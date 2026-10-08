// ============================================================================
// tests/test_attesa_mc1_v3.mjs — avviso fisso «perche' il ciclo MC1 e'
// fermo» (pannello v3, consegna 36, 8/10)
//
// 1. Regole (util/attesaMc1.js): per ogni codice di FROM_PLANT/WAIT/MC1 che
//    riga si vede (niente, grigia, gialla, «non aggiornato») e con che link;
//    la riga grigia «nessun ordine in Play per MC1» per il 30 e per FB204 a
//    0, 10 o 20 senza un ordine di MC1 in Play.
// 2. Testi (it e en): ogni codice ha il testo lungo e quello breve; errore
//    robot (8) col testo del codice, allarme MC1 (10) col codice, l'ora e il
//    testo; i link «Vai a ...».
// 3. Lo store ascolta e legge, non comanda: l'unico emit e' la richiesta
//    della cache (MC1/WAIT/REQUEST); gli ordini da api/order/show/all;
//    socket scollegato = non aggiornato; listener staccati allo stop.
// 4. Il componente non ha pulsanti (decisione di Dario): l'unico elemento
//    toccabile e' il link; sta nella shell fra la striscia e il contenuto.
//
// Uso: node tests/test_attesa_mc1_v3.mjs   (dalla cartella easybox/HMI)
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

const A = await server.ssrLoadModule('/src/util/attesaMc1.js');
const { rigaAttesa, testiAttesa, normalizzaAttesa, ordineMc1InPlay, TIPO, CODICI, PAGINE } = A;
const IN_PLAY = [{ ID: 1, MACHINE_ID: 1, STATUS: 3, QUANTITY: 10, PRODUCTED: 2 }];
const w = (codice, statoFB204 = 50, dato = 0, allarme = null) => ({ codice, statoFB204, dato, ts: 1, allarme });
const r = (a, o = {}) => rigaAttesa(a, Object.assign({ ordini: IN_PLAY, ordiniNoti: true, livello: 0 }, o));

console.log('1) regole');
check(r(null).tipo === TIPO.NESSUNA, 'mai arrivato niente (PLC senza la 36): nessun riquadro');
check(r(w(0)).tipo === TIPO.NESSUNA, 'codice 0: nessun riquadro');
check(r(w(0, 0), { ordini: [] }).tipo === TIPO.NESSUNA, 'codice 0 anche con FB204 a 0 e nessun ordine: nessun riquadro');
check(r(w(null, null, null)).tipo === TIPO.STANTIA, 'codice null: riga grigia «non aggiornato»');
const LINK = { 1: '/unit/robot', 8: '/unit/robot', 9: '/unit/robot', 10: '/unit/robot', 15: '/unit/robot', 16: '/unit/robot', 20: '/unit/robot',
	11: '/unit/CNC1', 14: '/unit/CNC1', 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 12: null, 13: null };
