//////// HMI ////////
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('../LogFunct');
const errorCodes = require('../errorCodes');
const { trayParentPredicate } = require('../trayParent');
const gratingFit = require('../gratingFit');

var templatePATH = '.';

router.get('/show/:ID', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getGripperData: " + err);
            return;
        }
		
		//se pos_mag>1000 sono gli uncini
		let query=`select * from POSITION;`
		if (String(req.params.ID)!="all") 
			query=`select * from POSITION where id='${req.params.ID}';`
		
		//query=query+' where pos_mag<1000;'   //non vengono mostrati gli uncini per estrarre il cassetto
		
        // create Request object
        var request = new sql.Request();
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("error DB")
            }else
				res.send(recordset.recordset)
        });
    })
})

router.get('/updatePositionStatus/:tray_ID/:position/:status', (req, res) => {
	//console.log(">>>"+JSON.stringify(req,null,4));
	// (tray-parent-predicate) predicato PARENT via helper condiviso
	// (valida anche il numero cassetto: niente path param raw in query)
	const pred = trayParentPredicate(req.params.tray_ID);
	if (!pred) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updatePositionStatus: " + err);
            return;
        }

		//console.log("---"+JSON.stringify(req.query,null,4));

        // create Request object
        var request = new sql.Request();

        let query = `UPDATE [POSITION] SET
					STATUS=${req.params.status}
					WHERE ${pred} and SUB_POS=${req.params.position};`
					
        log.info('query ' + query);
		//log.standard('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
			if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
            }else
				res.send("OK")
		});
    })
})

router.get('/insertPositionTray', (req, res) => {

	// (dup-guard 4/9) validazione cassetto/posizione + INSERT IDEMPOTENTE:
	// se la riga (PARENT, SUB_POS) esiste gia' NON si inserisce (KO_DUP).
	// Chiude i duplicati da salvataggi sovrapposti (doppio tap sul save del
	// grigliato: la seconda DELETE passava mentre la prima sequenza stava
	// ancora inserendo). La rigenerazione legittima non cambia: le righe
	// sono appena state cancellate e la NOT EXISTS e' vera.
	const dupPred = trayParentPredicate(req.query.TRAY_ID, 'px.PARENT');
	const subPos = Number(req.query.SUB_POS);
	if (!dupPred || !Number.isInteger(subPos) || subPos < 1) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertPosition: " + err);
            return;
        }

		var request = new sql.Request();
		// POSITION.Z dei cassetti = 0 per convenzione; l'origine Z è TRAY.Z_CORR
		// (teaching); la componente pezzo viene dall'anagrafica (Z e Z_PICK del PIECE)
		// (tray-teaching, punto D) INSERT...SELECT: ROT e APPROACH ereditati dal
		// TRAY associato (FLOOR_MAG = TRAY_ID del chiamante), COALESCE coi
		// default storici (rot 0, approach type 3 / 100000): comportamento
		// attuale al byte se il TRAY non e' mai stato insegnato. TOP 1 =
		// robustezza contro eventuali doppioni di FLOOR_MAG (mai piu' di una
		// riga inserita). NB: TRAY inesistente -> 0 righe (i chiamanti passano
		// sempre un FLOOR_MAG reale dalla trayList). PREREQUISITO: colonne del
		// DDL scripts/tray-teaching.sql (la SELECT le nomina).
        let query = `INSERT INTO [POSITION]
					(PARENT, POS, SUB_POS, STATUS, X, Y, Z, X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z, Part_Type)
					SELECT 'TRAY_${req.query.TRAY_ID}',
						${req.query.POS},
						${subPos},
						${req.query.STATUS},
						${req.query.X}, ${req.query.Y}, 0,
						COALESCE(t.X_ROT,0), COALESCE(t.Y_ROT,0), COALESCE(t.Z_ROT,0),
						COALESCE(t.APPROACH_TYPE,3), COALESCE(t.APPROACH_X,100000), COALESCE(t.APPROACH_Y,100000), COALESCE(t.APPROACH_Z,100000),
						${req.query.PIECE_TYPE}
					FROM (SELECT TOP 1 X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z
						  FROM TRAY WHERE FLOOR_MAG=${req.query.TRAY_ID}) t
					WHERE NOT EXISTS (SELECT 1 FROM [POSITION] px WHERE ${dupPred} AND px.SUB_POS=${subPos});`;

        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, result) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
				return;
            }
			const n = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
			if (n === 0) {
				log.standard("insertPositionTray KO_DUP: TRAY_" + req.query.TRAY_ID + " SUB_POS " + subPos + " gia' presente");
				res.send("KO_DUP");
			} else
				res.send("OK")
        });
	});
})


