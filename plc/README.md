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

| Cartella | Contenuto                                         | Estensione | Chi la scrive          |
|----------|---------------------------------------------------|------------|------------------------|
| `OB/`    | Blocchi organizzativi                             | `.scl`     | `tools/tia-export`     |
| `FB/`    | Blocchi funzionali                                | `.scl`     | `tools/tia-export`     |
| `FC/`    | Funzioni                                          | `.scl`     | `tools/tia-export`     |
| `DB/`    | Blocchi dati globali, di istanza e array DB       | `.db`      | `tools/tia-export`     |
| `UDT/`   | Tipi di dati PLC                                  | `.udt`     | `tools/tia-export`     |
| `tags/`  | Tabelle delle variabili PLC e costanti utente     | `.csv`     | a mano (vedi sotto)    |

Nome file = nome del blocco in TIA, così com'è (`FB7_Robot.scl`,
`DB_MC1.db`, `UDT_Gripper.udt`). I caratteri non ammessi nei nomi di file
diventano `_`. Niente numeri di versione nel nome: la versione è il commit.
Un eventuale blocco in STL finirebbe nella sua cartella con estensione `.awl`.

Le cartelle `OB/ FB/ FC/ DB/ UDT/` sono **gestite dal tool**: ci scrive solo
lui, e ci cancella i sorgenti dei blocchi che non esistono più nel progetto.
Non metterci file a mano.

## Come si esporta

Con il tool `tools/tia-export` (TIA Portal Openness V20): apre il progetto
senza interfaccia, genera il sorgente di **tutti** i blocchi della CPU (un
file per blocco) e scrive solo i file il cui contenuto è cambiato. A progetto
invariato non produce diff. Prerequisiti, configurazione e uso sono in
[`tools/tia-export/README.md`](../tools/tia-export/README.md).

A fine corsa stampa quanti blocchi ha esportato, quanti ne ha saltati (e
perché) e l'elenco dei file aggiunti (`A`), modificati (`M`) e rimossi (`D`)
rispetto alla corsa precedente.

Il tool **non esporta** e lo dichiara nel riepilogo come "saltati":

- **blocchi safety (F-)**: Openness non ne genera il sorgente;
- **blocchi know-how protected**;
- **blocchi LAD / FBD / GRAPH**: non hanno un sorgente testuale (vedi sotto);
- **blocchi di sistema** generati da TIA.

Per le **tabelle variabili** e le **costanti** l'esportazione resta manuale:
TIA offre solo Excel (`.xlsx`, binario), quindi aprire il file in Excel e
salvarlo come **CSV** in `tags/`. Non committare `.xlsx`.

## Blocchi in LAD / FBD / GRAPH (linguaggi grafici)

**Non generano sorgente**: la loro storia resta solo quella del progetto TIA
e vanno letti lì. Il riepilogo del tool stampa già le righe pronte per questa
tabella. Se un blocco grafico viene convertito in SCL, alla corsa successiva
il tool lo esporta: toglierlo da qui.

| Blocco | Linguaggio | Note                                             |
|--------|------------|--------------------------------------------------|
| Cyclic interrupt_1 | LAD | Leggere in TIA Portal, non esportabile come testo |
| FC_DBdata | LAD | Leggere in TIA Portal, non esportabile come testo |
| FC_ExtractGripper | LAD | Leggere in TIA Portal, non esportabile come testo |
| Main | LAD | Leggere in TIA Portal, non esportabile come testo |

## Regola operativa

Dopo **ogni sessione di modifiche al PLC**:

1. salvare il progetto in TIA e **chiuderlo** (il tool non apre un progetto
   già aperto);
2. lanciare `tools/tia-export`;
3. leggere l'elenco dei file cambiati e `git diff -- plc/`: deve mostrare
   **solo** quello che si è modificato in TIA. Se mostra di più, fermarsi e
   capire perché prima di committare;
4. **un commit per ogni modifica fatta in TIA**, con la stessa descrizione
   (es. `plc(FB7): refresh 90 ripubblica DECLARE/ROBOT`), sul branch di
   lavoro corrente. Se in una sessione si sono fatte più modifiche separate,
   staging selettivo dei file di ciascuna. Se la modifica PLC va di pari passo
   con una modifica del pannello o del backend, stesso commit o commit
   consecutivi con lo stesso prefisso: così il confronto "cosa ha cambiato il
   PLC quel giorno" è a portata di `git log -- plc/`.

L'export è sempre totale, ma essendo idempotente il diff contiene solo i
blocchi cambiati davvero: il legame fra commit e modifica lo garantisce il
diff, non la scelta a mano di cosa esportare.

Cosa NON fare:

- non committare il progetto TIA (`.ap20`, archivi `.zap20`/`.al20`, cartelle
  `IM/ System/ XRef/ UserFiles/ TMP/ Logs/ Vci/ AdditionalFiles/`);
- non modificare i sorgenti qui dentro a mano;
- non lasciar accumulare settimane di modifiche prima di esportare: il diff
  resta preciso, ma si perde il legame fra ogni commit e la sua modifica.

## Perché esiste

A luglio 2026 una regressione su un blocco è stata trovata solo per confronto
manuale, e il fix che l'aveva introdotta era invisibile perché il progetto
TIA non ha storia. Con i sorgenti in repo, `git log -p -- plc/FB/<blocco>.scl`
risponde in un minuto a "chi ha cambiato cosa e quando".
