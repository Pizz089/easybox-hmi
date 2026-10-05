"use strict";
// ============================================================================
// orderAutoClose.js — chiusura automatica degli ordini (P4 5/10, decisione D4-A)
//
// PERCHE'. La chiusura che esiste (setPositionStatus in MQTT_Client.js) scatta
// solo su FROM_PLANT/PART/BOX/TRAY, che nessun blocco PLC pubblica. Gli ordini
// restano quindi a STATUS=3 con PRODUCTED >= QUANTITY, e bloccano "Azzera
// stato cassetto", che ha la guardia "nessun ordine a 3".
//
// COSA FA. Ogni 30 s, e una volta all'avvio, porta a 5 (finito) gli ordini a 3
// con PRODUCTED >= QUANTITY. PRODUCTED e' il conteggio della vista WORKORDERS
// (tasche finite dell'ordine), quindi la condizione si legge dalla vista e si
// scrive sulla base table WORKORDER. Gli ordini chiusi si sanno da OUTPUT
// inserted.ID, non da rowsAffected: il trigger su [POSITION] insegna a non
// fidarsi dei conteggi delle righe toccate.
//
// Il PLC non cambia: legge solo ordini con Status=3 AND PRODUCTED<QUANTITY,
// quindi chiudere quelli gia' a quantita' per lui non cambia niente.
//
// UN SOLO TIMER, NIENTE SOVRAPPOSIZIONI: il giro successivo si programma solo
// quando il precedente ha finito (setTimeout a catena, non setInterval). Una
// query lenta allunga l'intervallo, non accavalla due UPDATE. Su errore SQL:
// log, nessun crash, si riprova al giro dopo.
// ============================================================================

const INTERVAL_MS = 30 * 1000;

const CLOSE_QUERY = `UPDATE WORKORDER SET STATUS=5 OUTPUT inserted.ID WHERE STATUS=3 AND ID IN (SELECT ID FROM WORKORDERS WHERE STATUS=3 AND PRODUCTED>=QUANTITY);`;

// deps: { sql, configDB, io, log, setTimeout?, intervalMs? } — iniettate per
// poterle sostituire nel test (test_order_autoclose.js)
function createOrderAutoClose(deps) {
	const sql = deps.sql;
	const log = deps.log;
	const schedule = deps.setTimeout || setTimeout;
	const intervalMs = deps.intervalMs || INTERVAL_MS;
	let running = false;
	let timer = null;
	let stopped = false;

	function next() {
		if (stopped) return;
		timer = schedule(tick, intervalMs);
	}

	function done() {
		running = false;
		next();
	}

	// Un giro: chiude gli ordini arrivati a quantita'. Se un giro e' ancora in
	// corso (non dovrebbe succedere col setTimeout a catena, ma tick() si puo'
	// chiamare anche da fuori) non ne parte un secondo.
	function tick() {
		if (running) return false;
		running = true;
		try {
			sql.connect(deps.configDB, function (err) {
				if (err) { log.error("chiusura ordini: connessione DB fallita: " + err); done(); return; }
				new sql.Request().query(CLOSE_QUERY, function (err, result) {
					if (err) { log.error("chiusura ordini: errore SQL: " + err); done(); return; }
					const ids = ((result && result.recordset) || []).map(r => r.ID);
					if (ids.length > 0) {
						log.standard("CHIUSURA ORDINI: " + ids.length + " ordini a quantita' raggiunta -> 5 (finito): " + ids.join(', '));
						deps.io.emit('PRODUCTION/CHANGED');
					}
					done();
				});
			});
		} catch (e) {
			log.error("chiusura ordini: " + e);
			done();
		}
		return true;
	}

	return {
		start() { stopped = false; tick(); },
		stop() { stopped = true; if (timer && deps.clearTimeout) deps.clearTimeout(timer); },
		tick,
		isRunning: () => running,
	};
}

module.exports = { createOrderAutoClose, CLOSE_QUERY, INTERVAL_MS };
