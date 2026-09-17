//////// HMI ////////
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('../LogFunct');
const ERR 	= require('../errorCodes');
const audit = require('../auditLog');

var templatePATH = '.';

// (push-to-stop 15/9) lunghezza ganascia della morsa sull'asse di battuta,
// in micron. Assente, vuota o non intera -> NULL = non misurata: il ciclo di
// spinta non si abilita (la vista COORDINATES_PUSH_MC risponde NO_DATA e
// l'ordine viene rifiutato con KO_PUSH_NO_DATA).
function clawLengthSql(raw) {
	const n = parseInt(raw, 10);
	if (raw == undefined || String(raw).trim() === '' || isNaN(n) || n < 0) return 'NULL';
	return String(n);
}

router.get('/show/:ID', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getTrayFromID: " + err);
            return;
        }

		let query = `select * from VICES ;`
		//console.log("ricevo:" +String(req.params.ID))
		if (String(req.params.ID)!="all") 
			query = `select * from VICES where ID='${req.params.ID}';`
		
		var request = new sql.Request();
        					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.json({})
            }else
				res.send(recordset.recordset)
        });
	});
})

//TODO: da testare
router.get('/updateVice', (req, res) => {

	//console.log(">>>"+JSON.stringify(req.query,null,4));
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updateVice: " + err);
            return;
        }

		// PALLET_ID (cantiere Attrezzaggi): campo OPZIONALE — la clausola entra
		// solo se il chiamante lo manda (il form storico Vice.vue non lo manda:
		// un undefined interpolato romperebbe la query e azzererebbe il
		// montaggio a ogni salvataggio anagrafica). Monta = intero, smonta =
		// vuoto/non numerico -> NULL. Colonna creata dal guarded ALTER al boot
		// (ensureSchema in server.js).
		let palletClause = '';
		if (req.query.PALLET_ID != undefined) {
			const pid = parseInt(req.query.PALLET_ID);
			palletClause = `, PALLET_ID=${isNaN(pid) ? 'NULL' : pid}`;
		}

		let query = `UPDATE VICE
					 SET FAMILY='${req.query.FAMILY}',
					 DESCR='${req.query.DESCR}',
					 STATUS=${req.query.STATUS},
					 X=${req.query.X},
					 Y=${req.query.Y},
					 Z=${req.query.Z},
					 Z_CLAW=${req.query.Z_CLAW},
					 Z_SINK_CLAW=${req.query.Z_SINK_CLAW},
					 MAG=${req.query.MAG},
					 MAG_POS=${req.query.MAG_POS},
					 POS_PLANT=${req.query.POS_PLANT},
					 CLAW_LENGTH=${clawLengthSql(req.query.CLAW_LENGTH)}${palletClause}
					WHERE ID=${req.query.ID};`
		
		var request = new sql.Request();
        					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
            }else
				res.send("OK")
		});
	});
})

//TODO:da testare
router.get('/insertVice', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertVice: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `INSERT INTO VICE
					(ID, FAMILY, DESCR, STATUS, X, Y, Z, Z_CLAW, Z_SINK_CLAW, MAG, MAG_POS, POS_PLANT, CLAW_LENGTH)
					VALUES(${req.query.ID}, 
					'${req.query.FAMILY}', 
					'${req.query.DESCR}', 
					${req.query.STATUS}, 
					${req.query.X}, 
					${req.query.Y}, 
					${req.query.Z}, 
					${req.query.Z_CLAW}, 
					${req.query.Z_SINK_CLAW}, 
					${req.query.MAG}, 
					${req.query.MAG_POS}, 
					${req.query.POS_PLANT},
					${clawLengthSql(req.query.CLAW_LENGTH)});`
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
            }else
				res.send("OK")
        });
	});
})

//TODO:da testare
router.delete('/:ID', (req, res) => {
    console.log('delete VICE '+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete Vice: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `DELETE FROM VICE WHERE ID=${req.params.ID};`
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                //res.send("KO")
            }
			//else
			//	res.send("OK")
        });
	});
});


