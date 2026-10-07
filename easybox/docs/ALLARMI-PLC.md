# Codici allarme del PLC — come si leggono

Il pannello mostra gli allarmi con la chiave i18n `robot.alarm_<codice>`. Quando
la chiave manca, a video esce la chiave grezza: succede ogni volta che il PLC
tira fuori un codice che nessuno ha ancora tradotto.

## La convenzione: MissionCode * 100 + errore

I codici lunghi NON sono numeri arbitrari. Si scompongono:

```
13599  ->  135 * 100 + 99   missione 135 (PickPlacePart_MC, comando 16)
                            errore  99   quote di lavorazione non trovate a database

3005   ->   30 * 100 + 5    catena Pallet_Robot_to_MC
                            errore   5   posizione pallet in macchina non trovata
```

Quindi davanti a un codice sconosciuto: si dividono le ultime due cifre dal
resto, il primo pezzo dice **quale missione o catena** ha fallito, il secondo
**cosa** e' andato storto dentro quella missione. Non serve indovinare, e non
si deve inventare una descrizione plausibile: si ricava, e se il pezzo di
sinistra non si riconosce si chiede al robotista.

I codici corti (944, 945, 946, 947, 948, 996, 997, 999) NON seguono questa
regola: sono errori di rifiuto delle dichiarazioni manuali, elencati sotto.

## Due namespace distinti, e non vanno mescolati

| chiave | a chi serve | dove si vede |
|---|---|---|
| `robot.alarm_<codice>` | allarmi di ciclo | toast globale (StandardMenu), card unita' |
| `robot.declErr.<codice>` | rifiuti delle dichiarazioni manuali (35/36/37/38/39) | dentro la sezione del dialog "Reimposta stato cella" |

Sono separati per necessita', non per gusto: **`robot.alarm_99` esiste gia' ed
e' "ALLARME GENERICO"**, mentre il 99 pubblicato su `FROM_PLANT/ALARM/BOX`
vuol dire "numero cassetto fuori intervallo". Stesso numero, due significati,
due canali diversi. Tenerli nello stesso namespace avrebbe fatto comparire la
frase sbagliata.

## Rifiuti delle dichiarazioni manuali

Instradati per sezione dal codice, perche' i canali `ALARM/MC1`, `ALARM/BOX` e
`ALARM/ROBOT` dicono l'unita' ma non quale comando ha rifiutato.

| codice | canale | sezione del dialog |
|---|---|---|
| 947, 948 | `ALARM/MC1` | macchina (36/37) |
| 99, 996, 997, 999 | `ALARM/BOX` | cassetto (38) |
| 944, 945, 946 | `ALARM/ROBOT` (dal PLC 33; prima solo in `Error`) | robot (35) |
| 20001, 20002, 20005, 20006 | `ALARM/ROBOT` | tasche (39) |

Il PLC pubblica l'allarme quando rifiuta, ma **non pubblica niente per dire
"ora e' a posto"**: manda solo l'eco del comando riuscito. Per questo nel
dialog l'eco vale anche come cancellazione dell'errore di quella sezione.

**944, 945, 946 prima del PLC 33.** Il rifiuto del 35 (REGION Declare_State
di FB_Robot) li scriveva solo in `Error`, senza pubblicarli su `ALARM/ROBOT`:
il pannello non riceveva il codice, l'attesa dell'eco del 35 finiva per
timeout («Nessuna conferma dal PLC») e il motivo si leggeva solo come errore
del robot. Dal PLC 33 (consegna del 7/10) arrivano davvero su `ALARM/ROBOT`,
e la sezione robot del dialog, come la dichiarazione del pallet a bordo
(`util/palletOnRobot.js`), mostra il testo del rifiuto.

## Rifiuti dei comandi dal pannello (970, 971, 972)

| codice | canale | quando | testo |
|---|---|---|---|
| 970 | `Error` | deposito manuale in MC1: nessun ordine di MC1 per il pezzo prelevato. Dal PLC 33 l'ordine si cerca nella vista `MAN_ORDER_MC1` 7/10: prima quello **avviato e non completo** (STATUS 3, PRODUCTED < QUANTITY), poi in coda o in pausa (4, 6), il piu' recente. Prima valeva solo in coda o in pausa | `robot.alarm_970` |
| 971 | `Error` | deposito manuale in MC1: non si sa da quale tasca viene il pezzo in pinza. Col PLC 33 esce solo se in piu' **non c'e' un ordine avviato di MC1**: «oppure avvia l'ordine» torna vero | `robot.alarm_971` |
| 972 | `ALARM/ROBOT`, come il 968 | (PLC 33) comando dal pannello rifiutato perche' il robot ha un **errore attivo**: prima veniva accettato e partiva da solo quando l'errore si azzerava (simulazione del 7/10, problema 9). RESET e si ripete; col 938 prima la dichiarazione dello stato cella | `robot.alarm_972` |

Il 972 lo mostra il toast globale come gli altri `robot.alarm_<codice>`: nel
pannello non c'e' una logica dedicata (il 968, l'altro rifiuto su
`ALARM/ROBOT`, chiude solo le attese delle dichiarazioni 35, non quelle dei
comandi di missione).

## Uncino per i cassetti e pinza col cassetto fuori (consegna 34, 7/10)

Tutti in `Error`, testi `robot.alarm_<codice>` (it e en). Dove li scrive il
PLC: file `34_FB7_uncino_e_cassetto_fuori.scl`; il come sta in APPUNTI-CELLA.md,
«Consegna 34».

| codice | dove | quando | cosa fare |
|---|---|---|---|
| 1419 | Gripper_TRAY_to_Robot, stato 10 | carico pinza rifiutato: c'e' un cassetto fuori (registro `ExtractedTray`, sensori `I_OUT_TRAY1..12`, estrazione o rilascio in corso) | chiudere il cassetto e premere RESET |
| 1519 | Gripper_Robot_to_TRAY, stato 10 | deposito pinza rifiutato (anche il cambio pinza, che comincia col deposito): c'e' un cassetto fuori | chiudere il cassetto e premere RESET |
| 19005 | TRAY_extact, stato 30; master 700 | estrazione rifiutata: la pinza a bordo non ha l'uncino (`GRIPPER.HAS_HOOK = 0`). In automatico la pinza dell'ordine non si cambia | dare l'uncino in anagrafica solo se la pinza lo ha davvero |
| 19006 | Gripper_Hook_Search | nessuna pinza con l'uncino, ne' a bordo ne' a scaffale | controllare `HAS_HOOK` in anagrafica |
| 19007 | master 700 | per prendere la pinza con l'uncino quella a bordo deve essere vuota | scaricare prima il contenuto della pinza |
| 20011 | TRAY_release, stato 30 | rilascio rifiutato: la pinza a bordo non ha l'uncino. Col cassetto fuori la pinza non si cambia | il cassetto si rientra a mano |

Il pannello prova a non arrivarci: i comandi pinza sono spenti col cassetto
fuori (1419, 1519) e Produzione avvisa quando la pinza di un ordine non ha
l'uncino (19005). Il controllo vero resta quello del PLC.

## Se manca una chiave

1. si decodifica il numero con la regola qui sopra;
2. si aggiunge `robot.alarm_<codice>` in **it.json e en.json** (parita' di
   conteggio: la verifica sta in coda ai test i18n);
3. il testo sta nel registro delle chiavi vicine — una riga, il fatto, niente
   istruzioni. Le istruzioni servono ai rifiuti (`declErr`), che dicono anche
   cosa fare, non agli allarmi di ciclo.
