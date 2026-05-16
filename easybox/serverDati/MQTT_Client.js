//const unit  = require('./unit/unit');
var sql 	= require('mssql')
const DBf 	= require('./DBFunct');
const log 	= require('./LogFunct');
const mqtt 	= require("mqtt");
var HEIDENHAIN		= require('./CN/HEIDENHAIN');
const diag			= require('./MQTTDiag');

//const client = mqtt.connect("mqtt://172.20.70.111");
const client = mqtt.connect("mqtt://HMI:HMI@127.0.0.1:9001",
							{clientId:'API_' + Math.random().toString(16).substr(2, 8),qos:2});

client.on('error', function (err){
	DBf.io.emit('PLC/ALARM/GENERIC', 'Impossible to connect to broker!    ['+err+']');
	// Topic con prefisso "_" indicano eventi interni del backend,
	// non topic MQTT reali. Convenzione interna del diag.
	try {
		const payloadStr = String(err);
		diag.publish({
			ts: Date.now(),
			dir: "IN",
			topic: "_BROKER/ERROR",
			payload: payloadStr,
			source: "BACKEND",
			size: Buffer.byteLength(payloadStr)
		});
	} catch (_) {}
});

// Lifecycle broker (sessione di refactor maggio 2026):
// flag `reconnectLogged` evita lo spam emettendo solo il primo reconnect dopo
// un close, fino a un nuovo connect o nuovo close. Allineato con la convenzione
// "_" per topic interni backend già introdotta in _BROKER/ERROR.
let reconnectLogged = false;
const BROKER_URL_DISPLAY = `${client.options.protocol}://${client.options.hostname}:${client.options.port}`;

client.on('connect', function () {
	reconnectLogged = false;
	try {
		const payloadStr = "connected to " + BROKER_URL_DISPLAY;
		diag.publish({
			ts: Date.now(),
			dir: "IN",
			topic: "_BROKER/CONNECT",
			payload: payloadStr,
			source: "BACKEND",
			size: Buffer.byteLength(payloadStr)
		});
	} catch (_) {}
});

client.on('close', function () {
	reconnectLogged = false;
	try {
		const payloadStr = "disconnected";
		diag.publish({
			ts: Date.now(),
			dir: "IN",
			topic: "_BROKER/CLOSE",
			payload: payloadStr,
			source: "BACKEND",
			size: Buffer.byteLength(payloadStr)
		});
	} catch (_) {}
});

client.on('reconnect', function () {
	if (reconnectLogged) return;
	reconnectLogged = true;
	try {
		const payloadStr = "attempting reconnect";
		diag.publish({
			ts: Date.now(),
			dir: "IN",
			topic: "_BROKER/RECONNECT",
			payload: payloadStr,
			source: "BACKEND",
			size: Buffer.byteLength(payloadStr)
		});
	} catch (_) {}
});

//server lanciato cosi: mosquitto -p 1883 -v -c mosquitto.conf
//client.publish("HMI/updateStatus/MC", "Working");


client.subscribe({'FROM_PLANT/#':{qos:2, retain:true}}) 
				 		
