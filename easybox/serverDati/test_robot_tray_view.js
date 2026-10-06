// ============================================================================
// test_robot_tray_view.js — vista COORDINATES_PIECES_TRAYS_4Robot v4 (6/10)
//
// Work object per cassetto: le quote delle tasche diventano RELATIVE AL
// CASSETTO, senza le correzioni del piano (TRAY.X/Y/Z_CORR). Sul TESTO degli
// script (come test_push_to_stop.js per le viste macchina):
//   1. v4: nessun t.X_CORR / t.Y_CORR / t.Z_CORR, ISNULL su ogni correzione,
//      le formule decise, stesse colonne della v3 (nomi e ordine), nessun
//      WITH ENCRYPTION, join su tray invariato;
//   2. guardia: la v3 e la v4 che confronta sono davvero quelle (la v3 dello
//      script vecchio, la v4 dell'ALTER), tre esiti, RAISERROR prima di NOEXEC;
//   3. gli script superati (v3, v2) sono INERTI in ogni caso;
//   4. nessun altro script attivo tocca la vista.
// Nessun DB: solo lettura dei file.
//
// Uso:   node test_robot_tray_view.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
const fs = require('fs');
const path = require('path');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const DIR = path.join(__dirname, 'scripts');
const leggi = f => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
// codice senza commenti di riga (i commenti PARLANO di t.X_CORR e di
// WITH ENCRYPTION per dire che non ci sono)
const codice = s => s.split('\n').filter(r => !r.trim().startsWith('--')).join('\n');
// stessa normalizzazione della guardia SQL: spazi bianchi -> uno, via il ';'
// finale, dalla "select" in poi
const norm = s => {
	let t = s.replace(/[\r\n\t]/g, ' ').replace(/ {2,}/g, ' ').trim();
	if (t.endsWith(';')) t = t.slice(0, -1).trimEnd();
	const i = t.toLowerCase().indexOf('select pt.id as partType'.toLowerCase());
	return i >= 0 ? t.slice(i) : '';
};
// colonne di una select: alias dopo " as ", altrimenti il nome dopo l'ultimo "."
function colonne(corpo) {
	const n = norm(corpo);
	const lista = n.slice('select '.length, n.toLowerCase().indexOf(' from [position]'));
	const out = []; let liv = 0, cur = '';
	for (const ch of lista) {
		if (ch === '(') liv++;
		if (ch === ')') liv--;
		if (ch === ',' && liv === 0) { out.push(cur); cur = ''; } else cur += ch;
	}
	out.push(cur);
	return out.map(x => x.trim()).map(x => { const m = x.match(/\sas\s+(\w+)$/i); return (m ? m[1] : x.split('.').pop()).toUpperCase(); });
}

const v4 = leggi('robot-tray-view-v4.sql');
const v4code = codice(v4);
const corpoV4 = (v4code.match(/ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS\n([\s\S]*?)\nGO/) || [])[1] || '';
const letterale = nome => ((v4code.match(new RegExp("DECLARE @" + nome + " nvarchar\\(max\\) = N'([\\s\\S]*?)';\\n")) || [])[1] || '').replace(/''/g, "'");
const v3old = leggi('superati/robot-tray-view-v3.sql');
const corpoV3 = ((codice(v3old).match(/EXEC\(N'ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS\n([\s\S]*?)'\);/) || [])[1] || '').replace(/''/g, "'");

