// ============================================================================
// test_base_dxf.mjs — la base dei grigliati letta da Base.dxf (7/10)
//
//   1. lettore (util/baseDxf.js parseBaseDxf) su fixture SINTETICHE: bulge,
//      POLYLINE R12 del nostro export, CRLF, INSUNITS 1, fori su 0 e HOLES,
//      PIECES, MTEXT formattato, estrusione (0,0,-1), INSERT;
//   2. casi d'errore: binario, profilo assente o doppio, aperto, sciolto, 3D,
//      origine in basso a sinistra, quote in pollici, estrusione storta;
//   3. andata e ritorno: export (buildGratingDxf) -> lettura, profilo e fori
//      identici; tasche dell'export in (W - Y/1000, X/1000 - H) delle
//      coordinate robot di drawingToRobot(gridCenters(...));
//   4. disegno: angoli e fori dove dice x_svg = x_dxf, y_svg = -y_dxf;
//   5. tasche contro base (pocketsVsBase): pulito, sul foro, oltre il profilo;
//   6. Grating.vue: loadBase, riga rossa, DXF/stampa bloccati, conferma
//      "esportare comunque?", viewBox, sorgente del template;
//   7. testi i18n.
//
// NESSUNA geometria del cliente: il cassetto di prova e' 500 x 400 e la base
// e' inventata. Il Base.dxf vero sta fuori dal repo (APPUNTI-CELLA).
//
// Uso:   node test_base_dxf.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' }, performance: globalThis.performance };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createI18n } = require('vue-i18n');

const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const bd = await server.ssrLoadModule('/src/util/baseDxf.js');
const { buildGrid, gridCenters } = await server.ssrLoadModule('/src/util/gratingGrid.js');
const { drawingToRobot } = await server.ssrLoadModule('/src/util/gratingAxes.js');
const cc = await server.ssrLoadModule('/src/util/cavityClearance.js');
const gratingMod = await server.ssrLoadModule('/src/views/conf/Grating/Grating.vue');
const comp = gratingMod.default;
const { buildGratingDxf, stripPreviewOnly } = gratingMod;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
const i18n = createI18n({ legacy: false, locale: 'it', messages: { it, en }, missingWarn: false, fallbackWarn: false });
const t = (k, p) => i18n.global.t(k, p || {});

// ---------------------------------------------------------------- fixture
const W = 500, H = 400;     // cassetto di prova, inventato
function dxfDoc(entities, { insunits = 4, eol = '\n' } = {}) {
	const r = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1027'];
	if (insunits !== null) r.push('9', '$INSUNITS', '70', String(insunits));
	r.push('0', 'ENDSEC', '0', 'SECTION', '2', 'TABLES', '0', 'ENDSEC');
	r.push('0', 'SECTION', '2', 'ENTITIES', ...entities.flat(), '0', 'ENDSEC', '0', 'EOF');
	return r.join(eol) + eol;
}
const ext = e => e ? ['210', String(e[0]), '220', String(e[1]), '230', String(e[2])] : [];
const lw = (layer, verts, { closed = true, extr = null } = {}) => {
	const r = ['0', 'LWPOLYLINE', '8', layer, '90', String(verts.length), '70', closed ? '1' : '0', ...ext(extr)];
	for (const v of verts) { r.push('10', String(v[0]), '20', String(v[1])); if (v[2]) r.push('42', String(v[2])); }
	return r;
};
const circle = (layer, cx, cy, r, extr = null) => ['0', 'CIRCLE', '8', layer, '10', String(cx), '20', String(cy), '30', '0', '40', String(r), ...ext(extr)];
const mtext = (layer, x, y, h, txt, attach = 1) => ['0', 'MTEXT', '8', layer, '10', String(x), '20', String(y), '40', String(h), '71', String(attach), '1', txt];
const text = (layer, x, y, h, txt) => ['0', 'TEXT', '8', layer, '10', String(x), '20', String(y), '40', String(h), '1', txt];
const line = (layer, a, b) => ['0', 'LINE', '8', layer, '10', String(a[0]), '20', String(a[1]), '11', String(b[0]), '21', String(b[1])];
const insert = () => ['0', 'INSERT', '8', '0', '2', 'BLOCCO', '10', '0', '20', '0'];

// profilo con una tacca a semicerchio sul lato alto: da (200,-10) a (300,-10)
// con bulge 1 (antiorario): centro (250,-10), r 50, punto medio (250,-60)
const PROFILO = [[10, -10], [200, -10, 1], [300, -10], [490, -10], [490, -390], [10, -390]];
const FORI = [[100, -30, 3], [400, -370, 3]];
const baseEnt = (extra = []) => [lw('PROFILE', PROFILO), ...FORI.map(f => circle('HOLES', ...f)), ...extra];
const leggi = (txt, wh = { width: W, height: H }) => bd.parseBaseDxf(txt, wh);

// ======================================================================
console.log('1) lettore, fixture sintetiche');
let b = leggi(dxfDoc(baseEnt()));
check(!b.error && b.profile.length === 6 && b.profile[1].bulge === 1 && b.holes.length === 2 && b.warnings.length === 0,
	'LWPOLYLINE chiusa su PROFILE + 2 fori su HOLES: 6 vertici, bulge 1 sul secondo, nessun avviso');
