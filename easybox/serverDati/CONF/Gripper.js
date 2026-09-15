//////// HMI ////////
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('../LogFunct');
const ERR 	= require('../errorCodes');
const audit = require('../auditLog');

var templatePATH = '.';

// (push-to-stop 15/9) CORSA e SPESSORE della ganascia: il form li manda da
// sempre ma insert e update non li nominavano, quindi si perdevano in
// silenzio e a DB restavano i default. Lo SPESSORE ora serve davvero: e' il
// termine 'spessore_ganascia_pinza/2' della quota di spinta in battuta.
// Assente o non intero -> fallback: nell'UPDATE il NOME della colonna (il
// valore a DB resta com'era, un client vecchio non azzera il dato), nella
// INSERT..SELECT il default dello schema (10000) perche' li' non c'e' riga
// sorgente da cui rileggere la colonna.
function clawNum(raw, col) {
	const n = parseInt(raw, 10);
	if (raw == undefined || String(raw).trim() === '' || isNaN(n) || n < 0) return col;
	return String(n);
}

router.get('/show/:ID', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getGripperData: " + err);
            return;
        }
		
		//se pos_mag>1000 sono gli uncini
		let query=`select * from GRIPPERS where sub_pos<1000 `
		if (String(req.params.ID)!="all") 
			query=`select * from GRIPPERS where id='${req.params.ID}' and sub_pos<1000`
		if (String(req.params.ID)=="out") 
			query=`select * from GRIPPERS where pos_Plant<0`
		
		query += " order by FAMILY,pos_mag,sub_pos;" ;
		
		//query=query+' where pos_mag<1000;'   //non vengono mostrati gli uncini per estrarre il cassetto
		
        // create Request object
        var request = new sql.Request();
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("error DB")
            }else
				res.send(recordset.recordset)
        });
    })
})

router.get('/showWarehousePos/', (req, res) => {
    //ATTENTION: return only for ONE warehouse!!!!!
    let ris = {}
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err showWarehousePos: " + err);
            return;
        }
		
		let query=`select max(sub_pos) as MaxPos from position where parent like 'Shelf%' `
		
        // create Request object
        var request = new sql.Request();
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("error DB")
            }else{
                ris.maxPos = recordset.recordset[0].MaxPos;
        
                query=`select sub_pos from position where parent like 'Shelf%' and sub_pos not in(
                            select  distinct POS_MAG
                            from gripper 
                            where pos_mag<1000 and POS_PLANT >=0
                            )`

                // create Request object
                request = new sql.Request();
                            
                log.info('query ' + query);
                // query to the database and get the records
                request.query(query, function (err, recordset) {
                    if (err) {
                        log.error("Err query: " + err)
                        res.status(500).send("error DB")
                    }else{
                        let _freePos = []
                        recordset.recordset.forEach(element => {
                            _freePos.push(element.sub_pos);
                        });
                        
                        ris.freePos = _freePos
                        res.send(ris)
                    }
                });
            }
        });
    })
})


router.get('/showType/:ID', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err showType: " + err);
            return;
        }
		
		let query=`select * from _GRIPPER_TYPE;`
		if (String(req.params.ID)!="all") 
			query=`select * from _GRIPPER_TYPE where id='${req.params.ID}';`
		
        // create Request object
        var request = new sql.Request();
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("error DB")
            }else
				res.send(recordset.recordset)
        });
    })
})

