// ============================================================================
// test_alarm_972.mjs — 972 seguito dal codice dell'errore attivo (consegna 35)
//
// Il PLC, quando rifiuta un comando di missione per un errore attivo,
// pubblica su FROM_PLANT/ALARM/ROBOT (evento PLC/ALARM/ROBOT) prima 972 e
// subito dopo il codice dell'errore. Il riquadro globale e' uno solo: un 972
// seguito entro 1 s da un altro codice diventa un avviso unico; un 972 da
// solo, e ogni altro codice, restano come prima (robot.alarm_<codice>).
// (7/10 sera, risposte sulla consegna 35) l'avviso unico: titolo «Comando
// rifiutato: errore attivo <codice>», testo del codice, la coda «Premi RESET
// e ripeti il comando.» solo se il codice non ha un testo. Si abbina solo il
// messaggio che segue su PLC/ALARM/ROBOT: mai ALARM/MC1 ne' GENERIC.
//
//   1. i due messaggi in fila (testi veri it ed en);
//   2. il 972 da solo, il codice oltre 1 s, l'ordine inverso, codici senza testo;
//   3. l'handler sul riquadro (store finto) e il riquadro che lo mostra;
//   4. un punto solo: StandardMenu usa l'handler della util.
//
// Uso:   node test_alarm_972.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
globalThis.window = { location: { hostname: 'localhost' }, performance: globalThis.performance };
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { robotAlarmCombiner, makePlcAlarmRobotHandler, makePlcAlarmHandlers, codiciInDialog, codiceInDialog, codiceAllarme, titoloCoppia, ALARM_REJECT_ACTIVE, ALARM_PAIR_MS, DIALOG_GRACE_MS } from './src/util/robotAlarm.js';
import { aspettaEco } from './src/util/palletMachine.js';
const require = createRequire(import.meta.url);
const { createI18n } = require('vue-i18n');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
const i18n = createI18n({ legacy: false, locale: 'it', fallbackLocale: 'en', messages: { it, en }, missingWarn: false, fallbackWarn: false });
const { t, te } = i18n.global;
let ora = 1000;
const now = () => ora;
// il riquadro mostra $t(desc): una chiave si traduce, un testo gia' tradotto resta com'e'
const aVideo = desc => t(desc);

console.log('1) 972 e poi il codice, in fila');
check(ALARM_REJECT_ACTIVE === 972 && ALARM_PAIR_MS === 1000, 'costanti: 972, finestra 1 s');
let d = robotAlarmCombiner({ t, te, now });
let a = d('972');
check(a === 'robot.alarm_972' && aVideo(a) === it.robot.alarm_972, 'arriva il 972: a video il testo del 972, come oggi');
ora += 3;
a = d('1419');
const tit = titoloCoppia(t, d.ultimaCoppia);
check(d.ultimaCoppia === 1419 && tit === 'Comando rifiutato: errore attivo 1419' && aVideo(a) === it.robot.alarm_1419,
	'subito dopo il 1419: titolo «' + tit + '», testo del 1419');
check(((tit + ' ' + aVideo(a)).match(/RESET/g) || []).length === 1, '   «RESET» compare UNA volta sola (lo dice gia\' il testo del 1419)');
ora += 3;
a = d('999');
check(a === 'robot.alarm_999' && d.ultimaCoppia === null, 'il codice dopo non si accoppia piu\' (la coppia si consuma)');
d = robotAlarmCombiner({ t, te, now });
d('972'); ora += 999;
a = d('947');
check(a === 'robot.alarm_947' && d.ultimaCoppia === 947, 'a 999 ms: ancora accoppiato');
i18n.global.locale.value = 'en';
d = robotAlarmCombiner({ t, te, now });
d('972'); ora += 1;
a = d('947');
check(titoloCoppia(t, d.ultimaCoppia) === 'Command refused: active error 947' && aVideo(a) === en.robot.alarm_947, 'in inglese: «' + titoloCoppia(t, d.ultimaCoppia) + '» + testo del 947');
i18n.global.locale.value = 'it';

console.log('\n2) quando NON si accoppia');
d = robotAlarmCombiner({ t, te, now });
check(aVideo(d('972')) === it.robot.alarm_972, '972 da solo: resta come oggi');
ora += 1001;
check(d('999') === 'robot.alarm_999', 'codice oltre 1 s dopo il 972: da solo, come oggi');
d = robotAlarmCombiner({ t, te, now });
d('999'); ora += 1;
check(d('972') === 'robot.alarm_972', 'ordine inverso (codice, poi 972): niente avviso unico');
d = robotAlarmCombiner({ t, te, now });
d('972'); ora += 1;
a = d('12345');
check(a === 'robot.alarm972NoText' && aVideo(a) === 'Premi RESET e ripeti il comando.' && titoloCoppia(t, d.ultimaCoppia) === 'Comando rifiutato: errore attivo 12345',
	'codice senza testo: titolo col codice e la coda «Premi RESET e ripeti il comando.»');
