//////// HMI ////////
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
const errorCodes = require('../errorCodes');
var router 	= express.Router();
const log 	= require('../LogFunct');

var templatePATH = '.';

router.get('/show/:ID', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err show grating data: " + err);
            return;
        }
		
		//se pos_mag>1000 sono gli uncini
		let query=`select * from GRATING;`
		if (String(req.params.ID)!="all") 
			query=`select * from GRATING where id='${req.params.ID}';`
		
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

//usata dalla pagina gratingView
router.get('/showCompleteData/:ID', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err show grating data: " + err);
            return;
        }
		
		//se pos_mag>1000 sono gli uncini
		let query=`select g.ID,g.NAME,g.DESCR, g.SAFEX, g.SAFEY ,
					t.id as TRAY_ID,t.FLOOR_MAG , t.MAG,gr.FAMILY as GRIPPER_DESC,p.FAMILY AS PIECE_ID, t.STATUS as TraySTATUS
					from GRATING g
					left join tray t on g.TRAY_ID=t.id
					left join gripper gr on g.GRIPPER_ID =gr.id
					left join PIECE p on g.PIECE_ID =p.id
					order by t.FLOOR_MAG desc`
		if (String(req.params.ID)!="all") 
			query=`select g.ID,g.NAME,g.DESCR, g.SAFEX, g.SAFEY ,
					t.FLOOR_MAG as TRAY_ID,t.MAG,gr.POS_MAG as GRIPPER_ID,p.FAMILY AS PIECE_ID 
					from GRATING g
					left join tray t on g.TRAY_ID=t.id
					left join gripper gr on g.GRIPPER_ID =gr.id
					left join PIECE p on g.PIECE_ID =p.id 
					where id='${req.params.ID}';`
		
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

router.get('/updateGrating', (req, res) => {

	//console.log(">>>"+JSON.stringify(req,null,4));
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err update Grating: " + err);
            return;
        }

		//console.log("---"+JSON.stringify(req.query,null,4));
		
        // create Request object
        var request = new sql.Request();

        let query = `UPDATE GRATING SET
					DESCR='${req.query.DESCR}', 
					TRAY_ID=${req.query.TRAY_ID},
					GRIPPER_ID=${req.query.GRIPPER_ID}, 
					PIECE_ID=${req.query.PIECE_ID},
					SAFEX=${req.query.SAFEX}, 
					SAFEY=${req.query.SAFEY}, 
					NAME='${req.query.NAME}'
					where ID=${req.query.ID};`
					
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

router.get('/downloadModelSVG', (req, res) => {
	//createModel()
	console.log("name: "+req.query.name)
	res.download(`./GRATING_MODEL/${req.query.name}.svg`)
})

//TODO:da testare
router.get('/insertGrating', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertGrating: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `INSERT INTO GRATING
					(NAME, DESCR, TRAY_ID, GRIPPER_ID, PIECE_ID, SAFEX, SAFEY)
					VALUES( 
					'${req.query.NAME}', 
					'${req.query.DESCR}', 
					${req.query.TRAY_ID}, 
					${req.query.GRIPPER_ID}, 
					${req.query.PIECE_ID}, 
					${req.query.SAFEX}, 
					${req.query.SAFEY});`
					
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
    //console.log('delete GRATING '+req.params.ID);
	// (tray-parent-predicate) ID validato a intero: niente param raw in query.
	// La route ora RISPONDE sempre (prima i res.send erano commentati e il
	// fetch della HMI restava appeso).
	const gratingId = Number(req.params.ID);
	if (!Number.isInteger(gratingId) || gratingId < 1) { res.send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete grating: " + err);
            res.send("KO");
            return;
        }

		var request = new sql.Request();
		// Predicato tasche = canone dell'helper trayParent (PARENT = 'TRAY_<n>',
		// uguaglianza: l'nchar paddato ignora gli spazi finali, niente jolly
		// '_' del LIKE); qui il numero cassetto e' noto solo in SQL (@tray),
		// quindi il canone e' riprodotto con CONCAT. @tray NULL (nessun
		// cassetto associato) -> CONCAT = 'TRAY_' e non matcha nulla.
		// Guardia ordine attivo PRIMA di qualunque scrittura (vincolo di
		// sicurezza): con ordine WORKORDERS.STATUS=3 sul cassetto non si
		// tocca ne' TRAY ne' POSITION ne' GRATING.
        let query = `SET NOCOUNT ON;
                     DECLARE @tray as INTEGER;
                     DECLARE @name as varchar(100);
                     SET @name = (select name from grating where id=${gratingId});
                     SET @tray = (select floor_mag from tray where FAMILY like concat(@name,'%'));
                     IF EXISTS (SELECT 1 FROM [POSITION] p JOIN WORKORDERS w ON w.ID = p.Order_ID WHERE p.PARENT = CONCAT('TRAY_', @tray) AND w.STATUS = 3)
                         SELECT '${errorCodes.KO_ACTIVE_ORDER}' AS ris;
                     ELSE BEGIN
                         UPDATE TRAY SET STATUS=2, FAMILY='' WHERE FAMILY like concat(@name,'%');
                         DELETE FROM [POSITION] WHERE PARENT = CONCAT('TRAY_', @tray);
                         DELETE FROM GRATING WHERE ID=${gratingId};
                         SELECT 'OK' AS ris;
                     END`

        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, result) {
            if (err) {
                log.error("Err query: " + err)
                res.send("KO")
            }else
				res.send(result.recordset && result.recordset[0] ? result.recordset[0].ris : "KO")
        });
	});
});

//usato solo per la pagina di importGrating (grigliato dal vero)
router.get('/showFromTray/:Tray_ID', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err show grating data: " + err);
            return;
        }
		
		//se pos_mag>1000 sono gli uncini
		let query=`select * from GRATING where name in (select family from tray)`
		
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

router.post('/saveModel/:model_name', (req, res) => {
	const { DOMParser, XMLSerializer } = require('xmldom');
	const fs = require('fs');

	//i dati serializzati arrivano all'endpoint
	const xmlString = req.body.xml
	
	// Parse
	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

	//elimino <g id="limits" la segnalazione dei limiti di sicurezza dal bordo del cassetto
	let elementi = xmlDoc.getElementsByTagName('g');
	for (let i = elementi.length - 1; i >= 0; i--) {
	  if (elementi[i].getAttribute('id') === 'limits') {
		elementi[i].parentNode.removeChild(elementi[i]);
	  }
	}
	//elimino lo sfondo grigio del cassetto (id="tray")
	elementi = xmlDoc.getElementsByTagName('rect');
	for (let i = elementi.length - 1; i >= 0; i--) {
	  if (elementi[i].getAttribute('id') === 'tray') {
		elementi[i].parentNode.removeChild(elementi[i]);
	  }
	}
	// Serializza e salva
	const serializer = new XMLSerializer();
	const nuovoXml = serializer.serializeToString(xmlDoc);
	
	fs.writeFileSync(process.env.Grating_model_dir+req.params.model_name+".svg", nuovoXml);
	
	res.send("ok")
});

module.exports = router;