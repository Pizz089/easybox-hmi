// ============================================================================
// test_order_decentrated.js — gli 8 decentramenti X/Y dell'ordine sono 0
// FISSI nel backend (insertOrder / updateOrder): nessun valore dal payload
// puo' entrare. Route reali (WORKORDER/Order.js) con express/mssql a stub.
//
// Uso:   node test_order_decentrated.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');

const routes = {};
const queries = [];
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(null, { recordset: [], rowsAffected: [1] }); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
require(path.join(__dirname, 'WORKORDER', 'Order.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const res = () => ({ body: null, send(b) { this.body = b; }, json(o) { this.body = o; }, status() { return this; } });
const strip = s => s.replace(/\s+/g, ' ');
const COLS = ['X_PICK_DECENTRATED_TRAY', 'X_PLACE_DECENTRATED_TRAY', 'Y_PICK_DECENTRATED_TRAY', 'Y_PLACE_DECENTRATED_TRAY',
	'X_PICK_DECENTRATED_MC', 'X_PLACE_DECENTRATED_MC', 'Y_PICK_DECENTRATED_MC', 'Y_PLACE_DECENTRATED_MC'];

// payload "ostile": un vecchio client (o un curl) manda decentramenti != 0
const hostile = {
	pieceID: 1029, gripperID: 26, viceID: 0, fixtureID: 0, palletID: 5, machineID: 1, quantity: 3, PP: 12, declaredPieceID: 0, status: 4, ID: 77,
	decentrated_tray_x_pick: 500, decentrated_tray_y_pick: 600, decentrated_tray_x_place: 700, decentrated_tray_y_place: 800,
	decentrated_MC_x_pick: 900, decentrated_MC_y_pick: 1000, decentrated_MC_x_place: 1100, decentrated_MC_y_place: 1200,
};

console.log('1) insertOrder: colonne presenti nello schema del comando, valori 0 fissi');
routes['GET /insertOrder']({ query: hostile }, res());
let q = strip(queries[queries.length - 1]);
check(/INSERT INTO WORKORDER/.test(q), 'INSERT sulla base table WORKORDER');
check(COLS.every(c => q.includes(c)), 'le 8 colonne restano nell\'elenco colonne (schema invariato)');
check(/'3', 0, 0, 0, 0, 0, 0, 0, 0, 12,/.test(q), 'dopo QUANTITY: otto 0 letterali, poi PartProg_ID');
check(!/500|600|700|800|900|1000|1100|1200/.test(q), 'nessun valore del payload (500..1200) e\' entrato nella query');
check(q.includes("'1029'") && q.includes("'26'") && q.includes("'5'") && q.includes("'3'"), 'gli altri campi (pezzo, pinza, pallet, quantita\') passano regolarmente');

console.log('\n2) updateOrder: stesse colonne, 0 fissi');
routes['GET /updateOrder']({ query: hostile }, res());
q = strip(queries[queries.length - 1]);
check(/UPDATE WORKORDER SET/.test(q), 'UPDATE sulla base table WORKORDER');
check(COLS.every(c => new RegExp(c + '=0,').test(q)), 'tutte e otto le colonne = 0');
check(!/500|600|700|800|900|1000|1100|1200/.test(q), 'nessun valore del payload e\' entrato');
check(/QUANTITY='3'/.test(q) && /WHERE ID='77'/.test(q), 'quantita\' e ID passano regolarmente');

console.log('\n3) payload SENZA i campi (client nuovo): identico');
const clean = Object.assign({}, hostile);
for (const k of Object.keys(clean)) if (k.startsWith('decentrated_')) delete clean[k];
routes['GET /insertOrder']({ query: clean }, res());
const qClean = strip(queries[queries.length - 1]);
routes['GET /insertOrder']({ query: hostile }, res());
check(qClean === strip(queries[queries.length - 1]), 'insert con e senza decentramenti nel payload: query identica');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
