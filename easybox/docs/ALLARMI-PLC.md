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
| 20001, 20002, 20005 | solo `Error`: **non arrivano su `ALARM/ROBOT`** | tasche (39) |

**20001, 20002 e 20005 restano in `Error`** (verificato il 7/10 sera su
FB_Robot.scl, righe 267-281 e 448-468, e 4355 per il 20001 del rilascio):
il PLC non li pubblica su `ALARM/ROBOT`, quindi il dialog delle tasche non li
riceve e l'attesa dell'eco del 39 finisce per timeout («Nessuna conferma dal
PLC»); il motivo si legge solo come errore del robot. **Il 20006 nel PLC non
esiste**: il pannello lo aspetta ancora fra i rifiuti del 39, senza effetto.

Il PLC pubblica l'allarme quando rifiuta, ma **non pubblica niente per dire
"ora e' a posto"**: manda solo l'eco del comando riuscito. Per questo nel
dialog l'eco vale anche come cancellazione dell'errore di quella sezione.

**Il riquadro globale tace se il dialog mostra il codice** (7/10 sera,
simulazione bis B61). Con la Reimposta stato cella aperta, e mentre un
dialog aspetta un eco (`palletMachine.aspettaEco`: anche i pallet in
macchina e a bordo), i codici che il dialog mostra non aprono anche il
riquadro degli allarmi (`util/robotAlarm.js`, `codiciInDialog`). Il 99 su
`ALARM/BOX` ha un testo suo, `robot.alarmBox_99` («numero di cassetto fuori
intervallo»): `robot.alarm_99` resta «ALLARME GENERICO» del robot. 948, 951,
996, 997 e 999 hanno un testo anche nel riquadro (`robot.alarm_<codice>`).

**944, 945, 946 prima del PLC 33.** Il rifiuto del 35 (REGION Declare_State
di FB_Robot) li scriveva solo in `Error`, senza pubblicarli su `ALARM/ROBOT`:
il pannello non riceveva il codice, l'attesa dell'eco del 35 finiva per
timeout («Nessuna conferma dal PLC») e il motivo si leggeva solo come errore
del robot. Dal PLC 33 (consegna del 7/10) arrivano davvero su `ALARM/ROBOT`,
e la sezione robot del dialog, come la dichiarazione del pallet a bordo
(`util/palletOnRobot.js`), mostra il testo del rifiuto.

## Rifiuti dei comandi dal pannello (970, 971, 972, 973, 981)

