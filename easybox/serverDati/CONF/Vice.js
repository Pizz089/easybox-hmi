//////// HMI ////////
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('../LogFunct');
const ERR 	= require('../errorCodes');
const audit = require('../auditLog');
// (7/10, prompt 5 di 5) catalogo delle chele della morsa: le tre misure della
// chela sono del TIPO montato (VICE_JAW, VICE.JAW_ID), non piu' della morsa
const J     = require('../viceJawSql');

var templatePATH = '.';

// (7/10) clawLengthSql tolta: la lunghezza della chela non si scrive piu'
// sulla morsa ma sul tipo di chele montato (viceJawSql.intMin, updateVice).

// (8/10, prompt 8) la riga di una morsa per updateVice e insertVice, campo per
// campo: FAMILY e DESCR come stringhe SQL (apici raddoppiati, al massimo 200
// caratteri, le colonne sono nchar(200)); STATUS, X, Y, Z, MAG, MAG_POS e
// POS_PLANT come interi (vuoto o "null" = NULL). null se un campo numerico non
// e' un intero: il chiamante risponde KO_BAD_INPUT.
function rigaMorsa(q) {
	const r = {
		FAMILY: J.sqlStr(q.FAMILY === undefined ? '' : String(q.FAMILY), 200),
		DESCR: J.sqlStr(q.DESCR === undefined ? '' : String(q.DESCR), 200),
	};
	for (const k of ['STATUS', 'X', 'Y', 'Z', 'MAG', 'MAG_POS', 'POS_PLANT']) {
		const v = J.intSql(q[k]);
		if (v === undefined) return null;
		r[k] = v;
	}
	return r;
}

router.get('/show/:ID', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err getTrayFromID: " + err);
            return;
        }

		let query = `select * from VICES ;`
		//console.log("ricevo:" +String(req.params.ID))
		if (String(req.params.ID)!="all") 
			query = `select * from VICES where ID='${req.params.ID}';`
		
		var request = new sql.Request();
        					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, recordset) {
            if (err) {
                log.error("Err query: " + err)
                res.json({})
            }else
				res.send(recordset.recordset)
        });
	});
})

