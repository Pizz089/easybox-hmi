// ============================================================================
// test_man_order_mc1.js — vista MAN_ORDER_MC1: l'ordine di MC1 del pezzo di
// una tasca, per il deposito manuale in MC1 (scripts/man-order-mc1.sql, 6/10;
// regola nuova il 7/10, consegna 33)
//
// Si controlla sul TESTO dello script (come test_extract_coords_workobject.js)
// che la vista resti com'e' stata pensata:
//   1. un ordine per tasca: cross apply con top 1, prima l'ordine avviato
//      (order by case when w.STATUS = 3 then 0 else 1 end), poi il piu'
//      recente (w.ID desc);
//   2. solo ordini di MC1: avviato e NON completo (STATUS = 3 and PRODUCTED <
//      QUANTITY, la regola di FB204 per l'ordine attivo) oppure in coda o in
//      pausa (STATUS in (4, 6));
//   3. TRAY passa da CASE WHEN p.PARENT LIKE 'TRAY[_]%' (nessuna conversione
//      valutata su righe che non sono di cassetto); colonne invariate;
//   4. niente TRY_CAST / TRY_CONVERT (livello di compatibilita' 100);
//   5. la vista legge da WORKORDERS, la stessa del pannello;
//   6. file solo ASCII, e nessun "$(" (lo lancia sqlcmd);
//   7. guardia a varianti: assente -> CREATE della 7/10; 6/10 -> ALTER alla
//      7/10 ("aggiornata"); 7/10 -> "conforme"; altro -> FERMO;
//   8. verifica finale in sola lettura (ordini 3/4/6, tasche dell'8, ordini
//      avviati ma completi) e intestazione (perche', comando, rollback).
// Nessun DB: solo lettura del file. Sul clone del portatile il 7/10: prima
// esecuzione "aggiornata dalla 6/10 alla 7/10", seconda "conforme".
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
const testa = raw.split('\n').filter(r => r.trim().startsWith('--')).join('\n');

// i testi delle viste: le stringhe N'...' assegnate a @v (7/10) e @v6 (6/10)
const leggi = nome => { const m = code.match(new RegExp('DECLARE ' + nome + " nvarchar\\(max\\) = N'((?:[^']|'')*)';")); return m ? m[1].replace(/''/g, "'") : ''; };
const v = leggi('@v'), v6 = leggi('@v6');
check(v.length > 0 && v6.length > 0, 'trovati i testi delle due versioni: @v (7/10, ' + v.length + ' caratteri) e @v6 (6/10, ' + v6.length + ')');

console.log('\n1) un ordine per tasca: prima l\'avviato, poi il piu\' recente');
check(/cross apply\s*\(\s*select top 1\b[\s\S]*?\border by case when w\.STATUS = 3 then 0 else 1 end, w\.ID desc\s*\)\s*o\b/i.test(v),
	'cross apply (select top 1 ... order by case when w.STATUS = 3 then 0 else 1 end, w.ID desc) o');
check((v.match(/\btop\b/gi) || []).length === 1 && (v.match(/\border by\b/gi) || []).length === 1, '   un solo top e un solo order by nella vista');

console.log('\n2) solo ordini di MC1: avviato e non completo, oppure in coda o in pausa');
check(/\bw\.MACHINE_ID = 1\b/.test(v), 'w.MACHINE_ID = 1');
check(/and \(\(w\.STATUS = 3 and w\.PRODUCTED < w\.QUANTITY\) or w\.STATUS in \(4, 6\)\)/.test(v),
	'(w.STATUS = 3 and w.PRODUCTED < w.QUANTITY) or w.STATUS in (4, 6): avviato NON completo (regola di FB204), 4 e 6 ancora presenti');
check(!/w\.STATUS in \([^)]*\b(3|5|7)\b/.test(v) && !/w\.PRODUCTED <= w\.QUANTITY/.test(v), '   niente ordini finiti o abortiti, niente avviati gia\' completi');
check(/\bw\.PIECE_ID = p\.Part_Type\b/.test(v), '   stesso pezzo della tasca: w.PIECE_ID = p.Part_Type');

