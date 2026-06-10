//////// HMI ////////
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('../LogFunct');

var templatePATH = '.';

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

		let query = `UPDATE WORKORDERS SET
					PIECE_ID='${req.query.pieceID}', 
					GRIPPER_ID='${req.query.gripperID}', 
					VICE_ID='${req.query.viceID}', 
					FIXTURE_ID='${req.query.fixtureID}',
					PALLET_ID='${req.query.palletID}', 
					STATUS='${req.query.status}', 
					MACHINE_ID='${req.query.machineID}', 
					QUANTITY='${req.query.quantity}', 
					X_PICK_DECENTRATED_TRAY='${req.query.decentrated_tray_x_pick}', 
					X_PLACE_DECENTRATED_TRAY=${req.query.decentrated_tray_x_place}', 
					Y_PICK_DECENTRATED_TRAY=${req.query.decentrated_tray_y_pick}', 
					Y_PLACE_DECENTRATED_TRAY=${req.query.decentrated_tray_x_place}', 
					X_PICK_DECENTRATED_MC=${req.query.decentrated_MC_x_pick}', 
					X_PLACE_DECENTRATED_MC=${req.query.decentrated_MC_x_place}',  
					Y_PICK_DECENTRATED_MC=${req.query.decentrated_MC_y_pick}',  
					Y_PLACE_DECENTRATED_MC=${req.query.decentrated_MC_y_place}',
					PartProg_ID=${req.query.PP}
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
        let query = `INSERT INTO WORKORDERS
					(PIECE_ID, GRIPPER_ID, VICE_ID, FIXTURE_ID, PALLET_ID, STATUS, MACHINE_ID, QUANTITY, X_PICK_DECENTRATED_TRAY, X_PLACE_DECENTRATED_TRAY, Y_PICK_DECENTRATED_TRAY, Y_PLACE_DECENTRATED_TRAY, X_PICK_DECENTRATED_MC, X_PLACE_DECENTRATED_MC, Y_PICK_DECENTRATED_MC, Y_PLACE_DECENTRATED_MC, PartProg_ID)
					VALUES(
					'${req.query.pieceID}', 
					'${req.query.gripperID}', 
					'${req.query.viceID}', 
					'${req.query.fixtureID}',
					'${req.query.palletID}', 
					 4, 
					'${req.query.machineID}', 
					'${req.query.quantity}', 
					'${req.query.decentrated_tray_x_pick}', 
					'${req.query.decentrated_tray_y_pick}', 
					'${req.query.decentrated_tray_x_place}', 
					'${req.query.decentrated_tray_y_place}', 
					'${req.query.decentrated_MC_x_pick}', 
					'${req.query.decentrated_MC_x_place}', 
					'${req.query.decentrated_MC_y_pick}', 
					'${req.query.decentrated_MC_y_place}',
					 ${req.query.PP}
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
        let query = `DELETE FROM WORKORDERS WHERE ID=${req.params.ID};`
					
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