//TODO: da testare
router.get('/updateVice', (req, res) => {

	//console.log(">>>"+JSON.stringify(req.query,null,4));
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err updateVice: " + err);
            return;
        }

		// PALLET_ID (cantiere Attrezzaggi): campo OPZIONALE — la clausola entra
		// solo se il chiamante lo manda (il form storico Vice.vue non lo manda:
		// un undefined interpolato romperebbe la query e azzererebbe il
		// montaggio a ogni salvataggio anagrafica). Monta = intero, smonta =
		// vuoto/non numerico -> NULL. Colonna creata dal guarded ALTER al boot
		// (ensureSchema in server.js).
		let palletClause = '';
		if (req.query.PALLET_ID != undefined) {
			const pid = parseInt(req.query.PALLET_ID);
			palletClause = `, PALLET_ID=${isNaN(pid) ? 'NULL' : pid}`;
		}
		// (8/10, prompt 8) OGNI CAMPO controllato, compreso l'ID della WHERE:
		// prima andavano nella query grezzi, un apice in DESCR faceva perdere il
		// salvataggio e "ID=1 OR 1=1" aggiornava tutte le morse
		const campi = rigaMorsa(req.query);
		if (!campi) { res.status(400).send("KO_BAD_INPUT"); return; }

		// (7/10) LE TRE MISURE DELLA CHELA sono del tipo montato (VICE_JAW),
		// le colonne della morsa restano com'erano alla migrazione e nessuno le
		// scrive piu'. Chi chiama updateVice manda la riga intera, misure
		// comprese, cosi' come l'ha letta da VICES (cioe' dal tipo): un valore
		// UGUALE a quello del tipo, o vuoto, non cambia niente. Un valore
		// DIVERSO va al tipo, con le guardie delle rotte di una misura sola:
		// senza tipo montato KO_NO_JAW, con un ordine a STATUS 3 sul pallet di
		// una morsa con quel tipo KO_JAW_ACTIVE_ORDER, e in quei casi non si
		// scrive niente, nemmeno il resto della riga.
		const id = J.intMin(req.query.ID, 1);
		if (id === null) { res.status(400).send("KO_BAD_INPUT"); return; }
		const cl = J.intMin(req.query.CLAW_LENGTH, 1);
		const zc = J.intMin(req.query.Z_CLAW, 1);
		const zs = J.intMin(req.query.Z_SINK_CLAW, 0);
		const n = v => (v === null ? 'NULL' : v);
		// (8/10) una transazione, con gli ordini letti WITH (UPDLOCK, HOLDLOCK)
		// (viceJawSql.ordineAttivoSuTipo), e @@ROWCOUNT dopo ogni UPDATE: una
		// morsa o un tipo che non c'e' piu' non rispondono OK e non scrivono
		// l'audit
		let query = `SET NOCOUNT ON; SET XACT_ABORT ON;
					BEGIN TRAN;
					DECLARE @id int = ${id}, @found int = 0, @jaw int, @ocl int, @ozc int, @ozs int;
					SELECT @found = 1, @jaw = JAW_ID FROM VICE WITH (UPDLOCK, HOLDLOCK) WHERE ID = @id;
					SELECT @ocl = CLAW_LENGTH, @ozc = Z_CLAW, @ozs = Z_SINK_CLAW FROM VICE_JAW WITH (UPDLOCK, HOLDLOCK) WHERE ID = @jaw;
					DECLARE @cl int = ${n(cl)}, @zc int = ${n(zc)}, @zs int = ${n(zs)};
					DECLARE @misure bit = CASE WHEN (@cl IS NOT NULL AND ISNULL(@ocl, -1) <> @cl)
											 OR (@zc IS NOT NULL AND ISNULL(@ozc, -1) <> @zc)
											 OR (@zs IS NOT NULL AND ISNULL(@ozs, -1) <> @zs) THEN 1 ELSE 0 END;
					DECLARE @ko varchar(40) = CASE
						WHEN @found = 0 THEN '${ERR.KO_NOT_FOUND}'
						WHEN @misure = 1 AND @jaw IS NULL THEN '${ERR.KO_NO_JAW}'
						WHEN @misure = 1 AND ${J.ordineAttivoSuTipo('@jaw')} THEN '${ERR.KO_JAW_ACTIVE_ORDER}'
						ELSE NULL END;
					IF @ko IS NOT NULL BEGIN ROLLBACK; SELECT @ko AS ris; END
					ELSE BEGIN
						UPDATE VICE
						 SET FAMILY=${campi.FAMILY},
						 DESCR=${campi.DESCR},
						 STATUS=${campi.STATUS},
						 X=${campi.X},
						 Y=${campi.Y},
						 Z=${campi.Z},
						 MAG=${campi.MAG},
						 MAG_POS=${campi.MAG_POS},
						 POS_PLANT=${campi.POS_PLANT}${palletClause}
						WHERE ID=@id;
						DECLARE @nv int = @@ROWCOUNT, @nj int = 1;
						IF @nv > 0 AND @misure = 1
						BEGIN
							UPDATE VICE_JAW SET CLAW_LENGTH = ISNULL(@cl, CLAW_LENGTH), Z_CLAW = ISNULL(@zc, Z_CLAW),
								Z_SINK_CLAW = ISNULL(@zs, Z_SINK_CLAW) WHERE ID = @jaw;
							SET @nj = @@ROWCOUNT;
						END
						IF @nv = 0 OR @nj = 0 BEGIN ROLLBACK; SELECT '${ERR.KO_NOT_FOUND}' AS ris; END
						ELSE BEGIN
							COMMIT;
							SELECT 'OK' AS ris, @misure AS misure, @jaw AS jaw, @ocl AS ocl, @ozc AS ozc, @ozs AS ozs,
								   (SELECT RTRIM(CODE) FROM VICE_JAW WHERE ID = @jaw) AS code;
						END
					END`

		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err, result) {
			if (err) {
				log.error("Err query: " + err)
				res.status(500).send("KO")
				return;
			}
			const row = (result && result.recordset && result.recordset[0]) || {};
			if (row.ris !== 'OK') {
				log.standard('updateVice ' + row.ris + ': morsa ' + req.query.ID);
				res.send(row.ris || "KO");
				return;
			}
			if (row.misure) {
				const cambi = [];
				if (cl !== null && cl !== row.ocl) cambi.push('lunghezza chela da ' + (row.ocl == null ? 'non misurata' : row.ocl + ' um') + ' a ' + cl + ' um');
				if (zc !== null && zc !== row.ozc) cambi.push('altezza chela da ' + (row.ozc == null ? 'non misurata' : row.ozc + ' um') + ' a ' + zc + ' um');
				if (zs !== null && zs !== row.ozs) cambi.push('affondo da ' + (row.ozs == null ? 'non misurato' : row.ozs + ' um') + ' a ' + zs + ' um');
				audit.audit('Morsa ID ' + req.query.ID + ', chele ' + row.code + ' (tipo ID ' + row.jaw + '): ' + cambi.join(', '),
					audit.SRC_CONF, 'VICE_JAW:' + row.jaw);
			}
			res.send("OK")
		});
	});
})

