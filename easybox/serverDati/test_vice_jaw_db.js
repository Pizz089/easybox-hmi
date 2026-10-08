// ============================================================================
// test_vice_jaw_db.js — CATALOGO DELLE CHELE: le guardie provate su un
// DATABASE VERO (8/10, prompt 8, punto 17)
//
// test_vice_jaw.js controlla le guardie sul TESTO delle query; qui le ROTTE
// VERE (CONF/Vice.js, CONF/ViceJaw.js, WORKORDER/Order.js e la query del Play
// di WORKORDER/orderStatusSql.js) girano su una COPIA del clone del portatile
// col catalogo gia' installato (vice-jaw.sql e le viste), e si guarda cosa
// resta scritto nelle tabelle:
//   - updateJaw con un ordine a STATUS 3 (rifiutato, niente scritto); DESCR e
//     NOTE non mandati restano;
//   - mountJaw (anche con ORDER_ID: la guardia non si salta);
//   - delete di un tipo con EVER_MOUNTED (rifiutato) e di uno mai montato;
//   - updateVice coi valori di prima (come Attrezzaggi), con un apice, con
//     "1 OR 1=1"; insertVice con l'ID dal database (SCOPE_IDENTITY);
//   - setStop col tipo di riferimento, e X_Support letto dalla vista
//     COORDINATES_BLOW_MC: fermo cambiando tipo, segue la correzione della
//     misura del tipo di riferimento;
//   - il passaggio a STATUS 3 rifiutato (Play e rilancio): chele confermate
//     diverse da quelle montate, morsa senza tipo.
// I dati sono INVENTATI (codici "PROVA_DB ...", misure di fantasia) e si
// tolgono alla fine; pallet, pezzo e ordine-modello si prendono da quelli che
// la copia ha. Le righe di LOG scritte da VICE_trig restano.
//
// Uso (PowerShell, sul portatile):
//   $env:EASYBOX_DB_PROVA='ADMG_PROVA_CHELE'; node test_vice_jaw_db.js
// Senza EASYBOX_DB_PROVA: SALTATO (exit 0). Si rifiuta su ADMG e su un nome
// senza "PROVA": mai sul clone, mai in cella. Server e utente: DB_SERVER
// (default localhost\SQLEXPRESS), DB_USER e DB_PASSWORD (default quelli di
// DBFunct.js).
// Exit code 0 = tutti i check passati (o SALTATO), 1 = almeno uno fallito,
// 2 = database rifiutato o non pronto.
// ============================================================================
const Module = require('module');
const path = require('path');

const DB = process.env.EASYBOX_DB_PROVA || '';
if (!DB) { console.log('SALTATO: impostare EASYBOX_DB_PROVA col nome della COPIA di prova (es. ADMG_PROVA_CHELE).'); process.exit(0); }
if (/^admg$/i.test(DB) || !/prova/i.test(DB)) { console.log('NO: "' + DB + '" non e\' una copia di prova (mai ADMG, il nome deve contenere PROVA).'); process.exit(2); }
const configDB = {
	user: process.env.DB_USER || 'plc',
	password: process.env.DB_PASSWORD || 'plc',
	server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
	database: DB,
	connectionTimeout: 8000,
	options: { encrypt: false, trustServerCertificate: true },
};

