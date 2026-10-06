// ============================================================================
// test_z_push_sql.js — quota Z della spinta (6/10), lato SQL, sul TESTO degli
// script (nessun DB):
//   1. coordinates-z-mc.sql: la vista COORDINATES_Z_MC versionata. Il pezzo
//      entra nel deposito del grezzo con PIECE.Z_PICK; la guardia confronta
//      il CODICE (commenti tolti, spazi normalizzati) e in cella e' un no-op:
//      i commenti della vista in cella hanno trattini lunghi, anche rovinati
//      da sqlcmd ("â€”"), e non devono contare;
//   2. piece-on-vice-z-push.sql: colonna Z_PUSH int NULL con CHECK >= 0,
//      idempotente, nessuna scrittura sui dati;
//   3. coordinates-push-mc.sql: le tre colonne Z_PUSH, Z_PUSH_REF,
//      Z_PUSH_DROP; Z_PUSH_DROP mai NULL con la formula decisa; guardia a
//      cinque varianti (nuova -> conforme; Z_PUSH_DROP diversa -> FERMO; le
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
const mV = codice(zRaw).match(/DECLARE @v nvarchar\(max\) = N'((?:[^']|'')*)';/);
const v = mV ? mV[1].replace(/''/g, "'") : '';
check(/p\.Z \+ pz\.Z_PICK\s+\+ f\.Z\s+\+ ISNULL\(v\.Z_CLAW, 0\) - ISNULL\(v\.Z_SINK_CLAW, 0\)\s+as Z_PLACE_MC/.test(v),
	'Z_PLACE_MC (deposito del grezzo) = P.Z + PIECE.Z_PICK + FIXTURE.Z + Z_CLAW - Z_SINK_CLAW');
check(/p\.Z \+ pz\.Z_PLACE \+ f\.Z\s+\+ ISNULL\(v\.Z_CLAW, 0\) - ISNULL\(v\.Z_SINK_CLAW, 0\)\s+as Z_PICK_MC/.test(v), '   Z_PICK_MC (prelievo del finito) con PIECE.Z_PLACE');
check(/WHILE CHARINDEX\(N'--', @a\) > 0/.test(zRaw) && /WHILE CHARINDEX\(N'--', @b\) > 0/.test(zRaw) && /ELSE IF @a = @b/.test(zRaw),
	'la guardia toglie i commenti "--" da entrambe le definizioni e confronta il codice');
// le istruzioni, senza i messaggi (PRINT 'FERMO: CREATE VIEW non riuscita')
const zIstr = codice(zRaw).split('\n').filter(r => !/^\s*PRINT\b/.test(r)).join('\n');
check(/IF @def IS NULL AND OBJECT_ID\('dbo\.COORDINATES_Z_MC'\) IS NULL/.test(zRaw) && (zIstr.match(/CREATE VIEW/g) || []).length === 1
	&& !/\bALTER VIEW\b|\bDROP VIEW\b/.test(zIstr),
	'   crea solo se manca; mai ALTER ne\' DROP: una vista diversa la lascia stare (FERMO)');
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
check(/AND @norm LIKE N'%when pv\.Z_PUSH > pz\.Z_PICK then 0 else pz\.Z_PICK - pv\.Z_PUSH end as Z_PUSH_DROP%'\nBEGIN\n\tPRINT 'coordinates-push-mc: conforme[^\n]*\n\tSET NOEXEC ON;/.test(guard),
	'guardia: la variante nuova (con la formula di Z_PUSH_DROP) -> "conforme", esce');
check(/ELSE IF @norm LIKE N'%as Z_PUSH_DROP%'\nBEGIN\n\tPRINT '[^\n]*FERMO\.';[\s\S]*?SET NOEXEC ON;/.test(guard), '   Z_PUSH_DROP presente ma diversa -> FERMO, non sovrascrive');
check(/variante completa della compensazione[^\n]*aggiungo Z_PUSH/.test(guard) && /segno giusto ma MANCA il ramo NO_COMP/.test(guard)
	&& /variante col PIU''/.test(guard) && /versione senza compensazione/.test(guard), '   le quattro varianti della compensazione -> ALTER alla definizione completa');
check((guard.match(/SET NOEXEC ON/g) || []).length === 3 && /nessuna delle cinque varianti note\. FERMO/.test(guard), '   esce solo su conforme, Z_PUSH_DROP diversa e variante sconosciuta');
check(!/Durante la spinta Y e Z restano quelle del deposito/.test(pRaw) && /La Z \(6\/10\) scende di\n-- Z_PUSH_DROP sotto la Z di deposito/.test(pRaw),
	'intestazione: la Z non resta piu\' quella del deposito, scende di Z_PUSH_DROP');

console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