// ===========================================================================
// (push-sim-save 15/9) SALVATAGGIO DI UNA SOLA MISURA
// La pagina di simulazione salva da qui. updateVice non andrebbe bene: scrive
// OGNI colonna dai parametri della query, quindi una chiamata parziale
// scriverebbe stringhe vuote sul resto della riga.
// Il ROWCOUNT viene controllato: una UPDATE che non tocca righe non deve
// rispondere OK, e' il difetto silenzioso che e' costato l'errore 799.
// La modifica viene tracciata in LOG (auditLog): la conferma a video copre
// l'intenzione, la riga di log rende la provenienza ricostruibile dopo.
// ===========================================================================
router.get('/setClawLength', (req, res) => {
	const id = parseInt(req.query.ID, 10);
	const len = parseInt(req.query.CLAW_LENGTH, 10);
	if (!Number.isInteger(id) || id < 1 || !Number.isInteger(len) || len <= 0) {
		res.status(400).send("KO_BAD_INPUT");
		return;
	}
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err setClawLength: " + err);
			res.status(500).send("KO");
			return;
		}
		let query = `SET NOCOUNT ON;
					DECLARE @old int = (SELECT CLAW_LENGTH FROM VICE WHERE ID=${id});
					UPDATE VICE SET CLAW_LENGTH=${len} WHERE ID=${id};
					SELECT @@ROWCOUNT AS n, @old AS old, RTRIM(FAMILY) AS fam FROM VICE WHERE ID=${id};`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err2, recordset) {
			if (err2) {
				log.error("Err query: " + err2);
				res.status(500).send("KO");
				return;
			}
			const row = recordset.recordset && recordset.recordset[0];
			if (!row || !row.n) { res.send(ERR.KO_NOT_FOUND); return; }
			audit.audit('Morsa ' + row.fam + ' (ID ' + id + '): lunghezza ganascia da '
				+ (row.old == null ? 'non misurata' : row.old + ' um') + ' a ' + len + ' um',
				audit.SRC_PUSH_SIM, 'VICE:' + id);
			res.send("OK");
		});
	});
})
// ===========================================================================
// (push-to-stop 15/9) APPOGGIO DICHIARATO per i pezzi che ECCEDONO la ganascia
// Un pezzo piu' lungo della ganascia non e' un errore: appoggia piu' avanti,
// su un altro riferimento fisico, e quella distanza nessuno la puo' dedurre
// dai dati. Vive in PIECE_ON_VICE, una riga per coppia morsa+pezzo.
//
// LA RIGA E' LA DICHIARAZIONE, NON IL VALORE: riga assente = nessuno ha
// dichiarato dove appoggia (l'ordine viene rifiutato con KO_PUSH_NO_FIT);
// riga con valore 0 = dichiarato che il pezzo, pur sporgendo, tocca ancora la
// fine della ganascia. Per questo la cancellazione della riga e' un'operazione
// vera e non un "metti a zero".
//
// CHIAVE SULLA MORSA e non sul pallet: se la morsa si sposta si porta dietro
// la sua battuta. Con la chiave sul pallet la dichiarazione resterebbe
// attaccata al posto e verrebbe applicata in silenzio alla morsa successiva.
// ===========================================================================

// Elenco delle dichiarazioni di una morsa, con i dati del pezzo che servono
// alla pagina per dire di quanto sporge. Non filtra per lunghezza: una riga
// che non serve piu' (ganascia allungata) deve restare VISIBILE, altrimenti
// sparirebbe senza che nessuno l'abbia cancellata.
router.get('/stops/:viceID', (req, res) => {
	const viceID = parseInt(req.params.viceID, 10);
	if (!Number.isInteger(viceID) || viceID < 1) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err stops: " + err);
			res.status(500).send("KO");
			return;
		}
		let query = `select pv.VICE_ID, pv.PIECE_ID, pv.STOP_BEYOND_CLAW, pv.COMP_PUSH,
							rtrim(p.FAMILY) as PIECE_FAMILY, rtrim(p.DESCR) as PIECE_DESCR,
							p.X as PIECE_X, p.Y as PIECE_Y, p.PUSH_TO_STOP
					 from PIECE_ON_VICE pv
					 inner join PIECE p on p.ID = pv.PIECE_ID
					 where pv.VICE_ID = ${viceID}
					 order by p.FAMILY;`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err, recordset) {
			if (err) {
				log.error("Err query: " + err);
				res.status(500).send("KO");
			} else
				res.send(recordset.recordset);
		});
	});
})

// UPSERT della dichiarazione. UPDATE e poi INSERT se non ha toccato righe:
// l'UPDATE da solo cercherebbe la riga che dovrebbe creare, ed e' esattamente
// il difetto silenzioso costato l'errore 799 sugli attrezzaggi.
router.get('/setStop', (req, res) => {
	const viceID  = parseInt(req.query.VICE_ID, 10);
	const pieceID = parseInt(req.query.PIECE_ID, 10);
	const stop    = parseInt(req.query.STOP_BEYOND_CLAW, 10);
	// lo ZERO e' valido e significativo; il vuoto NO: per togliere la
	// dichiarazione si cancella la riga, non si manda un campo vuoto.
	if (!Number.isInteger(viceID) || viceID < 1
		|| !Number.isInteger(pieceID) || pieceID < 1
		|| !Number.isInteger(stop) || stop < 0) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err setStop: " + err);
			res.status(500).send("KO");
			return;
		}
		let query = `SET NOCOUNT ON;
					UPDATE PIECE_ON_VICE SET STOP_BEYOND_CLAW=${stop}
					 WHERE VICE_ID=${viceID} AND PIECE_ID=${pieceID};
					IF @@ROWCOUNT = 0
						INSERT INTO PIECE_ON_VICE (VICE_ID, PIECE_ID, STOP_BEYOND_CLAW)
						VALUES (${viceID}, ${pieceID}, ${stop});`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err) {
			if (err) {
				log.error("Err query: " + err);
				res.status(500).send("KO");
			} else {
				audit.audit('Morsa ID ' + viceID + ', pezzo ID ' + pieceID
					+ ': appoggio dichiarato a ' + stop + ' um oltre la fine ganascia',
					audit.SRC_PUSH_SIM, 'PIECE_ON_VICE:' + viceID + ':' + pieceID);
				res.send("OK");
			}
		});
	});
})

