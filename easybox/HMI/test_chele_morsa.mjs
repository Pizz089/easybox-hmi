// ============================================================================
// test_chele_morsa.mjs — catalogo delle chele della morsa nel pannello
// (7/10, prompt 5 di 5, parte 1: coerenza del pannello e testi)
//
//   1. VOCABOLARIO (Dario, 7/10): chele della morsa e ganasce sono la stessa
//      cosa, a video una parola sola per oggetto: «chela della morsa» /
//      «chele morsa», «chela della pinza» / «chele pinza». In it.json la
//      radice «ganasc» non c'e' piu'; in en.json «jaw» compare solo in chiavi
//      della morsa («vice jaw»), la pinza e' «gripper claw»;
//   2. i rifiuti del catalogo (KO_NO_JAW e gli altri) e il 799 hanno un testo
//      in it ed en;
//   3. Spinta in battuta, form morsa e wizard passano dal tipo montato: la
//      riga «Chele montate», i rifiuti mostrati, la battuta corretta
//      (clawLengthRef) negli stessi calcoli della vista.
//
// Uso:   node test_chele_morsa.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
import { readFileSync } from 'node:fs';
import * as E from './src/util/errorCodes.js';
import { pushQuotes, stopCorrected } from './src/util/pushQuotes.js';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
const voci = (o, p = '', out = []) => { for (const [k, v] of Object.entries(o)) typeof v === 'string' ? out.push([p + k, v]) : voci(v, p + k + '.', out); return out; };
const I = voci(it), N = Object.fromEntries(voci(en));

console.log('1) vocabolario');
check(I.every(([, v]) => !/ganasc/i.test(v)), 'it.json: la radice «ganasc» non c\'e\' piu\' (' + I.filter(([, v]) => /ganasc/i.test(v)).map(([k]) => k).join(', ') + ')');
// le chiavi della morsa (controllate nel codice: le mostrano Vice.vue,
// PushSim.vue e lastData.vue parlando della morsa) e i testi nuovi
const MORSA = /^(viceJaw\.|vice\.|pushSim\.(fViceClaw|fZClaw|fStopBeyond|compNoRow|stopMissing|confirmVice|confirmZClaw|confirmZSink|confirmStop|restsOnClaw|restsOnDeclared|reason\.NO_DATA|reason\.NO_FIT|reason\.NO_ROOM)$|wizard\.lastData\.pushNo(Data|Fit)$|robot\.alarm_799$)/;
const jaw = Object.entries(N).filter(([, v]) => /jaw/i.test(v)).map(([k]) => k);
check(jaw.length > 0 && jaw.every(k => MORSA.test(k)), 'en.json: «jaw» solo in chiavi della morsa (' + jaw.filter(k => !MORSA.test(k)).join(', ') + ')');
check(N['gripper.stroke_claw'] === 'Gripper claw stroke' && N['gripper.tickness_claw'] === 'Gripper claw thickness' && /gripper claws/.test(N['piece.zPickRange']),
	'pinza: «gripper claw» (prima «Jaw»)');
check(it.gripper.stroke_claw === 'Corsa della chela della pinza' && it.gripper.tickness_claw === 'Spessore della chela della pinza' && /chele della pinza chiuse sul fondo/.test(it.piece.zPickRange),
	'pinza: «chela della pinza»');
check(/^Chela della morsa:/.test(it.vice.clawLength) && it.pushSim.fViceClaw === 'Chela della morsa' && it.pushSim.fZClaw === 'Altezza chela morsa',
	'morsa: «chela della morsa» / «chele morsa»');
// i segnaposto non si perdono cambiando le parole
for (const k of ['wizard.lastData.pushNoFit', 'pushSim.confirmVice', 'pushSim.confirmStop', 'pushSim.restsOnDeclared', 'pushSim.reason.NO_FIT', 'pushSim.reason.NO_ROOM', 'piece.zPickRange']) {
	const seg = t => (String(t).match(/\{\w+\}/g) || []).sort().join();
	const itv = k.split('.').reduce((o, p) => o[p], it);
	check(seg(itv) === seg(N[k]), '   ' + k + ': stessi segnaposto in it ed en (' + seg(itv) + ')');
}

