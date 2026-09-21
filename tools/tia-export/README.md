# tools/tia-export — esportazione dei sorgenti PLC via TIA Openness V20

Console C# che apre il progetto TIA Portal **senza interfaccia**
(`TiaPortalMode.WithoutUserInterface`) e, per ogni blocco di programma della
CPU, genera il sorgente testuale con
`PlcExternalSourceSystemGroup.GenerateSource`, un file per blocco, in `plc/`.
Non usa l'export SimaticML (XML, non diffabile). Il progetto viene aperto e
chiuso **senza salvare**: il tool legge soltanto.

Convenzione di `plc/` e regola operativa: [`plc/README.md`](../../plc/README.md).

## Prerequisiti

1. **TIA Portal V20** installato sulla macchina, con l'opzione *TIA Openness*.
   La `Siemens.Engineering.dll` **non** sta nel repo: in compilazione è
   referenziata da `C:\Program Files\Siemens\Automation\Portal V20\PublicAPI\V20`
   (sovrascrivibile con `dotnet build -p:TiaPublicApiDir=...`), a runtime il
   tool la trova tramite il registro
   (`HKLM\SOFTWARE\Siemens\Automation\Openness\20.0\PublicAPI\20.0.0.0`).
2. **Account Windows nel gruppo locale `Siemens TIA Openness`**. Lo aggiunge
   un amministratore (`Gestione computer → Utenti e gruppi locali`, oppure
   `net localgroup "Siemens TIA Openness" <utente> /add`), poi bisogna
   **disconnettersi e rientrare** in Windows. Il tool lo verifica all'avvio.
3. **.NET Framework 4.8** (runtime) e, per compilare, un .NET SDK con il
   targeting pack 4.8.

### Target .NET: Framework 4.8

Scelto verificando l'assembly installato: `PublicAPI\V20\Siemens.Engineering.dll`
dichiara `TargetFramework = .NETFramework,Version=v4.8` e in `PublicAPI\V20`
non c'è una variante per .NET 8.

> **Da ricontrollare sulla documentazione Openness V20** (manuale di sistema
> *TIA Portal Openness*, capitolo sui requisiti software) prima di valutare un
> passaggio a .NET 8: se Siemens pubblica un'API per .NET 8, qui cambia solo
> il `TargetFramework` nel `.csproj` e il percorso della DLL.

## Configurazione — `appsettings.json`

```json
{
  "ProjectDir": "C:\\Users\\biagi\\Desktop\\CartellaFileADMG\\ADMG\\EasyBox V2026_1_5",
  "OutputDir": "plc",
  "PlcName": ""
}
```

| Chiave       | Significato                                                                 |
|--------------|-----------------------------------------------------------------------------|
| `ProjectDir` | Cartella del progetto TIA. Il tool cerca lì dentro l'unico file `.ap20`.     |
| `OutputDir`  | Cartella di output. Se relativa, è relativa alla radice del repo git.       |
| `PlcName`    | Nome della CPU (o del dispositivo). Vuoto = l'unica CPU del progetto.       |

Il file viene copiato accanto all'eseguibile in compilazione: dopo averlo
modificato, ricompilare (o modificare la copia in `bin\...\net48\`).

## Uso

```powershell
cd tools\tia-export
dotnet build -c Release
.\bin\Release\net48\tia-export.exe
```

Prima di lanciarlo **chiudere il progetto in TIA Portal**: un progetto già
aperto è bloccato e il tool si ferma con un messaggio.

Al **primo avvio** (e dopo ogni ricompilazione, perché cambia l'hash
dell'eseguibile) TIA può mostrare la finestra di consenso *TIA Portal
Openness — accesso*: confermare per consentire l'accesso.

L'avvio di TIA senza interfaccia e l'apertura del progetto richiedono qualche
minuto.

### Cosa fa

- Blocchi da `OB/`, `FB/`, `FC/` in SCL → `.scl` (STL → `.awl`); DB globali,
  di istanza e array DB → `DB/*.db`; tipi di dati PLC → `UDT/*.udt`.
  Un file per blocco, nome = nome del blocco.
- **Salta**, e lo riporta come "saltato" (non come errore), con il motivo:
  blocchi **safety (F-)** (riconosciuti dal linguaggio `F_*`), blocchi
  **know-how protected**, blocchi **LAD/FBD/GRAPH** (con le righe già pronte
  per la tabella "leggere in TIA" di `plc/README.md`) e **blocchi di sistema**.
- **Idempotente**: genera tutto in una cartella temporanea, confronta byte per
  byte con `plc/` e scrive solo i file cambiati. Cancella da `OB/ FB/ FC/ DB/
  UDT/` i sorgenti dei blocchi che non esistono più. `tags/` non viene toccata.
- Se un blocco va in errore, il suo sorgente precedente resta al suo posto e
  la cancellazione dei sorgenti obsoleti viene sospesa per quella corsa.

### Riepilogo ed exit code

A fine corsa stampa gli esportati (per cartella), i saltati raggruppati per
motivo, gli errori e i file cambiati rispetto alla corsa precedente
(`A` aggiunto, `M` modificato, `D` rimosso).

| Exit code | Significato                                                      |
|-----------|------------------------------------------------------------------|
| 0         | tutto esportato (saltati esclusi)                                 |
| 1         | alcuni blocchi in errore, gli altri esportati                    |
| 2         | errore bloccante (configurazione, gruppo Openness, progetto…): `plc/` non toccata |

Il tool non esegue nessuna operazione git.
