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

		let query = `select * from TRAYS order by FLOOR_MAG desc;`
		//console.log("ricevo:" +String(req.params.ID))
		if (String(req.params.ID)!="all") 
			query = `select * from TRAYS where ID='${req.params.ID}';`
		
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


router.get('/updateTray', (req, res) => {

	//console.log(">>>"+JSON.stringify(req.query,null,4));
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updateTray: " + err);
            return;
        }

		let query = `UPDATE TRAY SET 
					MAG='${req.query.MAG}', 
					FAMILY='${req.query.FAMILY}', 
					DESCR='${req.query.DESCR}', 
					X='${req.query.X}', 
					Y='${req.query.Y}', 
					STATUS='${req.query.STATUS}', 
					APPROACH_TYPE='${req.query.APPROACH_TYPE}', 
					Z_PICK='${req.query.Z_PICK}', 
					Z_PLACE='${req.query.Z_PLACE}', 
					FLOOR_MAG='${req.query.FLOOR_MAG}', 
					X_CORR='${req.query.X_CORR}', 
					Y_CORR='${req.query.Y_CORR}', 
					Z_CORR='${req.query.Z_CORR}'
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

router.get('/updateGratingInTray', (req, res) => {

	//console.log(">>>"+JSON.stringify(req.query,null,4));
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updateGratingInTray: " + err);
            return;
        }

		let query = `UPDATE TRAY SET 
					FAMILY='${req.query.FAMILY}'
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

function makeQueryPart(notFirstPart, quote, name, val){ 
	let ris = ''
	//console.log(name+" "+val+" --> "+typeof(name)+" "+typeof(val))
	if (val==undefined) 			return '';
	if (val=='undefined')			return '';
	if (val===undefined) 			return '';
	if (typeof(val) === 'undefined')return '';
	if (val=='') 					return '';
	
	val = val.replace(",",".")
	
	ris += notFirstPart?',':'';
    if (typeof(val) !== 'undefined')
		ris += name+'='+(quote?'\''+val:val)+(quote?'\'':'') 
	return ris
}

router.get('/test', (req, res) => {
	//console.log(" - - - >"+JSON.stringify(req.query,null,4));
	//console.log(" DESCR: "+req.query.DESCR)
	let iniQuery = `UPDATE TRAY SET `;
	let query = iniQuery;
	query += makeQueryPart(query.length!=iniQuery.length, true, 'FAMILY', 	`${req.query.FAMILY}`)
	query += makeQueryPart(query.length!=iniQuery.length, true, 'DESCR', 	`${req.query.DESCR}`)
	query += makeQueryPart(query.length!=iniQuery.length, false,'X', 		`${req.query.X}`)
	query += makeQueryPart(query.length!=iniQuery.length, false,'Y', 		`${req.query.Y}`)
	query += makeQueryPart(query.length!=iniQuery.length, false,'STATUS', 	`${req.query.STATUS}`)
	query += makeQueryPart(query.length!=iniQuery.length, false,'APPROACH_TYPE',`${req.query.APPROACH_TYPE}`)
	query += makeQueryPart(query.length!=iniQuery.length, false,'Z_PICK', 	`${req.query.Z_PICK}`)
	query += makeQueryPart(query.length!=iniQuery.length, false,'Z_PLACE', 	`${req.query.Z_PLACE}`)
	query += makeQueryPart(query.length!=iniQuery.length, false,'FLOOR_MAG',`${req.query.FLOOR_MAG}`)
	query += makeQueryPart(query.length!=iniQuery.length, false,'X_CORR', 	`${req.query.X_CORR}`)
	query += makeQueryPart(query.length!=iniQuery.length, false,'Y_CORR', 	`${req.query.Y_CORR}`)
	query += ` WHERE ID=${req.query.ID}`
	
	res.send(query)
});

function makeQueryPart2(notFirstPart, quote, name, val){ 
	let ris = ['','']
	//console.log(name+" "+val+" --> "+typeof(name)+" "+typeof(val))
	if (val==undefined) 			return ['',''];
	if (val=='undefined')			return ['',''];
	if (val===undefined) 			return ['',''];
	if (typeof(val) === 'undefined')return ['',''];
	if (val=='') 					return ['',''];
	
	val = val.replace(",",".")
	
	ris[0] += notFirstPart?',':'';
	ris[1] += notFirstPart?',':'';
    if (typeof(val) !== 'undefined'){
		ris[0] += name
		ris[1] += (quote?'\''+val:val)+(quote?'\'':'') 
	}
	return ris
}

router.get('/test2', (req, res) => {
	//console.log(" - - - >"+JSON.stringify(req.query,null,4));
	//console.log(" DESCR: "+req.query.DESCR)
	let iniQuery = `INSERT INTO TRAY (`;
	let firstPartQuery = iniQuery;
	let query = ') VALUES (';
	let ret = ''
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, true, 'FAMILY',`${req.query.FAMILY}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, true, 'DESCR', `${req.query.DESCR}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, false, 'X', 	`${req.query.X}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, false, 'Y', 	`${req.query.Y}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, false, 'STATUS', `${req.query.STATUS}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, false, 'APPROACH_TYPE', `${req.query.APPROACH_TYPE}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, false, 'Z_PICK', `${req.query.Z_PICK}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, false, 'Z_PLACE', `${req.query.Z_PLACE}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, false, 'FLOOR_MAG', `${req.query.FLOOR_MAG}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]	
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, false, 'FLOOR_MAG', `${req.query.FLOOR_MAG}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]	
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, false, 'X_CORR', `${req.query.X_CORR}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]	
	ret = makeQueryPart2(iniQuery.length!=firstPartQuery.length, false, 'Y_CORR', `${req.query.Y_CORR}`)
	firstPartQuery 	+= ret[0]
	query 	 		+= ret[1]	
	
	res.send(firstPartQuery+query+")")
});

//TODO:da testare
router.get('/insertTray', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertTray: " + err);
            return;
        }
		
		var request = new sql.Request();

        let query = `INSERT INTO TRAY
					(MAG, FAMILY, DESCR, X, Y, STATUS, APPROACH_TYPE, Z_PICK, Z_PLACE, FLOOR_MAG, X_CORR, Y_CORR, Z_CORR)
					VALUES( 
					${req.query.MAG}, 
					'${req.query.FAMILY}', 
					'${req.query.DESCR}', 
					${req.query.X}, 
					${req.query.Y}, 
					${req.query.STATUS}, 
					${req.query.APPROACH_TYPE}, 
					${req.query.Z_PICK}, 
					${req.query.Z_PLACE}, 
					${req.query.FLOOR_MAG}, 
					${req.query.X_CORR}, 
					${req.query.Y_CORR}, 
					${req.query.Z_CORR});`
					
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
    console.log('delete Tray '+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete TRAY: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `DELETE FROM TRAY WHERE ID=${req.params.ID};`
					
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

//////////////////////////////////////////////////////////
///////////////////////// LAYOUT /////////////////////////
//////////////////////////////////////////////////////////
 
router.get('/layout/:trayID', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err layoutTrayFromID: " + err);
            return;
        }

		/*let query = `select partType,prisma,x_pick/1000 as x,Y_PICK/1000 as y, status from COORDINATES_PIECES_TRAYS where TRAY=${req.params.trayID};`*/
		let query = `select partType,prisma,x_pick/1000 as x,Y_PICK/1000 as y, status, order_ID, FLOOR_MAG from COORDINATES_PIECES_TRAYS where TRAY = '${req.params.trayID}' order by SUB_POS;`
		
		//console.log("ricevo:" +String(req.params.ID))
		
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

//////////////////////////////////////////////////////////
///////////////////// MOVING TRAY ////////////////////////
//////////////////////////////////////////////////////////
router.get('/extract/:trayID', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err layoutTrayFromID: " + err);
            return;
        }

		let query = `UPDATE TRAY
					SET [EXTRACT]=1000
					WHERE ID='${req.params.trayID}';`
		
		//console.log("ricevo:" +String(req.params.ID))
		
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

router.get('/insert/:trayID', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err layoutTrayFromID: " + err);
            return;
        }

		let query = `UPDATE TRAY
					SET [EXTRACT]=2000
					WHERE ID='${req.params.trayID}';`
		
		//console.log("ricevo:" +String(req.params.ID))
		
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

router.get('/resetExtract/:trayID', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err layoutTrayFromID: " + err);
            return;
        }

		let query = `UPDATE TRAY
					SET [EXTRACT]=0
					WHERE ID='${req.params.trayID}';`
		
		//console.log("ricevo:" +String(req.params.ID))
		
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

router.get('/resetInsert/:trayID', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err layoutTrayFromID: " + err);
            return;
        }

		let query = `UPDATE TRAY
					SET [EXTRACT]=1
					WHERE ID='${req.params.trayID}';`
		
		//console.log("ricevo:" +String(req.params.ID))
		
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

module.exports = router;