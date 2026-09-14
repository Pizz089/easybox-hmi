// ============================================================================
// test_grating_assoc.js — cantiere grating-model: il grigliato e' un MODELLO,
// l'associazione ai cassetti vive in CONF/Tray.js (associateGrating /
// dissociateGrating) e CONF/Grating.js scrive solo l'header.
// Route reali con express/mssql a stub (coda di risultati per le route a due
// query: contesto + transazione).
//
// Uso:   node test_grating_assoc.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');

const routes = {};
const queries = [];
let results = [];
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(null, results.length ? results.shift() : { recordset: [], rowsAffected: [0] }); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
require(path.join(__dirname, 'CONF', 'Tray.js'));
require(path.join(__dirname, 'CONF', 'Grating.js'));
const errorCodes = require(path.join(__dirname, 'errorCodes.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const norm = q => q.replace(/\s+/g, ' ');
function call(key, params, body, resultQueue) {
	results = resultQueue || [];
	const before = queries.length;
	const res = { body: null, send(b) { this.body = b; }, json(o) { this.body = o; }, status() { return this; } };
	routes[key]({ params, query: params, body }, res);
	return { res, n: queries.length - before, q: queries.slice(before).map(norm) };
}
// THICKNESS null = spessore non misurato (nessun vincolo), Z_PICK/Z_PLACE del pezzo dal DB
const ctx = { recordset: [{ ID: 7, PIECE_ID: 21, THICKNESS: null, PX: 40000, PY: 70000, Z_PICK: 15000, Z_PLACE: 15000, TX: 820000, TY: 610000 }] };
const ok = n => ({ recordset: [{ ris: 'OK', n }] });

console.log('1) associateGrating: COPIA da cassetto tarato (default)');
let r2;
let r = call('POST /associateGrating/:floor', { floor: '1' }, { gratingId: 7, replace: false, source: { floor: 12 } }, [ctx, ok(91)]);
check(r.n === 2 && r.res.body.ris === 'OK' && r.res.body.n === 91, 'contesto + transazione, risposta {ris:OK, n:91}');
let t = r.q[1];
check(/SET XACT_ABORT ON;[\s\S]*BEGIN TRAN;[\s\S]*COMMIT TRAN;/.test(t), 'transazione unica (XACT_ABORT + BEGIN/COMMIT)');
check(/DECLARE @extract int[\s\S]*ELSE IF @extract <> 0 SELECT 'KO_TRAY_EXTRACTED'/.test(t), 'guardia EXTRACT<>0 (cassetto fuori o in manovra) PRIMA di scrivere');
check(/ELSE IF EXISTS \(SELECT 1 FROM \[POSITION\] p JOIN WORKORDERS w ON w\.ID = p\.Order_ID WHERE \(p\.PARENT = 'TRAY_1'\) AND w\.STATUS = 3\) SELECT 'KO_ACTIVE_ORDER'/.test(t), 'guardia ordine attivo sul target (predicato canonico)');
check(/RTRIM\(ISNULL\(FAMILY,''\)\) <> ''\) OR EXISTS \(SELECT 1 FROM \[POSITION\] WHERE \(PARENT = 'TRAY_1'\)\) SELECT 'KO_ALREADY_ASSOCIATED'/.test(t), 'senza replace: target deve essere LIBERO (FAMILY vuota E zero tasche)');
check(/NOT EXISTS \(SELECT 1 FROM TRAY WHERE FLOOR_MAG=12 AND FAMILY = @name\) OR NOT EXISTS \(SELECT 1 FROM \[POSITION\] WHERE \(PARENT = 'TRAY_12'\)\) SELECT 'KO_SOURCE_EMPTY'/.test(t), 'sorgente: stesso modello (FAMILY = NAME, uguaglianza) e tasche presenti');
check(/INSERT INTO \[POSITION\] \(PARENT, POS, SUB_POS, STATUS, X, Y, Z, X_CORR, Y_CORR, Z_CORR, X_ROT, Y_ROT, Z_ROT, X_ROT_CORR, Y_ROT_CORR, Z_ROT_CORR, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z, APPROACH_X_ROT, APPROACH_Y_ROT, APPROACH_Z_ROT, Part_Type, Order_ID\) SELECT 'TRAY_1', t\.MAG, s\.SUB_POS, 2, s\.X, s\.Y, 0, s\.X_CORR, s\.Y_CORR, s\.Z_CORR, COALESCE\(t\.X_ROT, s\.X_ROT\)/.test(t), 'INSERT...SELECT: SUB_POS/X/Y/CORR tarati dalla sorgente, Z=0, rotazioni dal teaching del target con ripiego sorgente');
check(/FROM \[POSITION\] s CROSS JOIN \(SELECT TOP 1 MAG, X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z FROM TRAY WHERE FLOOR_MAG=1\) t WHERE \(s\.PARENT = 'TRAY_12'\) AND s\.SUB_POS > 0/.test(t), 'sorgente TRAY_12 -> target TRAY_1, POS = MAG del target');
check(/DELETE FROM \[POSITION\] WHERE \(PARENT = 'TRAY_1'\);[\s\S]*INSERT INTO[\s\S]*UPDATE TRAY SET FAMILY=@name, STATUS=2 WHERE FLOOR_MAG=1;/.test(t), 'ordine: delete target -> insert -> FAMILY=NAME nella stessa transazione');
check(!/LIKE/i.test(t), 'niente LIKE (uguaglianza su FAMILY)');

console.log('\n2) associateGrating: GENERA dall\'header con verifica ingombro LATO SERVER');
// griglia 13x7 del TRAY_12 (pezzo 40x70, SAFEX 20, SAFEY 10) in coordinate disegno: entra
const centers = [];
for (let c = 0; c < 7; c++) for (let rr = 0; rr < 13; rr++) centers.push({ w: 50 + 60 * rr, h: 45 + 80 * c });
r = call('POST /associateGrating/:floor', { floor: '9' }, { gratingId: 7, replace: false, source: { centers } }, [ctx, ok(91)]);
check(r.n === 2 && r.res.body.ris === 'OK', 'griglia dentro il contorno -> scritta');
t = r.q[1];
check(/FROM \(VALUES \(1, 45000, 50000\), \(2, 45000, 110000\)/.test(t), 'UNA INSERT multi-riga (VALUES): SUB_POS 1,2,... con X/Y robot (origine = angolo cassetto: tasca 1 = (h1, w1), origin-fix 14/9)');
check(/\(91, 525000, 770000\)\) AS v\(SUB_POS, X, Y\)/.test(t), '91 tasche, ultima (13a riga, 7a colonna) coerente con la convenzione assi');
check(/COALESCE\(t\.X_ROT,0\), COALESCE\(t\.Y_ROT,0\), COALESCE\(t\.Z_ROT,0\), COALESCE\(t\.APPROACH_TYPE,3\), COALESCE\(t\.APPROACH_X,100000\)[\s\S]*, 21 FROM \(VALUES/.test(t), 'eredita teaching TRAY come insertPositionTray, Part_Type = PIECE_ID del modello (dal DB)');
// stessa griglia TRASLATA fuori dal contorno: il client "stantio" la manda, il server la RIFIUTA
const shifted = centers.map(p => ({ w: p.w + 300, h: p.h }));
r = call('POST /associateGrating/:floor', { floor: '9' }, { gratingId: 7, replace: false, source: { centers: shifted } }, [ctx, ok(91)]);
check(r.n === 1 && r.res.body.ris === errorCodes.KO_OUT_OF_TRAY && r.res.body.overW > 0, 'griglia FUORI ingombro (misure TRAY/PIECE dal DB, non dal payload) -> KO_OUT_OF_TRAY, nessuna transazione');
// misure cassetto piu' piccole nel DB (client con dati vecchi): stessa griglia rifiutata
const ctxSmall = { recordset: [{ ID: 7, PIECE_ID: 21, PX: 40000, PY: 70000, TX: 700000, TY: 610000 }] };
r = call('POST /associateGrating/:floor', { floor: '9' }, { gratingId: 7, replace: false, source: { centers } }, [ctxSmall, ok(91)]);
check(r.n === 1 && r.res.body.ris === errorCodes.KO_OUT_OF_TRAY, 'cassetto a DB piu\' stretto della griglia del client -> rifiutata');
r = call('POST /associateGrating/:floor', { floor: '9' }, { gratingId: 7, replace: false, source: { centers } }, [{ recordset: [{ ID: 7, PIECE_ID: 0, PX: null, PY: null, TX: 820000, TY: 610000 }] }]);
check(r.n === 1 && r.res.body.ris === 'KO_BAD_INPUT', 'modello senza pezzo -> KO_BAD_INPUT (niente generazione)');

console.log('\n3) associateGrating: replace (Sostituisci/Rigenera) e input');
r = call('POST /associateGrating/:floor', { floor: '12' }, { gratingId: 7, replace: true, source: { centers } }, [ctx, ok(91)]);
check(/ELSE IF 1=0 SELECT 'KO_ALREADY_ASSOCIATED'/.test(r.q[1]) && /DELETE FROM \[POSITION\] WHERE \(PARENT = 'TRAY_12'\);/.test(r.q[1]), 'replace: guardia "libero" disattivata, tasche attuali cancellate nella stessa transazione');
check(/ELSE IF @extract <> 0 SELECT 'KO_TRAY_EXTRACTED'/.test(r.q[1]), 'replace: guardia EXTRACT sempre attiva');
r = call('POST /associateGrating/:floor', { floor: '13' }, { gratingId: 7, source: { floor: 12 } });
check(r.n === 0 && r.res.body.ris === 'KO_BAD_INPUT', 'cassetto fuori range -> KO_BAD_INPUT senza query');
r = call('POST /associateGrating/:floor', { floor: '1' }, { gratingId: 7, source: { floor: 1 } });
check(r.n === 0 && r.res.body.ris === 'KO_BAD_INPUT', 'sorgente = target -> KO_BAD_INPUT');
r = call('POST /associateGrating/:floor', { floor: '1' }, { gratingId: 'x', source: { floor: 12 } });
check(r.n === 0 && r.res.body.ris === 'KO_BAD_INPUT', 'gratingId non intero -> KO_BAD_INPUT');
r = call('POST /associateGrating/:floor', { floor: '1' }, { gratingId: 7, source: { centers: [{ w: 'a', h: 1 }] } });
check(r.n === 0 && r.res.body.ris === 'KO_BAD_INPUT', 'centers non numerici -> KO_BAD_INPUT');
r = call('POST /associateGrating/:floor', { floor: '1' }, { gratingId: 7, source: {} });
check(r.n === 0 && r.res.body.ris === 'KO_BAD_INPUT', 'senza sorgente ne\' centers -> KO_BAD_INPUT');
r = call('POST /associateGrating/:floor', { floor: '1' }, { gratingId: 7, source: { floor: 12 } }, [ctx, { recordset: [{ ris: errorCodes.KO_TRAY_EXTRACTED, n: 0 }] }]);
check(r.res.body.ris === errorCodes.KO_TRAY_EXTRACTED, 'esito della guardia SQL inoltrato nel JSON');

console.log('\n3b) spessore grigliato (grating-thickness): protezione anti-urto in generazione, valori dal DB');
const ctxThick = t => ({ recordset: [Object.assign({}, ctx.recordset[0], { THICKNESS: t })] });
r = call('POST /associateGrating/:floor', { floor: '1' }, { gratingId: 7, replace: false, source: { floor: 12 } }, [ctxThick(14500), ok(91)]);
check(r.n === 1 && r.res.body.ris === errorCodes.KO_Z_BELOW_GRATING, 'COPIA con Z_PICK 15000 < 14500 + 1000 -> KO_Z_BELOW_GRATING, NESSUNA transazione (anche la copia crea tasche)');
check(r.res.body.min === 15500 && r.res.body.zPick === 15000 && r.res.body.zPlace === 15000 && r.res.body.thickness === 14500, 'JSON con minimo (spessore + franco 1000), quote richieste e spessore, in micron');
r = call('POST /associateGrating/:floor', { floor: '9' }, { gratingId: 7, replace: true, source: { centers } }, [ctxThick(14500), ok(91)]);
check(r.n === 1 && r.res.body.ris === errorCodes.KO_Z_BELOW_GRATING, 'GENERA/RIGENERA sotto il minimo -> rifiutato prima della transazione');
r = call('POST /associateGrating/:floor', { floor: '9' }, { gratingId: 7, replace: false, source: { centers } }, [ctxThick(14000), ok(91)]);
check(r.n === 2 && r.res.body.ris === 'OK', 'Z_PICK 15000 = spessore 14000 + 1000: al limite PASSA');
r = call('POST /associateGrating/:floor', { floor: '9' }, { gratingId: 7, replace: false, source: { centers } }, [ctxThick(0), ok(91)]);
check(r.n === 2 && r.res.body.ris === 'OK', 'spessore 0 = non misurato: nessun vincolo');
r = call('POST /associateGrating/:floor', { floor: '9' }, { gratingId: 7, replace: false, source: { centers } }, [ctxThick(null), ok(91)]);
check(r.n === 2 && r.res.body.ris === 'OK', 'spessore NULL = non misurato: nessun vincolo (grigliati esistenti invariati)');
check(/g\.THICKNESS, p\.X AS PX, p\.Y AS PY, p\.Z_PICK, p\.Z_PLACE/.test(r.q[0]), 'spessore e quote del pezzo letti DAL DB nella query di contesto (mai dal payload)');

console.log('\n4) dissociateGrating: guardie + cancellazione tasche, anche a FAMILY vuota');
r = call('POST /dissociateGrating/:floor', { floor: '9' }, {}, [ok(91)]);
t = r.q[0];
check(r.n === 1 && r.res.body.ris === 'OK' && r.res.body.n === 91, 'una sola query transazionale, {ris:OK, n:91}');
check(/ELSE IF @extract <> 0 SELECT 'KO_TRAY_EXTRACTED'[\s\S]*ELSE IF EXISTS \(SELECT 1 FROM \[POSITION\] p JOIN WORKORDERS w[\s\S]*\(p\.PARENT = 'TRAY_9'\) AND w\.STATUS = 3\) SELECT 'KO_ACTIVE_ORDER'/.test(t), 'guardie EXTRACT + ordine attivo PRIMA della delete');
check(/BEGIN TRAN; DELETE FROM \[POSITION\] WHERE \(PARENT = 'TRAY_9'\); UPDATE TRAY SET FAMILY='', STATUS=2 WHERE FLOOR_MAG=9; COMMIT TRAN;/.test(t), 'delete tasche + FAMILY azzerata in transazione');
check(!/FAMILY <> ''|FAMILY IS NOT NULL/.test(t), 'nessuna condizione su FAMILY: ripulisce anche le tasche ORFANE');
r = call('POST /dissociateGrating/:floor', { floor: '0' }, {});
check(r.n === 0 && r.res.body.ris === 'KO_BAD_INPUT', 'cassetto non valido -> KO_BAD_INPUT senza query');

console.log('\n5) Grating.js: header-only, nome unico, rinomino propagato, TRAY_ID morto');
r = call('GET /insertGrating', { NAME: 'G1', DESCR: 'd', TRAY_ID: '24', GRIPPER_ID: '3', PIECE_ID: '21', SAFEX: '20', SAFEY: '10' }, null, [{ recordset: [{ ris: 'OK' }] }]);
t = r.q[0];
check(/IF EXISTS \(SELECT 1 FROM GRATING WHERE NAME='G1'\) SELECT 'KO_DUP_NAME'/.test(t), 'insert: nome duplicato rifiutato');
check(/VALUES\( 'G1', 'd', 0, 3, 21, 20, 10, NULL\)/.test(t), 'insert: TRAY_ID scritto 0 anche se il client lo manda; THICKNESS assente -> NULL (non misurato)');
r2 = call('GET /insertGrating', { NAME: 'G2', DESCR: 'd', GRIPPER_ID: '3', PIECE_ID: '21', SAFEX: '20', SAFEY: '10', THICKNESS: '8500' }, null, [{ recordset: [{ ris: 'OK' }] }]);
check(/VALUES\( 'G2', 'd', 0, 3, 21, 20, 10, 8500\)/.test(r2.q[0]), 'insert: THICKNESS 8500 um scritto');
r2 = call('GET /insertGrating', { NAME: 'G2', DESCR: 'd', GRIPPER_ID: '3', PIECE_ID: '21', SAFEX: '20', SAFEY: '10', THICKNESS: '-1' }, null);
check(r2.n === 0 && r2.res.body === 'KO_BAD_INPUT', 'insert: THICKNESS negativo -> KO_BAD_INPUT senza query');
r2 = call('GET /insertGrating', { NAME: 'G2', DESCR: 'd', GRIPPER_ID: '3', PIECE_ID: '21', SAFEX: '20', SAFEY: '10', THICKNESS: '8.5' }, null);
check(r2.n === 0 && r2.res.body === 'KO_BAD_INPUT', 'insert: THICKNESS non intero (mm invece di micron) -> KO_BAD_INPUT');
check(!/POSITION|UPDATE TRAY/.test(t) && r.res.body === 'OK', 'insert: nessuna tasca, nessun TRAY');
r = call('GET /insertGrating', { NAME: 'G1', DESCR: 'd', GRIPPER_ID: '3', PIECE_ID: '21', SAFEX: '20', SAFEY: '10' }, null, [{ recordset: [{ ris: errorCodes.KO_DUP_NAME }] }]);
check(r.res.body === errorCodes.KO_DUP_NAME, 'insert: body KO_DUP_NAME inoltrato');
r = call('GET /updateGrating', { ID: '7', NAME: 'G1bis', DESCR: 'd', TRAY_ID: '24', GRIPPER_ID: '3', PIECE_ID: '21', SAFEX: '20', SAFEY: '10' }, null, [{ recordset: [{ ris: 'OK' }] }]);
t = r.q[0];
check(/DECLARE @old varchar\(100\) = \(SELECT NAME FROM GRATING WHERE ID=7\)[\s\S]*ELSE IF EXISTS \(SELECT 1 FROM GRATING WHERE NAME=@new AND ID<>7\) SELECT 'KO_DUP_NAME'/.test(t), 'update: nome gia\' usato da un ALTRO modello -> KO_DUP_NAME');
check(/BEGIN TRAN;[\s\S]*TRAY_ID=0,[\s\S]*IF @old <> @new UPDATE TRAY SET FAMILY=@new WHERE FAMILY=@old; COMMIT TRAN;/.test(t), 'update: rinomino propagato a TRAY.FAMILY nella stessa transazione, TRAY_ID=0');
check(/THICKNESS=NULL,/.test(t), 'update: THICKNESS assente -> NULL');
r = call('GET /updateGrating', { ID: '7', NAME: 'G1bis', DESCR: 'd', GRIPPER_ID: '3', PIECE_ID: '21', SAFEX: '20', SAFEY: '10', THICKNESS: '8500' }, null, [{ recordset: [{ ris: 'OK' }] }]);
check(/THICKNESS=8500,/.test(r.q[0]), 'update: THICKNESS 8500 um scritto');
check(!/POSITION/.test(t) && r.res.body === 'OK', 'update: nessuna tasca toccata');
r = call('GET /updateGrating', { ID: 'x', NAME: 'G' }, null);
check(r.n === 0 && r.res.body === 'KO_BAD_INPUT', 'update: ID non intero -> KO_BAD_INPUT senza query');
r = call('GET /showCompleteData/:ID', { ID: 'all' }, null, [{ recordset: [] }]);
check(/left join tray t on t\.FAMILY = g\.NAME/.test(r.q[0]) && !/g\.TRAY_ID=t\.id/.test(r.q[0]) && /order by g\.ID, t\.FLOOR_MAG/.test(r.q[0]), 'lista: join su FAMILY = NAME (una riga per cassetto), non su TRAY_ID');
r = call('GET /showFromTray/:Tray_ID', { Tray_ID: '12' }, null, [{ recordset: [] }]);
check(/g\.NAME = \(select TOP 1 FAMILY from TRAY where FLOOR_MAG=12\)/.test(r.q[0]), 'showFromTray: modello DEL cassetto richiesto (prima ignorava il parametro)');
r = call('GET /showFromTray/:Tray_ID', { Tray_ID: '12; DROP' }, null);
check(r.n === 0 && r.res.body === 'KO_BAD_INPUT', 'showFromTray: piano non intero -> KO_BAD_INPUT');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
