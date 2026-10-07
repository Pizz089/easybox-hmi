# Lavori in coda — difetti noti tenuti fuori dal cantiere corrente

> Questo file NON e' una lista di desideri. Ci sta solo cio' che e' stato
> verificato nel codice, con il conteggio reale e il motivo per cui non e'
> stato corretto sul momento. Gli interventi manuali da fare in impianto
> stanno invece in `APPUNTI-CELLA.md`.

## [ ] Pannello v3: pagine non rifatte e voci aperte

**Cosa.** Sul ramo `ui-v3` restano fuori dal pannello nuovo:
- **pagine non rifatte:** il wizard dell'ordine (`views/workOrder/selectRig.vue`, `selectPiece.vue`, `selectGripper.vue`, `selectMC.vue`, `components/workOrder_step.vue`), che si fa nella fase E; il Grigliato (`views/conf/Grating/Grating.vue`); Importa grigliato (`ImportGrating.vue`); `views/layoutView.vue`, rifatta a metà;
- **decisioni aperte:**
  - «Estrai/Rilascia» in Cassetti: tolto nella fase C-bis perché non ha mai mandato il comando (la guardia di `ComandsRows` vuole `RobotInLocalMode`, che non scrive nessuno). Da decidere se ricollegarlo con quell'interblocco o senza;
  - porta MC2: `MC2_PORTA_CABLATA = false` in `views/unit/CNC2View.vue`, i comandi della porta restano nascosti finché non è cablata;
  - testi «Cosa fare» degli allarmi: la pagina Allarmi li mostra solo se esiste la chiave `robot.alarm_<codice>_fix`; oggi nessuna, i testi li scrive Dario;
  - «Riconosci» negli Allarmi: nessun endpoint lo fa, quindi il pulsante non c'è;
- **file orfani:** `components/units.vue`, che nel v3 non monta più nessuno ma è ancora nella golden dei comandi e in `test_oneshot_refresh.mjs`; `views/AboutView.vue`, senza rotta.

**Direzione.** Le pagine nella fase E; le decisioni con Dario; gli orfani si tolgono insieme ai loro test, dopo il merge di `ui-v3` in `ui-lifting`.

**Trovato il** 2026-10-07, rilievo in sola lettura del pannello v3.

## [x] `pannello.ps1` col pannello compilato non ricompila

**Cosa.** Col pannello compilato (`EasyBoxPannello` in modo `preview`), `pannello.ps1 -Versione v3` e `-Versione stabile` cambiavano ramo e riavviavano il pannello sulla `dist` di prima, senza dirlo. Non si sapeva nemmeno da che commit veniva il pannello servito (B59).

**Stato.** chiuso con 541c26d (7/10 sera). In modo `preview`, dopo pull e `npm install`, `pannello.ps1` lancia la stessa build di `servizi-cella.ps1 -Azione aggiorna`; se fallisce si ferma, la `dist` e il servizio restano com'erano e lo dice. La build scrive `easybox\HMI\dist\build.txt` (ramo, commit, data); `servizi-cella.ps1 -Azione stato` (o `-Azione servito`) e `pannello.ps1 -Versione stato` lo confrontano con l'ultimo commit che tocca `easybox/HMI`, riga rossa «pannello servito non aggiornato: -Azione aggiorna». Test in `tools/test_pannello_servizi.ps1` e `tools/test_servizi_cella.ps1`. Procedura in APPUNTI-CELLA.md.

**Trovato il** 2026-10-07, rilievo in sola lettura del pannello v3.

## [ ] Registro della tasca del finito, congelato al prelievo dalla macchina

**Cosa.** Limite dichiarato dalla consegna 35 (7/10). `PartSubPosMC` si riscrive alla fine di Part_Robot_to_MC prima che il finito a bordo sia depositato, nei giri di FB204 che passano dal 55/57 (ripartenza col pezzo in macchina, errore DB al 95/4). Al giro dopo il deposito del finito trova la tasca già a 5: con la 35 si ferma col 691 (prima posava su una tasca piena, problema 4 della simulazione).

**Direzione.** Un registro della tasca del finito, scritto al prelievo dalla macchina e non più toccato fino al deposito. Il 691 resta la rete di sicurezza.

**Trovato il** 2026-10-07, limiti della consegna 35.

## [ ] TCP dopo il cambio pinza nei percorsi pezzo (310, 410, 510, 1110, 1210)

**Cosa.** Il TCP dopo un cambio pinza lo mandano solo il 115, il 715, il 950 e lo swap; la consegna 35 lo aggiunge ai tre percorsi pallet (215, 1030, 1335). I percorsi pezzo (310, 410, 510, 1110, 1210) restano senza.

**Direzione.** Dipende dalla risposta del robotista: quando il robot prende una pinza (comando 11) il TCP lo imposta da solo o aspetta il comando 10 dal PLC? Se lo aspetta, una consegna li allinea tutti.

**Trovato il** 2026-10-07, intestazione della consegna 35, in attesa del robotista.

## [ ] FB204: chiedere il rilascio del cassetto prima di un cambio pinza o pallet

**Cosa.** Con la consegna 35, con un cassetto fuori la pinza non si cambia mai: in automatico il ciclo si ferma col 952 (FB204 in 9999), si rientra il cassetto e si dà RESET.