//TODO:da testare
router.get('/insertVice', (req, res) => {
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err insertVice: " + err);
            return;
        }
		
		// (7/10) una morsa nuova non ha chele montate: le misure della chela
		// non ha dove scriverle. Una lunghezza, un'altezza o un affondo diversi
		// da zero -> KO_NO_JAW, e la morsa non nasce (si crea senza misure e
		// poi si monta un tipo da Attrezzaggio > Chele morsa). Lo zero di
		// altezza e affondo e' quello che il form manda di suo: si ignora.
		if (J.intMin(req.query.CLAW_LENGTH, 1) !== null || J.intMin(req.query.Z_CLAW, 1) !== null
			|| J.intMin(req.query.Z_SINK_CLAW, 1) !== null) {
			log.standard('insertVice ' + ERR.KO_NO_JAW + ': misure della chela su una morsa nuova');
			res.send(ERR.KO_NO_JAW);
			return;
		}
		// (8/10, prompt 8) VICE.ID e' IDENTITY (in cella: controlli dell'8/10):
		// l'INSERT con l'ID esplicito falliva gia' oggi. L'ID non si manda piu'
		// e torna quello vero (SCOPE_IDENTITY: VICE ha solo un trigger AFTER
		// UPDATE). Ogni campo controllato, come in updateVice.
		const campi = rigaMorsa(req.query);
		if (!campi) { res.status(400).send("KO_BAD_INPUT"); return; }
		var request = new sql.Request();
		let query = `SET NOCOUNT ON;
					INSERT INTO VICE
					(FAMILY, DESCR, STATUS, X, Y, Z, MAG, MAG_POS, POS_PLANT)
					VALUES(${campi.FAMILY},
					${campi.DESCR},
					${campi.STATUS},
					${campi.X},
					${campi.Y},
					${campi.Z},
					${campi.MAG},
					${campi.MAG_POS},
					${campi.POS_PLANT});
					SELECT 'OK' AS ris, CAST(SCOPE_IDENTITY() AS int) AS ID;`
					
        log.info('query ' + query);
        // query to the database and get the records
        request.query(query, function (err, result) {
            if (err) {
                log.error("Err query: " + err)
                res.status(500).send("KO")
            }else {
				const row = (result && result.recordset && result.recordset[0]) || {};
				// (8/10) {"ris":"OK","ID":<nuovo>}: il pannello usa l'ID restituito
				res.json({ ris: row.ris || 'OK', ID: row.ID == null ? null : Number(row.ID) });
			}
        });
	});
})