// le rotte vere, con express, DBFunct, LogFunct e auditLog finti; mssql vero
const routes = {};
let currentMod = '';
const audits = [];
const emessi = [];
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[currentMod + ' ' + method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req.endsWith('DBFunct')) return { configDB, io: { emit: (...a) => emessi.push(a), on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	if (req.endsWith('auditLog')) return { audit: (...a) => audits.push(a), SRC_CONF: 'CONF', SRC_PUSH_SIM: 'PUSH_SIM', SRC_ORDER: 'ORDER' };
	return origLoad.apply(this, arguments);
};
const sql = require('mssql');
currentMod = 'jaw'; require(path.join(__dirname, 'CONF', 'ViceJaw.js'));
currentMod = 'vice'; require(path.join(__dirname, 'CONF', 'Vice.js'));
currentMod = 'order'; require(path.join(__dirname, 'WORKORDER', 'Order.js'));
const OS = require('./WORKORDER/orderStatusSql');
const ERR = require('./errorCodes');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const q = async text => (await sql.connect(configDB)).request().query(text);
const uno = async text => ((await q(text)).recordset || [])[0] || {};

// una rotta vera: risolve alla prima risposta (send o json), 15 s al massimo
function chiama(key, params, metodo) {
	const h = routes[key];
	if (!h) throw new Error('rotta mancante: ' + key);
	audits.length = 0;
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error('nessuna risposta da ' + key)), 15000);
		const r = {
			code: 200, body: null,
			status(c) { this.code = c; return this; },
			send(b) { this.body = b; clearTimeout(t); resolve(this); return this; },
			json(b) { this.body = b; clearTimeout(t); resolve(this); return this; },
		};
		h({ query: params, params, body: {}, method: metodo || 'GET' }, r);
	});
}
const play = async (id, status, pieceID) => OS.esito(await q(OS.query(OS.leggi({ id, status, pieceID }))));
const tr = v => Math.trunc(v / 2);

const CODICI = "N'PROVA_DB A', N'PROVA_DB B', N'PROVA_DB C'";
async function pulisci(viceId, ordId) {
	if (ordId) {
		await q(`UPDATE [POSITION] SET Order_ID = 0 WHERE Order_ID = ${ordId};`);
		await q(`DELETE FROM WORKORDER WHERE ID = ${ordId};`);
	}
	await q(`DELETE FROM WORKORDER WHERE JAW_ID IN (SELECT ID FROM VICE_JAW WHERE CODE IN (${CODICI}));`);
	await q(`DELETE FROM PIECE_ON_VICE WHERE CLAW_JAW_REF IN (SELECT ID FROM VICE_JAW WHERE CODE IN (${CODICI}))${viceId ? ' OR VICE_ID = ' + viceId : ''};`);
	// una morsa alla volta (VICE_trig): le morse della prova si riconoscono dalla descrizione
	const morse = (await q(`SELECT ID FROM VICE WHERE DESCR = N'harness test_vice_jaw_db'${viceId ? ' OR ID = ' + viceId : ''};`)).recordset || [];
	for (const m of morse) {
		await q(`DELETE FROM PIECE_ON_VICE WHERE VICE_ID = ${m.ID};`);
		await q(`DELETE FROM VICE WHERE ID = ${m.ID};`);
	}
	await q(`UPDATE VICE SET JAW_ID = NULL WHERE JAW_ID IN (SELECT ID FROM VICE_JAW WHERE CODE IN (${CODICI}));`);
	await q(`DELETE FROM VICE_JAW WHERE CODE IN (${CODICI});`);
}