//TODO: da testare
router.get('/updatePositionTray', (req, res) => {
	//log.info("updatePositionTray ---> "+JSON.stringify(req.query,null,4));

	// (tray-parent-predicate) via il LIKE 'TRAY_n %': predicato dall'helper
	const pred = trayParentPredicate(req.query.TRAY_ID);
	if (!pred) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertPosition: " + err); 
            return;
        }

		var request = new sql.Request();
		// POSITION.Z dei cassetti = 0 per convenzione; l'origine Z è TRAY.Z_CORR
		// (teaching); la componente pezzo viene dall'anagrafica (Z e Z_PICK del PIECE)
		// (tray-teaching, punto E) Z=0 FISSO. Il param EASYBOX resta accettato e
		// IGNORATO per la Z (prima sceglieva interasse nominale/0 per tipo
		// magazzino): con la convenzione la Z non dipende piu' dal tipo, e i 3
		// chiamanti (Grating/GratingTest/ImportGrating) restano intatti.
		// ROT e APPROACH non vengono toccati qui: il teaching sopravvive alla
		// ri-associazione del grigliato.
        let query = `UPDATE [POSITION] SET 
					STATUS=${req.query.STATUS},
					X=${req.query.X},
					Y=${req.query.Y},
					Part_Type=${req.query.PIECE_TYPE},
					Z=0
					WHERE
						${pred} AND
						POS=${req.query.POS} AND
						SUB_POS=${req.query.SUB_POS};`

        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
            }else
				res.send("OK")
        });
	});
})


//////////////////////////////////////////////////////////
///////////// MAGAZZINI (cantiere AD) ////////////////////
//////////////////////////////////////////////////////////

// Whitelist dei parent ammessi come "magazzino": WPALLET (pallet, 5x4)
// e SHELF (scaffale pinze). Mappa chiusa = niente injection dal path e
// niente usi fuori scope su altri parent di [POSITION].
const WAREHOUSE_PARENTS = { WPALLET: 'WPALLET', SHELF: 'SHELF' };

// AD (R1): lettura posizioni di un magazzino: ID, SUB_POS, STATUS.
// L'OCCUPANTE non viene joinato qui di proposito: lo deriva il client
// dalle liste pallet/gripper gia' in polling nelle view (stessa fonte
// di verita' della tabella a video, niente doppia semantica server).
router.get('/showWarehouse/:parent', (req, res) => {
	const parent = WAREHOUSE_PARENTS[String(req.params.parent || '').toUpperCase()];
	if (!parent) {
		res.json([]);
		return;
	}
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err showWarehouse: " + err);
            return;
        }

		let query = `select ID, SUB_POS, STATUS from [POSITION] where PARENT like '${parent}%' order by SUB_POS;`

		var request = new sql.Request();
        log.info('query ' + query);
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.json([])
            }else
				res.send(recordset.recordset)
        });
	});
})