// AD (R3): guard anti-sovrapposizione per lo scaffale pinze (SHELF), da
// appendere alla STESSA query di update/insert (controllo atomico):
// niente scrittura se lo slot POS_MAG (0<posMag<1000 = a magazzino, la
// stessa semantica di showWarehousePos) e' occupato da un'ALTRA pinza o
// disabilitato ([POSITION] SHELF STATUS=9). Il PLC non passa da qui.
// (gripper-twins, 1/9) le righe GEMELLE di una pinza doppia (stesso
// SUB_POS > 0 della pinza in scrittura) sono la STESSA pinza fisica e
// convivono nello slot: escluse dal conteggio. Due pinze DIVERSE (SUB_POS
// diverso, o 0) nello stesso slot restano vietate. Vale solo per l'update
// (l'ID della pinza in scrittura e' noto); l'insert da form nasce con
// SUB_POS 0 e resta strettamente esclusivo.
function shelfOccupiedFilter(posMag, excludeID) {
	const idFilter = excludeID !== '' ? ` and g2.ID<>${excludeID}` : '';
	const twinFilter = excludeID !== ''
		? ` and not (g2.SUB_POS>0 and g2.SUB_POS=(select SUB_POS from GRIPPER where ID=${excludeID}))`
		: '';
	return `g2.POS_MAG=${posMag} and g2.POS_MAG<1000 and g2.POS_PLANT>=0${idFilter}${twinFilter}`;
}

function shelfSlotGuard(posMag, excludeID) {
	return ` NOT EXISTS (select 1 from GRIPPER g2 where ${shelfOccupiedFilter(posMag, excludeID)})
			 AND NOT EXISTS (select 1 from [POSITION] where PARENT like 'SHELF%' and SUB_POS=${posMag} and STATUS=9)`;
}

// Diagnosi post-hoc del rifiuto (solo messaggio: l'atomicita' e' del guard).
function shelfSlotReason(posMag, excludeID, cb) {
	let check = `select
		(select count(*) from GRIPPER g2 where ${shelfOccupiedFilter(posMag, excludeID)}) as occ,
		(select count(*) from [POSITION] where PARENT like 'SHELF%' and SUB_POS=${posMag} and STATUS=9) as dis;`
	new sql.Request().query(check, function (err, rs) {
		if (err || rs.recordset.length == 0) { cb("KO"); return; }
		if (rs.recordset[0].occ > 0) { cb(ERR.KO_OCCUPIED); return; }
		if (rs.recordset[0].dis > 0) { cb(ERR.KO_DISABLED); return; }
		cb("KO");
	});
}

router.get('/updateGripper', (req, res) => {

	//console.log(">>>"+JSON.stringify(data,null,4));
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertStartJob: " + err);
            return;
        }

		//console.log("---"+JSON.stringify(gripperData,null,4));

		// AD (R3): guard solo quando si scrive uno slot di scaffale
		const posMag = parseInt(req.query.POS_MAG);
		const gripperID = parseInt(req.query.ID);
		const guarded = !isNaN(posMag) && posMag > 0 && posMag < 1000 && !isNaN(gripperID);

        // create Request object
        var request = new sql.Request();

        let query = `UPDATE GRIPPER
					SET FAMILY='${req.query.FAMILY}',
					DESCR='${req.query.DESCR}',
					X_BODY='${req.query.X_BODY}',
					Y_BODY='${req.query.Y_BODY}',
					Z_BODY='${req.query.Z_BODY}',
					X_CLAW='${req.query.X_CLAW}',
					Y_CLAW='${req.query.Y_CLAW}',
					Z_CLAW='${req.query.Z_CLAW}',
					STATUS='${req.query.STATUS}',
					POS_MAG='${req.query.POS_MAG}',
					POS_PLANT='${req.query.POS_PLANT}',
					Stroke_CLAW=${clawNum(req.query.STROKE_CLAW, 'Stroke_CLAW')},
					Tickness_CLAW=${clawNum(req.query.TICKNESS_CLAW, 'Tickness_CLAW')},
					CLAW_LENGTH=${clawNum(req.query.CLAW_LENGTH, 'CLAW_LENGTH')}
					where ID='${req.query.ID}'`
		// (gripper-twins, 1/9) SUB_POS NON viene piu' azzerato dall'update: e'
		// la chiave delle righe gemelle della pinza doppia (26/37 -> 3) usata
		// dal PLC ("SUB_POS in (select SUB_POS from GRIPPER where ID=<g>)");
		// il vecchio SUB_POS=0 di ogni modifica da form l'avrebbe rotta.
		if (guarded)
			query += ` AND ${shelfSlotGuard(posMag, gripperID)}`;
		query += ';'

        log.info('query ' + query);
		//log.standard('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, result) {

            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
				return;
            }
			const n = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
			if (n > 0 || !guarded) {
				res.send(n > 0 ? "OK" : "KO")
				return;
			}
			shelfSlotReason(posMag, gripperID, code => res.send(code));
		});
    })
})