(async () => {
	console.log('database: ' + DB + ' su ' + configDB.server);
	// (l'utente del backend, plc, e' db_datareader e db_datawriter: non vede
	// le definizioni delle viste, OBJECT_DEFINITION gli da' NULL)
	const pronto = await uno(`SELECT DB_NAME() AS db, CASE WHEN OBJECT_ID('dbo.VICE_JAW') IS NOT NULL AND COL_LENGTH('dbo.PIECE_ON_VICE', 'CLAW_JAW_REF') IS NOT NULL
		THEN 1 ELSE 0 END AS catalogo`);
	if (pronto.db !== DB || !pronto.catalogo) { console.log('NON PRONTO: ' + DB + ' senza il catalogo delle chele (lanciare prima vice-jaw.sql e gli script delle viste).'); process.exit(2); }
	await pulisci(null, null);
	const pallet = (await uno(`SELECT TOP 1 p.ID FROM PALLET p WHERE p.ID > 0 AND NOT EXISTS (SELECT 1 FROM VICE v WHERE v.PALLET_ID = p.ID)
		AND NOT EXISTS (SELECT 1 FROM WORKORDER w WHERE w.PALLET_ID = p.ID AND w.STATUS = 3) ORDER BY p.ID`)).ID;
	const pezzo = (await uno(`SELECT TOP 1 ID FROM PIECE WHERE ID > 0 ORDER BY ID`)).ID;
	const modello = (await uno(`SELECT TOP 1 ID FROM WORKORDER ORDER BY ID`)).ID;
	if (!pallet || !pezzo || !modello) { console.log('NON PRONTO: servono un pallet senza morsa, un pezzo e un ordine da copiare.'); process.exit(2); }
	let vice = null, ord = null;
	try {
		console.log('\n1) la morsa: insertVice con l\'ID dal database, updateVice coi valori di prima');
		let r = await chiama('vice GET /insertVice', { FAMILY: "Prova d'harness", DESCR: 'harness test_vice_jaw_db', STATUS: '0', X: '150000', Y: '100000', Z: '80000', MAG: '0', MAG_POS: '0', POS_PLANT: '0' });
		vice = r.body && r.body.ID;
		const nata = vice ? await uno(`SELECT ID, RTRIM(FAMILY) AS FAMILY, JAW_ID FROM VICE WHERE ID = ${Number(vice)}`) : {};
		check(r.body && r.body.ris === 'OK' && Number.isInteger(vice) && nata.ID === vice && nata.FAMILY === "Prova d'harness" && nata.JAW_ID === null,
			'insertVice: la morsa nasce senza ID mandato, la risposta porta l\'ID vero (SCOPE_IDENTITY), l\'apice resta un apice');
		const riga = await uno(`SELECT * FROM VICES WHERE ID = ${vice}`);
		const passa = { ID: riga.ID, FAMILY: (riga.FAMILY || '').trim(), DESCR: (riga.DESCR || '').trim(), STATUS: riga.STATUS, X: riga.X, Y: riga.Y, Z: riga.Z, MAG: riga.MAG, MAG_POS: riga.MAG_POS, POS_PLANT: riga.POS_PLANT };
		r = await chiama('vice GET /updateVice', Object.assign({}, passa, { PALLET_ID: String(pallet) }));
		check(r.body === 'OK' && (await uno(`SELECT PALLET_ID FROM VICE WHERE ID = ${vice}`)).PALLET_ID === pallet && audits.length === 0,
			'updateVice coi valori di prima e senza misure (come Attrezzaggi): montata sul pallet, nessun audit');
		const prima = await uno(`SELECT COUNT(*) AS n FROM VICE WHERE FAMILY = N'X'`);
		r = await chiama('vice GET /updateVice', Object.assign({}, passa, { ID: vice + ' OR 1=1', FAMILY: 'X' }));
		check(r.code === 400 && (await uno(`SELECT COUNT(*) AS n FROM VICE WHERE FAMILY = N'X'`)).n === prima.n, 'updateVice con ID "' + vice + ' OR 1=1": 400, nessuna morsa toccata');

		console.log('\n2) i tipi e il montaggio');
		await chiama('jaw GET /insertJaw', { CODE: 'PROVA_DB A', DESCR: 'tipo A', NOTE: 'nota prova', CLAW_LENGTH: '98766', Z_CLAW: '23456', Z_SINK_CLAW: '1234' });
		await chiama('jaw GET /insertJaw', { CODE: 'PROVA_DB B', DESCR: 'tipo B', CLAW_LENGTH: '86422', Z_CLAW: '21098', Z_SINK_CLAW: '0' });
		const A = (await uno(`SELECT ID FROM VICE_JAW WHERE CODE = N'PROVA_DB A'`)).ID, B = (await uno(`SELECT ID FROM VICE_JAW WHERE CODE = N'PROVA_DB B'`)).ID;
		check(A > 0 && B > 0, 'due tipi creati (insertJaw)');
		r = await chiama('jaw GET /mountJaw', { VICE_ID: String(vice), JAW_ID: String(A) });
		const ma = await uno(`SELECT v.JAW_ID, j.EVER_MOUNTED FROM VICE v JOIN VICE_JAW j ON j.ID = v.JAW_ID WHERE v.ID = ${vice}`);
		check(r.body === 'OK' && ma.JAW_ID === A && ma.EVER_MOUNTED === true, 'mountJaw: tipo A montato, EVER_MOUNTED a 1');

		console.log('\n3) un ordine a STATUS 3: misure e montaggio fermi');
		ord = (await uno(`SET NOCOUNT ON; DECLARE @n TABLE (ID int);
			INSERT INTO WORKORDER (PIECE_ID, GRIPPER_ID, VICE_ID, PALLET_ID, STATUS, MACHINE_ID, QUANTITY, X_PICK_DECENTRATED_TRAY, X_PLACE_DECENTRATED_TRAY, Y_PICK_DECENTRATED_TRAY, Y_PLACE_DECENTRATED_TRAY,
				X_PICK_DECENTRATED_MC, X_PLACE_DECENTRATED_MC, Y_PICK_DECENTRATED_MC, Y_PLACE_DECENTRATED_MC, FIXTURE_ID, OPTION1, OPTION2, PartProg_ID)
			OUTPUT inserted.ID INTO @n
			SELECT ${pezzo}, w.GRIPPER_ID, ${vice}, ${pallet}, 4, w.MACHINE_ID, 1, 0,0,0,0, 0,0,0,0, w.FIXTURE_ID, 0, 0, w.PartProg_ID FROM WORKORDER w WHERE w.ID = ${modello};
			SELECT ID FROM @n;`)).ID;
		check(ord > 0, 'ordine di prova a STATUS 4 sul pallet della morsa');
		let e = await play(ord, 3, pezzo);
		check(e.ris === 'OK' && (await uno(`SELECT STATUS FROM WORKORDER WHERE ID = ${ord}`)).STATUS === 3, 'Play con le chele montate e nessuna conferma: passa a 3');
		r = await chiama('jaw GET /updateJaw', { ID: String(A), CODE: 'PROVA_DB A', CLAW_LENGTH: '98768', Z_CLAW: '23456', Z_SINK_CLAW: '1234' });
		check(r.body === ERR.KO_JAW_ACTIVE_ORDER && (await uno(`SELECT CLAW_LENGTH FROM VICE_JAW WHERE ID = ${A}`)).CLAW_LENGTH === 98766 && audits.length === 0,
			'updateJaw di una misura con l\'ordine a 3: KO_JAW_ACTIVE_ORDER, niente scritto, niente audit');
		r = await chiama('jaw GET /updateJaw', { ID: String(A), CODE: 'PROVA_DB A', DESCR: 'tipo A, descrizione nuova', CLAW_LENGTH: '98766', Z_CLAW: '23456', Z_SINK_CLAW: '1234' });
		const dn = await uno(`SELECT RTRIM(DESCR) AS DESCR, RTRIM(NOTE) AS NOTE FROM VICE_JAW WHERE ID = ${A}`);
		check(r.body === 'OK' && dn.DESCR === 'tipo A, descrizione nuova' && dn.NOTE === 'nota prova', 'updateJaw senza cambiare misure: passa anche con l\'ordine a 3; NOTE non mandata resta');
		r = await chiama('jaw GET /mountJaw', { VICE_ID: String(vice), JAW_ID: String(B), ORDER_ID: String(ord) });
		check(r.body === ERR.KO_JAW_ACTIVE_ORDER && (await uno(`SELECT JAW_ID FROM VICE WHERE ID = ${vice}`)).JAW_ID === A,
			'mountJaw con l\'ordine a 3, anche mandando il suo ORDER_ID: KO_JAW_ACTIVE_ORDER, chele invariate');
		r = await chiama('vice GET /updateVice', Object.assign({}, passa, { CLAW_LENGTH: '98770' }));
		check(r.body === ERR.KO_JAW_ACTIVE_ORDER && (await uno(`SELECT CLAW_LENGTH FROM VICE_JAW WHERE ID = ${A}`)).CLAW_LENGTH === 98766, 'updateVice con una misura diversa e l\'ordine a 3: KO_JAW_ACTIVE_ORDER');
		e = await play(ord, 4, pezzo);
		check(e.ris === 'OK' && (await uno(`SELECT STATUS FROM WORKORDER WHERE ID = ${ord}`)).STATUS === 4 && (await uno(`SELECT COUNT(*) AS n FROM [POSITION] WHERE Order_ID = ${ord}`)).n === 0,
			'torna a grezzo (4): tasche liberate');

		console.log('\n4) la battuta: riferimento = tipo montato, X_Support dalla vista');
		const xs = async () => { const b = await uno(`SELECT CLAW_LENGTH, STOP_BEYOND_CLAW FROM COORDINATES_BLOW_MC WHERE ORDER_ID = ${ord}`); return tr(b.CLAW_LENGTH) + b.STOP_BEYOND_CLAW; };
		r = await chiama('vice GET /setStop', { VICE_ID: String(vice), PIECE_ID: String(pezzo), STOP_BEYOND_CLAW: '24680' });
		check(r.body === 'OK' && (await uno(`SELECT CLAW_JAW_REF FROM PIECE_ON_VICE WHERE VICE_ID = ${vice} AND PIECE_ID = ${pezzo}`)).CLAW_JAW_REF === A, 'setStop: battuta dichiarata col tipo montato (A) come riferimento');
		const x0 = await xs();
		check(x0 === tr(98766) + 24680, 'X_Support (vista del soffiaggio) = A/2 + battuta: ' + x0);
		r = await chiama('jaw GET /mountJaw', { VICE_ID: String(vice), JAW_ID: String(B) });
		check(r.body === 'OK' && await xs() === x0, 'montato un tipo diverso (B, piu\' corto): X_Support resta fermo');
		await chiama('jaw GET /updateJaw', { ID: String(A), CODE: 'PROVA_DB A', CLAW_LENGTH: '99768', Z_CLAW: '23456', Z_SINK_CLAW: '1234' });
		check(await xs() === x0 + 501, 'corretta la misura del tipo di riferimento (A +1002): la battuta la segue, X_Support +501');
		await chiama('jaw GET /updateJaw', { ID: String(B), CODE: 'PROVA_DB B', CLAW_LENGTH: '88422', Z_CLAW: '21098', Z_SINK_CLAW: '0' });
		check(await xs() === x0 + 501, 'corretta la misura del tipo montato (B) che non e\' il riferimento: X_Support fermo');
		r = await chiama('vice GET /setStop', { VICE_ID: String(vice), PIECE_ID: String(pezzo), STOP_BEYOND_CLAW: '13579' });
		check(r.body === 'OK' && (await uno(`SELECT CLAW_JAW_REF FROM PIECE_ON_VICE WHERE VICE_ID = ${vice} AND PIECE_ID = ${pezzo}`)).CLAW_JAW_REF === B && await xs() === tr(88422) + 13579,
			'battuta dichiarata di nuovo con B montato: riferimento B, X_Support = B/2 + battuta');
		await chiama('jaw GET /updateJaw', { ID: String(B), CODE: 'PROVA_DB B', CLAW_LENGTH: '89424', Z_CLAW: '21098', Z_SINK_CLAW: '0' });
		check(await xs() === tr(88422) + 13579 + 501, 'corretta la misura del tipo montato, che adesso e\' il riferimento: X_Support segue (+501)');

		console.log('\n5) il passaggio a STATUS 3 rifiutato per le chele');
		r = await chiama('jaw GET /confirmOrderJaw', { ORDER_ID: String(ord), JAW_ID: String(A) });
		e = await play(ord, 3, pezzo);
		check(r.body === 'OK' && e.ris === ERR.KO_ORDER_JAW_MISMATCH && (await uno(`SELECT STATUS FROM WORKORDER WHERE ID = ${ord}`)).STATUS === 4
			&& (await uno(`SELECT COUNT(*) AS n FROM [POSITION] WHERE Order_ID = ${ord}`)).n === 0,
			'ordine confermato con A, montate B: Play rifiutato (KO_ORDER_JAW_MISMATCH), resta a 4, nessuna tasca prenotata');
		await chiama('jaw GET /confirmOrderJaw', { ORDER_ID: String(ord), JAW_ID: String(B) });
		e = await play(ord, 3, pezzo);
		check(e.ris === 'OK' && (await uno(`SELECT STATUS FROM WORKORDER WHERE ID = ${ord}`)).STATUS === 3, 'confermato con B (montate): passa a 3');
		await play(ord, 4, pezzo);
		r = await chiama('jaw GET /mountJaw', { VICE_ID: String(vice), JAW_ID: '' });
		e = await play(ord, 3, pezzo);
		check(r.body === 'OK' && e.ris === ERR.KO_ORDER_VICE_NO_JAW && (await uno(`SELECT STATUS FROM WORKORDER WHERE ID = ${ord}`)).STATUS === 4,
			'morsa del pallet senza tipo montato: Play rifiutato (KO_ORDER_VICE_NO_JAW), resta a 4');
		await q(`UPDATE WORKORDER SET STATUS = 5 WHERE ID = ${ord};`);
		r = await chiama('order GET /relaunch/preview/:orderId', { orderId: String(ord) });
		const rl = await chiama('order POST /relaunch/:orderId', { orderId: String(ord), mode: 'available' }, 'POST');
		check(r.body && r.body.blocked === ERR.KO_ORDER_VICE_NO_JAW && rl.body && rl.body.ris === ERR.KO_ORDER_VICE_NO_JAW && (await uno(`SELECT STATUS FROM WORKORDER WHERE ID = ${ord}`)).STATUS === 5,
			'rilancio: lo dice gia\' l\'anteprima, e il rilancio e\' rifiutato (KO_ORDER_VICE_NO_JAW), l\'ordine resta FINITO');
		await q(`UPDATE WORKORDER SET STATUS = 4 WHERE ID = ${ord};`);

		console.log('\n6) cancellare e dismettere');
		r = await chiama('jaw DELETE /:ID', { ID: String(A) });
		check(r.body === ERR.KO_JAW_IN_USE && (await uno(`SELECT COUNT(*) AS n FROM VICE_JAW WHERE ID = ${A}`)).n === 1, 'tipo montato almeno una volta (EVER_MOUNTED): non si cancella (KO_JAW_IN_USE)');
		await chiama('jaw GET /insertJaw', { CODE: 'PROVA_DB C', CLAW_LENGTH: '77777', Z_CLAW: '22222', Z_SINK_CLAW: '0' });
		const C = (await uno(`SELECT ID FROM VICE_JAW WHERE CODE = N'PROVA_DB C'`)).ID;
		r = await chiama('jaw DELETE /:ID', { ID: String(C) });
		check(r.body === 'OK' && (await uno(`SELECT COUNT(*) AS n FROM VICE_JAW WHERE ID = ${C}`)).n === 0, 'tipo mai montato e mai usato: si cancella');
		r = await chiama('jaw GET /setJawStatus', { ID: String(B), STATUS: '0' });
		const r2 = await chiama('jaw GET /mountJaw', { VICE_ID: String(vice), JAW_ID: String(B) });
		check(r.body === 'OK' && r2.body === ERR.KO_JAW_RETIRED && (await uno(`SELECT JAW_ID FROM VICE WHERE ID = ${vice}`)).JAW_ID === null, 'tipo dismesso: non si monta (KO_JAW_RETIRED)');
	} catch (err) {
		check(false, 'eccezione: ' + (err && err.message));
	} finally {
		try { await pulisci(vice, ord); console.log('\npulizia: righe della prova tolte'); } catch (err) { console.log('\npulizia NON riuscita: ' + err.message); failed++; }
		try { await sql.close(); } catch (e) { /* niente */ }
	}
	console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
	process.exit(failed ? 1 : 0);
})();
