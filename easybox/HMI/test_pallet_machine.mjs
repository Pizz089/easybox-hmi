// ============================================================================
// test_pallet_machine.mjs — pallet IN MACCHINA: 40 / 41 con l'eco (7/10)
//
// util/palletMachine.js (estratto da CNC1View) e chi lo usa:
//   1. il modulo: 40;<pallet> e 41 su TO_PLANT/CMD/MC1, eco DECLARE/MC1
//      coerente, rifiuto 947 (FB204), timeout, scrittura REST con gli stessi
//      valori di prima (In macchina: casa invariata, POS_PLANT 101, casella di
//      provenienza liberata; Rimuovi: MAG_POS -1, POS_PLANT 0);
//   2. pagina Macchine (CNC1View): stessa sequenza di prima, ora col 947;
//   3. Attrezzaggi, Posiziona: «In macchina» e «Rimuovi» passano dal PLC
//      (simulazione del 7/10, problema 16) e scrivono SOLO dopo l'eco; 947,
//      timeout o un altro pallet nel registro: messaggio e nessuna scrittura.
//   4. (7/10 sera) «Casella» di un pallet in macchina come «Rimuovi»: prima
//      il 41, poi la casella; la guardia del 41 (guardia41) uguale per
//      Rimuovi e Casella: un altro pallet nel registro, o il registro non
//      letto, niente comando e niente scrittura. Col 41, la casella si
//      controlla PRIMA su dati riletti adesso (occupata, disabilitata, non
//      letta: niente 41); se la scrittura fallisce lo stesso dopo il 41, il
//      messaggio dice che il registro e' gia' a 0 e il database no.
//
// (8/10, prompt 7) DETERMINISTICO. Prima il test aspettava davvero (80 ms,
// 1,65 s, 3,2 s) e sotto carico l'eco non era ancora arrivata al controllo
// («41 rifiutato (947)» fallito una volta). Adesso il socket finto consegna
// in un microtask, le attese di util/palletMachine.js usano l'orologio finto
// di util/orologio.js, e il tempo passa solo quando il test lo dice:
// attesa(ms) lascia finire tutto quello che non aspetta il tempo, poi fa
// passare ms (scadono le attese), poi lascia finire di nuovo.
//
// Uso:   node test_pallet_machine.mjs
// ============================================================================
import { readFileSync } from 'node:fs';

globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const M = await server.ssrLoadModule('/src/util/palletMachine.js');
const CNC1 = (await server.ssrLoadModule('/src/views/unit/CNC1View.vue')).default;
const ATT = (await server.ssrLoadModule('/src/views/conf/AttrezzaggiView.vue')).default;
const O = await server.ssrLoadModule('/src/util/orologio.js');
const orologio = O.orologioFinto();
O.usaOrologio(orologio);

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
// finisce tutto quello che non aspetta il tempo (promesse, consegne del socket)
const quiete = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
const attesa = async ms => { await quiete(); orologio.avanza(ms); await quiete(); };
// una promessa che si chiude solo col tempo: si fa passare ms, poi la si aspetta
const scade = async (p, ms) => { await quiete(); orologio.avanza(ms); return p; };

