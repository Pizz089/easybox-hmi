// ============================================================================
// tests/test_shell_v3.mjs — shell del pannello v3 (fase A, 6/10)
//
// 1. Rotte INVARIATE: tutti gli URL di prima ci sono ancora (test, link,
//    preferiti del tablet); l'unica nuova e' /alarms. Tutte nella shell.
// 2. Navigazione: sette voci nell'ordine delle tavole; ogni rotta sta in
//    una voce; schede tecniche nascoste all'operatore (Posizioni, Macchine,
//    Magazzini, MQTT), le macchine solo se configurate.
// 3. HOLD / Riprendi / START della striscia = pulsante di robotView: stesso
//    comando nello stesso stato (dalla mappa golden dei comandi).
// 4. Lo store della striscia ascolta e legge, non comanda: l'unico emit e'
//    il replay della cache (UNIT/STATUS/REQUEST), listener staccati allo stop.
//
// Uso: node tests/test_shell_v3.mjs   (dalla cartella easybox/HMI)
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

console.log('1) rotte invariate, tutte nella shell');
// URL del router PRIMA del v3 (commit 120e35c): nessuno deve sparire
const PRIMA = ['/', '/dashboard', '/production', '/changeUser', '/unit/robot', '/unit/smallbox', '/unit/CNC1', '/unit/CNC2',
	'/conf/Grippers', '/conf/Fixtures', '/conf/Fixture', '/conf/FixtureOnPallet', '/conf/Grating/:grating_ID', '/conf/Gratings',
	'/conf/importGrating', '/conf/Warehouses', '/conf/Attrezzaggi', '/conf/Attrezzaggio', '/conf/Pallets', '/conf/pallet',
	'/conf/Vices', '/conf/vice', '/conf/Parts', '/conf/piece/piece', '/conf/Trays', '/conf/Gripper/gripper', '/conf/tray',
	'/conf/Position', '/sim/push', '/conf/Machines', '/layout/:trayID/:modifyEnable/:floorMag', '/selectRig', '/selectPiece',
	'/selectGripper', '/selectPallet', '/selectVice', '/selectFixture', '/selectMC', '/lastData', '/dispatcher', '/diag/mqtt', '/test'];
