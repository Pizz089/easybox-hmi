// ============================================================================
// tests/test_golden_comandi.mjs — MAPPA GOLDEN DEI COMANDI (pannello v3, 6/10)
//
// PERCHE'. Il pannello v3 sposta e ridisegna i comandi (shell nuova, Home e
// Controlli rifatti, striscia di stato col HOLD). La regola e' che OGNI
// comando resti identico: stesso topic e payload MQTT o stessa chiamata
// HTTP, stesse abilitazioni, stesse conferme. Questa mappa e' la prova:
// catturata PRIMA di toccare le pagine, deve restare uguale DOPO.
//
// COSA REGISTRA, per ogni controllo con un handler (@click, @change,
// @cmdPlay, @pick...) delle pagine con comandi:
//   etichetta -> handler -> condizione di abilitazione (testo) e, scenario
//   per scenario: visibile / abilitato / effetti (emit MQTT con payload,
//   fetch con metodo e URL, router, eventi verso il padre, avvisi, stato
//   cambiato) / conferme (se il controllo apre un dialog, cosa fanno i
//   pulsanti che compaiono).
// Il template si legge con @vue/compiler-sfc; gli handler si eseguono sulla
// VERA logica del componente (Vite ssrLoadModule) con socket, fetch, router
// e timer finti: niente parte verso la cella.
//
// Uso (dalla cartella easybox/HMI):
//   node tests/test_golden_comandi.mjs             confronto con il golden
//   node tests/test_golden_comandi.mjs --aggiorna  riscrive golden (json + md)
// Exit code 0 = mappa identica al golden, 1 = differenze (elencate).
// ============================================================================
process.on('unhandledRejection', () => {});
const noop = () => {};
globalThis.window = {
	location: { hostname: 'localhost', reload: noop },
	matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
	addEventListener: noop, removeEventListener: noop,
	performance: globalThis.performance,   // vue-i18n (istanze SSR)
};
globalThis.sessionStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('@vue/compiler-sfc');
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const IT = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const AGGIORNA = process.argv.includes('--aggiorna');
const GOLDEN_JSON = 'tests/golden/comandi.json';
const GOLDEN_MD = 'tests/golden/comandi.md';
const MAX_ITEM = 3;          // elementi per v-for: bastano a vedere il payload per riga

// ------------------------------------------------------------ registratore
let effetti = [];
const rec = s => effetti.push(s);
const J = v => { try { const s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch { return String(v); } };
dataStored.WS = {
	connected: true,
	socket: { on: noop, off: noop, emit: (ev, payload) => rec('emit ' + ev + ' ' + J(payload)) },
};
// risposte finte per URL: i dialog che si aprono con un'anteprima devono
// poter arrivare alla conferma (altrimenti la conferma resta spenta e il
// golden non vedrebbe il suo payload)
const RISPOSTE = [
	[/api\/order\/resetProduction\/preview\//, { orders: [{ ID: 101 }], positions: 3, blocked: false }],
];
globalThis.fetch = (url, opt) => {
	const m = ((opt && opt.method) || 'GET').toUpperCase();
	const u = String(url).replace(/^SRV\//, '');
	rec('fetch ' + m + ' ' + u + (opt && opt.body ? ' body=' + String(opt.body).slice(0, 160) : ''));
	const r = (RISPOSTE.find(([re]) => re.test(u)) || [null, []])[1];
	return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(r)), text: async () => (Array.isArray(r) ? '' : JSON.stringify(r)) });
};
globalThis.alert = m => rec('alert ' + J(m));
globalThis.window.alert = globalThis.alert;
globalThis.confirm = m => { rec('confirm-nativo ' + J(m)); return true; };

// timer finti: si eseguono quelli entro 1 s (debounce, attese brevi);
// quelli lunghi (sicurezze di missione da 5 s e oltre) restano in coda
let timers = [], timerId = 1;
const realSetTimeout = setTimeout;
globalThis.setTimeout = (fn, ms) => { const id = timerId++; timers.push({ id, fn, ms: Number(ms) || 0 }); return id; };
globalThis.clearTimeout = id => { timers = timers.filter(t => t.id !== id); };
globalThis.setInterval = () => timerId++;
globalThis.clearInterval = noop;
const microtasks = () => new Promise(r => realSetTimeout(r, 0));
async function flush() {
	for (let giro = 0; giro < 6; giro++) {
		await microtasks();
		const pronti = timers.filter(t => t.ms <= 1000).sort((a, b) => a.ms - b.ms);
		if (!pronti.length) break;
		timers = timers.filter(t => t.ms > 1000);
		for (const t of pronti) { try { t.fn(); } catch (e) { rec('errore-timer ' + e.message); } }
	}
	await microtasks();
}

// dataStored: si riparte dallo stesso stato a ogni prova
const DS_BASE = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(dataStored).filter(([k, v]) => k !== 'WS' && typeof v !== 'function'))));
DS_BASE.server = 'SRV/';
function resetDS() {
	for (const k of Object.keys(dataStored)) if (k !== 'WS' && typeof dataStored[k] !== 'function' && !(k in DS_BASE)) delete dataStored[k];
	Object.assign(dataStored, JSON.parse(JSON.stringify(DS_BASE)));
}

