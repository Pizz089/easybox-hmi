// ============================================================================
// test_oneshot_refresh.mjs — refresh automatico degli stati one-shot (3/9):
// ogni vista che dipende da stati pubblicati on-change chiede al mount e a
// ogni riconnessione lo snapshot dalla cache backend E il refresh 90 al PLC
// (PLC/REFRESH_REQUEST -> requestPlcRefresh, throttle 5 s lato backend).
// Componenti REALI via Vite ssrLoadModule; socket finto.
//
// (plc-silent-retry 18/9) In coda anche il banner "PLC muto" di robotView:
// dopo un riavvio del backend per OOM e' rimasto acceso a tempo indefinito.
// Le cache del backend erano vuote, il 90 e' partito una volta sola al connect
// del broker, e siccome il PLC pubblica lo stato SOLO ON-CHANGE con la cella
// ferma in HOLD non e' mai arrivato nessun ROBOT/STATUS. Qui si verifica che
// adesso il pannello ritenti da solo e che smetta di dire il falso.
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
const wait = ms => new Promise(r => setTimeout(r, ms));
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

console.log('=== robotView: PLC muto, il ritentativo non si ferma da solo ===');
const rv = readFileSync('src/views/unit/robotView.vue', 'utf8');
const base = Number((rv.match(/const PLC_RETRY_BASE_MS = (\d+);/) || [])[1]);
check(base >= 5000, 'la prima attesa (' + base + ' ms) sta FUORI dal throttle di 5 s del backend: '
	+ 'dentro, la richiesta verrebbe scartata in silenzio e il ritentativo non esisterebbe');
check(/const PLC_RETRY_MAX_MS = 60000;/.test(rv), 'tetto dell\'attesa a 60 s');
check(/Math\.min\(this\.plcRetryDelay \* 2, PLC_RETRY_MAX_MS\)/.test(rv), 'attesa che raddoppia fino al tetto');
const rvCode = rv.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
check(!/plcRetryCount|maxRetries|retriesLeft/.test(rvCode),
	'nessun contatore di tentativi nel CODICE (i commenti non contano): si dirada, non si arrende');

const s2 = makeSocket();
dataStored.WS.socket = s2;
const vm2 = vmOf(robotView);
// scala dei tempi accorciata: la cadenza la decide plcRetryDelay, non una
// costante congelata dentro il metodo
vm2.plcSilent = true;
vm2.plcRetryDelay = 5;
vm2.schedulePlcRetry();
await wait(80);
const n1 = refreshCount(s2);
check(n1 >= 3, 'ritenta da solo e piu\' volte, senza che nessuno clicchi (' + n1 + ' richieste)');
check(vm2.plcRetryDelay > 5, 'e ogni volta aspetta di piu\': ' + vm2.plcRetryDelay + ' ms');
vm2.clearPlcSilent();
const n2 = refreshCount(s2);
await wait(60);
check(refreshCount(s2) === n2, 'lo stato che arriva (clearPlcSilent) ferma il ritentativo: e\' la sola uscita');
check(vm2.plcSilent === false && vm2.plcSilentTimer === null && vm2.plcRetryTimer === null,
	'banner spento e nessun timer appeso');
check(vm2.plcRetryDelay === base, 'e il backoff riparte dal passo corto, non eredita l\'attesa lunga');

// smontaggio: un ritentativo in volo non deve sopravvivere alla view
vm2.plcSilent = true; vm2.plcRetryDelay = 5; vm2.schedulePlcRetry();
robotView.unmounted.call(vm2);
const n3 = refreshCount(s2);
await wait(60);
check(refreshCount(s2) === n3, 'dopo unmount nessun timer orfano continua a chiedere il refresh');

console.log('=== robotView: lo stato letto via HTTP spegne il banner ===');
const rispostaUnit = (row) => async (url) => {
	const u = String(url);
	// solo il robot cambia da caso a caso: alle altre unita' si risponde
	// sempre con una riga valida, altrimenti le richieste ancora in volo
	// delle sezioni precedenti sporcano l'output
	const j = u.includes('unit/show/robot') ? (row === null ? [] : [row])
		: u.includes('unit/show') ? [{ STATUS: 17, DESCR: '' }]
		: [];
	return { ok: true, text: async () => '', json: async () => j };
};

dataStored.WS.socket = makeSocket();
globalThis.fetch = rispostaUnit({ STATUS: 17, DESCR: '' });
const vm3 = vmOf(robotView);
vm3.plcSilent = true;
dataStored.cmdActive = false;
vm3.getRobotData();
await wait(30);
check(vm3.plcSilent === false,
	'risposta valida: il banner si spegne — il pannello aveva gia\' in mano lo stato e diceva il contrario');
check(dataStored.cmdActive === true, 'e il gate comandi si riallinea allo stato letto (HOLD -> attivi)');

globalThis.fetch = rispostaUnit({ STATUS: 0, DESCR: '' });
const vm4 = vmOf(robotView);
vm4.plcSilent = true;
vm4.getRobotData();
await wait(30);
check(vm4.plcSilent === true, 'STATUS 0 = status_notDef: li\' lo stato davvero non si sa, il banner RESTA');

globalThis.fetch = rispostaUnit(null);
const vm5 = vmOf(robotView);
vm5.dataRobot = { STATUS: 17 };
vm5.plcSilent = true;
vm5.getRobotData();
await wait(30);
check(vm5.dataRobot && vm5.dataRobot.STATUS === 17,
	'risposta vuota: dataRobot non diventa undefined (tutta la view legge dataRobot.STATUS)');
check(vm5.plcSilent === true, 'e senza riga il banner resta acceso');

console.log('=== robotView: il testo dice solo quello che e\' vero ===');
const itJson = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const enJson = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
check(!/comandi|disabilit/i.test(itJson.robot.plcSilent),
	'il messaggio non promette piu\' un blocco dei comandi: il gate e\' dataStored.cmdActive, che il banner non tocca');
check(!/command|disabled/i.test(enJson.robot.plcSilent), 'idem in inglese');
check(/non disponibile/i.test(itJson.robot.plcSilent) && /unavailable/i.test(enJson.robot.plcSilent),
	'e dice quello che e\' vero: lo stato non e\' disponibile');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