//GESTIONE PLC => HMI						
client.on('message', function (topic, message) {
	log.standard("ricevo MQTT: "+topic+":\t"+message.toString().trim())
	try {
		const payloadStr = message.toString();
		diag.publish({
			ts: Date.now(),
			dir: "IN",
			topic: topic,
			payload: payloadStr,
			source: "PLC",
			size: Buffer.byteLength(payloadStr)
		});
	} catch (_) {}

	let param = topic.toUpperCase().trim().split("/");   
	if (param[0] !="FROM_PLANT") 
		return;
		
	if (param[1] =="LOG") {			
		if (param[2] == "QUERY"){	//es: FROM_PLANT/LOG/QUERY
			insertLog( message.toString(), 'PLC', 'QUERY' )
			return;
		}
		if (param[2] == "MISSION"){	//es: FROM_PLANT/LOG/MISSION/<UNIT>
			insertLog( 'MISSION: '+message.toString(), 'PLC', param[3] )
			return;
		}	
	}
	if (param[1] =="ALARM") {		//es: FROM_PLANT/ALARM
		insertLog( message.toString(), 'PLC', 'ALARM' )
		DBf.io.emit('PLC/ALARM/ROBOT', message.toString())
		return;
	}
	if (param[1] =="DISPATCH") {  	//es: FROM_PLANT/DISPATCH/<unit>/<numeroDispatch>
		//insertLog( message.toString(), 'PLC', 'DISPATCH' )
		let obj = {};
		obj.unit = param[2];
		obj.dispatch = param[3];
		obj.value = message.toString()
		DBf.io.emit('DISPATCH', obj);
		
		//insertLog( 'DISPATCH['+param[3]+']='+message.toString().trim(), 'DISPATCH ',param[2] )
		return;
	}
	if (param[1] == "ROBOT" && param[2] == "NEWQUOTA"){	//es: FROM_PLANT/ROBOT/NEWQUOTA		
		insertLog( message.toString().trim(), 'PLC', 'NEWQUOTA' )
		return;
	}
	if (param[1] == "ROBOT" && param[2] == "CHANGESPEED"){	//es: FROM_PLANT/ROBOT/CHANGESPEED
		insertLog("NEW SPEED IS "+message.toString().trim(), 'ROBOT', 'CHGSPEED' )
		DBf.io.emit('ROBOT/CHANGESPEED', message.toString())
		return;
	}
	
	if (param[2] == "ROBOT"){
		switch (param[1]){  
			case "STATUS":		//es: FROM_PLANT/STATUS/ROBOT
				setStatusOnDB('ROBOT',message.toString())
				DBf.io.emit('ROBOT/STATUS', message.toString())
				insertLog( "STATUS " + getStatus(message.toString()), 'PLC', 'ROBOT' )
				break;
			case "DESCR":		//es: FROM_PLANT/DESCR/ROBOT
				setDescrOnDB('ROBOT',message.toString())
				DBf.io.emit('ROBOT/DESCR', message.toString())
				break;
			case 'PART':		//es: FROM_PLANT/PART/ROBOT/SUBPOS/<SUBPOS>
				setPieceOnGripper(message.toString(), param[4])
				//DBf.io.emit('ROBOT/GRIPPER/'+param[4], message.toString())
				DBf.io.emit('ROBOT/UPDATEGRIPPER')
				break;
			case 'GRIPPER':		//es.: FROM_PLANT/GRIPPER/ROBOT
				insertLog( "GRIPPER ON ROBOT ID="+message.toString(), 'PLC', 'ROBOT' )
				DBf.io.emit('ROBOT/UPDATEGRIPPER')
				break;
			case 'CMD_MAN':
				break;
			default:
				log.standard("UNKNOWN: "+topic.toString()+":\t"+message.toString())	
		}
	}
	if (param[2] == "MC1"){
		switch (param[1]){  
			case "STATUS":		//FROM_PLANT/STATUS/MC1
				setStatusOnDB('MC1',message.toString())
				DBf.io.emit('MC1/STATUS', message.toString())
				insertLog( "STATUS "+message.toString(), 'PLC', 'MC1' )
				DBf.io.emit('PRODUCTION/CHANGED')  //aggiorno la tabella di produzione
				break;
			case "ALARM":		//FROM_PLANT/ALARM/MC1 -> REQ_MODE_MANUAL
				DBf.io.emit('PLC/ALARM/GENERIC', message.toString())
				break;
			case 'DESCR':
				setDescrOnDB('MC1',message.toString())
				DBf.io.emit('MC1/DESCR', message.toString())
				break;
			case 'PART':
				break;
			case 'CMD_MAN':
				break;
			case 'STARTPP': {	//FROM_PLANT/STARTPP/MC1
				// Sanity check multi-CNC (N4-1, sessione di refactor maggio 2026):
				// STARTPP è il topic legacy del PLC per Heidenhain. Se la macchina è
				// configurata HAAS, il PLC dovrebbe usare TO_PLANT/HAAS_CMD/MC1 con
				// payload JSON. Configurazione incoerente → segnala nel diag e ignora,
				// per evitare di triggerare il driver sbagliato.
				const cnType = getCnType(1);
				if (cnType !== 'heidenhain') {
					try {
						const payloadStr = "PLC ha pubblicato STARTPP/MC1 ma CN_TYPE_MC1='" + cnType + "' — ignorato (atteso HAAS_CMD)";
						diag.publish({
							ts: Date.now(),
							dir: "IN",
							topic: "_HAAS/CONFIG_MISMATCH",
							payload: payloadStr,
							source: "BACKEND",
							size: Buffer.byteLength(payloadStr)
						});
					} catch (_) {}
					break;
				}
				HEIDENHAIN.startPP(1,"192.168.30.35",message.toString());  //startPP(ID,IP,fileName)
				break;
			}
			default:
				log.standard("UNKNOWN: "+topic.toString()+":\t"+message.toString())	
		}
	}
	if (param[2] == "MC2"){
		switch (param[1]){  
			case "STATUS":		//FROM_PLANT/STATUS/MC2
				setStatusOnDB('MC2',message.toString())
				DBf.io.emit('MC2/STATUS', message.toString())
				insertLog( "STATUS "+message.toString(), 'PLC', 'MC2' )
				break;
			case "ALARM":		//FROM_PLANT/ALARM/MC1 -> REQ_MODE_MANUAL
				DBf.io.emit('PLC/ALARM/GENERIC', message.toString())
				break;				
			case 'DESCR':
				setDescrOnDB('MC1',message.toString())
				DBf.io.emit('MC2/DESCR', message.toString())
				DBf.io.emit('PRODUCTION/CHANGED')  //aggiorno la tabella di produzione
				break;
			case 'PART':
				break;
			case 'CMD_MAN':
				break;
			default:
				log.standard("UNKNOWN: "+topic.toString()+":\t"+message.toString())	
		}
	}
	if (param[2] == "BOX"){			
		switch (param[1]){  
			case "STATUS":		//FROM_PLANT/STATUS/BOX
				setStatusOnDB('SMALLBOX',message.toString())
				DBf.io.emit('BOX/STATUS', message.toString())
				break;
			case "DESCR":		//FROM_PLANT/DESCR/BOX
				setDescrOnDB('SMALLBOX',message.toString())
				DBf.io.emit('BOX/DESCR', message.toString())
				break;
			case 'PART':		//es: FROM_PLANT/PART/BOX/TRAY/<TRAY_num>/<piecePos>
				setPositionStatus(message.toString(), param[4], param[5])
				break;
			case 'TRAY':		//es: FROM_PLANT/TRAY/BOX/EXTRACT or FROM_PLANT/TRAY/BOX/RELEASE
				if (param[3] == 'EXTRACT') {
					setExtractedTray(1,message.toString())
					DBf.io.emit('BOX/STATUS',message.toString())
				}
				if (param[3] == 'RELEASE') {
					setExtractedTray(0,message.toString())
					DBf.io.emit('BOX/STATUS',message.toString())
				}
				break;
			case 'CMD_MAN':
				break;
			default:
				log.standard("UNKNOWN: "+topic.toString()+":\t"+message.toString())	
		}
	}
	///////
	
})

