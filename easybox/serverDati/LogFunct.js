"use strict";

var logLevel= 1;

var rfs 	= require('rotating-file-stream') ;
var path 	= require('path')

var lastMsg	= "";
var multiply= 0;

var accessLogStream = rfs.createStream('access.log', {
  size: '1M', // rotate for size
  path: path.join(__dirname, 'log'),
  maxFiles:5
})


exports.formatLogTime = function (newline = false) {
    let d = new Date();

	let ris = 	( d.getDate()>10? d.getDate() : '0'+d.getDate() ) +
				"-"+
				( (d.getMonth()+1)>10? (d.getMonth()+1) : '0'+(d.getMonth()+1) ) +
				"-"+
				d.getFullYear().toString().substring(2) +
				" "+
				( d.getHours()>10? d.getHours() : '0'+d.getMonth() ) +
				':' +
				( (d.getMinutes()+1)>10? d.getMinutes()+1 : '0'+d.getMinutes()+1 ) +
				':' +
				(d.getSeconds()>10? d.getSeconds() : '0'+d.getSeconds() ) +
				'.' +
				d.getMilliseconds() +
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
	
	if (ris.len>0)
		accessLogStream.write( ris );
}

//livello 5 (ERRORE)
exports.error = function (str) {
	if (logLevel<=5){
		if (lastMsg	== str){
			multiply++;
		}else{
			this.emptingStream(5);
			lastMsg	= str;
			accessLogStream.write(
				"\nERR "+this.formatLogTime(false)+"\t"+str
			);
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
			accessLogStream.write(
				"\nSTD "+this.formatLogTime(false)+"\t"+str
			);
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
			accessLogStream.write(
				"\nINF "+this.formatLogTime(false)+"\t"+str
			);
			multiply++;
		}
}

//livello 0 (INIT)
exports.init = function (str) {
	accessLogStream.write(
		"\n\n"+
		"-------- INIT -------- \n\t"+
		this.formatLogTime(false)+"\t"+str+" - logLevel:"+logLevel
	);
}