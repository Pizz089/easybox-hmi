//////// HMI ////////
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('../LogFunct');
const ERR 	= require('../errorCodes');

var templatePATH = '.';

// AD (R3): guard anti-sovrapposizione per il magazzino pallet, da
// appendere alla STESSA query di update/insert (controllo atomico, non
// lettura separata): niente scrittura se MAG_POS>0 e' gia' occupata da
// un ALTRO pallet o disabilitata ([POSITION] WPALLET STATUS=9).
// Il PLC non passa da questi endpoint (scrive direttamente sul DB):
// zero impatto sul ciclo. excludeID='' per gli insert.
function palletSlotGuard(magPos, excludeID) {
	const idFilter = excludeID !== '' ? ` and p2.ID<>${excludeID}` : '';
	return ` NOT EXISTS (select 1 from PALLET p2 where p2.MAG_POS=${magPos}${idFilter})
			 AND NOT EXISTS (select 1 from [POSITION] where PARENT like 'WPALLET%' and SUB_POS=${magPos} and STATUS=9)`;
}

// Diagnosi POST-HOC del rifiuto (solo per il messaggio: l'atomicita' la
// garantisce il guard nella query di scrittura).
function palletSlotReason(magPos, excludeID, cb) {
	const idFilter = excludeID !== '' ? ` and p2.ID<>${excludeID}` : '';
	let check = `select
		(select count(*) from PALLET p2 where p2.MAG_POS=${magPos}${idFilter}) as occ,
		(select count(*) from [POSITION] where PARENT like 'WPALLET%' and SUB_POS=${magPos} and STATUS=9) as dis;`
	new sql.Request().query(check, function (err, rs) {
		if (err || rs.recordset.length == 0) { cb("KO"); return; }
		if (rs.recordset[0].occ > 0) { cb(ERR.KO_OCCUPIED); return; }
		if (rs.recordset[0].dis > 0) { cb(ERR.KO_DISABLED); return; }
		cb("KO");
	});
}

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

		// AD (R3): guard nella STESSA UPDATE quando si scrive una posizione
		// di magazzino (MAG_POS>0); -1/0 (fuori/non piazzato) passano liberi.
		const magPos = parseInt(req.query.MAG_POS);
		const palletID = parseInt(req.query.ID);
		const guarded = !isNaN(magPos) && magPos > 0 && !isNaN(palletID);

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
					WHERE ID='${req.query.ID}'`
		if (guarded)
			query += ` AND ${palletSlotGuard(magPos, palletID)}`;
		query += ';'

		var request = new sql.Request();

        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, result) {
            if (err) {
                log.error("Err query: " + err)
                res.send("KO")
				return;
            }
			const n = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
			if (n > 0 || !guarded) {
				res.send(n > 0 ? "OK" : "KO")
				return;
			}
			// 0 righe col guard attivo: distingui il motivo per il client
			palletSlotReason(magPos, palletID, code => res.send(code));
		});
	});
})

router.get('/insertPallet', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertPallet: " + err);
            return;
        }
		
		// AD (R3): stesso guard dell'update, in forma INSERT..SELECT..WHERE
		// (scrittura condizionale atomica). excludeID vuoto: nessun pallet
		// da escludere in creazione.
		const magPos = parseInt(req.query.MAG_POS);
		const guarded = !isNaN(magPos) && magPos > 0;

		var request = new sql.Request();
        let query = `INSERT INTO PALLET (FAMILY, DESCR, X, Y, Z, X_CORR, Y_CORR, Z_CORR, MAG, MAG_POS, POS_PLANT)
					 SELECT '${req.query.FAMILY}',
							'${req.query.DESCR}',
							${req.query.X},
							${req.query.Y},
							${req.query.Z},
							${req.query.X_CORR},
							${req.query.Y_CORR},
							${req.query.Z_CORR},
							${req.query.MAG},
							${req.query.MAG_POS},
							${req.query.POS_PLANT}`
		if (guarded)
			query += ` WHERE ${palletSlotGuard(magPos, '')}`;
		query += ';'

        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, result) {
            if (err) {
                log.error("Err query: " + err)
                res.send("KO")
				return;
            }
			const n = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
			if (n > 0 || !guarded) {
				res.send(n > 0 ? "OK" : "KO")
				return;
			}
			palletSlotReason(magPos, '', code => res.send(code));
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