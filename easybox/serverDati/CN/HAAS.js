"use strict";
// HAAS.js — comunicazione con CNC HAAS via W-protocol su TCP porta 5000.
//
// Pattern operativo:
//   - Singleton per-MC (map interna mcNum → instance). createHaas(1) chiamato
//     2 volte ritorna la stessa istanza.
//   - Connessione TCP persistente con auto-reconnect (backoff esponenziale).
//   - Request/response strettamente sequenziale (W-protocol non multiplexa).
//   - Coda interna serializza chiamate concorrenti.
//   - Timeout di default 2s per rilevare socket morti.
//   - TCP keepalive 30s come rete di sicurezza passiva (kernel-level).
//   - Hook diag MQTT per lifecycle (_HAAS/CONNECT, _HAAS/CLOSE, _HAAS/RECONNECT)
//     e errori protocollo (_HAAS/ERROR), entrambi visibili nel pannello /diag/mqtt.
//   - Errori delle Promise (setMacroVar/requestProgram reject) espongono err.code:
//     contratto pubblico in exports.errorCodes, no substring matching su err.message.
//
// Sintassi W-protocol assunta — TODO_VERIFY su manuale HAAS Macro Programming
// Reference o test su cantiere. Le funzioni buildSetMacroPacket /
// parseSetMacroResponse sono isolate per correzione chirurgica al primo go-live.
//   Request:  ?E<var> <value>\r\n
//   Success:  ?E<var> <value>\r\n   (echo con valore confermato in float)
//   Error:    ?E<var> STATUS=NAK\r\n (o codice specifico)

const net  = require('net');
const log  = require('../LogFunct');
const diag = require('../MQTTDiag');

// ============================================================================
// CONFIGURAZIONE (defaults sovrascrivibili via .env)
// ============================================================================

const DEFAULT_TIMEOUT_MS = parseInt(process.env.HAAS_TIMEOUT_MS, 10) || 2000;
const DEFAULT_PROGRAM_TRIGGER_VAR = parseInt(process.env.HAAS_PROGRAM_TRIGGER_VAR, 10) || 500;

// Backoff esponenziale per reconnect (ms). Saturato all'ultimo valore.
const RECONNECT_BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];

// TCP keepalive (kernel-level, rete di sicurezza passiva contro morte silenziosa).
const TCP_KEEPALIVE_MS = 30000;

// ============================================================================
// ERROR CODES — contratto pubblico per chi cattura le Promise di setMacroVar /
// requestProgram. Ogni reject genera un Error con err.code === uno di questi
// valori. Pattern coerente con Node.js core (fs ENOENT, net ECONNREFUSED).
// Il dispatcher MQTT li mappa direttamente in codici ACK PLC, evitando il
// substring-matching fragile su err.message.
// ============================================================================

const ERROR_CODES = {
	TIMEOUT:       'haas_timeout',
	NAK:           'haas_nak',
	SOCKET_CLOSED: 'socket_closed',
	WRITE_FAILED:  'write_failed',
	CLOSED:        'closed',
	CLOSING:       'closing',
};

// ============================================================================
// SINGLETON REGISTRY
// ============================================================================

const instances = new Map();   // mcNum (number) → instance object

// Flag globale di shutdown. Settato a true da closeAll(), blocca creazioni
// di nuove istanze finché il processo non muore. Previene race: dispatcher
// MQTT che chiama createHaas() mentre closeAll() è in volo otterrebbe
// altrimenti una nuova istanza con connessione TCP fresca in parallelo a
// quelle che si stanno chiudendo.
let shuttingDown = false;

/**
 * createHaas(mcNum, opts) → instance
 * Singleton per-MC: due chiamate con lo stesso mcNum ritornano la stessa istanza.
 * Eager init: la connessione TCP viene aperta immediatamente.
 *
 * opts (tutti opzionali, fallback a .env):
 *   ip:         string  (HAAS_MC<n>_IP, obbligatorio se non in env)
 *   port:       number  (HAAS_MC<n>_PORT, default 5000)
 *   timeoutMs:  number  (HAAS_TIMEOUT_MS, default 2000)
 *   triggerVar: number  (HAAS_PROGRAM_TRIGGER_VAR, default 500)
 */
