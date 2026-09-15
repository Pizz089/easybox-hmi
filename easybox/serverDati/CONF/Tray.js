//////// HMI ////////
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
const { trayParentPredicate } = require('../trayParent');
const errorCodes = require('../errorCodes');
const gratingFit = require('../gratingFit');
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
                res.status(500).send("KO")
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
                res.status(500).send("KO")
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
                res.status(500).send("KO")
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
		// (dup-guard 4/9) SUB_POS nella SELECT: la pagina layout mappa le tasche
		// per SUB_POS reale, mai per indice (coi duplicati l'indice sfalsava
		// etichette, click e salvataggi). Stessa vista, contratto PLC intatto.
		let query = `select partType,prisma,x_pick/1000 as x,Y_PICK/1000 as y, status, order_ID, FLOOR_MAG, SUB_POS from COORDINATES_PIECES_TRAYS where TRAY = '${req.params.trayID}' order by SUB_POS;`
		
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
//   2. UPDATE [POSITION] ROT + Z=0 WHERE PARENT = 'TRAY_n' (helper trayParent).
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
			res.status(500).send("KO");
			return;
		}
		// tutti i valori passano da Math.round(Number()) DOPO la validazione:
		// nella query entrano SOLO numeri.
		let query = "SET XACT_ABORT ON; BEGIN TRAN;";
		for (const r of rows) {
			const t = Math.round(Number(r.tray));
			const v = f => Math.round(Number(r[f]));
			query += ` UPDATE TRAY SET X_CORR=${v('xCorr')}, Y_CORR=${v('yCorr')}, Z_CORR=${v('zCorr')}, X_ROT=${v('xRot')}, Y_ROT=${v('yRot')}, Z_ROT=${v('zRot')} WHERE FLOOR_MAG=${t};`;
			query += ` UPDATE [POSITION] SET X_ROT=${v('xRot')}, Y_ROT=${v('yRot')}, Z_ROT=${v('zRot')}, Z=0 WHERE ${trayParentPredicate(t)};`;
		}
		query += " COMMIT TRAN;";
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err) {
			if (err) {
				log.error("Err query: " + err)
				res.status(500).send("KO")
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
			res.status(500).send("KO");
			return;
		}
		// SET NOCOUNT ON + COUNT esplicita: su [POSITION] c'e' un trigger
		// (POSITION_trig) i cui conteggi finiscono in rowsAffected PRIMA di
		// quello dell'UPDATE — il numero per la conferma a video va contato
		// a parte, non letto da rowsAffected.
		// (tray-parent-predicate) floor gia' validato 1..12 sopra
		const pred = trayParentPredicate(floor);
		let query = `SET NOCOUNT ON; UPDATE [POSITION] SET ` +
			COLS.map(c => `${c}=${Math.round(num(c))}`).join(', ') +
			` WHERE ${pred};` +
			` SELECT COUNT(*) as n FROM [POSITION] WHERE ${pred};`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err, result) {
			if (err) {
				log.error("Err query: " + err)
				res.status(500).send("KO")
			}else
				res.send("OK;" + (result.recordset && result.recordset[0] ? result.recordset[0].n : 0))
		});
	});
})

//////////////////////////////////////////////////////////////////////////
////////// ASSOCIAZIONE GRIGLIATO <-> CASSETTO (grating-model) ///////////
//////////////////////////////////////////////////////////////////////////
// Il grigliato (GRATING) e' un MODELLO senza tasche; l'UNICO legame con il
// cassetto e' TRAY.FAMILY = GRATING.NAME (uguaglianza, niente LIKE) e le
// tasche [POSITION] TRAY_n nascono SOLO qui. GRATING.TRAY_ID non si usa piu'.
//
// Guardie comuni, PRIMA di qualunque scrittura, nell'ordine:
//   1. cassetto e grigliato esistenti                     -> KO_BAD_INPUT
//   2. TRAY.EXTRACT <> 0 (fuori o in manovra)              -> KO_TRAY_EXTRACTED
//      NB: EXTRACT non viene aggiornato dal PLC al rientro (difetto noto):
//      la guardia e' CONSERVATIVA e puo' rifiutare a torto — voluto.
//   3. tasca legata a un ordine ATTIVO (WORKORDERS.STATUS=3) -> KO_ACTIVE_ORDER
// Tutto in UNA transazione (SET XACT_ABORT ON): o tutto o niente; l'indice
// UNIQUE (PARENT, SUB_POS) fa da cintura.

const TRAY_TEACH_COLS = 'MAG, X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z';