// AD (R1): set/clear disabilitazione di una posizione magazzino.
// Scrive SOLO STATUS e SOLO le transizioni da/verso 9 (status_locked):
//   disable = qualunque valore -> 9;
//   enable  = 9 -> 2 (SOLO se attualmente 9: un 2/4 scritto in cella
//             non viene MAI riscritto — regola "9=disabilitata,
//             qualunque altro valore=abilitata").
// NON riusa /updateposition (che riscrive le coordinate).
router.get('/warehouseSlot/:action/:parent/:subpos', (req, res) => {
	const parent = WAREHOUSE_PARENTS[String(req.params.parent || '').toUpperCase()];
	const subpos = parseInt(req.params.subpos);
	const action = String(req.params.action);
	if (!parent || isNaN(subpos) || (action != 'disable' && action != 'enable' && action != 'occupy' && action != 'free')) {
		res.status(400).send("KO");
		return;
	}
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err warehouseSlot: " + err);
            return;
        }

		let query;
		if (action == 'disable')
			query = `UPDATE [POSITION] SET STATUS=9 WHERE PARENT like '${parent}%' AND SUB_POS=${subpos};`
		else if (action == 'enable')
			query = `UPDATE [POSITION] SET STATUS=2 WHERE PARENT like '${parent}%' AND SUB_POS=${subpos} AND STATUS=9;`
		// (attrezzaggi-edit-remove-place, D3) flag occupazione casella per la
		// dichiarazione manuale dal dialog posizione: transizioni STRETTE come
		// enable — occupy 2->4 (solo da libera), free 4->2 (solo da occupata),
		// MAI toccato 9 (disabilitata). Idempotenti via check sotto.
		else if (action == 'occupy')
			query = `UPDATE [POSITION] SET STATUS=4 WHERE PARENT like '${parent}%' AND SUB_POS=${subpos} AND STATUS=2;`
		else
			query = `UPDATE [POSITION] SET STATUS=2 WHERE PARENT like '${parent}%' AND SUB_POS=${subpos} AND STATUS=4;`

		var request = new sql.Request();
        log.info('query ' + query);
        request.query(query, function (err, result) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
				return;
            }
			const n = result.rowsAffected && result.rowsAffected[0] ? result.rowsAffected[0] : 0;
			if (n > 0) {
				res.send("OK")
				return;
			}
			if (action == 'enable' || action == 'occupy' || action == 'free') {
				// 0 righe ma stato gia' quello voluto: OK idempotente
				// (enable: non-9; occupy: gia' 4; free: gia' 2)
				let check = `select STATUS from [POSITION] where PARENT like '${parent}%' AND SUB_POS=${subpos};`
				new sql.Request().query(check, function (err2, rs2) {
					if (err2 || rs2.recordset.length == 0) { res.send("KO"); return; }
					const st = rs2.recordset[0].STATUS;
					const okAlready =
						(action == 'enable' && st != 9) ||
						(action == 'occupy' && st == 4) ||
						(action == 'free'   && st == 2);
					res.send(okAlready ? "OK" : "KO")
				});
				return;
			}
			res.send("KO")   // disable su posizione inesistente
        });
	});
})

//utilizzata per la pagina conf/positionView
router.get('/updateposition', (req, res) => {

	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updateposition: " + err); 
            return;
        }

		var request = new sql.Request();
        let query = `UPDATE [POSITION] SET 
					 X=${req.query.X}, 
					 Y=${req.query.Y}, 
					 Z=${req.query.Z}, 
					 X_ROT=${req.query.X_ROT}, 
					 Y_ROT=${req.query.Y_ROT}, 
					 Z_ROT=${req.query.Z_ROT}, 
					 X_CORR=${req.query.X_CORR}, 
					 Y_CORR=${req.query.Y_CORR}, 
					 Z_CORR=${req.query.Z_CORR}, 
					 X_ROT_CORR=${req.query.X_ROT_CORR}, 
					 Y_ROT_CORR=${req.query.Y_ROT_CORR}, 
					 Z_ROT_CORR=${req.query.Z_ROT_CORR},
					 APPROACH_X=${req.query.APPROACH_X},
					 APPROACH_Y=${req.query.APPROACH_Y},
					 APPROACH_Z=${req.query.APPROACH_Z}
					 WHERE ID=${req.query.ID};`

        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
            }else
				res.send("OK")
        });
	});
})

//TODO:da testare
router.delete('/:ID', (req, res) => {
     console.log('delete Position '+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete position: " + err);
            return;
        }
		
		var request = new sql.Request();
        let query = `DELETE FROM POSITION WHERE ID=${req.params.ID};`
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                //res.send("KO")
            }
			//else
			//	res.send("OK")
        });
	});
});