//TODO:da testare
router.delete('/:ID', (req, res) => {
    console.log('delete VICE '+req.params.ID);
	sql.connect(DBf.configDB, function (err) {
        if (err) {
            log.error("err delete Vice: " + err);
            return;
        }
		
		var request = new sql.Request();
		// (8/10) l'ID controllato, come nelle altre rotte della morsa
		const delId = J.intMin(req.params.ID, 1);
		if (delId === null) { log.standard('delete VICE: ID non valido [' + req.params.ID + ']'); return; }
        let query = `DELETE FROM VICE WHERE ID=${delId};`
					
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


// ===========================================================================
// (push-sim-save 15/9) SALVATAGGIO DI UNA SOLA MISURA
// La pagina di simulazione salva da qui. updateVice non andrebbe bene: scrive
// OGNI colonna dai parametri della query, quindi una chiamata parziale
// scriverebbe stringhe vuote sul resto della riga.
// (8/10) Il ROWCOUNT si controlla davvero (prima lo diceva questo commento ma
// la query non lo faceva: con un JAW_ID orfano rispondeva OK e scriveva
// l'audit): una UPDATE che non tocca righe non risponde OK, e' il difetto
// silenzioso che e' costato l'errore 799.
// La modifica viene tracciata in LOG (auditLog): la conferma a video copre
// l'intenzione, la riga di log rende la provenienza ricostruibile dopo.
//
// (claw-geometry 18/9) LE MISURE DELLA CHELA SONO TRE, NON UNA.
// CLAW_LENGTH (lunghezza), Z_CLAW (altezza della ganascia) e Z_SINK_CLAW
// (affondamento del pezzo nella ganascia) descrivono la CHELA, non il corpo
// morsa: quando l'operatore sostituisce le chele cambiano insieme, e devono
// avere un unico punto dove impostarle. Finora solo CLAW_LENGTH aveva una
// rotta di salvataggio singolo; le altre due si potevano toccare soltanto da
// updateVice, che riscrive tutta la riga — tanto che il form morsa se le fa
// restituire fresche dal database pur di non sovrascriverle.
//
// Una rotta per misura, e il NOME DELLA COLONNA sta scritto qui dentro, a
// letterale: non arriva mai dalla richiesta.
//
// (7/10, prompt 5 di 5) LA MISURA E' DEL TIPO DI CHELE MONTATO sulla morsa
// (VICE_JAW via VICE.JAW_ID), non della morsa: le viste del PLC leggono da
// li'. La rotta resta la stessa (Spinta in battuta, pannello di prima) e
// scrive sul tipo. Senza tipo montato -> KO_NO_JAW. Le misure di un tipo
// valgono per TUTTE le morse che lo hanno montato: con un ordine a STATUS 3
// sul pallet di una di queste -> KO_JAW_ACTIVE_ORDER, nessuna scrittura.
// (8/10) In una transazione, con gli ordini letti WITH (UPDLOCK, HOLDLOCK).
// ===========================================================================
function salvaMisuraChela(req, res, m) {
	const id  = parseInt(req.query.ID, 10);
	const val = parseInt(req.query[m.param], 10);
	// il minimo cambia per misura: una lunghezza e un'altezza a zero non
	// esistono, un affondamento a zero SI' (ganascia piatta, il pezzo appoggia
	// sopra), e non va confuso con "non misurato"
	if (!Number.isInteger(id) || id < 1 || !Number.isInteger(val) || val < m.minimo) {
		res.status(400).send("KO_BAD_INPUT");
		return;
	}
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err " + m.rotta + ": " + err);
			res.status(500).send("KO");
			return;
		}
		let query = `SET NOCOUNT ON; SET XACT_ABORT ON;
					BEGIN TRAN;
					DECLARE @found int = 0, @jaw int, @fam nvarchar(200);
					SELECT @found = 1, @jaw = JAW_ID, @fam = RTRIM(FAMILY) FROM VICE WITH (UPDLOCK, HOLDLOCK) WHERE ID=${id};
					IF @found = 0 BEGIN ROLLBACK; SELECT '${ERR.KO_NOT_FOUND}' AS ris; END
					ELSE IF @jaw IS NULL BEGIN ROLLBACK; SELECT '${ERR.KO_NO_JAW}' AS ris; END
					ELSE IF ${J.ordineAttivoSuTipo('@jaw')} BEGIN ROLLBACK; SELECT '${ERR.KO_JAW_ACTIVE_ORDER}' AS ris; END
					ELSE BEGIN
						DECLARE @old int = (SELECT ${m.colonna} FROM VICE_JAW WITH (UPDLOCK, HOLDLOCK) WHERE ID=@jaw);
						UPDATE VICE_JAW SET ${m.colonna}=${val} WHERE ID=@jaw;
						IF @@ROWCOUNT = 0 BEGIN ROLLBACK; SELECT '${ERR.KO_NOT_FOUND}' AS ris; END
						ELSE BEGIN
							COMMIT;
							SELECT 'OK' AS ris, @old AS old, @fam AS fam, @jaw AS jaw,
								   (SELECT RTRIM(CODE) FROM VICE_JAW WHERE ID=@jaw) AS code,
								   (SELECT COUNT(*) FROM VICE WHERE JAW_ID=@jaw) AS montate;
						END
					END`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err2, recordset) {
			if (err2) {
				log.error("Err query: " + err2);
				res.status(500).send("KO");
				return;
			}
			const row = (recordset.recordset && recordset.recordset[0]) || {};
			if (row.ris !== 'OK') {
				log.standard(m.rotta + ' ' + (row.ris || ERR.KO_NOT_FOUND) + ': morsa ' + id);
				res.send(row.ris || ERR.KO_NOT_FOUND);
				return;
			}
			audit.audit('Morsa ' + row.fam + ' (ID ' + id + '), chele ' + row.code + ' (tipo ID ' + row.jaw + '): '
				+ m.etichetta + ' da ' + (row.old == null ? 'non misurata' : row.old + ' um') + ' a ' + val + ' um'
				+ (row.montate > 1 ? ' (vale per le ' + row.montate + ' morse che le hanno montate)' : ''),
				audit.SRC_PUSH_SIM, 'VICE_JAW:' + row.jaw);
			res.send("OK");
		});
	});
}

