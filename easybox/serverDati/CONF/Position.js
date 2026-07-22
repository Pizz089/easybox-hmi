//////// HMI ////////
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('../LogFunct');

var templatePATH = '.';

router.get('/show/:ID', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getGripperData: " + err);
            return;
        }
		
		//se pos_mag>1000 sono gli uncini
		let query=`select * from POSITION;`
		if (String(req.params.ID)!="all") 
			query=`select * from POSITION where id='${req.params.ID}';`
		
		//query=query+' where pos_mag<1000;'   //non vengono mostrati gli uncini per estrarre il cassetto
		
        // create Request object
        var request = new sql.Request();
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.send("error DB")
            }else
				res.send(recordset.recordset)
        });
    })
})

router.get('/updatePositionStatus/:tray_ID/:position/:status', (req, res) => {
	//console.log(">>>"+JSON.stringify(req,null,4));
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updatePositionStatus: " + err);
            return;
        }

		//console.log("---"+JSON.stringify(req.query,null,4));
		
        // create Request object
        var request = new sql.Request();

        let query = `UPDATE [POSITION] SET 
					STATUS=${req.params.status}
					WHERE PARENT='TRAY_${req.params.tray_ID}' and SUB_POS=${req.params.position};`
					
        log.info('query ' + query);
		//log.standard('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
			if (err) {
                log.error("Err query: " + err)
                res.send("KO")
            }else
				res.send("OK")
		});
    })
})

router.get('/insertPositionTray', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertPosition: " + err); 
            return;
        }
		
		var request = new sql.Request();
		// POSITION.Z dei cassetti = 0 per convenzione; l'origine Z è TRAY.Z_CORR
		// (teaching); la componente pezzo viene dall'anagrafica (Z e Z_PICK del PIECE)
		// (tray-teaching, punto D) INSERT...SELECT: ROT e APPROACH ereditati dal
		// TRAY associato (FLOOR_MAG = TRAY_ID del chiamante), COALESCE coi
		// default storici (rot 0, approach type 3 / 100000): comportamento
		// attuale al byte se il TRAY non e' mai stato insegnato. TOP 1 =
		// robustezza contro eventuali doppioni di FLOOR_MAG (mai piu' di una
		// riga inserita). NB: TRAY inesistente -> 0 righe (i chiamanti passano
		// sempre un FLOOR_MAG reale dalla trayList). PREREQUISITO: colonne del
		// DDL scripts/tray-teaching.sql (la SELECT le nomina).
        let query = `INSERT INTO [POSITION]
					(PARENT, POS, SUB_POS, STATUS, X, Y, Z, X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z, Part_Type)
					SELECT 'TRAY_${req.query.TRAY_ID}',
						${req.query.POS},
						${req.query.SUB_POS},
						${req.query.STATUS},
						${req.query.X}, ${req.query.Y}, 0,
						COALESCE(t.X_ROT,0), COALESCE(t.Y_ROT,0), COALESCE(t.Z_ROT,0),
						COALESCE(t.APPROACH_TYPE,3), COALESCE(t.APPROACH_X,100000), COALESCE(t.APPROACH_Y,100000), COALESCE(t.APPROACH_Z,100000),
						${req.query.PIECE_TYPE}
					FROM (SELECT TOP 1 X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z
						  FROM TRAY WHERE FLOOR_MAG=${req.query.TRAY_ID}) t;`;

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


//TODO: da testare
router.get('/updatePositionTray', (req, res) => {
	//log.info("updatePositionTray ---> "+JSON.stringify(req.query,null,4));
	
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertPosition: " + err); 
            return;
        }

		var request = new sql.Request();
		// POSITION.Z dei cassetti = 0 per convenzione; l'origine Z è TRAY.Z_CORR
		// (teaching); la componente pezzo viene dall'anagrafica (Z e Z_PICK del PIECE)
		// (tray-teaching, punto E) Z=0 FISSO. Il param EASYBOX resta accettato e
		// IGNORATO per la Z (prima sceglieva interasse nominale/0 per tipo
		// magazzino): con la convenzione la Z non dipende piu' dal tipo, e i 3
		// chiamanti (Grating/GratingTest/ImportGrating) restano intatti.
		// ROT e APPROACH non vengono toccati qui: il teaching sopravvive alla
		// ri-associazione del grigliato.
        let query = `UPDATE [POSITION] SET 
					STATUS=${req.query.STATUS},
					X=${req.query.X},
					Y=${req.query.Y},
					Part_Type=${req.query.PIECE_TYPE},
					Z=0
					WHERE 
						PARENT like 'TRAY_${req.query.TRAY_ID} %' AND 
						POS=${req.query.POS} AND 
						SUB_POS=${req.query.SUB_POS};`

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


//////////////////////////////////////////////////////////
///////////// MAGAZZINI (cantiere AD) ////////////////////
//////////////////////////////////////////////////////////

// Whitelist dei parent ammessi come "magazzino": WPALLET (pallet, 5x4)
// e SHELF (scaffale pinze). Mappa chiusa = niente injection dal path e
// niente usi fuori scope su altri parent di [POSITION].
const WAREHOUSE_PARENTS = { WPALLET: 'WPALLET', SHELF: 'SHELF' };

// AD (R1): lettura posizioni di un magazzino: ID, SUB_POS, STATUS.
// L'OCCUPANTE non viene joinato qui di proposito: lo deriva il client
// dalle liste pallet/gripper gia' in polling nelle view (stessa fonte
// di verita' della tabella a video, niente doppia semantica server).
router.get('/showWarehouse/:parent', (req, res) => {
	const parent = WAREHOUSE_PARENTS[String(req.params.parent || '').toUpperCase()];
	if (!parent) {
		res.json([]);
		return;
	}
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err showWarehouse: " + err);
            return;
        }

		let query = `select ID, SUB_POS, STATUS from [POSITION] where PARENT like '${parent}%' order by SUB_POS;`

		var request = new sql.Request();
        log.info('query ' + query);
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.json([])
            }else
				res.send(recordset.recordset)
        });
	});
})

