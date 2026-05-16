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
					Z_PLACE='${req.query.Z_PLACE}'
					WHERE ID=${req.query.ID};`
		
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
router.get('/insertPiece', (req, res) => {


	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertStartJob: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `INSERT INTO PIECE
					(FAMILY, DESCR, PARTPROGRAM, MC1_ONLY, MC2_ONLY, MC3_ONLY, PRISMA, X, Y, Z, Z_PICK, Z_PLACE)
					VALUES('${req.query.FAMILY}', 
						   '${req.query.DESCR}', 
						   '${req.query.PARTPROGRAM}', 
						    CONVERT(bit,'${req.query.MC1_ONLY}'), CONVERT(bit,'${req.query.MC2_ONLY}'), CONVERT(bit,'${req.query.MC3_ONLY}'), 
						    CONVERT(bit,'${req.query.PRISMA}'), 
						    ${req.query.X}, ${req.query.Y}, ${req.query.Z}, 
							${req.query.Z_PICK}, ${req.query.Z_PLACE});`
					
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


module.exports = router;