// ------------------------------------------------------------ template
const dir = (n, name) => (n.props || []).find(p => p.type === 7 && p.name === name);
const bindOf = (n, k) => { const d = (n.props || []).find(p => p.type === 7 && p.name === 'bind' && p.arg && p.arg.content === k); return d && d.exp ? d.exp.content.replace(/\s+/g, ' ').trim() : ''; };
const attrOf = (n, k) => { const a = (n.props || []).find(p => p.type === 6 && p.name === k); return a && a.value ? a.value.content : ''; };
function testo(n) {
	if (n.type === 2) return n.content;
	if (n.type === 5) return '{{' + n.content.content.trim() + '}}';
	if (n.type === 1 || n.type === 0) return (n.children || []).map(testo).join(' ');
	return '';
}
function leggiChiave(k) {
	if (typeof IT[k] === 'string') return IT[k];
	const v = k.split('.').reduce((o, p) => (o && typeof o === 'object' ? o[p] : undefined), IT);
	return typeof v === 'string' ? v : null;
}
const etichetta = s => s.replace(/\{\{\s*\$t\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g, (m, k) => { const v = leggiChiave(k); return v === null ? m : v.trim(); })
	.replace(/\s+/g, ' ').trim();
function parseFor(exp) {
	const m = exp.match(/^\s*\(?\s*([A-Za-z_$][\w$]*)\s*(?:,\s*([A-Za-z_$][\w$]*)\s*)?\)?\s+(?:in|of)\s+([\s\S]+)$/);
	return m ? { alias: m[1], index: m[2] || null, source: m[3].trim() } : null;
}
function estrai(file) {
	const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file });
	const ctrls = [];
	function figli(children, ctx) {
		let chain = [];
		for (const ch of children || []) {
			if (ch.type === 3) continue;                                     // commento
			if (ch.type === 2 && !ch.content.trim()) continue;               // spazi
			if (ch.type !== 1) { chain = []; continue; }
			const pIf = dir(ch, 'if'), pElseIf = dir(ch, 'else-if'), pElse = dir(ch, 'else'), pShow = dir(ch, 'show'), pFor = dir(ch, 'for');
			let conds = [];
			if (pIf) { conds = ['(' + pIf.exp.content + ')']; chain = [pIf.exp.content]; }
			else if (pElseIf) { conds = chain.map(c => '!(' + c + ')').concat('(' + pElseIf.exp.content + ')'); chain.push(pElseIf.exp.content); }
			else if (pElse) { conds = chain.map(c => '!(' + c + ')'); chain = []; }
			else chain = [];
			if (pShow) conds.push('(' + pShow.exp.content + ')');
			const loop = pFor ? parseFor(pFor.exp.content) : null;
			const nctx = { conds: ctx.conds.concat(conds), loops: loop ? ctx.loops.concat([loop]) : ctx.loops };
			for (const p of (ch.props || []).filter(p => p.type === 7 && p.name === 'on' && p.arg)) {
				ctrls.push({
					tag: ch.tag, evento: p.arg.content,
					handler: p.exp ? p.exp.content.replace(/\s+/g, ' ').trim() : '',
					etichetta: etichetta(testo(ch)).slice(0, 120),
					disabled: bindOf(ch, 'disabled') || (attrOf(ch, 'disabled') !== '' || (ch.props || []).some(q => q.type === 6 && q.name === 'disabled') ? 'true' : ''),
					classe: bindOf(ch, 'class'), classeStatica: attrOf(ch, 'class'),
					conds: nctx.conds, loops: nctx.loops,
				});
			}
			figli(ch.children, nctx);
		}
	}
	figli(descriptor.template.ast.children, { conds: [], loops: [] });
	// id stabile: tag@evento handler, con #n solo se ripetuto
	const visti = {};
	for (const c of ctrls) {
		const base = c.tag + '@' + c.evento + ' ' + c.handler;
		visti[base] = (visti[base] || 0) + 1;
		c.id = visti[base] > 1 ? base + ' #' + visti[base] : base;
	}
	return ctrls;
}

