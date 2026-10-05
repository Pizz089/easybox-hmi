// ============================================================================
// test_tray_number.mjs — il cassetto si identifica col suo NUMERO (5/10)
//
// Il numero del cassetto e' FLOOR_MAG, lo stesso che il PLC usa in
// ExtractedTray. Non e' l'ID della tabella TRAY: dopo il reinserimento dei
// piani 9-11 gli ID (30, 23, 13) non corrispondono piu' al numero. Si
// verifica che pagina layout e scheda cassetto mostrino il numero, che l'ID
// del database resti solo come tooltip, che le frecce e i loro testi parlino
// di "cassetto" e non di "piano", e che la scheda "nuovo cassetto" non offra
// piu' un salvataggio che finirebbe nel 403 di insertTray (P1).
//
// Uso:   node test_tray_number.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const trayComp = (await server.ssrLoadModule('/src/views/conf/Tray/Tray.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const noComments = s => s.replace(/<!--[\s\S]*?-->/g, '');
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

console.log('1) pagina layout: titolo col numero, ID del database solo come tooltip');
const layout = readFileSync('src/views/layoutView.vue', 'utf8');
const ltpl = noComments(layout.slice(0, layout.lastIndexOf('</template>')));
check(/<h2 class="layout-title view-title" :title="\$t\('tray\.dbId', \{ id: \$route\.params\.trayID \}\)">LAYOUT \{\{ \$t\('TRAY'\) \}\} \{\{ \$route\.params\.floorMag \}\}<\/h2>/.test(ltpl), 'titolo "LAYOUT Cassetto <floorMag>", tooltip "ID database <trayID>"');
check(!/ID\{\{\s*\$route\.params\.trayID/.test(ltpl) && !/\$t\('piano'\)/.test(ltpl), 'niente piu\' "ID<trayID>" ne\' "piano" nel template');
check(/\{\{ \$t\('TRAY'\) \}\} \{\{ neighbors\.prev\.floor \}\}/.test(ltpl) && /\{\{ \$t\('TRAY'\) \}\} \{\{ neighbors\.next\.floor \}\}/.test(ltpl), 'frecce: "Cassetto <n>"');

console.log('\n2) testi delle frecce e del dialog "modifiche non salvate"');
check(it.layout.nav.toFloor === 'Vai al cassetto {floor}' && en.layout.nav.toFloor === 'Go to tray {floor}', 'tooltip: "Vai al cassetto <n>" / "Go to tray <n>"');
check(!/piano/i.test(it.layout.nav.discardText) && /cassetto \{floor\}/.test(it.layout.nav.discardText) && /cassetto \{to\}/.test(it.layout.nav.discardText), 'dialog it: "cassetto", mai "piano"');
check(!/floor \{/i.test(en.layout.nav.discardText) && /tray \{floor\}/.test(en.layout.nav.discardText) && /tray \{to\}/.test(en.layout.nav.discardText), 'dialog en: "tray", mai "floor"');
check(it.tray.dbId === 'ID database {id}' && en.tray.dbId === 'Database ID {id}', 'tooltip ID database in it e en');

console.log('\n3) scheda cassetto: titolo col numero, OUT se fuori');
const tray = readFileSync('src/views/conf/Tray/Tray.vue', 'utf8');
const ttpl = noComments(tray.slice(0, tray.indexOf('<script>')));
check(/<h2 v-if="!createNew" class="view-title" :title="\$t\('tray\.dbId', \{ id: tray\.ID \}\)">\{\{ \$t\('tray\.data'\)\}\} \{\{ trayNumber \}\}<\/h2>/.test(ttpl), 'titolo "<tray.data> <numero>", tooltip "ID database <ID>"');
check(!/\{\{\s*tray\.ID\s*\}\}/.test(ttpl), 'l\'ID non compare piu\' nel testo');
const num = row => trayComp.computed.trayNumber.call({ tray: row });
check(num({ ID: 30, FLOOR_MAG: 9 }) === '9', 'ID 30 sul piano 9 -> "9" (non 30)');
check(num({ ID: 13, FLOOR_MAG: 11 }) === '11', 'ID 13 sul piano 11 -> "11"');
check(num({ ID: 7, FLOOR_MAG: 0 }) === 'OUT' && num({ ID: 7, FLOOR_MAG: -1 }) === 'OUT', 'FLOOR_MAG <= 0 -> "OUT", come in TraysView');
check(num({ FLOOR_MAG: -1 }) === '', 'cassetto non ancora letto: niente "OUT" provvisorio');

console.log('\n4) scheda "nuovo cassetto": avviso, nessun salvataggio');
check(/<div v-if="createNew" class="tray-create-disabled">\{\{ \$t\('tray\.createDisabled'\) \}\}<\/div>/.test(ttpl), 'avviso "La creazione dei cassetti e\' disabilitata"');
check(it.tray.createDisabled === 'La creazione dei cassetti è disabilitata' && typeof en.tray.createDisabled === 'string', 'testo in it e en');
check(/<div class="pure-controls" v-if="!createNew">\s*<button class="pure-button pure-button-primary" @click="saveData\(\)"/.test(ttpl), 'pulsante di salvataggio solo fuori dalla modalita\' nuovo');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