// AZZERA STATO CASSETTO (1/9): tutte le tasche del cassetto a STATUS=4
// (grezzo presente) e Order_ID=0. DICHIARA il cassetto pieno di grezzi: va
// usato solo dopo averlo ricaricato fisicamente. GUARDIA lato backend: nessun
// ordine in STATUS=3 (prima si ferma la produzione — il PLC legge [POSITION]
// in tempo reale). Conteggio PRIMA dell'update (trigger su [POSITION]).
router.post('/resetTray/:floor', (req, res) => {
	const pred = trayParentPredicate(req.params.floor);
	if (!pred) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) { log.error("err resetTray: " + err); res.status(500).send("KO"); return; }
		const query = `SET NOCOUNT ON;
			IF EXISTS (SELECT 1 FROM WORKORDERS WHERE STATUS=3)
				SELECT '${errorCodes.KO_ACTIVE_ORDER}' AS ris, 0 AS positions;
			ELSE BEGIN
				DECLARE @n INT = (SELECT COUNT(*) FROM [POSITION] WHERE ${pred});
				UPDATE [POSITION] SET STATUS=4, Order_ID=0 WHERE ${pred};
				SELECT 'OK' AS ris, @n AS positions;
			END`;
		log.info('query ' + query);
		new sql.Request().query(query, function (err, result) {
			if (err) { log.error("Err query: " + err); res.status(500).send("KO"); return; }
			const row = result.recordset && result.recordset[0] ? result.recordset[0] : { ris: "KO" };
			res.json(row);
			if (row.ris === 'OK')
				log.standard("AZZERA STATO CASSETTO " + req.params.floor + ": " + row.positions + " tasche -> grezzo, Order_ID 0");
		});
	});
});

