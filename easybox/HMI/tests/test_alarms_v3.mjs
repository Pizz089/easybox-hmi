// ============================================================================
// tests/test_alarms_v3.mjs — pagina Allarmi del pannello v3 (fase D)
//
//   1. codici: lettura dal testo del LOG e scomposizione missione * 100 +
//      errore (docs/ALLARMI-PLC.md) solo da 1000 a 899999;
//   2. la pagina vera resa in SSR con allarmi attivi finti (stores/
//      plantStatus.js, la stessa fonte del badge):
//      - "Cosa e' successo" e' il testo robot.alarm_<codice> che esiste gia',
//        intero;
//      - "Cosa fare" compare SOLO se esiste robot.alarm_<codice>_fix (oggi
//        nessuna: il test ne aggiunge una finta per vedere il meccanismo);
//      - unita' senza codice: "<unita'> in allarme" e il rimando ai suoi
//        Controlli;
//   3. nessun comando: niente socket, una sola lettura (GET
//      api/alarm/show/all), navigazione solo ai Controlli; nessun
//      "Riconosci" (non esiste un endpoint); il badge della barra resta
//      sulla stessa fonte (activeAlarmUnits).
//
// Uso: node tests/test_alarms_v3.mjs   (dalla cartella easybox/HMI)
// ============================================================================
const noop = () => {};
globalThis.window = {
	location: { hostname: 'localhost', reload: noop },
	matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
	addEventListener: noop, removeEventListener: noop,
	performance: globalThis.performance,
};
globalThis.sessionStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.fetch = () => Promise.reject(new Error('fetch non ammesso nel test'));
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
const { codiceAllarme, scomponiCodice } = await server.ssrLoadModule('/src/util/alarmCodes.js');
const plantStore = await server.ssrLoadModule('/src/stores/plantStatus.js');
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const AlarmsView = (await server.ssrLoadModule('/src/views/AlarmsView.vue')).default;
const { createSSRApp, h } = await import('vue');
const { renderToString } = await import('vue/server-renderer');
const { createI18n } = await import('vue-i18n');
const { createRouter, createMemoryHistory } = await import('vue-router');
const IT = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));

console.log('1) codici');
check(codiceAllarme('+900011') === '900011' && codiceAllarme(' 23 ') === '23' && codiceAllarme('ALLARME') === '', 'codice dal testo del LOG ("+900011", " 23 "), niente codice da un testo');
const dec = c => JSON.stringify(scomponiCodice(c));
check(dec(13599) === '{"mission":135,"error":99}' && dec('3005') === '{"mission":30,"error":5}', '13599 -> missione 135, errore 99; 3005 -> 30, 5');
check(scomponiCodice(959) === null && scomponiCodice(999) === null && scomponiCodice(900011) === null && scomponiCodice('') === null,
	'non si scompongono i codici corti (959, 999), i 9000xx (database, emergenze) e il vuoto');

async function rendi(messaggi) {
	const i18n = createI18n({ legacy: false, globalInjection: true, locale: 'it', messages: { it: messaggi }, missingWarn: false, fallbackWarn: false });
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] });
	await router.push('/alarms'); await router.isReady();
	const app = createSSRApp({ render: () => h(AlarmsView) });
	app.use(i18n); app.use(router);
	app.config.warnHandler = noop;
	return renderToString(app);
}
const reset = () => Object.assign(plantStore.plant, { robot: null, mc1: null, mc2: null, box: null, robotAlarm: '', trayOut: null });
const ALARM = dataStored.status_alarm;
const conFix = (codice, testo) => { const m = JSON.parse(JSON.stringify(IT)); m.robot['alarm_' + codice + '_fix'] = testo; return m; };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

console.log('\n2) la pagina, con allarmi attivi finti');
reset(); plantStore.plant.robot = ALARM; plantStore.plant.robotAlarm = '970';
let html = await rendi(IT);
check(html.includes(esc(IT.alarms.whatHappened)) && html.includes(esc(IT.robot.alarm_970)), 'robot 970: sotto "Cosa e\' successo" il testo robot.alarm_970 intero');
check(!html.includes(esc(IT.alarms.whatToDo)), '   senza robot.alarm_970_fix nessun riquadro "Cosa fare"');
check(html.includes(esc(IT.alarms.openControls.replace('{unit}', IT.menu.robot))), '   rimando ai Controlli del robot');
const FIX = 'Testo di prova del rimedio, non scritto nei locali';
html = await rendi(conFix(970, FIX));
check(html.includes(esc(IT.alarms.whatToDo)) && html.includes(FIX), 'con una chiave robot.alarm_970_fix (finta) compare "Cosa fare" col suo testo');
reset(); plantStore.plant.robot = ALARM; plantStore.plant.robotAlarm = '13599';
html = await rendi(IT);
check(html.includes(IT.alarms.decoded.replace('{mission}', '135').replace('{error}', '99')) && html.includes(esc(IT.robot.alarm_13599)), 'robot 13599: "Missione 135 · errore 99" e il suo testo');
reset(); plantStore.plant.mc1 = ALARM;
html = await rendi(IT);
check(html.includes(esc(IT.alarms.unitInAlarm.replace('{unit}', IT.nav.tab.mc1))) && html.includes(esc(IT.alarms.openControls.replace('{unit}', IT.nav.tab.mc1))),
	'MC1 in allarme (senza codice): "Macchina MC1 in allarme" e il rimando ai suoi Controlli');
check(!html.includes(esc(IT.alarms.whatToDo)), '   e nessun "Cosa fare"');
reset();
html = await rendi(IT);
check(html.includes(esc(IT.alarms.noneActive)), 'nessuna unita\' in allarme: lo dice');
reset();

console.log('\n3) nessun comando');
const src = readFileSync('src/views/AlarmsView.vue', 'utf8');
const codice = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '');
check(!/socket|\.emit\(|sendToRobot|sendToBox/.test(codice), 'niente socket ne\' invii all\'impianto');
check(!/\bfetch\(/.test(codice) && (codice.match(/caricaElenco\(/g) || []).length === 1 && /caricaElenco\(dataStored\.server, 'api\/alarm\/show\/all'\)/.test(codice), 'una sola lettura: GET api/alarm/show/all (caricaElenco)');
const rotte = [...src.matchAll(/(ROBOT|MC1|MC2|BOX): '(\/[^']+)'/g)].map(m => m[2]);
check(JSON.stringify(rotte) === JSON.stringify(['/unit/robot', '/unit/CNC1', '/unit/CNC2', '/unit/smallbox']) && (codice.match(/router\.push\(/g) || []).length === 1,
	'navigazione solo ai Controlli dell\'unita\' (' + rotte.join(', ') + ')');
check(!/[Rr]iconosc|acknowledge|alarms\.ack/.test(codice), 'nessun "Riconosci": non esiste un endpoint');
check(/_fix'/.test(codice) && /te\(chiave\(a\) \+ '_fix'\)/.test(codice), '"Cosa fare" solo da robot.alarm_<codice>_fix');
const shell = readFileSync('src/layout/v3/AppShell.vue', 'utf8');
check(/const nAllarmi = computed\(\(\) => activeAlarmUnits\(isMachineConfigured\(2\)\)\.length\)/.test(shell), 'badge della barra e campanella: stessa fonte (activeAlarmUnits)');

await server.close();
console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
