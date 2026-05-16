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
                res.send("error DB")
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
                res.send("error DB")
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
                        res.send("error DB")
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
                res.send("error DB")
            }else
				res.send(recordset.recordset)
        });
    })
})

router.get('/updateGripper', (req, res) => {

	//console.log(">>>"+JSON.stringify(data,null,4));
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertStartJob: " + err);
            return;
        }

		//console.log("---"+JSON.stringify(gripperData,null,4));

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
					SUB_POS=0, 
					POS_PLANT='${req.query.POS_PLANT}'
					where ID='${req.query.ID}';`
					
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

router.get('/insertGripper', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertStartJob: " + err);
            return;
        }
		
		//console.log("---"+JSON.stringify(req.query,null,4));
		
		var request = new sql.Request();
        let query = `INSERT INTO GRIPPER
					(FAMILY, DESCR, X_BODY, Y_BODY, Z_BODY, X_CLAW, Y_CLAW, Z_CLAW, STATUS, POS_MAG, SUB_POS, POS_PLANT)
					VALUES(
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
					'${req.query.POS_PLANT}');`
					
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
                res.send("error DB")
            }else
				res.send(recordset.recordset)
        });
    })
})

module.exports = router;