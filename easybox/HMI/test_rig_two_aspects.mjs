// ============================================================================
// test_rig_two_aspects.mjs — cantiere rig-two-aspects (15/9), lato pannello.
//
// MODELLO: la GEOMETRIA (riga FIXTURE_ON_PALLET) c'e' SEMPRE — il PLC somma
// FIXTURE.Z alla quota di deposito in macchina e non conosce VICE; la MORSA
// aggiunge il comportamento (ciclo EasyBox pieno). Morsa senza geometria =
// stato INCOMPLETO, visibile a pannello, mai ordini: e' lo stato che il 15/9
// e' uscito come errore 799 col robot gia' in movimento.
//
//  1. rigging.js: stati e FIXTURE_ID dell'ordine
//  2. selectRig: incompleto non selezionabile, ramo morsa che porta la geometria
//  3. Attrezzaggio: la morsa richiede la geometria, salvataggio via upsert
//  4. AttrezzaggiView: badge dell'incompleto e Modifica offerta per completarlo
// Componenti REALI via Vite ssrLoadModule.
//
// Uso:   node test_rig_two_aspects.mjs     (dalla cartella easybox/HMI)
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
const { buildRigRows, rigState, rigComplete, rigFixtureId } = await server.ssrLoadModule('/src/util/rigging.js');
const selectRig = (await server.ssrLoadModule('/src/views/workOrder/selectRig.vue')).default;
const Attrezzaggio = (await server.ssrLoadModule('/src/views/conf/Attrezzaggio.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = () => new Promise(r => setTimeout(r, 20));
function vmOf(comp, extra) {
	const vm = Object.assign({}, comp.data.call({}), extra || {});
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k, p) => k + (p ? ' ' + Object.entries(p).map(([a, b]) => a + '=' + b).join(',') : '');
	return vm;
}
globalThis.alert = () => {};
dataStored.alert = { title: '', desc: '', type: '' };

// dati come in cella: pallet 9 con la MORSA e senza geometria (stato del 15/9),
// pallet 2 attrezzatura sola, pallet 3 morsa + geometria (completo), pallet 1 nudo
const pallets = [{ ID: 1, FAMILY: 'P1' }, { ID: 2, FAMILY: 'P2' }, { ID: 3, FAMILY: 'P3' }, { ID: 9, FAMILY: 'P9' }];
const vices = [{ ID: 7, FAMILY: 'Morsa', DESCR: '158', PALLET_ID: 9, X: 0, Y: 0, Z: 0, Z_CLAW: 0, Z_SINK_CLAW: 0, MAG: 1, MAG_POS: 0, POS_PLANT: 0, STATUS: 2 },
               { ID: 8, FAMILY: 'Morsa2', DESCR: '', PALLET_ID: 3, X: 0, Y: 0, Z: 0, Z_CLAW: 0, Z_SINK_CLAW: 0, MAG: 1, MAG_POS: 0, POS_PLANT: 0, STATUS: 2 }];
const fixtures = [{ ID: 1, FAMILY: 'Morsa 158 + pallet 38', DESCR: 'misurata 1/9', Z: 176000 }];
const fop = [{ PALLET_ID: 2, FIXTURE_ID: 1, POS_X: 0, POS_Y: 0, POS_Z: 0, POS_X_CORR: 0, POS_Y_CORR: 0, POS_Z_CORR: 0, POS_X_ROT: 0, POS_Y_ROT: 0, POS_Z_ROT: 0 },
             { PALLET_ID: 3, FIXTURE_ID: 1, POS_X: 1500, POS_Y: 0, POS_Z: 0, POS_X_CORR: 250, POS_Y_CORR: 0, POS_Z_CORR: 0, POS_X_ROT: 0, POS_Y_ROT: 0, POS_Z_ROT: 0 }];

console.log('1) rigging.js: stati del modello a due aspetti');
const rows = buildRigRows(pallets, vices, fop);
const st = id => rigState(rows.find(r => r.pallet.ID == id));
check(st(1) === 'bare', 'pallet nudo -> bare');
check(st(2) === 'fixture', 'attrezzatura sola -> fixture (lavorazione speciale)');
check(st(3) === 'vice', 'morsa PIU\' geometria -> vice COMPLETO (prima era anomalia)');
check(st(9) === 'vice-incomplete', 'morsa SENZA geometria -> vice-incomplete (era lo stato del pallet 9 il 15/9)');
check(rigState({ pallet: { ID: 5 }, vice: null, fixtures: [{ FIXTURE_ID: 1 }, { FIXTURE_ID: 2 }] }) === 'anomaly', 'due attrezzature sullo stesso pallet -> anomaly');
check(rigComplete('vice') && rigComplete('fixture') && !rigComplete('vice-incomplete') && !rigComplete('bare') && !rigComplete('anomaly'), 'completi: solo vice e fixture');
check(rigFixtureId(rows.find(r => r.pallet.ID == 3)) === 1, 'ramo MORSA: FIXTURE_ID dell\'ordine = quello della geometria');
check(rigFixtureId(rows.find(r => r.pallet.ID == 2)) === 1, 'ramo ATTREZZATURA: stesso criterio');
check(rigFixtureId(rows.find(r => r.pallet.ID == 9)) === 0, 'stato incompleto: 0, cioe\' nessun ordine');

console.log('\n2) selectRig: gate e FIXTURE_ID scritto nell\'ordine');
const sr = vmOf(selectRig, { $router: { push: () => {} } });
sr.pallets = pallets; sr.vices = vices; sr.fixtures = fixtures; sr.fop = fop;
const row = id => sr.rows.find(r => r.pallet.ID == id);
check(sr.isSelectable(row(3)) && sr.isSelectable(row(2)), 'pallet completi: selezionabili');
check(!sr.isSelectable(row(9)) && !sr.isSelectable(row(1)), 'incompleto e nudo: NON selezionabili');
check(sr.selectableRows.length === 2, 'due pallet utilizzabili su quattro');
dataStored.emptingStructure();
sr.pick(row(3));
check(dataStored.createWorkOrder.rigType === 'vice' && dataStored.createWorkOrder.palletID === 3, 'scelto il pallet 3: ramo morsa');
check(dataStored.createWorkOrder.fixtureID === 1, 'il ramo MORSA porta la geometria (prima scriveva 0: causa del 799)');
check(dataStored.createWorkOrder.pieceID === -1 && dataStored.createWorkOrder.gripperID === 0, 'ramo morsa: pezzo e pinza si scelgono dopo');
dataStored.emptingStructure();
sr.pick(row(2));
check(dataStored.createWorkOrder.rigType === 'fixture' && dataStored.createWorkOrder.fixtureID === 1 && dataStored.createWorkOrder.pieceID === 0 && dataStored.createWorkOrder.gripperID === 0, 'ramo attrezzatura: convenzioni PLC invariate, geometria presente');
dataStored.emptingStructure();
sr.pick(row(9));
check(dataStored.createWorkOrder.palletID === -1, 'click su un pallet incompleto: nessuna scelta registrata');
const srcSR = readFileSync('src/views/workOrder/selectRig.vue', 'utf8');
check(/attrezzaggi\.incompleteHint/.test(srcSR), 'la scheda dice PERCHE\' non e\' selezionabile');

console.log('\n3) Attrezzaggio: la morsa richiede la geometria');
const calls = [];
globalThis.fetch = async (url, opt) => {
	const u = String(url).replace(dataStored.server, '');
	calls.push({ u, method: (opt && opt.method) || 'GET' });
	const j = u.includes('pallet/show') ? pallets : u.includes('vice/show') ? vices : u.includes('fixture/show') ? fixtures : u.includes('showFixtureOnPallet') ? fop : [];
	return { ok: true, json: async () => j, text: async () => 'OK' };
};
const az = vmOf(Attrezzaggio, { $route: { query: {} }, $router: { push: () => {}, replace: () => {} } });
az.pallets = pallets; az.vices = vices; az.fixtures = fixtures; az.fop = fop;
az.palletID = 1; az.rigType = 'vice'; az.viceID = 7;
check(az.canSave === false, 'morsa scelta ma geometria mancante: NON si salva');
az.fixtureID = 1;
check(az.canSave === true, 'con la geometria: si salva');
az.rigType = 'fixture'; az.viceID = 0;
check(az.canSave === true, 'ramo attrezzatura: basta l\'attrezzatura');
az.rigType = 'vice'; az.viceID = 7; az.fixtureID = 1;
calls.length = 0;
await az.saveData(); await tick();
const vice = calls.find(c => c.u.includes('updateVice'));
const geom = calls.find(c => c.u.includes('updateFixtureOnPallet'));
check(!!vice && /PALLET_ID=1(&|$)/.test(vice.u), 'monta la morsa sul pallet scelto');
check(!!geom && /PALLET_ID=1/.test(geom.u) && /FIXTURE_ID=1/.test(geom.u), 'scrive ANCHE la geometria, con l\'upsert');
check(calls.findIndex(c => c.u.includes('updateVice')) < calls.findIndex(c => c.u.includes('updateFixtureOnPallet')), 'prima la morsa, poi la geometria');
check(!calls.some(c => c.u.includes('insertFixtureOnPallet')), 'un solo endpoint per la geometria: l\'upsert (niente insert separata)');
// esito nel corpo: "KO" non deve piu' passare per successo
globalThis.fetch = async () => ({ ok: true, json: async () => [], text: async () => 'KO' });
let alerted = '';
globalThis.alert = m => { alerted = String(m); };
await az.saveData(); await tick();
check(alerted.includes('attrezzaggi.editIncomplete'), 'risposta "KO" con stato 200: il salvataggio NON passa per riuscito');
globalThis.alert = () => {};
const srcAZ = readFileSync('src/views/conf/Attrezzaggio.vue', 'utf8');
check(/att-geom/.test(srcAZ) && /attrezzaggi\.geometryHint/.test(srcAZ), 'il form chiede la geometria nel ramo morsa, col motivo');
check(/b\.indexOf\('KO'\) === 0/.test(srcAZ), 'controllo dell\'esito nel corpo condiviso da creazione e modifica');

console.log('\n4) AttrezzaggiView: incompleto visibile e completabile');
const srcAV = readFileSync('src/views/conf/AttrezzaggiView.vue', 'utf8');
check(/rowState\(row\)=='vice-incomplete'/.test(srcAV) && /attrezzaggi\.incomplete'/.test(srcAV), 'badge dedicato per l\'attrezzaggio incompleto');
check(/incomplete-hint/.test(srcAV), 'motivo scritto sotto il badge');
check(/rowState\(row\)!='bare' && rowState\(row\)!='anomaly'/.test(srcAV), 'Modifica offerta anche sull\'incompleto: e\' da li\' che si completa');
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
const fi = flat(it), fe = flat(en);
check(fi.length === fe.length && fi.every(k => fe.includes(k)), 'i18n it/en allineati (' + fi.length + ' chiavi)');
check(fi.includes('attrezzaggi.incomplete') && fi.includes('attrezzaggi.geometry') && fi.includes('wizard.lastData.geometryMissing'), 'chiavi nuove presenti');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