console.log('\n3) TRAY dal CASE sulle righe di cassetto, colonne invariate');
check(/^select\s+CASE WHEN p\.PARENT LIKE 'TRAY\[_\]%' THEN LTRIM\(RTRIM\(SUBSTRING\(p\.PARENT,6,10\)\)\) END AS TRAY,/.test(v), "TRAY = CASE WHEN p.PARENT LIKE 'TRAY[_]%' THEN ... END");
check(/\bwhere p\.PARENT like 'TRAY\[_\]%'\s*$/.test(v), "   e la vista tiene solo le righe 'TRAY_n'");
check(!/\bCAST\s*\(|\bCONVERT\s*\(/i.test(v), '   nessuna conversione nella vista (TRAY resta testo, come nella 4Robot)');
const colonne = t => ((t.match(/^select([\s\S]*?)\bfrom \[POSITION\]/) || [])[1] || '').replace(/\s+/g, ' ').trim();
check(colonne(v) === colonne(v6) && /AS TRAY, p\.SUB_POS, p\.Part_Type AS PIECE_ID, o\.ORDER_ID$/.test(colonne(v)), '   stesse colonne della 6/10 (TRAY, SUB_POS, PIECE_ID, ORDER_ID): il PLC legge solo ORDER_ID');

console.log('\n4) niente TRY_CAST / TRY_CONVERT');
check(!/\bTRY_CAST\b|\bTRY_CONVERT\b/i.test(code), 'nel codice (fuori dai commenti) nessun TRY_CAST ne\' TRY_CONVERT');

console.log('\n5) la vista legge da WORKORDERS');
check(/\bfrom WORKORDERS w\b/.test(v), 'from WORKORDERS w');
check(!/\bWORKORDER\b/i.test(v), '   e non dalla tabella WORKORDER');

console.log('\n6) ASCII, niente variabili sqlcmd');
check(!buf.some(b => b > 127), 'file solo ASCII');
check(!raw.includes('$('), 'nessun "$(" nel file');

console.log('\n7) guardia a varianti');
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
check(/UPDATE @t SET txt = SUBSTRING\(txt, CHARINDEX\(N'select CASE WHEN', txt\), LEN\(txt\)\)/.test(code), 'la guardia confronta dal primo "select CASE WHEN" in poi, come rifatto qui');
// la 6/10 riconosciuta: e' il testo della vista creata dallo script del 6/10
check(/w\.STATUS in \(4, 6\)\s+order by w\.ID desc\) o/.test(v6) && !/STATUS = 3/.test(v6), '@v6 e\' la regola del 6/10 (solo 4 e 6, il piu\' recente)');
const def6 = 'CREATE VIEW dbo.MAN_ORDER_MC1 AS ' + v6, def7 = 'CREATE VIEW dbo.MAN_ORDER_MC1 AS ' + v;
check(norm(def6) === norm(v6) && norm(def6) !== norm(v), '   la vista 6/10 come la conserva SQL Server si riconosce come 6/10 (e non come 7/10)');
check(norm(def7) === norm(v), '   alla seconda esecuzione la 7/10 risulta "conforme"');
const istr = code.split('\n').filter(r => !/^\s*PRINT\b/i.test(r)).join('\n');
check((istr.match(/CREATE VIEW/gi) || []).length === 1 && (istr.match(/ALTER VIEW/gi) || []).length === 1 && !/DROP VIEW/i.test(istr),
	'   un CREATE VIEW e un ALTER VIEW fra le istruzioni, nessun DROP VIEW');
check(/IF @def IS NULL AND OBJECT_ID\('dbo\.MAN_ORDER_MC1'\) IS NULL\s+BEGIN\s+EXEC \(N'CREATE VIEW dbo\.MAN_ORDER_MC1 AS ' \+ @v\);/.test(code), '   vista assente -> CREATE della 7/10');
check(/ELSE IF @nDef = @nV\s+PRINT 'MAN_ORDER_MC1: gia'' presente e conforme/.test(code), '   7/10 -> "conforme", nessuna modifica');
check(/ELSE IF @nDef = @nV6\s+BEGIN\s+EXEC \(N'ALTER VIEW dbo\.MAN_ORDER_MC1 AS ' \+ @v\);[\s\S]*?IF @dopo = @nV\s+PRINT 'MAN_ORDER_MC1: aggiornata dalla 6\/10 alla 7\/10/.test(code),
	'   6/10 -> ALTER alla 7/10, riletta, "aggiornata"');
check(/ELSE\s+BEGIN\s+PRINT 'FERMO: MAN_ORDER_MC1 esiste ma non e'' ne'' la 6\/10 ne'' la 7\/10\. Nessuna modifica\. Definizione trovata:';\s+SELECT @def AS definizione_trovata;/.test(code),
	'   altra versione -> FERMO, stampa la definizione trovata');

console.log('\n8) verifica finale e intestazione');
check(/SELECT ID, PIECE_ID, STATUS, PRODUCTED, QUANTITY FROM WORKORDERS WHERE MACHINE_ID = 1 AND STATUS IN \(3, 4, 6\)/.test(code), 'ordini di MC1 con STATUS 3, 4, 6 e PRODUCTED / QUANTITY');
check(/SELECT TOP 5 TRAY, SUB_POS, PIECE_ID, ORDER_ID FROM dbo\.MAN_ORDER_MC1 WHERE TRAY = '8'/.test(code), 'le prime tasche del cassetto 8 col loro ORDER_ID');
check(/COUNT\(\*\) FROM WORKORDERS WHERE STATUS = 3 AND PRODUCTED >= QUANTITY/.test(code) && /ATTENZIONE: ci sono ordini STATUS 3 gia'' completi/.test(code), 'conteggio degli avviati gia\' completi (atteso 0), e se non e\' 0 li elenca');
check(!/\b(UPDATE|INSERT|DELETE|MERGE)\s+(WORKORDER|WORKORDERS|\[?POSITION)/i.test(code), '   sola lettura: nessuna scrittura sui dati');
check(/CONSEGNA 33/.test(testa) && /problema 3/.test(testa) && /PRIMA del download della consegna 33/.test(testa), 'intestazione: perche\' (problema 3, consegna 33) e comando prima del download');
check(/la versione 6\/10 si rimette SOLO insieme al PLC di prima/.test(testa) && /da' 970/.test(testa), '   rollback: la 6/10 solo col PLC di prima (col PLC 33 un deposito con ordine avviato darebbe 970)');

console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
