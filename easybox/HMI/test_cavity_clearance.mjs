// ============================================================================
// test_cavity_clearance.mjs — franco cavita' nei soli file di fabbricazione.
// Carica la VERA Grating.vue via Vite ssrLoadModule: il DXF esce da
// buildGratingDxf (export nominato), l'SVG di stampa/modello/download passa
// da applyCavityClearanceToSvg; anteprima, listPz e coordinate robot devono
// restare NOMINALI.
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
const CL = cc.CAVITY_CLEARANCE_MM;   // 0.1 mm

console.log('0) costante unica');
check(cc.CAVITY_CLEARANCE_UM === 100 && near(CL, 0.1), 'CAVITY_CLEARANCE_UM = 100 (0.1 mm totali)');

console.log('\n1) DXF: cavita\' = nominale + 100 um per asse, centro al micron');
const H = 610;
const pieces = [{ prisma: true, x: 100, y: 200, status: 2 }, { prisma: false, x: 300, y: 400, status: 2 }];
const dxf = buildGratingDxf({ width: 820, height: H, pieces, dimX: 40, dimY: 70, radius: 20, flipY: true });
const lines = dxf.split('\n');
// vertici del POLYLINE su layer PIECES: coppie (10,x) (20,y)
const verts = [];
for (let i = 0; i < lines.length; i++)
	if (lines[i] === 'VERTEX' && lines[i+1] === '8' && lines[i+2] === 'PIECES')
		verts.push([Number(lines[i+4]), Number(lines[i+6])]);
check(verts.length === 4, '4 vertici della cavita\' prismatica');
const vx = verts.map(v => v[0]), vy = verts.map(v => v[1]);
const wDxf = Math.max(...vx) - Math.min(...vx), hDxf = Math.max(...vy) - Math.min(...vy);
check(near(wDxf, 40 + CL), 'larghezza cavita\' = 40.1 (' + wDxf + ')');
check(near(hDxf, 70 + CL), 'altezza cavita\' = 70.1 (' + hDxf + ')');
const cx = (Math.max(...vx) + Math.min(...vx)) / 2, cy = (Math.max(...vy) + Math.min(...vy)) / 2;
check(near(cx, 100 + 20) && near(cy, H - (200 + 35)), 'centro = centro nominale (120, ' + (H - 235) + ') -> (' + cx + ', ' + cy + ')');
// cerchio su layer PIECES
let rDxf = null;
for (let i = 0; i < lines.length; i++)
	if (lines[i] === 'CIRCLE' && lines[i+2] === 'PIECES') rDxf = Number(lines[i+8]);
check(rDxf !== null && near(rDxf, 20 + CL/2), 'raggio cilindro = 20.05 (diametro +0.1) (' + rDxf + ')');
const cyl = lines.findIndex((l, i) => l === 'CIRCLE' && lines[i+2] === 'PIECES');
check(Number(lines[cyl+4]) === 300 && Number(lines[cyl+6]) === H - 400, 'centro cilindro invariato (300, ' + (H - 400) + ')');
check(!dxf.includes('0.05\n10') , 'niente franco sui layer PROFILE/HOLES (solo PIECES)');
check(!/\d\.\d{7,}/.test(dxf), 'quote DXF arrotondate al micron (niente rumore binario)');
check(dxf.includes('\n99.95\n') && dxf.includes('\n140.05\n'), 'vertici prisma 99.95 / 140.05 esatti nel file');

console.log('\n2) SVG serializzato (stampa/PDF, download, modello): sagome allargate, centro fermo');
const svgIn = '<svg id="trayLayout"><rect id="tray" x="0" y="0" width="820" height="610"/>'
	+ '<g id="prisma_obj" transform="rotate(0 120 235)"><rect x="92" y="187" width="56" height="96" style="fill:lightcyan"/>'
	+ '<rect x="100" y="200" width="40" height="70" style="fill:lightgray;stroke:red;stroke-width:1"/>'
	+ '<circle cx="120" cy="235" r="4" style="stroke:red;fill:red"/><text x="110" y="225"></text></g>'
	+ '<g id="cylinder_obj"><circle cx="300" cy="400" r="20" style="fill:lightgray"/><circle cx="300" cy="400" r="4" style="stroke:red;fill:red"/></g>'
	+ '<circle r="3" cx="18" cy="15" fill="none"/></svg>';