// COMPENSAZIONE SPINTA (COMP_PUSH): accorcia la corsa, per i semilavorati che
// non devono arrivare in battuta. Stessa chiave di STOP_BEYOND_CLAW.
//
// SOLO UPDATE, NESSUN UPSERT — e' una scelta, non una dimenticanza. Creare la
// riga qui vorrebbe dire inventare uno STOP_BEYOND_CLAW, e lo ZERO non e'
// "nessun appoggio": e' l'appoggio dichiarato alla fine ESATTA della ganascia.
// Per un pezzo che sporge l'ordine passerebbe da NO_FIT ("manca un dato,
// compilalo") a NO_ROOM ("la geometria non ci sta"), mandando l'operatore in
// un vicolo cieco su un dato che non ha mai inserito.
// Riga assente -> KO_NOT_FOUND: prima si dichiara l'appoggio, poi si compensa.
//
// A differenza dell'appoggio dichiarato, qui lo ZERO e l'assenza vogliono dire
// la stessa cosa (nessuna compensazione): il campo vuoto e' ammesso e scrive
// NULL, senza bisogno di una rotta di cancellazione separata.
router.get('/setCompPush', (req, res) => {
	const viceID  = parseInt(req.query.VICE_ID, 10);
	const pieceID = parseInt(req.query.PIECE_ID, 10);
	const raw     = req.query.COMP_PUSH;
	const vuoto   = raw === undefined || String(raw).trim() === '';
	const comp    = vuoto ? null : parseInt(raw, 10);
	if (!Number.isInteger(viceID) || viceID < 1
		|| !Number.isInteger(pieceID) || pieceID < 1
		|| (!vuoto && (!Number.isInteger(comp) || comp < 0))) { res.status(400).send("KO_BAD_INPUT"); return; }
	const val = vuoto ? 'NULL' : String(comp);
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err setCompPush: " + err);
			res.status(500).send("KO");
			return;
		}
		// UPDATE a zero righe = riga assente, e va DETTO: una UPDATE che non
		// tocca niente e risponde OK e' il difetto silenzioso costato l'errore
		// 799 sugli attrezzaggi. @@ROWCOUNT esplicito, SET NOCOUNT ON perche'
		// su [PIECE_ON_VICE] i conteggi di eventuali trigger lo falserebbero.
		let query = `SET NOCOUNT ON;
					UPDATE PIECE_ON_VICE SET COMP_PUSH=${val}
					 WHERE VICE_ID=${viceID} AND PIECE_ID=${pieceID};
					SELECT @@ROWCOUNT AS n;`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err, result) {
			if (err) {
				log.error("Err query: " + err);
				res.status(500).send("KO");
				return;
			}
			const row = result.recordset && result.recordset[0];
			if (!row || !row.n) {
				log.standard('setCompPush ' + ERR.KO_NOT_FOUND + ': morsa ' + viceID
					+ ' pezzo ' + pieceID + ' senza riga PIECE_ON_VICE');
				res.send(ERR.KO_NOT_FOUND);
				return;
			}
			audit.audit('Morsa ID ' + viceID + ', pezzo ID ' + pieceID
				+ ': compensazione spinta ' + (vuoto ? 'rimossa' : comp + ' um'),
				audit.SRC_PUSH_SIM, 'PIECE_ON_VICE:' + viceID + ':' + pieceID);
			res.send("OK");
		});
	});
})

// Cancellazione della dichiarazione: il riferimento fisico non c'e' piu', e
// da quel momento gli ordini con quel pezzo su quella morsa tornano a essere
// rifiutati. E' il comportamento voluto, non un effetto collaterale.
router.get('/deleteStop', (req, res) => {
	const viceID  = parseInt(req.query.VICE_ID, 10);
	const pieceID = parseInt(req.query.PIECE_ID, 10);
	if (!Number.isInteger(viceID) || viceID < 1
		|| !Number.isInteger(pieceID) || pieceID < 1) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err deleteStop: " + err);
			res.status(500).send("KO");
			return;
		}
		let query = `DELETE FROM PIECE_ON_VICE WHERE VICE_ID=${viceID} AND PIECE_ID=${pieceID};`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err) {
			if (err) {
				log.error("Err query: " + err);
				res.status(500).send("KO");
			} else {
				audit.audit('Morsa ID ' + viceID + ', pezzo ID ' + pieceID
					+ ': appoggio dichiarato RIMOSSO (gli ordini con quel pezzo tornano a essere rifiutati)',
					audit.SRC_PUSH_SIM, 'PIECE_ON_VICE:' + viceID + ':' + pieceID);
				res.send("OK");
			}
		});
	});
})

module.exports = router;