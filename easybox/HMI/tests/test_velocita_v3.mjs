// ============================================================================
// tests/test_velocita_v3.mjs — velocita' robot a passi (pannello v3, fase B)
//
// Regole (PROMPT pannello v3, regola 1 "Velocita'"):
//   - il comando resta "100;<val>" su TO_PLANT/CMD/ROBOT; il valore mostrato
//     e' l'eco del PLC (ROBOT/CHANGESPEED), limitato a 1..100;
//   - i passi -10/-1/+1/+10 partono dall'eco, o dall'ultimo valore inviato
//     se l'eco non e' ancora arrivata, e mandano UN solo comando dopo 400 ms
//     senza tocchi: niente raffiche;
//   - i valori fissi 10/25/50/100 inviano subito.
// Carica la VERA robotView.vue via Vite; i metodi girano su un vm minimale
// con socket e timer finti (il tempo lo fa avanzare il test).
//
// Uso: node tests/test_velocita_v3.mjs   (dalla cartella easybox/HMI)
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
const ascolti = {};
dataStored.WS.socket = { on: (ev, f) => { ascolti[ev] = f; }, off: () => {}, emit: (ev, p) => emitted.push([ev, p]) };
const cmds = () => emitted.filter(e => e[0] === 'TO_PLANT/CMD/ROBOT').map(e => String(e[1]));

// timer finti: il tempo avanza solo quando lo dice il test
let ora = 0, prossimo = 1;
const timer = new Map();
globalThis.setTimeout = (f, ms) => { const id = prossimo++; timer.set(id, { f, t: ora + (ms || 0) }); return id; };
globalThis.clearTimeout = id => { timer.delete(id); };
function avanza(ms) {
	ora += ms;
	for (const [id, x] of [...timer].sort((a, b) => a[1].t - b[1].t)) if (x.t <= ora && timer.has(id)) { timer.delete(id); x.f(); }
}

function makeVm(stato) {
	const vm = Object.assign({}, comp.data.call({}), { $t: k => k });
	for (const [k, f] of Object.entries(comp.methods)) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.dataRobot = { STATUS: stato, DESCR: '' };
	return vm;
}
const eco = v => { dataStored.robotSpeed = v; };

console.log('1) passi: un solo comando dopo 400 ms senza tocchi');
eco('20');
let vm = makeVm(dataStored.status_hold);
emitted.length = 0;
vm.stepSpeed(1); avanza(100); vm.stepSpeed(1); avanza(100); vm.stepSpeed(10); avanza(399);
check(cmds().length === 0, 'tre tocchi ravvicinati: ancora niente dopo 399 ms dall\'ultimo');
check(vm.speedTarget === 32, 'intanto la pagina mostra il valore in arrivo (→ 32 %), il numero grande resta l\'eco (' + vm.displaySpeed + ')');
avanza(1);
check(cmds().join(',') === '100;32', 'a 400 ms parte UN comando, con la somma dei passi: ' + cmds().join(','));
check(vm.displaySpeed === 20, 'il numero grande resta l\'eco del PLC finche\' non arriva la nuova');

console.log('\n2) prima dell\'eco i passi partono dall\'ultimo valore inviato');
emitted.length = 0;
vm.stepSpeed(-1); avanza(400);
check(cmds().join(',') === '100;31', 'eco ancora a 20, ultimo inviato 32: -1 manda 31, non 19');
console.log('\n3) arrivata l\'eco si riparte dall\'eco');
vm.onSpeedEcho('30');
check(dataStored.robotSpeed === '30' && vm.displaySpeed === 30 && vm.speedTarget === null, 'eco 30: numero grande 30, niente "in arrivo"');
emitted.length = 0;
vm.stepSpeed(10); avanza(400);
check(cmds().join(',') === '100;40', 'dall\'eco 30, +10 manda 40');

console.log('\n4) limiti 1..100, e niente comando se non cambia niente');
eco('95'); vm = makeVm(dataStored.status_hold); emitted.length = 0;
vm.stepSpeed(10); avanza(400);
check(cmds().join(',') === '100;100', '95 + 10 = 100, non 105');
vm.onSpeedEcho('100'); emitted.length = 0;
vm.stepSpeed(10); avanza(400);
check(cmds().length === 0, 'a 100, +10 non manda niente');
eco('3'); vm = makeVm(dataStored.status_hold); emitted.length = 0;
vm.stepSpeed(-10); avanza(400);
check(cmds().join(',') === '100;1', '3 - 10 = 1, mai 0 o negativo');
eco('50'); vm = makeVm(dataStored.status_hold); emitted.length = 0;
vm.stepSpeed(1); vm.stepSpeed(-1); avanza(400);
check(cmds().length === 0, '+1 e -1 ravvicinati: torna all\'eco, nessun comando');

console.log('\n5) valori fissi: subito, e annullano i passi in attesa');
eco('20'); vm = makeVm(dataStored.status_hold); emitted.length = 0;
vm.stepSpeed(1);
vm.setSpeedPreset(50);
check(cmds().join(',') === '100;50', 'il 50 parte subito');
avanza(1000);
check(cmds().join(',') === '100;50', 'e il +1 in attesa non parte piu\'');
check(JSON.stringify(vm.speedPresets) === '[10,25,50,100]', 'i quattro valori fissi sono 10/25/50/100');

console.log('\n6) gate: stato robot ignoto = niente velocita\', come il cursore di prima');
eco('20'); vm = makeVm(undefined); emitted.length = 0;
vm.stepSpeed(10); avanza(400); vm.setSpeedPreset(50);
check(cmds().length === 0, 'STATUS non noto: ne\' passi ne\' valori fissi');
vm = makeVm(dataStored.status_notDef); emitted.length = 0;
vm.stepSpeed(10); avanza(400); vm.setSpeedPreset(50);
check(cmds().length === 0, 'NOT_DEFINED: idem');

console.log('\n7) uscendo dalla pagina il passo in attesa parte (il tocco era voluto)');
eco('20'); vm = makeVm(dataStored.status_hold); emitted.length = 0;
vm.dataRobot = { STATUS: dataStored.status_hold };
vm.stepSpeed(10);
comp.unmounted.call(vm);
check(cmds().join(',') === '100;30', 'smontaggio: 100;30 parte subito, una volta');
avanza(1000);
check(cmds().length === 1, 'e il timer non lo rimanda');

console.log('\n8) eco: ascoltata con un handler nominato e staccata allo smontaggio');
const codice = src.split('\n').filter(r => !r.trim().startsWith('//')).join('\n');
check(codice.includes("socket.on('ROBOT/CHANGESPEED', this.onSpeedEcho)") && codice.includes("socket.off('ROBOT/CHANGESPEED', this.onSpeedEcho)"), 'on/off con lo stesso handler (prima restava attaccato a ogni visita)');
check(/updateSpeed\(val\)\{[\s\S]{0,80}this\.sendToRobot\("100;"\+val\)/.test(src), 'il comando resta "100;<val>" in updateSpeed');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
