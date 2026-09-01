// ============================================================================
// test_reset_dialogs.mjs — dialog dei comandi di ripristino (1/9):
// productionView "Azzera produzione" e layoutView "Azzera stato cassetto".
// Componenti REALI via Vite ssrLoadModule, fetch finto: niente parte senza
// conferma, la conferma chiama l'endpoint giusto col metodo giusto.
//
// Uso:   node test_reset_dialogs.mjs     (dalla cartella easybox/HMI)
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const { KO_CELL_RUNNING, KO_ACTIVE_ORDER } = await server.ssrLoadModule('/src/util/errorCodes.js');
const Prod = (await server.ssrLoadModule('/src/views/productionView.vue')).default;
const Layout = (await server.ssrLoadModule('/src/views/layoutView.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = () => new Promise(r => setTimeout(r, 20));
const calls = [];
let responder = () => ({ ok: true, body: '' });
globalThis.fetch = async (url, opt) => {
	calls.push({ url: String(url).replace(dataStored.server, ''), method: (opt && opt.method) || 'GET' });
	const r = responder(String(url));
	return { ok: r.ok !== false, text: async () => r.body, json: async () => JSON.parse(r.body) };
};
function vmOf(comp, extra) {
	const vm = Object.assign({}, comp.data.call({}), extra || {});
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k, p) => k + (p ? ' ' + JSON.stringify(p) : '');
	return vm;
}
const posts = () => calls.filter(c => c.method === 'POST');

console.log('1) AZZERA PRODUZIONE: anteprima con numeri veri, niente POST senza conferma');
const preview = { orders: [{ ID: 12, PIECE_ID: 1029, PIECE: 'Pezzo di prova Rizzo' }], positions: 7, robotStatus: 15, blocked: null };
responder = url => url.includes('/preview/') ? { body: JSON.stringify(preview) } : { body: JSON.stringify({ ris: 'OK', orders: 1, positions: 7 }) };
const pv = vmOf(Prod);
pv.openResetDialog(); await tick();
check(pv.reset.open && calls[0].url === 'api/order/resetProduction/preview/1' && calls[0].method === 'GET', 'apertura -> GET anteprima MC1');
check(pv.reset.preview && pv.reset.preview.orders.length === 1 && pv.reset.preview.positions === 7, 'anteprima nel dialog: #12, 7 posizioni');
check(posts().length === 0, 'nessun POST prima della conferma');
check(pv.resetConfirmEnabled === true, 'conferma abilitata (ordini presenti, cella ferma)');
pv.closeResetDialog();
check(!pv.reset.open && posts().length === 0, 'annulla: niente POST');
pv.openResetDialog(); await tick();
pv.confirmReset(); await tick();
check(posts().length === 1 && posts()[0].url === 'api/order/resetProduction/1', 'conferma -> POST resetProduction/1');
check(!pv.reset.open && String(dataStored.alert.desc).includes('production.reset.done'), 'esito OK mostrato, dialog chiuso');

console.log('\n2) AZZERA PRODUZIONE: bloccato a cella in lavorazione / senza ordini');
calls.length = 0;
responder = () => ({ body: JSON.stringify(Object.assign({}, preview, { blocked: KO_CELL_RUNNING, robotStatus: 3 })) });
pv.openResetDialog(); await tick();
check(pv.resetConfirmEnabled === false, 'anteprima bloccata (robot in missione): conferma spenta');
pv.confirmReset(); await tick();
check(posts().length === 0, 'conferma forzata: nessun POST');
responder = () => ({ body: JSON.stringify({ orders: [], positions: 0, robotStatus: 15, blocked: null }) });
pv.openResetDialog(); await tick();
check(pv.resetConfirmEnabled === false, 'nessun ordine STATUS=3: conferma spenta (niente da azzerare)');
responder = url => url.includes('/preview/') ? { body: JSON.stringify(preview) } : { body: JSON.stringify({ ris: KO_CELL_RUNNING, orders: 0, positions: 0 }) };
pv.openResetDialog(); await tick(); pv.confirmReset(); await tick();
check(dataStored.alert.desc === 'production.reset.cellRunning', 'rifiuto del backend (KO_CELL_RUNNING) mostrato');

console.log('\n3) AZZERA STATO CASSETTO: dialog con avviso, POST solo su conferma');
calls.length = 0;
const lv = vmOf(Layout, { $route: { params: { floorMag: '9', trayID: '30', modifyEnable: '1' } } });
lv.listPz = new Array(91).fill({ x: 0, y: 0, status: 2 });
lv.openTrayReset();
check(lv.trayReset.open && calls.length === 0, 'apertura: niente chiamate');
lv.trayReset.open = false;
check(calls.length === 0, 'annulla: niente chiamate');
responder = url => url.includes('resetTray') ? { body: JSON.stringify({ ris: 'OK', positions: 91 }) } : { body: '[]' };
lv.openTrayReset(); lv.confirmTrayReset(); await tick();
check(posts().length === 1 && posts()[0].url === 'api/conf/position/resetTray/9', 'conferma -> POST resetTray/9');
check(!lv.trayReset.open && String(dataStored.alert.desc).includes('layout.reset.done'), 'esito OK, dialog chiuso, ricarica layout');
responder = () => ({ body: JSON.stringify({ ris: KO_ACTIVE_ORDER, positions: 0 }) });
lv.openTrayReset(); lv.confirmTrayReset(); await tick();
check(dataStored.alert.desc === 'layout.reset.activeOrder', 'rifiuto backend (ordine attivo) mostrato');

console.log('\n4) template: avvisi presenti, "Tutti grezzi" invariato');
const lsrc = readFileSync('src/views/layoutView.vue', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
check(/layout\.reset\.warn/.test(lsrc) && /layout\.reset\.what/.test(lsrc), 'dialog cassetto: cosa cambia + avviso "dichiara pieno di grezzi"');
check(/allRaugh\(\)\{[\s\S]*?this\.listPz\[i\]\.status = 4;/.test(lsrc), '"Tutti grezzi" resta la modifica locale (status 4, scritta col Save!)');
const psrc = readFileSync('src/views/productionView.vue', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
check(/production\.reset\.notPhysical/.test(psrc) && /production\.reset\.ordersLabel/.test(psrc) && /production\.reset\.positionsLabel/.test(psrc), 'dialog produzione: elenco ordini, posizioni, avviso stato fisico');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
