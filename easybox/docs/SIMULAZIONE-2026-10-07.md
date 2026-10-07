# Simulazione a tavolino della cella — 7/10/2026

## Cos'è e cosa non è
Cinque agenti hanno seguito il codice stato per stato su `ui-lifting` bcd6d42, quello in cella: FB7, FB8, FB204, FB_easyBox, ponte SQL, OB1 (XML), backend e pannello. Hanno simulato produzioni, emergenze in vari punti e comandi da pannello. **Non è un'esecuzione**: non c'erano né simulatore PLC, né robot, né HAAS.

I report completi sono `agente1_produzione.md`, `agente2_cassetti.md`, `agente3_pannello.md`, `agente4_pallet_pinze.md` e `agente5_trasversale.md`, nella stessa cartella.

**Risposte del robotista (Dario, 7/10 09:44), che decidono quale variante vale:**
1. Dopo il reset il robot **riprende la missione in corso**, a meno di un riavvio del cabinet.
2. La sequenza degli stati è quella normale: acquired, executing, executed tenuto fino al comando azzerato, poi waitingNewCmd.
3. Il robot ha una memoria **ritentiva** di cosa ha in pinza.
4. Nelle fasi della spinta e nella missione 16, alla ripartenza **continua la missione**.

Quindi vale la **variante V2**. I problemi che gli agenti davano solo con V1 o V3 scendono di priorità; quelli legati a V2 salgono.

Legenda: **[C]** = verificato da Claude sul codice (file:riga). **[A]** = verificato dall'agente, non ricontrollato da Claude. **IPOTESI** = dipende da robot, macchina o dati.
Gravità: S1 urto o posizione fisica sbagliata; S2 dati sbagliati che portano a una missione sbagliata; S3 ciclo fermo; S4 messaggi.

---

## Controlli da fare subito in cella (sola lettura)
1. **`"DB_MC1".pallet` deve valere 9** (il pallet 9 è in macchina). Se vale 0 o altro, è il problema 2: prima di qualunque ciclo automatico, dichiara il pallet dalla pagina Macchine (40;9). Altrimenti FB204 può decidere di montare un altro pallet nella macchina occupata.
2. **`"DB_MC1".order.ID`**: annota il valore. Se è un ordine già chiuso, i depositi manuali in MC1 userebbero i dati di quell'ordine (problema 3).
3. Pezzi con quota di presa diversa fra grezzo e finito (problema 12):
   `cd D:\Prog\easybox; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -Q "SELECT ID, Z_PICK, Z_PLACE FROM PIECE WHERE Z_PICK <> Z_PLACE"`
4. Cassetti segnati estratti nel DB (problema 20), da confrontare con `"DB_BOX_1".ExtractedTray`:
   `cd D:\Prog\easybox; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -Q "SELECT FLOOR_MAG, EXTRACT FROM TRAY WHERE EXTRACT <> 0"`

**Regola provvisoria per chi è in cella, finché il problema 1 non è corretto:**
- Start AUX e reset area robot solo dopo un'emergenza.
- Dopo qualunque riarmo con una missione in corso: lasciare che il robot finisca, poi controllare i registri (pinza occupata, pallet, tasche) prima di ripartire, oppure fare «Reimposta stato cella».

---

## I problemi, in ordine di priorità

### 1. [S1] Il riarmo azzera il PLC mentre il robot riprende la missione
- **Cosa.** `Start_AUX` (%I230.2) o `ResetAreaRobot` (%I33.5) azzerano tutte le catene di FB7, il ponte SQL, `Command`, `MissionCode` e il master di FB204 [C: FB_Robot.scl 5524-5560, 5624-5630]. Sono letti a livello, quindi lo fanno anche senza emergenza. Il robot invece riprende la missione (risposta 1 del robotista).
- **Effetti:**
  - il robot finisce una missione che il PLC ha dimenticato: pinza occupata, stato della pinza, `POS_PLANT` e tasche non vengono aggiornati;
  - se la missione aveva un handshake (fasi della spinta 42-45 e 1420-1423, fase 2 della missione 16), il robot aspetta un consenso che nessuno darà più, e la cella resta ferma senza allarme;
  - FB204 riparte da 0 su registri sbagliati.
