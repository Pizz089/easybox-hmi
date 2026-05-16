// TODO_DEADCODE: questo router NON è montato in server.js
//                (app.use('/api/rest', restRouter) è commentato in server.js:65).
//                Tutti gli handler /workOrders, /workOrderLogs, /login, ecc. sono
//                non raggiungibili a runtime. Da valutare rimozione integrale.
//                Decisione presa in sessione di refactor maggio 2026.
//////// APPI REST ////////
const jwt 	= require('jsonwebtoken');
var express = require('express');
const DBf 	= require('./DBFunct');
const log 	= require('./LogFunct');
var router 	= express.Router();



///////// AUTENTICAZIONE /////////
//https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs

function generateAccessToken(username) {
	return jwt.sign(
				username, 
				process.env.TOKEN_SECRET, 
				{ expiresIn: '1800s' } 
	);
}

function authenticateToken(req, res, next) {
  //log.standard(JSON.stringify(req.headers,null,4));
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[0]

  if (token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
    if (err!=null)
		log.error("errore: "+err)

    if (err) return res.sendStatus(403)

    req.user = user 

    next() 
  })
}

router.post('/auth', (req, res) => {
	//log.standard(JSON.stringify(req.body,null,4));
	//log.standard("user:"+req.body.username+"|"+process.env.userAuth+"|");
	 //log.standard("password:"+req.body.password+"|"+process.env.passwordAuth+"|");

	var obj = {}; 
	if (req.body.username==process.env.userAuth && 
		req.body.password==process.env.passwordAuth){
				
		const token = generateAccessToken(
			{ username: req.body.username }
		);
		
		obj.auth = true;
		obj.token=token;
	}else{
		obj.auth = false;
	}
	res.json(obj);
})


//inserimento ordine
router.post('/workOrders', authenticateToken, (req, res) => {
	//log.standard(JSON.stringify(req.body,null,4));
	if (req.body.workOrder!=null && 
		req.body.program!=null 	 && 
		req.body.quantity!=null){
			//faccio inserimento nel DB...
			DBf.insertWorkOrder(req.body.workOrder.trim(),
								req.body.program.trim(),
								req.body.quantity,
								(result)=>{
				if (result=="OK")
					res.sendStatus(200);
				else
					res.sendStatus(400);
			});
	}else 
		res.sendStatus(400);
})

//lettura ordini
router.get('/workOrders', (req, res) => {
	DBf.getWorkOrders( (result) =>{
		res.send(result);
	})
})

//Lettura singolo ordine
router.get('/workOrders/:workOrder',authenticateToken, (req, res) => {
	//log.standard("workOrder: "+req.params.workOrder);
	DBf.getWorkOrder(req.params.workOrder.trim(), (result) =>{
		if (result!=null)
			res.send(result);
		else
			res.sendStatus(400);
	});
})

//Eliminazione ordine (ritorna sempre OK anche se non cancella nulla)
router.delete('/workOrders/:workOrder',authenticateToken, (req, res) => {
	//log.standard("workOrder: "+req.params.workOrder);
	DBf.deleteWorkOrder(req.params.workOrder.trim());
	res.sendStatus(200);
})

//Lettura log lavorazioni
router.get('/workOrderLogs', authenticateToken, (req, res) => {
	if (JSON.stringify(req.query, null, 4).length>2 &&	
		req.query.fromDate==null && 
		req.query.toDate==null   &&
		req.query.side==null     &&
		req.query.workOrder==null &&
		req.query.program==null){
		res.sendStatus(400);
		return;
	}
	
	DBf.getWorkOrderLogs( req.query, (result) =>{
		if (result!=null)
			res.send(result);
		else
			res.send('{}');
	});
})

module.exports = router;