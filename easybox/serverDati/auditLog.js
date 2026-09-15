"use strict";
// ============================================================================
// auditLog.js — traccia di CHI ha ridefinito una misura fisica e da dove
// (cantiere push-sim-save, 15/9)
//
// PERCHE' ESISTE. La pagina di simulazione della spinta adesso SALVA. Il
// rischio, detto fin dalla proposta, e' che un valore mosso finche' il disegno
// "torna" diventi indistinguibile da uno misurato col calibro: VICE, GRIPPER e
// PIECE non hanno colonna di autore ne' di data, quindi dopo non c'e' modo di
// sapere da dove viene un numero.
//
// La conferma esplicita a video copre l'INTENZIONE: al momento di scrivere,
// chi salva legge quale oggetto fisico sta ridefinendo e da quale valore a
// quale. Questa riga copre la PROVENIENZA: dopo, la modifica si ritrova.
// Sono due cose diverse e servono tutte e due.
//
// DOVE SCRIVE: la tabella LOG, che esiste gia' e che MQTT_Client usa per gli
// eventi di cella (colonne DATA, DESCR, UNIT_A, UNIT_B). Nessuna tabella
// nuova, nessuno script da lanciare in cella.
//
// NON BLOCCA MAI LA SCRITTURA DEL DATO: se il log fallisce, la misura e' gia'
// stata salvata e l'operatore non deve vedere un errore per una riga di
// diario. Il fallimento finisce nel log su file.
// ============================================================================
const DBf = require('./DBFunct');
const sql = require('mssql');
const log = require('./LogFunct');

// UNIT_A e UNIT_B sono nchar(40): si tagliano, non si lasciano troncare dal
// database. DESCR e' nchar(4000).
const cut = (v, n) => String(v == undefined ? '' : v).replace(/'/g, "''").slice(0, n);

// descr: frase leggibile, con vecchio e nuovo valore gia' dentro.
// source: da dove arriva la modifica (es. 'PUSH_SIM').
// target: l'oggetto toccato (es. 'VICE:1').
exports.audit = function (descr, source, target) {
	try {
		sql.connect(DBf.configDB, function (err) {
			if (err) {
				log.error("audit: connessione fallita, modifica NON tracciata: " + err);
				return;
			}
			const query = `INSERT INTO LOG ([DATA], DESCR, UNIT_A, UNIT_B)
						   VALUES(GETDATE(), '${cut(descr, 3900)}', '${cut(source, 40)}', '${cut(target, 40)}');`;
			new sql.Request().query(query, function (err2) {
				if (err2) log.error("audit: insert fallita, modifica NON tracciata: " + err2);
			});
		});
	} catch (e) {
		log.error("audit: eccezione, modifica NON tracciata: " + e);
	}
};

// sorgenti conosciute, cosi' il valore non viene scritto a mano in giro
exports.SRC_PUSH_SIM = 'PUSH_SIM';
exports.SRC_CONF = 'CONF';
