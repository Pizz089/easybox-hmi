//////// HMI ////////
// ============================================================================
// CONF/ViceJaw.js — CATALOGO DELLE CHELE DELLA MORSA (7/10, prompt 5 di 5;
// correzioni dell'audit 8/10, prompt 8)
//
// Decisione di Dario (7/10): catalogo per riferimento. Un tipo di chele
// (VICE_JAW) porta le tre misure che il sistema usa (lunghezza sull'asse di
// battuta, altezza, affondo), la morsa punta al tipo montato (VICE.JAW_ID) e
// le viste lette dal PLC prendono le misure dal catalogo: dato unico.
// Montato su /api/conf/viceJaw.
//
//   GET  /show/all            i tipi, con le morse su cui sono montati e
//                             quanti ordini li usano
//   GET  /show/:ID            un tipo, idem
//   GET  /insertJaw           crea (CODE unico, tre misure obbligatorie)
//   GET  /updateJaw           modifica; le MISURE di un tipo montato su una
//                             morsa con un ordine a STATUS 3 sul suo pallet non
//                             si toccano (KO_JAW_ACTIVE_ORDER). (8/10) Una
//                             misura vuota e' NULL (un tipo nato dalla
//                             migrazione puo' averne una NULL); DESCR e NOTE
//                             non mandati restano com'erano
//   GET  /setJawStatus        dismetti (0) o riattiva (1); un tipo montato non
//                             si dismette (KO_JAW_MOUNTED)
//   DELETE /:ID               solo un tipo MAI montato e MAI usato da un
//                             ordine (KO_JAW_IN_USE): il cliente ha gia'
//                             cancellato cassetti che non doveva
//   GET  /mountJaw            monta un tipo su una morsa (VICE.JAW_ID; vuoto =
//                             smonta), con la guardia sugli ordini a STATUS 3
//                             del suo pallet; un tipo dismesso non si monta
//                             (KO_JAW_RETIRED). (8/10) Senza piu' l'ORDER_ID
//                             da escludere dalla guardia: un intero qualsiasi
//                             mandato dal client la saltava
//   GET  /confirmOrderJaw     le chele con cui l'ordine e' confermato
//                             (WORKORDER.JAW_ID). (8/10) Il controllo e' al
//                             passaggio a STATUS 3 (Play e rilancio:
//                             KO_ORDER_JAW_MISMATCH, viceJawSql.koChelePlay),
//                             non piu' nella vista COORDINATES_Z_MC
//
// (8/10) Le scritture con una guardia sono in UNA transazione (SET XACT_ABORT
// ON; BEGIN TRAN) con gli ordini letti WITH (UPDLOCK, HOLDLOCK), e ogni UPDATE
// controlla @@ROWCOUNT: una riga che non c'e' piu' non risponde OK e non
// scrive l'audit.
// Ogni scrittura va in LOG (auditLog), con il prima e il dopo. I livelli
// utente li applica il pannello, come per le altre pagine di configurazione.
// Le risposte seguono le rotte di CONF/Vice.js: 200 "OK" oppure 200 col
// codice di rifiuto (errorCodes), 400 KO_BAD_INPUT, 500 KO.
// ============================================================================
var express = require('express');
const DBf 	= require('../DBFunct');
var sql 	= require('mssql')
var router 	= express.Router();
const log 	= require('../LogFunct');
const ERR 	= require('../errorCodes');
const audit = require('../auditLog');
const J     = require('../viceJawSql');

const mm = v => (v === null || v === undefined ? 'non misurata' : Math.round(Number(v) / 100) / 10 + ' mm');

// esegue una query e passa il risultato; errore di connessione o di query -> 500
function esegui(res, nome, query, ok) {
	sql.connect(DBf.configDB, function (err) {
		if (err) {
			log.error("err " + nome + ": " + err);
			res.status(500).send("KO");
			return;
		}
		var request = new sql.Request();
		log.info('query ' + query);
		request.query(query, function (err2, result) {
			if (err2) {
				log.error("Err query " + nome + ": " + err2);
				res.status(500).send("KO");
				return;
			}
			ok(result || {});
		});
	});
}