console.log('1) definizione v4');
check(corpoV4.length > 200 && corpoV3.length > 200, 'trovati il corpo della v4 (ALTER) e quello della v3 (script superato)');
check(!/\bt\.[XYZ]_CORR\b/i.test(corpoV4), 'nessun termine t.X_CORR / t.Y_CORR / t.Z_CORR nelle quote');
check(!/\bt\.[XYZ]_CORR\b/i.test(letterale('v4')), 'neanche nella v4 che la guardia riconosce');
const nV4 = norm(corpoV4);
const FORMULE = [
	'(pos.X+ISNULL(pos.X_CORR,0)+ISNULL(w.X_PICK_DECENTRATED_TRAY,0)) as X_PICK',
	'(pos.Y+ISNULL(pos.Y_CORR,0)+ISNULL(w.Y_PICK_DECENTRATED_TRAY,0)) as Y_PICK',
	'(ISNULL(pos.Z,0)+ISNULL(pos.Z_CORR,0)+pt.Z_PICK) as Z_PICK',
	'(pos.X+ISNULL(pos.X_CORR,0)+ISNULL(w.X_PLACE_DECENTRATED_TRAY,0)) as X_PLACE',
	'(pos.Y+ISNULL(pos.Y_CORR,0)+ISNULL(w.Y_PLACE_DECENTRATED_TRAY,0)) as Y_PLACE',
	'(ISNULL(pos.Z,0)+ISNULL(pos.Z_CORR,0)+pt.Z_Place) as Z_PLACE',
	'(pos.X_ROT+ISNULL(pos.X_ROT_CORR,0)) as X_ROT',
	'(pos.Y_ROT+ISNULL(pos.Y_ROT_CORR,0)) as Y_ROT',
	'(pos.Z_ROT+ISNULL(pos.Z_ROT_CORR,0)) as Z_ROT',
];
for (const f of FORMULE) check(nV4.includes(f), 'formula: ' + f);
// ogni correzione (della tasca e decentrati dell'ordine) dentro un ISNULL
const corr = [...nV4.matchAll(/\b(?:pos|w)\.\w*(?:_CORR|_DECENTRATED_TRAY)\b/gi)];
const nude = corr.filter(m => !/ISNULL\($/i.test(nV4.slice(0, m.index)));
check(corr.length === 13 && nude.length === 0, 'ISNULL su tutte le correzioni (' + corr.length + ' termini' + (nude.length ? ', scoperti: ' + nude.map(m => m[0]).join(' ') : '') + ')');
check(/ISNULL\(pos\.Z,0\)/.test(nV4) && !/[^(]pos\.Z\+/.test(nV4.replace(/ISNULL\(pos\.Z,0\)/g, '')), 'anche pos.Z (le tasche nuove hanno Z = 0 per convenzione)');
const colV3 = colonne(corpoV3), colV4 = colonne(corpoV4);
check(colV4.join(',') === colV3.join(','), 'stesse colonne della v3, stessi nomi e stesso ordine (' + colV4.length + ')');
const PLC = ['X_PICK', 'Y_PICK', 'Z_PICK', 'X_ROT', 'Y_ROT', 'Z_ROT', 'APPROACH_TYPE', 'APPROACH_X', 'APPROACH_Y', 'APPROACH_Z', 'TRAY', 'SUB_POS', 'STATUS', 'PARTTYPE'];
check(PLC.every(c => colV4.includes(c)), 'tutte le colonne che il PLC legge o filtra: ' + PLC.join(', '));
check(nV4.includes("inner join tray t on concat('TRAY_', t.FLOOR_MAG) = trim(pos.PARENT)") && nV4.includes("where pos.parent like 'TRAY%' and pos.pos > 0"), 'join su tray e filtro invariati (vista limitata ai piani configurati)');
// (6/10, decisione di Dario) TRAY a prova di cast: NULL sulle righe che non
// sono tasche di cassetto (EXTRACT_TRAY_n dava 'CT', e il cast del PLC
// poteva andare in errore 245). Seconda colonna, stesso nome.
const TRAY_V4 = "CASE WHEN pos.PARENT LIKE 'TRAY[_]%' THEN SUBSTRING(pos.PARENT,6,2) END AS TRAY";
const TRAY_V3 = 'SUBSTRING(pos.PARENT,6,2) As TRAY';
check(nV4.includes('select pt.id as partType, ' + TRAY_V4 + ', pos.POS as MAG,'), 'TRAY e\' esattamente ' + TRAY_V4 + ' (seconda colonna)');
check(!nV4.includes(TRAY_V3) && norm(corpoV3).includes(TRAY_V3), 'nessun SUBSTRING nudo per TRAY nella v4 (la v3 lo aveva)');
// fuori da quote (formule e ISNULL) e TRAY la v4 e' la v3 parola per parola
const senzaQuote = n => n.replace(TRAY_V4, TRAY_V3).replace(/\(.*?\) as [XYZ]_(PICK|PLACE|ROT),?/gi, '');
check(senzaQuote(nV4) === senzaQuote(norm(corpoV3)), 'il resto della select e\' identico alla v3 (salvo formule delle quote, ISNULL e TRAY)');
check(!/WITH\s+ENCRYPTION/i.test(v4code), 'nessun WITH ENCRYPTION: la vista resta in chiaro');

console.log('\n2) guardia');
check(norm(letterale('v4')) === nV4 && nV4.length > 0, 'la v4 che la guardia riconosce e\' esattamente quella dell\'ALTER');
check(norm(letterale('v3')) === norm(corpoV3) && norm(corpoV3).length > 0, 'la v3 attesa e\' esattamente quella di superati/robot-tray-view-v3.sql');
check(/OBJECT_DEFINITION\(OBJECT_ID\('COORDINATES_PIECES_TRAYS_4Robot'\)\)/.test(v4code) && /CHAR\(13\)[\s\S]{0,80}CHAR\(10\)[\s\S]{0,80}CHAR\(9\)/.test(v4code) && /WHILE EXISTS[\s\S]{0,120}N'  '/.test(v4code), 'confronto a spazi normalizzati della definizione letta');
const iAlter = v4code.search(/ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS/);
const rami = v4code.slice(v4code.indexOf('IF @def IS NULL'), iAlter);
check(/ELSE IF @nDef = @nV4\s*BEGIN[\s\S]*?conforme[\s\S]*?SET NOEXEC ON;\s*END/.test(rami), 'gia\' v4: "conforme", nessuna modifica');
check(/ELSE IF @nDef = @nV3\s*BEGIN[\s\S]*?SELECT @def AS definizione_v3_prima_della_v4;[\s\S]*?END/.test(rami) && !/ELSE IF @nDef = @nV3\s*BEGIN[^E]*SET NOEXEC ON/.test(rami), 'v3: stampa la definizione vecchia (backup), poi ALTER');
const fermi = [...rami.matchAll(/RAISERROR\([\s\S]*?\);\s*SET NOEXEC ON;/g)];
check(fermi.length === 2 && /IF @def IS NULL\s*BEGIN[\s\S]*?RAISERROR/.test(rami) && /ELSE\s*BEGIN[\s\S]*?SELECT @def AS definizione_trovata;[\s\S]*?RAISERROR/.test(rami), 'vista assente/cifrata o diversa: FERMO, con RAISERROR PRIMA di SET NOEXEC ON');
check(/SET NOEXEC OFF;\s*\nGO/.test(v4code) && v4code.indexOf('SET NOEXEC OFF') > iAlter, 'NOEXEC si spegne dopo l\'ALTER');
// (6/10) dopo l'ALTER si rilegge la definizione: "v4 applicata" solo se c'e'
// davvero, altrimenti RAISERROR. Sta prima di SET NOEXEC OFF: dopo un FERMO
// non parte.
const dopoAlter = v4code.slice(iAlter, v4code.indexOf('SET NOEXEC OFF'));
const PATT = 'ISNULL(pos.Z,0)+ISNULL(pos.Z_CORR,0)+pt.Z_PICK';
check(/IF OBJECT_DEFINITION\(OBJECT_ID\('COORDINATES_PIECES_TRAYS_4Robot'\)\) LIKE N'%ISNULL\(pos\.Z,0\)\+ISNULL\(pos\.Z_CORR,0\)\+pt\.Z_PICK%'\s*\n\s*PRINT '[^']*v4 applicata\.';\s*\nELSE\s*\n\s*RAISERROR\('ALTER non riuscita, la vista e'' ancora quella di prima: vedi l''errore sopra\.', 16, 1\);/.test(dopoAlter),
	'dopo l\'ALTER rilegge la definizione: "v4 applicata" oppure RAISERROR "ALTER non riuscita"');
check((v4code.match(/v4 applicata/g) || []).length === 1, '"v4 applicata" esce solo da quel controllo (nessun PRINT incondizionato)');
check(corpoV4.includes(PATT), 'il controllo cerca un testo che la v4 contiene davvero (' + PATT + ')');
// (6/10) verifica in sola lettura: tasche con Z diversa da 0 (la v4 somma
// pos.Z, e "0 CASSETTIERA" che la azzerava non c'e' piu')
const verifica = v4code.slice(v4code.indexOf('SET NOEXEC OFF'));
check(/SELECT COUNT\(\*\) FROM \[POSITION\]\s*\n?\s*WHERE PARENT LIKE 'TRAY%' AND POS > 0 AND ISNULL\(Z,0\) <> 0/.test(verifica) && /atteso 0/.test(verifica), 'verifica: conta le tasche con Z diversa da 0 (atteso 0)');
check(/IF @zNon0 <> 0\s*BEGIN\s*PRINT 'ATTENZIONE:/.test(verifica), 'se non e\' 0: avviso chiaro');
check(!/RAISERROR|SET NOEXEC ON|ALTER |UPDATE |INSERT |DELETE /i.test(verifica), 'e niente FERMO ne\' scritture: la verifica e\' in sola lettura, la vista ormai e\' applicata');
check(/sqlcmd -S \.\\SQLEXPRESS -E -d ADMG -y 0 -i robot-tray-view-v4\.sql -o D:\\Backup\\vista4Robot_prima_v4\.txt; Get-Content D:\\Backup\\vista4Robot_prima_v4\.txt/.test(v4), 'nell\'intestazione il comando per Dario, col backup nel file');
check(/WHERE TRAY = '8' AND SUB_POS IN \(1, 13, 40, 52\)/.test(v4code), 'verifica sulle tasche 1, 13, 40 e 52 del cassetto 8, con TRAY = \'8\' come le query del PLC');
// (6/10, prova sul clone del DB di cella) cast(TRAY as int) nella WHERE e'
// andato in errore 245: l'ottimizzatore lo calcola anche sulle righe
// EXTRACT_TRAY_n, dove TRAY vale 'CT'. Nessun cast o convert su TRAY in
// nessuna WHERE dello script (codice, commenti esclusi; anche dentro le
// definizioni v3/v4 scritte nella guardia).
const where = [...v4code.matchAll(/\bWHERE\b[\s\S]*?(?=;|\bORDER\s+BY\b|\bGROUP\s+BY\b|\nGO\b)/gi)].map(m => m[0]);
const castTray = where.filter(w => /\b(TRY_)?(CAST|CONVERT)\s*\(\s*(\w+\s*,\s*)?(\w+\.)?TRAY\b/i.test(w));
check(where.length >= 4 && castTray.length === 0, 'nessun cast o convert su TRAY nelle WHERE (' + where.length + ' WHERE controllate' + (castTray.length ? '; colpevoli: ' + castTray.map(w => w.replace(/\s+/g, ' ').slice(0, 60)).join(' | ') : '') + ')');
check(/sys\.default_constraints/.test(v4code), 'stampa i default delle colonne di correzione (non sono scritti nel repo)');

console.log('\n3) script superati: inerti in ogni caso');
for (const f of ['superati/robot-tray-view-v3.sql', 'superati/robot-tray-view-v2.sql']) {
	const c = codice(leggi(f));
	const testa = c.slice(0, c.indexOf('GO', c.indexOf('RAISERROR')) + 2);
	check(/^\s*:on error exit\s*\nGO/.test(c), f + ': ":on error exit" in testa (sqlcmd esce al RAISERROR)');
	check(/RAISERROR\([^;]*SUPERATO[^;]*,\s*16,\s*1\);\s*\nSET NOEXEC ON;/.test(testa) && !/\bIF\b/.test(testa), f + ': RAISERROR e SET NOEXEC ON senza condizioni, in quest\'ordine, prima di tutto il resto');
	const alter = c.search(/ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS/);
	check(alter > 0 && c.indexOf('SET NOEXEC ON') < alter, f + ': l\'ALTER viene dopo (compilato, mai eseguito)');
}
check(!fs.existsSync(path.join(DIR, 'robot-tray-view-v3.sql')), 'la v3 non sta piu\' fra gli script attivi');

console.log('\n4) nessun altro script attivo tocca la vista');
const attivi = fs.readdirSync(DIR).filter(f => f.endsWith('.sql'));
const tocca = attivi.filter(f => /ALTER VIEW\s+(dbo\.)?COORDINATES_PIECES_TRAYS_4Robot|CREATE VIEW\s+(dbo\.)?COORDINATES_PIECES_TRAYS_4Robot/i.test(codice(leggi(f))));
check(tocca.join(',') === 'robot-tray-view-v4.sql', 'solo robot-tray-view-v4.sql (' + tocca.join(', ') + ')');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
