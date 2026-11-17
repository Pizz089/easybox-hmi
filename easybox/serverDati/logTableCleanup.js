"use strict";
// ============================================================================
// logTableCleanup.js — pulizia a blocchi della tabella LOG (17/11)
//
// PERCHE'. Prima server.js lanciava ogni 4 h, a partire dall'avvio, una DELETE
// sola: "DELETE FROM log WHERE data <= ora - 3 giorni". Da settembre non e' mai
// riuscita. Le righe di LOG sono da 8 KB (DESCR nchar(2000)), una transazione
// sola su giorni di righe supera il log del database (MAXSIZE 100 MB), lo
// riempie ("transaction log full ... ACTIVE_TRANSACTION", access.log del 13/11
// e del 16/11, tutti e due 4 h dopo un avvio) e torna indietro. Intanto la
// tabella e' arrivata a 774 MB sui 779 del database.
//
// COSA FA. Ogni 10 minuti, mai nei primi 10 dopo l'avvio, controlla se c'e'
// almeno una riga piu' vecchia del limite (SELECT TOP 1) e se vale una delle
// due condizioni:
//   (a) nessuna produzione attiva: nessuna riga di WORKORDERS con STATUS=3 AND
//       PRODUCTED<QUANTITY, la stessa regola con cui FB204 sceglie l'ordine
//       attivo;
//   (b) HAAS in lavorazione con il robot fermo: ultimo DISPATCH/MC1/0 = 95 e
//       ultimo DISPATCH/ROBOT/0 = 0, come li ha ricevuti MQTT_Client. Senza un
//       valore ricevuto dopo l'avvio la (b) e' falsa.
// Se si', cancella a BLOCCHI da 2000 righe, una richiesta per blocco, finche'
// un blocco ne cancella 0. Prima di ogni blocco la condizione si ricontrolla:
// se e' caduta ci si ferma e si riprende al giro dopo. Ogni blocco e' una
// transazione piccola, il log si svuota fra un blocco e l'altro.
//
// Le righe cancellate vengono da @@ROWCOUNT, non da rowsAffected: un trigger
// su LOG aggiungerebbe le sue righe al conteggio (stessa lezione del trigger
// su [POSITION], vedi orderAutoClose.js).
//
// Una riga di log STANDARD per passata (deve sopravvivere a logLevel 2):
// righe, blocchi, durata, condizione, motivo di fine. Un controllo che non fa
// partire niente non scrive niente.
//
// Giorni da tenere: LOG_TABLE_KEEP_DAYS nel .env, default 60 se manca o non e'
// un intero positivo (mai "cancella tutto" per un valore sbagliato).
//
// UN SOLO TIMER, NIENTE SOVRAPPOSIZIONI: setTimeout a catena come
// orderAutoClose.js, il giro dopo si programma a passata finita.
// ============================================================================

const INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_GIORNI = 60;

const DELETE_QUERY = `SET DEADLOCK_PRIORITY LOW; DELETE TOP (2000) FROM LOG WHERE DATA < DATEADD(day, -@giorni, GETDATE()); SELECT @@ROWCOUNT AS n;`;
const OLD_ROW_QUERY = `SELECT TOP 1 ID FROM LOG WHERE DATA < DATEADD(day, -@giorni, GETDATE());`;
const ACTIVE_ORDER_QUERY = `SELECT TOP 1 ID FROM WORKORDERS WHERE STATUS=3 AND PRODUCTED<QUANTITY;`;

// DISPATCH che fanno la condizione b
const MC1_IN_LAVORAZIONE = 95;
const ROBOT_FERMO = 0;

const CONDIZIONI = {
	a: 'condizione a (nessuna produzione attiva)',
	b: 'condizione b (HAAS in lavorazione, robot fermo)',
};

// valore grezzo del .env -> { giorni, fonte }
function giorniDaConfig(raw) {
	const s = String(raw == undefined ? '' : raw).trim();
	if (s === '') return { giorni: DEFAULT_GIORNI, fonte: 'default, LOG_TABLE_KEEP_DAYS assente' };
	if (/^\d+$/.test(s) && parseInt(s, 10) > 0) return { giorni: parseInt(s, 10), fonte: 'LOG_TABLE_KEEP_DAYS' };
	return { giorni: DEFAULT_GIORNI, fonte: 'default, LOG_TABLE_KEEP_DAYS non valido [' + s + ']' };
}

