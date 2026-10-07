// ============================================================================
// test_gripper_hook_route.js — uncino per i cassetti nel backend delle pinze
// (CONF/Gripper.js, consegna 34 del 7/10)
//
//   1. updateGripper scrive HAS_HOOK (1/0, true/false) come gli altri campi;
//      PASS-THROUGH: senza il parametro, o con un valore non riconosciuto,
//      scrive HAS_HOOK=HAS_HOOK (il valore a DB resta, non si azzera);
//   2. insertGripper: HAS_HOOK dal form, default 0;
//   3. setHasHook (solo l'uncino, per la gemella della pinza doppia):
//      validazione, query, audit solo se il valore cambia, KO_NOT_FOUND;
//   4. la lettura passa dalla vista: select * from GRIPPERS (HAS_HOOK c'e'
//      dopo scripts/gripper-has-hook.sql).
//
// Uso:   node test_gripper_hook_route.js
// NON richiede DB: mssql/express/DBFunct/LogFunct/auditLog sono stub; le
// route reali vengono chiamate e le query catturate.
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');

const routes = {};
const queries = [];
const audits = [];
let risposta = () => ({ recordset: [], rowsAffected: [1] });
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(null, risposta(q)); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	if (req.endsWith('auditLog')) return { audit: (...a) => audits.push(a), SRC_CONF: 'CONF', SRC_PUSH_SIM: 'PUSH_SIM' };
	return origLoad.apply(this, arguments);
};
require(path.join(__dirname, 'CONF', 'Gripper.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const res = () => ({ body: null, code: 200, send(b) { this.body = b; return this; }, status(c) { this.code = c; return this; } });
const lastQuery = () => queries[queries.length - 1];
const base = extra => ({ query: Object.assign({ ID: 26, FAMILY: 'Pinza pezzo DOPPIA', DESCR: 'x', X_BODY: 0, Y_BODY: 0, Z_BODY: 0, X_CLAW: 0, Y_CLAW: 0, Z_CLAW: 0, STATUS: 2, POS_MAG: -1, POS_PLANT: 1000 }, extra) });
const hookIn = q => (q.match(/HAS_HOOK=([A-Z_]+|\d)/) || [])[1];

console.log('1) updateGripper: HAS_HOOK come gli altri campi, pass-through se manca');
for (const [v, atteso] of [['1', '1'], ['0', '0'], ['true', '1'], ['false', '0'], [1, '1'], [0, '0']]) {
	routes['GET /updateGripper'](base({ HAS_HOOK: v }), res());
	check(hookIn(lastQuery()) === atteso, 'HAS_HOOK=' + JSON.stringify(v) + ' -> HAS_HOOK=' + atteso);
}
routes['GET /updateGripper'](base({}), res());
check(hookIn(lastQuery()) === 'HAS_HOOK', 'senza HAS_HOOK -> HAS_HOOK=HAS_HOOK: un client che non lo manda non lo azzera');
for (const v of ['', 'abc', '2', 'null']) {
	routes['GET /updateGripper'](base({ HAS_HOOK: v }), res());
	check(hookIn(lastQuery()) === 'HAS_HOOK', '   valore non riconosciuto ' + JSON.stringify(v) + ' -> pass-through');
}
check(/CLAW_LENGTH=CLAW_LENGTH,\s*HAS_HOOK=HAS_HOOK\s+where ID='26'/.test(lastQuery()), '   nella stessa UPDATE, dopo CLAW_LENGTH, sulla riga ID');

console.log('\n2) insertGripper: HAS_HOOK dal form, default 0');
routes['GET /insertGripper'](base({ ID: undefined, HAS_HOOK: '1', POS_MAG: -1 }), res());
let q = lastQuery();
check(/CLAW_LENGTH, HAS_HOOK\)/.test(q) && /NULL,\s*1\s*;?$/.test(q.trim()), 'colonna HAS_HOOK nell\'elenco e valore 1');
routes['GET /insertGripper'](base({ ID: undefined, POS_MAG: -1 }), res());
check(/NULL,\s*0\s*;?$/.test(lastQuery().trim()), '   senza parametro: 0, la pinza nuova nasce senza uncino (il valore lo scrive il backend, non si conta sul default della colonna)');

console.log('\n3) setHasHook: solo l\'uncino, per la gemella');
let r = res();
routes['GET /setHasHook']({ query: { ID: 'x', HAS_HOOK: '1' } }, r);
check(r.code === 400 && r.body === 'KO_BAD_INPUT', 'ID non valido: 400 KO_BAD_INPUT');
r = res();
routes['GET /setHasHook']({ query: { ID: '37' } }, r);
check(r.code === 400 && r.body === 'KO_BAD_INPUT', 'HAS_HOOK mancante: 400 (niente scrittura cieca)');
const nq = queries.length;
risposta = () => ({ recordset: [{ n: 1, old: true, fam: 'Pinza pezzo DOPPIA' }], rowsAffected: [1] });
r = res();
routes['GET /setHasHook']({ query: { ID: '37', HAS_HOOK: '0' } }, r);
q = lastQuery();
check(queries.length === nq + 1 && /UPDATE GRIPPER SET HAS_HOOK=0 WHERE ID=37;/.test(q) && !/FAMILY=|POS_MAG=|STATUS=/.test(q.replace(/RTRIM\(FAMILY\)/, '')) && r.body === 'OK',
	'UPDATE GRIPPER SET HAS_HOOK=0 WHERE ID=37, nessun altro campo, OK');
check(audits.length === 1 && /uncino per i cassetti da si a no/.test(audits[0][0]) && audits[0][1] === 'CONF' && audits[0][2] === 'GRIPPER:37', '   audit: "uncino per i cassetti da si a no"');
risposta = () => ({ recordset: [{ n: 1, old: false, fam: 'Pinza pezzo DOPPIA' }], rowsAffected: [1] });
routes['GET /setHasHook']({ query: { ID: '37', HAS_HOOK: '0' } }, res());
check(audits.length === 1, '   stesso valore di prima: nessun audit');
risposta = () => ({ recordset: [], rowsAffected: [0] });
r = res();
routes['GET /setHasHook']({ query: { ID: '999', HAS_HOOK: '1' } }, r);
check(r.body === 'KO_NOT_FOUND', '   pinza inesistente: KO_NOT_FOUND');

console.log('\n4) lettura: dalla vista GRIPPERS');
risposta = () => ({ recordset: [{ ID: 26, HAS_HOOK: true }], rowsAffected: [1] });
r = res();
routes['GET /show/:ID']({ params: { ID: 'all' } }, r);
check(/select \* from GRIPPERS/.test(lastQuery()) && r.body[0].HAS_HOOK === true, 'show/all: select * from GRIPPERS, HAS_HOOK passa com\'e\' (bit -> true/false)');

console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
