// ============================================================================
// test_pallet_mc.mjs — pallet DA e VERSO la macchina (16/9)
//
// IL DIFETTO. Dal pannello non si riusciva a comandare il prelievo di un
// pallet dalla macchina, mentre a mano "13;3;9;0" funzionava.
// Due strati, in PalletsView:
//   1. il gate del bottone era :move="dt.MAG_POS>=0". Ma MAG_POS NEGATIVO e'
//      la convenzione per "fuori magazzino" (vedi palletPositionLabel), e in
//      ComandsRows il bottone e' un v-if: per il pallet in macchina non
//      veniva nemmeno RENDERIZZATO. L'operazione spariva dal pannello.
//   2. anche passando, il payload portava dt.MAG_POS grezzo, cioe' un numero
//      NEGATIVO: FB7 ramifica su posizione = 0 (macchina) o > 0 (scaffale),
//      e -3 non e' ne' l'uno ne' l'altro.
// Dove sta davvero il pallet lo dice POS_PLANT (1000 = in pinza, 100+n =
// macchina n), non MAG_POS.
//
// Uso:   node test_pallet_mc.mjs     (dalla cartella easybox/HMI)
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const wh = await server.ssrLoadModule('/src/util/warehouseGrid.js');
const Robot = (await server.ssrLoadModule('/src/views/unit/robotView.vue')).default;
const Pallets = (await server.ssrLoadModule('/src/views/conf/PalletsView.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = () => new Promise(r => setTimeout(r, 25));
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

// i quattro casi reali dell'anagrafica pallet
const A_SCAFFALE = { ID: 9, MAG: 1, MAG_POS: 11, POS_PLANT: 0, FAMILY: 'a scaffale' };
const IN_MACCHINA = { ID: 9, MAG: 1, MAG_POS: -3, POS_PLANT: 101, FAMILY: 'in macchina' };
const IN_PINZA = { ID: 1, MAG: 1, MAG_POS: 6, POS_PLANT: 1000, FAMILY: 'sul robot' };
const SPERSO = { ID: 2, MAG: 1, MAG_POS: -3, POS_PLANT: 0, FAMILY: 'fuori magazzino, non in macchina' };

console.log('1) la posizione del comando: 0 = macchina, >0 = scaffale, mai un negativo');
check(wh.PALLET_POS_MACHINE === 0, 'la costante dice che 0 vuol dire macchina');
check(wh.palletPickPosition(A_SCAFFALE) === 11, 'a scaffale: si preleva dal suo posto');
check(wh.palletPickPosition(IN_MACCHINA) === 0, 'IN MACCHINA: posizione 0 — e\' il caso che non si riusciva a comandare');
check(wh.palletPickPosition(IN_PINZA) === null, 'gia\' in pinza: non si preleva');
check(wh.palletPickPosition(SPERSO) === null, 'fuori magazzino e non in macchina: non si inventa una posizione');
check(wh.palletPickPosition(SPERSO) !== -3, 'e soprattutto NON si manda il MAG_POS negativo (era il difetto)');
check(wh.palletPlacePosition(A_SCAFFALE) === 11, 'deposito: il posto assegnato');
check(wh.palletPlacePosition(IN_MACCHINA) === null, 'deposito: senza posto assegnato non si deduce la destinazione');
check(wh.palletIsInMachine(IN_MACCHINA) && !wh.palletIsInMachine(A_SCAFFALE) && !wh.palletIsInMachine(IN_PINZA),
	'in macchina = POS_PLANT nella fascia 100..999, non MAG_POS');

console.log('\n2) PAGINA PALLET: il bottone c\'era per tutti tranne quello in macchina');
function vmOf(comp, extra) {
	const vm = Object.assign({}, comp.data ? comp.data.call({}) : {}, extra || {});
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	// configurable: alcune computed vanno sostituite dal test per isolare il
	// ramo in esame (palletBranchEnabled dipende da segnali PLC assenti qui)
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { configurable: true, get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k) => k;
	vm.$router = { push: () => {} };
	return vm;
}
globalThis.fetch = async () => ({ ok: true, json: async () => [], text: async () => 'OK' });
const pv = vmOf(Pallets);
pv.dataGripper = { STATUS: 2 };                 // pinza pallet VUOTA -> prelievo (13)
check(pv.movePos(IN_MACCHINA) === 0, 'pinza vuota + pallet in macchina -> posizione 0, bottone presente');
check(pv.movePos(A_SCAFFALE) === 11, 'pinza vuota + pallet a scaffale -> il suo posto');
check(pv.movePos(SPERSO) === null, 'pallet sperso -> null, e il bottone resta assente (non si comanda al buio)');
pv.dataGripper = { STATUS: 1 };                 // pinza PIENA -> deposito (14)
check(pv.movePos(A_SCAFFALE) === 11, 'pinza piena -> destinazione = posto assegnato');
check(pv.inMachine(IN_MACCHINA) === true, 'la tabella puo\' dire IN MACCHINA invece di un generico OUT');
// il gate e il payload devono usare LA STESSA funzione: un gate che dice si'
// e un payload che manda altro e' il difetto di partenza
const psrc = readFileSync('src/views/conf/PalletsView.vue', 'utf8');
check(/:move="movePos\(dt\) !== null/.test(psrc), 'il gate del bottone chiede "la posizione si sa comporre"');
check(/movePos\(dt\)\s*$/m.test(psrc.replace(/\r/g, '')), 'e il payload manda quella stessa posizione');
check(!/dt\.MAG_POS\s*$/m.test(psrc.replace(/\r/g, '')), 'nessun MAG_POS grezzo nel payload');
check(!/:move="dt\.MAG_POS>=0/.test(psrc), 'il vecchio gate su MAG_POS non c\'e\' piu\'');

console.log('\n3) PAGINA ROBOT: stesso contratto, stesso comando');
const sent = [];
dataStored.WS = { socket: { on() {}, off() {}, emit(ev, p) { sent.push({ ev, payload: p }); } } };
const rv = vmOf(Robot);
rv.dialog = { type: 'palletLoad', selected: IN_MACCHINA };
rv.sendMission = (k, cmd) => sent.push({ ev: 'TO_PLANT/CMD/ROBOT', payload: cmd });
// palletBranchEnabled e' una computed: si ridefinisce la proprieta', non si
// assegna (il vm del test espone solo il getter)
Object.defineProperty(rv, 'palletBranchEnabled', { get: () => 1, configurable: true });
rv.palletGripperEmptyNow = () => 1;
rv.confirmDialog();
await tick();
check(sent.some(x => x.payload === '13;3;9;0'), 'preleva dalla macchina: 13;3;9;0 — lo stesso comando provato a mano');
sent.length = 0;
rv.dialog = { type: 'palletLoad', selected: A_SCAFFALE };
rv.confirmDialog();
await tick();
check(sent.some(x => x.payload === '13;3;9;11'), 'dal magazzino: 13;3;9;11, come prima');
sent.length = 0;
rv.dialog = { type: 'palletLoad', selected: SPERSO };
rv.confirmDialog();
await tick();
check(!sent.some(x => String(x.payload).startsWith('13;')), 'pallet sperso: NESSUN comando');
check(String(dataStored.alert.desc) === 'robot.dialog.palletNoPosition', 'e il motivo e\' scritto, non un silenzio');
// deposito
sent.length = 0;
rv.dialog = { type: 'palletUnload', selected: A_SCAFFALE };
rv.palletGripperEmptyNow = () => 0;
rv.confirmDialog();
await tick();
check(sent.some(x => x.payload === '14;3;9;11'), 'deposita a magazzino: 14;3;9;11');
// e i due comandi dedicati alla macchina restano quelli
const rsrc = readFileSync('src/views/unit/robotView.vue', 'utf8');
check(/'13;3;' \+ sel\.ID \+ ';0'/.test(rsrc) && /'14;3;' \+ sel\.ID \+ ';0'/.test(rsrc),
	'preleva/deposita in macchina dalla card collaudo: posizione 0 fissa, invariati');
check(!/';' \+ sel\.MAG_POS/.test(rsrc), 'nessun MAG_POS grezzo nel payload della pagina robot');

console.log('\n3-bis) COMANDO 40: l\'ID puo\' venire solo dall\'elenco');
// In DB_MC1.pallet e' finito 23178, che in anagrafica non esiste. Il PLC non
// valida quel campo: lo scrive e basta. Il 40 lo compone SOLO CNC1View, da un
// <select> popolato con gli ID veri — niente campo libero, niente valore
// calcolato. Qui si verifica che resti cosi', e che una lista stantia non
// possa far passare un ID sparito nel frattempo.
const CNC1 = (await server.ssrLoadModule('/src/views/unit/CNC1View.vue')).default;
const cv = vmOf(CNC1);
cv.palletsList = [{ ID: 1, FAMILY: 'ZERO POINT' }, { ID: 9, FAMILY: 'x' }];
Object.defineProperty(cv, 'rigBlockReason', { configurable: true, get: () => '' });
sent.length = 0;
cv.palletSel = 9;
cv.declarePallet();
check(sent.some(x => x.ev === 'TO_PLANT/CMD/MC1' && x.payload === '40;9'), 'ID scelto dall\'elenco: parte 40;9');
sent.length = 0;
// la dichiarazione riuscita ha armato l'attesa dell'eco: qui non arriva
// nessun eco, quindi si sblocca a mano prima della seconda prova
cv.declWaiting = false;
cv.palletSel = 23178;                       // il numero trovato in DB_MC1.pallet
cv.declarePallet();
check(!sent.some(x => x.ev === 'TO_PLANT/CMD/MC1'), 'ID che non e\' nell\'elenco: NESSUN comando');
check(String(dataStored.alert.desc) === 'machine.palletNotInList', 'e il motivo e\' scritto');
const csrc = readFileSync('src/views/unit/CNC1View.vue', 'utf8');
check(!/type=.text.[^>]*palletSel/.test(csrc), 'nessun campo libero per l\'ID pallet: solo il select');
check((csrc.match(/'40;'/g) || []).length === 1, 'il 40 si compone in UN punto solo');

console.log('\n4) le frasi');
check(typeof it.pallet.inMachine === 'string' && typeof en.pallet.inMachine === 'string', 'pallet.inMachine in it+en');
check(/non e' a scaffale ne' in macchina|non è a scaffale/.test(it.robot.dialog.palletNoPosition),
	'il rifiuto dice PERCHE\' non si puo\' comandare');
check(/Assegnargli un posto/.test(it.robot.dialog.palletNoPosition), 'e cosa fare');
check(typeof en.robot.dialog.palletNoPosition === 'string', 'tradotto');
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
check(flat(it).length === flat(en).length, 'parita\' di conteggio it/en: ' + flat(it).length);

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
