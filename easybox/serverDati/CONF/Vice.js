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
					 POS_PLANT=${req.query.POS_PLANT}
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
router.get('/insertVice', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertVice: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `INSERT INTO VICE
					(ID, FAMILY, DESCR, STATUS, X, Y, Z, Z_CLAW, Z_SINK_CLAW, MAG, MAG_POS, POS_PLANT)
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


module.exports = router;