for (const [c, to] of Object.entries(LINK)) {
	const x = r(w(Number(c)));
	check(x.tipo === TIPO.AVVISO && x.codice === Number(c) && (x.link ? x.link.to : null) === to,
		'codice ' + c + ': avviso giallo, ' + (to ? 'link a ' + to : 'nessun link'));
}
check(r(w(21)).tipo === TIPO.AVVISO && r(w(21)).link === null, 'codice 21 al livello 0: avviso senza link (MQTT Live e\' dal livello 1, come nella barra)');
check(r(w(21), { livello: 1 }).link && r(w(21), { livello: 1 }).link.to === '/diag/mqtt', 'codice 21 dal livello 1: link a /diag/mqtt');
check(Object.keys(CODICI).map(Number).sort((a, b) => a - b).join() === '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,20,21', 'tutti i codici della tabella hanno una regola (1-16, 20, 21)');
const ignoto = r(w(17));
check(ignoto.tipo === TIPO.AVVISO && ignoto.link === null, 'codice sconosciuto (17): avviso giallo generico, senza link');
check(r(w(30, 97)).tipo === TIPO.NEUTRA, '30 (FB204 al 97-99, in attesa di ordini): riga grigia');
check(r(w(30, 97)).link === null, '   senza link');
for (const s of [0, 10, 20]) {
	check(r(w(12, s), { ordini: [] }).tipo === TIPO.NEUTRA, 'FB204 a ' + s + ' senza ordini di MC1 in Play: riga grigia, niente giallo (12)');
	check(r(w(12, s)).tipo === TIPO.AVVISO, 'FB204 a ' + s + ' con un ordine di MC1 in Play: avviso giallo (12)');
}
check(r(w(6, 0), { ordini: [] }).tipo === TIPO.NEUTRA, 'anche col codice 6: senza ordini in Play il ciclo non aspetta niente, riga grigia');
check(r(w(11, 5), { ordini: [] }).tipo === TIPO.AVVISO, 'FB204 al 5 (non 0, 10, 20) senza ordini: avviso giallo (11)');
check(r(w(12, 0), { ordini: [], ordiniNoti: false }).tipo === TIPO.AVVISO, 'ordini non letti (server giu\'): non si decide «nessun ordine», resta l\'avviso');
check(!ordineMc1InPlay([{ MACHINE_ID: 2, STATUS: 3, QUANTITY: 10, PRODUCTED: 0 }]), 'un ordine di MC2 in Play non conta');
check(!ordineMc1InPlay([{ MACHINE_ID: 1, STATUS: 3, QUANTITY: 10, PRODUCTED: 10 }]), 'un ordine di MC1 gia\' completo (PRODUCTED = QUANTITY) non conta');
check(!ordineMc1InPlay([{ MACHINE_ID: 1, STATUS: 4, QUANTITY: 10, PRODUCTED: 0 }]), 'un ordine di MC1 in coda (STATUS 4) non conta');
check(ordineMc1InPlay([{ MACHINE_ID: '1', STATUS: '3', QUANTITY: '10', PRODUCTED: '9' }]), 'un ordine di MC1 in Play, coi numeri come testo: conta');

console.log('\n2) payload');
check(JSON.stringify(normalizzaAttesa({ codice: 11, statoFB204: 5, dato: 0, ts: 7, allarme: null })) === JSON.stringify({ codice: 11, statoFB204: 5, dato: 0, ts: 7, allarme: null }), 'oggetto del backend letto com\'e\'');
check(normalizzaAttesa('{"codice":10,"statoFB204":9999,"dato":0,"ts":7,"allarme":{"codice":959,"ts":5}}').allarme.codice === 959, 'anche come testo JSON, con l\'allarme');
check(normalizzaAttesa({ codice: null, statoFB204: null, dato: null, ts: 7 }).codice === null, 'codice null (non aggiornato) letto');
check(normalizzaAttesa({ codice: 'x', statoFB204: 0, dato: 0 }) === null && normalizzaAttesa('rotto') === null && normalizzaAttesa(5) === null, 'payload illeggibili: null (si tiene lo stato di prima)');

console.log('\n3) testi');
const L = { it: JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en: JSON.parse(readFileSync('src/locales/en.json', 'utf8')) };
const prendi = (loc, k) => k.split('.').reduce((o, p) => (o && typeof o === 'object' ? o[p] : undefined), L[loc]);
const fT = loc => (k, p) => { const v = prendi(loc, k); return typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (m, n) => (p && n in p ? String(p[n]) : m)) : k; };
const fTe = loc => k => typeof prendi(loc, k) === 'string';
const ts959 = new Date(2026, 9, 8, 13, 19, 14).getTime();
for (const loc of ['it', 'en']) {
	const tt = { t: fT(loc), te: fTe(loc) };
	const vuoti = [];
	for (const c of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 21, 17]) {
		const a = w(c, 50, 1419);
		const x = testiAttesa(r(a, { livello: 1 }), a, tt);
		if (!x.lungo || !x.breve || /\{|\}|cycleWait\./.test(x.lungo + x.breve + x.link) || (r(a, { livello: 1 }).link && !x.link)) vuoti.push(c);
	}
	check(vuoti.length === 0, loc + ': ogni codice ha testo lungo, breve e link, senza segnaposto rimasti' + (vuoti.length ? ' (mancano: ' + vuoti.join(', ') + ')' : ''));
	const ripari = ['cycleWait.stale', 'cycleWait.noOrder'].every(k => typeof prendi(loc, k) === 'string');
	check(ripari, loc + ': righe grigie «non aggiornato» e «nessun ordine in Play»');
}
const tIt = { t: fT('it'), te: fTe('it') };
const testo = (a, o) => testiAttesa(r(a, o), a, tIt);
check(testo(w(8, 50, 1419)).lungo === 'Errore robot 1419: ' + L.it.robot.alarm_1419.replace(/[.\s]+$/, '') + '. Controllare, poi Reset allarmi',
	'8 con un codice che ha un testo: «Errore robot 1419: <testo del 1419>. Controllare, poi Reset allarmi» (un punto solo)');