// ------------------------------------------------------------ vm
const SCOPE_BASE = { dataStored, Math, Number, String, JSON, parseInt, parseFloat, isNaN, Array, Object, Boolean };
// + gli import JS di <script setup> del componente (es. sendToRobot da
// util/globalFunction.js): nel template sono visibili come i metodi
let scopeCorrente = SCOPE_BASE;
function vmDi(comp, props, route) {
	const vm = {};
	const routeObj = route || { params: {}, query: {}, path: '/' };
	Object.assign(vm, {
		$t: (k, p) => (p !== undefined ? k + ' ' + J(p) : k), $te: () => true, $tc: k => k,
		$i18n: { locale: 'it' },
		$route: routeObj,
		$router: { push: x => rec('router ' + J(x)), replace: x => rec('router-replace ' + J(x)), go: n => rec('router-go ' + n), back: () => rec('router-back') },
		$emit: (ev, ...a) => rec('evento ' + ev + (a.length ? ' ' + J(a) : '')),
		$refs: {}, $nextTick: f => (f ? Promise.resolve().then(f) : Promise.resolve()), $el: null, $forceUpdate: noop,
	});
	Object.assign(vm, props || {});
	if (comp.props) {
		const pdef = Array.isArray(comp.props) ? Object.fromEntries(comp.props.map(k => [k, {}])) : comp.props;
		for (const [k, d] of Object.entries(pdef)) if (!(k in vm)) vm[k] = d && 'default' in d ? (typeof d.default === 'function' && d.type !== Function ? d.default() : d.default) : undefined;
	}
	if (typeof comp.data === 'function') Object.assign(vm, comp.data.call(vm));
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { configurable: true, enumerable: false, get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	return vm;
}
const PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;
const FUNZ = /^(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>|^function\b/;
function valuta(vm, loopVars, exp) {
	const f = new Function('__vm', '__scope', '__loop', 'with (__scope) { with (__vm) { with (__loop) { return (' + exp + '); } } }');
	return f(vm, scopeCorrente, loopVars || {});
}
function esegui(vm, loopVars, exp, $event) {
	const e = exp.trim().replace(/;+\s*$/, '');
	if (PATH.test(e) || FUNZ.test(e)) {
		const fn = valuta(vm, loopVars, e);
		if (typeof fn === 'function') return fn($event);
		return fn;
	}
	const f = new Function('__vm', '__scope', '__loop', '$event', 'with (__scope) { with (__vm) { with (__loop) { ' + e + ' ; } } }');
	return f(vm, scopeCorrente, loopVars || {}, $event);
}
function eventoFinto(nome) {
	if (nome === 'pick') return { index: 0, subPos: 1, status: 4, orderID: 0 };
	if (nome === 'update') return 5;
	// UiStepper: il passo (+1), come lo emette il componente
	if (nome === 'step') return 1;
	if (nome === 'click_obj') return undefined;
	return { target: { value: '1', checked: true, blur: noop, focus: noop, select: noop }, key: 'Enter', stopPropagation: noop, preventDefault: noop };
}
const classi = v => {
	if (!v) return [];
	if (typeof v === 'string') return v.split(/\s+/).filter(Boolean);
	if (Array.isArray(v)) return v.flatMap(classi);
	if (typeof v === 'object') return Object.entries(v).filter(([, on]) => on).map(([k]) => k);
	return [];
};
function abilitato(vm, lv, c) {
	try {
		if (c.disabled && valuta(vm, lv, c.disabled)) return false;
		const cl = classi(c.classeStatica).concat(c.classe ? classi(valuta(vm, lv, c.classe)) : []);
		if (cl.includes('pure-button-disable') || cl.includes('pure-button-disabled')) return false;
		return true;
	} catch (e) { return 'errore: ' + e.message; }
}
function visibile(vm, lv, c) {
	try { return c.conds.every(x => !!valuta(vm, lv, x)); } catch (e) { if (process.env.GOLDEN_DEBUG) console.log('visibile: ' + c.id + ': ' + e.message); return false; }
}
// combinazioni dei v-for (primi MAX_ITEM elementi di ogni sorgente)
function combinazioni(vm, loops) {
	let out = [{}];
	for (const L of loops) {
		const nuovo = [];
		for (const lv of out) {
			let src;
			try { src = valuta(vm, lv, L.source); } catch { src = []; }
			let items = [];
			if (typeof src === 'number') items = Array.from({ length: src }, (_, i) => [i + 1, i]);
			else if (Array.isArray(src)) items = src.map((x, i) => [x, i]);
			else if (src instanceof Set) items = [...src].map((x, i) => [x, i]);
			else if (src && typeof src === 'object') items = Object.entries(src).map(([k, x], i) => [x, L.index ? k : i]);
			for (const [x, i] of items.slice(0, MAX_ITEM)) nuovo.push(Object.assign({}, lv, { [L.alias]: x }, L.index ? { [L.index]: i } : {}));
		}
		out = nuovo;
	}
	return out;
}
// istantanea dello stato per il diff (solo dati serializzabili)
function istantanea(vm, dataKeys) {
	const o = {};
	for (const k of dataKeys) { try { o['vm.' + k] = J(vm[k]); } catch { o['vm.' + k] = '?'; } }
	for (const [k, v] of Object.entries(dataStored)) if (k !== 'WS' && typeof v !== 'function') o['dataStored.' + k] = J(v);
	return o;
}
function diff(a, b) {
	const out = [];
	for (const k of Object.keys(b)) {
		if (a[k] === b[k]) continue;
		let va, vb;
		try { va = JSON.parse(a[k]); vb = JSON.parse(b[k]); } catch { out.push(k + ' = ' + String(b[k]).slice(0, 80)); continue; }
		if (va && vb && typeof va === 'object' && typeof vb === 'object' && !Array.isArray(vb)) {
			for (const s of new Set(Object.keys(va).concat(Object.keys(vb))))
				if (J(va[s]) !== J(vb[s])) out.push(k + '.' + s + ' = ' + J(vb[s]).slice(0, 80));
		} else out.push(k + ' = ' + J(vb).slice(0, 80));
	}
	return out;
}
const COMANDO = /^(emit|fetch|router|evento|alert|confirm-nativo) /;

// ------------------------------------------------------------ pagine e scenari
const S = dataStored;   // costanti di stato: S.status_hold, ...
const robotIn = (vm, st) => { vm.dataRobot = Object.assign({}, vm.dataRobot, { STATUS: st }); };
const gripperA = [{ ID: 26, DESCR: 'Pinza prova', SUB_POS: 3, STATUS_DESC: 'EMPTY', STATUS_DESC2: 'EMPTY', GRIPPER_TYPE: 2, N_SIDES: 2 }];
const robotScen = (st, lvl, extra) => (vm, ds) => {
	ds.userLevel = lvl;
	robotIn(vm, st);
	vm.dataGripper = gripperA;
	if (extra) extra(vm, ds);
	if (vm.CMD_enabled) vm.CMD_enabled();
	if (vm.Mission_enabled) vm.Mission_enabled();
};
const ordini = [
	{ ID: 101, PIECE: 'PZ-A', PIECE_DESC: 'prova', MACHINE_ID: 1, STATUS: 4, STATUS_DESC: 'RAW', PP: '', PP_ID: 10, PRODUCTED: 0, QUANTITY: 5, PIECE_ID: 1 },
	{ ID: 102, PIECE: 'PZ-B', PIECE_DESC: 'prova', MACHINE_ID: 1, STATUS: 3, STATUS_DESC: 'WORKING', PP: '', PP_ID: 11, PRODUCTED: 2, QUANTITY: 5, PIECE_ID: 2 },
	{ ID: 103, PIECE: 'PZ-C', PIECE_DESC: 'prova', MACHINE_ID: 1, STATUS: 5, STATUS_DESC: 'FINISHED', PP: '', PP_ID: 12, PRODUCTED: 5, QUANTITY: 5, PIECE_ID: 3 },
];
const cassetti = [
	{ ID: 21, FAMILY: 'GR-PROVA', DESCR: 'cassetto 7', FLOOR_MAG: 7, EXTRACT: 0, STATUS: 2, X: 819000, Y: 605000, N_PLACE: 52 },
	{ ID: 22, FAMILY: 'GR-PROVA', DESCR: 'cassetto 8', FLOOR_MAG: 8, EXTRACT: 1, STATUS: 2, X: 819000, Y: 605000, N_PLACE: 52 },
];
const vassoio = [
	{ ID: 21, FLOOR_MAG: 7, DESCR: 'cassetto 7' }, { ID: 22, FLOOR_MAG: 8, DESCR: 'cassetto 8' }, { ID: 23, FLOOR_MAG: 9, DESCR: 'cassetto 9' },
];
const tasche = [
	{ SUB_POS: 1, x: 65, y: 50, status: 4, prisma: true, order_ID: 0, partType: 1035 },
	{ SUB_POS: 2, x: 65, y: 108, status: 2, prisma: true, order_ID: 0, partType: 1035 },
];
const PAGINE = [
	{ nome: 'robotView', file: 'src/views/unit/robotView.vue', scenari: {
		'HOLD liv2': robotScen(S.status_hold, 2),
		'HOLD liv0': robotScen(S.status_hold, 0),
		'HOLD liv2 cassetto 8 fuori': robotScen(S.status_hold, 2, vm => { vm.extractedTray = { ID: 22, FLOOR_MAG: 8, DESCR: 'cassetto 8' }; }),
		'AUTO liv2': robotScen(S.status_auto, 2),
		'OFF liv2': robotScen(S.status_off, 2),
		// (v3) il 17 e' un toggle nel PLC: a stato ignoto il HOLD si spegne
		'STATUS ignoto liv2': robotScen(undefined, 2),
		'NOT_DEFINED liv2': robotScen(S.status_notDef, 2),
	} },
	{ nome: 'CNC1View', file: 'src/views/unit/CNC1View.vue', scenari: {
		'base': (vm, ds) => { ds.userLevel = 2; },
		'pallet 2 scelto e dichiarato': (vm, ds) => { ds.userLevel = 2; vm.palletsList = [{ ID: 2, FAMILY: 'ZP', DESCR: 'pallet prova' }]; vm.palletSel = 2; vm.declPallet = 2; },
		// (fase B) morsa manuale a due posizioni: con l'eco ON si preme OFF (43)
		'eco morsa manuale ON': (vm, ds) => { ds.userLevel = 2; vm.declKnown = true; vm.declManualVice = 1; },
	} },
	{ nome: 'CNC2View', file: 'src/views/unit/CNC2View.vue', scenari: { 'base': () => {} } },
	{ nome: 'smallboxView', file: 'src/views/unit/smallboxView.vue', scenari: {
		'locale, cassetto 8 fuori': (vm, ds) => { ds.RobotInLocalMode = true; vm.data = JSON.parse(JSON.stringify(cassetti)); },
		'remoto, cassetto 8 fuori': (vm, ds) => { ds.RobotInLocalMode = false; vm.data = JSON.parse(JSON.stringify(cassetti)); },
		'locale, nessun cassetto fuori': (vm, ds) => { ds.RobotInLocalMode = true; vm.data = JSON.parse(JSON.stringify(cassetti)).map(t => Object.assign(t, { EXTRACT: 0 })); },
	} },
	{ nome: 'DashboardView', file: 'src/views/DashboardView.vue', scenari: {
		'base': () => {},
		// (fase B) Home v3: gli stessi ordini della tabella ordini, 102 in lavoro
		'tre ordini, 102 in lavoro': (vm) => { vm.orders = JSON.parse(JSON.stringify(ordini)); vm.statoOrdini = 'ok'; },
		'nessun ordine in corso': (vm) => { vm.orders = JSON.parse(JSON.stringify(ordini)).filter(o => o.STATUS !== 3); vm.statoOrdini = 'ok'; },
	} },
	{ nome: 'units', file: 'src/components/units.vue', scenari: { 'base': () => {} } },
	{ nome: 'productionView', file: 'src/views/productionView.vue', scenari: {
		'liv2': (vm, ds) => { ds.userLevel = 2; },
		'liv0': (vm, ds) => { ds.userLevel = 0; },
	} },
	{ nome: 'productionTable', file: 'src/components/productionTable.vue', scenari: {
		'tre ordini liv2': (vm, ds) => { ds.userLevel = 2; vm.orders = JSON.parse(JSON.stringify(ordini)); },
		'tre ordini, popup elimina aperto': (vm, ds) => { ds.userLevel = 2; vm.orders = JSON.parse(JSON.stringify(ordini)); vm.showPopUp = 101; },
	} },
	{ nome: 'ComandsRows', file: 'src/components/Comands/ComandsRows.vue',
		props: { play: true, pause: true, stop: true, modify: true, place: true, move: true, save: true, del: true },
		scenari: {
			'liv2, EasyBox in locale': (vm, ds) => { ds.userLevel = 2; ds.EasyBox = true; ds.RobotInLocalMode = true; },
			'liv0': (vm, ds) => { ds.userLevel = 0; ds.EasyBox = true; ds.RobotInLocalMode = true; },
			'liv2, robot non in locale': (vm, ds) => { ds.userLevel = 2; ds.EasyBox = true; ds.RobotInLocalMode = false; },
			'tutto disabilitato': (vm, ds) => { ds.userLevel = 2; Object.assign(vm, { playDisable: true, pauseDisable: true, stopDisable: true, modifyDisable: true, placeDisable: true, moveDisable: true, saveDisable: true, delDisable: true }); },
		} },
	{ nome: 'RelaunchDialog', file: 'src/components/RelaunchDialog.vue',
		props: { order: ordini[2] },
		scenari: {
			'anteprima: si sostituisce e si usa il disponibile': (vm, ds) => { vm.preview = { finished: 5, raw: 5, quantity: 5, available: 5, availableBlocked: false, replaceBlocked: false }; },
			'anteprima assente': (vm, ds) => { vm.preview = null; },
		} },
	{ nome: 'layoutView', file: 'src/views/layoutView.vue',
		route: { params: { trayID: '22', modifyEnable: '1', floorMag: '8' }, query: {}, path: '/layout/22/1/8' },
		scenari: {
			'modifica, vicini 7 e 9, liv2': (vm, ds) => { ds.userLevel = 2; vm.trays = JSON.parse(JSON.stringify(vassoio)); vm.listPz = JSON.parse(JSON.stringify(tasche)); },
			'modifica, reset aperto': (vm, ds) => { ds.userLevel = 2; vm.listPz = JSON.parse(JSON.stringify(tasche)); vm.trayReset = Object.assign({}, vm.trayReset, { open: true }); },
		} },
	{ nome: 'layoutView (sola lettura)', file: 'src/views/layoutView.vue',
		route: { params: { trayID: '22', modifyEnable: '0', floorMag: '8' }, query: {}, path: '/layout/22/0/8' },
		scenari: { 'sola lettura liv0': (vm, ds) => { ds.userLevel = 0; vm.trays = JSON.parse(JSON.stringify(vassoio)); vm.listPz = JSON.parse(JSON.stringify(tasche)); } } },
	{ nome: 'TraysView', file: 'src/views/conf/TraysView.vue', scenari: {
		'due cassetti liv2': (vm, ds) => { ds.userLevel = 2; vm.datiTab = JSON.parse(JSON.stringify(cassetti)); },
		'due cassetti liv0': (vm, ds) => { ds.userLevel = 0; vm.datiTab = JSON.parse(JSON.stringify(cassetti)); },
	} },
	{ nome: 'TrayPockets', file: 'src/components/layout/TrayPockets.vue',
		props: { pockets: [{ SUB_POS: 1, x: 65, y: 50, status: 4, prisma: true, order_ID: 0 }], dimX: 40, dimY: 110 },
		scenari: { 'una tasca': () => {} } },
	// (v3 fase A) striscia di stato: il pulsante HOLD / Riprendi / START deve
	// mandare lo stesso comando del pulsante di robotView (17), con la stessa
	// logica a tre stati. Componente solo <script setup>: istanza SSR vera.
	{ nome: 'StatusStrip', file: 'src/layout/v3/StatusStrip.vue', modo: 'ssr', scenari: {
		'robot in HOLD': () => { plantStore.plant.robot = S.status_hold; },
		'robot in lavoro': () => { plantStore.plant.robot = S.status_working; },
		'robot in AUTO': () => { plantStore.plant.robot = S.status_auto; },
		'robot spento': () => { plantStore.plant.robot = S.status_off; },
		'stato non ancora noto': () => { plantStore.plant.robot = null; },
		'NOT_DEFINED (0)': () => { plantStore.plant.robot = S.status_notDef; },
	} },
];

// ------------------------------------------------------------ istanze SSR
// Per i componenti scritti solo con <script setup> (shell v3): il template
// vede i binding di setup (store, sendToRobot, computed), che solo un'istanza
// vera espone. Render SSR con i18n e router in memoria; il proxy del
// componente fa da vm (with() funziona sul proxy). onMounted non gira.
const plantStore = await server.ssrLoadModule('/src/stores/plantStatus.js');
const { createSSRApp, h } = await import('vue');
const { renderToString } = await import('vue/server-renderer');
const { createI18n } = await import('vue-i18n');
const { createRouter, createMemoryHistory } = await import('vue-router');
// In SSR Vite compila <script setup> col template incorporato: il proxy non
// espone i binding. Qui lo script si ricompila SENZA template incorporato
// (setup restituisce i binding) in un modulo temporaneo; gli import
// relativi diventano assoluti, cosi' Vite li risolve come nel file vero.
const { compileScript } = require('@vue/compiler-sfc');
const TMP = 'tests/.golden_tmp';
const compilati = new Map();
async function componenteConBinding(file) {
	if (compilati.has(file)) return compilati.get(file);
	const P = require('node:path').posix;
	const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file });
	const out = compileScript(descriptor, { id: 'golden-' + compilati.size, inlineTemplate: false, isProd: false });
	const dirFile = '/' + P.dirname(file);
	const codice = out.content.replace(/(from\s+|import\s+)(['"])(\.{1,2}\/[^'"]+)\2/g, (m, pre, q, rel) => pre + q + P.normalize(P.join(dirFile, rel)) + q);
	mkdirSync(TMP, { recursive: true });
	const nome = file.replace(/[\/.]/g, '_') + '.mjs';
	writeFileSync(TMP + '/' + nome, codice);
	const comp = Object.assign({}, (await server.ssrLoadModule('/' + TMP + '/' + nome)).default, { render: () => null });
	compilati.set(file, comp);
	return comp;
}
async function istanzaSSR(comp, props, route) {
	const i18n = createI18n({ legacy: false, globalInjection: true, locale: 'it', fallbackLocale: 'it', messages: { it: IT }, missingWarn: false, fallbackWarn: false });
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] });
	await router.push((route && route.path) || '/');
	await router.isReady();
	// gli eventi verso il padre si registrano come per i componenti options
	const ascolto = {};
	for (const ev of (Array.isArray(comp.emits) ? comp.emits : Object.keys(comp.emits || {})))
		ascolto['on' + ev.split('-').map(x => x[0].toUpperCase() + x.slice(1)).join('')] = (...a) => rec('evento ' + ev + (a.length ? ' ' + J(a) : ''));
	let px = null;
	const app = createSSRApp({ render: () => h(comp, Object.assign({}, props || {}, ascolto)) });
	app.use(i18n); app.use(router);
	app.mixin({ created() { if (this.$.type === comp) px = this; } });
	await renderToString(app);
	if (!px) return null;
	// Vue nasconde i binding di <script setup> al trap "has" del proxy
	// pubblico (che e' quello che usa with()): si legge setupState
	// dell'istanza vera (ref gia' spacchettati), il resto dal proxy.
	const st = px.$.setupState;
	return new Proxy({}, {
		has: (_, k) => typeof k === 'string' && (k in st || k in px),
		get: (_, k) => (typeof k === 'string' && k in st ? st[k] : px[k]),
		set: (_, k, v) => { if (k in st) st[k] = v; else px[k] = v; return true; },
		ownKeys: () => Object.keys(st),
		getOwnPropertyDescriptor: (_, k) => (k in st ? { enumerable: true, configurable: true, value: st[k] } : undefined),
	});
}

