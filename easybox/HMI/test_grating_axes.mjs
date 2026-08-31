// ============================================================================
// test_grating_axes.mjs — generazione grigliato e validazione ingombro
// (grating-axis-swap-2, 1/9). Carica la VERA Grating.vue via Vite
// ssrLoadModule e confronta la geometria prodotta con i dati REALI del DB
// cella (TRAY_9 validato sul ferro; TRAY_8 = input dell'incidente 1/9).
//
// Uso:   node test_grating_axes.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
// shim browser minimo per data.js (window.location, storage)
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { drawingToRobot, gridFit, DIR_X, DIR_Y } = await server.ssrLoadModule('/src/util/gratingAxes.js');
const comp = (await server.ssrLoadModule('/src/views/conf/Grating/Grating.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// vm minimale sul componente REALE: data() + methods bindati
function makeVm({ pieceX, pieceY, safex, safey }) {
	const vm = Object.assign({}, comp.data.call({}));
	for (const [k, f] of Object.entries(comp.methods)) vm[k] = f.bind(vm);
	vm.$route = { params: { grating_ID: 0 } };
	// $t finto in chiaro (niente JSON annidato: le virgolette escapate
	// renderebbero fragili gli assert sul contenuto dell'alert)
	vm.$t = (k, p) => k + (p ? ' ' + Object.entries(p).map(([a, b]) => a + '=' + b).join(',') : '');
	vm.trayList = [{ ID: 30, FLOOR_MAG: 9, X: 820000, Y: 610000, MAG: 1 }];
	vm.partList = [{ ID: 1, X: pieceX, Y: pieceY, PRISMA: 1 }];
	// minSafeX = (STROKE+TICKNESS)/1000 = 20, minSafeY (prisma) = 5
	vm.gripperList = [{ ID: 1, STROKE_CLAW: 15000, TICKNESS_CLAW: 5000 }];
	vm.grating.trayIndex = 1; vm.grating.pieceIndex = 1; vm.grating.gripperIndex = 1;
	vm.grating.width = 820; vm.grating.height = 610;
	vm.grating.SAFEX = safex; vm.grating.SAFEY = safey;
	vm.calculateData();
	return vm;
}
const pts = vm => drawingToRobot(vm.pocketCentersWH());
const distinct = a => [...new Set(a)].sort((x, y) => x - y);

console.log('0) versi centralizzati');
check(DIR_X === +1 && DIR_Y === -1, 'DIR_X=+1 (lungo width), DIR_Y=-1 (height negata)');

console.log('\n1) TRAY_9 (validato sul ferro): pezzo 40x70, SAFE 20/10, bordi 20');
const vm9 = makeVm({ pieceX: 40000, pieceY: 70000, safex: 20, safey: 10 });
const p9 = pts(vm9);
check(p9.length === 91, '91 tasche (' + p9.length + ')');
const xs9 = distinct(p9.map(p => p.X)), ys9 = distinct(p9.map(p => p.Y));
check(xs9.length === 13 && xs9[0] === 50000 && xs9[12] === 770000, '13 valori X da 50000 a 770000');
check(xs9.every((v, i) => i === 0 || v - xs9[i-1] === 60000), 'passo X = 60000');
check(ys9.length === 7 && ys9[6] === -65000 && ys9[0] === -545000, '7 valori Y da -65000 a -545000');
check(ys9.every((v, i) => i === 0 || v - ys9[i-1] === 80000), 'passo Y = 80000 (verso negativo)');
// andamento SUB_POS come a DB: 1..13 lungo X, la 14 riparte a X=50000 con Y-80000
check(p9[0].X === 50000 && p9[0].Y === -65000, 'tasca 1 = (50000, -65000)');
check(p9[1].X === 110000 && p9[1].Y === -65000, 'tasca 2 = (110000, -65000): loop interno lungo X');
check(p9[12].X === 770000 && p9[12].Y === -65000, 'tasca 13 = (770000, -65000)');
check(p9[13].X === 50000 && p9[13].Y === -145000, 'tasca 14 = (50000, -145000)');
check(p9[90].X === 770000 && p9[90].Y === -545000, 'tasca 91 = (770000, -545000)');
const fit9 = gridFit(p9, { trayX: 820000, trayY: 610000, halfW: 20000, halfH: 35000 });
check(fit9.ok, 'ingombro dentro 820000 x 610000 (pezzo incluso)');

console.log('\n2) TRAY_8 (input incidente 1/9): pezzo 40x120, SAFE 20/20, bordi 20');
const vm8 = makeVm({ pieceX: 40000, pieceY: 120000, safex: 20, safey: 20 });
const p8 = pts(vm8);
check(p8.length === 52, '52 tasche (' + p8.length + ')');
const xs8 = distinct(p8.map(p => p.X)), ys8 = distinct(p8.map(p => p.Y));
check(xs8.length === 13 && ys8.length === 4, '13 colonne lungo X, 4 righe lungo Y (era 4x13 invertito)');
check(ys8.every(v => v <= 0), 'tutte le Y negative (prima salivano fino a +625000)');
const fit8 = gridFit(p8, { trayX: 820000, trayY: 610000, halfW: 20000, halfH: 60000 });
check(fit8.ok, 'la griglia STA nel cassetto (con la convenzione giusta)');
check(vm8.checkGridFit() === true, 'checkGridFit del componente: passa');

console.log('\n3) gridFit: sfora X, sfora Y, limite esatto, dentro');
const mk = (X, Y) => [{ X, Y }];
let f = gridFit(mk(810000, -100000), { trayX: 820000, trayY: 610000, halfW: 20000, halfH: 0 });
check(!f.ok && f.overX === 10000 && f.overY === 0, 'sfora in X di 10000 -> bloccato, overX=10000');
f = gridFit(mk(100000, -600000), { trayX: 820000, trayY: 610000, halfW: 0, halfH: 20000 });
check(!f.ok && f.overY === 10000 && f.overX === 0, 'sfora in Y (fondo) di 10000 -> bloccato, overY=10000');
f = gridFit(mk(100000, 5000), { trayX: 820000, trayY: 610000, halfW: 0, halfH: 0 });
check(!f.ok && f.overY === 5000, 'Y positiva (fuori dal bordo verso il robot) -> bloccato');
f = gridFit([{ X: 20000, Y: -20000 }, { X: 800000, Y: -590000 }], { trayX: 820000, trayY: 610000, halfW: 20000, halfH: 20000 });
check(f.ok, 'limite ESATTO (0 e 820000, 0 e -610000) -> passa');
f = gridFit(mk(400000, -300000), { trayX: 820000, trayY: 610000, halfW: 50000, halfH: 50000 });
check(f.ok, 'ben dentro -> passa');

console.log('\n4) il componente BLOCCA su griglia fuori contorno');
// stesso pezzo del TRAY_8 ma su un cassetto dichiarato piu' corto in Y:
// la griglia generata (fondo a -575000 pezzo incluso) non ci sta.
const vmKO = makeVm({ pieceX: 40000, pieceY: 120000, safex: 20, safey: 20 });
vmKO.trayList[0].Y = 500000;   // contorno reale piu' corto della griglia
let alerted = '';
globalThis.alert = m => { alerted = String(m); };
check(vmKO.checkGridFit() === false, 'checkGridFit -> false (salvataggio bloccato)');
check(alerted.includes('grating.outOfTray'), 'alert con chiave outOfTray (' + alerted + ')');
check(alerted.includes('axis=Y') && !alerted.includes('axis=X'), 'lo sforamento e\' segnalato SOLO sull\'asse Y');
check(alerted.includes('mm=75'), 'entita\' dello sforamento: 75 mm (fondo griglia -575000 vs contorno -500000)');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
