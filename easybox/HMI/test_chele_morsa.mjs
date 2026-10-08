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
//      (clawLengthRef) negli stessi calcoli della vista;
//   4. (8/10, prompt 8) la battuta si MOSTRA e si SALVA corretta per le chele
//      montate (riferimento = tipo montato): salvarla non sposta X_Support, e
//      portarla da 25 a 25,5 mm sposta l'arrivo di 0,5; Attrezzaggi non manda
//      piu' le misure delle chele e mostra i rifiuti; la morsa nuova prende
//      l'ID dal backend; Play e rilancio rifiutati per le chele, col testo.
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
const MORSA = /^(viceJaw\.|vice\.|pushSim\.(fViceClaw|fZClaw|fStopBeyond|compNoRow|stopMissing|stopFromOtherJaw|confirmVice|confirmZClaw|confirmZSink|confirmStop|restsOnClaw|restsOnDeclared|reason\.NO_DATA|reason\.NO_FIT|reason\.NO_ROOM)$|wizard\.lastData\.pushNo(Data|Fit)$|robot\.alarm_799$|production\.(playRefused_|relaunch\.)KO_ORDER_(VICE_NO_JAW|JAW_MISMATCH)$)/;
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
// (8/10, prompt 8) il 799 torna neutro: la vista non nasconde piu' righe per
// le chele (il controllo e' al Play)
check(it.robot.alarm_799 === "Deposito in macchina fermato: nessuna quota per questo ordine. Controlla pezzo e attrezzatura dell'ordine. Poi RESET."
	&& en.robot.alarm_799 === "Machine deposit stopped: no coordinates for this order. Check the order's part and fixture. Then RESET.", '799: il testo neutro di Dario, in it ed en');
for (const k of ['KO_ORDER_VICE_NO_JAW', 'KO_ORDER_JAW_MISMATCH'])
	check(E[k] === k && /\{id\}/.test(it.production['playRefused_' + k]) && /\{id\}/.test(en.production['playRefused_' + k]) && it.production.relaunch[k] && en.production.relaunch[k],
		k + ': codice nel pannello, testo del Play (con l\'ordine) e del rilancio, in it ed en');
check(/\{code\}/.test(it.production.playRefusedOther) && /\{code\}/.test(en.production.playRefusedOther) && /\{code\}/.test(it.attrezzaggi.unmountRefused) && /\{code\}/.test(en.attrezzaggi.unmountRefused)
	&& /\{id\}/.test(it.vice.created) && /\{id\}/.test(en.vice.created) && it.vice.createFailed && en.vice.createFailed && /\{code\}/.test(it.pushSim.stopFromOtherJaw) && /\{code\}/.test(en.pushSim.stopFromOtherJaw),
	'testi nuovi: altri rifiuti del Play, smontaggio rifiutato, morsa creata (con l\'ID), appoggio dichiarato con altre chele');

console.log('\n3) pannello: tipo montato e battuta corretta');
const ps = readFileSync('src/views/sim/PushSim.vue', 'utf8');
check((ps.match(/clawLengthRef: this\.stopRefSim,/g) || []).length === 2, 'Spinta in battuta: la battuta corretta nei due calcoli (esito e corsa)');
// (8/10, prompt 8) il campo e' riferito alle chele MONTATE: si carica
// corretto, disegno e testi usano la battuta corretta per la chela in prova
check(/stopRefSim\(\) \{\s*return toMicron\(this\.real\.viceClaw\);\s*\}/.test(ps), '   il riferimento del campo e\' sempre la lunghezza delle chele montate (setStop salva col tipo montato)');
check(/this\.real\.stopBeyond = row\s*\? stopCorrected\(Number\(row\.STOP_BEYOND_CLAW\), row\.REF_CLAW_LENGTH, toMicron\(this\.real\.viceClaw\)\) \/ 1000/.test(ps),
	'   il campo si carica con la battuta CORRETTA per le chele montate (riferimento: il tipo con cui e\' stata dichiarata)');
