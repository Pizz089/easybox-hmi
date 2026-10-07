"use strict";
// ============================================================================
// viceJawSql.js — pezzi comuni del CATALOGO DELLE CHELE DELLA MORSA (7/10,
// prompt 5 di 5): li usano CONF/ViceJaw.js (le rotte del catalogo) e
// CONF/Vice.js (le scritture delle misure della chela, redirette al tipo
// montato). Le misure sono in micron, come nelle colonne.
//
// LE GUARDIE in SQL, dentro la stessa query che scrive: il valore che decide
// e' quello del database ADESSO, non quello che il pannello ha letto prima.
// ============================================================================

// stati del tipo di chele (VICE_JAW.STATUS)
exports.JAW_ATTIVO = 1;
exports.JAW_DISMESSO = 0;
// ordine in lavorazione: il PLC lo esegue, le misure non si toccano
exports.ORDINE_ATTIVO = 3;

// stringa SQL nvarchar con gli apici raddoppiati; null/undefined -> NULL
exports.sqlStr = function (v, max) {
	if (v === null || v === undefined) return 'NULL';
	const s = String(v).slice(0, max || 4000).replace(/'/g, "''");
	return "N'" + s + "'";
};

// intero >= minimo, oppure null
exports.intMin = function (raw, minimo) {
	if (raw === null || raw === undefined || String(raw).trim() === '') return null;
	const t = String(raw).trim();
	if (!/^-?\d+$/.test(t)) return null;
	const n = parseInt(t, 10);
	return n >= minimo ? n : null;
};

// c'e' un ordine a STATUS 3 sul pallet di una morsa che ha montato questo
// tipo? (jaw: espressione SQL, es. '@jaw'). Le misure di un tipo cambiano
// insieme per TUTTE le morse che lo hanno montato.
exports.ordineAttivoSuTipo = function (jaw) {
	return `EXISTS (SELECT 1 FROM VICE vv JOIN WORKORDER ww ON ww.PALLET_ID = vv.PALLET_ID
				WHERE vv.JAW_ID = ${jaw} AND ww.STATUS = ${exports.ORDINE_ATTIVO})`;
};

// c'e' un ordine a STATUS 3 sul pallet della morsa, a parte quello che si sta
// avviando? (pallet, escludi: espressioni SQL; escludi 0 = nessuno)
exports.ordineAttivoSuPallet = function (pallet, escludi) {
	return `EXISTS (SELECT 1 FROM WORKORDER ww
				WHERE ww.PALLET_ID = ${pallet} AND ww.STATUS = ${exports.ORDINE_ATTIVO} AND ww.ID <> ${escludi})`;
};

// BATTUTA CORRETTA per le chele montate: la stessa funzione di pushQuotes,
// identica alle viste COORDINATES_PUSH_MC e COORDINATES_BLOW_MC
//   dichiarata + CLAW_LENGTH_REF/2 - montata/2
exports.battutaCorretta = require('./pushQuotes').stopCorrected;