// i tipi, con le morse su cui sono montati (MOUNTED_ON) e gli ordini che li
// usano (ORDERS). Due SELECT e l'unione qui: niente STRING_AGG, la cella puo'
// avere un livello di compatibilita' vecchio.
function elenco(res, where) {
	const query = `SET NOCOUNT ON;
				SELECT j.ID, RTRIM(j.CODE) AS CODE, RTRIM(j.DESCR) AS DESCR, j.CLAW_LENGTH, j.Z_CLAW, j.Z_SINK_CLAW,
					   j.STATUS, RTRIM(j.NOTE) AS NOTE, j.EVER_MOUNTED,
					   (SELECT COUNT(*) FROM WORKORDER w WHERE w.JAW_ID = j.ID) AS ORDERS
				  FROM VICE_JAW j ${where} ORDER BY j.STATUS DESC, j.CODE;
				SELECT v.ID, RTRIM(v.FAMILY) AS FAMILY, v.PALLET_ID, v.JAW_ID FROM VICE v WHERE v.JAW_ID IS NOT NULL ORDER BY v.ID;`;
	esegui(res, 'viceJaw show', query, result => {
		const sets = result.recordsets || [result.recordset || []];
		const tipi = sets[0] || [];
		const morse = sets[1] || [];
		for (const t of tipi)
			t.MOUNTED_ON = morse.filter(v => v.JAW_ID === t.ID).map(v => ({ ID: v.ID, FAMILY: v.FAMILY, PALLET_ID: v.PALLET_ID }));
		res.send(tipi);
	});
}

router.get('/show/:ID', (req, res) => {
	if (String(req.params.ID) === 'all') { elenco(res, ''); return; }
	const id = J.intMin(req.params.ID, 1);
	if (id === null) { res.status(400).send("KO_BAD_INPUT"); return; }
	elenco(res, 'WHERE j.ID = ' + id);
})

// le tre misure in micron, tutte obbligatorie (un tipo NUOVO): lunghezza e
// altezza > 0, affondo >= 0 (lo zero e' un valore vero: chela piatta)
function misure(q) {
	return {
		cl: J.intMin(q.CLAW_LENGTH, 1),
		zc: J.intMin(q.Z_CLAW, 1),
		zs: J.intMin(q.Z_SINK_CLAW, 0),
	};
}
// (8/10) in MODIFICA una misura vuota (o "null") e' NULL: un tipo nato dalla
// migrazione puo' avere la lunghezza NULL (la morsa non l'aveva), e il resto
// si deve poter salvare. Un valore che non e' un intero valido: undefined
// (KO_BAD_INPUT).
function misuraOpz(raw, minimo) {
	if (raw === undefined || raw === null) return null;
	const t = String(raw).trim();
	if (t === '' || t.toLowerCase() === 'null') return null;
	const n = J.intMin(t, minimo);
	return n === null ? undefined : n;
}
const codice = raw => String(raw === undefined || raw === null ? '' : raw).trim().slice(0, 100);
const sqlN = v => (v === null ? 'NULL' : String(v));