**Direzione.** FB204 chieda da solo il rilascio del cassetto prima di un cambio pinza o pallet, invece di fermarsi col 952. Modifica di FB204, da decidere.

**Trovato il** 2026-10-07, intestazione della consegna 35.

## [ ] BASE_WEB_MM da confermare (base dei grigliati, 7/10)

**Cosa.** `HMI/src/util/baseDxf.js`, `BASE_WEB_MM = 3`: il materiale minimo fra una cavità (col franco scelto) e il bordo di un foro o il profilo di `Base.dxf`. Sotto, la tasca è in rosso nel disegno, l'elenco in giallo, e DXF e stampa chiedono conferma; non blocca niente. Deciso il 7/10 sera: resta 3 finché Dario non dice la misura delle viti. `BASE_MIN_FILL = 0.5` va bene.

**Direzione.** Con la misura delle viti si corregge la costante; `test_base_dxf.mjs` controlla le soglie (r + 3,01 mm pulito, r + 2,99 conflitto) e va aggiornato col valore nuovo.

**Trovato il** 2026-10-07.

## [ ] Fori di fissaggio della piastra contro le tasche della colonna centrale

**Cosa.** Nella base del 7/10 i fori di fissaggio della piastra stanno in due gruppi al centro dei lati corti, oltre i 20 mm del bordo minimo della griglia. Con una griglia d'esempio (pezzo 60×40, distanze 20 e 15) le tasche 5 e 86, della colonna centrale, cadono sui fori. Oggi è solo l'avviso (tasche in rosso, elenco in giallo, conferma su DXF e stampa).

**Direzione.** Regola da decidere con Dario: per esempio lasciare libera la colonna centrale vicino ai fori, o spostare la griglia. Finché non c'è, resta l'avviso.

**Trovato il** 2026-10-07, schermate della base.

## [ ] GratingTest.vue e ImportGrating.vue non usano la base di `Base.dxf`

**Cosa.** Dal 7/10 la base dei grigliati la legge e la disegna solo `views/conf/Grating/Grating.vue`. `GratingTest.vue` (rotta già rimossa il 1/9) e `ImportGrating.vue` (legacy, rotta `/conf/importGrating`) non disegnano la base e restano fuori da questo lavoro.

**Direzione.** Niente finché restano legacy; se una delle due torna in uso, deve leggere la base da `util/baseDxf.js` come Grating.vue.

**Trovato il** 2026-10-07.

## [ ] ensureSchema all'avvio del backend fallisce in cella: niente permessi per sp_refreshview

**Cosa.** All'avvio il backend lancia `ensureSchema()` (`serverDati/server.js`):
`ALTER TABLE VICE ADD PALLET_ID` se la colonna manca, poi
`EXEC sp_refreshview 'VICES'`. In cella il 7/10 fallisce con «The user does
not have permission»: `sp_refreshview` chiede permessi sulla vista che
l'utente del backend non ha (in cella gli script con ALTER si lanciano a mano,
APPUNTI-CELLA). La colonna `VICE.PALLET_ID` c'è già, quindi l'ALTER salta
per la guardia; resta l'errore nel log a ogni avvio, e il backend non
controlla davvero che la vista `VICES` esponga `PALLET_ID`.

**Direzione.** Farne un controllo di sola lettura: nessun ALTER e nessun
refresh dal backend; se `COL_LENGTH('VICES','PALLET_ID')` è NULL, un errore
nel log che dice di rinfrescare la vista a mano. Il refresh, se serve, con
lo script lanciato in cella da un utente che ha i permessi.

**Trovato il** 2026-10-07, segnalato da Dario in cella.

## [ ] AllTrayInside (%I35.6) non cablato: un cassetto a metà corsa non lo vede nessuno

**Cosa.** Limite dichiarato dalla consegna 34 (7/10). Le catene pinza
riconoscono un cassetto fuori dal registro `ExtractedTray`, dai sensori
`I_OUT_TRAY1..12` e dalle catene di estrazione o rilascio attive. Un cassetto
fermo a metà corsa non accende nessuno dei tre, e la pinza si muoverebbe.

**Direzione.** Se il sensore `AllTrayInside` (%I35.6) esiste sull'impianto,
cablarlo chiude il buco. Da verificare in cella se c'è. Nel PLC è già
l'ingresso `AllTrayInside` di FB_easyBox (tag `All_trays_Inside`, in Main).

**Trovato il** 2026-10-07, limiti della consegna 34.

## [ ] Righe 15 e 24 di GRIPPER, i vecchi «ganci» a scaffale: esistono ancora?

**Cosa.** Le righe 15 e 24 (SUB_POS 1002, POS_MAG 2, `HAS_HOOK = 0`) sono le
vecchie righe «gancio»: fino alla consegna 34 la ricerca dell'uncino del PLC
cercava le righe con SUB_POS > 1000. Dal PLC 34 l'uncino è `HAS_HOOK` e quelle
righe non le usa più nessuno: la vista `GRIPPERS` non le mostra e l'anagrafica
le esclude (SUB_POS < 1000).

**Direzione.** Decidere con Dario se quei ganci esistono ancora fisicamente.
Le righe non si toccano finché non è deciso.

**Trovato il** 2026-10-07, consegna 34.