// ------------------------------------------------------------ esecuzione
async function prova(pagina, comp, ctrls, scen, catena) {
	// catena: [{c, lv}] controlli da eseguire in ordine; ritorna effetti e stato
	resetDS(); timers = []; timerId = 1; effetti = [];
	if (pagina.modo === 'ssr') Object.assign(plantStore.plant, { robot: null, mc1: null, mc2: null, box: null, robotAlarm: '', trayOut: null });
	const vm = pagina.modo === 'ssr'
		? await istanzaSSR(comp, JSON.parse(JSON.stringify(pagina.props || {})), pagina.route)
		: vmDi(comp, JSON.parse(JSON.stringify(pagina.props || {})), pagina.route && JSON.parse(JSON.stringify(pagina.route)));
	effetti = [];
	try { pagina.scenari[scen](vm, dataStored); } catch (e) { return { errore: 'scenario: ' + e.message }; }
	const dataKeys = typeof comp.data === 'function' ? Object.keys(comp.data.call(vmDi({}, {}, {}))) : [];
	let prima = istantanea(vm, dataKeys);
	const passi = [];
	for (const { c, lv } of catena) {
		effetti = [];
		prima = istantanea(vm, dataKeys);
		try { esegui(vm, lv, c.handler, eventoFinto(c.evento)); } catch (e) { rec('errore ' + e.message.slice(0, 100)); }
		await flush();
		passi.push({ effetti: effetti.slice(), stato: diff(prima, istantanea(vm, dataKeys)) });
	}
	return { vm, passi, dataKeys };
}
async function importSetup(file) {
	const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file });
	const src = descriptor.scriptSetup ? descriptor.scriptSetup.content : '';
	const scope = {};
	const P = require('node:path').posix;
	for (const m of src.matchAll(/import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g)) {
		const [, def, nomi, da] = m;
		if (!/^\.|^@\//.test(da) || /\.vue$/.test(da)) continue;
		const assoluto = da.startsWith('@/') ? '/src/' + da.slice(2) : '/' + P.normalize(P.join(P.dirname(file), da));
		let mod; try { mod = await server.ssrLoadModule(assoluto); } catch { continue; }
		if (def && mod.default !== undefined) scope[def] = mod.default;
		for (const n of (nomi || '').split(',').map(x => x.trim()).filter(Boolean)) {
			const [orig, alias] = n.split(/\s+as\s+/).map(x => x.trim());
			if (orig in mod) scope[alias || orig] = mod[orig];
		}
	}
	return Object.assign({}, SCOPE_BASE, scope);
}
async function mappaPagina(pagina) {
	const comp = pagina.modo === 'ssr' ? await componenteConBinding(pagina.file) : (await server.ssrLoadModule('/' + pagina.file)).default;
	scopeCorrente = pagina.modo === 'ssr' ? SCOPE_BASE : await importSetup(pagina.file);
	const ctrls = estrai(pagina.file);
	const out = [];
	for (const c of ctrls) {
		const esiti = {};
		for (const scen of Object.keys(pagina.scenari)) {
			// stato dello scenario, senza clic: visibilita' e abilitazione
			const base = await prova(pagina, comp, ctrls, scen, []);
			if (base.errore) { esiti[scen] = base.errore; continue; }
			const combos = combinazioni(base.vm, c.loops);
			const righe = [];
			for (const lv of combos) {
				const vis = visibile(base.vm, lv, c);
				if (!vis) { righe.push('nascosto'); continue; }
				const ab = abilitato(base.vm, lv, c);
				const r = await prova(pagina, comp, ctrls, scen, [{ c, lv }]);
				const p = r.passi[0];
				const riga = { abilitato: ab, effetti: p.effetti, stato: p.stato };
				// apre un dialog? (stato cambiato, nessun comando): cosa fanno i
				// controlli che sono comparsi
				if (p.stato.length) {
					const conferme = [];
					for (const d of ctrls) {
						if (d === c) continue;
						for (const lv2 of combinazioni(r.vm, d.loops)) {
							if (!visibile(r.vm, lv2, d) || visibile(base.vm, lv2, d)) continue;
							const r2 = await prova(pagina, comp, ctrls, scen, [{ c, lv }, { c: d, lv: lv2 }]);
							conferme.push({ controllo: d.id, etichetta: d.etichetta, abilitato: abilitato(r.vm, lv2, d), effetti: r2.passi[1].effetti });
						}
					}
					if (conferme.length) riga.conferme = conferme;
				}
				righe.push(riga);
			}
			esiti[scen] = c.loops.length ? righe : righe[0];
		}
		out.push({ id: c.id, etichetta: c.etichetta, evento: c.evento, handler: c.handler, disabled: c.disabled, classe: c.classe, esiti });
	}
	return { file: pagina.file, scenari: Object.keys(pagina.scenari), controlli: out };
}