check(b.holes.every((h, i) => h.cx === FORI[i][0] && h.cy === FORI[i][1] && h.r === FORI[i][2]), 'fori letti con le coordinate del file');
// semicerchio: punto medio dell'arco spezzato
const arco = bd.bulgePoints({ x: 200, y: -10 }, { x: 300, y: -10 }, 1);
const medio = arco.reduce((m, p) => Math.abs(p.x - 250) < Math.abs(m.x - 250) ? p : m, arco[0]);
check(near(medio.x, 250, 1e-9) && near(medio.y, -60, 1e-9), 'semicerchio bulge 1: il punto medio dell\'arco cade in (250, -60) (' + medio.x + ', ' + medio.y + ')');
check(arco.every(p => near(Math.hypot(p.x - 250, p.y + 10), 50, 1e-9)), '   tutti i punti a raggio 50 dal centro (250, -10)');
const pa = [{ x: 200, y: -10 }, ...arco, { x: 300, y: -10 }];
const freccia = Math.max(...pa.slice(1).map((p, i) => { const q = pa[i]; const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2; return 50 - Math.hypot(mx - 250, my + 10); }));
check(freccia <= bd.BULGE_CHORD_TOL_MM + 1e-12 && freccia > 0.01, '   scarto di corda massimo ' + freccia.toFixed(4) + ' mm <= 0.05');
const archoNeg = bd.bulgePoints({ x: 200, y: -10 }, { x: 300, y: -10 }, -1);
const medioNeg = archoNeg.reduce((m, p) => Math.abs(p.x - 250) < Math.abs(m.x - 250) ? p : m, archoNeg[0]);
check(near(medioNeg.y, 40, 1e-9), '   bulge -1 (orario): l\'arco va dall\'altra parte, (250, 40)');
// CRLF
const bCrlf = leggi(dxfDoc(baseEnt(), { eol: '\r\n' }));
check(!bCrlf.error && JSON.stringify(bCrlf.profile) === JSON.stringify(b.profile) && JSON.stringify(bCrlf.holes) === JSON.stringify(b.holes), 'CRLF: stesso risultato di LF');
// INSUNITS 1: ignorato (nessuna scala), avviso
const bIn = leggi(dxfDoc(baseEnt(), { insunits: 1 }));
check(!bIn.error && bIn.info.insunits === 1 && bIn.profile[3].x === 490 && bIn.warnings.some(w => w.key === 'grating.base.warn.units'),
	'INSUNITS 1: quote lette in mm senza scala, unita\' dichiarata in info, avviso');
// fori sul layer 0 e su HOLES
const bL0 = leggi(dxfDoc([lw('PROFILE', PROFILO), circle('HOLES', 100, -30, 3), circle('0', 400, -370, 3), circle('0', 400, -30, 3)]));
const wl = bL0.warnings.filter(w => w.key === 'grating.base.warn.holeLayer');
check(bL0.holes.length === 3 && wl.length === 1 && wl[0].params.layer === '0' && wl[0].params.n === 2, 'cerchi su 0 e su HOLES: tutti fori, avviso col nome del layer 0 (2 fori)');
// PIECES: ignorate, contate, avviso; un cerchio su PIECES non e' un foro
const bP = leggi(dxfDoc(baseEnt([lw('PIECES', [[50, -50], [90, -50], [90, -120], [50, -120]]), circle('pieces', 200, -200, 20)])));
check(!bP.error && bP.holes.length === 2 && bP.info.pieces === 2 && bP.warnings.some(w => w.key === 'grating.base.warn.pieces' && w.params.n === 2),
	'entita\' su PIECES (anche in minuscolo): ignorate, contate (2), avviso, il cerchio non diventa un foro');
// MTEXT formattato e TEXT; i vuoti si scartano
const bT = leggi(dxfDoc(baseEnt([mtext('0', 250, -20, 8, '{\\H1.2x;\\fArial|b0|i0|c0|p34;\\U+2191 Robot \\U+2191}', 5), mtext('0', 10, -10, 5, ''), text('TESTI', 20, -380, 4, 'Lato operatore')])));
check(bT.texts.length === 2 && bT.texts[0].text === '\u2191 Robot \u2191' && bT.texts[0].attach === 5 && bT.texts[0].h === 8 && bT.info.testiVuoti === 1,
	'MTEXT formattato -> "\u2191 Robot \u2191" (altezza 8, attacco 5); MTEXT vuoto scartato');
check(bT.texts[1].text === 'Lato operatore' && bT.texts[1].x === 20 && bT.texts[1].y === -380, 'TEXT letto con posizione e testo');
check(bd.mtextPlain('a\\Pb {\\C1;rosso}') === 'a b rosso' && bd.mtextPlain('{\\Q15;inclinato} \\{graffa\\}') === 'inclinato {graffa}', 'mtextPlain: a capo, colore, inclinazione, graffe col backslash');
// estrusione (0,0,-1): x col segno cambiato
const bE = leggi(dxfDoc([lw('PROFILE', PROFILO.map(v => [-v[0], v[1], v[2] ? -v[2] : 0]), { extr: [0, 0, -1] }), circle('HOLES', -100, -30, 3, [0, 0, -1]), circle('HOLES', 400, -370, 3)]));
check(!bE.error && JSON.stringify(bE.profile.map(v => [v.x, v.y, v.bulge])) === JSON.stringify(b.profile.map(v => [v.x, v.y, v.bulge])) && bE.holes[0].cx === 100,
	'estrusione (0,0,-1): x e bulge col segno cambiato, stessa base della fixture normale');
