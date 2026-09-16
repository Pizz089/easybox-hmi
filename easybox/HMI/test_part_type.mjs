// ============================================================================
// test_part_type.mjs — POSITION.Part_Type nasce giusto, o non nasce (16/9)
//
// PERCHE'. Il PLC e' passato da "grezzi dell'ordine" (Order_ID) a "grezzi di
// quel tipo" (Part_Type): il ciclo filtra STATUS=4 AND Part_Type=<pezzo
// dell'ordine>. Non decide solo QUALE pezzo — la vista
// COORDINATES_PIECES_TRAYS_4Robot aggancia PIECE con un join INTERNO su
// Part_Type e ne somma Z_PICK. Quindi un Part_Type sbagliato manda il robot a
// prendere il pezzo sbagliato ALLA QUOTA DI UN ALTRO PEZZO, e un Part_Type 0
// non aggancia niente: quelle tasche spariscono dalla vista, il cassetto
// risulta pieno sul pannello e per la cella non esiste.
//
// Il lato server (la copia che ereditava il pezzo dalla sorgente, e la
// guardia sul modello senza pezzo) e' in serverDati/test_grating_assoc.js.
// Qui c'e' il lato pannello: nessuna pagina puo' piu' far nascere uno zero, e
// nessun comando promette di cambiare il codice pezzo senza riuscirci.
//
// Uso:   node test_part_type.mjs     (dalla cartella easybox/HMI)
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const { KO_GRATING_NO_PIECE } = await server.ssrLoadModule('/src/util/errorCodes.js');
const Import = (await server.ssrLoadModule('/src/views/conf/Grating/ImportGrating.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = () => new Promise(r => setTimeout(r, 25));
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

// solo il CODICE: i commenti nuovi citano PIECE_TYPE_NONUSARE e Part_Type per
// spiegare cosa e' stato tolto, e un controllo che legge i commenti al posto
// del codice passerebbe (o fallirebbe) per il motivo sbagliato
const codice = (p) => readFileSync(p, 'utf8')
	.replace(/<!--[\s\S]*?-->/g, '')
	.split('\n').filter(r => !r.trim().startsWith('//')).join('\n');

const PAGINE = [
	'src/views/conf/Grating/ImportGrating.vue',
	'src/views/conf/Grating/Grating.vue',
	'src/views/conf/Tray/Tray.vue',
	'src/views/conf/Tray.vue',
	'src/views/conf/Position.vue',
	'src/views/conf/PositionView.vue',
	'src/views/conf/TraysView.vue',
];

console.log('1) IMPORT GRIGLIATO: il codice pezzo si CHIEDE, e senza non si salva');
const calls = [];
globalThis.fetch = async (url) => {
	calls.push(String(url).replace(dataStored.server, ''));
	if (String(url).includes('piece/show')) return { ok: true, json: async () => PEZZI };
	return { ok: true, json: async () => [], text: async () => 'OK' };
};
// due codici DIVERSI con la STESSA sagoma: e' il caso che rende il difetto
// invisibile, perche' la geometria non li distingue
const PEZZI = [
	{ ID: 1030, FAMILY: 'A', DESCR: 'sagoma 40x70', X: 40000, Y: 70000, Z_PICK: 15000 },
	{ ID: 1033, FAMILY: 'B', DESCR: 'sagoma 40x70', X: 40000, Y: 70000, Z_PICK: 15000 },
];
function vmOf(comp, extra) {
	const vm = Object.assign({}, comp.data.call({}), extra || {});
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k) => k;
	vm.$router = { push: () => {} };
	vm.$route = { params: { grating_ID: 0 } };
	return vm;
}
const vm = vmOf(Import);
vm.getPartList();
await tick();
check(vm.partList.length === 2, 'l\'anagrafica pezzi viene caricata (prima il campo esisteva e restava vuoto)');
check(vm.grating.pieceIndex === 0 && vm.pieceChosen === false, 'si parte SENZA pezzo scelto: niente default silenzioso');

calls.length = 0;
vm.saveData();
await tick();
check(calls.length === 0, 'Salva senza pezzo: NON scrive niente — meglio un import fallito di un cassetto invisibile');

vm.grating.pieceIndex = 2;                       // secondo pezzo dell'elenco
check(vm.pieceChosen === true, 'scelto il pezzo, il salvataggio si sblocca');
calls.length = 0;
vm.saveData();
await tick();
const scrittura = calls.find(u => u.includes('grating'));
check(!!scrittura, 'adesso salva');
check(/PIECE_ID=1033/.test(scrittura), 'e manda il codice SCELTO (1033), non lo zero di prima');
check(!/PIECE_ID=0(&|$)/.test(scrittura), 'nessuno zero nel payload');

console.log('\n2) nessuna pagina puo\' far nascere una tasca con Part_Type 0');
for (const p of PAGINE) {
	const src = codice(p);
	check(!/PIECE_TYPE\s*[:=]\s*0\b/.test(src), p.split('/').pop() + ': non scrive PIECE_TYPE 0');
}
check(!/savePositions/.test(codice('src/views/conf/Grating/ImportGrating.vue')),
	'savePositions() rimossa: era irraggiungibile e scriveva zero su ogni tasca');

console.log('\n3) la tendina "tipo pezzo" che non scriveva niente e\' sparita');
// updateTray non tocca quella colonna, e sulla tabella vera si chiama
// PIECE_TYPE_NONUSARE: cambiare e salvare non faceva NIENTE, in silenzio
for (const p of ['src/views/conf/Tray/Tray.vue', 'src/views/conf/Tray.vue', 'src/views/conf/Position.vue']) {
	const src = codice(p);
	check(!/tray\.PIECE_TYPE/.test(src) && !/TIPO_PEZZO/.test(src),
		p.split('/').pop() + ': nessun campo che promette di cambiare il codice pezzo');
}
const backend = readFileSync('../serverDati/CONF/Tray.js', 'utf8');
check(!/PIECE_TYPE/.test(backend.split('\n').filter(r => !r.trim().startsWith('//')).join('\n')),
	'e updateTray continua a non scrivere quella colonna: non e\' stata fatta funzionare, e\' stata tolta');

console.log('\n4) il rifiuto del server ha una frase, non un codice');
check(typeof KO_GRATING_NO_PIECE === 'string', 'codice esportato anche lato client (contratto speculare)');
check(/KO_GRATING_NO_PIECE/.test(codice('src/views/conf/TraysView.vue')), 'TraysView lo mappa su un messaggio');
const msg = it.tray.assoc.err.noPiece;
check(/invisibili al robot/.test(msg), 'la frase dice la conseguenza vera: le tasche non esisterebbero per la cella');
check(/Assegnare il codice pezzo/.test(msg), 'e dice cosa fare');
check(typeof en.tray.assoc.err.noPiece === 'string', 'tradotta');
for (const k of ['importPieceHint', 'importNoPiece']) {
	check(typeof it.grating[k] === 'string' && typeof en.grating[k] === 'string', 'grating.' + k + ' in it+en');
}
check(/sagoma ospita tutti i pezzi/.test(it.grating.importPieceHint),
	'l\'avviso dell\'import dice PERCHE\' serve chiederlo: la sagoma non distingue i codici');
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
check(flat(it).length === flat(en).length, 'parita\' di conteggio it/en: ' + flat(it).length);

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
