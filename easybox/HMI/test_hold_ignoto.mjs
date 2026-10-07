// ============================================================================
// test_hold_ignoto.mjs — HOLD / CONTINUA / START spento a stato del robot ignoto
//
// Nel PLC il 17 e' un TOGGLE (FB_Robot, CMD_HOLD: IF NOT #holdButton THEN
// #HOLD := NOT #HOLD): se il pannello non sa in che stato e' il robot, un
// pulsante con scritto "HOLD" potrebbe TOGLIERE l'hold. Con STATUS ignoto
// (null / undefined / vuoto) o NOT_DEFINED (0) il pulsante che manda il 17 e'
// visibile ma disabilitato, testo "—".
// Vale per ogni pulsante del pannello che manda il 17, ovunque stia (pagina
// Robot; nel pannello v3 la striscia di stato). Fa eccezione solo START, che
// esiste solo con lo stato NOTO "spento".
//
// Uso:   node test_hold_ignoto.mjs     (dalla cartella easybox/HMI)
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync, existsSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const { robotStatoIgnoto } = await server.ssrLoadModule('/src/util/holdState.js');
const robot = (await server.ssrLoadModule('/src/views/unit/robotView.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

console.log('1) quando lo stato del robot e\' ignoto');
for (const [v, atteso, nome] of [[undefined, true, 'undefined'], [null, true, 'null'], ['', true, 'vuoto'], ['  ', true, 'spazi'], ['abc', true, 'non numerico'],
	[0, true, 'NOT_DEFINED (0)'], ['0', true, 'NOT_DEFINED ("0")'],
	[dataStored.status_hold, false, 'HOLD (17)'], [String(dataStored.status_hold), false, 'HOLD ("17")'], [dataStored.status_auto, false, 'AUTO (10)'],
	[dataStored.status_working, false, 'in lavoro (3)'], [dataStored.status_off, false, 'spento'], [dataStored.status_alarm, false, 'allarme (99)']])
	check(robotStatoIgnoto(v) === atteso, nome + ' -> ' + (atteso ? 'ignoto' : 'noto'));

console.log('\n2) pagina Robot: holdIgnoto segue lo STATUS');
const vm = Object.assign({}, robot.data.call({}));
Object.defineProperty(vm, 'holdIgnoto', { get: () => robot.computed.holdIgnoto.call(vm) });
for (const [s, atteso] of [[undefined, true], [0, true], [dataStored.status_hold, false], [dataStored.status_auto, false]]) {
	vm.dataRobot = { STATUS: s };
	check(vm.holdIgnoto === atteso, 'STATUS ' + String(s) + ' -> holdIgnoto ' + atteso);
}

console.log('\n3) ogni pulsante che manda il 17 si spegne a stato ignoto');
const FILE = ['src/views/unit/robotView.vue', 'src/layout/v3/StatusStrip.vue'].filter(f => existsSync(f));
let gated = 0;
for (const f of FILE) {
	const src = readFileSync(f, 'utf8');
	const tpl = src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '');
	// (fase E1.3) nella striscia il 17 passa dall'antirimbalzo: @click="premi",
	// e premi manda sendToRobot(17) (test_hold_guard.mjs)
	const viaPremi = /const premi = \(\) => \{ holdGuard\.premi\(\(\) => sendToRobot\(17\)\); \};/.test(src);
	const click = viaPremi ? '(?:sendToRobot\\(17\\)|premi)' : 'sendToRobot\\(17\\)';
	for (const m of tpl.matchAll(new RegExp('<button([^>]*@click="' + click + '"[^>]*)>([\\s\\S]*?)<\\/button>', 'g'))) {
		const attr = m[1], corpo = m[2];
		// START: compare solo con lo stato NOTO "spento"
		if (/v-if="dataRobot\.STATUS==dataStored\.status_off"/.test(attr) || /(^|\s)v-else(\s|$|=)/.test(attr)) continue;
		const dis = (attr.match(/:disabled="([^"]+)"/) || [])[1];
		check(!!dis, f + ': il pulsante HOLD ha :disabled (' + (dis || 'assente') + ')');
		check(/—/.test(corpo), f + ': e mostra "—" a stato ignoto');
		check(/cmd\.holdUnknown/.test(attr), f + ': tooltip "Stato del robot non noto"');
		check(/robotStatoIgnoto/.test(src), f + ': la regola e\' quella di util/holdState.js');
		gated++;
	}
}
check(gated >= 1, 'almeno un pulsante HOLD controllato (' + gated + ')');

console.log('\n4) testo del tooltip in due lingue');
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
check(it.cmd && it.cmd.holdUnknown === 'Stato del robot non noto' && en.cmd && en.cmd.holdUnknown === 'Robot state unknown', 'cmd.holdUnknown in italiano e in inglese');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