// lunghezza delle chele sull'asse di battuta: e' la base del calcolo della
// spinta (COORDINATES_PUSH_MC) e del soffiaggio (COORDINATES_BLOW_MC)
router.get('/setClawLength', (req, res) => salvaMisuraChela(req, res, {
	rotta: 'setClawLength', colonna: 'CLAW_LENGTH', param: 'CLAW_LENGTH',
	etichetta: 'lunghezza chela', minimo: 1,
}))

// altezza della ganascia
router.get('/setClawHeight', (req, res) => salvaMisuraChela(req, res, {
	rotta: 'setClawHeight', colonna: 'Z_CLAW', param: 'Z_CLAW',
	etichetta: 'altezza chela', minimo: 1,
}))

// quanto il pezzo affonda dentro la ganascia. Lo ZERO e' un valore vero
// (ganascia piatta), non un dato mancante: minimo 0.
router.get('/setClawSink', (req, res) => salvaMisuraChela(req, res, {
	rotta: 'setClawSink', colonna: 'Z_SINK_CLAW', param: 'Z_SINK_CLAW',
	etichetta: 'affondo del pezzo nella chela', minimo: 0,
}))
// ===========================================================================
// (push-to-stop 15/9) APPOGGIO DICHIARATO per i pezzi che ECCEDONO la ganascia
// Un pezzo piu' lungo della ganascia non e' un errore: appoggia piu' avanti,
// su un altro riferimento fisico, e quella distanza nessuno la puo' dedurre
// dai dati. Vive in PIECE_ON_VICE, una riga per coppia morsa+pezzo.
//
// LA RIGA E' LA DICHIARAZIONE, NON IL VALORE: riga assente = nessuno ha
// dichiarato dove appoggia (l'ordine viene rifiutato con KO_PUSH_NO_FIT);
// riga con valore 0 = dichiarato che il pezzo, pur sporgendo, tocca ancora la
// fine della ganascia. Per questo la cancellazione della riga e' un'operazione
// vera e non un "metti a zero".
//
// CHIAVE SULLA MORSA e non sul pallet: se la morsa si sposta si porta dietro
// la sua battuta. Con la chiave sul pallet la dichiarazione resterebbe
// attaccata al posto e verrebbe applicata in silenzio alla morsa successiva.
// ===========================================================================

// Elenco delle dichiarazioni di una morsa, con i dati del pezzo che servono
// alla pagina per dire di quanto sporge. Non filtra per lunghezza: una riga
// che non serve piu' (ganascia allungata) deve restare VISIBILE, altrimenti
// sparirebbe senza che nessuno l'abbia cancellata.
router.get('/stops/:viceID', (req, res) => {
	const viceID = parseInt(req.params.viceID, 10);
	if (!Number.isInteger(viceID) || viceID < 1) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err stops: " + err);
			res.status(500).send("KO");
			return;
		}
		// (6/10) anche Z_PUSH, la quota Z della spinta (NULL = alla quota di presa)
		// (8/10) anche il TIPO di chele con cui la battuta e' stata dichiarata
		// (CLAW_JAW_REF) e la sua lunghezza adesso (REF_CLAW_LENGTH), piu' il
		// tipo montato sulla morsa (MOUNTED_JAW_ID): il pannello mostra la
		// battuta corretta per le chele montate, come le viste
		let query = `select pv.VICE_ID, pv.PIECE_ID, pv.STOP_BEYOND_CLAW, pv.COMP_PUSH, pv.Z_PUSH,
							pv.CLAW_JAW_REF, jr.CLAW_LENGTH as REF_CLAW_LENGTH, rtrim(jr.CODE) as REF_JAW_CODE,
							v.JAW_ID as MOUNTED_JAW_ID,
							rtrim(p.FAMILY) as PIECE_FAMILY, rtrim(p.DESCR) as PIECE_DESCR,
							p.X as PIECE_X, p.Y as PIECE_Y, p.PUSH_TO_STOP
					 from PIECE_ON_VICE pv
					 inner join PIECE p on p.ID = pv.PIECE_ID
					 left join VICE v on v.ID = pv.VICE_ID
					 left join VICE_JAW jr on jr.ID = pv.CLAW_JAW_REF
					 where pv.VICE_ID = ${viceID}
					 order by p.FAMILY;`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err, recordset) {
			if (err) {
				log.error("Err query: " + err);
				res.status(500).send("KO");
			} else
				res.send(recordset.recordset);
		});
	});
})