// socket finto: risponde ai comandi secondo lo scenario
//   risp: 'eco' | numero (allarme) | 'zitto' | stringa (eco diversa)
//   registro: payload di DECLARE/MC1 allo snapshot (undefined = nessuna risposta)
function socketFinto(o = {}) {
	const s = Object.assign({ risp: 'eco', registro: '0;0;0' }, o);
	const h = new Map();
	const emessi = [];
	const consegna = (e, p) => queueMicrotask(() => { for (const f of [...(h.get(e) || [])]) f(p); });
	return {
		emessi,
		on(e, f) { if (!h.has(e)) h.set(e, new Set()); h.get(e).add(f); },
		off(e, f) { if (h.has(e)) h.get(e).delete(f); },
		emit(e, p) {
			emessi.push(p === undefined ? e : e + ' ' + p);
			if (e === 'GRIPPER/REQUEST_SNAPSHOT') { if (s.registro !== undefined) consegna('DECLARE/MC1', s.registro); return; }
			if (e === 'TO_PLANT/CMD/MC1') {
				const atteso = String(p).startsWith('40;') ? String(p).split(';')[1] + ';0;0' : '0;0;0';
				if (s.risp === 'eco') consegna('DECLARE/MC1', atteso);
				else if (typeof s.risp === 'number') consegna('ALARM/MC1', String(s.risp));
				else if (s.risp !== 'zitto') consegna('DECLARE/MC1', s.risp);
			}
		},
		ascoltatori: () => [...h.values()].reduce((n, x) => n + x.size, 0),
	};
}
// fetch finto: pallet freschi, risposta di updatePallet, chiamate registrate
// (7/10) posti: righe di showWarehouse/WPALLET; ko: url che rispondono non ok
function fetchFinto(pallets, body = 'OK', posti = [], ko = null) {
	const chiamate = [];
	const f = async (url) => {
		const u = String(url);
		chiamate.push(u);
		if (ko && ko.test(u)) return { ok: false, json: async () => [], text: async () => '' };
		if (/pallet\/show\/all/.test(u)) return { ok: true, json: async () => JSON.parse(JSON.stringify(pallets)) };
		if (/showWarehouse\/WPALLET/.test(u)) return { ok: true, json: async () => JSON.parse(JSON.stringify(posti)) };
		return { ok: true, text: async () => (/updatePallet/.test(u) ? body : 'OK'), json: async () => [] };
	};
	f.chiamate = chiamate;
	return f;
}
const PALLETS = () => [
	{ ID: 901, FAMILY: 'PAL-A', DESCR: 'a', X: 400000, Y: 400000, Z: 100000, X_CORR: 0, Y_CORR: 0, Z_CORR: 0, MAG: 1, MAG_POS: 4, POS_PLANT: 0 },
	{ ID: 902, FAMILY: 'PAL-B', DESCR: 'b', X: 400000, Y: 400000, Z: 100000, X_CORR: 0, Y_CORR: 0, Z_CORR: 0, MAG: 1, MAG_POS: 5, POS_PLANT: 101 },
];
const scritture = f => f.chiamate.filter(u => /updatePallet|warehouseSlot/.test(u));
const param = (u, k) => new URL(u, 'http://x/').searchParams.get(k);

console.log('1) il modulo');
let so = socketFinto();
let p = M.mandaComandoPallet(so, { mc: 1, tipo: 'set', palletId: 901 });
check(so.emessi.join() === 'TO_PLANT/CMD/MC1 40;901', '40;901 parte subito, in modo sincrono');
let r = await p;
check(r.ok && so.ascoltatori() === 0, '   eco DECLARE/MC1 "901;..." = conferma, nessun ascoltatore appeso');
so = socketFinto();
r = await M.mandaComandoPallet(so, { mc: 1, tipo: 'clear' });
check(so.emessi.join() === 'TO_PLANT/CMD/MC1 41' && r.ok, '41, eco col pallet a 0 = conferma');
so = socketFinto({ risp: 947 });
r = await M.mandaComandoPallet(so, { mc: 1, tipo: 'set', palletId: 901, ms: 60 });
check(!r.ok && r.codice === 947 && !r.scaduto, '947 su ALARM/MC1 chiude subito l\'attesa');
check(M.messaggioEsitoMacchina(r, 'set') === 'palletMachine.err.set947' && M.messaggioEsitoMacchina(r, 'clear') === 'palletMachine.err.clear947', '   e ha il suo messaggio (40 e 41)');
so = socketFinto({ risp: 'zitto' });
r = await scade(M.mandaComandoPallet(so, { mc: 1, tipo: 'set', palletId: 901, ms: 60 }), 60);
check(!r.ok && r.scaduto && M.messaggioEsitoMacchina(r, 'set') === 'machine.echoTimeout' && so.ascoltatori() === 0, 'niente eco: timeout, machine.echoTimeout, ascoltatori tolti');
so = socketFinto({ risp: '902;0;0' });
r = await scade(M.mandaComandoPallet(so, { mc: 1, tipo: 'set', palletId: 901, ms: 60 }), 60);
check(!r.ok && r.scaduto, 'un\'eco con un altro pallet non vale come conferma del 40;901');
check(await M.leggiRegistroMacchina(socketFinto({ registro: '902;0;1' }), 60) === 902 && await scade(M.leggiRegistroMacchina(socketFinto({ registro: undefined }), 40), 40) === undefined,
	'registro della macchina dallo snapshot (902), undefined se non risponde');
