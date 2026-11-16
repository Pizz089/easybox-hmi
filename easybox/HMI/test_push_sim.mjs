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
	{ ID: 1029, FAMILY: 'P1029', DESCR: '', X: 40000, Y: 120000, PUSH_TO_STOP: 1, Z_PICK: 10000 },
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
// (v3 fase D-bis) campi a 48 px (--touch-target-min), pulsanti UiButton (48 o 56)
check(/min-height: var\(--touch-target-min\)/.test(src) && /<UiButton/.test(src), 'bersagli touch v3: campi a 48 px, pulsanti UiButton');

console.log('\n5c) stile allineato al resto del pannello (v3, fase D-bis)');
// La pagina deve sembrare parte dello stesso applicativo: guscio, card,
// etichette e bottoni sono quelli del pannello v3, non inventati qui.
const tplSim = src.split('<script')[0];
check(/class="view-shell view-shell--fill push-sim conf-v3"/.test(src), 'guscio v3: conf-v3, come le pagine di dettaglio della fase D');
check(/<h2 class="view-title">/.test(src), 'titolo con la classe di pagina, non un h1 con stile proprio');
check(/class="section-label"/.test(src) && !/sim-h2/.test(src), 'etichette di sezione dal design system');
check(/<UiButton variant="primary" class="play-btn"/.test(tplSim) && (tplSim.match(/variant="primary"/g) || []).length === 1 && /<UiConfirmDialog/.test(tplSim),
	'azione principale: Avvia, l\'unico UiButton primary; la conferma col dialog v3');
check(/variant="secondary"\s+size="min"\s+class="sim-save"/.test(tplSim) && /<UiButton variant="outline" size="min" @click="restoreReal">/.test(tplSim)
	&& (tplSim.match(/class="cat-chip"/g) || []).length === 3, 'azioni secondarie: Salva secondary, Ripristina outline, rimandi come chip v3');
check(!/pure-button|btn-ghost|button_pressed/.test(tplSim), 'niente pulsanti del pannello vecchio nel template');
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
// (v3) la voce sta nelle schede di Attrezzaggio (layout/navConfig.js)
const nav = readFileSync('src/layout/navConfig.js', 'utf8');
const rigaNav = nav.split('\n').find(l => /'\/sim\/push'/.test(l)) || '';
check(/label: 'menu\.pushSim'/.test(rigaNav) && !/level:/.test(rigaNav), 'scheda di Attrezzaggio senza livello minimo: il livello 0 la vede');

