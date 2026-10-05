using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Siemens.Engineering;
using Siemens.Engineering.Compare;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using Siemens.Engineering.Online;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.ExternalSources;
using Siemens.Engineering.SW.Tags;
using Siemens.Engineering.SW.Types;

namespace TiaExport
{
    internal enum Outcome { Exported, Skipped, Error }

    /// <summary>Perché un blocco non è stato esportato. L'ordine è quello del riepilogo.</summary>
    internal enum SkipReason { Safety, KnowHowProtected, Graphical, System, Unsupported }

    internal sealed class BlockResult
    {
        public string Name;
        public string Kind;            // OB, FB, FC, DB, UDT, TAG: tipo dell'oggetto, per il log
        public string Folder;          // cartella di output: OB, FB, FC, DB, UDT, LAD, tags
        public string Language;
        public string GroupPath;       // gruppo nell'albero TIA, per il log
        public Outcome Outcome;
        public SkipReason Skip;
        public string Detail;          // motivo del salto o messaggio d'errore
        public string RelativePath;    // es. FB/FB_ExecuteQuery.scl (esportati ed errori)
        public string TempFile;        // file generato (solo esportati)
    }

    /// <summary>Esito del confronto progetto / PLC online. Report null = confronto non riuscito.</summary>
    internal sealed class CompareOutcome
    {
        public string Report;
        public string Error;
        public readonly Dictionary<string, int> Counts = new Dictionary<string, int>();
    }

    /// <summary>
    /// Apre il progetto TIA senza interfaccia e genera, in una cartella temporanea, un
    /// sorgente esterno per ogni blocco SCL/STL e tipo di dato della CPU e l'XML SimaticML
    /// dei blocchi LAD/FBD e delle tabelle variabili, un file per oggetto.
    /// A richiesta confronta il progetto con il PLC online.
    /// </summary>
    internal sealed class Exporter
    {
        private static readonly string[] FolderOrder = { "OB", "FB", "FC", "DB", "UDT", "LAD", "tags" };
        public static IReadOnlyList<string> ManagedFolders => FolderOrder;

        private readonly string _tempRoot;
        private readonly List<BlockResult> _results = new List<BlockResult>();
        private readonly HashSet<string> _targets = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private PlcExternalSourceSystemGroup _sources;

        public Exporter(string tempRoot)
        {
            _tempRoot = tempRoot;
        }

        /// <summary>Valorizzato solo se Run è chiamato con compareOnline.</summary>
        public CompareOutcome Compare { get; private set; }

        public IList<BlockResult> Run(FileInfo projectFile, string plcName, bool compareOnline)
        {
            Console.WriteLine("Avvio TIA Portal V20 senza interfaccia (può richiedere qualche minuto)...");
            TiaPortal portal;
            try
            {
                portal = new TiaPortal(TiaPortalMode.WithoutUserInterface);
            }
            catch (EngineeringSecurityException ex)
            {
                throw new FatalException(
                    "accesso Openness negato o non confermato. Dopo ogni ricompilazione TIA chiede il consenso nella " +
                    "finestra 'TIA Portal Openness': rilanciare e confermarla entro il timeout.\n  " + ex.Message, ex);
            }

            using (var tia = portal)
            {
                Console.WriteLine("Apertura progetto " + projectFile.FullName);
                Project project;
                try
                {
                    project = tia.Projects.Open(projectFile);
                }
                catch (Exception ex)
                {
                    throw new FatalException(
                        "Impossibile aprire il progetto. Se è aperto in TIA Portal, chiuderlo e rilanciare.\n  " + ex.Message, ex);
                }

                try
                {
                    var cpu = FindPlc(project, plcName);
                    var plc = cpu.Item2;
                    Console.WriteLine("CPU: " + plc.Name);
                    _sources = plc.ExternalSourceGroup;

                    WalkBlocks(plc.BlockGroup, "");
                    foreach (PlcSystemBlockGroup systemGroup in plc.BlockGroup.SystemBlockGroups)
                        WalkSystemBlocks(systemGroup, systemGroup.Name);

                    WalkTypes(plc.TypeGroup, "");
                    WalkTagTables(plc.TagTableGroup.TagTables, plc.TagTableGroup.Groups, "");

                    if (compareOnline)
                        Compare = CompareToOnline(cpu.Item1, plc);
                }
                finally
                {
                    // Nessun salvataggio: il tool legge soltanto.
                    project.Close();
                }
            }
            return _results;
        }

