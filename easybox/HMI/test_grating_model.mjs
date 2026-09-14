// ============================================================================
// test_grating_model.mjs — cantiere grating-model (14/9): grigliato = MODELLO
// senza tasche; associazione/sostituzione/rigenerazione/dissociazione SOLO
// dalla gestione cassetti (TraysView), copia da cassetto tarato di default.
//  1. util gratingGrid: parita' con la griglia storica (TRAY_12: 13 x 7 = 91)
//  2. GratingsView: aggregazione una-riga-per-cassetto -> modello + trays[]
//  3. TraysView dialog: proposta = sorgente con PIU' tasche (mostrata, non
//     silenziosa), generazione solo senza sorgenti, rigenera con avviso
//     taratura + spunta, payload POST, guardia EXTRACT sui bottoni
//  4. Grating.vue: "Salva" = header soltanto
// Componenti REALI via Vite ssrLoadModule.
//
// Uso:   node test_grating_model.mjs     (dalla cartella easybox/HMI)
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
const { buildGrid, gridCenters, gripperMinSafe, taughtMismatch } = await server.ssrLoadModule('/src/util/gratingGrid.js');
const { drawingToRobot, gridFit } = await server.ssrLoadModule('/src/util/gratingAxes.js');
const gratingsMod = await server.ssrLoadModule('/src/views/conf/GratingsView.vue');
const GratingsView = gratingsMod.default, groupGratings = gratingsMod.groupGratings;
const TraysView = (await server.ssrLoadModule('/src/views/conf/TraysView.vue')).default;
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
globalThis.alert = () => {};
dataStored.alert = { title: '', desc: '', type: '' };

console.log('1) util gratingGrid: parita\' con la griglia storica');
const g12 = buildGrid({ pieceX: 40, pieceY: 70, prismatic: true, safeX: 20, safeY: 10, width: 820, height: 610 });
check(g12.n_cln === 13 && g12.n_row === 7 && g12.listPz.length === 91, 'TRAY_12: pezzo 40x70, SAFEX 20, SAFEY 10 su 820x610 -> 13 x 7 = 91 tasche');
const c12 = gridCenters(g12.listPz, { width: 820, height: 610, dim_x: g12.dim_x, dim_y: g12.dim_y });
const p12 = drawingToRobot(c12);
check(p12[0].X === 65000 && p12[0].Y === 50000 && p12[1].Y === 110000 && p12[13].X === 145000 && p12[90].X === 545000 && p12[90].Y === 770000, 'coordinate robot: origine angolo cassetto, tasca 1 = (h1, w1) = (65, 50) (origin-fix 14/9)');
check(gridFit(c12, { width: 820, height: 610, halfW: 20, halfH: 35 }).ok, 'la griglia storica entra nel contorno');
// stessa griglia calcolata dal componente Grating.vue (anteprima): identica
const gv = vmOf(Grating, { $route: { params: { grating_ID: 2096 } } });
gv.partList = [{ ID: 21, X: 40000, Y: 70000, PRISMA: true }];
gv.gripperList = [{ ID: 3, STROKE_CLAW: 10000, TICKNESS_CLAW: 5000 }];
gv.trayList = [{ ID: 24, FLOOR_MAG: 12, X: 820000, Y: 610000, MAG: 1, FAMILY: 'T 12' }];
gv.grating.trayIndex = 1; gv.grating.pieceIndex = 1; gv.grating.gripperIndex = 1;
gv.grating.width = 820; gv.grating.height = 610; gv.grating.SAFEX = 20; gv.grating.SAFEY = 10;
gv.calculateData();
check(gv.listPz.length === 91 && JSON.stringify(drawingToRobot(gv.pocketCentersWH())) === JSON.stringify(p12), 'Grating.vue (anteprima) e util producono la STESSA griglia: anteprima e tasche scritte non divergono');
const cyl = buildGrid({ pieceX: 30, pieceY: 30, prismatic: false, safeX: 10, safeY: 10, width: 820, height: 610 });
check(cyl.listPz.length > 0 && cyl.listPz[0].prisma === false && cyl.radius === 15, 'cilindrico: centri e raggio');
const ms = gripperMinSafe({ STROKE_CLAW: 10000, TICKNESS_CLAW: 5000 }, true);
check(ms.minSafeX === 15 && ms.minSafeY === 5 && gripperMinSafe({ STROKE_CLAW: 10000, TICKNESS_CLAW: 5000 }, false).minSafeY === 15, 'minimi pinza-derivati (prisma: SAFEY = solo chela)');

