// ============================================================================
// test_gripper_twins.mjs — convenzione pinza doppia (righe gemelle, stesso
// SUB_POS/POS_MAG, riga canonica = ID minore) applicata a TUTTI gli elenchi:
// util/grippers.js, Grating.vue e GratingTest.vue (select pinza), GrippersView
// (una riga, FAMILY visibile), robotView "Carica pinza" (una voce, il dialog
// di collaudo resta completo), backend updateGripper senza SUB_POS=0.
//
// Uso:   node test_gripper_twins.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const { dedupeGrippers, isTwinGripper } = await server.ssrLoadModule('/src/util/grippers.js');
const Grating = (await server.ssrLoadModule('/src/views/conf/Grating/Grating.vue')).default;
const GratingTest = (await server.ssrLoadModule('/src/views/conf/Grating/GratingTest.vue')).default;
const GrippersView = (await server.ssrLoadModule('/src/views/conf/GrippersView.vue')).default;
const robotView = (await server.ssrLoadModule('/src/views/unit/robotView.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const strip = f => readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '');

// righe REALI cella (show/all), la doppia A BORDO
const onBoard = [
	{ ID: 1,  FAMILY: 'Pinza PALLET',       DESCR: 'Pinza per pallet',                  SUB_POS: 0, POS_MAG: 4, POS_PLANT: 0,    STATUS: 2, STATUS_DESC: 'EMPTY' },
	{ ID: 26, FAMILY: 'Pinza pezzo DOPPIA', DESCR: 'Parte della pinza doppia',          SUB_POS: 3, POS_MAG: 3, POS_PLANT: 1000, STATUS: 4, STATUS_DESC: 'RAW' },
	{ ID: 37, FAMILY: 'Pinza pezzo DOPPIA', DESCR: 'Parte della pinza doppia - lato 2', SUB_POS: 3, POS_MAG: 3, POS_PLANT: 1000, STATUS: 2, STATUS_DESC: 'EMPTY' },
];
// la doppia A MAGAZZINO
const inShelf = onBoard.map(r => Object.assign({}, r, { POS_PLANT: 0 }));

function vmOf(comp) {
	const vm = Object.assign({}, comp.data.call({}));
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k, p) => k + (p ? ' ' + JSON.stringify(p) : '');
	return vm;
}
const tick = () => new Promise(r => setTimeout(r, 20));

console.log('1) util: una voce, ID canonico, twinIDs');
for (const [label, rows] of [['a bordo', onBoard], ['a magazzino', inShelf]]) {
	const d = dedupeGrippers(rows);
	check(d.length === 2 && d[1].ID === 26 && d[1].twinIDs.join('+') === '26+37', label + ': pallet + doppia(26, twinIDs 26+37)');
	check(isTwinGripper(d[1]) && !isTwinGripper(d[0]), label + ': isTwinGripper solo sulla doppia');
}
check(dedupeGrippers(onBoard)[1].onBoard === true && dedupeGrippers(inShelf)[1].onBoard === false, 'onBoard riflette POS_PLANT 1000');

console.log('\n2) Grating.vue: select pinza senza filtro SUB_POS<=1, doppia selezionabile, ID 26');
globalThis.fetch = async () => ({ ok: true, json: async () => onBoard });
const g = vmOf(Grating);
await g.getGripperList();
check(g.gripperList.length === 2 && g.gripperList[1].ID === 26, 'gripperList = pallet + doppia (26)');
g.grating.gripperIndex = 2; g.grating.pieceIndex = 0;   // onChangeGripper: GRIPPER_ID dal gripperList
g.grating.GRIPPER_ID = g.gripperList[g.grating.gripperIndex-1].ID;
check(g.grating.GRIPPER_ID === 26, 'selezione doppia -> GRIPPER_ID 26 (canonico)');
const gSrc = strip('src/views/conf/Grating/Grating.vue');
check(!/g\.SUB_POS<=1/.test(gSrc) && !/GRIPPER_ID\s*>\s*1000|Math\.trunc\(this\.grating\.GRIPPER_ID/.test(gSrc), 'via v-if SUB_POS<=1 e decodifica ID composito');
const gt = vmOf(GratingTest);
gt.getGripperList(); await tick();
check(gt.gripperList.length === 2 && gt.gripperList[1].ID === 26, 'GratingTest: stessa lista deduplicata');
check(!/g\.SUB_POS<=1/.test(strip('src/views/conf/Grating/GratingTest.vue')), 'GratingTest: via v-if SUB_POS<=1');

console.log('\n3) GrippersView: una riga per pinza, FAMILY visibile, badge doppia');
const gv = vmOf(GrippersView);
gv.getDataTable(); await tick();
check(gv.datiTab.length === 2 && gv.datiTab[1].ID === 26, 'datiTab = 2 righe, la doppia e\' la 26');
const gvTpl = readFileSync('src/views/conf/GrippersView.vue', 'utf8').slice(0, readFileSync('src/views/conf/GrippersView.vue', 'utf8').lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '');
check(!/dt\.SUB_POS==0|dt\.SUB_POS==1|dt\.SUB_POS>1|cell-joined|dt\.SUB_POS<=1/.test(gvTpl), 'via celle unite e gate move su SUB_POS');
check(/<td>\s*\{\{dt\.FAMILY\.trim\(\)\}\}/.test(gvTpl) && /isTwinGripper\(dt\)/.test(gvTpl) && /gripper\.twinBadge/.test(gvTpl), 'FAMILY sempre nella cella + badge twinBadge');
check(String(gv.calculatePos(1)).includes('ROBOT'), 'calculatePos: ROBOT per la doppia a bordo');
gv.datiTab = dedupeGrippers(inShelf);
check(gv.calculatePos(1) === 3, 'a magazzino: posizione = POS_MAG 3 (non piu\' "3.3")');

console.log('\n4) robotView: CARICA PINZA una voce, dialog di collaudo completo');
const rv = vmOf(robotView);
rv.grippersList = inShelf.filter(r => r.POS_PLANT != 1000);   // come getGrippersList
check(rv.grippersList.length === 3, 'grippersList (collaudo) COMPLETA: 3 righe, entrambe le gemelle');
check(rv.loadGrippersList.length === 2 && rv.loadGrippersList[1].ID === 26, 'loadGrippersList (carica): pallet + doppia (26)');
rv.dialog.type = 'gripper';
check(rv.dialogItems.length === 2 && rv.dialogItems[1].ID === 26, 'dialog CARICA PINZA usa la lista deduplicata');
const rvSrc = strip('src/views/unit/robotView.vue');
check(/v-for="g in grippersList"/.test(readFileSync('src/views/unit/robotView.vue', 'utf8')), 'il dialog di collaudo itera ancora grippersList (intatto)');
check(/g => g\.POS_PLANT != 1000/.test(rvSrc), 'filtro POS_PLANT != 1000 conservato');
rv.grippersList = onBoard.filter(r => r.POS_PLANT != 1000);
check(rv.loadGrippersList.length === 1 && rv.loadGrippersList[0].ID === 1, 'doppia a bordo: in CARICA resta solo la pallet');

console.log('\n5) backend: updateGripper non azzera piu\' SUB_POS');
const be = readFileSync('../serverDati/CONF/Gripper.js', 'utf8');
const upd = be.slice(be.indexOf("router.get('/updateGripper'"), be.indexOf("router.get('/insertGripper'") > 0 ? be.indexOf("router.get('/insertGripper'") : be.length);
check(!/SUB_POS\s*=\s*0/.test(upd.replace(/\/\/[^\n]*/g, '')), "nessun 'SUB_POS=0' nell'UPDATE GRIPPER");

console.log('\n6) selectGripper importa dalla util (un punto solo)');
const sg = readFileSync('src/views/workOrder/selectGripper.vue', 'utf8');
check(/import \{ dedupeGrippers \} from '\.\.\/\.\.\/util\/grippers\.js'/.test(sg) && !/export function dedupeGrippers/.test(sg), 'nessuna copia locale di dedupeGrippers');

console.log('\n7) rotta /conf/Gratingtest rimossa, gemella raggiungibile da GrippersView');
const routerSrc = readFileSync('src/router/index.js', 'utf8').replace(/\/\/[^\n]*/g, '');
check(!/Gratingtest|GratingTest\.vue/i.test(routerSrc), 'nessuna rotta ne\' import di GratingTest nel router attivo');
// (createWebHistory richiede window.history: verifica statica delle path)
const paths = [...routerSrc.matchAll(/path:\s*["']([^"']+)["']/g)].map(m => m[1].toLowerCase());
check(!paths.includes('/conf/gratingtest') && paths.includes('/conf/importgrating') && paths.includes('/conf/gratings'), '/conf/gratingtest non e\' tra le rotte (importGrating e Gratings si\')');
check(/twin-link/.test(gvTpl2()) && /modifyGripper\(tid\)/.test(gvTpl2()) && /gripper\.twinOpen/.test(gvTpl2()), 'GrippersView: link per aprire la gemella (modifyGripper per ID)');
function gvTpl2() { const s = readFileSync('src/views/conf/GrippersView.vue', 'utf8'); return s.slice(0, s.lastIndexOf('</template>')); }
let pushedTo = '';
gv.$router = { push: p => { pushedTo = p; } };
gv.modifyGripper(37);
check(pushedTo === '/conf/gripper/gripper?gripperID=37', 'apre il form della gemella 37');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