const mappa = { versione: 1, pagine: {} };
for (const p of PAGINE) mappa.pagine[p.nome] = await mappaPagina(p);
await server.close();
rmSync(TMP, { recursive: true, force: true });

// ------------------------------------------------------------ md leggibile
function md(m) {
	const righe = ['# Mappa golden dei comandi', '', 'Generata da `tests/test_golden_comandi.mjs --aggiorna`. Per ogni controllo: etichetta, handler, condizione di abilitazione e, nel primo scenario dove e\' visibile, gli effetti (MQTT, HTTP, router) e le conferme. Il dettaglio per scenario e\' nel json.', ''];
	for (const [nome, p] of Object.entries(m.pagine)) {
		righe.push('## ' + nome + ' (`' + p.file + '`)', '', 'Scenari: ' + p.scenari.join(' · '), '');
		if (!p.controlli.length) { righe.push('Nessun controllo con handler.', ''); continue; }
		righe.push('| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |', '|---|---|---|---|---|---|');
		for (const c of p.controlli) {
			const ab = p.scenari.map(s => { const e = c.esiti[s]; const r = Array.isArray(e) ? e.find(x => x !== 'nascosto') : e; return s + ': ' + (r === undefined || r === 'nascosto' ? '–' : typeof r === 'string' ? r : (r.abilitato === true ? 'sì' : 'no')); }).join('<br>');
			let eff = '', conf = '';
			const primo = r => r && typeof r === 'object';
			const scelto = p.scenari.find(s => { const e = c.esiti[s]; const r = Array.isArray(e) ? e.find(x => x !== 'nascosto') : e; return primo(r) && r.abilitato === true; }) ;
			for (const s of (scelto ? [scelto] : p.scenari)) {
				const e = c.esiti[s]; const r = Array.isArray(e) ? e.find(x => x !== 'nascosto') : e;
				if (primo(r)) {
					eff = r.effetti.filter(x => COMANDO.test(x)).join('<br>') || (r.stato.length ? 'stato: ' + r.stato.slice(0, 2).join(', ') : '–');
					if (r.conferme) conf = r.conferme.map(x => x.etichetta + ' → ' + (x.effetti.filter(y => COMANDO.test(y)).join(', ') || '–')).join('<br>');
					break;
				}
			}
			const esc = s => String(s || '').replace(/\|/g, '\\|');
			righe.push('| ' + [c.etichetta || '(' + c.evento + ')', '`' + c.handler + '`', c.disabled || c.classe ? '`' + (c.disabled || c.classe) + '`' : '', ab, eff, conf || 'no'].map(esc).join(' | ') + ' |');
		}
		righe.push('');
	}
	return righe.join('\n');
}