// UPSERT della dichiarazione. UPDATE e poi INSERT se non ha toccato righe:
// l'UPDATE da solo cercherebbe la riga che dovrebbe creare, ed e' esattamente
// il difetto silenzioso costato l'errore 799 sugli attrezzaggi.
router.get('/setStop', (req, res) => {
	const viceID  = parseInt(req.query.VICE_ID, 10);
	const pieceID = parseInt(req.query.PIECE_ID, 10);
	const stop    = parseInt(req.query.STOP_BEYOND_CLAW, 10);
	// lo ZERO e' valido e significativo; il vuoto NO: per togliere la
	// dichiarazione si cancella la riga, non si manda un campo vuoto.
	if (!Number.isInteger(viceID) || viceID < 1
		|| !Number.isInteger(pieceID) || pieceID < 1
		|| !Number.isInteger(stop) || stop < 0) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err setStop: " + err);
			res.status(500).send("KO");
			return;
		}
		// (7/10) la battuta si dichiara con le chele montate ADESSO. (8/10) Il
		// riferimento e' il TIPO montato (CLAW_JAW_REF), non la sua lunghezza:
		// le viste correggono la battuta se poi si monta un tipo diverso, e la
		// fanno seguire alla misura se si corregge quella del tipo. Nessun tipo
		// montato: NULL, nessuna correzione (come prima). Il valore che arriva e'
		// quello che il pannello mostra, cioe' gia' riferito alle chele montate.
		let query = `SET NOCOUNT ON;
					DECLARE @ref int = (SELECT v.JAW_ID FROM VICE v WHERE v.ID=${viceID});
					DECLARE @len int = (SELECT j.CLAW_LENGTH FROM VICE_JAW j WHERE j.ID = @ref);
					UPDATE PIECE_ON_VICE SET STOP_BEYOND_CLAW=${stop}, CLAW_JAW_REF=@ref
					 WHERE VICE_ID=${viceID} AND PIECE_ID=${pieceID};
					IF @@ROWCOUNT = 0
						INSERT INTO PIECE_ON_VICE (VICE_ID, PIECE_ID, STOP_BEYOND_CLAW, CLAW_JAW_REF)
						VALUES (${viceID}, ${pieceID}, ${stop}, @ref);
					SELECT @ref AS ref, @len AS len, (SELECT RTRIM(CODE) FROM VICE_JAW WHERE ID = @ref) AS code;`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err, result) {
			if (err) {
				log.error("Err query: " + err);
				res.status(500).send("KO");
			} else {
				const r0 = (result && result.recordset && result.recordset[0]) || {};
				audit.audit('Morsa ID ' + viceID + ', pezzo ID ' + pieceID
					+ ': appoggio dichiarato a ' + stop + ' um oltre la fine della chela'
					+ (r0.ref == null ? ' (nessun tipo di chele montato)' : ' (chele ' + r0.code + ', tipo ID ' + r0.ref
						+ (r0.len == null ? ', non misurate' : ', ' + r0.len + ' um') + ')'),
					audit.SRC_PUSH_SIM, 'PIECE_ON_VICE:' + viceID + ':' + pieceID);
				res.send("OK");
			}
		});
	});
})

