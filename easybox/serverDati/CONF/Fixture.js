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

		let query = `select * from FIXTURES ;`
		//console.log("ricevo:" +String(req.params.ID))
		if (String(req.params.ID)!="all") 
			query = `select * from FIXTURES where ID='${req.params.ID}';`
		
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

router.get('/showOnMC/:ID', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getTrayFromID: " + err);
            return;
        }

		let query = `select * from FIXTURES where ID in (select fixture from unit_STATUS where unit like'MC%')`
		if (String(req.params.ID)!="all") 
			query = `select * from FIXTURES where ID in (select fixture from unit_STATUS where unit like 'MC${req.params.ID}%') `
		
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

router.get('/updateFixture', (req, res) => {

	//console.log(">>>"+JSON.stringify(req.query,null,4));

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updateFixture: " + err);
            return;
        }

		let query = `UPDATE FIXTURE SET 
					FAMILY='${req.query.FAMILY}', 
					DESCR='${req.query.DESCR}', 
					STATUS='${req.query.STATUS}', 
					X=${req.query.X}*1000, 
					Y=${req.query.Y}*1000, 
					Z=${req.query.Z}*1000, 
					Z_CLAW=${req.query.Z_CLAW}*1000, 
					Z_SINK_CLAW=${req.query.Z_SINK_CLAW}*1000, 
					MAG='${req.query.MAG}', 
					MAG_POS='${req.query.MAG_POS}', 
					POS_PLANT='${req.query.POS_PLANT}'
					WHERE ID='${req.query.ID}';`
		
		//if (req.query.POS_PLANT>0){
		//	query += `UPDATE FIXTURE_ON_PALLET SET 
		//			PALLET_ID=${req.query.POS_PLANT}, 
		//			FIXTURE_ID=${req.query.ID}, 
		//			POS_X=${req.query.POS_X}*1000, 
		//			POS_Y=${req.query.POS_Y}*1000,  
		//			POS_Z=${req.query.POS_Z}*1000, 
		//			POS_X_CORR=${req.query.POS_X_CORR}*1000, 
		//			POS_Y_CORR=${req.query.POS_Y_CORR}*1000, 
		//			POS_Z_CORR=${req.query.POS_Z_CORR}*1000, 
		//			POS_X_ROT=${req.query.POS_X_ROT}*1000, 
		//			POS_Y_ROT=${req.query.POS_Y_ROT}*1000, 
		//			POS_Z_ROT=${req.query.POS_Z_ROT}*1000
		//			WHERE FIXTURE_ID='${req.query.ID}' AND  PALLET_ID='${req.query.POS_PLANT}' ;`
		//}
		 
		log.info('query ' + query);

		var request = new sql.Request();
        					
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

// QUIRK STORICO (documentato, NON riparare — ha consumatori: FixtureOnPallet.vue
// serializza l'intera fixture con URLSearchParams): il pallet arriva nel campo
// POS_PLANT e la fixture nel campo ID. Quindi PALLET_ID=POS_PLANT e
// FIXTURE_ID=ID non sono errori di mappatura ma il contratto di fatto.
// L'insert nuovo qui sotto accetta anche i nomi espliciti PALLET_ID/FIXTURE_ID.
router.get('/updateFixtureOnPallet', (req, res) => {

	//console.log(">>>"+JSON.stringify(req.query,null,4));

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updateFixture: " + err);
            return;
        }

		let query =`UPDATE FIXTURE_ON_PALLET SET 
					PALLET_ID=${req.query.POS_PLANT}, 
					FIXTURE_ID=${req.query.ID}, 
					POS_X=${req.query.POS_X}*1000, 
					POS_Y=${req.query.POS_Y}*1000,  
					POS_Z=${req.query.POS_Z}*1000, 
					POS_X_CORR=${req.query.POS_X_CORR}*1000, 
					POS_Y_CORR=${req.query.POS_Y_CORR}*1000, 
					POS_Z_CORR=${req.query.POS_Z_CORR}*1000, 
					POS_X_ROT=${req.query.POS_X_ROT}*1000, 
					POS_Y_ROT=${req.query.POS_Y_ROT}*1000, 
					POS_Z_ROT=${req.query.POS_Z_ROT}*1000
					WHERE FIXTURE_ID='${req.query.ID}' AND  PALLET_ID='${req.query.POS_PLANT}' ;`
		
		 
		log.info('query ' + query);

		var request = new sql.Request();
        					
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

// Cantiere Attrezzaggi (U-FASE2): endpoint INSERT che mancava — la view
// FixtureOnPallet in creazione chiamava insertFixtureOnPallet e riceveva la
// 400 del catch-all (l'associazione nasceva solo a mano nel DB).
// Parametri: nomi espliciti PALLET_ID/FIXTURE_ID per i consumatori nuovi,
// fallback sul quirk storico POS_PLANT/ID (vedi updateFixtureOnPallet sopra)
// cosi' la form esistente funziona senza modifiche. POS_X/Y/Z not null:
// default 0 se assenti, come CORR e ROT; quote in micron come l'update (*1000).
router.get('/insertFixtureOnPallet', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertFixtureOnPallet: " + err);
            return;
        }

		const palletID  = parseInt(req.query.PALLET_ID  != undefined ? req.query.PALLET_ID  : req.query.POS_PLANT);
		const fixtureID = parseInt(req.query.FIXTURE_ID != undefined ? req.query.FIXTURE_ID : req.query.ID);
		if (isNaN(palletID) || isNaN(fixtureID)) {
			log.error("err insertFixtureOnPallet: PALLET_ID/FIXTURE_ID mancanti o non numerici");
			res.send("KO");
			return;
		}
		const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

		var request = new sql.Request();
		let query = `INSERT INTO FIXTURE_ON_PALLET
					(PALLET_ID, FIXTURE_ID, POS_X, POS_Y, POS_Z, POS_X_CORR, POS_Y_CORR, POS_Z_CORR, POS_X_ROT, POS_Y_ROT, POS_Z_ROT)
					VALUES(${palletID},
					${fixtureID},
					${num(req.query.POS_X)}*1000,
					${num(req.query.POS_Y)}*1000,
					${num(req.query.POS_Z)}*1000,
					${num(req.query.POS_X_CORR)}*1000,
					${num(req.query.POS_Y_CORR)}*1000,
					${num(req.query.POS_Z_CORR)}*1000,
					${num(req.query.POS_X_ROT)}*1000,
					${num(req.query.POS_Y_ROT)}*1000,
					${num(req.query.POS_Z_ROT)}*1000);`

        log.info('query ' + query);
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
router.get('/insertFixture', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertFixture: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `INSERT INTO FIXTURE
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
    console.log('delete FIXTURE '+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete fixture: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `DELETE FROM Fixture WHERE ID=${req.params.ID};`
					
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