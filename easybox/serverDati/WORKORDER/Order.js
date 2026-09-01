//////// HMI ////////
// MODELLO PART PROGRAM (cantiere AG fase 2, ratificato dal cliente):
// il part program e' proprieta' del PARTICOLARE (PIECE.PARTPROGRAM, numero di
// sottoprogramma HAAS inserito a mano in anagrafica); l'ordine lo eredita alla
// creazione come snapshot.
//
// ARCHITETTURA DB (verificata su dev, 2026-07): WORKORDERS e' una VIEW
// (non aggiornabile: join multi-tabella); la tabella fisica e' WORKORDER
// (singolare) con colonna PartProg_ID. Regola CRUD: le SCRITTURE (insert/
// update/delete) vanno sulla base table WORKORDER; le LETTURE restano sulla
// view WORKORDERS, che espone PP_ID = w.PartProg_ID (post script guardato
// scripts/workorders-view-pp.sql: LEFT JOIN su PARTPROGRAM, numeri liberi
// ammessi). Il PLC legge PP_id dalla view e lo spedisce alla macchina come
// numero di sottoprogramma (macro #10200).
// La tabella PARTPROGRAM (ID/NAME/PATH/NOTE) resta il flusso Heidenhain: non toccarla.
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('../LogFunct');
const errorCodes = require('../errorCodes');

var templatePATH = '.';

// ============================================================================
// AZZERA PRODUZIONE (1/9) — ripristino operatore, prima solo via SQL a mano.
// In UNA transazione: gli ordini STATUS=3 della macchina passano a STATUS=7
// (annullato, resta la traccia: niente delete) e le righe [POSITION] che li
// puntavano tornano a Order_ID=0. NON tocca lo stato fisico (pinza, pezzo in
// macchina, pallet): quello si dichiara col 35 dalla pagina Robot.
// GUARDIA lato backend (il PLC legge questi dati in tempo reale): la cella
// deve essere FERMA — UNIT_STATUS del ROBOT non in missione (WORKING 3 /
// PAUSED 6, codici di HMI/src/data.js) e conosciuto. NB: la guardia "nessun
// ordine STATUS=3" qui sarebbe autocontraddittoria (il comando annulla
// proprio quelli).
// ============================================================================
const ROBOT_BUSY_STATUS = [3, 6];
const cellRunningGuard = () =>
	`(SELECT COUNT(*) FROM UNIT_STATUS WHERE UNIT='ROBOT' AND STATUS IS NOT NULL AND STATUS NOT IN (${ROBOT_BUSY_STATUS.join(',')})) = 0`;

// Anteprima con NUMERI VERI per il dialog di conferma: ordini (ID, pezzo)
// che verranno annullati e righe POSITION che verranno svincolate.
router.get('/resetProduction/preview/:machineId', (req, res) => {
	const machineId = Number(req.params.machineId);
	if (!Number.isInteger(machineId) || machineId < 1) { res.send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) { log.error("err resetProduction preview: " + err); res.send("KO"); return; }
		const query = `SET NOCOUNT ON;
			SELECT ID, PIECE_ID, PIECE FROM WORKORDERS WHERE STATUS=3 AND MACHINE_ID=${machineId} ORDER BY ID;
			SELECT COUNT(*) AS n FROM [POSITION] WHERE Order_ID IN (SELECT ID FROM WORKORDERS WHERE STATUS=3 AND MACHINE_ID=${machineId});
			SELECT STATUS FROM UNIT_STATUS WHERE UNIT='ROBOT';`;
		log.info('query ' + query);
		new sql.Request().query(query, function (err, result) {
			if (err) { log.error("Err query: " + err); res.send("KO"); return; }
			const rs = result.recordsets || [];
			const robot = rs[2] && rs[2][0] ? rs[2][0].STATUS : null;
			res.json({
				orders: rs[0] || [],
				positions: rs[1] && rs[1][0] ? rs[1][0].n : 0,
				robotStatus: robot,
				blocked: (robot === null || ROBOT_BUSY_STATUS.includes(Number(robot))) ? errorCodes.KO_CELL_RUNNING : null
			});
		});
	});
});

