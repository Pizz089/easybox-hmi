// ============================================================================
// test_robot_claw.mjs — CARD 5 "Comandi pinza" di robotView.vue (240..243).
// Carica la VERA robotView.vue via Vite ssrLoadModule; i metodi girano su un
// vm minimale con socket finto. Il template viene verificato staticamente
// (i 4 bottoni gated su clawEnabled -> dataStored.cmdActive).
//
// Uso:   node test_robot_claw.mjs     (dalla cartella easybox/HMI)
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
const src = readFileSync('src/views/unit/robotView.vue', 'utf8');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const emitted = [];
dataStored.WS.socket = { on: () => {}, off: () => {}, emit: (ev, p) => emitted.push([ev, p]) };
const cmds = () => emitted.filter(e => e[0] === 'TO_PLANT/CMD/ROBOT').map(e => String(e[1]));

function makeVm() {
	const vm = Object.assign({}, comp.data.call({}));
	for (const [k, f] of Object.entries(comp.methods)) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	return vm;
}

console.log('1) template: 4 bottoni, tutti gated su clawEnabled (-> dataStored.cmdActive)');
// fine = chiusura del template ROOT (l'ultima: dentro ci sono <template v-else> annidati)
const card = src.slice(src.indexOf('CARD 5'), src.lastIndexOf('</template>'));
const btnOpen = (card.match(/openClawDialog\(side\)/g) || []).length;
const btnClose = (card.match(/sendClaw\(side, false\)/g) || []).length;
check(btnOpen === 1 && btnClose === 1 && card.includes('v-for="side in [1, 2]"'), 'apri/chiudi x lato 1 e 2 (v-for sui due lati)');
check((card.match(/clawEnabled\(side\) \?/g) || []).length === 4, ':class e @click di entrambi i bottoni passano da clawEnabled');
check(/clawEnabled\(side\)\s*\{[\s\S]*?dataStored\.cmdActive != 1\) return false/.test(src), 'clawEnabled usa dataStored.cmdActive');
check(!/CMD_enabled\(\)\s*\{\s*dataStored\.cmdActive = \(this\.dataRobot\.STATUS == dataStored\.status_hold\);[\s\S]{0,40}claw/i.test(src), 'CMD_enabled() non toccata');
check(card.includes('confirmClawOpen()') && !card.includes('sendClaw(side, true)'), 'nel template l\'apertura passa SOLO dal dialog');

console.log('\n2) gating: cmdActive falso -> tutto disabilitato');
const vm = makeVm();
dataStored.cmdActive = false;
vm.dataGripper = [{ ID: 26 }, { ID: 37 }];
check(!vm.clawEnabled(1) && !vm.clawEnabled(2), 'lato 1 e 2 disabilitati con cmdActive=false');
vm.openClawDialog(1);   // il template non lo chiamerebbe; il re-check alla conferma deve comunque bloccare
vm.confirmClawOpen();
check(cmds().length === 0 && vm.clawDialog.side === 0, 'conferma con cmdActive=false: nessun comando inviato');

console.log('\n3) gating lato 2 dalla seconda riga di dataGripper');
dataStored.cmdActive = true;
vm.dataGripper = [{ ID: 26 }];
check(vm.clawEnabled(1) && !vm.clawEnabled(2) && vm.clawSide2Available === false, 'pinza a una riga: lato 1 si, lato 2 no');
vm.dataGripper = {};
check(vm.clawEnabled(1) && !vm.clawEnabled(2), 'nessuna pinza a bordo ({}): lato 1 si (gate = cmdActive), lato 2 no');
vm.dataGripper = [{ ID: 26 }, { ID: 37 }];
check(vm.clawEnabled(1) && vm.clawEnabled(2) && vm.clawSide2Available === true, 'pinza doppia (2 righe): entrambi i lati');

console.log('\n4) chiusura diretta, apertura solo con conferma');
emitted.length = 0;
vm.sendClaw(1, false);
check(cmds().join() === '241' && vm.clawDialog.side === 0, 'chiudi lato 1 -> "241" subito, nessun dialog');
vm.sendClaw(2, false);
check(cmds().join() === '241,243', 'chiudi lato 2 -> "243"');
check(vm.missionRunning === 'claw-close-2' && vm.missionPhase === 'armed', 'feedback missione armato sul bottone premuto');
vm.clearMission();
emitted.length = 0;
vm.openClawDialog(1);
check(vm.clawDialog.side === 1 && cmds().length === 0, 'apri lato 1 -> dialog aperto, NIENTE inviato');
vm.closeClawDialog();
check(vm.clawDialog.side === 0 && cmds().length === 0, 'annulla -> niente inviato');
vm.openClawDialog(1); vm.confirmClawOpen();
check(cmds().join() === '240' && vm.clawDialog.side === 0, 'conferma -> "240" e dialog chiuso');
vm.openClawDialog(2); vm.confirmClawOpen();
check(cmds().join() === '240,242', 'conferma lato 2 -> "242"');
check(vm.missionRunning === 'claw-open-2', 'feedback missione sul bottone apri lato 2');
vm.clearMission();
emitted.length = 0;
vm.dataGripper = [{ ID: 26 }];
vm.openClawDialog(2); vm.confirmClawOpen();
check(cmds().length === 0, 're-check alla conferma: lato 2 sparito a dialog aperto -> niente inviato');
check(emitted.every(e => e[0] === 'TO_PLANT/CMD/ROBOT'), 'nessun topic nuovo (solo TO_PLANT/CMD/ROBOT)');

console.log('\n5) un solo overlay: il dialog chela si chiude aprendo gli altri e viceversa');
vm.openClawDialog(1);
vm.openTestDialog('placeMC');
check(vm.clawDialog.side === 0 && vm.testDialog.type === 'placeMC', 'openTestDialog chiude il dialog chela');
vm.openClawDialog(1);
check(vm.testDialog.type === '' && vm.clawDialog.side === 1, 'openClawDialog chiude il dialog di collaudo');
vm.openDialog('tray');
check(vm.clawDialog.side === 0 && vm.dialog.type === 'tray', 'openDialog chiude il dialog chela');
vm.openClawDialog(2);
vm.openDeclDialog();
check(vm.clawDialog.side === 0 && vm.declDialog.open === true, 'openDeclDialog chiude il dialog chela');
vm.dataGripper = [{ ID: 26 }];
vm.openClawDialog(1);
vm.openGripperMission();
check(vm.clawDialog.side === 0 && vm.unloadOpen === true, 'openGripperMission chiude il dialog chela');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
