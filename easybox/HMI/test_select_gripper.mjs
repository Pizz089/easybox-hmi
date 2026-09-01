// ============================================================================
// test_select_gripper.mjs — scelta pinza dell'ordine (selectGripper.vue):
// pinze a bordo selezionabili, UNA voce per la pinza doppia (righe gemelle),
// GRIPPER_ID canonico (ID minore) salvato nel wizard.
//
// Uso:   node test_select_gripper.mjs     (dalla cartella easybox/HMI)
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
const mod = await server.ssrLoadModule('/src/views/workOrder/selectGripper.vue');
const comp = mod.default, { dedupeGrippers } = mod;
const src = readFileSync('src/views/workOrder/selectGripper.vue', 'utf8');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// righe REALI della cella (api/conf/gripper/show/all = GRIPPERS sub_pos<1000
// order by FAMILY, pos_mag, sub_pos), con la doppia a bordo
const rows = [
	{ ID: 1,  FAMILY: 'Pinza PALLET',       DESCR: 'Pinza per pallet',                 SUB_POS: 0, POS_MAG: 4, POS_PLANT: 0,    STATUS: 2 },
	{ ID: 26, FAMILY: 'Pinza pezzo DOPPIA', DESCR: 'Parte della pinza doppia',         SUB_POS: 3, POS_MAG: 3, POS_PLANT: 1000, STATUS: 4 },
	{ ID: 37, FAMILY: 'Pinza pezzo DOPPIA', DESCR: 'Parte della pinza doppia - lato 2', SUB_POS: 3, POS_MAG: 3, POS_PLANT: 1000, STATUS: 2 },
];

console.log('1) via la fusione ID*1000 + subID');
// codice senza commenti (// e HTML): i commenti citano la vecchia fusione per storia
const code = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '');
check(!/\* ?1000/.test(code) && !/SUB_POS > 1/.test(code), 'nessuna fusione composita ne\' filtro SUB_POS>1 nel codice');

console.log('\n2) dedupe con la doppia a bordo: pallet + doppia, una voce sola');
const d = dedupeGrippers(rows);
check(d.length === 2, '2 voci (' + d.length + ')');
check(d[0].ID === 1 && d[0].onBoard === false, 'pinza pallet ID 1, non a bordo');
check(d[1].ID === 26 && d[1].FAMILY === 'Pinza pezzo DOPPIA', 'pinza doppia UNA voce, ID 26 (riga con ID minore)');
check(d[1].onBoard === true, 'doppia marcata "a bordo" (POS_PLANT 1000)');
check(!d.some(g => g.ID === 37) && !d.some(g => g.ID > 1000), 'niente riga 37 ne\' ID compositi');

console.log('\n3) dedupe: ordine delle gemelle e casi limite');
check(dedupeGrippers([rows[0], rows[2], rows[1]])[1].ID === 26, 'gemelle in ordine inverso (37 prima di 26): resta 26');
const inShelf = rows.map(r => Object.assign({}, r, { POS_PLANT: 0 }));
const s = dedupeGrippers(inShelf);
check(s.length === 2 && s[1].ID === 26 && s[1].onBoard === false, 'doppia a magazzino: una voce, non a bordo');
const twoOut = [
	{ ID: 5, FAMILY: 'A', SUB_POS: 0, POS_MAG: -1, POS_PLANT: -1 },
	{ ID: 6, FAMILY: 'B', SUB_POS: 0, POS_MAG: -1, POS_PLANT: -1 },
];
check(dedupeGrippers(twoOut).length === 2, 'due pinze DIVERSE fuori magazzino (POS_MAG<=0, stesso SUB_POS) restano due voci');
const twoSlots = [
	{ ID: 7, FAMILY: 'A', SUB_POS: 0, POS_MAG: 1, POS_PLANT: 0 },
	{ ID: 8, FAMILY: 'B', SUB_POS: 0, POS_MAG: 2, POS_PLANT: 0 },
];
check(dedupeGrippers(twoSlots).length === 2, 'stesso SUB_POS ma slot diversi: due voci (chiave = POS_MAG + SUB_POS)');
check(dedupeGrippers([]).length === 0 && dedupeGrippers(null).length === 0, 'lista vuota/null -> vuota');

console.log('\n4) componente: getDataTable + nextStep salva il GRIPPER_ID giusto');
globalThis.fetch = async () => ({ ok: true, json: async () => rows });
const vm = Object.assign({}, comp.data.call({}));
for (const [k, f] of Object.entries(comp.methods)) vm[k] = f.bind(vm);
let pushed = '';
vm.$router = { push: p => { pushed = p; } };
vm.getDataTable();
await new Promise(r => setTimeout(r, 20));
check(vm.data.length === 2 && vm.data[1].ID === 26 && vm.data[1].onBoard === true, 'lista del componente: pallet + doppia (26, a bordo)');
vm.nextStep(vm.data[1].ID);
check(dataStored.createWorkOrder.gripperID === 26, 'createWorkOrder.gripperID = 26 (-> insertOrder GRIPPER_ID)');
check(pushed === '/selectMC', 'passo successivo: selectMC');

console.log('\n5) template: etichetta a bordo, nessun blocco');
const tpl = src.slice(0, src.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '');
check(/v-if="p\.onBoard"[^>]*>\{\{ \$t\('wizard\.gripper\.onBoard'\) \}\}/.test(tpl), 'suffisso i18n wizard.gripper.onBoard');
check(/@click="nextStep\(p\.ID\)"/.test(tpl) && !/onBoard\s*\?/.test(tpl), 'la card resta cliccabile anche a bordo');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
