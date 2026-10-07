// ============================================================================
// test_hold_guard.mjs — antirimbalzo del pulsante HOLD (verso definitivo
// 2.1, fase E1.3, 7/10)
//
// Il 17 e' un interruttore nel PLC: due tocchi ravvicinati rimettono in
// moto la cella. Dopo un tocco il pulsante resta spento finche' STATUS del
// robot non cambia, o al massimo 5 s; senza cambio, avviso «HOLD non
// confermato dal PLC».
//   1. util/holdGuard.js con un orologio finto;
//   2. la striscia: il 17 passa dall'antirimbalzo, il pulsante si spegne.
//
// Uso:   node test_hold_guard.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
import { readFileSync } from 'node:fs';
import { createHoldGuard, HOLD_CONFIRM_MS } from './src/util/holdGuard.js';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// orologio finto: i timer partono a mano
let timers = [];
const setTimer = (f, ms) => { const t = { f, ms }; timers.push(t); return t; };
const clearTimer = t => { timers = timers.filter(x => x !== t); };
const scade = () => { const t = timers.shift(); if (t) t.f(); };

console.log('1) util/holdGuard.js');
check(HOLD_CONFIRM_MS === 5000, 'attesa massima 5 s');
let stato = 10, inviati = 0, avvisi = 0;
let g = createHoldGuard({ stato: () => stato, avvisa: () => avvisi++, setTimer, clearTimer });
check(g.attesa === false, 'all\'inizio il pulsante e\' acceso');
check(g.premi(() => inviati++) === true && inviati === 1 && g.attesa === true, 'primo tocco: parte il 17, il pulsante si spegne');
check(g.premi(() => inviati++) === false && inviati === 1, 'secondo tocco subito dopo: NON parte (il PLC rimetterebbe in moto la cella)');
check(timers.length === 1 && timers[0].ms === 5000, 'attesa di 5 s armata');
stato = 17; g.stato(17);
check(g.attesa === false && timers.length === 0 && avvisi === 0, 'STATUS cambia (HOLD): pulsante di nuovo acceso, nessun avviso');
check(g.premi(() => inviati++) === true && inviati === 2, 'si puo\' premere di nuovo (Riprendi)');
g.stato(17);
check(g.attesa === true, 'uno STATUS uguale a quello di prima non conta');
scade();
check(g.attesa === false && avvisi === 1, 'nessun cambio in 5 s: pulsante riacceso e avviso «HOLD non confermato dal PLC»');
stato = 10;
g.premi(() => inviati++); stato = 17; scade();
check(avvisi === 1 && g.attesa === false, 'lo STATUS era gia\' cambiato alla scadenza (evento perso): nessun avviso');
g.premi(() => inviati++); g.annulla();
check(g.attesa === false && timers.length === 0, 'annulla (striscia smontata): niente timer appesi');
g = createHoldGuard({ stato: () => null, avvisa: () => avvisi++, setTimer, clearTimer });
g.premi(() => {}); g.stato(17);
check(g.attesa === false, 'da stato non noto, il primo STATUS che arriva chiude l\'attesa');

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