check(/stopDeclared\(\) \{\s*return stopCorrected\(this\.m\.stopBeyond, this\.stopRefSim, this\.m\.viceClaw\);/.test(ps)
	&& /:x1="stopX"/.test(ps) && /mm\(stopDeclared\)/.test(ps) && /stop: this\.stopDeclared === null/.test(ps),
	'   disegno, «appoggia a...» e NO_ROOM usano la battuta corretta (stopDeclared), non il numero grezzo');
check(/t\("pushSim\.stopFromOtherJaw", \{ code: stopFromOtherJaw \}\)/.test(ps) && /r\.CLAW_JAW_REF == r\.MOUNTED_JAW_ID/.test(ps), '   se la battuta e\' stata dichiarata con un altro tipo, lo dice');
check(/t\("viceJaw\.mounted", \{ code: jawCode \|\| t\("viceJaw\.none"\) \}\)/.test(ps), '   riga «Chele montate» sotto la scelta della morsa');
check(/String\(body\)\.trim\(\) === KO_NO_JAW \|\| String\(body\)\.trim\(\) === KO_JAW_ACTIVE_ORDER/.test(ps) && /this\.t\("viceJaw\." \+ String\(body\)\.trim\(\)\)/.test(ps),
	'   rifiuti del catalogo mostrati col loro testo');
const vv = readFileSync('src/views/conf/Vice/Vice.vue', 'utf8');
check(/\$t\("viceJaw\.mounted"/.test(vv) && /data-jaw/.test(vv), 'form morsa: riga «Chele montate»');
check((vv.match(/if \(this\.rifiutoChele\(body\)\) return;/g) || []).length === 2 && /if \(b !== KO_NO_JAW && b !== KO_JAW_ACTIVE_ORDER\) return false;/.test(vv),
	'form morsa: crea e salva leggono il corpo della risposta; KO_NO_JAW e KO_JAW_ACTIVE_ORDER restano sulla pagina col messaggio');
const ld = readFileSync('src/views/workOrder/lastData.vue', 'utf8');
check(/clawLengthRef: this\.pieceStopRef,/.test(ld) && /this\.pieceStopRef = row && row\.REF_CLAW_LENGTH != null \? Number\(row\.REF_CLAW_LENGTH\) : null;/.test(ld),
	'wizard: il controllo della spinta usa la battuta corretta (lunghezza del tipo di riferimento), come la vista e il backend');
check(/const battuta = \(st\) => stopCorrected\(Number\(st\.STOP_BEYOND_CLAW\), st\.REF_CLAW_LENGTH, claw\) \/ 1000;/.test(vv) && (vv.match(/value: (st \? )?battuta\(st\)/g) || []).length === 2,
	'form morsa: le battute si mostrano (e si salvano) corrette per le chele montate, come in Spinta in battuta');
// la stessa formula del backend (test di parita' in serverDati/test_vice_jaw.js)
check(stopCorrected(25000, 150000, 107200) === 46400 && pushQuotes({ enabled: true, hasVice: true, xPlace: 0, pieceY: 180000, viceClawLength: 107200, gripperClawLength: 42000, stopBeyondClaw: 25000, clawLengthRef: 150000 }).clearance === 10000,
	'pushQuotes del pannello: battuta 25000 dichiarata con chele da 150000, montate da 107200 -> 46400, corsa 10000 (riferimento sulla morsa invariato)');

console.log('\n4) battuta salvata, Attrezzaggi, morsa nuova, Play');
// numeri inventati: battuta dichiarata con chele A, montate chele B
const tr = v => Math.trunc(v / 2);
let fermo = true, mezzo = true, n = 0, nOk = 0;
for (const A of [98765, 98766, 123457])
	for (const B of [86421, 86422, 140001])
		for (const d of [0, 777, 24680]) {
			const mostrata = stopCorrected(d, A, B);
			// salvata com'e' col tipo montato come riferimento: la vista la corregge per B su B
			if (stopCorrected(mostrata, B, B) !== mostrata || tr(B) + mostrata !== tr(A) + d) fermo = false;
			// il caso dell'audit: +0,5 mm nel campo = +0,5 mm all'arrivo, non 20,9
			const q = (stop, ref) => pushQuotes({ enabled: true, hasVice: true, xPlace: 300000, pieceY: B + 60000, viceClawLength: B, gripperClawLength: 12345, stopBeyondClaw: stop, clawLengthRef: ref });
			const prima = q(d, A), dopo = q(mostrata + 500, B);
			if (prima.status === 'OK') { nOk++; if (dopo.xStop - prima.xStop !== 500) mezzo = false; }
			n++;
		}
check(fermo, 'salvare la battuta mostrata (riferimento = tipo montato) lascia X_Support dov\'era, al micron (' + n + ' casi, lunghezze pari e dispari)');
check(mezzo && nOk > 5, 'portare la battuta mostrata a +0,5 mm sposta l\'arrivo di 0,5 mm esatti (' + nOk + ' casi con la spinta possibile)');
const av = readFileSync('src/views/conf/AttrezzaggiView.vue', 'utf8'), at = readFileSync('src/views/conf/Attrezzaggio.vue', 'utf8');
const sm = av.slice(av.indexOf('unmountVice(viceID){'), av.indexOf('unmountRefused(code){'));
const bp = at.slice(at.indexOf('buildViceParams(v, palletIdValue){'), at.indexOf('apiWrite(url){'));
check(sm && bp && !/Z_CLAW|Z_SINK_CLAW|CLAW_LENGTH/.test(sm) && !/Z_CLAW|Z_SINK_CLAW|CLAW_LENGTH/.test(bp), 'Attrezzaggi: monta e smonta senza le misure delle chele (stanno sul tipo, lette all\'apertura possono essere vecchie)');
check(/return r\.text\(\);/.test(sm) && /if \(b\.indexOf\('KO'\) === 0\) this\.unmountRefused\(b\);/.test(sm) && /this\.\$te\(k\) \? this\.\$t\(k\) : this\.\$t\('attrezzaggi\.unmountRefused'/.test(av),
	'   smonta morsa: legge il corpo della risposta e mostra il rifiuto (prima guardava solo r.ok)');
const crea = vv.slice(vv.indexOf('if (this.create) {', vv.indexOf('saveData() {')), vv.indexOf('// AF + TRAPPOLA PASS-THROUGH'));
check(crea && !/ID: this\.vice\.ID/.test(crea) && /const id = this\.idCreato\(body\);/.test(crea) && /"newVice=" \+ id/.test(crea) && /this\.\$t\("vice\.created", \{ id \}\)/.test(crea),
	'morsa nuova: niente ID mandato (VICE.ID e\' IDENTITY), usa l\'ID restituito (messaggio e ritorno ad Attrezzaggio)');
check(/const nuova = parseInt\(this\.\$route\.query\.newVice\) \|\| 0;/.test(at) && /this\.viceID = nuova;/.test(at), '   Attrezzaggio propone gia\' scelta la morsa appena creata');
const pt = readFileSync('src/components/productionTable.vue', 'utf8'), rd = readFileSync('src/components/RelaunchDialog.vue', 'utf8');
check(/socket\.on\('ORDER\/REJECTED', this\.orderRejectedHandler\)/.test(pt) && /socket\.off\('ORDER\/REJECTED', this\.orderRejectedHandler\)/.test(pt) && /'production\.playRefused_' \+ code/.test(pt),
	'Produzione: il rifiuto del Play arriva (ORDER/REJECTED) e si mostra col suo testo');
check(/\[KO_ORDER_VICE_NO_JAW\]: 'production\.relaunch\.' \+ KO_ORDER_VICE_NO_JAW/.test(rd) && /\[KO_ORDER_JAW_MISMATCH\]: 'production\.relaunch\.' \+ KO_ORDER_JAW_MISMATCH/.test(rd),
	'rilancio: i due rifiuti delle chele col loro testo (anteprima e conferma)');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
