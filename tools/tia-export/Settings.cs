using System;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;

namespace TiaExport
{
    [DataContract]
    internal sealed class Settings
    {
        /// <summary>Cartella del progetto TIA: il file .ap20 viene cercato qui dentro.</summary>
        [DataMember] public string ProjectDir { get; set; }

        /// <summary>Cartella di output; se relativa, è relativa alla radice del repo.</summary>
        [DataMember] public string OutputDir { get; set; }

        /// <summary>Nome della CPU da esportare. Vuoto = l'unica CPU del progetto.</summary>
        [DataMember] public string PlcName { get; set; }

        public static Settings Load(string path)
        {
            if (!File.Exists(path))
                throw new FatalException("File di configurazione non trovato: " + path);

            Settings s;
            try
            {
                using (var stream = File.OpenRead(path))
                    s = (Settings)new DataContractJsonSerializer(typeof(Settings)).ReadObject(stream);
            }
            catch (SerializationException ex)
            {
                throw new FatalException("appsettings.json non valido: " + ex.Message);
            }

            if (string.IsNullOrWhiteSpace(s.ProjectDir))
                throw new FatalException("appsettings.json: ProjectDir mancante.");
            if (string.IsNullOrWhiteSpace(s.OutputDir))
                s.OutputDir = "plc";
            return s;
        }
    }

    /// <summary>Errore che interrompe la corsa prima di toccare l'output.</summary>
    internal sealed class FatalException : Exception
    {
        public FatalException(string message) : base(message) { }
        public FatalException(string message, Exception inner) : base(message, inner) { }
    }
}
