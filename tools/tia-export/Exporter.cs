using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.ExternalSources;
using Siemens.Engineering.SW.Types;

namespace TiaExport
{
    internal enum Outcome { Exported, Skipped, Error }

    /// <summary>Perché un blocco non è stato esportato. L'ordine è quello del riepilogo.</summary>
    internal enum SkipReason { Safety, KnowHowProtected, Graphical, System, Unsupported }

    internal sealed class BlockResult
    {
        public string Name;
        public string Folder;          // OB, FB, FC, DB, UDT
        public string Language;
        public string GroupPath;       // gruppo nell'albero TIA, per il log
        public Outcome Outcome;
        public SkipReason Skip;
        public string Detail;          // motivo del salto o messaggio d'errore
        public string RelativePath;    // es. FB/FB_ExecuteQuery.scl (esportati ed errori)
        public string TempFile;        // sorgente generato (solo esportati)
    }

    /// <summary>
    /// Apre il progetto TIA senza interfaccia e genera un sorgente esterno per ogni
    /// blocco e tipo di dato della CPU, un file per blocco, in una cartella temporanea.
    /// </summary>
    internal sealed class Exporter
    {
        private static readonly string[] FolderOrder = { "OB", "FB", "FC", "DB", "UDT" };
        public static IReadOnlyList<string> ManagedFolders => FolderOrder;

        private readonly string _tempRoot;
        private readonly List<BlockResult> _results = new List<BlockResult>();
        private readonly HashSet<string> _targets = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private PlcExternalSourceSystemGroup _sources;

        public Exporter(string tempRoot)
        {
            _tempRoot = tempRoot;
        }

        public IList<BlockResult> Run(FileInfo projectFile, string plcName)
        {
            Console.WriteLine("Avvio TIA Portal V20 senza interfaccia (può richiedere qualche minuto)...");
            using (var tia = new TiaPortal(TiaPortalMode.WithoutUserInterface))
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
                    var plc = FindPlc(project, plcName);
                    Console.WriteLine("CPU: " + plc.Name);
                    _sources = plc.ExternalSourceGroup;

                    WalkBlocks(plc.BlockGroup, "");
                    foreach (PlcSystemBlockGroup systemGroup in plc.BlockGroup.SystemBlockGroups)
                        WalkSystemBlocks(systemGroup, systemGroup.Name);

                    WalkTypes(plc.TypeGroup, "");
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

        private static PlcSoftware FindPlc(Project project, string plcName)
        {
            var found = new List<Tuple<string, PlcSoftware>>();
            foreach (var device in AllDevices(project))
                foreach (var item in AllItems(device.DeviceItems))
                {
                    var container = item.GetService<SoftwareContainer>();
                    if (container?.Software is PlcSoftware plc)
                        found.Add(Tuple.Create(device.Name, plc));
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
                return match.Item2;
            }

            if (found.Count > 1)
                throw new FatalException("Il progetto contiene più CPU: impostare PlcName in appsettings.json. Disponibili: " + DescribePlcs(found));
            return found[0].Item2;
        }

        private static string DescribePlcs(IEnumerable<Tuple<string, PlcSoftware>> plcs) =>
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
            var r = new BlockResult { Name = block.Name, GroupPath = groupPath, Folder = FolderOf(block) };
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
            var r = new BlockResult { Name = type.Name, GroupPath = groupPath, Folder = "UDT", Language = "UDT" };
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

        // ---- generazione -------------------------------------------------------------

        private void Generate(BlockResult r, IGenerateSource item, string extension)
        {
            var fileName = SafeFileName(r.Name) + extension;
            r.RelativePath = r.Folder + "/" + fileName;

            if (!_targets.Add(r.RelativePath))
            {
                // Nome file già usato (nomi che differiscono solo per caratteri non validi o maiuscole).
                r.Outcome = Outcome.Error;
                r.Detail = "nome file già usato da un altro blocco: " + r.RelativePath;
                r.RelativePath = null;
                return;
            }

            var dir = Directory.CreateDirectory(Path.Combine(_tempRoot, r.Folder));
            var file = new FileInfo(Path.Combine(dir.FullName, fileName));
            if (file.Exists) file.Delete();

            _sources.GenerateSource(new[] { item }, file, GenerateOptions.None);

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