router.get('/insertGripper', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertStartJob: " + err);
            return;
        }
		
		//console.log("---"+JSON.stringify(req.query,null,4));
		
		// AD (R3): stesso guard dell'update, in forma INSERT..SELECT..WHERE
		const posMag = parseInt(req.query.POS_MAG);
		const guarded = !isNaN(posMag) && posMag > 0 && posMag < 1000;

		var request = new sql.Request();
        let query = `INSERT INTO GRIPPER
					(FAMILY, DESCR, X_BODY, Y_BODY, Z_BODY, X_CLAW, Y_CLAW, Z_CLAW, STATUS, POS_MAG, SUB_POS, POS_PLANT, Stroke_CLAW, Tickness_CLAW, CLAW_LENGTH)
					SELECT
					'${req.query.FAMILY}',
					'${req.query.DESCR}',
					'${req.query.X_BODY}',
					'${req.query.Y_BODY}',
					'${req.query.Z_BODY}',
					'${req.query.X_CLAW}',
					'${req.query.Y_CLAW}',
					'${req.query.Z_CLAW}',
					'${req.query.STATUS}',
					'${req.query.POS_MAG}',
					0,
					'${req.query.POS_PLANT}',
					${clawNum(req.query.STROKE_CLAW, '10000')},
					${clawNum(req.query.TICKNESS_CLAW, '10000')},
					${clawNum(req.query.CLAW_LENGTH, 'NULL')}`
		if (guarded)
			query += ` WHERE ${shelfSlotGuard(posMag, '')}`;
		query += ';'

        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, result) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
				return;
            }
			const n = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
			if (n > 0 || !guarded) {
				res.send(n > 0 ? "OK" : "KO")
				return;
			}
			shelfSlotReason(posMag, '', code => res.send(code));
        });
	});
})


//TODO:da testare
router.delete('/:ID', (req, res) => {
   console.log('delete GRIPPER '+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete gripper: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `DELETE FROM GRIPPER WHERE ID=${req.params.ID};`
					
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


//TODO: da testare
router.get('/onRobot', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getGripperOnData: " + err);
            return;
        }
		
		let query=`select * from GRIPPERS where POS_PLANT=1000 order by sub_pos;`
		
        // create Request object
        var request = new sql.Request();
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("error DB")
            }else
				res.send(recordset.recordset)
        });
    })
})

// ===========================================================================
// (push-sim-save 15/9) SALVATAGGIO DI UNA SOLA MISURA, stesso motivo di VICE:
// updateGripper scrive ogni colonna dai parametri, e una chiamata parziale
// finirebbe per scrivere "undefined" su FAMILY e DESCR.
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
					DECLARE @old int = (SELECT CLAW_LENGTH FROM GRIPPER WHERE ID=${id});
					UPDATE GRIPPER SET CLAW_LENGTH=${len} WHERE ID=${id};
					SELECT @@ROWCOUNT AS n, @old AS old, RTRIM(FAMILY) AS fam FROM GRIPPER WHERE ID=${id};`;
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
			audit.audit('Pinza ' + row.fam + ' (ID ' + id + '): lunghezza chela da '
				+ (row.old == null ? 'non misurata' : row.old + ' um') + ' a ' + len + ' um',
				audit.SRC_PUSH_SIM, 'GRIPPER:' + id);
			res.send("OK");
		});
	});
})

module.exports = router;