//GESTIONE WEBSOCKET HMI => PLC
let users = 0;
DBf.io.on('connection', (socket) => {
  insertLog( "New HMI connected (tot:"+ ++users +")", 'HMI', '' );
  
  socket.on('disconnect', () => {
	insertLog( "HMI disconnected (tot:"+ --users +")", 'HMI', '' );
  });
  
  socket.on('TO_PLANT/CMD/ROBOT', (cmd) => {
	insertLog( "Sent CMD: "+getCMD(cmd), 'HMI', 'ROBOT' );
	client.publish("TO_PLANT/CMD/ROBOT", cmd.toString());
	try {
		const payloadStr = cmd.toString();
		diag.publish({
			ts: Date.now(),
			dir: "OUT",
			topic: "TO_PLANT/CMD/ROBOT",
			payload: payloadStr,
			source: "HMI",
			size: Buffer.byteLength(payloadStr)
		});
	} catch (_) {}
  });
  
  socket.on('TO_PLANT/CMD/BOX', (cmd) => {
	insertLog( "Sent CMD: "+getCMD(cmd), 'HMI', 'BOX' );
	client.publish("TO_PLANT/CMD/BOX", cmd.toString());
	try {
		const payloadStr = cmd.toString();
		diag.publish({
			ts: Date.now(),
			dir: "OUT",
			topic: "TO_PLANT/CMD/BOX",
			payload: payloadStr,
			source: "HMI",
			size: Buffer.byteLength(payloadStr)
		});
	} catch (_) {}
  });
    
  socket.on('TO_PLANT/CMD/MC1', (cmd) => {
	insertLog( "Sent CMD: "+getCMD(cmd), 'HMI', 'MC1' );
	client.publish("TO_PLANT/CMD/MC1", cmd.toString());
	try {
		const payloadStr = cmd.toString();
		diag.publish({
			ts: Date.now(),
			dir: "OUT",
			topic: "TO_PLANT/CMD/MC1",
			payload: payloadStr,
			source: "HMI",
			size: Buffer.byteLength(payloadStr)
		});
	} catch (_) {}
  });
  
  socket.on('TO_PLANT/CMD/MC2', (cmd) => {
	insertLog( "Sent CMD: "+getCMD(cmd), 'HMI', 'MC2' );
	client.publish("TO_PLANT/CMD/MC2", cmd.toString());
	try {
		const payloadStr = cmd.toString();
		diag.publish({
			ts: Date.now(),
			dir: "OUT",
			topic: "TO_PLANT/CMD/MC2",
			payload: payloadStr,
			source: "HMI",
			size: Buffer.byteLength(payloadStr)
		});
	} catch (_) {}
  });
  
  socket.on('TO_PLANT/CMD/MC3', (cmd) => {
	insertLog( "Sent CMD: "+getCMD(cmd), 'HMI', 'MC3' );
	client.publish("TO_PLANT/CMD/MC3", cmd.toString());
	try {
		const payloadStr = cmd.toString();
		diag.publish({
			ts: Date.now(),
			dir: "OUT",
			topic: "TO_PLANT/CMD/MC3",
			payload: payloadStr,
			source: "HMI",
			size: Buffer.byteLength(payloadStr)
		});
	} catch (_) {}
  });
  
//  socket.on('TO_PLANT/CMD/ORDER', (data) => {
//	insertLog( "Sent CMD: "+JSON.stringify(data,null,4), 'HMI', 'ORDER' );
//	
//	sql.connect(DBf.configDB, function (err) {
//        if (err) {
//			insertLog( "ERR TO_PLANT/CMD/ORDER: "+err.toString(), 'HMI', 'ORDER' );
//            return;
//        }
//		let query = `UPDATE WORKORDER SET 
//					STATUS='@status@' 
//					WHERE ID=@id@;`
//		query = query.replace("@status@", data.status); 
//		query = query.replace("@id@", data.id);
//		var request = new sql.Request();
//        request.query(query, function (err, recordset) {
//            if (err) {
//                insertLog( "QUERY ERR TO_PLANT/CMD/ORDER: "+query, 'HMI', 'ORDER' );
//            }else
//				DBf.io.emit('PRODUCTION/CHANGED')  //aggiorno la tabella di produzione			
//		});
//	});
//  });
  
    socket.on('TO_PLANT/CMD/ORDER', (data) => {
	insertLog( "Sent CMD: "+JSON.stringify(data,null,4), 'HMI', 'ORDER' );
	
	sql.connect(DBf.configDB, function (err) {
        if (err) {
			insertLog( "ERR TO_PLANT/CMD/ORDER: "+err.toString(), 'HMI', 'ORDER' );
            return;
        }
		let query = `UPDATE WORKORDER SET 
					STATUS='@status@' 
					WHERE ID=@id@;`;
		
		if (data.status == 3){  //WORKING
			query += `UPDATE [POSITION] SET Order_ID=@id@ WHERE id IN (
						SELECT top 10 id FROM POSITION WHERE Part_Type=@PIECE_ID@ AND STATUS=4 AND ORDER_ID=0 
					  )`;
		}
		if (data.status == 4){  //RAW
			query += `UPDATE [POSITION] SET Order_ID=0 WHERE id in (
						SELECT id FROM position WHERE Part_Type=@PIECE_ID@ AND STATUS=4 AND ORDER_ID=@id@
					 )`
		}
					
		query = query.replaceAll("@status@", 	data.status); 
		query = query.replaceAll("@id@", 		data.id);
		query = query.replaceAll("@PIECE_ID@", 	data.pieceID);
		var request = new sql.Request();
        request.query(query, function (err, recordset) {
            if (err) {
                insertLog( "QUERY ERR TO_PLANT/CMD/ORDER: "+query, 'HMI', 'ORDER' );
            }else
				DBf.io.emit('PRODUCTION/CHANGED')  //aggiorno la tabella di produzione			
		});
	});
  });
  
});