// Ramo COPIA: tasche del cassetto sorgente -> target, stesso SUB_POS, quote
// e correzioni per tasca TARATE conservate (X, Y, *_CORR, *_ROT_CORR,
// APPROACH_*_ROT, Part_Type). Z=0 per convenzione (la quota piano vive in
// TRAY.Z_CORR del target). Rotazioni e avvicinamenti dal teaching del TRAY
// target, con ripiego sul valore della tasca sorgente se il target non e'
// mai stato insegnato (NULL). Stato vuoto (2), Order_ID 0.
function copyInsertSql(floor, srcFloor) {
	return `INSERT INTO [POSITION] (PARENT, POS, SUB_POS, STATUS, X, Y, Z, X_CORR, Y_CORR, Z_CORR, X_ROT, Y_ROT, Z_ROT, X_ROT_CORR, Y_ROT_CORR, Z_ROT_CORR, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z, APPROACH_X_ROT, APPROACH_Y_ROT, APPROACH_Z_ROT, Part_Type, Order_ID)
		SELECT 'TRAY_${floor}', t.MAG, s.SUB_POS, 2, s.X, s.Y, 0, s.X_CORR, s.Y_CORR, s.Z_CORR,
			COALESCE(t.X_ROT, s.X_ROT), COALESCE(t.Y_ROT, s.Y_ROT), COALESCE(t.Z_ROT, s.Z_ROT),
			s.X_ROT_CORR, s.Y_ROT_CORR, s.Z_ROT_CORR,
			COALESCE(t.APPROACH_TYPE, s.APPROACH_TYPE), COALESCE(t.APPROACH_X, s.APPROACH_X), COALESCE(t.APPROACH_Y, s.APPROACH_Y), COALESCE(t.APPROACH_Z, s.APPROACH_Z),
			s.APPROACH_X_ROT, s.APPROACH_Y_ROT, s.APPROACH_Z_ROT, s.Part_Type, 0
		FROM [POSITION] s
		CROSS JOIN (SELECT TOP 1 ${TRAY_TEACH_COLS} FROM TRAY WHERE FLOOR_MAG=${floor}) t
		WHERE ${trayParentPredicate(srcFloor, 's.PARENT')} AND s.SUB_POS > 0;`;
}

// Ramo GENERA (solo primo cassetto di un modello senza sorgenti, o "Rigenera
// tasche"): punti robot gia' verificati e convertiti dal server, UNA INSERT
// multi-riga con la stessa eredita' di teaching di insertPositionTray.
function generateInsertSql(floor, pts, pieceId) {
	const values = pts.map((p, i) => `(${i + 1}, ${p.X}, ${p.Y})`).join(', ');
	return `INSERT INTO [POSITION] (PARENT, POS, SUB_POS, STATUS, X, Y, Z, X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z, Part_Type)
		SELECT 'TRAY_${floor}', t.MAG, v.SUB_POS, 2, v.X, v.Y, 0,
			COALESCE(t.X_ROT,0), COALESCE(t.Y_ROT,0), COALESCE(t.Z_ROT,0),
			COALESCE(t.APPROACH_TYPE,3), COALESCE(t.APPROACH_X,100000), COALESCE(t.APPROACH_Y,100000), COALESCE(t.APPROACH_Z,100000),
			${pieceId}
		FROM (VALUES ${values}) AS v(SUB_POS, X, Y)
		CROSS JOIN (SELECT TOP 1 ${TRAY_TEACH_COLS} FROM TRAY WHERE FLOOR_MAG=${floor}) t;`;
}

