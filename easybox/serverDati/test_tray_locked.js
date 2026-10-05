// ============================================================================
// test_tray_locked.js — cassetti senza Aggiungi ed Elimina (P1 5/10,
// decisione 29/9).
//
// PERCHE': il cliente ha cancellato cassetti che non doveva eliminare. Le
// rotte GET /insertTray e DELETE /:ID di CONF/Tray.js restano registrate ma
// rispondono 403 + KO_TRAY_LOCKED SENZA toccare il DB, e lasciano una riga
// di log con rotta e parametri.
//
// Si carica SOLO CONF/Tray.js: 'DELETE /:ID' lo registrano piu' router (vedi
// la nota in test_http_status.js) e qui serve proprio quello dei cassetti.
//
// Uso:   node test_tray_locked.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');

const routes = {};
let connects = 0, queries = 0;
const logs = [];
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => { connects++; cb(null); },
		Request: function () { this.input = () => this; this.query = (q, cb) => { queries++; cb(null, { recordset: [], rowsAffected: [1] }); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: s => logs.push(s), error: s => logs.push(s), info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
const SRV = __dirname;
require(path.join(SRV, 'CONF/Tray.js'));
const errorCodes = require(path.join(SRV, 'errorCodes.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
function call(key, params, query) {
	const res = { code: 200, body: null, status(n) { this.code = n; return this; }, send(b) { this.body = b; }, json(o) { this.body = o; } };
	routes[key]({ params: params || {}, query: query || {}, body: null }, res);
	return res;
}

console.log('1) il codice esiste ed e\' lo stesso nelle due copie');
check(errorCodes.KO_TRAY_LOCKED === 'KO_TRAY_LOCKED', 'serverDati/errorCodes.js: KO_TRAY_LOCKED');
const hmiCodes = require('fs').readFileSync(path.join(SRV, '../HMI/src/util/errorCodes.js'), 'utf8');
check(/export const KO_TRAY_LOCKED\s*=\s*"KO_TRAY_LOCKED"/.test(hmiCodes), 'HMI/src/util/errorCodes.js: stessa costante');

console.log('\n2) GET /insertTray -> 403 KO_TRAY_LOCKED, nessun accesso al DB');
check(typeof routes['GET /insertTray'] === 'function', 'rotta ancora registrata (risponde in chiaro a chi la chiama)');
let r = call('GET /insertTray', {}, { MAG: '1', FAMILY: 'X', DESCR: 'd', FLOOR_MAG: '5' });
check(r.code === 403 && r.body === errorCodes.KO_TRAY_LOCKED, 'insertTray -> ' + r.code + ' ' + r.body);
check(connects === 0 && queries === 0, 'nessuna connessione e nessuna query (connect=' + connects + ', query=' + queries + ')');
check(logs.some(s => /insertTray/.test(s) && /FLOOR_MAG/.test(s)), 'riga di log con rotta e parametri');

console.log('\n3) DELETE /:ID -> 403 KO_TRAY_LOCKED, nessun accesso al DB');
logs.length = 0;
r = call('DELETE /:ID', { ID: '7' });
check(r.code === 403 && r.body === errorCodes.KO_TRAY_LOCKED, 'DELETE /:ID -> ' + r.code + ' ' + r.body);
check(connects === 0 && queries === 0, 'nessuna connessione e nessuna query (connect=' + connects + ', query=' + queries + ')');
check(logs.some(s => /DELETE/.test(s) && /"ID":"7"/.test(s)), 'riga di log con rotta e ID');

console.log('\n4) le altre rotte dei cassetti esistono ancora');
for (const k of ['GET /show/:ID', 'GET /updateTray', 'GET /layout/:trayID'])
	check(typeof routes[k] === 'function', k + ' registrata');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
