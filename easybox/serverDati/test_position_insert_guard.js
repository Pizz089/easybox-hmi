// ============================================================================
// test_position_insert_guard.js — insert idempotente delle tasche (4/9) e
// SUB_POS nella SELECT del layout. Route reali (CONF/Position.js, CONF/
// Tray.js) con express/mssql a stub.
//
// Uso:   node test_position_insert_guard.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');

const routes = {};
const queries = [];
let nextResult = { recordset: [], rowsAffected: [1] };
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(null, nextResult); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
require(path.join(__dirname, 'CONF', 'Position.js'));
require(path.join(__dirname, 'CONF', 'Tray.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
function call(key, params, result) {
	nextResult = result;
	const before = queries.length;
	const res = { body: null, send(b) { this.body = b; }, json(o) { this.body = o; }, status() { return this; } };
	routes[key]({ params, query: params }, res);
	return { res, ranQuery: queries.length > before, query: (queries[queries.length - 1] || '').replace(/\s+/g, ' ') };
}
const goodInsert = { TRAY_ID: '12', POS: '1', SUB_POS: '5', STATUS: '2', X: '50000', Y: '179000', PIECE_TYPE: '1030' };

console.log('1) insertPositionTray IDEMPOTENTE su (PARENT, SUB_POS)');
let r = call('GET /insertPositionTray', goodInsert, { recordset: [], rowsAffected: [1] });
check(r.ranQuery, 'query eseguita');
check(/WHERE NOT EXISTS \(SELECT 1 FROM \[POSITION\] px WHERE \(px\.PARENT = 'TRAY_12'\) AND px\.SUB_POS=5\)/.test(r.query), "guardia NOT EXISTS su PARENT='TRAY_12' + SUB_POS=5 (predicato canonico)");
check(/INSERT INTO \[POSITION\]/.test(r.query) && /COALESCE\(t\.X_ROT,0\)/.test(r.query), 'INSERT...SELECT con eredita teaching INVARIATO');
check(r.res.body === 'OK', 'riga nuova (rowsAffected 1) -> OK');
r = call('GET /insertPositionTray', goodInsert, { recordset: [], rowsAffected: [0] });
check(r.res.body === 'KO_DUP', "riga gia' presente (rowsAffected 0) -> KO_DUP, nessun duplicato");
r = call('GET /insertPositionTray', Object.assign({}, goodInsert, { TRAY_ID: '13' }), {});
check(!r.ranQuery && r.res.body === 'KO_BAD_INPUT', 'cassetto fuori range -> KO_BAD_INPUT senza query');
r = call('GET /insertPositionTray', Object.assign({}, goodInsert, { SUB_POS: '0' }), {});
check(!r.ranQuery && r.res.body === 'KO_BAD_INPUT', 'SUB_POS non valido -> KO_BAD_INPUT senza query');
r = call('GET /insertPositionTray', Object.assign({}, goodInsert, { SUB_POS: '5; DROP' }), {});
check(!r.ranQuery && r.res.body === 'KO_BAD_INPUT', 'SUB_POS non intero -> KO_BAD_INPUT senza query');

console.log('\n2) endpoint layout: SUB_POS nella SELECT, vista e ordinamento invariati');
r = call('GET /layout/:trayID', { trayID: '12' }, { recordset: [] });
check(/select partType,prisma,x_pick\/1000 as x,Y_PICK\/1000 as y, status, order_ID, FLOOR_MAG, SUB_POS from COORDINATES_PIECES_TRAYS/.test(r.query), 'SELECT con SUB_POS dalla STESSA vista');
check(/order by SUB_POS;/.test(r.query), 'ordinamento per SUB_POS invariato');

console.log('\nX) declareTrayType: il CONTENUTO del cassetto, a cassetto chiuso (16/9)');
// PERCHE'. POSITION.Part_Type e' il codice che il cassetto contiene: il ciclo
// cerca STATUS=4 AND Part_Type=<pezzo dell'ordine>, e la vista 4Robot ci
// aggancia PIECE per sapere a che quota scendere. Finora si cambiava solo
// riassociando il grigliato — cioe' rifacendo l'attrezzaggio per svuotare un
// cassetto e riempirlo con un altro particolare. Il grigliato e' la geometria
// e non cambia: cambia cosa c'e' dentro.
// A cassetto FUORI la stessa dichiarazione la fa il PLC col comando 44; qui
// c'e' la strada a cassetto CHIUSO, quella che serve preparando la produzione.
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '1033' }, { recordset: [{ ris: 'OK', positions: 91 }] });
check(r.ranQuery && r.res.body.ris === 'OK' && r.res.body.positions === 91, 'una sola query, risposta {ris, positions}');
check(/UPDATE \[POSITION\] SET Part_Type=1033 WHERE \(PARENT = 'TRAY_12'\);/.test(r.query), 'scrive Part_Type su TUTTE le tasche del cassetto (predicato canonico)');
check(!/STATUS=/.test(r.query) && !/Order_ID=/.test(r.query), 'e NON tocca stato ne\' ordine: dire cosa c\'e\' dentro non e\' dire quanto ce n\'e\'');
check(/IF NOT EXISTS \(SELECT 1 FROM PIECE WHERE ID=1033\)[\s\S]*KO_NO_PIECE_DECLARED/.test(r.query), 'guardia: un codice inesistente renderebbe il cassetto invisibile al ciclo');
check(/ELSE IF @extract <> 0[\s\S]*KO_TRAY_EXTRACTED/.test(r.query), 'guardia: a cassetto fuori o in manovra si passa dal comando 44');
check(/JOIN WORKORDERS w ON w\.ID = p\.Order_ID WHERE \(p\.PARENT = 'TRAY_12'\) AND w\.STATUS = 3[\s\S]*KO_ACTIVE_ORDER/.test(r.query), 'guardia: non si cambia il pezzo sotto un ordine in corso (il PLC legge POSITION in tempo reale)');
check(/DECLARE @n INT = \(SELECT COUNT\(\*\) FROM \[POSITION\]/.test(r.query), 'conteggio con COUNT esplicita: su [POSITION] c\'e\' POSITION_trig e rowsAffected mente');
// input: niente path param grezzi in query
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '13', pieceId: '1033' }, {});
check(!r.ranQuery && r.res.body.ris === 'KO_BAD_INPUT', 'cassetto fuori range -> KO_BAD_INPUT senza query');
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '0' }, {});
check(!r.ranQuery && r.res.body.ris === 'KO_BAD_INPUT', 'codice 0 -> KO_BAD_INPUT: e\' il valore che rende invisibili le tasche');
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: 'x' }, {});
check(!r.ranQuery && r.res.body.ris === 'KO_BAD_INPUT', 'codice non intero -> KO_BAD_INPUT');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
