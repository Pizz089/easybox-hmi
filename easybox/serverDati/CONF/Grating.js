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
		
		// (grating-model) il grigliato e' un MODELLO: i cassetti che lo usano
		// si leggono da TRAY.FAMILY = GRATING.NAME (uguaglianza; GRATING.TRAY_ID
		// non si usa piu'). UNA riga per coppia grigliato-cassetto (N cassetti
		// possono usare lo stesso modello; senza cassetti: colonne TRAY NULL).
		// La pagina aggrega per g.ID.
		let query=`select g.ID,g.NAME,g.DESCR, g.SAFEX, g.SAFEY ,
					t.id as TRAY_ID,t.FLOOR_MAG , t.MAG,gr.FAMILY as GRIPPER_DESC,p.FAMILY AS PIECE_ID, t.STATUS as TraySTATUS
					from GRATING g
					left join tray t on t.FAMILY = g.NAME
					left join gripper gr on g.GRIPPER_ID =gr.id
					left join PIECE p on g.PIECE_ID =p.id
					order by g.ID, t.FLOOR_MAG`
		if (String(req.params.ID)!="all")
			query=`select g.ID,g.NAME,g.DESCR, g.SAFEX, g.SAFEY ,
					t.FLOOR_MAG as TRAY_ID,t.MAG,gr.POS_MAG as GRIPPER_ID,p.FAMILY AS PIECE_ID
					from GRATING g
					left join tray t on t.FAMILY = g.NAME
					left join gripper gr on g.GRIPPER_ID =gr.id
					left join PIECE p on g.PIECE_ID =p.id
					where g.id='${req.params.ID}';`
		
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

		// (grating-model) SOLO header: nessuna tasca e nessun TRAY toccati qui
		// (l'associazione vive in CONF/Tray.js associateGrating). TRAY_ID
		// scritto a 0: colonna morta. NAME e' la chiave del legame TRAY.FAMILY:
		// un RINOMINO viene propagato ai cassetti che usano il modello nella
		// stessa transazione; nome gia' usato da un ALTRO grigliato -> KO_DUP_NAME.
		const gratingId = Number(req.query.ID);
		if (!Number.isInteger(gratingId) || gratingId < 1) { res.send("KO_BAD_INPUT"); return; }
        let query = `SET NOCOUNT ON; SET XACT_ABORT ON;
					DECLARE @old varchar(100) = (SELECT NAME FROM GRATING WHERE ID=${gratingId});
					DECLARE @new varchar(100) = '${req.query.NAME}';
					IF @old IS NULL SELECT 'KO_BAD_INPUT' AS ris;
					ELSE IF EXISTS (SELECT 1 FROM GRATING WHERE NAME=@new AND ID<>${gratingId}) SELECT '${errorCodes.KO_DUP_NAME}' AS ris;
					ELSE BEGIN
						BEGIN TRAN;
						UPDATE GRATING SET
							DESCR='${req.query.DESCR}',
							TRAY_ID=0,
							GRIPPER_ID=${req.query.GRIPPER_ID},
							PIECE_ID=${req.query.PIECE_ID},
							SAFEX=${req.query.SAFEX},
							SAFEY=${req.query.SAFEY},
							NAME=@new
							where ID=${gratingId};
						IF @old <> @new UPDATE TRAY SET FAMILY=@new WHERE FAMILY=@old;
						COMMIT TRAN;
						SELECT 'OK' AS ris;
					END`

        log.info('query ' + query);
		//log.standard('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, result) {

            if (err) {
                log.error("Err query: " + err)
                res.send("KO")
            }else
				res.send(result.recordset && result.recordset[0] ? result.recordset[0].ris : "KO")
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
		// (grating-model) il grigliato nasce come MODELLO: nessun cassetto
		// (TRAY_ID=0, colonna morta), nessuna tasca. Nome unico: e' la chiave
		// del legame TRAY.FAMILY.
        let query = `SET NOCOUNT ON;
					IF EXISTS (SELECT 1 FROM GRATING WHERE NAME='${req.query.NAME}') SELECT '${errorCodes.KO_DUP_NAME}' AS ris;
					ELSE BEGIN
						INSERT INTO GRATING
						(NAME, DESCR, TRAY_ID, GRIPPER_ID, PIECE_ID, SAFEX, SAFEY)
						VALUES(
						'${req.query.NAME}',
						'${req.query.DESCR}',
						0,
						${req.query.GRIPPER_ID},
						${req.query.PIECE_ID},
						${req.query.SAFEX},
						${req.query.SAFEY});
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
		// (grating-model) si cancella SOLO il modello. Se almeno un cassetto
		// lo usa (TRAY.FAMILY = NAME, uguaglianza) -> KO_IN_USE: prima si
		// dissociano i cassetti dalla gestione cassetti (che cancella le
		// tasche con le sue guardie). Niente piu' cascata su TRAY/POSITION.
        let query = `SET NOCOUNT ON;
                     DECLARE @name as varchar(100);
                     SET @name = (select name from grating where id=${gratingId});
                     IF @name IS NULL SELECT 'KO_BAD_INPUT' AS ris;
                     ELSE IF EXISTS (SELECT 1 FROM TRAY WHERE FAMILY = @name)
                         SELECT '${errorCodes.KO_IN_USE}' AS ris, (SELECT COUNT(*) FROM TRAY WHERE FAMILY = @name) AS n;
                     ELSE BEGIN
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

// Grigliato (modello) associato a UN cassetto: :Tray_ID = numero piano
// (FLOOR_MAG). Usato da layoutView (grigliato importato dal vero, Part_Type 0).
// (grating-model) prima ignorava il parametro e tornava TUTTI i grigliati
// associati a un cassetto qualsiasi (con un solo cassetto era indistinguibile).
router.get('/showFromTray/:Tray_ID', (req, res) => {
	const floor = Number(req.params.Tray_ID);
	if (!Number.isInteger(floor) || floor < 1 || floor > 12) { res.send("KO_BAD_INPUT"); return; }

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err show grating data: " + err);
            return;
        }

		let query=`select g.* from GRATING g where g.NAME = (select TOP 1 FAMILY from TRAY where FLOOR_MAG=${floor})`
		
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