// ============================================================================
// test_alarm_show.js — storico allarmi, GET /api/alarm/show/all (6/10).
//
// Tre difetti di alarm.js, con mssql ed express finti (nessun DB):
//   1. "order by Timestamp" ordinava sull'ALIAS testuale "dd/MM/yyyy ...",
//      cioe' per giorno del mese: il top 50 prendeva le righe sbagliate.
//      Sul clone del 6/10: in cima il 30/09 invece del 06/10, e solo 6 righe
//      in comune fra il vecchio top 50 e quello giusto. Ora LOG.data desc.
//   2. FORMAT con "hh": ora a 12 senza AM/PM. Ora "HH".
//   3. errore di connessione: log non era definito, la richiesta restava
//      appesa. Ora 500 e riga nel log, come gli altri router.
// Timestamp resta una STRINGA nello stesso formato dd/MM/yyyy HH:mm:ss: la
// legge AlarmsView del pannello v3 (unico consumatore).
//
// Uso:   node test_alarm_show.js
// ============================================================================
const Module = require('module');
const path = require('path');

const routes = {};
let connErr = null, queryErr = null, rows = [];
const queries = [], logErr = [];
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return { Router: () => ({ get: (p, h) => { routes['GET ' + p] = h; } }) };
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(connErr),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(queryErr, { recordset: rows }); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {} };
	if (req.endsWith('LogFunct')) return { error: s => logErr.push(s), standard: () => {}, info: () => {} };
	return origLoad.apply(this, arguments);
};
require(path.join(__dirname, 'alarm.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
function call() {
	const res = { code: 200, body: undefined, sent: false, status(n) { this.code = n; return this; }, send(b) { this.body = b; this.sent = true; }, json(o) { this.body = o; this.sent = true; } };
	let eccezione = null;
	try { routes['GET /show/all']({ params: {}, query: {} }, res); } catch (e) { eccezione = e; }
	return { res, eccezione };
}

console.log('1) la query');
rows = [{ Timestamp: '06/10/2026 16:58:30', descr: '+900010' }];
let r = call();
const q = queries.pop() || '';
check(/order by LOG\.data desc\s*$/.test(q) && !/order by Timestamp/i.test(q), 'ordina sulla colonna LOG.data, non sull\'alias testuale Timestamp');
check(/FORMAT\(data, 'dd\/MM\/yyyy HH:mm:ss', 'it-IT'\) AS 'Timestamp'/.test(q) && !/hh:mm/.test(q), 'ora a 24 (HH), Timestamp resta una stringa dd/MM/yyyy HH:mm:ss');
check(/select top 50 /.test(q) && /from LOG where UNIT_B like 'ALARM%'/.test(q), 'stesse righe: le ultime 50 di LOG con UNIT_B ALARM%');
check(r.res.code === 200 && r.res.sent && r.res.body === rows, 'esito: 200 con le righe cosi\' come le da\' il DB');

console.log('\n2) errori');
connErr = new Error('connessione rifiutata');
r = call();
check(!r.eccezione && r.res.sent && r.res.code === 500, 'connessione fallita: risponde 500 (prima: eccezione su log non definito, richiesta appesa)');
check(logErr.length === 1 && /alarm show\/all/.test(logErr[0]) && /connessione rifiutata/.test(logErr[0]), '   e scrive nel log');
connErr = null; queryErr = new Error('boom'); logErr.length = 0;
r = call();
check(r.res.code === 500 && r.res.sent && logErr.length === 1, 'errore SQL: 500, e ora anche una riga nel log');

console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
