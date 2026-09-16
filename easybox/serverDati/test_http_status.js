// ============================================================================
// test_http_status.js — contratto degli esiti (15/9, cantiere http-status).
//
// REGOLA: un fallimento TECNICO (errore SQL o di connessione) risponde con
// stato HTTP 500; un esito APPLICATIVO (i codici del contratto: KO_DUP,
// KO_ACTIVE_ORDER, KO_TRAY_EXTRACTED, KO_BAD_INPUT, "0 righe") resta 200 col
// codice nel corpo, perche' le pagine lo leggono per dare il messaggio giusto.
//
// PERCHE': prima OGNI fallimento usciva con stato 200 e "KO" nel corpo, e le
// pagine guardano quasi tutte il solo stato HTTP: una scrittura persa passava
// per riuscita (incidente FIXTURE_ON_PALLET del 15/9). Col 500 le pagine se ne
// accorgono senza modifiche lato frontend.
//
// Uso:   node test_http_status.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');
const fs = require('fs');

const routes = {};
let queryErr = null, connErr = null, results = [];
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(connErr),
		Request: function () { this.query = (q, cb) => cb(queryErr, results.length ? results.shift() : { recordset: [], rowsAffected: [0] }); },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
const SRV = __dirname;
for (const f of ['CONF/Tray.js', 'CONF/Grating.js', 'CONF/Position.js', 'CONF/Fixture.js', 'CONF/Gripper.js', 'CONF/Vice.js', 'CONF/Pallet.js', 'CONF/Piece.js', 'WORKORDER/Order.js'])
	require(path.join(SRV, f));
