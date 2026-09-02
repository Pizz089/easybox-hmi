// ============================================================================
// test_pickplace.mjs — missione 244 "preleva finito e deposita grezzo" (MC1)
// in robotView: gate su precondizioni note, dialog di conferma con verifica
// FRESCA dell'ordine attivo, esclusione reciproca overlay, nessuna
// regressione sui 4 bottoni chela. Componente REALE via Vite ssrLoadModule.
//
// Uso:   node test_pickplace.mjs     (dalla cartella easybox/HMI)
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
const comp = (await server.ssrLoadModule('/src/views/unit/robotView.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = () => new Promise(r => setTimeout(r, 20));

const emitted = [];
dataStored.WS.socket = { on: () => {}, off: () => {}, emit: (ev, p) => emitted.push([ev, p]) };
const cmds = () => emitted.filter(e => e[0] === 'TO_PLANT/CMD/ROBOT').map(e => String(e[1]));

// (rev. quote-ultimo-ordine) il dialog NON verifica piu' l'ordine: nessuna
// fetch deve partire dall'apertura/conferma. Contatore per provarlo.
let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; return { ok: true, json: async () => [], text: async () => '' }; };

function makeVm() {
	const vm = Object.assign({}, comp.data.call({}));
	for (const [k, f] of Object.entries(comp.methods)) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = k => k;
	// stato buono di default: doppia a bordo, lato 1 RAW (chela chiusa), lato 2 EMPTY
	dataStored.cmdActive = 1;
	vm.dataGripper = [{ ID: 26, STATUS: 4 }, { ID: 37, STATUS: 2 }];
	vm.gripperClosed1 = 1;
	return vm;
}

console.log('1) gate: abilitato solo con grezzo sul lato 1, lato 2 libero, HOLD');
const vm = makeVm();
check(vm.pickPlaceEnabled() === true && vm.pickPlaceDisabledReason() === '', 'stato buono: abilitato, nessun hint');
dataStored.cmdActive = 0;
check(vm.pickPlaceEnabled() === false, 'cmdActive=0: disabilitato');
dataStored.cmdActive = 1;
vm.dataGripper = [{ ID: 26, STATUS: 2 }, { ID: 37, STATUS: 2 }];
check(!vm.pickPlaceEnabled() && vm.pickPlaceDisabledReason() === 'robot.pickPlace.hintSide1', 'lato 1 vuoto: bloccato con hint lato 1');
vm.dataGripper = [{ ID: 26, STATUS: 4 }, { ID: 37, STATUS: 5 }];
check(!vm.pickPlaceEnabled() && vm.pickPlaceDisabledReason() === 'robot.pickPlace.hintSide2', 'lato 2 con FINITO: bloccato con hint lato 2');
vm.dataGripper = [{ ID: 26, STATUS: 4 }];
check(!vm.pickPlaceEnabled(), 'pinza senza lato 2: bloccato');
vm.dataGripper = [{ ID: 26, STATUS: 4 }, { ID: 37, STATUS: 2 }];
vm.gripperClosed1 = 0;
check(!vm.pickPlaceEnabled() && vm.pickPlaceDisabledReason() === 'robot.pickPlace.hintSide1', 'chele 1 APERTE (CLOSED1=0): lato 1 forzato vuoto, bloccato');
vm.gripperClosed1 = null;
check(vm.pickPlaceEnabled(), 'CLOSED1 mai visto (null): non blocca');

console.log('\n2) dialog: nota quote ultimo ordine, niente invio senza conferma');
emitted.length = 0;
const vm2 = makeVm();
fetchCalls = 0;
vm2.openPickPlaceDialog(); await tick();
check(vm2.pickPlaceDialog.open && cmds().length === 0, 'apertura: dialog su, niente inviato');
check(fetchCalls === 0, 'nessuna verifica ordine: zero chiamate REST all\'apertura');
check(vm2.pickPlaceConfirmEnabled === true, 'conferma abilitata (gate lati pinza soddisfatto)');
vm2.closePickPlaceDialog();
check(!vm2.pickPlaceDialog.open && cmds().length === 0, 'annulla: niente inviato');
vm2.openPickPlaceDialog(); await tick();
vm2.confirmPickPlace();
check(cmds().join() === '244' && !vm2.pickPlaceDialog.open, 'conferma -> TO_PLANT/CMD/ROBOT "244", dialog chiuso');
check(fetchCalls === 0, 'zero ordini in tabella: il 244 parte lo stesso (quote dell\'ultimo ordine registrato)');
check(vm2.missionRunning === 'pickplace-mc1' && vm2.missionPhase === 'armed', 'feedback missione armato');
vm2.clearMission();

console.log('\n3) rifiuto SOLO dal gate lati pinza (l\'ordine non conta piu\')');
emitted.length = 0;
const vm3 = makeVm();
vm3.dataGripper = [{ ID: 26, STATUS: 2 }, { ID: 37, STATUS: 2 }];   // lato 1 vuoto
vm3.openPickPlaceDialog(); await tick();
check(vm3.pickPlaceConfirmEnabled === false, 'gate decaduto a dialog aperto: conferma spenta');
vm3.confirmPickPlace();
check(cmds().length === 0, 'conferma forzata: niente inviato');
const tplSrc = readFileSync('src/views/unit/robotView.vue', 'utf8');
check(/robot\.pickPlace\.lastOrderNote/.test(tplSrc), 'il dialog mostra la nota sulle quote dell\'ultimo ordine');
check(!/robot\.pickPlace\.(noOrder|wrongGripper|checkFailed|orderInfo|checking)/.test(tplSrc), 'via le righe di verifica ordine dal componente');

console.log('\n4) esclusione reciproca overlay');
const vm4 = makeVm();
vm4.openPickPlaceDialog(); await tick();
vm4.openClawDialog(1);
check(!vm4.pickPlaceDialog.open && vm4.clawDialog.side === 1, 'openClawDialog chiude il dialog 244');
vm4.openPickPlaceDialog(); await tick();
check(vm4.clawDialog.side === 0 && vm4.pickPlaceDialog.open, 'openPickPlaceDialog chiude il dialog chela');
vm4.openDeclDialog();
check(!vm4.pickPlaceDialog.open && vm4.declDialog.open, 'openDeclDialog chiude il dialog 244');
vm4.closeDeclDialog();
vm4.openPickPlaceDialog(); await tick();
vm4.openTestDialog('placeMC');
check(!vm4.pickPlaceDialog.open && vm4.testDialog.type === 'placeMC', 'openTestDialog chiude il dialog 244');

console.log('\n5) nessuna regressione sui 4 bottoni chela');
emitted.length = 0;
const vm5 = makeVm();
check(vm5.clawEnabled(1) && vm5.clawEnabled(2), 'clawEnabled invariato (doppia a bordo)');
vm5.sendClaw(1, false); vm5.sendClaw(2, false);
check(cmds().join() === '241,243', 'chiusure 241/243 invariate');
vm5.clearMission();
vm5.openClawDialog(1); vm5.confirmClawOpen();
vm5.openClawDialog(2); vm5.confirmClawOpen();
check(cmds().join() === '241,243,240,242', 'aperture 240/242 via dialog invariate');
const src = readFileSync('src/views/unit/robotView.vue', 'utf8');
check(/const PICKPLACE_CMD = '244';/.test(src), 'codice 244 in un punto solo (PICKPLACE_CMD)');

console.log('\n6) posizione: il bottone 244 sta nella card MISSIONI, non fra le chele');
const tpl = src.slice(0, src.lastIndexOf('</template>'));
const missionCard = tpl.slice(tpl.indexOf('CARD 3'), tpl.indexOf('CARD 4'));
const clawCard = tpl.slice(tpl.indexOf('CARD 5'));
check(missionCard.includes("robot.pickPlace.button") && missionCard.includes('pickPlaceDialog.open'), 'bottone e dialog 244 dentro la CARD 3 Missioni');
check(!clawCard.includes('pickPlace'), 'nessuna traccia del 244 nella CARD 5 Comandi pinza');
check((clawCard.match(/clawEnabled\(side\) \?/g) || []).length === 4, 'i 4 bottoni chela restano al loro posto, invariati');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
