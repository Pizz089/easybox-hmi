// ============================================================================
// test_reset_cmds.js — comandi di ripristino operatore (1/9):
//   POST /api/order/resetProduction/:machineId   (Order.js)
//   GET  /api/order/resetProduction/preview/:mc  (Order.js)
//   POST /api/conf/position/resetTray/:floor     (Position.js)
// NON richiede DB: express/mssql/DBFunct/LogFunct sono stub; le route sono
// REALI, la query viene catturata e l'esito programmato dal recordset finto.
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');

const routes = {};
const queries = [];
let nextResult = { recordset: [], recordsets: [] };
const emitted = [];
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
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: e => emitted.push(e), on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
const errorCodes = require(path.join(__dirname, 'errorCodes.js'));
require(path.join(__dirname, 'WORKORDER', 'Order.js'));
require(path.join(__dirname, 'CONF', 'Position.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
function call(key, params, result) {
	nextResult = result;
	const before = queries.length;
	const res = { body: null, send(b) { this.body = b; }, json(o) { this.body = o; }, status() { return this; } };
	routes[key]({ params, query: params }, res);
	return { res, ranQuery: queries.length > before, query: queries[queries.length - 1] };
}
const strip = s => s.replace(/\s+/g, ' ');

console.log('1) AZZERA PRODUZIONE: guardia cella ferma, transazione, esito');
let r = call('POST /resetProduction/:machineId', { machineId: '1' }, { recordset: [{ ris: 'OK', orders: 2, positions: 5 }] });
let q = strip(r.query);
check(r.ranQuery, 'query eseguita');
check(/IF \(SELECT COUNT\(\*\) FROM UNIT_STATUS WHERE UNIT='ROBOT' AND STATUS IS NOT NULL AND STATUS NOT IN \(3,6\)\) = 0 SELECT 'KO_CELL_RUNNING'/.test(q), 'guardia: robot in missione (3/6) o stato ignoto -> KO_CELL_RUNNING, prima di tutto');
check(/ELSE BEGIN SET XACT_ABORT ON; BEGIN TRAN;[\s\S]*COMMIT TRAN;/.test(q), 'scritture in UNA transazione (XACT_ABORT + BEGIN/COMMIT TRAN)');
check(/UPDATE \[POSITION\] SET Order_ID=0 WHERE Order_ID IN \(SELECT ID FROM WORKORDER WHERE STATUS=3 AND MACHINE_ID=1\)/.test(q), 'posizioni svincolate (Order_ID=0) degli ordini STATUS=3 della macchina');
check(/UPDATE WORKORDER SET STATUS=7 WHERE STATUS=3 AND MACHINE_ID=1/.test(q) && !/DELETE FROM WORKORDER/.test(q), 'ordini STATUS=3 -> 7 sulla base table, NESSUNA delete');
check(q.indexOf('UPDATE [POSITION]') < q.indexOf('UPDATE WORKORDER'), 'prima le posizioni (la sottoquery vede ancora STATUS=3), poi gli ordini');
check(/DECLARE @o INT[\s\S]*DECLARE @p INT[\s\S]*UPDATE \[POSITION\]/.test(q), 'conteggi letti PRIMA delle scritture (trigger su POSITION)');
check(r.res.body && r.res.body.ris === 'OK' && r.res.body.orders === 2 && r.res.body.positions === 5, 'esito OK con conteggi veri');
check(emitted.includes('PRODUCTION/CHANGED'), 'PRODUCTION/CHANGED emesso (la tabella si aggiorna)');
emitted.length = 0;
r = call('POST /resetProduction/:machineId', { machineId: '1' }, { recordset: [{ ris: errorCodes.KO_CELL_RUNNING, orders: 0, positions: 0 }] });
check(r.res.body.ris === errorCodes.KO_CELL_RUNNING && !emitted.includes('PRODUCTION/CHANGED'), 'cella in lavorazione -> KO_CELL_RUNNING, niente evento');
r = call('POST /resetProduction/:machineId', { machineId: 'x' }, {});
check(!r.ranQuery && r.res.body === 'KO_BAD_INPUT', 'machineId non intero -> KO_BAD_INPUT senza query');

console.log('\n2) anteprima con numeri veri');
r = call('GET /resetProduction/preview/:machineId', { machineId: '1' }, {
	recordsets: [[{ ID: 12, PIECE_ID: 1029, PIECE: 'Pezzo di prova Rizzo' }], [{ n: 7 }], [{ STATUS: 15 }]],
});
q = strip(r.query);
check(/SELECT ID, PIECE_ID, PIECE FROM WORKORDERS WHERE STATUS=3 AND MACHINE_ID=1/.test(q) && /SELECT COUNT\(\*\) AS n FROM \[POSITION\] WHERE Order_ID IN/.test(q), 'legge ordini (ID, pezzo) e posizioni dalla view');
check(r.res.body.orders.length === 1 && r.res.body.orders[0].ID === 12 && r.res.body.positions === 7, 'anteprima: 1 ordine (#12), 7 posizioni');
check(r.res.body.blocked === null && r.res.body.robotStatus === 15, 'robot 15 (pronto in automatico, fermo): non bloccato');
r = call('GET /resetProduction/preview/:machineId', { machineId: '1' }, { recordsets: [[], [{ n: 0 }], [{ STATUS: 3 }]] });
check(r.res.body.blocked === errorCodes.KO_CELL_RUNNING, 'robot 3 (in missione): anteprima marcata bloccata');
r = call('GET /resetProduction/preview/:machineId', { machineId: '1' }, { recordsets: [[], [{ n: 0 }], []] });
check(r.res.body.blocked === errorCodes.KO_CELL_RUNNING && r.res.body.robotStatus === null, 'stato robot ignoto: bloccata');

console.log('\n3) AZZERA STATO CASSETTO: guardia ordine attivo, STATUS=4 + Order_ID=0');
r = call('POST /resetTray/:floor', { floor: '9' }, { recordset: [{ ris: 'OK', positions: 91 }] });
q = strip(r.query);
check(/IF EXISTS \(SELECT 1 FROM WORKORDERS WHERE STATUS=3\) SELECT 'KO_ACTIVE_ORDER'/.test(q), 'guardia: ordine in STATUS=3 -> KO_ACTIVE_ORDER, prima dell\'update');
check(/UPDATE \[POSITION\] SET STATUS=4, Order_ID=0 WHERE \(PARENT = 'TRAY_9'\)/.test(q), 'tutte le tasche del cassetto 9: STATUS=4 e Order_ID=0 (predicato canonico)');
check(q.indexOf('DECLARE @n INT') < q.indexOf('UPDATE [POSITION]'), 'conteggio prima dell\'update');
check(r.res.body.ris === 'OK' && r.res.body.positions === 91, 'esito OK con 91 tasche');
r = call('POST /resetTray/:floor', { floor: '9' }, { recordset: [{ ris: errorCodes.KO_ACTIVE_ORDER, positions: 0 }] });
check(r.res.body.ris === errorCodes.KO_ACTIVE_ORDER, 'ordine attivo -> KO_ACTIVE_ORDER');
r = call('POST /resetTray/:floor', { floor: '13' }, {});
check(!r.ranQuery && r.res.body === 'KO_BAD_INPUT', 'cassetto fuori range -> KO_BAD_INPUT senza query');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
