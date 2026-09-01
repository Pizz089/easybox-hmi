// ============================================================================
// test_cavity_clearance.mjs — franco cavita' nei soli file di fabbricazione,
// parametrico all'export (default = costante). Carica la VERA Grating.vue via
// Vite ssrLoadModule: il DXF esce da buildGratingDxf (export nominato), l'SVG
// di stampa/modello/download passa da applyCavityClearanceToSvg; anteprima,
// listPz e coordinate robot devono restare NOMINALI in ogni caso.
//
// Uso:   node test_cavity_clearance.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const cc = await server.ssrLoadModule('/src/util/cavityClearance.js');
const { drawingToRobot } = await server.ssrLoadModule('/src/util/gratingAxes.js');
const gratingMod = await server.ssrLoadModule('/src/views/conf/Grating/Grating.vue');
const comp = gratingMod.default;
const { buildGratingDxf } = gratingMod;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const CL = cc.CAVITY_CLEARANCE_UM / 1000;   // 0.1 mm

// misura della cavita' prismatica e del cerchio nel DXF (layer PIECES)
function dxfCavity(dxf, H) {
	const lines = dxf.split('\n');
	const verts = [];
	for (let i = 0; i < lines.length; i++)
		if (lines[i] === 'VERTEX' && lines[i+1] === '8' && lines[i+2] === 'PIECES')
			verts.push([Number(lines[i+4]), Number(lines[i+6])]);
	const vx = verts.map(v => v[0]), vy = verts.map(v => v[1]);
	let r = null, ccx = null, ccy = null;
	for (let i = 0; i < lines.length; i++)
		if (lines[i] === 'CIRCLE' && lines[i+2] === 'PIECES') { ccx = Number(lines[i+4]); ccy = Number(lines[i+6]); r = Number(lines[i+8]); }
	return {
		n: verts.length,
		w: Math.max(...vx) - Math.min(...vx), h: Math.max(...vy) - Math.min(...vy),
		cx: (Math.max(...vx) + Math.min(...vx)) / 2, cy: (Math.max(...vy) + Math.min(...vy)) / 2,
		r, ccx, ccy,
	};
}
const H = 610;
const pieces = [{ prisma: true, x: 100, y: 200, status: 2 }, { prisma: false, x: 300, y: 400, status: 2 }];
const dxfWith = (um) => buildGratingDxf(Object.assign({ width: 820, height: H, pieces, dimX: 40, dimY: 70, radius: 20, flipY: true }, um === undefined ? {} : { clearanceUm: um }));

console.log('0) costanti e conversione (un punto solo)');
check(cc.CAVITY_CLEARANCE_UM === 100 && cc.CAVITY_CLEARANCE_MAX_UM === 2000, 'default 100 um, massimo 2000 um');
check(cc.clearanceMmToUm(0.1) === 100 && cc.clearanceMmToUm('0.3') === 300 && cc.clearanceMmToUm(2) === 2000 && cc.clearanceMmToUm(0) === 0, 'mm -> um: 0.1->100, "0.3"->300, 2->2000, 0->0');
check(cc.clearanceMmToUm(0.15) === 200 && cc.clearanceMmToUm(0.04) === 0, 'un decimale: 0.15 -> 0.2 -> 200, 0.04 -> 0');
check(cc.clearanceUmToMm(100) === 0.1 && cc.clearanceUmToMm(2000) === 2, 'um -> mm: 100->0.1, 2000->2');
check(cc.isValidClearanceUm(0) && cc.isValidClearanceUm(100) && cc.isValidClearanceUm(2000), 'validi: 0, 100, 2000');
check(!cc.isValidClearanceUm(2100) && !cc.isValidClearanceUm(-100) && !cc.isValidClearanceUm(NaN) && !cc.isValidClearanceUm(150.5), 'non validi: 2100, -100, NaN, non intero');
check(Number.isNaN(cc.clearanceMmToUm('abc')), 'testo -> NaN (rifiutato)');

