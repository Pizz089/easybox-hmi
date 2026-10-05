// ============================================================================
// test_order_relaunch.js — Rilancia ordine finito (P2 5/10)
//
// Rifare lo stesso lotto quando l'ordine e' finito (STATUS 5). Due modi:
//   replaced : "ho rimesso i grezzi al posto dei finiti" -> le tasche finite
//              dell'ordine tornano a 4 e restano legate all'ordine;
//   available: "uso i grezzi che ci sono" -> le tasche finite restano a 5 ma
//              si scollegano (Order_ID=0); senza grezzi -> KO_NO_RAW.
// In entrambi l'ordine va a 6 (pausa): riparte solo col Play.
//
// Qui si verifica la COMPOSIZIONE delle query (guardie, conteggi prima delle
// scritture, transazione con XACT_ABORT) e la gestione delle risposte: OK con
// log ed emit, i tre rifiuti richiesti (ordine non finito, cella in lavoro,
// nessun grezzo) passati al pannello col loro codice, input validato.
//
// Uso:   node test_order_relaunch.js
// NON richiede DB ne' backend attivo (stessi stub di test_http_status).
// ============================================================================

const Module = require('module');
const path = require('path');

const routes = {};
const queries = [];
const emitted = [];
const logs = [];
let results = [];
let queryErr = null;
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(queryErr, results.length ? results.shift() : { recordset: [] }); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: ev => emitted.push(ev), on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: s => logs.push(s), error: s => logs.push(s), info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
const SRV = __dirname;
require(path.join(SRV, 'WORKORDER/Order.js'));
const ERR = require(path.join(SRV, 'errorCodes.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
function call(key, params, query, resultQueue) {
	results = resultQueue || [];
	queries.length = 0; emitted.length = 0; logs.length = 0;
	const res = { code: 200, body: null, status(n) { this.code = n; return this; }, send(b) { this.body = b; }, json(o) { this.body = o; } };
	routes[key]({ params: params || {}, query: query || {}, body: {} }, res);
	return res;
}
const flat = q => q.replace(/\s+/g, ' ');
const before = (q, a, b) => q.indexOf(a) >= 0 && q.indexOf(b) > q.indexOf(a);

console.log('0) codici nuovi in tutte e due le copie');
const hmi = require('fs').readFileSync(path.join(SRV, '../HMI/src/util/errorCodes.js'), 'utf8');
for (const k of ['KO_ORDER_NOT_FINISHED', 'KO_NO_RAW'])
	check(ERR[k] === k && new RegExp('export const ' + k + '\\s*=\\s*"' + k + '"').test(hmi), k + ' in serverDati e HMI');

console.log('\n1) input validato come resetProduction');
for (const [id, mode] of [['0', 'replaced'], ['-3', 'replaced'], ['1.5', 'replaced'], ['abc', 'replaced'], ['12', 'boh'], ['12', undefined]]) {
	const r = call('POST /relaunch/:orderId', { orderId: id }, { mode });
	check(r.code === 400 && queries.length === 0, `ordine ${id} mode ${mode} -> ${r.code}, nessuna query`);
}
let r = call('GET /relaunch/preview/:orderId', { orderId: 'x' });
check(r.code === 400 && queries.length === 0, 'anteprima con ID non intero -> 400');

console.log('\n2) query del mode replaced');
r = call('POST /relaunch/:orderId', { orderId: '42' }, { mode: 'replaced' }, [{ recordset: [{ ris: 'OK', finished: 24, raw: 0, quantity: 24 }] }]);
let q = flat(queries[0] || '');
check(/DECLARE @id INT = 42;/.test(q), 'ordine passato come intero validato');
check(before(q, 'SET XACT_ABORT ON;', 'BEGIN TRAN;'), 'XACT_ABORT prima della transazione');
check(/FROM WORKORDER WITH \(UPDLOCK, HOLDLOCK\) WHERE ID=@id/.test(q), 'ordine letto con UPDLOCK dentro la transazione (scrittura sulla base table)');
check(before(q, 'BEGIN TRAN;', "WHEN @st<>5 THEN '" + ERR.KO_ORDER_NOT_FINISHED + "'"), 'guardia ordine finito dentro la transazione');
check(q.includes("THEN '" + ERR.KO_NOT_FOUND + "'"), 'ordine inesistente -> KO_NOT_FOUND');
check(/UNIT='ROBOT' AND STATUS IS NOT NULL AND STATUS NOT IN \(3,6\)\) = 0 THEN 'KO_CELL_RUNNING'/.test(q), 'guardia cella ferma = cellRunningGuard di resetProduction');
check(/STATUS=3 AND MACHINE_ID=@mc AND ID<>@id\) THEN 'KO_ACTIVE_ORDER'/.test(q), 'nessun ALTRO ordine a 3 sulla stessa macchina');
check(before(q, 'DECLARE @fin', 'UPDATE [POSITION]') && before(q, 'DECLARE @raw', 'UPDATE [POSITION]'), 'conteggi PRIMA delle UPDATE (trigger su [POSITION])');
check(/@fin INT = \(SELECT COUNT\(\*\) FROM \[POSITION\] WHERE STATUS=5 AND Order_ID=@id\)/.test(q), 'finiti = tasche a 5 dell\'ordine');
check(/@raw INT = \(SELECT COUNT\(\*\) FROM \[POSITION\] WHERE PARENT LIKE 'TRAY%' AND STATUS=4 AND Part_Type=@piece AND Order_ID IN \(0, @id\)\)/.test(q), 'grezzi = tasche di cassetto a 4 del pezzo, libere o dell\'ordine');
check(q.includes('UPDATE [POSITION] SET STATUS=4 WHERE STATUS=5 AND Order_ID=@id;'), 'replaced: finiti -> 4, restano legati all\'ordine');
check(!q.includes('SET Order_ID=0'), 'replaced: nessuno scollegamento');
check(!q.includes(ERR.KO_NO_RAW), 'replaced: niente guardia sui grezzi');
check(q.includes('UPDATE WORKORDER SET STATUS=6 WHERE ID=@id AND STATUS=5;'), 'ordine -> 6 (pausa), solo se ancora a 5');
check(/IF @ko IS NOT NULL BEGIN ROLLBACK TRAN;/.test(q), 'rifiuto -> ROLLBACK, niente scritto');
check(r.body && r.body.ris === 'OK', 'risposta OK passata al pannello');
check(emitted.includes('PRODUCTION/CHANGED'), 'emit PRODUCTION/CHANGED');
check(logs.some(s => /RILANCIA ORDINE 42 \(replaced\)/.test(s) && /24 tasche finite/.test(s)), 'log standard con i numeri');