// ===========================================================================
// DICHIARA IL CONTENUTO DEL CASSETTO (16/9): Part_Type su TUTTE le tasche.
//
// PERCHE' ESISTE. POSITION.Part_Type e' il codice pezzo che il cassetto
// CONTIENE: il ciclo cerca le tasche con STATUS=4 AND Part_Type=<pezzo
// dell'ordine>, e la vista 4Robot aggancia PIECE su quel campo per sapere a
// che quota prendere. Finora nasceva con la griglia e si poteva cambiare solo
// riassociando il grigliato — cioe' rifacendo l'attrezzaggio per svuotare un
// cassetto e riempirlo con un altro particolare. Il grigliato e' la GEOMETRIA
// (quante tasche, che passo) e non cambia: quello che cambia e' cosa c'e'
// dentro. Qui si dichiara, senza toccare la geometria.
//
// In campo, col cassetto FUORI, la stessa dichiarazione la fa il PLC col
// comando 44 (dialog Reimposta stato cella). Questa e' la strada a cassetto
// CHIUSO: il 44 legge DB_BOX_1.ExtractedTray e vale solo sul cassetto
// estratto, quindi non servirebbe quando si prepara la produzione.
//
// TRE GUARDIE, tutte con l'ordine attivo in mente:
//  - il pezzo deve esistere in PIECE: un codice inventato renderebbe l'intero
//    cassetto invisibile alla cella (join INTERNO), pieno sul pannello;
//  - nessun ordine in STATUS=3 sulle tasche di QUESTO cassetto: il PLC legge
//    [POSITION] in tempo reale e cambiare il tipo sotto un ciclo in corso
//    significa cambiargli il pezzo sotto le mani;
//  - il cassetto non deve essere fuori o in manovra (guardia conservativa,
//    come nell'associazione): a cassetto aperto la strada e' il comando 44.
//
// NON tocca STATUS ne' Order_ID: dire cosa c'e' dentro non e' dire quanto ce
// n'e'. Il conteggio dei grezzi resta il gesto separato che gia' esiste.
// Conteggio con COUNT esplicita: su [POSITION] c'e' POSITION_trig e i suoi
// numeri finiscono in rowsAffected prima di quelli della UPDATE.
router.post('/declareTrayType/:floor/:pieceId', (req, res) => {
	const floor = Number(req.params.floor);
	const pred = trayParentPredicate(req.params.floor);
	const predP = trayParentPredicate(req.params.floor, 'p.PARENT');
	const pieceId = parseInt(req.params.pieceId, 10);
	if (!pred || !Number.isInteger(pieceId) || pieceId < 1) { res.status(400).json({ ris: 'KO_BAD_INPUT', positions: 0 }); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) { log.error('err declareTrayType: ' + err); res.status(500).json({ ris: 'KO', positions: 0 }); return; }

		// FASE 1 (sola lettura): tutto quello che serve a decidere, dal DB.
		// Le tasche servono per la verifica di ingombro: sono la geometria VERA
		// del cassetto, non quella teorica del modello.
		const ctx = `SET NOCOUNT ON;
			SELECT
				(SELECT TOP 1 ISNULL([EXTRACT],0) FROM TRAY WHERE FLOOR_MAG=${floor}) AS EXTRACTED,
				(SELECT TOP 1 X FROM TRAY WHERE FLOOR_MAG=${floor}) AS TX,
				(SELECT TOP 1 Y FROM TRAY WHERE FLOOR_MAG=${floor}) AS TY,
				(SELECT TOP 1 g.THICKNESS FROM GRATING g JOIN TRAY t ON t.FAMILY = g.NAME WHERE t.FLOOR_MAG=${floor}) AS THICKNESS,
				p.ID AS PID, p.X AS PX, p.Y AS PY, p.Z_PICK, p.Z_PLACE,
				-- IL CASSETTO E' IN USO DAL CICLO? Due modi, e servono entrambi:
				-- 1) ha tasche PRENOTATE da un ordine attivo (Order_ID, scritto
				--    all'avvio ordine) — e' anche dove tornera' il finito che il
				--    robot ha a bordo, quindi vale anche a cassetto chiuso;
				-- 2) ha grezzi del codice di un ordine attivo. Dal cambio di
				--    modello PLC il ciclo NON guarda piu' Order_ID: pesca su
				--    STATUS=4 AND Part_Type=<pezzo dell'ordine>. Quindi un cassetto
				--    mai prenotato puo' essere lo stesso nel mucchio da cui il
				--    ciclo sta attingendo ADESSO, e cambiargli il codice sotto
				--    glielo toglierebbe di mano.
				CASE WHEN EXISTS (SELECT 1 FROM [POSITION] p2 JOIN WORKORDERS w ON w.ID = p2.Order_ID WHERE ${trayParentPredicate(req.params.floor, 'p2.PARENT')} AND w.STATUS = 3) THEN 1 ELSE 0 END AS RESERVED,
				CASE WHEN EXISTS (SELECT 1 FROM [POSITION] p3 WHERE ${trayParentPredicate(req.params.floor, 'p3.PARENT')} AND p3.STATUS = 4 AND p3.Part_Type IN (SELECT PIECE_ID FROM WORKORDERS WHERE STATUS = 3)) THEN 1 ELSE 0 END AS IN_POOL
			FROM (SELECT 1 AS uno) d
			LEFT JOIN PIECE p ON p.ID = ${pieceId};`;
		log.info('query ' + ctx);
		new sql.Request().query(ctx, function (err, ctxRes) {
			if (err) { log.error('Err query: ' + err); res.status(500).json({ ris: 'KO', positions: 0 }); return; }
			const c = ctxRes.recordset && ctxRes.recordset[0];
			if (!c) { res.status(500).json({ ris: 'KO', positions: 0 }); return; }

			// il codice deve esistere: la vista del PLC aggancia PIECE con un
			// join INTERNO, e un codice inventato renderebbe l'intero cassetto
			// invisibile alla cella — pieno sul pannello, inesistente per il robot
			if (!c.PID) { res.json({ ris: errorCodes.KO_NO_PIECE_DECLARED, positions: 0 }); return; }
			// a cassetto fuori o in manovra la strada e' il comando 44 (pannello
			// robot): il PLC dichiara quello che ha davvero davanti
			if (Number(c.EXTRACTED) !== 0) { res.json({ ris: errorCodes.KO_TRAY_EXTRACTED, positions: 0 }); return; }
			// SOLO il cassetto che il ciclo sta usando: su tutti gli altri il
			// rifornimento a meta' produzione deve passare, ed e' il caso d'uso.
			if (Number(c.RESERVED) === 1 || Number(c.IN_POOL) === 1) {
				log.standard('declareTrayType ' + errorCodes.KO_ACTIVE_ORDER + ': cassetto ' + floor + ' in uso dal ciclo (prenotato ' + c.RESERVED + ', nel mucchio ' + c.IN_POOL + ')');
				res.json({ ris: errorCodes.KO_ACTIVE_ORDER, positions: 0, reserved: Number(c.RESERVED), inPool: Number(c.IN_POOL) });
				return;
			}

			// ANTI-URTO VERTICALE: quota di presa/rilascio sopra il grigliato
			// (stessa regola dell'associazione, stessi valori dal DB)
			const clr = gratingFit.pickClearance({ thickness: c.THICKNESS, zPick: c.Z_PICK, zPlace: c.Z_PLACE });
			if (!clr.ok) {
				log.standard('declareTrayType ' + errorCodes.KO_Z_BELOW_GRATING + ': cassetto ' + floor + ' pezzo ' + pieceId + ' min ' + clr.min);
				res.json({ ris: errorCodes.KO_Z_BELOW_GRATING, positions: 0, min: clr.min, zPick: clr.zPick, zPlace: clr.zPlace, thickness: Number(c.THICKNESS) || 0 });
				return;
			}

			// ANTI-URTO ORIZZONTALE: il pezzo dichiarato deve stare nelle tasche
			// che ci sono. Prima era garantito per costruzione (la griglia nasceva
			// dal pezzo); adesso il codice si dichiara a posteriori, quindi si puo'
			// dichiarare un particolare piu' grande dell'alloggiamento. Nessun
			// controllo a valle lo prenderebbe: la vista 4Robot somma le quote e
			// basta, il robot ci andrebbe sopra.
			new sql.Request().query(`SET NOCOUNT ON; SELECT X, Y FROM [POSITION] WHERE ${pred};`, function (err, posRes) {
				if (err) { log.error('Err query: ' + err); res.status(500).json({ ris: 'KO', positions: 0 }); return; }
				const tasche = (posRes.recordset || []);
				const fit = gratingFit.pieceFitsPockets(tasche, { trayX: c.TX, trayY: c.TY, pieceX: c.PX, pieceY: c.PY });
				if (!fit.ok) {
					log.standard('declareTrayType ' + errorCodes.KO_PIECE_TOO_BIG + ': cassetto ' + floor + ' pezzo ' + pieceId + ' sforo ' + JSON.stringify(fit));
					res.json({ ris: errorCodes.KO_PIECE_TOO_BIG, positions: 0,
						pitch: Math.max(fit.overPitchX, fit.overPitchY), over: Math.max(fit.overW, fit.overH) });
					return;
				}

				// Conteggio con COUNT esplicita: su [POSITION] c'e' POSITION_trig e
				// i suoi numeri finiscono in rowsAffected prima di quelli della UPDATE.
				// NON tocca STATUS ne' Order_ID: dire cosa c'e' dentro non e' dire
				// quanto ce n'e'.
				const upd = `SET NOCOUNT ON;
					DECLARE @n INT = (SELECT COUNT(*) FROM [POSITION] WHERE ${pred});
					UPDATE [POSITION] SET Part_Type=${pieceId} WHERE ${pred};
					SELECT 'OK' AS ris, @n AS positions;`;
				log.info('query ' + upd);
				new sql.Request().query(upd, function (err, result) {
					if (err) { log.error('Err query: ' + err); res.status(500).json({ ris: 'KO', positions: 0 }); return; }
					const row = result.recordset && result.recordset[0] ? result.recordset[0] : { ris: 'KO', positions: 0 };
					res.json(row);
					if (row.ris === 'OK')
						log.standard('DICHIARA CONTENUTO CASSETTO ' + floor + ': ' + row.positions + ' tasche -> pezzo ' + pieceId);
				});
			});
		});
	});
});