// INSERT: avviso
const bI = leggi(dxfDoc(baseEnt([insert()])));
check(!bI.error && bI.warnings.some(w => w.key === 'grating.base.warn.insert' && w.params.n === 1), 'INSERT: avviso «blocco non letto: esplodilo»');
// foro fuori dal profilo: avviso (dentro la tacca a semicerchio)
const bF = leggi(dxfDoc(baseEnt([circle('HOLES', 250, -30, 3)])));
check(!bF.error && bF.warnings.some(w => w.key === 'grating.base.warn.holeOutside' && w.params.n === 1), 'foro dentro la tacca (fuori dal profilo): avviso');
// chiusa coi punti senza flag
const bC = leggi(dxfDoc([lw('PROFILE', [...PROFILO, PROFILO[0]], { closed: false })]));
check(!bC.error && bC.profile.length === 6 && bC.warnings.some(w => w.key === 'grating.base.warn.closedByPoints'), 'ultimo punto = primo, senza flag: accettata con avviso');

// ======================================================================
console.log('\n2) casi d\'errore');
const errKey = r => r && r.error && r.error.key;
check(errKey(leggi('AutoCAD Binary DXF\r\n\u001a\u0000xx')) === 'grating.base.err.binary', 'DXF binario: errore');
check(errKey(leggi('ciao\nmondo\n')) === 'grating.base.err.notDxf', 'testo qualunque: non e\' un DXF');
check(errKey(leggi(dxfDoc(FORI.map(f => circle('HOLES', ...f))))) === 'grating.base.err.profileMissing', 'profilo assente: errore');
check(errKey(leggi(dxfDoc([lw('PROFILE', PROFILO), lw('profile', PROFILO)]))) === 'grating.base.err.profileMany', 'profilo doppio (PROFILE e profile): errore');
check(errKey(leggi(dxfDoc([lw('PROFILE', PROFILO, { closed: false })]))) === 'grating.base.err.profileOpen', 'polilinea aperta: errore «chiudi il profilo (JOIN)»');
check(errKey(leggi(dxfDoc([line('PROFILE', [10, -10], [490, -10]), line('PROFILE', [490, -10], [490, -390])]))) === 'grating.base.err.profileLoose', 'linee sciolte su PROFILE: errore «unisci il profilo in una polilinea»');
const poly3d = ['0', 'POLYLINE', '8', 'PROFILE', '66', '1', '70', '9', ...PROFILO.flatMap(v => ['0', 'VERTEX', '8', 'PROFILE', '10', String(v[0]), '20', String(v[1]), '30', '0']), '0', 'SEQEND', '8', 'PROFILE'];
check(errKey(leggi(dxfDoc([poly3d]))) === 'grating.base.err.profile3d', 'polilinea 3D: errore');
const mesh = ['0', 'POLYLINE', '8', 'PROFILE', '66', '1', '70', '16', ...PROFILO.flatMap(v => ['0', 'VERTEX', '8', 'PROFILE', '10', String(v[0]), '20', String(v[1])]), '0', 'SEQEND', '8', 'PROFILE'];
check(errKey(leggi(dxfDoc([mesh]))) === 'grating.base.err.profile3d', 'mesh: errore');
check(errKey(leggi(dxfDoc([lw('PROFILE', PROFILO, { extr: [1, 0, 0] })]))) === 'grating.base.err.extrusion', 'estrusione (1,0,0): errore');
const bBL = leggi(dxfDoc([lw('PROFILE', PROFILO.map(v => [v[0], -v[1], v[2] ? -v[2] : 0]))]));
check(errKey(bBL) === 'grating.base.err.outOfTray' && bBL.error.params.minY === 10 && bBL.error.params.maxY === 390 && bBL.error.params.w === W,
	'origine in basso a sinistra (tutte le y positive): errore «non sta nel cassetto», col riquadro trovato');
const pollici = [[0, 0], [32.3, 0], [32.3, -24], [0, -24]];
const bInch = leggi(dxfDoc([lw('PROFILE', pollici)]), { width: 820, height: 610 });
check(errKey(bInch) === 'grating.base.err.outOfTray' && bInch.error.params.maxX === 32.3 && bInch.error.params.minY === -24,
	'quote in pollici (riquadro 32 x 24 nel cassetto 820 x 610): errore, riquadro trovato nel messaggio');
check(errKey(leggi(dxfDoc([lw('PROFILE', [[0, 0], [W + 2, 0], [W + 2, -H], [0, -H]])]))) === 'grating.base.err.outOfTray', 'profilo oltre W + 1: errore');
check(!leggi(dxfDoc([lw('PROFILE', [[-1, 1], [W + 1, 1], [W + 1, -H - 1], [-1, -H - 1]])])).error, 'profilo a 1 mm fuori dal cassetto: tollerato');
check(!leggi(dxfDoc([lw('PROFILE', pollici)]), {}).error, 'senza W e H il controllo contro il cassetto si salta');

// ======================================================================
console.log('\n3) andata e ritorno: export -> lettura');
const g = buildGrid({ pieceX: 40, pieceY: 70, prismatic: true, safeX: 20, safeY: 10, width: W, height: H });
const exp = buildGratingDxf({ base: b, pieces: g.listPz, dimX: g.dim_x, dimY: g.dim_y, radius: g.radius, clearanceUm: 0 });
const back = leggi(exp);
check(!back.error, 'l\'export si rilegge come base valida');
check(back.profile.length === b.profile.length && back.profile.every((v, i) => near(v.x, b.profile[i].x) && near(v.y, b.profile[i].y) && v.bulge === b.profile[i].bulge),
	'profilo identico alla base entro 1e-6, bulge compresi (codice 42 sul VERTEX R12)');