function createHaas(mcNum, opts) {
	if (shuttingDown) {
		throw new Error('HAAS module shutting down, cannot create new instances');
	}
	const key = Number(mcNum);
	const existing = instances.get(key);
	if (existing) return existing;
	const inst = makeHaasInstance(key, opts || {});
	instances.set(key, inst);
	return inst;
}

/**
 * closeAll() → Promise<void>
 * Chiude pulitamente tutte le instances. Da chiamare al SIGTERM del backend.
 */
function closeAll() {
	shuttingDown = true;
	const promises = [];
	for (const inst of instances.values()) {
		promises.push(inst.close().catch(() => {}));
	}
	instances.clear();
	return Promise.all(promises);
}

// ============================================================================
// PACKET HELPERS — TODO_VERIFY sintassi W-protocol esatta
// ============================================================================

function buildSetMacroPacket(varNum, value) {
	// TODO_VERIFY: formato corrente assunto ?E<var> <value>\r\n
	return '?E' + varNum + ' ' + Number(value) + '\r\n';
}

function parseSetMacroResponse(line) {
	// TODO_VERIFY: formato corrente assunto:
	//   Success: ?E<var> <value>     (echo con valore confermato)
	//   Error:   ?E<var> STATUS=<code>
	const m = line.match(/^\?E(\d+)\s+(.+)$/);
	if (!m) throw new Error('Invalid response format: ' + JSON.stringify(line));
	const varNum = parseInt(m[1], 10);
	const rest = m[2].trim();
	if (rest.startsWith('STATUS=')) {
		const err = new Error('HAAS NAK: ' + rest);
		err.code = ERROR_CODES.NAK;
		throw err;
	}
	const value = parseFloat(rest);
	if (Number.isNaN(value)) throw new Error('Invalid value in response: ' + JSON.stringify(rest));
	return { varNum, value };
}

// ============================================================================
// FACTORY — state per-instance in closure (no class, no this)
// ============================================================================