// (7/10) la guardia del 41
const G = (pp, reg, id = 902) => JSON.stringify(M.guardia41({ palletId: id, posPlant: pp, registro: reg }));
check(G(101, 902) === '{"ok":true,"mc":1}' && G(0, 902) === '{"ok":true,"mc":1}', 'guardia41: il registro ha QUESTO pallet -> 41 a MC1 (anche se il database lo dice a magazzino)');
check(G(101, 0) === '{"ok":true,"mc":0}' && G(0, 0) === '{"ok":true,"mc":0}' && G(0, undefined) === '{"ok":true,"mc":0}',
	'   registro a 0, o pallet a magazzino: nessun 41 (a magazzino anche col registro non letto: il 41 non serve)');
check(G(101, 905) === '{"ok":false,"motivo":"palletMachine.err.otherInMachine","parametri":{"id":905}}', '   un ALTRO pallet nel registro: niente 41, si dice quale');
check(G(101, undefined) === '{"ok":false,"motivo":"palletMachine.err.registerUnread","parametri":{}}' && G(102, 0) === G(101, undefined),
	'   registro non letto (o di una macchina che il pannello non legge): niente 41 alla cieca');
check(M.inMacchina(PALLETS(), 1) === 902 && M.inMacchina([{ ID: 7, POS_PLANT: 150 }], 1) === 7 && M.inMacchina([{ ID: 7, POS_PLANT: 0 }], 1) === 0, 'inMacchina: 100+n esatto, poi la fascia legacy');
let f = fetchFinto(PALLETS());
let w = await M.scriviPosizione({ server: 'http://x/', fetchFn: f, tipo: 'set', palletId: 901, mc: 1, liberaCasella: true });
let up = scritture(f);
check(w.ok && up.length === 2 && param(up[0], 'POS_PLANT') === '101' && param(up[0], 'MAG_POS') === '4' && param(up[0], 'X') === '400000'
	&& /warehouseSlot\/free\/WPALLET\/4$/.test(up[1]), 'set: POS_PLANT 101, la casa resta (MAG_POS 4), pass-through dei campi, casella 4 liberata');
f = fetchFinto(PALLETS());
w = await M.scriviPosizione({ server: 'http://x/', fetchFn: f, tipo: 'clear', palletId: null, mc: 1 });
up = scritture(f);
check(w.ok && up.length === 1 && param(up[0], 'ID') === '902' && param(up[0], 'MAG_POS') === '-1' && param(up[0], 'POS_PLANT') === '0', 'clear senza pallet: quello a 101 (902) a MAG_POS -1 / POS_PLANT 0, nessuna casella');
f = fetchFinto(PALLETS(), 'KO_DB');
w = await M.scriviPosizione({ server: 'http://x/', fetchFn: f, tipo: 'set', palletId: 901, mc: 1, liberaCasella: true });
check(!w.ok && scritture(f).length === 1, 'risposta non OK: esito non riuscito e nessuna casella toccata');
f = fetchFinto(PALLETS());
w = await M.scriviPosizione({ server: 'http://x/', fetchFn: f, tipo: 'set', palletId: 999, mc: 1 });
check(!w.ok && scritture(f).length === 0, 'pallet non piu\' in elenco: nessuna scrittura cieca');
// (7/10) «Casella» dopo il 41: scriviPosizione tipo 'casella' e casellaLibera
f = fetchFinto(PALLETS());
w = await M.scriviPosizione({ server: 'http://x/', fetchFn: f, tipo: 'casella', casella: 6, palletId: 902 });
up = scritture(f);
check(w.ok && up.length === 3 && param(up[0], 'MAG_POS') === '6' && param(up[0], 'POS_PLANT') === '0' && param(up[0], 'X') === '400000'
	&& /occupy\/WPALLET\/6$/.test(up[1]) && /free\/WPALLET\/5$/.test(up[2]), 'casella: MAG_POS 6, POS_PLANT 0, pass-through, occupy della 6 e free della casa 5 (come la casella del Posiziona)');
