//////// HMI ////////
var express = require('express');
const DBf 	= require('./DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('./LogFunct');

var templatePATH = '.';

router.get('/show/all', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        // (6/10) prima: log non era definito (require commentato, e col
        // percorso sbagliato), il throw finiva nella callback e la richiesta
        // restava appesa. Ora 500 e riga nel log, come gli altri router.
        if (err) {
            log.error("err alarm show/all: " + err);
            res.status(500).send("error DB");
            return;
        }
		
		// le ultime 50 righe di allarme. (6/10) Si ordina sulla COLONNA
		// LOG.data: "order by Timestamp" ordinava sull'alias testuale
		// "dd/MM/yyyy ...", cioe' per giorno del mese, e il top 50 prendeva
		// le righe sbagliate. HH: ora a 24 (hh e' a 12, senza AM/PM).
		// Timestamp resta una stringa, stesso formato.
		let query=`select top 50 FORMAT(data, 'dd/MM/yyyy HH:mm:ss', 'it-IT') AS 'Timestamp',descr from LOG where UNIT_B like 'ALARM%' order by LOG.data desc`
		
		// create Request object
        var request = new sql.Request();
					
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("err alarm show/all query: " + err);
                res.status(500).send("error DB")
            }else
				res.send(recordset.recordset)
        });
    })
})

module.exports = router;