- **Spiega l'incidente del 6/10** [C + robotista]: prelievo del pallet da MC in corso, riarmo, catena 4 a 0, il robot finisce il prelievo. La mattina dopo: `POS_PLANT` 101, pinza vuota, `Dispatcher[4]` = 0. È esattamente lo stato trovato.
- **Della stessa famiglia** [A]: il reset 99, i comandi di posizionamento in HOLD (tutti con `RESET_ALL_DISPATCH`), e il 18 (riavvio del programma robot), accettato anche col robot in esecuzione.
- **Direzione.** Il riarmo dopo un'emergenza non deve buttare via le catene: il robot riprende, e le catene devono poterlo seguire fino alla fine. Il reset «vero» (99, 18) deve essere accettato solo a robot fermo e senza missione, e deve costringere a dichiarare lo stato prima della ripartenza. **Va progettato insieme al robotista.**
- **Prova in campo.** In HOLD, senza movimento, con una catena parcheggiata: premere Start AUX con Aux_OK alto e vedere i Dispatcher andare a 0.

### 2. [S2, può diventare S1] Dopo un deposito manuale del pallet in MC il registro della macchina è sbagliato
- **Cosa.** Al 60 di Pallet_Robot_to_MC c'è `"DB_MC1".pallet := #pieceReq` [C: riga ~2787]. Ma `pieceReq` è una variabile TEMP [C: riga 78] calcolata al 10, in un altro ciclo: al 60 non contiene il pallet comandato (vale 0 o un residuo).
- **Effetti:**
  - la pagina Macchine dice «nessun pallet»;
  - FB204 può montare un secondo pallet nella macchina occupata;
  - in automatico il prelievo successivo aggiorna `POS_PLANT` sull'ID sbagliato.
- **Direzione.** Al 60 scrivere `PalletRequested`, oppure salvare il valore in una variabile statica al 10. È una correzione piccola.
- **Prova:** controllo 1 qui sopra.

### 3. [S1 IPOTESI, S2 certo] Il deposito manuale in MC1 usa l'ordine chiuso
- **Cosa.** La consegna 30 sceglie «ordine avviato» con `DB_MC1.order.ID > 0`. Ma FB204 **non azzera `order.ID` a fine produzione**: lo fa solo col reset di errore macchina [C: FB_Machine_Autonomous.scl 1330-1339 contro 1460]. Dopo un ordine finito, il deposito manuale prende quote, spinta e soffiaggio dell'ordine chiuso invece dell'ordine in attesa (MAN_ORDER_MC1). Lo stesso vale per il prelievo manuale.
- **È un errore mio nella consegna 30.** Il 6/10 il test era riuscito perché `order.ID` era 0 in quel momento.
- **Direzione.** Decidere «ordine avviato» dallo stato reale dell'ordine (o dallo stato di FB204), non da `order.ID > 0`. Oppure: in manuale usare sempre l'ordine in attesa del pezzo, includendo anche quello avviato.
- **Prova:** controllo 2 qui sopra.

### 4. [S1] Finito depositato su una tasca già piena
Trovato da due agenti, indipendentemente.
- **Cosa.** Al 50 di Part_Robot_to_MC, `PartSubPosMC` e `TrayIdMC` vengono sovrascritti col grezzo appena depositato [C: righe 3711-3712, senza condizioni]. In alcuni percorsi di FB204 (55-56-50-58 e 57-58) il finito precedente è ancora sul lato 2: va nella tasca del grezzo, e al giro dopo il finito successivo ci viene posato sopra.
- **Basta poco:** un errore SQL sul conteggio al 95, un riavvio da 0 con pezzo in macchina, un cambio cassetto.
- **Stato.** La sovrascrittura è [C]; i percorsi di FB204 che ci arrivano sono [A].
- **Direzione.** Non toccare quei registri finché il lato 2 è occupato; separare «finito a bordo» da «pezzo in macchina»; nel deposito automatico pretendere la tasca vuota (STATUS=2).

### 5. [S1/S2] Due numeri di cassetto che si separano: Tray_ID ed ExtractedTray [A]
- **Come si separano:**
  - il comando 25 scrive `Tray_ID` anche quando viene rifiutato (19002);
  - `Tray_ID` non è ritentivo;
  - la dichiarazione 38 e i sensori cambiano solo `ExtractedTray`.
