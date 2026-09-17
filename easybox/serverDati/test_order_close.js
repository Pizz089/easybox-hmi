// ============================================================================
// test_order_close.js — chiusura dell'ordine a quantita' raggiunta (17/9)
//
// COSA E' SUCCESSO IN CAMPO. Ordine 1100 arrivato a PRODUCTED=24 su QUANTITY=24
// e rimasto a STATUS=3, chiuso a mano. Nel log di cella:
//
//   ricevo MQTT: FROM_PLANT/CYCLE_DONE/MC1: +1100
//   CYCLE_DONE: err query: RequestError: Update or insert of view or function
//   'WORKORDERS' failed because it contains a derived or constant field.
//
// DUE DIFETTI SOVRAPPOSTI, entrambi in handleCycleDone:
//   1. `UPDATE WORKORDERS SET PRODUCTED = PRODUCTED + 1` e' IMPOSSIBILE:
//      PRODUCTED non e' una colonna, e' il conteggio delle tasche finite
//      calcolato dalla vista. I due statement erano nello stesso batch, quindi
//      il fallimento del primo impediva al secondo (la chiusura) di partire.
//   2. anche da solo, il secondo sarebbe arrivato TROPPO PRESTO: PRODUCTED sale
//      quando il finito viene DEPOSITATO nel cassetto, cioe' DOPO il fine ciclo
//      macchina. All'ultimo pezzo il conteggio e' indietro di uno.
//
// Qui si verifica che la chiusura sia dove il conteggio e' gia' aggiornato
// (setPositionStatus, sul deposito del finito) e che CYCLE_DONE non tocchi piu'
// il database.
//
// Uso:   node test_order_close.js
// NON richiede broker, DB ne' backend attivo (stessi stub di test_snapshot_miss).
// ============================================================================

const Module = require('module');
const path = require('path');

const queries = [];
let connectionHandler = null;
const clientHandlers = {};
const emitted = [];

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
const logLines = [];

const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'mqtt') return { connect: () => fakeClient };
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(null, { recordset: [], rowsAffected: [1] }); }; },
	};
	if (req.endsWith('DBFunct')) return { io: fakeIo, configDB: {} };
	if (req.endsWith('LogFunct')) return {
		standard: s => logLines.push(String(s)), error: () => {},
		info: s => logLines.push(String(s)), init: () => {},
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
const norm = q => String(q).replace(/\s+/g, ' ').trim();
const msg = (topic, payload) => {
	queries.length = 0; emitted.length = 0; logLines.length = 0;
	clientHandlers.message(topic, Buffer.from(String(payload)));
};
const sql = () => queries.map(norm);

console.log('1) CYCLE_DONE non tocca piu\' il database');
// payload come in campo: "+1100", col segno
msg('FROM_PLANT/CYCLE_DONE/MC1', '+1100');
check(queries.length === 0, 'nessuna query: l\'avanzamento non si conta qui');
check(!sql().some(q => /PRODUCTED = PRODUCTED \+ 1/.test(q)), 'sparito l\'UPDATE impossibile su colonna derivata');
check(emitted.some(e => e[0] === 'PRODUCTION/CHANGED'), 'ma il pannello viene comunque avvisato');
check(logLines.some(l => /CYCLE_DONE: ordine 1100/.test(l)), 'e resta la traccia a log, col numero d\'ordine');
// payload sporco: si ferma prima, come prima
msg('FROM_PLANT/CYCLE_DONE/MC1', 'xx');
check(queries.length === 0 && !emitted.some(e => e[0] === 'PRODUCTION/CHANGED'),
	'orderID non valido: niente query e niente notifica');
check(logLines.some(l => /orderID non valido/.test(l)), 'e lo dice');

console.log('\n2) LA CHIUSURA sta dove il conteggio e\' gia\' aggiornato');
// FROM_PLANT/PART/BOX/TRAY/<tray>/<subpos>, payload = nuovo stato tasca.
// 5 = FINITO: e' il deposito del pezzo lavorato nel cassetto.
msg('FROM_PLANT/PART/BOX/TRAY/9/7', '5');
const q = sql().join(' ');
check(/UPDATE \[POSITION\] SET STATUS=5 WHERE \(PARENT = 'TRAY_9'\) and SUB_POS=7/.test(q),
	'la tasca viene marcata finita, come prima');
check(/UPDATE WORKORDER SET STATUS=5/.test(q), 'e NELLO STESSO BATCH parte la chiusura');
check(/SELECT Order_ID FROM \[POSITION\] WHERE \(PARENT = 'TRAY_9'\) AND SUB_POS=7 AND Order_ID > 0/.test(q),
	'l\'ordine si ricava dalla tasca appena marcata, non da un parametro');
check(/AND STATUS = 3/.test(q), 'solo se l\'ordine e\' ancora in lavorazione: non si riscrive un ordine gia\' chiuso');
check(/SELECT ID FROM WORKORDERS WHERE PRODUCTED >= QUANTITY/.test(q),
	'il conteggio si LEGGE dalla vista: una sola definizione di "prodotto"');
check(/UPDATE WORKORDER SET/.test(q) && !/UPDATE WORKORDERS SET/.test(q),
	'ma si SCRIVE sulla tabella base: scrivere sulla vista e\' cio\' che faceva fallire CYCLE_DONE');
check(emitted.some(e => e[0] === 'PRODUCTION/CHANGED'), 'e il pannello si aggiorna');

console.log('\n3) su ogni ALTRO cambio di stato la chiusura NON si accoda');
for (const [st, nome] of [['2', 'vuota'], ['4', 'grezzo'], ['7', 'abortita']]) {
	msg('FROM_PLANT/PART/BOX/TRAY/9/7', st);
	const s2 = sql().join(' ');
	check(/UPDATE \[POSITION\] SET STATUS=/.test(s2), 'stato ' + nome + ': la tasca si marca');
	check(!/UPDATE WORKORDER SET/.test(s2), '  e nessuna chiusura in coda (' + nome + ')');
	check(!emitted.some(e => e[0] === 'PRODUCTION/CHANGED'), '  ne\' notifica di produzione (' + nome + ')');
}
// una tasca ABORTITA non deve concorrere alla chiusura: con la vista v3
// PRODUCTED conta solo i finiti, e qui non parte nemmeno la verifica
msg('FROM_PLANT/PART/BOX/TRAY/9/7', '7');
check(!/UPDATE WORKORDER/.test(sql().join(' ')),
	'pezzo abortito: non e\' un pezzo prodotto e non puo\' chiudere l\'ordine');

console.log('\n4) il cassetto sbagliato non viene toccato (regressione gia\' coperta)');
msg('FROM_PLANT/PART/BOX/TRAY/1/3', '5');
const q1 = sql().join(' ');
check(/\(PARENT = 'TRAY_1'\)/.test(q1) && !/TRAY_10/.test(q1),
	'uguaglianza sul PARENT: il tray 1 non aggancia il tray 10');
msg('FROM_PLANT/PART/BOX/TRAY/99/3', '5');
check(queries.length === 0, 'numero cassetto fuori range: nessuna query');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