// COMPENSAZIONE SPINTA (COMP_PUSH): accorcia la corsa, per i semilavorati che
// non devono arrivare in battuta. Stessa chiave di STOP_BEYOND_CLAW.
//
// SOLO UPDATE, NESSUN UPSERT — e' una scelta, non una dimenticanza. Creare la
// riga qui vorrebbe dire inventare uno STOP_BEYOND_CLAW, e lo ZERO non e'
// "nessun appoggio": e' l'appoggio dichiarato alla fine ESATTA della ganascia.
// Per un pezzo che sporge l'ordine passerebbe da NO_FIT ("manca un dato,
// compilalo") a NO_ROOM ("la geometria non ci sta"), mandando l'operatore in
// un vicolo cieco su un dato che non ha mai inserito.
// Riga assente -> KO_NOT_FOUND: prima si dichiara l'appoggio, poi si compensa.
//
// A differenza dell'appoggio dichiarato, qui lo ZERO e l'assenza vogliono dire
// la stessa cosa (nessuna compensazione): il campo vuoto e' ammesso e scrive
// NULL, senza bisogno di una rotta di cancellazione separata.
router.get('/setCompPush', (req, res) => {
	const viceID  = parseInt(req.query.VICE_ID, 10);
	const pieceID = parseInt(req.query.PIECE_ID, 10);
	const raw     = req.query.COMP_PUSH;
	const vuoto   = raw === undefined || String(raw).trim() === '';
	const comp    = vuoto ? null : parseInt(raw, 10);
	if (!Number.isInteger(viceID) || viceID < 1
		|| !Number.isInteger(pieceID) || pieceID < 1
		|| (!vuoto && (!Number.isInteger(comp) || comp < 0))) { res.status(400).send("KO_BAD_INPUT"); return; }
	const val = vuoto ? 'NULL' : String(comp);
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err setCompPush: " + err);
			res.status(500).send("KO");
			return;
		}
		// UPDATE a zero righe = riga assente, e va DETTO: una UPDATE che non
		// tocca niente e risponde OK e' il difetto silenzioso costato l'errore
		// 799 sugli attrezzaggi. @@ROWCOUNT esplicito, SET NOCOUNT ON perche'
		// su [PIECE_ON_VICE] i conteggi di eventuali trigger lo falserebbero.
		let query = `SET NOCOUNT ON;
					UPDATE PIECE_ON_VICE SET COMP_PUSH=${val}
					 WHERE VICE_ID=${viceID} AND PIECE_ID=${pieceID};
					SELECT @@ROWCOUNT AS n;`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err, result) {
			if (err) {
				log.error("Err query: " + err);
				res.status(500).send("KO");
				return;
			}
			const row = result.recordset && result.recordset[0];
			if (!row || !row.n) {
				log.standard('setCompPush ' + ERR.KO_NOT_FOUND + ': morsa ' + viceID
					+ ' pezzo ' + pieceID + ' senza riga PIECE_ON_VICE');
				res.send(ERR.KO_NOT_FOUND);
				return;
			}
			audit.audit('Morsa ID ' + viceID + ', pezzo ID ' + pieceID
				+ ': compensazione spinta ' + (vuoto ? 'rimossa' : comp + ' um'),
				audit.SRC_PUSH_SIM, 'PIECE_ON_VICE:' + viceID + ':' + pieceID);
			res.send("OK");
		});
	});
})

