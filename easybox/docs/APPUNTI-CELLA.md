# Appunti cella — interventi manuali da eseguire in impianto

## Avvio e aggiornamento della cella

**Il clone di cella è parziale** (verificato il 6/10): sparse-checkout in modalità cone, `D:\Prog\.git\info\sparse-checkout` contiene

```
/*
!/*/
/easybox/
```

Sul disco vengono scritti solo i file della radice e la cartella `easybox/`: `tools/` e `plc/` in cella non ci sono. **Tutto quello che deve arrivare in cella sta sotto `easybox/`** (per questo `pannello.ps1` sta in `easybox/tools/`).

**Avvio: nessun servizio, niente nssm.** Due `.bat` che non sono nel repo, ciascuno nella sua finestra:
- backend: `D:\Prog\easybox\serverDati\start_server.bat` (`timeout /t 10`, `cd /d`, `mkdir log`, `node --max-old-space-size=1024 server.js`, `pause`);
- pannello: `D:\Prog\easybox\HMI\start_hmi.bat` (`timeout /t 15`, `cd /d`, `npm run dev`).

Nessuno dei due si riavvia da solo. **Le due finestre non si chiudono senza rilanciarle.** Il 6/10 la chiusura della finestra del backend ha fermato il ponte fra PLC e SQL per circa 13 minuti.

Nel working tree di cella ci sono file non tracciati che il `.gitignore` non esclude: i due `.bat` e la cartella `easybox/serverDati_BACKUP_2026-06-03/`. Sono normali: `pannello.ps1` conta come modifiche locali solo i file tracciati.

**Procedura di aggiornamento:**
1. Cella in HOLD.
2. `cd D:\Prog`, poi `git pull`; oppure lo script, che fa fetch, cambio di ramo, pull solo in avanti e `npm install` se serve:
   ```
   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione stato
   ```
   `-Versione stato` dice su che versione si è, senza cambiare niente; `-Versione stabile` (ramo `ui-lifting`) o `-Versione v3` (ramo `ui-v3`) aggiorna o cambia versione.
3. Backend: nella finestra di `start_server.bat` Ctrl+C, poi rilanciare il `.bat`.
4. Pannello: rilanciare `start_hmi.bat` solo se sono cambiati `package.json`, `package-lock.json` o `vite.config.js`, altrimenti basta Ctrl+F5 sui client.
5. Controlli:
   - porte 5173, 8080 e 3000 in ascolto;
   - `INIT` nuovo in `access.log`;
   - stato del robot che si aggiorna;
   - `DB_executeQuery.readyForNextQuery` TRUE.

## [x] 2026-10-06 — `tools/pannello.ps1` non c'era in cella: clone parziale

Dopo il pull del 6/10 `tools/pannello.ps1` non è comparso in cella. Causa verificata sul PC di cella: il clone è parziale (voce «Avvio e aggiornamento della cella»), git ha messo il file nell'elenco del pull ma non l'ha scritto sul disco. Defender non c'entra: lo storico delle minacce è vuoto.

Risolto:
- lo script sta in `easybox/tools/pannello.ps1` (commit a73e412). Nuovo comando in cella: `powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione stato`;
- contano solo i file tracciati (`git status --porcelain --untracked-files=no`); il messaggio finale non dice più che il backend si riavvia da solo, ma cosa riavviare e i quattro controlli; in testa al cambio di versione ricorda la cella in HOLD (commit 58231d1).

## [ ] 2026-10-06 — work object per cassetto: vista 4Robot **v4**, quote relative al cassetto

**Perché.** Il robotista passa a **un work object per cassetto**: meccanicamente i cassetti non sono paralleli né equidistanti. Da quel momento le quote delle tasche che il PLC gli passa devono essere **relative al cassetto**:
- X e Y dall'angolo del cassetto;
- Z = quota di presa dal fondo.

La vista v3 sommava le correzioni del cassetto (`TRAY.X_CORR`, `Y_CORR`, `Z_CORR`; per il piano 8 la Z del piano vale 698,6 mm): con il work object quelle quote sarebbero sbagliate di tutto l'offset del piano. Decisione di Dario: la regola sta nel **codice** (vista v4), non nei dati, così nessun salvataggio dal pannello può rimettere gli offset di piano.

**Convenzione del work object** (da concordare col robotista):
- origine nell'angolo interno del cassetto vicino alla tasca 1, quello da cui il modello misura 819 × 605;
- X lungo il lato da 605, verso la tasca 40;
- Y lungo il lato da 819, verso la tasca 13;
- Z = 0 sulla superficie su cui appoggiano i pezzi.

**N_Cassetto, %QW644** (REGION `N_Cassetto` in FB_RobotEfort, Signal_TO_ROBOT; Dario la scarica a parte, cella in HOLD):
- valorizzato in **tutte** le missioni sul cassetto: prelievo/deposito pezzo → il cassetto estratto; estrazione → il cassetto chiesto (`Tray_ID`, perché `ExtractedTray` vale ancora 0); rilascio → il cassetto estratto;
- 0 in tutte le altre missioni (pinze sullo scaffale, pallet, macchina);
- a riposo può restare il numero dell'ultimo cassetto usato, e un "Vai a EasyBox" dopo una missione sul cassetto porta N_Cassetto diverso da 0 (il posizionamento scrive Unit_code ma non Object_Type);
- da qui le uscite libere verso il robot partono da %QW646.

**Correzione su 6cabcc4.** Il commit riporta l'export TIA alle 09:34, che è l'ora UTC letta dalla macchina di appoggio. L'export è delle 11:34 ora italiana, dopo l'ultima modifica del progetto delle 11:21.

