# plc/ — sorgenti esportati del PLC (S7-1500, TIA Portal V20)

Questa cartella contiene la **fotografia leggibile e confrontabile** dei blocchi
del PLC della cella EasyBox, esportati da TIA Portal come **testo**. Serve a
una cosa sola: avere una storia delle modifiche e poter fare un `git diff`
fra due versioni di un blocco. Oggi questo non esiste da nessun'altra parte.

> **La fonte di verità è TIA Portal, non questo repo.** Se il sorgente qui
> dentro e il blocco in TIA divergono, **vince TIA**: il repo è in ritardo e va
> rigenerato. Non modificare mai i file qui dentro a mano per "correggere" il
> PLC — le modifiche si fanno in TIA e poi si ri-esportano.

Il progetto TIA (file `.ap20` e albero di cartelle `IM/`, `System/`, `XRef/`,
…) **non va versionato**: è binario, cambia a ogni apertura, i diff sono
illeggibili e si corrompe se toccato fuori da TIA. Il `.gitignore` della
radice lo esclude esplicitamente.

## Struttura

| Cartella   | Contenuto                                              | Estensione generata da TIA |
|------------|--------------------------------------------------------|----------------------------|
| `blocks/`  | OB, FB, FC in SCL                                      | `.scl`                     |
| `db/`      | Blocchi dati globali e DB di istanza                   | `.db`                      |
| `types/`   | Tipi di dati utente (UDT / PLC data types)             | `.udt`                     |
| `tags/`    | Tabelle delle variabili PLC e costanti utente          | `.csv` o `.xml` (vedi sotto) |

Nome file = nome del blocco in TIA, così com'è (`FB7_Robot.scl`,
`DB_MC1.db`, `UDT_Gripper.udt`). Niente numeri di versione nel nome: la
versione è il commit.

## Come si esporta da TIA Portal

1. Nell'albero del progetto, selezionare uno o più blocchi (anche a multi
   selezione con Ctrl).
2. Tasto destro → **Generate source from blocks** (in italiano: **Genera
   sorgente da blocchi**). TIA chiede il nome del file e lo crea nella
   cartella **External source files** (*File sorgente esterni*) del progetto.
3. Nella cartella *External source files*, tasto destro sul file generato →
   **Export** (*Esporta*) → salvare nella sottocartella giusta di `plc/`
   (`blocks/`, `db/`, `types/`) sovrascrivendo il file precedente.
4. Codifica: lasciare l'UTF-8 proposto da TIA.

Per le **tabelle variabili** e le **costanti** TIA offre solo l'esportazione
in Excel (`.xlsx`, binario): aprire il file in Excel e salvarlo come **CSV**
in `tags/`, oppure — quando ci sarà l'integrazione Openness — l'XML testuale.
Non committare `.xlsx`.

## Blocchi in LAD / FBD (linguaggi grafici)

**Non generano sorgente**: "Genera sorgente da blocchi" funziona solo per
SCL (e STL). Per questi blocchi si annota qui sotto il nome e si spiega che
vanno letti in TIA; la loro storia resta solo quella del progetto. Se un
blocco grafico viene convertito in SCL, si sposta nella tabella dei blocchi
esportati.

| Blocco | Linguaggio | Note                                             |
|--------|------------|--------------------------------------------------|
| _(da compilare)_ | LAD/FBD | Leggere in TIA Portal, non esportabile come testo |

## Regola operativa

Dopo **ogni sessione di modifiche al PLC**:

1. rigenerare i sorgenti dei **soli blocchi toccati** (non l'intero progetto:
   un'esportazione totale nasconde nel rumore la modifica vera);
2. copiarli nella sottocartella giusta sovrascrivendo i precedenti;
3. `git diff` per vedere esattamente cosa è cambiato — se il diff mostra più
   di quello che si è modificato, fermarsi e capire perché prima di committare;
4. **un commit con la stessa descrizione della modifica fatta in TIA**
   (es. `plc(FB7): refresh 90 ripubblica DECLARE/ROBOT`), sul branch di
   lavoro corrente. Se la modifica PLC va di pari passo con una modifica del
   pannello o del backend, stesso commit o commit consecutivi con lo stesso
   prefisso: così il confronto "cosa ha cambiato il PLC quel giorno" è a
   portata di `git log -- plc/`.

Cosa NON fare:

- non committare il progetto TIA (`.ap20`, archivi `.zap20`/`.al20`, cartelle
  `IM/ System/ XRef/ UserFiles/ TMP/ Logs/ Vci/ AdditionalFiles/`);
- non modificare i sorgenti qui dentro a mano;
- non committare esportazioni "a tappeto" dopo settimane: si perde il legame
  fra commit e modifica, che è l'unico motivo per cui questa cartella esiste.

## Perché esiste

A luglio 2026 una regressione su un blocco è stata trovata solo per confronto
manuale, e il fix che l'aveva introdotta era invisibile perché il progetto
TIA non ha storia. Con i sorgenti in repo, `git log -p -- plc/blocks/<blocco>.scl`
risponde in un minuto a "chi ha cambiato cosa e quando".

## Fasi successive (non in questa cartella)

Automazione dell'esportazione via TIA Openness e confronto automatico
repo↔progetto: fase successiva, esplicitamente fuori scope. Qui c'è solo la
struttura e la convenzione.