f = fetchFinto(PALLETS());
w = await M.scriviPosizione({ server: 'http://x/', fetchFn: f, tipo: 'casella', casella: 5, palletId: 902 });
up = scritture(f);
check(w.ok && up.length === 2 && /occupy\/WPALLET\/5$/.test(up[1]), '   di nuovo nella propria casa (5): occupy, nessun free');
f = fetchFinto(PALLETS(), 'OK', [{ SUB_POS: 7, STATUS: 9 }]);
check((await M.casellaLibera({ server: 'http://x/', fetchFn: f, casella: 5, palletId: 902 })).ok
	&& JSON.stringify(await M.casellaLibera({ server: 'http://x/', fetchFn: f, casella: 4, palletId: 902 })) === '{"ok":false,"motivo":"warehouses.occupiedBy","parametri":{"name":"#901 PAL-A"}}'
	&& (await M.casellaLibera({ server: 'http://x/', fetchFn: f, casella: 7, palletId: 902 })).motivo === 'warehouses.disabledPos'
	&& (await M.casellaLibera({ server: 'http://x/', fetchFn: fetchFinto(PALLETS(), 'OK', [], /show/), casella: 8, palletId: 902 })).motivo === 'palletMachine.err.slotUnread',
	'casellaLibera: la propria casa e\' libera; occupata da un altro (#901 PAL-A); disabilitata (STATUS 9); non letta');

// ------------------------------------------------------------- le pagine
function vmOf(comp, extra) {
	const vm = Object.assign({}, comp.data ? comp.data.call({}) : {}, extra || {});
	for (const [k, fn] of Object.entries(comp.methods || {})) vm[k] = fn.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { configurable: true, get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k, par) => k + (par ? ' ' + JSON.stringify(par) : '');
	vm.$router = { push: () => {} };
	return vm;
}
// extra: { body, posti, ko } per fetchFinto. linea: comandi e chiamate
// nell'ordine in cui partono (per dire «prima del 41»)
function ambiente(o, pallets, extra = {}) {
	const sock = socketFinto(o);
	const linea = [];
	const emit0 = sock.emit;
	sock.emit = (e, p) => { linea.push('emit ' + e + (p === undefined ? '' : ' ' + p)); return emit0(e, p); };
	dataStored.WS = { socket: sock };
	const ff = fetchFinto(pallets || PALLETS(), extra.body, extra.posti, extra.ko);
	globalThis.fetch = (u, o2) => { linea.push('fetch ' + u); return ff(u, o2); };
	dataStored.alert = { title: '', desc: '', type: '' };
	return { sock, ff, linea };
}