const errorCodes = require(path.join(SRV, 'errorCodes.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
function call(key, params, body, resultQueue) {
	results = resultQueue || [];
	const res = { code: 200, body: null, status(n) { this.code = n; return this; }, send(b) { this.body = b; }, json(o) { this.body = o; } };
	routes[key]({ params, query: params, body }, res);
	return res;
}

console.log('1) fallimento TECNICO (errore SQL) -> stato 500');
queryErr = new Error('boom');
const tech = [
	['GET /updateGrating', { ID: '7', NAME: 'G', DESCR: 'd', GRIPPER_ID: '1', PIECE_ID: '1', SAFEX: '20', SAFEY: '10' }],
	['GET /insertGrating', { NAME: 'G', DESCR: 'd', GRIPPER_ID: '1', PIECE_ID: '1', SAFEX: '20', SAFEY: '10' }],
	['GET /insertPositionTray', { TRAY_ID: '1', POS: '1', SUB_POS: '1', STATUS: '2', X: '1', Y: '1', PIECE_TYPE: '1' }],
	['DELETE /deletePositionsTray/:ID', { ID: '9' }],
	['GET /insertFixtureOnPallet', { PALLET_ID: '9', FIXTURE_ID: '1' }],
	['GET /updateFixtureOnPallet', { POS_PLANT: '9', ID: '1', POS_X: '0', POS_Y: '0', POS_Z: '0', POS_X_CORR: '0', POS_Y_CORR: '0', POS_Z_CORR: '0', POS_X_ROT: '0', POS_Y_ROT: '0', POS_Z_ROT: '0' }],
	['GET /updateTray', { ID: '1' }],
	['GET /teachTrays', { rows: JSON.stringify([{ tray: 1, xCorr: 0, yCorr: 0, zCorr: 0, xRot: 0, yRot: 0, zRot: 0 }]) }],
	['GET /insertOrder', { pieceID: '1', gripperID: '1', viceID: '0', fixtureID: '1', palletID: '1', machineID: '1', quantity: '1', PP: '1' }],
	['GET /updateOrder', { ID: '1', pieceID: '1', gripperID: '1', viceID: '0', fixtureID: '1', palletID: '1', status: '4', machineID: '1', quantity: '1', PP: '1' }],
];
for (const [key, params] of tech) {
	const r = call(key, params, null, []);
	check(r.code === 500, key + ' con errore SQL -> ' + r.code + ' (atteso 500)');
}
queryErr = null;

console.log('\n2) esito APPLICATIVO -> resta 200 col codice nel corpo');
let r = call('GET /insertPositionTray', { TRAY_ID: '12', POS: '1', SUB_POS: '5', STATUS: '2', X: '1', Y: '1', PIECE_TYPE: '1' }, null, [{ recordset: [], rowsAffected: [0] }]);
check(r.code === 200 && r.body === 'KO_DUP', 'insertPositionTray riga gia\' presente -> 200 KO_DUP');
// NB: 'DELETE /:ID' non e' verificabile qui — lo registrano piu' file (grigliato,
// attrezzatura, pinza, morsa, pallet, pezzo, ordine) e nella mappa vince
// l'ultimo caricato. Il KO_IN_USE del grigliato e' coperto da test_grating_assoc.
r = call('DELETE /deletePositionsTray/:ID', { ID: '9' }, null, [{ recordset: [{ ris: errorCodes.KO_ACTIVE_ORDER }] }]);
check(r.code === 200 && r.body === errorCodes.KO_ACTIVE_ORDER, 'delete tasche con ordine attivo -> 200 KO_ACTIVE_ORDER');
r = call('POST /associateGrating/:floor', { floor: '1' }, { gratingId: 7, source: { floor: 12 } },
	[{ recordset: [{ ID: 7, PIECE_ID: 21, PID: 21, THICKNESS: null, PX: 40000, PY: 70000, Z_PICK: 15000, Z_PLACE: 15000, TX: 820000, TY: 610000 }] },
	 { recordset: [{ ris: errorCodes.KO_TRAY_EXTRACTED, n: 0 }] }]);
check(r.code === 200 && r.body.ris === errorCodes.KO_TRAY_EXTRACTED, 'associa con cassetto estratto -> 200 KO_TRAY_EXTRACTED');
r = call('GET /updateGrating', { ID: '7', NAME: 'G', DESCR: 'd', GRIPPER_ID: '1', PIECE_ID: '1', SAFEX: '20', SAFEY: '10' }, null, [{ recordset: [{ ris: errorCodes.KO_DUP_NAME }] }]);
check(r.code === 200 && r.body === errorCodes.KO_DUP_NAME, 'grigliato con nome duplicato -> 200 KO_DUP_NAME');

console.log('\n2b) input MALFORMATO -> stato 400, codice ancora nel corpo');
const bad = [
	['GET /insertPositionTray', { TRAY_ID: '13', SUB_POS: '1' }, 'cassetto fuori range'],
	['DELETE /deletePositionsTray/:ID', { ID: '9; DROP' }, 'id non intero'],
	['GET /updateGrating', { ID: 'x', NAME: 'G' }, 'id grigliato non intero'],
	['GET /updateFixtureOnPallet', { PALLET_ID: 'x', FIXTURE_ID: '1' }, 'pallet non numerico'],
	['POST /associateGrating/:floor', { floor: '13' }, 'cassetto fuori range (JSON)'],
	['POST /resetProduction/:machineId', { machineId: '0' }, 'macchina non valida'],
];
for (const [key, params, what] of bad) {
	const r = call(key, params, params, []);
	const body = typeof r.body === 'string' ? r.body : (r.body && r.body.ris);
	check(r.code === 400 && body === 'KO_BAD_INPUT', key + ' (' + what + ') -> ' + r.code + ' ' + body);
}

console.log('\n3) nessun fallimento tecnico lasciato a 200 nel sorgente');
const walk = (dir, out = []) => {
	for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
		if (['node_modules', 'scripts', 'log', 'LOG'].includes(f.name)) continue;
		const p = path.join(dir, f.name);
		if (f.isDirectory()) walk(p, out); else out.push(p.replace(/\\/g, '/'));
	}
	return out;
};
const src = walk(SRV).filter(f => /\.js$/.test(f) && !/\/test_/.test(f));
let leftover = [], total500 = 0;
for (const f of src) {
	const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		if (/res\.status\(500\)/.test(lines[i])) total500++;
		const l = lines[i];
		if (!/res\.send\(\s*"(KO|error DB)"\s*\)/.test(l) && !/res\.json\(\s*\{\s*ris:\s*"KO"/.test(l)) continue;
		if (/res\.status\(/.test(l) || /^\s*(\/\/|\*)/.test(l)) continue;
		let ctx = l, seen = 0;
		for (let j = i - 1; j >= 0 && seen < 5; j--) {
			if (!lines[j].trim()) continue;
			ctx = lines[j] + '\n' + ctx; seen++;
			if (/if\s*\(\s*err\s*\)/.test(lines[j])) break;
		}
		if (/if\s*\(\s*err\s*\)/.test(ctx) && /log\.(error|standard)\s*\(/.test(ctx))
			leftover.push(f.replace(SRV + '/', '') + ':' + (i + 1));
	}
}
check(leftover.length === 0, 'nessun ramo if(err) risponde ancora 200 (' + (leftover.join(', ') || 'nessuno') + ')');
check(total500 >= 55, total500 + ' risposte 500 nel backend (attese almeno 55)');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
