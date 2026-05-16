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

		let query = `select * from PALLET order by MAG, MAG_POS desc;`
		//console.log("ricevo:" +String(req.params.ID))
		if (String(req.params.ID)!="all") 
			query = `select * from PALLET where ID='${req.params.ID}';`
		
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
router.get('/updatePallet', (req, res) => {

	//console.log(">>>"+JSON.stringify(req.query,null,4));
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updatePallet: " + err);
            return;
        }

		let query = `UPDATE PALLET SET 
					FAMILY='${req.query.FAMILY}', 
					DESCR='${req.query.DESCR}', 
					X='${req.query.X}', 
					Y='${req.query.Y}', 
					Z='${req.query.Z}', 
					X_CORR='${req.query.X_CORR}', 
					Y_CORR='${req.query.Y_CORR}', 
					Z_CORR='${req.query.Z_CORR}', 
					MAG='${req.query.MAG}', 
					MAG_POS='${req.query.MAG_POS}', 
					POS_PLANT='${req.query.POS_PLANT}'
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

router.get('/insertPallet', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertPallet: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `INSERT INTO PALLET (FAMILY, DESCR, X, Y, Z, X_CORR, Y_CORR, Z_CORR, MAG, MAG_POS, POS_PLANT)
					 VALUES('${req.query.FAMILY}', 
							'${req.query.DESCR}', 
							${req.query.X}, 
							${req.query.Y}, 
							${req.query.Z}, 
							${req.query.X_CORR}, 
							${req.query.Y_CORR}, 
							${req.query.Z_CORR}, 
							${req.query.MAG}, 
							${req.query.MAG_POS}, 
							${req.query.POS_PLANT});`
					
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

router.delete('/:ID', (req, res) => {
    console.log('delete Pallet '+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete pallet: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `DELETE FROM PALLET WHERE ID=${req.params.ID};`
					
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