| codice | canale | quando | testo |
|---|---|---|---|
| 970 | `Error` | deposito manuale in MC1: nessun ordine di MC1 per il pezzo prelevato. Dal PLC 33 l'ordine si cerca nella vista `MAN_ORDER_MC1` 7/10: prima quello **avviato e non completo** (STATUS 3, PRODUCTED < QUANTITY), poi in coda o in pausa (4, 6), il piu' recente. Prima valeva solo in coda o in pausa | `robot.alarm_970` |
| 971 | `Error` | deposito manuale in MC1: non si sa da quale tasca viene il pezzo in pinza. Col PLC 33 esce solo se in piu' **non c'e' un ordine avviato di MC1**: «oppure avvia l'ordine» torna vero | `robot.alarm_971` |
| 972 | `ALARM/ROBOT`, come il 968 | (PLC 33) comando dal pannello rifiutato perche' il robot ha un **errore attivo**: prima veniva accettato e partiva da solo quando l'errore si azzerava (simulazione del 7/10, problema 9). RESET e si ripete; col 938 prima la dichiarazione dello stato cella. **Dal PLC 35** subito dopo il 972, nello stesso ciclo, arriva su `ALARM/ROBOT` il codice dell'errore attivo | `robot.alarm_972`; col codice dopo, titolo `robot.alarm972Title`, testo del codice, coda `robot.alarm972NoText` solo se il codice non ha un testo |
| 973 | `ALARM/ROBOT` | (PLC 35) comando di missione rifiutato perche' c'e' una **missione in corso** (master diverso da 0) **o sospesa** (`MissionCode` diverso da 0). In HOLD una missione di FB204 puo' restare in `MissionCode`: il pannello la sovrascriveva e FB204 leggeva la missione del pannello come la propria (simulazione bis, B5). Il comando e' consumato e `MissionCode` resta com'era. Si esce con CONTINUA (la missione sospesa riprende), con la procedura dopo una missione interrotta (RESTART MAIN PROGRAM, HOME, Reimposta stato cella) o col RESET. Home, manutenzione, posizionamenti, dichiarazioni e reset restano ammessi. **Dal 20/10 (Reimposta)** il rifiuto vale anche con la **Reimposta stato cella aperta**: `#Dispatcher["_Declare_State"] <> 0` o `#Dispatcher["get_TCP_Data"] <> 0` (`plc/FB/FB_Robot.scl` 410-427, REGION Manager CMD from HMI). Dopo l'eco del 35 la Reimposta resta aperta fino al Riprendi (REGION Declare_State, 5836-6260: il 76 manda il 10 al robot, riga 6058, il 75 aspetta il robot, in HOLD fino al Riprendi, il 90 chiude), con master e `MissionCode` a 0: una missione del pannello accettata in quel momento prendeva per sua l'eseguito del 10. Si esce con CONTINUA; qui il RESET non basta. Come dalla 35, il controllo vale solo in HOLD (`NOT #RemoteMode`) e col robot non sotto pendant, per i 16 comandi di missione e di chela elencati alle righe 416-420 | `robot.alarm_973` |
| 981 | `ALARM/ROBOT` | (HOLD unico, scaricato il 16/10) **Riprendi dal pannello rifiutato**: comando 17 (`CMD_HOLD`) con la cella in HOLD, oppure 81 (`CMD_RobotRemoteMode`, togli HOLD), con la porta dell'area robot non bloccata (`NOT "Door_Robot_locked"`) e il robot in automatico (`"sys_Robot_Auto_Mode"`). L'HOLD resta (`plc/FB/FB_Robot.scl` 196-208, REGION Manager CMD from HMI). Con il robot non in automatico, per esempio in T1, la regola non vale. Il 17 a cella non in HOLD e l'82 (`CMD_RobotLocalMode`, metti HOLD) mettono l'HOLD sempre. Il pulsante in cella segue la stessa regola (`plc/FB/FB_plant.scl` 112-118, REGION HOLD_MANAGER) ma non pubblica niente: il Riprendi dal pulsante e' solo ignorato. La porta sbloccata col robot in automatico mette anche l'HOLD, sul fronte (107, 110-111) | `robot.alarm_981` |

**972 seguito dal codice (PLC 35).** Il riquadro degli allarmi e' uno solo e
mostra l'ultimo codice arrivato: da soli, a video sarebbe rimasto il codice
dell'errore, senza dire che il comando era stato rifiutato. Il pannello li
mette insieme in un punto solo, `HMI/src/util/robotAlarm.js` (handler di
`PLC/ALARM/ROBOT`, usato dal layout: `StandardMenu.vue` sul ramo
`ui-lifting`, `layout/plantGlobals.js` su `ui-v3`): un 972 seguito **entro
1 s** da un altro codice diventa un avviso unico (7/10 sera):
- titolo «Comando rifiutato: errore attivo <codice>»;
- testo: quello del codice, che dice gia' cosa fare;
- la coda «Premi RESET e ripeti il comando.» solo se il codice non ha un
  testo. Cosi' «RESET» compare una volta sola (972 + 1419: lo dice il 1419).

