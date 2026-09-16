// ============================================================================
// test_cell_declare.mjs — dichiarazione dello STATO CELLA (16/9)
//
// PERCHE'. Il dialog "Reimposta stato cella" mandava il solo 35. Adesso
// dichiara tutta la cella, e l'ordine di invio NON e' un dettaglio: il 35
// azzera tutte le catene del dispatcher nel PLC (RESET_ALL_DISPATCH). Se
// partisse per primo, o se gli altri comandi partissero senza aspettare il
// loro eco, il reset travolgerebbe le catene appena alzate e la cella
// resterebbe dichiarata a meta' — con il pannello convinto del contrario.
//
// Qui si verifica quello che si puo' rompere in silenzio:
//   1. l'ordine 36/37 -> 38 -> 35, ognuno DOPO il suo eco
//   2. eco che non arriva -> la sequenza SI FERMA (niente comandi successivi)
//   3. un rifiuto per sezione: compare il motivo, e SPARISCE all'eco del
//      comando riuscito (il PLC non pubblica nessun "ora e' a posto")
//   4. le tasche: gate su cassetto estratto E su cella in HOLD, e il 39 parte
//      con il SUB_POS cliccato, non con un numero digitato
//
// Uso:   node test_cell_declare.mjs     (dalla cartella easybox/HMI)
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const Robot = (await server.ssrLoadModule('/src/views/unit/robotView.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = (ms) => new Promise(r => setTimeout(r, ms || 20));
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

// ---------------------------------------------------------------- socket finto
// on/off/emit veri: i test registrano davvero i listener che registra la view,
// cosi' un off mancato o un evento sbagliato si vedono.
const sent = [];
const listeners = {};
dataStored.WS = {
	socket: {
		on(ev, h) { (listeners[ev] = listeners[ev] || []).push(h); },
		off(ev, h) { listeners[ev] = (listeners[ev] || []).filter(x => x !== h); },
		emit(ev, payload) { sent.push({ ev, payload }); }
	}
};
const fire = (ev, payload) => (listeners[ev] || []).slice().forEach(h => h(payload));
globalThis.fetch = async () => ({ ok: true, json: async () => [], text: async () => 'OK' });

function vmOf(extra) {
	const vm = Object.assign({}, Robot.data.call({}), extra || {});
	for (const [k, f] of Object.entries(Robot.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(Robot.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k) => k;
	vm.declEchoMs = 80;          // attese corte: qui si prova la LOGICA, non i 5 s
	vm.declDialog.open = true;
	vm.declDialog.step = 2;
	vm.declDialog.gripperSel = 7;
	wire(vm);
	return vm;
}
// Registra gli stessi listener che registra mounted(): senza questo passo il
// test proverebbe una view scollegata dal socket, e un rifiuto che nella
// realta' arriva qui sembrerebbe non arrivare mai.
const WIRING = [
	['DECLARE/ROBOT', 'onDeclRobot'], ['DECLARE/MC1', 'onDeclMc1'],
	['DECLARE/TRAY', 'onDeclTray'], ['TRAY/EXTRACT', 'onTrayExtract'],
	['ALARM/MC1', 'onAlarmMc1'], ['ALARM/BOX', 'onAlarmBox'], ['ALARM/ROBOT', 'onAlarmRobot'],
	['DECLARE/TRAYTYPE', 'onDeclTrayType']
];
function wire(vm) {
	for (const [ev, m] of WIRING) dataStored.WS.socket.on(ev, vm[m]);
}
const cmdsTo = (unit) => sent.filter(s => s.ev === 'TO_PLANT/CMD/' + unit).map(s => s.payload);

console.log('1) ORDINE DI INVIO: macchina, cassetto, robot — e il 35 per ULTIMO');
let vm = vmOf();
sent.length = 0;
vm.declDialog.pieceSel = 1032;
vm.declDialog.boxSel = 9;
vm.sendDeclare();
await tick();
check(sent.length === 1 && sent[0].ev === 'TO_PLANT/CMD/MC1' && sent[0].payload === '36;1032',
	'parte per primo il 36 alla macchina, col pezzo scelto');
check(cmdsTo('BOX').length === 0 && cmdsTo('ROBOT').length === 0,
	'e finche\' la macchina non conferma, cassetto e robot NON ricevono niente');
fire('DECLARE/MC1', '0;0;1032');
await tick();
check(cmdsTo('BOX').length === 1 && cmdsTo('BOX')[0] === '38;9', 'arrivato l\'eco: parte il 38 col cassetto scelto');
check(cmdsTo('ROBOT').length === 0, 'il 35 aspetta ancora: azzera le catene, non puo\' anticipare');
fire('TRAY/EXTRACT', '9');
await tick();
check(cmdsTo('ROBOT').length === 1 && /^35;7;/.test(cmdsTo('ROBOT')[0]), 'per ULTIMO il 35, col contratto di sempre');
check(cmdsTo('ROBOT')[0] === '35;7;0;0;0;0', 'contratto del 35 invariato: 35;gripper;cont1;id1;cont2;id2');
fire('DECLARE/ROBOT', '7;0;0');
await tick();
check(vm.declDialog.open === false && String(dataStored.alert.desc) === 'robot.decl.done', 'tre echi: dichiarazione conclusa, dialog chiuso');

console.log('\n2) MORSA VUOTA: 37, senza parametri');
vm = vmOf();
sent.length = 0;
vm.declDialog.pieceSel = 0;
vm.sendDeclare();
await tick();
check(cmdsTo('MC1')[0] === '37', '«Morsa vuota» manda il 37, non un 36 con ID 0');

console.log('\n3) ECO CHE NON ARRIVA: la sequenza si FERMA, non prosegue');
vm = vmOf();
sent.length = 0;
vm.declDialog.pieceSel = 1032;
vm.declDialog.boxSel = 9;
vm.sendDeclare();
await tick();
check(cmdsTo('MC1').length === 1, 'il 36 e\' partito');
await tick(150);                               // eco mai emesso: scade l'attesa
check(cmdsTo('BOX').length === 0, 'NIENTE 38: il cassetto non viene dichiarato al buio');
check(cmdsTo('ROBOT').length === 0, 'NIENTE 35: il reset delle catene non parte su uno stato incerto');
check(vm.declDialog.phase === 'stopped' && vm.declDialog.stoppedAt === 'mc', 'il dialog dice DOVE si e\' fermato');
check(vm.declDialog.waiting === false, 'e si riapre all\'uso: non resta bloccato in attesa');
check(String(dataStored.alert.desc) === 'robot.decl.noEcho', 'e lo dice, invece di restare muto');

console.log('\n4) ECO MANCANTE A META\': quello che era gia\' partito resta partito, il resto no');
vm = vmOf();
sent.length = 0;
vm.declDialog.pieceSel = 1032;
vm.declDialog.boxSel = 9;
vm.sendDeclare();
await tick();
fire('DECLARE/MC1', '0;0;1032');
await tick();
check(cmdsTo('BOX').length === 1, 'il 38 e\' partito');
await tick(150);                               // il cassetto non conferma
check(cmdsTo('ROBOT').length === 0, 'il 35 NON parte: la sequenza si ferma al cassetto');
check(vm.declDialog.stoppedAt === 'box', 'fermata dichiarata sulla sezione cassetto');

console.log('\n5) UN RIFIUTO PER SEZIONE: compare il motivo, e sparisce al comando riuscito');
vm = vmOf();
// --- MACCHINA: 947 cella non a riposo
vm.onAlarmMc1('947');
check(vm.declErr.mc === 947, 'macchina: rifiuto 947 registrato sulla sua sezione');
check(vm.declErr.box === 0 && vm.declErr.robot === 0, 'e solo su quella: le altre restano pulite');
vm.onDeclMc1('0;0;0');
check(vm.declErr.mc === 0, 'l\'eco DECLARE/MC1 cancella il rifiuto (il PLC non manda nessun "ora va bene")');
// --- CASSETTO: 996 sensori discordi
vm.onAlarmBox('996');
check(vm.declErr.box === 996, 'cassetto: rifiuto 996 registrato');
vm.onTrayExtract('9');
check(vm.declErr.box === 0, 'l\'eco TRAY/BOX/EXTRACT lo cancella');
// --- ROBOT: 945 pinza incoerente
vm.onAlarmRobot('945');
check(vm.declErr.robot === 945 && vm.declErr.pocket === 0, 'robot: 945 va sulla sezione robot, non sulle tasche');
vm.onDeclRobot('7;0;0');
check(vm.declErr.robot === 0, 'l\'eco DECLARE/ROBOT lo cancella');
// --- TASCHE: 20006 grezzo senza ordine attivo
vm.onAlarmRobot('20006');
check(vm.declErr.pocket === 20006 && vm.declErr.robot === 0, 'tasche: la serie 200xx va sulle tasche, non sul robot');
vm.onDeclTray('9;3;4');
check(vm.declErr.pocket === 0, 'l\'eco DECLARE/TRAY lo cancella');
// --- niente errori fantasma a dialog chiuso
vm.declDialog.open = false;
vm.onAlarmBox('999');
check(vm.declErr.box === 0, 'a dialog chiuso non si accumulano rifiuti da mostrare alla prossima apertura');

console.log('\n6) RIFIUTO DURANTE LA SEQUENZA: ferma subito, senza aspettare il timeout');
vm = vmOf();
sent.length = 0;
vm.declDialog.pieceSel = 1032;
vm.sendDeclare();
await tick();
fire('ALARM/MC1', '947');
await tick(30);                                 // molto meno dei declEchoMs
check(vm.declErr.mc === 947, 'il motivo e\' a video');
check(cmdsTo('BOX').length === 0 && cmdsTo('ROBOT').length === 0, 'e i comandi successivi non partono');
check(vm.declDialog.stoppedAt === 'mc', 'fermata sulla sezione macchina');

console.log('\n6-bis) ANNULLA A META\' SEQUENZA: i comandi rimasti non partono');
vm = vmOf();
sent.length = 0;
vm.declDialog.pieceSel = 1032;
vm.declDialog.boxSel = 9;
vm.sendDeclare();
await tick();
vm.closeDeclDialog();                            // l'operatore annulla
fire('DECLARE/MC1', '0;0;1032');                 // l'eco arriva lo stesso
await tick();
check(cmdsTo('BOX').length === 0 && cmdsTo('ROBOT').length === 0,
	'dopo l\'annullo la cella non riceve altre dichiarazioni a sua insaputa');
check(vm.declDialog.waiting === false, 'e il dialog non resta in attesa di niente');

console.log('\n7) TASCHE: si apre solo col cassetto fuori E a cella ferma');
vm = vmOf();
vm.extractedTray = null;
vm.dataRobot = { STATUS: dataStored.status_hold };
check(vm.pocketsEnabled === false && vm.pocketsDisabledReason === 'robot.decl.pocketsNoTray',
	'senza cassetto estratto: spenta, e dice perche\'');
vm.extractedTray = { FLOOR_MAG: 9, DESCR: 'cassetto 9' };
vm.dataRobot = { STATUS: dataStored.status_auto };
check(vm.pocketsEnabled === false && vm.pocketsDisabledReason === 'robot.decl.pocketsNotHold',
	'cella non in HOLD: spenta — il PLC ignorerebbe il 39 in silenzio');
vm.dataRobot = { STATUS: dataStored.status_hold };
check(vm.pocketsEnabled === true, 'cassetto fuori + HOLD: si apre');

console.log('\n8) TASCHE: si clicca la casella, e parte 39;subpos;stato');
sent.length = 0;
vm.pockets.rows = [{ SUB_POS: 1, status: 2, x: 65, y: 50, prisma: true, order_ID: 0 },
                   { SUB_POS: 7, status: 2, x: 65, y: 410, prisma: true, order_ID: 0 }];
vm.pickPocket({ index: 1, subPos: 7, status: 2, orderID: 0 });
check(vm.pockets.sel === 7, 'il click seleziona il SUB_POS REALE della tasca, non l\'indice');
vm.declarePocket(dataStored.status_raw);
await tick();
check(cmdsTo('ROBOT')[0] === '39;7;4', 'parte 39;7;4 (grezzo) sulla tasca cliccata');
fire('DECLARE/TRAY', '9;7;4');
await tick();
check(vm.pockets.rows[1].status === 4, 'l\'eco aggiorna il disegno: la tasca diventa grezza');
check(vm.pockets.sel === null && vm.pockets.busy === false, 'e si torna pronti per la tasca successiva (ripetibile)');
// stati ammessi: esattamente i tre del PLC
check(vm.pocketStates.map(s => s.code).join(',') === '2,4,5', 'tre soli stati: 2 vuota, 4 grezzo, 5 finito');
// gate ricontrollato sui dati FRESCHI
sent.length = 0;
vm.pockets.sel = 7;
vm.dataRobot = { STATUS: dataStored.status_auto };
vm.declarePocket(dataStored.status_raw);
await tick();
check(cmdsTo('ROBOT').length === 0 && vm.declDialog.step === 2,
	'cella ripartita col dialog aperto: niente comando, si torna indietro con l\'avviso');

console.log('\n8-bis) CONTENUTO DEL CASSETTO (44): dice DI CHE COSA, non quanto');
// Le tasche (39) dichiarano quante sono piene; il 44 dichiara il CODICE di
// tutto il cassetto — quello che il ciclo cerca e di cui usa le quote. Stesso
// gate del 39 (cassetto fuori + HOLD: il PLC legge DB_BOX_1.ExtractedTray).
sent.length = 0;
vm.dataRobot = { STATUS: dataStored.status_hold };
vm.pockets.typeSel = 1033;
vm.declareTrayType();
await tick();
check(cmdsTo('ROBOT')[0] === '44;1033', 'parte 44;1033 sul canale robot');
check(vm.pockets.typeBusy === true, 'e si aspetta la conferma prima di dire che e\' fatta');
fire('DECLARE/TRAYTYPE', '9;1033');
await tick();
check(vm.pockets.typeBusy === false && String(dataStored.alert.desc) === 'robot.decl.trayTypeDone', 'eco DECLARE/TRAYTYPE: dichiarato');
// rifiuto instradato sulla sua sezione, non su quella delle tasche
vm.declErr.trayType = 0; vm.declErr.pocket = 0;
vm.pockets.typeBusy = true;
vm.onAlarmRobot('20001');
check(vm.declErr.trayType === 20001 && vm.declErr.pocket === 0, '20001 durante il 44 va sulla sezione contenuto');
vm.declErr.trayType = 0; vm.pockets.typeBusy = false;
vm.onAlarmRobot('20001');
check(vm.declErr.pocket === 20001 && vm.declErr.trayType === 0, 'e fuori dal 44 va sulle tasche: si accende dove si stava guardando');
// IL PEZZO DICHIARATO DEVE STARE NELLE TASCHE. Il 44 lo scrive il PLC:
// nessuna guardia di backend puo' intercettarlo, quindi il controllo e' qui.
// Senza, un pezzo piu' grande dell'alloggiamento arriverebbe al robot senza
// che nessuno l'avesse guardato.
sent.length = 0;
vm.declPieces = [{ ID: 1033, X: 40000, Y: 70000 }, { ID: 22, X: 71000, Y: 90000 }];
vm.pockets.trayX = 820000; vm.pockets.trayY = 610000;
vm.pockets.rows = [];
for (let c = 0; c < 7; c++) for (let rr = 0; rr < 13; rr++)
	vm.pockets.rows.push({ SUB_POS: c * 13 + rr + 1, x: 45 + 80 * c, y: 50 + 60 * rr, status: 2, prisma: 1, order_ID: 0 });
vm.pockets.typeSel = 22;               // 71x90 in tasche da 60x80 di passo
vm.declareTrayType();
await tick();
check(cmdsTo('ROBOT').length === 0, "pezzo piu' grande dell'alloggiamento: il 44 NON parte");
check(vm.declErr.trayType === 'tooBig' && vm.declErrParams.pitch === 11, 'e il dialog dice di quanto invade la tasca vicina');
vm.pockets.typeSel = 1033;             // il pezzo per cui la griglia e' fatta
vm.declErr.trayType = 0;
vm.declareTrayType();
await tick();
check(cmdsTo('ROBOT')[0] === '44;1033', 'il pezzo che ci sta passa');
fire('DECLARE/TRAYTYPE', '9;1033');
await tick();

// senza codice scelto non parte niente
sent.length = 0; vm.pockets.typeSel = 0;
vm.declareTrayType();
await tick();
check(cmdsTo('ROBOT').length === 0, 'codice non scelto: nessun comando');
// cella ripartita col dialog aperto: re-check sui dati freschi
sent.length = 0; vm.pockets.typeSel = 1033; vm.dataRobot = { STATUS: dataStored.status_auto };
vm.declareTrayType();
await tick();
check(cmdsTo('ROBOT').length === 0 && vm.declDialog.step === 2, 'fuori da HOLD non parte: il PLC lo ignorerebbe in silenzio');

console.log('\n9) LA GRIGLIA E\' QUELLA DEL LAYOUT, non una seconda copia');
const rsrc = readFileSync('src/views/unit/robotView.vue', 'utf8');
const lsrc = readFileSync('src/views/layoutView.vue', 'utf8');
const comp = readFileSync('src/components/layout/TrayPockets.vue', 'utf8');
check(/TrayPockets/.test(rsrc) && /TrayPockets/.test(lsrc), 'dialog e pagina layout usano lo STESSO componente');
check(!/<prisma|<cylinder/.test(rsrc) && !/<prisma|<cylinder/.test(lsrc), 'nessuno dei due ridisegna le tasche per conto suo');
check(/robotToDrawing/.test(comp) && !/robotToDrawing/.test(rsrc), 'la conversione assi sta in un posto solo');
check(/loadTrayPockets/.test(rsrc) && /loadTrayPockets/.test(lsrc), 'e anche la lettura delle tasche e\' una sola');
// il wiring provato sopra deve essere quello VERO: il test non deve poter
// passare su listener che la view non registra (commenti esclusi)
const codice = rsrc.split('\n').filter(r => !r.trim().startsWith('//')).join('\n');
for (const [ev, m] of WIRING) {
	check(codice.includes("socket.on('" + ev + "', this." + m + ")"), 'la view ascolta davvero ' + ev);
	check(codice.includes("socket.off('" + ev + "', this." + m + ")"), 'e lo stacca allo smontaggio: ' + ev);
}

console.log('\n10) le frasi: motivo e cosa fare, in due lingue');
const e = it.robot.declErr;
for (const code of ['947', '948', '99', '996', '997', '999', '944', '945', '946', '20001', '20002', '20005', '20006']) {
	check(typeof e[code] === 'string' && e[code].length > 30, 'rifiuto ' + code + ' spiegato');
	check(typeof en.robot.declErr[code] === 'string', 'rifiuto ' + code + ' tradotto');
}
check(/conferma, non una forzatura/.test(e['996']), 'il 996 dice che il 38 e\' una conferma, non una forzatura');
check(/Portare la cella in HOLD/.test(e['947']), 'il 947 dice cosa fare, non solo cosa e\' andato storto');
check(/invisibile al ciclo/.test(e['20006']), 'il 20006 dice la conseguenza vera: la tasca sparirebbe dal ciclo');
check(/conferma, non una forzatura/.test(it.robot.decl.boxHint), 'e l\'avviso del cassetto lo dice PRIMA di provarci');
check(it.robot.decl.seq.stopped.includes('NON sono state inviate'), 'la sequenza fermata dice che il resto non e\' partito');

console.log('\n11) chiavi che oggi il pannello mostra grezze');
// i codici lunghi sono MissionCode * 100 + errore: 13599 = missione 135
// (PickPlacePart_MC) + 99, 3005 = catena Pallet_Robot_to_MC + 5. La regola e'
// in docs/ALLARMI-PLC.md; qui si verifica solo che non sia rimasto un
// segnaposto al posto della descrizione vera.
check(/[Qq]uote di lavorazione/.test(it.robot.alarm_13599) && typeof en.robot.alarm_13599 === 'string', 'robot.alarm_13599 dice cosa non e\' stato trovato');
check(/[Pp]osizione pallet/.test(it.robot.alarm_3005) && typeof en.robot.alarm_3005 === 'string', 'robot.alarm_3005 idem');
for (const k of ['alarm_13599', 'alarm_3005'])
	check(!/non ancora fornita|not yet provided/i.test(it.robot[k] + en.robot[k]), 'nessun segnaposto rimasto in ' + k);
check(typeof it.normal === 'string' && typeof en.normal === 'string', "'normal' esiste (units.vue la chiede a ogni STATUS non mappato)");
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
check(flat(it).length === flat(en).length, 'parita\' di conteggio it/en: ' + flat(it).length);

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