console.log('\n1) DXF col DEFAULT: identico a prima (cavita\' +100 um, centro fermo)');
const d0 = dxfCavity(dxfWith(undefined), H);
check(d0.n === 4 && near(d0.w, 40 + CL) && near(d0.h, 70 + CL), 'cavita\' 40.1 x 70.1 (' + d0.w + ' x ' + d0.h + ')');
check(near(d0.cx, 120) && near(d0.cy, H - 235), 'centro = centro nominale (120, ' + (H - 235) + ')');
check(near(d0.r, 20.05) && d0.ccx === 300 && d0.ccy === H - 400, 'cilindro r 20.05, centro fermo');
check(dxfWith(undefined) === dxfWith(100), 'default esplicito 100 um = default implicito (byte-identico)');

console.log('\n2) DXF con valore diverso: la cavita\' cambia, il centro no');
for (const [um, w, h, r] of [[500, 40.5, 70.5, 20.25], [0, 40, 70, 20], [2000, 42, 72, 21]]) {
	const d = dxfCavity(dxfWith(um), H);
	check(near(d.w, w) && near(d.h, h) && near(d.r, r), um + ' um -> ' + w + ' x ' + h + ', r ' + r);
	check(near(d.cx, 120) && near(d.cy, H - 235) && d.ccx === 300 && d.ccy === H - 400, um + ' um: centri invariati');
}

console.log('\n3) SVG serializzato: parametro applicato, default invariato');
const svgIn = '<svg id="trayLayout"><rect id="tray" x="0" y="0" width="820" height="610"/>'
	+ '<g id="prisma_obj" transform="rotate(0 120 235)"><rect x="92" y="187" width="56" height="96" style="fill:lightcyan"/>'
	+ '<rect x="100" y="200" width="40" height="70" style="fill:lightgray;stroke:red;stroke-width:1"/>'
	+ '<circle cx="120" cy="235" r="4" style="stroke:red;fill:red"/><text x="110" y="225"></text></g>'
	+ '<g id="cylinder_obj"><circle cx="300" cy="400" r="20" style="fill:lightgray"/><circle cx="300" cy="400" r="4" style="stroke:red;fill:red"/></g>'
	+ '<circle r="3" cx="18" cy="15" fill="none"/></svg>';
const s0 = cc.applyCavityClearanceToSvg(svgIn);
check(s0.includes('<rect x="99.95" y="199.95" width="40.1" height="70.1"') && s0.includes('<circle cx="300" cy="400" r="20.05"'), 'default: rect 40.1x70.1, cerchio 20.05');
check(s0 === cc.applyCavityClearanceToSvg(svgIn, 100), 'default implicito = esplicito');
const s5 = cc.applyCavityClearanceToSvg(svgIn, 500);
check(s5.includes('<rect x="99.75" y="199.75" width="40.5" height="70.5"') && s5.includes('<circle cx="300" cy="400" r="20.25"'), '500 um: rect 40.5x70.5 (centro fermo), cerchio 20.25');
check(cc.applyCavityClearanceToSvg(svgIn, 0) === svgIn.replace('<rect x="100" y="200" width="40" height="70"', '<rect x="100" y="200" width="40" height="70"'), '0 um: nessuna modifica');
check(s5.includes('<rect x="92" y="187" width="56" height="96" style="fill:lightcyan"/>') && s5.includes('<circle cx="120" cy="235" r="4"') && s5.includes('<circle r="3" cx="18" cy="15"'), 'alone, marker e fori intatti');