**Vista v4** (`serverDati/scripts/robot-tray-view-v4.sql`): stesse colonne della v3, stessi nomi e stesso ordine; cambiano le quote e l'espressione di TRAY.
- `X_PICK = pos.X + ISNULL(pos.X_CORR,0) + ISNULL(decentrato pick X,0)`, Y uguale;
- `Z_PICK = ISNULL(pos.Z,0) + ISNULL(pos.Z_CORR,0) + PIECE.Z_PICK`;
- place allo stesso modo; rotazioni come la v3, con `ISNULL` sulla correzione della tasca;
- **niente più `t.X_CORR`, `t.Y_CORR`, `t.Z_CORR`**. Il join su TRAY resta: limita la vista ai piani configurati.
- `ISNULL` su ogni correzione: il ponte SQL verso il PLC non converte NULL in zero, passa valori casuali. Sul clone del DB di cella (6/10) le colonne di correzione di `[POSITION]` hanno default 0 e **accettano NULL**: gli `ISNULL` sono necessari.
- **Colonna TRAY a prova di cast** (decisione di Dario, 6/10): `CASE WHEN pos.PARENT LIKE 'TRAY[_]%' THEN SUBSTRING(pos.PARENT,6,2) END AS TRAY`. Resta la seconda colonna, stesso nome e stesso tipo (nvarchar); sulle tasche dei cassetti vale come prima, sulle altre righe NULL. Perché: con il SUBSTRING nudo le righe `EXTRACT_TRAY_n` davano `'CT'`, e l'ottimizzatore può calcolare un cast a int anche su righe che la vista poi scarta. Il PLC fa `cast(TRAY as int)` nella lista delle colonne (`FB_Robot.scl` righe 2954, 2972, 2978) e confronta TRAY con un intero nella sottoquery su `COORDINATES_FOR_EXTRACT` (`FB_ExecuteQuery.scl` riga 39, `FB_ExecuteQuery2.scl` riga 62). In cella non è mai successo; sul clone la query di verifica con `cast(TRAY as int) = 8` ha dato l'errore 245, e ora filtra con `TRAY = '8'`, come le query del PLC.

**Le correzioni del cassetto in TRAY non contano più** per le quote del robot: restano nel DB, la posizione del cassetto è nel robot. Il pannello lo dice nella pagina Cassetto (avviso fisso sopra X/Y/Z, e accanto alle rotazioni che si impostano lì).

**Quando:** a cella ferma, **insieme** al cambio del programma robot (work object per cassetto), non prima. Da PowerShell, con il backup della definizione vecchia nel file:
```
cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -y 0 -i robot-tray-view-v4.sql -o D:\Backup\vista4Robot_prima_v4.txt; Get-Content D:\Backup\vista4Robot_prima_v4.txt
```
- La guardia confronta la definizione attuale (a spazi normalizzati) con la v3 attesa e con la v4: v3 → la stampa nel file e passa alla v4; già v4 → "conforme", niente; qualunque altra cosa → FERMO, niente.
- La **prima tabella** del file è il default delle colonne `*_CORR` di `[POSITION]`, letto dai metadati: nel repo non c'è, e i due inserimenti di tasche del backend (`insertPositionTray` e "Genera") non scrivono nessuna correzione. Sul clone del DB di cella (6/10): default 0, NULL ammesso (vedi sopra, ISNULL).
- **Verifica**, in fondo al file (cassetto 8, tasche 1/13/40/52): con il grigliato attuale Z_PICK 10000 e X/Y uguali a prima (tasca 1: 101500 / 61500); dopo la rigenerazione con le distanze 19/25, tasca 1 circa 100150 / 55500.
- **Rollback:** con `rollback-wo.sql` (vedi **Rollback** in fondo a questa voce). La definizione v3 resta anche nel file di backup, in fondo allo script v4 (commentata) e in `scripts/superati/robot-tray-view-v3.sql`.
- `superati/robot-tray-view-v3.sql` e `superati/robot-tray-view-v2.sql` sono **inerti sempre**: la v3 migrava alla v3 qualunque vista non fosse v3, la v2 si fermava solo trovando la v3. Dopo la v4 entrambe avrebbero riportato indietro la vista.

**Causa dello scarto trovata il 6/10.** Il grigliato 2098 aveva distanze 18/24 contro la piastra vera, che misurata col metro dà 19/25: passi 709/12 e 405/3. La piastra è centrata nel cassetto 819 × 605: tasca 1 a 100 / 55 misurata, contro 101,5 / 61,5 del modello. Rimedio: rigenerare le tasche col grigliato a 19/25.

**Estrazione** (25) e rilascio (26) usano anche loro il WO del cassetto. Le 12 righe `[POSITION]` con PARENT `EXTRACT_TRAY_n`, che FB7 legge attraverso `COORDINATES_FOR_EXTRACT`, diventano relative al cassetto con `serverDati/scripts/extract-coords-workobject.sql` (scritto da Dario):
- quota relativa = quota attuale meno `TRAY.X/Y/Z_CORR` del piano: si conserva la differenza fra prelievo e cassetto che era già corretta;
- le correzioni della riga (`X_CORR`, `Y_CORR`, `Z_CORR`) restano libere per i ritocchi a mano dalla pagina Posizioni (±5 mm); rotazioni, avvicinamenti e tabella TRAY non si toccano;
- backup nella tabella `dbo.POSITION_EXTRACT_PRE_WO` e nel file `D:\Backup\estrazione_prima_WO.txt`; parte solo con `-v ROBOT_WO=SI`;
- la Z sale di 0,2 mm a piano (passo delle righe 100 mm, cassetti 99,8): ereditato dalla tabella vecchia, si corregge a mano se serve.

