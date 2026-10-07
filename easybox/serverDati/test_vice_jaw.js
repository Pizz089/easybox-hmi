// ============================================================================
// test_vice_jaw.js — CATALOGO DELLE CHELE DELLA MORSA (7/10, prompt 5 di 5)
//
//   1. la battuta corretta per le chele montate: formula unica (pushQuotes,
//      viceJawSql), X_Support del PLC invariato AL MICRON con chele di
//      lunghezza diversa, pari o dispari; parita' server/pannello di
//      pushQuotes con CLAW_LENGTH_REF e uguaglianza con la formula delle viste;
//   2. le rotte del catalogo (CONF/ViceJaw.js): validazione, guardie (ordine a
//      STATUS 3, tipo dismesso, montato, gia' usato), audit solo se si scrive;
//   3. le scritture delle misure redirette al tipo montato (CONF/Vice.js):
//      updateVice, insertVice, setStop con CLAW_LENGTH_REF, elenco battute;
//   4. gli script SQL, sul TESTO (nessun DB): tabella e colonne, migrazione
//      una volta sola, viste con catalogo, correzione e blocco chele, VICES
//      per esteso, ritorni nell'ordine giusto, confronto in sola lettura.
// Le prove sul DB (clone del portatile, in una transazione annullata e poi
// davvero col ripristino dal backup) sono nel report del 7/10.
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
const res = () => ({ body: null, code: 200, send(b) { this.body = b; return this; }, status(c) { this.code = c; return this; } });
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
	let x = call('jaw GET /insertJaw', { CODE: '', CLAW_LENGTH: '107200', Z_CLAW: '30000', Z_SINK_CLAW: '4000' });
	check(x.r.code === 400 && x.q.length === 0, 'crea: codice vuoto -> 400, nessuna query');
	x = call('jaw GET /insertJaw', { CODE: 'C1', CLAW_LENGTH: '0', Z_CLAW: '30000', Z_SINK_CLAW: '4000' });
	check(x.r.code === 400, 'crea: lunghezza 0 -> 400 (> 0)');
	x = call('jaw GET /insertJaw', { CODE: 'C1', CLAW_LENGTH: '107200', Z_CLAW: '30000', Z_SINK_CLAW: '' });
	check(x.r.code === 400, 'crea: affondo vuoto -> 400 (tutte e tre le misure obbligatorie)');
	x = call('jaw GET /insertJaw', { CODE: "Chele dell'operatore", DESCR: 'd', CLAW_LENGTH: '107200', Z_CLAW: '30000', Z_SINK_CLAW: '0' }, ok({ ID: 5 }));
	check(/INSERT INTO VICE_JAW/.test(x.q[0]) && /N'Chele dell''operatore'/.test(x.q[0]) && /107200, 30000, 0,/.test(x.q[0]),
		'crea: affondo 0 ammesso (chela piatta), apice raddoppiato nel codice');
	check(/IF EXISTS \(SELECT 1 FROM VICE_JAW WHERE CODE = N'Chele dell''operatore'\)\s*SELECT 'KO_JAW_DUP_CODE'/.test(x.q[0]), 'crea: codice gia\' usato -> KO_JAW_DUP_CODE');
	check(x.r.body === 'OK' && x.a.length === 1 && x.a[0][2] === 'VICE_JAW:5', 'crea: OK e una riga di audit sul tipo');
	x = call('jaw GET /insertJaw', { CODE: 'C1', CLAW_LENGTH: '107200', Z_CLAW: '30000', Z_SINK_CLAW: '0' }, ko(ERR.KO_JAW_DUP_CODE));
	check(x.r.body === ERR.KO_JAW_DUP_CODE && x.a.length === 0, '   rifiuto inoltrato, niente audit');

	x = call('jaw GET /updateJaw', { ID: '5', CODE: 'C1', CLAW_LENGTH: '107300', Z_CLAW: '30000', Z_SINK_CLAW: '4000' }, ok({ misure: 1, ocl: 107200, ozc: 30000, ozs: 4000, ocode: 'C1', montate: 2 }));
	check(/DECLARE @misure bit = CASE WHEN ISNULL\(@ocl, -1\) <> 107300/.test(x.q[0]) && /ELSE IF @misure = 1 AND EXISTS \(SELECT 1 FROM VICE vv JOIN WORKORDER ww ON ww\.PALLET_ID = vv\.PALLET_ID\s+WHERE vv\.JAW_ID = @id AND ww\.STATUS = 3\) SELECT 'KO_JAW_ACTIVE_ORDER'/.test(x.q[0]),
		'modifica: le MISURE si fermano con un ordine a STATUS 3 sul pallet di una morsa con quel tipo');
	check(x.r.body === 'OK' && x.a.length === 1 && /lunghezza da 107\.2 mm a 107\.3 mm/.test(x.a[0][0]) && /montate su 2 morse/.test(x.a[0][0]),
		'modifica: audit col prima e il dopo, e su quante morse vale');
	x = call('jaw GET /updateJaw', { ID: '5', CODE: 'C1', CLAW_LENGTH: '107200', Z_CLAW: '30000', Z_SINK_CLAW: '4000' }, ok({ misure: 0, ocl: 107200, ozc: 30000, ozs: 4000, ocode: 'C1', montate: 0 }));
	check(x.r.body === 'OK' && x.a.length === 0, 'modifica senza cambi: OK e nessuna riga di audit');
	x = call('jaw GET /updateJaw', { ID: '5', CODE: 'C1', CLAW_LENGTH: '107300', Z_CLAW: '30000', Z_SINK_CLAW: '4000' }, ko(ERR.KO_JAW_ACTIVE_ORDER));
	check(x.r.body === ERR.KO_JAW_ACTIVE_ORDER && x.a.length === 0, 'modifica rifiutata: codice inoltrato, niente audit');

	x = call('jaw GET /setJawStatus', { ID: '5', STATUS: '0' }, ok({ code: 'C1' }));
	check(/ELSE IF 0 = 0 AND EXISTS \(SELECT 1 FROM VICE WHERE JAW_ID = @id\) SELECT 'KO_JAW_MOUNTED'/.test(x.q[0]) && x.a.length === 1 && /dismesso/.test(x.a[0][0]),
		'dismetti: un tipo montato non si dismette (KO_JAW_MOUNTED); audit');
	x = call('jaw GET /setJawStatus', { ID: '5', STATUS: '2' });
	check(x.r.code === 400, '   stato diverso da 0/1 -> 400');

	x = call('jaw DELETE /:ID', { ID: '5' }, ok({ code: 'C1' }));
	check(/ELSE IF @ever = 1 OR EXISTS \(SELECT 1 FROM VICE WHERE JAW_ID = @id\) OR EXISTS \(SELECT 1 FROM WORKORDER WHERE JAW_ID = @id\)\s*SELECT 'KO_JAW_IN_USE'/.test(x.q[0]),
		'cancella: solo un tipo MAI montato (EVER_MOUNTED), non montato adesso e mai usato da un ordine');
	check(/DELETE FROM VICE_JAW WHERE ID = @id/.test(x.q[0]) && x.r.body === 'OK' && x.a.length === 1, '   altrimenti si cancella, con audit');

	x = call('jaw GET /mountJaw', { VICE_ID: '1', JAW_ID: '5', ORDER_ID: '2117' }, ok({ cambiato: 1, fam: 'MORSA', da: 'C0', a: 'C1' }));
	check(/ELSE IF @jaw IS NOT NULL AND @jst <> 1 SELECT 'KO_JAW_RETIRED'/.test(x.q[0]), 'monta: un tipo dismesso non si monta');
	check(/ELSE IF @pallet IS NOT NULL AND EXISTS \(SELECT 1 FROM WORKORDER ww\s+WHERE ww\.PALLET_ID = @pallet AND ww\.STATUS = 3 AND ww\.ID <> 2117\) SELECT 'KO_JAW_ACTIVE_ORDER'/.test(x.q[0]),
		'monta: guardia sugli ordini a STATUS 3 del pallet, escluso quello che si sta avviando');
	check(/UPDATE VICE SET JAW_ID = @jaw WHERE ID = @vice;/.test(x.q[0]) && /UPDATE VICE_JAW SET EVER_MOUNTED = 1 WHERE ID = @jaw/.test(x.q[0]), 'monta: VICE.JAW_ID, e il tipo resta segnato come montato');
	check(x.a.length === 1 && /Morsa MORSA \(ID 1\): chele da C0 a C1/.test(x.a[0][0]) && x.a[0][2] === 'VICE:1', 'monta: audit «morsa X: chele da A a B»');
	x = call('jaw GET /mountJaw', { VICE_ID: '1', JAW_ID: '' }, ok({ cambiato: 1, fam: 'MORSA', da: 'C1', a: null }));
	check(/@jaw int = NULL/.test(x.q[0]) && /\(ID 1\): chele da C1 a nessuna/.test(x.a[0][0]) && /ww\.ID <> 0/.test(x.q[0]), 'smonta: JAW_ID vuoto, senza ordine da escludere');
	x = call('jaw GET /mountJaw', { VICE_ID: '1', JAW_ID: '5' }, ok({ cambiato: 0 }));
	check(x.r.body === 'OK' && x.a.length === 0, 'monta lo stesso tipo gia\' montato: OK, nessun audit');

	x = call('jaw GET /confirmOrderJaw', { ORDER_ID: '2117', JAW_ID: '5' }, ok({ da: null, a: 'C1' }));
	check(/ELSE IF @st = 3 AND ISNULL\(@old, -1\) <> @jaw SELECT 'KO_JAW_ACTIVE_ORDER'/.test(x.q[0]) && /UPDATE WORKORDER SET JAW_ID = @jaw WHERE ID = @o/.test(x.q[0]),
		'conferma sull\'ordine: WORKORDER.JAW_ID, mai cambiato sotto un ordine a STATUS 3');
	check(x.a.length === 1 && x.a[0][1] === 'ORDER' && /Ordine 2117: chele confermate C1/.test(x.a[0][0]), '   audit sull\'ordine');
	x = call('jaw GET /confirmOrderJaw', { ORDER_ID: '2117' });
	check(x.r.code === 400, '   senza tipo -> 400');

	x = call('jaw GET /show/:ID', { ID: 'all' }, [{ recordsets: [[{ ID: 5, CODE: 'C1' }, { ID: 6, CODE: 'C2' }], [{ ID: 1, FAMILY: 'M1', PALLET_ID: 9, JAW_ID: 5 }]] }]);
	check(Array.isArray(x.r.body) && x.r.body[0].MOUNTED_ON.length === 1 && x.r.body[0].MOUNTED_ON[0].FAMILY === 'M1' && x.r.body[1].MOUNTED_ON.length === 0,
		'elenco: per ogni tipo le morse su cui e\' montato');
	check(/\(SELECT COUNT\(\*\) FROM WORKORDER w WHERE w\.JAW_ID = j\.ID\) AS ORDERS/.test(x.q[0]) && !/STRING_AGG/.test(x.q[0]), '   e quanti ordini lo usano; niente STRING_AGG (compatibilita\' vecchia in cella)');

	console.log('\n3) misure della chela redirette al tipo montato (CONF/Vice.js)');
	const RIGA = { ID: '1', FAMILY: 'M', DESCR: 'D', STATUS: '2', X: '1', Y: '1', Z: '1', MAG: '1', MAG_POS: '1', POS_PLANT: '1' };
	x = call('vice GET /updateVice', Object.assign({}, RIGA, { CLAW_LENGTH: '107200', Z_CLAW: 'null', Z_SINK_CLAW: '4000' }), ok({ misure: 0, jaw: 7, ocl: 107200, ozc: null, ozs: 4000, code: 'C' }));
	check(/DECLARE @cl int = 107200, @zc int = NULL, @zs int = 4000;/.test(x.q[0]), 'updateVice: "null" (letto da VICES con misura vuota) = nessun cambio');
	check(/IF @misure = 1 AND @jaw IS NULL SELECT 'KO_NO_JAW'/.test(x.q[0]) && /ELSE IF @misure = 1 AND EXISTS \(SELECT 1 FROM VICE vv JOIN WORKORDER ww/.test(x.q[0]),
		'updateVice: una misura DIVERSA senza tipo montato -> KO_NO_JAW; con un ordine a STATUS 3 -> KO_JAW_ACTIVE_ORDER');
	check(x.r.body === 'OK' && x.a.length === 0, 'updateVice con le misure di prima: OK, nessun audit (Attrezzaggio monta e smonta la morsa cosi\')');
	x = call('vice GET /updateVice', Object.assign({}, RIGA, { CLAW_LENGTH: '107300' }), ko(ERR.KO_NO_JAW));
	check(x.r.body === ERR.KO_NO_JAW, 'updateVice: rifiuto inoltrato nel body (il form lo mostra)');
	x = call('vice GET /updateVice', Object.assign({}, RIGA, { CLAW_LENGTH: '107300' }), ok({ misure: 1, jaw: 7, ocl: 107200, ozc: 30000, ozs: 4000, code: 'C' }));
	check(x.a.length === 1 && /lunghezza chela da 107200 um a 107300 um/.test(x.a[0][0]) && x.a[0][2] === 'VICE_JAW:7', 'updateVice: misura cambiata -> audit sul tipo');
	x = call('vice GET /insertVice', Object.assign({}, RIGA, { CLAW_LENGTH: '107200', Z_CLAW: '0', Z_SINK_CLAW: '0' }));
	check(x.r.body === ERR.KO_NO_JAW && x.q.length === 0, 'insertVice: una lunghezza su una morsa nuova -> KO_NO_JAW, nessuna query');
	x = call('vice GET /insertVice', Object.assign({}, RIGA, { CLAW_LENGTH: '', Z_CLAW: '0', Z_SINK_CLAW: '0' }), [{}]);
	check(x.r.body === 'OK' && /INSERT INTO VICE\s+\(ID, FAMILY, DESCR, STATUS, X, Y, Z, MAG, MAG_POS, POS_PLANT\)/.test(x.q[0]),
		'insertVice: senza misure (gli zeri di default del form) la morsa nasce, senza colonne della chela');
	x = call('vice GET /setStop', { VICE_ID: '1', PIECE_ID: '1029', STOP_BEYOND_CLAW: '25000' }, [{ recordset: [{ ref: 107200 }] }]);
	check(/DECLARE @ref int = \(SELECT j\.CLAW_LENGTH FROM VICE v JOIN VICE_JAW j ON j\.ID = v\.JAW_ID WHERE v\.ID=1\);/.test(x.q[0])
		&& /SET STOP_BEYOND_CLAW=25000, CLAW_LENGTH_REF=@ref/.test(x.q[0]) && /VALUES \(1, 1029, 25000, @ref\)/.test(x.q[0]),
		'setStop: la battuta si dichiara con le chele montate adesso (CLAW_LENGTH_REF)');
	check(x.a.length === 1 && /\(chele da 107200 um\)/.test(x.a[0][0]), '   e il diario lo dice');
	x = call('vice GET /stops/:viceID', { viceID: '1' }, [{ recordset: [] }]);
	check(/pv\.CLAW_LENGTH_REF,/.test(x.q[0]), 'elenco delle battute: anche CLAW_LENGTH_REF, per mostrare la battuta corretta');
	check(fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8').includes("app.use('/api/conf/viceJaw'	, viceJawRouter);"), 'server.js: rotte montate su /api/conf/viceJaw');
	const hmiErr = fs.readFileSync(path.join(__dirname, '..', 'HMI', 'src', 'util', 'errorCodes.js'), 'utf8');
	check(['KO_NO_JAW', 'KO_JAW_ACTIVE_ORDER', 'KO_JAW_RETIRED', 'KO_JAW_MOUNTED', 'KO_JAW_IN_USE', 'KO_JAW_DUP_CODE'].every(k => ERR[k] === k && hmiErr.includes('export const ' + k)),
		'codici di rifiuto nuovi nel backend e nella copia del pannello');

	console.log('\n4) script SQL');
	const vj = scripts('vice-jaw.sql'), vjc = codice(vj);
	check(/CREATE TABLE dbo\.VICE_JAW/.test(vjc) && /CONSTRAINT UQ_VICE_JAW_CODE UNIQUE \(CODE\)/.test(vjc)
		&& /CHECK \(CLAW_LENGTH IS NULL OR CLAW_LENGTH > 0\)/.test(vjc) && /CHECK \(Z_CLAW IS NULL OR Z_CLAW > 0\)/.test(vjc) && /CHECK \(Z_SINK_CLAW IS NULL OR Z_SINK_CLAW >= 0\)/.test(vjc),
		'VICE_JAW: codice unico, lunghezza e altezza > 0, affondo >= 0');
	check(/ALTER TABLE dbo\.VICE ADD JAW_ID int NULL;/.test(vjc) && /ALTER TABLE dbo\.WORKORDER ADD JAW_ID int NULL;/.test(vjc) && /ALTER TABLE dbo\.PIECE_ON_VICE ADD CLAW_LENGTH_REF int NULL/.test(vjc),
		'colonne nuove: VICE.JAW_ID, WORKORDER.JAW_ID, PIECE_ON_VICE.CLAW_LENGTH_REF');
	check(/EXEC sp_refreshview @v;/.test(vjc) && /referenced_entity_name IN \(N'VICE', N'WORKORDER', N'PIECE_ON_VICE'\)/.test(vjc), 'sp_refreshview sulle viste delle tre tabelle (VICES e\' v.*)');
	check(/IF EXISTS \(SELECT 1 FROM dbo\.VICE_JAW\) OR EXISTS \(SELECT 1 FROM dbo\.VICE WHERE JAW_ID IS NOT NULL\)/.test(vjc) && /MIGRAZIONE: gia'' fatta/.test(vjc),
		'migrazione una volta sola');
	check(/WHERE CLAW_LENGTH < 0 OR Z_CLAW < 0 OR Z_SINK_CLAW < 0/.test(vjc) && /FERMO: una o piu'' morse hanno una misura della chela NEGATIVA/.test(vjc), 'un negativo ferma la migrazione (cambierebbe le quote)');
	check(/BEGIN TRAN;/.test(vjc) && /IF @@TRANCOUNT > 0 ROLLBACK;/.test(vjc), 'migrazione in una transazione: o tutto o niente');
	check(!/UPDATE (dbo\.)?VICE SET (CLAW_LENGTH|Z_CLAW|Z_SINK_CLAW)/.test(vjc) && !/DROP COLUMN|sp_rename/.test(vjc), 'le colonne vecchie di VICE restano com\'erano: non si scrivono, non si tolgono, non si rinominano');
	check(/UPDATE pv SET CLAW_LENGTH_REF = v\.CLAW_LENGTH/.test(vjc), 'CLAW_LENGTH_REF delle battute = la chela della loro morsa');

	const z = scripts('coordinates-z-mc.sql'), p = codice(scripts('coordinates-push-mc.sql')), b = codice(scripts('coordinates-blow-mc.sql'));
	const CORR = 'pv.STOP_BEYOND_CLAW + pv.CLAW_LENGTH_REF/2 - j.CLAW_LENGTH/2';
	check(p.includes(CORR) && b.includes(CORR), 'spinta e soffiaggio: la stessa correzione, dichiarata + REF/2 - montata/2');
	check(/cross apply \(select case when pv\.CLAW_LENGTH_REF is null or ISNULL\(j\.CLAW_LENGTH, 0\) <= 0\s+then pv\.STOP_BEYOND_CLAW/.test(p), 'spinta: senza REF o chela non misurata, la dichiarata com\'e\'');
	check(/where w\.JAW_ID is null or w\.JAW_ID = v\.JAW_ID;/.test(z) && !/w\.JAW_ID/.test(p.slice(p.indexOf('ALTER VIEW'))) && !/w\.JAW_ID/.test(b.slice(b.indexOf('ALTER VIEW'))),
		'blocco chele SOLO in COORDINATES_Z_MC (il PLC si ferma col 799 prima di muovere)');
	check([z, p, b].every(t => /left\s+join VICE_JAW j\s+on j\.ID = v\.JAW_ID/.test(t)), 'le tre viste leggono le misure dal tipo montato');
	check(!/\bv\.(CLAW_LENGTH|Z_CLAW|Z_SINK_CLAW)\b/.test(p.slice(p.indexOf('ALTER VIEW'))) && !/\bv\.(CLAW_LENGTH|Z_CLAW|Z_SINK_CLAW)\b/.test(b.slice(b.indexOf('ALTER VIEW'))),
		'nessuna vista legge piu\' le misure dalla riga della morsa');
	const vs = codice(scripts('vices-view.sql'));
	check(/j\.Z_CLAW AS Z_CLAW,/.test(vs) && /j\.Z_SINK_CLAW AS Z_SINK_CLAW,/.test(vs) && /j\.CLAW_LENGTH AS CLAW_LENGTH,/.test(vs) && /v\.JAW_ID,\s*RTRIM\(j\.CODE\) AS JAW_CODE,/.test(vs) && !/v\.\*/.test((vs.match(/DECLARE @nuova nvarchar\(max\) = N'([^']*)'/) || [])[1] || 'v.*'),
		'VICES: colonne per esteso, misure dal tipo con lo stesso nome, JAW_ID e JAW_CODE');
	check(/FERMO: VICE ha colonne che la vista nuova non elenca/.test(vs), '   e si ferma se VICE ha colonne che perderebbe');
	const vr = scripts('vice-jaw-views-rollback.sql');
	check((vr.match(/EXEC \(N'ALTER VIEW dbo\.(COORDINATES_Z_MC|COORDINATES_PUSH_MC|COORDINATES_BLOW_MC|VICES) AS/g) || []).length === 4 && (vr.match(/SELECT @def AS definizione_trovata;/g) || []).length >= 8,
		'ritorno delle viste: quattro ALTER, ognuno dopo aver stampato la definizione trovata');
	const vjr = scripts('vice-jaw-rollback.sql');
	check(vjr.indexOf("FERMO: queste viste leggono ancora il catalogo") > 0 && vjr.indexOf('FERMO: queste viste') < vjr.indexOf('DROP TABLE dbo.VICE_JAW'),
		'ritorno dello schema: prima le viste, altrimenti FERMO senza toccare niente');
	check(/UPDATE v SET CLAW_LENGTH = j\.CLAW_LENGTH, Z_CLAW = j\.Z_CLAW, Z_SINK_CLAW = j\.Z_SINK_CLAW/.test(vjr) && /UPDATE pv SET STOP_BEYOND_CLAW = pv\.STOP_BEYOND_CLAW \+ pv\.CLAW_LENGTH_REF\/2 - j\.CLAW_LENGTH\/2/.test(vjr),
		'   riporta nella morsa le misure del tipo montato e la battuta corretta: le viste di prima danno gli stessi numeri');
	check(/BEGIN TRAN;/.test(vjr) && /battute corrette verrebbero negative/.test(vjr), '   in una transazione, e FERMO se una battuta corretta verrebbe negativa');
	for (const f of ['vice-jaw-check.sql', 'vice-jaw-controlli.sql']) {
		const t = codice(scripts(f)).replace(/^\s*PRINT[^\n]*$/gm, '');
		check(!/\b(INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|EXEC|TRUNCATE)\b/i.test(t), f + ': solo SELECT');
	}
	const ascii = f => !fs.readFileSync(path.join(__dirname, 'scripts', f)).some(c => c > 127);
	check(['vice-jaw.sql', 'vice-jaw-rollback.sql', 'vices-view.sql', 'vice-jaw-check.sql', 'vice-jaw-controlli.sql', 'coordinates-z-mc.sql'].every(ascii), 'script nuovi solo ASCII (la vista della spinta resta UTF-8: si lancia con -f 65001)');

	console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
	process.exit(failed ? 1 : 0);
})();
