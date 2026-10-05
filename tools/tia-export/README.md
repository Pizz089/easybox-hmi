# tools/tia-export — esportazione dei sorgenti PLC via TIA Openness V20

Console C# che apre il progetto TIA Portal **senza interfaccia**
(`TiaPortalMode.WithoutUserInterface`) e scrive in `plc/`, un file per oggetto:

- per i blocchi SCL/STL, i DB e i tipi di dati PLC il **sorgente testuale**
  (`PlcExternalSourceSystemGroup.GenerateSource`);
- per i blocchi **LAD/FBD**, che un sorgente testuale non ce l'hanno, l'XML
  SimaticML (`PlcBlock.Export`);
- per le **tabelle variabili** (variabili e costanti utente) l'XML SimaticML
  (`PlcTagTable.Export`);
- a richiesta (`--compare-online`) un report del **confronto progetto / PLC
  online** (`PlcSoftware.CompareToOnline`).

Il progetto viene aperto e chiuso **senza salvare**: il tool legge soltanto.

Convenzione di `plc/` e regola operativa: [`plc/README.md`](../../plc/README.md).

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
.\bin\Release\net48\tia-export.exe                     # export
.\bin\Release\net48\tia-export.exe --compare-online    # export + confronto con il PLC
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
- OB, FB, FC in **LAD/FBD** (anche IEC) → `LAD/<nome blocco>.xml`, tutti nella
  stessa cartella qualunque sia il tipo di blocco.
- Ogni tabella variabili PLC (anche nei sottogruppi), con variabili e costanti
  utente → `tags/<nome tabella>.xml`. Le costanti di sistema non sono incluse.
- **Salta**, e lo riporta come "saltato" (non come errore), con il motivo:
  blocchi **safety (F-)** (riconosciuti dal linguaggio `F_*`, quindi anche
  `F_LAD`/`F_FBD`), blocchi **know-how protected**, blocchi **GRAPH** e altri
  linguaggi senza export (con le righe già pronte per la tabella "leggere in
  TIA" di `plc/README.md`) e **blocchi di sistema**.
- **Idempotente**: genera tutto in una cartella temporanea, confronta byte per
  byte con `plc/` e scrive solo i file cambiati. Cancella da `OB/ FB/ FC/ DB/
  UDT/` i sorgenti dei blocchi che non esistono più, e da `LAD/` e `tags/` gli
  `.xml` di blocchi e tabelle spariti; altri file in quelle cartelle (es.
  `.gitkeep`, CSV fatti a mano) non vengono toccati.
- Se un oggetto va in errore, il suo file precedente resta al suo posto e la
  cancellazione dei file obsoleti viene sospesa per quella corsa.

### XML SimaticML: cosa contiene e perché è stabile

Gli export partono con `ExportOptions.None` e `DocumentInfoOptions.None`, che
lasciano fuori proprio ciò che cambierebbe da una corsa all'altra:

- `DocumentInfoOptions.None` toglie il blocco `<DocumentInfo>` (data e ora
  dell'export, impostazioni, prodotti installati);
- `ExportOptions.None` toglie gli attributi di sola lettura e quelli ai valori
  di default: niente `CreationDate`, `ModifiedDate`, `CodeModifiedDate`,
  `CompileDate`, `InterfaceModifiedDate`, `IsConsistent`...

Restano due tipi di identificatori, entrambi stabili, quindi il tool non
riscrive né filtra l'XML:

- `ID="0"`, `ID="1"`, … sugli elementi: numerazione progressiva dentro il file,
  rigenerata uguale a ogni export dello stesso contenuto;
- `UId="21"`, … nelle reti LAD/FBD: sono salvati nel blocco e cambiano solo se
  si modifica la rete (in quel caso il diff è reale).

Verificato con due corse consecutive sul progetto vero: zero file cambiati.

**Blocchi non compilati.** Openness rifiuta l'export SimaticML di un blocco
inconsistente ("Inconsistent blocks and PLC data types (UDT) cannot be
exported"): il blocco finisce fra gli **errori**, il suo XML precedente resta e
la rimozione dei file obsoleti è sospesa. Rimedio: compilare in TIA, salvare,
rilanciare. Il tool non compila da sé, perché non modifica il progetto.

### Confronto online (`--compare-online`)

Dopo l'export il tool va online con la CPU usando la **connessione salvata nel
progetto** (interfaccia PG/PC e indirizzo dell'ultimo "Collega online" fatto in
TIA), chiama `PlcSoftware.CompareToOnline()` e torna offline. È **sola lettura**:
nessun download, nessun upload, nessuna modifica al PLC; il progetto si chiude
comunque senza salvare.

Il report va in `plc/COMPARE.txt`: una riga per oggetto (blocchi, tipi,
tabelle… e le cartelle il cui stato proprio differisce), ordinate per stato e
poi per percorso:

| Stato          | Significato (`CompareResultState`)                 |
|----------------|----------------------------------------------------|
| `diverso`      | `ObjectsDifferent` (o cartella con stato diverso)  |
| `solo offline` | `RightMissing`: nel progetto, non nel PLC          |
| `solo online`  | `LeftMissing`: nel PLC, non nel progetto           |
| `uguale`       | `ObjectsIdentical`                                 |

Il file non contiene date: a progetto e PLC invariati non cambia, e il diff
mostra solo gli stati che si sono spostati. Viene scritto solo dalle corse con
`--compare-online`: le corse normali lo lasciano com'è (fotografia dell'ultimo
confronto, la data è quella del commit).

Se il collegamento non riesce (PLC non raggiungibile, nessuna connessione
salvata nel progetto, CPU protetta da password, certificato da confermare…)
l'export resta valido, `COMPARE.txt` **non** viene aggiornato, il riepilogo
stampa il motivo e l'exit code è 1.

### Riepilogo ed exit code

A fine corsa stampa gli esportati (per cartella: `OB FB FC DB UDT LAD tags`),
i saltati raggruppati per motivo, gli errori e i file cambiati rispetto alla
corsa precedente (`A` aggiunto, `M` modificato, `D` rimosso), compreso
`COMPARE.txt`. Con `--compare-online` aggiunge i conteggi per stato del
confronto, oppure il motivo per cui non è riuscito.

| Exit code | Significato                                                      |
|-----------|------------------------------------------------------------------|
| 0         | tutto esportato (saltati esclusi) e, se richiesto, confronto riuscito |
| 1         | alcuni oggetti in errore, oppure confronto online non riuscito; il resto è esportato |
| 2         | errore bloccante (configurazione, gruppo Openness, progetto…): `plc/` non toccata |

Il tool non esegue nessuna operazione git.