router.delete('/deletePositionsTray/:ID', (req, res) => {
     console.log("delete TRAY's position "+req.params.ID);
	// (tray-parent-predicate) :ID = numero cassetto (FLOOR_MAG), validato
	// dall'helper. NB: questa route ora RISPONDE sempre (prima i res.send
	// erano commentati: il fetch della HMI restava appeso e il ciclo di
	// insert di savePositions non partiva mai — bug provato in cella 1/9).
	const pred  = trayParentPredicate(req.params.ID);
	const predP = trayParentPredicate(req.params.ID, 'p.PARENT');
	if (!pred) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete position: " + err);
            res.status(500).send("KO");
            return;
        }

		var request = new sql.Request();
		// Guardia ordine attivo PRIMA della delete (vincolo di sicurezza):
		// nessuna cancellazione su un cassetto con posizione legata a un
		// ordine WORKORDERS.STATUS=3. Esito nel body (error contract).
        let query = `SET NOCOUNT ON;
					IF EXISTS (SELECT 1 FROM [POSITION] p JOIN WORKORDERS w ON w.ID = p.Order_ID WHERE ${predP} AND w.STATUS = 3)
						SELECT '${errorCodes.KO_ACTIVE_ORDER}' AS ris;
					ELSE BEGIN
						DELETE FROM [POSITION] WHERE ${pred};
						SELECT 'OK' AS ris;
					END`

        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, result) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
            }else
				res.send(result.recordset && result.recordset[0] ? result.recordset[0].ris : "KO")
        });
	});
});


module.exports = router;