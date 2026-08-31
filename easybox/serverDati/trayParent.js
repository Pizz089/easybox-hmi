"use strict";
// ============================================================================
// trayParent.js — predicato canonico per le tasche cassetto in [POSITION]
// (fix tray-parent-predicate, verifica in cella 2026-08-31/09-01).
//
// In cella PARENT e' NCHAR(30): 'TRAY_9' + padding di spazi a destra.
// Il canone e' l'UGUAGLIANZA: PARENT = 'TRAY_<n>' (i trailing spaces
// dell'nchar sono ignorati dal confronto ANSI). NIENTE LIKE:
//  - 'TRAY_<n>%' senza spazio: '_' e' jolly e il prefisso aggancia anche
//    TRAY_10 dai predicati del tray 1 (provato sui dati cella: 32 righe
//    di TRAY_10 matchate da LIKE 'TRAY_1%');
//  - 'TRAY_<n> %' con spazio: matcha SOLO grazie al padding dell'nchar
//    (lo spazio del pattern consuma il primo spazio di padding) e
//    smetterebbe di funzionare su varchar o con ANSI_PADDING OFF.
// Verifica cella 2026-08-31: DISTINCT PARENT = {TRAY_9, TRAY_10} paddati,
// NESSUN suffisso storico dopo il numero (percio' niente ramo OR LIKE).
// ============================================================================

// Ritorna il predicato SQL "(<col> = 'TRAY_<n>')" oppure null se il numero
// cassetto non e' un intero 1..12 (stesso range gia' validato da
// teachTrays/propagateTeaching in CONF/Tray.js). Il valore entra nella query
// SOLO dopo la validazione a intero: il chiamante su null risponde
// KO_BAD_INPUT (route) o scarta loggando (MQTT).
exports.trayParentPredicate = function (trayFloor, col) {
	const n = Number(trayFloor);
	if (!Number.isInteger(n) || n < 1 || n > 12) return null;
	return "(" + (col || "PARENT") + " = 'TRAY_" + n + "')";
};