**"0 CASSETTIERA" eliminato** (decisione di Dario). Ricavava le correzioni di ogni piano dalle differenze fra le righe di `COORDINATES_FOR_EXTRACT`: dopo lo script di estrazione quelle differenze valgono circa 0,2 mm, e il comando scriverebbe in TRAY valori senza senso. Il robot non se ne accorgerebbe (la v4 li ignora), ma il ritorno alla v3 non sarebbe più possibile. Il pulsante e il dialog non ci sono più; la rotta `/teachTrays` resta e risponde 410 `KO_WORKOBJECT` senza toccare il DB (per un pannello rimasto aperto su una versione vecchia). Le **rotazioni** si impostano cassetto per cassetto dalla scheda del cassetto: salva → `propagateTeaching` → tutte le tasche del cassetto. Da qui la Z delle tasche, che "0 CASSETTIERA" portava a 0, la garantiscono gli inserimenti (Z = 0) e la controlla la verifica della vista v4.

**Ordine della fermata di passaggio**, tutto nella stessa fermata:
1. Robot: WO insegnati sui cassetti che si useranno (l'8 per primo) e programma pronto a usare `N_Cassetto`.
2. PLC con la REGION `N_Cassetto` scaricata (può essere fatto anche prima).
3. `git pull` in cella. È qui che arrivano i testi del pannello e l'eliminazione di "0 CASSETTIERA": non prima.
4. Vista v4 (comando nella sua intestazione).
5. `extract-coords-workobject.sql` (comando nella sua intestazione, con `-v ROBOT_WO=SI`).
6. Robot sul programma con i WO.
7. Prova lenta: estrazione dell'8, rilascio dell'8, prelievo dalla tasca 1 con l'8 fuori.

**Rollback**: `serverDati/scripts/rollback-wo.sql` (scritto da Dario, provato sul clone prima della fermata), al posto della copia a mano dei due blocchi commentati. **Solo con il robot già tornato sul riferimento unico**: per questo parte solo con `-v ROBOT_RIF_UNICO=SI`. Comando (è nella sua intestazione), con il resoconto nel file:
```
cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -v ROBOT_RIF_UNICO=SI -i rollback-wo.sql -o D:\Backup\rollback_wo.txt; Get-Content D:\Backup\rollback_wo.txt
```
- In **una transazione**: riporta la vista dalla v4 alla v3; rimette le 12 righe `EXTRACT_TRAY_n` esattamente come prima del passaggio (X/Y/Z e X/Y/Z_CORR, dalla tabella `dbo.POSITION_EXTRACT_PRE_WO`); rinomina la tabella di backup in `POSITION_EXTRACT_PRE_WO_ANNULLATO_<data_ora>`, così lo script di estrazione si può rilanciare. Due controlli (righe uguali al backup, vista risultante v3): se uno non torna, `ROLLBACK` di tutto.
- **Stati**: vista v4 + backup → annulla tutti e due i passi; vista v3 + backup → solo le quote; vista v4 senza backup con quote ancora assolute (fermata interrotta prima dello script di estrazione) → solo la vista; vista v3 senza backup con quote assolute → niente da annullare; qualunque altro caso → FERMO, nessuna modifica.
- **Non tocca** la tabella TRAY, le tasche, il PLC (`N_Cassetto` resta: il robot sul riferimento unico lo ignora), il pannello. Avvisa (non ferma) se le correzioni TRAY di un piano o le quote di estrazione sono cambiate dopo il passaggio, e scarta le correzioni a mano fatte dopo (restano nel resoconto).
- Per riavere "0 CASSETTIERA" restano da annullare i commit del pannello: `c1ad480` (pannello e rotta `/teachTrays` insieme).

**Compatibilità del DB**: il DB ADMG della cella ha livello di compatibilità **100** (intestazione del backup del 6/10). Negli script niente funzioni che richiedono un livello più alto, come `TRY_CAST` e `TRY_CONVERT`.

### 5/10 sera — dati pezzo al robot e larghezza corretta
- Su richiesta del robotista il PLC passa le tre misure del pezzo dell'ordine in mm interi, troncati: %QW636 `Part_Width_mm` = PIECE.Y, %QW640 `Part_Length_mm` = PIECE.X, %QW642 `Part_Height_mm` = PIECE.Z, accanto a %QW634 `Vice_ClawLength_mm` e %QW638 `X_Support_mm`. Libere da %QW644 a %QW666 (dal 6/10 %QW644 è `N_Cassetto`: vedi sopra).
- Semantica (Dario e robotista, 5/10): X lunghezza, Y larghezza, Z altezza, come L/W/H nella pagina Pezzo.
- Dal 18/9 al 5/10 %QW636 portava PIECE.X, cioè la lunghezza. Corretto in cella il 5/10 alle 19:17 con un ALTER VIEW guardato; il backup della definizione è su `D:\Backup` del PC di cella. Lezione: un nome di colonna o di tag non prova il significato, si confronta col pezzo.
- Limiti: si aggiornano solo nelle missioni in macchina con un ordine attivo e non si azzerano mai. Al primo prelievo dal cassetto di un ordine nuovo il robot vede ancora le misure dell'ordine precedente.
- Riscontro: ordine 2117, pezzo 1035 → 40 / 109 / 15 mm.

## [ ] 2026-10-05 — sonda HAAS live: `serverDati/tools/haas-probe-live.js`

**Non è un test.** Pubblica `FROM_PLANT/HAAS_CMD/MC1`
`{"cmd":"setMacro","var":10200,"value":<ricetta>}` come farebbe il PLC: il
backend collegato a quel broker **scrive la macro sulla HAAS vera** e risponde
con `TO_PLANT/CMD/HAAS_ACK/MC1` (o `HAAS_NACK`).

Fino al 5/10 si chiamava `serverDati/test_haas.js`, con il broker della cella
scritto dentro come default. Col nome `test_` finiva nei cicli "lancia tutti i
test" e quel giorno ha scritto **#10200 = 1 sulla HAAS MC1 della cella**
più volte durante le prove PLC (ack ok alle 16:28, 16:53, 17:11 e 18:45; due
giri alle 16:49 e 16:52 senza log). **Da verificare a bordo macchina il
valore della #10200**: quello di prima non è noto.

Guardie adesso:
- sta in `tools/`, fuori da `test_*`: nessun ciclo sui test la prende;
- nessun broker di default: senza `MQTT_BROKER_URL` esce con errore;
- senza `--live` esce con errore **prima** di collegarsi: niente pubblicato.

Uso, solo a ragion veduta (dalla cartella `easybox/serverDati`):

```
# bash
MQTT_BROKER_URL=mqtt://utente:password@host:porta node tools/haas-probe-live.js --live
# PowerShell
$env:MQTT_BROKER_URL='mqtt://utente:password@host:porta'; node tools/haas-probe-live.js --live
# ricetta 3 invece di 1: aggiungere 3 dopo --live
```

## [x] 2026-09-18 — limite heap del backend: in `start_server.bat`, NON sta nel repo

Dopo il crash `Fatal process out of memory: Zone` il backend gira con un tetto
heap dichiarato. `serverDati/package.json` lo mette nello script di avvio:

```
"start": "node --max-old-space-size=1024 server.js"
```

**Ma in cella `npm start` non si usa**, e non c'è nessun servizio nssm (la
prima versione di questa voce lo dava per scontato). Il backend parte da
`start_server.bat`, che non è nel repo (voce «Avvio e aggiornamento della
cella»): il tetto di memoria sta lì, nella riga che avvia il backend.

