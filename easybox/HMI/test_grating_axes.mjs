// ============================================================================
// test_grating_axes.mjs — generazione grigliato e validazione ingombro
// (grating-axis-swap-3, 1/9). Carica la VERA Grating.vue via Vite
// ssrLoadModule e confronta la geometria prodotta con il RIFERIMENTO
// AUTORITATIVO (TRAY_9 corretto a DB e verificato sul robot, tasche 1 e 2) e
// con l'intera griglia del 9; per il cassetto 8 riporta la geometria attesa.
//
// Uso:   node test_grating_axes.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { drawingToRobot, gridFit, DIR_X, DIR_Y, ROBOT_AXIS_ALONG } = await server.ssrLoadModule('/src/util/gratingAxes.js');
const comp = (await server.ssrLoadModule('/src/views/conf/Grating/Grating.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// vm minimale sul componente REALE: data() + methods bindati
function makeVm({ pieceX, pieceY, safex, safey, trayX = 820000, trayY = 610000 }) {
	const vm = Object.assign({}, comp.data.call({}));
	for (const [k, f] of Object.entries(comp.methods)) vm[k] = f.bind(vm);
	vm.$route = { params: { grating_ID: 0 } };
	vm.$t = (k, p) => k + (p ? ' ' + Object.entries(p).map(([a, b]) => a + '=' + b).join(',') : '');
	vm.trayList = [{ ID: 30, FLOOR_MAG: 9, X: trayX, Y: trayY, MAG: 1 }];
	vm.partList = [{ ID: 1, X: pieceX, Y: pieceY, PRISMA: 1 }];
	// minSafeX = (STROKE+TICKNESS)/1000 = 20, minSafeY (prisma) = 5
	vm.gripperList = [{ ID: 1, STROKE_CLAW: 15000, TICKNESS_CLAW: 5000 }];
	vm.grating.trayIndex = 1; vm.grating.pieceIndex = 1; vm.grating.gripperIndex = 1;
	vm.grating.width = trayX / 1000; vm.grating.height = trayY / 1000;
	vm.grating.SAFEX = safex; vm.grating.SAFEY = safey;
	vm.calculateData();
	return vm;
}
const pts = vm => drawingToRobot(vm.pocketCentersWH());
const distinct = a => [...new Set(a)].sort((x, y) => x - y);
const eq = (p, X, Y) => p.X === X && p.Y === Y;

console.log('0) versi e accoppiamento assi/contorno centralizzati');
check(DIR_X === +1 && DIR_Y === +1, 'DIR_X=+1 (lungo height), DIR_Y=+1 (lungo width)');
check(ROBOT_AXIS_ALONG.width === 'Y' && ROBOT_AXIS_ALONG.height === 'X', 'TRAY.X (width) limita Y robot, TRAY.Y (height) limita X robot');

console.log('\n1) TRAY_9 — RIFERIMENTO AUTORITATIVO (pezzo 40x70, SAFE 20/10, bordi 20)');
const vm9 = makeVm({ pieceX: 40000, pieceY: 70000, safex: 20, safey: 10 });
const p9 = pts(vm9);
check(p9.length === 91, '91 tasche (' + p9.length + ')');
check(eq(p9[0], 50000, -65000), 'SUB_POS 1  = (50000, -65000)');
check(eq(p9[1], 50000, -5000), 'SUB_POS 2  = (50000, -5000)');
check(eq(p9[12], 50000, 655000), 'SUB_POS 13 = (50000, 655000)');
check(eq(p9[13], 130000, -65000), 'SUB_POS 14 = (130000, -65000)');
check(eq(p9[90], 530000, 655000), 'SUB_POS 91 = (530000, 655000)');
// intera griglia: SUB_POS avanza su Y a passo +60000 (13 per colonna), le
// colonne su X a passo +80000 (7)
let gridOk = true;
for (let i = 0; i < 91; i++) {
	const col = Math.floor(i / 13), row = i % 13;
	if (!eq(p9[i], 50000 + 80000 * col, -65000 + 60000 * row)) { gridOk = false; break; }
}
check(gridOk, 'TUTTE le 91 tasche: X = 50000 + 80000*col, Y = -65000 + 60000*row (col = SUB_POS-1 div 13)');
const xs9 = distinct(p9.map(p => p.X)), ys9 = distinct(p9.map(p => p.Y));
check(xs9.length === 7 && xs9[0] === 50000 && xs9[6] === 530000, '7 valori X da 50000 a 530000 (passo 80000 = pezzo.Y + SAFEY)');
check(ys9.length === 13 && ys9[0] === -65000 && ys9[12] === 655000, '13 valori Y da -65000 a 655000 (passo 60000 = pezzo.X + SAFEX)');
check(vm9.checkGridFit() === true, 'checkGridFit: il cassetto 9 PASSA (estende 720000 su Y: lo limita TRAY.X 820000, non TRAY.Y)');

console.log('\n2) TRAY_8 — geometria ATTESA (tray 820000x610000, pezzo 40x120, SAFE 20/20, bordi 20)');
const vm8 = makeVm({ pieceX: 40000, pieceY: 120000, safex: 20, safey: 20 });
const p8 = pts(vm8);
check(p8.length === 52, '52 tasche (' + p8.length + ')');
const xs8 = distinct(p8.map(p => p.X)), ys8 = distinct(p8.map(p => p.Y));
check(xs8.length === 4 && xs8.join() === '50000,190000,330000,470000', '4 colonne X: 50000, 190000, 330000, 470000 (passo 140000 = 120 + 20)');
check(ys8.length === 13 && ys8[0] === -95000 && ys8[12] === 625000, '13 valori Y da -95000 a 625000 (passo 60000 = 40 + 20)');
check(eq(p8[0], 50000, -95000) && eq(p8[1], 50000, -35000) && eq(p8[12], 50000, 625000) && eq(p8[13], 190000, -95000) && eq(p8[51], 470000, 625000), 'SUB_POS 1 (50000,-95000), 2 (50000,-35000), 13 (50000,625000), 14 (190000,-95000), 52 (470000,625000)');
const fit8 = gridFit(vm8.pocketCentersWH(), { width: 820, height: 610, halfW: 20, halfH: 60 });
check(fit8.ok, 'ingombro: lungo width (Y robot) 30..790 <= 820, lungo height (X robot) 35..575 <= 610 -> ACCETTATO');
check(vm8.checkGridFit() === true, 'checkGridFit del componente: passa');

console.log('\n3) gridFit (spazio disegno): sfora width, sfora height, limite esatto, dentro');
const mk = (w, h) => [{ w, h }];
let f = gridFit(mk(810, 100), { width: 820, height: 610, halfW: 20, halfH: 0 });
check(!f.ok && f.overW === 10 && f.overH === 0, 'sfora lungo width di 10 -> overW=10 (asse robot ' + ROBOT_AXIS_ALONG.width + ')');
f = gridFit(mk(100, 600), { width: 820, height: 610, halfW: 0, halfH: 20 });
check(!f.ok && f.overH === 10 && f.overW === 0, 'sfora lungo height di 10 -> overH=10 (asse robot ' + ROBOT_AXIS_ALONG.height + ')');
f = gridFit(mk(-5, 100), { width: 820, height: 610, halfW: 0, halfH: 0 });
check(!f.ok && f.overW === 5, 'fuori dal bordo a 0 -> bloccato');
f = gridFit([{ w: 20, h: 20 }, { w: 800, h: 590 }], { width: 820, height: 610, halfW: 20, halfH: 20 });
check(f.ok, 'limite ESATTO (0..820 e 0..610) -> passa');
f = gridFit(mk(400, 300), { width: 820, height: 610, halfW: 50, halfH: 50 });
check(f.ok, 'ben dentro -> passa');

console.log('\n4) il componente BLOCCA su griglia fuori contorno (messaggio con asse robot)');
// stessa griglia del TRAY_8 ma contorno dichiarato piu' corto lungo height
// (X robot): il fondo delle colonne (515+60 = 575) non ci sta in 500
const vmKO = makeVm({ pieceX: 40000, pieceY: 120000, safex: 20, safey: 20 });
vmKO.trayList[0].Y = 500000;
let alerted = '';
globalThis.alert = m => { alerted = String(m); };
check(vmKO.checkGridFit() === false, 'checkGridFit -> false (salvataggio bloccato)');
check(alerted.includes('grating.outOfTray'), 'alert con chiave outOfTray (' + alerted + ')');
check(alerted.includes('axis=X') && !alerted.includes('axis=Y'), 'sforo segnalato SOLO sull\'asse robot X (lungo height)');
check(alerted.includes('mm=75'), 'entita\': 75 mm (575 vs 500)');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