check(testo(w(8, 50, 12345)).lungo === 'Errore robot 12345. Controllare, poi Reset allarmi', '8 con un codice senza testo: solo il numero');
check(testo(w(8, 50, 19003)).lungo.includes('30 minuti'), '8 col 19003 (catena cassetto): il testo nuovo, 30 minuti');
check(testo(w(8, 50, 1419)).breve === 'Errore robot 1419', '   breve: «Errore robot 1419»');
const t10 = testo(w(10, 9999, 0, { codice: 959, ts: ts959 }));
check(t10.lungo === 'Ciclo MC1 fermo in errore (959 alle 13:19 — Ciclo interrotto da un comando manuale): controllare, poi Reset allarmi',
	'10 col 959: codice, ora e testo dell\'allarme («' + t10.lungo + '»)');
check(t10.breve === 'Ciclo MC1 in errore (959)', '   breve: «Ciclo MC1 in errore (959)»');
check(testo(w(10, 9999, 0, null)).lungo === 'Ciclo MC1 fermo in errore (allarme non noto): controllare, poi Reset allarmi', '10 senza allarme (9999 senza un ALARM/MC1): «allarme non noto»');
check(testo(w(10, 9999, 0, { codice: 77777, ts: ts959 })).lungo.includes('(77777 alle 13:19)'), '10 con un allarme senza testo: codice e ora');
check(testo(w(11, 5)).lungo === 'Morsa chiusa con contenuto sconosciuto: aprire la morsa, oppure dichiarare il pezzo in morsa' && testo(w(11, 5)).link === 'Vai a Controlli › Macchina MC1',
	'11: testo e «Vai a Controlli › Macchina MC1»');
check(testo(w(15, 50, 25)).lungo === 'Missione robot 25 in sospeso: premere Riprendi, oppure Reset allarmi' && testo(w(15, 50, 25)).link === 'Vai a Controlli › Robot', '15 col MissionCode: testo e «Vai a Controlli › Robot»');
check(testo(w(21, 50, 13), { livello: 1 }).link === 'Vai a Allarmi › MQTT Live' && testo(w(21, 50, 13)).link === '', '21: link a MQTT Live solo dal livello 1');
check(testo(w(3)).link === '' && testo(w(3)).lungo === 'Robot in manuale dal pendant: portare il selettore in AUTO', '3: testo, nessun link');
check(testo(w(30, 97)).lungo === 'Nessun ordine in Play per MC1' && testo(w(null, null, null)).lungo === 'Stato del ciclo non aggiornato', 'righe grigie: testi');
check(testo(w(11, 5)).linkBreve === 'Vai a Macchina MC1', 'link breve (compatto): «Vai a Macchina MC1»');
const chiavi = o => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? chiavi(v).map(x => k + '.' + x) : [k]));
check(chiavi(L.it.cycleWait).sort().join() === chiavi(L.en.cycleWait).sort().join(), 'cycleWait: stesse chiavi in it ed en');
check(Object.values(PAGINE).every(p => typeof prendi('it', p.label) === 'string' && typeof prendi('en', p.breve) === 'string'), 'pagine dei link: etichette in it ed en');