console.log('\n2) GratingsView: catalogo, una riga per cassetto -> modello + trays[]');
const rows = [
	{ ID: 1, NAME: 'T 12', DESCR: 'a', SAFEX: 20, SAFEY: 10, TRAY_ID: 24, FLOOR_MAG: 12, MAG: 1, TraySTATUS: 2, GRIPPER_DESC: 'P', PIECE_ID: 'X' },
	{ ID: 1, NAME: 'T 12', DESCR: 'a', SAFEX: 20, SAFEY: 10, TRAY_ID: 4, FLOOR_MAG: 1, MAG: 1, TraySTATUS: 2, GRIPPER_DESC: 'P', PIECE_ID: 'X' },
	{ ID: 1, NAME: 'T 12', DESCR: 'a', SAFEX: 20, SAFEY: 10, TRAY_ID: 30, FLOOR_MAG: 9, MAG: 1, TraySTATUS: 3, GRIPPER_DESC: 'P', PIECE_ID: 'X' },
	{ ID: 2, NAME: 'G71x90', DESCR: 'b', SAFEX: 30, SAFEY: 30, TRAY_ID: null, FLOOR_MAG: null, MAG: null, TraySTATUS: null, GRIPPER_DESC: null, PIECE_ID: null },
];
const grouped = groupGratings(rows);
check(grouped.length === 2, '4 righe -> 2 modelli');
check(grouped[0].trays.map(t => t.FLOOR_MAG).join(',') === '1,9,12', 'T 12 usato dai cassetti 1, 9, 12 (ordinati)');
check(grouped[1].trays.length === 0 && grouped[1].NAME === 'G71x90', 'modello senza cassetti: trays vuoto (non sparisce dal catalogo)');
check(!('FLOOR_MAG' in grouped[0]) && !('TRAY_ID' in grouped[0]), 'colonne cassetto tolte dal modello aggregato');
const gsrcV = readFileSync('src/views/conf/GratingsView.vue', 'utf8');
check(/:disabled="dt\.trays\.length>0" @click="deleteGrating/.test(gsrcV) && /KO_IN_USE/.test(gsrcV), 'delete: bloccata a video se in uso e KO_IN_USE gestito');
check(!/deletePositionsTray|associate\b/.test(gsrcV), 'nessuna azione di associazione nella pagina grigliati (solo catalogo)');
// (grating-thickness) indicatore nel catalogo: pezzo del modello sotto spessore + franco
const gvw = vmOf(GratingsView);
check(gvw.thicknessIssue({ THICKNESS: 14500, Z_PICK: 15000, Z_PLACE: 15000 }) !== null, 'badge: spessore 14.5 e pezzo a 15 -> segnalato (min 15.5)');
check(gvw.thicknessIssue({ THICKNESS: 14000, Z_PICK: 15000, Z_PLACE: 15000 }) === null && gvw.thicknessIssue({ THICKNESS: null, Z_PICK: 15000, Z_PLACE: 15000 }) === null, 'badge: al limite o spessore non misurato -> nessun indicatore');
check(/thick-badge/.test(gsrcV) && /grating\.thicknessBadge/.test(gsrcV), 'badge presente nella riga del catalogo (si vede prima di associare)');

console.log('\n3) TraysView: dialog associa/sostituisci/rigenera/dissocia');
// posizioni a DB: TRAY_12 91 tasche tarate (passi 61/82), TRAY_9 88 tasche, TRAY_1 nessuna
const positions = [];
for (let i = 0; i < 91; i++) { const col = Math.floor(i / 13), r = i % 13; positions.push({ PARENT: 'TRAY_12'.padEnd(30), SUB_POS: i + 1, X: 50000 + 82000 * col, Y: -65000 + 61000 * r }); }
for (let i = 0; i < 88; i++) positions.push({ PARENT: 'TRAY_9 '.padEnd(30), SUB_POS: i + 1, X: 50000, Y: -65000 + 60000 * i });
positions.push({ PARENT: 'WPALLET'.padEnd(30), SUB_POS: 1, X: 0, Y: 0 });
const gratings = [{ ID: 7, NAME: 'T 12', DESCR: 'a', PIECE_ID: 21, GRIPPER_ID: 3, SAFEX: 20, SAFEY: 10 }, { ID: 8, NAME: 'G71x90', DESCR: 'b', PIECE_ID: 22, GRIPPER_ID: 3, SAFEX: 30, SAFEY: 30 }, { ID: 9, NAME: 'ZERO', DESCR: 'z', PIECE_ID: 23, GRIPPER_ID: 3, SAFEX: 30, SAFEY: 30 }];
// (z-pick 14/9) Z_PICK = quota di presa dal fondo: il dialog rifiuta di
// generare con Z_PICK 0 (pezzo 23)
const pieces = [{ ID: 21, X: 40000, Y: 70000, Z: 30000, Z_PICK: 15000, Z_PLACE: 15000, PRISMA: true }, { ID: 22, X: 71000, Y: 90000, Z: 15000, Z_PICK: 7500, Z_PLACE: 7500, PRISMA: true }, { ID: 23, X: 71000, Y: 90000, Z: 15000, Z_PICK: 0, Z_PLACE: 0, PRISMA: true }];
const trays = [
	{ ID: 4,  FLOOR_MAG: 1,  X: 820000, Y: 610000, MAG: 1, FAMILY: ''.padEnd(400), EXTRACT: 0 },
	{ ID: 30, FLOOR_MAG: 9,  X: 820000, Y: 610000, MAG: 1, FAMILY: 'T 12'.padEnd(400), EXTRACT: 0 },
	{ ID: 24, FLOOR_MAG: 12, X: 820000, Y: 610000, MAG: 1, FAMILY: 'T 12'.padEnd(400), EXTRACT: 1 },
	{ ID: 5,  FLOOR_MAG: 2,  X: 820000, Y: 610000, MAG: 1, FAMILY: ''.padEnd(400), EXTRACT: 0 },
];
const calls = [];
globalThis.fetch = async (url, opt) => {
	const u = String(url).replace(dataStored.server, '');
	calls.push({ u, opt });
	const j = u.includes('tray/show') ? trays : u.includes('grating/show') ? gratings : u.includes('position/show') ? positions : u.includes('piece/show') ? pieces : { ris: 'OK', n: 91 };
	return { ok: true, json: async () => j, text: async () => JSON.stringify(j) };
};
const tv = vmOf(TraysView);
tv.datiTab = trays;
dataStored.userLevel = 2;
check(tv.assocAllowed(trays[0]) === true && tv.assocAllowed(trays[2]) === false, 'bottoni: consentiti a livello tecnico e cassetto DENTRO; EXTRACT=1 -> disabilitati');
dataStored.userLevel = 1;
check(tv.assocAllowed(trays[0]) === false, 'livello manutentore -> disabilitati (cancellano tasche tarate)');
dataStored.userLevel = 2;

// ASSOCIA cassetto 1 con T 12: due sorgenti (12: 91 tasche, 9: 88) -> proposta = 12
await tv.openAssoc('associate', trays[0]);
check(tv.assoc.open && tv.assoc.mode === 'associate' && tv.assoc.floor === 1 && tv.assoc.gratings.length === 3, 'dialog aperto, catalogo caricato');
check(tv.assocReady === false, 'senza modello scelto: conferma bloccata');
tv.assoc.gratingId = 7; tv.onAssocGratingChange();
check(tv.assoc.candidates.map(c => c.floor + ':' + c.n).join(' ') === '12:91 9:88', 'sorgenti = cassetti con lo STESSO modello e tasche a DB, la PRIMA e\' quella con PIU\' tasche');
check(tv.assoc.sourceFloor === 12 && tv.assoc.preview === null, 'proposta automatica = cassetto 12 (copia), nessuna generazione');
const tsrc = readFileSync('src/views/conf/TraysView.vue', 'utf8');
check(/tray\.assoc\.willCopy', \{ n: assoc\.sourceFloor/.test(tsrc) && /tray\.assoc\.suggested/.test(tsrc), 'la proposta e\' MOSTRATA nel dialog (sorgente e conteggio), mai applicata in silenzio');
check(tv.assocReady === true, 'modello + sorgente -> conferma abilitata');
tv.assoc.sourceFloor = 9;
calls.length = 0;
await tv.confirmAssoc();
let post = calls.find(c => c.u.includes('associateGrating'));
check(post && post.u.endsWith('associateGrating/1') && post.opt.method === 'POST', 'POST associateGrating/<target>');
let body = JSON.parse(post.opt.body);
check(body.gratingId === 7 && body.replace === false && body.source.floor === 9 && !body.source.centers, 'payload copia: {gratingId, replace:false, source:{floor:9}} (sorgente modificabile dall\'operatore)');
check(tv.assoc.open === false && dataStored.alert.desc === 'tray.assoc.done.associate', 'esito OK: dialog chiuso, conferma a video');

// ASSOCIA cassetto 2 con G71x90: NESSUNA sorgente -> genera dall'header
await tv.openAssoc('associate', trays[3]);
tv.assoc.gratingId = 8; tv.onAssocGratingChange();
check(tv.assoc.candidates.length === 0 && tv.assoc.sourceFloor === null && tv.assoc.preview && tv.assoc.preview.tot > 0, 'senza sorgenti: anteprima generata dall\'header sulle misure del cassetto target');
const expected = buildGrid({ pieceX: 71, pieceY: 90, prismatic: true, safeX: 30, safeY: 30, width: 820, height: 610 });
check(tv.assoc.preview.tot === expected.listPz.length && tv.assoc.preview.n_row === expected.n_row, 'griglia = buildGrid(pezzo 71x90, SAFE 30/30, 820x610): ' + expected.n_row + ' x ' + expected.n_cln);
calls.length = 0;
await tv.confirmAssoc();
post = calls.find(c => c.u.includes('associateGrating'));
body = JSON.parse(post.opt.body);
check(body.source.centers && body.source.centers.length === expected.listPz.length && body.source.floor === undefined, 'payload genera: source.centers in coordinate DISEGNO (il server verifica l\'ingombro dal DB)');

// (z-pick 14/9) modello con pezzo a Z_PICK 0: generazione RIFIUTATA con messaggio
tv.assoc.gratingId = 9; tv.onAssocGratingChange();
check(tv.assoc.preview === null && tv.assoc.error === 'tray.assoc.err.zPick' && tv.assocReady === false, 'pezzo con Z_PICK 0 (quota di presa dal fondo): nessuna anteprima, errore dedicato, conferma bloccata');

// (grating-thickness 14/9) spessore grigliato + franco: blocco in TUTTI i modi, copia compresa
gratings[0].THICKNESS = 14500;   // T 12: pezzo 21 ha Z_PICK 15000 < 14500 + 1000
await tv.openAssoc('associate', trays[0]);
tv.assoc.gratingId = 7; tv.onAssocGratingChange();
check(tv.assoc.error === 'tray.assoc.err.thickness' && tv.assoc.candidates.length === 0 && tv.assoc.sourceFloor === null && tv.assocReady === false, 'copia da sorgente disponibile ma pezzo sotto spessore + franco: bloccato PRIMA della scelta sorgente');
check(tv.assoc.errorParams.min === 15.5 && tv.assoc.errorParams.pick === 15 && tv.assoc.errorParams.t === 14.5, 'messaggio con minimo 15.5 mm, richiesto 15 mm, spessore 14.5 mm');
gratings[0].THICKNESS = 14000;   // al limite: 15000 = 14000 + 1000 -> passa
tv.onAssocGratingChange();
check(tv.assoc.error === '' && tv.assoc.sourceFloor === 12, 'al limite esatto: passa, sorgente proposta come prima');
gratings[0].THICKNESS = null;
tv.onAssocGratingChange();
check(tv.assoc.error === '' && tv.assoc.sourceFloor === 12, 'spessore non misurato (NULL): nessun vincolo, come prima');
// rifiuto dal SERVER (client con dati vecchi): codice mappato con i numeri
globalThis.fetch = async (url, opt) => {
	const u = String(url).replace(dataStored.server, '');
	const j = u.includes('tray/show') ? trays : u.includes('grating/show') ? gratings : u.includes('position/show') ? positions : u.includes('piece/show') ? pieces
		: { ris: 'KO_Z_BELOW_GRATING', n: 0, min: 15500, zPick: 15000, zPlace: 15000, thickness: 14500 };
	return { ok: true, json: async () => j };
};
await tv.confirmAssoc();
check(tv.assoc.open === true && tv.assoc.error === 'tray.assoc.err.thickness' && tv.assoc.errorParams.min === 15.5 && tv.assoc.errorParams.t === 14.5, 'KO_Z_BELOW_GRATING dal server -> stesso messaggio con i numeri del DB, dialog aperto');
globalThis.fetch = async (url, opt) => {
	const u = String(url).replace(dataStored.server, '');
	calls.push({ u, opt });
	const j = u.includes('tray/show') ? trays : u.includes('grating/show') ? gratings : u.includes('position/show') ? positions : u.includes('piece/show') ? pieces : { ris: 'OK', n: 91 };
	return { ok: true, json: async () => j, text: async () => JSON.stringify(j) };
};

// SOSTITUISCI cassetto 9 (ha T 12) con G71x90 -> replace:true, tasche attuali dichiarate
await tv.openAssoc('replace', trays[1]);
check(tv.assoc.currentCount === 88, 'sostituisci: 88 tasche attuali del cassetto 9 dichiarate (verranno cancellate)');
tv.assoc.gratingId = 8; tv.onAssocGratingChange();
calls.length = 0;
await tv.confirmAssoc();
body = JSON.parse(calls.find(c => c.u.includes('associateGrating')).opt.body);
check(body.replace === true && body.gratingId === 8, 'payload sostituisci: replace:true');

// RIGENERA cassetto 12 (tarato 61/82 vs header 60/80): avviso + spunta obbligatoria
await tv.openAssoc('regenerate', trays[2]);
check(tv.assoc.gratingId === 7 && tv.assoc.sourceFloor === null && tv.assoc.preview && tv.assoc.preview.tot === 91, 'rigenera: modello FISSO (FAMILY), sempre generazione dall\'header, 91 tasche');
check(tv.assoc.mismatch && tv.assoc.mismatch.realW === 61000 && tv.assoc.mismatch.realH === 82000 && tv.assoc.mismatch.genW === 60000 && tv.assoc.mismatch.genH === 80000, 'avviso taratura: passi reali 61/82 vs 60/80');
check(tv.assocReady === false, 'senza spunta: conferma BLOCCATA');
tv.assoc.ack = true;
check(tv.assocReady === true, 'con spunta esplicita: conferma abilitata');
calls.length = 0;
await tv.confirmAssoc();
body = JSON.parse(calls.find(c => c.u.includes('associateGrating')).opt.body);
check(body.replace === true && body.gratingId === 7 && body.source.centers.length === 91, 'payload rigenera: replace:true, stesso modello, centers generati');

// DISSOCIA cassetto 9
await tv.openAssoc('dissociate', trays[1]);
check(tv.assoc.currentCount === 88 && tv.assocReady === true, 'dissocia: 88 tasche dichiarate, conferma abilitata');
calls.length = 0;
await tv.confirmAssoc();
post = calls.find(c => c.u.includes('dissociateGrating'));
check(post && post.u.endsWith('dissociateGrating/9') && post.opt.method === 'POST', 'POST dissociateGrating/9');

// errore dal backend: codice mappato a messaggio, dialog resta aperto
globalThis.fetch = async (url) => {
	const u = String(url).replace(dataStored.server, '');
	const j = u.includes('tray/show') ? trays : u.includes('grating/show') ? gratings : u.includes('position/show') ? positions : u.includes('piece/show') ? pieces : { ris: 'KO_TRAY_EXTRACTED', n: 0 };
	return { ok: true, json: async () => j };
};
await tv.openAssoc('dissociate', trays[1]);
await tv.confirmAssoc();
check(tv.assoc.open === true && tv.assoc.error === 'tray.assoc.err.extracted' && tv.assocReady === false, 'KO_TRAY_EXTRACTED -> messaggio dedicato, dialog aperto, conferma bloccata');

console.log('\n4) Grating.vue: "Salva" scrive SOLO l\'header del modello');
calls.length = 0;
globalThis.fetch = async (url, opt) => { calls.push(String(url).replace(dataStored.server, '')); return { ok: true, json: async () => [], text: async () => 'OK' }; };
const g = vmOf(Grating, { $route: { params: { grating_ID: 0 } }, $router: { push: () => {} } });
g.checkGridFit = () => true;
g.grating.NAME = 'NUOVO'; g.createNew = true;
await g.saveData();
check(calls.length === 1 && calls[0].includes('grating/insertgrating') && !calls[0].includes('TRAY_ID=') === false, 'una sola chiamata: insertgrating (header)');
check(!calls.some(u => /position|tray\/updateGratingInTray|deletePositionsTray/.test(u)), 'nessuna scrittura di tasche o TRAY dal salvataggio del modello');
const gsrc = readFileSync('src/views/conf/Grating/Grating.vue', 'utf8');
check(!/name="trayList"|setGratingAssociated|gratingAssociated/.test(gsrc), 'nessun select/bottone di associazione cassetto nella pagina modello');
check(/usedByFloors/.test(gsrc) && /grating\.usedBy/.test(gsrc), 'cassetti che usano il modello mostrati come informazione');
globalThis.fetch = async () => ({ ok: true, json: async () => [], text: async () => 'KO_DUP_NAME' });
let alerted = '';
globalThis.alert = m => { alerted = String(m); };
await g.saveData();
check(alerted.includes('grating.dupName'), 'nome duplicato -> messaggio dedicato');
// (grating-thickness) form: avviso NON bloccante e payload in micron
const gt = vmOf(Grating, { $route: { params: { grating_ID: 5 } }, $router: { push: () => {} } });
gt.partList = [{ ID: 21, X: 40000, Y: 70000, Z: 30000, Z_PICK: 15000, Z_PLACE: 15000, PRISMA: true }];
gt.grating.pieceIndex = 1; gt.grating.NAME = 'T'; gt.grating.THICKNESS = 14.5;
check(gt.thicknessWarn && gt.thicknessWarn.min === 15500, 'form: spessore 14.5 mm e pezzo a 15 -> avviso con minimo 15.5');
gt.grating.THICKNESS = 14;
check(gt.thicknessWarn === null, 'form: al limite -> nessun avviso');
check(gt.headerPayload().THICKNESS === 14000, 'payload: mm -> micron');
gt.grating.THICKNESS = null;
check(gt.thicknessWarn === null && gt.headerPayload().THICKNESS === '', 'form: vuoto = non misurato -> nessun avviso, payload vuoto (NULL a DB)');
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
const fi = flat(it), fe = flat(en);
check(fi.length === fe.length && fi.every(k => fe.includes(k)), 'i18n: it/en allineati (' + fi.length + ' chiavi)');
check(fi.includes('tray.assoc.err.extracted') && fi.includes('grating.usedBy') && !fi.includes('grating.confirmRegenerate'), 'i18n: chiavi nuove presenti, chiavi morte rimosse');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
