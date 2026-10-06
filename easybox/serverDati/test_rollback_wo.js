// ============================================================================
// test_rollback_wo.js — ritorno dai work object per cassetto (rollback-wo.sql)
//
// Lo script lo ha scritto Dario e si versiona byte per byte. Qui, sul TESTO
// (come gli altri test sugli script, nessun DB):
//   1. la v3 e la v4 che lo script riconosce e rimette sono ESATTAMENTE quelle
//      degli script veri: @v3 = @v3 di robot-tray-view-v4.sql = corpo
//      dell'EXEC di superati/robot-tray-view-v3.sql; @v4 (senza il raddoppio
//      degli apici) = corpo dell'ALTER VIEW di robot-tray-view-v4.sql. Se un
//      giorno cambia la v4, questo test fallisce finche' non si aggiorna
//      anche il rollback;
//   2. la guardia $(ROBOT_RIF_UNICO) viene prima di BEGIN TRAN, e "$(" compare
//      una sola volta (sqlcmd sostituisce le variabili anche nei commenti);
//   3. ALTER (EXEC), UPDATE e sp_rename stanno fra BEGIN TRAN e COMMIT TRAN,
//      con un ROLLBACK TRAN su ciascuno dei due controlli (righe uguali al
//      backup, vista risultante v3);
//   4. nessuna istruzione scrive su TRAY, nessun DROP;
//   5. niente TRY_CAST / TRY_CONVERT (il DB della cella ha livello di
//      compatibilita' 100: intestazione del backup del 6/10);
//   6. solo ASCII, un solo batch.
//
// Uso:   node test_rollback_wo.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
const fs = require('fs');
const path = require('path');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const DIR = path.join(__dirname, 'scripts');
const leggi = f => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
const codice = s => s.split('\n').filter(r => !r.trim().startsWith('--')).join('\n');
// letterale N'...' di una DECLARE (testo grezzo, apici ancora raddoppiati)
const letterale = (s, nome) => (s.match(new RegExp("DECLARE @" + nome + " nvarchar\\(max\\) = N'([\\s\\S]*?)';\\n")) || [])[1];

const buf = fs.readFileSync(path.join(DIR, 'rollback-wo.sql'));
const raw = buf.toString('utf8').replace(/\r\n/g, '\n');
const code = codice(raw);
const v4file = codice(leggi('robot-tray-view-v4.sql'));
const v3file = codice(leggi('superati/robot-tray-view-v3.sql'));

console.log('1) la v3 e la v4 sono quelle degli script veri');
const rbV3 = letterale(code, 'v3'), rbV4 = letterale(code, 'v4');
const v4V3 = letterale(v4file, 'v3');
const exeV3 = (v3file.match(/EXEC\(N'ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS\n([\s\S]*?)'\);/) || [])[1];
const alterV4 = (v4file.match(/ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS\n([\s\S]*?)\nGO/) || [])[1];
check(!!rbV3 && !!rbV4 && !!v4V3 && !!exeV3 && !!alterV4, 'trovati i cinque testi (@v3/@v4 del rollback, @v3 della v4, EXEC della v3, ALTER della v4)');
check(rbV3 === v4V3, '@v3 del rollback identico al @v3 di robot-tray-view-v4.sql');
check(rbV3 === exeV3, '@v3 del rollback identico al corpo dell\'EXEC di superati/robot-tray-view-v3.sql');
check(!!rbV4 && rbV4.replace(/''/g, "'") === alterV4, '@v4 del rollback (senza il raddoppio degli apici) identico al corpo dell\'ALTER VIEW di robot-tray-view-v4.sql');
check(/EXEC \(N'ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS ' \+ @v3\);/.test(code), 'l\'ALTER rimette proprio @v3');

