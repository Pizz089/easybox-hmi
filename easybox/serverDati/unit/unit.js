//////// HMI ////////
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('../LogFunct');

var templatePATH = '.';

router.get('/show/:name', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getUnitData: " + err);
            return;
        }

		let query=`select * from UNIT_STATUS;` 
		if (String(req.params.name)!="all") 
			query=`select * from UNIT_STATUS where unit like '${req.params.name}';`
		
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

module.exports = router;
