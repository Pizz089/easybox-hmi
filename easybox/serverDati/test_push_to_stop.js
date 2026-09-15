// ============================================================================
// test_push_to_stop.js — ciclo di SPINTA IN BATTUTA (15/9), lato backend.
//
//  1. pushQuotes: le tre quote e gli esiti, con la PARITA' fra la copia server
//     e quella del pannello (le formule vivono in due posti, come per gli assi
//     del grigliato: se divergono il pannello blocca cio' che il PLC farebbe,
//     o peggio lascia passare cio' che il PLC non sa fare).
//  2. insertOrder: istantanea del bit dal PEZZO e guardie KO_PUSH_*.
//  3. colonne nuove scritte davvero da Piece/Vice/Gripper — con particolare
//     attenzione a corsa, spessore e LUNGHEZZA della chela: i primi due il form
//     li mandava da sempre e il backend li perdeva in silenzio, la terza nasce
//     adesso e non deve ricadere nella stessa trappola.
//
// RISCONTRO SU PEZZO NON QUADRATO: i numeri qui sotto vengono dal pezzo 1029
// (PIECE.X 40000, PIECE.Y 120000). Con un pezzo quadrato (il 1033 e' 100.6 x
// 100.6) uno scambio d'asse darebbe lo stesso risultato e il test passerebbe
// sbagliato: e' esattamente l'errore corretto il 15/9.
//  4. lo script della vista NON crea una vista cifrata.
//
// Uso:   node test_push_to_stop.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const routes = {};
const queries = [];
let results = [];
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(null, results.length ? results.shift() : { recordset: [], rowsAffected: [0] }); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
require(path.join(__dirname, 'CONF', 'Piece.js'));
require(path.join(__dirname, 'CONF', 'Vice.js'));
require(path.join(__dirname, 'CONF', 'Gripper.js'));
require(path.join(__dirname, 'WORKORDER', 'Order.js'));
const errorCodes = require(path.join(__dirname, 'errorCodes.js'));
const srv = require(path.join(__dirname, 'pushQuotes.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const norm = q => q.replace(/\s+/g, ' ');
function call(key, params, resultQueue) {
	results = resultQueue || [];
	const before = queries.length;
	const res = { code: 200, body: null, status(n) { this.code = n; return this; }, send(b) { this.body = b; }, json(o) { this.body = o; } };
	routes[key]({ params, query: params }, res);
	return { res, n: queries.length - before, q: queries.slice(before).map(norm) };
}

(async () => {

console.log('1) pushQuotes: quote, esiti e parita\' server/pannello');
const hmi = await import(pathToFileURL(path.join(__dirname, '..', 'HMI', 'src', 'util', 'pushQuotes.js')).href);
// caso cella: deposito X -16084, pezzo 1029 NON QUADRATO (X 40000, Y 120000:
// nel conto entra la Y, che corre lungo la X del robot), chela pinza 30000,
// ganascia morsa 150000 -> corsa 15000 (gli stessi numeri della vista)
const PIECE_X = 40000, PIECE_Y = 120000;
const cella = { enabled: true, hasVice: true, xPlace: -16084, pieceY: PIECE_Y, viceClawLength: 150000, gripperClawLength: 30000 };
const r1 = srv.pushQuotes(cella);
check(r1.status === 'OK', 'dati completi -> OK');
check(r1.xPush === -16084 - 60000 - 15000, 'spinta = deposito - pezzo/2 - MEZZA lunghezza chela (' + r1.xPush + ')');
check(r1.clearance === 15000, 'corsa = (ganascia - pezzo)/2 = 15000');
check(r1.xStop === r1.xPush + 15000, 'arrivo = spinta + corsa (' + r1.xStop + ')');
check(r1.xPush === -91084 && r1.xStop === -76084, 'riscontro numerico del 15/9 sul pezzo 1029: -91084 e -76084');
// guardia d'asse: col pezzo 1029 le due dimensioni differiscono di 80 mm,
// quindi usare PIECE.X al posto di PIECE.Y si vede subito. Questo check
// fallirebbe se qualcuno riscambiasse gli assi.
const conX = srv.pushQuotes(Object.assign({}, cella, { pieceY: PIECE_X }));
check(conX.xPush !== r1.xPush && conX.clearance !== r1.clearance, 'pezzo NON quadrato: con PIECE.X i numeri cambiano, lo scambio d\'asse non passerebbe inosservato');
const casi = [
	{ name: 'bit spento', v: Object.assign({}, cella, { enabled: false }), st: 'DISABLED' },
	{ name: 'nessuna morsa sul pallet', v: Object.assign({}, cella, { hasVice: false }), st: 'NO_VICE' },
	{ name: 'ganascia non misurata', v: Object.assign({}, cella, { viceClawLength: null }), st: 'NO_DATA' },
	{ name: 'ganascia a zero', v: Object.assign({}, cella, { viceClawLength: 0 }), st: 'NO_DATA' },
	{ name: 'lunghezza chela pinza mancante', v: Object.assign({}, cella, { gripperClawLength: null }), st: 'NO_DATA' },
	{ name: 'pezzo senza misura', v: Object.assign({}, cella, { pieceY: 0 }), st: 'NO_DATA' },
	{ name: 'pezzo piu\' lungo della ganascia', v: Object.assign({}, cella, { pieceY: 160000 }), st: 'NO_FIT' },
	{ name: 'pezzo esattamente lungo come la ganascia', v: Object.assign({}, cella, { pieceY: 150000 }), st: 'OK' },
	{ name: 'pezzo girato (entrerebbe la X): resta un caso valido ma diverso', v: Object.assign({}, cella, { pieceY: PIECE_X }), st: 'OK' },
	{ name: 'valori dispari (troncamento come SQL)', v: Object.assign({}, cella, { pieceY: 120001, viceClawLength: 150001, gripperClawLength: 30001 }), st: 'OK' },
];
for (const c of casi) {
	const a = srv.pushQuotes(c.v), b = hmi.pushQuotes(c.v);
	check(a.status === c.st, c.name + ' -> ' + a.status);
	check(JSON.stringify(a) === JSON.stringify(b), '  parita\' server/pannello: ' + JSON.stringify(a));
}
check(srv.pushQuotes(casi[0].v).xPush === null && srv.pushQuotes(casi[6].v).xStop === null, 'quote NULL quando l\'esito non e\' OK (come la vista)');
check(srv.PUSH_BIT === 2 && hmi.PUSH_BIT === 2, 'bit 1 di OPTION2 (valore 2), il bit 0 resta al gripper doppio');
check(srv.isPushEnabled(2) && srv.isPushEnabled(3) && !srv.isPushEnabled(1) && !srv.isPushEnabled(0), 'isPushEnabled legge il solo bit 1 (3 = gripper doppio + spinta)');

console.log('\n2) insertOrder: istantanea dal pezzo e guardie');
const ORD = { pieceID: '1029', gripperID: '26', viceID: '0', fixtureID: '1', palletID: '9', machineID: '1', quantity: '3', PP: '12' };
let r = call('GET /insertOrder', ORD, [{ recordset: [{ ris: 'OK' }] }]);
let t = r.q[0];
check(/DECLARE @push int = ISNULL\(\(SELECT CASE WHEN PUSH_TO_STOP = 1 THEN 2 ELSE 0 END FROM PIECE WHERE ID=1029\), 0\)/.test(t), 'il bit lo legge il SQL dall\'anagrafica pezzo: istantanea non falsificabile dal client');
check(/DECLARE @claw int = \(SELECT TOP 1 CLAW_LENGTH FROM VICE WHERE PALLET_ID=9\)/.test(t), 'ganascia morsa dal pallet dell\'ordine');
check(/DECLARE @tool int = \(SELECT TOP 1 CLAW_LENGTH FROM GRIPPER WHERE ID=26\)/.test(t), 'lunghezza chela dalla pinza dell\'ordine');
check(/DECLARE @pieceY int = \(SELECT TOP 1 Y FROM PIECE WHERE ID=1029\)/.test(t), 'dal pezzo entra la Y, quella che corre lungo la X del robot');
check(!/SELECT TOP 1 X FROM PIECE/.test(t), 'PIECE.X non entra nel conto della spinta');
check(/ELSE IF @push <> 0 AND \(ISNULL\(@claw,0\) <= 0 OR ISNULL\(@tool,0\) <= 0 OR ISNULL\(@pieceY,0\) <= 0\) SELECT 'KO_PUSH_NO_DATA'/.test(t), 'guardia dati mancanti');
check(/ELSE IF @push <> 0 AND \(@claw - @pieceY\) < 0 SELECT 'KO_PUSH_NO_FIT'/.test(t), 'guardia pezzo che non entra');
check(/PartProg_ID, DECLARED_PIECE_ID, OPTION1, OPTION2\)/.test(t) && /0, @push\s*\);/.test(t), 'OPTION1 0 e OPTION2 = istantanea scritti nella INSERT');
check(t.indexOf('@push') < t.indexOf('INSERT INTO WORKORDER'), 'le guardie girano PRIMA della INSERT');
r = call('GET /insertOrder', ORD, [{ recordset: [{ ris: errorCodes.KO_PUSH_NO_FIT }] }]);
check(r.res.body === errorCodes.KO_PUSH_NO_FIT && r.res.code === 200, 'esito applicativo inoltrato con stato 200');

console.log('\n3) colonne nuove scritte davvero');
r = call('GET /updatePiece', { ID: '1029', FAMILY: 'F', DESCR: 'D', PARTPROGRAM: '12', MC1_ONLY: '0', MC2_ONLY: '0', MC3_ONLY: '0', PRISMA: '1', X: '1', Y: '1', Z: '1', Z_PICK: '1', Z_PLACE: '1', PUSH_TO_STOP: '1' }, [{}]);
check(/PUSH_TO_STOP=CONVERT\(bit,'1'\)/.test(r.q[0]), 'pezzo: PUSH_TO_STOP in update');
r = call('GET /insertPiece', { FAMILY: 'F', DESCR: 'D', PARTPROGRAM: '12', MC1_ONLY: '0', MC2_ONLY: '0', MC3_ONLY: '0', PRISMA: '1', X: '1', Y: '1', Z: '1', Z_PICK: '1', Z_PLACE: '1' }, [{}]);
check(/, PUSH_TO_STOP\)/.test(r.q[0]) && /CONVERT\(bit,'0'\)\);/.test(r.q[0]), 'pezzo: colonna in insert, assente -> 0 (nessun ciclo)');
r = call('GET /updateVice', { ID: '1', FAMILY: 'M', DESCR: 'D', STATUS: '2', X: '1', Y: '1', Z: '1', Z_CLAW: '1', Z_SINK_CLAW: '1', MAG: '1', MAG_POS: '1', POS_PLANT: '1', CLAW_LENGTH: '150000' }, [{}]);
check(/CLAW_LENGTH=150000/.test(r.q[0]), 'morsa: ganascia in update');
r = call('GET /updateVice', { ID: '1', FAMILY: 'M', DESCR: 'D', STATUS: '2', X: '1', Y: '1', Z: '1', Z_CLAW: '1', Z_SINK_CLAW: '1', MAG: '1', MAG_POS: '1', POS_PLANT: '1', CLAW_LENGTH: '' }, [{}]);
check(/CLAW_LENGTH=NULL/.test(r.q[0]), 'morsa: campo vuoto -> NULL (non misurata)');
r = call('GET /updateGripper', { ID: '26', FAMILY: 'P', DESCR: 'D', X_BODY: '1', Y_BODY: '1', Z_BODY: '1', X_CLAW: '1', Y_CLAW: '1', Z_CLAW: '1', STATUS: '2', POS_MAG: '2', POS_PLANT: '0', STROKE_CLAW: '10000', TICKNESS_CLAW: '5000', CLAW_LENGTH: '30000' }, [{ rowsAffected: [1] }]);
check(/Stroke_CLAW=10000/.test(r.q[0]) && /Tickness_CLAW=5000/.test(r.q[0]), 'pinza: corsa e spessore ORA salvati (prima si perdevano in silenzio)');
check(/CLAW_LENGTH=30000/.test(r.q[0]), 'pinza: la LUNGHEZZA della chela arriva davvero alla UPDATE');
r = call('GET /updateGripper', { ID: '26', FAMILY: 'P', DESCR: 'D', X_BODY: '1', Y_BODY: '1', Z_BODY: '1', X_CLAW: '1', Y_CLAW: '1', Z_CLAW: '1', STATUS: '2', POS_MAG: '2', POS_PLANT: '0' }, [{ rowsAffected: [1] }]);
check(/Stroke_CLAW=Stroke_CLAW/.test(r.q[0]) && /Tickness_CLAW=Tickness_CLAW/.test(r.q[0]), 'pinza: client che non manda i campi NON azzera il dato a DB');
check(/CLAW_LENGTH=CLAW_LENGTH/.test(r.q[0]), 'pinza: nemmeno la lunghezza chela viene azzerata da un client vecchio');
r = call('GET /insertGripper', { FAMILY: 'P', DESCR: 'D', X_BODY: '1', Y_BODY: '1', Z_BODY: '1', X_CLAW: '1', Y_CLAW: '1', Z_CLAW: '1', STATUS: '2', POS_MAG: '0', POS_PLANT: '0' }, [{ rowsAffected: [1] }]);
check(/, Stroke_CLAW, Tickness_CLAW, CLAW_LENGTH\)/.test(r.q[0]) && /10000,\s*10000,/.test(r.q[0]), 'pinza: in INSERT..SELECT il fallback e\' il default di schema, non il nome colonna');
check(/10000,\s*NULL/.test(r.q[0]), 'pinza: lunghezza chela assente -> NULL, cioe\' non misurata (0 direbbe misurata e nulla)');
r = call('GET /insertGripper', { FAMILY: 'P', DESCR: 'D', X_BODY: '1', Y_BODY: '1', Z_BODY: '1', X_CLAW: '1', Y_CLAW: '1', Z_CLAW: '1', STATUS: '2', POS_MAG: '0', POS_PLANT: '0', CLAW_LENGTH: '30000' }, [{ rowsAffected: [1] }]);
check(/10000,\s*30000/.test(r.q[0]), 'pinza: lunghezza chela salvata anche in creazione');

