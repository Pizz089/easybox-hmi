// ============================================================================
// test_gripper_has_hook.js — vista GRIPPERS con HAS_HOOK, uncino per i
// cassetti (scripts/gripper-has-hook.sql, consegna 34 del 7/10)
//
// Si controlla sul TESTO dello script (come test_man_order_mc1.js):
//   1. la versione nuova e' quella di gripper-claw-length.sql piu' UNA riga,
//      ",G.HAS_HOOK" dopo ",G.CLAW_LENGTH": le altre colonne non cambiano;
//   2. la versione da riconoscere (@vClaw) e' proprio la vista che crea
//      gripper-claw-length.sql;
//   3. niente ALTER TABLE (la colonna c'e'), niente DROP; senza colonna FERMO;
//   4. solo ASCII, nessun "$(" (lo lancia sqlcmd), niente TRY_CAST;
//   5. guardia a varianti: versione claw-length -> ALTER, riletta, "estesa";
//      versione con HAS_HOOK -> "conforme"; assente o altro -> FERMO con la
//      definizione;
//   6. verifica finale in sola lettura (ID, FAMILY, SUB_POS, POS_PLANT,
//      HAS_HOOK da GRIPPERS) e intestazione (perche', comando, rollback).
// Nessun DB: solo lettura dei file. Sul clone del portatile il 7/10: prima
// esecuzione "estesa con HAS_HOOK", seconda "conforme".
//
// Uso:   node test_gripper_has_hook.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
const fs = require('fs');
const path = require('path');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const file = path.join(__dirname, 'scripts', 'gripper-has-hook.sql');
const buf = fs.readFileSync(file);
const raw = buf.toString('utf8').replace(/\r\n/g, '\n');
const code = raw.split('\n').filter(r => !r.trim().startsWith('--')).join('\n');
const testa = raw.split('\n').filter(r => r.trim().startsWith('--')).join('\n');

const leggi = nome => { const m = code.match(new RegExp('DECLARE ' + nome + " nvarchar\\(max\\) = N'((?:[^']|'')*)';")); return m ? m[1].replace(/''/g, "'") : ''; };
const v = leggi('@v'), vClaw = leggi('@vClaw');
check(v.length > 0 && vClaw.length > 0, 'trovati i testi delle due versioni: @v (con HAS_HOOK, ' + v.length + ' caratteri) e @vClaw (' + vClaw.length + ')');

// la guardia, rifatta qui: spazi normalizzati, ';' finale tolto, dal primo
// "SELECT G.ID," in poi
const norm = t => {
	let s = t.replace(/[\r\n\t]/g, ' ');
	while (s.includes('  ')) s = s.replace(/  /g, ' ');
	s = s.trim();
	if (s.endsWith(';')) s = s.slice(0, -1).trimEnd();
	const i = s.toLowerCase().indexOf('select g.id,');
	return i >= 0 ? s.slice(i) : s;
};

console.log('1) la versione nuova = quella di prima piu\' G.HAS_HOOK');
const righe = t => t.split('\n').map(r => r.trim());
const rv = righe(v), rc = righe(vClaw);
const iClaw = rc.indexOf(',G.CLAW_LENGTH');
check(iClaw > 0 && rv.length === rc.length + 1 && rv[iClaw + 1] === ',G.HAS_HOOK'
	&& JSON.stringify(rv.slice(0, iClaw + 1).concat(rv.slice(iClaw + 2))) === JSON.stringify(rc),
	'@v = @vClaw con una sola riga in piu\', ",G.HAS_HOOK" subito dopo ",G.CLAW_LENGTH"');
const colonne = t => (norm(t).match(/^SELECT (.*?) FROM GRIPPER G/i) || [])[1] || '';
check(colonne(v) === colonne(vClaw).replace(',G.CLAW_LENGTH ,', ',G.CLAW_LENGTH ,G.HAS_HOOK ,'), '   stesse colonne di prima piu\' HAS_HOOK; FROM e WHERE invariati');
check(norm(v).slice(norm(v).indexOf('FROM GRIPPER G')) === norm(vClaw).slice(norm(vClaw).indexOf('FROM GRIPPER G')), '   join e condizioni invariate');