check(back.holes.length === 2 && back.holes.every((h, i) => near(h.cx, b.holes[i].cx) && near(h.cy, b.holes[i].cy) && near(h.r, b.holes[i].r)), 'fori identici alla base');
check(/\n9\n\$INSUNITS\n70\n4\n/.test(exp) && /\n42\n1\n/.test(exp), 'INSUNITS 4 (mm) e bulge scritto sul vertice');
const bTxt = leggi(dxfDoc(baseEnt([mtext('0', 250, -20, 8, 'Robot')])));
const expT = buildGratingDxf({ base: bTxt, pieces: [], dimX: 40, dimY: 70, radius: 0 });
check(!/\nM?TEXT\n/.test(expT) && bTxt.texts.length === 1, 'i testi della base non si esportano');
check(back.info.pieces === g.listPz.length, 'le ' + g.listPz.length + ' tasche stanno sul layer PIECES');
// centri delle tasche nell'export (POLYLINE su PIECES)
function tascheDxf(dxf) {
	const r = dxf.split('\n'), out = [];
	for (let i = 0; i < r.length; i++) {
		if (r[i] !== 'POLYLINE' || r[i + 2] !== 'PIECES') continue;
		const xs = [], ys = [];
		for (let k = i + 1; r[k] !== 'SEQEND'; k++) if (r[k] === 'VERTEX') { xs.push(Number(r[k + 4])); ys.push(Number(r[k + 6])); }
		out.push({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
	}
	for (let i = 0; i < r.length; i++) if (r[i] === 'CIRCLE' && r[i + 2] === 'PIECES') out.push({ x: Number(r[i + 4]), y: Number(r[i + 6]), r: Number(r[i + 8]) });
	return out;
}
const robot = drawingToRobot(gridCenters(g.listPz, { width: W, height: H, dim_x: g.dim_x, dim_y: g.dim_y }));
const td = tascheDxf(exp);
const scarto = Math.max(...td.map((c, i) => Math.max(Math.abs(c.x - (W - robot[i].Y / 1000)), Math.abs(c.y - (robot[i].X / 1000 - H)))));
check(td.length === robot.length && scarto <= 0.0005 + 1e-9,
	'prismi: centro tasca DXF = (W - Y/1000, X/1000 - H) delle coordinate robot, scarto max ' + scarto.toFixed(6) + ' mm (arrotondamento al micron)');
check(near(td[0].x, W - robot[0].Y / 1000, 0.0005) && td[0].x > W / 2 && td[0].y < -H / 2, '   tasca 1 in basso a destra nel DXF, vicino all\'origine del work object (W, -H)');
const gc = buildGrid({ pieceX: 50, pieceY: 50, prismatic: false, safeX: 15, safeY: 15, width: W, height: H });
const expC = buildGratingDxf({ base: b, pieces: gc.listPz, dimX: 0, dimY: 0, radius: gc.radius, clearanceUm: 200 });
const robC = drawingToRobot(gridCenters(gc.listPz, { width: W, height: H, dim_x: 0, dim_y: 0 }));
const tc = tascheDxf(expC);
check(tc.length === robC.length && tc.every((c, i) => near(c.x, W - robC[i].Y / 1000, 0.0005) && near(c.y, robC[i].X / 1000 - H, 0.0005) && near(c.r, 25.1)),
	'cilindri: stessa regola, raggio con franco 0.2 mm (25.1) a centro fermo');
const td1 = tascheDxf(buildGratingDxf({ base: b, pieces: g.listPz, dimX: 40, dimY: 70, radius: 0, clearanceUm: 1000 }));
check(td1.every((c, i) => near(c.x, td[i].x) && near(c.y, td[i].y) && near(c.w, 41) && near(c.h, 71)), 'franco 1 mm: cavita\' 41 x 71, centri invariati');
check(!buildGratingDxf({ base: null, pieces: g.listPz, dimX: 40, dimY: 70, radius: 0 }).includes('PROFILE\n66'), 'senza base nessun profilo (l\'export pero\' e\' bloccato a monte)');

// ======================================================================
console.log('\n4) disegno: x_svg = x_dxf, y_svg = -y_dxf');
const quadro = leggi(dxfDoc([lw('PROFILE', [[5, -5], [495, -5], [495, -395], [5, -395]]), circle('HOLES', 480, -385, 4), mtext('0', 250, -12, 6, 'Robot', 5)]));
const sv = bd.baseToSvg(quadro);
const pts = sv.d.replace(/[MZ]/g, '').trim().split(' L').map(s => s.trim().split(' ').map(Number));
check(JSON.stringify(pts) === JSON.stringify([[5, 5], [495, 5], [495, 395], [5, 395]]) && /^M/.test(sv.d) && /Z$/.test(sv.d), 'i quattro angoli (5,-5) (495,-5) (495,-395) (5,-395) -> (5,5) (495,5) (495,395) (5,395)');
check(sv.holes[0].cx === 480 && sv.holes[0].cy === 385 && sv.holes[0].r === 4, 'il foro (480,-385) -> (480,385), stesso raggio');
check(sv.texts[0].x === 250 && sv.texts[0].y === 12 && sv.texts[0].size === 6 && sv.texts[0].anchor === 'middle' && sv.texts[0].baseline === 'central', 'testo (250,-12) -> (250,12), altezza 6, attacco centro-centro');
check(sv.bbox.minX === 5 && sv.bbox.minY === 5 && sv.bbox.maxX === 495 && sv.bbox.maxY === 395, 'riquadro della base nello SVG');
const svArc = bd.baseToSvg(b);
check(/L250 60(\s|$)/.test(svArc.d) || svArc.d.includes(' L250 60 '), 'arco spezzato nel path: passa da (250, 60), il punto medio della tacca');
// la stampa allarga solo le tasche: il gruppo base passa intatto
const svgBase = '<svg><g id="base"><path d="' + sv.d + '"/><circle r="4" cx="480" cy="385"/></g><g id="prisma_obj"><rect x="10" y="10" width="40" height="70"/></g></svg>';
const stampa = cc.applyCavityClearanceToSvg(svgBase, 500);
check(stampa.includes('<g id="base"><path d="' + sv.d + '"/><circle r="4" cx="480" cy="385"/></g>') && stampa.includes('width="40.5"'), 'applyCavityClearanceToSvg: fori della base intatti, tasche allargate');

// ======================================================================
console.log('\n5) tasche contro base (BASE_WEB_MM = ' + bd.BASE_WEB_MM + ', DA CONFERMARE)');
check(bd.BASE_WEB_MM === 3, 'BASE_WEB_MM = 3');
const rett = { profile: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: -H }, { x: 0, y: -H }].map(v => Object.assign({ bulge: 0 }, v)), holes: [] };
const cav = (lp, dx, dy, um = 100) => lp.map(p => { const c = cc.cavityRect(p.x, p.y, dx, dy, um); return { tipo: 'rect', x: c.x, y: c.y, w: c.w, h: c.h }; });
check(bd.pocketsVsBase(rett, cav(g.listPz, 40, 70)).length === 0, 'caso pulito: griglia coi bordi da 20 mm, nessun conflitto');
const c1 = { x: g.listPz[0].x + 20, y: g.listPz[0].y + 35 };
const sulForo = Object.assign({}, rett, { holes: [{ cx: c1.x, cy: -c1.y, r: 3 }] });
const k1 = bd.pocketsVsBase(sulForo, cav(g.listPz, 40, 70));
check(k1.length === 1 && k1[0].index === 0 && k1[0].foro && !k1[0].profilo, 'foro al centro della tasca 1: conflitto foro sulla sola tasca 1');
const corto = Object.assign({}, rett, { profile: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: -300 }, { x: 0, y: -300 }].map(v => Object.assign({ bulge: 0 }, v)) });
const k2 = bd.pocketsVsBase(corto, cav(g.listPz, 40, 70));
check(k2.length > 0 && k2.every(k => k.profilo && !k.foro) && k2.some(k => k.index === 0) && k2.every(k => g.listPz[k.index].y + 70 > 300 - 3),
	'profilo piu\' corto del cassetto: le tasche oltre (o a meno di 3 mm) sono in conflitto col profilo, prima la 1');