// POST /associateGrating/:floor   body JSON:
//   { gratingId, replace: bool, source: { floor: <cassetto sorgente> } }
//   { gratingId, replace: bool, source: { centers: [{w,h}, ...] } }   (mm, coordinate DISEGNO)
// replace=true: "Sostituisci"/"Rigenera" — le tasche attuali vengono
// cancellate nella stessa transazione; replace=false: il cassetto deve
// essere libero (FAMILY vuota E zero tasche) -> altrimenti KO_ALREADY_ASSOCIATED.
// Risposta JSON { ris, n } (n = tasche a DB dopo l'operazione).
router.post('/associateGrating/:floor', (req, res) => {
	const floor = Number(req.params.floor);
	const pred  = trayParentPredicate(floor);
	const predP = trayParentPredicate(floor, 'p.PARENT');
	const body  = req.body || {};
	const gratingId = Number(body.gratingId);
	const replace = body.replace === true || body.replace === 'true' || body.replace === 1;
	const src = body.source || {};
	const copy = src.floor !== undefined && src.floor !== null;
	const srcFloor = copy ? Number(src.floor) : null;
	const centers = copy ? null : gratingFit.parseCenters(src.centers);
	if (!pred || !Number.isInteger(gratingId) || gratingId < 1 ||
		(copy && (!trayParentPredicate(srcFloor) || srcFloor === floor)) ||
		(!copy && !centers)) {
		res.json({ ris: "KO_BAD_INPUT", n: 0 });
		return;
	}
	sql.connect(DBf.configDB, function (err) {
		if (err) { log.error("err associateGrating: " + err); res.status(500).json({ ris: "KO", n: 0 }); return; }
		// FASE 1 (sola lettura): misure cassetto target e pezzo del modello
		// DAL DB — il payload non puo' portare misure proprie (client stantio).
		const ctx = `SET NOCOUNT ON;
			SELECT g.ID, g.PIECE_ID, g.THICKNESS, p.X AS PX, p.Y AS PY, p.Z_PICK, p.Z_PLACE, t.X AS TX, t.Y AS TY
			FROM GRATING g
			LEFT JOIN PIECE p ON p.ID = g.PIECE_ID
			CROSS JOIN (SELECT TOP 1 X, Y FROM TRAY WHERE FLOOR_MAG=${floor}) t
			WHERE g.ID=${gratingId};`;
		log.info('query ' + ctx);
		new sql.Request().query(ctx, function (err, result) {
			if (err) { log.error("Err query: " + err); res.status(500).json({ ris: "KO", n: 0 }); return; }
			const row = result.recordset && result.recordset[0];
			if (!row) { res.json({ ris: "KO_BAD_INPUT", n: 0 }); return; }
			// (grating-thickness 14/9) protezione anti-urto IN GENERAZIONE, in
			// TUTTI i modi (copia compresa: anche la copia crea le tasche di
			// questo cassetto con il pezzo di questo modello): Z_PICK e
			// Z_PLACE del pezzo >= THICKNESS + franco, valori DAL DB. Sotto il
			// minimo nessuna riga entra in [POSITION]; il JSON porta i numeri
			// per il messaggio (micron). THICKNESS NULL/0 = nessun vincolo.
			const clr = gratingFit.pickClearance({ thickness: row.THICKNESS, zPick: row.Z_PICK, zPlace: row.Z_PLACE });
			if (!clr.ok) {
				log.standard("associateGrating KO_Z_BELOW_GRATING: TRAY_" + floor + " grigliato " + gratingId + " min " + clr.min + " um, Z_PICK " + clr.zPick + " Z_PLACE " + clr.zPlace);
				res.json({ ris: errorCodes.KO_Z_BELOW_GRATING, n: 0, min: clr.min, zPick: clr.zPick, zPlace: clr.zPlace, thickness: Number(row.THICKNESS) || 0 });
				return;
			}
			let insert;
			if (copy) {
				insert = copyInsertSql(floor, srcFloor);
			} else {
				// verifica INGOMBRO lato server: contorno = TRAY.X/Y (mm), mezzo
				// ingombro tasca = PIECE.X/2, PIECE.Y/2 (mm) — stessa gridFit del client
				if (!(Number(row.PX) > 0) || !(Number(row.PY) > 0)) { res.json({ ris: "KO_BAD_INPUT", n: 0 }); return; }
				const f = gratingFit.gridFit(centers, {
					width: Number(row.TX) / 1000, height: Number(row.TY) / 1000,
					halfW: Number(row.PX) / 2000, halfH: Number(row.PY) / 2000,
				});
				if (!f.ok) {
					log.standard("associateGrating KO_OUT_OF_TRAY: TRAY_" + floor + " sfora W " + f.overW + " mm / H " + f.overH + " mm");
					res.json({ ris: errorCodes.KO_OUT_OF_TRAY, n: 0, overW: f.overW, overH: f.overH });
					return;
				}
				insert = generateInsertSql(floor, gratingFit.drawingToRobot(centers), Math.round(Number(row.PIECE_ID)));
			}
			const freeCheck = replace ? '1=0' :
				`EXISTS (SELECT 1 FROM TRAY WHERE FLOOR_MAG=${floor} AND RTRIM(ISNULL(FAMILY,'')) <> '') OR EXISTS (SELECT 1 FROM [POSITION] WHERE ${pred})`;
			const sourceCheck = copy ?
				`NOT EXISTS (SELECT 1 FROM TRAY WHERE FLOOR_MAG=${srcFloor} AND FAMILY = @name) OR NOT EXISTS (SELECT 1 FROM [POSITION] WHERE ${trayParentPredicate(srcFloor)})` : '1=0';
			const query = `SET NOCOUNT ON; SET XACT_ABORT ON;
				DECLARE @name varchar(100) = (SELECT NAME FROM GRATING WHERE ID=${gratingId});
				DECLARE @extract int = (SELECT TOP 1 ISNULL(EXTRACT,0) FROM TRAY WHERE FLOOR_MAG=${floor});
				IF @name IS NULL OR @extract IS NULL SELECT 'KO_BAD_INPUT' AS ris, 0 AS n;
				ELSE IF @extract <> 0 SELECT '${errorCodes.KO_TRAY_EXTRACTED}' AS ris, 0 AS n;
				ELSE IF EXISTS (SELECT 1 FROM [POSITION] p JOIN WORKORDERS w ON w.ID = p.Order_ID WHERE ${predP} AND w.STATUS = 3) SELECT '${errorCodes.KO_ACTIVE_ORDER}' AS ris, 0 AS n;
				ELSE IF ${freeCheck} SELECT '${errorCodes.KO_ALREADY_ASSOCIATED}' AS ris, (SELECT COUNT(*) FROM [POSITION] WHERE ${pred}) AS n;
				ELSE IF ${sourceCheck} SELECT '${errorCodes.KO_SOURCE_EMPTY}' AS ris, 0 AS n;
				ELSE BEGIN
					BEGIN TRAN;
					DELETE FROM [POSITION] WHERE ${pred};
					${insert}
					UPDATE TRAY SET FAMILY=@name, STATUS=2 WHERE FLOOR_MAG=${floor};
					COMMIT TRAN;
					SELECT 'OK' AS ris, (SELECT COUNT(*) FROM [POSITION] WHERE ${pred}) AS n;
				END`;
			log.info('query ' + query);
			new sql.Request().query(query, function (err, result) {
				if (err) { log.error("Err query: " + err); res.status(500).json({ ris: "KO", n: 0 }); return; }
				const out = result.recordset && result.recordset[0] ? result.recordset[0] : { ris: "KO", n: 0 };
				res.json(out);
				if (out.ris === 'OK')
					log.standard("ASSOCIA GRIGLIATO " + gratingId + " -> TRAY_" + floor + (copy ? " (copia da TRAY_" + srcFloor + ")" : " (generato dall'header)") + (replace ? " [sostituzione]" : "") + ": " + out.n + " tasche");
			});
		});
	});
});