d = robotAlarmCombiner({ t, te, now });
d('972'); ora += 1;
check(d('Impossible to connect') === 'robot.alarm_Impossible to connect', 'un testo che non e\' un codice: come oggi');
d = robotAlarmCombiner({ t, te, now });
d('972'); ora += 1; d('972'); ora += 1;
check(d(' 947 ') === 'robot.alarm_947' && d.ultimaCoppia === 947, 'due 972 di fila e poi il codice (con spazi): accoppiato al secondo');
d = robotAlarmCombiner({ t, te, now });
d('972'); ora += 1;
check(d('972') === 'robot.alarm_972' && d.ultimaCoppia === null, 'un 972 che segue un altro 972 non si abbina: e\' il testo del 972');
d = robotAlarmCombiner({ t, te, now });
check(['18', '947', '973', '691'].every(c => d(c) === 'robot.alarm_' + c), 'gli altri codici: robot.alarm_<codice>, come oggi');

console.log('\n3) l\'handler sul riquadro globale');
const store = { alert: { title: '', desc: '', type: 'alarm' } };
const h = makePlcAlarmRobotHandler(store, { t, te, now });
h('973');
check(store.alert.title === 'PLC_Error' && store.alert.desc === 'robot.alarm_973' && store.alert.type === 'warning', '973: titolo, chiave e tipo come prima');
h('972');
check(store.alert.title === 'PLC_Error' && store.alert.desc === 'robot.alarm_972', '972 da solo: titolo e testo del 972, come oggi');
ora += 2; h('20011');
check(store.alert.title === 'Comando rifiutato: errore attivo 20011' && t(store.alert.title) === store.alert.title && store.alert.desc === 'robot.alarm_20011',
	'972 + 20011: titolo dell\'avviso unico ($t lo lascia com\'e\') e testo del 20011');
