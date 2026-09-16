// ============================================================================
// test_declare_routing.js — instradamento degli echi e degli allarmi nuovi
// (MQTT_Client.js: DECLARE/TRAY, TRAY/EXTRACT, ALARM per sezione).
//
// PERCHE'. Il dialog "Reimposta stato cella" aspetta un eco PRECISO per ogni
// comando e mostra il rifiuto NELLA sezione che l'ha subito. Tre cose potevano
// romperlo in silenzio dal lato bridge:
//   - FROM_PLANT/DECLARE/TRAY e' un topic NUOVO: il vecchio ramo accettava
//     solo MC1 e ROBOT, e l'eco del comando 39 non sarebbe mai arrivata;
//   - BOX/STATUS viene emesso sia per EXTRACT sia per RELEASE: chi aspetta la
//     conferma del 38 non puo' distinguerli, serve un canale suo;
//   - ALARM/BOX e ALARM/ROBOT viaggiavano insieme sul canale generico, quindi
//     indistinguibili — ma il canale generico NON deve sparire, perche' ci sta
//     appeso il toast globale.
//
// Uso:   node test_declare_routing.js
// NON richiede broker, DB ne' backend attivo (stessi stub di test_snapshot_miss).
// ============================================================================

const Module = require('module');
const path = require('path');

const published = [];
let connectionHandler = null;
const clientHandlers = {};
const emitted = [];            // [evento, payload] emessi a TUTTE le HMI

const fakeClient = {
	options: { protocol: 'mqtt', hostname: 'stub', port: 0 },
	on: (ev, fn) => { clientHandlers[ev] = fn; },
	publish: (topic, payload) => { published.push([topic, String(payload)]); },
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
Module._load = function (req, parent) {
	if (req === 'mqtt') return { connect: () => fakeClient };
	if (req === 'mssql') return noopProxy;
	if (req.endsWith('DBFunct')) return { io: fakeIo, configDB: {} };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	if (req.endsWith('MQTTDiag')) return { publish: () => {} };
	if (req.endsWith('MQTT_Client')) return origLoad.apply(this, arguments);
	if (req.startsWith('.')) return noopProxy;
	return origLoad.apply(this, arguments);
};

require(path.join(__dirname, 'MQTT_Client.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const msg = (topic, payload) => { emitted.length = 0; clientHandlers.message(topic, Buffer.from(String(payload))); };
const ev = (name) => emitted.filter(e => e[0] === name).map(e => e[1]);

check(typeof clientHandlers.message === 'function', 'MQTT_Client registra client.on(message)');

console.log('\n1) DECLARE: i due vecchi topic passano come prima, il TRAY nuovo arriva');
msg('FROM_PLANT/DECLARE/MC1', '0;0;1032');
check(ev('DECLARE/MC1')[0] === '0;0;1032', 'DECLARE/MC1 inoltrato intero, terzo campo compreso');
msg('FROM_PLANT/DECLARE/ROBOT', '7;0;0');
check(ev('DECLARE/ROBOT')[0] === '7;0;0', 'DECLARE/ROBOT inoltrato');
msg('FROM_PLANT/DECLARE/TRAY', '9;7;4');
check(ev('DECLARE/TRAY')[0] === '9;7;4', 'DECLARE/TRAY (topic nuovo, eco del 39) inoltrato');

console.log('\n2) cassetto: l\'eco del 38 ha un canale suo, distinto dal rilascio');
msg('FROM_PLANT/TRAY/BOX/EXTRACT', '9');
check(ev('TRAY/EXTRACT')[0] === '9', 'EXTRACT -> TRAY/EXTRACT col numero di cassetto');
check(ev('BOX/STATUS')[0] === '9', 'e BOX/STATUS resta, per chi lo ascoltava gia\'');
msg('FROM_PLANT/TRAY/BOX/RELEASE', '9');
check(ev('TRAY/EXTRACT').length === 0, 'il RILASCIO non finisce su TRAY/EXTRACT: non e\' una conferma del 38');
check(ev('BOX/STATUS')[0] === '9', 'ma continua a suonare il campanello BOX/STATUS');
msg('FROM_PLANT/TRAY/BOX/EXTRACT', '0');
check(ev('TRAY/EXTRACT')[0] === '0', '0 = nessun cassetto fuori: passa, non viene scambiato per "niente da dire"');

console.log('\n3) allarmi: canale per sezione IN PIU\', generico invariato');
msg('FROM_PLANT/ALARM/MC1', '947');
check(ev('ALARM/MC1')[0] === '947', 'MC1 sul suo canale (era gia\' cosi\')');
msg('FROM_PLANT/ALARM/BOX', '996');
check(ev('ALARM/BOX')[0] === '996', 'BOX adesso ha il suo canale');
check(ev('PLC/ALARM/ROBOT')[0] === '996', 'e il canale generico continua a riceverlo: il toast globale non cambia');
msg('FROM_PLANT/ALARM/ROBOT', '20006');
check(ev('ALARM/ROBOT')[0] === '20006', 'ROBOT ha il suo canale');
check(ev('PLC/ALARM/ROBOT')[0] === '20006', 'e anche qui il generico resta');
msg('FROM_PLANT/ALARM', 'LICENSE NOT VALID!!');
check(ev('PLC/ALARM/ROBOT')[0] === 'LICENSE NOT VALID!!', 'allarme senza unita\': solo generico, nessun canale inventato');
check(ev('ALARM/BOX').length === 0 && ev('ALARM/ROBOT').length === 0, 'e non finisce su una sezione a caso');

console.log('\n4) snapshot: le cache nuove vengono rigiocate a chi si connette');
// il PLC non ritiene i topic: senza replay una HMI che monta dopo non
// saprebbe ne' che cassetto e' fuori ne' cosa e' stato dichiarato
const sock = { on: () => {}, emit: (e, p) => sock.out.push([e, String(p)]), out: [] };
connectionHandler(sock);
sock.out.length = 0;
// il client chiede lo snapshot come fa la view al mount
const handlers = {};
const sock2 = { on: (e, f) => { handlers[e] = f; }, emit: (e, p) => sock2.out.push([e, String(p)]), out: [] };
connectionHandler(sock2);
// il replay delle dichiarazioni sta nello snapshot pinza, quello che la
// pagina robot chiede al mount (GRIPPER/REQUEST_SNAPSHOT)
const richiesta = 'GRIPPER/REQUEST_SNAPSHOT';
check(typeof handlers[richiesta] === 'function', 'il backend risponde a ' + richiesta);
if (richiesta) {
	sock2.out.length = 0;
	handlers[richiesta]();
	const out = (n) => sock2.out.filter(e => e[0] === n).map(e => e[1]);
	check(out('DECLARE/TRAY')[0] === '9;7;4', 'DECLARE/TRAY rigiocato dallo snapshot');
	check(out('TRAY/EXTRACT')[0] === '0', 'TRAY/EXTRACT rigiocato con l\'ultimo valore visto');
	check(out('DECLARE/MC1')[0] === '0;0;1032', 'e le dichiarazioni gia\' note restano rigiocate come prima');
}

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
