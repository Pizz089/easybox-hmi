// ============================================================================
// test_shelf_guard.js — guardia anti-sovrapposizione scaffale pinze
// (CONF/Gripper.js, shelfSlotGuard): la GEMELLA di una pinza doppia (stesso
// SUB_POS > 0) e' ammessa nello slot, una pinza DIVERSA resta rifiutata.
//
// Uso:   node test_shelf_guard.js
// NON richiede DB: mssql/express/DBFunct/LogFunct sono stub; la route reale
// viene chiamata e la query catturata; il predicato SQL viene poi VALUTATO
// da un piccolo interprete sulle righe reali della cella (1, 26, 37).
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');

const routes = {};
const queries = [];
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(null, { recordset: [], rowsAffected: [1] }); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
require(path.join(__dirname, 'CONF', 'Gripper.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const res = () => ({ body: null, send(b) { this.body = b; }, status() { return this; } });
const lastQuery = () => queries[queries.length - 1];

// righe REALI della cella
const GRIPPER = [
	{ ID: 1,  SUB_POS: 0, POS_MAG: 4, POS_PLANT: 0 },
	{ ID: 26, SUB_POS: 3, POS_MAG: 3, POS_PLANT: 1000 },
	{ ID: 37, SUB_POS: 3, POS_MAG: 3, POS_PLANT: 1000 },
];
// interprete del predicato "occupato" estratto dalla query catturata:
//   g2.POS_MAG=<n> and g2.POS_MAG<1000 and g2.POS_PLANT>=0 [and g2.ID<>id]
//   [and not (g2.SUB_POS>0 and g2.SUB_POS=(select SUB_POS from GRIPPER where ID=id))]
function occupiedBy(query) {
	const m = query.match(/NOT EXISTS \(select 1 from GRIPPER g2 where ([^)]*(?:\([^)]*\))?[^)]*)\)/);
	if (!m) throw new Error('predicato slot non trovato');
	const pred = m[1];
	const posMag = Number((pred.match(/g2\.POS_MAG=(\d+)/) || [])[1]);
	const exId = (pred.match(/g2\.ID<>(\d+)/) || [])[1];
	const twinOf = (pred.match(/select SUB_POS from GRIPPER where ID=(\d+)/) || [])[1];
	const writerSub = twinOf ? GRIPPER.find(g => g.ID == twinOf).SUB_POS : null;
	return GRIPPER.filter(g2 => g2.POS_MAG == posMag && g2.POS_MAG < 1000 && g2.POS_PLANT >= 0
		&& (exId === undefined || g2.ID != exId)
		&& !(twinOf !== undefined && g2.SUB_POS > 0 && g2.SUB_POS === writerSub)).map(g => g.ID);
}
const upd = (ID, POS_MAG) => ({ query: { ID, POS_MAG, FAMILY: 'x', DESCR: '', X_BODY: 0, Y_BODY: 0, Z_BODY: 0, X_CLAW: 0, Y_CLAW: 0, Z_CLAW: 0, STATUS: 2, POS_PLANT: 0 } });

console.log('1) update: gemella ammessa nello slot della sorella');
routes['GET /updateGripper'](upd(37, 3), res());
let q = lastQuery();
check(/and not \(g2\.SUB_POS>0 and g2\.SUB_POS=\(select SUB_POS from GRIPPER where ID=37\)\)/.test(q), 'esclusione delle gemelle nel guard (per SUB_POS della pinza in scrittura)');
check(occupiedBy(q).length === 0, 'gemella 37 su slot 3 (occupato dalla 26): AMMESSA');
routes['GET /updateGripper'](upd(26, 3), res());
check(occupiedBy(lastQuery()).length === 0, 'gemella 26 su slot 3 (occupato dalla 37): AMMESSA');

console.log('\n2) update: pinza DIVERSA rifiutata');
routes['GET /updateGripper'](upd(1, 3), res());
check(occupiedBy(lastQuery()).join() === '26,37', 'pinza pallet (SUB_POS 0) su slot 3: RIFIUTATA (occupato da 26 e 37)');
routes['GET /updateGripper'](upd(1, 4), res());
check(occupiedBy(lastQuery()).length === 0, 'pinza pallet sul proprio slot 4: ammessa (esclude se stessa)');

console.log('\n3) insert: nessuna esclusione gemelle (nasce con SUB_POS 0)');
routes['GET /insertGripper']({ query: { POS_MAG: 3, FAMILY: 'nuova', DESCR: '', X_BODY: 0, Y_BODY: 0, Z_BODY: 0, X_CLAW: 0, Y_CLAW: 0, Z_CLAW: 0, STATUS: 2, POS_PLANT: 0 } }, res());
q = lastQuery();
check(!/select SUB_POS from GRIPPER/.test(q), 'insert: guard strettamente esclusivo');
check(occupiedBy(q).join() === '26,37', 'nuova pinza su slot 3: RIFIUTATA');

console.log('\n4) SUB_POS non viene azzerato dall\'update');
routes['GET /updateGripper'](upd(26, 3), res());
check(!/SUB_POS\s*=\s*0/.test(lastQuery()), "nessun SUB_POS=0 nell'UPDATE");

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