// soglie esatte, cavita' 40 x 70 a (100,100) in SVG
const r0 = [{ tipo: 'rect', x: 100, y: 100, w: 40, h: 70 }];
check(bd.pocketsVsBase(Object.assign({}, rett, { holes: [{ cx: 146.01, cy: -135, r: 3 }] }), r0).length === 0, 'foro a r + 3.01 dal bordo: nessun conflitto');
check(bd.pocketsVsBase(Object.assign({}, rett, { holes: [{ cx: 145.99, cy: -135, r: 3 }] }), r0)[0].foro, 'foro a r + 2.99 dal bordo: conflitto');
check(bd.pocketsVsBase(rett, [{ tipo: 'rect', x: 3.01, y: 100, w: 40, h: 70 }]).length === 0 && bd.pocketsVsBase(rett, [{ tipo: 'rect', x: 2.99, y: 100, w: 40, h: 70 }])[0].profilo,
	'cavita\' a 3.01 dal lato: ok; a 2.99: conflitto col profilo');
check(bd.pocketsVsBase(rett, [{ tipo: 'rect', x: -10, y: 100, w: 40, h: 70 }])[0].profilo, 'cavita\' oltre il profilo: conflitto');
check(bd.pocketsVsBase(Object.assign({}, rett, { holes: [{ cx: 200, cy: -200, r: 3 }] }), [{ tipo: 'circle', cx: 200, cy: 175, r: 19.9 }])[0].foro
	&& bd.pocketsVsBase(Object.assign({}, rett, { holes: [{ cx: 200, cy: -200, r: 3 }] }), [{ tipo: 'circle', cx: 200, cy: 170, r: 19 }]).length === 0, 'cilindro: 25 - 19.9 < 6 conflitto, 30 - 19 >= 6 pulito');
const tacca = bd.pocketsVsBase(b, [{ tipo: 'rect', x: 230, y: 40, w: 40, h: 30 }]);
check(tacca.length === 1 && tacca[0].profilo, 'profilo con arco: una cavita\' dentro la tacca a semicerchio e\' in conflitto');

