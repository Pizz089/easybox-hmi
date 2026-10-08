# Appunti cella — interventi manuali da eseguire in impianto

## Avvio e aggiornamento della cella

**Il clone di cella è parziale** (verificato il 6/10): sparse-checkout in modalità cone, `D:\Prog\.git\info\sparse-checkout` contiene

```
/*
!/*/
/easybox/
```

Sul disco vengono scritti solo i file della radice e la cartella `easybox/`: `tools/` e `plc/` in cella non ci sono. **Tutto quello che deve arrivare in cella sta sotto `easybox/`** (per questo `pannello.ps1` sta in `easybox/tools/`).

**Avvio: servizi Windows** (decisione di Dario, 6/10). Installati in cella il 6/10 alle 15:16. Verificato subito dopo: tutti e due accesi, avvio automatico ritardato, utente di sistema, porte 8080, 3000 e 5173 in ascolto, Vite in HTTPS su 172.20.70.80 e 192.168.1.152. **Da fare: la prova del riavvio del PC**, con la verifica scritta più sotto («Verifica al riavvio del PC»: il 7/10 quattro operazioni pianificate avviavano ancora le vecchie finestre).

Backend e pannello partono da soli all'accensione, come servizi nssm creati da `easybox/tools/servizi-cella.ps1`:
- `EasyBoxBackend`: `node --max-old-space-size=1024 server.js` in `easybox\serverDati`;
- `EasyBoxPannello`: Vite lanciato con node (`node_modules\vite\bin\vite.js`, senza npm, cosi' nssm ferma il processo vero) in `easybox\HMI`;
- utente di sistema (LocalSystem), avvio automatico **ritardato** (circa 2 minuti dopo l'accensione), nessuna dipendenza da SQL Server e mosquitto: fermarli per manutenzione non deve fermare i servizi, il backend si ricollega da solo;
- se node si chiude, nssm lo riavvia dopo 5 secondi;
- log di node (uscita ed errori, rotazione a 10 MB): `serverDati\log\servizio_backend.log` e `HMI\log\servizio_pannello.log`. `access.log` resta dov'e';
- nssm viene copiato in `C:\Program Files\nssm\nssm.exe`: il servizio non dipende da `D:\Prog\easybox\nssm.exe`, che resta non tracciato.

Comandi, da PowerShell **come amministratore**:

```
powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione stato
powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione prova
powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione installa
powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione riavvia
powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione rimuovi
```

- `stato`: servizi (per uno in Paused, il motivo dagli ultimi eventi nssm), chi tiene le porte 8080/3000/5173 e se è il processo del servizio giusto (8080 e 3000 il backend, 5173 il pannello), avvii automatici delle vecchie finestre (le operazioni pianificate solo se attive), ultime righe dei log. Non cambia niente; non serve l'amministratore (ma senza, la riga di comando dei processi può mancare).
- `prova`: tutti i controlli di `installa` e i 34 comandi nssm che eseguirebbe (17 per servizio), senza eseguirli. Non cambia niente.
- `installa`: copia nssm, crea i due servizi, li avvia e aspetta le porte. Si ferma se non e' amministratore, se i servizi esistono gia', se c'e' un altro servizio nssm o se le porte sono occupate (prima: cella in HOLD, Ctrl+C nelle due finestre). Se un passo fallisce toglie quello che ha creato. Prima di ogni altro controllo (quindi anche coi servizi già installati) segnala gli avvii automatici delle vecchie finestre e, per le operazioni pianificate attive, propone di disabilitarle: lo fa solo con una «s», dopo averne salvato la definizione in `D:\EasyBox_backup\task_<data e ora>`. `prova` dice soltanto che lo proporrebbe.
- `riavvia`: ferma i due servizi, aspetta che le porte si liberino, chiude **solo** i node rimasti sulle tre porte (ne scrive pid, ora di avvio e riga di comando), riavvia i servizi e controlla che siano Running e che le porte siano loro. Altrimenti esce in errore. Un processo sulle porte che non è node non lo chiude: si ferma, coi servizi fermi.
- `rimuovi`: ferma e toglie **solo** `EasyBoxBackend` ed `EasyBoxPannello`.
- (7/10, pannello compilato, voce qui sotto) `preview`: passaggio dal server di sviluppo al pannello compilato; `aggiorna`: dopo un git pull ricompila il pannello e riavvia backend e pannello, prima il backend; `ripristina`: torna alla build di prima; `dev`: ritorno al server di sviluppo. `preview`, `ripristina` e `dev` toccano solo il pannello.

**Dopo un git pull, col pannello compilato: `git pull`, poi `servizi-cella.ps1 -Azione aggiorna`.** È un comando solo: ricompila il pannello e riavvia backend e pannello. Col server di sviluppo bastava `-Azione riavvia`. `pannello.ps1` riavvia i servizi ma non ricompila (procedura qui sotto).

**Pannello compilato (decisione di Dario, 7/10).** Il servizio `EasyBoxPannello` serviva il pannello col server di sviluppo di Vite (`node node_modules\vite\bin\vite.js`), che compila i moduli alla prima richiesta: dopo un avvio il primo caricamento è lento. Ora il pannello si compila **in cella** (`vite build` → `easybox\HMI\dist`) e il servizio lo serve con `node node_modules\vite\bin\vite.js preview --port 5173 --strictPort`. Restano uguali la porta 5173, gli indirizzi, il certificato e il proxy (`/api/` alla 8080, `/socket.io/` alla 3000 con websocket): il blocco `preview` di `vite.config.js` ha lo stesso proxy e lo stesso HTTPS, e la porta 5173 la dà la riga di comando (il blocco resta su 4173 per le prove sul portatile). Il touch e il tablet non cambiano niente.
- **Perché in cella e non sul portatile:** la build legge il `.env` di `easybox\HMI` e ci scrive dentro `VITE_DARK_MODE`, l'unica variabile `VITE_` che il pannello usa. Se si cambia il `.env` della cella, serve `-Azione aggiorna`. `dist`, `dist_build` e `dist_prev` sono ignorate da git e non vanno nel repo.
- **Cache:** `vite preview` manda `index.html` e i file con `Cache-Control: no-cache` ed ETag. Il browser chiede ogni volta se sono cambiati: dopo un aggiornamento prende l'`index.html` nuovo, e i file nuovi hanno un altro hash nel nome. Nessun service worker, solo `manifest.webmanifest`. Ctrl+F5 sui client resta buona abitudine.
- **Senza `dist`** il servizio non parte vuoto: node esce subito con «The directory "dist" does not exist. Did you build your project?» in `HMI\log\servizio_pannello.log`, e `-Azione stato` lo segnala.
- **Tempi misurati sul portatile il 7/10** (Chrome con la cache vuota, dal lancio del server al pannello montato):
  - server di sviluppo: 2,1-2,3 s con la cache delle dipendenze di Vite già pronta, **29,6 s** senza (la prima volta dopo un aggiornamento delle dipendenze), 187 richieste;
  - pannello compilato: **1,3-1,4 s**, 13 richieste;
  - build: 13 s, `dist` di 23 MB in 163 file.

  In cella il PC è più lento: i tempi veri vanno presi lì.
- **L'avvio ritardato dei servizi resta** e costa circa 2,5 minuti dall'accensione. Il 7/10 il PC è stato acceso alle 13:35:55, `EasyBoxBackend` è partito alle 13:38:20 ed `EasyBoxPannello` alle 13:38:30. In quel tempo il browser mostra il pannello dalla cache, ma senza server. Il pannello compilato non toglie questi minuti: toglie solo la compilazione al primo caricamento. Se cambiare l'avvio ritardato lo decide Dario a parte.

**La prima volta in cella** (cella in HOLD, PowerShell **come amministratore**):
1. il codice nuovo, con lo script nuovo:
   ```
   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione stabile
   ```
   (oppure `-Versione v3`, quella in uso);
2. lo stato di partenza, che deve dire «Pannello: server di sviluppo»:
   ```
   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione stato
   ```
3. il passaggio, un comando:
   ```
   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione preview
   ```
   Fa la build in `dist_build`; se fallisce si ferma e il pannello resta col server di sviluppo. Poi mette `dist_build` al posto di `dist`, cambia i parametri del servizio (`nssm set EasyBoxPannello AppParameters ...`), riavvia il solo pannello e controlla che sia Running e che la 5173 sia sua;
4. di nuovo `-Azione stato`: «Pannello: COMPILATO», `dist` compilata adesso, porta 5173 del servizio;
5. Ctrl+F5 sul touch e sul tablet, stato del robot che si aggiorna.

**Fatto in cella il 7/10 alle 14:23:** `-Azione preview` riuscita, build in 24 s, pannello compilato in servizio (`dist` del 07/10 14:23).

**Dopo ogni git pull** (cella in HOLD, PowerShell come amministratore):
```
cd D:\Prog; git pull
powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione aggiorna
```
`-Azione aggiorna` fa la build in `dist_build`. Se fallisce si ferma, e `dist` e servizi restano come sono: gira la versione di prima, backend compreso, che non viene riavviato. Stampa l'errore (completo in `HMI\log\build_pannello.log`). Se riesce: ferma i due servizi, `dist` → `dist_prev`, `dist_build` → `dist`, riavvia **prima il backend** (aspetta 8080 e 3000) **e poi il pannello** (5173), controlla che siano Running e che le porte siano loro, e stampa lo stato. Se il pull cambia `package-lock.json` servono prima le dipendenze (`pannello.ps1` fa `npm install`); senza, la build si ferma con l'errore e non cambia niente.

**Se la build nuova non va:** `servizi-cella.ps1 -Azione ripristina` scambia `dist` e `dist_prev` e riavvia il pannello (lanciato di nuovo torna alla build nuova). **Ritorno al server di sviluppo:** `servizi-cella.ps1 -Azione dev` rimette i parametri di prima e riavvia il pannello; `dist` resta su disco e non si usa. Il comando a mano equivalente è `& "C:\Program Files\nssm\nssm.exe" set EasyBoxPannello AppParameters node_modules\vite\bin\vite.js`, poi `-Azione riavvia`.

**7/10: servizi in Paused, le porte tenute dalle vecchie finestre.** Dagli eventi nssm i due servizi uscivano con codice 1 (EADDRINUSE) almeno dalle 13:02. Le porte le tenevano i node avviati dalle vecchie finestre cmd (`start_server.bat`, `start_hmi.bat`), che partono ancora all'accesso a Windows. Le finestre partono prima dei servizi, che hanno l'avvio ritardato: i loro node prendono 8080, 3000 e 5173. nssm rilancia node, node esce subito, e nssm mette il servizio in **Paused**. Sistemato a mano chiudendo quei node e riavviando i servizi.

**Causa trovata (7/10, in cella): quattro operazioni pianificate** avviavano ancora backend e pannello all'accesso a Windows:
- `\EasyBox Server`: `cmd /k ... npx nodemon server.js`;
- `\ServerDati`: `start_server.bat`;
- `\EasyBox HMI`: `cmd /k ... npm run dev`;
- `\HMI`: `start_hmi.bat`.

Dario le ha **disabilitate** (non cancellate) e ne ha esportato la definizione in `D:\EasyBox_backup\task_2026-10-07`. In più `nodemon` riavviava il backend **a ogni git pull** (guarda i file e riparte quando cambiano). Lo script ora cerca nelle operazioni pianificate le azioni che contengono `start_server`, `start_hmi`, `node`, `npm`, `nodemon`, `vite` o `easybox`: `stato` elenca quelle attive, `installa` le segnala e propone di disabilitarle.

**Non da togliere: `\EasyBox Browser`** (`chrome_proxy.exe --app-id=... --start-maximized`) apre il pannello nel browser all'accesso. Non prende porte e resta attiva. Dal 7/10 lo script elenca a parte le operazioni che lanciano un browser (chrome, chrome_proxy, msedge), come «Browser del pannello all'accesso (ok)»: senza avviso e senza proporre di disabilitarle. Prima lo script la segnalava, per sbaglio, fra gli avvii da togliere.

**Verifica al riavvio del PC** (è anche la prova del riavvio rimasta da fare dal 6/10):
1. cella in HOLD, riavvio di Windows, accesso come al solito;
2. **nessuna finestra cmd** di backend o pannello deve aprirsi all'accesso;
3. aspettare circa 3 minuti: i servizi hanno l'avvio ritardato (circa 2 minuti dopo l'accensione);
4. `-Azione stato`. Atteso: `EasyBoxBackend` ed `EasyBoxPannello` **Running**; porte 8080, 3000 e 5173 «del servizio»; «nessuno attivo» fra gli avvii automatici (le quattro operazioni risultano trovate ma tutte disabilitate);
5. Ctrl+F5 sul touch e sul tablet, stato del robot che si aggiorna, `INIT` nuovo in `access.log`.

Se un servizio è in Paused o una porta è di un altro processo: la procedura qui sotto, e riportare a Dario l'uscita di `stato`, cioè gli eventi nssm e i proprietari delle porte.

Procedura, se i servizi sono in Paused o le porte non sono loro:
1. cella in HOLD;
2. `-Azione stato`: dice per ogni porta chi la tiene (pid, ora di avvio, padre, riga di comando) e se è del servizio; per un servizio in Paused, gli ultimi eventi nssm (codice di uscita, riavvio ritardato); gli avvii automatici trovati;
3. `-Azione riavvia`, da amministratore: chiude solo i node rimasti sulle porte e rimette su i servizi. Se esce in errore, i servizi possono essere fermi: rimetterli su con le finestre dei `.bat` e chiamare Dario con la finestra;
4. alla fine `-Azione stato`: due servizi Running, tre porte «del servizio».

`pannello.ps1` riavvia i servizi ma non chiude i node delle vecchie finestre: se dopo un aggiornamento le porte non tornano, si usa `-Azione riavvia`.

**Riserva: i due `.bat`**, che non sono nel repo, ciascuno nella sua finestra. Si usano solo dopo `-Azione rimuovi` (con i servizi accesi le porte sono occupate):
- backend: `D:\Prog\easybox\serverDati\start_server.bat` (`timeout /t 10`, `cd /d`, `mkdir log`, `node --max-old-space-size=1024 server.js`, `pause`);
- pannello: `D:\Prog\easybox\HMI\start_hmi.bat` (`timeout /t 15`, `cd /d`, `npm run dev`).

Con le finestre nessuno dei due si riavvia da solo, e **le due finestre non si chiudono senza rilanciarle.** Il 6/10 la chiusura della finestra del backend ha fermato il ponte fra PLC e SQL per circa 13 minuti.

Nel working tree di cella ci sono file non tracciati che il `.gitignore` non esclude: i due `.bat`, `easybox/nssm.exe` e la cartella `easybox/serverDati_BACKUP_2026-06-03/`. Sono normali: `pannello.ps1` conta come modifiche locali solo i file tracciati.

**Attenzione: nel clone parziale `git pull` e `git switch` non si fermano** su un file non tracciato che il ramo in arrivo porta allo stesso percorso. Lo sovrascrivono, con il solo warning «already present and thus not updated despite sparse patterns», e finiscono con codice 0. Provato il 6/10 con git 2.52 su un clone parziale come quello di cella; in un clone completo git invece si ferma. Quindi nel repo nessun file ai percorsi dove la cella ha file suoi (i due `.bat`, `easybox/nssm.exe`, `easybox/serverDati_BACKUP_2026-06-03/`). `pannello.ps1` lo controlla da sé prima di cambiare ramo o aggiornare; un `git pull` a mano no.

**Procedura di aggiornamento:**
1. Cella in HOLD.
2. Lo script (con i servizi: da PowerShell **come amministratore**, senza si ferma prima di toccare qualunque cosa e dice il comando da rilanciare):
   ```
   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione stato
   ```
   `-Versione stato` dice su che versione si è e lo stato dei servizi, senza cambiare niente; `-Versione stabile` (ramo `ui-lifting`) o `-Versione v3` (ramo `ui-v3`) aggiorna o cambia versione: fetch, cambio di ramo, pull solo in avanti, `npm install` se serve.
   - **Con i servizi** ferma `EasyBoxPannello` prima di toccare i file, alla fine riavvia `EasyBoxBackend`, avvia `EasyBoxPannello` e aspetta le porte (al massimo 90 secondi). Se qualcosa fallisce dopo aver fermato il pannello, lo rimette su comunque, sulla versione che c'è.
   - **Col pannello compilato** (dal 7/10 sera) `pannello.ps1`, dopo pull e `npm install`, lancia da solo `servizi-cella.ps1 -Azione aggiorna`: la stessa build, scambio delle dist, riavvio di backend e pannello. Se la build fallisce si ferma, il pannello servito resta quello di prima e lo dice. Prima del 7/10 sera riavviava il pannello sulla `dist` di prima senza dirlo.
   - **Da che commit viene il pannello servito:** la build scrive `easybox\HMI\dist\build.txt` (ramo, commit, data). `servizi-cella.ps1 -Azione stato` (o `-Azione servito`, senza amministratore) e `pannello.ps1 -Versione stato` lo stampano e lo confrontano col commit più recente che tocca `easybox/HMI`: riga rossa «pannello servito non aggiornato: -Azione aggiorna» se la build non lo contiene.
   - **Senza servizi** (le finestre): nella finestra di `start_server.bat` Ctrl+C, poi rilanciare il `.bat`; rilanciare `start_hmi.bat` solo se sono cambiati `package.json`, `package-lock.json` o `vite.config.js`, altrimenti basta Ctrl+F5 sui client.

   In alternativa `cd D:\Prog`, `git pull` e poi, **col pannello compilato, `servizi-cella.ps1 -Azione aggiorna`**, che ricompila e riavvia backend e pannello; col server di sviluppo `servizi-cella.ps1 -Azione riavvia`. Se il pull cambia `package-lock.json` serve `npm install`: meglio lo script.
3. Controlli:
   - porte 5173, 8080 e 3000 in ascolto;
   - `INIT` nuovo in `access.log`;
   - Ctrl+F5 sui client (touch di cella e tablet);
   - stato del robot che si aggiorna;
   - `DB_executeQuery.readyForNextQuery` TRUE.

## [ ] 2026-10-07 — Catalogo delle chele della morsa: deploy in una finestra pianificata

**Cosa.** Le tre misure della chela della morsa (lunghezza sull'asse di battuta, altezza, affondo) passano dalla riga della morsa a un catalogo, `VICE_JAW`. La morsa punta al tipo montato (`VICE.JAW_ID`) e le viste lette dal PLC (`COORDINATES_Z_MC`, `COORDINATES_PUSH_MC`, `COORDINATES_BLOW_MC`) prendono le misure da lì. Le query del PLC non cambiano. Due cose nuove nelle viste:
- la **battuta corretta** quando cambiano le chele: dichiarata + `CLAW_LENGTH_REF`/2 − montata/2, così il riferimento sulla morsa (X_Support) non si sposta;
- il **blocco chele** in `COORDINATES_Z_MC`: un ordine confermato con chele diverse da quelle montate non dà righe e il PLC si ferma col 799 prima di muovere.

Decisioni in DECISIONI.md («Catalogo delle chele della morsa»), il 799 in ALLARMI-PLC.md. Gli script stanno in `serverDati\scripts`; ognuno ha la guardia sul codice (conforme / ALTER / FERMO), stampa la definizione che trova ed è ripetibile.

**I tre file da mettere prima in `D:\Backup`**, come `controlli-simulazione-bis.sql`: in cella non ci sono finché il catalogo non arriva sul ramo di cella (passo 4), e in cella non si lanciano comandi git a mano. Si prendono dal ramo di revisione su GitHub (`revisione/ui-v3`, cartella `easybox/serverDati/scripts`): `vice-jaw-controlli.sql`, `vice-jaw.sql`, `vice-jaw-check.sql`.

**Prima della finestra, quando si vuole** (sola lettura, non cambia niente): cosa toccherà la migrazione sui dati veri, quali ordini fermerebbe la variante «morsa senza tipo» (non applicata, da decidere) e se `VICE.ID` è IDENTITY (sezione 7). PowerShell sul PC della cella:

```
cd D:\Backup; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -s "|" -i vice-jaw-controlli.sql -o D:\Backup\vice-jaw-controlli_esito.txt; Get-Content D:\Backup\vice-jaw-controlli_esito.txt
```

**La finestra.** Cella ferma: robot in HOLD dal pannello, nessun ordine a STATUS 3, **nessuno usa il pannello** (touch e tablet) fino alla fine. PowerShell **da amministratore** sul PC della cella. Gli esiti vanno in `D:\Backup`, e restano. **I passi 4 e 5 si fanno uno dopo l'altro, senza pause:** fra i due il backend nuovo gira con le viste di prima.

1. **Backup del DB, verificato.** Va nella cartella di backup dell'istanza (lì SQL Server può scrivere di sicuro); la riga finale dice il percorso.
   ```
   cd D:\Backup; sqlcmd -S .\SQLEXPRESS -E -d master -b -Q "DECLARE @d nvarchar(4000); EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'BackupDirectory', @d OUTPUT; DECLARE @f nvarchar(4000) = @d + N'\ADMG_prima_catalogo_chele.bak'; BACKUP DATABASE ADMG TO DISK = @f WITH COPY_ONLY, INIT, CHECKSUM; RESTORE VERIFYONLY FROM DISK = @f WITH CHECKSUM; PRINT @f;"
   ```
   Atteso: «Il set di backup del file '1' è valido» e il percorso. Se no, ci si ferma.
2. **Tabella, colonne e migrazione**, con i conteggi prima e dopo (lo script è in `D:\Backup`, il `git pull` è al passo 4):
   ```
   cd D:\Backup; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i vice-jaw.sql -o D:\Backup\vice-jaw_esito.txt; Get-Content D:\Backup\vice-jaw_esito.txt
   ```
   Atteso: «VICE_JAW creata», le tre colonne aggiunte, «MIGRAZIONE: fatta», `morse_con_tipo` = `morse_con_misure`, `battute_con_ref` uguale alle battute delle morse misurate, le tre VERIFICHE senza righe. Un «FERMO» (misura negativa) ferma la finestra: si ripristina niente, lo script non ha scritto.
3. **Righe delle tre viste, prima** (le viste non sono ancora cambiate: `vice-jaw.sql` non le tocca):
   ```
   cd D:\Backup; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -s "|" -i vice-jaw-check.sql -o D:\Backup\viste_prima_chele.txt
   ```
4. **Backend e pannello nuovi** (il catalogo arriva sul ramo di cella adesso), e subito dopo il passo 5:
   ```
   cd D:\Prog; git pull
   cd D:\Prog\easybox\tools; powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione aggiorna
   ```
5. **Le viste** (in quest'ordine; ogni esito tiene la definizione di prima, per il ritorno):
   ```
   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -y 0 -i coordinates-z-mc.sql -o D:\Backup\coordinates-z-mc_esito.txt; Get-Content D:\Backup\coordinates-z-mc_esito.txt
   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -f 65001 -y 0 -i coordinates-push-mc.sql -o D:\Backup\coordinates-push-mc_esito.txt; Get-Content D:\Backup\coordinates-push-mc_esito.txt
   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -f 65001 -y 0 -i coordinates-blow-mc.sql -o D:\Backup\coordinates-blow-mc_esito.txt; Get-Content D:\Backup\coordinates-blow-mc_esito.txt
   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -y 0 -i vices-view.sql -o D:\Backup\vices-view_esito.txt; Get-Content D:\Backup\vices-view_esito.txt
   ```
   Atteso: «portata alla versione del 7/10» (Z), «la porto alle chele dal catalogo» (spinta e soffiaggio), «misure della chela dal catalogo» (VICES). Un «FERMO» vuol dire che in cella c'è una definizione che il repo non conosce: ci si ferma e si legge l'esito.
6. **Confronto delle righe**: devono essere identiche.
   ```
   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -s "|" -i vice-jaw-check.sql -o D:\Backup\viste_dopo_chele.txt
   cd D:\Backup; $d = Compare-Object (Get-Content viste_prima_chele.txt) (Get-Content viste_dopo_chele.txt); $d; if (-not $d) { 'IDENTICHE' }
   ```
   Atteso: `IDENTICHE`. Altrimenti ritorno (qui sotto).
7. **Prova a robot fermo**: le quote degli ordini vivi (in coda e attivi), da confrontare con le stesse righe di `viste_prima_chele.txt`:
   ```
   cd D:\Backup; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -s "|" -Q "select z.ORDER_ID, w.STATUS, z.Z_PLACE_MC, z.Z_PICK_MC, p.X_PUSH, p.X_STOP, p.Z_PUSH_DROP, p.PUSH_STATUS, b.CLAW_LENGTH, b.STOP_BEYOND_CLAW, b.CLAW_LENGTH/2 + b.STOP_BEYOND_CLAW as X_SUPPORT from WORKORDER w join COORDINATES_Z_MC z on z.ORDER_ID = w.ID join COORDINATES_PUSH_MC p on p.ORDER_ID = w.ID join COORDINATES_BLOW_MC b on b.ORDER_ID = w.ID where w.STATUS in (3, 4) order by z.ORDER_ID"
   ```
   E nel pannello: pagina della morsa e Spinta in battuta dicono «Chele montate: Chele attuali …» con le misure di prima.
8. **Primo deposito a velocità ridotta**: velocità del robot al 10 % dalla pagina Robot, primo ordine con la morsa, si guarda il deposito (e la spinta, se il pezzo ce l'ha); poi la velocità di sempre.

**Ritorno**, a cella ferma, in quest'ordine:
1. le viste com'erano:
   ```
   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -f 65001 -y 0 -i vice-jaw-views-rollback.sql -o D:\Backup\vice-jaw-views-rollback_esito.txt; Get-Content D:\Backup\vice-jaw-views-rollback_esito.txt
   ```
2. tabella e colonne: lo script riporta nella morsa le misure del tipo montato e la battuta corretta, così le viste di prima danno gli stessi numeri, poi toglie catalogo e colonne (si ferma se una vista legge ancora il catalogo):
   ```
   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i vice-jaw-rollback.sql -o D:\Backup\vice-jaw-rollback_esito.txt; Get-Content D:\Backup\vice-jaw-rollback_esito.txt
   ```
3. backend e pannello di prima, con `pannello.ps1 -Versione ritorno`. Riporta la copia di lavoro al commit prima del catalogo, ricompila il pannello e riavvia backend e pannello. Si ferma se ci sono modifiche locali o se il commit non è nella storia del ramo; il ramo non si sposta. Il commit dipende dal ramo di cella (`pannello.ps1 -Versione stato` lo dice). Sul ramo `ui-v3`:
   ```
   cd D:\Prog\easybox\tools; powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione ritorno -Commit fd0138a26b1bbb29d6370ecacb97f0032b14dfe5
   ```
   Sul ramo `ui-lifting`:
   ```
   cd D:\Prog\easybox\tools; powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione ritorno -Commit 632d60cf552b0e53f598a2dcc11cefafc49d50cd
   ```
   Dopo il ritorno la copia di lavoro è fuori dal ramo: un `git pull` dice che non è su un ramo e non fa niente. Per rimettere il catalogo, la finestra da capo; il passo 4 diventa `pannello.ps1 -Versione v3` (o `-Versione stabile`), che torna sul ramo, aggiorna e ricompila. Se va male anche il ritorno: il backup del passo 1.

**Provato il 7/10** sul clone del portatile (backup della cella del 6/10), con gli stessi comandi: righe identiche prima e dopo, guardie «conforme» al secondo lancio, ritorno con righe identiche a prima; in una transazione annullata anche con dati di prova (zeri, misure parziali, lunghezze dispari, chele cambiate: X_Support identico al micron; blocco chele). **Rifatta l'8/10** con gli script finali: in più l'affondo a 0 resta 0 nel tipo (chela piatta), lunghezza e altezza a 0 diventano NULL. Il ritorno del codice (`pannello.ps1 -Versione ritorno`) è provato in `tools/test_pannello_servizi.ps1`, CASO 7, su un clone parziale come quello di cella.

**Il pannello vecchio (`ui-lifting`)** non ha pagine per il catalogo: legge e scrive le misure passando dal tipo montato, e dice «Chele montate: <codice>». Catalogo, montaggio e conferma delle chele nell'ordine sono nel pannello v3 (parte 2). Due cose cambiano per chi usa il pannello vecchio:
- **una misura della chela non si azzera più** dal form morsa: un campo lasciato vuoto vuol dire «nessun cambio». Si azzera, o si corregge, dal catalogo delle chele (parte 2);
- **una morsa nuova con le misure della chela viene rifiutata** (KO_NO_JAW) finché non arriva la parte 2: si crea la morsa senza misure, e le misure si danno al tipo di chele quando lo si monta.

**Backend nuovo senza lo schema** (cioè `git pull` e `-Azione aggiorna` prima di `vice-jaw.sql`): verificato l'8/10 compilando sul clone, senza eseguirlo, l'SQL che il backend nuovo manda. Fallisce con «nome di colonna non valido»:
- la **creazione di ogni ordine**, non solo quelli con la spinta;
- salva morsa e il montaggio o lo smontaggio della morsa sul pallet in Attrezzaggi (`updateVice`);
- l'elenco e la dichiarazione delle battute, quindi anche il controllo della spinta nel wizard, che senza battute ferma gli ordini dei pezzi con la spinta;
- le misure della chela da Spinta in battuta;
- tutte le rotte del catalogo.

Funzionano: la lettura delle morse, la creazione di una morsa senza misure, la compensazione e le quote della spinta lette dalla vista; PLC e robot non ne risentono. Per questo il catalogo arriva sui rami di cella solo nella finestra, al passo 4.
## [ ] 2026-10-07 — Consegna 35 (7/10 sera): cassetto fuori anche su swap e pallet, spinta con quote NULL, 973

**Cosa.** PLC, la scarica Dario: due file, da scaricare **insieme, nella stessa finestra**:
- `35_FB7_guardie_e_spinta.scl` (FB_Robot), base l'export 8c9da6a, uguale al PLC dopo le consegne 33 e 34;
- `35_FB_easyBox_cassetti_da_pannello.scl` (FB_easyBox), base il FB_easyBox del repo al commit 7007bb8.

Le intestazioni dei due file dicono blocco per blocco cosa cambia, i codici e i limiti. Origine: la seconda simulazione del 7/10 (sigle B). Decisioni in DECISIONI.md, codici in ALLARMI-PLC.md («Consegna 35»), limiti in LAVORI-IN-CODA.md.

**Pannello** (si può aggiornare prima del download: senza la 35 i testi nuovi non escono, e il 972 arriva da solo come oggi): testi del 973 e del 691; 1419 e 1519 con l'ordine giusto dei passi (prima RESET, poi il cassetto, poi il comando); 20011 con la Reimposta stato cella a cassetto 0; il 972 seguito dal codice dell'errore attivo diventa un avviso unico.

**Prima di incollare i blocchi, in TIA:** la variabile Temp `cassettoFuori` (Bool) va aggiunta **a mano** in fondo alla sezione Temp della tabella dell'interfaccia di FB_Robot (nell'editor l'interfaccia è una tabella e non si incolla). Poi i blocchi, come dicono le intestazioni (FB_Robot: A interfaccia, B..R le region e gli stati; FB_easyBox: S la region Manager CMD from HMI).

**Precondizioni di download, verificate in watch** (non dichiarate a voce), con la cella in HOLD dal pannello e il robot fermo:
- `"DB_Robot".Dispatcher[0..31]` tutti a 0;
- `"DB_Robot".MissionCode` = 0;
- `"DB_MC1".Dispatcher[0]` in {0, 5, 97, 9999}.

Gli stati nuovi (215, 1030, 1040, 1335) nella versione di oggi non esistono: con i master a 0 nessuna catena cambia significato a metà.

**Download in RUN senza reinizializzazione.** Interfaccia: solo una Temp in più, nessuna statica nuova, nessun retain toccato; FB_easyBox invariato. **Se TIA chiede di reinizializzare DB_Robot, ci si ferma**: si perderebbero `Dispatcher`, `Gripper_ID` e `GripperOccuped` (ritentivi). Si riporta a Dario cosa propone TIA.

**Test di accettazione** (watch: `"DB_Robot".Error`, `"DB_Robot".MissionCode`, `"DB_Robot".Dispatcher[0]`, `"DB_Robot".Gripper_ID[1]`, `"DB_BOX_1".ExtractedTray`; pannello aperto su MqttDiag; cella in HOLD dal pannello).

FB_Robot, senza robot (bastano PLC e pannello):
1. **973.** Da tabella di controllo `"DB_Robot".MissionCode := 140` (il master non fa niente con quel codice). Dal pannello «Chiudi chela». Atteso: su ALARM/ROBOT 973, `MissionCode` resta 140; a video il testo del 973. Poi RESET: `MissionCode` 0.
2. **972 col codice.** Da tabella di controllo `"DB_Robot".Error := 999`. Dal pannello «Chiudi chela». Atteso: su ALARM/ROBOT prima 972, poi 999; a video l'avviso unico, titolo «Comando rifiutato: errore attivo 999» e il testo del 999 (senza la coda «Premi RESET e ripeti il comando.»: il 999 ha un testo). RESET.
3. **Spinta**, da PowerShell sul database (sola lettura):
   ```
   cd D:\Backup; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -Q "select ORDER_ID, PUSH_STATUS, isnull(X_PUSH,0) as XP, isnull(X_STOP,0) as XS, X_STOP - X_PUSH as CORSA, Z_PUSH_DROP from COORDINATES_PUSH_MC where MC=1 order by ORDER_ID desc"
   ```
   Atteso: 0 e 0 sulle righe con PUSH_STATUS diverso da OK; sull'ordine di riferimento dell'intestazione gli stessi valori di prima; CORSA sempre sotto 200000 (sopra, la spinta di quell'ordine si spegnerebbe senza allarme).

FB_Robot, col robot a velocità ridotta:

4. cassetto fuori, DOPPIA a bordo: cambio pinza verso la PALLET (il pannello col cassetto fuori lo spegne: il comando va mandato senza il pannello, come nel test 2 della consegna 34). Atteso: 1519, il master resta a 0, il robot non si muove;
5. cassetto fuori, DOPPIA a bordo: «Carica pallet» dal magazzino (il pannello col cassetto fuori lo spegne dal 7/10, `aa2433b`: il comando va mandato senza il pannello, come nel test 4). Atteso: 1519 al 1010, nessun comando 13 al robot;
6. cassetti chiusi, DOPPIA a bordo: «Carica pallet». Atteso: 1010 → 1020 (scarico) → 1030 (carico della PALLET) → 1040 (TCP) → 1050 → 1060;
7. pezzo di prova a bordo (lato 1, dichiarato). Una tasca vuota per davvero segnata piena a database (39;p;4), poi «deposita in tasca p». Atteso: 691, il robot non si muove. Ripristino: 39;p;2 e RESET (la catena resta a 691 fino al RESET, e intanto i comandi di missione danno 972);
8. automatico con cambio pallet: lo scarico pallet arriva al 240 e il ciclo prosegue (prima si fermava al 230); al 215 parte il TCP;
9. HOLD di 2 minuti a metà swap: nessun 943, e CONTINUA riprende;
10. HAAS in ciclo a vuoto, porta chiusa, HOLD, RESET. Atteso: DISPATCH/MC1/0 resta 95 e va a 100 a fine ciclo. A HAAS ferma con la porta aperta, al 95: RESET porta FB204 a 0.

FB_easyBox:
1. cella in HOLD, nessun errore, pinza con uncino a bordo: «sposta» per estrarre un cassetto dalla pagina Cassetti. Atteso: estrazione come dalla pagina Robot (master 700 → 705 → 730 → 750);
2. cella in HOLD, da tabella di controllo `"DB_Robot".Error := 999`: «sposta». Atteso: su ALARM/ROBOT 972 e poi 999, `"DB_Robot".MissionCode` resta 0 (niente resta in attesa, quindi niente può partire più tardi). RESET;
3. cella non in HOLD: «sposta». Atteso: nessun movimento, `MissionCode` 0.

**Regole operative nuove** (dopo il download):
- **cambio pinza col cassetto fuori: mai**, da nessun percorso (pannello, swap, master pallet, automatico). In automatico il ciclo si ferma col 952 (FB204 in 9999) invece di andare allo scaffale: si rientra il cassetto e si dà RESET;
- **973 in pausa:** in HOLD durante una produzione i comandi di missione dal pannello danno 973. O CONTINUA, o la procedura dopo una missione interrotta (RESTART MAIN PROGRAM, HOME, Reimposta stato cella);
- **pagina Cassetti solo in HOLD:** «sposta» estrae e ripone passando dal manager di FB_Robot, con gli stessi rifiuti della pagina Robot (972, 973, 968 sotto pendant). In automatico il comando non fa niente;
- **RESET con la HAAS in lavorazione:** a porta chiusa FB204 aspetta il fine ciclo (resta al 95) invece di tornare a 0. Se la HAAS si ferma a ciclo interrotto con la porta chiusa, FB204 resta al 95: si apre la porta dalla HAAS e si dà RESET (oppure AUX);
- i timeout di swap (943) e cassetto (19003) non contano in HOLD;
- deposito in tasca a posizione fissa solo su tasca vuota a database: altrimenti 691 (si controlla la tasca, la si dichiara con il 39, RESET, si ripete).

**Dopo il download** (su richiesta di Dario): tia-export, `--compare-online` e diff con 8c9da6a per FB_Robot e FB_easyBox, blocco per blocco; poi si toglie la regola provvisoria della voce «Consegna 34» qui sotto.

## [ ] 2026-10-07 — Base dei grigliati: `Base.dxf` nella cartella dei modelli

**Cosa.** Dal 7/10 la pagina Grigliato non disegna più una base scritta nel codice: profilo esterno, fori e testi vengono da `Base.dxf`, nella cartella `Grating_model_dir` del `.env` del backend (la stessa dei modelli SVG del pannello). Il file **non sta nel repo**: il repo è pubblico, e in cella `git pull` sovrascriverebbe un file non tracciato allo stesso percorso. Decisione in DECISIONI.md.

**Dove metterlo.** La cartella si legge nel `.env` di cella:
```
Select-String -Path D:\Prog\easybox\serverDati\.env -Pattern Grating_model_dir
```
Il file va lì, col nome esatto `Base.dxf`.

**Come si sostituisce.** Si copia il file nuovo col nome `Base.dxf`, sovrascrivendo il vecchio, e si riapre la pagina del grigliato. Niente riavvii e niente build: il backend legge il file a ogni apertura della pagina (`GET /api/conf/grating/base`) e il browser non lo tiene in cache. Massimo 5 MB.

**Cosa vuol dire la riga rossa** (sopra il disegno): la base manca o non è valida. Il messaggio dice perché e quale file è stato cercato. Con la riga rossa **DXF e stampa PDF sono bloccati**; generazione, salvataggio e modello SVG funzionano lo stesso.
- «Base.dxf non trovato»: manca il file nella cartella del percorso indicato;
- «Grating_model_dir non è impostata»: manca la riga nel `.env` del backend (non si cerca altrove);
- «chiudi il profilo (JOIN)», «unisci il profilo in una polilinea», «ne serve una sola», «manca il profilo»: il profilo va corretto nel CAD;
- «non sta nel cassetto W×H»: origine non in alto a sinistra, oppure quote non in mm (un disegno in pollici sta tutto in un angolo).

La **riga gialla** porta gli avvisi (es. unità dichiarate in pollici, fori fuori dal layer HOLES): il file si usa lo stesso, la riga si chiude con ×. La riga sotto il disegno dice quale file è in uso, la data di modifica e quanti fori ha. Le **tasche in rosso**, con l'elenco in giallo sopra il disegno, sono a meno di 3 mm di materiale da un foro o dal profilo (valore da confermare con la misura delle viti): solo un avviso, DXF e stampa chiedono «Esportare comunque?».

**Le regole del file:**
- vista lato operatore: il grigliato come lo inserisce l'operatore nel cassetto, la scritta «Robot» sul lato lontano, in alto;
- 0,0 in alto a sinistra del rettangolo del cassetto, X verso destra, **Y negativa verso il basso**. **Lo 0,0 è l'origine del work object** del robot;
- profilo: **una sola polilinea chiusa** (2D, archi ammessi) sul layer `PROFILE`; niente linee o archi sciolti;
- fori: cerchi, meglio sul layer `HOLES` (su un altro layer valgono lo stesso, con un avviso); il layer `PIECES` è delle tasche e nella base si ignora;
- testi facoltativi: si disegnano in grigio, non vanno nel DXF esportato; blocchi (`INSERT`) da esplodere;
- DXF ASCII, quote in **mm**: `$INSUNITS` e `$EXTMIN/$EXTMAX` non si usano;
- il DXF, la pagina Cassetti e l'anteprima del Grigliato sono tutti in **vista lato operatore**: tasca 1 in alto a sinistra, vicino allo 0,0, lato robot in alto. Per il robot, che sta dal lato opposto, la tasca 1 è in basso a destra (correzione della sera del 7/10: qui c'era scritto che l'origine era l'angolo (W, −H), ed era sbagliato).

Il DXF esportato dalla pagina sta nello stesso frame e si sovrappone 1:1 a `Base.dxf`: una tasca robot (X, Y) µm cade in (Y/1000, −X/1000).

**Messa in servizio:** dopo `git pull` e `servizi-cella.ps1 -Azione aggiorna` (che ricompila il pannello e riavvia anche il backend, con la route nuova), copiare `Base.dxf` nella cartella e aprire un grigliato. Col file del 7/10 attesi: nessuna riga rossa, riga gialla per le unità in pollici e per gli 8 fori sul layer 0, riga sotto il disegno con 8 fori.

## [ ] 2026-10-07 — Consegna 34 (7/10): uncino per i cassetti e pinza ferma col cassetto fuori

**Cosa.** PLC, la scarica Dario (scaricata il 7/10 verso le 13:45, insieme alla 33): file `34_FB7_uncino_e_cassetto_fuori.scl`, solo FB_Robot, sulla base della consegna 33 (i blocchi non si sovrappongono, si può scaricare nella stessa finestra). Decisioni di Dario del 7/10 in DECISIONI.md: l'uncino è un dato dell'anagrafica (`GRIPPER.HAS_HOOK`); senza una pinza adatta a bordo il PLC va a prendersi quella con l'uncino; anche il rilascio vuole l'uncino; con un cassetto aperto niente pinze dallo scaffale.

**`HAS_HOOK` in cella** (verificato il 7/10): bit, esiste già. Vale 1 sulla pinza doppia (righe 26 e 37), 0 sulla pinza pallet (1) e sulle vecchie righe «gancio» 15 e 24 (SUB_POS 1002). Il PLC lo legge dalla tabella `GRIPPER`; la vista `GRIPPERS`, da cui legge il pannello, non lo esponeva: lo aggiunge `gripper-has-hook.sql`.

**Come il PLC sceglie la pinza con l'uncino** (REGION Gripper_Hook_Search): la pinza a bordo se ha `HAS_HOOK = 1`, altrimenti la prima a scaffale (`POS_PLANT 0`) con l'uncino, a ID più basso (riga canonica della doppia). Nessuna: **19006**. Fino al 7/10 si cercavano le righe «gancio» (SUB_POS > 1000) e in `GripperRequested` finiva 2, una pinza che non esiste.
- Estrazione dal pannello (master 700): se la pinza a bordo non ha l'uncino il PLC la scarica, solo se è vuota (altrimenti **19007**), monta quella con l'uncino, manda il TCP al robot ed estrae: 700 → 705 → 710 (deposita) → 715 (monta) → 720 (TCP) → 730 → 750. Con la doppia a bordo: 700 → 705 → 730, nessun cambio pinza.
- Estrazione e rilascio, in ogni percorso: la query delle catene legge anche `HAS_HOOK` della pinza a bordo. Senza uncino: **19005** (estrazione) o **20011** (rilascio). Col cassetto fuori la pinza non si cambia: il cassetto si rientra a mano.

**In automatico** la pinza a bordo all'estrazione è quella dell'ordine e non si cambia: senza uncino 19005 e il ciclo si ferma. Quindi ogni pinza che preleva pezzi dai cassetti deve avere `HAS_HOOK = 1` (oggi la doppia ce l'ha). Produzione lo avvisa, senza bloccare, quando si crea o si avvia un ordine con una pinza senza uncino.

**Pinze col cassetto fuori.** Catene pinza (scaffale → robot e robot → scaffale), stato 10: con un cassetto fuori (registro `ExtractedTray`, sensori `I_OUT_TRAY1..12`, catene di estrazione o rilascio attive) la pinza non si muove: **1419** (carico) o **1519** (deposito). **Correzione del 7/10 sera (consegna 35):** qui c'era scritto che il divieto valeva per tutti i percorsi, swap e master automatici compresi. Era sbagliato: con la 34 lo copre solo chi passa dalle catene pinza; lo swap (master 970) andava allo scaffale col cassetto fuori, e i master 1020/1050 andavano avanti dopo il rifiuto. **Lo swap e i master pallet li copre la consegna 35**, voce qui sopra. Con la 34 i master che passano dalle catene restano in attesa con l'errore alzato, come col 949: RESET, si rientra il cassetto, si ripete. Solo il 700 chiude da sé la missione.

**REGOLA PROVVISORIA, da togliere quando Dario conferma il download della 35:** finché in PLC c'è la 34, con un cassetto fuori:
- niente cambio pinza (27);
- niente «Carica pallet» (né pallet da MC1);
- niente avvio dell'automatico se la pinza a bordo non è quella dell'ordine.

Il PLC 34 non li ferma e il robot può andare allo scaffale pinze col cassetto aperto. Nel pannello (7/10 sera) i comandi pinza (pagina Robot e «sposta» della lista pinze) sono spenti col cassetto fuori o in manovra, con «Cassetto fuori: prima rientralo»; «Gestione pallet» propone solo i pallet che non chiedono un cambio pinza e si spegne se non ce n'è. Il confronto è quello del PLC (master 1010: cambio quando `GripperRequested <> Gripper_ID[1]`): `PALLET.GripperREQ`, letta senza badare alle maiuscole del nome della colonna, contro la pinza che il PLC tiene come **lato 1** (`FROM_PLANT/GRIPPER/ROBOT`, nel pannello `GRIPPER/REGISTERED`). Dall'8/10 un pallet che chiede la gemella del lato 2 conta come cambio pinza, come nel PLC; se il registro del PLC non è arrivato e la pinza è doppia, il lato 1 non si sa e col cassetto fuori nessun pallet si propone; il collaudo 31/33 offre solo la pinza a bordo. L'automatico non lo ferma il pannello.

**Codici** (tutti in `Error`, testi `robot.alarm_<codice>`, vedi ALLARMI-PLC.md): 1419 carico pinza rifiutato, cassetto fuori; 1519 deposito pinza rifiutato, cassetto fuori; 19005 estrazione rifiutata, pinza a bordo senza uncino; 19006 nessuna pinza con uncino, né a bordo né a scaffale; 19007 per prendere la pinza con l'uncino quella a bordo deve essere vuota; 20011 rilascio rifiutato, pinza a bordo senza uncino.

**Messa in servizio, in quest'ordine, a cella ferma:**
1. la vista, prima del pannello che mostra la casella:
   ```
   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i gripper-has-hook.sql
   ```
   Atteso «estesa con HAS_HOOK»; rilanciato, «conforme». Se stampa FERMO, riportare la definizione trovata. Senza lo script il pannello funziona lo stesso: la casella è spenta e il valore a database non si tocca;
2. i servizi (pannello con la casella, i testi dei sei codici, i comandi pinza spenti col cassetto fuori, l'avviso in Produzione);
3. **prima del download**, in anagrafica pinze: `HAS_HOOK = 1` su tutte e sole le pinze che hanno l'uncino. La verifica in fondo allo script li elenca (le righe 15 e 24 non compaiono: la vista le esclude già);
4. il download della consegna 34 (Dario), in RUN senza reinizializzazione: interfaccia invariata, nessuna variabile nuova, nessun retain perso;
5. i test di accettazione della consegna, in HOLD, porta operatore chiusa. In watch: `"DB_Robot".Error`, `Dispatcher[0]` (`_master`), `Gripper_ID[1]`, `GripperRequested`, `"DB_BOX_1".ExtractedTray`:
   1. pinza pallet a bordo, vuota, cassetti chiusi, «estrai cassetto» dal pannello. Atteso: 700 → 705 → 710 → 715 (monta la 26) → 720 → 730 → 750, il cassetto esce;
   2. col cassetto fuori, «carica pinza» o «scarica pinza». Atteso: 1419 o 1519, il robot non va allo scaffale. Il pannello aggiornato spegne questi comandi col cassetto fuori: per vedere il rifiuto del PLC il comando va mandato senza il pannello (`TO_PLANT/CMD/ROBOT` `11;<id>` o `12` da un client MQTT);
   3. doppia a bordo, «estrai cassetto». Atteso: niente cambio pinza, 700 → 705 → 730;
   4. rilascio del cassetto con la doppia a bordo: rientra come prima;
   5. doppia a bordo e cassetto fuori, togli l'uncino alla doppia in anagrafica, comando di rilascio. Atteso: 20011, il robot non si muove. Rimetti l'uncino, RESET, rilascia: il cassetto rientra;
   6. automatico, un ciclo completo: identico a prima;
6. tia-export e confronto con le consegne 33 e 34, blocco per blocco (parte 5, dopo il download). Fatto il 7/10 sul **progetto del portatile** salvato alle 12:21 (commit 8c9da6a). **Download delle consegne 33 e 34 fatto il 7/10 verso le 13:45**, da quel progetto. Export rilanciato dopo il download, a progetto chiuso: identico a 8c9da6a, e il file del progetto è ancora quello delle 12:21. Quindi **il confronto vale anche per il PLC**. **Confronto diretto col PLC, 7/10**, a portatile collegato: `tia-export.exe --compare-online`, in sola lettura (nessun download né upload, progetto chiuso senza salvare). Esito: **uguale 165, diverso 0, solo nel progetto 0, solo nel PLC 0**, compresi `FB_Robot [FB7]` con le consegne 33 e 34, `FB_RobotEfort [FB8]`, `FB_Machine_Autonomous [FB204]`, la tabella `Robot_Efort` (con `Sys_SetRobotspeed` a %QW650) e i blocchi safety. Il report è in `plc/COMPARE.txt`. Il confronto riguarda il software del PLC (blocchi, tipi, tabelle), non la configurazione hardware. Esito dell'export:
   - blocchi A, C, D, E1, E2, F1 e F2 identici; fuori dai blocchi niente cambia, compresi i blocchi della 33;
   - il blocco B (Gripper_Hook_Search) ha lo stesso codice, ma è stato incollato **dentro** la region esistente: `REGION Gripper_Hook_Search` compare due volte, una dentro l'altra. Il comportamento non cambia; la region esterna va tolta in TIA alla prossima modifica.

**Limiti** (LAVORI-IN-CODA): un cassetto a metà corsa non lo vede nessuno (`AllTrayInside`, %I35.6, non cablato); le righe 15 e 24 da chiarire; `currentGripperHasHook` dichiarata e mai usata.

Provato sul clone del portatile il 7/10: `gripper-has-hook.sql` lanciato due volte («estesa con HAS_HOOK», poi «conforme»; verifica: 1 senza uncino, 26 e 37 con).

## 2026-10-07 — Riarmo dopo un'emergenza: procedura (simulazione 7/10, problema 1)

**Quando vale** (DECISIONI.md, 7/10): HOLD = pausa, il PLC non azzera niente e CONTINUA riprende la missione dal punto in cui era. Questa procedura vale solo per una missione interrotta: emergenza o riarmo, RESET con una missione a metà, RESTART MAIN PROGRAM, comando di movimento a metà missione.

Decisione di Dario del 7/10 (DECISIONI.md): nessuna correzione PLC. Il riarmo (`Start_AUX`, `ResetAreaRobot`) azzera le catene del PLC, mentre il robot riprenderebbe la missione interrotta. Quindi il robot va in home e lo stato della cella si dichiara di nuovo. In quest'ordine:

1. cella in HOLD. **Non premere CONTINUA né il pulsante HOLD**: il PLC riavvia il programma robot dalla riga corrente, e il robot riprenderebbe la missione interrotta;
2. RESTART MAIN PROGRAM. Confermato dal robotista il 7/10: in HOLD abbandona la missione e mette il robot in attesa della prossima;
3. HOME, oppure il robotista in T1 se il robot è in macchina o al cassetto. I ritorni in home sono sicuri da qualunque punto (robotista, 7/10);
4. controllo visivo;
5. Reimposta stato cella (pezzi in pinza, morsa, cassetto);
6. pallet in macchina e tasche, se la missione interrotta li ha toccati;
7. RESET, poi CONTINUA.

Dettagli del problema: [SIMULAZIONE-2026-10-07.md](SIMULAZIONE-2026-10-07.md), problema 1.

## [ ] 2026-10-07 — Consegna 33 (7/10): correzioni della simulazione, vista `MAN_ORDER_MC1` **prima** del download

**Cosa corregge** (PLC, la scarica Dario; file `33_FB7_correzioni_simulazione.scl`; dal 7/10 è nel progetto TIA del portatile, export nel commit 80a414b; **scaricata nel PLC il 7/10 verso le 13:45**, insieme alla 34): quattro problemi della [simulazione del 7/10](SIMULAZIONE-2026-10-07.md):
- 2: registro del pallet in macchina (`DB_MC1.pallet`) sbagliato dopo un deposito manuale del pallet;
- 3: il manuale usava l'ordine chiuso (`DB_MC1.order.ID`, che FB204 non azzera a fine produzione);
- 9: comandi accettati con un errore attivo, che poi partivano da soli;
- 14: una dichiarazione 35 rifiutata lasciava spenta la supervisione 938.

**Come il PLC sceglie l'ordine dal pannello.**
- Deposito in MC1: l'ordine di MC1 del pezzo della tasca di provenienza, dalla vista `MAN_ORDER_MC1` 7/10. Prima l'ordine **avviato e non completo** (STATUS 3, PRODUCTED < QUANTITY, la regola con cui FB204 sceglie l'ordine attivo), poi in coda o in pausa (4, 6), a parità il più recente. Nessun ordine: 970. Provenienza del pezzo non nota: l'ordine avviato di MC1 se c'è, altrimenti 971.
- Prelievo da MC1, query del soffiaggio (stato 37 di Part_MC_to_Robot): l'ordine attivo, altrimenti quello congelato col pezzo in macchina (`OrderIdMC`), altrimenti il più recente.
- Il ramo pannello o automatico non si decide più da `RemoteMode` riletto a ogni ciclo (simulazione, problema 13), ma dal master: i comandi del pannello lo tengono in **1230** (prelievo del pezzo da MC1), **1250** (deposito del pezzo su MC1), **1350** (deposito del pallet su MC1).

**Comandi con un errore attivo.** Dal PLC 33 un comando dal pannello con `Error` diverso da 0 viene rifiutato con **972** (su `ALARM/ROBOT`, testo nel pannello): RESET e si ripete; con il 938 prima la dichiarazione dello stato cella. Il comando si consuma, `MissionCode` non viene scritto: prima restava in attesa e partiva da solo quando il pulsante HOLD azzerava `Error`. Vale con la cella in manuale e il robot non sotto pendant; sotto pendant resta il 968. Elenco dal codice (REGION Manager CMD from HMI, valori da `tags/cmd_Robot.xml`):
- **rifiutati con il 972**: 11 preleva pinza, 12 deposita pinza, 13 e 14 preleva/deposita oggetto (i comandi pallet), 25 estrai cassetto, 26 riponi cassetto, 27 cambio pinza, 31 e 32 preleva/deposita pezzo nel cassetto, 33 e 34 preleva/deposita pezzo in MC1, 244 preleva il finito e deposita il grezzo, 240-243 apri/chiudi pinza 1 e 2;
- **ancora ammessi**: home (20), manutenzione (21), posizionamenti (15, 1501, 1502, 1511, 1512), le dichiarazioni (35-44) e i reset (83, 99), oltre a HOLD, velocità e refresh.

Per l'operatore cambia questo: carico, scarico e cambio pinza e i comandi pallet da magazzino prima partivano anche con un errore attivo, adesso vogliono prima il RESET.

**944, 945, 946** (rifiuti del 35): dal PLC 33 arrivano su `ALARM/ROBOT`; prima restavano solo in `Error` e il pannello vedeva un timeout. Vedi ALLARMI-PLC.md.

**Messa in servizio, in quest'ordine, a cella ferma:**
1. la vista, **prima** del download:
   ```
   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i man-order-mc1.sql
   ```
   Atteso «aggiornata dalla 6/10 alla 7/10»; rilanciato, «conforme». La verifica in fondo stampa gli ordini di MC1 (3, 4, 6), le prime tasche del cassetto 8 col loro ordine e gli ordini avviati ma già completi: devono essere 0 (chiusura automatica, `orderAutoClose.js`); se non lo sono, riportarlo. Col PLC 33 e la vista del 6/10 un deposito dal pannello con l'ordine avviato darebbe 970;
2. i servizi (pannello col testo nuovo del 970 e il 972);
3. il download della consegna 33 (Dario), in RUN senza reinizializzazione: interfaccia invariata, nessun retain perso. Prima, in watch: `"DB_Robot".Dispatcher[31]` (se è diverso da 0, oggi la supervisione 938 è spenta), `"DB_MC1".order.ID`, `"DB_MC1".pallet`. Se l'indice 31 è fermo su 944, 945 o 946, al primo ciclo torna a 0 e il pannello riceve quel codice **una** volta: è atteso;
4. i test di accettazione della consegna. In watch: `"DB_Robot".OrderIdMC`, `Error`, `MissionCode`, `Dispatcher[31]`, `"DB_MC1".pallet`, `"DB_MC1".order.ID`, `"DB_RobotMission"."X_Pick-Place"`, `"Z_Pick-Place"`:
   1. *problema 2*: dal pannello preleva il pallet da MC1 (`DB_MC1.pallet` va a 0), poi rimettilo in MC1. Atteso: `DB_MC1.pallet` = ID del pallet;
   2. *problema 3*: con `DB_MC1.order.ID` su un ordine finito o di un altro pezzo, preleva dal cassetto un pezzo con un ordine di MC1 in coda o in pausa (per esempio il 1035, ordine 2117) e depositalo in MC1 dal pannello. Atteso: `OrderIdMC` = 2117 subito dopo il 12; `Z_Pick-Place` del deposito = quella del 2117 (269600 al 6/10); spinta e misure del 2117. Poi preleva da MC1 dal pannello: stesso `OrderIdMC`, `Z_Pick-Place` = quota di prelievo del finito del 2117;
   3. *problema 9*: in HOLD, da tabella di controllo `"DB_Robot".Error` = 999, poi «estrai cassetto» dal pannello. Atteso: il pannello mostra 972, il robot non si muove, `MissionCode` resta 0. RESET dal pannello e di nuovo «estrai cassetto»: parte;
   4. *problema 14*: da tabella di controllo `"DB_Robot".Dispatcher[31]` = 944. Atteso, al ciclo dopo: `Dispatcher[31]` = 0 e il pannello mostra il 944. Se il pannello lo permette, anche una dichiarazione vera che il PLC rifiuta (pinza dichiarata contro il sensore, 945). Atteso: rifiuto a video subito, non dopo il timeout; `Error` = 945 fino al RESET. Dopo il RESET, se la pinza è davvero incoerente col registro, il 938 torna subito, non dopo 2 s (supervisione attiva; corretto il 7/10 sera, simulazione bis);
   5. *automatico*: un ciclo completo con deposito, prelievo (o missione 16) e cambio pallet. Atteso: tutto come prima, `DB_MC1.pallet` giusto, `OrderIdMC` = ordine attivo;
5. tia-export e confronto con la consegna, blocco per blocco. Fatto il 7/10 sul progetto salvato alle 10:37 (commit 80a414b). Blocchi B-F identici; in A cambiano solo gli spazi di 21 righe di continuazione; fuori dai blocchi niente. È il **progetto del portatile** con la consegna 33. Download delle consegne 33 e 34 il 7/10 verso le 13:45; export rilanciato dopo il download, identico a 8c9da6a (export della 34, che contiene la 33): **la parte 4 è confermata anche per il PLC** (vedi il passo dell'export nella voce «Consegna 34»). Confermato anche dal confronto diretto col PLC del 7/10 (`tia-export.exe --compare-online`): 165 oggetti uguali, nessuno diverso o mancante, `FB_Robot [FB7]` compreso. Report in `plc/COMPARE.txt`.

**Nello stesso export, fuori dalla consegna:** in `tags/Robot_Efort.xml` il tag `Sys_SetRobotspeed` passa da %QW512 a %QW650 (al posto di `spare_9`, commit 896cb8f). Il codice non cambia, perché lo usa per nome. **Confermato il 7/10** (DECISIONI.md): lo spostamento l'hanno fatto Dario e il robotista, e il lato robot è allineato, cioè legge la velocità dalla parola nuova. Dalla storia del repo:
- compare per la prima volta a %QW650 nell'export del progetto salvato il 7/10 alle 10:37 (commit 896cb8f). Nell'export delle 9:22 (47ca223) era ancora a %QW512;
- prima era a %QW512 in tutti gli export, dal primo della tabella (34f79b7, 5/10);
- lo scrive un solo blocco, `FB_RobotEfort`, REGION Signal_FROM_ROBOT, a ogni ciclo e senza condizioni: `"Sys_SetRobotspeed" := "DB_Robot".speedRequest`. `speedRequest` lo scrive solo `FB_Robot`, col comando 100 della velocità dal pannello (`#speedRequest := "DB_MQTT".lastParams[0]`). Nessun altro blocco esportato, SCL o LAD, lo nomina, e nessuno usa gli indirizzi %QW512 o %QW650. I blocchi safety e la configurazione hardware non si esportano.

**Rollback.** La vista del 6/10 si rimette solo insieme al PLC di prima (testo in testa a `man-order-mc1.sql`).

**Limiti** (LAVORI-IN-CODA): il 244 in manuale usa ancora `DB_MC1.order.ID`; il pulsante HOLD azzera `Error` anche con una catena ferma su un errore (FB8); `OrderIdMC` non è ritentivo.

Provato sul clone del portatile il 7/10: script lanciato due volte («aggiornata», poi «conforme»; 52 tasche del cassetto 8 con l'ordine 2117; 0 avviati ma completi). In una transazione chiusa con ROLLBACK: l'ordine 2117 portato a STATUS 3 resta scelto (avviato, 0 su 1); con QUANTITY 0 (avviato ma completo) non lo sceglie più nessuna tasca. Riga tornata com'era.

## [ ] 2026-10-07 — pallet «a bordo del robot»: come si dichiara, e perché passa dal PLC

**Quando serve.** Dopo un prelievo del pallet dalla macchina il sistema non sapeva che il pallet era in pinza: il pannello vedeva la pinza vuota e il PLC rifiutava il deposito a magazzino (errore 23 di MISSION_Unload_Pallet).

**Come si dichiara** (cella in HOLD), due strade che sono la stessa funzione (`HMI/src/util/palletOnRobot.js`):
- Attrezzaggi → riga del pallet → **Posiziona** → **A bordo del robot** → Conferma;
- pagina Robot, quando la pinza pallet risulta occupata e nessun pallet è a bordo: sotto «Gestione pallet» c'è **Dichiara quale pallet è in pinza** (prima c'era solo l'avviso «Dichiarare lo stato cella, poi riprovare») → scegliere il pallet → Conferma.

**Cosa parte.** Il pannello non scrive il database. Manda al PLC:
1. se il pallet risulta in macchina (`POS_PLANT` 100+n, oppure è quello del registro `DB_MC1.pallet`): `41` a MC1 con la guardia di «Rimuovi» (dal 7/10 sera, vedi sotto: altro pallet nel registro o registro non letto = nessun comando, registro a 0 = niente 41), come la pagina Macchine, e aspetta l'eco `DECLARE/MC1` col pallet a 0 (3 s). Rifiuto 947 (ciclo macchina avviato) o niente eco: ci si ferma qui, il 35 non parte. Dopo il 41 la macchina risulta vuota, anche il pezzo in morsa (`piecepresent` a 0);
2. `35;<pinza>;3;<pallet>;<lato 2>;0` e aspetta l'eco `DECLARE/ROBOT` `<pinza>;3;<lato 2>` (5 s). Rifiuti 944, 945, 946 (e 968/969 sotto pendant) con i testi di «Reimposta stato cella».

La pinza è quella che il PLC ha registrata come lato 1 (`GRIPPER/REGISTERED`), purché sia fra quelle a bordo nel database: il 35 mette in `Gripper_ID[1]` l'ID ricevuto, e per una pinza doppia la riga sbagliata scambierebbe i lati. Il lato 2 ripete il contenuto attuale della gemella; per una pinza a un lato solo (una sola riga GRIPPER a bordo) vale 0.

**Perché passa dal PLC.** Per il robot il database non basta: il pannello Robot decide su `GRIPPER.STATUS`, il PLC su `GripperOccuped[1]`. Scrivere solo `POS_PLANT=1000` lascerebbe la stessa incoerenza della sera del 6/10. Il 35 (FB_Robot, REGION Declare_State) scrive `GripperOccuped`, lo STATUS della pinza e `UPDATE Pallet SET POS_PLANT=1000` (stato 68), con le sue validazioni.

**Attenzione.** Il 35 parte con `RESET_ALL_DISPATCH`: annulla tutte le catene in corso nel PLC. Per questo il pannello rifiuta se:
- la cella non è in HOLD;
- la pagina Robot ha appena mandato una missione (le catene del PLC il pannello non le vede: vale la cella in HOLD);
- la pinza non è a bordo (sensore `GRIPPER/MOUNTED` e database), o quella registrata dal PLC non è fra quelle a bordo nel database;
- le chele del lato 1 sono lette aperte (`CLOSED1 = 0`: niente in mano);
- un altro pallet risulta già a bordo (`POS_PLANT=1000`): il 35 non lo libererebbe.

Non si tocca la casella del magazzino: `MAG_POS` resta la casa del pallet, dove lo si riporta con «Gestione pallet».

**Anche «In macchina» e «Rimuovi» del Posiziona passano dal PLC** (simulazione del 7/10, problema 16: scrivevano solo il database e `DB_MC1.pallet` restava com'era). Stessa logica della pagina Macchine, in `HMI/src/util/palletMachine.js`:
- «In macchina»: `40;<pallet>` a MC1, eco `DECLARE/MC1` col pallet (3 s), poi il database come prima (`POS_PLANT` 101, la casa resta, la casella di provenienza si libera). Se il registro ha già quel pallet il 40 non parte (FB204 lo rifiuterebbe); se ne ha un altro, niente comando e si dice quale;
- «Rimuovi» di un pallet in macchina: `41`, eco col pallet a 0, poi `MAG_POS -1`, `POS_PLANT 0`. «Rimuovi» di un pallet a magazzino non riguarda la macchina: solo il database;
- (7/10 sera) «Casella» di un pallet in macchina: come «Rimuovi», prima il `41` con la sua eco, poi la casella scelta (`MAG_POS` = casella, `POS_PLANT 0`, casella occupata e casa liberata, come prima). Prima scriveva solo il database. **Prima del 41** la casella si controlla su pallet e caselle riletti adesso, con lo stesso criterio del backend (un altro pallet con quel `MAG_POS`, o casella disabilitata): se è occupata, disabilitata o non letta, nessun comando, e si sceglie un'altra casella. Se dopo il 41 la scrittura fallisce lo stesso, il messaggio dice che il registro della macchina è già a 0 e il database no, e che si sceglie un'altra casella o si usa «Rimuovi dal magazzino». Al tentativo dopo il registro è a 0, quindi niente 41: basta il database;
- la guardia del 41 è una sola (`guardia41`), per «Rimuovi», «Casella» e il pallet a bordo del robot. Il 41 parte solo se il registro ha quel pallet. Con il registro già a 0 basta il database (il 41 azzererebbe anche il pezzo in macchina). Con un altro pallet nel registro non si manda niente e si dice quale. Col registro che non risponde, niente 41 alla cieca: «Registro della macchina non letto, riprova» (fino al 7/10 sera il 41 partiva lo stesso). Un pallet a magazzino non ha bisogno del 41, quindi va anche col registro non letto;
- rifiuto 947 di FB204 (ciclo macchina avviato, o 40 con un pallet già dichiarato) o niente eco: messaggio e **nessuna** scrittura nel database.

**Messa in servizio.** Solo pannello: nessuno script SQL e nessuna modifica al PLC (35, 40 e 41 esistono già). Aggiornare i servizi.

## [ ] 2026-10-06 — deposito manuale in MC1: vista `MAN_ORDER_MC1` **prima** del download di FB_Robot

> **7/10:** la regola della vista è cambiata con la consegna 33 (anche l'ordine avviato e non completo, con la precedenza). Lo stesso script, rilanciato, porta la vista dalla 6/10 alla 7/10: vedi la voce «Consegna 33» qui sopra.

Decisione di Dario in [DECISIONI.md](DECISIONI.md) («Deposito manuale in MC1»). La vista `MAN_ORDER_MC1` dà, per ogni tasca di cassetto, il pezzo (`Part_Type` della tasca) e l'ordine di MC1 in attesa per quel pezzo (STATUS 4 o 6, il più recente). FB_Robot la interroga (consegna 30, REGION Part_Robot_to_MC) quando in manuale, senza ordine avviato, si deposita in MC1.

**Comando**, da PowerShell in cella:

```
cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i man-order-mc1.sql
```

Esiti: «vista creata»; «già presente e conforme» (nessuna modifica: si può rilanciare); «FERMO» (esiste una vista con lo stesso nome ma diversa: non tocca niente e stampa la definizione trovata). In coda una verifica in sola lettura: gli ordini di MC1 in attesa e le tasche del cassetto 8 che li trovano.

**Ordine dei passi:**
1. la vista (comando qui sopra);
2. il download di FB_Robot (Dario: cella in HOLD, nessuna missione in corso);
3. l'export con tia-export, da confrontare con la consegna 30.

La vista va creata **prima** del download: senza la vista la ricerca fallisce e ogni deposito manuale in MC1 dà 970.

**Allarmi:** 970 nessun ordine in attesa per il pezzo prelevato (l'ordine si crea in Produzione senza avviarlo, poi reset e di nuovo il comando); 971 provenienza del pezzo non nota.

**Limite del riconoscimento:** il pezzo si riconosce dall'ultimo cassetto estratto e dall'ultima tasca di prelievo. Se fra prelievo e deposito si estrae un altro cassetto, il riconoscimento sbaglia.

**Codici di stato degli ordini**, letti in cella da `_STATUS_TYPE` il 6/10: 3 WORKING, 4 RAW (in coda), 5 FINISHED, 6 PAUSED, 7 ABORTED.

**Rollback:** `DROP VIEW dbo.MAN_ORDER_MC1;` solo dopo aver tolto la consegna 30 dal PLC.

## [x] 2026-10-06 — `tools/pannello.ps1` non c'era in cella: clone parziale

Dopo il pull del 6/10 `tools/pannello.ps1` non è comparso in cella. Causa verificata sul PC di cella: il clone è parziale (voce «Avvio e aggiornamento della cella»), git ha messo il file nell'elenco del pull ma non l'ha scritto sul disco. Defender non c'entra: lo storico delle minacce è vuoto.

Risolto:
- lo script sta in `easybox/tools/pannello.ps1` (commit a73e412). Nuovo comando in cella: `powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione stato`;
- contano solo i file tracciati (`git status --porcelain --untracked-files=no`); il messaggio finale non dice più che il backend si riavvia da solo, ma cosa riavviare e i quattro controlli; in testa al cambio di versione ricorda la cella in HOLD (commit 58231d1);
- prima di cambiare ramo o aggiornare controlla i file non tracciati d'intralcio, che nel clone parziale git sovrascriverebbe senza fermarsi (voce «Avvio e aggiornamento della cella»).

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
- da qui le uscite libere verso il robot partono da %QW646; dal 6/10 (consegna 31) %QW646 e %QW648 sono `Z_Push_LOW` e `Z_Push_HIGH` (quota Z della spinta, voce sulla spinta), libere da %QW650 a %QW666.

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
- **6/10, circa le 17 — X e Y scambiate nel PLC** (decisione di Dario: per il robot X e Y erano invertite; la Z non è mai stata toccata). Nei tre stati che leggono l'esito (1418 dello scambio, 39 di Part_Robot_to_MC e di Part_MC_to_Robot): %QW636 `Part_Width_mm` = PIECE.X (col[3], `PART_LENGTH` della vista), %QW640 `Part_Length_mm` = PIECE.Y (col[1], `PART_WIDTH`), %QW642 `Part_Height_mm` = PIECE.Z (col[4]). La vista `COORDINATES_BLOW_MC` non cambia: lo scambio sta nel PLC, quindi i nomi delle colonne della vista e quelli delle variabili PROFINET non coincidono più. Riscontro col pezzo 1035 (X 40, Y 109, Z 15): Width 40, Length 109, Height 15. %QW636 torna a portare PIECE.X, come dal 18/9 al 5/10. Il commento in FB_Robot («lo decide la vista, non il PLC») non vale più: da correggere in TIA alla prossima modifica. La mappa e la semantica qui sotto sono quelle del 5/10.
- Su richiesta del robotista il PLC passa le tre misure del pezzo dell'ordine in mm interi, troncati: %QW636 `Part_Width_mm` = PIECE.Y, %QW640 `Part_Length_mm` = PIECE.X, %QW642 `Part_Height_mm` = PIECE.Z, accanto a %QW634 `Vice_ClawLength_mm` e %QW638 `X_Support_mm`. Libere da %QW650 a %QW666: dal 6/10 %QW644 è `N_Cassetto` (vedi sopra) e %QW646/%QW648 sono `Z_Push_LOW`/`Z_Push_HIGH` (quota Z della spinta, voce sulla spinta).
- **Superata dalla nota del 6/10 qui sopra** (vale per l'anagrafica e la pagina Pezzo, non per il robot). Semantica (Dario e robotista, 5/10): X lunghezza, Y larghezza, Z altezza, come L/W/H nella pagina Pezzo.
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

### [ ] 6/10 — quota Z della spinta: da mettere in servizio

Decisione di Dario (6/10, 18:24):
- si imposta l'**altezza della chela dal fondo del pezzo** durante la spinta, da 0 alla quota di presa del grezzo (`PIECE.Z_PICK`); **vuoto = alla quota di presa = come oggi**;
- si salva per la coppia morsa + pezzo in `PIECE_ON_VICE.Z_PUSH` (int NULL, micron, `CHECK (Z_PUSH >= 0)`), accanto a `COMP_PUSH`. Si imposta dalla pagina «Spinta in battuta» (rotta `/setZPush`, solo UPDATE: la riga nasce dichiarando l'appoggio; il limite superiore lo rilegge il backend dal pezzo, oltre risponde `KO_Z_PUSH_RANGE`);
- arriva al robot su una variabile PROFINET nuova, scritta dal PLC prima della missione: %QW646 `Z_Push_LOW`, %QW648 `Z_Push_HIGH` (ex spare_7 e spare_8);
- robotista: il TCP è in punta alla chela; a 0 dal fondo la chela non sfonda l'appoggio.

**Formula:** `Z_Push = Z deposito − Z_PUSH_DROP`. `Z_PUSH_DROP` è una colonna della vista `COORDINATES_PUSH_MC`: vale `Z_PICK − Z_PUSH`, oppure 0 se `Z_PUSH` è vuota, se il pezzo non ha quota di presa o se `Z_PUSH` la supera (pezzo cambiato dopo). Non è mai NULL. La Z di deposito è `COORDINATES_Z_MC.Z_PLACE_MC`, dove il pezzo entra proprio con `Z_PICK` (verificato sulla definizione il 6/10; la vista ora è versionata in `coordinates-z-mc.sql`).

**Finché `Z_PUSH` è vuota non cambia niente:** `Z_PUSH_DROP` vale 0 e la chela spinge alla Z del deposito, come oggi.

**Ordine di messa in servizio**, a cella ferma:
1. script SQL:
   ```
   cd D:\Prog\easybox\serverDati\scripts
   sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i coordinates-z-mc.sql
   sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i piece-on-vice-z-push.sql
   sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -f 65001 -i coordinates-push-mc.sql
   ```
   Esiti attesi: «conforme» (la vista della Z di deposito non cambia); colonna e vincolo aggiunti; «variante completa della compensazione … aggiungo Z_PUSH, Z_PUSH_REF e Z_PUSH_DROP». Rilanciati, dicono «già presente» e «conforme». `-f 65001` sulla vista della spinta: il file è UTF-8, senza i trattini lunghi dei commenti diventano «â€”» (solo estetica, ma la vista in cella della Z di deposito è già così);
2. servizi: backend e pannello aggiornati (`servizi-cella.ps1 -Azione riavvia` o `pannello.ps1`). Il backend legge `Z_PUSH` e `Z_PUSH_DROP`: per questo gli script vanno prima;
3. PLC: consegna 31 (Dario), poi tia-export;
4. programma robot: `Z_Push` su %QW646/%QW648.

Provato il 6/10 sul clone del portatile: due esecuzioni di ogni script (la seconda «già presente» / «conforme»), verifiche vuote, e il caso costruito sulla riga morsa 1 / pezzo 1035 in una transazione chiusa con ROLLBACK (`Z_PUSH` 10000 → 0, 0 → 10000, 10001 → 0, 4000 → 6000, −1 rifiutato dal vincolo).

### [ ] 6/10 — prelievo da MC1 dopo una spinta: il robot usa la X del deposito

In cella, ordine 2117, corsa della spinta 3640 µm (3,64 mm):
- il PLC manda la X giusta: `X_Pick-Place` = 315140 = `X_PLACE` 311500 + corsa 3640. La scrive al 30 di `Part_MC_to_Robot` (`col[0] + xPushOffsetMC`), prima del comando di prelievo (40); nel ciclo a missione 16 la stessa somma la fa il master (`xPlaceTemp + xPushOffsetMC`);
- il robot ha prelevato a 311,5 mm, cioè alla X che aveva memorizzato al deposito, non a quella ricevuta.

**Causa lato robot**, verificata col robotista: il PLC e il pannello non c'entrano.

**Da fare (robotista):** il programma del prelievo da MC deve usare la X ricevuta col comando di prelievo, non quella memorizzata al deposito. Finché non è corretto, dopo una spinta il robot preleva il pezzo dove era prima della spinta, cioè spostato della corsa.

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
manda come X_Pick-Place). Y resta quella del deposito; la Z dal 6/10 scende di
`Z_PUSH_DROP` (quota Z della spinta, sopra), e finche' `Z_PUSH` e' vuota resta
quella del deposito. Del pezzo entra
`PIECE.Y`, perche' e' la dimensione che corre lungo la X del robot: e' la
stessa convenzione del passo delle tasche nel cassetto.

**Dipendenza da ricordare:** le quote presuppongono il deposito CENTRATO sulla
morsa (confermato da Dario). Se si riapprende la posizione di deposito in
macchina scentrata, la corsa calcolata non corrisponde piu' al reale e non c'e'
nessun controllo che se ne accorga.

## HTTPS del pannello: accensione e RITORNO IN HTTP

Il pannello gira in HTTPS per poter installare la PWA sul tablet, che arriva
per indirizzo IP. Il certificato lo prepara `HMI\tools\ensure-cert.ps1`
(`npm run cert`), che `start_hmi.bat` deve chiamare prima di Vite: in cella,
al 6/10, non lo chiama (voce aperta qui sotto).

### [ ] Aperto (6/10): lo `start_hmi.bat` di cella non chiama `npm run cert`

Al 6/10 lo `start_hmi.bat` di cella non chiama `npm run cert`, e Dario non l'ha ancora aggiunto.
- Il certificato del pannello in cella esiste, quindi il pannello gira in HTTPS. È del 15/09 e `ensure-cert.ps1` lo fa valere 2 anni: scade intorno a settembre 2028.
- Il rinnovo automatico parte solo con `call npm run cert` nel `.bat`, prima di `npm run dev`. Il `call` serve perché `npm` è a sua volta un `.bat`: senza, lo `start_hmi.bat` finirebbe dopo il certificato e Vite non partirebbe.

Finché la riga non c'è, quello che questa sezione dice su rigenerazione e rinnovo del certificato non vale: resta quello del 15/09.

### Se in cella qualcosa non va: tornare in HTTP

**Una riga sola, in `start_hmi.bat`, PRIMA di `npm run dev` (e di
`call npm run cert`, quando ci sarà).** Se la riga c'è con il `rem` davanti,
togliere il `rem`; nel `.bat` di cella del 6/10 non c'è, e va scritta:

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
solo se serve, ma solo se il `.bat` chiama `npm run cert` (voce aperta qui
sopra).

### Cosa NON serve fare

Vale quando `start_hmi.bat` chiama `npm run cert` (voce aperta qui sopra).

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
