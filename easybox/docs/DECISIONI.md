# Decisioni

Decisioni di Dario che vincolano codice, dati e procedure in cella; la più recente in alto. Il come (script, comandi, ordine degli interventi) sta in [APPUNTI-CELLA.md](APPUNTI-CELLA.md).

**«Sblocca morsa» con un tocco solo (8/10).** In Controlli › Macchina MC1 «Sblocca morsa» (`TO_PLANT/CMD/MC1 10`) resta un comando diretto, **senza conferma**. L'audit del prompt 10 proponeva la conferma rossa dell'apertura della chela del robot (il PLC lo accetta a ciclo fermo o in HOLD, e con un pezzo in morsa il pezzo può cadere). Dario ha deciso di no: non riproporla.

**Catalogo delle chele della morsa (7/10).** Il cliente vuole un punto dove dichiarare le chele della morsa con le loro misure, e ritrovarle quando le rimonta.
1. **Catalogo per riferimento.** Le misure della chela (lunghezza sull'asse di battuta, altezza, affondo) stanno in un catalogo di tipi di chele (`VICE_JAW`); la morsa punta al tipo montato (`VICE.JAW_ID`) e le viste lette dal PLC prendono le misure dal catalogo. Dato unico: le colonne della morsa restano solo per il ritorno indietro.
2. **Il «punto di appoggio» è la battuta dei pezzi più lunghi della chela.** Resta per coppia morsa + pezzo in `PIECE_ON_VICE`: il riferimento sta sulla morsa, non sulla chela. Ne segue che la battuta va corretta quando cambiano le chele. Geometria data per confermata: chele centrate sulla morsa, battuta fissa sulla morsa.
   - (8/10, prompt 8) **Il riferimento della battuta è il TIPO di chele, non una lunghezza.** Chi la dichiara la misura dalla fine della chela montata in quel momento, e si salva quel tipo (`PIECE_ON_VICE.CLAW_JAW_REF`, FK verso `VICE_JAW`).
   - Le viste usano dichiarata + lunghezza(tipo di riferimento)/2 − lunghezza(tipo montato)/2, con le lunghezze di adesso e le divisioni intere; una lunghezza NULL = nessuna correzione.
   - Così: correggendo la misura del tipo montato, X_Support segue la misura nuova (sono le stesse chele, misurate meglio); montando un tipo diverso, X_Support resta fermo; correggendo poi la misura del tipo vecchio, la battuta segue anche quella.
   - Il pannello mostra e salva la battuta già corretta per le chele montate, col tipo montato come riferimento.
   - Prima (7/10) si salvava la lunghezza (`CLAW_LENGTH_REF`), e ogni correzione della misura veniva trattata come un cambio di chele.
3. **Nomi.** «Chele morsa» e «Chele pinza». Chele della morsa e ganasce sono la stessa cosa: a video una parola sola per oggetto, «chela della morsa» / «chele morsa» e «chela della pinza» / «chele pinza»; «ganascia» non compare più.
4. **Menu.** Attrezzaggio con le schede Attrezzaggi | Pallet | Morse | Chele morsa | Attrezzature.
5. **Il controllo delle chele sta nel backend, al passaggio a STATUS 3** (8/10, prompt 8; prima era un blocco nella vista `COORDINATES_Z_MC`). Il Play da Produzione e il rilancio vengono rifiutati, con un messaggio:
   - se l'ordine ha chele confermate (`WORKORDER.JAW_ID`) diverse da quelle montate sulla morsa del suo pallet (`KO_ORDER_JAW_MISMATCH`);
   - se il pallet ha una morsa senza tipo di chele montato (`KO_ORDER_VICE_NO_JAW`).

   Le viste tornano solo dati. Nascondere la riga fermava il PLC solo nelle query filtrate per ordine. Tre query del PLC prendono invece «l'ordine più recente» dalla vista (prelievo del finito dal pannello, soffiaggio, missione 16 manuale) e avrebbero preso le quote di un altro ordine. Il pannello (parte 2) farà la domanda prima, nel dialog di avvio. Il blocco anche nel PLC, se servirà, dopo aver cambiato quelle tre query (LAVORI-IN-CODA.md).

Il come: APPUNTI-CELLA.md, «Catalogo delle chele della morsa».

**Consegna 35: guardie del PLC (7/10).** Dalla seconda simulazione del 7/10.
1. **I timeout non contano in HOLD.** I timeout di swap (943) e del cassetto (19003) si fermano in HOLD: l'HOLD è una pausa, e CONTINUA riprende.
2. **Il RESET non abbandona un ciclo HAAS in corso a porta chiusa.** Con la macchina in lavorazione (FB204 al 95, porta chiusa) FB204 aspetta il fine ciclo invece di tornare a 0 e rileggere l'ordine col pezzo in lavorazione. Con la porta aperta va a 0 come prima.
3. **La pagina Cassetti comanda i cassetti solo in HOLD.** Estrai e riponi passano dal manager di FB_Robot, con gli stessi rifiuti della pagina Robot.
4. **Un comando di missione non sovrascrive mai una missione in corso o sospesa**: il PLC lo rifiuta col 973. Si riprende con CONTINUA, oppure RESET o la procedura dopo una missione interrotta.

Il come (download, precondizioni, test): APPUNTI-CELLA.md, «Consegna 35»; i codici: ALLARMI-PLC.md.

**Base dei grigliati da `Base.dxf` (7/10).** Il profilo esterno e i fori del grigliato non sono più scritti nel codice di Grating.vue: il pannello li legge da `Base.dxf`, nella cartella `Grating_model_dir` del backend, fuori dal repo. Se cambia il disegno si sostituisce il file, senza toccare il codice e senza build.
1. Il DXF è il grigliato **come lo inserisce l'operatore nel cassetto, visto dal lato operatore**: 0,0 in alto a sinistra, Y negativa verso il basso, la scritta «Robot» sul lato lontano dall'operatore, in alto. **Lo 0,0 è l'origine del work object** e la tasca 1 ci sta vicino.
2. **Il pannello mostra i cassetti dal lato operatore, anche nell'anteprima del Grigliato** (correzione della sera del 7/10, dopo la prova sul cassetto 8: la tasca 1 sta in alto a sinistra, lato robot). Base.dxf, pagina Cassetti e Grigliato hanno la stessa vista: la base non si ruota (`x_svg = x_dxf`, `y_svg = −y_dxf`), e una tasca va in (w, h) di `gridCenters`, come in TrayPockets. Fino a quella sera l'anteprima del Grigliato era la vista lato robot, ruotata di 180°. Il robot sta dal lato opposto: per lui la tasca 1 è in basso a destra. Formule del robot e quote a database non cambiano: una tasca in coordinate robot (X, Y) µm sta nel DXF in (Y/1000, −X/1000).
3. Il DXF di fabbricazione esce **nel frame di Base.dxf** e ci si sovrappone 1:1. Rispetto ai DXF esportati prima del 7/10 (vista lato robot, `y = H − y_svg`) è ruotato di 180°. Profilo e fori si copiano dal file letto, bulge compresi; i testi della base non si esportano; `$INSUNITS` resta 4 (mm).
4. Un file di fabbricazione senza base non esce: con `Base.dxf` assente o non valido DXF e stampa PDF sono bloccati; generazione, salvataggio e modello SVG restano possibili.
5. Le tasche troppo vicine a un foro o al profilo sono **solo un avviso** (in rosso nel disegno, elenco in giallo, conferma su DXF e stampa); il rosso della riga resta per «base assente o non valida». `BASE_WEB_MM = 3` mm dal bordo del foro resta così finché Dario non dice la misura delle viti; `BASE_MIN_FILL = 0.5` va bene. Dal bordo del cassetto la regola resta quella della generazione, almeno 20 mm (`MIN_BORDER_MM`). I 12 cassetti misurano tutti 819 × 605 (verificato il 7/10): un cassetto di riferimento basta.

**Pannello v3: prova in cella, poi merge (7/10, scelta di Dario).** Periodo di prova in cella su `ui-v3`, con `ui-lifting` ancora vivo. Poi merge di `ui-v3` in `ui-lifting`, con un ramo d'archivio del pannello vecchio creato prima del merge.

Dove si mette il file, come si sostituisce, le regole del disegno e cosa vuol dire la riga rossa: APPUNTI-CELLA.md, «Base dei grigliati».

**Pannello compilato in cella (7/10).** In cella il pannello non lo serve più il server di sviluppo di Vite, che compila i moduli alla prima richiesta e al primo caricamento ci mette troppo. Il pannello si compila **in cella** (`vite build` → `easybox\HMI\dist`, col `.env` della cella) e il servizio `EasyBoxPannello` lo serve con `vite preview`, con lo stesso proxy e lo stesso HTTPS, sulla stessa porta 5173. Dopo ogni git pull si ricompila con `servizi-cella.ps1 -Azione aggiorna`; si torna al server di sviluppo con `-Azione dev`. Il pacchetto compilato non va nel repo. L'avvio ritardato dei servizi (circa 2,5 minuti dall'accensione) resta: si decide a parte. Procedura e tempi in APPUNTI-CELLA.md.