console.log('\n3) query del mode available');
r = call('POST /relaunch/:orderId', { orderId: '42' }, { mode: 'available' }, [{ recordset: [{ ris: 'OK', finished: 24, raw: 10, quantity: 24 }] }]);
q = flat(queries[0] || '');
check(q.includes('UPDATE [POSITION] SET Order_ID=0 WHERE STATUS=5 AND Order_ID=@id;'), 'available: finiti restano a 5 ma scollegati');
check(!q.includes('SET STATUS=4'), 'available: i finiti NON tornano grezzi');
check(q.includes("IF @ko IS NULL AND @raw=0 SET @ko='" + ERR.KO_NO_RAW + "';"), 'available senza grezzi -> KO_NO_RAW');
check(before(q, "SET @ko='" + ERR.KO_NO_RAW + "'", 'IF @ko IS NOT NULL BEGIN'), 'KO_NO_RAW valutato prima delle scritture');
check(q.includes('UPDATE WORKORDER SET STATUS=6 WHERE ID=@id AND STATUS=5;'), 'ordine -> 6 (pausa)');

console.log('\n4) i tre rifiuti arrivano al pannello col loro codice, senza emit');
for (const [mode, code, label] of [
	['replaced', ERR.KO_ORDER_NOT_FINISHED, 'ordine non finito'],
	['available', ERR.KO_CELL_RUNNING, 'cella in lavoro'],
	['available', ERR.KO_NO_RAW, 'nessun grezzo'],
]) {
	r = call('POST /relaunch/:orderId', { orderId: '7' }, { mode }, [{ recordset: [{ ris: code, finished: 3, raw: 0, quantity: 3 }] }]);
	check(r.code === 200 && r.body.ris === code && !emitted.includes('PRODUCTION/CHANGED'), `${label} -> 200 ${code}, nessun emit`);
	check(logs.some(s => s.includes('rifiutato: ' + code)), `${label}: riga di log del rifiuto`);
}

console.log('\n5) anteprima: stessi conteggi, nessuna scrittura');
r = call('GET /relaunch/preview/:orderId', { orderId: '42' }, {}, [{ recordset: [{ blocked: null, status: 5, machineId: 1, pieceId: 9, finished: 24, raw: 10, quantity: 24, piece: 'P' }] }]);
q = flat(queries[0] || '');
check(!/UPDATE|INSERT|DELETE|BEGIN TRAN/.test(q), 'nessuna scrittura e nessuna transazione');
check(!/UPDLOCK/.test(q), 'nessun lock in lettura');
check(q.includes("WHEN @st<>5 THEN '" + ERR.KO_ORDER_NOT_FINISHED + "'") && q.includes("THEN 'KO_CELL_RUNNING'"), 'stesse guardie del rilancio (motivo del blocco)');
check(r.body && r.body.finished === 24 && r.body.raw === 10 && r.body.quantity === 24, 'numeri veri passati al dialog');

console.log('\n6) errore SQL -> 500, nessun emit');
queryErr = new Error('boom');
r = call('POST /relaunch/:orderId', { orderId: '42' }, { mode: 'replaced' });
check(r.code === 500 && !emitted.length, 'rilancio con errore SQL -> ' + r.code + ', nessun emit');
r = call('GET /relaunch/preview/:orderId', { orderId: '42' });
check(r.code === 500, 'anteprima con errore SQL -> ' + r.code);
queryErr = null;

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