function makeHaasInstance(mcNum, opts) {
	const ip         = opts.ip   || process.env['HAAS_MC' + mcNum + '_IP'];
	const port       = opts.port || parseInt(process.env['HAAS_MC' + mcNum + '_PORT'], 10) || 5000;
	const timeoutMs  = opts.timeoutMs  || DEFAULT_TIMEOUT_MS;
	const triggerVar = opts.triggerVar || DEFAULT_PROGRAM_TRIGGER_VAR;

	// Errore di config statica (manca .env): gestito da bootEagerHaas in
	// MQTT_Client.js, che pubblica _HAAS/CONFIG_ERROR nel diag. Niente err.code:
	// non è un errore di runtime ma di setup, non coinvolge il dispatcher.
	if (!ip) {
		throw new Error('HAAS MC' + mcNum + ': IP non configurato (HAAS_MC' + mcNum + '_IP)');
	}

	// --- state ---
	let socket = null;
	let connState = 'idle';        // idle | connecting | connected | reconnecting | closing | closed
	let recvBuffer = '';
	let queue = [];                // [{ packet, label, resolve, reject, timeoutHandle }]
	let busy = false;
	let pendingRequest = null;
	let reconnectAttempt = 0;
	let reconnectTimer = null;
	let reconnectLogged = false;   // anti-spam diag (come _BROKER/RECONNECT in 2c-B)
	let lastError = null;
	let lastConnectTs = 0;

	function publishDiag(suffix, payload) {
		try {
			const payloadStr = String(payload);
			diag.publish({
				ts: Date.now(),
				dir: "IN",
				topic: '_HAAS/' + suffix,
				payload: payloadStr,
				source: "BACKEND",
				size: Buffer.byteLength(payloadStr)
			});
		} catch (_) {}
	}

	function _connect() {
		if (connState === 'connecting' || connState === 'connected') return;
		if (connState === 'closing' || connState === 'closed') return;
		connState = 'connecting';

		socket = new net.Socket();
		socket.setKeepAlive(true, TCP_KEEPALIVE_MS);

		socket.once('connect', () => {
			connState = 'connected';
			reconnectAttempt = 0;
			reconnectLogged = false;
			lastConnectTs = Date.now();
			lastError = null;
			recvBuffer = '';
			log.standard('HAAS MC' + mcNum + ': connected to ' + ip + ':' + port);
			publishDiag('CONNECT', 'MC' + mcNum + ' connected to ' + ip + ':' + port);
			_processQueue();
		});

		socket.on('data', (chunk) => {
			recvBuffer += chunk.toString();
			while (true) {
				const idx = recvBuffer.indexOf('\n');
				if (idx === -1) break;
				let line = recvBuffer.slice(0, idx);
				if (line.endsWith('\r')) line = line.slice(0, -1);
				recvBuffer = recvBuffer.slice(idx + 1);
				if (line.length === 0) continue;
				_onResponseLine(line);
			}
		});

		socket.once('close', () => {
			const wasConnected = (connState === 'connected');
			const wasClosing   = (connState === 'closing');
			connState = wasClosing ? 'closed' : 'reconnecting';
			log.standard('HAAS MC' + mcNum + ': socket closed');
			if (wasConnected) publishDiag('CLOSE', 'MC' + mcNum + ' disconnected');
			// reject pending request (non re-tentiamo automaticamente)
			if (pendingRequest) {
				if (pendingRequest.timeoutHandle) clearTimeout(pendingRequest.timeoutHandle);
				const p = pendingRequest;
				pendingRequest = null;
				busy = false;
				const err = new Error('HAAS MC' + mcNum + ': socket closed during request');
				err.code = ERROR_CODES.SOCKET_CLOSED;
				p.reject(err);
			}
			socket = null;
			if (connState === 'reconnecting') _scheduleReconnect();
		});

		socket.on('error', (err) => {
			lastError = err.message || String(err);
			log.standard('HAAS MC' + mcNum + ': socket error: ' + lastError);
			// niente publishDiag qui: il close che segue darà CLOSE/RECONNECT
		});

		try {
			socket.connect({ host: ip, port: port });
		} catch (e) {
			lastError = e.message || String(e);
			log.standard('HAAS MC' + mcNum + ': connect threw: ' + lastError);
			connState = 'reconnecting';
			_scheduleReconnect();
		}
	}

	function _scheduleReconnect() {
		if (reconnectTimer) return;
		if (connState === 'closed' || connState === 'closing') return;
		const delay = RECONNECT_BACKOFF_MS[Math.min(reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
		reconnectAttempt++;
		if (!reconnectLogged) {
			reconnectLogged = true;
			publishDiag('RECONNECT', 'MC' + mcNum + ' attempting reconnect (delay ' + delay + 'ms)');
		}
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			if (connState === 'closed' || connState === 'closing') return;
			_connect();
		}, delay);
	}

	function _onResponseLine(line) {
		if (!pendingRequest) {
			log.standard('HAAS MC' + mcNum + ': unsolicited response: ' + JSON.stringify(line));
			return;
		}
		clearTimeout(pendingRequest.timeoutHandle);
		const p = pendingRequest;
		pendingRequest = null;
		busy = false;
		try {
			const parsed = parseSetMacroResponse(line);
			p.resolve(parsed);
		} catch (e) {
			publishDiag('ERROR', 'MC' + mcNum + ' ' + p.label + ' failed: ' + e.message);
			p.reject(e);
		}
		_processQueue();
	}

	function _processQueue() {
		if (busy || queue.length === 0) return;
		if (connState !== 'connected') {
			// non posso processare ora; al prossimo 'connect' la coda riprende automaticamente
			return;
		}
		const req = queue.shift();
		busy = true;
		pendingRequest = req;
		req.timeoutHandle = setTimeout(() => {
			if (pendingRequest !== req) return;
			pendingRequest = null;
			busy = false;
			publishDiag('ERROR', 'MC' + mcNum + ' ' + req.label + ' timeout (' + timeoutMs + 'ms)');
			const err = new Error('HAAS MC' + mcNum + ' timeout: ' + req.label);
			err.code = ERROR_CODES.TIMEOUT;
			req.reject(err);
			_processQueue();
		}, timeoutMs);
		try {
			socket.write(req.packet);
		} catch (e) {
			clearTimeout(req.timeoutHandle);
			pendingRequest = null;
			busy = false;
			const err = new Error('HAAS MC' + mcNum + ' write failed: ' + e.message);
			err.code = ERROR_CODES.WRITE_FAILED;
			req.reject(err);
			// il socket emetterà 'close' che triggera reconnect
		}
	}

	// --- API pubblica ---

	function setMacroVar(varNum, value) {
		return new Promise((resolve, reject) => {
			if (connState === 'closed') {
				const err = new Error('HAAS MC' + mcNum + ' closed');
				err.code = ERROR_CODES.CLOSED;
				return reject(err);
			}
			if (connState === 'closing') {
				const err = new Error('HAAS MC' + mcNum + ' closing');
				err.code = ERROR_CODES.CLOSING;
				return reject(err);
			}
			queue.push({
				packet: buildSetMacroPacket(varNum, value),
				label: 'setMacroVar(' + varNum + ',' + value + ')',
				resolve, reject,
				timeoutHandle: null,
			});
			_processQueue();
		});
	}

	function requestProgram(programNum) {
		// Scrive la macro var trigger (default #500) col numero programma.
		// Il programma macro caricato sulla HAAS userà quel valore per decidere
		// quale sottoprogramma lanciare. Non garantiamo l'esecuzione effettiva.
		return setMacroVar(triggerVar, programNum);
	}

	function getStatus() {
		return {
			mcNum,
			ip, port,
			state: connState,
			connected: connState === 'connected',
			queueLen: queue.length,
			busy,
			reconnectAttempt,
			lastError,
			lastConnectTs,
		};
	}

	function close() {
		return new Promise((resolve) => {
			connState = 'closing';
			if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
			if (pendingRequest) {
				if (pendingRequest.timeoutHandle) clearTimeout(pendingRequest.timeoutHandle);
				const err = new Error('HAAS MC' + mcNum + ' closing');
				err.code = ERROR_CODES.CLOSING;
				pendingRequest.reject(err);
				pendingRequest = null;
			}
			busy = false;
			for (const req of queue) {
				const err = new Error('HAAS MC' + mcNum + ' closing');
				err.code = ERROR_CODES.CLOSING;
				req.reject(err);
			}
			queue = [];
			if (socket) {
				// Rimuovo i listener originali prima di registrare il mio handler di
				// chiusura. Senza questo, se siamo in stato 'connecting' e il
				// 'connect' tardivo arriva durante close(), il listener originale
				// sovrascrive connState='closing'→'connected', poi il close handler
				// originale vede wasClosing=false e schedula reconnect (con
				// _HAAS/RECONNECT spurio nel diag, e reconnectTimer orfano).
				socket.removeAllListeners();
				// Swallow di eventuali 'error' asincroni durante socket.end(): senza
				// handler diventerebbero uncaughtException. Caso raro (RST tardivo,
				// stack TCP in errore) ma fatale per il processo.
				socket.on('error', () => {});
				socket.once('close', () => { connState = 'closed'; resolve(); });
				try { socket.end(); } catch (_) {}
			} else {
				connState = 'closed';
				resolve();
			}
		});
	}

	// EAGER INIT: connessione aperta subito. Pannello diag mostrerà _HAAS/CONNECT
	// (o CLOSE+RECONNECT se HAAS non raggiungibile) all'avvio backend.
	_connect();

	return {
		setMacroVar,
		requestProgram,
		getStatus,
		close,
	};
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.createHaas              = createHaas;
exports.closeAll                = closeAll;
exports.buildSetMacroPacket     = buildSetMacroPacket;
exports.parseSetMacroResponse   = parseSetMacroResponse;
exports.errorCodes              = ERROR_CODES;
