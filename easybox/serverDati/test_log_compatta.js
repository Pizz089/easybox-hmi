// ============================================================================
// test_log_compatta.js — script di compattazione della tabella LOG
// (scripts/log-compatta.sql, 17/11)
//
// Lo script lo lancia Dario in cella con sqlcmd, a cella ferma e servizio
// EasyBoxBackend fermo, DOPO il rilascio della pulizia a blocchi. Qui, sul
// TESTO (come gli altri test sugli script, nessun DB):
//   1. solo ASCII, un solo batch, intestazione con quando e come lanciarlo;
//   2. la variabile GIORNI: una sola occorrenza di "$(" (sqlcmd sostituisce
//      anche nei commenti), letta come testo e controllata prima di tutto;
//   3. le guardie del passo 0 (tipi, LOG_NEW e LOG_OLD assenti, ...) e le
//      stampe (identity, nullabilita', permessi, trigger, dipendenze), tutte
//      PRIMA della prima scrittura;
//   4. l'ordine dei passi 0..6 e cosa fa ciascuno: log a 2 GB, LOG_NEW con
//      nvarchar e indici, copia a blocchi da 5000 con RTRIM e IDENTITY_INSERT,
//      scambio in una transazione, verifiche con prova annullata;
//   5. nessun DROP, nessun TRUNCATE, nessuna DELETE; ritorno indietro in fondo
//      e tutto commentato;
//   6. niente TRY_CAST / TRY_CONVERT / STRING_AGG (livello di compatibilita'
//      100 del DB della cella, APPUNTI-CELLA).
//
// Uso:   node test_log_compatta.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
const fs = require('fs');
const path = require('path');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const FILE = path.join(__dirname, 'scripts', 'log-compatta.sql');
if (!fs.existsSync(FILE)) { console.log('  FAIL scripts/log-compatta.sql non esiste'); console.log('\n1 CHECK FALLITI'); process.exit(1); }
const buf = fs.readFileSync(FILE);
const raw = buf.toString('utf8').replace(/\r\n/g, '\n');
const righe = raw.split('\n');
// codice: senza le righe di commento (il ritorno indietro in fondo e' commentato)
const code = righe.filter(r => !r.trim().startsWith('--')).join('\n');
const pos = re => code.search(re);
const tutte = re => [...code.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))].map(m => m.index);

console.log('1) file, intestazione');
check([...buf].every(b => b < 128), 'solo ASCII (sqlcmd legge il file nella code page della console)');
check(!/^\s*GO\s*$/im.test(code), 'un solo batch: niente GO, cosi\' un RETURN ferma tutto');
const intest = raw.slice(0, raw.indexOf('\nSET '));
check(/sqlcmd -S \.\\SQLEXPRESS -E -d ADMG -W -v GIORNI=60 -i log-compatta\.sql -o D:\\Backup\\[\w.]+\.txt/.test(intest), 'comando sqlcmd con -v GIORNI=60, -E -d ADMG e output in D:\\Backup');
check(/cella ferma/i.test(intest) && /EasyBoxBackend/.test(intest) && /fermo/i.test(intest), 'intestazione: cella ferma, servizio EasyBoxBackend fermo');
check(/DOPO/.test(intest) && /parte 1/i.test(intest) && /pulizia a blocchi/i.test(intest), 'intestazione: DOPO il rilascio della parte 1 (pulizia a blocchi)');
check(/SET XACT_ABORT ON;/.test(code) && /SET NOCOUNT ON;/.test(code), 'XACT_ABORT e NOCOUNT');

