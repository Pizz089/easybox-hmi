// ============================================================================
// test_hold_guard.mjs — antirimbalzo del pulsante HOLD (verso definitivo
// 2.1, fase E1.3, 7/10)
//
// Il 17 e' un interruttore nel PLC: due tocchi ravvicinati rimettono in
// moto la cella. Dopo un tocco il pulsante resta spento; (8/10, prompt 7) si
// riaccende al piu' tardi fra «cambio di STATUS + 1 s» e «tocco + 1,5 s»; un
// passaggio a ignoto o a 0 non chiude l'attesa; senza cambio in 5 s, avviso
// «HOLD non confermato dal PLC».
//   1. util/holdGuard.js con un orologio finto (util/orologio.js);
//   1-bis. un PLC finto che inverte HOLD a ogni 17, col suo ritardo d'eco:
//      doppio tocco a 300 ms con eco a 100 ms -> un solo 17;
//   2. la striscia: il 17 passa dall'antirimbalzo, il pulsante si spegne.
//
// Uso:   node test_hold_guard.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
import { readFileSync } from 'node:fs';
import { createHoldGuard, HOLD_CONFIRM_MS, RIARMO_MIN_MS, RIARMO_DOPO_CAMBIO_MS, statoRisposta } from './src/util/holdGuard.js';
import { orologioFinto } from './src/util/orologio.js';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

console.log('1) util/holdGuard.js');
check(HOLD_CONFIRM_MS === 5000 && RIARMO_MIN_MS === 1500 && RIARMO_DOPO_CAMBIO_MS === 1000, 'attesa massima 5 s; riarmo al piu\' tardi fra cambio + 1 s e tocco + 1,5 s');
let o = orologioFinto();
const finto = () => ({ setTimer: o.setTimeout, clearTimer: o.clearTimeout });
let stato = 10, inviati = 0, avvisi = 0;
let g = createHoldGuard(Object.assign({ stato: () => stato, avvisa: () => avvisi++ }, finto()));
check(g.attesa === false, 'all\'inizio il pulsante e\' acceso');
check(g.premi(() => inviati++) === true && inviati === 1 && g.attesa === true, 'primo tocco: parte il 17, il pulsante si spegne');
check(g.premi(() => inviati++) === false && inviati === 1, 'secondo tocco subito dopo: NON parte (il PLC rimetterebbe in moto la cella)');
o.avanza(200); stato = 17; g.stato(17);
check(g.attesa === true, 'STATUS cambia a 200 ms (HOLD): ancora spento');
o.avanza(1299);
check(g.attesa === true, '   a 1499 ms ancora spento (tocco + 1,5 s)');
o.avanza(1);
check(g.attesa === false && avvisi === 0 && o.attivi() === 0, '   a 1500 ms si riaccende, nessun avviso, nessun timer appeso');
check(g.premi(() => inviati++) === true && inviati === 2, 'si puo\' premere di nuovo (Riprendi)');
o.avanza(1400); stato = 10; g.stato(10);
o.avanza(999);
check(g.attesa === true, 'STATUS cambia a 1,4 s dal tocco: a 2,399 s ancora spento (cambio + 1 s)');
o.avanza(1);
check(g.attesa === false, '   a 2,4 s si riaccende');
g.premi(() => inviati++);
g.stato(10);
check(g.attesa === true, 'uno STATUS uguale a quello di prima non conta');
g.stato(0); g.stato(null); g.stato('');
o.avanza(2000);
check(g.attesa === true, 'un passaggio a NOT_DEFINED (0) o a stato ignoto non chiude l\'attesa');
o.avanza(3000);
check(g.attesa === false && avvisi === 1, 'nessun cambio valido in 5 s: pulsante riacceso e avviso «HOLD non confermato dal PLC»');
stato = 10;
g.premi(() => inviati++); stato = 17; o.avanza(5000);
check(avvisi === 1 && g.attesa === false, 'lo STATUS era gia\' cambiato alla scadenza (evento perso): nessun avviso');
g.premi(() => inviati++); g.annulla();
check(g.attesa === false && o.attivi() === 0, 'annulla (striscia smontata): niente timer appesi');
g = createHoldGuard(Object.assign({ stato: () => null, avvisa: () => avvisi++ }, finto()));
g.premi(() => {}); g.stato(17); o.avanza(1500);
check(g.attesa === false, 'da stato non noto, il primo STATUS valido chiude l\'attesa (con i tempi di riarmo)');
check(statoRisposta(17) && statoRisposta('3') && !statoRisposta(0) && !statoRisposta('0') && !statoRisposta(null) && !statoRisposta('') && !statoRisposta('x'), 'statoRisposta: noto e diverso da 0');

