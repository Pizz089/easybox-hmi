// ============================================================================
// test_fixture_composition.mjs — composizione dell'attrezzatura (16/9)
//
// PERCHE'. FIXTURE.Z e' la quota del piano su cui appoggia il pezzo in morsa,
// ed e' il SOLO valore che il PLC legge per il deposito in macchina. E' una
// somma fatta a mano di pallet + morsa, e l'anagrafica VICE non entra in
// nessun calcolo: chi ritocca VICE.Z crede di aver aggiornato la quota di
// deposito e non ha aggiornato niente. Due giorni persi.
//
// La vista FIXTURES adesso denuncia il disallineamento con Z_DIVERGE; qui si
// verifica che il pannello lo RACCONTI, e nei tre modi diversi che servono:
//   0 coerente        -> si mostra da cosa viene la quota, in tono quieto
//   1 diverge         -> motivo, conseguenza sul robot, cosa fare
//   2 non dichiarata  -> stato, NON un guasto
//
// Uso:   node test_fixture_composition.mjs     (dalla cartella easybox/HMI)
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const { statoComposizione, quoteComposizione, scostamentoMm, COMPOSIZIONE } =
	await server.ssrLoadModule('/src/util/fixtureComposition.js');
const Form = (await server.ssrLoadModule('/src/views/conf/Fixture/Fixture.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 30));
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

// le tre righe hanno i numeri del database di prova: pallet 40 + morsa 100
const COERENTE = { ID: 1, Z: 140000, PALLET_Z: 40000, VICE_Z: 100000, Z_CALC: 140000, Z_DIVERGE: 0, PALLET_ID: 1, VICE_ID: 1 };
const DIVERGE = { ID: 2, Z: 200000, PALLET_Z: 40000, VICE_Z: 300000, Z_CALC: 340000, Z_DIVERGE: 1, PALLET_ID: 1, VICE_ID: 2 };
const NON_DICH = { ID: 3, Z: 175000, PALLET_Z: null, VICE_Z: null, Z_CALC: null, Z_DIVERGE: 2, PALLET_ID: null, VICE_ID: null };

console.log('1) i tre stati, uno per valore di Z_DIVERGE');
check(statoComposizione(COERENTE) === COMPOSIZIONE.COERENTE, '0 -> coerente');
check(statoComposizione(DIVERGE) === COMPOSIZIONE.DIVERGE, '1 -> diverge');
check(statoComposizione(NON_DICH) === COMPOSIZIONE.NON_DICHIARATA, '2 -> composizione non dichiarata');
// se in cella la vista non fosse ancora estesa il pannello non deve inventare
check(statoComposizione({ ID: 9, Z: 1000 }) === COMPOSIZIONE.SCONOSCIUTA, 'colonna assente -> stato sconosciuto, non un guasto inventato');
check(statoComposizione(null) === COMPOSIZIONE.SCONOSCIUTA, 'riga assente -> sconosciuto');

console.log('\n2) i numeri arrivano dai dati, in millimetri');
const q = quoteComposizione(DIVERGE);
check(q.dichiarata === 200 && q.pallet === 40 && q.morsa === 300 && q.somma === 340, 'micron convertiti in mm (200 / 40 + 300 = 340)');
const qn = quoteComposizione(NON_DICH);
check(qn.pallet === null && qn.somma === null, 'quota mancante resta vuota: non diventa 0, che sarebbe una misura');
check(scostamentoMm(DIVERGE) === 140, 'scostamento del deposito: +140 mm');
check(scostamentoMm(NON_DICH) === null, 'senza componenti lo scostamento non si puo\' dire');
check(scostamentoMm({ Z: 340000, Z_CALC: 200000 }) === -140, 'scostamento negativo quando la somma e\' piu\' bassa');

console.log('\n3) le frasi: motivo, conseguenza, cosa fare');
const c = it.fixture.composition;
check(/\{dichiarata\}/.test(c.divergeWhy) && /\{pallet\}/.test(c.divergeWhy) && /\{somma\}/.test(c.divergeWhy),
	'la frase di divergenza prende i numeri dai dati, non da un esempio');
check(/non corrisponde/.test(c.divergeWhy), 'dice il motivo');
check(/PLC usa la quota dichiarata/.test(c.divergeWhat), 'dice la conseguenza: e\' la dichiarata che muove il robot');
check(/Correggere dalla Modifica/.test(c.divergeWhat), 'e dice cosa fare');
// il testo lungo dice apposta "non e' un errore": il controllo verifica che
// le parole da allarme non compaiano in forma AFFERMATIVA
check(!/errore|guasto|allarme/i.test(c.undeclaredWhat), "l'etichetta breve non usa parole da allarme");
check(/non \u00e8 un errore/i.test(c.undeclaredForm), 'e il testo lungo nega esplicitamente che sia un errore');
check(/Non è un errore/.test(c.undeclaredForm), 'anzi, lo dice esplicitamente');
for (const k of Object.keys(c)) check(en.fixture.composition[k] !== undefined, 'tradotta in inglese: ' + k);

console.log('\n4) allineamento: esplicito, e dice di quanto si sposta il robot');
check(/\{mm\}/.test(c.alignUp) && /\{mm\}/.test(c.alignDown), 'la conferma porta i millimetri');
check(/PIU' IN ALTO/.test(c.alignUp) && /PIU' IN BASSO/.test(c.alignDown), 'e il verso dello spostamento');
const src = readFileSync('src/views/conf/Fixture/Fixture.vue', 'utf8');
check(/chiediAllineamento\(\)/.test(src) && /alignDialog/.test(src), 'l\'allineamento passa da una conferma, non da un click');
check(/confermaAllineamento\(\)[\s\S]{0,400}this\.fixture\.Z = q\.somma/.test(src), 'e confermando cambia SOLO il campo');
check(!/updateFixture[\s\S]{0,200}confermaAllineamento/.test(src), 'non scrive da solo: il robot si sposta al salvataggio');

console.log('\n5) il form scrive davvero le due colonne');
const calls = [];
globalThis.fetch = async (url) => {
	calls.push(String(url).replace(dataStored.server, ''));
	const u = String(url);
	if (u.includes('fixture/show/')) return { ok: true, json: async () => [Object.assign({}, DIVERGE, { FAMILY: 'ADMG 202', DESCR: 'x', Z_CLAW: 0, Z_SINK_CLAW: 0, X: 0, Y: 0, POS_X: 0, POS_Y: 0, POS_Z: 0, POS_X_CORR: 0, POS_Y_CORR: 0, POS_Z_CORR: 0, POS_X_ROT: 0, POS_Y_ROT: 0, POS_Z_ROT: 0 })] };
	if (u.includes('pallet/show')) return { ok: true, json: async () => [{ ID: 1, FAMILY: 'ZERO POINT' }] };
	if (u.includes('vice/show')) return { ok: true, json: async () => [{ ID: 1, FAMILY: 'ADMG' }, { ID: 2, FAMILY: 'ADMG' }] };
	return { ok: true, json: async () => [], text: async () => 'OK' };
};
const vm = Object.assign({}, Form.data.call({}), { $route: { query: { fixtureID: 2 } }, $router: { push: () => {} }, $t: (k) => k });
for (const [k, f] of Object.entries(Form.methods || {})) vm[k] = f.bind(vm);
for (const [k, cc] of Object.entries(Form.computed || {}))
	Object.defineProperty(vm, k, { get: () => (typeof cc === 'function' ? cc.call(vm) : cc.get.call(vm)) });
vm.getDataTable(); vm.getPalletList(); vm.getViceList();
await tick(); await tick();
check(calls.some((u) => u.includes('api/conf/vice/show/all')), 'il form legge l\'anagrafica morse (rotta gia\' esistente)');
check(calls.some((u) => u.includes('api/conf/pallet/show/all')), 'e l\'anagrafica pallet');
check(vm.statoComp === COMPOSIZIONE.DIVERGE, 'lo stato arriva dalla riga letta');
check(vm.scostamento === 140, 'e lo scostamento e\' calcolato sulla quota in mm del form');
calls.length = 0;
vm.fixture.VICE_ID = 1;
vm.saveData();
await tick();
const scrittura = calls.find((u) => u.includes('updateFixture'));
check(!!scrittura, 'il salvataggio chiama updateFixture');
check(/VICE_ID=1/.test(scrittura) && /PALLET_ID=1/.test(scrittura), 'e manda le due colonne della composizione');

console.log('\n6) la lista mostra la composizione');
const lista = readFileSync('src/views/conf/FixturesView.vue', 'utf8');
check(/fixture\.composition\.column/.test(lista), 'colonna dedicata in tabella');
check(/divergeBadge/.test(lista) && /undeclaredBadge/.test(lista), 'due stati distinti, con due etichette diverse');
check(/badge-undeclared[\s\S]{0,200}var\(--bg-input\)/.test(lista), 'quella non dichiarata ha colore neutro, non da avviso');
check(/badge-diverge[\s\S]{0,200}color-warning-bg/.test(lista), 'quella divergente ha i colori dell\'avviso');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
