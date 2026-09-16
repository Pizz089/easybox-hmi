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
	// (grating-thickness) la regola spessore + franco lato client vive in gratingGrid.js
	const hmiGrid = await import(pathToFileURL(path.join(__dirname, '..', 'HMI', 'src', 'util', 'gratingGrid.js')).href);

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

	console.log('\n2b) pickClearance (spessore grigliato + franco): parita\' server/client');
	check(srv.GRATING_CLEARANCE_UM === 1000 && hmiGrid.GRATING_CLEARANCE_UM === 1000, 'franco 1000 um, stesso valore da entrambi i lati');
	const clrCases = [
		{ name: 'NULL = non misurato', thickness: null, zPick: 100, zPlace: 100 },
		{ name: '0 = non misurato', thickness: 0, zPick: 100, zPlace: 100 },
		{ name: 'sotto il minimo (pick)', thickness: 8500, zPick: 9000, zPlace: 12000 },
		{ name: 'sotto il minimo (place)', thickness: 8500, zPick: 12000, zPlace: 9499 },
		{ name: 'al limite esatto', thickness: 8500, zPick: 9500, zPlace: 9500 },
		{ name: 'sopra', thickness: 8500, zPick: 15000, zPlace: 15000 },
		{ name: 'stringhe dal DB', thickness: '8500', zPick: '9500', zPlace: '9500' },
	];
	for (const c of clrCases) {
		const a = srv.pickClearance(c), b = hmiGrid.pickClearance(c);
		check(JSON.stringify(a) === JSON.stringify(b), c.name + ' -> ' + JSON.stringify(a));
	}
	check(srv.pickClearance(clrCases[0]).ok && srv.pickClearance(clrCases[1]).ok, 'NULL e 0: nessun vincolo (comportamento invariato)');
	check(!srv.pickClearance(clrCases[2]).ok && !srv.pickClearance(clrCases[3]).ok && srv.pickClearance(clrCases[2]).min === 9500, 'sotto 8500 + 1000 = 9500 su UNA delle due quote -> rifiuto, min 9500');
	check(srv.pickClearance(clrCases[4]).ok && srv.pickClearance(clrCases[5]).ok, 'al limite e sopra -> ok');

	console.log('\n3) parseCenters: validazione payload');
	check(srv.parseCenters([{ w: '1', h: 2 }]).length === 1 && srv.parseCenters([{ w: '1', h: 2 }])[0].w === 1, 'stringhe numeriche normalizzate a Number');
	check(srv.parseCenters([]) === null && srv.parseCenters(null) === null && srv.parseCenters('x') === null, 'vuoto / null / non array -> null');
	check(srv.parseCenters([{ w: 'a', h: 1 }]) === null && srv.parseCenters([{ w: Infinity, h: 1 }]) === null, 'non finiti -> null');
	check(srv.parseCenters(new Array(501).fill({ w: 1, h: 1 })) === null, 'oltre 500 tasche -> null');

	console.log('\n5) pieceFitsPockets: il pezzo DICHIARATO entra nelle tasche che ci sono');
	// (16/9) regola nuova, e come le altre vive in DUE copie: il backend la usa
	// in declareTrayType (strada REST, cassetto chiuso), il pannello prima di
	// mandare il comando 44 (cassetto aperto, lo scrive il PLC e nessuna
	// guardia di backend puo' intercettarlo). Se le due divergono, una delle
	// due strade lascia passare un pezzo che il robot va a sbattere.
	// Griglia vera: 13 x 7, passo 60000 su Y robot e 80000 su X, cassetto 820x610.
	const tasche = [];
	for (let c = 0; c < 7; c++) for (let r = 0; r < 13; r++) tasche.push({ X: 45000 + 80000 * c, Y: 50000 + 60000 * r });
	const casi = [
		{ nome: 'il pezzo per cui la griglia e\' stata fatta (40x70)', pieceX: 40000, pieceY: 70000 },
		{ nome: 'un pezzo piu\' grande (71x90): invade le vicine', pieceX: 71000, pieceY: 90000 },
		{ nome: 'al limite del passo (60x80): entra esatto', pieceX: 60000, pieceY: 80000 },
		{ nome: 'un micron oltre il passo: non entra', pieceX: 60001, pieceY: 80000 },
		{ nome: 'misure assenti: nessun rifiuto inventato', pieceX: 0, pieceY: 0 },
	];
	for (const c of casi) {
		const opt = { trayX: 820000, trayY: 610000, pieceX: c.pieceX, pieceY: c.pieceY };
		const a = srv.pieceFitsPockets(tasche, opt), b = hmi.pieceFitsPockets(tasche, opt);
		check(JSON.stringify(a) === JSON.stringify(b), c.nome + ' -> ' + JSON.stringify(a));
	}
	check(srv.pieceFitsPockets(tasche, { trayX: 820000, trayY: 610000, pieceX: 40000, pieceY: 70000 }).ok, '40x70 passa');
	const grande = srv.pieceFitsPockets(tasche, { trayX: 820000, trayY: 610000, pieceX: 71000, pieceY: 90000 });
	check(!grande.ok && grande.overPitchY === 11000 && grande.overPitchX === 10000, '71x90 rifiutato, e dice di quanto invade su ciascun asse');
	check(srv.pieceFitsPockets(tasche, { trayX: 820000, trayY: 610000, pieceX: 60000, pieceY: 80000 }).ok, 'al limite del passo: passa (il rifiuto e\' la COLLISIONE, non il franco del modello)');
	check(!srv.pieceFitsPockets(tasche, { trayX: 820000, trayY: 610000, pieceX: 60001, pieceY: 80000 }).ok, 'un micron oltre: non passa');
	// contorno: una tasca sola, troppo vicina al bordo
	const bordo = srv.pieceFitsPockets([{ X: 5000, Y: 5000 }], { trayX: 820000, trayY: 610000, pieceX: 40000, pieceY: 70000 });
	check(!bordo.ok && bordo.overW === 15000 && bordo.overH === 30000, 'tasca a 5 mm dal bordo: il pezzo sporgerebbe, e si dice di quanto');
	// una sola fila su un asse: il passo su quell'asse non esiste, non si vincola
	const fila = srv.pieceFitsPockets([{ X: 45000, Y: 50000 }, { X: 45000, Y: 110000 }], { trayX: 820000, trayY: 610000, pieceX: 40000, pieceY: 500000 });
	check(fila.overPitchX === 0, 'con una sola fila il passo su quell\' asse non esiste: nessun vincolo inventato');
	check(srv.pieceFitsPockets([], { trayX: 1, trayY: 1, pieceX: 9e9, pieceY: 9e9 }).ok, 'nessuna tasca: niente da verificare');

	console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
	process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
