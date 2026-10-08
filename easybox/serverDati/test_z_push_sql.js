// ============================================================================
// test_z_push_sql.js — quota Z della spinta (6/10), lato SQL, sul TESTO degli
// script (nessun DB):
//   1. coordinates-z-mc.sql: la vista COORDINATES_Z_MC versionata. Il pezzo
//      entra nel deposito del grezzo con PIECE.Z_PICK; la guardia confronta
//      il CODICE (commenti tolti, spazi normalizzati): i commenti della vista
//      in cella hanno trattini lunghi, anche rovinati da sqlcmd ("â€”"), e
//      non devono contare. (7/10) Due versioni note: quella del 6/10 si porta
//      alla nuova (chele dal catalogo, blocco chele), la nuova e' "conforme",
//      altro FERMO. (8/10, prompt 8) Il blocco chele esce dalla vista (tre
//      query del PLC prendono «l'ordine piu' recente» e con la riga nascosta
//      avrebbero le quote di un altro ordine): tre versioni note (6/10, 7/10
//      col blocco, 8/10), l'ALTER solo a migrazione avvenuta e la vista
//      RILETTA dopo l'ALTER;
//   2. piece-on-vice-z-push.sql: colonna Z_PUSH int NULL con CHECK >= 0,
//      idempotente, nessuna scrittura sui dati;
//   3. coordinates-push-mc.sql: le tre colonne Z_PUSH, Z_PUSH_REF,
//      Z_PUSH_DROP; Z_PUSH_DROP mai NULL con la formula decisa; guardia a
//      sette varianti (nuova -> conforme; 7/10 col riferimento a lunghezza ->
//      ALTER; catalogo diverso o Z_PUSH_DROP diversa -> FERMO; 6/10 e le
//      quattro della compensazione -> ALTER); prerequisito sulla colonna.
// Prove sul clone del portatile (6/10): nel report e in APPUNTI-CELLA.
//
// Uso:   node test_z_push_sql.js
// ============================================================================
const fs = require('fs');
const path = require('path');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const leggi = f => fs.readFileSync(path.join(__dirname, 'scripts', f), 'utf8').replace(/\r\n/g, '\n');
const codice = t => t.split('\n').filter(r => !r.trim().startsWith('--')).join('\n');

// la normalizzazione della guardia di coordinates-z-mc.sql, rifatta qui
function norm(t) {
	while (t.includes('--')) { const i = t.indexOf('--'); const j = t.indexOf('\n', i); t = t.slice(0, i) + (j < 0 ? '' : t.slice(j)); }
	t = t.replace(/[\r\n\t]/g, ' ');
	while (t.includes('  ')) t = t.replace(/  /g, ' ');
	t = t.trim();
	if (t.endsWith(';')) t = t.slice(0, -1).trimEnd();
	const i = t.toLowerCase().indexOf('select ');
	return i >= 0 ? t.slice(i) : t;
}

console.log('1) coordinates-z-mc.sql');
const zRaw = leggi('coordinates-z-mc.sql');
const zBuf = fs.readFileSync(path.join(__dirname, 'scripts', 'coordinates-z-mc.sql'));
check(!zBuf.some(b => b > 127) && !zRaw.includes('$('), 'file solo ASCII e nessun "$(" (lo lancia sqlcmd)');
const mV = codice(zRaw).match(/DECLARE @nuova nvarchar\(max\) = N'((?:[^']|'')*)';/);
const v = mV ? mV[1].replace(/''/g, "'") : '';
const mO = codice(zRaw).match(/DECLARE @vecchia nvarchar\(max\) = N'((?:[^']|'')*)';/);
const vOld = mO ? mO[1].replace(/''/g, "'") : '';
check(/p\.Z \+ pz\.Z_PICK\s+\+ f\.Z\s+\+ ISNULL\(j\.Z_CLAW, 0\) - ISNULL\(j\.Z_SINK_CLAW, 0\)\s+as Z_PLACE_MC/.test(v),
	'Z_PLACE_MC (deposito del grezzo) = P.Z + PIECE.Z_PICK + FIXTURE.Z + Z_CLAW - Z_SINK_CLAW, chela dal tipo montato (7/10)');