Si abbina **solo il codice che segue il 972 sull'evento `ALARM/ROBOT`**, entro
1 s (corretto l'8/10: prima l'abbinamento si decideva su `PLC/ALARM/ROBOT`).
Nella 35 il PLC mette in coda i due messaggi uno dopo l'altro, nello stesso
ciclo e sullo stesso topic `FROM_PLANT/ALARM/ROBOT` (FB_Robot, REGION Manager,
due `FC_MQTT` con `insert := true`): il secondo e' `#Error` di FB_Robot, un
codice del robot. Il backend (`serverDati/MQTT_Client.js`, ramo `ALARM`)
manda `PLC/ALARM/ROBOT` per **ogni** `FROM_PLANT/ALARM/*` tranne MC1: anche
per `ALARM/BOX` e per le emergenze 900001, 900002, 900010 e 900011, che il PLC
pubblica su `FROM_PLANT/ALARM` (`plc/FB/FB_plant.scl`, 134-176). L'evento
`ALARM/ROBOT` invece arriva solo per `FROM_PLANT/ALARM/ROBOT`, subito prima
del `PLC/ALARM/ROBOT` dello stesso messaggio. Quindi:
- l'handler di `ALARM/ROBOT` (`alarmRobot` in `util/robotAlarm.js`) decide
  l'abbinamento e non tocca il riquadro;
- quello di `PLC/ALARM/ROBOT` sceglie il testo e mostra il riquadro, una
  volta sola per messaggio.

Un'emergenza o un 99 del cassetto arrivati entro 1 s da un 972 hanno il loro
testo (prima diventavano «Comando rifiutato: errore attivo 900010»). Mai
`ALARM/MC1` ne' `PLC/ALARM/GENERIC`, che hanno handler loro e non passano dal
combinatore; un 972 che segue un altro 972 non si abbina. Un 972 senza
seguito (PLC 33, o un codice arrivato dopo 1 s) resta il testo del 972. Il 968, l'altro rifiuto su
`ALARM/ROBOT`, chiude solo le attese delle dichiarazioni 35, non quelle dei
comandi di missione.

## Uncino per i cassetti e pinza col cassetto fuori (consegna 34, 7/10)

Tutti in `Error`, testi `robot.alarm_<codice>` (it e en). Dove li scrive il
PLC: file `34_FB7_uncino_e_cassetto_fuori.scl`; il come sta in APPUNTI-CELLA.md,
«Consegna 34».

| codice | dove | quando | cosa fare |
|---|---|---|---|
| 1419 | Gripper_TRAY_to_Robot, stato 10; dal PLC 35 anche master 0, 1010, 1310 | carico pinza rifiutato: c'e' un cassetto fuori (registro `ExtractedTray`, sensori `I_OUT_TRAY1..12`, estrazione o rilascio in corso) | premere RESET, rientrare il cassetto (Gestione cassetto), ripetere il comando |
| 1519 | Gripper_Robot_to_TRAY, stato 10; dal PLC 35 anche master 0, 1010, 1100, 1200, 1310 | deposito pinza rifiutato: c'e' un cassetto fuori. **Il 1519 della 34 non copriva lo swap 970** (il cambio pinza 27 non passa dalle catene pinza, e col PLC 34 andava allo scaffale lo stesso): lo copre la consegna 35, **scaricata l'8/10** | premere RESET, rientrare il cassetto (Gestione cassetto), ripetere il comando |
| 19005 | TRAY_extact, stato 30; master 700 | estrazione rifiutata: la pinza a bordo non ha l'uncino (`GRIPPER.HAS_HOOK = 0`). In automatico la pinza dell'ordine non si cambia | dare l'uncino in anagrafica solo se la pinza lo ha davvero |
| 19006 | Gripper_Hook_Search | nessuna pinza con l'uncino, ne' a bordo ne' a scaffale | controllare `HAS_HOOK` in anagrafica |
| 19007 | master 700 | per prendere la pinza con l'uncino quella a bordo deve essere vuota | scaricare prima il contenuto della pinza |
| 20011 | TRAY_release, stato 30 | rilascio rifiutato: la pinza a bordo non ha l'uncino. Col cassetto fuori la pinza non si cambia | il cassetto si rientra a mano, poi Reimposta stato cella con cassetto 0 |