console.log('\n2) testi dei rifiuti e del 799');
for (const k of ['KO_NO_JAW', 'KO_JAW_ACTIVE_ORDER', 'KO_JAW_RETIRED', 'KO_JAW_MOUNTED', 'KO_JAW_IN_USE', 'KO_JAW_DUP_CODE'])
	check(E[k] === k && it.viceJaw[k] && en.viceJaw[k], k + ': codice nel pannello e testo in it ed en');
check(it.viceJaw.mounted === 'Chele montate: {code}' && en.viceJaw.mounted === 'Mounted jaws: {code}' && it.viceJaw.none && en.viceJaw.none, 'riga «Chele montate: <codice>»');
// (8/10, prompt 6) su ui-lifting senza il percorso del menu: «Attrezzaggio ›
// Chele morsa» lo aggiunge il v3 nella parte 2, quando la pagina esiste
check(it.robot.alarm_799 === "Deposito in macchina fermato: nessuna quota per questo ordine. Controlla pezzo e attrezzatura dell'ordine, e che le chele dell'ordine siano quelle montate sulla morsa. Poi RESET."
	&& /mounted on the vice\. Then RESET\.$/.test(en.robot.alarm_799), '799: il testo di Dario, in it ed en');

console.log('\n3) pannello: tipo montato e battuta corretta');
const ps = readFileSync('src/views/sim/PushSim.vue', 'utf8');
check((ps.match(/clawLengthRef: this\.stopRefSim,/g) || []).length === 2, 'Spinta in battuta: la battuta corretta nei due calcoli (esito e corsa)');
check(/if \(toMicron\(this\.sim\.stopBeyond\) === toMicron\(this\.real\.stopBeyond\)\) return salvata;\s*return toMicron\(this\.real\.viceClaw\);/.test(ps),
	'   battuta del database: la chela con cui e\' stata dichiarata; battuta in prova: le chele montate adesso (setStop scrive quelle)');
check(/t\("viceJaw\.mounted", \{ code: jawCode \|\| t\("viceJaw\.none"\) \}\)/.test(ps), '   riga «Chele montate» sotto la scelta della morsa');
check(/String\(body\)\.trim\(\) === KO_NO_JAW \|\| String\(body\)\.trim\(\) === KO_JAW_ACTIVE_ORDER/.test(ps) && /this\.t\("viceJaw\." \+ String\(body\)\.trim\(\)\)/.test(ps),
	'   rifiuti del catalogo mostrati col loro testo');
const vv = readFileSync('src/views/conf/Vice/Vice.vue', 'utf8');
check(/\$t\("viceJaw\.mounted"/.test(vv) && /data-jaw/.test(vv), 'form morsa: riga «Chele montate»');
check((vv.match(/if \(this\.rifiutoChele\(body\)\) return;/g) || []).length === 2 && /if \(b !== KO_NO_JAW && b !== KO_JAW_ACTIVE_ORDER\) return false;/.test(vv),
	'form morsa: crea e salva leggono il corpo della risposta; KO_NO_JAW e KO_JAW_ACTIVE_ORDER restano sulla pagina col messaggio');
const ld = readFileSync('src/views/workOrder/lastData.vue', 'utf8');
check(/clawLengthRef: this\.pieceStopRef,/.test(ld) && /this\.pieceStopRef = row && row\.CLAW_LENGTH_REF != null \? Number\(row\.CLAW_LENGTH_REF\) : null;/.test(ld),
	'wizard: il controllo della spinta usa la battuta corretta, come la vista e il backend');
// la stessa formula del backend (test di parita' in serverDati/test_vice_jaw.js)
check(stopCorrected(25000, 150000, 107200) === 46400 && pushQuotes({ enabled: true, hasVice: true, xPlace: 0, pieceY: 180000, viceClawLength: 107200, gripperClawLength: 42000, stopBeyondClaw: 25000, clawLengthRef: 150000 }).clearance === 10000,
	'pushQuotes del pannello: battuta 25000 dichiarata con chele da 150000, montate da 107200 -> 46400, corsa 10000 (riferimento sulla morsa invariato)');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