check(/p\.Z \+ pz\.Z_PLACE \+ f\.Z\s+\+ ISNULL\(j\.Z_CLAW, 0\) - ISNULL\(j\.Z_SINK_CLAW, 0\)\s+as Z_PICK_MC/.test(v), '   Z_PICK_MC (prelievo del finito) con PIECE.Z_PLACE');
check(/left  join VICE_JAW j   on j\.ID = v\.JAW_ID;$/.test(v.trim()) && !/\bwhere\b/i.test(v) && !/w\.JAW_ID/.test(v),
	'   (8/10) misure dal catalogo, NESSUN blocco chele: la vista non nasconde righe (il controllo e\' al Play, nel backend)');
const mI = codice(zRaw).match(/DECLARE @intermedia nvarchar\(max\) = N'((?:[^']|'')*)';/);
const vMid = mI ? mI[1].replace(/''/g, "'") : '';
check(/where w\.JAW_ID is null or w\.JAW_ID = v\.JAW_ID;?$/.test(vMid.trim()), '   la versione del 7/10 (col blocco, mai andata in cella) e\' tenuta nello script, per riconoscerla');
check(/ISNULL\(v\.Z_CLAW, 0\) - ISNULL\(v\.Z_SINK_CLAW, 0\)\s+as Z_PLACE_MC/.test(vOld) && !/JAW/.test(vOld), '   la versione del 6/10 e\' tenuta nello script, per riconoscerla');
check(/CREATE PROCEDURE #codice_vista/.test(zRaw) && /WHILE CHARINDEX\(N'--', @s\) > 0/.test(zRaw) && /ELSE IF @a = @n/.test(zRaw) && /ELSE IF @a = @o OR @a = @m/.test(zRaw)
	&& (zRaw.match(/EXEC #codice_vista @(def|vecchia|intermedia|nuova), @[aomn] OUTPUT;/g) || []).length === 4,
	'la guardia toglie i commenti "--" dalle quattro definizioni (trovata, 6/10, 7/10, 8/10) e confronta il codice');
// le istruzioni, senza i messaggi (PRINT 'FERMO: CREATE VIEW non riuscita')
const zIstr = codice(zRaw).split('\n').filter(r => !/^\s*PRINT\b/.test(r)).join('\n');
check(/IF @def IS NULL AND OBJECT_ID\('dbo\.COORDINATES_Z_MC'\) IS NULL/.test(zRaw) && (zIstr.match(/CREATE VIEW/g) || []).length === 1
	&& (zIstr.match(/ALTER VIEW/g) || []).length === 1 && /ELSE IF @a = @o OR @a = @m\nBEGIN[\s\S]*?SELECT @def AS definizione_trovata;[\s\S]*?EXEC \(N'ALTER VIEW/.test(zIstr) && !/\bDROP VIEW\b/.test(zIstr),
	'   crea se manca, ALTER solo dalle versioni del 6/10 e del 7/10 (stampata prima), mai DROP: una vista diversa la lascia stare (FERMO)');
// (8/10, prompt 8) a migrazione non avvenuta (una morsa con misure e senza
// tipo) ne' CREATE ne' ALTER: la vista leggerebbe misure che non ci sono
check(/DECLARE @migrata bit = CASE WHEN EXISTS \(SELECT 1 FROM dbo\.VICE WHERE JAW_ID IS NULL\s+AND \(CLAW_LENGTH IS NOT NULL OR Z_CLAW IS NOT NULL OR Z_SINK_CLAW IS NOT NULL\)\) THEN 0 ELSE 1 END;/.test(zRaw)
	&& (zRaw.match(/IF @migrata = 0\s+PRINT 'FERMO: la migrazione di vice-jaw\.sql non e'' avvenuta/g) || []).length === 2,
	'   FERMO se la migrazione non e\' avvenuta, sia prima del CREATE sia prima dell\'ALTER');
check(/INSERT INTO #attesa VALUES \(@n\);/.test(zRaw) && /EXEC #codice_vista @letta, @dopo OUTPUT;\s*IF @dopo = @attesa\s+PRINT 'COORDINATES_Z_MC: riletta/.test(zRaw)
	&& /PRINT 'FERMO: COORDINATES_Z_MC riletta NON e'' la versione dell''8\/10/.test(zRaw),
	'   dopo l\'ALTER la vista si RILEGGE (OBJECT_DEFINITION): FERMO se non e\' la definizione nuova');
// la vista in cella: stesso codice, commenti coi trattini lunghi (anche
// rovinati da sqlcmd senza -f 65001)
const cella = 'CREATE VIEW dbo.COORDINATES_Z_MC AS\n' + v.replace(/ - il 10/, ' — il 10').replace(/TRE posti/, 'TRE posti â€”');
check(cella !== v && norm(cella) === norm(v), 'la definizione di cella (CREATE VIEW, commenti diversi) risulta "conforme": in cella e\' un no-op');
check(norm(v.replace('pz.Z_PICK  + f.Z', 'pz.Z_PLACE + f.Z')) !== norm(v), '   e una differenza nel CODICE no (FERMO)');

console.log('\n2) piece-on-vice-z-push.sql');
const cRaw = leggi('piece-on-vice-z-push.sql');
const c = codice(cRaw);
check(/ALTER TABLE dbo\.PIECE_ON_VICE ADD Z_PUSH int NULL;/.test(c), 'Z_PUSH int NULL (micron, NULL = alla quota di presa)');
check(/ADD CONSTRAINT CK_PIECE_ON_VICE_Z_PUSH CHECK \(Z_PUSH >= 0\)/.test(c), '   vincolo CHECK (Z_PUSH >= 0)');
check(/IF COL_LENGTH\('dbo\.PIECE_ON_VICE', 'Z_PUSH'\) IS NULL/.test(c) && /t\.name = 'int' AND c\.is_nullable = 1/.test(c) && /FERMO: PIECE_ON_VICE\.Z_PUSH esiste ma non e'' int NULL/.test(c),
	'   idempotente: aggiunge solo se manca; se c\'e\' ma non e\' int NULL, FERMO');
check(!/\b(UPDATE|INSERT|MERGE|DELETE)\b|DROP (COLUMN|CONSTRAINT)/i.test(c.replace(/^\s*PRINT[^\n]*$/gm, '')), '   nessuna scrittura sui dati, niente DROP (il rollback sta nei commenti)');
check(!fs.readFileSync(path.join(__dirname, 'scripts', 'piece-on-vice-z-push.sql')).some(b => b > 127) && !cRaw.includes('$('), '   solo ASCII, nessun "$("');

console.log('\n3) coordinates-push-mc.sql: quota Z della spinta');
const pRaw = leggi('coordinates-push-mc.sql');
const p = codice(pRaw).replace(/\s+/g, ' ');
check(/q\.PUSH_STATUS, q\.Z_PUSH, q\.Z_PUSH_REF, q\.Z_PUSH_DROP from \(/.test(p), 'tre colonne in fondo alla vista: Z_PUSH, Z_PUSH_REF, Z_PUSH_DROP');
check(/pv\.Z_PUSH as Z_PUSH, ISNULL\(pz\.Z_PICK, 0\) as Z_PUSH_REF,/.test(p), '   Z_PUSH grezza (anche NULL, per il pannello), Z_PUSH_REF = ISNULL(Z_PICK, 0)');
check(/case when pv\.Z_PUSH is null then 0 when ISNULL\(pz\.Z_PICK, 0\) <= 0 then 0 when pv\.Z_PUSH > pz\.Z_PICK then 0 else pz\.Z_PICK - pv\.Z_PUSH end as Z_PUSH_DROP/.test(p),
	'   Z_PUSH_DROP: vuota, quota di presa assente o fuori campo -> 0, altrimenti Z_PICK - Z_PUSH (mai NULL)');
const drop = p.match(/case when pv\.Z_PUSH is null[\s\S]*?as Z_PUSH_DROP/);
check(!!drop && !/PUSH_STATUS/.test(drop[0]), '   e non dipende da PUSH_STATUS');
check(/OR COL_LENGTH\('dbo\.PIECE_ON_VICE', 'Z_PUSH'\) IS NULL/.test(p), 'prerequisito: la colonna PIECE_ON_VICE.Z_PUSH (piece-on-vice-z-push.sql)');
const guard = pRaw.slice(pRaw.indexOf('IF @def IS NULL'), pRaw.indexOf('IF OBJECT_ID(\'dbo.COORDINATES_PUSH_MC\') IS NULL'));
check(/AND @norm LIKE N'%when pv\.Z_PUSH > pz\.Z_PICK then 0 else pz\.Z_PICK - pv\.Z_PUSH end as Z_PUSH_DROP%'\n\t AND @norm LIKE N'%left join VICE_JAW j on j\.ID = v\.JAW_ID%'\n\t AND @norm LIKE N'%left join VICE_JAW jr on jr\.ID = pv\.CLAW_JAW_REF%'\n[^\n]*\nBEGIN\n\tPRINT 'coordinates-push-mc: conforme[^\n]*\n\tSET NOEXEC ON;/.test(guard),
	'guardia: la variante nuova (Z_PUSH_DROP, catalogo, battuta col tipo di riferimento) -> "conforme", esce');
check(/variante del 7\/10 \(riferimento della battuta = lunghezza salvata\): la porto al tipo di riferimento/.test(guard), '   (8/10) la variante del 7/10 (mai andata in cella) si porta al tipo di riferimento');
check(/variante del 6\/10 \(quota Z della spinta\): la porto alle chele dal catalogo/.test(guard), '   la variante del 6/10 si porta alle chele dal catalogo');
check(/ELSE IF @norm LIKE N'%as Z_PUSH_DROP%'\nBEGIN\n\tPRINT '[^\n]*FERMO\.';[\s\S]*?SET NOEXEC ON;/.test(guard), '   Z_PUSH_DROP presente ma diversa -> FERMO, non sovrascrive');
check(/variante completa della compensazione[^\n]*aggiungo Z_PUSH/.test(guard) && /segno giusto ma MANCA il ramo NO_COMP/.test(guard)
	&& /variante col PIU''/.test(guard) && /versione senza compensazione/.test(guard), '   le quattro varianti della compensazione -> ALTER alla definizione completa');
check((guard.match(/SET NOEXEC ON/g) || []).length === 4 && /nessuna delle sette varianti note\. FERMO/.test(guard), '   esce solo su conforme, catalogo diverso, Z_PUSH_DROP diversa e variante sconosciuta');
check(/PRINT 'coordinates-push-mc: riletta, e'' la versione dell''8\/10/.test(pRaw) && /PRINT 'FERMO: coordinates-push-mc: la vista riletta NON e'' la versione dell''8\/10/.test(pRaw),
	'   (8/10) dopo l\'ALTER la vista si RILEGGE: FERMO se non e\' la definizione nuova');
check(!/Durante la spinta Y e Z restano quelle del deposito/.test(pRaw) && /La Z \(6\/10\) scende di\n-- Z_PUSH_DROP sotto la Z di deposito/.test(pRaw),
	'intestazione: la Z non resta piu\' quella del deposito, scende di Z_PUSH_DROP');

console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
