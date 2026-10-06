// ============================================================================
// tests/test_cassetto_scala.mjs — il cassetto si disegna IN SCALA, mai come
// griglia stirata (pannello v3, regola 4; fase C, 6/10)
//
// Per due grigliati di prova, generati col generatore vero (gratingGrid) e
// passati a TrayPockets come arrivano dal DB (coordinate robot, mm), nel
// disegno devono coincidere con la geometria:
//   - il numero di righe e di colonne;
//   - il rapporto larghezza/altezza delle tasche (tolleranza 1%);
//   - il rapporto larghezza/altezza del cassetto (tolleranza 1%).
// I due grigliati:
//   A. quello reale della cella: cassetto 819 x 605, pezzo 40 x 110, distanze
//      19 / 25 (la piastra misurata il 6/10) -> 4 righe x 13 colonne;
//   B. uno molto piu' fitto (pezzo 12 x 24, distanze 5 / 6) -> tasche
//      piccole, per vedere cosa succede.
//
// "In largo e in compatto": il disegno sta tutto nel viewBox (mm) e il
// browser lo scala con preserveAspectRatio meet, cioe' con UN fattore solo.
// Qui si controlla che sia cosi' (viewBox, meet, nessuna misura fissa) e si
// riporta la geometria nei riquadri del disegno della pagina Cassetti misurati
// nel rilievo del 6/10 (RIQUADRI): rapporti identici, e dove la tasca scende
// sotto i 44 px il tocco ingrandisce una zona (util/trayZoom.js) in cui il
// passo torna sopra i 56 px. Il rilievo con Playwright misura gli stessi
// rapporti sul disegno vero, alle tre risoluzioni.
//
// Uso: node tests/test_cassetto_scala.mjs   (dalla cartella easybox/HMI)
// ============================================================================
globalThis.window = globalThis.window || { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} };
import { createServer } from 'vite';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const vicino = (a, b, tol = 0.01) => Math.abs(a / b - 1) <= tol;

const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { buildGrid, gridCenters } = await server.ssrLoadModule('/src/util/gratingGrid.js');
const { drawingToRobot } = await server.ssrLoadModule('/src/util/gratingAxes.js');
const zoom = await server.ssrLoadModule('/src/util/trayZoom.js');
const TrayPockets = (await server.ssrLoadModule('/src/components/layout/TrayPockets.vue')).default;
const { createSSRApp, h } = await import('vue');
const { renderToString } = await import('vue/server-renderer');

// riquadri del disegno nella pagina Cassetti (px), misurati nel rilievo del
// 6/10 sul pannello locale: largo 1920 x 1080, compatto 1024 x 768
const RIQUADRI = { 'largo (1920x1080)': { w: 1076, h: 520 }, 'compatto (1024x768)': { w: 616, h: 300 } };

const GRIGLIATI = [
	{ nome: 'A reale (819 x 605, 40 x 110, distanze 19/25)', tray: { w: 819, h: 605 }, pezzo: { x: 40, y: 110 }, safe: { x: 19, y: 25 }, attese: { righe: 4, colonne: 13 } },
	{ nome: 'B fitto (819 x 605, 12 x 24, distanze 5/6)', tray: { w: 819, h: 605 }, pezzo: { x: 12, y: 24 }, safe: { x: 5, y: 6 }, attese: null },
];

// (il render lato server scrive viewbox / preserveaspectratio in minuscolo:
// il parser HTML del browser li riporta alla forma SVG, come per ogni SVG)
const attr = (tag, k) => { const m = tag.match(new RegExp('\\s' + k + '="([^"]*)"', 'i')); return m ? m[1] : null; };
const num = (tag, k) => Number(attr(tag, k));

