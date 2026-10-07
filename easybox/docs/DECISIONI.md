# Decisioni

Decisioni di Dario che vincolano codice, dati e procedure in cella; la più recente in alto. Il come (script, comandi, ordine degli interventi) sta in [APPUNTI-CELLA.md](APPUNTI-CELLA.md).

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
