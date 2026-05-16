//////// HMI ////////
var express = require('express');
const DBf 	= require('./DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
//const log 	= require('../LogFunct');

var templatePATH = '.';

router.get('/show/all', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getGripperData: " + err);
            return;
        }
		
		//se pos_mag>1000 sono gli uncini
		let query=`select top 50 FORMAT(data, 'dd/MM/yyyy hh:mm:ss', 'it-IT') AS 'Timestamp',descr from LOG where UNIT_B like 'ALARM%' order by Timestamp desc`
		
		// create Request object
        var request = new sql.Request();
					
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                res.send("error DB")
            }else
				res.send(recordset.recordset)
        });
    })
})

module.exports = router;