console.log('\n4) lo store ascolta e legge, non comanda');
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const ascolti = new Map(), emessi = [], letti = [];
dataStored.WS = { connected: true, socket: {
	on: (ev, f) => ascolti.set(ev, f), off: (ev, f) => { if (ascolti.get(ev) === f) ascolti.delete(ev); },
	emit: (...a) => emessi.push(a),
} };
let risposta = { ok: true, status: 200, json: async () => IN_PLAY };
globalThis.fetch = async url => { letti.push(String(url)); return risposta; };
const S = await server.ssrLoadModule('/src/stores/attesaMc1.js');
const st = S.attesaMc1;
S.startAttesaMc1();
await new Promise(res => setTimeout(res, 20));
check(['MC1/WAIT', 'PRODUCTION/CHANGED', 'disconnect', 'connect'].every(e => ascolti.has(e)), 'ascolta MC1/WAIT, PRODUCTION/CHANGED, disconnect e connect');
check(emessi.length === 1 && emessi[0][0] === 'MC1/WAIT/REQUEST', 'all\'avvio un solo emit: MC1/WAIT/REQUEST (la cache del backend), nessun comando');
check(letti.length === 1 && /api\/order\/show\/all$/.test(letti[0]) && st.ordiniNoti && st.ordini.length === 1, 'e legge gli ordini (api/order/show/all)');
check(st.attesa === null, 'finche\' non arriva niente: nessuno stato (nessun riquadro)');
ascolti.get('disconnect')();
check(st.attesa === null, 'socket scollegato senza stato: resta nessuno stato');
ascolti.get('MC1/WAIT')({ codice: 11, statoFB204: 5, dato: 0, ts: 9, allarme: null });
check(st.attesa && st.attesa.codice === 11, 'MC1/WAIT: lo stato nuovo');
ascolti.get('MC1/WAIT')('rotto');
check(st.attesa.codice === 11, 'un payload illeggibile non cambia niente');
risposta = { ok: true, status: 200, json: async () => [] };
ascolti.get('PRODUCTION/CHANGED')();
await new Promise(res => setTimeout(res, 20));
check(letti.length === 2 && st.ordini.length === 0 && st.ordiniNoti, 'PRODUCTION/CHANGED: rilegge gli ordini');
risposta = { ok: false, status: 500, json: async () => [] };
ascolti.get('PRODUCTION/CHANGED')();
await new Promise(res => setTimeout(res, 20));
check(!st.ordiniNoti, 'lettura fallita (500): ordini non noti');
ascolti.get('disconnect')();
check(st.attesa.codice === null, 'socket scollegato: «non aggiornato»');
emessi.length = 0;
ascolti.get('connect')();
check(emessi.length === 1 && emessi[0][0] === 'MC1/WAIT/REQUEST', 'alla riconnessione richiede di nuovo la cache');
S.stopAttesaMc1();
check(['MC1/WAIT', 'PRODUCTION/CHANGED', 'disconnect', 'connect'].every(e => !ascolti.has(e)), 'allo stop i listener si staccano');

console.log('\n5) il componente e il suo posto');
const comp = readFileSync('src/layout/v3/CycleWaitBar.vue', 'utf8');
const tpl = (comp.match(/<template>([\s\S]*)<\/template>/) || ['', ''])[1].replace(/<!--[\s\S]*?-->/g, '');
check(!/<button|<UiButton|role="button"/.test(tpl), 'nessun pulsante (decisione di Dario dell\'8/10)');
check((tpl.match(/@click/g) || []).length === 1 && /<a v-if="riga\.link"[^>]*@click\.prevent="vai"/.test(tpl), 'un solo elemento toccabile: il link «Vai a ...»');
const script = (comp.match(/<script setup>([\s\S]*?)<\/script>/) || ['', ''])[1];
check(!/emit\(|sendToRobot|socket|fetch\(/.test(script), 'il componente non manda niente: niente emit, socket o fetch');
check(/function vai\(\) \{\s*if \(riga\.value\.link\) router\.push\(riga\.value\.link\.to\);\s*\}/.test(script), 'il link naviga e basta (router.push)');
check(/role="status"/.test(tpl), 'role="status": i lettori di schermo lo leggono quando cambia');
const shell = readFileSync('src/layout/v3/AppShell.vue', 'utf8');
check(/<StatusStrip [^>]*\/>\s*<CycleWaitBar \/>\s*<main class="content shell__content">/.test(shell), 'nella shell: subito sotto la striscia, prima del contenuto (lo spinge in basso, non lo copre)');
check(/onMounted\(startAttesaMc1\);\s*onUnmounted\(stopAttesaMc1\);/.test(shell), 'la shell avvia e ferma lo store');
const css = (comp.match(/<style scoped>([\s\S]*)<\/style>/) || ['', ''])[1];
check(!/position:\s*(fixed|absolute|sticky)/.test(css) && /\.cycle-wait \{[^}]*flex: none;/.test(css), 'riquadro nel flusso (niente fixed, absolute o sticky): non copre niente');
check(/white-space: nowrap;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;/.test(css), 'una riga sola: il testo non va a capo');
check(/\.cycle-wait__link \{[^}]*min-height: var\(--touch-target-min\);/.test(css) && /\.cycle-wait \{[^}]*min-height: var\(--touch-target-min\);/.test(css), 'link alto 48 (bersaglio minimo), riga alta 48');
check(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(css), 'colori solo dai token');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