- **Effetti.** Prelievo nel cassetto estratto, ma aggiornamento DB e deposito sul cassetto di `Tray_ID`. Tasche sbagliate nel DB; con la vista v3 il robot va alla quota del cassetto chiuso.
- **Direzione.** Nelle catene delle tasche usare solo `ExtractedTray`; scrivere `Tray_ID` solo dopo la validazione; il deposito deve rifiutare se il cassetto non è quello giusto.

### 6. [S1 IPOTESI] Risposta SQL tardiva consegnata alla query successiva [A]
- **Cosa.** Dopo il timeout di 20 s, o dopo un reset con una query in volo, `executeSqlCommand` non viene azzerato. La risposta vecchia può finire alla query dopo, con le coordinate di un'altra query al robot.
- **Dipende** da come SQL Server tratta il secondo batch sulla stessa connessione (IPOTESI).
- **Direzione.** Dopo timeout o reset, riciclare la connessione prima di riaprire il ponte.

### 7. [S1 IPOTESI] Reset durante la lavorazione HAAS [A]
- **Cosa.** Il 99 e il riarmo portano FB204 a 0 anche dal 95, a macchina in lavoro. FB204 può rilanciare una missione in macchina.
- **Dipende** dal bit autoMode della HAAS e dal fatto che il robot aspetti la porta aperta.
- **Direzione.** Trattare il 95 come gli altri reset (substate 6).

### 8. [S2] Un errore SQL viene letto come «zero righe» [A]
- **Cosa.** L'errorToken non viene letto. Una colonna mancante (per esempio lo script non lanciato prima del download) disattiva in silenzio la spinta, lascia al robot le misure del pezzo precedente, o chiude la produzione. Un UPDATE fallito risulta riuscito.
- **Direzione.** Se c'è un errore SQL, dataError; per gli UPDATE critici, almeno una riga toccata.