**Prima RESET, poi il cassetto** (simulazione bis, B8). Con un errore attivo
anche il rilascio del cassetto e' un comando di missione, e il PLC lo
rifiuta col 972 finche' l'errore resta: per questo i testi del 1419 e del
1519 dicono «Premi RESET, rientra il cassetto (Gestione cassetto), poi
ripeti il comando», e non piu' il contrario.

Il pannello prova a non arrivarci: i comandi pinza sono spenti col cassetto
fuori (1419, 1519) e Produzione avvisa quando la pinza di un ordine non ha
l'uncino (19005). Il controllo vero resta quello del PLC.

## Consegna 35 (7/10): guardie e spinta

Dove li scrive il PLC: file `35_FB7_guardie_e_spinta.scl` (FB_Robot) e
`35_FB_easyBox_cassetti_da_pannello.scl` (FB_easyBox); il come sta in
APPUNTI-CELLA.md, «Consegna 35». Origine: seconda simulazione del 7/10
(sigle B).

| codice | dove | cosa cambia |
|---|---|---|
| 973 | Manager CMD from HMI | nuovo: comando di missione con una missione in corso o sospesa (tabella dei rifiuti qui sopra) |
| 972 | Manager CMD from HMI | subito dopo, nello stesso ciclo, il codice dell'errore attivo (vedi «972 seguito dal codice») |
| 949 | (1) Extract_TRAY e Release_TRAY, stato 10 (master 700, 800 e l'estrazione dentro il 500); (2) catene pinza e pezzo del magazzino, stato 10, anche master 0 (swap, carico e scarico pinza), 1010, 1100, 1200, 1310 | **Due cause** (corretto l'8/10: qui c'era scritto che la porta non c'entrava). (1) **Porta operatore non chiusa** mentre si estrae o si rientra un cassetto: `IF NOT "Door_OP_locked" THEN #Error := 949` (`plc/FB/FB_Robot.scl`, 4180 in Extract_TRAY e 4344 in Release_TRAY; guardia del 19/9, l'ingresso letto direttamente). (2) **EasyBox in errore**: `"DB_BOX_1".Robot_enabled_to_work` falso. `DB_BOX_1` e' l'istanza di FB_easyBox e il bit vale `#Error = 0` di FB_easyBox (`plc/FB/FB_easyBox.scl`, 376-387): il registro del cassetto fuori non coincide coi sensori (1..12 cassetto registrato fuori ma non visto; 999 visto fuori ma non registrato (128-129) **o piu' cassetti fuori** (250-252, 336-338); 998 a meta' corsa; 99 registro fuori range). Dal 19/9 il bit **non guarda piu' la porta**: per pezzi e pinze la porta aperta non ferma niente, per i cassetti la guardia e' la (1). Prima lo alzavano solo le catene pinza e i master restavano appesi; adesso la missione si chiude subito |
| 1419, 1519 | anche master 0 (swap, carico e scarico pinza), 1010, 1100, 1200, 1310 | cassetto fuori: la missione si chiude subito, il robot non si muove. Lo swap a flangia nuda da' 1419 (sarebbe un carico), con una pinza a bordo 1519 |
| 1722 | 1010 e 1310 | `_Gripper4Pallet_Search` (17) errore 22: la query `select GRIPPERREQ from pallets_grippers where palletID=<pallet>` non da' una riga, va in errore o (dalla 35) da' 0. Adesso **chiude la missione**. Prima `GripperRequested` restava col valore vecchio e il master cambiava pinza verso una pinza che col pallet non c'entra. La pinza richiesta del pallet (`pallet.GripperREQ`) **non si imposta dal pannello** (LAVORI-IN-CODA.md) |
| 691 | Part_Robot_to_TRAY, stato 10 | catena 6 errore 91, zero righe dalla query della tasca. Dal PLC 35 vuol dire **«tasca di destinazione non trovata o non vuota a database»**: nei depositi a tasca fissa (finito in automatico, grezzo che torna, posizione scelta dal pannello) la query vuole `STATUS=2`. Il robot non si muove: si controlla la tasca, la si dichiara (39), RESET e si ripete. La catena resta a 691 fino al RESET, e intanto i comandi di missione danno 972 |

Testi nel pannello (it ed en): `robot.alarm_973`, `robot.alarm_691`, il
titolo e la coda dell'avviso unico (`robot.alarm972Title`,
`robot.alarm972NoText`); 1419, 1519 e 20011 aggiornati; dal 7/10 sera anche
`robot.alarm_949` (porta operatore durante l'estrazione o il rientro di un
cassetto, oppure EasyBox in errore: le due cause dall'8/10) e
`robot.alarm_1722` (pinza del pallet assente a database).

## HOLD unico (16/10) e Reimposta (20/10)

Dal codice in `plc/`, export del progetto V2026_1_6 del 20/10 (righe di
quell'export). Il come sta in APPUNTI-CELLA.md.

| codice | dove | cosa cambia |
|---|---|---|
| 981 | `FB_Robot.scl` 196-208, Manager CMD from HMI; il pulsante in `FB_plant.scl` 107-119, HOLD_MANAGER, senza codice | nuovo: Riprendi rifiutato con la porta dell'area robot non bloccata e il robot in automatico (tabella dei rifiuti qui sopra) |
| 973 | `FB_Robot.scl` 410-427, Manager CMD from HMI | esteso alla Reimposta aperta, `_Declare_State` o `get_TCP_Data` diversi da 0 (tabella dei rifiuti qui sopra) |
| 982 | `FB_Machine_Autonomous.scl` 1676-1713, Declare MC1 from HMI, comando 37 (`CMD_RemovePiece_MC`) | nuovo, su `ALARM/MC1`: **morsa dichiarata vuota ma non aperta**. Dal 20/10 la morsa dichiarata vuota col 37 si apre da sola: `#cmd.code := "MC_openVice"` (1705), lo stesso comando di SBLOCCO MORSA, eseguito al giro dopo nella REGION SPECIFIC_implementation. Solo con la morsa automatica (`#ManualVice = 0`) e non gia' aperta (`NOT #io_in.viceOpened`, 1698). Servono (1699-1703): porta HAAS aperta (`#io_in.doorOpened`), cella in HOLD (`"DB_Robot".HOLD`), robot fuori dalla macchina (`"Robot_IN_AREA"` alto = fuori ingombro), nessun comando macchina in corso (`#cmd.code <= 0 AND NOT #cmd.executing`), robot in attesa (`"DB_RobotMissionStatus".StatusCode = "cmd_waitingNewCmd"`). Se una manca: 982 (1707-1710). **La dichiarazione e' gia' registrata** (`piecepresent[1] := 0`, `updatePartOnMC := 10 + EMPTY`, eco forzato, 1683-1685): il 982 dice solo che la morsa non si e' aperta: l'operatore apre la porta dalla HAAS e usa SBLOCCO MORSA (commento alle 1695-1696). Con la morsa manuale o gia' aperta niente 982. Col ciclo MC1 in corso (master diverso da 0 e da 9999) il 37 resta rifiutato col 947 (1677-1681) |

Testi nel pannello (it ed en): `robot.alarm_981`, `robot.alarm_982`;
`robot.alarm_973` aggiornato.

## Se manca una chiave

1. si decodifica il numero con la regola qui sopra;
2. si aggiunge `robot.alarm_<codice>` in **it.json e en.json** (parita' di
   conteggio: la verifica sta in coda ai test i18n);
3. il testo sta nel registro delle chiavi vicine — una riga, il fatto, niente
   istruzioni. Le istruzioni servono ai rifiuti (`declErr`), che dicono anche
   cosa fare, non agli allarmi di ciclo.
