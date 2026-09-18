"use strict";

// ============================================================================
// LogFunct — log su file rotante.
//
// (oom 18/9) DUE CAMBI DOPO IL CRASH "Fatal process out of memory".
//
// 1. LIVELLO 2 DI DEFAULT (prima 1). Al livello 1 anche exports.info scrive, e
//    ogni chiamata al database ne produce una con la query INTERA dentro
//    (insertLog, setStatusOnDB, ...). Con il PLC che pubblicava a raffica era
//    una riga lunga per messaggio, piu' quella di "ricevo MQTT". Si puo'
//    riabbassare con LOG_LEVEL=1 nel .env quando serve davvero.
//
// 2. SI RISPETTA LA BACKPRESSURE. Prima il valore di ritorno di write() non lo
//    guardava nessuno e non si aspettava mai 'drain': quando il disco (o una
//    rotazione, che a 1 MB capita di continuo sotto raffica) non stava dietro,
//    i chunk si accumulavano nel buffer interno del Writable SENZA LIMITE. E'
//    una delle strutture che crescevano fino a uccidere il processo.
//    Adesso: se write() torna false si SCARTA contando, e alla ripresa si
//    scrive una riga sola con quante righe sono andate perse. Piu' un tetto in
//    BYTE AL SECONDO, perche' la rotazione a 1 MB limita il file su disco, non
//    la memoria del processo.
//
// Il principio: un log che perde righe e lo dichiara e' meglio di un log che
// tiene tutto e fa morire il ponte.
// ============================================================================

// livello: 0 init, 1 debug, 2 standard, 5 errore. Si scrive cio' che ha
// livello >= logLevel. Override esplicito con LOG_LEVEL (accetta anche 0).
const livelloEnv = parseInt(process.env.LOG_LEVEL, 10);
var logLevel = Number.isInteger(livelloEnv) ? livelloEnv : 2;

var rfs 	= require('rotating-file-stream') ;
var path 	= require('path')

var lastMsg	= "";
var multiply= 0;

var accessLogStream = rfs.createStream('access.log', {
  size: '1M', // rotate for size
  path: path.join(__dirname, 'log'),
  maxFiles:5
})

// ---------------------------------------------------------------------------
// Tetto in byte al secondo. Non e' una stima di disco: e' il freno che impedisce
// alla coda in memoria di partire. 64 KB/s sono circa 600 righe al secondo di
// log normale, molto piu' di quanto serva a capire cosa succede; oltre, quello
// che si perde e' rumore ripetuto, e viene comunque contato.
const MAX_BYTE_AL_SECONDO = 64 * 1024;

let bloccato = false;          // write() ha detto false, 'drain' non ancora arrivato
let scartate = 0;              // righe buttate da quando e' uscita l'ultima nota
let finestraTs = 0;            // inizio della finestra da un secondo
let byteNellaFinestra = 0;

function writeRaw(str) {
	// L'unico punto che tocca lo stream. Se il buffer interno e' pieno si alza
	// il flag e si aspetta 'drain': da li' in poi si scarta invece di accodare.
	if (accessLogStream.write(str) === false) {
		bloccato = true;
		accessLogStream.once('drain', () => {
			bloccato = false;
			segnalaScarti();
		});
	}
}

// Una riga sola quando si torna a scrivere: quante ne sono state buttate e
// perche'. Senza questa, un buco nel log sarebbe indistinguibile da un periodo
// in cui non e' successo niente — che e' il modo peggiore di perdere dati.
function segnalaScarti() {
	if (scartate === 0 || bloccato) return;
	const n = scartate;
	scartate = 0;
	writeRaw("\nSTD " + exports.formatLogTime(false) + "\t"
		+ n + " righe di log scartate (backpressure o tetto di "
		+ Math.round(MAX_BYTE_AL_SECONDO / 1024) + " KB/s)");
}

// importante = true per errori e init: passano sopra il tetto in byte, perche'
// perdere una riga d'errore costa piu' del traffico che genera. Il flag
// 'bloccato' invece vale per tutti: quando il buffer e' pieno, accodare
// un'altra riga e' esattamente cio' che non si deve fare.
function scrivi(str, importante) {
	if (bloccato) { scartate++; return; }

	const now = Date.now();
	if (now - finestraTs >= 1000) {
		finestraTs = now;
		byteNellaFinestra = 0;
		segnalaScarti();
	}

	const len = Buffer.byteLength(str);
	if (!importante && byteNellaFinestra + len > MAX_BYTE_AL_SECONDO) {
		scartate++;
		return;
	}
	byteNellaFinestra += len;
	writeRaw(str);
}