console.log('\n1-bis) un PLC finto: il 17 inverte HOLD, l\'eco arriva dopo il ritardo scelto');
// tocchi agli istanti dati (ms); torna quanti 17 sono partiti e lo stato finale
function prova(eco, tocchi, stato0 = 3) {
	o = orologioFinto();
	let robot = stato0, mandati = 0, t = 0;
	const gg = createHoldGuard(Object.assign({ stato: () => robot, avvisa: () => {} }, finto()));
	const plc = () => { mandati++; o.setTimeout(() => { robot = robot === 17 ? 3 : 17; gg.stato(robot); }, eco); };
	for (const quando of tocchi) { o.avanza(quando - t); t = quando; gg.premi(plc); }
	o.avanza(6000);
	return { mandati, robot, attesa: gg.attesa };
}
let p = prova(100, [0, 300]);
check(p.mandati === 1 && p.robot === 17, 'doppio tocco a 300 ms, eco a 100 ms: UN solo 17, la cella resta in HOLD (prima: due 17, cella in moto)');
p = prova(200, [0, 300]);
check(p.mandati === 1 && p.robot === 17, 'doppio tocco a 300 ms, eco a 200 ms: un solo 17');
p = prova(400, [0, 300]);
check(p.mandati === 1 && p.robot === 17, 'doppio tocco a 300 ms, eco a 400 ms: un solo 17');
p = prova(100, [0, 1499]);
check(p.mandati === 1, 'secondo tocco a 1,499 s, eco a 100 ms: non parte (tocco + 1,5 s)');
p = prova(1200, [0, 2100]);
check(p.mandati === 1, 'eco a 1,2 s, secondo tocco a 2,1 s: non parte (cambio + 1 s = 2,2 s)');
p = prova(100, [0, 1600]);
check(p.mandati === 2 && p.robot === 3 && p.attesa === false, 'secondo tocco a 1,6 s con eco a 100 ms: parte, e Riprendi rimette in moto (voluto)');

console.log('\n2) la striscia');
const ss = readFileSync('src/layout/v3/StatusStrip.vue', 'utf8');
check(/const premi = \(\) => \{ holdGuard\.premi\(\(\) => sendToRobot\(17\)\); \};/.test(ss), 'il 17 parte solo da holdGuard.premi');
check((ss.match(/@click="premi"/g) || []).length === 2 && !/@click="sendToRobot\(17\)"/.test(ss), 'HOLD/Riprendi e START usano premi, nessun 17 diretto');
check(/:disabled="ignoto \|\| holdGuard\.attesa"/.test(ss) && /:disabled="holdGuard\.attesa"/.test(ss), 'spento a stato ignoto e durante l\'attesa');
check(/watch\(\(\) => plant\.robot, v => holdGuard\.stato\(v\)\)/.test(ss), 'ogni STATUS del robot arriva all\'antirimbalzo');
check(/desc = 'cmd\.holdNotConfirmed'/.test(ss), 'avviso con la chiave cmd.holdNotConfirmed');
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
check(/^HOLD non confermato dal PLC/.test(it.cmd.holdNotConfirmed) && /^HOLD not confirmed by the PLC/.test(en.cmd.holdNotConfirmed), 'testo «HOLD non confermato dal PLC» (it, en)');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