// POST /dissociateGrating/:floor — cancella le tasche del cassetto e azzera
// FAMILY/stato. Funziona ANCHE con FAMILY gia' vuota: serve a ripulire tasche
// orfane (il PLC le conta comunque). Il modello GRATING non viene toccato.
// Risposta JSON { ris, n } (n = tasche cancellate).
router.post('/dissociateGrating/:floor', (req, res) => {
	const floor = Number(req.params.floor);
	const pred  = trayParentPredicate(floor);
	const predP = trayParentPredicate(floor, 'p.PARENT');
	if (!pred) { res.json({ ris: "KO_BAD_INPUT", n: 0 }); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) { log.error("err dissociateGrating: " + err); res.status(500).json({ ris: "KO", n: 0 }); return; }
		const query = `SET NOCOUNT ON; SET XACT_ABORT ON;
			DECLARE @extract int = (SELECT TOP 1 ISNULL(EXTRACT,0) FROM TRAY WHERE FLOOR_MAG=${floor});
			IF @extract IS NULL SELECT 'KO_BAD_INPUT' AS ris, 0 AS n;
			ELSE IF @extract <> 0 SELECT '${errorCodes.KO_TRAY_EXTRACTED}' AS ris, 0 AS n;
			ELSE IF EXISTS (SELECT 1 FROM [POSITION] p JOIN WORKORDERS w ON w.ID = p.Order_ID WHERE ${predP} AND w.STATUS = 3) SELECT '${errorCodes.KO_ACTIVE_ORDER}' AS ris, 0 AS n;
			ELSE BEGIN
				DECLARE @n int = (SELECT COUNT(*) FROM [POSITION] WHERE ${pred});
				BEGIN TRAN;
				DELETE FROM [POSITION] WHERE ${pred};
				UPDATE TRAY SET FAMILY='', STATUS=2 WHERE FLOOR_MAG=${floor};
				COMMIT TRAN;
				SELECT 'OK' AS ris, @n AS n;
			END`;
		log.info('query ' + query);
		new sql.Request().query(query, function (err, result) {
			if (err) { log.error("Err query: " + err); res.status(500).json({ ris: "KO", n: 0 }); return; }
			const out = result.recordset && result.recordset[0] ? result.recordset[0] : { ris: "KO", n: 0 };
			res.json(out);
			if (out.ris === 'OK')
				log.standard("DISSOCIA GRIGLIATO da TRAY_" + floor + ": " + out.n + " tasche cancellate, FAMILY azzerata");
		});
	});
});

module.exports = router;