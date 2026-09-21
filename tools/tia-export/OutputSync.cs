using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace TiaExport
{
    internal enum ChangeKind { Added, Modified, Removed }

    internal sealed class FileChange
    {
        public ChangeKind Kind;
        public string RelativePath;   // relativo alla cartella di output, separatore '/'
    }

    /// <summary>
    /// Porta nella cartella di output i sorgenti generati, scrivendo solo i file il cui
    /// contenuto è cambiato: a progetto invariato non si tocca nulla e git non vede diff.
    /// </summary>
    internal static class OutputSync
    {
        private static readonly string[] ManagedExtensions = { ".scl", ".awl", ".db", ".udt" };

        /// <param name="allowRemovals">
        /// false quando la corsa ha avuto errori: un blocco fallito non deve far sparire
        /// il suo sorgente precedente.
        /// </param>
        public static List<FileChange> Apply(string outputRoot, IEnumerable<BlockResult> results, bool allowRemovals)
        {
            var changes = new List<FileChange>();
            var produced = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var r in results.Where(x => x.Outcome == Outcome.Exported).OrderBy(x => x.RelativePath, StringComparer.OrdinalIgnoreCase))
            {
                produced.Add(r.RelativePath);
                var target = Path.Combine(outputRoot, r.RelativePath.Replace('/', Path.DirectorySeparatorChar));
                var generated = File.ReadAllBytes(r.TempFile);

                ChangeKind? kind = null;
                if (!File.Exists(target))
                    kind = ChangeKind.Added;
                else if (!generated.SequenceEqual(File.ReadAllBytes(target)))
                    kind = ChangeKind.Modified;

                if (kind == null)
                    continue;

                Directory.CreateDirectory(Path.GetDirectoryName(target));
                File.WriteAllBytes(target, generated);
                changes.Add(new FileChange { Kind = kind.Value, RelativePath = r.RelativePath });
            }

            if (!allowRemovals)
                return changes;

            // Sorgenti di blocchi non più esportati (cancellati, rinominati, convertiti in LAD...).
            foreach (var folder in Exporter.ManagedFolders)
            {
                var dir = Path.Combine(outputRoot, folder);
                if (!Directory.Exists(dir))
                    continue;

                foreach (var file in Directory.GetFiles(dir).OrderBy(f => f, StringComparer.OrdinalIgnoreCase))
                {
                    if (!ManagedExtensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase))
                        continue;
                    var rel = folder + "/" + Path.GetFileName(file);
                    if (produced.Contains(rel))
                        continue;
                    File.Delete(file);
                    changes.Add(new FileChange { Kind = ChangeKind.Removed, RelativePath = rel });
                }
            }
            return changes;
        }
    }
}