// ======================================================================
console.log('\n6) Grating.vue');
function makeVm({ base = null } = {}) {
	const vm = Object.assign({}, comp.data.call({}));
	for (const [k, f] of Object.entries(comp.methods)) vm[k] = f.bind(vm);
	for (const [k, f] of Object.entries(comp.computed)) Object.defineProperty(vm, k, { get: () => f.call(vm), configurable: true });
	vm.$route = { params: { grating_ID: 0 } };
	vm.$t = t;
	vm.trayList = [{ ID: 30, FLOOR_MAG: 9, X: W * 1000, Y: H * 1000, MAG: 1 }];
	vm.partList = [{ ID: 1, X: 40000, Y: 70000, PRISMA: 1 }];
	vm.gripperList = [{ ID: 1, STROKE_CLAW: 15000, TICKNESS_CLAW: 5000 }];
	vm.grating.trayIndex = 1; vm.grating.pieceIndex = 1; vm.grating.gripperIndex = 1;
	vm.grating.width = W; vm.grating.height = H; vm.grating.SAFEX = 20; vm.grating.SAFEY = 10;
	vm.calculateData();
	vm.base = base;
	return vm;
}
let alerts = [], confirms = [], risposta = true;
globalThis.alert = m => alerts.push(String(m));
globalThis.confirm = m => { confirms.push(String(m)); return risposta; };

// loadBase con la route finta
const headers = h => ({ get: n => { const k = Object.keys(h).find(x => x.toLowerCase() === n.toLowerCase()); return k ? h[k] : null; } });
const risp = (status, body, h = {}) => ({ ok: status >= 200 && status < 300, status, headers: headers(h),
	text: async () => String(body), json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });
let chiamate = [];
const route = r => { globalThis.fetch = async (url, opt) => { chiamate.push({ url: String(url), opt }); return r; }; };
const PERC = 'C:\\prove\\modelli\\Base.dxf';
let vm = makeVm();
route(risp(200, dxfDoc(baseEnt([circle('0', 400, -30, 3)])), { 'Last-Modified': 'Tue, 07 Oct 2026 10:00:00 GMT', 'X-Base-Size': '1234', 'X-Base-Path': encodeURIComponent(PERC) }));
await vm.loadBase();
check(chiamate[0].url.endsWith('api/conf/grating/base') && chiamate[0].opt && chiamate[0].opt.cache === 'no-store', 'loadBase: GET api/conf/grating/base senza cache del browser');
check(vm.base && vm.base.holes.length === 3 && !vm.baseError && vm.baseFile.path === PERC && vm.baseFile.size === 1234, 'base valida: letta, percorso decodificato dall\'header, dimensione');
check(vm.baseWarnings.length === 1 && vm.baseWarnings[0].key === 'grating.base.warn.holeLayer', 'avvisi della util pronti per la riga gialla');
check(vm.baseInfoText.includes(PERC) && /fori: 3/.test(vm.baseInfoText) && vm.baseInfoText.includes('2026'), 'riga informativa: file, data di modifica, numero di fori');
check(vm.baseSvg && vm.baseSvg.holes.length === 3, 'baseSvg pronto per il gruppo <g id="base">');

vm = makeVm(); route(risp(404, { error: 'BASE_DXF_MISSING', path: PERC })); await vm.loadBase();
check(!vm.base && vm.baseError.key === 'grating.base.err.missing' && vm.baseErrorText.includes('Base.dxf non trovato') && vm.baseErrorText.includes(PERC), '404: riga rossa «Base.dxf non trovato» col percorso cercato');
vm = makeVm(); route(risp(500, { error: 'BASE_DIR_UNSET' })); await vm.loadBase();
check(vm.baseError.key === 'grating.base.err.dirUnset' && /Grating_model_dir/.test(vm.baseErrorText), '500 BASE_DIR_UNSET: riga rossa, cartella non impostata');
vm = makeVm(); route(risp(413, { error: 'BASE_DXF_TOO_LARGE', path: PERC, size: 6000000 })); await vm.loadBase();
check(vm.baseError.key === 'grating.base.err.tooLarge' && /6000000/.test(vm.baseErrorText), '413: troppo grande');
vm = makeVm(); route(risp(200, dxfDoc([lw('PROFILE', PROFILO, { closed: false })]), { 'X-Base-Path': encodeURIComponent(PERC) })); await vm.loadBase();
check(!vm.base && vm.baseError.key === 'grating.base.err.profileOpen' && vm.baseErrorText.includes('chiudi il profilo (JOIN)') && vm.baseErrorText.includes(PERC), 'file non valido: messaggio della util e percorso');
vm = makeVm(); globalThis.fetch = async () => { throw new Error('rete giu'); };
const consoleInfo = console.info; console.info = () => {};
await vm.loadBase();
console.info = consoleInfo;
check(vm.baseError.key === 'grating.base.err.network' && /rete giu/.test(vm.baseErrorText), 'backend irraggiungibile: riga rossa');

// DXF e stampa bloccati senza base; generazione e salvataggio no
const uscite = [];
vm.esportaDXF = um => uscite.push(['dxf', um]);
vm.stampaDiv = um => uscite.push(['print', um]);
alerts = [];
vm.askCavity('dxf');
check(!vm.cavityDialog.open && alerts.length === 1 && alerts[0].includes(vm.baseErrorText) && /bloccati/.test(alerts[0]), 'senza base: DXF bloccato con lo stesso messaggio della riga rossa');
vm.askCavity('print');
check(!vm.cavityDialog.open && alerts.length === 2, 'senza base: stampa PDF bloccata');
vm.runCavityAction('dxf', 100);
check(uscite.length === 0 && alerts.length === 3, 'runCavityAction senza base: niente export');
const vmB = makeVm(); alerts = [];
Object.entries(comp.methods).filter(([k]) => k === 'esportaDXF' || k === 'stampaDiv').forEach(([k, f]) => f.call(vmB, 100));
check(alerts.length === 2 && alerts.every(a => /non ancora letta/.test(a)), 'esportaDXF/stampaDiv chiamati diretti senza base (in caricamento): bloccati');
check(vm.listPz.length > 0 && typeof vm.saveData === 'function' && !/this\.base/.test(comp.methods.saveData.toString()) && !/this\.base/.test(comp.methods.createModelFile.toString()) && !/this\.base/.test(comp.methods.calculateData.toString()),
	'generazione, salvataggio e modello SVG non dipendono dalla base');