router.post('/resetProduction/:machineId', (req, res) => {
	const machineId = Number(req.params.machineId);
	if (!Number.isInteger(machineId) || machineId < 1) { res.send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) { log.error("err resetProduction: " + err); res.send("KO"); return; }
		// conteggi PRIMA delle scritture (il trigger su [POSITION] sporca
		// rowsAffected/@@ROWCOUNT), guardia e scritture nello STESSO batch:
		// SET XACT_ABORT ON + BEGIN TRAN = o tutto o niente.
		const query = `SET NOCOUNT ON;
			IF ${cellRunningGuard()}
				SELECT '${errorCodes.KO_CELL_RUNNING}' AS ris, 0 AS orders, 0 AS positions;
			ELSE BEGIN
				SET XACT_ABORT ON;
				BEGIN TRAN;
				DECLARE @o INT = (SELECT COUNT(*) FROM WORKORDER WHERE STATUS=3 AND MACHINE_ID=${machineId});
				DECLARE @p INT = (SELECT COUNT(*) FROM [POSITION] WHERE Order_ID IN (SELECT ID FROM WORKORDER WHERE STATUS=3 AND MACHINE_ID=${machineId}));
				UPDATE [POSITION] SET Order_ID=0 WHERE Order_ID IN (SELECT ID FROM WORKORDER WHERE STATUS=3 AND MACHINE_ID=${machineId});
				UPDATE WORKORDER SET STATUS=7 WHERE STATUS=3 AND MACHINE_ID=${machineId};
				COMMIT TRAN;
				SELECT 'OK' AS ris, @o AS orders, @p AS positions;
			END`;
		log.info('query ' + query);
		new sql.Request().query(query, function (err, result) {
			if (err) { log.error("Err query: " + err); res.send("KO"); return; }
			const row = result.recordset && result.recordset[0] ? result.recordset[0] : { ris: "KO" };
			res.json(row);
			if (row.ris === 'OK') {
				log.standard("AZZERA PRODUZIONE MC" + machineId + ": " + row.orders + " ordini -> 7, " + row.positions + " posizioni svincolate");
				DBf.io.emit('PRODUCTION/CHANGED');
			}
		});
	});
});

//TODO:NON SERVE PIU
router.get('/data/:ID', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getOrderFromID: " + err); 
            return;
        }

		let query = `select * from WORKORDERS_COUNTER;`
		//console.log("ricevo:" +String(req.params.ID))
		if (String(req.params.ID)!="all") 
			query = `select * from WORKORDERS_COUNTER where order_id='${req.params.ID}';`
		
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

router.get('/show/:ID', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getTrayFromID: " + err);
            return;
        }

		let query = `select * from WORKORDERS ;`  //order by status
		//console.log("ricevo:" +String(req.params.ID))
		if (String(req.params.ID)!="all") 
			query = `select * from WORKORDERS where ID='${req.params.ID}';`
		
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

