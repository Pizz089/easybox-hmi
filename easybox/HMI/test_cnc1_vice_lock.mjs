// ============================================================================
// test_cnc1_vice_lock.mjs — BLOCCO MORSA (11) in CNC1View.vue.
// Carica la VERA CNC1View.vue via Vite ssrLoadModule; metodi su vm minimale
// con socket finto; template verificato staticamente (parita' di gating col
// gemello SBLOCCO MORSA, apertura SOLO via dialog).
//
// Uso:   node test_cnc1_vice_lock.mjs     (dalla cartella easybox/HMI)
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
const comp = (await server.ssrLoadModule('/src/views/unit/CNC1View.vue')).default;
const src = readFileSync('src/views/unit/CNC1View.vue', 'utf8');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const emitted = [];
dataStored.WS.socket = { on: () => {}, off: () => {}, emit: (ev, p) => emitted.push([ev, p]) };

const vm = Object.assign({}, comp.data.call({}));
for (const [k, f] of Object.entries(comp.methods)) vm[k] = f.bind(vm);

console.log('1) template: gemello dello sblocco, stesso stile e stesso (non-)gating');
const tpl = src.slice(0, src.lastIndexOf('</template>'));
const btn = (label) => {
	const m = tpl.match(new RegExp('<button([^>]*)>\\s*' + label + '\\s*</button>'));
	return m ? m[1] : null;
};
const unlock = btn('SBLOCCO MORSA'), lock = btn("\\{\\{ \\$t\\('machine\\.viceLock'\\) \\}\\}");
check(unlock !== null && lock !== null, 'entrambi i bottoni presenti');
const attrs = s => (s || '').replace(/@click="[^"]*"/, '').replace(/\s+/g, ' ').trim();
check(attrs(unlock) === attrs(lock), 'stessi attributi (classe) a parte il click: [' + attrs(lock) + ']');
check(!/:disabled/.test(unlock) && !/:disabled/.test(lock), 'nessun :disabled su entrambi (i comandi macchina della pagina non hanno gating)');
check(/@click="openViceLockDialog\(\)"/.test(lock), 'il bottone apre SOLO il dialog');
check((tpl.match(/sendToPLC\('11'\)|sendToPLC\(11\)/g) || []).length === 0, "nessun invio di 11 dal template");
check((src.match(/sendToPLC\('11'\)/g) || []).length === 1 && /confirmViceLock\(\)\s*\{[\s\S]*?sendToPLC\('11'\)/.test(src), "l'11 parte SOLO da confirmViceLock");
check((tpl.match(/mission-dialog-overlay/g) || []).length === 1, 'un solo overlay nella pagina');
check(/machine\.viceLockWarn/.test(tpl), 'il dialog mostra l\'avviso di sicurezza');

console.log('\n2) dialog sempre prima dell\'invio, annulla non invia');
vm.openViceLockDialog();
check(vm.viceLockOpen === true && emitted.length === 0, 'apertura dialog: niente inviato');
vm.closeViceLockDialog();
check(vm.viceLockOpen === false && emitted.length === 0, 'annulla: niente inviato');
vm.openViceLockDialog();
vm.confirmViceLock();
check(vm.viceLockOpen === false, 'conferma chiude il dialog');
check(emitted.length === 1 && emitted[0][0] === 'TO_PLANT/CMD/MC1' && emitted[0][1] === '11', 'conferma -> esattamente TO_PLANT/CMD/MC1 "11"');
check(typeof emitted[0][1] === 'string', 'payload stringa');

console.log('\n3) nessun fallback: niente timer/alert legati al blocco');
check(!/viceLock[\s\S]{0,200}(setTimeout|alert\.)/.test(src) || !/(setTimeout|dataStored\.alert)[^\n]*viceLock/.test(src), 'nessun timeout/alert nel ramo BLOCCO MORSA');
check(vm.declTimer === null && vm.pendingDecl === null, 'la doppia mossa eco-driven (40/41) non viene armata');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
