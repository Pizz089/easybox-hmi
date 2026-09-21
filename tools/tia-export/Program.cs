using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32;

namespace TiaExport
{
    internal static class Program
    {
        private const string OpennessGroup = "Siemens TIA Openness";
        private const string PublicApiRegistryKey = @"SOFTWARE\Siemens\Automation\Openness\20.0\PublicAPI\20.0.0.0";

        private static int Main()
        {
            Console.OutputEncoding = Encoding.UTF8;

            // Siemens.Engineering.dll non sta nella bin: va caricata dall'installazione di TIA
            // prima che venga compilato qualunque metodo che usa i suoi tipi (vedi Run).
            AppDomain.CurrentDomain.AssemblyResolve += ResolveSiemensAssembly;

            try
            {
                return Run();
            }
            catch (FatalException ex)
            {
                Console.Error.WriteLine("ERRORE: " + ex.Message);
                return 2;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("ERRORE inatteso: " + ex);
                return 2;
            }
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static int Run()
        {
            var settings = Settings.Load(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "appsettings.json"));
            var projectFile = FindProjectFile(settings.ProjectDir);
            var outputRoot = ResolveOutputRoot(settings.OutputDir);
            LocatePublicApi();
            CheckOpennessGroup();

            Console.WriteLine("Progetto: " + projectFile.FullName);
            Console.WriteLine("Output:   " + outputRoot);

            return ExportAndSync(projectFile, outputRoot, settings.PlcName);
        }

        // Metodo separato: i tipi Siemens si caricano solo quando viene compilato questo,
        // cioè dopo LocatePublicApi.
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static int ExportAndSync(FileInfo projectFile, string outputRoot, string plcName)
        {
            var tempRoot = Path.Combine(Path.GetTempPath(), "tia-export-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempRoot);
            try
            {
                var results = new Exporter(tempRoot).Run(projectFile, plcName);
                var errors = results.Count(r => r.Outcome == Outcome.Error);
                var changes = OutputSync.Apply(outputRoot, results, allowRemovals: errors == 0);
                PrintSummary(results, changes, RelativeToRepo(outputRoot), removalsSuspended: errors > 0);
                return errors == 0 ? 0 : 1;
            }
            finally
            {
                try { Directory.Delete(tempRoot, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
            }
        }

        // ---- prerequisiti ------------------------------------------------------------

        private static string _publicApiDir;

        /// <summary>Cartella PublicAPI di TIA V20, letta dal registro come indica Siemens.</summary>
        private static void LocatePublicApi()
        {
            string engineeringDll;
            using (var hklm = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64))
            using (var key = hklm.OpenSubKey(PublicApiRegistryKey))
                engineeringDll = key?.GetValue("Siemens.Engineering") as string;

            if (string.IsNullOrEmpty(engineeringDll) || !File.Exists(engineeringDll))
                throw new FatalException("TIA Portal V20 Openness non installato: chiave HKLM\\" + PublicApiRegistryKey + " assente o DLL mancante.");
            _publicApiDir = Path.GetDirectoryName(engineeringDll);
        }

        private static Assembly ResolveSiemensAssembly(object sender, ResolveEventArgs args)
        {
            var name = new AssemblyName(args.Name).Name;
            if (_publicApiDir == null || !name.StartsWith("Siemens.Engineering", StringComparison.Ordinal))
                return null;
            var path = Path.Combine(_publicApiDir, name + ".dll");
            return File.Exists(path) ? Assembly.LoadFrom(path) : null;
        }

        private static void CheckOpennessGroup()
        {
            var identity = WindowsIdentity.GetCurrent();
            bool member;
            try { member = new WindowsPrincipal(identity).IsInRole(OpennessGroup); }
            catch (SystemException) { member = false; }   // gruppo inesistente = TIA Openness non installato

            if (!member)
                throw new FatalException(
                    "l'utente " + identity.Name + " non è nel gruppo Windows '" + OpennessGroup + "'.\n" +
                    "  Aggiungerlo (serve un amministratore), poi disconnettersi e rientrare in Windows.");
        }

        private static FileInfo FindProjectFile(string projectDir)
        {
            if (!Directory.Exists(projectDir))
                throw new FatalException("Cartella del progetto TIA non trovata: " + projectDir);

            var files = Directory.GetFiles(projectDir, "*.ap20", SearchOption.TopDirectoryOnly);
            if (files.Length == 0)
                throw new FatalException("Nessun file .ap20 in " + projectDir);
            if (files.Length > 1)
                throw new FatalException("Più file .ap20 in " + projectDir + ": " + string.Join(", ", files.Select(Path.GetFileName)));
            return new FileInfo(files[0]);
        }

        private static string _repoRoot;

        private static string ResolveOutputRoot(string outputDir)
        {
            _repoRoot = FindRepoRoot(AppDomain.CurrentDomain.BaseDirectory);
            if (Path.IsPathRooted(outputDir))
                return Path.GetFullPath(outputDir);
            if (_repoRoot == null)
                throw new FatalException("OutputDir '" + outputDir + "' è relativo ma il tool non è dentro un repository git.");
            return Path.GetFullPath(Path.Combine(_repoRoot, outputDir));
        }

        private static string FindRepoRoot(string start)
        {
            for (var dir = new DirectoryInfo(start); dir != null; dir = dir.Parent)
                if (Directory.Exists(Path.Combine(dir.FullName, ".git")) || File.Exists(Path.Combine(dir.FullName, ".git")))
                    return dir.FullName;
            return null;
        }

        private static string RelativeToRepo(string path)
        {
            if (_repoRoot != null && path.StartsWith(_repoRoot, StringComparison.OrdinalIgnoreCase))
                path = path.Substring(_repoRoot.Length).TrimStart(Path.DirectorySeparatorChar);
            return path.Replace(Path.DirectorySeparatorChar, '/');
        }

        // ---- riepilogo ---------------------------------------------------------------

        private static void PrintSummary(IList<BlockResult> results, List<FileChange> changes, string outputPrefix, bool removalsSuspended)
        {
            var exported = results.Where(r => r.Outcome == Outcome.Exported).ToList();
            var skipped = results.Where(r => r.Outcome == Outcome.Skipped).ToList();
            var errors = results.Where(r => r.Outcome == Outcome.Error).ToList();

            Console.WriteLine();
            Console.WriteLine("==== Riepilogo ====");
            var perFolder = Exporter.ManagedFolders
                .Select(f => f + " " + exported.Count(r => r.Folder == f))
                .ToArray();
            Console.WriteLine("Esportati: " + exported.Count + "  (" + string.Join(", ", perFolder) + ")");
            Console.WriteLine("Saltati:   " + skipped.Count);
            Console.WriteLine("Errori:    " + errors.Count);

            foreach (var group in skipped.GroupBy(r => r.Skip).OrderBy(g => g.Key))
            {
                Console.WriteLine();
                Console.WriteLine("Saltati - " + Describe(group.Key) + " (" + group.Count() + "):");
                foreach (var r in group.OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase))
                    Console.WriteLine("  " + Label(r) + "  - " + r.Detail);
            }

            var graphical = skipped.Where(r => r.Skip == SkipReason.Graphical).OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase).ToList();
            if (graphical.Count > 0)
            {
                Console.WriteLine();
                Console.WriteLine("Righe per la tabella \"leggere in TIA\" di plc/README.md:");
                foreach (var r in graphical)
                    Console.WriteLine("| " + r.Name + " | " + r.Language + " | Leggere in TIA Portal, non esportabile come testo |");
            }

            if (errors.Count > 0)
            {
                Console.WriteLine();
                Console.WriteLine("Errori (" + errors.Count + "):");
                foreach (var r in errors.OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase))
                    Console.WriteLine("  " + Label(r) + "  - " + r.Detail);
            }