console.log('\n2) guardia ROBOT_RIF_UNICO');
const iBegin = code.search(/^BEGIN TRAN;/m), iCommit = code.search(/^COMMIT TRAN;/m);
const iGuardia = code.search(/IF '\$\(ROBOT_RIF_UNICO\)' <> 'SI'\s*\nBEGIN[\s\S]*?RETURN;\s*\nEND/);
check(iBegin > 0 && iCommit > iBegin, 'una transazione: BEGIN TRAN ... COMMIT TRAN');
check((code.match(/BEGIN TRAN/g) || []).length === 1 && (code.match(/COMMIT TRAN/g) || []).length === 1, 'una sola BEGIN TRAN e una sola COMMIT TRAN');
check(iGuardia > 0 && iGuardia < iBegin, 'guardia $(ROBOT_RIF_UNICO) (diverso da SI -> RETURN) prima di BEGIN TRAN');
check(iGuardia < code.search(/OBJECT_DEFINITION/), 'e prima di qualunque lettura');
check((raw.match(/\$\(/g) || []).length === 1, '"$(" una sola volta in tutto il file, commenti compresi');
check(/-v ROBOT_RIF_UNICO=SI/.test(raw), 'nell\'intestazione il comando con -v ROBOT_RIF_UNICO=SI');

console.log('\n3) scritture dentro la transazione, ROLLBACK sui due controlli');
const tran = code.slice(iBegin, iCommit);
check(code.indexOf("EXEC (N'ALTER VIEW") > iBegin && code.indexOf("EXEC (N'ALTER VIEW") < iCommit, 'EXEC dell\'ALTER fra BEGIN e COMMIT');
check(code.search(/^\s*UPDATE p SET/m) > iBegin && code.search(/^\s*UPDATE p SET/m) < iCommit, 'UPDATE fra BEGIN e COMMIT');
check(code.indexOf('EXEC sp_rename') > iBegin && code.indexOf('EXEC sp_rename') < iCommit, 'sp_rename fra BEGIN e COMMIT');
// scritture su oggetti del DB (le UPDATE/INSERT sulla variabile tabella @t,
// che serve a normalizzare i testi, non scrivono nel DB)
const scritture = (code.match(/^\s*(UPDATE|INSERT\s+INTO|DELETE)\s+(?!@)/gm) || []).length;
const exec = (code.match(/^\s*EXEC\b/gm) || []).length;
check(scritture === 1 && exec === 2, 'nessun\'altra scrittura: un UPDATE (righe [POSITION]) e due EXEC (ALTER e sp_rename) (' + scritture + ' / ' + exec + ')');
check(/IF @nOk <> 12\s*\n\s*BEGIN\s*\n\s*ROLLBACK TRAN;[\s\S]*?RETURN;/.test(tran), 'controllo 1: righe uguali al backup diverse da 12 -> ROLLBACK TRAN');
check(/IF @nNew <> @nV3\s*\nBEGIN\s*\n\s*ROLLBACK TRAN;[\s\S]*?RETURN;/.test(tran), 'controllo 2: vista risultante non v3 -> ROLLBACK TRAN');
check(tran.indexOf('IF @nOk <> 12') > tran.search(/UPDATE p SET/) && tran.indexOf('IF @nNew <> @nV3') > tran.indexOf("EXEC (N'ALTER VIEW"), 'ciascun controllo viene dopo la scrittura che verifica');
const upd = (code.match(/UPDATE p SET([\s\S]*?)\n\s*FROM \[POSITION\] p/) || [])[1] || '';
const bersagli = [...upd.matchAll(/\bp\.(\w+)\s*=/g)].map(m => m[1]);
check(bersagli.join(',') === 'X,Y,Z,X_CORR,Y_CORR,Z_CORR', 'l\'UPDATE rimette X/Y/Z e X/Y/Z_CORR delle righe [POSITION] (' + bersagli.join(', ') + ')');
check(/^SET XACT_ABORT ON;/m.test(code), 'SET XACT_ABORT ON: un errore a meta\' annulla tutto');

console.log('\n4) niente TRAY, niente DROP');
check(!/\b(UPDATE|INSERT\s+INTO|DELETE\s+FROM|MERGE|TRUNCATE\s+TABLE|ALTER\s+TABLE)\s+(dbo\.)?\[?TRAY\]?\b/i.test(code), 'nessuna istruzione scrive su TRAY');
check(!/\bDROP\b/i.test(code) && !/\bTRUNCATE\b|\bDELETE\b/i.test(code), 'nessun DROP (ne\' DELETE / TRUNCATE): il backup si rinomina, non si cancella');

console.log('\n5) compatibilita\' del DB (livello 100)');
check(!/TRY_CAST|TRY_CONVERT|TRY_PARSE/i.test(raw), 'nessun TRY_CAST / TRY_CONVERT / TRY_PARSE');

console.log('\n6) formato');
check(buf.every(b => b < 128), 'solo ASCII');
check(!/^\s*GO\s*$/m.test(code), 'un solo batch (nessun GO): ogni RETURN ferma tutto lo script');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
