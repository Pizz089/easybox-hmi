// ============================================================================
// test_snapshot_miss.js — test unitario del refresh 90 su cache-miss
// (MQTT_Client.js: requestPlcRefresh, SNAPSHOT/MISS, PLC/REFRESH_REQUEST).
//
// Uso:   node test_snapshot_miss.js
//
// NON richiede broker, DB ne' backend attivo: mqtt/mssql/DBFunct/LogFunct/
// MQTTDiag/CN vengono sostituiti da stub prima di caricare MQTT_Client.js.
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');

// --- stub ---
const published = [];          // publish MQTT catturate: [topic, payload]
const diagEvents = [];         // diag.publish catturate
const logLines = [];           // log.standard catturate
let connectionHandler = null;  // callback di DBf.io.on('connection')
const clientHandlers = {};     // client.on(evento) del client mqtt finto

const fakeClient = {
	options: { protocol: 'mqtt', hostname: 'stub', port: 0 },
	on: (ev, fn) => { clientHandlers[ev] = fn; },
	publish: (topic, payload) => { published.push([topic, String(payload)]); },
	subscribe: () => {},
};
const fakeIo = {
	on: (ev, fn) => { if (ev === 'connection') connectionHandler = fn; },
	emit: () => {},
	of: () => ({ on: () => {}, emit: () => {}, sockets: new Map() }),
};
const noopProxy = new Proxy(function () {}, {
	get: (t, prop) => (prop === 'then' ? undefined : noopProxy),
	apply: () => noopProxy,
	construct: () => noopProxy,
});

const origLoad = Module._load;
Module._load = function (req, parent) {
	if (req === 'mqtt') return { connect: () => fakeClient };
	if (req === 'mssql') return noopProxy;
	if (req.endsWith('DBFunct')) return { io: fakeIo, configDB: {} };
	if (req.endsWith('LogFunct')) return { standard: s => logLines.push(String(s)), error: () => {}, info: () => {}, init: () => {} };
	if (req.endsWith('MQTTDiag')) return { publish: e => diagEvents.push(e) };
	if (req.endsWith('MQTT_Client')) return origLoad.apply(this, arguments);
	if (req.startsWith('.')) return noopProxy;
	return origLoad.apply(this, arguments);
};

// Date.now controllabile: il throttle va provato senza aspettare 5 s reali
let fakeNow = 1_000_000;
Date.now = () => fakeNow;

require(path.join(__dirname, 'MQTT_Client.js'));

// --- socket HMI finto ---
function makeSocket() {
	const handlers = {};
	const emitted = [];
	return {
		on: (ev, fn) => { handlers[ev] = fn; },
		emit: (ev, payload) => { emitted.push([ev, payload]); },
		handlers, emitted,
	};
}

// --- check ---
let failed = 0;
function check(cond, label) {
	console.log((cond ? '  ok   ' : '  FAIL ') + label);
	if (!cond) failed++;
}
const count90 = () => published.filter(p => p[0] === 'TO_PLANT/CMD/ROBOT' && p[1] === '90').length;
const missOf = (sock) => sock.emitted.filter(e => e[0] === 'SNAPSHOT/MISS').map(e => JSON.parse(e[1]));

check(typeof connectionHandler === 'function', 'MQTT_Client registra il handler connection');
check(typeof clientHandlers.connect === 'function', 'MQTT_Client registra client.on(connect)');
check(typeof clientHandlers.message === 'function', 'MQTT_Client registra client.on(message)');

console.log('\n1) connect broker -> un refresh 90');
clientHandlers.connect();
check(count90() === 1, 'publish 90 al connect');
check(logLines.some(l => l.includes('PLC refresh 90') && l.includes('broker connect')), 'log.standard con reason');
check(diagEvents.some(e => e.dir === 'OUT' && e.topic === 'TO_PLANT/CMD/ROBOT' && e.payload === '90' && e.source === 'BACKEND'), 'diag OUT/BACKEND');

console.log('\n2) throttle 5 s');
const sockA = makeSocket();
connectionHandler(sockA);
fakeNow += 1000;
sockA.handlers['PLC/REFRESH_REQUEST']();
check(count90() === 1, 'PLC/REFRESH_REQUEST entro 5 s: nessuna nuova publish');
fakeNow += 5000;
sockA.handlers['PLC/REFRESH_REQUEST']();
check(count90() === 2, 'PLC/REFRESH_REQUEST dopo 5 s: una publish');
check(logLines.some(l => l.includes('richiesta utente')), 'reason "richiesta utente" loggata');

console.log('\n3) cache vuota: i tre snapshot -> MISS + UN solo 90 (smoke)');
fakeNow += 6000;
const before = count90();
const sockB = makeSocket();
connectionHandler(sockB);
sockB.handlers['BRAND/REQUEST_SNAPSHOT']();
sockB.handlers['UNIT/STATUS/REQUEST']('ROBOT');
sockB.handlers['GRIPPER/REQUEST_SNAPSHOT']();
const missB = missOf(sockB);
check(missB.length === 3, 'tre SNAPSHOT/MISS ricevuti (' + missB.length + ')');
check(missB.some(m => m.channel === 'BRAND' && m.unit === ''), 'MISS BRAND');
check(missB.some(m => m.channel === 'STATUS' && m.unit === 'ROBOT'), 'MISS STATUS/ROBOT');
check(missB.some(m => m.channel === 'GRIPPER' && m.unit === ''), 'MISS GRIPPER');
check(count90() === before + 1, 'una sola publish 90 per la raffica di miss');
check(sockB.emitted.every(e => e[0] === 'SNAPSHOT/MISS'), 'su miss nessun altro evento al socket');
check(logLines.some(l => l.includes('cache miss BRAND')), 'reason "cache miss BRAND" loggata');

console.log('\n4) cache piena: ramo hit invariato (nessun MISS, nessun 90)');
fakeNow += 6000;
clientHandlers.message('FROM_PLANT/STATUS/ROBOT', Buffer.from('17'), {});
clientHandlers.message('FROM_PLANT/BRAND/MC1', Buffer.from('{"req":2,"act":2,"lastError":0,"lastErrorBrand":0}'), {});
clientHandlers.message('FROM_PLANT/GRIPPER/SENSOR', Buffer.from('1'), {});
const before2 = count90();
const sockC = makeSocket();
connectionHandler(sockC);
sockC.handlers['BRAND/REQUEST_SNAPSHOT']();
sockC.handlers['UNIT/STATUS/REQUEST']('ROBOT');
sockC.handlers['GRIPPER/REQUEST_SNAPSHOT']();
check(missOf(sockC).length === 0, 'nessun SNAPSHOT/MISS');
check(sockC.emitted.some(e => e[0] === 'MC1/BRAND'), 'replay MC1/BRAND');
check(sockC.emitted.some(e => e[0] === 'ROBOT/STATUS' && e[1] === '17'), 'replay ROBOT/STATUS');
check(sockC.emitted.some(e => e[0] === 'GRIPPER/SENSOR'), 'replay GRIPPER/SENSOR');
check(count90() === before2, 'nessuna publish 90 su hit');

console.log('\n5) miss parziale: STATUS di un\'unita\' mai vista');
fakeNow += 6000;
const before3 = count90();
sockC.handlers['UNIT/STATUS/REQUEST']('MC2');
const missC = missOf(sockC);
check(missC.length === 1 && missC[0].channel === 'STATUS' && missC[0].unit === 'MC2', 'MISS STATUS/MC2');
check(count90() === before3 + 1, 'refresh 90 sul miss parziale');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
