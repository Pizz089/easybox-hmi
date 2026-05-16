"use strict";
// MQTTDiag.js — pannello diagnostica MQTT live
//
// Espone un namespace Socket.IO `/diag` e una API publish() per inoltrare
// eventi MQTT al pannello frontend.
//
// Vincoli operativi (concordati in sessione di refactor maggio 2026):
//  - fire-and-forget: publish() non lancia mai eccezioni al chiamante.
//    La diagnostica non deve mai poter rompere il flusso operativo.
//  - early-exit: se nessun client è connesso al namespace, evita di
//    accumulare il batch o schedulare il flush (il buffer circolare
//    in memoria continua comunque ad aggiornarsi per il tail iniziale).
//  - batch emit ogni 100ms con cap 200 msg per non saturare il client.
//  - buffer circolare degli ultimi 1000 messaggi inviato come snapshot
//    iniziale ai nuovi client connessi.

const DBf = require('./DBFunct');
const log = require('./LogFunct');

const NAMESPACE    = '/diag';
const BUFFER_MAX   = 1000;   // tail circolare in memoria (~150KB)
const SNAPSHOT_MAX = 200;    // tail effettivamente inviato al nuovo client
const BATCH_MS     = 100;
const BATCH_MAX    = 200;

const nsp = DBf.io.of(NAMESPACE);

const buffer  = [];   // tail circolare degli ultimi BUFFER_MAX messaggi
let   pending = [];   // batch in attesa di emit verso i client
let   flushTimer = null;

// 2c-C: invio snapshot ridotto al socket richiedente. Usato sia al primo
// connection (automatico) sia al reconnect (su richiesta esplicita del client).
function sendSnapshot(socket) {
	if (buffer.length === 0) return;
	// snapshot ridotto: solo gli ultimi SNAPSHOT_MAX messaggi
	// (per cronistorie più lunghe → LOG\access.log o tabella LOG SQL)
	socket.emit('mqtt-bulk', buffer.slice(-SNAPSHOT_MAX));
}

nsp.on('connection', (socket) => {
	try {
		log.standard("DIAG client connesso (tot:" + nsp.sockets.size + ")");
		sendSnapshot(socket);

		// 2c-C: il client può richiedere uno snapshot esplicito al reconnect
		// (al primo connect lo riceve automaticamente sopra). Idempotente,
		// emit solo al chiamante. Fallimento silenzioso accettato.
		socket.on('request-snapshot', () => {
			try { sendSnapshot(socket); } catch (_) {}
		});

		socket.on('disconnect', () => {
			try {
				log.standard("DIAG client disconnesso (tot:" + nsp.sockets.size + ")");
			} catch (_) {}
		});
	} catch (_) {}
});

function scheduleFlush() {
	if (flushTimer) return;
	flushTimer = setTimeout(() => {
		flushTimer = null;
		if (pending.length === 0) return;
		const batch = pending;
		pending = [];
		try {
			nsp.emit('mqtt-batch', batch);
		} catch (_) {
			// non propago: la diagnostica non deve mai rompere il flusso
		}
	}, BATCH_MS);
}

function pushToBuffer(msg) {
	buffer.push(msg);
	if (buffer.length > BUFFER_MAX) buffer.shift();
}

/**
 * publish(msg) — fire-and-forget. Non lancia eccezioni al chiamante.
 *
 * msg shape attesa:
 *   { ts: <epoch ms>, dir: "IN"|"OUT", topic: string,
 *     payload: string, source: "PLC"|"HMI"|"BACKEND", size: <byte> }
 */
exports.publish = function (msg) {
	try {
		pushToBuffer(msg);
		// early-exit: nessuno ascolta → non accodare, non schedulare
		if (nsp.sockets.size === 0) return;
		if (pending.length >= BATCH_MAX) {
			pending.shift();   // drop del più vecchio del batch
		}
		pending.push(msg);
		scheduleFlush();
	} catch (_) {
		// silently: la diagnostica non deve mai poter rompere il sistema
	}
};

/**
 * hasListeners() — utility per chiamanti che vogliono evitare di
 * costruire l'oggetto messaggio quando nessuno ascolta.
 */
exports.hasListeners = function () {
	try { return nsp.sockets.size > 0; }
	catch (_) { return false; }
};
