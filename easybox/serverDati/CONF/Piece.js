//////// HMI ////////
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('../LogFunct');
const ERR 	= require('../errorCodes');
const audit = require('../auditLog');

var templatePATH = '.';

router.get('/show/:ID', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getTrayFromID: " + err);
            return;
        }

		let query = `select * from PIECE order by PRISMA;`
		//console.log("ricevo:" +String(req.params.ID))
		if (String(req.params.ID)!="all") 
			query = `select * from PIECE where ID='${req.params.ID}';`
		
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

//TODO: da TESTARE
router.get('/updatePiece', (req, res) => {

	//console.log(">>>"+JSON.stringify(req.query,null,4));
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updateTray: " + err);
            return;
        }

		let query = `UPDATE PIECE SET 
					FAMILY='${req.query.FAMILY}', 
					DESCR='${req.query.DESCR}', 
					PARTPROGRAM='${req.query.PARTPROGRAM}', 
					MC1_ONLY=CONVERT(bit,'${req.query.MC1_ONLY}'), 
					MC2_ONLY=CONVERT(bit,'${req.query.MC2_ONLY}'), 
					MC3_ONLY=CONVERT(bit,'${req.query.MC3_ONLY}'), 
					PRISMA=CONVERT(bit,'${req.query.PRISMA}'), 
					X='${req.query.X}', 
					Y='${req.query.Y}', 
					Z='${req.query.Z}', 
					Z_PICK='${req.query.Z_PICK}', 
					Z_PLACE='${req.query.Z_PLACE}',
					PUSH_TO_STOP=CONVERT(bit,'${req.query.PUSH_TO_STOP == undefined ? 0 : req.query.PUSH_TO_STOP}')
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
router.get('/insertPiece', (req, res) => {


	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertStartJob: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `INSERT INTO PIECE
					(FAMILY, DESCR, PARTPROGRAM, MC1_ONLY, MC2_ONLY, MC3_ONLY, PRISMA, X, Y, Z, Z_PICK, Z_PLACE, PUSH_TO_STOP)
					VALUES('${req.query.FAMILY}', 
						   '${req.query.DESCR}', 
						   '${req.query.PARTPROGRAM}', 
						    CONVERT(bit,'${req.query.MC1_ONLY}'), CONVERT(bit,'${req.query.MC2_ONLY}'), CONVERT(bit,'${req.query.MC3_ONLY}'), 
						    CONVERT(bit,'${req.query.PRISMA}'), 
						    ${req.query.X}, ${req.query.Y}, ${req.query.Z}, 
							${req.query.Z_PICK}, ${req.query.Z_PLACE},
							CONVERT(bit,'${req.query.PUSH_TO_STOP == undefined ? 0 : req.query.PUSH_TO_STOP}'));`
					
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
    console.log('delete Piece '+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete piece: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `DELETE FROM PIECE WHERE ID=${req.params.ID};`
					
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
// (push-sim-save 15/9) LE DUE DIMENSIONI FISICHE DEL PEZZO, non tutta la riga.
// ATTENZIONE, e la conferma a video lo dice esplicitamente: PIECE.Y non serve
// solo alla spinta in battuta, e' anche il passo delle tasche lungo la X del
// robot quando si genera un grigliato. Cambiarla qui cambia le griglie
// generate dopo. Per questo la conferma nomina la conseguenza invece di
// chiedere un si' generico.
// ===========================================================================
router.get('/setSize', (req, res) => {
	const id = parseInt(req.query.ID, 10);
	const x = parseInt(req.query.X, 10);
	const y = parseInt(req.query.Y, 10);
	if (!Number.isInteger(id) || id < 1
		|| !Number.isInteger(x) || x <= 0
		|| !Number.isInteger(y) || y <= 0) {
		res.status(400).send("KO_BAD_INPUT");
		return;
	}
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err setSize: " + err);
			res.status(500).send("KO");
			return;
		}
		let query = `SET NOCOUNT ON;
					DECLARE @ox int = (SELECT X FROM PIECE WHERE ID=${id});
					DECLARE @oy int = (SELECT Y FROM PIECE WHERE ID=${id});
					UPDATE PIECE SET X=${x}, Y=${y} WHERE ID=${id};
					SELECT @@ROWCOUNT AS n, @ox AS ox, @oy AS oy, RTRIM(FAMILY) AS fam FROM PIECE WHERE ID=${id};`;
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
			audit.audit('Pezzo ' + row.fam + ' (ID ' + id + '): dimensioni da '
				+ row.ox + 'x' + row.oy + ' a ' + x + 'x' + y + ' um'
				+ ' (la Y e anche il passo delle tasche nel grigliato)',
				audit.SRC_PUSH_SIM, 'PIECE:' + id);
			res.send("OK");
		});
	});
})

module.exports = router;
