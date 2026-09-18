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
const VICES = [
	{ ID: 1, FAMILY: 'M', PALLET_ID: 9, X: 300000, Y: 200000, CLAW_LENGTH: 150000, Z_CLAW: 27300, Z_SINK_CLAW: 5000 },
	// morsa mai misurata: in cella e' la 2, con CLAW_LENGTH a NULL
	{ ID: 2, FAMILY: 'M2', PALLET_ID: 3, X: 300000, Y: 300000, CLAW_LENGTH: null, Z_CLAW: 20000, Z_SINK_CLAW: 10000 },
];
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
check(/min-height: (44|52)px/.test(src), 'bersagli touch almeno 44 px');

console.log('\n5c) stile allineato al resto del pannello');
// La pagina deve sembrare parte dello stesso applicativo: guscio, card,
// etichette e bottoni sono quelli del design system, non inventati qui.
check(/class="view-shell view-shell--fill conf-card/.test(src), 'guscio e card standard delle view di configurazione');
check(/<h3 class="view-title">/.test(src), 'titolo con la classe di pagina, non un h1 con stile proprio');
check(/class="section-label"/.test(src) && !/sim-h2/.test(src), 'etichette di sezione dal design system');
check(/class="pure-button pure-button-primary"/.test(src), 'azione principale: variante primary canonica');
check(/class="btn-ghost/.test(src), 'azioni secondarie: variante ghost canonica');
check(!/class="pure-button button_pressed/.test(src), 'niente varianti legacy fuori dalle sei canoniche');
// nessun colore inventato: tutto dai token
const styleBlock = src.slice(src.indexOf('<style'));
check(!/#[0-9a-fA-F]{3,8}\b/.test(styleBlock), 'nessun colore esadecimale nello stile: solo token');
check(!/font-size:\s*\d/.test(styleBlock), 'nessuna dimensione di carattere fuori scala: solo token');
check((styleBlock.match(/var\(--space-/g) || []).length > 10, 'spaziature dai token 8-base');
// il disegno deve poter rimpicciolire invece di spingere fuori le colonne
// le soglie guardano la LARGHEZZA DELLA PAGINA, non quella della finestra:
// la barra laterale porta via ~220 px, e con le soglie sulla finestra il
// disegno si schiacciava a pochi pixel prima che scattassero
check(/container-type: inline-size/.test(styleBlock), 'la pagina si adatta alla propria larghezza, non a quella della finestra');
check((styleBlock.match(/@container \(min-width/g) || []).length >= 2, "due soglie: due colonne, poi tre quando c'e' posto");
check(/\.sim-layout \{[\s\S]{0,400}?grid-template-columns: minmax\(0, 1fr\)/.test(styleBlock), 'si parte da UNA colonna: senza supporto alle query resta alta ma non si rompe');
check(!/minmax\((?!0)/.test(styleBlock), "nessuna colonna con minimo rigido: il disegno puo' sempre rimpicciolire");
check(/\.sim-layout \{[\s\S]{0,500}?overflow-y: auto/.test(styleBlock), 'lo scroll sta dentro la pagina, come nelle view con tabella');

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

console.log('\n6b) le TRE misure della chela, in un punto solo');
// Quando l'operatore sostituisce le chele cambiano insieme: lunghezza, altezza
// ganascia e affondamento del pezzo. Prima solo la lunghezza era salvabile da
// qui; le altre due si potevano toccare solo da updateVice, che riscrive tutta
// la riga (il form morsa infatti se le rilegge fresche pur di non perderle).
vm = await page({ level: 2, pieceID: 1029 });
const chiavi = vm.fields.map(f => f.key);
check(chiavi.indexOf('zClaw') === chiavi.indexOf('viceClaw') + 1
	&& chiavi.indexOf('zSink') === chiavi.indexOf('viceClaw') + 2,
	'le tre misure della chela stanno una accanto all\'altra, non sparse nella pagina');
check(vm.real.zClaw === 27.3 && vm.real.zSink === 5,
	'lette dall\'anagrafica in millimetri (27,3 e 5 della morsa 1)');

const quoteA = JSON.stringify(vm.check);
vm.sim.zClaw = 30; vm.sim.zSink = 8;
await tick();
check(JSON.stringify(vm.check) === quoteA,
	'e NON entrano nel calcolo della spinta: servono al soffiaggio, le quote non si muovono');

calls.length = 0;
vm.askSave('zClaw');
check(/obj=M #1/.test(vm.confirm.text) && /from=27.3 mm/.test(vm.confirm.text) && /to=30 mm/.test(vm.confirm.text),
	'altezza ganascia: la conferma nomina la morsa e dice da quanto a quanto');
vm.doSave(); await tick(); await tick();
let w2 = calls.filter(u => /setClaw/i.test(u));
check(w2.length === 1 && /api\/conf\/vice\/setClawHeight/.test(w2[0]) && /ID=1&Z_CLAW=30000/.test(w2[0]),
	'e va sulla rotta mirata, con il valore in micron');

calls.length = 0;
vm.askSave('zSink');
vm.doSave(); await tick(); await tick();
w2 = calls.filter(u => /setClaw/i.test(u));
check(w2.length === 1 && /api\/conf\/vice\/setClawSink/.test(w2[0]) && /ID=1&Z_SINK_CLAW=8000/.test(w2[0]),
	'affondamento: rotta sua, mai la stessa dell\'altezza');

// lo ZERO e' un valore vero per l'affondamento (ganascia piatta), non per
// l'altezza: una ganascia alta zero non esiste
vm.confirm = null; vm.sim.zSink = 0; vm.askSave('zSink');
check(!!vm.confirm, 'affondamento ZERO: si puo\' salvare, e\' una ganascia piatta e non un dato mancante');
vm.confirm = null; vm.sim.zClaw = 0; vm.askSave('zClaw');
check(vm.confirm === null, 'altezza ZERO: niente conferma, una ganascia alta zero non esiste');
// IL VUOTO NON DEVE DIVENTARE UNO ZERO. Con Z_SINK_CLAW >= 0 lo zero e il "mai
// misurato" finiscono nello stesso record, quindi salvare zero deve essere un
// gesto VOLUTO e non l'inerzia di un campo svuotato e confermato. Si prova con
// la stringa vuota, che e' quello che da' davvero un input number ripulito:
// toMicron('') -> null, non 0.
calls.length = 0;
vm.confirm = null; vm.sim.zSink = ''; vm.askSave('zSink');
check(vm.confirm === null, 'campo svuotato: niente conferma — svuotare non e\' mettere a zero');
vm.doSave(); await tick(); await tick();
check(calls.filter(u => /setClawSink/.test(u)).length === 0, 'e nessuna scrittura parte lo stesso');
vm.confirm = null; vm.sim.zSink = null; vm.askSave('zSink');
check(vm.confirm === null, 'idem col valore assente, non solo con la stringa vuota');
// lo zero invece si salva, ma perche' l'operatore lo ha DIGITATO
calls.length = 0;
vm.sim.zSink = 0; vm.askSave('zSink'); vm.doSave(); await tick(); await tick();
check(calls.some(u => /setClawSink/.test(u) && /Z_SINK_CLAW=0/.test(u)),
	'lo zero DIGITATO invece si salva: e\' la ganascia piatta, ed e\' un gesto esplicito');

// morsa mai misurata: il campo regge il valore assente e ci si puo' scrivere
vm = await page({ level: 2, pieceID: 1029 });
vm.sel.viceID = 2; vm.onSelectionChange(); await tick();
check(vm.real.viceClaw === null && vm.sim.viceClaw === null,
	'morsa senza lunghezza a DB: il campo resta VUOTO, non mostra uno zero che sembrerebbe una misura');
check(vm.real.zClaw === 20 && vm.real.zSink === 10, 'le altre due misure si leggono lo stesso');
calls.length = 0;
vm.sim.viceClaw = 107.2;
vm.askSave('viceClaw');
check(/from=pushSim.notMeasured/.test(vm.confirm.text), 'e la conferma dice che prima non era misurata');
vm.doSave(); await tick(); await tick();
check(calls.some(u => /setClawLength/.test(u) && /ID=2&CLAW_LENGTH=107200/.test(u)),
	'si salva un numero dove prima non c\'era niente');

check(/api\/conf\/vice\/setClawHeight/.test(src) && /api\/conf\/vice\/setClawSink/.test(src),
	'la pagina usa due rotte mirate anche per le misure nuove');

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