            Console.WriteLine();
            if (changes.Count == 0)
                Console.WriteLine("Nessun file cambiato rispetto alla corsa precedente.");
            else
            {
                Console.WriteLine("File cambiati rispetto alla corsa precedente (" + changes.Count + "):");
                foreach (var c in changes.OrderBy(c => c.RelativePath, StringComparer.OrdinalIgnoreCase))
                    Console.WriteLine("  " + Marker(c.Kind) + " " + outputPrefix + "/" + c.RelativePath);
            }

            if (removalsSuspended)
                Console.WriteLine("Rimozione dei sorgenti obsoleti sospesa: la corsa ha avuto errori, i file dei blocchi falliti restano quelli precedenti.");
        }

        private static string Label(BlockResult r)
        {
            var kind = r.Folder ?? "?";
            var where = string.IsNullOrEmpty(r.GroupPath) ? "" : "  [" + r.GroupPath + "]";
            return kind + " " + r.Name + where;
        }

        private static string Describe(SkipReason reason)
        {
            switch (reason)
            {
                case SkipReason.Safety: return "safety (F-)";
                case SkipReason.KnowHowProtected: return "know-how protected";
                case SkipReason.Graphical: return "LAD/FBD/GRAPH, leggere in TIA";
                case SkipReason.System: return "blocchi di sistema";
                default: return "non supportati";
            }
        }

        private static string Marker(ChangeKind kind)
        {
            switch (kind)
            {
                case ChangeKind.Added: return "A";
                case ChangeKind.Modified: return "M";
                default: return "D";
            }
        }
    }
}
