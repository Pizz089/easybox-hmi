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
		let quotaZ = (parseInt(req.query.TRAY_ID)-1)*100000; //interasse tra cassetti easybox =100
        let query = `INSERT INTO [POSITION]
					(PARENT, POS, SUB_POS, STATUS, X, Y, Z, X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, Part_Type)
					VALUES('TRAY_${req.query.TRAY_ID}', 
						${req.query.POS}, 
						${req.query.SUB_POS}, 
						${req.query.STATUS}, 
						${req.query.X}, ${req.query.Y}, ${quotaZ}, 
						0, 0, 0, 
						3, ${req.query.PIECE_TYPE});`;

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
		let quotaZ = 0;
		if (req.query.EASYBOX === 'true'){
			quotaZ = (parseInt(req.query.TRAY_ID)-1)*100000; //interasse tra cassetti easybox =100
		}
        let query = `UPDATE [POSITION] SET 
					STATUS=${req.query.STATUS},
					X=${req.query.X},
					Y=${req.query.Y},
					Part_Type=${req.query.PIECE_TYPE},
					Z=${quotaZ}
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