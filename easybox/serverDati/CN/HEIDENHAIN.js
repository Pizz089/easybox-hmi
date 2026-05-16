///////////////////////////////////////////////////
// Return values for Program status:  
// 0 Started                          
// 1 Stopped                          
// 2 Finished                         
// 3 Cancelled                        
// 4 Interrupted                      
// 5 Error                            
// 6 Error cleared
// 7 Idle
// 8 <<undefined>>
///////////////////////////////////////////////////
// Return values for Execution mode:
// 0 Manual
// 1 MDI
// 2 Pass References
// 3 Single Step
// 4 Automatic
// 5 <<undefined>>
///////////////////////////////////////////////////
// publish to HMI:
// 		DBf.io.emit(`MC${ID}/ERROR`, "COMMUNICATION");
//		DBf.io.emit(`MC${ID}/ERROR`, stderr);
//
// publish to PLC:
// 		mqttPLC.publish(`TO_PLANT/MC${ID}/CHANGEPALLET`, ChangePalletReady);
//		mqttPLC.publish(`TO_PLANT/MC${ID}/CN_STATUS`, 	 sendToPLC);		
///////////////////////////////////////////////////
				

var express 	= require('express');
const DBf 		= require('../DBFunct');
const mqttPLC	= require('../MQTT_Client');
var router 		= express.Router();
const log 		= require('../LogFunct');
const {exec}	= require('child_process');

var ChangePalletReady = false;
var status 		= "";
var mode 		= "";
var PP 			= "";
var PPpos		= 0;

function getInfo(ID,IP){

	exec(`cd \"C:\\Program Files (x86)\\HEIDENHAIN\\TNCremo\" && TNCcmdPlus -I${IP} @execute.txt`,
		(error,stdout,stderr)=>{
			if (error) {
				log.error("error: "+error.message);
				//DBf.io.emit(`MC${ID}/ERROR`, "COMMUNICATION");			//HMI 
				mqttPLC.publish(`TO_PLANT/MC${ID}/CN_STATUS`, "0");			//PLC (not_def)
				mqttPLC.publish(`TO_PLANT/MC${ID}/CHANGEPALLET`, "false");	//PLC
				return
			}
			if (stderr) {
				log.error("stderr: "+stderr);
				//DBf.io.emit(`MC${ID}/ERROR`, stderr);						//HMI 
				mqttPLC.publish(`TO_PLANT/MC${ID}/CN_STATUS`, "0");			//PLC (not_def)
				mqttPLC.publish(`TO_PLANT/MC${ID}/CHANGEPALLET`, "false");	//PLC
				return  
			}
			if (stdout)  {
				let sendToPLC = 0;
				let str = "Program Status:"
				status = stdout.substring( stdout.indexOf(str)+str.length,stdout.indexOf(str)+str.length+2 ).trim();
				switch (parseInt(status)){
					case 0:  	//Started 
						sendToPLC = 3;					//PLC (working)
						break;
					case 1,6:  	//Stopped, Error cleared
						sendToPLC = 6;					//PLC (paused)
						break;
					case 2,7:  	//Finished, Idle
						sendToPLC = 5;					//PLC (finished)
						break;
					case 3,4: 	//Cancelled, Interrupted
						sendToPLC = 7;					//PLC (aborted)
						break;
					case 5: 	//Error
						sendToPLC = 99;					//PLC (alarm)
						break;
					case 8: 	//undefined
						sendToPLC = 0;					//PLC (not_def)
						break;
					default:
						log.error("status unknown ["+status+"]");
				}
				
				str = "Execution Mode:"
				mode =  stdout.substring( stdout.indexOf(str)+str.length,stdout.indexOf(str)+str.length+2 ).trim();
				if (parseInt(mode) != 4){  				//Automatic
					sendToPLC = 20;						//PLC (manual)
				}
				
				str = "Program position:"
				PP = stdout.substring( stdout.indexOf(str)+str.length,stdout.lastIndexOf(")")+1 );
				PPpos =  parseInt( PP.substring(PP.lastIndexOf("(")+1, PP.lastIndexOf(")")) );
				PP.substring(0,PP.lastIndexOf("("));
				
				ChangePalletReady = (status==7 && mode==4 && PP.toUpperCase().indexOf("PALLETCHANGE")>0 && PPpos>10);
				
				mqttPLC.publish(`TO_PLANT/MC${ID}/CHANGEPALLET`, ChangePalletReady.toString());		//PLC
				mqttPLC.publish(`TO_PLANT/MC${ID}/CN_STATUS`, 	 sendToPLC.toString());				//PLC
			}		
		}
	);
}

function startPP(ID,IP,fileName){

	exec(`cd \"C:\\Program Files (x86)\\HEIDENHAIN\\TNCremo\" && TNCcmdPlus -I${IP} "copy ADMG\${fileName}.H nc_prog\_EASYBOX.H"`,
		(error,stdout,stderr)=>{
			if (error) {
				log.error("error: "+error.message);
				//mqttPLC.publish(`TO_PLANT/MC${ID}/STARTPP`, "false");	//PLC
				return
			}
			if (stderr) {
				log.error("stderr: "+stderr);
				//mqttPLC.publish(`TO_PLANT/MC${ID}/STARTPP`, "false");	//PLC
				return  
			}
			if (stdout)  {
				let result = stdout.indexOf(stdout,"ok")>0;
				
				if (!result) {
					mqttPLC.publish(`TO_PLANT/MC${ID}/STARTPP`, "Err: "+stout);	//PLC
					return
				}
				
				exec(`cd \"C:\\Program Files (x86)\\HEIDENHAIN\\TNCremo\" && TNCcmdPlus -I${IP} @selectPP.txt`,
				(error,stdout,stderr)=>{
					if (error) {
						log.error("error: "+error.message);
						mqttPLC.publish(`TO_PLANT/MC${ID}/STARTPP`, "KO");	//PLC
						return
					}
					if (stderr) {
						log.error("stderr: "+stderr);
						mqttPLC.publish(`TO_PLANT/MC${ID}/STARTPP`, "KO");	//PLC
						return  
					}
					if (stdout)  {
						mqttPLC.publish(`TO_PLANT/MC${ID}/STARTPP`, "ok");	//PLC
					}
				});
			}		
		}
	);
}

function listPP(ID,IP,fileName){

	exec(`cd \"C:\\Program Files (x86)\\HEIDENHAIN\\TNCremo\" && TNCcmdPlus -I${IP} "dir ADMG\"`,
	(error,stdout,stderr)=>{
		if (error) {
			log.error("error: "+error.message);
			//mqttPLC.publish(`TO_PLANT/MC${ID}/LISTPP`, "ERROR");	//PLC
			return
		}
		if (stderr) {
			log.error("stderr: "+stderr);
			//mqttPLC.publish(`TO_PLANT/MC${ID}/LISTPP`, "ERROR");	//PLC
			return  
		}
		if (stdout)  {
			
		}
	});

}

module.exports = { getInfo, startPP }