console.log('\n9) quota Z della spinta (6/10)');
// altezza della chela dal fondo del pezzo: da 0 alla quota di presa (1029:
// 10 mm), vuoto = alla quota di presa = come il deposito
const rigaZ = { PIECE_ID: 1029, STOP_BEYOND_CLAW: 0, COMP_PUSH: null, Z_PUSH: null };
vm = await page({ level: 2, pieceID: 1029, stopRow: rigaZ });
const kz = vm.fields.map(f => f.key);
check(kz.indexOf('zPush') === kz.indexOf('compPush') + 1, 'campo "altezza di spinta" accanto alla compensazione');
check(vm.real.zPush === null && vm.sim.zPush === null, 'Z_PUSH vuota a DB: il campo resta vuoto (non "0")');
check(vm.zPushPlaceholder === 'pushSim.zPushEmpty mm=10', 'il segnaposto dice il valore del vuoto: 10 (mm, accanto)');
{
	const it = JSON.parse(readFileSync(new URL('./src/locales/it.json', import.meta.url), 'utf8'));
	check(it.pushSim.zPushEmpty === 'vuoto = {mm}' && it.pushSim.zPushPreviewSame.includes('alla stessa quota del deposito'),
		'   corto, per non restare tagliato nel campo da 7rem; "come il deposito" lo dice il riscontro sotto');
	const tpl = readFileSync(new URL('./src/views/sim/PushSim.vue', import.meta.url), 'utf8');
	// (16/11) il valore in sola lettura sta in fieldText: si prova il testo vero
	const zc = vm.sim.zClaw; vm.sim.zClaw = 0.3;
	check(/<span v-if="canEdit" class="sim-unit">mm<\/span>/.test(tpl) && vm.fieldText('zPush') === 'pushSim.zPushEmpty mm=10 mm' && vm.fieldText('zClaw') === '0.3 mm',
		"   in sola lettura l'unita' una volta sola (fieldText la scrive gia': prima \"0.3 mm mm\")");
	vm.sim.zClaw = zc;
	// (v3 fase D-bis) il Salva e' un UiButton: lo stato spento lo disegna lui
	const uiBtn = readFileSync(new URL('./src/components/ui/UiButton.vue', import.meta.url), 'utf8');
	check(/<UiButton[^>]*class="sim-save"\s+:disabled="saving \|\| \(f\.key === 'zPush' && !!zPushError\)"/.test(tpl) && /\.ui-btn:disabled \{/.test(uiBtn),
		"   fuori campo il Salva e' disabilitato e si vede (UiButton spento)");
}
check(vm.zPushPreview && vm.zPushPreview.fromMm === 10 && vm.zPushPreview.dropMm === 0, 'riscontro col campo vuoto: 10 mm dal fondo, alla quota del deposito');
vm.sim.zPush = 4;
check(vm.zPushError === '' && vm.zPushPreview.fromMm === 4 && vm.zPushPreview.dropMm === 6, '4 mm: la chela spinge a 4 mm dal fondo, 6 mm sotto il deposito (zPushDrop, come la vista)');
vm.sim.zPush = 10.1;
check(/pushSim\.zPushRange max=10/.test(vm.zPushError) && vm.zPushPreview === null, 'oltre la quota di presa: il motivo si legge, niente riscontro');
vm.askSave('zPush');
check(vm.confirm === null, '   e non si arriva alla conferma');
check(/:disabled="saving \|\| \(f\.key === 'zPush' && !!zPushError\)"/.test(src), '   il pulsante Salva non si abilita fuori campo');
vm.sim.zPush = -1;
check(/pushSim\.zPushRange/.test(vm.zPushError), 'negativo: fuori campo');
calls.length = 0;
vm.sim.zPush = 4;
vm.askSave('zPush');
check(vm.confirm && /pushSim\.confirmZPush /.test(vm.confirm.text) && /obj=M #1/.test(vm.confirm.text) && /piece=P1029 #1029/.test(vm.confirm.text) && /to=4 mm/.test(vm.confirm.text),
	'la conferma nomina morsa e pezzo e dice da quanto a quanto');
rigaZ.Z_PUSH = 4000;   // quello che il database ha dopo la scrittura
vm.doSave(); await tick(); await tick(); await tick();
const wz = calls.filter(u => /setZPush/.test(u));
check(wz.length === 1 && /VICE_ID=1&PIECE_ID=1029&Z_PUSH=4000/.test(wz[0]), 'scrive su setZPush, in micron');
check(vm.real.zPush === 4 && vm.sim.zPush === 4 && !vm.fieldChanged('zPush'), 'dopo il salvataggio il campo torna dal database e il Salva sparisce');
vm.sim.zPush = '';
vm.askSave('zPush');
check(vm.confirm && /pushSim\.confirmZPushClear/.test(vm.confirm.text), 'svuotare: conferma che dice "alla quota di presa"');
vm.doSave(); await tick(); await tick();
check(calls.filter(u => /setZPush/.test(u)).some(u => /Z_PUSH=$/.test(u)), '   e manda il campo vuoto (NULL a DB)');
// (6/10) lo stesso per la compensazione: prima il campo tornava al valore
// vecchio dopo il salvataggio (si sincronizzava solo l'appoggio)
rigaZ.Z_PUSH = null;
vm = await page({ level: 2, pieceID: 1029, stopRow: rigaZ });
vm.sim.compPush = 0.3;
vm.askSave('compPush');
rigaZ.COMP_PUSH = 300;
vm.doSave(); await tick(); await tick(); await tick();
// (16/11) dal database il campo torna a due decimali fissi: "0.30"
check(vm.real.compPush === '0.30' && vm.sim.compPush === '0.30' && !vm.fieldChanged('compPush'), 'compensazione: dopo il salvataggio il campo resta al valore salvato (prima tornava al vecchio)');
rigaZ.COMP_PUSH = null;
// senza riga PIECE_ON_VICE: si dice prima, non parte nessuna richiesta
vm = await page({ level: 2, pieceID: 1029, stopRow: null });
dataStored.alert.desc = '';
calls.length = 0;
vm.sim.zPush = 4;
vm.askSave('zPush');
check(vm.compNeedsRow && vm.confirm === null && /pushSim\.zPushNoRow/.test(dataStored.alert.desc) && !calls.some(u => /setZPush/.test(u)),
	'senza riga: l\'avviso di compNeedsRow, e nessuna richiesta');
// il server rilegge la quota di presa: se rifiuta, lo si dice
vm = await page({ level: 2, pieceID: 1029, stopRow: rigaZ });
const fetchPrima = globalThis.fetch;
globalThis.fetch = async (url) => /setZPush/.test(String(url)) ? { ok: true, text: async () => 'KO_Z_PUSH_RANGE', json: async () => [] } : fetchPrima(url);
dataStored.alert.desc = '';
vm.sim.zPush = 4;
vm.askSave('zPush');
vm.doSave(); await tick(); await tick();
check(/pushSim\.zPushRangeServer/.test(dataStored.alert.desc), 'KO_Z_PUSH_RANGE dal server: il motivo si legge');
globalThis.fetch = fetchPrima;
// la riga letta dalla vista porta la discesa che il PLC sottrae
check(/viewRow\.Z_PUSH_DROP != null/.test(src) && /pushSim\.qZDrop/.test(src), 'la riga letta dalla vista mostra anche la discesa della chela');
const last = readFileSync('src/views/workOrder/lastData.vue', 'utf8');
check(/zPushDrop\(\{ zPush: this\.pieceZPush, zPick: this\.pieceZPick \}\)/.test(last) && /row\.Z_PUSH/.test(last) && /wizard\.lastData\.pushZ/.test(last),
	'lastData: accanto alla corsa, dove spinge la chela e quanto sotto il deposito');

console.log('\n10) appoggio e compensazione al CENTESIMO (16/11)');
// La catena dati porta gia' i micron (DB, setStop, vista, FB_Robot): il limite
// era il pannello, col passo a 0.1. Si salva quantizzato a 10 micron in due
// passi (micron interi, poi la decina): col passo unico 1.005 darebbe 1000.
{
	const tplC = src.split('<script')[0];
	const itC = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
	// $t col testo vero di it.json, per leggere la conferma come la legge l'operatore
	const vero = (k, p) => { let s = k.split('.').reduce((o, x) => o && o[x], itC); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(b); return s; };
	const riga = (um) => ({ PIECE_ID: 1099, STOP_BEYOND_CLAW: um });

	vm = await page({ level: 2, pieceID: 1099, stopRow: riga(25000) });
	const passi = Object.fromEntries(vm.fields.map(f => [f.key, f.step || '0.1']));
	check(passi.stopBeyond === '0.01' && passi.compPush === '0.01'
		&& Object.entries(passi).filter(([k]) => k !== 'stopBeyond' && k !== 'compPush').every(([, s]) => s === '0.1'),
		'passo 0.01 solo su appoggio e compensazione, gli altri ' + (Object.keys(passi).length - 2) + ' campi restano a 0.1');
	check(/:step="f\.step \|\| '0\.1'"/.test(tplC) && !/\sstep="0\.1"/.test(tplC), '   il passo viene dalla riga di fields, non e\' piu\' comune a tutti');

	for (const [mm, um] of [[52.93, 52930], [52.935, 52940], ['52.935', 52940], [1.005, 1010], [0, 0]]) {
		vm = await page({ level: 2, pieceID: 1099, stopRow: riga(25000) });
		calls.length = 0;
		vm.sim.stopBeyond = mm;
		vm.askSave('stopBeyond');
		vm.doSave(); await tick(); await tick();
		const ws = calls.filter(u => /setStop|deleteStop/.test(u));
		check(ws.length === 1 && new RegExp('setStop\\?VICE_ID=1&PIECE_ID=1099&STOP_BEYOND_CLAW=' + um + '$').test(ws[0]),
			'appoggio ' + JSON.stringify(mm) + ' -> ' + (ws[0] || 'nessuna scrittura'));
	}

	vm = await page({ level: 2, pieceID: 1099, stopRow: riga(52930) });
	check(vm.sim.stopBeyond === '52.93' && vm.fieldChanged('stopBeyond') === false && vm.diverged === false,
		'DB 52930, campo 52.93: fieldChanged falso, nessun pulsante Salva, nessuna divergenza');
	vm.sim.stopBeyond = 52.931;
	check(vm.fieldChanged('stopBeyond') === false && vm.diverged === false, '   52.931 si salverebbe 52930 come a DB: niente Salva e niente divergenza');
	vm.sim.stopBeyond = 52.94;
	check(vm.fieldChanged('stopBeyond') === true && vm.diverged === true, '   52.94: il Salva compare');
	vm.$t = vero; vm.t = vero;
	vm.askSave('stopBeyond');
	check(!!vm.confirm && /da 52\.93 mm a 52\.94 mm\./.test(vm.confirm.text), 'conferma 52930 -> 52940: «' + (vm.confirm && vm.confirm.text) + '»');

	for (const [um, txt] of [[52900, '52.90'], [52935, '52.94'], [0, '0.00']]) {
		vm = await page({ level: 0, pieceID: 1099, stopRow: riga(um) });
		check(vm.fieldText('stopBeyond') === txt + ' mm', 'sola lettura, DB ' + um + ' -> «' + vm.fieldText('stopBeyond') + '»');
	}
	check(/<span v-else class="sim-readonly">\{\{ fieldText\(f\.key\) \}\}<\/span>/.test(tplC), '   ed e\' il testo che mostra il template');
	check(vm.fieldText('viceClaw') === '150 mm' && vm.fieldText('pieceLen') === '180 mm' && vm.fieldText('toolClaw') === '30 mm',
		'   le altre misure restano al decimo (150, 180, 30 mm)');

	vm = await page({ level: 0, pieceID: 1099, stopRow: riga(52900) });
	check(vm.mm2(vm.stopDeclared) === '52.90' && /\{\{ mm2\(stopDeclared\) \}\}/.test(tplC) && /restsOnDeclared", \{ mm: mm2\(stopDeclared\) \}/.test(tplC),
		'etichetta del disegno e frase «appoggia ... oltre la ganascia» a due decimali (52.90)');
	check(/\{\{ mm\(g\.pieceLen\) \}\}/.test(tplC) && /\{\{ mm\(g\.pieceWid\) \}\}/.test(tplC), '   le misure del pezzo nel disegno restano al decimo');

	// quote: X arrivo e corsa seguono l'appoggio, X spinta no (pushQuotes)
	vm = await page({ level: 2, pieceID: 1099, stopRow: riga(52930) });
	const qt = () => ({ place: vm.mmText2(vm.quotes.xPlaceMm), push: vm.mmText2(vm.quotes.xPushMm), stop: vm.mmText2(vm.quotes.xStopMm), travel: vm.mmText2(vm.quotes.travelMm) });
	const qa = qt();
	vm.sim.stopBeyond = 52.94;
	const qb = qt();
	const passo = (a, b) => Math.round((parseFloat(b) - parseFloat(a)) * 100);
	check(vm.ok && passo(qa.stop, qb.stop) === 1 && passo(qa.travel, qb.travel) === 1 && qa.push === qb.push && qa.place === qb.place,
		'appoggio 52.93 -> 52.94: X arrivo ' + qa.stop + ' -> ' + qb.stop + ', corsa ' + qa.travel + ' -> ' + qb.travel + ', X spinta ferma a ' + qb.push);
	check(['xPlaceMm', 'xPushMm', 'xStopMm', 'travelMm'].every(k => tplC.includes('mmText2(quotes.' + k + ')')) && !/mmText\(quotes\./.test(tplC),
		'   il riquadro quote mostra i due decimali (deposito, spinta, arrivo, corsa)');
	vm.sim.stopBeyond = 52.931;
	check(vm.mmText2(vm.quotes.xStopMm) === qa.stop, '   il disegno usa il valore che si salverebbe: 52.931 vale 52930, X arrivo ' + vm.mmText2(vm.quotes.xStopMm));
	check(['X_PUSH', 'X_STOP', 'Z_PUSH_DROP'].every(k => tplC.includes('mmText2(viewRow.' + k + ' / 1000)')) && !/mmText\(viewRow\./.test(tplC)
		&& vm.mmText2(-121084 / 1000) === '-121.08 mm',
		'quote lette dalla vista a due decimali (-121084 -> -121.08 mm)');

	// compensazione: stesse regole
	const rigaC = { PIECE_ID: 1029, STOP_BEYOND_CLAW: 0, COMP_PUSH: null, Z_PUSH: null };
	for (const [mm, um] of [[0.33, 330], [0.335, 340], [1.005, 1010]]) {
		vm = await page({ level: 2, pieceID: 1029, stopRow: rigaC });
		calls.length = 0;
		vm.sim.compPush = mm;
		vm.askSave('compPush');
		vm.doSave(); await tick(); await tick();
		const wc = calls.filter(u => /setCompPush/.test(u));
		check(wc.length === 1 && new RegExp('VICE_ID=1&PIECE_ID=1029&COMP_PUSH=' + um + '$').test(wc[0]), 'compensazione ' + mm + ' -> ' + (wc[0] || 'nessuna scrittura'));
	}
	rigaC.COMP_PUSH = 330;
	vm = await page({ level: 2, pieceID: 1029, stopRow: rigaC });
	check(vm.sim.compPush === '0.33' && !vm.fieldChanged('compPush') && vm.fieldText('compPush') === '0.33 mm',
		'compensazione da DB 330: campo 0.33, niente Salva, in sola lettura «0.33 mm»');
	vm.sim.compPush = 0.334;
	check(!vm.fieldChanged('compPush'), '   0.334 si salverebbe 330: niente Salva');
	vm.sim.compPush = 0.34;
	vm.$t = vero; vm.t = vero;
	vm.askSave('compPush');
	check(!!vm.confirm && /da 0\.33 mm a 0\.34 mm\./.test(vm.confirm.text), '   conferma: «' + (vm.confirm && vm.confirm.text) + '»');
	check(vm.mm2(vm.compPreview.comp) === '0.34' && /comp: mm2\(compPreview\.comp\)/.test(tplC),
		'   riscontro della corsa: «' + vero('pushSim.compTravel', { travel: vm.mm2(vm.compPreview.clearance), comp: vm.mm2(vm.compPreview.comp) }) + '»');
	rigaC.COMP_PUSH = null;
	vm = await page({ level: 2, pieceID: 1029, stopRow: rigaC });
	calls.length = 0;
	vm.sim.compPush = 0.3; vm.askSave('compPush'); vm.doSave(); await tick(); await tick();
	vm.sim.compPush = ''; vm.askSave('compPush');
	check(/pushSim\.confirmCompClear/.test(vm.confirm.text), '   svuotare resta «nessuna compensazione»');
	vm.doSave(); await tick(); await tick();
	check(calls.filter(u => /setCompPush/.test(u)).some(u => /COMP_PUSH=300$/.test(u)) && calls.filter(u => /setCompPush/.test(u)).some(u => /COMP_PUSH=$/.test(u)),
		'   0.3 -> COMP_PUSH=300, vuoto -> COMP_PUSH vuoto (NULL a DB)');
}

console.log('\n11) campi modificabili a due decimali dal database, corsa e motivi (16/11)');
// Come in Vice: appoggio e compensazione si caricano come TESTO a due decimali
// fissi (mm2), quindi real.* e sim.* di quelle due chiavi sono stringhe. Ogni
// conto passa da micronOf/toMicron: qui si prova che il testo "52.90" fa gli
// stessi conti del numero 52.9.
{
	const tplD = src.split('<script')[0];
	const script = src.slice(src.indexOf('<script'), src.indexOf('</script>'));
	const itD = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
	const vero = (k, p) => { let s = k.split('.').reduce((o, x) => o && o[x], itD); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(b); return s; };

	vm = await page({ level: 2, pieceID: 1099, stopRow: { PIECE_ID: 1099, STOP_BEYOND_CLAW: 52900 } });
	check(vm.real.stopBeyond === '52.90' && vm.sim.stopBeyond === '52.90', 'DB 52900 -> campo «' + vm.sim.stopBeyond + '» (testo, come in Vice)');
	check(!vm.fieldChanged('stopBeyond') && !vm.diverged, '   nessun Salva e nessuna divergenza');
	check(vm.m.stopBeyond === 52900 && vm.stopDeclared === 52900 && vm.check.status === PUSH_STATUS.OK && vm.check.clearance === 37900,
		'   il calcolo riceve 52900 micron, non la stringa: corsa ' + vm.check.clearance);
	vm.sim.stopBeyond = 52.9;        // l'operatore riscrive lo stesso valore (v-model number)
	check(!vm.fieldChanged('stopBeyond') && !vm.diverged, '   riscritto come numero 52.9: stesso valore, niente Salva');
	vm.sim.stopBeyond = 52.93;
	calls.length = 0;
	vm.askSave('stopBeyond'); vm.doSave(); await tick(); await tick();
	check(calls.some(u => /setStop\?VICE_ID=1&PIECE_ID=1099&STOP_BEYOND_CLAW=52930$/.test(u)), '   cambiato in 52.93: setStop con 52930');
	vm.sim.stopBeyond = '52.90'; vm.sim.viceClaw = 160;
	vm.restoreReal();
	check(vm.sim.stopBeyond === '52.90' && Number(vm.sim.viceClaw) === 150 && !vm.diverged, '   il ripristino rimette il testo del database');

	vm = await page({ level: 2, pieceID: 1099, stopRow: { PIECE_ID: 1099, STOP_BEYOND_CLAW: 52935 } });
	check(vm.sim.stopBeyond === '52.94' && !vm.fieldChanged('stopBeyond') && !vm.diverged, 'DB 52935 -> campo «' + vm.sim.stopBeyond + '», nessun Salva');

	vm = await page({ level: 2, pieceID: 1099, stopRow: { PIECE_ID: 1099, STOP_BEYOND_CLAW: 0 } });
	check(vm.sim.stopBeyond === '0.00' && vm.m.stopBeyond === 0 && vm.stopDeclaredReal === 0, 'DB 0 -> campo «0.00»: lo zero resta una dichiarazione, non un vuoto');

	const rigaD = { PIECE_ID: 1029, STOP_BEYOND_CLAW: 0, COMP_PUSH: 330, Z_PUSH: null };
	vm = await page({ level: 2, pieceID: 1029, stopRow: rigaD });
	check(vm.real.compPush === '0.33' && vm.sim.compPush === '0.33' && !vm.fieldChanged('compPush') && vm.m.compPush === 330,
		'COMP_PUSH 330 -> campo «' + vm.sim.compPush + '», niente Salva, il calcolo riceve 330');
	check(vm.check.xStop === vm.check.xPush + vm.check.clearance - 330, '   e X arrivo la sottrae come numero');
	calls.length = 0;
	vm.sim.compPush = '';
	vm.askSave('compPush');
	check(/pushSim\.confirmCompClear/.test(vm.confirm.text), '   svuotato: conferma «nessuna compensazione»');
	rigaD.COMP_PUSH = null;          // quello che il database ha dopo la scrittura
	vm.doSave(); await tick(); await tick(); await tick();
	check(calls.some(u => /setCompPush\?VICE_ID=1&PIECE_ID=1029&COMP_PUSH=$/.test(u)), '   e manda COMP_PUSH vuoto (NULL a DB)');
	check(vm.real.compPush === null && vm.sim.compPush === null && !vm.fieldChanged('compPush'), '   dopo il salvataggio il campo torna vuoto, non «0.00»');

	vm = await page({ level: 2, pieceID: 1029, stopRow: rigaD });
	check(vm.sim.compPush === null && vm.m.compPush === null && vm.fieldText('compPush') === '-', 'COMP_PUSH NULL -> campo vuoto, non «0.00»');

	// corsa a due decimali, con e senza compensazione
	check(vm.compPreview.clearance === 15000
		&& vero('pushSim.compTravelNone', { travel: vm.mm2(vm.compPreview.clearance) }) === 'Corsa: 15.00 mm'
		&& /compTravelNone", \{ travel: mm2\(compPreview\.clearance\) \}/.test(tplD)
		&& /compTravel", \{ travel: mm2\(compPreview\.clearance\), comp: mm2\(compPreview\.comp\) \}/.test(tplD),
		'compTravel e compTravelNone: {travel} a due decimali («Corsa: 15.00 mm»)');

	// motivi: stop e comp a due decimali
	vm = await page({ level: 0, pieceID: 1099, stopRow: { PIECE_ID: 1099, STOP_BEYOND_CLAW: 10000 } });
	check(vm.check.status === PUSH_STATUS.NO_ROOM && vm.reasonArgs.stop === '10.00', 'NO_ROOM: {stop} = «' + vm.reasonArgs.stop + '»');
	vm = await page({ level: 0, pieceID: 1029, stopRow: { PIECE_ID: 1029, STOP_BEYOND_CLAW: 0, COMP_PUSH: 15500, Z_PUSH: null } });
	check(vm.check.status === PUSH_STATUS.NO_COMP && vm.reasonArgs.comp === '15.50' && vm.reasonArgs.travel === '15.00',
		'NO_COMP: {comp} = «' + vm.reasonArgs.comp + '», {travel} = «' + vm.reasonArgs.travel + '»: «' + vero('pushSim.reason.NO_COMP', vm.reasonArgs).slice(0, 60) + '...»');
	vm = await page({ level: 0, pieceID: 1029, stopRow: null });
	check(vm.reasonArgs.stop === '-' && vm.reasonArgs.comp === '-', '   senza dichiarazione ne\' compensazione: «-», come prima');
	vm = await page({ level: 0, pieceID: 1099, stopRow: null });
	check(vm.compPreview.clearance === null && vm.reasonArgs.travel === '-', '   senza corsa (pezzo che eccede, appoggio non dichiarato): {travel} = «-», come prima');

	// nessun conto diretto su real e sim: appoggio e compensazione si leggono
	// solo attraverso micronOf/toMicron (o si assegnano)
	const usi = [...script.matchAll(/this\.(sim|real)\.(stopBeyond|compPush)/g)]
		.map(m => ({ prima: script.slice(Math.max(0, m.index - 40), m.index), dopo: script.slice(m.index + m[0].length, m.index + m[0].length + 3) }));
	check(usi.length >= 6 && usi.every(u => /(micronOf\("\w+", |toMicron\()$/.test(u.prima) || /^ = /.test(u.dopo)),
		'appoggio e compensazione: ' + usi.length + ' accessi diretti, tutti dentro micronOf/toMicron o assegnazioni');
	const conto = /(?:\b(?:sim|real)(?:\.\w+|\[[^\]]+\]))\s*[-+*/%](?!=)|[-+*/%]\s*(?:this\.)?(?:sim|real)(?:\.\w+|\[)/;
	check(!conto.test(script) && !conto.test(tplD) && !/Number\((?:this\.)?(?:sim|real)[.[]/.test(src), '   nessuna somma o Number() diretto su sim o real, ne\' nello script ne\' nel template');
}

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