console.log('\n2) pagina Macchine (CNC1View): la stessa sequenza, dal modulo');
let env = ambiente();
let cv = vmOf(CNC1);
Object.defineProperty(cv, 'rigBlockReason', { configurable: true, get: () => '' });
cv.palletsList = PALLETS();
cv.palletSel = 901;
cv.declarePallet();
check(env.sock.emessi.join() === 'TO_PLANT/CMD/MC1 40;901' && cv.declWaiting === true && scritture(env.ff).length === 0, 'Dichiara: 40;901 subito, in attesa, ancora nessuna scrittura');
await attesa(60);
up = scritture(env.ff);
check(cv.declWaiting === false && up.length === 2 && param(up[0], 'POS_PLANT') === '101' && /free\/WPALLET\/4$/.test(up[1]), '   dopo l\'eco: POS_PLANT 101 e casella di provenienza liberata (come prima)');
env = ambiente({ risp: 947 });
cv = vmOf(CNC1); Object.defineProperty(cv, 'rigBlockReason', { configurable: true, get: () => '' });
cv.palletsList = PALLETS(); cv.palletSel = 901;
cv.declarePallet(); await attesa(40);
check(scritture(env.ff).length === 0 && dataStored.alert.desc === 'palletMachine.err.set947' && cv.declWaiting === false, '947: messaggio e nessuna scrittura REST (prima: 3 s di attesa e "nessuna conferma")');
env = ambiente();
cv = vmOf(CNC1); Object.defineProperty(cv, 'rigBlockReason', { configurable: true, get: () => '' });
cv.declPallet = 902;
cv.removePallet(); await attesa(60);
up = scritture(env.ff);
check(env.sock.emessi.join() === 'TO_PLANT/CMD/MC1 41' && up.length === 1 && param(up[0], 'ID') === '902' && param(up[0], 'MAG_POS') === '-1', 'Rimuovi: 41, poi il pallet in macchina a MAG_POS -1 / POS_PLANT 0 (come prima)');
env = ambiente({ risp: 'zitto' });
cv = vmOf(CNC1); Object.defineProperty(cv, 'rigBlockReason', { configurable: true, get: () => '' });
cv.declPallet = 902;
cv.removePallet(); await attesa(3200);
check(scritture(env.ff).length === 0 && dataStored.alert.desc === 'machine.echoTimeout', 'niente eco in 3 s: machine.echoTimeout e nessuna scrittura (come prima)');

console.log('\n3) Attrezzaggi, Posiziona: «In macchina» e «Rimuovi» dal PLC');
const apri = (pallets, sel, idx = 0) => {
	const vm = vmOf(ATT);
	vm.pallets = pallets; vm.getDataTable = () => {};
	vm.placeTarget = pallets[idx]; vm.placeSel = sel;
	return vm;
};
env = ambiente({ registro: '0;0;0' }, [PALLETS()[0]]);
let av = apri([PALLETS()[0]], 'mc1');
av.confirmPlace(); await attesa(80);
up = scritture(env.ff);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT,TO_PLANT/CMD/MC1 40;901' && up.length === 2 && param(up[0], 'POS_PLANT') === '101' && param(up[0], 'MAG_POS') === '4'
	&& /free\/WPALLET\/4$/.test(up[1]) && av.placeTarget === null, 'In macchina: registro letto, 40;901, eco, poi gli stessi valori di prima (POS_PLANT 101, casa 4, casella liberata)');
check(env.ff.chiamate.indexOf(up[0]) > -1 && env.sock.emessi.indexOf('TO_PLANT/CMD/MC1 40;901') > -1, '   la scrittura arriva dopo il comando (mai prima dell\'eco)');
env = ambiente({ registro: '0;0;0', risp: 947 }, [PALLETS()[0]]);
av = apri([PALLETS()[0]], 'mc1');
av.confirmPlace(); await attesa(80);
check(scritture(env.ff).length === 0 && /palletMachine\.err\.set947/.test(dataStored.alert.desc) && av.placeTarget !== null && av.placeBusy === false, '947: messaggio, nessuna scrittura, il dialog resta aperto');
env = ambiente({ registro: '902;0;0' }, [PALLETS()[0]]);
av = apri([PALLETS()[0]], 'mc1');
av.confirmPlace(); await attesa(80);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/')) && scritture(env.ff).length === 0 && /otherInMachine.*902/.test(dataStored.alert.desc), 'nel registro un altro pallet (902): nessun comando, nessuna scrittura, si dice quale');
env = ambiente({ registro: '901;0;0' }, [PALLETS()[0]]);
av = apri([PALLETS()[0]], 'mc1');
av.confirmPlace(); await attesa(80);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/')) && scritture(env.ff).length === 2, 'il registro ha gia\' QUESTO pallet: niente 40 (sarebbe 947), solo il database');

const inMc = [Object.assign(PALLETS()[1])];
env = ambiente({ registro: '902;0;0' }, inMc);
av = apri(inMc, -1);
av.confirmPlace(); await attesa(80);
up = scritture(env.ff);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT,TO_PLANT/CMD/MC1 41' && up.length === 2 && param(up[0], 'MAG_POS') === '-1' && param(up[0], 'POS_PLANT') === '0' && /free\/WPALLET\/5$/.test(up[1]),
	'Rimuovi di un pallet in macchina (902 nel registro): 41, eco, poi MAG_POS -1 / POS_PLANT 0 e la sua casa (5) liberata, come prima');
