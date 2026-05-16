//////// HMI ////////
var express = require('express');
const DBf 	= require('./DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('./LogFunct');

var templatePATH = '.';

//elenco dei tipi di approcci
router.get('/approachList', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err approachList: " + err);
            return;
        }

		let query = `select * from _APPROACH_TYPE;`
		
		var request = new sql.Request();
        					
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

//elenco TIPOPEZZO
router.get('/typePartList', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err typePartList: " + err);
            return;
        }

		let query = `select * from PIECE;`
		
		var request = new sql.Request();
        					
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