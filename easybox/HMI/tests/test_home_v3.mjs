// ============================================================================
// tests/test_home_v3.mjs — Home del pannello v3 (fase B)
//
// La Home nuova sostituisce units.vue + productionTable sulla Dashboard. Qui:
//   1. "Ferma ordine" manda ESATTAMENTE lo stop della tabella ordini (stesso
//      topic, stesso payload, per lo stesso ordine), e la Home non manda
//      nessun altro comando;
//   2. niente "Pausa" (non esiste un comando di pausa dell'ordine) e niente
//      trascinamento della coda;
//   3. le tile portano alle stesse pagine delle card di prima (units.vue);
//   4. i comandi degli ordini tolti dalla Home restano nella Produzione;
//   5. lo store della shell tiene viva l'eco della velocita' e non invia.
// Legge la mappa golden (tests/golden/comandi.json) e i sorgenti.
//
// Uso: node tests/test_home_v3.mjs   (dalla cartella easybox/HMI)
// ============================================================================
import { readFileSync } from 'node:fs';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const g = JSON.parse(readFileSync('tests/golden/comandi.json', 'utf8'));
const home = g.pagine.DashboardView, tab = g.pagine.productionTable;
const righe = e => (Array.isArray(e) ? e : [e]).filter(r => r && typeof r === 'object');
const comandi = (p, s) => p.controlli.flatMap(c => righe(c.esiti[s]).flatMap(r => r.effetti.filter(x => /^(emit|fetch) /.test(x))));

console.log('1) "Ferma ordine" = stop della tabella ordini');
const S = 'tre ordini, 102 in lavoro';
const ferma = home.controlli.find(c => /modifyOrderStatus\(ordineInCorso\.ID,dataStored\.status_raw,ordineInCorso\.PIECE_ID\)/.test(c.handler));
const fermaEff = ferma ? righe(ferma.esiti[S]).flatMap(r => r.effetti) : [];
const stopTab = tab.controlli.find(c => c.evento === 'cmdStop');
const stopTabEff = stopTab ? righe(stopTab.esiti['tre ordini liv2']).flatMap(r => r.effetti).filter(x => /"id":102/.test(x)) : [];
check(fermaEff.length === 1 && stopTabEff.length === 1 && fermaEff[0] === stopTabEff[0], 'stesso emit per l\'ordine 102: ' + fermaEff[0] + ' == ' + stopTabEff[0]);
check(righe(ferma.esiti[S]).every(r => r.abilitato === true) && righe(stopTab.esiti['tre ordini liv2']).every(r => r.abilitato === true), 'abilitato come lo stop della tabella (sempre)');
check(!righe(ferma.esiti[S]).some(r => r.conferme), 'senza conferma, come lo stop della tabella');
const tutti = new Set(home.scenari.flatMap(s => comandi(home, s)));
check(tutti.size === 1 && [...tutti][0] === fermaEff[0], 'la Home non manda nessun altro comando (' + [...tutti].join(' | ') + ')');
check(ferma.esiti['nessun ordine in corso'] === 'nascosto' && ferma.esiti.base === 'nascosto', 'senza ordine in corso il pulsante non c\'e\'');

console.log('\n2) niente Pausa, niente trascinamento');
const src = readFileSync('src/views/DashboardView.vue', 'utf8');
const tpl = src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '');
check(!/cmdPause|status_paused|[Pp]ausa/.test(tpl), 'nessun pulsante Pausa (non esiste un comando di pausa dell\'ordine)');
check(!/draggable|@drag|GripVertical|GripHorizontal|drag-handle/i.test(tpl), 'nessuna maniglia di trascinamento nella coda');
check(!/ciclo|stimat|grezzi disponibili|%\s*<\/|04:12/i.test(tpl), 'nessun dato senza fonte (ciclo medio, fine stimata, grezzi, tempo MC1)');

console.log('\n3) le tile portano dove portavano le card');
const dest = p => new Set(p.controlli.flatMap(c => Object.values(c.esiti).flatMap(righe).flatMap(r => r.effetti.filter(x => /^router /.test(x)))));
const prima = dest(g.pagine.units);
const ora = new Set([...dest(home)].concat(/'\/unit\/cnc2'/.test(tpl) ? ['router "/unit/cnc2"'] : []));
for (const d of prima) check(ora.has(d), d);
check(/v-if="isMachineConfigured\(1\)"[^>]*@click="\$router\.push\('\/unit\/cnc1'\);"/.test(tpl) && /v-if="isMachineConfigured\(2\)"[^>]*@click="\$router\.push\('\/unit\/cnc2'\);"/.test(tpl), 'MC1 / MC2 solo se configurate, come prima');

console.log('\n4) i comandi degli ordini restano nella Produzione');
const prod = readFileSync('src/views/productionView.vue', 'utf8');
check(/import prodtable from '\.\.\/components\/productionTable\.vue'/.test(prod) && /<prodtable><\/prodtable>/.test(prod), 'productionView usa ancora la tabella ordini (avvia, ferma, elimina, rilancia)');
for (const ev of ['cmdPlay', 'cmdStop', 'cmdDel']) check(tab.controlli.some(c => c.evento === ev), 'tabella ordini: ' + ev);
check(tab.controlli.some(c => c.handler === 'relaunchOrder = o'), 'tabella ordini: rilancia');

console.log('\n5) eco della velocita\' nello store della shell');
const store = readFileSync('src/stores/plantStatus.js', 'utf8');
const codiceStore = store.split('\n').filter(r => !r.trim().startsWith('//')).join('\n');
check(/'ROBOT\/CHANGESPEED': p => \{ dataStored\.robotSpeed = p; \}/.test(codiceStore), 'lo store ascolta ROBOT/CHANGESPEED e aggiorna dataStored.robotSpeed');
check(!/\.emit\(\s*'TO_PLANT/.test(codiceStore), 'e non manda comandi');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
