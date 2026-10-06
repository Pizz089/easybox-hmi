// ============================================================================
// test_extract_coords_workobject.js — quote di ESTRAZIONE relative al cassetto
// (scripts/extract-coords-workobject.sql, 6/10)
//
// Lo script lo ha scritto Dario e si versiona byte per byte: qui si controlla
// sul TESTO (come test_push_to_stop.js per le viste) che resti com'e' stato
// pensato, cioe' sicuro da lanciare una volta sola in cella:
//   1. le guardie ($(ROBOT_WO) e tabella di backup gia' presente) vengono
//      prima di BEGIN TRAN;
//   2. l'UPDATE scrive solo X, Y e Z delle righe [POSITION]; nessuna
//      istruzione scrive su TRAY ne' sulle correzioni della riga;
//   3. backup (SELECT * INTO) e UPDATE stanno fra BEGIN TRAN e COMMIT TRAN,
//      con ROLLBACK TRAN sul controllo a 12;
//   4. il piano si ricava sempre con CAST(SUBSTRING(PARENT,14,50) AS int),
//      come nella vista COORDINATES_FOR_EXTRACT;
//   5. niente TRY_CAST / TRY_CONVERT (livello di compatibilita' del DB non
//      verificato);
//   6. "$(" una volta sola (sqlcmd sostituisce le variabili anche nei
//      commenti: un "$(" in piu' farebbe fallire lo script);
//   7. file solo ASCII, un solo batch (RETURN esce da tutto lo script).
// Nessun DB: solo lettura del file.
//
// Uso:   node test_extract_coords_workobject.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
const fs = require('fs');
const path = require('path');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const file = path.join(__dirname, 'scripts', 'extract-coords-workobject.sql');
const buf = fs.readFileSync(file);
const raw = buf.toString('utf8').replace(/\r\n/g, '\n');
// codice senza i commenti di riga (il rollback commentato in coda contiene
// UPDATE, BEGIN TRAN e COMMIT TRAN)
const code = raw.split('\n').filter(r => !r.trim().startsWith('--')).join('\n');
const pos = re => code.search(re);

const iBegin = pos(/^BEGIN TRAN;/m), iCommit = pos(/^COMMIT TRAN;/m);
console.log('1) guardie prima della transazione');
check(iBegin > 0 && iCommit > iBegin, 'una transazione: BEGIN TRAN ... COMMIT TRAN');
check((code.match(/BEGIN TRAN/g) || []).length === 1 && (code.match(/COMMIT TRAN/g) || []).length === 1, 'una sola BEGIN TRAN e una sola COMMIT TRAN nel codice');
const iWo = pos(/IF '\$\(ROBOT_WO\)' <> 'SI'\s*\nBEGIN[\s\S]*?RETURN;\s*\nEND/);
check(iWo > 0 && iWo < iBegin, 'guardia ROBOT_WO (diverso da SI -> RETURN) prima di BEGIN TRAN');
const iBk = pos(/IF OBJECT_ID\('dbo\.POSITION_EXTRACT_PRE_WO','U'\) IS NOT NULL\s*\nBEGIN[\s\S]*?RETURN;\s*\nEND/);
check(iBk > 0 && iBk < iBegin, 'guardia sulla tabella di backup gia\' presente prima di BEGIN TRAN');
check(iWo < pos(/^SELECT p\.ID/m), 'la guardia ROBOT_WO viene prima di qualunque lettura');
check(/IF @nRighe <> 12 OR @nPiani <> 12 OR @nTray <> 12[\s\S]*?RETURN;/.test(code.slice(0, iBegin)) && /IF @nFuori > 0[\s\S]*?RETURN;/.test(code.slice(0, iBegin)), 'anche conteggi e campo delle quote fermano prima di BEGIN TRAN');

console.log('\n2) cosa scrive');
const upd = (code.match(/UPDATE p SET([\s\S]*?)\nFROM \[POSITION\] p/) || [])[1] || '';
const bersagli = [...upd.matchAll(/\bp\.(\w+)\s*=/g)].map(m => m[1]);
check(bersagli.join(',') === 'X,Y,Z', 'l\'UPDATE assegna solo p.X, p.Y, p.Z (' + bersagli.join(', ') + ')');
check(!/p\.[XYZ]_CORR\s*=/.test(upd), 'nel SET nessuna assegnazione a X_CORR, Y_CORR, Z_CORR (a destra si sottraggono le correzioni del cassetto t.*_CORR)');
// istruzioni a inizio riga (la parola compare anche nel testo di un PRINT)
check((code.match(/^\s*UPDATE\b/gm) || []).length === 1, 'una sola istruzione UPDATE in tutto il codice');
check(!/\b(UPDATE|INSERT\s+INTO|DELETE\s+FROM|MERGE|TRUNCATE\s+TABLE|DROP\s+TABLE|ALTER\s+TABLE)\s+(dbo\.)?\[?TRAY\]?\b/i.test(code), 'nessuna istruzione scrive su TRAY');
check(!/\bDELETE\b|\bDROP\b|\bTRUNCATE\b|\bALTER\b/i.test(code), 'nessun DELETE / DROP / TRUNCATE / ALTER (la tabella di backup resta)');

console.log('\n3) backup e UPDATE nella transazione, ROLLBACK sul controllo a 12');
const iInto = pos(/SELECT \* INTO dbo\.POSITION_EXTRACT_PRE_WO FROM \[POSITION\] WHERE PARENT LIKE 'EXTRACT%';/);
const iUpd = pos(/UPDATE p SET/);
check(iInto > iBegin && iInto < iCommit, 'SELECT * INTO dbo.POSITION_EXTRACT_PRE_WO fra BEGIN e COMMIT');
check(iUpd > iInto && iUpd < iCommit, 'UPDATE dopo il backup, prima del COMMIT');
const ctrl = code.slice(iUpd, iCommit);
check(/IF @nBk <> 12 OR @nOk <> 12\s*\nBEGIN\s*\n\s*ROLLBACK TRAN;[\s\S]*?RETURN;\s*\nEND/.test(ctrl), 'ROLLBACK TRAN (e RETURN) se backup o righe verificate non sono 12');
check(/^SET XACT_ABORT ON;/m.test(code), 'SET XACT_ABORT ON: un errore a meta\' annulla tutto');

console.log('\n4) piano dal PARENT come nella vista COORDINATES_FOR_EXTRACT');
const piani = code.match(/CAST\(SUBSTRING\((p\.)?PARENT,14,50\) AS int\)/g) || [];
check(piani.length >= 6, 'CAST(SUBSTRING(...PARENT,14,50) AS int) in tutti i join e i conteggi (' + piani.length + ')');
check(!/SUBSTRING\((p\.)?PARENT,(?!14,50\))/.test(code) && !/RIGHT\((p\.)?PARENT|REPLACE\((p\.)?PARENT/i.test(code), 'nessun altro modo di ricavare il piano');

console.log('\n5) niente TRY_CAST / TRY_CONVERT');
check(!/TRY_CAST|TRY_CONVERT|TRY_PARSE/i.test(raw), 'nessun TRY_* in tutto il file');

console.log('\n6) variabili sqlcmd');
check((raw.match(/\$\(/g) || []).length === 1, '"$(" una sola volta in tutto il file, commenti compresi');
check(/-v ROBOT_WO=SI/.test(raw), 'nell\'intestazione il comando con -v ROBOT_WO=SI');

console.log('\n7) formato');
check(buf.every(b => b < 128), 'solo ASCII');
check(!/^\s*GO\s*$/m.test(code), 'un solo batch (nessun GO): ogni RETURN ferma tutto lo script');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
