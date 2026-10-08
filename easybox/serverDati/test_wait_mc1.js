// ============================================================================
// test_wait_mc1.js — FROM_PLANT/WAIT/MC1: perche' il ciclo MC1 e' fermo
// (consegna 36, 8/10)
//
// FB7 pubblica ogni 3 s "codice;stato di FB204;dato". Il backend lo passa al
// pannello come MC1/WAIT (avviso fisso del v3). Si verifica:
//   1. la sottoscrizione FROM_PLANT/# copre il topic;
//   2. parsing: tre interi, oggetto al pannello; nessuna riga «ricevo MQTT» e
//      nessun UNKNOWN (ogni 3 s accorcerebbero la storia del log);
//   3. un payload malformato si scarta, con UNA riga di log;
//   4. nella tabella LOG una riga solo quando il codice cambia;
//   5. dopo 10 s senza messaggi: codice null («non aggiornato»), una volta;
//   6. cache a chi si connette e a chi la chiede; niente prima del primo
//      messaggio (un PLC senza la 36 non pubblica il topic);
//   7. col codice 10 l'ultimo ALARM/MC1 (codice e ora): non i rifiuti 947 e
//      948, e non un allarme di un 9999 precedente.
//
// Uso:   node test_wait_mc1.js
// NON richiede broker, DB ne' backend attivo (stessi stub di test_status_payload).
// ============================================================================

const Module = require('module');
const path = require('path');
const fs = require('fs');

const queries = [];
let connectionHandler = null;
const clientHandlers = {};
const emitted = [];            // [evento, payload] a TUTTI i pannelli
const logLines = [];
const subscribed = [];

// orologio finto: il «non aggiornato» e' un setTimeout di 10 s
const timers = [];
const realSetTimeout = global.setTimeout;
global.setTimeout = (fn, ms) => { const t = { fn, ms, vivo: true, unref() { return t; } }; timers.push(t); return t; };
global.clearTimeout = t => { if (t && typeof t === 'object') t.vivo = false; };
const scatta = ms => { const pronti = timers.filter(t => t.vivo && t.ms === ms); pronti.forEach(t => { t.vivo = false; t.fn(); }); return pronti.length; };

