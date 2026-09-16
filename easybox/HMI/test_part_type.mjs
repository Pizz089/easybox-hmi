// ============================================================================
// test_part_type.mjs — Part_Type e' il CONTENUTO del cassetto (16/9)
//
// IL MODELLO. Tre cose distinte che prima erano confuse in una:
//  - il GRIGLIATO porta la GEOMETRIA (quante tasche, che passo, che ingombro).
//    GRATING.PIECE_ID serve a quel calcolo e poi non serve piu': puo' mancare,
//    ed e' legittimo. Lo stesso grigliato ospita piu' particolari — due pezzi
//    di sagoma identica con programmi HAAS diversi sono codici distinti.
//  - il CASSETTO dichiara COSA CONTIENE, ed e' POSITION.Part_Type. Un cassetto
//    contiene un tipo alla volta: se dichiara 1033 serve agli ordini del 1033,
//    con le quote del 1033, perche' e' quello che c'e' dentro.
//  - la PRODUZIONE guarda il codice dichiarato: il ciclo filtra STATUS=4 AND
//    Part_Type=<pezzo dell'ordine>, e la vista 4Robot aggancia PIECE su quel
//    campo per sapere a che quota scendere.
//
// Quindi il contenuto si DICHIARA, in due momenti: alla prima associazione del
// grigliato, e in qualunque momento dopo senza rifare l'attrezzaggio. Qui si
// verifica il lato pannello; il lato server sta in
// serverDati/test_grating_assoc.js.
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
const { KO_NO_PIECE_DECLARED, KO_ACTIVE_ORDER, KO_TRAY_EXTRACTED } = await server.ssrLoadModule('/src/util/errorCodes.js');
const Import = (await server.ssrLoadModule('/src/views/conf/Grating/ImportGrating.vue')).default;
const Layout = (await server.ssrLoadModule('/src/views/layoutView.vue')).default;
const Trays = (await server.ssrLoadModule('/src/views/conf/TraysView.vue')).default;

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tick = () => new Promise(r => setTimeout(r, 30));
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

// solo il CODICE: i commenti spiegano cosa e' stato tolto e citano gli stessi
// nomi, e un controllo che legge i commenti passerebbe per il motivo sbagliato
const codice = (p) => readFileSync(p, 'utf8')
	.replace(/<!--[\s\S]*?-->/g, '')
	.split('\n').filter(r => !r.trim().startsWith('//')).join('\n');

// due codici DIVERSI con la STESSA sagoma: il caso che rende tutto invisibile
const PEZZI = [
	{ ID: 1030, FAMILY: 'A', DESCR: 'sagoma 40x70', X: 40000, Y: 70000, Z_PICK: 15000, Z_PLACE: 15000 },
	{ ID: 1033, FAMILY: 'B', DESCR: 'sagoma 40x70', X: 40000, Y: 70000, Z_PICK: 15000, Z_PLACE: 15000 },
];
let calls = [];
let posted = [];
globalThis.fetch = async (url, opt) => {
	const u = String(url).replace(dataStored.server, '');
	calls.push(u);
	if ((opt && opt.method) === 'POST') posted.push({ url: u, body: opt.body });
	if (u.includes('piece/show')) return { ok: true, json: async () => PEZZI, text: async () => '' };
	if (u.includes('tray/layout/')) return { ok: true, json: async () => TASCHE, text: async () => '' };
	if (u.includes('declareTrayType')) return { ok: true, json: async () => DECL_RIS, text: async () => '' };
	return { ok: true, json: async () => [], text: async () => 'OK' };
};
let TASCHE = [];
let DECL_RIS = { ris: 'OK', positions: 91 };

function vmOf(comp, extra) {
	const vm = Object.assign({}, comp.data ? comp.data.call({}) : {}, extra || {});
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	vm.$t = (k, p) => k + (p ? ' ' + JSON.stringify(p) : '');
	vm.$router = { push: () => {} };
	return vm;
}

