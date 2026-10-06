// ============================================================================
// test_man_order_mc1.js — vista MAN_ORDER_MC1: l'ordine IN ATTESA del pezzo
// di una tasca, per il deposito manuale in MC1 (scripts/man-order-mc1.sql,
// 6/10)
//
// Lo script lo ha scritto Dario e si versiona byte per byte: qui si controlla
// sul TESTO (come test_extract_coords_workobject.js) che la vista resti com'e'
// stata pensata:
//   1. un ordine per tasca: cross apply con top 1 ... order by w.ID desc
//      (il piu' recente);
//   2. solo ordini di MC1 in attesa: w.MACHINE_ID = 1 e w.STATUS in (4, 6)
//      (4 RAW, in coda; 6 PAUSED);
//   3. TRAY passa da CASE WHEN p.PARENT LIKE 'TRAY[_]%' (nessuna conversione
//      valutata su righe che non sono di cassetto);
//   4. niente TRY_CAST / TRY_CONVERT (il DB della cella ha livello di
//      compatibilita' 100);
//   5. la vista legge da WORKORDERS, la stessa del pannello;
//   6. file solo ASCII, e nessun "$(" (lo lancia sqlcmd, che sostituirebbe
//      le variabili anche nei commenti);
//   7. il testo della vista dentro @v e' quello che finisce nel CREATE VIEW,
//      e alla seconda esecuzione la guardia lo trova "conforme".
// Nessun DB: solo lettura del file.
//
// Uso:   node test_man_order_mc1.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
const fs = require('fs');
const path = require('path');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const file = path.join(__dirname, 'scripts', 'man-order-mc1.sql');
const buf = fs.readFileSync(file);
const raw = buf.toString('utf8').replace(/\r\n/g, '\n');
// codice senza i commenti di riga (l'intestazione nomina TRY_CAST per dire
// che non si usa)
const code = raw.split('\n').filter(r => !r.trim().startsWith('--')).join('\n');

// il testo della vista: la stringa N'...' assegnata a @v, con '' -> '
const mV = code.match(/DECLARE @v nvarchar\(max\) = N'((?:[^']|'')*)';/);
const v = mV ? mV[1].replace(/''/g, "'") : '';
check(v.length > 0, 'trovato il testo della vista in @v (' + v.length + ' caratteri)');

console.log('\n1) un ordine per tasca, il piu\' recente');
check(/cross apply\s*\(\s*select top 1\b[\s\S]*?\border by w\.ID desc\s*\)\s*o\b/i.test(v), 'cross apply (select top 1 ... order by w.ID desc) o');
check((v.match(/\btop\b/gi) || []).length === 1 && (v.match(/\border by\b/gi) || []).length === 1, '   un solo top e un solo order by nella vista');

console.log('\n2) solo ordini di MC1 in attesa');
check(/\bw\.MACHINE_ID = 1\b/.test(v), 'w.MACHINE_ID = 1');
check(/\bw\.STATUS in \(4, 6\)/.test(v), 'w.STATUS in (4, 6)');
check(/\bw\.PIECE_ID = p\.Part_Type\b/.test(v), '   stesso pezzo della tasca: w.PIECE_ID = p.Part_Type');

console.log('\n3) TRAY dal CASE sulle righe di cassetto');
check(/^select\s+CASE WHEN p\.PARENT LIKE 'TRAY\[_\]%' THEN LTRIM\(RTRIM\(SUBSTRING\(p\.PARENT,6,10\)\)\) END AS TRAY,/.test(v), "TRAY = CASE WHEN p.PARENT LIKE 'TRAY[_]%' THEN ... END");
check(/\bwhere p\.PARENT like 'TRAY\[_\]%'\s*$/.test(v), "   e la vista tiene solo le righe 'TRAY_n'");
check(!/\bCAST\s*\(|\bCONVERT\s*\(/i.test(v), '   nessuna conversione nella vista (TRAY resta testo, come nella 4Robot)');

console.log('\n4) niente TRY_CAST / TRY_CONVERT');
check(!/\bTRY_CAST\b|\bTRY_CONVERT\b/i.test(code), 'nel codice (fuori dai commenti) nessun TRY_CAST ne\' TRY_CONVERT');

console.log('\n5) la vista legge da WORKORDERS');
check(/\bfrom WORKORDERS w\b/.test(v), 'from WORKORDERS w');
check(!/\bWORKORDER\b/i.test(v), '   e non dalla tabella WORKORDER');

console.log('\n6) ASCII, niente variabili sqlcmd');
check(!buf.some(b => b > 127), 'file solo ASCII');
check(!raw.includes('$('), 'nessun "$(" nel file');

console.log('\n7) @v e CREATE VIEW coincidono');
// le istruzioni, senza i messaggi (PRINT 'FERMO: CREATE VIEW non riuscita')
const istruzioni = code.split('\n').filter(r => !/^\s*PRINT\b/i.test(r)).join('\n');
check((istruzioni.match(/CREATE VIEW/gi) || []).length === 1 && !/ALTER VIEW|DROP VIEW/i.test(istruzioni), 'un solo CREATE VIEW fra le istruzioni, nessun ALTER VIEW o DROP VIEW');
check(/EXEC \(N'CREATE VIEW dbo\.MAN_ORDER_MC1 AS ' \+ @v\);/.test(code), "   ed e' EXEC (N'CREATE VIEW dbo.MAN_ORDER_MC1 AS ' + @v): la vista e' @v, senza altro testo");
// la guardia, rifatta qui: spazi normalizzati, ';' finale tolto, dal primo
// "select CASE WHEN" in poi (CHARINDEX, collation CI)
const norm = t => {
	let s = t.replace(/[\r\n\t]/g, ' ');
	while (s.includes('  ')) s = s.replace(/  /g, ' ');
	s = s.trim();
	if (s.endsWith(';')) s = s.slice(0, -1).trimEnd();
	const i = s.toLowerCase().indexOf('select case when');
	return i >= 0 ? s.slice(i) : s;
};
const definizione = 'CREATE VIEW dbo.MAN_ORDER_MC1 AS ' + v;   // cosa SQL Server conserva
check(norm(definizione) === norm(v) && norm(v).startsWith('select CASE WHEN'), "   alla seconda esecuzione la guardia la trova uguale (\"conforme\", nessuna modifica)");
check(/UPDATE @t SET txt = SUBSTRING\(txt, CHARINDEX\(N'select CASE WHEN', txt\), LEN\(txt\)\)/.test(code), "   la guardia confronta dal primo \"select CASE WHEN\" in poi, come rifatto qui");

console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
