// ============================================================================
// test_tray_predicate.js — test del predicato PARENT tasche cassetto
// (fix tray-parent-predicate) e della guardia ordine-attivo sulle delete.
//
// Uso:   node test_tray_predicate.js
//
// NON richiede DB ne' broker: mssql/express/DBFunct/LogFunct sono stub;
// trayParent.js e le route di CONF/Position.js e CONF/Grating.js sono REALI.
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');

// --- emulazione del confronto SQL sul dato reale di cella ---
// PARENT e' NCHAR(30): valore paddato a spazi. Equality ANSI ignora i
// trailing spaces di ENTRAMBI i lati.
const PLANT_PARENTS = ['TRAY_9'.padEnd(30), 'TRAY_10'.padEnd(30)];
function sqlEqualsMatches(predicate, value) {
	// predicate atteso: (PARENT = 'TRAY_<n>')
	const m = predicate.match(/^\((\S+) = '([^']*)'\)$/);
	if (!m) throw new Error('predicato non riconosciuto: ' + predicate);
	return value.replace(/\s+$/, '') === m[2].replace(/\s+$/, '');
}

// --- stub moduli ---
const routes = {};          // 'DELETE /path' -> handler
const queries = [];         // query SQL catturate
let nextRecordset = [];     // recordset della prossima request.query

const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req, parent) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(null, { recordset: nextRecordset, rowsAffected: [0] }); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};

const { trayParentPredicate } = require(path.join(__dirname, 'trayParent.js'));
const errorCodes = require(path.join(__dirname, 'errorCodes.js'));
require(path.join(__dirname, 'CONF', 'Position.js'));
require(path.join(__dirname, 'CONF', 'Grating.js'));

// --- check ---
let failed = 0;
function check(cond, label) {
	console.log((cond ? '  ok   ' : '  FAIL ') + label);
	if (!cond) failed++;
}
function callRoute(key, params, recordset) {
	nextRecordset = recordset;
	const before = queries.length;
	const res = { body: null, send(b) { this.body = b; }, status() { return this; } };
	routes[key]({ params: params, query: params }, res);
	return { res, ranQuery: queries.length > before, query: queries[queries.length - 1] };
}

console.log('1) helper: predicato per cassetti a una e due cifre');
check(trayParentPredicate(9) === "(PARENT = 'TRAY_9')", 'pred(9)');
check(trayParentPredicate(10) === "(PARENT = 'TRAY_10')", 'pred(10)');
check(trayParentPredicate('9') === "(PARENT = 'TRAY_9')", 'pred("9") da path param');
check(trayParentPredicate(9, 'p.PARENT') === "(p.PARENT = 'TRAY_9')", 'colonna qualificata');
check(sqlEqualsMatches(trayParentPredicate(9), PLANT_PARENTS[0]), 'pred(9) matcha TRAY_9 paddato');
check(!sqlEqualsMatches(trayParentPredicate(1), PLANT_PARENTS[1]), 'pred(1) NON raggiunge TRAY_10');
check(!sqlEqualsMatches(trayParentPredicate(9), PLANT_PARENTS[1]), 'pred(9) NON raggiunge TRAY_10');
check(sqlEqualsMatches(trayParentPredicate(10), PLANT_PARENTS[1]), 'pred(10) matcha TRAY_10 paddato');

console.log('\n2) helper: input invalidi -> null (niente SQL)');
for (const bad of [0, 13, -1, 1.5, '9; DROP TABLE POSITION', 'x', '', null, undefined])
	check(trayParentPredicate(bad) === null, 'null per ' + JSON.stringify(bad));

console.log('\n3) deletePositionsTray: guardia ordine attivo');
let r = callRoute('DELETE /deletePositionsTray/:ID', { ID: '9' }, [{ ris: errorCodes.KO_ACTIVE_ORDER }]);
check(r.ranQuery, 'query eseguita');
check(/IF EXISTS[\s\S]*STATUS = 3[\s\S]*ELSE[\s\S]*DELETE FROM \[POSITION\]/.test(r.query), 'guardia PRIMA della delete (IF EXISTS ... ELSE DELETE)');
check(r.query.includes("(PARENT = 'TRAY_9')") && r.query.includes("(p.PARENT = 'TRAY_9')"), 'predicato uguaglianza in guardia e delete');
check(!r.query.includes(" %'"), "niente LIKE ' %' residuo");
check(r.res.body === errorCodes.KO_ACTIVE_ORDER, 'ordine attivo -> body KO_ACTIVE_ORDER (delete bloccata)');
r = callRoute('DELETE /deletePositionsTray/:ID', { ID: '9' }, [{ ris: 'OK' }]);
check(r.res.body === 'OK', 'senza ordine attivo -> body OK (delete consentita)');
r = callRoute('DELETE /deletePositionsTray/:ID', { ID: '9; DROP' }, [{ ris: 'OK' }]);
check(!r.ranQuery && r.res.body === 'KO_BAD_INPUT', 'ID non intero -> KO_BAD_INPUT senza query');

console.log('\n4) delete grigliato (Grating /:ID): guardia ordine attivo');
r = callRoute('DELETE /:ID', { ID: '5' }, [{ ris: errorCodes.KO_ACTIVE_ORDER }]);
check(r.ranQuery, 'query eseguita');
check(/IF EXISTS[\s\S]*STATUS = 3[\s\S]*ELSE BEGIN[\s\S]*UPDATE TRAY[\s\S]*DELETE FROM \[POSITION\][\s\S]*DELETE FROM GRATING/.test(r.query), 'guardia PRIMA di update/delete');
check(r.query.includes("PARENT = CONCAT('TRAY_', @tray)"), 'predicato uguaglianza via CONCAT');
check(!r.query.includes(" %'"), "niente LIKE ' %' residuo");
check(r.res.body === errorCodes.KO_ACTIVE_ORDER, 'ordine attivo -> KO_ACTIVE_ORDER (nessuna scrittura)');
r = callRoute('DELETE /:ID', { ID: '5' }, [{ ris: 'OK' }]);
check(r.res.body === 'OK', 'senza ordine attivo -> OK');
r = callRoute('DELETE /:ID', { ID: 'abc' }, [{ ris: 'OK' }]);
check(!r.ranQuery && r.res.body === 'KO_BAD_INPUT', 'ID non intero -> KO_BAD_INPUT senza query');

console.log('\n5) updatePositionStatus / updatePositionTray: helper al posto del LIKE');
r = callRoute('GET /updatePositionStatus/:tray_ID/:position/:status', { tray_ID: '9', position: '1', status: '2' }, []);
check(r.ranQuery && r.query.includes("(PARENT = 'TRAY_9')"), 'updatePositionStatus usa il predicato');
r = callRoute('GET /updatePositionTray', { TRAY_ID: '10', POS: '1', SUB_POS: '1', STATUS: '2', X: '0', Y: '0', PIECE_TYPE: '1' }, []);
check(r.ranQuery && r.query.includes("(PARENT = 'TRAY_10')") && !r.query.includes(" %'"), 'updatePositionTray usa il predicato');
r = callRoute('GET /updatePositionTray', { TRAY_ID: 'zz' }, []);
check(!r.ranQuery && r.res.body === 'KO_BAD_INPUT', 'updatePositionTray con TRAY_ID invalido -> KO_BAD_INPUT');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