console.log('1) IMPORT GRIGLIATO: il pezzo e\' un RIFERIMENTO, non un obbligo');
// la geometria qui nasce dalle misure reali delle tasche, non da un calcolo
// sull'ingombro: il pezzo non serve al calcolo, quindi non si impone
const imp = vmOf(Import, { $route: { params: { grating_ID: 0 } } });
imp.getPartList();
await tick();
check(imp.partList.length === 2, 'l\'anagrafica pezzi viene caricata');
calls = [];
imp.saveData();
await tick();
const salvataggio = calls.find(u => u.includes('grating'));
check(!!salvataggio, 'si salva ANCHE senza pezzo indicato: un grigliato senza PIECE_ID e\' legittimo');
check(/PIECE_ID=0/.test(salvataggio), 'e il modello nasce con PIECE_ID 0, che vuol dire "la geometria non sa cosa ci metteranno"');
imp.grating.pieceIndex = 2;
calls = [];
imp.saveData();
await tick();
check(/PIECE_ID=1033/.test(calls.find(u => u.includes('grating'))), 'indicato, il riferimento viene salvato');
check(!/pieceChosen/.test(codice('src/views/conf/Grating/ImportGrating.vue')), 'nessun obbligo residuo nel codice');

console.log('\n2) ASSOCIAZIONE: si dichiara cosa conterra\' il cassetto');
const tv = vmOf(Trays);
tv.assoc.open = true; tv.assoc.mode = 'associate'; tv.assoc.gratingId = 7;
tv.assoc.pieces = PEZZI; tv.assoc.sourceFloor = 12; tv.assoc.floor = 1;
tv.assoc.pieceId = 0;
check(tv.assocReady === false, 'senza contenuto dichiarato la conferma e\' spenta');
tv.assoc.pieceId = 1033;
check(tv.assocReady === true, 'dichiarato il contenuto, si puo\' confermare');
posted = [];
tv.confirmAssoc();
await tick();
check(posted.length === 1 && /associateGrating/.test(posted[0].url), 'parte la POST di associazione');
check(JSON.parse(posted[0].body).pieceId === 1033, 'e porta il contenuto dichiarato nel payload');
const tsrc = codice('src/views/conf/TraysView.vue');
check(/a\.pieceId > 0 \? a\.pieceId : g\.PIECE_ID/.test(tsrc),
	'anteprima e anti-urto usano le misure del pezzo che ci finira\' DENTRO, col pezzo del modello come ripiego');

console.log('\n3) CAMBIO A CASSETTO CHIUSO: dalla pagina del cassetto, senza riassociare');
TASCHE = [{ SUB_POS: 1, partType: 1030, status: 4, x: 65, y: 50, prisma: 1, order_ID: 0 },
          { SUB_POS: 2, partType: 1030, status: 4, x: 65, y: 110, prisma: 1, order_ID: 0 }];
