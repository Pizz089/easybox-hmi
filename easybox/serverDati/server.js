const express 		= require('express')
const dotenv 		= require('dotenv');
// dotenv.config() PRIMA di tutti i require successivi: alcuni moduli leggono
// process.env a require-time (es. MQTT_Client → bootEagerHaas → getCnType).
// Posizione precedente (in fondo al file) era un bug latente.
dotenv.config();
var path 			= require('path')
const os 			= require('node:os');
const si 			= require('systeminformation');

const log 			= require('./LogFunct');
const DBf 			= require('./DBFunct');
//const robot		=  require('./robotComunication');

var HMIRouter 		= require('./HMI');
var restRouter 		= require('./REST');
var utilityRouter 	= require('./UTILITY');
var unitRouter 		= require('./unit/unit');
var orderRouter		= require('./WORKORDER/Order');
var gripperRouter 	= require('./CONF/Gripper');
var trayRouter 		= require('./CONF/Tray');
var pieceRouter 	= require('./CONF/Piece');
var viceRouter 		= require('./CONF/Vice');
var fixtureRouter 	= require('./CONF/Fixture');
var palletRouter 	= require('./CONF/Pallet');
var gratingRouter 	= require('./CONF/Grating');
var positionRouter	= require('./CONF/Position');
var PP_Router		= require('./PartProgram/PartProgram');
var alarmRouter 	= require('./ALARM');
var HEIDENHAIN		= require('./CN/HEIDENHAIN');

const MQTT			= require('./MQTT_Client');

const app 			= express()

app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});
app.use(express.json());
app.use('/api/conf/gripper'	, gripperRouter);
app.use('/api/unit'			, unitRouter);
app.use('/api/order'		, orderRouter);
app.use('/api/conf/tray'	, trayRouter);
app.use('/api/conf/piece'	, pieceRouter);
app.use('/api/conf/vice'	, viceRouter);
app.use('/api/conf/fixture'	, fixtureRouter);
app.use('/api/conf/pallet'	, palletRouter);
app.use('/api/conf/grating' , gratingRouter);
app.use('/api/conf/position', positionRouter);
app.use('/api/utility'		, utilityRouter);
app.use('/api/alarm'		, alarmRouter);
app.use('/api/pp'			, PP_Router);

//app.use('/api/rest', restRouter);
//app.set("view engine","hbs")

process.env.TOKEN_SECRET;

//saluto nella HMI
/*
app.get('/', (req, res) => {
	DBf.date((xx)=>{
		log.standard("ricevo:"+xx.dd);
	});
	res.send('Versione 1.0 dell\'industria 4.0 per i cobot! [MAC version]');
})
*/

app.get('/ver', (req, res) => {
	res.send('Versione 1.0');
})

app.get('/darkmode', (req, res) => {
	res.send(process.env.darkMode || false); 
}); 

app.get('/HMI_option', (req, res) => {
	const hmiOption =JSON.parse(process.env.HMI_option);
	res.json(hmiOption);
});




//tutte le richieste non conosciute vengono bloccate
app.get('/*', (req, res) => {
	res.sendStatus(400); 
}); 

const server = app.listen(process.env.serverPort, () => {
  log.init(`Server listening on port  ${process.env.serverPort}`)
  console.log(`Server listening on port ${process.env.serverPort}`)

  //////////////////////////////////////getAndCheckLicense(10) //ripristinare

  //setInterval(() => {
	//HEIDENHAIN.getInfo(1,"192.168.30.35");
    //HEIDENHAIN.getInfo(2,"192.168.30.31");
  //}, "5000");
  
  //delete old LOG TABLE entries...
  setInterval(() => {
	var sql 	= require('mssql');
	sql.connect(DBf.configDB, function (err) {
		let query = `SET DEADLOCK_PRIORITY LOW; DELETE FROM log WHERE data <= DateAdd(day,-3,GETDate());`
		
		var request = new sql.Request();
		request.query(query, function (err, recordset) { 
			log.info("LOG TABLE ERASED!!")
			if (err) {
                log.error("Err query: " + err)
            }
		});
	});
  }, (4*3600*1000) ); 
  
})

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received.'); 
  log.emptingStream(0);
  server.close(() => {
    // Additional cleanup tasks go here
  });
});

//process.on('SIGINT', () => {
//  console.log('SIGINT signal received.');
//  log.emptingStream(0);
//  server.close(() => {
//    // Additional cleanup tasks go here 
//  });
//});

async function getAndCheckLicense(_len) {
  console.log("check license...")
  try {
    const sys = await si.system( );
	let license = sys.uuid.replaceAll("-","").toUpperCase()
	
	license = license.substring(0,_len)+
			  "-"+
			  license.substring(license.length-_len,license.length)
	
	license += "-"
	
	const net = await si.networkInterfaces()

	//net.forEach ( (n) => console.log(n.mac + "\t"+ n.iface) )
	
	for(let i=0; i<net.length; i++){
		if (net[i].iface != "Ethernet")
			continue;
		
		let mac = net[i].mac.replaceAll(":","").toUpperCase()
		
		if (mac.length<_len)
			mac += "00000000000" 
		license += mac.substring(0,_len)
	}	
	
	if (process.argv[8] != undefined && process.argv[8] == "666")    //// !!!
		console.log("license >>> "+license);
	
	checkLicense( license.trim() )
    
  } catch (e) {
    console.log("license error "+e);
	log.error("license error "+e);
  }
}

function checkLicense(lic){
	var sql 	= require('mssql')
	sql.connect(DBf.configDB, function (err) {
		let query = `select descr from UNIT_STATUS us where unit='license';`
		
		var request = new sql.Request();
		request.query(query, function (err, recordset) {
			if(recordset.recordset[0].descr.trim()!=lic){
				console.log("-------------------------------------------------");
				console.log("-------------- LICENSE NOT VALID!! --------------");
				console.log("-------------------------------------------------");
				log.error("LICENSE NOT VALID!!")
				
				//avviso l'interfaccia
				MQTT.publish("FROM_PLANT/ALARM","LICENSE NOT VALID!!")
				
				setTimeout(process.exit(),3000);
			}
			else 
				console.log("OK")
		});
	});
}

function heidenhain_cn (IP){
	exec(`cd \"C:\\Program Files (x86)\\HEIDENHAIN\\TNCremo\" && TNCcmdPlus -I${IP} @execute.txt`,
		(error,stdout,stderr)=>{
			if (error) {
				log.error("error: "+error.message);
				return
			}
			if (stderr) {
				log.error("stderr: "+stderr);
				return  
			}
			if (stdout)  {
				let ris = "";
				let str = "Program Status:"
				ris += "Stato:"+stdout.substring(
					stdout.indexOf(str)+str.length,stdout.indexOf(str)+str.length+2);
				
				str = "Execution Mode:"
				ris += " - Mode:"+stdout.substring(
					stdout.indexOf(str)+str.length,stdout.indexOf(str)+str.length+2);
				
				str = "Program position:"
				ris += " - Pos:"+stdout.substring(
					stdout.indexOf(str)+str.length,stdout.lastIndexOf(")")+1 );
						
				//log.info("IP: "+IP+" "+ris);
				log.info(ris);
			}		
		}
	);
}