console.log('\n4) lo script della vista non nasconde la definizione');
const view = fs.readFileSync(path.join(__dirname, 'scripts', 'coordinates-push-mc.sql'), 'utf8');
// i commenti PARLANO di WITH ENCRYPTION (per dire che non si usa): il controllo
// guarda il solo SQL eseguibile
const viewSql = view.split(/\r?\n/).filter(l => !/^\s*--/.test(l)).join('\n');
check(!/WITH\s+ENCRYPTION/i.test(viewSql), 'nessun WITH ENCRYPTION: la vista nasce IN CHIARO');
check(/ALTER VIEW dbo\.COORDINATES_PUSH_MC AS/.test(view) && /PUSH_STATUS/.test(view), 'definizione completa versionata nel repo');
check(/p\.X - pz\.Y\/2 - g\.CLAW_LENGTH\/2/.test(viewSql), 'quota di spinta identica alla formula del modulo condiviso: si muove la X');
check(/\(v\.CLAW_LENGTH - pz\.Y\)\/2/.test(viewSql), 'corsa identica alla formula del modulo condiviso');
check(!/p\.Y - pz\./.test(viewSql) && !/pz\.X/.test(viewSql), 'la vista non spinge sulla Y e non usa PIECE.X');
check(/RTRIM\(p\.PARENT\) = CONCAT\('MC_', w\.MACHINE_ID\)/.test(view), 'posizione legata alla macchina dell\'ordine (la query storica non filtrava)');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
