// ============================================================================
// test_vice_jaw.js — CATALOGO DELLE CHELE DELLA MORSA (7/10, prompt 5 di 5;
// correzioni dell'audit 8/10, prompt 8)
//
//   1. la battuta corretta per le chele montate: formula unica (pushQuotes,
//      viceJawSql), X_Support del PLC invariato AL MICRON con chele di
//      lunghezza diversa, pari o dispari; parita' server/pannello di
//      pushQuotes e uguaglianza con la formula delle viste (8/10: REF e' la
//      lunghezza del tipo di riferimento della battuta, CLAW_JAW_REF);
//   2. le rotte del catalogo (CONF/ViceJaw.js): validazione, guardie (ordine a
//      STATUS 3, tipo dismesso, montato, gia' usato) in transazione con
//      UPDLOCK/HOLDLOCK, @@ROWCOUNT, audit solo se si scrive; mountJaw senza
//      ORDER_ID; updateJaw con misure NULL e DESCR/NOTE conservati;
//   3. la morsa (CONF/Vice.js): misure redirette al tipo montato, ogni campo
//      controllato (apici, ID), insertVice senza ID con SCOPE_IDENTITY,
//      setStop col tipo montato (CLAW_JAW_REF), elenco battute;
//   4. il passaggio a STATUS 3 (Play da Produzione e rilancio): rifiutato se
//      le chele della morsa del pallet non vanno (il blocco non sta piu'
//      nella vista);
//   5. gli script SQL, sul TESTO (nessun DB): tabella, colonne e FK,
//      migrazione una volta sola, refresh della sola VICES, viste col tipo di
//      riferimento e senza blocco chele, rilettura dopo l'ALTER, PICKPLACE
//      versionata, ritorno unico in transazione, controlli in sola lettura.
// Le prove sul DB vero (le rotte chiamate su una copia del clone del
// portatile) sono in test_vice_jaw_db.js.
//
// Uso:   node test_vice_jaw.js
// NON richiede DB: mssql/express/DBFunct/LogFunct/auditLog sono stub; le
// route reali vengono chiamate e le query catturate.
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
const Module = require('module');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const routes = {};
let currentMod = '';
const queries = [];
const audits = [];
let risposte = [];
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[currentMod + ' ' + method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(null, risposte.length ? risposte.shift() : { recordset: [] }); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	if (req.endsWith('auditLog')) return { audit: (...a) => audits.push(a), SRC_CONF: 'CONF', SRC_PUSH_SIM: 'PUSH_SIM', SRC_ORDER: 'ORDER' };
	return origLoad.apply(this, arguments);
};
currentMod = 'jaw'; require(path.join(__dirname, 'CONF', 'ViceJaw.js'));
currentMod = 'vice'; require(path.join(__dirname, 'CONF', 'Vice.js'));
const ERR = require('./errorCodes');
const J = require('./viceJawSql');
const srv = require('./pushQuotes');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const res = () => ({ body: null, code: 200, send(b) { this.body = b; return this; }, json(b) { this.body = b; this.jsonBody = b; return this; }, status(c) { this.code = c; return this; } });
function call(key, params, coda) {
	queries.length = 0; audits.length = 0; risposte = coda || [];
	const r = res();
	const h = routes[key];
	if (!h) throw new Error('rotta mancante: ' + key);
	h({ query: params, params }, r);
	return { r, q: queries.slice(), a: audits.slice() };
}
const ok = row => [{ recordset: [Object.assign({ ris: 'OK' }, row || {})] }];
const ko = code => [{ recordset: [{ ris: code }] }];
const scripts = f => fs.readFileSync(path.join(__dirname, 'scripts', f), 'utf8').replace(/\r\n/g, '\n');
const codice = t => t.split('\n').filter(r => !r.trim().startsWith('--')).join('\n');

