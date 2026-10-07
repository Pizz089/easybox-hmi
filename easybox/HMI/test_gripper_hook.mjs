// ============================================================================
// test_gripper_hook.mjs — uncino per i cassetti e pinza ferma col cassetto
// fuori, lato pannello (consegna 34 del 7/10)
//
//   1. util: twinRowsOf (convenzione di util/grippers.js), hasHook,
//      avvisoUncinoOrdine, statoCassetti / motivoPinzaCassetto;
//   2. anagrafica pinze (Gripper.vue), la casella «Uncino per cassetti»:
//      lettura dalla vista, scrittura (update e insert), pass-through se la
//      vista non lo espone, gemella della pinza doppia allineata (e il caso
//      in cui la scrittura della gemella fallisce);
//   3. pagina Robot: carica / scarica / cambio pinza spenti col cassetto
//      fuori o in manovra, col motivo; la conferma ricontrolla;
//   4. lista pinze: «sposta» (11/12) spento col cassetto fuori;
//   5. Produzione: avviso (non blocco) per la pinza senza uncino, alla
//      creazione (ultimo passo del wizard) e all'avvio dell'ordine.
//
// Uso:   node test_gripper_hook.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const G = await server.ssrLoadModule('/src/util/grippers.js');
const C = await server.ssrLoadModule('/src/util/cassettoFuori.js');
const Gripper = (await server.ssrLoadModule('/src/views/conf/Gripper/Gripper.vue')).default;
const GrippersView = (await server.ssrLoadModule('/src/views/conf/GrippersView.vue')).default;
const robotView = (await server.ssrLoadModule('/src/views/unit/robotView.vue')).default;
const lastData = (await server.ssrLoadModule('/src/views/workOrder/lastData.vue')).default;
const productionTable = (await server.ssrLoadModule('/src/components/productionTable.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

function vmOf(comp, extra) {
	const vm = Object.assign({}, comp.data ? comp.data.call({}) : {}, extra || {});
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { configurable: true, get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k, p) => k + (p ? ' ' + JSON.stringify(p) : '');
	vm.pushed = [];
	vm.$router = { push: x => { vm.pushed.push(x); } };
	return vm;
}
// socket finto: registra gli emit
const emessi = [];
dataStored.WS = { socket: { emit: (e, p) => emessi.push(e + ' ' + (typeof p === 'object' ? JSON.stringify(p) : p)), on: () => {}, off: () => {} } };
const nuovoAlert = () => { dataStored.alert = { title: '', desc: '', type: '' }; };
// fetch finto: rotte per url, chiamate registrate
let chiamate = [];
function fetchFinto(rotte) {
	chiamate = [];
	globalThis.fetch = async (url) => {
		const u = String(url);
		chiamate.push(u);
		for (const [re, r] of rotte) if (re.test(u)) {
			const v = typeof r === 'function' ? r(u) : r;
			if (v === 'KO_RETE') return { ok: false, json: async () => [], text: async () => '' };
			return { ok: true, json: async () => JSON.parse(JSON.stringify(v)), text: async () => (typeof v === 'string' ? v : 'OK') };
		}
		return { ok: true, json: async () => [], text: async () => 'OK' };
	};
}

// righe REALI della cella (vista GRIPPERS dopo gripper-has-hook.sql)
const RIGHE = () => [
	{ ID: 1,  FAMILY: 'Pinza PALLET',       SUB_POS: 0, POS_MAG: 4, POS_PLANT: 0,    STATUS: 2, HAS_HOOK: false, X_BODY: 0, Y_BODY: 0, Z_BODY: 0, X_CLAW: 0, Y_CLAW: 0, Z_CLAW: 0, STROKE_CLAW: 10000, TICKNESS_CLAW: 10000, CLAW_LENGTH: null },
	{ ID: 26, FAMILY: 'Pinza pezzo DOPPIA', SUB_POS: 3, POS_MAG: 3, POS_PLANT: 1000, STATUS: 2, HAS_HOOK: true,  X_BODY: 0, Y_BODY: 0, Z_BODY: 0, X_CLAW: 0, Y_CLAW: 0, Z_CLAW: 0, STROKE_CLAW: 10000, TICKNESS_CLAW: 10000, CLAW_LENGTH: 42000 },
	{ ID: 37, FAMILY: 'Pinza pezzo DOPPIA', SUB_POS: 3, POS_MAG: 3, POS_PLANT: 1000, STATUS: 2, HAS_HOOK: true,  X_BODY: 0, Y_BODY: 0, Z_BODY: 0, X_CLAW: 0, Y_CLAW: 0, Z_CLAW: 0, STROKE_CLAW: 10000, TICKNESS_CLAW: 10000, CLAW_LENGTH: null },
];
const senzaHook = rows => rows.map(r => { const x = Object.assign({}, r); delete x.HAS_HOOK; return x; });
const param = (u, k) => new URL(u, 'http://x/').searchParams.get(k);

console.log('1) util');
check(G.twinRowsOf(RIGHE(), 26).map(r => r.ID).join() === '37' && G.twinRowsOf(RIGHE(), 37).map(r => r.ID).join() === '26' && G.twinRowsOf(RIGHE(), 1).length === 0,
	'twinRowsOf: la gemella di 26 e\' 37 (e viceversa), la pinza pallet non ne ha');
check(G.hasHook({ HAS_HOOK: true }) === true && G.hasHook({ HAS_HOOK: 1 }) === true && G.hasHook({ HAS_HOOK: false }) === false && G.hasHook({ HAS_HOOK: 0 }) === false
	&& G.hasHook({}) === null && G.hasHook(null) === null, 'hasHook: bit (true/false o 1/0), null se la vista non lo espone');
check(G.avvisoUncinoOrdine(RIGHE(), 1) === 'production.noHookWarning' && G.avvisoUncinoOrdine(RIGHE(), 26) === '' && G.avvisoUncinoOrdine(senzaHook(RIGHE()), 1) === '' && G.avvisoUncinoOrdine(RIGHE(), 99) === '',
	'avvisoUncinoOrdine: solo se la pinza dell\'ordine risulta SENZA uncino (non se non si sa)');
const st = C.statoCassetti([{ FLOOR_MAG: 3, EXTRACT: 1 }, { FLOOR_MAG: 4, EXTRACT: 0 }]);
check(st.estratto && st.estratto.FLOOR_MAG === 3 && !st.manovra && C.motivoPinzaCassetto(st) === 'robot.hint.trayOutGripper', 'statoCassetti: cassetto 3 fuori -> «Cassetto fuori: prima rientralo»');
check(C.motivoPinzaCassetto(C.statoCassetti([{ FLOOR_MAG: 5, EXTRACT: 1000 }])) === 'robot.hint.trayBusy' && C.motivoPinzaCassetto(C.statoCassetti([{ FLOOR_MAG: 5, EXTRACT: 0 }])) === ''
	&& C.statoCassetti([{ FLOOR_MAG: 13, EXTRACT: 1 }]).estratto === null, '   manovra (1000/2000) -> «Manovra cassetto in corso»; riga fuori dai 12 cassetti ignorata');

console.log('\n2) anagrafica pinze: la casella «Uncino per cassetti»');
const apriPinza = async (id, righe) => {
	fetchFinto([[/gripper\/show\//, righe.filter(r => r.ID === id)]]);
	const vm = vmOf(Gripper);
	vm.$route = { query: { gripperID: id } };
	vm.updatePreviewFromModel = () => {};
	vm.getDataTable(); await tick();
	return vm;
};
let vm = await apriPinza(26, RIGHE());
check(vm.gripper.HAS_HOOK === true && vm.hookKnown === true, 'lettura: la doppia (26) ha l\'uncino, casella accesa');
vm = await apriPinza(1, RIGHE());
check(vm.gripper.HAS_HOOK === false && vm.hookKnown === true, '   la pinza pallet (1) non ce l\'ha');
vm = await apriPinza(26, senzaHook(RIGHE()));
check(vm.hookKnown === false, '   vista senza HAS_HOOK: casella spenta (non si sa)');
const tpl = readFileSync('src/views/conf/Gripper/Gripper.vue', 'utf8');
check(/type="checkbox"\s+name="HAS_HOOK"\s+v-model="gripper\.HAS_HOOK"\s+:disabled="!hookKnown"/.test(tpl) && /\$t\("gripper\.hasHook"\)/.test(tpl), '   nel form la casella, accanto alle misure, senza permessi diversi dagli altri campi');

// scrittura: la doppia perde l'uncino (26) -> update della 26 e setHasHook della 37
const salva = async (vm, rotte) => { nuovoAlert(); fetchFinto(rotte); vm.saveData(); await tick(60); return chiamate.slice(); };
vm = await apriPinza(26, RIGHE());
vm.gripper.HAS_HOOK = false;
let c = await salva(vm, [[/updateGripper/, 'OK'], [/gripper\/show\/all/, RIGHE()], [/setHasHook/, 'OK']]);
const upd = c.find(u => /updateGripper/.test(u));
check(upd && param(upd, 'HAS_HOOK') === '0' && param(upd, 'ID') === '26', 'scrittura: updateGripper della 26 con HAS_HOOK=0');
const sh = c.filter(u => /setHasHook/.test(u));
check(sh.length === 1 && param(sh[0], 'ID') === '37' && param(sh[0], 'HAS_HOOK') === '0' && c.indexOf(sh[0]) > c.indexOf(upd),
	'   gemella allineata: setHasHook della 37 a 0, dopo l\'update');
check(vm.pushed.join() === '/conf/Grippers' && dataStored.alert.desc === '', '   poi torna all\'elenco');
// gemella gia' allineata: niente scrittura in piu'
vm = await apriPinza(26, RIGHE());
c = await salva(vm, [[/updateGripper/, 'OK'], [/gripper\/show\/all/, RIGHE()], [/setHasHook/, 'OK']]);
check(param(c.find(u => /updateGripper/.test(u)), 'HAS_HOOK') === '1' && !c.some(u => /setHasHook/.test(u)), '   gemella con lo stesso valore: nessun setHasHook');
// la scrittura della gemella non riesce: messaggio, si resta sul form
vm = await apriPinza(26, RIGHE());
vm.gripper.HAS_HOOK = false;
c = await salva(vm, [[/updateGripper/, 'OK'], [/gripper\/show\/all/, RIGHE()], [/setHasHook/, 'KO_NOT_FOUND']]);
check(c.some(u => /setHasHook/.test(u)) && /gripper\.hasHookTwinFailed/.test(dataStored.alert.desc) && vm.pushed.length === 0,
	'   gemella non scritta: «l\'uncino non e\' stato scritto sull\'altra riga», si resta sul form');
vm = await apriPinza(26, RIGHE());
vm.gripper.HAS_HOOK = false;
c = await salva(vm, [[/updateGripper/, 'OK'], [/gripper\/show\/all/, 'KO_RETE']]);
check(/gripper\.hasHookTwinFailed/.test(dataStored.alert.desc) && vm.pushed.length === 0, '   elenco pinze non letto: stesso messaggio, nessuna scrittura alla cieca');
// pinza semplice: niente gemelle
vm = await apriPinza(1, RIGHE());
vm.gripper.HAS_HOOK = true;
c = await salva(vm, [[/updateGripper/, 'OK'], [/gripper\/show\/all/, RIGHE()], [/setHasHook/, 'OK']]);
check(param(c.find(u => /updateGripper/.test(u)), 'HAS_HOOK') === '1' && !c.some(u => /setHasHook/.test(u)) && vm.pushed.length === 1, '   pinza pallet: solo la sua riga');
// PASS-THROUGH: vista senza HAS_HOOK -> parametro vuoto (il backend lascia la colonna), nessuna gemella toccata
vm = await apriPinza(26, senzaHook(RIGHE()));
c = await salva(vm, [[/updateGripper/, 'OK'], [/gripper\/show\/all/, RIGHE()], [/setHasHook/, 'OK']]);
check(param(c.find(u => /updateGripper/.test(u)), 'HAS_HOOK') === '' && !c.some(u => /setHasHook|show\/all/.test(u)),
	'pass-through: vista senza HAS_HOOK -> HAS_HOOK vuoto (a DB resta 1), gemella non toccata');
// insert
nuovoAlert(); fetchFinto([[/insertGripper/, 'OK']]);
vm = vmOf(Gripper); vm.$route = { query: {} }; vm.updatePreviewFromModel = () => {};
vm.getDataTable(); vm.gripper.HAS_HOOK = true; vm.saveData(); await tick(60);
check(vm.create && param(chiamate.find(u => /insertGripper/.test(u)), 'HAS_HOOK') === '1' && !chiamate.some(u => /setHasHook|show\/all/.test(u)), 'pinza nuova: insertGripper con HAS_HOOK=1, nessuna gemella');

console.log('\n3) pagina Robot: comandi pinza spenti col cassetto fuori');
dataStored.safetyAux = 1;
const robot = (tray) => {
	const rv = vmOf(robotView);
	rv.dataRobot = { STATUS: dataStored.status_hold };
	rv.dataGripper = [{ ID: 26, STATUS: 2 }, { ID: 37, STATUS: 2 }];
	Object.assign(rv, tray || {});
	return rv;
};
let rv = robot();
check(rv.gripperBranchEnabled === true && rv.gripperDisabledReason === '', 'in HOLD, cassetti dentro: «Gestione pinza» acceso');
rv = robot({ extractedTray: { FLOOR_MAG: 3, EXTRACT: 1 } });
check(rv.gripperBranchEnabled === false && rv.gripperDisabledReason === 'robot.hint.trayOutGripper', 'cassetto fuori: spento, «Cassetto fuori: prima rientralo»');
rv = robot({ trayBusy: true });
check(rv.gripperBranchEnabled === false && rv.gripperDisabledReason === 'robot.hint.trayBusy', 'cassetto in manovra: spento, «Manovra cassetto in corso»');
rv = robot({ extractedTray: { FLOOR_MAG: 3, EXTRACT: 1 } });
rv.dataRobot = { STATUS: 10 };
check(rv.gripperDisabledReason === 'robot.hint.notHold', '   fuori da HOLD prevale il motivo di sempre');
// la conferma ricontrolla: carico (11), scarico (12) e cambio (27) non partono
for (const [lbl, prep] of [['carico 11', r => { r.dataGripper = []; r.dialog.type = 'gripper'; r.dialog.selected = { ID: 26 }; r.confirmDialog(); }],
	['cambio 27', r => { r.swapSelecting = true; r.dialog.type = 'gripper'; r.dialog.selected = { ID: 1 }; r.confirmDialog(); }],
	['scarico 12', r => { r.confirmUnload(); }]]) {
	rv = robot({ extractedTray: { FLOOR_MAG: 3, EXTRACT: 1 } });
	rv.getGrippersList = () => {}; rv.getPalletsList = () => {}; rv.getTraysList = () => {};
	nuovoAlert(); emessi.length = 0;
	prep(rv);
	check(!emessi.some(e => /TO_PLANT\/CMD\/ROBOT/.test(e)) && dataStored.alert.desc === 'robot.dialog.stateChanged', '   ' + lbl + ' col cassetto fuori (stato cambiato col dialog aperto): non parte, messaggio');
}
fetchFinto([[/tray\/show\/all/, [{ FLOOR_MAG: 8, EXTRACT: 1 }, { FLOOR_MAG: 2, EXTRACT: 0 }]]]);
rv = robot(); rv.getTraysList(); await tick();
check(rv.extractedTray && rv.extractedTray.FLOOR_MAG === 8 && rv.gripperBranchEnabled === false, 'il dato e\' quello che la pagina ha gia\' (vista dei cassetti, EXTRACT = 1)');

console.log('\n4) lista pinze: «sposta» (11/12) spento col cassetto fuori');
fetchFinto([[/tray\/show\/all/, [{ FLOOR_MAG: 8, EXTRACT: 1 }]]]);
const gv = vmOf(GrippersView);
gv.getTrays(); await tick();
check(gv.motivoPinza === 'robot.hint.trayOutGripper', 'motivo: «Cassetto fuori: prima rientralo»');
emessi.length = 0; gv.datiTab = RIGHE(); gv.PickReleaseGripper(26);
check(emessi.length === 0, '   e nessun comando parte');
const gvSrc = readFileSync('src/views/conf/GrippersView.vue', 'utf8');
check(/:moveDisable="!dataStored\.cmdActive \|\| motivoPinza !== ''"/.test(gvSrc) && /<p class="tray-hint" v-if="motivoPinza">\{\{ \$t\(motivoPinza\) \}\}<\/p>/.test(gvSrc), '   bottone spento e motivo scritto nella pagina');

console.log('\n5) Produzione: avviso per la pinza senza uncino (non blocca)');
dataStored.createWorkOrder = Object.assign({}, dataStored.createWorkOrder || {}, { gripperID: 1 });
fetchFinto([[/gripper\/show\/all/, RIGHE()]]);
let ld = vmOf(lastData); ld.getHookWarning(); await tick();
check(ld.hookWarning === 'production.noHookWarning', 'creazione (ultimo passo del wizard): pinza 1 senza uncino -> avviso');
dataStored.createWorkOrder.gripperID = 26;
ld = vmOf(lastData); ld.getHookWarning(); await tick();
check(ld.hookWarning === '', '   pinza 26 con l\'uncino: nessun avviso');
const ldSrc = readFileSync('src/views/workOrder/lastData.vue', 'utf8');
check(/<div class="form-row" v-if="hookWarning">[\s\S]*?<span class="hook-warning">\{\{ t\(hookWarning\) \}\}<\/span>/.test(ldSrc)
	&& /:disabled="!piecePPValid \|\| !fixtureOk \|\| !pushOk \|\| !quantityValid"/.test(ldSrc) && !/hookWarning\s*\)?\s*return/.test(ldSrc),
	'   una riga di avviso; il salvataggio resta possibile (non e\' fra le condizioni del pulsante)');
const pt = vmOf(productionTable);
pt.orders = [{ ID: 7001, GRIPPER_ID: 1, PIECE_ID: 5 }, { ID: 7002, GRIPPER_ID: 26, PIECE_ID: 5 }];
nuovoAlert(); emessi.length = 0; fetchFinto([[/gripper\/show\/all/, RIGHE()]]);
pt.modifyOrderStatus(7001, dataStored.status_working, 5);
check(emessi.length === 1 && /TO_PLANT\/CMD\/ORDER/.test(emessi[0]) && dataStored.alert.desc === '', 'avvio: il comando parte subito, come prima');
await tick();
check(/production\.noHookWarning/.test(dataStored.alert.desc) && dataStored.alert.type === 'warning', '   poi l\'avviso: pinza dell\'ordine senza uncino (19005)');
nuovoAlert(); fetchFinto([[/gripper\/show\/all/, RIGHE()]]);
pt.modifyOrderStatus(7002, dataStored.status_working, 5); await tick();
check(dataStored.alert.desc === '', '   ordine con la doppia (uncino): nessun avviso');
nuovoAlert(); fetchFinto([[/gripper\/show\/all/, RIGHE()]]);
pt.modifyOrderStatus(7001, dataStored.status_raw, 5); await tick();
check(chiamate.length === 0 && dataStored.alert.desc === '', '   stop dell\'ordine: nessuna lettura, nessun avviso');

await server.close();
console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