// (6/10) QUOTA Z DELLA SPINTA (Z_PUSH): l'altezza della chela dal FONDO del
// pezzo durante la spinta, da 0 alla quota di presa del grezzo (PIECE.Z_PICK).
// Vuoto = NULL = alla quota di presa, cioe' alla Z del deposito: come prima.
// Stessa chiave e STESSA REGOLA di COMP_PUSH: SOLO UPDATE, NESSUN UPSERT. La
// riga nasce dichiarando l'appoggio; senza riga -> KO_NOT_FOUND.
// Il limite superiore si legge dal DB nella stessa query, MAI dal payload: il
// pannello lo mostra, ma il valore che decide e' quello del pezzo adesso.
// Oltre la quota di presa, o pezzo senza quota di presa -> KO_Z_PUSH_RANGE e
// nessuna scrittura. La vista COORDINATES_PUSH_MC tratterebbe comunque un
// valore fuori campo come vuoto (Z_PUSH_DROP = 0), ma qui non deve entrare.
router.get('/setZPush', (req, res) => {
	const viceID  = parseInt(req.query.VICE_ID, 10);
	const pieceID = parseInt(req.query.PIECE_ID, 10);
	const raw     = req.query.Z_PUSH;
	const vuoto   = raw === undefined || String(raw).trim() === '';
	const z       = vuoto ? null : Number(String(raw).trim());
	if (!Number.isInteger(viceID) || viceID < 1
		|| !Number.isInteger(pieceID) || pieceID < 1
		|| (!vuoto && (!Number.isInteger(z) || z < 0))) { res.status(400).send("KO_BAD_INPUT"); return; }
	const val = vuoto ? 'NULL' : String(z);
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err setZPush: " + err);
			res.status(500).send("KO");
			return;
		}
		// la riga c'e'? e la quota di presa del pezzo, ADESSO. L'UPDATE parte
		// solo se c'e' la riga e (valore vuoto oppure dentro 0..Z_PICK).
		let query = `SET NOCOUNT ON;
					DECLARE @riga int = (SELECT COUNT(*) FROM PIECE_ON_VICE WHERE VICE_ID=${viceID} AND PIECE_ID=${pieceID});
					DECLARE @zpick int = (SELECT Z_PICK FROM PIECE WHERE ID=${pieceID});
					DECLARE @n int = 0;
					IF @riga > 0 AND (${vuoto ? '1 = 1' : '@zpick IS NOT NULL AND ' + val + ' <= @zpick'})
					BEGIN
						UPDATE PIECE_ON_VICE SET Z_PUSH=${val}
						 WHERE VICE_ID=${viceID} AND PIECE_ID=${pieceID};
						SET @n = @@ROWCOUNT;
					END
					SELECT @riga AS riga, @zpick AS z_pick, @n AS n;`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err, result) {
			if (err) {
				log.error("Err query: " + err);
				res.status(500).send("KO");
				return;
			}
			const row = (result.recordset && result.recordset[0]) || {};
			if (!row.riga) {
				log.standard('setZPush ' + ERR.KO_NOT_FOUND + ': morsa ' + viceID
					+ ' pezzo ' + pieceID + ' senza riga PIECE_ON_VICE');
				res.send(ERR.KO_NOT_FOUND);
				return;
			}
			if (!row.n) {
				log.standard('setZPush ' + ERR.KO_Z_PUSH_RANGE + ': morsa ' + viceID + ' pezzo ' + pieceID
					+ ' Z_PUSH ' + val + ' fuori da 0..' + (row.z_pick === null || row.z_pick === undefined ? 'NULL' : row.z_pick));
				res.send(ERR.KO_Z_PUSH_RANGE);
				return;
			}
			audit.audit('Morsa ID ' + viceID + ', pezzo ID ' + pieceID
				+ ': quota Z della spinta ' + (vuoto ? 'rimossa (alla quota di presa)' : z + ' um dal fondo del pezzo'),
				audit.SRC_PUSH_SIM, 'PIECE_ON_VICE:' + viceID + ':' + pieceID);
			res.send("OK");
		});
	});
})

// Cancellazione della dichiarazione: il riferimento fisico non c'e' piu', e
// da quel momento gli ordini con quel pezzo su quella morsa tornano a essere
// rifiutati. E' il comportamento voluto, non un effetto collaterale.
router.get('/deleteStop', (req, res) => {
	const viceID  = parseInt(req.query.VICE_ID, 10);
	const pieceID = parseInt(req.query.PIECE_ID, 10);
	if (!Number.isInteger(viceID) || viceID < 1
		|| !Number.isInteger(pieceID) || pieceID < 1) { res.status(400).send("KO_BAD_INPUT"); return; }
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err deleteStop: " + err);
			res.status(500).send("KO");
			return;
		}
		let query = `DELETE FROM PIECE_ON_VICE WHERE VICE_ID=${viceID} AND PIECE_ID=${pieceID};`;
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err) {
			if (err) {
				log.error("Err query: " + err);
				res.status(500).send("KO");
			} else {
				audit.audit('Morsa ID ' + viceID + ', pezzo ID ' + pieceID
					+ ': appoggio dichiarato RIMOSSO (gli ordini con quel pezzo tornano a essere rifiutati)',
					audit.SRC_PUSH_SIM, 'PIECE_ON_VICE:' + viceID + ':' + pieceID);
				res.send("OK");
			}
		});
	});
})

module.exports = router;