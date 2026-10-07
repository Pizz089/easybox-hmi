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

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const attesa = ms => new Promise(r => setTimeout(r, ms));

// socket finto: risponde ai comandi secondo lo scenario
//   risp: 'eco' | numero (allarme) | 'zitto' | stringa (eco diversa)
//   registro: payload di DECLARE/MC1 allo snapshot (undefined = nessuna risposta)
function socketFinto(o = {}) {
	const s = Object.assign({ risp: 'eco', registro: '0;0;0' }, o);
	const h = new Map();
	const emessi = [];
	const consegna = (e, p) => setTimeout(() => { for (const f of [...(h.get(e) || [])]) f(p); }, 2);
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
function fetchFinto(pallets, body = 'OK') {
	const chiamate = [];
	const f = async (url) => {
		const u = String(url);
		chiamate.push(u);
		if (/pallet\/show\/all/.test(u)) return { ok: true, json: async () => JSON.parse(JSON.stringify(pallets)) };
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
r = await M.mandaComandoPallet(so, { mc: 1, tipo: 'set', palletId: 901, ms: 60 });
check(!r.ok && r.scaduto && M.messaggioEsitoMacchina(r, 'set') === 'machine.echoTimeout' && so.ascoltatori() === 0, 'niente eco: timeout, machine.echoTimeout, ascoltatori tolti');
so = socketFinto({ risp: '902;0;0' });
r = await M.mandaComandoPallet(so, { mc: 1, tipo: 'set', palletId: 901, ms: 60 });
check(!r.ok && r.scaduto, 'un\'eco con un altro pallet non vale come conferma del 40;901');
check(await M.leggiRegistroMacchina(socketFinto({ registro: '902;0;1' }), 60) === 902 && await M.leggiRegistroMacchina(socketFinto({ registro: undefined }), 40) === undefined,
	'registro della macchina dallo snapshot (902), undefined se non risponde');
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
function ambiente(o, pallets) {
	const sock = socketFinto(o);
	dataStored.WS = { socket: sock };
	const ff = fetchFinto(pallets || PALLETS());
	globalThis.fetch = ff;
	dataStored.alert = { title: '', desc: '', type: '' };
	return { sock, ff };
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
const aMag = [PALLETS()[0]];
env = ambiente({ registro: '0;0;0' }, aMag);
av = apri(aMag, -1);
av.confirmPlace(); await attesa(80);
up = scritture(env.ff);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/')) && up.length === 2 && param(up[0], 'MAG_POS') === '-1' && /free\/WPALLET\/4$/.test(up[1]), 'Rimuovi di un pallet a magazzino: la macchina non c\'entra, solo il database come prima');
env = ambiente({}, aMag);
av = apri(aMag, 6);
av.confirmPlace(); await attesa(40);
check(!env.sock.emessi.some(e => e.startsWith('TO_PLANT/') || e === 'GRIPPER/REQUEST_SNAPSHOT') && scritture(env.ff).some(u => param(u, 'MAG_POS') === '6'), 'casella: invariata, solo il database');

const att = readFileSync('src/views/conf/AttrezzaggiView.vue', 'utf8');
check(/import \{ mandaComandoPallet, scriviPosizione, leggiRegistroMacchina, messaggioEsitoMacchina \} from '\.\.\/\.\.\/util\/palletMachine\.js'/.test(att)
	&& /import \{ mandaComandoPallet, scriviPosizione, messaggioEsitoMacchina \} from '\.\.\/\.\.\/util\/palletMachine\.js'/.test(readFileSync('src/views/unit/CNC1View.vue', 'utf8'))
	&& /from '\.\/palletMachine\.js'/.test(readFileSync('src/util/palletOnRobot.js', 'utf8')),
	'Attrezzaggi, pagina Macchine e pallet a bordo usano lo STESSO modulo (util/palletMachine.js)');
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
check(Object.keys(it.palletMachine.err).join() === Object.keys(en.palletMachine.err).join() && /947/.test(it.palletMachine.err.set947), 'testi it/en');

await server.close();
console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
