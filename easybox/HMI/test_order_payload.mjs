// ============================================================================
// test_order_payload.mjs — il wizard ordine non mostra ne' invia piu' gli 8
// decentramenti X/Y: componente lastData.vue REALE via Vite ssrLoadModule,
// data.js reale, fetch finto per catturare la query string dell'insert.
//
// Uso:   node test_order_payload.mjs     (dalla cartella easybox/HMI)
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const comp = (await server.ssrLoadModule('/src/views/workOrder/lastData.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = () => new Promise(r => setTimeout(r, 20));

console.log('1) data.js: createWorkOrder senza decentramenti, anche dopo emptingStructure');
const keys = () => Object.keys(dataStored.createWorkOrder);
check(!keys().some(k => /decentrated/i.test(k)), 'nessuna chiave decentrated_* (' + keys().length + ' chiavi)');
dataStored.emptingStructure();
check(!keys().some(k => /decentrated/i.test(k)), 'idem dopo emptingStructure');

console.log('\n2) lastData.vue: nessun campo X/Y a schermo');
const src = readFileSync('src/views/workOrder/lastData.vue', 'utf8');
const tpl = src.slice(0, src.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '');
check(!/decentrated|positioning-card|xy-pair|xy-row/.test(tpl), 'template senza card Posizionamento e senza input decentrated_*');
check(/ld-quantity/.test(tpl) && /wizard\.lastData\.partProgram/.test(tpl) && /wizard\.lastData\.save/.test(tpl), 'restano quantita\', part program e Salva');
check(!/\*= 100/.test(src), 'niente piu\' conversione *100 nel save');
for (const k of ['positioningSection', 'positioningUnit', 'trayColumn', 'machineColumn', 'pickup', 'deposit'])
	check(!src.includes('lastData.' + k), 'chiave i18n orfana rimossa dall\'uso: ' + k);

console.log('\n3) creazione ordine: la query string dell\'insert non porta decentramenti');
const calls = [];
globalThis.fetch = async (url) => { calls.push(String(url)); return { ok: true, json: async () => [{ PARTPROGRAM: '12' }] }; };
const vm = Object.assign({}, comp.data.call({}));
for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
for (const [k, c] of Object.entries(comp.computed || {}))
	Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
vm.$router = { push: () => {} };
dataStored.createWorkOrder.rigType = 'vice';
dataStored.createWorkOrder.pieceID = 1029;
dataStored.createWorkOrder.gripperID = 26;
dataStored.createWorkOrder.palletID = 5;
dataStored.createWorkOrder.machineID = 1;
dataStored.createWorkOrder.quantity = 3;
vm.getPiecePP(); await tick();
check(vm.piecePPValid === true && vm.piecePP === 12, 'part program dal particolare: 12');
vm.saveData(); await tick();
const insert = calls.find(u => u.includes('api/order/insertOrder?'));
check(!!insert, 'chiamato api/order/insertOrder');
const params = new URLSearchParams(insert.split('?')[1]);
check(![...params.keys()].some(k => /decentrated/i.test(k)), 'query string senza decentrated_* (' + [...params.keys()].join(',') + ')');
check(params.get('pieceID') === '1029' && params.get('gripperID') === '26' && params.get('quantity') === '3' && params.get('PP') === '12', 'pezzo, pinza, quantita\', PP presenti');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