for (const G of GRIGLIATI) {
	console.log('\n' + G.nome);
	const grid = buildGrid({ pieceX: G.pezzo.x, pieceY: G.pezzo.y, prismatic: true, safeX: G.safe.x, safeY: G.safe.y, width: G.tray.w, height: G.tray.h });
	const centri = gridCenters(grid.listPz, { width: G.tray.w, height: G.tray.h, dim_x: grid.dim_x, dim_y: grid.dim_y });
	const robot = drawingToRobot(centri);
	// righe come le da' api/conf/tray/layout: x/y in mm robot
	const pockets = robot.map((p, i) => ({ SUB_POS: i + 1, x: p.X / 1000, y: p.Y / 1000, status: 4, prisma: true, order_ID: 0, partType: 1 }));
	if (G.attese) check(grid.n_row === G.attese.righe && grid.n_cln === G.attese.colonne, 'il generatore da\' ' + grid.n_row + ' righe x ' + grid.n_cln + ' colonne (' + pockets.length + ' tasche)');
	else console.log('       il generatore da\' ' + grid.n_row + ' righe x ' + grid.n_cln + ' colonne (' + pockets.length + ' tasche)');

	const svg = await renderToString(createSSRApp({ render: () => h(TrayPockets, { pockets, dimX: G.pezzo.x, dimY: G.pezzo.y, trayX: G.tray.w, trayY: G.tray.h, fill: true, showOrigin: false }) }));
	const radice = svg.match(/<svg[^>]*>/)[0];
	const vassoio = svg.match(/<rect[^>]*class="tray-pockets__tray"[^>]*>/)[0];
	const tasche = svg.match(/<rect[^>]*class="pocket-shape"[^>]*>/g) || [];

	// 1. righe e colonne
	const xs = new Set(tasche.map(t => num(t, 'x').toFixed(3)));
	const ys = new Set(tasche.map(t => num(t, 'y').toFixed(3)));
	check(tasche.length === pockets.length, 'tutte le tasche disegnate (' + tasche.length + ')');
	check(ys.size === grid.n_row && xs.size === grid.n_cln, 'righe x colonne nel disegno = geometria (' + ys.size + ' x ' + xs.size + ')');

	// 2. rapporto della tasca
	const tw = num(tasche[0], 'width'), th = num(tasche[0], 'height');
	check(vicino(tw / th, G.pezzo.x / G.pezzo.y), 'tasca ' + tw + ' x ' + th + ': rapporto ' + (tw / th).toFixed(4) + ' contro ' + (G.pezzo.x / G.pezzo.y).toFixed(4));
	check(tasche.every(t => num(t, 'width') === tw && num(t, 'height') === th), 'tutte le tasche della stessa misura');

	// 3. rapporto del cassetto
	const vw = num(vassoio, 'width'), vh = num(vassoio, 'height');
	check(vicino(vw / vh, G.tray.w / G.tray.h), 'cassetto ' + vw + ' x ' + vh + ': rapporto ' + (vw / vh).toFixed(4) + ' contro ' + (G.tray.w / G.tray.h).toFixed(4));
	check(attr(radice, 'data-tray-known') === '1', 'contorno dalle misure del cassetto, non quello fisso di prima');

	// 4. scala uniforme: viewBox in mm, meet, nessuna misura fissa
	const vb = (attr(radice, 'viewBox') || '').split(' ').map(Number);
	check(vb.length === 4 && vb[2] >= vw && vb[3] >= vh, 'viewBox in mm che contiene il cassetto (' + vb.join(' ') + ')');
	check(attr(radice, 'preserveAspectRatio') === 'xMidYMid meet', 'preserveAspectRatio="xMidYMid meet": un fattore solo, nessuna deformazione');
	check(attr(radice, 'width') === '100%' && attr(radice, 'height') === '100%', 'nessuna larghezza o altezza fissa (era 480 x 360)');
	// tutte le tasche dentro il contorno del cassetto
	check(tasche.every(t => num(t, 'x') >= 0 && num(t, 'y') >= 0 && num(t, 'x') + tw <= vw + 1e-6 && num(t, 'y') + th <= vh + 1e-6), 'tutte le tasche dentro il contorno del cassetto');

	// 5. nei riquadri della pagina (largo e compatto)
	const passoW = zoom.pitchOf(centri.map(c => c.w));
	for (const [nome, R] of Object.entries(RIQUADRI)) {
		const s = Math.min(R.w / vb[2], R.h / vb[3]);          // meet
		const pw = tw * s, ph = th * s, cw = vw * s, ch = vh * s;
		check(vicino(pw / ph, G.pezzo.x / G.pezzo.y) && vicino(cw / ch, G.tray.w / G.tray.h),
			nome + ': cassetto ' + cw.toFixed(0) + ' x ' + ch.toFixed(0) + ' px, tasca ' + pw.toFixed(1) + ' x ' + ph.toFixed(1) + ' px, rapporti invariati');
		const geom = { pitchW: passoW, dimX: G.pezzo.x };
		if (zoom.needsZoom(geom, s)) {
			const k = zoom.zoomFactor(geom, s);
			const zona = zoom.zoneAround({ w: centri[0].w, h: centri[0].h }, { trayW: G.tray.w, trayH: G.tray.h }, k);
			const s2 = Math.min(R.w / zona.w, R.h / zona.h);
			check(passoW * s2 >= zoom.TARGET_PX && vicino(zona.w / zona.h, G.tray.w / G.tray.h) && zona.x >= 0 && zona.y >= 0 && zona.x + zona.w <= G.tray.w + 1e-6,
				nome + ': passo ' + (passoW * s).toFixed(1) + ' px < ' + zoom.MIN_TOUCH_PX + ' -> il tocco ingrandisce x' + k + ' (passo ' + (passoW * s2).toFixed(0) + ' px), zona dentro il cassetto e con le sue proporzioni');
		} else {
			check(passoW * s >= zoom.MIN_TOUCH_PX, nome + ': passo ' + (passoW * s).toFixed(1) + ' px, si tocca la tasca direttamente');
		}
	}
}

// la zona ingrandita e' lo STESSO disegno con un altro viewBox
console.log('\nzona ingrandita');
{
	const pockets = [{ SUB_POS: 1, x: 100, y: 55.5, status: 4, prisma: true, order_ID: 0 }];
	const svg = await renderToString(createSSRApp({ render: () => h(TrayPockets, { pockets, dimX: 40, dimY: 110, trayX: 819, trayY: 605, fill: true, zone: { x: 0, y: 0, w: 409.5, h: 302.5 } }) }));
	const radice = svg.match(/<svg[^>]*>/)[0];
	check(attr(radice, 'viewBox') === '0 0 409.5 302.5' && attr(radice, 'preserveAspectRatio') === 'xMidYMid meet', 'viewBox = zona, sempre meet');
	const svg2 = await renderToString(createSSRApp({ render: () => h(TrayPockets, { pockets, dimX: 40, dimY: 110 }) }));
	const vassoio2 = svg2.match(/<rect[^>]*class="tray-pockets__tray"[^>]*>/)[0];
	check(/data-tray-known="0"/.test(svg2) && num(vassoio2, 'width') === 820 && num(vassoio2, 'height') === 615,
		'senza misure del cassetto: contorno 820 x 615 come prima, e la pagina lo sa (data-tray-known="0")');
}

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