### 9. [S1] Missione chiesta con un errore attivo che parte da sola più tardi [A]
- **Cosa.** I comandi da pannello vengono accettati anche con `Error` ≠ 0; il master li avvia solo con `Error` = 0. Il fronte del pulsante HOLD (o l'apertura porta) azzera `Error` in FB8, e la missione chiesta minuti prima parte.
- **Direzione.** Rifiutare (e azzerare `MissionCode`) quando c'è un errore; il pulsante non deve azzerare l'errore se una catena è ferma su un errore.

### 10. [S3] In HOLD gli errori non arrivano al pannello; circa 40 codici senza testo [A, tre agenti]
- **Cosa.** In HOLD lo stato pubblicato è fisso, quindi l'errore non esce. I rifiuti (944-946, 970, 971, 2000x…) il pannello li aspetta su ALARM/ROBOT, dove il PLC non li manda: si vede solo un timeout.
- **Codici senza testo:** 21, 521, 621, 691, 799, 894, 899, 935, 940-942, 949, 951, 990, 992, 1722, 2001, 2002, 2005, 2021, 2022, 2222, 4022, 19001-19003, 20003-20008, 20010 e altri. Alcuni testi esistenti sono sbagliati: 22, 936, 30123.
- **Direzione.** Pubblicare `Error` a ogni cambio, mandare i rifiuti su ALARM/ROBOT, scrivere i testi.

### 11. [S1] Il contenuto della pinza non blocca i comandi [A]
- **Cosa.** Scarico pinza, swap e prelievo pallet passano anche con un oggetto in pinza. L'incoerenza fra memoria del PLC e chele chiuse dà solo l'allarme 23, che è un messaggio.
- **Direzione.** Rifiutare quei comandi con pinza occupata o chele chiuse; fare dell'incoerenza un errore bloccante.

### 12. [S1 IPOTESI sui dati] Il finito viene depositato in tasca con la quota del grezzo [A]
- **Cosa.** Part_Robot_to_TRAY usa le colonne PICK anche per il finito.
- **Effetto oggi:** nessuno, se nessun pezzo ha Z_PICK ≠ Z_PLACE (controllo 3).
- **Direzione.** Col lato 2 usare le colonne PLACE.

### 13. [S2] HOLD messo o tolto a metà missione cambia il ramo delle catene [A, tre agenti]
- **Cosa.** `RemoteMode := NOT HOLD` viene riletto a ogni ciclo. Pallet e finito prendono il ramo manuale (`PalletRequested`, `PartSubPos`): `POS_PLANT` sull'ID sbagliato, finito marcato grezzo.
- **Direzione.** Fissare all'avvio della missione se è manuale o automatica.

### 14. [S2] Dopo una dichiarazione 35 rifiutata la supervisione 938 resta spenta [A, due agenti]
- **Cosa.** L'indice 31 (Declare_State) è ritentivo e non viene mai azzerato dal reset.
- **Direzione.** Dai rami d'errore tornare a 0; includere l'indice 31 nel reset.

### 15. [S1 IPOTESI] STOP→RUN a missione in corso [A]
- **Cosa.** I Dispatcher ritentivi restano, ma il frame della missione è a zero. Una catena al 40 riscrive al robot un comando con coordinate a zero alla prima rimozione di HOLD.
- **Direzione.** Al primo ciclo dopo il riavvio: reset delle catene e dichiarazione obbligatoria. È lo stesso cantiere del pezzo in macchina non ritentivo.

### 16. [S2] Attrezzaggi: «In macchina» e «Rimuovi» scrivono solo il DB [A, due agenti]
- **Cosa.** Il registro `DB_MC1.pallet` resta com'era, e FB204 decide su quello.
- **Collegato** al prompt «pallet a bordo del robot»: conviene far passare dal PLC (40/41) anche queste due destinazioni.

### 17. [S3] MQTT: comandi persi e echi persi [A]
- **Cosa.** In ricezione, una pubblicazione prima del consumatore cancella il comando. In uscita, il buffer di 11 posti sovrascrive senza controllo.
- **Effetto:** comandi o echi che si perdono ogni tanto.

### 18. [S2] Tasche marcate male nei depositi in tasca [A]
- **Cosa.** Il deposito manuale in tasca registra sempre «grezzo», anche col finito. Il deposito automatico del grezzo restituito (lato 1) viene registrato come finito, sulla tasca del pezzo in macchina.

### 19. [S1 IPOTESI] Cassetto a metà corsa non rilevabile [A]
- **Cosa.** AllTrayInside (%I35.6) non è collegato e il controllo è commentato; il rilascio viene confermato senza sensore.

### 20. [S2] Il pannello lavora sul primo cassetto con EXTRACT=1 [A]
- **Cosa.** Il backend non azzera gli altri cassetti, e l'eco non viene confrontato. Si può modificare un cassetto diverso da quello estratto (controllo 4).

### Già noti, confermati o approfonditi
- Pezzo in macchina non ritentivo.
- Prelievo da MC con la X del deposito (lato robot).
- Incidente pallet del 6/10: adesso spiegato dal problema 1.

### Percorsi simulati senza difetti [A]
- Ordine normale di 3 pezzi, senza disturbi.
- Ciclo nello stesso cassetto con la missione 16.
- Guardie della catena cassetto.
- Query in volo al momento del riarmo: la pulizia del ponte è completa.
- Nessuna query supera i 254 caratteri; la più vicina, la gemella pinza alla riga 2166, ha 5 caratteri di margine.

---

## Proposta di ordine di lavoro
1. **Subito, in cella:** i controlli 1-4 e la regola provvisoria sul riarmo.
2. **Correzioni PLC piccole e sicure**, in una sola finestra di download:
   - problema 2 (`DB_MC1.pallet`);
   - problema 3 (scelta dell'ordine nel manuale);
   - problema 14 (indice 31 nel reset);
   - problema 9 (comandi rifiutati con errore attivo).
3. **Progetto con il robotista:** problema 1 (riarmo che segue il robot) e problema 15 (riavvio), insieme al pezzo in macchina ritentivo.
4. **Pannello e backend** (CC): problemi 10 (testi), 16 e 20, più il prompt del pallet a bordo.
5. **Poi:** problemi 4, 5, 13, 18 (tasche e cassetti), 11 (interblocchi della pinza), 6 e 8 (ponte SQL).
