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

		// (tray-teaching) colonne di teaching OPZIONALI — clausola solo se il
		// chiamante le manda (pattern PALLET_ID di updateVice: i chiamanti che
		// rimandano righe lette PRIMA del DDL non le hanno, un undefined
		// interpolato romperebbe la query e azzererebbe il teaching a ogni
		// salvataggio). Non numerico -> NULL (= mai insegnato).
		let teachClause = '';
		for (const col of ['X_ROT','Y_ROT','Z_ROT','APPROACH_X','APPROACH_Y','APPROACH_Z']) {
			if (req.query[col] != undefined) {
				const v = parseInt(req.query[col]);
				teachClause += `, ${col}=${isNaN(v) ? 'NULL' : v}`;
			}
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
					Z_CORR='${req.query.Z_CORR}'${teachClause}
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

//////////////////////////////////////////////////////////
////////// TEACHING CASSETTIERA (tray-teaching) //////////
//////////////////////////////////////////////////////////

// Coordinate di estrazione per-piano (tabella solo-PLC, 12 righe TRAY 1..12):
// al pannello servono i DELTA XYZ tra piani per derivare il teaching degli
// altri 11 cassetti dal campione. Sola lettura.
router.get('/extractCoords', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err extractCoords: " + err);
			return;
		}
		let query = `select * from COORDINATES_FOR_EXTRACT order by TRAY;`
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

// Scrittura ATOMICA del teaching su tutta la cassettiera (comando "0").
// Input: rows = JSON [{tray:1..12, xCorr,yCorr,zCorr,xRot,yRot,zRot}, ...]
// (millesimi interi). Validazione numerica server-side: QUALUNQUE campo non
// numerico -> KO_BAD_INPUT, nessuna scrittura. Per ogni riga, nella STESSA
// transazione (SET XACT_ABORT ON + BEGIN TRAN: qualsiasi errore runtime
// annulla TUTTO — o si scrive tutta la cassettiera o niente):
//   1. UPDATE TRAY (CORR+ROT) WHERE FLOOR_MAG=tray (piano senza riga TRAY:
//      no-op, non errore — il pannello lo annota in anteprima);
//   2. UPDATE [POSITION] ROT + Z=0 WHERE PARENT like 'TRAY_n %'.
//      Z=0 = migrazione alla CONVENZIONE (vedi Position.js): le righe
//      vecchio-regime con Z=interasse vengono azzerate QUI, nella stessa
//      transazione del teaching che mette la quota assoluta in TRAY.Z_CORR.
router.get('/teachTrays', (req, res) => {
	let rows;
	try { rows = JSON.parse(req.query.rows); } catch (e) { res.send("KO_BAD_INPUT"); return; }
	if (!Array.isArray(rows) || rows.length < 1 || rows.length > 12) { res.send("KO_BAD_INPUT"); return; }
	const FIELDS = ['xCorr','yCorr','zCorr','xRot','yRot','zRot'];
	for (const r of rows) {
		const tray = Number(r && r.tray);
		if (!Number.isInteger(tray) || tray < 1 || tray > 12) { res.send("KO_BAD_INPUT"); return; }
		for (const f of FIELDS)
			if (!Number.isFinite(Number(r[f]))) { res.send("KO_BAD_INPUT"); return; }
	}
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err teachTrays: " + err);
			res.send("KO");
			return;
		}
		// tutti i valori passano da Math.round(Number()) DOPO la validazione:
		// nella query entrano SOLO numeri.
		let query = "SET XACT_ABORT ON; BEGIN TRAN;";
		for (const r of rows) {
			const t = Math.round(Number(r.tray));
			const v = f => Math.round(Number(r[f]));
			query += ` UPDATE TRAY SET X_CORR=${v('xCorr')}, Y_CORR=${v('yCorr')}, Z_CORR=${v('zCorr')}, X_ROT=${v('xRot')}, Y_ROT=${v('yRot')}, Z_ROT=${v('zRot')} WHERE FLOOR_MAG=${t};`;
			query += ` UPDATE [POSITION] SET X_ROT=${v('xRot')}, Y_ROT=${v('yRot')}, Z_ROT=${v('zRot')}, Z=0 WHERE PARENT like 'TRAY_${t} %';`;
		}
		query += " COMMIT TRAN;";
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err) {
			if (err) {
				log.error("Err query: " + err)
				res.send("KO")
			}else
				res.send("OK")
		});
	});
})

// Propagazione teaching del SINGOLO cassetto (form Tray): ROT + APPROACH
// gia' persistiti su TRAY -> [POSITION] TRAY_n esistenti. Risponde
// "OK;<n righe>" per la conferma "applicato a N posizioni" a video.
router.get('/propagateTeaching', (req, res) => {
	const num = k => Number(req.query[k]);
	const COLS = ['X_ROT','Y_ROT','Z_ROT','APPROACH_TYPE','APPROACH_X','APPROACH_Y','APPROACH_Z'];
	const floor = num('FLOOR_MAG');
	if (!Number.isInteger(floor) || floor < 1 || floor > 12 || COLS.some(c => !Number.isFinite(num(c)))) {
		res.send("KO_BAD_INPUT");
		return;
	}
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err propagateTeaching: " + err);
			res.send("KO");
			return;
		}
		// SET NOCOUNT ON + COUNT esplicita: su [POSITION] c'e' un trigger
		// (POSITION_trig) i cui conteggi finiscono in rowsAffected PRIMA di
		// quello dell'UPDATE — il numero per la conferma a video va contato
		// a parte, non letto da rowsAffected.
		let query = `SET NOCOUNT ON; UPDATE [POSITION] SET ` +
			COLS.map(c => `${c}=${Math.round(num(c))}`).join(', ') +
			` WHERE PARENT like 'TRAY_${floor} %';` +
			` SELECT COUNT(*) as n FROM [POSITION] WHERE PARENT like 'TRAY_${floor} %';`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err, result) {
			if (err) {
				log.error("Err query: " + err)
				res.send("KO")
			}else
				res.send("OK;" + (result.recordset && result.recordset[0] ? result.recordset[0].n : 0))
		});
	});
})

module.exports = router;