const svgOut = cc.applyCavityClearanceToSvg(svgIn);
check(svgOut.includes('<rect x="99.95" y="199.95" width="40.1" height="70.1"'), 'rect tasca: x/y -0.05, w/h +0.1');
check(svgOut.includes('<rect x="92" y="187" width="56" height="96" style="fill:lightcyan"/>'), 'alone diffOrder intatto');
check(svgOut.includes('<circle cx="120" cy="235" r="4"'), 'marker di centro del prisma intatto');
check(svgOut.includes('<circle cx="300" cy="400" r="20.05"'), 'cilindro: r 20 -> 20.05, centro fermo');
check(svgOut.includes('<circle cx="300" cy="400" r="4"'), 'marker di centro del cilindro intatto');
check(svgOut.includes('<circle r="3" cx="18" cy="15"'), 'fori del cassetto intatti');
check(svgOut.includes('<rect id="tray" x="0" y="0" width="820" height="610"/>'), 'contorno cassetto intatto');

console.log('\n3) nominale invariato: listPz, dim_x/dim_y, coordinate robot');
const vm = Object.assign({}, comp.data.call({}));
for (const [k, f] of Object.entries(comp.methods)) vm[k] = f.bind(vm);
vm.$route = { params: { grating_ID: 0 } };
vm.trayList = [{ ID: 30, FLOOR_MAG: 9, X: 820000, Y: 610000, MAG: 1 }];
vm.partList = [{ ID: 1, X: 40000, Y: 70000, PRISMA: 1 }];
vm.gripperList = [{ ID: 1, STROKE_CLAW: 15000, TICKNESS_CLAW: 5000 }];
vm.grating.trayIndex = 1; vm.grating.pieceIndex = 1; vm.grating.gripperIndex = 1;
vm.grating.width = 820; vm.grating.height = 610; vm.grating.SAFEX = 20; vm.grating.SAFEY = 10;
vm.calculateData();
check(vm.dim_x === 40 && vm.dim_y === 70, 'dim_x/dim_y a schermo = 40x70 nominali');
check(vm.listPz.length === 91, '91 tasche');
const p = drawingToRobot(vm.pocketCentersWH());
check(p[0].X === 50000 && p[0].Y === -65000 && p[1].X === 110000 && p[90].X === 770000 && p[90].Y === -545000, 'coordinate robot [POSITION] identiche a TRAY_9 (passo 60000/80000 invariato)');
// il DXF dagli stessi dati: cavita' 40.1 x 70.1, centri = centri nominali
const dxf9 = buildGratingDxf({ width: 820, height: 610, pieces: vm.listPz, dimX: vm.dim_x, dimY: vm.dim_y, radius: vm.radius });
const l9 = dxf9.split('\n');
const first = [];
for (let i = 0; i < l9.length && first.length < 4; i++)
	if (l9[i] === 'VERTEX' && l9[i+2] === 'PIECES') first.push([Number(l9[i+4]), Number(l9[i+6])]);
const c1x = (Math.max(...first.map(v => v[0])) + Math.min(...first.map(v => v[0]))) / 2;
const c1y = (Math.max(...first.map(v => v[1])) + Math.min(...first.map(v => v[1]))) / 2;
check(near(c1x, vm.listPz[0].x + 20) && near(c1y, 610 - (vm.listPz[0].y + 35)), 'DXF tasca 1: centro = centro nominale della tasca 1');
check(near(Math.max(...first.map(v => v[0])) - Math.min(...first.map(v => v[0])), 40.1), 'DXF tasca 1: 40.1 mm su X');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