console.log('\n2) variabile GIORNI');
check((raw.match(/\$\(/g) || []).length === 1, '"$(" compare una sola volta in tutto il file (anche nei commenti sqlcmd sostituisce)');
const iVar = pos(/DECLARE @giorniTxt varchar\(20\) = '\$\(GIORNI\)';/);
check(iVar > 0, 'GIORNI letta come testo: DECLARE @giorniTxt varchar(20) = \'$(GIORNI)\'');
const iGuardiaGiorni = pos(/IF @giorniTxt = '' OR @giorniTxt LIKE '%\[\^0-9\]%' OR LEN\(@giorniTxt\) > 4\s*\nBEGIN\s*\n\s*PRINT 'FERMO[^\n]*\n\s*RETURN;/);
check(iGuardiaGiorni > iVar, 'GIORNI non intero (o piu\' di 4 cifre) -> FERMO, senza CAST che possa fallire');
check(/IF @giorni < 1\s*\nBEGIN\s*\n\s*PRINT 'FERMO[^\n]*\n\s*RETURN;/.test(code), 'GIORNI = 0 -> FERMO');
check(/SET @limite = DATEADD\(day, -@giorni, GETDATE\(\)\);/.test(code) && tutte(/SET @limite =/).length === 1, 'limite calcolato UNA volta: ora - GIORNI giorni');

console.log('\n3) passo 0: guardie e stampe prima di qualunque scrittura');
const iAlterDb = pos(/ALTER DATABASE ADMG MODIFY FILE/);
const scritture = [/ALTER DATABASE/, /CREATE TABLE/, /INSERT INTO dbo\.LOG/, /sp_rename/, /DBCC CHECKIDENT/, /ALTER TABLE/, /EXEC \(@crea\)|EXEC\(@crea\)/];
const primaScrittura = Math.min(...scritture.map(pos).filter(i => i >= 0));
check(primaScrittura === iAlterDb, 'la prima scrittura e\' l\'ALTER DATABASE del passo 1');
const fermi = tutte(/PRINT 'FERMO/);
const fermiPasso0 = fermi.filter(i => i < iAlterDb);
check(fermiPasso0.length >= 8, 'almeno 8 FERMO prima del passo 1 (' + fermiPasso0.length + ')');
check(tutte(/RETURN;/).length <= fermi.length + 1, 'ogni RETURN ha il suo PRINT FERMO');
const g = code.slice(0, iAlterDb);
check(/IF DB_NAME\(\) <> 'ADMG'/.test(g), 'guardia: database ADMG');
check(/FROM sys\.database_files WHERE name = 'SmallBOX_log' AND type = 1/.test(g), 'guardia: file di log SmallBOX_log presente');
check(/OBJECT_ID\(N'dbo\.LOG', 'U'\) IS NULL/.test(g), 'guardia: dbo.LOG esiste ed e\' una tabella');
check(/OBJECT_ID\(N'dbo\.LOG_NEW'\) IS NOT NULL OR OBJECT_ID\(N'dbo\.LOG_OLD'\) IS NOT NULL/.test(g), 'guardia: LOG_NEW e LOG_OLD non esistono');
check(/\(1, 'ID', 'bigint', 8\)/.test(g) && /\(2, 'DATA', 'datetime', 8\)/.test(g) && /\(3, 'DESCR', 'nchar', 4000\)/.test(g)
	&& /\(4, 'UNIT_A', 'nchar', 40\)/.test(g) && /\(5, 'UNIT_B', 'nchar', 40\)/.test(g),
	'guardia tipi: ID bigint, DATA datetime, DESCR nchar(2000) (4000 byte), UNIT_A/UNIT_B nchar(20) (40 byte), in quest\'ordine');
check(/@nColonne <> 5 OR @nColonneOk <> 5/.test(g), 'guardia: esattamente quelle 5 colonne (POSITION_trig scrive in LOG: stesso ordine)');
check(/sys\.identity_columns/.test(g), 'stampa: identity su ID (seed, incremento, valore attuale)');
check(/is_nullable/.test(g), 'stampa: nullabilita\' delle colonne');
check(/sys\.database_permissions/.test(g) && /class = 1/.test(g), 'stampa: permessi a livello oggetto su LOG');
check(/sys\.triggers/.test(g), 'stampa: trigger su LOG');
check(/sys\.sql_expression_dependencies/.test(g), 'stampa: oggetti che referenziano LOG');
check(/recovery_model_desc/.test(g), 'stampa: modello di recupero del database');

console.log('\n4) ordine dei passi e cosa fanno');
const passi = [0, 1, 2, 3, 4, 5, 6].map(n => pos(new RegExp("PRINT '=== PASSO " + n + '[ :]')));
check(passi.every(i => i >= 0) && passi.every((i, k) => k === 0 || i > passi[k - 1]), 'PASSO 0..6 presenti e in ordine');
check(/ALTER DATABASE ADMG MODIFY FILE \(NAME = SmallBOX_log, MAXSIZE = 2048MB, FILEGROWTH = 128MB\);/.test(code), 'passo 1: log a MAXSIZE 2048MB, FILEGROWTH 128MB');
check(iAlterDb > passi[1] && iAlterDb < passi[2], 'l\'ALTER DATABASE sta nel passo 1');
const iCrea = pos(/CREATE TABLE dbo\.LOG_NEW \(/);
check(iCrea > passi[2] && iCrea < passi[3], 'passo 2: CREATE TABLE dbo.LOG_NEW');
check(/DESCR nvarchar\(2000\)/.test(code) && /UNIT_A nvarchar\(20\)/.test(code) && /UNIT_B nvarchar\(20\)/.test(code) && /\[DATA\] datetime/.test(code) && /ID bigint/.test(code),
	'LOG_NEW: ID bigint, DATA datetime, DESCR nvarchar(2000), UNIT_A/UNIT_B nvarchar(20)');
check(/IDENTITY\(' \+ CAST\(@seed AS nvarchar\(30\)\) \+ N',' \+ CAST\(@incr AS nvarchar\(30\)\)/.test(code), 'identity con lo stesso seed e incremento dell\'originale');
check(/CONSTRAINT PK_LOG_NEW PRIMARY KEY CLUSTERED \(ID\)/.test(code), 'PK clustered su ID con nome nuovo (PK_LOG_NEW)');
check(/CREATE NONCLUSTERED INDEX IX_LOG_DATA ON dbo\.LOG_NEW \(\[DATA\]\);/.test(code) && /CREATE NONCLUSTERED INDEX IX_LOG_UNIT_B_DATA ON dbo\.LOG_NEW \(UNIT_B, \[DATA\]\);/.test(code),
	'indici su (DATA) e su (UNIT_B, DATA)');
const iCopia = pos(/SELECT TOP \(5000\) ID, \[DATA\], RTRIM\(DESCR\), RTRIM\(UNIT_A\), RTRIM\(UNIT_B\)/);
check(iCopia > passi[3] && iCopia < passi[4], 'passo 3: copia a blocchi da 5000 con RTRIM su DESCR, UNIT_A, UNIT_B');
check(/FROM dbo\.LOG WHERE ID > @dopo AND \[DATA\] >= @limite ORDER BY ID;/.test(code), 'per ID crescente, solo DATA >= limite');
const iIdOn = pos(/SET IDENTITY_INSERT dbo\.LOG_NEW ON;/), iIdOff = pos(/SET IDENTITY_INSERT dbo\.LOG_NEW OFF;/);
check(iIdOn > passi[3] && iIdOff > iIdOn && iIdOff < passi[4], 'IDENTITY_INSERT ON/OFF attorno al blocco di copia');
check(/IF @identita = 1\s*\n\s*SET @blocco = N'SET IDENTITY_INSERT dbo\.LOG_NEW ON;/.test(code), 'IDENTITY_INSERT solo se ID e\' identity');
check(/PRINT 'righe attese[^\n]*@attese/.test(code) && /copiate/.test(code.slice(passi[3], passi[4])), 'conteggi attesi e copiati stampati');

console.log('\n5) passo 4: scambio in UNA transazione');
const iBegin = tutte(/BEGIN TRAN;/), iCommit = tutte(/COMMIT TRAN;/);
check(iCommit.length === 1, 'una sola COMMIT TRAN (quella dello scambio)');
const b4 = iBegin.find(i => i > passi[4] && i < passi[5]);
check(!!b4 && iCommit[0] > b4 && iCommit[0] < passi[5], 'BEGIN TRAN ... COMMIT TRAN dentro il passo 4');
const tran = b4 ? code.slice(b4, iCommit[0]) : '';
check(/WITH \(TABLOCKX, HOLDLOCK\)/.test(tran), 'LOG bloccata in esclusiva prima del confronto finale');
const iRen1 = tran.search(/EXEC sp_rename N'dbo\.LOG', N'LOG_OLD';/), iRen2 = tran.search(/EXEC sp_rename N'dbo\.LOG_NEW', N'LOG';/);
check(iRen1 > 0 && iRen2 > iRen1, 'LOG -> LOG_OLD, poi LOG_NEW -> LOG');
check(/@nNuova <> @nAttese[\s\S]*?ROLLBACK TRAN;[\s\S]*?PRINT 'FERMO[\s\S]*?RETURN;/.test(tran), 'conteggi diversi sotto blocco -> ROLLBACK e FERMO, LOG intatta');
check(/EXEC sp_rename @oggetto, @a, N'OBJECT';/.test(tran), 'nomi dei vincoli sistemati (sp_rename OBJECT)');
check(/EXEC \(@permessi\);/.test(tran), 'permessi a livello oggetto ricopiati');
check(/DBCC CHECKIDENT \(N'dbo\.LOG', RESEED, @maxId\);/.test(tran) && tran.search(/DBCC CHECKIDENT/) > iRen2, 'reseed dell\'identity a MAX(ID), dopo lo scambio');
check(/SET LOCK_TIMEOUT \d+;/.test(code.slice(passi[4], b4 || 0)), 'LOCK_TIMEOUT prima della transazione: se LOG e\' occupata si ferma, non resta appeso');

console.log('\n6) passo 5: verifiche');
const v = code.slice(passi[5], passi[6]);
check(/COUNT\(\*\)/.test(v) && /MIN\(\[DATA\]\)/.test(v), 'conteggi e MIN(DATA)');
check(/EXEC sp_spaceused N'dbo\.LOG';/.test(v) && /EXEC sp_spaceused N'dbo\.LOG_OLD';/.test(v), 'sp_spaceused su LOG e LOG_OLD');
const b5 = iBegin.find(i => i > passi[5] && i < passi[6]);
check(!!b5 && /INSERT INTO dbo\.LOG \(\[DATA\], DESCR, UNIT_A, UNIT_B\)/.test(v) && /ROLLBACK TRAN;/.test(v) && !/COMMIT/.test(v), 'INSERT/SELECT di prova in una transazione chiusa con ROLLBACK');

console.log('\n7) niente di distruttivo, ritorno indietro commentato');
check(!/\bDROP\b/i.test(raw), 'nessun DROP, neanche nei commenti');
check(!/\bTRUNCATE\b/i.test(raw), 'nessun TRUNCATE, neanche nei commenti');
check(!/\bDELETE\b/i.test(code), 'nessuna DELETE nel codice');
const iRit = raw.indexOf('RITORNO INDIETRO');
const coda = iRit >= 0 ? raw.slice(raw.lastIndexOf('\n', raw.lastIndexOf('-- ====', iRit))).split('\n') : [];
check(iRit > raw.indexOf("PRINT '=== PASSO 6"), 'blocco RITORNO INDIETRO in fondo, dopo il passo 6');
check(coda.length > 5 && coda.every(r => r.trim() === '' || r.trim().startsWith('--')), 'tutto commentato fino alla fine del file');
const rit = coda.join('\n');
check(/-- EXEC sp_rename N'dbo\.LOG', N'LOG_NEW';/.test(rit) && /-- EXEC sp_rename N'dbo\.LOG_OLD', N'LOG';/.test(rit)
	&& rit.indexOf("N'LOG_NEW';") < rit.indexOf("N'dbo.LOG_OLD', N'LOG';"), 'scambio inverso: LOG -> LOG_NEW, poi LOG_OLD -> LOG');
check(/-- BEGIN TRAN;/.test(rit) && /-- COMMIT TRAN;/.test(rit), 'anche il ritorno in una transazione');

console.log('\n8) compatibilita\' 100');
check(!/TRY_CAST|TRY_CONVERT|STRING_AGG|CONCAT_WS/i.test(code), 'niente TRY_CAST, TRY_CONVERT, STRING_AGG, CONCAT_WS');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