env = ambiente({ registro: '902;0;0', risp: 947 }, inMc);
av = apri(inMc, -1);
av.confirmPlace(); await attesa(80);
check(scritture(env.ff).length === 0 && /palletMachine\.err\.clear947/.test(dataStored.alert.desc), '   41 rifiutato (947): messaggio e nessuna scrittura');
env = ambiente({ registro: '0;0;0' }, inMc);
av = apri(inMc, -1);
av.confirmPlace(); await attesa(80);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/')) && scritture(env.ff).length === 2, '   registro gia\' a 0: niente 41 (azzererebbe anche il pezzo in macchina), solo il database');
env = ambiente({ registro: '905;0;0' }, inMc);
av = apri(inMc, -1);
av.confirmPlace(); await attesa(80);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/')) && scritture(env.ff).length === 0 && /otherInMachine.*905/.test(dataStored.alert.desc), '   nel registro un ALTRO pallet: il 41 toglierebbe quello, niente comando e niente scrittura');
env = ambiente({ registro: undefined }, inMc);
av = apri(inMc, -1);
av.confirmPlace(); await attesa(M.REGISTRO_MS + 150);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT' && scritture(env.ff).length === 0 && /palletMachine\.err\.registerUnread/.test(dataStored.alert.desc) && av.placeBusy === false,
	'   registro non letto: niente 41 alla cieca e niente scrittura, «registro della macchina non letto, riprova»');
const aMag = [PALLETS()[0]];
env = ambiente({ registro: '0;0;0' }, aMag);
av = apri(aMag, -1);
av.confirmPlace(); await attesa(80);
up = scritture(env.ff);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/')) && up.length === 2 && param(up[0], 'MAG_POS') === '-1' && /free\/WPALLET\/4$/.test(up[1]), 'Rimuovi di un pallet a magazzino: la macchina non c\'entra, solo il database come prima');
env = ambiente({ registro: undefined }, aMag);
av = apri(aMag, -1);
av.confirmPlace(); await attesa(M.REGISTRO_MS + 150);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/')) && scritture(env.ff).length === 2, '   anche col registro non letto: nessun 41 da mandare, solo il database');

console.log('\n4) Posiziona, «Casella» di un pallet in macchina: come «Rimuovi», prima il 41');
// la scrittura della casella e' quella di prima: updatePallet con MAG_POS =
// casella e POS_PLANT 0, poi occupy della casella e free della provenienza
const casella = (up, n, da) => up.length === (da ? 3 : 2) && param(up[0], 'MAG_POS') === String(n) && param(up[0], 'POS_PLANT') === '0' && param(up[0], 'X') === '400000'
	&& /warehouseSlot\/occupy\/WPALLET\/\d+$/.test(up[1]) && up[1].endsWith('/' + n) && (!da || /warehouseSlot\/free\/WPALLET\/\d+$/.test(up[2]) && up[2].endsWith('/' + da));
env = ambiente({ registro: '902;0;1' }, inMc);
av = apri(inMc, 6);
av.confirmPlace(); await attesa(80);
up = scritture(env.ff);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT,TO_PLANT/CMD/MC1 41' && casella(up, 6, 5) && av.placeTarget === null,
	'pallet in macchina (902, POS_PLANT 101, nel registro), casella 6: registro letto, 41, eco, poi MAG_POS 6 / POS_PLANT 0, casella 6 occupata e la casa 5 liberata');
// (7/10) la casella si controlla PRIMA del 41, su dati riletti adesso
const i41 = env.linea.indexOf('emit TO_PLANT/CMD/MC1 41');
check(i41 > 0 && env.linea.slice(0, i41).some(x => /pallet\/show\/all$/.test(x)) && env.linea.slice(0, i41).some(x => /showWarehouse\/WPALLET$/.test(x))
	&& !env.linea.slice(0, i41).some(x => /updatePallet|warehouseSlot/.test(x)),
	'   prima del 41 si rileggono pallet e caselle (casella libera?), nessuna scrittura');