//TODO:da testare
router.get('/updateOrder', (req, res) => {

	console.log(">>>"+JSON.stringify(req.query,null,4));
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updateOrder: " + err);
            return;
        }

		// DECLARED_PIECE_ID: come in insertOrder (NULL se assente o ramo morsa)
		const declared = parseInt(req.query.declaredPieceID, 10);
		const declaredSql = (Number.isInteger(declared) && declared > 0) ? declared : 'NULL';

		// SCRITTURA sulla base table WORKORDER (la view WORKORDERS non e'
		// aggiornabile). Riparati gli apici rotti storici (B1).
		// (1/9) gli 8 decentramenti X/Y sono 0 FISSI: la regolazione della
		// presa e' SOLO in Z, via PIECE.Z_PICK / Z_PLACE (vedi insertOrder).
		let query = `UPDATE WORKORDER SET
					PIECE_ID='${req.query.pieceID}',
					GRIPPER_ID='${req.query.gripperID}',
					VICE_ID='${req.query.viceID}',
					FIXTURE_ID='${req.query.fixtureID}',
					PALLET_ID='${req.query.palletID}',
					STATUS='${req.query.status}',
					MACHINE_ID='${req.query.machineID}',
					QUANTITY='${req.query.quantity}',
					X_PICK_DECENTRATED_TRAY=0,
					X_PLACE_DECENTRATED_TRAY=0,
					Y_PICK_DECENTRATED_TRAY=0,
					Y_PLACE_DECENTRATED_TRAY=0,
					X_PICK_DECENTRATED_MC=0,
					X_PLACE_DECENTRATED_MC=0,
					Y_PICK_DECENTRATED_MC=0,
					Y_PLACE_DECENTRATED_MC=0,
					PartProg_ID=${req.query.PP},
					DECLARED_PIECE_ID=${declaredSql}
					WHERE ID='${req.query.ID}';`
		
		var request = new sql.Request();
        					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.send("KO")
            }else
				res.send("OK")
		});
	});
})

//TODO:da testare
router.get('/insertOrder', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertOrder: " + err);
            return;
        }
		
		var request = new sql.Request();
        // SCRITTURA sulla base table WORKORDER (la view WORKORDERS non e' aggiornabile).
        // DECLARED_PIECE_ID: pezzo dichiarato del ramo attrezzatura (solo uso
        // HMI, NULL nel ramo morsa) — colonna aggiunta da
        // scripts/workorder-declared-piece.sql.
        // (1/9) DECENTRAMENTI X/Y = 0 FISSI, NON piu' letti dal payload: la
        // regolazione della presa avviene ESCLUSIVAMENTE in Z, tramite
        // PIECE.Z_PICK / PIECE.Z_PLACE dell'anagrafica pezzo. Le 8 colonne
        // restano nello schema (la vista 4Robot le somma a X/Y di [POSITION]:
        // a 0 sono neutre) ma nessun valore diverso da zero puo' entrare.
        const declared = parseInt(req.query.declaredPieceID, 10);
        const declaredSql = (Number.isInteger(declared) && declared > 0) ? declared : 'NULL';
        let query = `INSERT INTO WORKORDER
					(PIECE_ID, GRIPPER_ID, VICE_ID, FIXTURE_ID, PALLET_ID, STATUS, MACHINE_ID, QUANTITY, X_PICK_DECENTRATED_TRAY, X_PLACE_DECENTRATED_TRAY, Y_PICK_DECENTRATED_TRAY, Y_PLACE_DECENTRATED_TRAY, X_PICK_DECENTRATED_MC, X_PLACE_DECENTRATED_MC, Y_PICK_DECENTRATED_MC, Y_PLACE_DECENTRATED_MC, PartProg_ID, DECLARED_PIECE_ID)
					VALUES(
					'${req.query.pieceID}',
					'${req.query.gripperID}',
					'${req.query.viceID}',
					'${req.query.fixtureID}',
					'${req.query.palletID}',
					 4,
					'${req.query.machineID}',
					'${req.query.quantity}',
					 0, 0, 0, 0,
					 0, 0, 0, 0,
					 ${req.query.PP},
					 ${declaredSql}
					);`
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.send("KO")
            }else{
				res.send("OK")
				DBf.io.emit('PRODUCTION/CHANGED')
			}
        });
	});
})

router.delete('/:ID', (req, res) => {
    console.log('delete Order '+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertOrder: " + err);
            return;
        }
		
		var request = new sql.Request();
        // SCRITTURA sulla base table WORKORDER (la view WORKORDERS non e' aggiornabile)
        let query = `DELETE FROM WORKORDER WHERE ID=${req.params.ID};`
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.send("KO")
            }else{
				res.send("OK")
				DBf.io.emit('PRODUCTION/CHANGED')
			}
        });
	});
});


module.exports = router;