(async () => {
	const hmi = await import(pathToFileURL(path.join(__dirname, '..', 'HMI', 'src', 'util', 'pushQuotes.js')).href);

	console.log('1) battuta corretta per le chele montate');
	check(J.battutaCorretta === srv.stopCorrected, 'una formula sola lato server: viceJawSql usa pushQuotes.stopCorrected');
	const tr = v => Math.trunc(v / 2);
	let invariato = true, mmInvariato = true, casi = 0;
	for (const ref of [150000, 150001, 107200, 107201, 120000])
		for (const montata of [150000, 150001, 107200, 107201, 99999, 180000])
			for (const dich of [0, 1, 20001, 25000, 31000]) {
				const corr = srv.stopCorrected(dich, ref, montata);
				// il PLC: X_Support_mm := DINT_TO_INT((CLAW_LENGTH / 2 + STOP_BEYOND_CLAW) / 1000)
				const xs = tr(montata) + corr, xsRef = tr(ref) + dich;
				if (xs !== xsRef) invariato = false;
				if (Math.trunc(xs / 1000) !== Math.trunc(xsRef / 1000)) mmInvariato = false;
				casi++;
			}
	check(invariato, 'X_Support (montata/2 + battuta corretta) = REF/2 + dichiarata AL MICRON, ' + casi + ' casi pari e dispari');
	check(mmInvariato, '   e quindi anche in mm interi, come lo passa il PLC al robot');
	check(srv.stopCorrected(25000, 150000, 107200) === 46400 && srv.stopCorrected(20001, 150000, 107201) === 41401,
		'riscontro sul clone del portatile (7/10): 25000 -> 46400, 20001 -> 41401');
	check(srv.stopCorrected(25000, null, 107200) === 25000 && srv.stopCorrected(25000, 150000, 0) === 25000 && srv.stopCorrected(25000, 150000, null) === 25000,
		'senza REF, o con la chela montata non misurata: la dichiarata com\'e\' (come prima)');
	check(srv.stopCorrected(null, 150000, 107200) === null && srv.stopCorrected('', 150000, 107200) === null, 'battuta non dichiarata: resta non dichiarata');
	check(srv.stopCorrected(25000, 150000, 150000) === 25000, 'stessa chela: nessuna correzione (la migrazione lascia le quote identiche)');
	const base = { enabled: true, hasVice: true, xPlace: 311000, gripperClawLength: 42000, compPush: 300 };
	const CASI = [
		{ pieceY: 180000, viceClawLength: 107201, stopBeyondClaw: 25000, clawLengthRef: 150000 },
		{ pieceY: 180001, viceClawLength: 107201, stopBeyondClaw: 20001, clawLengthRef: 150000 },
		{ pieceY: 100000, viceClawLength: 107200, stopBeyondClaw: 25000, clawLengthRef: 150000 },
		{ pieceY: 180000, viceClawLength: 150000, stopBeyondClaw: 25000, clawLengthRef: null },
		{ pieceY: 180000, viceClawLength: 190000, stopBeyondClaw: 1000, clawLengthRef: 150000 },
		{ pieceY: 160000, viceClawLength: 107200, stopBeyondClaw: 0, clawLengthRef: 150000 },
	];
	let pari = true, vista = true;
	for (const c of CASI) {
		const v = Object.assign({}, base, c);
		const a = srv.pushQuotes(v), b = hmi.pushQuotes(v);
		if (JSON.stringify(a) !== JSON.stringify(b)) pari = false;
		// la vista: TRAVEL_RAW = (j.CLAW_LENGTH - pz.Y)/2 + (pezzo oltre ? s.STOP_BEYOND_CLAW : 0)
		const oltre = c.pieceY > c.viceClawLength;
		const s = c.clawLengthRef == null ? c.stopBeyondClaw : c.stopBeyondClaw + tr(c.clawLengthRef) - tr(c.viceClawLength);
		const travel = tr(c.viceClawLength - c.pieceY) + (oltre ? s : 0);
		const atteso = travel < 0 ? 'NO_ROOM' : travel - 300 < 0 ? 'NO_COMP' : 'OK';
		if (a.status !== atteso || (atteso === 'OK' && a.clearance !== travel)) vista = false;
	}
	check(pari, 'pushQuotes: server e pannello alla pari con CLAW_LENGTH_REF (' + CASI.length + ' casi)');
	check(vista, 'pushQuotes = formula della vista COORDINATES_PUSH_MC (corsa ed esito), battuta corretta compresa');
	check(typeof hmi.stopCorrected === 'function' && hmi.stopCorrected(25000, 150000, 107200) === 46400, 'il pannello ha la stessa stopCorrected');

	console.log('\n2) rotte del catalogo (CONF/ViceJaw.js)');
	const TRAN = /SET XACT_ABORT ON;\s*BEGIN TRAN;/;
	let x = call('jaw GET /insertJaw', { CODE: '', CLAW_LENGTH: '98765', Z_CLAW: '23456', Z_SINK_CLAW: '1234' });
	check(x.r.code === 400 && x.q.length === 0, 'crea: codice vuoto -> 400, nessuna query');
	x = call('jaw GET /insertJaw', { CODE: 'C1', CLAW_LENGTH: '0', Z_CLAW: '23456', Z_SINK_CLAW: '1234' });
	check(x.r.code === 400, 'crea: lunghezza 0 -> 400 (> 0)');
	x = call('jaw GET /insertJaw', { CODE: 'C1', CLAW_LENGTH: '98765', Z_CLAW: '23456', Z_SINK_CLAW: '' });
	check(x.r.code === 400, 'crea: affondo vuoto -> 400 (tutte e tre le misure obbligatorie)');
	x = call('jaw GET /insertJaw', { CODE: "Chele dell'operatore", DESCR: 'd', CLAW_LENGTH: '98765', Z_CLAW: '23456', Z_SINK_CLAW: '0' }, ok({ ID: 5 }));
	check(/INSERT INTO VICE_JAW/.test(x.q[0]) && /N'Chele dell''operatore'/.test(x.q[0]) && /98765, 23456, 0,/.test(x.q[0]),
		'crea: affondo 0 ammesso (chela piatta), apice raddoppiato nel codice');
	check(/IF EXISTS \(SELECT 1 FROM VICE_JAW WHERE CODE = N'Chele dell''operatore'\)\s*SELECT 'KO_JAW_DUP_CODE'/.test(x.q[0]), 'crea: codice gia\' usato -> KO_JAW_DUP_CODE');
	check(x.r.body === 'OK' && x.a.length === 1 && x.a[0][2] === 'VICE_JAW:5', 'crea: OK e una riga di audit sul tipo');
	x = call('jaw GET /insertJaw', { CODE: 'C1', CLAW_LENGTH: '98765', Z_CLAW: '23456', Z_SINK_CLAW: '0' }, ko(ERR.KO_JAW_DUP_CODE));
	check(x.r.body === ERR.KO_JAW_DUP_CODE && x.a.length === 0, '   rifiuto inoltrato, niente audit');

	// (8/10, prompt 8) una transazione, ordini con UPDLOCK e HOLDLOCK, @@ROWCOUNT
	x = call('jaw GET /updateJaw', { ID: '5', CODE: 'C1', CLAW_LENGTH: '98767', Z_CLAW: '23456', Z_SINK_CLAW: '1234' }, ok({ misure: 1, ocl: 98765, ozc: 23456, ozs: 1234, ocode: 'C1', montate: 2 }));
	check(/DECLARE @misure bit = CASE WHEN ISNULL\(@ocl, -1\) <> ISNULL\(98767, -1\)/.test(x.q[0]) && x.q[0].includes("WHEN @misure = 1 AND " + J.ordineAttivoSuTipo('@id') + " THEN 'KO_JAW_ACTIVE_ORDER'"),
		'modifica: le MISURE si fermano con un ordine a STATUS 3 sul pallet di una morsa con quel tipo');
	check(TRAN.test(x.q[0]) && /FROM VICE_JAW WITH \(UPDLOCK, HOLDLOCK\) WHERE ID = @id/.test(x.q[0]) && /WITH \(UPDLOCK, HOLDLOCK\)\s+WHERE ww\.STATUS = 3/.test(x.q[0])
		&& /WHERE ID = @id;\s*IF @@ROWCOUNT = 0 BEGIN ROLLBACK; SELECT 'KO_NOT_FOUND' AS ris; END/.test(x.q[0]),
		'   (8/10) in una transazione: tipo e ordini letti WITH (UPDLOCK, HOLDLOCK), @@ROWCOUNT dopo l\'UPDATE');
	check(x.r.body === 'OK' && x.a.length === 1 && /lunghezza da 98\.8 mm a 98\.8 mm/.test(x.a[0][0]) && /montate su 2 morse/.test(x.a[0][0]),
		'modifica: audit col prima e il dopo, e su quante morse vale');
	check(/DESCR = DESCR, NOTE = NOTE,/.test(x.q[0]), '   (8/10) DESCR e NOTE non mandati: restano com\'erano (prima diventavano vuoti)');
	x = call('jaw GET /updateJaw', { ID: '5', CODE: 'C1', DESCR: "dell'officina", NOTE: '', CLAW_LENGTH: '', Z_CLAW: 'null', Z_SINK_CLAW: '0' }, ok({ misure: 0, ocl: null, ozc: null, ozs: 0, ocode: 'C1', montate: 1 }));
	check(x.r.code === 200 && /CLAW_LENGTH = NULL, Z_CLAW = NULL, Z_SINK_CLAW = 0/.test(x.q[0]) && /DESCR = N'dell''officina', NOTE = N''/.test(x.q[0]),
		'   (8/10) misure vuote = NULL (un tipo migrato puo\' non averle): si salva il resto; DESCR e NOTE mandati si scrivono');
	x = call('jaw GET /updateJaw', { ID: '5', CODE: 'C1', CLAW_LENGTH: '98x', Z_CLAW: '23456', Z_SINK_CLAW: '1234' });
	check(x.r.code === 400 && x.q.length === 0, '   una misura che non e\' un intero -> 400, nessuna query');
	x = call('jaw GET /updateJaw', { ID: '5', CODE: 'C1', CLAW_LENGTH: '98765', Z_CLAW: '23456', Z_SINK_CLAW: '1234' }, ok({ misure: 0, ocl: 98765, ozc: 23456, ozs: 1234, ocode: 'C1', montate: 0 }));
	check(x.r.body === 'OK' && x.a.length === 0, 'modifica senza cambi: OK e nessuna riga di audit');
	x = call('jaw GET /updateJaw', { ID: '5', CODE: 'C1', CLAW_LENGTH: '98767', Z_CLAW: '23456', Z_SINK_CLAW: '1234' }, ko(ERR.KO_JAW_ACTIVE_ORDER));
	check(x.r.body === ERR.KO_JAW_ACTIVE_ORDER && x.a.length === 0, 'modifica rifiutata: codice inoltrato, niente audit');
	x = call('jaw GET /updateJaw', { ID: '5', CODE: 'C1', CLAW_LENGTH: '98767', Z_CLAW: '23456', Z_SINK_CLAW: '1234' }, ko(ERR.KO_NOT_FOUND));
	check(x.r.body === ERR.KO_NOT_FOUND && x.a.length === 0, '   tipo sparito (@@ROWCOUNT 0): KO_NOT_FOUND, niente audit');

	x = call('jaw GET /setJawStatus', { ID: '5', STATUS: '0' }, ok({ code: 'C1' }));
	check(/ELSE IF 0 = 0 AND EXISTS \(SELECT 1 FROM VICE WITH \(UPDLOCK, HOLDLOCK\) WHERE JAW_ID = @id\)\s+BEGIN ROLLBACK; SELECT 'KO_JAW_MOUNTED' AS ris; END/.test(x.q[0]) && TRAN.test(x.q[0]) && x.a.length === 1 && /dismesso/.test(x.a[0][0]),
		'dismetti: un tipo montato non si dismette (KO_JAW_MOUNTED); audit');
	x = call('jaw GET /setJawStatus', { ID: '5', STATUS: '2' });
	check(x.r.code === 400, '   stato diverso da 0/1 -> 400');

	x = call('jaw DELETE /:ID', { ID: '5' }, ok({ code: 'C1' }));
	check(/ELSE IF @ever = 1 OR EXISTS \(SELECT 1 FROM VICE WITH \(UPDLOCK, HOLDLOCK\) WHERE JAW_ID = @id\)\s+OR EXISTS \(SELECT 1 FROM WORKORDER WITH \(UPDLOCK, HOLDLOCK\) WHERE JAW_ID = @id\)\s+OR EXISTS \(SELECT 1 FROM PIECE_ON_VICE WITH \(UPDLOCK, HOLDLOCK\) WHERE CLAW_JAW_REF = @id\)\s+BEGIN ROLLBACK; SELECT 'KO_JAW_IN_USE' AS ris; END/.test(x.q[0]),
		'cancella: solo un tipo MAI montato (EVER_MOUNTED), non montato adesso, mai usato da un ordine ne\' come riferimento di una battuta');
	check(TRAN.test(x.q[0]) && /DELETE FROM VICE_JAW WHERE ID = @id;\s*IF @@ROWCOUNT = 0/.test(x.q[0]) && x.r.body === 'OK' && x.a.length === 1, '   altrimenti si cancella, in transazione, con audit');

	x = call('jaw GET /mountJaw', { VICE_ID: '1', JAW_ID: '5', ORDER_ID: '2117' }, ok({ cambiato: 1, fam: 'MORSA', da: 'C0', a: 'C1' }));
	const conOrdine = x.q[0];
	check(/ELSE IF @jaw IS NOT NULL AND @jst <> 1 BEGIN ROLLBACK; SELECT 'KO_JAW_RETIRED' AS ris; END/.test(x.q[0]), 'monta: un tipo dismesso non si monta');
	check(x.q[0].includes('ELSE IF @pallet IS NOT NULL AND ' + J.ordineAttivoSuPallet('@pallet') + " BEGIN ROLLBACK; SELECT 'KO_JAW_ACTIVE_ORDER' AS ris; END")
		&& /WITH \(UPDLOCK, HOLDLOCK\)\s+WHERE ww\.PALLET_ID = @pallet AND ww\.STATUS = 3\)/.test(x.q[0]) && !/ww\.ID <>/.test(x.q[0]) && !/2117/.test(x.q[0]),
		'monta: guardia su TUTTI gli ordini a STATUS 3 del pallet (8/10: ORDER_ID tolto, un intero qualsiasi la saltava)');
	check(TRAN.test(x.q[0]) && /UPDATE VICE SET JAW_ID = @jaw WHERE ID = @vice;\s*IF @@ROWCOUNT = 0/.test(x.q[0]) && /UPDATE VICE_JAW SET EVER_MOUNTED = 1 WHERE ID = @jaw/.test(x.q[0]), 'monta: VICE.JAW_ID in transazione, e il tipo resta segnato come montato');
	check(x.a.length === 1 && /Morsa MORSA \(ID 1\): chele da C0 a C1/.test(x.a[0][0]) && x.a[0][2] === 'VICE:1', 'monta: audit «morsa X: chele da A a B»');
	x = call('jaw GET /mountJaw', { VICE_ID: '1', JAW_ID: '5' }, ok({ cambiato: 1, fam: 'MORSA', da: 'C0', a: 'C1' }));
	check(x.q[0] === conOrdine, '   ORDER_ID mandato o no: la stessa query');
	x = call('jaw GET /mountJaw', { VICE_ID: '1', JAW_ID: '' }, ok({ cambiato: 1, fam: 'MORSA', da: 'C1', a: null }));
	check(/@jaw int = NULL/.test(x.q[0]) && /\(ID 1\): chele da C1 a nessuna/.test(x.a[0][0]), 'smonta: JAW_ID vuoto');
	x = call('jaw GET /mountJaw', { VICE_ID: '1', JAW_ID: '5' }, ok({ cambiato: 0 }));
	check(x.r.body === 'OK' && x.a.length === 0, 'monta lo stesso tipo gia\' montato: OK, nessun audit');

	x = call('jaw GET /confirmOrderJaw', { ORDER_ID: '2117', JAW_ID: '5' }, ok({ da: null, a: 'C1' }));
	check(/ELSE IF @st = 3 AND ISNULL\(@old, -1\) <> @jaw BEGIN ROLLBACK; SELECT 'KO_JAW_ACTIVE_ORDER' AS ris; END/.test(x.q[0]) && /UPDATE WORKORDER SET JAW_ID = @jaw WHERE ID = @o/.test(x.q[0])
		&& /FROM WORKORDER WITH \(UPDLOCK, HOLDLOCK\) WHERE ID = @o/.test(x.q[0]),
		'conferma sull\'ordine: WORKORDER.JAW_ID, mai cambiato sotto un ordine a STATUS 3');
	check(x.a.length === 1 && x.a[0][1] === 'ORDER' && /Ordine 2117: chele confermate C1/.test(x.a[0][0]), '   audit sull\'ordine');
	x = call('jaw GET /confirmOrderJaw', { ORDER_ID: '2117' });
	check(x.r.code === 400, '   senza tipo -> 400');

	x = call('jaw GET /show/:ID', { ID: 'all' }, [{ recordsets: [[{ ID: 5, CODE: 'C1' }, { ID: 6, CODE: 'C2' }], [{ ID: 1, FAMILY: 'M1', PALLET_ID: 9, JAW_ID: 5 }]] }]);
	check(Array.isArray(x.r.body) && x.r.body[0].MOUNTED_ON.length === 1 && x.r.body[0].MOUNTED_ON[0].FAMILY === 'M1' && x.r.body[1].MOUNTED_ON.length === 0,
		'elenco: per ogni tipo le morse su cui e\' montato');
	check(/\(SELECT COUNT\(\*\) FROM WORKORDER w WHERE w\.JAW_ID = j\.ID\) AS ORDERS/.test(x.q[0]) && !/STRING_AGG/.test(x.q[0]), '   e quanti ordini lo usano; niente STRING_AGG (compatibilita\' vecchia in cella)');

	console.log('\n3) la morsa (CONF/Vice.js): misure al tipo montato, campi controllati, ID dal database');
	const RIGA = { ID: '1', FAMILY: 'M', DESCR: 'D', STATUS: '2', X: '1', Y: '1', Z: '1', MAG: '1', MAG_POS: '1', POS_PLANT: '1' };
	x = call('vice GET /updateVice', Object.assign({}, RIGA, { CLAW_LENGTH: '98765', Z_CLAW: 'null', Z_SINK_CLAW: '1234' }), ok({ misure: 0, jaw: 7, ocl: 98765, ozc: null, ozs: 1234, code: 'C' }));
	check(/DECLARE @cl int = 98765, @zc int = NULL, @zs int = 1234;/.test(x.q[0]), 'updateVice: "null" (letto da VICES con misura vuota) = nessun cambio');
	check(/WHEN @misure = 1 AND @jaw IS NULL THEN 'KO_NO_JAW'/.test(x.q[0]) && x.q[0].includes("WHEN @misure = 1 AND " + J.ordineAttivoSuTipo('@jaw') + " THEN 'KO_JAW_ACTIVE_ORDER'"),
		'updateVice: una misura DIVERSA senza tipo montato -> KO_NO_JAW; con un ordine a STATUS 3 -> KO_JAW_ACTIVE_ORDER');
	check(TRAN.test(x.q[0]) && /FROM VICE WITH \(UPDLOCK, HOLDLOCK\) WHERE ID = @id;/.test(x.q[0]) && /IF @nv = 0 OR @nj = 0 BEGIN ROLLBACK; SELECT 'KO_NOT_FOUND' AS ris; END/.test(x.q[0]),
		'   (8/10) in transazione, @@ROWCOUNT su morsa e tipo: una riga sparita non risponde OK');
	check(x.r.body === 'OK' && x.a.length === 0, 'updateVice con le misure di prima: OK, nessun audit (Attrezzaggio monta e smonta la morsa cosi\')');
	// (8/10, prompt 8) ogni campo controllato, compreso l'ID della WHERE
	x = call('vice GET /updateVice', Object.assign({}, RIGA, { FAMILY: "Morsa d'angolo", DESCR: "l'altra" }), ok({ misure: 0, jaw: 7 }));
	check(/SET FAMILY=N'Morsa d''angolo',\s*DESCR=N'l''altra',\s*STATUS=2,/.test(x.q[0]) && /WHERE ID=@id;/.test(x.q[0]) && /DECLARE @id int = 1,/.test(x.q[0]),
		'updateVice: FAMILY e DESCR con gli apici raddoppiati (prima un apice faceva perdere il salvataggio), WHERE sull\'ID controllato');
	x = call('vice GET /updateVice', Object.assign({}, RIGA, { ID: '1 OR 1=1' }));
	check(x.r.code === 400 && x.q.length === 0, '   ID "1 OR 1=1" -> 400, nessuna query (prima aggiornava tutte le morse)');
	x = call('vice GET /updateVice', Object.assign({}, RIGA, { X: '1; DELETE FROM VICE' }));
	check(x.r.code === 400 && x.q.length === 0, '   un campo numerico che non e\' un intero -> 400, nessuna query');
	x = call('vice GET /updateVice', Object.assign({}, RIGA, { MAG: '', MAG_POS: 'null', PALLET_ID: '' }), ok({ misure: 0, jaw: null }));
	check(/MAG=NULL,\s*MAG_POS=NULL,/.test(x.q[0]) && /PALLET_ID=NULL/.test(x.q[0]), '   vuoto o "null" = NULL; PALLET_ID vuoto smonta (come prima)');
	x = call('vice GET /updateVice', Object.assign({}, RIGA, { CLAW_LENGTH: '98767' }), ko(ERR.KO_NO_JAW));
	check(x.r.body === ERR.KO_NO_JAW, 'updateVice: rifiuto inoltrato nel body (il form lo mostra)');
	x = call('vice GET /updateVice', Object.assign({}, RIGA, { CLAW_LENGTH: '98767' }), ok({ misure: 1, jaw: 7, ocl: 98765, ozc: 23456, ozs: 1234, code: 'C' }));
	check(x.a.length === 1 && /lunghezza chela da 98765 um a 98767 um/.test(x.a[0][0]) && x.a[0][2] === 'VICE_JAW:7', 'updateVice: misura cambiata -> audit sul tipo');

	x = call('vice GET /insertVice', Object.assign({}, RIGA, { CLAW_LENGTH: '98765', Z_CLAW: '0', Z_SINK_CLAW: '0' }));
	check(x.r.body === ERR.KO_NO_JAW && x.q.length === 0, 'insertVice: una lunghezza su una morsa nuova -> KO_NO_JAW, nessuna query');
	// (8/10, prompt 8) VICE.ID e' IDENTITY: niente ID nell'INSERT, torna quello vero
	x = call('vice GET /insertVice', Object.assign({}, RIGA, { ID: '0', FAMILY: "Morsa d'angolo", CLAW_LENGTH: '', Z_CLAW: '0', Z_SINK_CLAW: '0' }), [{ recordset: [{ ris: 'OK', ID: 42 }] }]);
	check(/INSERT INTO VICE\s+\(FAMILY, DESCR, STATUS, X, Y, Z, MAG, MAG_POS, POS_PLANT\)/.test(x.q[0]) && /VALUES\(N'Morsa d''angolo',/.test(x.q[0]),
		'insertVice: senza l\'ID (VICE.ID e\' IDENTITY: con l\'ID esplicito l\'INSERT falliva), campi controllati');
	check(/SELECT 'OK' AS ris, CAST\(SCOPE_IDENTITY\(\) AS int\) AS ID;/.test(x.q[0]) && x.r.jsonBody && x.r.jsonBody.ris === 'OK' && x.r.jsonBody.ID === 42,
		'   risponde {"ris":"OK","ID":<nuovo>} con SCOPE_IDENTITY: il pannello usa quell\'ID');
	x = call('vice GET /insertVice', Object.assign({}, RIGA, { STATUS: 'abc' }));
	check(x.r.code === 400 && x.q.length === 0, '   un campo numerico non valido -> 400, nessuna query');

	// (8/10, prompt 8) il riferimento della battuta e' il TIPO montato
	x = call('vice GET /setStop', { VICE_ID: '1', PIECE_ID: '1029', STOP_BEYOND_CLAW: '24680' }, [{ recordset: [{ ref: 7, len: 98765, code: 'C' }] }]);
	check(/DECLARE @ref int = \(SELECT v\.JAW_ID FROM VICE v WHERE v\.ID=1\);/.test(x.q[0])
		&& /SET STOP_BEYOND_CLAW=24680, CLAW_JAW_REF=@ref/.test(x.q[0]) && /VALUES \(1, 1029, 24680, @ref\)/.test(x.q[0]) && !/CLAW_LENGTH_REF/.test(x.q[0]),
		'setStop: la battuta si dichiara col tipo di chele montato adesso (CLAW_JAW_REF)');
	check(x.a.length === 1 && /\(chele C, tipo ID 7, 98765 um\)/.test(x.a[0][0]), '   e il diario lo dice');
	x = call('vice GET /stops/:viceID', { viceID: '1' }, [{ recordset: [] }]);
	check(/pv\.CLAW_JAW_REF, jr\.CLAW_LENGTH as REF_CLAW_LENGTH, rtrim\(jr\.CODE\) as REF_JAW_CODE,/.test(x.q[0]) && /v\.JAW_ID as MOUNTED_JAW_ID,/.test(x.q[0])
		&& /left join VICE_JAW jr on jr\.ID = pv\.CLAW_JAW_REF/.test(x.q[0]),
		'elenco delle battute: tipo di riferimento, la sua lunghezza adesso e il tipo montato, per mostrare la battuta corretta');
	const viceJs = fs.readFileSync(path.join(__dirname, 'CONF', 'Vice.js'), 'utf8');
	check(/Il ROWCOUNT si controlla davvero/.test(viceJs) && !/^\/\/ Il ROWCOUNT viene controllato: una UPDATE/m.test(viceJs), 'commento di salvaMisuraChela corretto: il ROWCOUNT ora si controlla davvero');
	check(fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8').includes("app.use('/api/conf/viceJaw'	, viceJawRouter);"), 'server.js: rotte montate su /api/conf/viceJaw');
	const hmiErr = fs.readFileSync(path.join(__dirname, '..', 'HMI', 'src', 'util', 'errorCodes.js'), 'utf8');
	check(['KO_NO_JAW', 'KO_JAW_ACTIVE_ORDER', 'KO_JAW_RETIRED', 'KO_JAW_MOUNTED', 'KO_JAW_IN_USE', 'KO_JAW_DUP_CODE', 'KO_ORDER_VICE_NO_JAW', 'KO_ORDER_JAW_MISMATCH'].every(k => ERR[k] === k && hmiErr.includes('export const ' + k)),
		'codici di rifiuto nel backend e nella copia del pannello (8/10: anche quelli del Play)');

	console.log('\n4) passaggio a STATUS 3: il controllo delle chele (Play e rilancio)');
	const kc = J.koChelePlay('@id');
	check(/WHEN EXISTS \(SELECT 1 FROM WORKORDER w WITH \(UPDLOCK, HOLDLOCK\) JOIN VICE v ON v\.PALLET_ID = w\.PALLET_ID\s+WHERE w\.ID = @id AND v\.JAW_ID IS NULL\) THEN 'KO_ORDER_VICE_NO_JAW'/.test(kc),
		'morsa del pallet senza tipo montato -> KO_ORDER_VICE_NO_JAW');
	check(/WHERE w\.ID = @id AND w\.JAW_ID IS NOT NULL\s+AND NOT EXISTS \(SELECT 1 FROM VICE v WHERE v\.PALLET_ID = w\.PALLET_ID AND v\.JAW_ID = w\.JAW_ID\)\) THEN 'KO_ORDER_JAW_MISMATCH'/.test(kc),
		'chele confermate sull\'ordine diverse da quelle montate (o morsa tolta) -> KO_ORDER_JAW_MISMATCH; ordine senza conferma: passa');
	const OS = require('./WORKORDER/orderStatusSql');
	const o3 = OS.leggi({ id: '77', status: '3', pieceID: '1029' });
	check(o3 && o3.id === 77 && o3.status === 3 && o3.pieceID === 1029 && OS.leggi({ id: '1 OR 1=1', status: 3, pieceID: 1029 }) === null
		&& OS.leggi({ id: 77, status: 4 }) === null && OS.leggi({ id: 77, status: "3'", pieceID: 1 }) === null && OS.leggi({ id: 77, status: 6 }) !== null,
		'Play: id, stato e pezzo controllati (prima andavano nella query grezzi); il pezzo serve solo a 3 e a 4');
	const q3 = OS.query(o3), q4 = OS.query({ id: 77, status: 4, pieceID: 1029 });
	check(q3.includes('SET @ko = ' + kc + ';') && /SET XACT_ABORT ON;\s*BEGIN TRAN;/.test(q3) && /IF @ko IS NOT NULL BEGIN ROLLBACK; SELECT @ko AS ris; END/.test(q3)
		&& /UPDATE \[POSITION\] SET Order_ID=@id WHERE id IN \(\s*SELECT top \(SELECT QUANTITY FROM WORKORDERS WHERE ID=@id\) id FROM POSITION WHERE Part_Type=1029 AND STATUS=4 AND ORDER_ID=0/.test(q3),
		'Play: al passaggio a 3 il controllo delle chele, nella stessa transazione dell\'UPDATE e della prenotazione delle tasche');
	check(!q4.includes(kc) && /UPDATE \[POSITION\] SET Order_ID=0 WHERE id in \(\s*SELECT id FROM position WHERE Part_Type=1029 AND STATUS=4 AND ORDER_ID=@id/.test(q4),
		'   torna a grezzo (4): nessun controllo delle chele, le tasche si liberano come prima');
	check(OS.esito({ recordsets: [[{ x: 1 }], [{ ris: 'KO_ORDER_VICE_NO_JAW' }]] }).ris === 'KO_ORDER_VICE_NO_JAW' && OS.esito({}).ris === undefined, '   l\'esito e\' l\'ultima riga con ris (un trigger puo\' aggiungere risultati)');
	const mq = fs.readFileSync(path.join(__dirname, 'MQTT_Client.js'), 'utf8').replace(/\r\n/g, '\n');
	const play = mq.slice(mq.indexOf("    socket.on('TO_PLANT/CMD/ORDER'"), mq.indexOf('function getStatus('));
	check(/const ord = orderStatusSql\.leggi\(data\);/.test(play) && /const query = orderStatusSql\.query\(ord\);/.test(play) && /const row = orderStatusSql\.esito\(result\);/.test(play)
		&& !/replaceAll\("@id@"/.test(play) && !/\$\{data\./.test(play),
		'il socket TO_PLANT/CMD/ORDER usa questo modulo (lo stesso provato sul database)');
	check(/socket\.emit\('ORDER\/REJECTED', \{ id: ord\.id, code: row\.ris \}\);/.test(play) && /DBf\.io\.emit\('PRODUCTION\/CHANGED'\)/.test(play),
		'   rifiuto: ORDER/REJECTED al pannello che ha mandato il comando; riuscito: PRODUCTION/CHANGED come prima');
	currentMod = 'order'; require(path.join(__dirname, 'WORKORDER', 'Order.js'));
	queries.length = 0; risposte = [{ recordset: [{ blocked: null }] }];
	let jr = null;
	routes['order GET /relaunch/preview/:orderId']({ params: { orderId: '77' }, query: {} }, Object.assign(res(), { json(b) { jr = b; } }));
	check(queries[0] && queries[0].includes('ELSE ' + J.koChelePlay('@id', false) + ' END;') && !/UPDLOCK/.test(queries[0]),
		'rilancio: le chele come al Play, gia\' nell\'anteprima del dialog (che resta una lettura senza lock)');
	queries.length = 0; risposte = [{ recordset: [{ ris: ERR.KO_ORDER_JAW_MISMATCH }] }]; jr = null;
	routes['order POST /relaunch/:orderId']({ params: { orderId: '77' }, query: { mode: 'available' }, body: {} }, Object.assign(res(), { json(b) { jr = b; } }));
	check(queries[0] && queries[0].includes(kc) && /SET XACT_ABORT ON;\s*BEGIN TRAN;/.test(queries[0]) && jr && jr.ris === ERR.KO_ORDER_JAW_MISMATCH,
		'rilancio: rifiutato con il codice, nella transazione del rilancio');

	console.log('\n5) script SQL');
	const vj = scripts('vice-jaw.sql'), vjc = codice(vj);
	check(/CREATE TABLE dbo\.VICE_JAW/.test(vjc) && /CONSTRAINT UQ_VICE_JAW_CODE UNIQUE \(CODE\)/.test(vjc)
		&& /CHECK \(CLAW_LENGTH IS NULL OR CLAW_LENGTH > 0\)/.test(vjc) && /CHECK \(Z_CLAW IS NULL OR Z_CLAW > 0\)/.test(vjc) && /CHECK \(Z_SINK_CLAW IS NULL OR Z_SINK_CLAW >= 0\)/.test(vjc),
		'VICE_JAW: codice unico, lunghezza e altezza > 0, affondo >= 0');
	check(/ALTER TABLE dbo\.VICE ADD JAW_ID int NULL;/.test(vjc) && /ALTER TABLE dbo\.WORKORDER ADD JAW_ID int NULL;/.test(vjc) && /ALTER TABLE dbo\.PIECE_ON_VICE ADD CLAW_JAW_REF int NULL;/.test(vjc)
		&& !/ADD CLAW_LENGTH_REF/.test(vjc),
		'colonne nuove: VICE.JAW_ID, WORKORDER.JAW_ID, PIECE_ON_VICE.CLAW_JAW_REF (8/10: il tipo, non la lunghezza)');
	check(['FK_VICE_JAW_ID FOREIGN KEY (JAW_ID) REFERENCES dbo.VICE_JAW (ID)', 'FK_WORKORDER_JAW_ID FOREIGN KEY (JAW_ID) REFERENCES dbo.VICE_JAW (ID)', 'FK_PIECE_ON_VICE_CLAW_JAW_REF FOREIGN KEY (CLAW_JAW_REF) REFERENCES dbo.VICE_JAW (ID)'].every(f => vjc.includes(f)),
		'(8/10) FK verso VICE_JAW: VICE.JAW_ID, WORKORDER.JAW_ID, PIECE_ON_VICE.CLAW_JAW_REF');
	check(/^SET XACT_ABORT ON;/m.test(vjc), '(8/10) SET XACT_ABORT ON');
	check(/IF COL_LENGTH\('dbo\.PIECE_ON_VICE', 'CLAW_LENGTH_REF'\) IS NOT NULL/.test(vjc) && /FERMO: c''e'' PIECE_ON_VICE\.CLAW_LENGTH_REF/.test(vjc), '   FERMO se trova la versione del 7/10 (CLAW_LENGTH_REF), mai andata in cella');
	check(/EXEC sp_refreshview N'dbo\.VICES';/.test(vjc) && (vjc.match(/sp_refreshview/g) || []).length === 1 && !/referenced_entity_name/.test(vjc),
		'(8/10) sp_refreshview SOLO su VICES: le viste con * lette dal PLC per posizione non si rinfrescano');
	check(/IF EXISTS \(SELECT 1 FROM dbo\.VICE_JAW\) OR EXISTS \(SELECT 1 FROM dbo\.VICE WHERE JAW_ID IS NOT NULL\)/.test(vjc) && /MIGRAZIONE: gia'' fatta/.test(vjc),
		'migrazione una volta sola');
	check(/WHERE CLAW_LENGTH < 0 OR Z_CLAW < 0 OR Z_SINK_CLAW < 0/.test(vjc) && /FERMO: una o piu'' morse hanno una misura della chela NEGATIVA/.test(vjc), 'un negativo ferma la migrazione (cambierebbe le quote)');
	check(/BEGIN TRAN;/.test(vjc) && /IF @@TRANCOUNT > 0 ROLLBACK;/.test(vjc), 'migrazione in una transazione: o tutto o niente');
	check(/N'Chele attuali morsa ' \+ CAST\(v\.ID AS nvarchar\(12\)\) AS CODE,/.test(vjc) && !/RTRIM\(v\.FAMILY\)\s*\+\s*N?' '?\s*AS CODE/.test(vjc),
		'(8/10) codice dei tipi migrati sempre con l\'ID della morsa: FAMILY NULL o uguale non collidono sull\'UNIQUE');
	check(/DECLARE m CURSOR LOCAL FAST_FORWARD FOR SELECT VICE_ID, JAW_ID FROM #map/.test(vjc) && /UPDATE dbo\.VICE SET JAW_ID = @jj WHERE ID = @v;/.test(vjc),
		'il tipo su ogni morsa UNA ALLA VOLTA (VICE_trig scriverebbe il prodotto incrociato)');
	check(!/UPDATE (dbo\.)?VICE SET (CLAW_LENGTH|Z_CLAW|Z_SINK_CLAW)/.test(vjc) && !/DROP COLUMN|sp_rename/.test(vjc), 'le colonne vecchie di VICE restano com\'erano: non si scrivono, non si tolgono, non si rinominano');
	check(/UPDATE pv SET CLAW_JAW_REF = mp\.JAW_ID/.test(vjc), 'CLAW_JAW_REF delle battute = il tipo creato per la loro morsa: viste identiche al micron');
	check(/CASE WHEN v\.CLAW_LENGTH > 0 THEN v\.CLAW_LENGTH END AS CLAW_LENGTH/.test(vjc) && /CASE WHEN v\.Z_CLAW > 0 THEN v\.Z_CLAW END AS Z_CLAW/.test(vjc)
		&& /CASE WHEN v\.Z_SINK_CLAW >= 0 THEN v\.Z_SINK_CLAW END AS Z_SINK_CLAW/.test(vjc), 'migrazione: lunghezza e altezza a 0 -> NULL, affondo 0 resta 0');
	check(/VALUES \(s\.CODE, s\.DESCR, s\.CLAW_LENGTH, s\.Z_CLAW, s\.Z_SINK_CLAW, 1, N'creato da vice-jaw\.sql \(migrazione\)', 1\)/.test(vjc), 'migrazione: EVER_MOUNTED = 1 sui tipi che crea (sono gia\' montati)');
	const jawJs = fs.readFileSync(path.join(__dirname, 'CONF', 'ViceJaw.js'), 'utf8') + viceJs;
	check(/UPDATE VICE_JAW SET EVER_MOUNTED = 1 WHERE ID = @jaw/.test(jawJs) && !/SET EVER_MOUNTED = 0/.test(jawJs),
		'EVER_MOUNTED: a 1 al primo montaggio, nessuna rotta lo rimette a 0');

	const z = codice(scripts('coordinates-z-mc.sql')), p = codice(scripts('coordinates-push-mc.sql')), b = codice(scripts('coordinates-blow-mc.sql'));
	const nuovaZ = (z.match(/DECLARE @nuova nvarchar\(max\) = N'((?:[^']|'')*)';/) || [])[1] || '';
	const CORR = 'pv.STOP_BEYOND_CLAW + jr.CLAW_LENGTH/2 - j.CLAW_LENGTH/2';
	const pV = p.slice(p.indexOf('ALTER VIEW dbo.COORDINATES_PUSH_MC AS')), bV = b.slice(b.indexOf('ALTER VIEW dbo.COORDINATES_BLOW_MC AS'));
	check(pV.includes(CORR) && bV.includes(CORR) && !/CLAW_LENGTH_REF/.test(pV) && !/CLAW_LENGTH_REF/.test(bV), 'spinta e soffiaggio: la stessa correzione, dichiarata + lunghezza(tipo di riferimento)/2 - montata/2');
	check(/left\s+join VICE_JAW jr\s+on jr\.ID = pv\.CLAW_JAW_REF/.test(pV) && /left\s+join VICE_JAW jr\s+on jr\.ID = pv\.CLAW_JAW_REF/.test(bV), '   il tipo di riferimento si legge dal catalogo (la sua lunghezza ADESSO)');
	check(/cross apply \(select case when ISNULL\(jr\.CLAW_LENGTH, 0\) <= 0 or ISNULL\(j\.CLAW_LENGTH, 0\) <= 0\s+then pv\.STOP_BEYOND_CLAW/.test(pV), 'spinta: una lunghezza NULL (o nessun tipo di riferimento): la dichiarata com\'e\'');
	check(nuovaZ && !/w\.JAW_ID/.test(nuovaZ) && !/\bwhere\b/i.test(nuovaZ) && !/w\.JAW_ID/.test(pV) && !/w\.JAW_ID/.test(bV),
		'(8/10) NESSUN blocco chele nelle viste: tre query del PLC prendono «l\'ordine piu\' recente» (il controllo e\' al Play)');
	check([nuovaZ, pV, bV].every(t => /left\s+join VICE_JAW j\s+on j\.ID = v\.JAW_ID/.test(t)), 'le tre viste leggono le misure dal tipo montato');
	check(!/\bv\.(CLAW_LENGTH|Z_CLAW|Z_SINK_CLAW)\b/.test(pV) && !/\bv\.(CLAW_LENGTH|Z_CLAW|Z_SINK_CLAW)\b/.test(bV) && !/\bv\.(CLAW_LENGTH|Z_CLAW|Z_SINK_CLAW)\b/.test(nuovaZ),
		'nessuna vista legge piu\' le misure dalla riga della morsa');
	const vsRaw = scripts('vices-view.sql'), vs = codice(vsRaw);
	check(/j\.Z_CLAW AS Z_CLAW,/.test(vs) && /j\.Z_SINK_CLAW AS Z_SINK_CLAW,/.test(vs) && /j\.CLAW_LENGTH AS CLAW_LENGTH,/.test(vs) && /v\.JAW_ID,\s*RTRIM\(j\.CODE\) AS JAW_CODE,/.test(vs) && !/v\.\*/.test((vs.match(/DECLARE @nuova nvarchar\(max\) = N'([^']*)'/) || [])[1] || 'v.*'),
		'VICES: colonne per esteso, misure dal tipo con lo stesso nome, JAW_ID e JAW_CODE');
	check(/FERMO: VICE ha colonne che la vista nuova non elenca/.test(vs), '   e si ferma se VICE ha colonne che perderebbe');
	// (8/10, prompt 8) ogni script di vista RILEGGE la definizione dopo l'ALTER
	for (const [f, t] of [['coordinates-z-mc.sql', z], ['coordinates-push-mc.sql', p], ['coordinates-blow-mc.sql', b], ['vices-view.sql', vs]])
		check(/OBJECT_DEFINITION/.test(t.slice(t.lastIndexOf('SET NOEXEC OFF'))) && /PRINT 'FERMO: [^']*riletta[^']*NON e''/.test(t), f + ': dopo l\'ALTER la definizione si rilegge, FERMO se non e\' quella nuova');
	const pp = codice(scripts('coordinates-pickplace-mc.sql'));
	check(/inner join COORDINATES_Z_MC z on z\.ORDER_ID = w\.ID/.test(pp) && /z\.Z_PICK_MC,[^\n]*\n\s*z\.Z_PLACE_MC,/.test(pp) && !/\bVICE\b|Z_CLAW|Z_SINK_CLAW/.test(pp.replace(/PRINT[^\n]*/g, '')),
		'(8/10) COORDINATES_PICKPLACE_MC (missione 16) prende le Z da COORDINATES_Z_MC: nessun quinto script di misure, solo la definizione versionata');
	check(/conforme/.test(pp) && /FERMO/.test(pp) && /CREATE VIEW dbo\.COORDINATES_PICKPLACE_MC/.test(pp) && !/\bALTER VIEW\b|\bDROP VIEW\b/.test(pp.replace(/PRINT[^\n]*/g, '')),
		'   guardia: conforme (codice senza commenti) / crea se manca / altrimenti FERMO; mai ALTER o DROP');
	const chk = codice(scripts('vice-jaw-check.sql'));
	check(/COORDINATES_PICKPLACE_MC/.test(chk) && /PRINT '== FINE ==';/.test(chk), 'vice-jaw-check.sql: anche le righe di COORDINATES_PICKPLACE_MC, e il marcatore di fine per il confronto');
	const ctl = codice(scripts('vice-jaw-controlli.sql'));
	check(["FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id", 'sys.triggers', 'COORDINATES_PICKPLACE_MC', 'COORDINATES_FOR_PALLET_WAREHOUSE', 'HAVING COUNT(*) > 1'].every(s => ctl.includes(s)) && /\*/.test(ctl),
		'vice-jaw-controlli.sql: tipi delle colonne di VICE, trigger, pallet con piu\' morse, PICKPLACE e FOR_PALLET_WAREHOUSE, viste con *');

	check(!fs.existsSync(path.join(__dirname, 'scripts', 'vice-jaw-views-rollback.sql')), '(8/10) un solo script di ritorno: vice-jaw-views-rollback.sql non c\'e\' piu\'');
	const vjr = scripts('vice-jaw-rollback.sql');
	const iNeg = vjr.indexOf('battute corrette verrebbero NEGATIVE'), iTran = vjr.indexOf('BEGIN TRAN;', iNeg), iVice = vjr.indexOf('UPDATE v SET CLAW_LENGTH = j.CLAW_LENGTH, Z_CLAW = j.Z_CLAW, Z_SINK_CLAW = j.Z_SINK_CLAW');
	const iStop = vjr.indexOf('UPDATE pv SET STOP_BEYOND_CLAW = pv.STOP_BEYOND_CLAW + jr.CLAW_LENGTH/2 - j.CLAW_LENGTH/2'), iAlt = vjr.indexOf("EXEC (N''ALTER VIEW dbo.COORDINATES_Z_MC AS"), iCommit = vjr.indexOf('COMMIT;', iAlt);
	const iBak = vjr.indexOf("SELECT * INTO dbo.VICE_JAW_BAK_"), iDrop = vjr.indexOf('DROP TABLE dbo.VICE_JAW;');
	check(/^SET XACT_ABORT ON;/m.test(vjr) && iNeg > 0 && iNeg < iTran && iTran < iVice && iVice < iStop && iStop < iAlt && iAlt < iCommit,
		'ritorno in UNA transazione (XACT_ABORT): negativi (FERMO prima di scrivere), colonne di VICE, battute corrette, ALTER delle viste, COMMIT');
	check(iCommit < iBak && iBak < iDrop && /WORKORDER_JAW_BAK_/.test(vjr) && /PIECE_ON_VICE_JAWREF_BAK_/.test(vjr)
		&& /IF EXISTS \(SELECT 1 FROM #rit WHERE fase = 'salvate'\)/.test(vjr),
		'   poi, separati: le tabelle di salvataggio (catalogo, ordini -> chele, battute col riferimento) e il DROP, solo coi salvataggi fatti');
	check(/SELECT v\.ID FROM dbo\.VICE v LEFT JOIN dbo\.VICE_JAW j ON j\.ID = v\.JAW_ID\s+WHERE EXISTS \(SELECT 1 FROM dbo\.VICE_JAW\)\s+AND \(/.test(vjr) && /catalogo vuoto \(migrazione mai fatta\): le colonne delle morse restano come sono/.test(vjr),
		'   catalogo vuoto (vice-jaw.sql fermo prima della migrazione): le misure delle morse non si toccano (sarebbero diventate NULL)');
	const iFk = vjr.indexOf('DROP CONSTRAINT FK_VICE_JAW_ID'), iCol = vjr.indexOf('ALTER TABLE dbo.VICE DROP COLUMN JAW_ID');
	check(iFk > 0 && iFk < iCol && iCol < iDrop && /DROP CONSTRAINT FK_WORKORDER_JAW_ID/.test(vjr) && /DROP CONSTRAINT FK_PIECE_ON_VICE_CLAW_JAW_REF/.test(vjr),
		'   il DROP toglie prima le FK, poi colonne e tabella');
	check(/PRINT '== CONTEGGI PRIMA ==';/.test(vjr) && /PRINT '== DOPO ==';/.test(vjr) && (vjr.match(/Non riprendere la produzione/g) || []).length >= 3,
		'   conteggi prima e dopo; dopo un FERMO «non riprendere la produzione»');
	check(/QUESTO SCRIPT, PRIMA di pannello\.ps1 -Versione ritorno/.test(vjr) && /Nessun git checkout a mano\./.test(vjr), '   intestazione: prima l\'SQL, poi pannello.ps1, nessun git checkout');
	for (const f of ['vice-jaw-check.sql', 'vice-jaw-controlli.sql']) {
		const t = codice(scripts(f)).replace(/^\s*PRINT[^\n]*$/gm, '');
		check(!/\b(INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|EXEC|TRUNCATE)\b/i.test(t), f + ': solo SELECT');
	}
	const ascii = f => !fs.readFileSync(path.join(__dirname, 'scripts', f)).some(c => c > 127);
	check(['vice-jaw.sql', 'vices-view.sql', 'vice-jaw-check.sql', 'vice-jaw-controlli.sql', 'coordinates-z-mc.sql', 'coordinates-pickplace-mc.sql'].every(ascii),
		'script nuovi solo ASCII (il ritorno e le viste di spinta e soffiaggio restano UTF-8: si lanciano con -f 65001)');

	console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
	process.exit(failed ? 1 : 0);
})();