router.get('/insertJaw', (req, res) => {
	const code = codice(req.query.CODE);
	const m = misure(req.query);
	if (!code || m.cl === null || m.zc === null || m.zs === null) { res.status(400).send("KO_BAD_INPUT"); return; }
	const query = `SET NOCOUNT ON;
				IF EXISTS (SELECT 1 FROM VICE_JAW WHERE CODE = ${J.sqlStr(code, 100)})
					SELECT '${ERR.KO_JAW_DUP_CODE}' AS ris;
				ELSE BEGIN
					DECLARE @n TABLE (ID int);
					INSERT INTO VICE_JAW (CODE, DESCR, CLAW_LENGTH, Z_CLAW, Z_SINK_CLAW, STATUS, NOTE, EVER_MOUNTED)
					OUTPUT inserted.ID INTO @n
					VALUES (${J.sqlStr(code, 100)}, ${J.sqlStr(req.query.DESCR || '', 200)}, ${m.cl}, ${m.zc}, ${m.zs},
							${J.JAW_ATTIVO}, ${J.sqlStr(req.query.NOTE || '', 1000)}, 0);
					SELECT 'OK' AS ris, ID FROM @n;
				END`;
	esegui(res, 'insertJaw', query, result => {
		const row = (result.recordset && result.recordset[0]) || {};
		if (row.ris !== 'OK') { res.send(row.ris || "KO"); return; }
		audit.audit('Chele morsa ' + code + ' (tipo ID ' + row.ID + '): creato, lunghezza ' + m.cl + ' um, altezza '
			+ m.zc + ' um, affondo ' + m.zs + ' um', audit.SRC_CONF, 'VICE_JAW:' + row.ID);
		res.send("OK");
	});
})

router.get('/updateJaw', (req, res) => {
	const id = J.intMin(req.query.ID, 1);
	const code = codice(req.query.CODE);
	const m = {
		cl: misuraOpz(req.query.CLAW_LENGTH, 1),
		zc: misuraOpz(req.query.Z_CLAW, 1),
		zs: misuraOpz(req.query.Z_SINK_CLAW, 0),
	};
	if (id === null || !code || m.cl === undefined || m.zc === undefined || m.zs === undefined) { res.status(400).send("KO_BAD_INPUT"); return; }
	// (8/10) DESCR e NOTE non mandati: restano com'erano (prima diventavano vuoti)
	const descr = req.query.DESCR === undefined ? 'DESCR' : J.sqlStr(req.query.DESCR, 200);
	const note = req.query.NOTE === undefined ? 'NOTE' : J.sqlStr(req.query.NOTE, 1000);
	const query = `SET NOCOUNT ON; SET XACT_ABORT ON;
				BEGIN TRAN;
				DECLARE @id int = ${id}, @found int = 0, @ocl int, @ozc int, @ozs int, @ocode nvarchar(100);
				SELECT @found = 1, @ocl = CLAW_LENGTH, @ozc = Z_CLAW, @ozs = Z_SINK_CLAW, @ocode = RTRIM(CODE)
				  FROM VICE_JAW WITH (UPDLOCK, HOLDLOCK) WHERE ID = @id;
				DECLARE @misure bit = CASE WHEN ISNULL(@ocl, -1) <> ISNULL(${sqlN(m.cl)}, -1) OR ISNULL(@ozc, -1) <> ISNULL(${sqlN(m.zc)}, -1)
										 OR ISNULL(@ozs, -1) <> ISNULL(${sqlN(m.zs)}, -1) THEN 1 ELSE 0 END;
				DECLARE @ko varchar(40) = CASE
					WHEN @found = 0 THEN '${ERR.KO_NOT_FOUND}'
					WHEN EXISTS (SELECT 1 FROM VICE_JAW WHERE CODE = ${J.sqlStr(code, 100)} AND ID <> @id) THEN '${ERR.KO_JAW_DUP_CODE}'
					WHEN @misure = 1 AND ${J.ordineAttivoSuTipo('@id')} THEN '${ERR.KO_JAW_ACTIVE_ORDER}'
					ELSE NULL END;
				IF @ko IS NOT NULL BEGIN ROLLBACK; SELECT @ko AS ris; END
				ELSE BEGIN
					UPDATE VICE_JAW SET CODE = ${J.sqlStr(code, 100)}, DESCR = ${descr}, NOTE = ${note},
						CLAW_LENGTH = ${sqlN(m.cl)}, Z_CLAW = ${sqlN(m.zc)}, Z_SINK_CLAW = ${sqlN(m.zs)}
					 WHERE ID = @id;
					IF @@ROWCOUNT = 0 BEGIN ROLLBACK; SELECT '${ERR.KO_NOT_FOUND}' AS ris; END
					ELSE BEGIN
						COMMIT;
						SELECT 'OK' AS ris, @misure AS misure, @ocl AS ocl, @ozc AS ozc, @ozs AS ozs, @ocode AS ocode,
							   (SELECT COUNT(*) FROM VICE WHERE JAW_ID = @id) AS montate;
					END
				END`;
	esegui(res, 'updateJaw', query, result => {
		const row = (result.recordset && result.recordset[0]) || {};
		if (row.ris !== 'OK') { res.send(row.ris || "KO"); return; }
		const cambi = [];
		if (row.ocl !== m.cl) cambi.push('lunghezza da ' + mm(row.ocl) + ' a ' + mm(m.cl));
		if (row.ozc !== m.zc) cambi.push('altezza da ' + mm(row.ozc) + ' a ' + mm(m.zc));
		if (row.ozs !== m.zs) cambi.push('affondo da ' + mm(row.ozs) + ' a ' + mm(m.zs));
		if (row.ocode !== code) cambi.push('codice da ' + row.ocode + ' a ' + code);
		if (cambi.length)
			audit.audit('Chele morsa ' + code + ' (tipo ID ' + id + '): ' + cambi.join(', ')
				+ (row.montate ? ' (montate su ' + row.montate + ' morse)' : ''), audit.SRC_CONF, 'VICE_JAW:' + id);
		res.send("OK");
	});
})

