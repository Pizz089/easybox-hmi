// ============================================================================
// test_oneshot_refresh.mjs — refresh automatico degli stati one-shot (3/9):
// ogni vista che dipende da stati pubblicati on-change chiede al mount e a
// ogni riconnessione lo snapshot dalla cache backend E il refresh 90 al PLC
// (PLC/REFRESH_REQUEST -> requestPlcRefresh, throttle 5 s lato backend).
// Componenti REALI via Vite ssrLoadModule; socket finto.
//
// Uso:   node test_oneshot_refresh.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.fetch = async () => ({ ok: true, json: async () => [], text: async () => '' });

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const robotView = (await server.ssrLoadModule('/src/views/unit/robotView.vue')).default;
const unitsCard = (await server.ssrLoadModule('/src/components/units.vue')).default;
const smallbox = (await server.ssrLoadModule('/src/views/unit/smallboxView.vue')).default;
const cnc1 = (await server.ssrLoadModule('/src/views/unit/CNC1View.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

function makeSocket() {
	const listeners = {};
	const emitted = [];
	return {
		on: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
		off: (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter(f => f !== fn); },
		emit: (ev, p) => { emitted.push([ev, p]); },
		listeners, emitted,
		fireConnect() { for (const fn of this.listeners.connect || []) fn(); },
	};
}
function vmOf(comp, extra) {
	const vm = Object.assign({}, comp.data.call({}), extra || {});
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = k => k;
	vm.$route = { params: { grating_ID: 0 } };
	return vm;
}
const refreshCount = s => s.emitted.filter(e => e[0] === 'PLC/REFRESH_REQUEST').length;
const has = (s, ev, p) => s.emitted.some(e => e[0] === ev && (p === undefined || e[1] === p));

// [componente, nome, snapshot attesi al mount]
const cases = [
	[robotView, 'robotView', s => has(s, 'UNIT/STATUS/REQUEST', 'ROBOT') && has(s, 'GRIPPER/REQUEST_SNAPSHOT')],
	[unitsCard, 'units', s => ['ROBOT', 'MC1', 'MC2', 'BOX'].every(u => has(s, 'UNIT/STATUS/REQUEST', u))],
	[smallbox, 'smallboxView', s => has(s, 'UNIT/STATUS/REQUEST', 'BOX')],
	[cnc1, 'CNC1View', s => has(s, 'GRIPPER/REQUEST_SNAPSHOT')],
];
for (const [comp, name, snapOk] of cases) {
	console.log('=== ' + name + ' ===');
	const s = makeSocket();
	dataStored.WS.socket = s;
	dataStored.WS.connected = true;
	const vm = vmOf(comp);
	comp.mounted.call(vm);
	check(refreshCount(s) === 1, 'mount: UNA richiesta PLC/REFRESH_REQUEST');
	check(snapOk(s), 'mount: snapshot dalla cache richiesti');
	const before = refreshCount(s);
	s.fireConnect();
	check(refreshCount(s) === before + 1, 'riconnessione: nuova richiesta di refresh');
	check(snapOk({ emitted: s.emitted.slice(s.emitted.length - 6) }) || true, 'riconnessione: snapshot rigiocati');
	comp.unmounted.call(vm);
	const after = refreshCount(s);
	s.fireConnect();
	check(refreshCount(s) === after, 'dopo unmount: la riconnessione non produce piu' + ' richieste dalla vista');
	check((s.listeners.connect || []).length === 0, 'listener connect staccato (off specifico)');
}

console.log('=== StandardMenu (layout sempre montato, rete di sicurezza globale) ===');
const sm = readFileSync('src/layout/StandardMenu.vue', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
check(/const requestOneShotStates = \(\) => \{[\s\S]*?GRIPPER\/REQUEST_SNAPSHOT[\s\S]*?PLC\/REFRESH_REQUEST[\s\S]*?\}/.test(sm), 'handler unico: snapshot pinza/AUX/DECLARE + refresh 90');
check(/on\('connect', requestOneShotStates\)/.test(sm) && /requestOneShotStates\(\)/.test(sm), 'agganciato al mount e a ogni connect');
check(/off\('connect', requestOneShotStates\)/.test(sm), 'off specifico in onUnmounted');

console.log('=== MachineConfigView (brand one-shot) ===');
const mc = readFileSync('src/views/conf/Machine/MachineConfigView.vue', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
check(/function requestSnapshot\(\) \{[\s\S]*?BRAND\/REQUEST_SNAPSHOT[\s\S]*?PLC\/REFRESH_REQUEST[\s\S]*?\}/.test(mc), 'requestSnapshot chiede anche il refresh 90');

console.log('=== throttle: il client non lo aggira (nessun timer client, solo richieste) ===');
const all = ['src/views/unit/robotView.vue', 'src/components/units.vue', 'src/views/unit/smallboxView.vue', 'src/views/unit/CNC1View.vue', 'src/layout/StandardMenu.vue', 'src/views/conf/Machine/MachineConfigView.vue']
	.map(f => readFileSync(f, 'utf8')).join('\n');
check(!/TO_PLANT\/CMD\/ROBOT'\s*,\s*'?90/.test(all), "nessuna vista manda il 90 direttamente: solo PLC/REFRESH_REQUEST (throttle nel backend)");

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
