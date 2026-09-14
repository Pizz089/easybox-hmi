// ============================================================================
// test_grating_fit_parity.js — la replica server (gratingFit.js, CommonJS)
// DEVE dare gli stessi risultati della util HMI (util/gratingAxes.js, ESM):
// ingombro (gridFit) e conversione disegno->robot (drawingToRobot). Se le
// formule divergono il server accetta/rifiuta griglie diverse dal client.
//
// Uso:   node test_grating_fit_parity.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
const path = require('path');
const { pathToFileURL } = require('url');
const srv = require(path.join(__dirname, 'gratingFit.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

(async () => {
	const hmi = await import(pathToFileURL(path.join(__dirname, '..', 'HMI', 'src', 'util', 'gratingAxes.js')).href);

	// griglia TRAY_12 (13 x 7, pezzo 40x70, SAFEX 20, SAFEY 10) + casi limite
	const grid = [];
	for (let c = 0; c < 7; c++) for (let r = 0; r < 13; r++) grid.push({ w: 50 + 60 * r, h: 45 + 80 * c });
	const cases = [
		{ name: 'TRAY_12 13x7 dentro', centers: grid, box: { width: 820, height: 610, halfW: 20, halfH: 35 } },
		{ name: 'stessa griglia traslata +300 su w (fuori)', centers: grid.map(p => ({ w: p.w + 300, h: p.h })), box: { width: 820, height: 610, halfW: 20, halfH: 35 } },
		{ name: 'cassetto piu\' stretto (700)', centers: grid, box: { width: 700, height: 610, halfW: 20, halfH: 35 } },
		{ name: 'al limite esatto (>=/<=)', centers: [{ w: 20, h: 35 }, { w: 800, h: 575 }], box: { width: 820, height: 610, halfW: 20, halfH: 35 } },
		{ name: 'oltre il limite di 0.001 mm', centers: [{ w: 19.999, h: 35 }], box: { width: 820, height: 610, halfW: 20, halfH: 35 } },
		{ name: 'griglia vuota', centers: [], box: { width: 820, height: 610, halfW: 0, halfH: 0 } },
		{ name: 'coordinate negative', centers: [{ w: -5, h: 10 }, { w: 100, h: 700 }], box: { width: 820, height: 610, halfW: 0, halfH: 0 } },
	];
	console.log('1) gridFit: parita\' server/client');
	for (const c of cases) {
		const a = srv.gridFit(c.centers, c.box), b = hmi.gridFit(c.centers, c.box);
		check(JSON.stringify(a) === JSON.stringify(b), c.name + ' -> ' + JSON.stringify(a));
	}
	console.log('\n2) drawingToRobot: parita\' server/client');
	for (const c of cases) {
		const a = srv.drawingToRobot(c.centers), b = hmi.drawingToRobot(c.centers);
		check(JSON.stringify(a) === JSON.stringify(b), c.name + ' (' + a.length + ' punti)');
	}
	const p = srv.drawingToRobot(grid);
	check(p[0].X === 45000 && p[0].Y === 50000 && p[1].Y === 110000 && p[13].X === 125000 && p[90].X === 525000 && p[90].Y === 770000, 'origine angolo cassetto (origin-fix 14/9): tasca 1 = (h1, w1) = (45000, 50000); SUB_POS 2 = +60000 su Y, SUB_POS 14 = +80000 su X');

	console.log('\n3) parseCenters: validazione payload');
	check(srv.parseCenters([{ w: '1', h: 2 }]).length === 1 && srv.parseCenters([{ w: '1', h: 2 }])[0].w === 1, 'stringhe numeriche normalizzate a Number');
	check(srv.parseCenters([]) === null && srv.parseCenters(null) === null && srv.parseCenters('x') === null, 'vuoto / null / non array -> null');
	check(srv.parseCenters([{ w: 'a', h: 1 }]) === null && srv.parseCenters([{ w: Infinity, h: 1 }]) === null, 'non finiti -> null');
	check(srv.parseCenters(new Array(501).fill({ w: 1, h: 1 })) === null, 'oltre 500 tasche -> null');

	console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
	process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