// deps: { sql, configDB, log, giorni, ultimoDispatch(unit, n), setTimeout?,
// intervalMs? } — iniettate per poterle sostituire nel test
// (test_log_table_cleanup.js)
function createLogTableCleanup(deps) {
	const sql = deps.sql;
	const log = deps.log;
	const schedule = deps.setTimeout || setTimeout;
	const intervalMs = deps.intervalMs || INTERVAL_MS;
	const { giorni, fonte } = giorniDaConfig(deps.giorni);
	let running = false;
	let timer = null;
	let stopped = false;

	const connect = () => new Promise((resolve, reject) => {
		sql.connect(deps.configDB, err => (err ? reject(err) : resolve()));
	});
	const query = (q, conGiorni) => new Promise((resolve, reject) => {
		const request = new sql.Request();
		if (conGiorni) request.input('giorni', sql.Int, giorni);
		request.query(q, (err, result) => (err ? reject(err) : resolve(result)));
	});
	const righe = result => ((result && result.recordset) || []);

	// 'b', 'a' o null. La b prima: non costa una query.
	async function condizione() {
		if (deps.ultimoDispatch
			&& deps.ultimoDispatch('MC1', 0) === MC1_IN_LAVORAZIONE
			&& deps.ultimoDispatch('ROBOT', 0) === ROBOT_FERMO) return 'b';
		return righe(await query(ACTIVE_ORDER_QUERY, false)).length === 0 ? 'a' : null;
	}

	async function passata() {
		try {
			await connect();
		} catch (err) {
			log.error("pulizia LOG: connessione DB fallita: " + err);
			return;
		}

		let cond;
		try {
			cond = await condizione();
			if (!cond) return;
			if (righe(await query(OLD_ROW_QUERY, true)).length === 0) return;
		} catch (err) {
			log.error("pulizia LOG: errore SQL nel controllo: " + err);
			return;
		}

		const t0 = Date.now();
		let cancellate = 0;
		let blocchi = 0;
		let fine;
		try {
			for (;;) {
				if (blocchi > 0 && !(await condizione())) { fine = 'condizione caduta, si riprende al giro dopo'; break; }
				const n = Number((righe(await query(DELETE_QUERY, true))[0] || {}).n) || 0;
				if (n === 0) { fine = 'finito'; break; }
				cancellate += n;
				blocchi++;
			}
		} catch (err) {
			log.error("pulizia LOG: errore SQL: " + err);
			fine = 'errore (' + err + ')';
		}
		log.standard("PULIZIA LOG: " + cancellate + " righe cancellate in " + blocchi
			+ (blocchi === 1 ? " blocco" : " blocchi") + ", " + ((Date.now() - t0) / 1000).toFixed(1) + " s, "
			+ CONDIZIONI[cond] + ", fine: " + fine + " (tengo " + giorni + " giorni)");
	}

	function next() {
		if (stopped) return;
		timer = schedule(() => tick(), intervalMs);
	}

	// Un giro. Se uno e' ancora in corso non ne parte un secondo (false);
	// altrimenti la promessa della passata, che non rigetta mai.
	function tick() {
		if (running) return false;
		running = true;
		return passata()
			.catch(err => log.error("pulizia LOG: " + err))
			.then(() => { running = false; next(); });
	}

	return {
		start() {
			stopped = false;
			log.init("pulizia LOG: tengo " + giorni + " giorni (" + fonte + "), controllo ogni "
				+ Math.round(intervalMs / 60000) + " min, il primo fra " + Math.round(intervalMs / 60000) + " min");
			next();
		},
		stop() { stopped = true; if (timer && deps.clearTimeout) deps.clearTimeout(timer); },
		tick,
		isRunning: () => running,
	};
}

module.exports = { createLogTableCleanup, giorniDaConfig, DELETE_QUERY, OLD_ROW_QUERY, ACTIVE_ORDER_QUERY, INTERVAL_MS, DEFAULT_GIORNI };
