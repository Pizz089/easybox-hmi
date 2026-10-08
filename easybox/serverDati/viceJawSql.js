"use strict";
// ============================================================================
// viceJawSql.js — pezzi comuni del CATALOGO DELLE CHELE DELLA MORSA (7/10,
// prompt 5 di 5; correzioni dell'audit 8/10, prompt 8): li usano
// CONF/ViceJaw.js (le rotte del catalogo), CONF/Vice.js (le scritture delle
// misure della chela, redirette al tipo montato), WORKORDER/Order.js e il
// socket TO_PLANT/CMD/ORDER di MQTT_Client.js (il passaggio a STATUS 3). Le
// misure sono in micron, come nelle colonne.
//
// LE GUARDIE in SQL, dentro la stessa transazione che scrive: il valore che
// decide e' quello del database ADESSO, non quello che il pannello ha letto
// prima. (8/10) Gli ordini si leggono WITH (UPDLOCK, HOLDLOCK), come
// Tray.js, Grating.js e Order.js: fra il controllo e la scrittura nessun
// ordine passa a STATUS 3 sotto di noi.
// ============================================================================
const ERR = require('./errorCodes');

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

// (8/10) un campo intero della riga di una morsa, per la query: vuoto,
// "null" o assente -> 'NULL'; un intero (anche negativo) -> il numero;
// qualunque altra cosa -> undefined (il chiamante risponde KO_BAD_INPUT).
// Prima i campi andavano nella query grezzi: "1 OR 1=1" passava.
exports.intSql = function (raw) {
	if (raw === null || raw === undefined) return 'NULL';
	const t = String(raw).trim();
	if (t === '' || t.toLowerCase() === 'null' || t.toLowerCase() === 'undefined') return 'NULL';
	if (!/^-?\d{1,10}$/.test(t)) return undefined;
	const n = parseInt(t, 10);
	return n >= -2147483648 && n <= 2147483647 ? String(n) : undefined;
};

// c'e' un ordine a STATUS 3 sul pallet di una morsa che ha montato questo
// tipo? (jaw: espressione SQL, es. '@jaw'). Le misure di un tipo cambiano
// insieme per TUTTE le morse che lo hanno montato.
exports.ordineAttivoSuTipo = function (jaw) {
	return `EXISTS (SELECT 1 FROM WORKORDER ww WITH (UPDLOCK, HOLDLOCK)
				WHERE ww.STATUS = ${exports.ORDINE_ATTIVO}
				  AND ww.PALLET_ID IN (SELECT vv.PALLET_ID FROM VICE vv WHERE vv.JAW_ID = ${jaw}))`;
};

// c'e' un ordine a STATUS 3 sul pallet della morsa? (pallet: espressione SQL)
// (8/10) senza piu' l'ordine «da escludere»: il client poteva mandare un
// intero qualsiasi e saltare la guardia. L'ordine che si avvia non e' ancora a
// STATUS 3 quando si apre il dialog di avvio.
exports.ordineAttivoSuPallet = function (pallet) {
	return `EXISTS (SELECT 1 FROM WORKORDER ww WITH (UPDLOCK, HOLDLOCK)
				WHERE ww.PALLET_ID = ${pallet} AND ww.STATUS = ${exports.ORDINE_ATTIVO})`;
};

// (8/10, prompt 8) IL CONTROLLO DELLE CHELE AL PASSAGGIO A STATUS 3 (Play da
// Produzione, rilancio). Prima stava nella vista COORDINATES_Z_MC, che
// nascondeva la riga: ma tre punti del PLC prendono «l'ordine piu' recente»
// dalla vista, e con la riga nascosta il robot avrebbe preso le quote di un
// altro ordine. Espressione SQL: NULL se si puo' avviare, altrimenti il codice:
//   KO_ORDER_VICE_NO_JAW   il pallet dell'ordine ha una morsa senza tipo di
//                          chele montato (le quote uscirebbero senza
//                          l'appoggio delle chele);
//   KO_ORDER_JAW_MISMATCH  l'ordine ha chele confermate (WORKORDER.JAW_ID)
//                          e non sono quelle montate sulla morsa del suo
//                          pallet (o il pallet non ha piu' una morsa).
// ordine: espressione SQL, es. '@id'. lock = false nelle sole letture
// (anteprima del rilancio): niente UPDLOCK fuori da una transazione.
exports.koChelePlay = function (ordine, lock = true) {
	const blocca = lock ? ' WITH (UPDLOCK, HOLDLOCK)' : '';
	return `CASE
		WHEN EXISTS (SELECT 1 FROM WORKORDER w${blocca} JOIN VICE v ON v.PALLET_ID = w.PALLET_ID
					 WHERE w.ID = ${ordine} AND v.JAW_ID IS NULL) THEN '${ERR.KO_ORDER_VICE_NO_JAW}'
		WHEN EXISTS (SELECT 1 FROM WORKORDER w${blocca}
					 WHERE w.ID = ${ordine} AND w.JAW_ID IS NOT NULL
					   AND NOT EXISTS (SELECT 1 FROM VICE v WHERE v.PALLET_ID = w.PALLET_ID AND v.JAW_ID = w.JAW_ID)) THEN '${ERR.KO_ORDER_JAW_MISMATCH}'
		ELSE NULL END`;
};

// BATTUTA CORRETTA per le chele montate: la stessa funzione di pushQuotes,
// identica alle viste COORDINATES_PUSH_MC e COORDINATES_BLOW_MC
//   dichiarata + REF/2 - montata/2
// (8/10) REF = la lunghezza ADESSO del tipo di riferimento della battuta
// (PIECE_ON_VICE.CLAW_JAW_REF), non piu' una lunghezza salvata
exports.battutaCorretta = require('./pushQuotes').stopCorrected;
