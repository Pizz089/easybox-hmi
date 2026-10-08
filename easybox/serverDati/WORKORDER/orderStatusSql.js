"use strict";
// ============================================================================
// WORKORDER/orderStatusSql.js — (8/10, prompt 8) il cambio di stato di un
// ordine dalla Produzione (socket TO_PLANT/CMD/ORDER di MQTT_Client.js: Play =
// 3, torna a grezzo = 4, ...). Qui e non nel gestore del socket, cosi' la
// query si prova sul database vero (test_vice_jaw_db.js) senza caricare
// MQTT_Client.js, che all'avvio si collega al broker.
//
// Prima: id, stato e pezzo andavano nella query grezzi, senza transazione.
// Adesso: interi controllati, una transazione con XACT_ABORT, e al passaggio
// a 3 il CONTROLLO DELLE CHELE (viceJawSql.koChelePlay), che prima stava nella
// vista COORDINATES_Z_MC: morsa del pallet senza tipo montato o chele
// confermate diverse da quelle montate -> l'ordine NON passa a 3 e nessuna
// tasca si prenota. Il resto e' quello di prima: a 3 si prenotano
// TOP(QUANTITY) grezzi del pezzo, a 4 si liberano.
// ============================================================================
const J = require('../viceJawSql');

// i dati del socket: { id, status, pieceID } controllati, oppure null
exports.leggi = function (data) {
	const d = data || {};
	const id = J.intMin(d.id, 1);
	const status = J.intMin(d.status, 0);
	const pieceID = J.intMin(d.pieceID, 0);
	if (id === null || status === null || ((status == 3 || status == 4) && pieceID === null)) return null;
	return { id, status, pieceID };
};

// la query: una riga { ris } con 'OK' o il codice del rifiuto
exports.query = function ({ id, status, pieceID }) {
	let query = `SET NOCOUNT ON; SET XACT_ABORT ON;
					BEGIN TRAN;
					DECLARE @id int = ${id}, @ko varchar(40) = NULL;
					${status == 3 ? `SET @ko = ${J.koChelePlay('@id')};` : ''}
					IF @ko IS NOT NULL BEGIN ROLLBACK; SELECT @ko AS ris; END
					ELSE BEGIN
					UPDATE WORKORDERS SET
					STATUS='${status}'
					WHERE ID=@id;`;

	if (status == 3){  //WORKING
		query += `UPDATE [POSITION] SET Order_ID=@id WHERE id IN (
						SELECT top (SELECT QUANTITY FROM WORKORDERS WHERE ID=@id) id FROM POSITION WHERE Part_Type=${pieceID} AND STATUS=4 AND ORDER_ID=0
					  );`;
	}
	if (status == 4){  //RAW
		query += `UPDATE [POSITION] SET Order_ID=0 WHERE id in (
						SELECT id FROM position WHERE Part_Type=${pieceID} AND STATUS=4 AND ORDER_ID=@id
					 );`
	}
	query += `
					COMMIT;
					SELECT 'OK' AS ris;
					END`;
	return query;
};

// l'esito: l'ultima riga con ris (un trigger su [POSITION] puo' aggiungere i
// suoi risultati); {} se non c'e'
exports.esito = function (result) {
	const esiti = ((result && result.recordsets) || []).map(r => r && r[0]).filter(r => r && r.ris !== undefined);
	return esiti.length ? esiti[esiti.length - 1] : {};
};