const lv = vmOf(Layout, { $route: { params: { trayID: 24, floorMag: 12, modifyEnable: 1 } } });
lv.getPieces(); lv.getDataTable();
await tick(); await tick();
check(lv.listPz.length === 2, 'tasche lette');
lv.openTrayType();
check(lv.trayType.open === true, 'il dialog si apre');
check(lv.trayType.pieceId === 1030, 'e parte dal codice GIA\' dichiarato: si conferma o si cambia, non si riparte da vuoto');
check(/#1030/.test(lv.currentTypeLabel), 'il dialog dice cosa dichiara adesso');
posted = [];
lv.trayType.pieceId = 1033;
lv.confirmTrayType();
await tick();
check(posted.length === 1 && posted[0].url === 'api/conf/position/declareTrayType/12/1033',
	'POST declareTrayType/<cassetto>/<codice>: una sola chiamata per tutto il cassetto');
check(lv.trayType.open === false && String(dataStored.alert.desc).includes('layout.type.done'), 'esito mostrato, dialog chiuso');
// un rifiuto non deve passare per dichiarazione fatta
for (const [code, atteso] of [[KO_ACTIVE_ORDER, 'activeOrder'], [KO_TRAY_EXTRACTED, 'extracted'], [KO_NO_PIECE_DECLARED, 'noPiece']]) {
	DECL_RIS = { ris: code, positions: 0 };
	lv.openTrayType(); lv.trayType.pieceId = 1033; lv.confirmTrayType();
	await tick();
	check(lv.trayType.error === 'layout.type.err.' + atteso && lv.trayType.open === true,
		'rifiuto ' + code + ': motivo a video, dialog aperto');
}
DECL_RIS = { ris: 'OK', positions: 91 };
// il codice 0 non e' dichiarabile: sarebbe un cassetto invisibile
lv.openTrayType(); lv.trayType.pieceId = 0;
posted = [];
lv.confirmTrayType();
await tick();
check(posted.length === 0, 'codice non scelto: nessuna chiamata');

console.log('\n4) nessuna pagina puo\' far nascere una tasca con Part_Type 0');
for (const p of ['src/views/conf/Grating/ImportGrating.vue', 'src/views/conf/Grating/Grating.vue',
                 'src/views/conf/Tray/Tray.vue', 'src/views/conf/Tray.vue',
                 'src/views/conf/Position.vue', 'src/views/conf/PositionView.vue',
                 'src/views/conf/TraysView.vue', 'src/views/layoutView.vue']) {
	check(!/PIECE_TYPE\s*[:=]\s*0\b/.test(codice(p)), p.split('/').pop() + ': non scrive PIECE_TYPE 0');
}
check(!/savePositions/.test(codice('src/views/conf/Grating/ImportGrating.vue')),
	'savePositions() resta rimossa: era irraggiungibile e scriveva zero su ogni tasca');

console.log('\n5) la tendina che non scriveva niente resta sparita');
for (const p of ['src/views/conf/Tray/Tray.vue', 'src/views/conf/Tray.vue', 'src/views/conf/Position.vue']) {
	const src = codice(p);
	check(!/tray\.PIECE_TYPE/.test(src) && !/TIPO_PEZZO/.test(src), p.split('/').pop() + ': nessun campo morto');
}

console.log('\n6) le frasi dicono il modello, non il vecchio assunto');
check(/cosa conterr/i.test(it.tray.assoc.err.noPiece), 'il rifiuto parla del CONTENUTO del cassetto, non del grigliato');
check(/invisibili al ciclo/.test(it.tray.assoc.err.noPiece), 'e dice la conseguenza');
check(/Facoltativo/.test(it.grating.refPartHint) && /non è il contenuto/i.test(it.grating.refPartHint),
	'l\'import dice che il pezzo e\' un riferimento, non il contenuto');
check(/Non cambia quante tasche sono piene/.test(it.layout.type.hint),
	'dichiarare il tipo non e\' dichiarare la quantita\': lo dice');
check(/cassetto aperto si dichiara dal pannello robot/.test(it.layout.type.err.extracted),
	'a cassetto fuori la strada e\' il comando 44, e il messaggio ci manda li\'');
check(/QUANTO/.test(it.robot.decl.trayTypeHint) && /DI CHE COSA/.test(it.robot.decl.trayTypeHint),
	'e nel dialog robot la differenza fra 39 e 44 e\' scritta');
for (const k of ['button', 'title', 'current', 'none', 'choose', 'what', 'hint', 'confirm', 'done'])
	check(typeof en.layout.type[k] === 'string', 'layout.type.' + k + ' tradotta');
for (const k of ['trayType', 'trayTypeLabel', 'trayTypeSend', 'trayTypeHint', 'trayTypeDone'])
	check(typeof en.robot.decl[k] === 'string', 'robot.decl.' + k + ' tradotta');
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
check(flat(it).length === flat(en).length, 'parita\' di conteggio it/en: ' + flat(it).length);

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