        // ---- ricerca della CPU -------------------------------------------------------

        /// <summary>La CPU (il DeviceItem che porta il software, serve per andare online) e il suo software.</summary>
        private static Tuple<DeviceItem, PlcSoftware> FindPlc(Project project, string plcName)
        {
            var found = new List<Tuple<string, PlcSoftware, DeviceItem>>();
            foreach (var device in AllDevices(project))
                foreach (var item in AllItems(device.DeviceItems))
                {
                    var container = item.GetService<SoftwareContainer>();
                    if (container?.Software is PlcSoftware plc)
                        found.Add(Tuple.Create(device.Name, plc, item));
                }

            if (found.Count == 0)
                throw new FatalException("Nessuna CPU trovata nel progetto.");

            if (!string.IsNullOrWhiteSpace(plcName))
            {
                var match = found.FirstOrDefault(f =>
                    string.Equals(f.Item2.Name, plcName, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(f.Item1, plcName, StringComparison.OrdinalIgnoreCase));
                if (match == null)
                    throw new FatalException("CPU '" + plcName + "' non trovata. Disponibili: " + DescribePlcs(found));
                return Tuple.Create(match.Item3, match.Item2);
            }

            if (found.Count > 1)
                throw new FatalException("Il progetto contiene più CPU: impostare PlcName in appsettings.json. Disponibili: " + DescribePlcs(found));
            return Tuple.Create(found[0].Item3, found[0].Item2);
        }

        private static string DescribePlcs(IEnumerable<Tuple<string, PlcSoftware, DeviceItem>> plcs) =>
            string.Join(", ", plcs.Select(p => p.Item2.Name + " (dispositivo " + p.Item1 + ")"));

        private static IEnumerable<Device> AllDevices(Project project)
        {
            foreach (Device d in project.Devices)
                yield return d;
            foreach (DeviceUserGroup g in project.DeviceGroups)
                foreach (var d in AllDevices(g))
                    yield return d;
        }

        private static IEnumerable<Device> AllDevices(DeviceUserGroup group)
        {
            foreach (Device d in group.Devices)
                yield return d;
            foreach (DeviceUserGroup g in group.Groups)
                foreach (var d in AllDevices(g))
                    yield return d;
        }

        private static IEnumerable<DeviceItem> AllItems(DeviceItemComposition items)
        {
            foreach (DeviceItem item in items)
            {
                yield return item;
                foreach (var child in AllItems(item.DeviceItems))
                    yield return child;
            }
        }

        // ---- blocchi -----------------------------------------------------------------

        private void WalkBlocks(PlcBlockGroup group, string path)
        {
            foreach (PlcBlock block in group.Blocks)
                HandleBlock(block, path, false);
            foreach (PlcBlockUserGroup sub in group.Groups)
                WalkBlocks(sub, Combine(path, sub.Name));
        }

        // I gruppi di sistema (es. quelli generati dal programma safety) non derivano da PlcBlockGroup.
        private void WalkSystemBlocks(PlcSystemBlockGroup group, string path)
        {
            foreach (PlcBlock block in group.Blocks)
                HandleBlock(block, path, true);
            foreach (PlcSystemBlockGroup sub in group.Groups)
                WalkSystemBlocks(sub, Combine(path, sub.Name));
        }

        private void HandleBlock(PlcBlock block, string groupPath, bool isSystem)
        {
            var kind = FolderOf(block);
            var r = new BlockResult { Name = block.Name, GroupPath = groupPath, Kind = kind, Folder = kind };
            _results.Add(r);

            try
            {
                if (IsKnowHowProtected(block))
                {
                    SetSkipped(r, SkipReason.KnowHowProtected, "blocco know-how protected");
                    return;
                }

                var language = block.ProgrammingLanguage;
                r.Language = language.ToString();

                if (r.Language.StartsWith("F_", StringComparison.Ordinal))
                {
                    SetSkipped(r, SkipReason.Safety, "blocco safety (" + r.Language + "): Openness non ne genera il sorgente");
                    return;
                }
                if (isSystem)
                {
                    SetSkipped(r, SkipReason.System, "blocco di sistema generato da TIA (gruppo '" + groupPath + "')");
                    return;
                }
                if (r.Folder == null)
                {
                    SetSkipped(r, SkipReason.Unsupported, "tipo di blocco non gestito: " + block.GetType().Name);
                    return;
                }

                string extension;
                if (block is DataBlock)
                {
                    if (language != ProgrammingLanguage.DB)
                    {
                        SetSkipped(r, SkipReason.Unsupported, "DB di tipo " + r.Language + ": nessun sorgente generabile");
                        return;
                    }
                    extension = ".db";
                }
                else if (language == ProgrammingLanguage.SCL)
                    extension = ".scl";
                else if (language == ProgrammingLanguage.STL)
                    extension = ".awl";
                else if (IsLadOrFbd(language))
                {
                    // Nessun sorgente testuale: XML SimaticML, tutti nella stessa cartella.
                    r.Folder = "LAD";
                    ExportXml(r, file => block.Export(file, ExportOptions.None, DocumentInfoOptions.None));
                    return;
                }
                else
                {
                    SetSkipped(r, SkipReason.Graphical, "linguaggio " + r.Language + ": nessun sorgente testuale, leggere in TIA");
                    return;
                }

                Generate(r, block, extension);
            }
            catch (Exception ex)
            {
                SetError(r, ex);
            }
        }

        private static bool IsLadOrFbd(ProgrammingLanguage language) =>
            language == ProgrammingLanguage.LAD || language == ProgrammingLanguage.FBD ||
            language == ProgrammingLanguage.LAD_IEC || language == ProgrammingLanguage.FBD_IEC;

        private static string FolderOf(PlcBlock block)
        {
            if (block is OB) return "OB";
            if (block is FB) return "FB";
            if (block is FC) return "FC";
            if (block is DataBlock) return "DB";   // globali, di istanza, array DB
            return null;
        }

        private static bool IsKnowHowProtected(PlcBlock block)
        {
            try { return block.IsKnowHowProtected; }
            catch (EngineeringException) { return false; }
        }

        // ---- tipi di dato PLC --------------------------------------------------------

        private void WalkTypes(PlcTypeGroup group, string path)
        {
            // I tipi di sistema (SystemTypeGroups) non sono del progetto: non si esportano.
            foreach (PlcType type in group.Types)
                HandleType(type, path);
            foreach (PlcTypeUserGroup sub in group.Groups)
                WalkTypes(sub, Combine(path, sub.Name));
        }

        private void HandleType(PlcType type, string groupPath)
        {
            var r = new BlockResult { Name = type.Name, GroupPath = groupPath, Kind = "UDT", Folder = "UDT", Language = "UDT" };
            _results.Add(r);
            try
            {
                if (type.IsKnowHowProtected)
                {
                    SetSkipped(r, SkipReason.KnowHowProtected, "tipo di dato know-how protected");
                    return;
                }
                Generate(r, type, ".udt");
            }
            catch (Exception ex)
            {
                SetError(r, ex);
            }
        }

        // ---- tabelle variabili PLC ---------------------------------------------------

        // Il gruppo radice (PlcTagTableSystemGroup) e i gruppi utente non hanno una base comune.
        private void WalkTagTables(PlcTagTableComposition tables, PlcTagTableUserGroupComposition groups, string path)
        {
            foreach (PlcTagTable table in tables)
                HandleTagTable(table, path);
            foreach (PlcTagTableUserGroup sub in groups)
                WalkTagTables(sub.TagTables, sub.Groups, Combine(path, sub.Name));
        }

        private void HandleTagTable(PlcTagTable table, string groupPath)
        {
            var r = new BlockResult { Name = table.Name, GroupPath = groupPath, Kind = "TAG", Folder = "tags", Language = "tabella variabili" };
            _results.Add(r);
            try
            {
                // L'XML contiene variabili e costanti utente della tabella.
                ExportXml(r, file => table.Export(file, ExportOptions.None, DocumentInfoOptions.None));
            }
            catch (Exception ex)
            {
                SetError(r, ex);
            }
        }

        // ---- confronto online --------------------------------------------------------

        /// <summary>
        /// Sola lettura: va online con la connessione salvata nel progetto, confronta e torna
        /// offline. Nessun download né upload. Un errore qui non ferma l'export.
        /// </summary>
        private static CompareOutcome CompareToOnline(DeviceItem cpu, PlcSoftware plc)
        {
            var outcome = new CompareOutcome();
            var online = cpu.GetService<OnlineProvider>();
            if (online == null)
            {
                outcome.Error = "la CPU non offre il servizio OnlineProvider";
                return outcome;
            }

            var wentOnline = false;
            try
            {
                if (online.State != OnlineState.Online)
                {
                    Console.WriteLine("Collegamento online alla CPU (sola lettura)...");
                    wentOnline = true;
                    var state = online.GoOnline();
                    if (state != OnlineState.Online)
                    {
                        outcome.Error = "collegamento online non riuscito, stato " + state;
                        return outcome;
                    }
                }

                Console.WriteLine("Confronto progetto / PLC online...");
                var result = plc.CompareToOnline();
                var lines = new List<Tuple<string, string>>();
                CollectCompare(result.RootElement, "", lines);
                outcome.Report = FormatCompare(plc.Name, lines, outcome.Counts);
            }
            catch (Exception ex)
            {
                outcome.Error = ex.Message.Replace(Environment.NewLine, " ").Trim();
            }
            finally
            {
                if (wentOnline)
                {
                    try { online.GoOffline(); }
                    catch (Exception ex) { Console.Error.WriteLine("Attenzione: GoOffline non riuscito: " + ex.Message); }
                }
            }
            return outcome;
        }

        // Una riga per ogni oggetto foglia (blocco, tipo, tabella...) e per le cartelle con
        // uno stato proprio diverso; le altre cartelle si attraversano soltanto.
        private static void CollectCompare(CompareResultElement element, string parentPath, List<Tuple<string, string>> lines)
        {
            var name = !string.IsNullOrEmpty(element.LeftName) ? element.LeftName : element.RightName;
            var path = Combine(parentPath, name ?? "?");
            var children = element.Elements.ToList();
            var state = element.ComparisonResult;

            var ownStateDifferent = state == CompareResultState.FolderContainsDifferencesOwnStateDifferent ||
                                    state == CompareResultState.FolderContentEqualOwnStateDifferent;
            if (children.Count == 0 || ownStateDifferent)
            {
                var label = CompareLabel(state);
                if (label != null)
                    lines.Add(Tuple.Create(label, children.Count == 0 ? path : path + "/ (cartella)"));
            }
            foreach (var child in children)
                CollectCompare(child, path, lines);
        }

        private static string CompareLabel(CompareResultState state)
        {
            switch (state)
            {
                case CompareResultState.ObjectsIdentical:
                case CompareResultState.FolderContentsIdentical:
                    return "uguale";
                case CompareResultState.RightMissing:
                    return "solo offline";
                case CompareResultState.LeftMissing:
                    return "solo online";
                case CompareResultState.ObjectsDifferent:
                case CompareResultState.FolderContentsDifferent:
                case CompareResultState.FolderContainsDifferencesOwnStateDifferent:
                case CompareResultState.FolderContentEqualOwnStateDifferent:
                    return "diverso";
                default:
                    return null;   // CompareIrrelevant
            }
        }

        private static readonly string[] CompareOrder = { "diverso", "solo offline", "solo online", "uguale" };
        public static IReadOnlyList<string> CompareLabels => CompareOrder;

        // Nessuna data nel file: a progetto e PLC invariati il report non cambia.
        private static string FormatCompare(string plcName, List<Tuple<string, string>> lines, Dictionary<string, int> counts)
        {
            foreach (var label in CompareOrder)
                counts[label] = lines.Count(l => l.Item1 == label);

            var sb = new StringBuilder();
            sb.AppendLine("Confronto progetto (offline) / PLC online - CPU " + plcName);
            sb.AppendLine("Generato da tools/tia-export --compare-online. Non modificare a mano.");
            sb.AppendLine(string.Join(", ", CompareOrder.Select(l => l + " " + counts[l])));
            sb.AppendLine();
            sb.AppendLine("STATO         OGGETTO");
            foreach (var l in lines.OrderBy(l => Array.IndexOf(CompareOrder, l.Item1)).ThenBy(l => l.Item2, StringComparer.Ordinal))
                sb.AppendLine(l.Item1.PadRight(13) + " " + l.Item2);
            return sb.ToString();
        }

        // ---- generazione -------------------------------------------------------------

        private void Generate(BlockResult r, IGenerateSource item, string extension) =>
            Produce(r, extension, file => _sources.GenerateSource(new[] { item }, file, GenerateOptions.None));

        // ExportOptions.None e DocumentInfoOptions.None lasciano fuori date e info di export:
        // l'XML è già stabile fra due corse e non serve normalizzarlo (vedi README).
        private void ExportXml(BlockResult r, Action<FileInfo> export) =>
            Produce(r, ".xml", export);

        private void Produce(BlockResult r, string extension, Action<FileInfo> write)
        {
            var fileName = SafeFileName(r.Name) + extension;
            r.RelativePath = r.Folder + "/" + fileName;

            if (!_targets.Add(r.RelativePath))
            {
                // Nome file già usato (nomi che differiscono solo per caratteri non validi o maiuscole).
                r.Outcome = Outcome.Error;
                r.Detail = "nome file già usato da un altro oggetto: " + r.RelativePath;
                r.RelativePath = null;
                return;
            }

            var dir = Directory.CreateDirectory(Path.Combine(_tempRoot, r.Folder));
            var file = new FileInfo(Path.Combine(dir.FullName, fileName));
            if (file.Exists) file.Delete();   // Export rifiuta un file già esistente

            write(file);

            file.Refresh();
            if (!file.Exists)
                throw new InvalidOperationException("TIA non ha prodotto il file " + fileName);

            r.Outcome = Outcome.Exported;
            r.TempFile = file.FullName;
        }

        private static void SetSkipped(BlockResult r, SkipReason reason, string detail)
        {
            r.Outcome = Outcome.Skipped;
            r.Skip = reason;
            r.Detail = detail;
        }

        private static void SetError(BlockResult r, Exception ex)
        {
            r.Outcome = Outcome.Error;
            r.Detail = ex.Message.Replace(Environment.NewLine, " ").Trim();
            r.TempFile = null;
        }

        private static string SafeFileName(string name)
        {
            var invalid = Path.GetInvalidFileNameChars();
            return new string(name.Select(c => invalid.Contains(c) ? '_' : c).ToArray());
        }

        private static string Combine(string path, string name) =>
            path.Length == 0 ? name : path + "/" + name;
    }
}