## [ ] FB_Robot: `currentGripperHasHook` dichiarata e mai usata

**Cosa.** Variabile dell'interfaccia di FB_Robot, dichiarata e mai letta né
scritta. La consegna 34 non la usa e la lascia com'è, per non cambiare
l'interfaccia (download senza reinizializzazione).

**Direzione.** Toglierla alla prossima modifica dell'interfaccia di FB_Robot.

**Trovato il** 2026-10-07, consegna 34.

## [ ] Il 244 in manuale usa ancora DB_MC1.order.ID

**Cosa.** Limite dichiarato dalla consegna 33 (7/10). La consegna corregge la
scelta dell'ordine nel deposito e nel prelievo manuale da pannello (vista
`MAN_ORDER_MC1` 7/10, simulazione problema 3), ma la missione 244 (preleva
il finito e deposita il grezzo in MC1) in manuale decide ancora con
`DB_MC1.order.ID`, che FB204 non azzera a fine produzione: dopo un ordine
finito puo' usare i dati dell'ordine chiuso.

**Trovato il** 2026-10-07, limiti della consegna 33. Collegato al problema 3
di [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md).

## [ ] Il pulsante HOLD azzera Error anche con una catena ferma su un errore (FB8)

**Cosa.** Limite dichiarato dalla consegna 33 (7/10). La consegna rifiuta i
comandi da pannello con un errore attivo (972, simulazione problema 9), ma il
fronte del pulsante HOLD (o l'apertura della porta) in FB8 azzera ancora
`Error` anche quando una catena e' ferma proprio su quell'errore: l'errore
sparisce senza che la causa sia stata tolta.

**Direzione.** Il pulsante non deve azzerare l'errore se una catena e' ferma
su un errore (problema 9 di [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md)).

**Trovato il** 2026-10-07, limiti della consegna 33.

## [x] Simulazione 7/10, problema 1: [S1] il riarmo azzera il PLC mentre il robot riprende la missione

**Cosa.** `Start_AUX` (%I230.2) o `ResetAreaRobot` (%I33.5), letti a livello, azzerano le catene di FB7, il ponte SQL, `Command`, `MissionCode` e il master di FB204; il robot invece riprende la missione. Spiega l'incidente del pallet del 6/10. Della stessa famiglia il reset 99, i posizionamenti in HOLD e il 18.

**Stato.** chiuso con procedura (decisione di Dario del 7/10, DECISIONI.md): nessuna correzione PLC. Dopo un'emergenza: HOLD, RESTART MAIN PROGRAM, HOME, poi Reimposta stato cella, più pallet in macchina e tasche se toccati. I 7 passi sono in APPUNTI-CELLA.md, «Riarmo dopo un'emergenza». Il punto aperto col robotista è chiuso: il 7/10 ha confermato che RESTART MAIN PROGRAM, in HOLD, abbandona la missione e mette il robot in attesa della prossima, e che i ritorni in home sono sicuri da qualunque punto. Il problema 15 e il pezzo in macchina ritentivo restano nelle loro voci.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 1.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 2: [S2] dopo un deposito manuale del pallet in MC il registro della macchina e' sbagliato

**Cosa.** Al 60 di Pallet_Robot_to_MC `"DB_MC1".pallet := #pieceReq`, ma `pieceReq` e' TEMP e calcolata al 10, in un altro ciclo: al 60 non contiene il pallet comandato.

**Stato.** corretto dalla consegna 33 (PLC, 7/10), scaricata il 7/10 verso le 13:45; restano i test di accettazione. In cella, prima: controllo 1 del documento (`DB_MC1.pallet` deve valere il pallet in macchina).

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 2.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 3: [S1 IPOTESI, S2] il deposito manuale in MC1 usa l'ordine chiuso

**Cosa.** La consegna 30 decideva «ordine avviato» con `DB_MC1.order.ID > 0`, che FB204 non azzera a fine produzione: dopo un ordine finito il deposito (e il prelievo) manuale prendeva quote, spinta e soffiaggio dell'ordine chiuso.

**Stato.** corretto dalla consegna 33 (PLC) con la vista `MAN_ORDER_MC1` 7/10 (`serverDati/scripts/man-order-mc1.sql`, da lanciare prima del download). Resta il 244 in manuale (voce a parte).

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 3.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 4: [S1] finito depositato su una tasca gia' piena

**Cosa.** Al 50 di Part_Robot_to_MC `PartSubPosMC` e `TrayIdMC` vengono sovrascritti col grezzo appena depositato, senza condizioni; in alcuni percorsi di FB204 il finito precedente e' ancora sul lato 2, va nella tasca del grezzo e al giro dopo un altro finito ci viene posato sopra.

**Stato (consegna 35, 7/10).** Il deposito a tasca fissa vuole la tasca vuota a database: invece di posare su una tasca piena si ferma col 691. La correzione vera è il registro della tasca del finito (voce in cima).

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 4.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 5: [S1/S2] due numeri di cassetto che si separano: Tray_ID ed ExtractedTray

**Cosa.** Il 25 scrive `Tray_ID` anche quando e' rifiutato, `Tray_ID` non e' ritentivo, la 38 e i sensori cambiano solo `ExtractedTray`: prelievo nel cassetto estratto ma aggiornamento e deposito su quello di `Tray_ID`.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 5.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 6: [S1 IPOTESI] risposta SQL tardiva consegnata alla query successiva

**Cosa.** Dopo il timeout di 20 s, o un reset con una query in volo, `executeSqlCommand` non viene azzerato: la risposta vecchia puo' finire alla query dopo, con le coordinate di un'altra query al robot.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 6.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 7: [S1 IPOTESI] reset durante la lavorazione HAAS

**Cosa.** Il 99 e il riarmo portano FB204 a 0 anche dal 95, a macchina in lavoro: FB204 puo' rilanciare una missione in macchina.

**Stato (consegna 35, 7/10).** Il RESET (99) col FB204 al 95 e la porta della HAAS chiusa porta FB204 al substate 6, che aspetta il fine ciclo; con la porta aperta va a 0 come prima. Da chiudere dopo il download e il test 10 della consegna (APPUNTI-CELLA, «Consegna 35»).

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 7.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 8: [S2] un errore SQL viene letto come «zero righe»

**Cosa.** L'errorToken non viene letto: una colonna mancante (uno script non lanciato prima del download) disattiva in silenzio la spinta, lascia al robot le misure del pezzo precedente o chiude la produzione; un UPDATE fallito risulta riuscito.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 8.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 9: [S1] missione chiesta con un errore attivo che parte da sola piu' tardi

**Cosa.** I comandi da pannello vengono accettati con `Error` diverso da 0; il master li avvia solo con `Error` a 0; il pulsante HOLD (o la porta) azzera `Error` in FB8 e la missione chiesta minuti prima parte.

**Stato.** la consegna 33 (PLC) rifiuta i comandi con un errore attivo (allarme 972, testi nel pannello). Resta il pulsante HOLD che azzera `Error` (voce a parte).

**Stato (consegna 35, 7/10).** Chiuso anche per «sposta» della pagina Cassetti, che passa dal manager di FB_Robot. **Resta aperto per le missioni di FB204:** una missione 16 in attesa di `Error` = 0 parte quando il fronte del pulsante HOLD fisico azzera `Error`. Con un errore attivo e la produzione in pausa si dà RESET dal pannello (azzera anche `MissionCode`) prima di toccare il pulsante HOLD.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 9.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 10: [S3] in HOLD gli errori non arrivano al pannello; circa 40 codici senza testo

**Cosa.** In HOLD lo stato pubblicato e' fisso e l'errore non esce; i rifiuti (944-946, 970, 971, 2000x) il pannello li aspetta su ALARM/ROBOT, dove il PLC non li mandava: si vedeva solo un timeout. Circa 40 codici senza testo (21, 521, 621, 691, 799, 894, 899, 935, 940-942, 949, 951, 990, 992, ...), alcuni testi sbagliati (22, 936, 30123).

**Stato.** dalla consegna 33 944, 945 e 946 arrivano su ALARM/ROBOT (ALLARMI-PLC.md). Restano la pubblicazione di `Error` in HOLD e i testi mancanti o sbagliati.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 10.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 11: [S1] il contenuto della pinza non blocca i comandi

**Cosa.** Scarico pinza, swap e prelievo pallet passano anche con un oggetto in pinza; l'incoerenza fra memoria del PLC e chele chiuse da' solo l'allarme 23, un messaggio.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 11.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 12: [S1 IPOTESI sui dati] il finito viene depositato in tasca con la quota del grezzo

**Cosa.** Part_Robot_to_TRAY usa le colonne PICK anche per il finito. Oggi nessun effetto se nessun pezzo ha Z_PICK diverso da Z_PLACE (controllo 3 del documento).

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 12.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 13: [S2] HOLD messo o tolto a meta' missione cambia il ramo delle catene

**Cosa.** `RemoteMode := NOT HOLD` viene riletto a ogni ciclo: pallet e finito prendono il ramo manuale (`PalletRequested`, `PartSubPos`), con POS_PLANT sull'ID sbagliato e il finito marcato grezzo.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 13.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 14: [S2] dopo una dichiarazione 35 rifiutata la supervisione 938 resta spenta

**Cosa.** L'indice 31 (Declare_State) e' ritentivo e non viene mai azzerato dal reset: dopo un 35 rifiutato la catena resta sul codice d'errore.

**Stato.** corretto dalla consegna 33 (PLC), scaricata il 7/10 verso le 13:45; resta il test di accettazione.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 14.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 15: [S1 IPOTESI] STOP->RUN a missione in corso

**Cosa.** I Dispatcher ritentivi restano ma il frame della missione e' a zero: una catena al 40 riscrive al robot un comando con coordinate a zero alla prima rimozione di HOLD.

**Stato.** stesso cantiere del pezzo in macchina non ritentivo (voce «Pezzo in macchina non ritentivo»).

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 15.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [x] Simulazione 7/10, problema 16: [S2] Attrezzaggi: «In macchina» e «Rimuovi» scrivevano solo il DB

**Cosa.** Il registro `DB_MC1.pallet` restava com'era, e FB204 decide su quello.

**Stato.** chiuso nel pannello il 7/10 (9c507df): le due destinazioni passano dal PLC (40/41 con l'eco) col modulo `util/palletMachine.js`; 947 o niente eco = nessuna scrittura. Da mettere in servizio aggiornando il pannello. 7/10 sera: anche «Casella» di un pallet in macchina passa prima dal 41. La guardia del 41 (`guardia41`) è una sola per «Rimuovi», «Casella» e il pallet a bordo del robot: con un altro pallet nel registro, o col registro non letto, nessun comando e nessuna scrittura.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 16.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 17: [S3] MQTT: comandi persi e echi persi

**Cosa.** In ricezione una pubblicazione prima del consumatore cancella il comando; in uscita il buffer di 11 posti sovrascrive senza controllo: comandi o echi che si perdono ogni tanto.

**Stato (consegna 35, 7/10).** Limite dichiarato: FC_MQTT ricalcola il comando ricevuto a ogni chiamata, e una pubblicazione di FB204 nello stesso ciclo cancella un comando del pannello prima che FB_Robot lo legga. Succedeva già ai comandi della pagina Robot; dalla 35 vale anche per estrai e riponi della pagina Cassetti, che prima FB_easyBox consumava subito.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 17.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 18: [S2] tasche marcate male nei depositi in tasca

**Cosa.** Il deposito manuale in tasca registra sempre «grezzo», anche col finito; il deposito automatico del grezzo restituito (lato 1) viene registrato come finito, sulla tasca del pezzo in macchina.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 18.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 19: [S1 IPOTESI] cassetto a meta' corsa non rilevabile

**Cosa.** AllTrayInside (%I35.6) non e' collegato e il controllo e' commentato: il rilascio viene confermato senza sensore.

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 19.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Simulazione 7/10, problema 20: [S2] il pannello lavora sul primo cassetto con EXTRACT=1

**Cosa.** Il backend non azzera gli altri cassetti e l'eco non viene confrontato: si puo' modificare un cassetto diverso da quello estratto (controllo 4 del documento).

**Dettagli e direzione:** [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 20.

**Trovato il** 2026-10-07, simulazione a tavolino della cella.

## [ ] Pezzo in macchina non ritentivo

**Cosa.** In FB_Robot (export `plc/FB/FB_Robot.scl`) quattro variabili che
descrivono il pezzo in macchina stanno nella sezione `VAR` senza `RETAIN`
(righe 34-75 dell'export):
- `xPushOffsetMC`: la corsa della spinta, che il prelievo da MC somma alla
  X del deposito (al 30 di `Part_MC_to_Robot` e nel master);
- `TrayIdMC`, `PartSubPosMC`: cassetto e tasca del grezzo entrato in
  macchina, dove torna il finito;
- `OrderIdMC`: l'ordine che ha lavorato il pezzo, scritto nella tasca del
  finito.
Nello stesso blocco `Dispatcher`, `communication_OK`, `Gripper_ID` e
`GripperOccuped` sono invece in `VAR RETAIN`.

**Perche' conta.** Uno STOP -> RUN con un pezzo in morsa azzera le quattro
variabili: si perde la corsa della spinta (il prelievo torna alla X del
deposito, spostato della corsa) e anche tasca, cassetto e ordine del finito.

**Proposta.** Un DB globale ritentivo nuovo per il pezzo in macchina, che si
scarica in RUN senza reinizializzare DB_Robot (spostarle in `VAR RETAIN`
vorrebbe dire cambiare l'interfaccia di FB_Robot, col rischio di dover
reinizializzare l'istanza).

**Da verificare (IPOTESI, non provata).** Cosa fa oggi il ritorno del finito
con `TrayIdMC` = 0 (e `PartSubPosMC` = 0). I punti dove si leggono:
- REGION `updatePartOnTray`, stato 15, ramo automatico:
  `UPDATE [POSITION] SET STATUS=5, Order_ID=... WHERE PARENT='TRAY_<TrayIdMC>' AND SUB_POS=<PartSubPosMC>`;
- il deposito del finito in tasca (automatico, lato 2): la query delle
  coordinate usa `SUB_POS=<PartSubPosMC>`.
Con gli zeri le due query potrebbero non trovare la tasca: da verificare
sul PLC (o in simulazione) prima di decidere.

**Trovato il** 2026-10-06, analizzando il prelievo da MC1 dopo la spinta.

**Consegna 33 (7/10).** Fra i limiti dichiarati: `OrderIdMC` non e'
ritentivo, e col PLC 33 entra anche nella query del soffiaggio (stato 37 di
Part_MC_to_Robot, ramo fra l'ordine attivo e il piu' recente). Stessa
soluzione proposta qui sopra. Collegati i problemi 1 e 15 di [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md).

## [x] Dichiarazione dell'attrezzatura a bordo del robot

**Chiusa il** 2026-10-07. Chiarito con Dario cosa mancava: dichiarare un
PALLET a bordo del robot dopo il prelievo dalla macchina, senza passare dalla
dichiarazione dell'intera cella. Ora c'e' la destinazione «A bordo del
robot» nel Posiziona di Attrezzaggi e, nella pagina Robot, «Dichiara quale
pallet e' in pinza» al posto del solo avviso. Tutte e due mandano al PLC il
35 (e prima il 41 se il pallet e' in macchina) col modulo condiviso
`HMI/src/util/palletOnRobot.js`; il pannello non scrive POS_PLANT=1000. Come
si usa e perche' passa dal PLC: APPUNTI-CELLA, voce del 7/10.

**Cosa.** Dario (6/10 sera): manca la possibilita' di dichiarare
l'attrezzatura a bordo del robot.

**Cosa c'e' oggi.** «Reimposta stato cella» (pagina Robot, comando 35)
dichiara la pinza montata e il contenuto delle chele dei due lati: vuoto,
grezzo, finito o «Pallet». Con le chele aperte il lato 1 e' forzato vuoto.
Per «Pallet» il dialog fa scegliere il pallet da un elenco e il 35 porta il
suo ID (`35;pinza;c1;id1;c2;id2`, id solo col pallet), che il PLC usa. Nel
messaggio di Dario c'era «Pallet, ma senza quale»: nel codice di oggi il
pallet si sceglie; anche questo e' da chiarire.

**Da chiarire con Dario** cosa manca esattamente: per esempio l'attrezzatura
o la morsa montata sul pallet che il robot ha in pinza, oppure un caso che
l'elenco dei pallet non copre.

**Trovato il** 2026-10-06 sera.

## [ ] Nuova attrezzatura dal pannello: l'inserimento non puo' riuscire

**Cosa.** «Nuova attrezzatura» (FixturesView, livello 2) apre `Fixture.vue`
in creazione; il salvataggio chiama `GET /api/conf/fixture/insertFixture`,
che scrive `INSERT INTO FIXTURE (ID, ...) VALUES(${req.query.ID}, ...)`.
`FIXTURE.ID` e' IDENTITY. Provato il 6/10 sul clone, in una transazione
chiusa con ROLLBACK (0 righe in piu', identity ferma):
- dal form in creazione l'ID non c'e': `VALUES(undefined, ...)`, errore 207
  (colonna `undefined`), risposta 500, la pagina mostra «errore»;
- con un ID esplicito: errore 544 (IDENTITY_INSERT e' OFF).

In piu' il backend risponde "OK" e non l'ID creato, e dopo l'inserimento
`Fixture.vue` (riga 264) andrebbe a `/conf/Fixtureonpallet?fixtureID=` con
l'ID del form, cioe' `undefined`.

**Perche' non e' stato corretto.** Va cambiato il backend: inserire senza
ID (la colonna e' IDENTITY) e restituire l'ID creato (`OUTPUT inserted.ID`
o `SCOPE_IDENTITY()`); solo allora la pagina puo' usarlo. Nel lavoro del
6/10 sera il backend era fuori perimetro, e l'ID non si inventa nel
pannello.

**Come si chiude.** Rotta che inserisce senza ID e risponde con l'ID nuovo
(400/500/200 come le altre), `Fixture.vue` che naviga con quello, test con
i mock e prova sul clone.

**Trovato il** 2026-10-06, punto 4 dei difetti del pannello stabile.

## [ ] DELETE /api/conf/position/:ID: rotta morta e senza controlli

**Cosa.** `CONF/Position.js` ha `router.delete('/:ID')` ("TODO: da
testare"): `DELETE FROM POSITION WHERE ID=${req.params.ID}` con l'ID
interpolato senza controllo, e nessuna risposta al chiamante (la richiesta
resta appesa). Nel pannello non la chiama nessuno: il solo pulsante che
puntava a una cancellazione (la conferma DELETE/EXIT di PositionView, che
chiamava un metodo `deleteposition` mai esistito) e' stato tolto il 6/10.

**Perche' conta.** Le posizioni sono quote tarate: una cancellazione per
errore toglie al PLC un punto di prelievo o deposito.

**Da decidere (Dario).** Togliere la rotta, o lasciarla con ID intero
controllato, risposta e audit. Il backend non e' stato toccato.

**Trovato il** 2026-10-06, punto 3 dei difetti del pannello stabile.

## [ ] COORDINATES_Z_MC: quote del pezzo e dell'attrezzatura senza ISNULL

**Cosa.** Nella vista `COORDINATES_Z_MC` (versionata il 6/10 in
`serverDati/scripts/coordinates-z-mc.sql`) entrano senza `ISNULL` tre colonne
che nello schema ammettono NULL:
- `PIECE.Z_PICK`, in `Z_PLACE_MC` (deposito del grezzo);
- `PIECE.Z_PLACE`, in `Z_PICK_MC` (prelievo del finito);
- `FIXTURE.Z`, in tutte e due.

Le altre componenti: `POSITION.Z` e' NOT NULL; `VICE.Z_CLAW` e
`VICE.Z_SINK_CLAW` hanno gia' `ISNULL`. Le chiavi dell'ordine
(`WORKORDER.PIECE_ID`, `FIXTURE_ID`, `MACHINE_ID`) se NULL tolgono la riga,
perche' i join sono interni; `WORKORDER.PALLET_ID` NULL invece non trova la
morsa e le chele entrano come 0.

**Perche' conta.** Il ponte SQL non converte NULL in zero: un NULL arriva al
PLC come numero casuale sulla Z di deposito o di prelievo, e al 30 non c'e'
nessun controllo di plausibilita' sulla Z.

**Da valutare.** Escludere la riga quando una di quelle colonne e' NULL (il
PLC riceve zero righe e da' l'allarme 799/899) invece di `ISNULL` a 0, che
darebbe una Z sbagliata ma credibile.

**Prima di decidere**, in cella, la query che conta pezzi e ordini con quelle
colonne NULL (sola lettura):

```
-- pezzi con quota di presa o di rilascio NULL
SELECT ID, FAMILY, Z_PICK, Z_PLACE FROM PIECE WHERE Z_PICK IS NULL OR Z_PLACE IS NULL;
-- attrezzature con Z NULL
SELECT ID, FAMILY, Z FROM FIXTURE WHERE Z IS NULL;
-- ordini che la vista legge con una quota NULL, per stato
SELECT w.STATUS, COUNT(*) AS ordini
  FROM COORDINATES_Z_MC z JOIN WORKORDER w ON w.ID = z.ORDER_ID
 WHERE z.Z_PLACE_MC IS NULL OR z.Z_PICK_MC IS NULL
 GROUP BY w.STATUS;
-- ordini senza pallet (la morsa non si trova, chele a 0)
SELECT ID, STATUS FROM WORKORDER WHERE PALLET_ID IS NULL;
```

Sul clone del portatile (backup della cella del 6/10, 17:47): 0 pezzi, 0
attrezzature, 0 ordini senza pallet, 0 righe della vista con una quota NULL
(7 pezzi e un solo ordine in tutto).

**Trovato il** 2026-10-06, versionando la vista per la quota Z della spinta.

## [ ] FB_Robot: il commento "lo decide la vista, non il PLC" non vale piu'

**Cosa.** Negli stati 1418 (scambio), 39 di Part_Robot_to_MC e 39 di
Part_MC_to_Robot, sopra le righe che scrivono `Part_Length_mm` e
`Part_Height_mm`, il commento dice ancora che quale colonna di PIECE diventa
lunghezza e quale altezza "lo decide la vista COORDINATES_BLOW_MC, non il
PLC". Dal 6/10 (d89b2de) X e Y si incrociano nel PLC: `Part_Width_mm` :=
col[3] (PIECE.X), `Part_Length_mm` := col[1] (PIECE.Y).

**Perche' non e' stato corretto sul momento.** E' un commento nel PLC: si
cambia in TIA e va scaricato.

**Come si chiude.** Alla prossima finestra di download: riscrivere il
commento nei tre stati (la mappa e' nell'intestazione di
`serverDati/scripts/coordinates-blow-mc.sql`), poi tia-export e commit.

**Trovato il** 2026-10-06, nell'export dopo lo scambio di X e Y.

## [ ] Misure del pezzo al robot: verificare la mappa con X > Y e con un cilindro

**Cosa.** La mappa del 6/10 (`Part_Width_mm` = PIECE.X, `Part_Length_mm` =
PIECE.Y, `Part_Height_mm` = PIECE.Z) e' stata riscontrata in cella con un
solo pezzo, il 1035 (X 40, Y 109, Z 15), che ha X < Y.

**Ipotesi da falsificare.** Il robot vuole la misura per ASSE (Length = lungo
le chele = PIECE.Y), non il lato piu' lungo. Col 1035 le due letture danno lo
stesso risultato, perche' il lato lungo le chele e' anche il piu' lungo.

**Come si chiude.** Col primo pezzo con X > Y e col primo cilindro (X = D):
guardare cosa fa il robot con le misure che riceve (%QW636, %QW640, %QW642).
Se con X > Y vuole ancora Length = PIECE.Y, la mappa e' per asse e resta; se
vuole il lato piu' lungo, va rivista.

**Trovato il** 2026-10-06.

## [ ] Etichette L/W/H della pagina Pezzo e nomi delle misure del robot

**Cosa.** Nella pagina Pezzo X e' etichettata L (D se cilindro), Y W e Z H;
il robot riceve `Part_Width_mm` = PIECE.X e `Part_Length_mm` = PIECE.Y. La
stessa misura si chiama L nel pannello e Width verso il robot, e Y il
contrario. Le colonne della vista COORDINATES_BLOW_MC seguono l'anagrafica.

**Da decidere.** Se rinominare le etichette della pagina Pezzo, o
affiancarle ai nomi del robot, oppure tenere i due vocabolari con la mappa
scritta nell'intestazione di `coordinates-blow-mc.sql`. Dipende anche
dall'esito della voce precedente.

**Trovato il** 2026-10-06.

## [ ] Stato tasche in QoS 0: una radice di topic separata lato PLC

**Cosa.** Dal 18/9 la subscribe e' `FROM_PLANT/#` in **QoS 0** (prima QoS 2):
in QoS 2 mqtt.js teneva ogni pacchetto in arrivo nel suo `incomingStore` in
memoria fino alla stretta di mano a quattro passaggi, ed era una delle
strutture che crescevano nel crash per out of memory.

**Il rischio che resta.** Quasi tutto cio' che arriva su `FROM_PLANT/#` e'
stato pubblicato ON-CHANGE e ricostruibile col refresh 90 — marca, ausiliari,
stati unita', dispatcher, DECLARE. **Tranne `FROM_PLANT/PART/#`**, lo stato
delle tasche: il 90 non ripubblica il contenuto dei cassetti. Un messaggio
perso li' lascia la tasca allo stato vecchio, e da quando la chiusura
dell'ordine si appoggia al conteggio dei finiti (`setPositionStatus`),
l'ordine non si chiude.

**Perche' non e' stato corretto sul momento.** Per tenere quel solo topic in
QoS 2 serve una seconda `subscribe` che si SOVRAPPONE a `FROM_PLANT/#`, e
mosquitto su sottoscrizioni sovrapposte puo' consegnare lo stesso messaggio
due volte. I doppioni non farebbero danni (le scritture sono idempotenti:
`UPDATE POSITION SET STATUS`, e la chiusura ordine e' protetta da
`AND STATUS = 3`), ma raddoppierebbero il traffico su quel topic e le righe
di diario. Rischio accettato da Dario il 18/9.

**Come si chiude.** Chiedere al PLC una radice di topic separata per le
tasche (es. `FROM_PLANT_PART/#`), cosi' le due subscribe non si sovrappongono
e quella sola resta in QoS 2. Serve una modifica lato PLC, quindi non e' un
lavoro solo di pannello.

**Come ci si accorge che e' successo.** Una tasca ferma a grezzo con il pezzo
gia' lavorato, o un ordine a `PRODUCTED` uguale a `QUANTITY` che resta in
lavorazione.

## [ ] `dataStored.userLevel<0`: vincoli di sola lettura che non bloccano niente

**Cosa.** Nei form compare `:readonly="dataStored.userLevel<0"`. Il livello
utente vale 0, 1 o 2 e non e' mai negativo, quindi l'espressione e' sempre
falsa e il campo resta sempre modificabile. Dove l'idioma e' usato per
`:disabled` su un bottone, vale lo stesso: il bottone non si disabilita mai.

**Quanto.** 44 occorrenze in tutto, ma solo 14 sono raggiungibili dal router
attivo. Le altre stanno in file morti e non vanno toccate.

| File | Occorrenze | Stato |
|---|---|---|
| `views/conf/Grating/Grating.vue` | 9 | vivo, rotta `/conf/Grating/:grating_ID` |
| `views/conf/Grating/ImportGrating.vue` | 4 | vivo, rotta `/conf/importGrating`, gia' marcato legacy |
| `views/conf/Fixture/FixtureOnPallet.vue` | 1 | vivo, rotta `/conf/FixtureOnPallet` |
| `views/conf/Grating/GratingTest.vue` | 10 | rotta RIMOSSA l'1/9, file non raggiungibile |
| `views/conf/Grating/old/Grating1.vue` | 10 | morto |
| `views/conf/Grating/old/GratingTestORIGI.vue` | 10 | morto |

**Perche' conta.** Sono i form del grigliato e dell'attrezzatura su pallet,
cioe' dati che finiscono nelle coordinate lette dal robot. Chi ha scritto quei
binding voleva un vincolo e ha creduto di averlo messo.

**Perche' NON e' una sostituzione meccanica.** Rimpiazzare `<0` con `>=1`
accenderebbe di colpo 14 vincoli veri, e da domani l'operatore di livello 0 non
potrebbe piu' modificare campi che oggi modifica tutti i giorni. La soglia va
decisa campo per campo con chi usa il pannello, non dedotta dal codice. Per
questo il lavoro e' separato: la parte tecnica e' banale, la parte che conta e'
la decisione su chi puo' toccare cosa.

**Trovato il** 2026-09-15, durante la proposta della pagina di simulazione
della spinta in battuta.

## [ ] Bersagli touch sotto il minimo, e viste non responsive

**Cosa.** Nel pannello di prima la classe base `.pure-button` (`HMI/src/assets/pure.css`) dichiara
`padding: .5em 1em` e nessun `min-height`: l'altezza risultante sta intorno ai
30 px, contro i 44 raccomandati per il tocco. La usano 46 file `.vue`.

**Stato (7/10).** Il pannello v3 (ramo `ui-v3`) la risolve sulle pagine rifatte:
bersagli a `--touch-target` e viste che si adattano alla finestra. Restano:
- le pagine non rifatte della voce «Pannello v3: pagine non rifatte e voci
  aperte» (wizard dell'ordine, Grigliato, Importa grigliato, `layoutView.vue`
  a metà);
- i dialog `mission-dialog`: dalla fase E1 (4cae76a, solo `ui-v3`) i pulsanti
  nelle righe `.pure-g` dei dialog e i `.button_pressed` stanno a
  `--touch-target`, il resto del contenuto va guardato dialog per dialog.

**Perche' conta.** Col tablet **portato in giro intorno alla cella**, in piedi e
in movimento, sbagliare bersaglio diventa normale.

**Nella stessa famiglia**, censito il 15/9 in `PWA-TABLET.md` per il pannello di
prima: disegni a dimensione fissa in `views/layoutView.vue`, due anteprime 3D a
360x360 in `conf/Vice/Vice.vue` e `conf/Gripper/Gripper.vue`, la tabella
cassetti a 16 colonne, 6 viste responsive su 25, e 62 regole `:hover` che sul
touch non hanno senso.

**Perche' NON e' una sostituzione meccanica.** Alzare `.pure-button` a 44 px
sposta il layout di ogni pagina che la usa, comprese quelle dense di comandi
che oggi entrano in una schermata. Va fatto guardando le pagine, non con una
regola globale.

**Trovato il** 2026-09-15, aggiungendo il supporto PWA per il tablet;
riscritta il 2026-10-07 col pannello v3.
