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


//TODO:da testare
router.delete('/:ID', (req, res) => {
    //console.log('delete GRATING '+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete grating: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `DECLARE @tray as INTEGER;
                     DECLARE @name as varchar(100);
                     SET @name = (select name from grating where id=${req.params.ID});
                     SET @tray = (select floor_mag from tray where FAMILY like concat(@name,'%'));
                     UPDATE TRAY SET STATUS=2, FAMILY='' WHERE FAMILY like concat(@name,'%');
                     DELETE FROM [POSITION] WHERE parent like concat('TRAY_',@tray,' %');
                     DELETE FROM GRATING WHERE ID=${req.params.ID};`
        
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