// conflitti e conferma «esportare comunque?»
const tasca1 = (() => { const v = makeVm(); return { x: v.listPz[0].x + 20, y: v.listPz[0].y + 35 }; })();
const baseForo = leggi(dxfDoc([lw('PROFILE', [[0, 0], [W, 0], [W, -H], [0, -H]]), circle('HOLES', tasca1.x, -tasca1.y, 3)]));
vm = makeVm({ base: baseForo });
check(vm.pocketConflicts.length === 1 && vm.pocketConflicts[0].index === 0, 'anteprima: la tasca 1 sul foro e\' in conflitto');
check(vm.conflictText(vm.pocketConflicts) === 'Tasche 1: troppo vicine a un foro (meno di 3 mm di materiale)', 'elenco: «' + vm.conflictText(vm.pocketConflicts) + '»');
const lista = vm.conflictText([{ index: 0, foro: true, profilo: false }, { index: 4, foro: true, profilo: true }, { index: 6, foro: false, profilo: true }]);
check(lista === 'Tasche 1, 5: troppo vicine a un foro (meno di 3 mm di materiale) · Tasche 5, 7: troppo vicine al profilo (meno di 3 mm di materiale)', 'elenco con fori e profilo: «' + lista + '»');
const usciteC = [];
vm.esportaDXF = um => usciteC.push(['dxf', um]);
vm.stampaDiv = um => usciteC.push(['print', um]);
confirms = []; risposta = false;
vm.runCavityAction('dxf', 100);
check(confirms.length === 1 && /Esportare comunque\?/.test(confirms[0]) && /Tasche 1/.test(confirms[0]) && usciteC.length === 0, 'DXF con conflitti: conferma «esportare comunque?», annullata -> niente export');
risposta = true;
vm.runCavityAction('print', 100);
check(confirms.length === 2 && usciteC.length === 1 && usciteC[0][0] === 'print', 'stampa con conflitti: confermata -> stampa');
const vmPulita = makeVm({ base: leggi(dxfDoc([lw('PROFILE', [[0, 0], [W, 0], [W, -H], [0, -H]])])) });
vmPulita.esportaDXF = um => usciteC.push(['dxf', um]);
confirms = [];
vmPulita.runCavityAction('dxf', 300);
check(confirms.length === 0 && usciteC[1][0] === 'dxf' && usciteC[1][1] === 300, 'senza conflitti: nessuna conferma, export col franco scelto');
// il franco scelto conta: foro a 3.07 mm dal bordo nominale -> pulito a 0, conflitto a 0.2 mm
const vmF = makeVm({ base: leggi(dxfDoc([lw('PROFILE', [[0, 0], [W, 0], [W, -H], [0, -H]]), circle('HOLES', tasca1.x + 20 + 6.07, -tasca1.y, 3)])) });
check(vmF.baseConflicts(0).length === 0 && vmF.baseConflicts(200).length === 1, 'il controllo usa la cavita\' col franco scelto (0 mm pulito, 0.2 mm conflitto)');
// export DXF dalla base letta, niente DOM
let scaricato = null;
globalThis.Blob = function (parts) { scaricato = parts.join(''); };
globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} };
globalThis.document = { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} }, getElementById: () => { throw new Error('esportaDXF non deve leggere il DOM'); } };
vm = makeVm({ base: b });
comp.methods.esportaDXF.call(vm, 100);
check(scaricato && leggi(scaricato).profile.length === 6 && leggi(scaricato).profile[1].bulge === 1 && leggi(scaricato).info.pieces === vm.listPz.length, 'esportaDXF: profilo (col bulge) e fori dalla base letta, tasche dalla griglia, senza DOM');

// viewBox
const vb = (base, w = W, h = H) => comp.computed.sceneViewBox.call({ grating: { width: w, height: h }, baseSvg: base ? bd.baseToSvg(base) : null });
const largo = leggi(dxfDoc([lw('PROFILE', [[-1, 1], [W + 1, 1], [W + 1, -H - 1], [-1, -H - 1]])]));
check(vb(largo) === '-26 -26 552 711', 'sceneViewBox dal riquadro della base (' + vb(largo) + ')');
check(vb(null) === '-25 -25 550 710', 'senza base: il solo cassetto (' + vb(null) + ')');

// il modello SVG non porta la sovrapposizione rossa
const conSovr = '<svg><rect id="tray"/><g id="baseConflicts" class="noPrint"><rect x="1"/><circle r="2"/></g><g id="base"><path d="M0 0 Z"/></g></svg>';
check(stripPreviewOnly(conSovr) === '<svg><rect id="tray"/><g id="base"><path d="M0 0 Z"/></g></svg>' && stripPreviewOnly('<svg/>') === '<svg/>', 'stripPreviewOnly: via la sovrapposizione dei conflitti, la base resta');

