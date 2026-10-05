// ============================================================================
// test_status_payload.js — STATUS con payload non numerico (P7 5/10)
//
// FB204, allo stato 100, pubblica FROM_PLANT/STATUS/MC1 con payload
// 'CYCLE_COMPLETED'. Prima diventava "UPDATE UNIT_STATUS SET
// STATUS=CYCLE_COMPLETED" (errore SQL a ogni ciclo), finiva in unitStatusCache
// e usciva al pannello come MC1/STATUS. Si verifica che con 'CYCLE_COMPLETED'
// non parta nessuna query, non cambi la cache e non esca lo stato, e che con
// '3' tutto funzioni come prima, ma con la query parametrizzata.
//
// Uso:   node test_status_payload.js
// NON richiede broker, DB ne' backend attivo (stessi stub di test_order_close).
// ============================================================================

const Module = require('module');
const path = require('path');

const queries = [];
const inputs = [];
let connectionHandler = null;
const clientHandlers = {};
const emitted = [];
const logLines = [];

const fakeClient = {
	options: { protocol: 'mqtt', hostname: 'stub', port: 0 },
	on: (ev, fn) => { clientHandlers[ev] = fn; },
	publish: () => {},
	subscribe: () => {},
};
const fakeIo = {
	on: (ev, fn) => { if (ev === 'connection') connectionHandler = fn; },
	emit: (ev, payload) => { emitted.push([ev, String(payload)]); },
	of: () => ({ on: () => {}, emit: () => {}, sockets: new Map() }),
};
const noopProxy = new Proxy(function () {}, {
	get: (t, prop) => (prop === 'then' ? undefined : noopProxy),
	apply: () => noopProxy,
	construct: () => noopProxy,
});

const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'mqtt') return { connect: () => fakeClient };
	if (req === 'mssql') return {
		Int: 'Int', NVarChar: 'NVarChar',
		connect: (cfg, cb) => cb(null),
		Request: function () {
			this.input = (name, type, value) => { inputs.push([name, type, value]); return this; };
			this.query = (q, cb) => { queries.push(q); cb(null, { recordset: [], rowsAffected: [1] }); };
		},
	};
	if (req.endsWith('DBFunct')) return { io: fakeIo, configDB: {} };
	if (req.endsWith('LogFunct')) return {
		standard: s => logLines.push(String(s)), error: s => logLines.push(String(s)),
		info: () => {}, init: () => {},
	};
	if (req.endsWith('MQTTDiag')) return { publish: () => {} };
	if (req.endsWith('MQTT_Client')) return origLoad.apply(this, arguments);
	if (req.endsWith('trayParent')) return origLoad.apply(this, arguments);
	if (req.startsWith('.')) return noopProxy;
	return origLoad.apply(this, arguments);
};

require(path.join(__dirname, 'MQTT_Client.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const msg = (topic, payload) => {
	queries.length = 0; inputs.length = 0; emitted.length = 0; logLines.length = 0;
	clientHandlers.message(topic, Buffer.from(String(payload)));
};
const statusQueries = () => queries.filter(q => /UNIT_STATUS/.test(q));

// socket finto per leggere la cache: UNIT/STATUS/REQUEST rigioca unitStatusCache
const sockHandlers = {};
const sockEmitted = [];
connectionHandler({
	id: 'test', handshake: { address: 'stub' }, on: (ev, fn) => { sockHandlers[ev] = fn; },
	emit: (ev, p) => sockEmitted.push([ev, String(p)]), join: () => {}, leave: () => {},
});
const cached = unit => { sockEmitted.length = 0; sockHandlers['UNIT/STATUS/REQUEST'](unit); const e = sockEmitted.find(x => x[0] === unit + '/STATUS'); return e ? e[1] : undefined; };

console.log('1) MC1 con stato numerico: come prima, query parametrizzata');
msg('FROM_PLANT/STATUS/MC1', '3');
const q3 = statusQueries();
check(q3.length === 1, 'parte l\'UPDATE su UNIT_STATUS');
check(q3.length === 1 && /UPDATE UNIT_STATUS SET STATUS=@status WHERE UNIT=@unit;/.test(q3[0]) && !/=3/.test(q3[0]), 'testo con parametri, il valore non e\' nella stringa');
check(inputs.some(i => i[0] === 'status' && i[1] === 'Int' && i[2] === 3) && inputs.some(i => i[0] === 'unit' && i[2] === 'MC1'), 'status=3 (Int) e unit=MC1 passati come input');
check(emitted.some(e => e[0] === 'MC1/STATUS' && e[1] === '3'), 'emit MC1/STATUS 3');
check(emitted.some(e => e[0] === 'PRODUCTION/CHANGED'), 'emit PRODUCTION/CHANGED');
check(cached('MC1') === '3', 'cache MC1 = 3');

console.log('\n2) MC1 con CYCLE_COMPLETED: nessuna query, cache e stato intatti');
msg('FROM_PLANT/STATUS/MC1', 'CYCLE_COMPLETED');
check(queries.length === 0, 'nessuna query (ne\' UPDATE ne\' insert nel log a DB)');
check(!emitted.some(e => e[0] === 'MC1/STATUS'), 'nessun emit MC1/STATUS');
check(cached('MC1') === '3', 'la cache resta allo stato vero (3), non diventa CYCLE_COMPLETED');
check(emitted.some(e => e[0] === 'PRODUCTION/CHANGED'), 'la tabella produzione si aggiorna comunque (fine ciclo)');
check(logLines.some(l => /STATUS MC1 non numerico \[CYCLE_COMPLETED\]/.test(l)), 'una riga di log che lo dice');

console.log('\n3) stesso trattamento per le altre unita\'');
for (const [topic, unit] of [['FROM_PLANT/STATUS/ROBOT', 'ROBOT'], ['FROM_PLANT/STATUS/MC2', 'MC2'], ['FROM_PLANT/STATUS/BOX', 'BOX']]) {
	msg(topic, '17');
	check(statusQueries().length === 1 && emitted.some(e => e[0] === unit + '/STATUS'), unit + ' con 17: UPDATE ed emit come prima');
	msg(topic, 'boh');
	check(queries.length === 0 && !emitted.some(e => e[0] === unit + '/STATUS') && cached(unit) === '17', unit + ' con payload non intero: niente query, niente stato, cache intatta');
}

console.log('\n4) valori limite');
msg('FROM_PLANT/STATUS/MC1', '+6');
check(statusQueries().length === 1 && inputs.some(i => i[0] === 'status' && i[2] === 6), '"+6" (segno dal PLC) e\' un intero: passa come 6');
msg('FROM_PLANT/STATUS/MC1', ' 4 ');
check(statusQueries().length === 1 && inputs.some(i => i[0] === 'status' && i[2] === 4), 'spazi attorno ammessi');
for (const bad of ['3;DROP TABLE x', '3.5', '', '0x10', '3 4']) {
	msg('FROM_PLANT/STATUS/MC1', bad);
	check(queries.length === 0, JSON.stringify(bad) + ': nessuna query');
}

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