// un altro pallet ha preso la casella 6: l'elenco della pagina (polling) non lo
// sa ancora, la rilettura si'
const presa = [...inMc, { ID: 903, FAMILY: 'PAL-C', DESCR: 'c', MAG: 1, MAG_POS: 6, POS_PLANT: 0 }];
env = ambiente({ registro: '902;0;1' }, presa);
av = apri(inMc, 6);
av.confirmPlace(); await attesa(80);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT' && scritture(env.ff).length === 0 && /warehouses\.occupiedBy.*#903 PAL-C/.test(dataStored.alert.desc)
	&& av.placeTarget !== null && av.placeSel === null && av.placeBusy === false,
	'   casella presa nel frattempo (903, vista solo rileggendo): niente 41, niente scrittura, si dice da chi, si sceglie un\'altra casella');
env = ambiente({ registro: '902;0;1' }, inMc, { posti: [{ SUB_POS: 6, STATUS: 9 }] });
av = apri(inMc, 6);
av.confirmPlace(); await attesa(80);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT' && scritture(env.ff).length === 0 && /warehouses\.disabledPos/.test(dataStored.alert.desc) && av.placeSel === null,
	'   casella disabilitata (STATUS 9): niente 41, niente scrittura');
env = ambiente({ registro: '902;0;1' }, inMc, { ko: /showWarehouse/ });
av = apri(inMc, 6);
av.confirmPlace(); await attesa(80);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT' && scritture(env.ff).length === 0 && /palletMachine\.err\.slotUnread/.test(dataStored.alert.desc),
	'   caselle non lette: niente 41 alla cieca, niente scrittura');
// la casella risulta libera, ma fra la rilettura e la scrittura qualcuno la
// prende: il 41 e' gia' partito
env = ambiente({ registro: '902;0;1' }, inMc, { body: 'KO_OCCUPIED' });
av = apri(inMc, 6);
av.confirmPlace(); await attesa(80);
up = scritture(env.ff);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT,TO_PLANT/CMD/MC1 41' && up.length === 1 && param(up[0], 'MAG_POS') === '6'
	&& /palletMachine\.err\.slotAfter41.*"slot":6/.test(dataStored.alert.desc) && av.placeTarget !== null && av.placeSel === null && av.placeBusy === false,
	'   scrittura fallita DOPO il 41 (KO_OCCUPIED): nessuna casella toccata, il messaggio dice registro gia\' a 0 e database no, altra casella o «Rimuovi dal magazzino»');
env = ambiente({ registro: '902;0;1' }, inMc, { ko: /updatePallet/ });
av = apri(inMc, 6);
av.confirmPlace(); await attesa(80);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT,TO_PLANT/CMD/MC1 41' && scritture(env.ff).length === 1 && /palletMachine\.err\.slotAfter41/.test(dataStored.alert.desc),
	'   anche con la scrittura in errore di rete: lo stesso messaggio');
// il secondo tentativo, con il registro ormai a 0: niente 41, solo il database
env = ambiente({ registro: '0;0;0' }, inMc);
av = apri(inMc, 7);
av.confirmPlace(); await attesa(80);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/')) && casella(scritture(env.ff), 7, 5), '   poi un\'altra casella (7): registro a 0, niente 41, la casella si scrive');
env = ambiente({ registro: '902;0;1', risp: 'zitto' }, inMc);
av = apri(inMc, 6);
av.confirmPlace(); await attesa(80);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT,TO_PLANT/CMD/MC1 41' && scritture(env.ff).length === 0 && av.placeBusy === true,
	'   la casella si scrive solo dopo l\'eco: prima nessuna scrittura');