// sorgente: template e ordine di caricamento
const src = readFileSync('src/views/conf/Grating/Grating.vue', 'utf8');
const tpl = src.slice(0, src.indexOf('<script>', src.indexOf('</template>'))).replace(/<!--[\s\S]*?-->/g, '');
const gBase = tpl.slice(tpl.indexOf('<g id="base"'), tpl.indexOf('</g>', tpl.indexOf('<g id="base"')));
check(gBase.includes(':d="baseSvg.d"') && /v-for="\(h, i\) in baseSvg\.holes"/.test(gBase) && /v-for="\(t, i\) in baseSvg\.texts"/.test(gBase), '<g id="base">: profilo, fori e testi dalla base letta');
check(!/prisma_obj|cylinder_obj/.test(gBase) && !/rotate|transform/.test(gBase), '   niente id prisma_obj/cylinder_obj e niente rotazioni nel gruppo');
check(/fill="#8A94A6"/.test(gBase) && /:font-size="t\.size"/.test(gBase), '   testi in grigio alla loro altezza');
check(!/M15 5/.test(tpl) && !/<circle r="3" cx="18"/.test(tpl) && !/PROF\s*=/.test(src), 'path, 9 cerchi e PROF scritti a mano: spariti');
check(/class="pure-u-1 base-line base-error" v-if="baseError"/.test(tpl) && tpl.indexOf('base-error') < tpl.indexOf('id="trayLayout"'), 'riga rossa sopra il disegno');
check(/base-warn" v-if="baseWarnings\.length && !baseWarningsClosed"/.test(tpl) && /@click="baseWarningsClosed = true"/.test(tpl), 'riga gialla degli avvisi, chiudibile');
check(tpl.indexOf('base-info') > tpl.indexOf('</svg>', tpl.indexOf('id="trayLayout"')), 'riga informativa sotto il disegno');
check(/<g id="baseConflicts" class="noPrint"/.test(tpl), 'tasche in conflitto in rosso, solo a schermo');
check(/Promise\.all\(\[this\.getPiecesList\(\), this\.getGripperList\(\), this\.getTrayList\(\)\]\)\s*\.then\(\(\) => \{ this\.loadBase\(\); this\.getGratingList\(\); \}\)/.test(src), 'la base si carica dopo getTrayList (servono W e H)');
check(!/querySelector/.test(comp.methods.esportaDXF.toString()), 'esportaDXF non legge piu\' il profilo dal DOM');
check(/checkGridFit\(\) \{\s*if \(this\.listPz\.length === 0\) return true;\s*const tray = this\.trayList\[this\.grating\.trayIndex-1\];/.test(src), 'checkGridFit invariato');

// ======================================================================
console.log('\n7) testi i18n (it ed en)');
const bdSrc = readFileSync('src/util/baseDxf.js', 'utf8');
const chiavi = new Set([
	...[...bdSrc.matchAll(/errore\('(\w+)'/g)].map(m => 'grating.base.err.' + m[1]),
	...[...bdSrc.matchAll(/avviso\('(\w+)'/g)].map(m => 'grating.base.warn.' + m[1]),
	...[...bdSrc.matchAll(/'(grating\.base\.err\.\w+)'/g)].map(m => m[1]),
	...[...src.matchAll(/'(grating\.base\.\w+)'/g)].map(m => m[1]),
]);
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
const fi = flat(it), fe = flat(en);
const mancanti = [...chiavi].filter(k => !fi.includes(k) || !fe.includes(k));
check(chiavi.size >= 25 && mancanti.length === 0, chiavi.size + ' chiavi grating.base usate dal codice, tutte in it ed en' + (mancanti.length ? ' (mancano ' + mancanti.join(', ') + ')' : ''));
check(fi.length === fe.length && fi.every(k => fe.includes(k)), 'it/en allineati (' + fi.length + ' chiavi)');
const par = { msg: 'm', path: 'p', w: 1, h: 2, minX: 3, maxX: 4, minY: 5, maxY: 6, n: 7, riga: 8, dove: 'd', size: 9, status: 10, unita: 'u', codice: 11, layer: 'L', list: '1, 2', web: 3, detail: 'x', mtime: 't', holes: 4 };
let rotti = [];
for (const loc of ['it', 'en']) {
	i18n.global.locale.value = loc;
	for (const k of chiavi) { const s = t(k, par); if (!s || s === k || /[{}]/.test(s)) rotti.push(loc + ':' + k); }
}
i18n.global.locale.value = 'it';
check(rotti.length === 0, 'tutti i messaggi si compilano e sostituiscono i parametri' + (rotti.length ? ' (rotti: ' + rotti.join(', ') + ')' : ''));
check(/chiudi il profilo \(JOIN\)/.test(it.grating.base.err.profileOpen) && /unisci il profilo in una polilinea/.test(it.grating.base.err.profileLoose)
	&& /esplodilo/.test(it.grating.base.warn.insert) && /origine non in alto a sinistra o quote non in mm/.test(it.grating.base.err.outOfTray), 'i testi chiesti: JOIN, polilinea, esplodilo, origine/mm');
check(/Esportare comunque\?/.test(it.grating.base.conflictConfirm) && /troppo vicine a un foro/.test(it.grating.base.conflictHoles) && /troppo vicine al profilo/.test(it.grating.base.conflictProfile), '«esportare comunque?» e «troppo vicine a un foro / al profilo»');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