console.log('\n4) nominale invariato in ogni caso: listPz, dim_x/dim_y, coordinate robot');
function makeVm() {
	const vm = Object.assign({}, comp.data.call({}));
	for (const [k, f] of Object.entries(comp.methods)) vm[k] = f.bind(vm);
	vm.$route = { params: { grating_ID: 0 } };
	vm.$t = k => k;
	vm.trayList = [{ ID: 30, FLOOR_MAG: 9, X: 820000, Y: 610000, MAG: 1 }];
	vm.partList = [{ ID: 1, X: 40000, Y: 70000, PRISMA: 1 }];
	vm.gripperList = [{ ID: 1, STROKE_CLAW: 15000, TICKNESS_CLAW: 5000 }];
	vm.grating.trayIndex = 1; vm.grating.pieceIndex = 1; vm.grating.gripperIndex = 1;
	vm.grating.width = 820; vm.grating.height = 610; vm.grating.SAFEX = 20; vm.grating.SAFEY = 10;
	vm.calculateData();
	return vm;
}
const vm = makeVm();
check(vm.dim_x === 40 && vm.dim_y === 70 && vm.listPz.length === 91, 'dim 40x70 nominali, 91 tasche');
const p = drawingToRobot(vm.pocketCentersWH());
check(p[0].X === 50000 && p[0].Y === -65000 && p[1].Y === -5000 && p[13].X === 130000 && p[90].X === 530000 && p[90].Y === 655000, 'coordinate robot [POSITION] = riferimento TRAY_9');
const before = JSON.stringify(vm.listPz);
buildGratingDxf({ width: 820, height: 610, pieces: vm.listPz, dimX: vm.dim_x, dimY: vm.dim_y, radius: vm.radius, clearanceUm: 1500 });
check(JSON.stringify(vm.listPz) === before && vm.dim_x === 40 && vm.dim_y === 70, 'dopo un DXF a 1.5 mm: listPz e dim invariati');

console.log('\n5) dialog di export: un punto solo, default 0.1 a ogni pagina, range 0..2');
const runs = [];
vm.esportaDXF = um => runs.push(['dxf', um]);
vm.stampaDiv = um => runs.push(['print', um]);
vm.createModelFile = um => runs.push(['model', um]);
check(vm.cavityUm === 100 && vm.cavityDialog.open === false, 'pagina nuova: 100 um, dialog chiuso');
vm.askCavity('dxf');
check(vm.cavityDialog.open && vm.cavityDialog.value === '0.1' && runs.length === 0, 'DXF -> dialog aperto a 0.1 mm, niente esportato');
vm.closeCavityDialog();
check(!vm.cavityDialog.open && runs.length === 0, 'annulla: niente esportato');
vm.askCavity('dxf'); vm.cavityDialog.value = '0.3'; vm.confirmCavity();
check(runs.length === 1 && runs[0][0] === 'dxf' && runs[0][1] === 300 && !vm.cavityDialog.open, 'conferma 0.3 -> esportaDXF(300)');
vm.askCavity('model');
check(vm.cavityDialog.value === '0.3', 'lo stesso valore vale per la prossima uscita di questa pagina (modello)');
vm.confirmCavity();
check(runs[1][0] === 'model' && runs[1][1] === 300, 'modello SVG -> createModelFile(300)');
vm.askCavity('print'); vm.cavityDialog.value = '0'; vm.confirmCavity();
check(runs[2][0] === 'print' && runs[2][1] === 0, 'stampa con 0 -> stampaDiv(0): zero valido = nessun franco');
vm.askCavity('dxf'); vm.cavityDialog.value = '2'; vm.confirmCavity();
check(runs[3][1] === 2000, '2 mm (limite) accettato -> 2000 um');
for (const bad of ['2.1', '-0.1', 'abc', '']) {
	vm.askCavity('dxf'); vm.cavityDialog.value = bad; const n = runs.length; vm.confirmCavity();
	check(vm.cavityDialog.open && vm.cavityDialog.error === 'grating.cavity.rangeError' && runs.length === n, 'valore "' + bad + '": rifiutato con messaggio, niente esportato');
	vm.closeCavityDialog();
}
check(makeVm().cavityUm === 100, 'nuova apertura della pagina: torna il default (nessuna persistenza)');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