// AD (R1): set/clear disabilitazione di una posizione magazzino.
// Scrive SOLO STATUS e SOLO le transizioni da/verso 9 (status_locked):
//   disable = qualunque valore -> 9;
//   enable  = 9 -> 2 (SOLO se attualmente 9: un 2/4 scritto in cella
//             non viene MAI riscritto — regola "9=disabilitata,
//             qualunque altro valore=abilitata").
// NON riusa /updateposition (che riscrive le coordinate).
router.get('/warehouseSlot/:action/:parent/:subpos', (req, res) => {
	const parent = WAREHOUSE_PARENTS[String(req.params.parent || '').toUpperCase()];
	const subpos = parseInt(req.params.subpos);
	const action = String(req.params.action);
	if (!parent || isNaN(subpos) || (action != 'disable' && action != 'enable')) {
		res.send("KO");
		return;
	}
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err warehouseSlot: " + err);
            return;
        }

		let query;
		if (action == 'disable')
			query = `UPDATE [POSITION] SET STATUS=9 WHERE PARENT like '${parent}%' AND SUB_POS=${subpos};`
		else
			query = `UPDATE [POSITION] SET STATUS=2 WHERE PARENT like '${parent}%' AND SUB_POS=${subpos} AND STATUS=9;`

		var request = new sql.Request();
        log.info('query ' + query);
        request.query(query, function (err, result) {
            if (err) {
                log.error("Err query: " + err)
                res.send("KO")
				return;
            }
			const n = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
			if (n > 0) {
				res.send("OK")
				return;
			}
			if (action == 'enable') {
				// riga esistente e gia' non-9 = gia' abilitata: OK idempotente
				let check = `select STATUS from [POSITION] where PARENT like '${parent}%' AND SUB_POS=${subpos};`
				new sql.Request().query(check, function (err2, rs2) {
					if (!err2 && rs2.recordset.length > 0 && rs2.recordset[0].STATUS != 9)
						res.send("OK")
					else
						res.send("KO")
				});
				return;
			}
			res.send("KO")   // disable su posizione inesistente
        });
	});
})

//utilizzata per la pagina conf/positionView
router.get('/updateposition', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updateposition: " + err); 
            return;
        }

		var request = new sql.Request();
        let query = `UPDATE [POSITION] SET 
					 X=${req.query.X}, 
					 Y=${req.query.Y}, 
					 Z=${req.query.Z}, 
					 X_ROT=${req.query.X_ROT}, 
					 Y_ROT=${req.query.Y_ROT}, 
					 Z_ROT=${req.query.Z_ROT}, 
					 X_CORR=${req.query.X_CORR}, 
					 Y_CORR=${req.query.Y_CORR}, 
					 Z_CORR=${req.query.Z_CORR}, 
					 X_ROT_CORR=${req.query.X_ROT_CORR}, 
					 Y_ROT_CORR=${req.query.Y_ROT_CORR}, 
					 Z_ROT_CORR=${req.query.Z_ROT_CORR},
					 APPROACH_X=${req.query.APPROACH_X},
					 APPROACH_Y=${req.query.APPROACH_Y},
					 APPROACH_Z=${req.query.APPROACH_Z}
					 WHERE ID=${req.query.ID};`

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
router.delete('/:ID', (req, res) => {
     console.log('delete Position '+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete position: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `DELETE FROM POSITION WHERE ID=${req.params.ID};`
					
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

router.delete('/deletePositionsTray/:ID', (req, res) => {
     console.log("delete TRAY's position "+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete position: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `DELETE FROM POSITION WHERE PARENT like 'TRAY_${req.params.ID} %';`
					
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


module.exports = router;