const testoMappa = JSON.stringify(mappa, null, 1) + '\n';
if (AGGIORNA) {
	mkdirSync('tests/golden', { recursive: true });
	writeFileSync(GOLDEN_JSON, testoMappa);
	writeFileSync(GOLDEN_MD, md(mappa) + '\n');
	const n = Object.values(mappa.pagine).reduce((a, p) => a + p.controlli.length, 0);
	console.log('golden riscritto: ' + Object.keys(mappa.pagine).length + ' pagine, ' + n + ' controlli');
	process.exit(0);
}
let golden;
try { golden = JSON.parse(readFileSync(GOLDEN_JSON, 'utf8')); } catch { console.log('  FAIL golden assente: lanciare con --aggiorna'); process.exit(1); }
let failed = 0;
for (const [nome, g] of Object.entries(golden.pagine)) {
	const m = mappa.pagine[nome];
	if (!m) { console.log('  FAIL pagina sparita: ' + nome); failed++; continue; }
	const ids = new Set(m.controlli.map(c => c.id));
	for (const gc of g.controlli) {
		const mc = m.controlli.find(c => c.id === gc.id);
		if (!mc) { console.log('  FAIL ' + nome + ': controllo sparito: ' + gc.id + ' (' + gc.etichetta + ')'); failed++; continue; }
		if (J(mc) !== J(gc)) {
			failed++;
			console.log('  FAIL ' + nome + ': ' + gc.id + ' cambiato');
			for (const k of ['etichetta', 'handler', 'disabled', 'classe']) if (J(mc[k]) !== J(gc[k])) console.log('       ' + k + ': ' + J(gc[k]) + ' -> ' + J(mc[k]));
			for (const s of Object.keys(gc.esiti)) if (J(mc.esiti[s]) !== J(gc.esiti[s])) console.log('       scenario "' + s + '": ' + J(gc.esiti[s]).slice(0, 300) + '\n          -> ' + J(mc.esiti[s]).slice(0, 300));
		}
		ids.delete(gc.id);
	}
	for (const id of ids) { console.log('  FAIL ' + nome + ': controllo nuovo non nel golden: ' + id); failed++; }
}
for (const nome of Object.keys(mappa.pagine)) if (!golden.pagine[nome]) { console.log('  FAIL pagina nuova non nel golden: ' + nome); failed++; }
const n = Object.values(mappa.pagine).reduce((a, p) => a + p.controlli.length, 0);
console.log('  ' + (failed ? 'FAIL' : 'ok  ') + ' mappa dei comandi: ' + Object.keys(mappa.pagine).length + ' pagine, ' + n + ' controlli' + (failed ? ', ' + failed + ' differenze' : ', identica al golden'));
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