function getStatus(st){  
	switch(parseInt(st)) {
		case 0  : return st + " -> NOT_DEFINED";
		case 1  : return st + " -> FULL?      ";
		case 2  : return st + " -> EMPTY      ";
		case 3  : return st + " -> WORKING    ";
		case 4  : return st + " -> RAW        ";
		case 5  : return st + " -> FINISHED   ";
		case 6  : return st + " -> PAUSED     ";
		case 7  : return st + " -> ABORTED    ";
		case 9  : return st + " -> LOCKED     ";
		case 10 : return st + " -> AUTO       ";
		case 15 : return st + " -> REMOTE     ";
		case 16 : return st + " -> LOCAL      ";
		case 17 : return st + " -> HOLD       ";
		case 20 : return st + " -> MANUAL     ";
		case 99 : return st + " -> ALARM      ";
		case 999: return st + " -> OFF        ";
		default: return st;
	}
}

function getCMD(cmd){  
	switch(parseInt(cmd)) {
		case 10  : return cmd + " -> Change Data On Gripper	";
		case 11  : return cmd + " -> Pick Gripper			";
		case 12  : return cmd + " -> Remove Gripper			";
		case 13  : return cmd + " -> Pick Object			";
		case 14  : return cmd + " -> Place Object			";
		case 15  : return cmd + " -> Positioning			";
		case 16  : return cmd + " -> Pick Place Object		";
		case 17  : return cmd + " -> HOLD					";
		case 18  : return cmd + " -> Restart Main Program	";
		case 20  : return cmd + " -> To Home Pos			";
		case 21  : return cmd + " -> To Maintenance Pos		";
		case 25  : return cmd + " -> Extract Tray			";
		case 26  : return cmd + " -> Release Tray			";
		case 81  : return cmd + " -> Remote Mode			";
		case 82  : return cmd + " -> Local Mode				";
		case 83  : return cmd + " -> Reset Object on Gripper";
		case 99  : return cmd + " -> Reset					";
		case 100 : return cmd + " -> Change speed			";
		case 1501: return cmd + " -> Positioning Box1		";
		case 1502: return cmd + " -> Positioning Box2 		";
		case 1511: return cmd + " -> Positioning MC1 		";
		case 1512: return cmd + " -> Positioning MC2		";
		default: return cmd;
	}
}