const router = readFileSync('src/router/index.js', 'utf8');
const ora = [...router.matchAll(/^\s*path: "([^"]+)"/gm)].map(m => m[1]);
const sparite = PRIMA.filter(p => !ora.includes(p));
check(sparite.length === 0, 'tutti gli URL di prima ci sono ancora (' + PRIMA.length + ')' + (sparite.length ? ': mancano ' + sparite.join(', ') : ''));
const nuove = ora.filter(p => !PRIMA.includes(p));
check(nuove.slice().sort().join() === '/alarms,/settings/user', 'rotte nuove solo /alarms e /settings/user' + (nuove.length ? ' (' + nuove.join(', ') + ')' : ''));
const blocchi = router.split(/\n\s*\{\s*\n/).filter(b => /path: "/.test(b));
const senzaShell = blocchi.filter(b => /component:/.test(b) && !/meta: \{ layout: AppShell \}/.test(b)).map(b => b.match(/path: "([^"]+)"/)[1]);
check(senzaShell.length === 1 && senzaShell[0] === '/dispatcher', 'ogni pagina e\' nella shell (fuori solo /dispatcher, che non aveva layout neanche prima)' + (senzaShell.length ? ': ' + senzaShell.join(', ') : ''));
check(!/StandardMenu/.test(router.replace(/\/\/.*$/gm, '')), 'nessuna rotta usa piu\' il layout vecchio');

console.log('\n2) navigazione e livelli');
const { NAV, sectionOf, visibleTabs } = await server.ssrLoadModule('/src/layout/navConfig.js');
check(NAV.map(s => s.id).join(',') === 'home,controls,production,warehouse,tooling,alarms,settings', 'sette voci nell\'ordine delle tavole');
check(NAV.find(s => s.id === 'settings').bottom === true && NAV.find(s => s.id === 'alarms').badge === true, 'Impostazioni in fondo, badge su Allarmi');
const esempi = { '/': 'home', '/dashboard': 'home', '/production': 'production', '/selectRig': 'production', '/lastData': 'production',
	'/unit/robot': 'controls', '/unit/CNC1': 'controls', '/unit/smallbox': 'controls',
	'/conf/Trays': 'warehouse', '/conf/tray': 'warehouse', '/layout/22/1/8': 'warehouse', '/conf/Gratings': 'warehouse', '/conf/Grating/2095': 'warehouse', '/conf/importGrating': 'warehouse', '/conf/Parts': 'warehouse', '/conf/piece/piece': 'warehouse',
	'/conf/Attrezzaggi': 'tooling', '/conf/Attrezzaggio': 'tooling', '/conf/Pallets': 'tooling', '/conf/pallet': 'tooling', '/conf/Vices': 'tooling', '/conf/vice': 'tooling',
	'/conf/Fixtures': 'tooling', '/conf/Fixture': 'tooling', '/conf/FixtureOnPallet': 'tooling', '/conf/Grippers': 'tooling', '/conf/Gripper/gripper': 'tooling', '/sim/push': 'tooling',
	'/alarms': 'alarms', '/diag/mqtt': 'alarms', '/conf/Position': 'settings', '/conf/Machines': 'settings', '/conf/Warehouses': 'settings', '/settings/user': 'settings' };
const sbagliate = Object.entries(esempi).filter(([p, id]) => (sectionOf(p) || {}).id !== id).map(([p, id]) => p + ' -> ' + ((sectionOf(p) || {}).id || 'nessuna') + ' (attesa ' + id + ')');
check(sbagliate.length === 0, 'ogni rotta accende la sua voce (' + Object.keys(esempi).length + ' rotte)' + (sbagliate.length ? ': ' + sbagliate.join('; ') : ''));
check((sectionOf('/UNIT/robot') || {}).id === 'controls', 'senza distinguere maiuscole, come il router');
const tutte = m => n => m.includes(n);
const etichette = (lv, conf) => NAV.flatMap(s => visibleTabs(s, lv, conf).map(t => t.to));
const solo1 = tutte([1]);
const op = etichette(0, solo1), tec = etichette(1, solo1), amm = etichette(2, solo1);
check(!['/conf/Position', '/conf/Machines', '/conf/Warehouses', '/diag/mqtt'].some(r => op.includes(r)), 'operatore: niente Posizioni, Macchine, Magazzini, MQTT');
check(['/conf/Position', '/conf/Warehouses', '/diag/mqtt'].every(r => tec.includes(r)) && !tec.includes('/conf/Machines'), 'livello 1: Posizioni, Magazzini, MQTT; Macchine no (livello 2 come oggi)');
check(amm.includes('/conf/Machines'), 'livello 2: anche Macchine');
check(op.includes('/sim/push') && op.includes('/alarms'), 'operatore: Spinta in battuta e Allarmi visibili');
check(!op.includes('/unit/CNC2') && etichette(0, tutte([1, 2])).includes('/unit/CNC2'), 'MC2 solo se configurata');
check(visibleTabs(NAV.find(s => s.id === 'settings'), 0, solo1).map(t => t.to).join() === '/settings/user', 'Impostazioni per l\'operatore: solo Utente e lingua (nessun "non abilitato")');
const su = readFileSync('src/views/SettingsUserView.vue', 'utf8'), lingua = readFileSync('src/util/lingua.js', 'utf8');
check(/<ChangeUserModal/.test(su) && /useLingua/.test(su) && /useLingua/.test(readFileSync('src/layout/v3/StatusStrip.vue', 'utf8')) && /LINGUE = \['it', 'en'\]/.test(lingua),
	'Utente e lingua: stesso dialog di cambio utente e stesso ciclo it/en della striscia');
const rail = readFileSync('src/layout/v3/NavRail.vue', 'utf8');
check(/v-else type="button"[\s\S]{0,200}\$emit\('open-user'\)/.test(rail), 'voce senza schede -> cambio utente');

console.log('\n3) HOLD / Riprendi / START della striscia = pulsante di robotView');
// la striscia dalla mappa di oggi, il pulsante della pagina Robot dalla mappa
// di RIFERIMENTO (prima delle fasi B-D): dalla fase B il HOLD sta solo nella
// striscia, e deve fare esattamente cio' che faceva quello della pagina
const g = JSON.parse(readFileSync('tests/golden/comandi.json', 'utf8'));
const rif = JSON.parse(readFileSync('tests/golden/comandi_riferimento.json', 'utf8'));
const strip = g.pagine.StatusStrip.controlli, robot = rif.pagine.robotView.controlli;
const emitsIn = (ctrls, scen) => ctrls.filter(c => c.handler === 'sendToRobot(17)').map(c => c.esiti[scen]).filter(e => e && typeof e === 'object').flatMap(e => e.effetti);
const coppie = [['robot in HOLD', 'HOLD liv2'], ['robot in AUTO', 'AUTO liv2'], ['robot spento', 'OFF liv2']];
for (const [s, r] of coppie)
	check(JSON.stringify(emitsIn(strip, s)) === JSON.stringify(emitsIn(robot, r)) && emitsIn(strip, s).length === 1,
		s + ': ' + JSON.stringify(emitsIn(strip, s)) + ' come robotView (' + JSON.stringify(emitsIn(robot, r)) + ')');
const vis = (ctrls, scen) => ctrls.filter(c => c.handler.startsWith('sendToRobot(17)')).map(c => c.esiti[scen] === 'nascosto' ? '-' : c.etichetta.includes('start') || c.etichetta === 'START' ? 'START' : 'HOLD');
check(vis(strip, 'robot spento').join() === '-,START' && vis(strip, 'robot in HOLD').join() === 'HOLD,-', 'a tre stati: HOLD/Riprendi se non spento, START da spento');
// (6/10) il 17 e' un toggle nel PLC: a STATUS ignoto o NOT_DEFINED il
// pulsante resta visibile ma spento, in tutti e due i posti
const spento = (ctrls, scen) => {
	const visibili = ctrls.filter(c => c.handler.startsWith('sendToRobot(17)')).map(c => c.esiti[scen]).filter(e => e && e !== 'nascosto');
	return visibili.length === 1 && visibili[0].abilitato === false;
};
check(spento(strip, 'stato non ancora noto') && spento(strip, 'NOT_DEFINED (0)') && spento(robot, 'STATUS ignoto liv2') && spento(robot, 'NOT_DEFINED liv2'),
	'STATUS ignoto o NOT_DEFINED: HOLD spento nella striscia e nella pagina Robot');
const ss = readFileSync('src/layout/v3/StatusStrip.vue', 'utf8');
check(/strip__hold--start \{ animation: blinker 1s linear infinite; \}/.test(ss), 'START con la stessa animazione di robotView (blinker 1s)');

console.log('\n4) lo store della striscia non comanda');
const emessi = [], ascolti = new Map();
const { dataStored } = await server.ssrLoadModule('/src/data.js');
dataStored.WS = { socket: { emit: (e, p) => emessi.push(e + ' ' + p), on: (e, h) => ascolti.set(e, (ascolti.get(e) || 0) + 1), off: (e) => ascolti.set(e, (ascolti.get(e) || 0) - 1) } };
globalThis.fetch = async u => { emessi.push('fetch ' + u); return { ok: true, json: async () => [] }; };
const ps = await server.ssrLoadModule('/src/stores/plantStatus.js');
ps.startPlantStatus(); ps.startPlantStatus();
check(emessi.filter(e => !e.startsWith('fetch')).every(e => e.startsWith('UNIT/STATUS/REQUEST ')), 'emit solo UNIT/STATUS/REQUEST (replay della cache): ' + JSON.stringify(emessi.filter(e => !e.startsWith('fetch'))));
check(emessi.filter(e => e.startsWith('fetch')).every(e => /api\/(unit|conf\/tray)\/show\/all$/.test(e)), 'letture: api/unit/show/all e api/conf/tray/show/all');
check([...ascolti.values()].every(n => n === 1), 'due start = un solo giro di listener');
ps.stopPlantStatus(); ps.stopPlantStatus();
check([...ascolti.values()].every(n => n === 0), 'allo stop i listener si staccano tutti');
const shell = readFileSync('src/layout/v3/AppShell.vue', 'utf8');
check(/<main class="content shell__content">/.test(shell), 'la shell tiene <main class="content"> (selettori di custom-fix e productionTable)');
check(/<ChangeUserModal/.test(shell) && /<alert/.test(shell), 'cambio utente e toast degli allarmi come nel layout di prima');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
