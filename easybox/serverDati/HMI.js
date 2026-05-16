// TODO_DEADCODE: questo intero router NON è montato in server.js
//                (nessun app.use(..., HMIRouter) esistente). Tutti gli handler
//                /workOrders, /workOrderLogs, ecc. sono non raggiungibili a runtime.
//                Da valutare rimozione integrale. Decisione presa in sessione di refactor maggio 2026.
//////// HMI ////////
var express = require('express');
const DBf = require('./DBFunct');
var router = express.Router();

var templatePATH = '.';

//lettura ordini per HMI
router.get('/workOrders', (req, res) => {
	DBf.getWorkOrders( (result) =>{
		res.render(templatePATH+"\\workOrder", { 	
				title	: 'WorkOrders', 
				content : 'Elenco WorkOrders',
				workOrds: result
		});
		//console.log(JSON.stringify(result,null,4));
	})
})

//mostra i pezzi fatti per HMI
router.get('/workOrderLogs', (req, res) => {
	var refineSearch= {}
	//refineSearch.side="left";
	DBf.getWorkOrderLogs( refineSearch, (result) =>{
		console.log(JSON.stringify(result,null,4));
		res.render(templatePATH + "\\workOrdersLogs", { 	
				title	: 'WorkOrderLogs', 
				content : 'Elenco pezzi fatti',
				workOrdsLogs: result
		});
	})
})

router.get('/test', (req, res) => {
	var refineSearch= {}
	DBf.getWorkOrderLogs( refineSearch, (result) =>{
		//console.log(JSON.stringify(result,null,4));
		res.send(result);
	});
})

module.exports = router;