/**
 * getCnType(mcNum) → 'heidenhain' | 'haas'
 * Legge process.env['CN_TYPE_MC' + mcNum]. Fallback a 'heidenhain' se assente o invalido
 * (backwards-compat con impianti esistenti). Letto a runtime per rispettare l'ordine di
 * caricamento require → dotenv.config() (vedi server.js).
 */
function getCnType(mcNum) {
	const val = (process.env['CN_TYPE_MC' + mcNum] || '').toLowerCase().trim();
	if (val === 'haas')       return 'haas';
	if (val === 'heidenhain') return 'heidenhain';
	if (val === '')           return 'heidenhain';   // default backwards-compat
	log.standard("CN_TYPE_MC" + mcNum + "='" + val + "' non valido, fallback a 'heidenhain'");
	return 'heidenhain';
}

/*
client.subscribe('#')
client.on('message', function (topic, message) {
  console.log("ricevo: "+topic+":\t"+message)
  switch (topic.substring(0,7)) {
	case 'log/plc':
		console.log("\tPLCPLCPLC");
		//client.publish("log/xx", "Hello PLC");
		break;
	case 'log/c':
		console.log("\tblaaaaa")	
		break;
	default:
		console.log("SCONOSCIUTO: "+message.toString())	
  }
})


client.subscribe(['log/#','status/#']);
client.on('message', function (topic, message) {
  console.log("ricevo: \n\t"+topic+":\n\t"+message)
});

client.on('end', function () {
  console.log("client morto")
});

client.on('packetsend', function () {
  console.log("client spedisce")
});

client.on('packetreceive', function () {
  console.log("client riceve")
});
*/

///////////////////////////////// FUNZIONI DI REGISTRAZIONE SU DB ///////////////////////////////// 