router.get('/setJawStatus', (req, res) => {
	const id = J.intMin(req.query.ID, 1);
	const st = String(req.query.STATUS);
	if (id === null || (st !== '0' && st !== '1')) { res.status(400).send("KO_BAD_INPUT"); return; }
	const query = `SET NOCOUNT ON; SET XACT_ABORT ON;
				BEGIN TRAN;
				DECLARE @id int = ${id}, @found int = 0, @code nvarchar(100);
				SELECT @found = 1, @code = RTRIM(CODE) FROM VICE_JAW WITH (UPDLOCK, HOLDLOCK) WHERE ID = @id;
				IF @found = 0 BEGIN ROLLBACK; SELECT '${ERR.KO_NOT_FOUND}' AS ris; END
				ELSE IF ${st} = ${J.JAW_DISMESSO} AND EXISTS (SELECT 1 FROM VICE WITH (UPDLOCK, HOLDLOCK) WHERE JAW_ID = @id)
					BEGIN ROLLBACK; SELECT '${ERR.KO_JAW_MOUNTED}' AS ris; END
				ELSE BEGIN
					UPDATE VICE_JAW SET STATUS = ${st} WHERE ID = @id;
					COMMIT;
					SELECT 'OK' AS ris, @code AS code;
				END`;
	esegui(res, 'setJawStatus', query, result => {
		const row = (result.recordset && result.recordset[0]) || {};
		if (row.ris !== 'OK') { res.send(row.ris || "KO"); return; }
		audit.audit('Chele morsa ' + row.code + ' (tipo ID ' + id + '): ' + (st === '0' ? 'dismesso' : 'riattivato'),
			audit.SRC_CONF, 'VICE_JAW:' + id);
		res.send("OK");
	});
})