await attesa(M.ECO_MC_MS + 100);
check(scritture(env.ff).length === 0 && dataStored.alert.desc === 'machine.echoTimeout' && av.placeTarget !== null && av.placeBusy === false, '   niente eco in 3 s: machine.echoTimeout, nessuna scrittura, il dialog resta aperto');
env = ambiente({ registro: '902;0;1', risp: 947 }, inMc);
av = apri(inMc, 6);
av.confirmPlace(); await attesa(80);
check(scritture(env.ff).length === 0 && /palletMachine\.err\.clear947/.test(dataStored.alert.desc), '   41 rifiutato (947): messaggio e nessuna scrittura');
env = ambiente({ registro: '0;0;0' }, inMc);
av = apri(inMc, 6);
av.confirmPlace(); await attesa(80);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/')) && casella(scritture(env.ff), 6, 5), '   POS_PLANT 101 ma registro gia\' a 0: niente 41, solo il database');
const regQui = [Object.assign(PALLETS()[0])];
env = ambiente({ registro: '901;0;0' }, regQui);
av = apri(regQui, 6);
av.confirmPlace(); await attesa(80);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT,TO_PLANT/CMD/MC1 41' && casella(scritture(env.ff), 6, 4), '   database a magazzino ma nel registro QUESTO pallet (901): anche il 41, poi la casella');
env = ambiente({ registro: '905;0;0' }, inMc);
av = apri(inMc, 6);
av.confirmPlace(); await attesa(80);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT' && scritture(env.ff).length === 0 && /otherInMachine.*905/.test(dataStored.alert.desc),
	'   nel registro un ALTRO pallet (905): niente 41 e niente scrittura, si dice quale');
env = ambiente({ registro: undefined }, inMc);
av = apri(inMc, 6);
av.confirmPlace(); await attesa(M.REGISTRO_MS + 150);
check(env.sock.emessi.join() === 'GRIPPER/REQUEST_SNAPSHOT' && scritture(env.ff).length === 0 && /palletMachine\.err\.registerUnread/.test(dataStored.alert.desc),
	'   registro non letto: niente 41 alla cieca e niente scrittura, «registro della macchina non letto, riprova»');
env = ambiente({ registro: '0;0;0' }, aMag);
av = apri(aMag, 6);
av.confirmPlace(); await attesa(80);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/')) && casella(scritture(env.ff), 6, 4) && av.placeTarget === null, 'pallet a magazzino: nessun 41, la casella come prima (MAG_POS 6, occupy 6, free 4)');
env = ambiente({ registro: undefined }, aMag);
av = apri(aMag, 6);
av.confirmPlace(); await attesa(M.REGISTRO_MS + 150);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/')) && casella(scritture(env.ff), 6, 4), '   anche col registro non letto: il 41 non serve, la casella si scrive');

const att = readFileSync('src/views/conf/AttrezzaggiView.vue', 'utf8');
check(/import \{ mandaComandoPallet, scriviPosizione, leggiRegistroMacchina, guardia41, casellaLibera, messaggioEsitoMacchina \} from '\.\.\/\.\.\/util\/palletMachine\.js'/.test(att)
	&& /import \{ mandaComandoPallet, scriviPosizione, messaggioEsitoMacchina \} from '\.\.\/\.\.\/util\/palletMachine\.js'/.test(readFileSync('src/views/unit/CNC1View.vue', 'utf8'))
	&& /from '\.\/palletMachine\.js'/.test(readFileSync('src/util/palletOnRobot.js', 'utf8')),
	'Attrezzaggi, pagina Macchine e pallet a bordo usano lo STESSO modulo (util/palletMachine.js)');
const senzaCommenti = t => t.replace(/\/\/.*$/gm, '');
check((senzaCommenti(att).match(/\bguardia41\(/g) || []).length === 2 && (senzaCommenti(readFileSync('src/util/palletOnRobot.js', 'utf8')).match(/\bguardia41\(/g) || []).length === 1
	&& !/mc === 1 && reg/.test(att),
	'   la guardia del 41 e\' UNA: guardia41 in Rimuovi e Casella, e nel pallet a bordo del robot; nessuna copia a mano');
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
check(Object.keys(it.palletMachine.err).join() === Object.keys(en.palletMachine.err).join() && /947/.test(it.palletMachine.err.set947), 'testi it/en');

await server.close();
console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