// Quante righe sono state scartate e non ancora dichiarate. La usa la riga
// periodica di memoria in server.js: se cresce, il ponte sta ricevendo piu' di
// quanto riesca a raccontare.
exports.righeScartate = function () {
	return scartate;
}

// (oom 18/9) ORARIO CORRETTO. Il formato di ogni riga cambia, ed e'
// voluto: la riga periodica di memoria serve a leggere un ANDAMENTO nel
// tempo, e con l'orario rotto non si legge. Cosa c'era prima:
//
//   ore    '0'+d.getMonth()        -> sotto le dieci stampava il MESE
//   minuti d.getMinutes()+1        -> sempre un minuto avanti, e "60" al
//                                     posto di "00" allo scoccare dell'ora;
//                                     sotto i dieci, '0'+5+1 e' concatenazione
//                                     di stringhe e usciva "051", tre cifre
//   giorno/mese/ore/secondi  >10   -> il valore ESATTAMENTE 10 finiva nel ramo
//                                     dello zero davanti e usciva "010"
//   millisecondi                   -> senza zeri davanti, quindi due righe
//                                     dello stesso secondo non si ordinano
//
// Erano lo stesso difetto ripetuto: un padding scritto a mano sei volte. Ora
// e' una funzione sola, e il formato resta DD-MM-YY HH:MM:SS.mmm.
const due = (n) => (n < 10 ? '0' + n : String(n));
const tre = (n) => (n < 10 ? '00' + n : n < 100 ? '0' + n : String(n));

exports.formatLogTime = function (newline = false) {
	const d = new Date();

	const ris = due(d.getDate()) +
				"-" +
				due(d.getMonth() + 1) +
				"-" +
				d.getFullYear().toString().substring(2) +
				" " +
				due(d.getHours()) +
				':' +
				due(d.getMinutes()) +
				':' +
				due(d.getSeconds()) +
				'.' +
				tre(d.getMilliseconds()) +
				': '
	if (newline)
		return '\n' + ris;
	else
		return ris;
}

exports.emptingStream = function(level){
	if (lastMsg=="") return;

	var ris="\n";
	var risShutdown=""
	switch (level){
		case 0: ris += "    ";
				risShutdown += "\n\n-------- SHUTDOWN --------\n\t";
				break;
		case 1: ris += "INF "; break;
		case 2: ris += "STD "; break;
		case 5: ris += "ERR "; break;
	}
	ris += this.formatLogTime(false)+"\t"
	if (multiply>1)
		ris += "("+multiply +" times) "

	//ris += lastMsg

	if (risShutdown!="")
		ris += risShutdown;

	multiply=0;

	// NB (18/9): `ris.len` non esiste — e' `ris.length`. Con undefined > 0
	// sempre falso questa riga non viene MAI scritta, quindi il riepilogo
	// "(N times)" dei messaggi ripetuti non e' mai comparso nel log. Lasciato
	// com'e' di proposito: correggerlo qui vorrebbe dire AUMENTARE il volume
	// del log nel commit che serve a ridurlo. Da decidere a parte.
	if (ris.len>0)
		scrivi( ris, level === 0 || level === 5 );
}

//livello 5 (ERRORE)
exports.error = function (str) {
	if (logLevel<=5){
		if (lastMsg	== str){
			multiply++;
		}else{
			this.emptingStream(5);
			lastMsg	= str;
			scrivi("\nERR "+this.formatLogTime(false)+"\t"+str, true);
			multiply++;
		}
	}
}

//livello 2 (standard)
exports.standard = function (str) {
	if (logLevel<=2)
		if (lastMsg	== str){
			multiply++;
		}else{
			this.emptingStream(2);
			lastMsg	= str;
			scrivi("\nSTD "+this.formatLogTime(false)+"\t"+str, false);
			multiply++;
		}
}

//livello 1 (debug)
exports.info = function (str) {
	if (logLevel<=1)
		if (lastMsg	== str){
			multiply++;
		}else{
			this.emptingStream(1);
			lastMsg	= str;
			scrivi("\nINF "+this.formatLogTime(false)+"\t"+str, false);
			multiply++;
		}
}

//livello 0 (INIT)
exports.init = function (str) {
	scrivi(
		"\n\n"+
		"-------- INIT -------- \n\t"+
		this.formatLogTime(false)+"\t"+str+" - logLevel:"+logLevel
	, true);
}