router.delete('/:ID', (req, res) => {
	const id = J.intMin(req.params.ID, 1);
	if (id === null) { res.status(400).send("KO_BAD_INPUT"); return; }
	// (8/10) in transazione, con morse e ordini letti WITH (UPDLOCK, HOLDLOCK):
	// nessuno lo monta o lo conferma fra il controllo e la cancellazione
	const query = `SET NOCOUNT ON; SET XACT_ABORT ON;
				BEGIN TRAN;
				DECLARE @id int = ${id}, @found int = 0, @code nvarchar(100), @ever bit;
				SELECT @found = 1, @code = RTRIM(CODE), @ever = EVER_MOUNTED FROM VICE_JAW WITH (UPDLOCK, HOLDLOCK) WHERE ID = @id;
				IF @found = 0 BEGIN ROLLBACK; SELECT '${ERR.KO_NOT_FOUND}' AS ris; END
				ELSE IF @ever = 1 OR EXISTS (SELECT 1 FROM VICE WITH (UPDLOCK, HOLDLOCK) WHERE JAW_ID = @id)
					 OR EXISTS (SELECT 1 FROM WORKORDER WITH (UPDLOCK, HOLDLOCK) WHERE JAW_ID = @id)
					 OR EXISTS (SELECT 1 FROM PIECE_ON_VICE WITH (UPDLOCK, HOLDLOCK) WHERE CLAW_JAW_REF = @id)
					BEGIN ROLLBACK; SELECT '${ERR.KO_JAW_IN_USE}' AS ris; END
				ELSE BEGIN
					DELETE FROM VICE_JAW WHERE ID = @id;
					IF @@ROWCOUNT = 0 BEGIN ROLLBACK; SELECT '${ERR.KO_NOT_FOUND}' AS ris; END
					ELSE BEGIN COMMIT; SELECT 'OK' AS ris, @code AS code; END
				END`;
	esegui(res, 'deleteJaw', query, result => {
		const row = (result.recordset && result.recordset[0]) || {};
		if (row.ris !== 'OK') { res.send(row.ris || "KO"); return; }
		audit.audit('Chele morsa ' + row.code + ' (tipo ID ' + id + '): cancellato (mai montato, mai usato da un ordine)',
			audit.SRC_CONF, 'VICE_JAW:' + id);
		res.send("OK");
	});
});

// MONTA un tipo sulla morsa (JAW_ID vuoto = smonta). Con un ordine a STATUS 3
// sul pallet della morsa: KO_JAW_ACTIVE_ORDER, sempre (8/10: niente piu'
// ORDER_ID da escludere).
router.get('/mountJaw', (req, res) => {
	const vice = J.intMin(req.query.VICE_ID, 1);
	const vuoto = req.query.JAW_ID === undefined || String(req.query.JAW_ID).trim() === '';
	const jaw = vuoto ? null : J.intMin(req.query.JAW_ID, 1);
	if (vice === null || (!vuoto && jaw === null)) { res.status(400).send("KO_BAD_INPUT"); return; }
	const query = `SET NOCOUNT ON; SET XACT_ABORT ON;
				BEGIN TRAN;
				DECLARE @vice int = ${vice}, @jaw int = ${jaw === null ? 'NULL' : jaw}, @found int = 0, @pallet int, @old int, @fam nvarchar(200);
				SELECT @found = 1, @pallet = PALLET_ID, @old = JAW_ID, @fam = RTRIM(FAMILY) FROM VICE WITH (UPDLOCK, HOLDLOCK) WHERE ID = @vice;
				DECLARE @jst int = (SELECT STATUS FROM VICE_JAW WITH (UPDLOCK, HOLDLOCK) WHERE ID = @jaw);
				IF @found = 0 OR (@jaw IS NOT NULL AND @jst IS NULL) BEGIN ROLLBACK; SELECT '${ERR.KO_NOT_FOUND}' AS ris; END
				ELSE IF @jaw IS NOT NULL AND @jst <> ${J.JAW_ATTIVO} BEGIN ROLLBACK; SELECT '${ERR.KO_JAW_RETIRED}' AS ris; END
				ELSE IF ISNULL(@old, -1) = ISNULL(@jaw, -1) BEGIN COMMIT; SELECT 'OK' AS ris, 0 AS cambiato; END
				ELSE IF @pallet IS NOT NULL AND ${J.ordineAttivoSuPallet('@pallet')} BEGIN ROLLBACK; SELECT '${ERR.KO_JAW_ACTIVE_ORDER}' AS ris; END
				ELSE BEGIN
					UPDATE VICE SET JAW_ID = @jaw WHERE ID = @vice;
					IF @@ROWCOUNT = 0 BEGIN ROLLBACK; SELECT '${ERR.KO_NOT_FOUND}' AS ris; END
					ELSE BEGIN
						IF @jaw IS NOT NULL UPDATE VICE_JAW SET EVER_MOUNTED = 1 WHERE ID = @jaw;
						COMMIT;
						SELECT 'OK' AS ris, 1 AS cambiato, @fam AS fam,
							   (SELECT RTRIM(CODE) FROM VICE_JAW WHERE ID = @old) AS da,
							   (SELECT RTRIM(CODE) FROM VICE_JAW WHERE ID = @jaw) AS a;
					END
				END`;
	esegui(res, 'mountJaw', query, result => {
		const row = (result.recordset && result.recordset[0]) || {};
		if (row.ris !== 'OK') { res.send(row.ris || "KO"); return; }
		if (row.cambiato)
			audit.audit('Morsa ' + row.fam + ' (ID ' + vice + '): chele da ' + (row.da || 'nessuna') + ' a ' + (row.a || 'nessuna'),
				audit.SRC_CONF, 'VICE:' + vice);
		res.send("OK");
	});
})