```
node --max-old-space-size=1024 server.js
```

Applicato da Dario il 6/10; la copia del `.bat` di prima è in
`D:\Backup\start_server.bat.20261006`.

### Come si CONTROLLA che sia arrivato

Non si dà per buono: all'avvio il backend chiede il limite a V8 e lo scrive
in `serverDati/log/access.log`, nella riga `INIT`:

```
-------- INIT --------  ... heap limit: 1072 MB
```

Con il flag il limite è **circa 1072 MB**: 1024 più l'area giovane di V8. Se
la riga dice **4144 MB**, è il default di node in cella: il flag NON è
arrivato al processo e si è cambiato qualcosa che non conta.

### La riga periodica

Ogni 5 minuti compare una riga come:

```
STD ... memoria: rss 180 MB, heap 95/140 MB, external 12 MB, socket HMI 2, log scartate 0
```

Serve al prossimo incidente: con questa c'e' un ANDAMENTO invece di una sola
riga fatale, e si distingue una crescita lenta di ore da un'esplosione in un
minuto. `log scartate` diverso da zero vuol dire che il ponte sta ricevendo
piu' di quanto riesca a raccontare — non e' un errore di per se', ma e' il
segnale che si e' in raffica.


## [ ] 2026-09-17 — ALTER VIEW WORKORDERS **v3**: PRODUCTED conta solo i finiti