console.log('\n2) @vClaw e\' la vista di gripper-claw-length.sql');
const claw = fs.readFileSync(path.join(__dirname, 'scripts', 'gripper-claw-length.sql'), 'utf8').replace(/\r\n/g, '\n');
const mClaw = claw.match(/EXEC\('ALTER VIEW dbo\.GRIPPERS AS\n([\s\S]*?)'\);/);
check(!!mClaw && norm(mClaw[1].replace(/''/g, "'")) === norm(vClaw), 'stesso testo, a spazi normalizzati');
// come la conserva SQL Server (CREATE VIEW anche dopo un ALTER, CRLF, tab)
const salvata = 'CREATE VIEW dbo.GRIPPERS AS\r\n' + vClaw.replace(/\n/g, '\r\n');
check(norm(salvata) === norm(vClaw) && norm(salvata) !== norm(v), '   la vista com\'e\' in cella si riconosce come versione claw-length (e non come quella nuova)');
check(norm('CREATE VIEW dbo.GRIPPERS AS ' + v) === norm(v), '   alla seconda esecuzione la versione nuova risulta "conforme"');

console.log('\n3) niente ALTER TABLE, niente DROP');
const istr = code.split('\n').filter(r => !/^\s*PRINT\b/i.test(r)).join('\n');
check(!/ALTER\s+TABLE/i.test(istr) && !/\bDROP\b/i.test(istr), 'fra le istruzioni (fuori dai PRINT) nessun ALTER TABLE e nessun DROP');
check(/IF COL_LENGTH\('dbo\.GRIPPER', 'HAS_HOOK'\) IS NULL\s+BEGIN\s+PRINT 'FERMO:[^']*';\s+RETURN;\s+END/.test(code), '   colonna assente: FERMO e uscita, senza crearla');
check((istr.match(/ALTER VIEW/gi) || []).length === 1 && !/CREATE VIEW/i.test(istr), '   un solo ALTER VIEW fra le istruzioni, nessun CREATE VIEW');

console.log('\n4) ASCII, niente variabili sqlcmd, niente TRY_CAST');
check(!buf.some(b => b > 127), 'file solo ASCII');
check(!raw.includes('$('), 'nessun "$(" nel file');
check(!/\bTRY_CAST\b|\bTRY_CONVERT\b/i.test(code), 'nessun TRY_CAST / TRY_CONVERT (compatibilita\' 100)');

console.log('\n5) guardia a varianti');
check(/UPDATE @t SET txt = SUBSTRING\(txt, CHARINDEX\(N'SELECT G\.ID,', txt\), LEN\(txt\)\)/.test(code), 'la guardia confronta dal primo "SELECT G.ID," in poi, come rifatto qui');
check(/IF @def IS NULL\s+BEGIN\s+PRINT 'FERMO: la vista GRIPPERS non esiste/.test(code), '   vista assente -> FERMO');
check(/ELSE IF @nDef = @nV\s+PRINT 'GRIPPERS: gia'' presente e conforme/.test(code), '   versione con HAS_HOOK -> "conforme", nessuna modifica');
check(/ELSE IF @nDef = @nClaw\s+BEGIN\s+EXEC \(N'ALTER VIEW dbo\.GRIPPERS AS ' \+ @v\);[\s\S]*?IF @dopo = @nV\s+PRINT 'GRIPPERS: estesa con HAS_HOOK/.test(code),
	'   versione claw-length -> ALTER, riletta, "estesa"');
check(/ELSE\s+BEGIN\s+PRINT 'FERMO: GRIPPERS esiste ma non e''[^']*''[^']*''[^']*Definizione trovata:';\s+SELECT @def AS definizione_trovata;/.test(code),
	'   altra versione -> FERMO, stampa la definizione trovata');

console.log('\n6) verifica finale e intestazione');
check(/EXEC \(N'select ID, FAMILY, SUB_POS, POS_PLANT, HAS_HOOK from GRIPPERS order by ID'\)/.test(code),
	'select ID, FAMILY, SUB_POS, POS_PLANT, HAS_HOOK from GRIPPERS (dinamica: con la vista vecchia la colonna non c\'e\' e lo script non compilerebbe)');
check(!/\b(UPDATE|INSERT|DELETE|MERGE)\s+(INTO\s+)?(dbo\.)?GRIPPER/i.test(code), '   sola lettura: nessuna scrittura su GRIPPER');
check(/7\/10/.test(testa) && /consegna 34/i.test(testa) && /HAS_HOOK/.test(testa) && /sqlcmd -S \.\\SQLEXPRESS -E -d ADMG -W -i gripper-has-hook\.sql/.test(testa) && /ROLLBACK/.test(testa),
	'intestazione: perche\' (7/10, consegna 34), comando, rollback');

console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
