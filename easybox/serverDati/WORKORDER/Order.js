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
const pushQuotes = require('../pushQuotes');

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
	if (!Number.isInteger(machineId) || machineId < 1) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) { log.error("err resetProduction preview: " + err); res.status(500).send("KO"); return; }
		const query = `SET NOCOUNT ON;
			SELECT ID, PIECE_ID, PIECE FROM WORKORDERS WHERE STATUS=3 AND MACHINE_ID=${machineId} ORDER BY ID;
			SELECT COUNT(*) AS n FROM [POSITION] WHERE Order_ID IN (SELECT ID FROM WORKORDERS WHERE STATUS=3 AND MACHINE_ID=${machineId});
			SELECT STATUS FROM UNIT_STATUS WHERE UNIT='ROBOT';`;
		log.info('query ' + query);
		new sql.Request().query(query, function (err, result) {
			if (err) { log.error("Err query: " + err); res.status(500).send("KO"); return; }
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
	if (!Number.isInteger(machineId) || machineId < 1) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) { log.error("err resetProduction: " + err); res.status(500).send("KO"); return; }
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
			if (err) { log.error("Err query: " + err); res.status(500).send("KO"); return; }
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

		// (rig-two-aspects 15/9) stessa GUARDIA GEOMETRIA di insertOrder: una
		// modifica non puo' portare l'ordine in uno stato che il PLC non sa
		// eseguire (join interno su FIXTURE -> errore 799).
		const fixtureID = parseInt(req.query.fixtureID, 10);
		if (!Number.isInteger(fixtureID) || fixtureID < 1) {
			log.standard("updateOrder " + errorCodes.KO_NO_FIXTURE + ": fixtureID [" + req.query.fixtureID + "]");
			res.send(errorCodes.KO_NO_FIXTURE);
			return;
		}

		// SCRITTURA sulla base table WORKORDER (la view WORKORDERS non e'
		// aggiornabile). Riparati gli apici rotti storici (B1).
		// (1/9) gli 8 decentramenti X/Y sono 0 FISSI: la regolazione della
		// presa e' SOLO in Z, via PIECE.Z_PICK / Z_PLACE (vedi insertOrder).
		let query = `SET NOCOUNT ON;
					IF NOT EXISTS (SELECT 1 FROM FIXTURE WHERE ID=${fixtureID}) SELECT '${errorCodes.KO_NO_FIXTURE}' AS ris;
					ELSE BEGIN
					UPDATE WORKORDER SET
					PIECE_ID='${req.query.pieceID}',
					GRIPPER_ID='${req.query.gripperID}',
					VICE_ID='${req.query.viceID}',
					FIXTURE_ID=${fixtureID},
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
					WHERE ID='${req.query.ID}';
					SELECT 'OK' AS ris;
					END`

		var request = new sql.Request();

        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, result) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
            }else
				res.send(result.recordset && result.recordset[0] ? result.recordset[0].ris : "KO")
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
        // (rig-two-aspects 15/9) GUARDIA GEOMETRIA: il PLC calcola la quota di
        // deposito in macchina come P.Z + PIECE.Z_PLACE + FIXTURE.Z con un join
        // INTERNO su FIXTURE. Un ordine con FIXTURE_ID che non aggancia nessuna
        // riga (0 compreso) non produce righe: errore 799 col robot gia' in
        // movimento. Qui l'ordine non nasce proprio. Vale per ENTRAMBI i rami:
        // dal 15/9 anche il ramo morsa porta il FIXTURE_ID della geometria.
        const fixtureID = parseInt(req.query.fixtureID, 10);
        const pieceID   = parseInt(req.query.pieceID, 10)   || 0;
        const palletID  = parseInt(req.query.palletID, 10)  || 0;
        const gripperID = parseInt(req.query.gripperID, 10) || 0;
        if (!Number.isInteger(fixtureID) || fixtureID < 1) {
            log.standard("insertOrder " + errorCodes.KO_NO_FIXTURE + ": fixtureID [" + req.query.fixtureID + "]");
            res.send(errorCodes.KO_NO_FIXTURE);
            return;
        }
        // (push-to-stop 15/9) SPINTA IN BATTUTA: il bit e' proprieta' del PEZZO
        // (PIECE.PUSH_TO_STOP) e l'ordine lo eredita come ISTANTANEA nel bit 1 di
        // OPTION2 — stesso meccanismo del part program. Lo calcola il SQL
        // dall'anagrafica, non il client: nessun campo nuovo nel payload e
        // nessuna istantanea falsificabile. Il bit 0 resta al gripper doppio.
        // Guardia: se la spinta e' attiva ma manca la ganascia della morsa o la
        // lunghezza della chela della pinza, l'ordine NON nasce (il PLC lo
        // scoprirebbe col robot in movimento). La dimensione che entra nel
        // conto e' PIECE.Y, quella che corre lungo la X del robot: e' sulla X
        // che si spinge in battuta.
        //
        // PEZZO OLTRE LA GANASCIA (15/9): non e' un errore. In quel caso il
        // pezzo appoggia su un altro riferimento fisico, e la distanza va
        // DICHIARATA in PIECE_ON_VICE (riga per coppia morsa+pezzo; la riga E'
        // la dichiarazione, il valore zero e' legittimo). Restano due rifiuti:
        //   - eccede la ganascia e NESSUNO ha dichiarato dove appoggia -> NO_FIT
        //   - l'appoggio dichiarato e' piu' vicino di quanto il pezzo gia'
        //     sporge, quindi la corsa verrebbe NEGATIVA           -> NO_ROOM
        // La dichiarazione segue la MORSA, non il pallet: se la morsa si sposta
        // si porta dietro la sua battuta.
        // I termini sono gli stessi della vista COORDINATES_PUSH_MC.
        let query = `SET NOCOUNT ON;
					DECLARE @push int = ISNULL((SELECT CASE WHEN PUSH_TO_STOP = 1 THEN ${pushQuotes.PUSH_BIT} ELSE 0 END FROM PIECE WHERE ID=${pieceID}), 0);
					DECLARE @claw int = (SELECT TOP 1 CLAW_LENGTH FROM VICE WHERE PALLET_ID=${palletID});
					DECLARE @tool int = (SELECT TOP 1 CLAW_LENGTH FROM GRIPPER WHERE ID=${gripperID});
					DECLARE @pieceY int = (SELECT TOP 1 Y FROM PIECE WHERE ID=${pieceID});
					DECLARE @viceID int = (SELECT TOP 1 ID FROM VICE WHERE PALLET_ID=${palletID});
					DECLARE @stop int = (SELECT TOP 1 STOP_BEYOND_CLAW FROM PIECE_ON_VICE WHERE VICE_ID=@viceID AND PIECE_ID=${pieceID});
					DECLARE @travel int = (@claw - @pieceY)/2 + CASE WHEN @pieceY > @claw THEN ISNULL(@stop,0) ELSE 0 END;
					IF NOT EXISTS (SELECT 1 FROM FIXTURE WHERE ID=${fixtureID}) SELECT '${errorCodes.KO_NO_FIXTURE}' AS ris;
					ELSE IF @push <> 0 AND (ISNULL(@claw,0) <= 0 OR ISNULL(@tool,0) <= 0 OR ISNULL(@pieceY,0) <= 0) SELECT '${errorCodes.KO_PUSH_NO_DATA}' AS ris;
					ELSE IF @push <> 0 AND @pieceY > @claw AND @stop IS NULL SELECT '${errorCodes.KO_PUSH_NO_FIT}' AS ris;
					ELSE IF @push <> 0 AND @travel < 0 SELECT '${errorCodes.KO_PUSH_NO_ROOM}' AS ris;
					ELSE BEGIN
					INSERT INTO WORKORDER
					(PIECE_ID, GRIPPER_ID, VICE_ID, FIXTURE_ID, PALLET_ID, STATUS, MACHINE_ID, QUANTITY, X_PICK_DECENTRATED_TRAY, X_PLACE_DECENTRATED_TRAY, Y_PICK_DECENTRATED_TRAY, Y_PLACE_DECENTRATED_TRAY, X_PICK_DECENTRATED_MC, X_PLACE_DECENTRATED_MC, Y_PICK_DECENTRATED_MC, Y_PLACE_DECENTRATED_MC, PartProg_ID, DECLARED_PIECE_ID, OPTION1, OPTION2)
					VALUES(
					'${req.query.pieceID}',
					'${req.query.gripperID}',
					'${req.query.viceID}',
					${fixtureID},
					'${req.query.palletID}',
					 4,
					'${req.query.machineID}',
					'${req.query.quantity}',
					 0, 0, 0, 0,
					 0, 0, 0, 0,
					 ${req.query.PP},
					 ${declaredSql},
					 0, @push
					);
					SELECT 'OK' AS ris;
					END`

        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, result) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
                return;
            }
			const ris = result.recordset && result.recordset[0] ? result.recordset[0].ris : "KO";
			res.send(ris);
			if (ris === 'OK')
				DBf.io.emit('PRODUCTION/CHANGED')
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
                res.status(500).send("KO")
            }else{
				res.send("OK")
				DBf.io.emit('PRODUCTION/CHANGED')
			}
        });
	});
});


// ===========================================================================
// (push-to-stop 15/9) LETTURA della vista COORDINATES_PUSH_MC
// La pagina di simulazione, quando si apre su un ordine VERO, deve mostrare
// quello che leggera' il PLC e non una replica calcolata a parte. Il modulo
// util/pushQuotes e' verificato alla pari con la vista da un test, ma restano
// due cose diverse: qui si legge la vista.
// Sola lettura, nessuna scrittura, nessun effetto sull'ordine.
// ===========================================================================
router.get('/pushQuotes/:orderID', (req, res) => {
	const orderID = parseInt(req.params.orderID, 10);
	if (!Number.isInteger(orderID) || orderID < 1) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err pushQuotes: " + err);
			res.status(500).send("KO");
			return;
		}
		let query = `select ORDER_ID, MC, X_PLACE, Y_PLACE, Z_PLACE,
							X_PUSH, X_STOP, CLEARANCE, STOP_REF, STOP_BEYOND_CLAW,
							PUSH_ENABLED, PUSH_STATUS
					 from COORDINATES_PUSH_MC where ORDER_ID = ${orderID};`;
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

module.exports = router;