**Velocità del robot su %QW650 (7/10).** `Sys_SetRobotspeed` è stato spostato da %QW512 a %QW650 (al posto di `spare_9`) da Dario e dal robotista; il lato robot è allineato e legge la velocità dalla parola nuova. Chiude il dubbio del commit 896cb8f. Il PLC la scrive da `FB_RobotEfort`, a ogni ciclo, col valore che il pannello manda col comando 100.

**Uncino per i cassetti e pinze col cassetto fuori (7/10).** Consegna 34.
1. L'uncino è fisso su certe pinze, quindi è un dato dell'anagrafica: `GRIPPER.HAS_HOOK`, che si scrive dalla pagina della pinza (casella «Uncino per cassetti»; su una pinza doppia vale per tutte e due le righe).
2. Se si chiede di estrarre un cassetto senza una pinza adatta a bordo, il PLC va a prendersi la pinza con l'uncino.
3. Anche il rilascio (rientro) del cassetto vuole l'uncino.
4. Con un cassetto aperto, niente deposito né prelievo di pinze dallo scaffale (rischio d'urto).

Come lo fa il PLC, i codici e la messa in servizio: APPUNTI-CELLA.md, «Consegna 34».

**HOLD e missione interrotta; riarmo dopo emergenza (7/10).** HOLD = pausa: il PLC non azzera niente e CONTINUA riprende la missione dal punto in cui era. La procedura HOLD, RESTART MAIN PROGRAM, HOME, Reimposta stato cella vale solo per una missione interrotta: emergenza o riarmo, RESET con una missione a metà, RESTART MAIN PROGRAM, comando di movimento a metà missione. Per il riarmo dopo un'emergenza nessuna correzione PLC: il robot va in home e lo stato della cella si dichiara con Reimposta stato cella (pezzi in pinza, morsa, cassetto), più pallet in macchina e tasche se la missione interrotta li ha toccati. Procedura completa in APPUNTI-CELLA.md, «Riarmo dopo un'emergenza»; è il problema 1 della [simulazione del 7/10](SIMULAZIONE-2026-10-07.md).

**Appoggi dichiarati nella pagina Morsa (7/10).** Nella pagina Morsa gli appoggi dichiarati (Salva e Cancella della sezione «Appoggi dichiarati») si scrivono solo dal livello utente 1 in su, come nella pagina Spinta in battuta, che scrive la stessa riga di PIECE_ON_VICE con la stessa rotta (`setStop` / `deleteStop`). Sotto il livello 1 i due pulsanti sono spenti e una riga dice perché. Introdotta in e3d4387.

**Deposito manuale in MC1 (6/10).** In manuale, senza ordine avviato, il deposito in MC1 usa i dati dell'ordine in attesa del pezzo prelevato: un ordine di MC1 in coda o in pausa (STATUS 4 o 6), il più recente se sono più di uno. Quote di deposito, spinta e dimensioni del pezzo vengono tutte da quell'ordine. Il pezzo si riconosce dalla tasca di provenienza: ultimo cassetto estratto e ultima tasca di prelievo. Senza ordine in attesa: allarme 970, e l'ordine si crea in Produzione senza avviarlo. Provenienza non nota: allarme 971. Prelievo manuale da MC1 e missione 16 in manuale usano ancora l'ordine più recente di MC1, sia per le quote sia per le dimensioni.

**Work object per cassetto (6/10).** Il robot usa un work object per ogni cassetto: meccanicamente i cassetti non sono paralleli né equidistanti. Il PLC manda il numero del cassetto in N_Cassetto (%QW644) in tutte le missioni sul cassetto, e 0 nelle altre. Le quote delle tasche sono relative al cassetto (vista 4Robot v4): le correzioni del cassetto in TRAY non entrano più nelle quote del robot. Le quote di estrazione sono relative al cassetto e si ottengono conservando la differenza fra prelievo e cassetto che era corretta prima; i ritocchi si fanno a mano in tabella. Il comando "0 CASSETTIERA" è eliminato; le rotazioni si impostano cassetto per cassetto dalla scheda del cassetto.