// (7/10 sera) il 972 si abbina solo al messaggio che segue su PLC/ALARM/ROBOT
const st2 = { alert: { title: '', desc: '', type: '' } };
const hh = makePlcAlarmHandlers(st2, { t, te, now });
hh.robot('972'); ora += 200; hh.mc1('947');
check(st2.alert.title === 'MC1' && st2.alert.desc === 'robot.alarm_947', '972 e, 200 ms dopo, 947 su ALARM/MC1: nessun abbinamento, il 947 col suo testo come oggi');
ora += 100; hh.robot('1419');
check(st2.alert.title === 'Comando rifiutato: errore attivo 1419', '   e il 972 resta in attesa del SUO messaggio su PLC/ALARM/ROBOT (entro 1 s)');
// l'handler di PLC/ALARM/GENERIC sta nel layout: StandardMenu.vue su
// ui-lifting, layout/plantGlobals.js su ui-v3
const layoutSrc = ['src/layout/StandardMenu.vue', 'src/layout/plantGlobals.js'].filter(existsSync).map(p => readFileSync(p, 'utf8')).join('\n');
const gen = (layoutSrc.match(/const plcAlarmGenericHandler = payload => \{[\s\S]*?\n\s*\}/) || [''])[0];
check(gen && !/allarmi|robotAlarmCombiner|desc\(/.test(gen) && /dataStored\.alert\.desc = payload/.test(gen), 'PLC/ALARM/GENERIC ha un handler suo, che non passa dal combinatore del 972');
const alertVue = readFileSync('src/components/Alerts/Alert.vue', 'utf8');
check(/\{\{ \$t\(desc\) \}\}/.test(alertVue), 'il riquadro (Alerts/Alert.vue) mostra $t(desc)');

console.log('\n4) un punto solo');
const menuPath = 'src/layout/StandardMenu.vue';
const globPath = 'src/layout/plantGlobals.js';
const punti = [menuPath, globPath].filter(existsSync).map(p => [p, readFileSync(p, 'utf8')]);
check(punti.length >= 1 && punti.every(([, src]) => /makePlcAlarmHandlers\(dataStored, \{ t, te \}\)/.test(src) && /socket\.on\('PLC\/ALARM\/ROBOT', plcAlarmRobotHandler\)/.test(src)
	&& /socket\.on\('ALARM\/MC1', alarmMc1Handler\)/.test(src) && /socket\.on\('ALARM\/BOX', alarmBoxHandler\)/.test(src) && /socket\.off\('ALARM\/BOX', alarmBoxHandler\)/.test(src) && !/'robot\.alarm_' \+ (payload|code)/.test(src)),
	'handler di PLC/ALARM/ROBOT, ALARM/MC1 e ALARM/BOX dalla util in ' + punti.map(([p]) => p).join(', '));
check(!existsSync(globPath) || !existsSync(menuPath) || !/PLC\/ALARM\/ROBOT/.test(readFileSync(menuPath, 'utf8')) || !/PLC\/ALARM\/ROBOT/.test(readFileSync(globPath, 'utf8')) || /usePlantGlobals/.test(readFileSync(menuPath, 'utf8')),
	'un solo layout registra l\'handler');

console.log('\n5) (7/10 sera) B60: il codice passa da parseInt');
check(codiceAllarme('+900001') === 900001 && codiceAllarme(' 18 ') === 18 && Number.isNaN(codiceAllarme('Impossible to connect')), 'codiceAllarme: "+900001" -> 900001, " 18 " -> 18, testo -> NaN');
d = robotAlarmCombiner({ t, te, now });
check(d('+900001') === 'robot.alarm_900001' && d(' 18 ') === 'robot.alarm_18' && aVideo(d(' 18 ')) === it.robot.alarm_18, 'chiave col codice ripulito: robot.alarm_900001, robot.alarm_18 (e il 18 col suo testo)');

console.log('\n6) B61: il 99 di ALARM/BOX ha un testo suo');
let st = { alert: { title: '', desc: '', type: '' } };
let hs = makePlcAlarmHandlers(st, { t, te, now });
hs.robot('99');
check(st.alert.desc === 'robot.alarm_99' && aVideo(st.alert.desc) === 'ALLARME GENERICO', '99 del robot (non da ALARM/BOX): "ALLARME GENERICO", come prima');
hs.box('99'); ora += 2; hs.robot('99');
check(st.alert.desc === 'robot.alarmBox_99' && /cassetto fuori intervallo/.test(aVideo(st.alert.desc)), '99 arrivato su ALARM/BOX: «' + aVideo(st.alert.desc) + '»');
hs.box('996'); ora += 2; hs.robot('996');
check(st.alert.desc === 'robot.alarm_996', '996 da ALARM/BOX senza testo box suo: robot.alarm_996');
hs.box('99'); ora += ALARM_PAIR_MS + 1; hs.robot('99');
check(st.alert.desc === 'robot.alarm_99', 'il 99 del robot arrivato oltre 1 s dopo quello del cassetto: testo del robot');
check(['948', '951', '996', '997', '999'].every(c => te('robot.alarm_' + c) && t('robot.alarm_' + c) !== 'robot.alarm_' + c), '948, 951, 996, 997, 999: un testo nel namespace degli allarmi');

console.log('\n7) B61: niente riquadro per un codice che un dialog aperto sta gia\' mostrando');
st = { alert: { title: '', desc: '', type: '' } };
hs = makePlcAlarmHandlers(st, { t, te, now });
let rilascia = codiciInDialog([947, 944], { graziaMs: 0 });
check(codiceInDialog(947) && codiceInDialog('944') && !codiceInDialog(948), 'codici registrati dal dialog');
hs.mc1('947'); hs.robot('944');
check(st.alert.title === '' && st.alert.desc === '', 'ALARM/MC1 947 e PLC/ALARM/ROBOT 944 col dialog che li mostra: il riquadro non compare');
hs.mc1('948');
check(st.alert.title === 'MC1' && st.alert.desc === 'robot.alarm_948', 'un codice che il dialog non mostra: riquadro come prima');
rilascia();
check(!codiceInDialog(947), 'dialog chiuso: i codici tornano al riquadro');
hs.mc1('947');
check(st.alert.desc === 'robot.alarm_947', '   e il 947 compare di nuovo');
// aspettaEco registra i codici del rifiuto finche' aspetta, piu' il margine
const asc = {}; const sock = { on: (e, f) => { asc[e] = f; }, off: (e) => { delete asc[e]; } };
const att = aspettaEco(sock, { evento: 'DECLARE/MC1', allarme: 'ALARM/MC1', codici: [947], ms: 2000 });
check(codiceInDialog(947), 'aspettaEco: mentre aspetta, il 947 lo mostra il dialog');
asc['ALARM/MC1']('947');
const esito = await att;
check(esito.ok === false && esito.codice === 947 && codiceInDialog(947), '   rifiuto arrivato: l\'attesa finisce, il codice resta zitto ancora per il margine (l\'allarme al riquadro arriva un attimo dopo)');
await new Promise(r => setTimeout(r, DIALOG_GRACE_MS + 50));
check(!codiceInDialog(947), '   dopo ' + DIALOG_GRACE_MS + ' ms torna al riquadro');
const rv = readFileSync('src/views/unit/robotView.vue', 'utf8');
// DECL_CODICI nello <script> dell'Options API, non nello <script setup> (che
// il watcher non vede): il watcher vero lo prova test_cell_declare.mjs
const rvOpzioni = rv.slice(rv.indexOf('\n<script>'));
check(/'declDialog\.open'\(aperto\)/.test(rv) && /codiciInDialog\(DECL_CODICI\)/.test(rv) && /const DECL_CODICI = \[947, 948, 99, 996, 997, 999, 944, 945, 946, 968, 969, 20001, 20002, 20005, 20006\]/.test(rvOpzioni),
	'Reimposta stato cella aperta: i suoi codici (macchina, cassetto, robot, tasche) non vanno al riquadro');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
