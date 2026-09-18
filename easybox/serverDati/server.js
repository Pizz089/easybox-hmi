const express 		= require('express')
const dotenv 		= require('dotenv');
// dotenv.config() PRIMA di tutti i require successivi: alcuni moduli leggono
// process.env a require-time (es. MQTT_Client → bootEagerHaas → getCnType).
// Posizione precedente (in fondo al file) era un bug latente.
dotenv.config();
var path 			= require('path')
const fs 			= require('node:fs')
const os 			= require('node:os');
const si 			= require('systeminformation');

const v8 			= require('node:v8');
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
// ===========================================================================
// (pwa-https) /ca.crt — la CA locale, scaricabile IN CHIARO
//
// E' il passo uno della procedura per aggiungere un tablet: il dispositivo
// deve poter prendere il certificato della CA PRIMA di fidarsi di qualcosa,
// quindi questo endpoint deve restare raggiungibile in HTTP. Sta sul backend
// e non sul pannello proprio per questo: il pannello, acceso l'HTTPS, non
// risponde piu' in chiaro.
//
// Non sta sotto /api di proposito: /api e' il prefisso che il proxy di Vite
// gira al backend, e questo indirizzo va invece aperto DIRETTO dal tablet.
//
// Non e' un segreto: e' la parte pubblica della CA, quella che si installa sui
// dispositivi. La chiave privata sta in ca.pfx e non viene servita.
// ===========================================================================
app.get('/ca.crt', (req, res) => {
	const caPath = path.join(__dirname, '..', 'HMI', 'certs', 'ca.crt');
	if (!fs.existsSync(caPath)) {
		res.status(404).send('CA non presente: lanciare "npm run cert" nella cartella HMI.');
		return;
	}
	res.setHeader('Content-Type', 'application/x-x509-ca-cert');
	res.setHeader('Content-Disposition', 'attachment; filename="easybox-ca.crt"');
	res.send(fs.readFileSync(caPath));
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

  //migrazione schema idempotente (cantiere Attrezzaggi)
  ensureSchema();

  //////////////////////////////////////getAndCheckLicense(10) //ripristinare

  //setInterval(() => {
	//HEIDENHAIN.getInfo(1,"192.168.30.35");
    //HEIDENHAIN.getInfo(2,"192.168.30.31");
  //}, "5000");
  
  // (oom 18/9) RETE DI SICUREZZA DOPO IL CRASH "Fatal process out of memory".
  // Di quel crash e' rimasta una riga sola e nessun andamento: non si sapeva
  // se la memoria fosse cresciuta piano per ore o esplosa in un minuto.
  //
  // Il limite dell'heap viene STAMPATO, non dato per buono: --max-old-space-size
  // si imposta fuori dal repo (parametri del servizio nssm, vedi APPUNTI-CELLA)
  // e l'unico modo di sapere se e' davvero attivo e' chiederlo a V8.
  const mb = (v) => Math.round(v / 1048576);
  log.init('heap limit: ' + mb(v8.getHeapStatistics().heap_size_limit) + ' MB'
    + ' (se e\' il default, --max-old-space-size non e\' arrivato al processo)');
  setInterval(() => {
    const m = process.memoryUsage();
    // una riga sola, di livello standard: deve sopravvivere a logLevel 2
    log.standard('memoria: rss ' + mb(m.rss) + ' MB, heap ' + mb(m.heapUsed)
      + '/' + mb(m.heapTotal) + ' MB, external ' + mb(m.external) + ' MB'
      + ', socket HMI ' + (DBf.io && DBf.io.engine ? DBf.io.engine.clientsCount : '?')
      + ', log scartate ' + log.righeScartate());
  }, 5 * 60 * 1000);

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

// Shutdown pulito (N4-3d): SIGTERM/SIGINT/SIGBREAK convergono in un unico
// handler che chiude le istanze HAAS, flusha i log, chiude il server HTTP,
// e poi exit(0). forceExitTimer 10s come safety net se server.close si
// blocca (es. Socket.IO clients HMI non si disconnettono).
let shuttingDownLocal = false;
async function shutdownHandler(signal) {
  if (shuttingDownLocal) return;
  shuttingDownLocal = true;
  log.standard(signal + ' received, shutting down');

  const forceExitTimer = setTimeout(() => {
    log.standard('Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 10000);

  try {
    await MQTT.HAAS.closeAll();
    log.emptingStream(0);
    server.close(() => {
      clearTimeout(forceExitTimer);
      process.exit(0);
    });
  } catch (err) {
    log.standard('Shutdown error: ' + err.message);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on('SIGTERM',  () => shutdownHandler('SIGTERM'));
process.on('SIGINT',   () => shutdownHandler('SIGINT'));
process.on('SIGBREAK', () => shutdownHandler('SIGBREAK'));

// Guarded ALTER idempotente al boot (cantiere Attrezzaggi): VICE.PALLET_ID
// int NULL = pallet su cui la morsa e' montata (NULL = smontata). Il guard
// COL_LENGTH rende l'ALTER ripetibile a ogni avvio senza effetti quando la
// colonna esiste gia'. Lo sp_refreshview e' NECESSARIO: la lettura HMI passa
// dalla vista VICES (select *), che in SQL Server congela le colonne alla
// creazione — senza refresh la colonna nuova non arriverebbe mai all'HMI
// (il guard sys.views la salta se VICES non fosse una vista).
function ensureSchema() {
	var sql = require('mssql');
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err ensureSchema: " + err);
			return;
		}
		let query = `IF COL_LENGTH('VICE','PALLET_ID') IS NULL
						ALTER TABLE VICE ADD PALLET_ID int NULL;
					 IF EXISTS (SELECT 1 FROM sys.views WHERE name='VICES')
						EXEC sp_refreshview 'VICES';`
		var request = new sql.Request();
		request.query(query, function (err) {
			if (err)
				log.error("Err ensureSchema: " + err)
			else
				log.init("ensureSchema OK: VICE.PALLET_ID")
		});
	});
}

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