function setStatusOnDB(_unit, _status){
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.standard("err getUnitData: " + err);
            return;
        }

		let query=`UPDATE UNIT_STATUS SET STATUS=@status@ where UNIT=@unit@;` 
		
		query = query.replace("@status@",_status);
		query = query.replace("@unit@","'"+_unit+"'");
		
		log.info("query: "+query)
        // create Request object
        var request = new sql.Request();
					
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.standard("Err query: " + err)
            }
		});
    })
}

function setDescrOnDB(_unit, _descr){
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.standard("err getUnitData: " + err);
            return;
        }

		let query=`UPDATE UNIT_STATUS SET DESCR='@descr@' where UNIT=@unit@;` 
		
		query = query.replace("@descr@",_descr);
		query = query.replace("@unit@","'"+_unit+"'");
		
		log.info("query: "+query)
        // create Request object
        var request = new sql.Request();
					
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.standard("Err query: " + err)
            }
		});
    })
}

function setPositionStatus(_status, _TrayID, _subPos){
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.standard("err getUnitData: " + err);
            return;
        }

		let query=`UPDATE [POSITION] SET STATUS=@STATUS@ WHERE PARENT like 'TRAY_@TRAY_ID@%' and SUB_POS=@SUBPOS@;` 
		
		query = query.replace("@STATUS@",_status);
		query = query.replace("@TRAY_ID@",_TrayID);
		query = query.replace("@SUBPOS@",_subPos);
		
		log.info("query: "+query)
        // create Request object
        var request = new sql.Request();
					
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.standard("Err query: " + err)
            }
		});
    })
}



function setPieceOnGripper(_STATUS, _SUB_POS){
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.standard("err getUnitData: " + err);
            return;
        }

		let query=`UPDATE GRIPPER SET STATUS=@STATUS@ WHERE POS_PLANT=1000 AND (SUB_POS=0 OR SUB_POS=@SUB_POS@);` 
		
		query = query.replace("@STATUS@",_STATUS);
		query = query.replace("@SUB_POS@",_SUB_POS);
		
		log.info("query: "+query)
        // create Request object
        var request = new sql.Request();
					
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.standard("Err query: " + err)
            }
		});
    })
}


function insertLog(_QUERY, _unitA, _unitB){
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.standard("err getUnitData: " + err);
            return;
        }

		let query=`INSERT INTO LOG ([DATA], DESCR, UNIT_A, UNIT_B)
				   VALUES(GETDATE(), '@QUERY@', '@UnitA@', '@UnitB@');`
		
		if (_QUERY == null || _QUERY == "") 
			_QUERY = JSON.stringify(_QUERY,null,4)
		else
			_QUERY = _QUERY.replaceAll("\'","_");
		
		query = query.replace("@QUERY@",_QUERY);
		query = query.replace("@UnitA@",_unitA);
		query = query.replace("@UnitB@",_unitB);
		query = query.replaceAll("\n"," ");
		query = query.replaceAll("\t"," ");
		query = query.replace("        "," ");
		
		log.info("query: "+query)
        // create Request object
        var request = new sql.Request();
					
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.standard("Err query: " + err)
            }
		});
    })
}

function setExtractedTray(_extratAction, _trayNum){
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.standard("err setExtractedTray: " + err);
            return;
        }
		
		let query = "";
		if (_trayNum > 0)
			query = `UPDATE TRAY SET [EXTRACT]=@EXTRACT@ WHERE FLOOR_MAG=@TRAYNUM@;` 
		else
			query = `UPDATE TRAY SET [EXTRACT]=0;` 
		
		query = query.replace("@EXTRACT@",_extratAction);
		query = query.replace("@TRAYNUM@",_trayNum.trim());
		
		log.info("query: "+query)
        // create Request object
        var request = new sql.Request();
					
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.standard("Err query: " + err)
            }
		});
    })
}

//ATTIVO UN SERVIZIO PER FARE IL PUBLISH DEI MESSAGGI ANCHE A MODULI ESTERNI
function publish(topic, msg){
	client.publish(topic, msg);
	try {
		const payloadStr = String(msg);
		diag.publish({
			ts: Date.now(),
			dir: "OUT",
			topic: topic,
			payload: payloadStr,
			source: "BACKEND",
			size: Buffer.byteLength(payloadStr)
		});
	} catch (_) {}
}
exports.publish = publish