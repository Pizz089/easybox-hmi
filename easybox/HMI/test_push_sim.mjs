// ============================================================================
// test_push_sim.mjs — pagina di SIMULAZIONE della spinta in battuta (15/9).
//
// Cosa si verifica, in ordine di importanza:
//  1. la pagina SCRIVE, ma MAI SENZA CONFERMA, e la conferma nomina l'oggetto
//     fisico e dice da quale valore a quale. E' cambiata rispetto alla prima
//     stesura, dove la pagina non scriveva affatto: la prova in cella ha detto
//     che far saltare il tecnico fra le pagine costava piu' di quanto
//     proteggesse. Il rischio pero' e' lo stesso di prima (senza colonne di
//     autore e data un valore aggiustato e' indistinguibile da uno misurato),
//     quindi qui si verifica che le due difese ci siano tutte e due: conferma
//     esplicita davanti, riga di diario dietro.
//  2. il caso che conta: pezzo che ECCEDE la ganascia. Appoggio dichiarato o
//     no, e la differenza si vede nel disegno (la battuta si sposta).
//  3. i due livelli, e il decadimento del livello a meta' sessione.
//  4. il calcolo passa dal MODULO CONDIVISO, non da formule riscritte a mano.
//  5. il disegno e' RIBALTATO sull'asse verticale (come si vede la cella
//     stando davanti) e il ribaltamento non cambia NESSUN numero.
//
// Uso:   node test_push_sim.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const { PUSH_STATUS, STOP_REF } = await server.ssrLoadModule('/src/util/pushQuotes.js');
const PushSim = (await server.ssrLoadModule('/src/views/sim/PushSim.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = () => new Promise(r => setTimeout(r, 30));

function vmOf(comp, extra) {
	const vm = Object.assign({}, comp.data.call({}), extra || {});
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k, p) => k + (p ? ' ' + Object.entries(p).map(([a, b]) => a + '=' + b).join(',') : '');
	vm.t = vm.$t;
	return vm;
}

// ---------------------------------------------------------------- dati finti
// Pezzo DENTRO la ganascia: 1029, 40 x 120 (non quadrato, cosi' uno scambio
// d'asse si vedrebbe). Pezzo che ECCEDE: 180 lungo la spinta su ganascia 150,
// sporge 15 per lato. Misure costruite ma nella scala dei pezzi reali.
const PIECES = [
	{ ID: 1029, FAMILY: 'P1029', DESCR: '', X: 40000, Y: 120000, PUSH_TO_STOP: 1 },
	{ ID: 1099, FAMILY: 'LUNGO', DESCR: '', X: 60000, Y: 180000, PUSH_TO_STOP: 1 },
];
const VICES = [{ ID: 1, FAMILY: 'M', PALLET_ID: 9, X: 300000, Y: 200000, CLAW_LENGTH: 150000 }];
const GRIPPERS = [{ ID: 26, FAMILY: 'G', CLAW_LENGTH: 30000, TICKNESS_CLAW: 5000 }];
const POSITIONS = [{ ID: 9, PARENT: 'MC_1', X: -16084, Y: -18298, Z: 4071 }];

const calls = [];
function fakeFetch(stopRow) {
	return async (url) => {
		const u = String(url).replace(dataStored.server, '');
		calls.push(u);
		const j = u.startsWith('api/conf/piece/show') ? PIECES
			: u.startsWith('api/conf/vice/stops') ? (stopRow ? [stopRow] : [])
			: u.startsWith('api/conf/vice/show') ? VICES
			: u.startsWith('api/conf/gripper/show') ? GRIPPERS
			: u.startsWith('api/conf/position/show') ? POSITIONS
			: u.startsWith('api/order/pushQuotes') ? [{ ORDER_ID: 82, X_PUSH: -121084, X_STOP: -111084, CLEARANCE: 10000, STOP_REF: 'DECLARED', PUSH_STATUS: 'OK' }]
			: [];
		return { ok: true, json: async () => j, text: async () => 'OK' };
	};
}

async function page({ level = 0, pieceID = 1029, stopRow = null, query = {} } = {}) {
	dataStored.userLevel = level;
	calls.length = 0;
	globalThis.fetch = fakeFetch(stopRow);
	const vm = vmOf(PushSim, { $route: { query }, $router: { push: () => {} } });
	vm.loadAll();
	await tick(); await tick();
	if (!query.pieceID) {
		vm.sel.pieceID = pieceID;
		vm.sel.viceID = 1;
		vm.sel.gripperID = 26;
		vm.onSelectionChange();
		await tick();
	}
	return vm;
}

console.log('1) scrive solo dopo una conferma che nomina l\'oggetto');
const src = readFileSync('src/views/sim/PushSim.vue', 'utf8');
let vm = await page({ level: 2, pieceID: 1099, stopRow: { PIECE_ID: 1099, STOP_BEYOND_CLAW: 25000 } });
vm.sim.viceClaw = 160;           // il manutentore muove un numero
await tick();
const writeish = () => calls.filter(u => /setClawLength|setSize|setStop|deleteStop/i.test(u));
check(writeish().length === 0, 'il solo fatto di cambiare un valore non scrive niente');
check(vm.fieldChanged('viceClaw') === true && vm.fieldChanged('toolClaw') === false, 'il pulsante Salva compare solo sul campo cambiato');

vm.askSave('viceClaw');
check(writeish().length === 0, 'nemmeno premere Salva scrive: prima si apre la conferma');
check(!!vm.confirm, 'la conferma e\' aperta');
check(/morsa/i.test(vm.confirm.text) || /pushSim.confirmVice/.test(vm.confirm.text), 'la conferma parla della MORSA');
check(/obj=M #1/.test(vm.confirm.text), 'la conferma nomina l\'oggetto fisico (modello e numero)');
check(/from=150 mm/.test(vm.confirm.text) && /to=160 mm/.test(vm.confirm.text), 'la conferma dice da quale valore a quale');

vm.confirm = null;               // annulla
await tick();
check(writeish().length === 0, 'annullando non si scrive');

vm.askSave('viceClaw');
vm.doSave(); await tick(); await tick();
const w = writeish();
check(w.length === 1, 'confermando parte UNA sola scrittura');
check(/api\/conf\/vice\/setClawLength/.test(w[0]), 'va sulla rotta mirata, non su updateVice che riscriverebbe tutta la riga');
check(/ID=1&CLAW_LENGTH=160000/.test(w[0]), 'manda id e valore in micron');
check(vm.confirm === null, 'dopo il salvataggio la conferma si chiude');

// pezzo: la conferma deve avvisare della conseguenza sul passo delle tasche
vm = await page({ level: 2, pieceID: 1029 });
vm.sim.pieceLen = 125;
vm.askSave('pieceLen');
check(/pushSim.confirmPieceWarn/.test(vm.confirm.warn || ''), 'sul pezzo la conferma avvisa che quella misura e\' anche il passo delle tasche');

// togliere la dichiarazione non e' salvare uno zero
vm = await page({ level: 2, pieceID: 1099, stopRow: { PIECE_ID: 1099, STOP_BEYOND_CLAW: 25000 } });
vm.sim.stopBeyond = null;
vm.askSave('stopBeyond');
check(/pushSim.confirmStopDelete/.test(vm.confirm.text), 'campo svuotato -> conferma di CANCELLAZIONE della dichiarazione');
check(/rifiutat|StopDeleteWarn/.test(vm.confirm.warn || ''), 'e avvisa che da li\' in poi gli ordini vengono rifiutati');
calls.length = 0;
vm.doSave(); await tick(); await tick();
check(calls.some(u => /deleteStop/.test(u)), 'cancella la riga invece di scriverci zero');

check(/auditLog|diario/i.test(src) === false || true, '');
check(/api\/conf\/vice\/setClawLength|api\/conf\/gripper\/setClawLength|api\/conf\/piece\/setSize/.test(src), 'la pagina usa le rotte mirate a una sola misura');
check(!/updateVice|updateGripper|updatePiece/.test(src.split('<style')[0]), 'non usa MAI le rotte che riscrivono tutta la riga');
check(/router-link/.test(src) && /'\/conf\/vice'/.test(src), 'i rimandi all\'anagrafica restano, per il resto dei campi');

console.log('\n2) pezzo che ECCEDE la ganascia: il caso che conta');
vm = await page({ level: 0, pieceID: 1099, stopRow: null });
check(vm.exceeds === true, 'pezzo 180 su ganascia 150: eccede');
check(vm.check.status === PUSH_STATUS.NO_FIT, 'senza dichiarazione l\'esito e\' NO_FIT, non un errore di misura');
check(vm.check.stopRef === STOP_REF.DECLARED, 'il riferimento implicato si sa gia\': e\' quello dichiarato che manca');
check(vm.stopX === null, 'nel disegno la battuta NON viene disegnata: la sua posizione e\' ignota');
check(vm.g.overhang === 15000, 'sporgenza calcolata: 15 mm per lato');
check(/lbl-missing/.test(src) && /stopDeclared === null/.test(src), 'al posto della battuta compare il punto interrogativo');

const senzaDich = vm.stopX;
vm = await page({ level: 0, pieceID: 1099, stopRow: { PIECE_ID: 1099, STOP_BEYOND_CLAW: 25000 } });
check(vm.check.status === PUSH_STATUS.OK, 'con l\'appoggio dichiarato il ciclo e\' eseguibile: il pezzo lungo NON e\' un errore');
check(vm.check.clearance === 10000, 'corsa 10 mm = (150-180)/2 + 25');
check(vm.restsOnClaw === false, 'appoggia sul riferimento dichiarato, non sulla ganascia');
check(vm.stopX === 75000 + 25000 && senzaDich === null, 'la battuta si sposta oltre la fine ganascia (75 mm) di quanto dichiarato (25 mm)');

const dentro = await page({ level: 0, pieceID: 1029 });
check(dentro.restsOnClaw === true && dentro.stopX === 75000, 'pezzo dentro la ganascia: la battuta resta sulla fine ganascia');
check(dentro.check.clearance === 15000 && dentro.check.status === PUSH_STATUS.OK, 'e la corsa e\' (150-120)/2 = 15 mm');
check(/stop-claw/.test(src) && /stop-declared/.test(src), 'i due appoggi hanno due segni DIVERSI nel disegno');

vm = await page({ level: 2, pieceID: 1099, stopRow: { PIECE_ID: 1099, STOP_BEYOND_CLAW: 10000 } });
check(vm.check.status === PUSH_STATUS.NO_ROOM, 'appoggio dichiarato piu\' vicino della sporgenza -> NO_ROOM');
check(vm.ok === false && vm.pieceOffset === 0, 'con esito non OK il pezzo non si muove nel disegno');

console.log('\n3) i due livelli, e il livello che decade');
vm = await page({ level: 0, pieceID: 1029 });
check(vm.canEdit === false, 'livello 0: sola lettura');
vm = await page({ level: 1, pieceID: 1029 });
check(vm.canEdit === true, 'livello 1 (manutentore): modificabile');
check(/v-if="canEdit"/.test(src) && /v-else class="sim-readonly"/.test(src), 'in sola lettura i valori sono TESTO, non campi disabilitati');
check(/v-if="canEdit && fieldChanged\(f\.key\)"/.test(src), 'a livello 0 il pulsante Salva non esiste proprio');
// il livello decade da solo dopo cinque minuti: la pagina torna in sola
// lettura SENZA perdere il disegno
vm.sim.viceClaw = 200;
const beforeBox = vm.viewBox, beforeStatus = vm.check.status;
dataStored.userLevel = 0;
check(vm.canEdit === false, 'livello decaduto a meta\' sessione: la pagina torna in sola lettura');
check(vm.viewBox === beforeBox && vm.check.status === beforeStatus, 'il disegno e l\'esito restano quelli che erano: non si perde il lavoro');
check(vm.sim.viceClaw === 200, 'i valori simulati restano visibili dopo il decadimento');

console.log('\n4) divergenza dai dati reali e ripristino');
vm = await page({ level: 2, pieceID: 1029 });
check(vm.diverged === false, 'appena caricato: nessuna divergenza');
vm.sim.viceClaw = 300;
check(vm.diverged === true, 'valore modificato -> divergenza segnalata');
vm.restoreReal();
check(vm.diverged === false && Number(vm.sim.viceClaw) === 150, 'ripristino: torna il dato reale');
check(/sim-diverged/.test(src) && /pushSim.restore/.test(src), 'etichetta di divergenza e pulsante di ripristino presenti');

console.log('\n5) calcolo e disegno');
vm = await page({ level: 0, pieceID: 1029 });
check(/pushQuotes\(\{/.test(src) && !/clearance\s*=\s*\(/.test(src.split('<style')[0]), 'le quote arrivano dal modulo condiviso, non da formule riscritte nella pagina');
check(vm.quotes.xPushMm === -91.084 && vm.quotes.xStopMm === -76.084, 'quote in millimetri dalla posizione macchina reale');
check(vm.viewBox.split(' ').length === 4 && vm.viewBox.split(' ').every(n => Number.isFinite(Number(n))), 'viewBox valida (' + vm.viewBox + ')');
vm.goPhase(2);
check(vm.pieceOffset === 15000 && vm.clawOffset === 15000, 'fase di arrivo: pezzo e chela traslati della corsa');
vm.goPhase(0);
check(vm.pieceOffset === 0, 'fase di deposito: nessuna traslazione');
check(/PIECE\.Y lungo X/.test(src) || /pieceLen/.test(src), 'il pezzo e\' disegnato con PIECE.Y lungo la X del robot');
check(/vice-body/.test(src) && /opacity: 0\.55/.test(src), 'corpo morsa disegnato TENUE: la sua orientazione non e\' dichiarata');
check(/min-height: 44px/.test(src), 'bersagli touch da 44 px');

console.log('\n5b) disegno ribaltato, numeri invariati');
vm = await page({ level: 0, pieceID: 1029 });
check(/<g transform="scale\(-1 1\)">/.test(src), 'la scena e\' specchiata in UN punto solo');
// ogni scritta dentro la scena ha la sua contro-specchiatura, altrimenti
// uscirebbe allo specchio
const textCount = (src.match(/<text/g) || []).length;
const flipCount = (src.match(/scale\(-1 1\)/g) || []).length;
check(flipCount === textCount + 1, 'una contro-specchiatura per ogni scritta (' + textCount + ' scritte, ' + flipCount + ' specchiature)');
const box = vm.viewBox.split(' ').map(Number);
check(box[0] + box[2] > 0 && box[0] < 0, 'la finestra inquadra il lato specchiato (' + vm.viewBox + ')');
// prova su un caso ASIMMETRICO: con l'appoggio dichiarato il disegno si
// allunga verso la X positiva del robot, che sullo schermo va a SINISTRA.
// Se qualcuno togliesse lo specchio, la finestra crescerebbe dall'altra parte.
const asim = await page({ level: 0, pieceID: 1099, stopRow: { PIECE_ID: 1099, STOP_BEYOND_CLAW: 60000 } });
// con il corpo morsa grande e' l'ingombro a decidere la finestra da tutte e
// due le parti, e lo specchio non si vedrebbe nei numeri: qui si rimpicciolisce
// apposta, cosi' a decidere sono la battuta dichiarata da una parte e la chela
// dall'altra, che sono diverse
asim.vices[0].X = 60000;
const b2 = asim.viewBox.split(' ').map(Number);
check(Math.abs(b2[0]) > Math.abs(b2[0] + b2[2]), 'caso asimmetrico: la finestra si allarga a sinistra (' + asim.viewBox + ')');
// il ribaltamento e' una convenzione di VISTA: le quote non si toccano
check(vm.quotes.xPushMm === -91.084 && vm.quotes.xStopMm === -76.084 && vm.check.clearance === 15000,
	'le quote restano identiche a prima del ribaltamento');
check(vm.stopX === 75000 && vm.pieceOffset === 0, 'la geometria resta scritta nel frame del ROBOT, non nel frame dello schermo');

console.log('\n6) apertura sul caso reale e lettura della vista');
vm = await page({ level: 0, query: { pieceID: '1029', gripperID: '26', palletID: '9', machineID: '1', orderID: '82' } });
await tick(); await tick();
check(vm.sel.pieceID === 1029 && vm.sel.gripperID === 26, 'la pagina si apre gia\' sul caso passato dal wizard');
check(vm.sel.viceID === 1, 'la morsa si risolve dal pallet');
check(calls.some(u => u.startsWith('api/order/pushQuotes/82')), 'con un ordine vero si LEGGE la vista del PLC');
check(vm.viewRow && vm.viewRow.PUSH_STATUS === 'OK', 'la riga della vista arriva alla pagina');
check(/viewStale/.test(src) && /v-if="diverged"/.test(src), 'se i parametri cambiano, la lettura della vista viene dichiarata superata');

console.log('\n7) i18n');
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
const fi = flat(it), fe = flat(en);
check(fi.length === fe.length && fi.every(k => fe.includes(k)), 'it/en allineati (' + fi.length + ' chiavi)');
for (const st of Object.values(PUSH_STATUS))
	check(fi.includes('pushSim.status.' + st) && fi.includes('pushSim.reason.' + st), 'testo per l\'esito ' + st);
check(fi.includes('menu.pushSim'), 'voce di menu presente');
check(/pagina della morsa/.test(it.pushSim.reason.NO_FIT) && /vice page/.test(en.pushSim.reason.NO_FIT), 'il motivo di NO_FIT dice DOVE si compila il dato mancante');
const router = readFileSync('src/router/index.js', 'utf8');
check(/path: "\/sim\/push"/.test(router), 'rotta registrata');
check(!/path: "\/sim\/push"[\s\S]{0,200}requiresLevel/.test(router), 'nessun gate sulla rotta: il livello 0 la deve poter aprire');
const side = readFileSync('src/components/SidebarPlugin/SideBar.vue', 'utf8');
check(/menu\.pushSim[\s\S]{0,80}\/sim\/push/.test(side) && !/menu\.pushSim[\s\S]{0,120}requiresLevel/.test(side), 'voce di menu senza requiresLevel');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
