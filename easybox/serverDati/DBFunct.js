"use strict";
var sql 		 = require('mssql')
const log 		 = require('./LogFunct');
const { Server } = require('socket.io');

const configDB= { 
	user: 'plc',
	password: 'plc',
	server: '127.0.0.1\\SQLEXPRESS' , 
	database: 'ADMG', 
	connectionTimeout: 5000, 
	options: {
		encrypt:false   
	} 
} 

exports.io = new Server(3000,{cors:{ origin:'*', credentials:true }});
//module.exports=configDB;

exports.configDB=configDB;

exports.insertWorkOrder = function (workorder,program, quantity, cb) {
    sql.connect(configDB, function (err) {
        if (err) {
            log.error("err insertWorkOrder: " + err);
            return;
        }

        // create Request object
        var request = new sql.Request();

        let query = `INSERT INTO workOrder
					(workOrder, program, quantity)
					VALUES('${workorder}', '${program}', ${quantity});`
					
        log.info('query ' + query);
		//log.standard('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {

            if (err) {
                log.error("Err query: " + err)
                cb("KO")
            }else
				cb("OK")
        });
    })
}

exports.getWorkOrders = function (cb) {
    sql.connect(configDB, function (err) {
        if (err) {
            log.standard("err: " + err);
            return;
        }

        //create Request object
        var request = new sql.Request();

        let query = `SELECT * from workOrder ;`;
		
		request.query(query, function (err, recordset) {

            if (err) {
                log.standard("Err query: " + err)
                return
            }
            //log.standard(JSON.stringify(recordset.recordset[0], null, 4));
           if (recordset.recordset[0] != undefined) {
               cb(recordset.recordset)
           }
        });
	});
}

exports.getWorkOrder = function (workOrder, cb) {
    sql.connect(configDB, function (err) {
        if (err) {
            log.standard("err: " + err);
            return;
        }

        //create Request object
        var request = new sql.Request();

        let query = `SELECT TOP 1 * from workOrder where workOrder='${workOrder}';`;
		
		log.standard("query: "+query);
		
		request.query(query, function (err, recordset) {

            if (err) {
                log.standard("Err query: " + err)
                return
            }
            log.standard(JSON.stringify(recordset.recordset[0], null, 4));
           if (recordset.recordset[0] != undefined) {
               cb(recordset.recordset[0])
           }else
			   cb(null)
        });
	});
}

exports.deleteWorkOrder = function (workorder) {
    sql.connect(configDB, function (err) {
        if (err) {
            log.standard("err deleteWorkOrder: " + err);
            return;
        }

        // create Request object
        var request = new sql.Request();

        let query = `DELETE FROM workOrder WHERE workOrder='${workorder}';`
					
        //log.standard('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {

            if (err) {
                log.standard("Err query: " + err)
                return false
            }else
				return true
        });
    })
}

// TODO_DEADCODE: getWorkOrderLogs è chiamato solo da HMI.js e REST.js,
//                entrambi router non montati in server.js (HMI.js mai usato in app.use,
//                REST.js commentato in server.js:65). Inoltre interroga la tabella `pinza`
//                (probabile copia-incolla errato: pinza è la tabella gripper).
//                Da rimuovere dopo verifica DB. Decisione presa in sessione di refactor maggio 2026.
exports.getWorkOrderLogs = function (refineSearch, cb) {
    sql.connect(configDB, function (err) {
        if (err) {
            log.standard("err: " + err);
            return;
        }
		
		//log.standard(JSON.stringify(refineSearch, null, 4));

        //create Request object
        var request = new sql.Request();

        let query = `SELECT * from pinza `;
		let subQuery = "";
		
		if (refineSearch.fromDate!=null){
			subQuery+=`where start>='${refineSearch.fromDate}' `;
		}
		if (refineSearch.toDate!=null){
			if (subQuery.length>0){
				subQuery+=`AND `
			}else
				subQuery+=`where `
			subQuery+=`stop<='${refineSearch.toDate}' `;
		}
		if (refineSearch.side!=null){
			if (subQuery.length>0){
				subQuery+=`AND `
			}else
				subQuery+=`where `
			subQuery+=`side='${refineSearch.side}' `
		}
		if (refineSearch.workOrder!=null){
			if (subQuery.length>0){ 
				subQuery+=`AND `
			}else
				subQuery+=`where `
			subQuery+=`workOrder='${refineSearch.workOrder}' `
		}
		if (refineSearch.program!=null){
			if (subQuery.length>0){
				subQuery+=`AND `
			}else
				subQuery+=`where `
			subQuery+=`program='${refineSearch.program}' `
		}
		
		log.info("query: "+query+subQuery+";");
		
		request.query(query+subQuery+";", function (err, recordset) {
		
            if (err) {
                log.standard("Err query: " + err)
                return
            }
            //log.standard(JSON.stringify(recordset.recordset[0], null, 4));
           if (recordset.recordset[0] != undefined) {
               cb(recordset.recordset)
           }else
			   cb(null)
        });
	});
}

exports.date = function (cb) {
    sql.connect(configDB, function (err) {
        if (err) {
            log.standard("err: " + err);
            return;
        }

        //create Request object
        var request = new sql.Request();

        let query = `SELECT getdate() as dd;`;
		
		request.query(query, function (err, recordset) {

            if (err) {
                log.standard("Err query: " + err)
                return
            }
            //log.standard(JSON.stringify(recordset.recordset[0], null, 4));
           if (recordset.recordset[0] != undefined) {
               cb(recordset.recordset[0])
           }
        });
	});
}

///////////// CONF
exports.getGripperData = function (gripperID, cb) {
	sql.connect(configDB, function (err) {
        if (err) {
            log.error("err getGripperData: " + err);
            return;
        }
        // create Request object
        var request = new sql.Request();
        let query = `select * from pinza where id='${gripperID}'`
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                cb("error DB")
            }else
				cb(recordset)
        });
    })
}

exports.updateGripper = function (gripperData, cb) {
    sql.connect(configDB, function (err) {
        if (err) {
            log.error("err insertStartJob: " + err);
            return;
        }

		//console.log("---"+JSON.stringify(gripperData,null,4));

        // create Request object
        var request = new sql.Request();

        let query = `UPDATE PINZA
					SET FAMIGLIA='${gripperData.family}', 
					DESCR='${gripperData.description}', 
					X_BODY='${gripperData.bodyX}', 
					Y_BODY='${gripperData.bodyY}', 
					Z_BODY='${gripperData.bodyZ}', 
					X_CHELE='${gripperData.chelaX}', 
					Y_CHELE='${gripperData.chelaY}', 
					Z_CHELE='${gripperData.chelaZ}', 
					STATO='${gripperData.stato}',
					POS_IN_MAGAZZINO='${gripperData.posMag}', 
					SUB_POSIZIONE=0, 
					POS_IN_IMPIANTO='${gripperData.posPlant}'
					where ID='${gripperData.id}';`
					
        log.info('query ' + query);
		//log.standard('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {

            if (err) {
                log.error("Err query: " + err)
                cb("KO")
            }else
				cb("OK")
		});
    })
}
