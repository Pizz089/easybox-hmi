// ============================================================================
// test_tray_dup_guard.mjs — difese contro i SUB_POS duplicati (4/9):
//  - layoutView mappa per SUB_POS reale (etichette, chiavi, Save!), dedup
//    difensivo con segnalazione se il DB porta doppioni;
//  - Grating.vue: flag `saving` anti doppio-tap (innesco dei duplicati) e
//    avviso FORTE se le tasche a DB sono tarate con passi diversi da quelli
//    che la rigenerazione produrrebbe (rischio collisione).
// Componenti REALI via Vite ssrLoadModule.
//
// Uso:   node test_tray_dup_guard.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const layoutView = (await server.ssrLoadModule('/src/views/layoutView.vue')).default;
// (stato cella 16/9) il disegno e' uscito da layoutView in un componente
// condiviso col dialog robot: le tasche deduplicate devono arrivare LI'
const Grid = (await server.ssrLoadModule('/src/components/layout/TrayPockets.vue')).default;
const Grating = (await server.ssrLoadModule('/src/views/conf/Grating/Grating.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = () => new Promise(r => setTimeout(r, 20));
function vmOf(comp, extra) {
	const vm = Object.assign({}, comp.data.call({}), extra || {});
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k, p) => k + (p ? ' ' + Object.entries(p).map(([a, b]) => a + '=' + b).join(',') : '');
	return vm;
}

// righe layout come le manda ora l'endpoint (con SUB_POS): TRAY_12 reale
// (7 colonne X passo 82, 13 righe Y passo 61) + 2 DUPLICATI (SUB_POS 5 e 40)
const rows = [];
for (let i = 0; i < 91; i++) {
	const col = Math.floor(i / 13), r = i % 13;
	rows.push({ partType: 1030, prisma: 1, x: (50000 + 82000 * col) / 1000, y: (-65000 + 61000 * r) / 1000, status: 2, order_ID: 0, FLOOR_MAG: 12, SUB_POS: i + 1 });
}
const withDups = [];
for (const r of rows) {
	withDups.push(r);
	if (r.SUB_POS === 5 || r.SUB_POS === 40) withDups.push(Object.assign({}, r, { status: 4 }));
}

console.log('1) layoutView: dedup difensivo per SUB_POS + segnalazione');
const calls = [];
globalThis.fetch = async (url) => { calls.push(String(url).replace(dataStored.server, '')); return { ok: true, json: async () => withDups, text: async () => '' }; };
dataStored.alert = { title: '', desc: '', type: '' };
const lv = vmOf(layoutView, { $route: { params: { trayID: 24, floorMag: 12, modifyEnable: 1 } } });
lv.getDataTable(); await tick();
check(withDups.length === 93 && lv.listPz.length === 91, '93 righe (2 doppioni) dal backend -> 91 tasche in griglia');
check(lv.listPz.every((p, i) => p.SUB_POS === i + 1), 'tenuta la PRIMA riga di ogni SUB_POS, sequenza 1..91 integra');
check(String(dataStored.alert.desc).includes('layout.dupRows') && String(dataStored.alert.desc).includes('n=2'), 'anomalia SEGNALATA a video (2 doppioni), non disegnata in silenzio');
// il componente e' di sole props: niente data() da chiamare
const grid = { pockets: lv.listPz, dimX: 40, dimY: 70, radius: 20 };
for (const [k, c] of Object.entries(Grid.computed || {}))
	Object.defineProperty(grid, k, { get: () => (typeof c === 'function' ? c.call(grid) : c.get.call(grid)) });
check(grid.drawPz.length === 91, 'drawPz: 91 tasche');

console.log('\n2) layoutView: Save! scrive il SUB_POS REALE, non l\'indice');
lv.listPz = rows.filter(p => p.SUB_POS !== 3);   // buco: manca la 3
calls.length = 0;
lv.saveAllData(); await tick();
const saves = calls.filter(u => u.includes('updatePositionStatus'));
check(saves.length === 90, '90 scritture per 90 righe');
check(saves.some(u => u.includes('/12/4/')) && !saves.some(u => u.includes('/12/3/')), 'col buco sulla 3: si scrive la 4 (SUB_POS reale), MAI la 3');
check(!saves.some(u => u.includes('/12/91/')) === false || saves.some(u => u.includes('/12/91/')), 'l\'ultima scrittura arriva al SUB_POS 91 (non si ferma a 90)');
// le etichette si disegnano nel componente, insieme al resto del disegno
const tpl = readFileSync('src/components/layout/TrayPockets.vue', 'utf8');
check(/p\.SUB_POS != null \? p\.SUB_POS : index\+1/.test(tpl), 'etichette tasca = SUB_POS reale (fallback indice solo senza campo)');
// e il click esce col SUB_POS reale: il dialog robot ci manda il 39
check(/subPos: p && p\.SUB_POS != null \? p\.SUB_POS : index \+ 1/.test(tpl), 'e il click porta fuori il SUB_POS reale, non l\'indice');

console.log('\n3) Grating: flag saving anti doppio-tap');
globalThis.fetch = async () => ({ ok: true, json: async () => [], text: async () => 'OK' });
const g = vmOf(Grating, { $route: { params: { grating_ID: 0 } } });
check(g.saving === false, 'saving parte falso');
g.saving = true;
let gridFitCalls = 0;
g.checkGridFit = () => { gridFitCalls++; return true; };
await g.saveData();
check(gridFitCalls === 0, 'con un salvataggio in volo il secondo saveData esce SUBITO (niente delete-then-insert sovrapposto)');
const gsrc = readFileSync('src/views/conf/Grating/Grating.vue', 'utf8');
check(/\|\| saving">/.test(gsrc), 'bottone Salva disabilitato durante il salvataggio');
check(/finally \{\s*this\.saving = false;/.test(gsrc), 'il flag si abbassa SEMPRE (finally), anche su errore');

console.log('\n4) avviso taratura (grating-model: util gratingGrid + "Rigenera tasche" in TraysView)');
// (grating-model) "Salva" del grigliato NON rigenera piu' nulla: l'avviso
// taratura vive nel dialog "Rigenera tasche" della gestione cassetti, sul
// confronto passi reali (righe [POSITION]) / passi teorici (pezzo+distanza).
const { taughtMismatch } = await server.ssrLoadModule('/src/util/gratingGrid.js');
// righe DB del cassetto 12: passi REALI 61000 (Y, SUB_POS consecutive) e 82000 (X)
const dbRows = rows.map(r => ({ PARENT: 'TRAY_12', SUB_POS: r.SUB_POS, X: r.x * 1000, Y: r.y * 1000, STATUS: 2, Order_ID: 0 }));
let mm = taughtMismatch(dbRows, 60000, 80000);   // pezzo 40x70 + SAFEX 20 / SAFEY 10
check(mm && mm.realW === 61000 && mm.realH === 82000 && mm.genW === 60000 && mm.genH === 80000, 'passi 61/82 vs 60/80: avviso con passi reali e teorici');
check(taughtMismatch(dbRows, 61000, 82000) === null, 'passi coincidenti (40+21 / 70+12): nessun avviso');
check(taughtMismatch(dbRows, 61400, 82400) === null, 'entro la tolleranza di 0.5 mm: nessun avviso');
const gsrc2 = readFileSync('src/views/conf/Grating/Grating.vue', 'utf8');
check(!/insertPositionTray|deletePositionsTray|updateGratingInTray|confirmRegenerate/.test(gsrc2), 'Grating.vue: "Salva" non tocca tasche ne\' cassetti (nessuna chiamata di scrittura tasche)');
const tsrc = readFileSync('src/views/conf/TraysView.vue', 'utf8');
check(/taughtMismatch\(this\.pocketsOf\(a\.floor\), genW, genH\)/.test(tsrc) && /a\.mismatch && !a\.ack/.test(tsrc), 'TraysView "Rigenera": avviso taratura calcolato e conferma bloccata senza spunta esplicita');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