const fakeClient = {
	options: { protocol: 'mqtt', hostname: 'stub', port: 0 },
	on: (ev, fn) => { clientHandlers[ev] = fn; },
	publish: () => {},
	subscribe: (t) => { subscribed.push(t); },
};
const fakeIo = {
	on: (ev, fn) => { if (ev === 'connection') connectionHandler = fn; },
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
const pulisci = () => { queries.length = 0; emitted.length = 0; logLines.length = 0; };
const msg = (topic, payload) => { pulisci(); clientHandlers.message(topic, Buffer.from(String(payload))); };
const wait = () => emitted.filter(e => e[0] === 'MC1/WAIT').map(e => e[1]);
const logWait = () => queries.filter(q => /INSERT INTO LOG/.test(q) && /'WAIT'/.test(q));
const socketFinto = () => {
	const s = { h: {}, out: [], on(e, f) { s.h[e] = f; }, emit(e, p) { s.out.push([e, p]); }, join() {}, leave() {}, id: 'x', handshake: { address: 'stub' } };
	return s;
};
const outWait = s => s.out.filter(e => e[0] === 'MC1/WAIT').map(e => e[1]);

console.log('1) sottoscrizione');
const src = fs.readFileSync(path.join(__dirname, 'MQTT_Client.js'), 'utf8');
check(subscribed.includes('FROM_PLANT/#'), 'FROM_PLANT/# sottoscritto: copre FROM_PLANT/WAIT/MC1');
check(/param\[1\] == "WAIT" && param\[2\] == "MC1"/.test(src), 'il ramo WAIT/MC1 esiste');

console.log('\n2) prima del primo messaggio: niente al pannello');
const s0 = socketFinto();
connectionHandler(s0);
check(outWait(s0).length === 0, 'alla connessione nessun MC1/WAIT (PLC senza la 36: nessun «non aggiornato» per sempre)');
s0.out.length = 0; s0.h['MC1/WAIT/REQUEST']();
check(outWait(s0).length === 0, 'e nemmeno a chi lo chiede');
check(scatta(10000) === 0, 'nessun timer del «non aggiornato» armato');

console.log('\n3) parsing e log');
msg('FROM_PLANT/WAIT/MC1', '11;5;0');
let w = wait()[0];
check(w && w.codice === 11 && w.statoFB204 === 5 && w.dato === 0 && w.allarme === null && typeof w.ts === 'number',
	'«11;5;0» -> MC1/WAIT { codice 11, statoFB204 5, dato 0, allarme null, ts }');
check(!logLines.some(l => /ricevo MQTT/.test(l)), 'nessuna riga «ricevo MQTT» (arriva ogni 3 s)');
check(!logLines.some(l => /UNKNOWN/.test(l)), 'nessun UNKNOWN (prima finiva nel default del ramo MC1)');
check(!emitted.some(e => e[0] === 'MC1/STATUS' || e[0] === 'PLC/ALARM/GENERIC'), 'nessun altro evento del ramo MC1');
check(logWait().length === 1 && /WAIT MC1: 11;5;0/.test(logWait()[0]) && /'PLC'/.test(logWait()[0]),
	'primo messaggio: una riga nella tabella LOG («WAIT MC1: 11;5;0», PLC, WAIT)');
msg('FROM_PLANT/WAIT/MC1', '11;5;0');
check(wait().length === 1 && logWait().length === 0, 'stesso codice: al pannello si\', nella tabella LOG no');
msg('FROM_PLANT/WAIT/MC1', '11;5;3');
check(wait().length === 1 && wait()[0].dato === 3 && logWait().length === 0, 'cambia solo il dato: al pannello il dato nuovo, nella tabella LOG niente');
msg('FROM_PLANT/WAIT/MC1', ' 8 ; 0 ; 19003 \r\n');
w = wait()[0];
check(w && w.codice === 8 && w.statoFB204 === 0 && w.dato === 19003, 'spazi e a capo intorno ai numeri: letti');
check(logWait().length === 1 && /WAIT MC1: 8 ; 0 ; 19003'/.test(logWait()[0]), 'codice cambiato (11 -> 8): una riga nella tabella LOG');
msg('from_plant/wait/mc1', '0;0;0');
check(wait().length === 1 && wait()[0].codice === 0, 'il topic si riconosce senza badare alle maiuscole, come gli altri');

console.log('\n4) payload malformati');
let righe = 0, eventi = 0;
for (const p of ['abc', '1;2', '1;2;3;4', '1;x;3', '', '1.5;2;3', '1;;3']) {
	msg('FROM_PLANT/WAIT/MC1', p);
	righe += logLines.filter(l => /WAIT\/MC1: payload non valido/.test(l)).length;
	eventi += wait().length + logWait().length;
}
check(eventi === 0, 'sette payload malformati: nessun MC1/WAIT, nessuna riga nella tabella LOG');
check(righe === 1, 'una riga di log sola per tutti e sette (' + righe + ')');
msg('FROM_PLANT/WAIT/MC1', '0;0;0');
msg('FROM_PLANT/WAIT/MC1', 'rotto');
check(logLines.filter(l => /payload non valido/.test(l)).length === 1, 'dopo un payload buono, il malformato successivo si scrive di nuovo');

console.log('\n5) non aggiornato');
msg('FROM_PLANT/WAIT/MC1', '6;50;0');
msg('FROM_PLANT/WAIT/MC1', '6;50;0');
check(timers.filter(t => t.vivo && t.ms === 10000).length === 1, 'ogni messaggio riarma il timer (ne resta vivo uno)');
pulisci();
check(scatta(10000) === 1, '10 s senza messaggi: scatta');
w = wait()[0];
check(w && w.codice === null && w.statoFB204 === null && w.dato === null, 'al pannello codice null: «non aggiornato»');
check(logWait().length === 1 && /non aggiornato/.test(logWait()[0]), 'e una riga nella tabella LOG');
pulisci();
check(scatta(10000) === 0 && wait().length === 0, 'una volta sola: niente timer finche\' non arriva un messaggio');
const s1 = socketFinto();
connectionHandler(s1);
check(outWait(s1).length === 1 && outWait(s1)[0].codice === null, 'chi si connette adesso riceve «non aggiornato»');
msg('FROM_PLANT/WAIT/MC1', '6;50;0');
check(wait()[0].codice === 6 && logWait().length === 1, 'torna il messaggio: al pannello, e una riga nella tabella LOG (null -> 6)');

console.log('\n6) cache a chi si connette e a chi la chiede');
msg('FROM_PLANT/WAIT/MC1', '3;0;0');
const s2 = socketFinto();
connectionHandler(s2);
check(outWait(s2).length === 1 && outWait(s2)[0].codice === 3, 'alla connessione: l\'ultimo stato (3)');
s2.out.length = 0;
check(typeof s2.h['MC1/WAIT/REQUEST'] === 'function', 'il backend risponde a MC1/WAIT/REQUEST');
s2.h['MC1/WAIT/REQUEST']();
check(outWait(s2).length === 1 && outWait(s2)[0].codice === 3, 'a chi lo chiede: l\'ultimo stato, solo a lui');

console.log('\n7) ultimo allarme MC1 col codice 10');
msg('FROM_PLANT/WAIT/MC1', '15;50;1600');
msg('FROM_PLANT/ALARM/MC1', '959');
check(emitted.some(e => e[0] === 'ALARM/MC1' && e[1] === '959') && queries.some(q => /ALARM MC1: 959/.test(q)),
	'ALARM/MC1 come prima: evento al pannello e riga nella tabella LOG');
check(wait().length === 0, 'col codice 15 l\'allarme non rimanda MC1/WAIT');
msg('FROM_PLANT/WAIT/MC1', '10;9999;0');
w = wait()[0];
check(w.codice === 10 && w.allarme && w.allarme.codice === 959 && typeof w.allarme.ts === 'number', 'codice 10: con l\'allarme 959 e la sua ora');
msg('FROM_PLANT/ALARM/MC1', '947');
check(wait().length === 0, 'un 947 (rifiuto) non cambia niente: FB204 resta dov\'e\'');
msg('FROM_PLANT/WAIT/MC1', '10;9999;0');
check(wait()[0].allarme.codice === 959, 'dopo il 947 l\'allarme resta il 959');
msg('FROM_PLANT/ALARM/MC1', '948');
msg('FROM_PLANT/WAIT/MC1', '10;9999;0');
check(wait()[0].allarme.codice === 959, 'e anche dopo il 948');
msg('FROM_PLANT/ALARM/MC1', '958');
check(wait().length === 1 && wait()[0].allarme.codice === 958, 'un allarme vero col codice 10 gia\' in corso: MC1/WAIT subito, col codice nuovo');
msg('FROM_PLANT/WAIT/MC1', '6;9999;0');
check(wait()[0].allarme === null, 'l\'allarme va solo col codice 10');
msg('FROM_PLANT/WAIT/MC1', '0;0;0');
msg('FROM_PLANT/WAIT/MC1', '10;9999;0');
check(wait()[0].allarme === null, 'FB204 uscito dal 9999 e rientrato senza allarme: nessun allarme vecchio (958)');
msg('FROM_PLANT/ALARM/MC1', '952');
check(wait()[0].allarme.codice === 952, 'l\'allarme che arriva dopo il WAIT del 9999 si aggancia');
msg('FROM_PLANT/ALARM/MC1', 'testo');
check(wait().length === 0, 'un ALARM/MC1 che non e\' un numero non si tiene');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
global.setTimeout = realSetTimeout;
process.exit(failed ? 1 : 0);
