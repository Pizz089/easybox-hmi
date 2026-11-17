// ============================================================================
// test_dispatch_cache.js — ultimo valore di FROM_PLANT/DISPATCH/<unit>/<n>
// (pulizia LOG, 17/11)
//
// La pulizia della tabella LOG (logTableCleanup.js) parte anche con la
// produzione attiva se la HAAS sta lavorando e il robot e' fermo: ultimo
// DISPATCH/MC1/0 = 95 e ultimo DISPATCH/ROBOT/0 = 0. Quei valori li riceve gia'
// MQTT_Client e li gira al pannello (evento DISPATCH); qui si verifica che li
// tenga anche in memoria e li esponga con lastDispatch(unit, n):
//   - prima di un messaggio ricevuto dopo l'avvio: undefined (condizione b falsa);
//   - interi col segno del PLC ("+95") letti come numeri, come gli STATUS;
//   - payload non intero: undefined, non un valore vecchio;
//   - l'evento DISPATCH al pannello resta com'era.
//
// Uso:   node test_dispatch_cache.js
// NON richiede broker, DB ne' backend attivo (stessi stub di test_status_payload).
// ============================================================================

const Module = require('module');
const path = require('path');

const queries = [];
const clientHandlers = {};
const emitted = [];

const fakeClient = {
	options: { protocol: 'mqtt', hostname: 'stub', port: 0 },
	on: (ev, fn) => { clientHandlers[ev] = fn; },
	publish: () => {},
	subscribe: () => {},
};
const fakeIo = {
	on: () => {},
	emit: (ev, payload) => { emitted.push([ev, payload]); },
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
			this.input = () => this;
			this.query = (q, cb) => { queries.push(q); cb(null, { recordset: [], rowsAffected: [1] }); };
		},
	};
	if (req.endsWith('DBFunct')) return { io: fakeIo, configDB: {} };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	if (req.endsWith('MQTTDiag')) return { publish: () => {} };
	if (req.endsWith('MQTT_Client')) return origLoad.apply(this, arguments);
	if (req.endsWith('trayParent')) return origLoad.apply(this, arguments);
	if (req.startsWith('.')) return noopProxy;
	return origLoad.apply(this, arguments);
};

const MQTT = require(path.join(__dirname, 'MQTT_Client.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const msg = (topic, payload) => {
	queries.length = 0; emitted.length = 0;
	clientHandlers.message(topic, Buffer.from(String(payload)));
};

console.log('1) prima di ricevere qualcosa');
check(typeof MQTT.lastDispatch === 'function', 'MQTT_Client esporta lastDispatch(unit, n)');
check(typeof MQTT.lastDispatch === 'function' && MQTT.lastDispatch('MC1', 0) === undefined && MQTT.lastDispatch('ROBOT', 0) === undefined,
	'MC1/0 e ROBOT/0 undefined: nessun valore dopo l\'avvio, la condizione b e\' falsa');
if (typeof MQTT.lastDispatch !== 'function') { console.log('\n' + failed + ' CHECK FALLITI'); process.exit(1); }

console.log('\n2) valori ricevuti');
msg('FROM_PLANT/DISPATCH/MC1/0', '95');
check(MQTT.lastDispatch('MC1', 0) === 95, 'DISPATCH/MC1/0 "95" -> 95 (numero)');
check(emitted.length === 1 && emitted[0][0] === 'DISPATCH' && emitted[0][1].unit === 'MC1' && emitted[0][1].dispatch === '0' && emitted[0][1].value === '95',
	'evento DISPATCH al pannello come prima');
check(queries.length === 0, 'nessuna query');
msg('FROM_PLANT/DISPATCH/ROBOT/0', '+0');
check(MQTT.lastDispatch('ROBOT', 0) === 0, 'DISPATCH/ROBOT/0 "+0" (segno del PLC) -> 0');
msg('FROM_PLANT/DISPATCH/MC1/0', '+100');
check(MQTT.lastDispatch('MC1', 0) === 100, 'MC1/0 aggiornato a 100: conta l\'ultimo valore');
msg('FROM_PLANT/DISPATCH/MC1/0', ' 95 ');
check(MQTT.lastDispatch('MC1', 0) === 95, 'spazi attorno ammessi');
check(MQTT.lastDispatch('ROBOT', 0) === 0, 'ROBOT/0 non toccato dai messaggi di MC1');

console.log('\n3) indici e unita\' tenuti separati');
msg('FROM_PLANT/DISPATCH/ROBOT/4', '12');
check(MQTT.lastDispatch('ROBOT', 4) === 12 && MQTT.lastDispatch('ROBOT', 0) === 0, 'ROBOT/4 = 12, ROBOT/0 resta 0');
msg('from_plant/dispatch/mc1/1', '7');
check(MQTT.lastDispatch('MC1', 1) === 7 && MQTT.lastDispatch('mc1', '1') === 7, 'topic e unita\' senza distinzione di maiuscole, indice numero o stringa');

console.log('\n4) payload non intero');
msg('FROM_PLANT/DISPATCH/ROBOT/0', 'boh');
check(MQTT.lastDispatch('ROBOT', 0) === undefined, '"boh": undefined, non il valore vecchio (0)');
msg('FROM_PLANT/DISPATCH/MC1/0', '');
check(MQTT.lastDispatch('MC1', 0) === undefined, 'payload vuoto: undefined');
check(emitted.length === 1 && emitted[0][0] === 'DISPATCH', 'l\'evento al pannello parte comunque, come prima');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
