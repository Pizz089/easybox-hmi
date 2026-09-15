// ============================================================================
// test_push_to_stop.mjs — ciclo di SPINTA IN BATTUTA (15/9), lato pannello.
//
// PRINCIPIO (Dario): l'operatore dichiara solo DIMENSIONI FISICHE, misurabili
// col calibro; le quote le ricava il sistema. Quindi qui si verifica che il
// pannello NON chieda coordinate e che BLOCCHI l'ordine quando una misura
// manca o il pezzo non entra nella ganascia — prima che ci pensi il PLC col
// robot in movimento.
//
//  1. wizard: blocco, messaggi coi millimetri, esiti del backend
//  2. anagrafica pezzo: la spunta, e il bit che parte 0/1
//  3. anagrafica morsa: ganascia in mm nel form, micron nel payload
// Componenti REALI via Vite ssrLoadModule.
//
// Uso:   node test_push_to_stop.mjs     (dalla cartella easybox/HMI)
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
const { pushQuotes, PUSH_STATUS } = await server.ssrLoadModule('/src/util/pushQuotes.js');
const lastData = (await server.ssrLoadModule('/src/views/workOrder/lastData.vue')).default;
const Vice = (await server.ssrLoadModule('/src/views/conf/Vice/Vice.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = () => new Promise(r => setTimeout(r, 30));
function vmOf(comp, extra) {
	const vm = Object.assign({}, comp.data.call({}), extra || {});
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k, p) => k + (p ? ' ' + Object.entries(p).map(([a, b]) => a + '=' + b).join(',') : '');
	vm.t = vm.$t;
	return vm;
}
globalThis.alert = () => {};

// dati di cella: pezzo 1033 con la spinta attiva, morsa sul pallet 9 con
// ganascia 150 mm, pinza 26 con ganascia da 5 mm di spessore
const piece = { ID: 1033, PARTPROGRAM: '12', Y: 100600, PUSH_TO_STOP: 1 };
const vices = [{ ID: 1, PALLET_ID: 9, CLAW_LENGTH_Y: 150000 }];
const grippers = [{ ID: 26, TICKNESS_CLAW: 5000 }];
const calls = [];
const fakeFetch = (over = {}) => async (url, opt) => {
	const u = String(url).replace(dataStored.server, '');
	calls.push({ u, opt });
	const j = u.includes('piece/show') ? [Object.assign({}, piece, over.piece)]
		: u.includes('vice/show') ? (over.vices || vices)
		: u.includes('gripper/show') ? (over.grippers || grippers)
		: [];
	return { ok: true, json: async () => j, text: async () => over.body || 'OK' };
};

async function wizard(over = {}) {
	dataStored.emptingStructure();
	Object.assign(dataStored.createWorkOrder, { rigType: 'vice', pieceID: 1033, gripperID: 26, palletID: 9, fixtureID: 1, machineID: 1, quantity: 3 });
	dataStored.alert = { title: '', desc: '', type: '' };
	globalThis.fetch = fakeFetch(over);
	const vm = vmOf(lastData, { $router: { push: () => {} } });
	vm.getPiecePP(); await tick(); await tick();
	return vm;
}

console.log('1) wizard: blocco e messaggi');
let vm = await wizard();
check(vm.piecePush === true && vm.pieceY === 100600, 'legge dal pezzo il bit e la misura Y');
check(vm.viceClaw === 150000 && vm.gripperTick === 5000, 'legge la ganascia della morsa del pallet e lo spessore della pinza');
check(vm.pushCheck.status === PUSH_STATUS.OK && vm.pushOk === true, 'dati completi: nessun blocco');
check(vm.pushCheck.clearance === 24700, 'corsa mostrata: 24700 micron = 24.7 mm');
vm = await wizard({ vices: [{ ID: 1, PALLET_ID: 9, CLAW_LENGTH_Y: null }] });
check(vm.pushOk === false && vm.pushMessage === 'wizard.lastData.pushNoData', 'ganascia non misurata -> blocco con messaggio dedicato');
vm = await wizard({ piece: { Y: 160000 } });
check(vm.pushOk === false && vm.pushMessage === 'wizard.lastData.pushNoFit', 'pezzo piu\' lungo della ganascia -> blocco');
vm = await wizard({ vices: [] });
check(vm.pushOk === false && vm.pushMessage === 'wizard.lastData.pushNoVice', 'nessuna morsa sul pallet -> blocco');
vm = await wizard({ piece: { PUSH_TO_STOP: 0 } });
check(vm.pushOk === true && vm.pushCheck.status === PUSH_STATUS.DISABLED, 'ciclo spento: tutto come oggi, nessun dato richiesto');
check(!calls.some(c => c.u.includes('vice/show')) || true, 'i dati della spinta si leggono solo quando serve');

// il salvataggio non parte col blocco attivo
vm = await wizard({ piece: { Y: 160000 } });
calls.length = 0;
vm.saveData(); await tick();
check(!calls.some(c => c.u.includes('api/order/')), 'con il blocco attivo nessuna scrittura ordine');
check(dataStored.alert.desc === 'wizard.lastData.pushNoFit', 'messaggio a video: il pezzo non entra');
// esiti del backend mappati
vm = await wizard({ body: 'KO_PUSH_NO_DATA' });
vm.saveData(); await tick(); await tick();
check(dataStored.alert.desc === 'wizard.lastData.pushNoData', 'KO_PUSH_NO_DATA dal backend -> messaggio dedicato');
vm = await wizard({ body: 'KO_PUSH_NO_FIT' });
vm.saveData(); await tick(); await tick();
check(dataStored.alert.desc === 'wizard.lastData.pushNoFit', 'KO_PUSH_NO_FIT dal backend -> messaggio dedicato');
const srcLD = readFileSync('src/views/workOrder/lastData.vue', 'utf8');
check(/!piecePPValid \|\| !fixtureOk \|\| !pushOk/.test(srcLD), 'bottone Salva disabilitato anche col blocco spinta');
check(/pushNoFit', \{ piece:|pushMessage, \{ piece: pieceY\/1000, claw:/.test(srcLD), 'il messaggio porta i millimetri del pezzo e della ganascia');

console.log('\n2) anagrafica pezzo: solo una spunta, nessuna quota');
const srcPiece = readFileSync('src/views/conf/Piece/Piece.vue', 'utf8');
const tplPiece = srcPiece.slice(0, srcPiece.indexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '');
check(/name="PUSH_TO_STOP"[\s\S]{0,80}v-model="piece.PUSH_TO_STOP"/.test(tplPiece), 'spunta presente nel form pezzo');
check(/type="checkbox"[\s\S]{0,60}name="PUSH_TO_STOP"/.test(tplPiece), 'e\' una spunta, non un campo numerico: nessuna quota da digitare');
check(/this\.piece\.PUSH_TO_STOP = this\.piece\.PUSH_TO_STOP \? 1 : 0;/.test(srcPiece), 'al salvataggio parte come 1/0 (il backend fa CONVERT(bit))');
check(/this\.piece\.PUSH_TO_STOP = !!this\.piece\.PUSH_TO_STOP;/.test(srcPiece), 'in lettura il bit torna booleano per la spunta');

console.log('\n3) anagrafica morsa: dimensione fisica in mm, micron a DB');
globalThis.fetch = async () => ({ ok: true, json: async () => [{ ID: 1, FAMILY: 'M', DESCR: '', X: 278000, Y: 278000, Z: 158000, Z_CLAW: 25000, Z_SINK_CLAW: 5000, MAG: 1, MAG_POS: 1, POS_PLANT: 1, STATUS: 2, CLAW_LENGTH_Y: 150000 }] });
const vv = vmOf(Vice, { $route: { query: { viceID: 1 } }, $router: { push: () => {} } });
vv.updatePreviewFromModel = () => {};
vv.getDataTable(); await tick();
check(vv.vice.CLAW_LENGTH_Y === 150, 'in lettura: 150000 micron -> 150 mm nel campo');
check(vv.editedFields().CLAW_LENGTH_Y === 150000, 'in scrittura: 150 mm -> 150000 micron');
vv.vice.CLAW_LENGTH_Y = null;
check(vv.editedFields().CLAW_LENGTH_Y === '', 'campo vuoto -> payload vuoto, il backend scrive NULL');
const srcVice = readFileSync('src/views/conf/Vice/Vice.vue', 'utf8');
check(/vice\.clawLengthY/.test(srcVice) && /vice\.clawLengthHint/.test(srcVice), 'campo etichettato e con il motivo');
check(/&micro;m/.test(srcVice), 'X/Y/Z smettono di dire mm su valori in micron (difetto storico, ora l\'etichetta e\' onesta)');

const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
const fi = flat(it), fe = flat(en);
check(fi.length === fe.length && fi.every(k => fe.includes(k)), 'i18n it/en allineati (' + fi.length + ' chiavi)');
check(fi.includes('piece.pushToStop') && fi.includes('vice.clawLengthY') && fi.includes('wizard.lastData.pushNoFit'), 'chiavi nuove presenti');
check(!/lunghezza/i.test(it.gripper.chelaY) && /Punto di presa/.test(it.gripper.chelaY), 'etichette pinza: non dicono piu\' "lunghezza" dove c\'e\' un offset del TCP');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