// le chele con cui l'ordine e' confermato. Su un ordine gia' a STATUS 3 non si
// cambiano: il PLC lo sta eseguendo.
router.get('/confirmOrderJaw', (req, res) => {
	const ord = J.intMin(req.query.ORDER_ID, 1);
	const jaw = J.intMin(req.query.JAW_ID, 1);
	if (ord === null || jaw === null) { res.status(400).send("KO_BAD_INPUT"); return; }
	const query = `SET NOCOUNT ON; SET XACT_ABORT ON;
				BEGIN TRAN;
				DECLARE @o int = ${ord}, @jaw int = ${jaw}, @found int = 0, @st int, @old int;
				SELECT @found = 1, @st = STATUS, @old = JAW_ID FROM WORKORDER WITH (UPDLOCK, HOLDLOCK) WHERE ID = @o;
				DECLARE @jst int = (SELECT STATUS FROM VICE_JAW WITH (UPDLOCK, HOLDLOCK) WHERE ID = @jaw);
				IF @found = 0 OR @jst IS NULL BEGIN ROLLBACK; SELECT '${ERR.KO_NOT_FOUND}' AS ris; END
				ELSE IF @jst <> ${J.JAW_ATTIVO} BEGIN ROLLBACK; SELECT '${ERR.KO_JAW_RETIRED}' AS ris; END
				ELSE IF @st = ${J.ORDINE_ATTIVO} AND ISNULL(@old, -1) <> @jaw BEGIN ROLLBACK; SELECT '${ERR.KO_JAW_ACTIVE_ORDER}' AS ris; END
				ELSE BEGIN
					UPDATE WORKORDER SET JAW_ID = @jaw WHERE ID = @o;
					IF @@ROWCOUNT = 0 BEGIN ROLLBACK; SELECT '${ERR.KO_NOT_FOUND}' AS ris; END
					ELSE BEGIN
						COMMIT;
						SELECT 'OK' AS ris, (SELECT RTRIM(CODE) FROM VICE_JAW WHERE ID = @old) AS da,
							   (SELECT RTRIM(CODE) FROM VICE_JAW WHERE ID = @jaw) AS a;
					END
				END`;
	esegui(res, 'confirmOrderJaw', query, result => {
		const row = (result.recordset && result.recordset[0]) || {};
		if (row.ris !== 'OK') { res.send(row.ris || "KO"); return; }
		audit.audit('Ordine ' + ord + ': chele confermate ' + row.a + (row.da && row.da !== row.a ? ' (prima ' + row.da + ')' : ''),
			audit.SRC_ORDER, 'WORKORDER:' + ord);
		res.send("OK");
	});
})

module.exports = router;