Script: `serverDati/scripts/workorders-producted-finished.sql` (idempotente,
con guardie che lo FERMANO se la vista non e' quella attesa).

Una sola modifica nella derivata che calcola PRODUCTED: `status IN (5,6,7)`
diventa `status = 5`. 6 = in pausa, 7 = abortito: non sono pezzi prodotti.
Finche' il numero serviva solo a mostrare l'avanzamento era un'imprecisione;
da adesso ci si appoggia la **chiusura automatica dell'ordine**
(`setPositionStatus` in `MQTT_Client.js`), quindi contare gli abortiti
chiuderebbe l'ordine prima della quantita' richiesta.

**Va eseguito PRIMA di deployare il backend nuovo.** Backend nuovo + vista
vecchia: la chiusura scatta sul conteggio gonfiato. Vista nuova + backend
vecchio: nessun danno, cambia solo il numero mostrato.

**Effetto collaterale da annunciare:** sugli ordini in corso con tasche 6/7
l'avanzamento mostrato CALA. E' il numero giusto. La query 2 nello script,
lanciata PRIMA, dice quali ordini e di quanto.

### La lezione: gli script nel repo NON sono la fonte di verita'

La v3 e' stata scritta una prima volta partendo da `workorders-view-pp.sql`
(v2) e buttata via: quel file descrive la vista come sta su **dev**, e la
cella e' diversa da sempre nella derivata.

| | `workorders-view-pp.sql` (dev) | cella (letta 2026-09-17) |
|---|---|---|
| join | `on w.ORDER_ID = x.Order_ID` | `on w.ID = x.Order_ID` |
| group by | `Order_ID, status` | `Order_ID` |
| count | `count(Order_ID)` | `count(*)` |

In cella `w.ID` e' la chiave dell'ordine, la stessa che `POSITION.Order_ID`
contiene; `WORKORDER.ORDER_ID` e' NULL su tutte le righe, colonna morta. Il
difetto di duplicazione che il testo dev lascerebbe supporre **in cella non
esiste**. `workorders-view-pp.sql` e' stato marcato in testata e gli e' stata
aggiunta una guardia che lo ferma se lo si punta sulla vista di cella.

**Regola da qui in avanti:** prima di scrivere una ALTER VIEW per la cella,
leggere la definizione REALE e partire da quella —

```
SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('<vista>');
```

(`OBJECT_DEFINITION(...)` va bene uguale, ma da sqlcmd ricordarsi `-y 8000`:
altrimenti il testo esce troncato e sembra un'altra vista.)


## [x] 2026-09-15 — composizione attrezzatura: NESSUNO script da eseguire

La vista `FIXTURES` in cella e' gia' stata estesa (PALLET_Z, VICE_Z, Z_CALC,
Z_DIVERGE): il pannello la legge e basta. **Non c'e' DDL da lanciare** e la
vista non va toccata.

Cosa sapere al deploy:

- il backend legge sempre `select * from FIXTURES`: le colonne nuove passano
  senza modifiche in lettura;
- in scrittura `updateFixture`/`insertFixture` adesso nominano anche
  `PALLET_ID` e `VICE_ID` sulla TABELLA `FIXTURE`. Se il DB di destinazione
  non avesse quelle due colonne il salvataggio fallirebbe: verificarle prima
  del deploy con
  `select PALLET_ID, VICE_ID from FIXTURE;`
- se la vista NON fosse estesa (`Z_DIVERGE` assente) il pannello non inventa
  nulla: la colonna Composizione resta vuota e il form non mostra il blocco.
  Nessun errore, nessun avviso falso.

Il database di **sviluppo** non aveva l'estensione: e' stata replicata in
locale solo per la prova, con uno script tenuto fuori dal repo apposta per
non rischiare di sovrascrivere la vista buona della cella.

## [ ] 2026-09-15 — ciclo SPINTA IN BATTUTA: cinque script, poi le misure

Ordine obbligato, **a cella ferma**, i primi quattro prima del deploy del
backend (insert/update nominano le colonne e la tabella nuove), la vista per
ultima perche' le nomina tutte:

```
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i piece-push-to-stop.sql
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i vice-claw-length.sql
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i gripper-claw-length.sql
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i piece-on-vice.sql
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i coordinates-push-mc.sql
```

I due script delle chele toccano anche le viste, in due modi diversi:
`vice-claw-length.sql` fa `sp_refreshview 'dbo.VICES'` perche' quella vista e'
`SELECT v.*` e una vista con l'asterisco **non vede** le colonne aggiunte dopo;
`gripper-claw-length.sql` fa invece un `ALTER` esplicito, perche' GRIPPERS
elenca le colonne per nome e il refresh non basterebbe. Senza questi passaggi
il pannello non leggerebbe mai le due misure. Trappola da ricordare per ogni
colonna nuova.

`vice-claw-length.sql` gestisce anche la **rinomina** da `CLAW_LENGTH_Y` a
`CLAW_LENGTH`: se in cella e' gia' stato eseguito il primo script (versione del
14/9, quando la battuta si credeva sulla Y), la colonna viene rinominata e i
dati restano. Se non e' mai stato eseguito, la crea e basta.

Dopo il deploy, misure col calibro (nessuna quota da digitare):
1. Morsa, campo "Ganascia: lunghezza nella direzione in cui il pezzo scorre
   fino alla battuta", in mm.
2. Pinza, campo "Chela: lunghezza nella direzione in cui spinge il pezzo", in
   mm: e' la lunghezza della chela, **non** lo spessore.
3. Pezzo, spunta "Spinta in battuta" sui particolari che la vogliono.
4. Morsa, sezione "Pezzi che sporgono dalla ganascia": compare da sola per
   ogni pezzo con la spinta attiva piu' lungo di quella ganascia. Per ognuno
   si misura col calibro **quanto oltre la fine della ganascia** sta il
   riferimento su cui il pezzo appoggia davvero. Finche' manca, l'ordine viene
   rifiutato: e' voluto, nessuno puo' dedurre quella distanza dai dati.
5. Pinza, corsa e spessore della ganascia: **da ricontrollare su tutte le
   pinze**, perche' fino al 15/9 il form li mandava e il backend li perdeva,
   quindi a database ci sono i default e non le misure vere. Non entrano nella
   spinta, ma sono sbagliati per lo stesso motivo.

Verifica: `SELECT ORDER_ID, X_PLACE, X_PUSH, X_STOP, CLEARANCE, STOP_REF,
STOP_BEYOND_CLAW, PUSH_STATUS FROM COORDINATES_PUSH_MC` — **da fare su un pezzo
NON quadrato**, altrimenti uno scambio d'asse non si vede. Col 1029 (40 x 120),
ganascia morsa 150 e chela pinza 30: spinta scostata di 75 mm dal deposito,
corsa fino alla battuta 15 mm, `STOP_REF` = `CLAW`.

**Un pezzo piu' lungo della ganascia NON e' un errore.** Appoggia piu' avanti,
su un altro riferimento, e la corsa diventa `(ganascia - pezzo)/2 + distanza
dichiarata`. Restano due rifiuti: `NO_FIT` quando il pezzo sporge e nessuno ha
dichiarato dove appoggia, `NO_ROOM` quando il riferimento dichiarato e' piu'
vicino di quanto il pezzo gia' sporge, cioe' la corsa verrebbe negativa.
`STOP_REF` dice su cosa appoggia: `CLAW` fine ganascia, `DECLARED` riferimento
dichiarato.

La dichiarazione sta in `PIECE_ON_VICE`, una riga per coppia morsa+pezzo, ed e'
**la riga** a essere la dichiarazione: valore zero legittimo, riga assente =
non dichiarato. E' agganciata alla MORSA e non al pallet, quindi una morsa
spostata si porta dietro la sua battuta.

Per capire un caso davanti al pannello c'e' la pagina **Spinta in battuta**
(menu ATTREZZAGGIO): vista dall'alto, tre fasi animate, e si vede se il pezzo
appoggia sulla ganascia o sul riferimento dichiarato. Il disegno e' orientato
come si vede la cella stando davanti.

Dal livello manutentore in su i parametri si possono muovere **e si possono
salvare da li'**, una misura alla volta: compare una conferma che nomina
l'oggetto fisico e dice da quale valore a quale. Ogni modifica lascia una riga
nella tabella `LOG`, con l'oggetto, il valore vecchio e quello nuovo, e la
sigla `PUSH_SIM` a dire che arriva dalla simulazione. Serve a ricostruire dopo
da dove viene un numero, visto che morsa, pinza e pezzo non hanno colonna di
autore ne' di data. Per leggerle:

```
-- DESCR e UNIT_B sono nchar: senza RTRIM escono pieni di spazi
SELECT [DATA], RTRIM(DESCR) AS modifica, RTRIM(UNIT_B) AS oggetto
  FROM LOG WHERE RTRIM(UNIT_A) = 'PUSH_SIM' ORDER BY ID DESC;
```

**Asse della battuta:** la spinta e' sulla **X del robot** (quella che il PLC
manda come X_Pick-Place). Y e Z restano quelle del deposito. Del pezzo entra
`PIECE.Y`, perche' e' la dimensione che corre lungo la X del robot: e' la
stessa convenzione del passo delle tasche nel cassetto.

**Dipendenza da ricordare:** le quote presuppongono il deposito CENTRATO sulla
morsa (confermato da Dario). Se si riapprende la posizione di deposito in
macchina scentrata, la corsa calcolata non corrisponde piu' al reale e non c'e'
nessun controllo che se ne accorga.

## HTTPS del pannello: accensione e RITORNO IN HTTP

Il pannello gira in HTTPS per poter installare la PWA sul tablet, che arriva
per indirizzo IP. Il certificato lo prepara da solo
`HMI\tools\ensure-cert.ps1`, chiamato da `start_hmi.bat` prima di Vite.

### Se in cella qualcosa non va: tornare in HTTP

**Una riga sola, in `start_hmi.bat`, PRIMA della riga che chiama il
certificato.** Togliere il `rem`:

```
set HMI_HTTP_ONLY=1
```

Poi chiudere e riaprire la finestra del pannello. Fatto: Vite riparte in HTTP
esattamente come prima, il proxy continua a funzionare, e lo stesso
interruttore impedisce allo script di rigenerare il certificato (senza quello
il certificato tornerebbe e si resterebbe in HTTPS).

Cosa cambia per chi usa il pannello:

| Dove | Con HTTPS | Tornati in HTTP |
|---|---|---|
| Touch di cella | `https://localhost:5173` | `http://localhost:5173` |
| Tablet | `https://<ip>:5173`, PWA installata | `http://<ip>:5173`, niente PWA |

**L'icona della PWA sul tablet smette di funzionare** quando si torna in HTTP:
apriva l'indirizzo `https`, che non risponde piu'. Sul tablet si riapre a mano
l'indirizzo `http`. Sul touch di cella basta aprire l'indirizzo `http`.

Per rifare il giro all'indietro fino in fondo, se un giorno si vuole togliere
tutto: cancellare la cartella `HMI\certs`, e togliere la CA dalle autorita'
fidate con

```
Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Subject -like '*EasyBox Local CA*' } | Remove-Item
```

### Riaccendere

Rimettere il `rem` davanti alla riga, riavviare. Il certificato si rigenera da
solo se serve.

### Cosa NON serve fare

- Non serve rinnovare niente a mano: lo script rigenera il certificato del
  pannello quando mancano meno di 30 giorni alla scadenza, firmandolo con la
  stessa CA. **I tablet non vanno ritoccati**, perche' si fidano della CA e
  quella dura dieci anni.
- Non serve rifare il giro sui dispositivi se cambia l'indirizzo IP del PC
  impianto: lo script se ne accorge e rigenera. I tablet pero' devono usare
  il nuovo indirizzo.

## [ ] Errori emersi dopo il passaggio a 400/500 — lista, non correzioni

Dal deploy del contratto HTTP nuovo compaiono a pannello errori che prima
passavano inosservati. **Si annotano qui e si correggono a lotti**, quando si
vede la causa comune: le due famiglie attese sono le scritture che toccano zero
righe per una chiave sbagliata (come l'UPDATE che cercava la riga da creare) e
le query che nominano colonne assunte.

| Data | Pagina | Operazione | Messaggio |
|---|---|---|---|
|  |  |  |  |

## [ ] 2026-09-15 — UNIQUE (PALLET_ID, FIXTURE_ID) su FIXTURE_ON_PALLET — A CELLA FERMA

Script: `serverDati/scripts/fixture-on-pallet-unique.sql` (idempotente, rollback
commentato). La tabella non ha ne' chiave primaria ne' indice unico ne' chiave
esterna: niente impedisce due righe per la stessa coppia, e la geometria del
pallet diventerebbe ambigua.

```
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i fixture-on-pallet-unique.sql
```

Verifica post: `EXEC sp_helpindex 'dbo.FIXTURE_ON_PALLET'` mostra
`UX_FOP_PALLET_FIXTURE`. Se lo script elenca duplicati: bonificare con la
procedura commentata dentro lo script e rieseguire.

**Chiave esterna verso FIXTURE: RIMANDATA.** Oggi fallirebbe per la riga orfana
(PALLET_ID 1, FIXTURE_ID 2, con l'attrezzatura 2 inesistente in cella) e non si
bonificano dati mentre si produce.

**Dopo il deploy del modello a due aspetti** (commit rig-two-aspects): il pallet
9 risultera' INCOMPLETO nell'elenco Attrezzaggi (morsa senza geometria). Si
completa dalla Modifica associandogli l'attrezzatura 1 ("Morsa 158 + pallet 38",
Z 176000). Da quel momento gli ordini nascono col FIXTURE_ID giusto e non serve
piu' la correzione a mano `UPDATE WORKORDER SET FIXTURE_ID=1`.

## [ ] 2026-09-14 — origine tasche + significato Z_PICK: vista 4Robot v3 e bonifica

Riscontro pendant TRAY_1 tasca 1 (pezzo 1033, 100.6x100.6x15): reale
X 84.0 / Y 102.5 / Z 7.5 contro 118.5 / 16.2 / 45 mandati dal PLC.
Due difetti, due rimedi nello stesso commit:
- ORIGINE delle tasche (`drawingToRobot`, util + replica server): la costante
  era (w1, -h1) della convenzione pre-1/9; ora X = h, Y = w (tasca 1 = i suoi
  margini dai bordi). Le correzioni di piano attuali X_CORR 10 / Y_CORR 100
  compensavano l'errore: vanno RI-INSEGNATE.
- Z_PICK/Z_PLACE del PEZZO = QUOTA DI PRESA DAL FONDO del cassetto (mezzeria:
  7.5 su un pezzo di 15). Vista 4Robot v3: Z = TRAY.Z_CORR + PIECE.Z_PICK.
  TRAY.Z_CORR = fondo del cassetto (teaching = pendant - Z_PICK).

**NON si tocca `COORDINATES_MC`** (macchina) finche' non c'e' la misura in
morsa: oggi somma anche PIECE.Z, col nuovo significato manderebbe il robot
15 mm sopra. Lo script v3 modifica SOLO la vista cassetti.

Nella STESSA fermata va anche `grating-thickness.sql` (colonna
GRATING.THICKNESS, spessore griglia in micron, NULL = non misurato = nessun
vincolo; protezione anti-urto in generazione: Z_PICK/Z_PLACE del pezzo >=
spessore + 1 mm, controllata da client e server). I due DDL sono
INDIPENDENTI (uno tocca la vista dei cassetti, l'altro la tabella GRATING):
ordine fra loro indifferente, ENTRAMBI prima del deploy del backend
(insert/update del grigliato nominano la colonna nuova).

Sequenza obbligata (il teaching legge la tasca 1 a DB per calcolare i CORR):
```
-- 1) anagrafica pezzi: Z_PICK e Z_PLACE riscritti col nuovo significato
--    (1033 -> 7500 / 7500). Il form ora rifiuta 0 e valori > Z.
-- 2) DDL a CELLA FERMA (login plc senza ALTER), in qualsiasi ordine:
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i robot-tray-view-v3.sql
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i grating-thickness.sql
-- 3) deploy codice (git pull in D:\Prog) + riavvio backend
--    (poi, con calma: spessore misurato nel form grigliato 2097)
-- 4) Cassetti > "Rigenera tasche" su 1 e 12 (grigliato 2097, nessuna
--    taratura da conservare). Il 9 esce dal piano: Dissocia.
-- 5) Cassetti > "0 CASSETTIERA": campione 1, pendant X 84 / Y 102.5 / Z 7.5
--    -> X_CORR 0.2, Y_CORR -6.0, Z_CORR piano 1 = 0; gli altri piani derivati
--    da COORDINATES_FOR_EXTRACT.
-- 6) PRIMA di fidarsi del piano 12: pendant sulla sua tasca 1 (gli Z_CORR
--    832/1130 non sono derivati in modo uniforme: 800/1092 teorici).
-- 7) morsa: misura in presa vs COORDINATES_MC, poi si decide la vista MC.
```
Verifica post DDL+teaching: `SELECT TRAY, SUB_POS, X_PICK, Y_PICK, Z_PICK
FROM COORDINATES_PIECES_TRAYS_4Robot WHERE TRAY='1' AND SUB_POS=1` ->
84000 / 102500 / 7500.

## [ ] 2026-09-04 — UNIQUE (PARENT, SUB_POS) su [POSITION] — A CELLA FERMA

Script: `serverDati/scripts/position-parent-subpos-unique.sql` (idempotente,
rollback commentato). Chiude alla radice i SUB_POS duplicati (93 righe per 91
tasche sul TRAY_12: salvataggi grigliato sovrapposti; l'HMI ora ha insert
idempotente + flag anti doppio-tap, l'indice e' la cintura).

**ESEGUIRE SOLO A CELLA FERMA**: la CREATE INDEX prende un lock su [POSITION]
e le scritture PLC in volo possono farla fallire o restarne bloccate.

```
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i position-parent-subpos-unique.sql
```

Se lo script elenca duplicati: bonificare con la CTE commentata dentro lo
script e rieseguire. Verifica post: `sp_helpindex 'dbo.POSITION'` deve
mostrare `UX_POSITION_PARENT_SUBPOS`.

Nota trigger (4/9, letto con -E): `POSITION_trig` e' solo logging AFTER
UPDATE,DELETE verso [log] — non c'entra coi duplicati. Difetti noti, NON
toccati: INNER JOIN inserted/deleted (i DELETE puri non vengono loggati) e
una INSERT sincrona per ogni UPDATE del PLC (~7.000 righe/giorno in
commissioning): da rivedere a parte.

> Regola impianto: le modifiche allo schema DB della cella NON sono
> automatizzate. Ogni voce qui sotto va eseguita a mano da Dario, spuntata
> con data, e rimossa solo quando verificata.

## [ ] 2026-07-20 — ALTER VIEW WORKORDERS **v2** (cantiere AG fase 2, decisioni B+A)

Script: `serverDati/scripts/workorders-view-pp.sql` (idempotente, con rollback
commentato in coda). **La v2 SOSTITUISCE la v1**: stesso file, stato finale
intero della vista. Chi avesse già applicato la v1 in impianto riesegue lo
stesso script: riconosce la v1 e migra («migro da v1 a v2»); da vista
originale migra direttamente.

Cosa fa: la view WORKORDERS passa a `LEFT JOIN` su PARTPROGRAM con
`PP_ID = w.PartProg_ID` (v1) **e a `LEFT JOIN` su GRIPPER** (v2). Senza la v1
gli ordini a numero di sottoprogramma libero spariscono dalla view; senza la
v2 spariscono gli ordini del ramo ATTREZZATURA (GRIPPER_ID=0, nessuna riga
GRIPPER 0). In entrambi i casi: invisibili al PLC e alla tabella produzione,
senza errori. Il select del PLC non cambia.

**PRIMA di eseguire, obbligatorio:**
1. Verificare che la definizione della view in cella sia IDENTICA a quella
   dev salvata nella sezione ROLLBACK dello script:
   ```
   sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -Q "SELECT OBJECT_DEFINITION(OBJECT_ID('WORKORDERS'));" -y 8000
   ```
   Se differisce, FERMARSI e riconciliare. **AGGIORNAMENTO 2026-09-17: NON
   sono identiche** — la derivata PRODUCTED e' diversa; vedi la scheda v3 in
   testa a questo documento. Questo script resta valido per dev.
2. Eseguire lo script:
   ```
   sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -i workorders-view-pp.sql
   ```
3. Verifica post: gli ordini esistenti restano visibili con gli stessi PP_ID
   (`SELECT ID, PP_ID FROM WORKORDERS`), PARTPROGRAM intatta.

Da deployare INSIEME al backend con il nuovo `WORKORDER/Order.js` (le
scritture ordini puntano alla base table `WORKORDER`): view vecchia + backend
nuovo convivono (insert funziona, ma i numeri liberi restano invisibili
finché la view non è migrata); view nuova + backend vecchio NO (insert
resta rotto).

## [ ] 2026-07-20 — ALTER TABLE WORKORDER: colonna DECLARED_PIECE_ID (C2)

Script: `serverDati/scripts/workorder-declared-piece.sql` (idempotente,
rollback commentato). Aggiunge `DECLARED_PIECE_ID INT NULL` alla base table:
pezzo dichiarato del ramo attrezzatura del wizard. Solo uso HMI — la view
WORKORDERS non la espone, il PLC non la vede.

```
sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -i workorder-declared-piece.sql
```

PREREQUISITO del backend nuovo: senza questa colonna `insertOrder`/`updateOrder`
falliscono (la INSERT la nomina). Eseguire PRIMA di deployare il backend C2.

## [ ] Bonifica ordini legacy — PRIMA del primo ciclo automatico in cella

Gli ordini storici in `Status=3` (WORKING) con `PRODUCTED<QUANTITY` verrebbero
agganciati dal dispatcher alla prima macchina EMPTY. Vanno portati a
`Status=7` (ABORTED) prima del collaudo:

```
-- 1) conferma di cosa c'è (annotare gli ID):
sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -Q "SELECT ID, PIECE_ID, MACHINE_ID, QUANTITY, PRODUCTED, PP_ID FROM WORKORDERS WHERE Status=3 AND PRODUCTED<QUANTITY"

-- 2) bonifica (sulla BASE table):
sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -Q "UPDATE WORKORDER SET STATUS=7 WHERE STATUS=3 AND ID IN (SELECT ID FROM WORKORDERS WHERE Status=3 AND PRODUCTED<QUANTITY)"

-- 3) conferma post (atteso: nessuna riga):
sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -Q "SELECT ID FROM WORKORDERS WHERE Status=3 AND PRODUCTED<QUANTITY"
```

Nota: tra gli ordini legacy ce n'è almeno uno con `VICE_ID=-1` (visto su dev):
la convenzione nuova è VICE_ID=0 sempre — la bonifica a Status=7 li toglie
comunque dal giro del dispatcher.

## [ ] Tray-teaching — ORDINE OBBLIGATO in cella (DDL prima del backend)

Il backend nuovo nomina le colonne di teaching di TRAY (insertPositionTray le
usa nella INSERT...SELECT): senza DDL il salvataggio grigliato FALLISCE.
Inoltre la convenzione POSITION.Z=0 entra in vigore col deploy: le righe
POSITION esistenti (Z=interasse) vengono migrate a 0 SOLO dalla transazione
del teaching. Sequenza obbligata:

```
-- 1) DDL (login plc senza ALTER: eseguire con -E):
sqlcmd -S 172.20.70.80SQLEXPRESS -E -d ADMG -i tray-teaching.sql

-- 2) deploy backend+HMI

-- 3) teaching cassettiera dal pannello (Cassetti > "0 CASSETTIERA"):
--    scrive TRAY.CORR/ROT di tutti e 12 e porta a 0 la Z delle POSITION
--    esistenti nella STESSA transazione.

-- 4) SOLO DOPO: eventuali ri-associazioni grigliato (le righe nuove nascono
--    gia' con Z=0 e ROT/APPROACH ereditati dal TRAY).
```

NB: tra il punto 2 e il punto 3 NON ri-associare grigliati: righe con Z=0 ma
TRAY.Z_CORR ancora vecchio-regime darebbero quote basse di ~800 mm.
