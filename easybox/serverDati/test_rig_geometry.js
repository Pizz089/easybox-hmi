// ============================================================================
// test_rig_geometry.js — cantiere rig-two-aspects (15/9), lato backend.
//
//  1. updateFixtureOnPallet e' un UPSERT: aggiorna gli offset se la riga c'e',
//     la CREA se manca. Prima faceva solo l'UPDATE, con una WHERE che cercava
//     la stessa coppia che stava scrivendo: associare un'attrezzatura a un
//     pallet nuovo toccava zero righe e rispondeva "OK" (incidente pallet 9).
//  2. insertOrder / updateOrder rifiutano un ordine senza geometria
//     (KO_NO_FIXTURE): il PLC fa un join INTERNO su FIXTURE per la quota di
//     deposito, con FIXTURE_ID 0 va in errore 799 col robot in movimento.
//
// Route reali, express/mssql a stub.
// Uso:   node test_rig_geometry.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');

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
require(path.join(__dirname, 'CONF', 'Fixture.js'));
require(path.join(__dirname, 'WORKORDER', 'Order.js'));
const errorCodes = require(path.join(__dirname, 'errorCodes.js'));

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

console.log('1) updateFixtureOnPallet: UPSERT (era un update che non creava mai la riga)');
let r = call('GET /updateFixtureOnPallet', { PALLET_ID: '9', FIXTURE_ID: '1', POS_X: '1.5', POS_Y: '0', POS_Z: '0', POS_X_CORR: '0', POS_Y_CORR: '0', POS_Z_CORR: '0', POS_X_ROT: '0', POS_Y_ROT: '0', POS_Z_ROT: '0' }, [{ recordset: [{ ris: 'OK' }] }]);
let t = r.q[0];
check(r.n === 1 && r.res.body === 'OK' && r.res.code === 200, 'una query, esito OK');
check(/UPDATE FIXTURE_ON_PALLET SET POS_X=1\.5\*1000/.test(t), 'UPDATE dei soli offset, quote in micron (*1000)');
check(!/SET[\s\S]*PALLET_ID=|SET[\s\S]*FIXTURE_ID=/.test(t.split('WHERE')[0]), 'PALLET_ID/FIXTURE_ID NON sono nella SET: sono la chiave');
check(/WHERE FIXTURE_ID=1 AND PALLET_ID=9;/.test(t), 'chiave della UPDATE = coppia (pallet, attrezzatura)');
check(/IF @@ROWCOUNT = 0 INSERT INTO FIXTURE_ON_PALLET \(PALLET_ID, FIXTURE_ID, POS_X, POS_Y, POS_Z, POS_X_CORR, POS_Y_CORR, POS_Z_CORR, POS_X_ROT, POS_Y_ROT, POS_Z_ROT\) VALUES\(9, 1,/.test(t), 'se non c\'era niente da aggiornare: INSERT della riga (e\' il fix del 15/9)');
r = call('GET /updateFixtureOnPallet', { POS_PLANT: '9', ID: '1', POS_X: '0', POS_Y: '0', POS_Z: '0' }, [{ recordset: [{ ris: 'OK' }] }]);
check(/WHERE FIXTURE_ID=1 AND PALLET_ID=9;/.test(r.q[0]), 'firma storica POS_PLANT/ID ancora accettata (FixtureOnPallet.vue)');
r = call('GET /updateFixtureOnPallet', { PALLET_ID: 'x', FIXTURE_ID: '1' }, []);
check(r.n === 0 && r.res.body === 'KO_BAD_INPUT', 'pallet non numerico -> KO_BAD_INPUT senza query');

console.log('\n2) ordine senza geometria: rifiutato prima di scrivere');
const ORD = { pieceID: '1029', gripperID: '26', viceID: '0', palletID: '9', machineID: '1', quantity: '3', PP: '12', status: '4', ID: '77' };
r = call('GET /insertOrder', Object.assign({}, ORD, { fixtureID: '0' }), []);
check(r.n === 0 && r.res.body === errorCodes.KO_NO_FIXTURE, 'insertOrder con FIXTURE_ID 0 -> KO_NO_FIXTURE, nessuna query');
r = call('GET /insertOrder', Object.assign({}, ORD, { fixtureID: '' }), []);
check(r.n === 0 && r.res.body === errorCodes.KO_NO_FIXTURE, 'insertOrder senza FIXTURE_ID -> KO_NO_FIXTURE');
r = call('GET /updateOrder', Object.assign({}, ORD, { fixtureID: '0' }), []);
check(r.n === 0 && r.res.body === errorCodes.KO_NO_FIXTURE, 'updateOrder con FIXTURE_ID 0 -> KO_NO_FIXTURE (non si puo\' rompere un ordine sano)');

console.log('\n3) ordine con geometria: guardia in SQL sull\'esistenza della riga FIXTURE');
r = call('GET /insertOrder', Object.assign({}, ORD, { fixtureID: '1' }), [{ recordset: [{ ris: 'OK' }] }]);
t = r.q[0];
check(r.n === 1 && r.res.body === 'OK', 'ordine creato');
check(/IF NOT EXISTS \(SELECT 1 FROM FIXTURE WHERE ID=1\) SELECT 'KO_NO_FIXTURE' AS ris; ELSE BEGIN INSERT INTO WORKORDER/.test(t), 'la guardia gira PRIMA della INSERT, nello stesso batch');
check(/VALUES\( '1029', '26', '0', 1, '9',/.test(t), 'FIXTURE_ID scritto come intero validato, non come stringa del payload');
r = call('GET /insertOrder', Object.assign({}, ORD, { fixtureID: '99' }), [{ recordset: [{ ris: errorCodes.KO_NO_FIXTURE }] }]);
check(r.res.body === errorCodes.KO_NO_FIXTURE, 'attrezzatura inesistente a DB -> KO_NO_FIXTURE dal SQL');
r = call('GET /updateOrder', Object.assign({}, ORD, { fixtureID: '1' }), [{ recordset: [{ ris: 'OK' }] }]);
check(/IF NOT EXISTS \(SELECT 1 FROM FIXTURE WHERE ID=1\)/.test(r.q[0]) && /FIXTURE_ID=1,/.test(r.q[0]), 'updateOrder: stessa guardia, FIXTURE_ID intero');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
