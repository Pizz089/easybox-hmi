// ============================================================================
// test_position_insert_guard.js — insert idempotente delle tasche (4/9) e
// SUB_POS nella SELECT del layout. Route reali (CONF/Position.js, CONF/
// Tray.js) con express/mssql a stub.
//
// Uso:   node test_position_insert_guard.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');

const routes = {};
const queries = [];
let nextResult = { recordset: [], rowsAffected: [1] };
let coda = [];
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		// coda: le route a piu' passi (contesto -> tasche -> scrittura) ricevono
		// un risultato per query; chi ne ha una sola continua a usare nextResult
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(null, coda.length ? coda.shift() : nextResult); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
require(path.join(__dirname, 'CONF', 'Position.js'));
require(path.join(__dirname, 'CONF', 'Tray.js'));
const errorCodes = require(path.join(__dirname, 'errorCodes.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
function call(key, params, result, resultQueue) {
	nextResult = result;
	coda = resultQueue || [];
	const before = queries.length;
	const res = { body: null, send(b) { this.body = b; }, json(o) { this.body = o; }, status() { return this; } };
	routes[key]({ params, query: params }, res);
	return { res, ranQuery: queries.length > before, query: (queries[queries.length - 1] || '').replace(/\s+/g, ' ') };
}
const goodInsert = { TRAY_ID: '12', POS: '1', SUB_POS: '5', STATUS: '2', X: '50000', Y: '179000', PIECE_TYPE: '1030' };

console.log('1) insertPositionTray IDEMPOTENTE su (PARENT, SUB_POS)');
let r = call('GET /insertPositionTray', goodInsert, { recordset: [], rowsAffected: [1] });
check(r.ranQuery, 'query eseguita');
check(/WHERE NOT EXISTS \(SELECT 1 FROM \[POSITION\] px WHERE \(px\.PARENT = 'TRAY_12'\) AND px\.SUB_POS=5\)/.test(r.query), "guardia NOT EXISTS su PARENT='TRAY_12' + SUB_POS=5 (predicato canonico)");
check(/INSERT INTO \[POSITION\]/.test(r.query) && /COALESCE\(t\.X_ROT,0\)/.test(r.query), 'INSERT...SELECT con eredita teaching INVARIATO');
check(r.res.body === 'OK', 'riga nuova (rowsAffected 1) -> OK');
r = call('GET /insertPositionTray', goodInsert, { recordset: [], rowsAffected: [0] });
check(r.res.body === 'KO_DUP', "riga gia' presente (rowsAffected 0) -> KO_DUP, nessun duplicato");
r = call('GET /insertPositionTray', Object.assign({}, goodInsert, { TRAY_ID: '13' }), {});
check(!r.ranQuery && r.res.body === 'KO_BAD_INPUT', 'cassetto fuori range -> KO_BAD_INPUT senza query');
r = call('GET /insertPositionTray', Object.assign({}, goodInsert, { SUB_POS: '0' }), {});
check(!r.ranQuery && r.res.body === 'KO_BAD_INPUT', 'SUB_POS non valido -> KO_BAD_INPUT senza query');
r = call('GET /insertPositionTray', Object.assign({}, goodInsert, { SUB_POS: '5; DROP' }), {});
check(!r.ranQuery && r.res.body === 'KO_BAD_INPUT', 'SUB_POS non intero -> KO_BAD_INPUT senza query');

console.log('\n2) endpoint layout: SUB_POS nella SELECT, vista e ordinamento invariati');
r = call('GET /layout/:trayID', { trayID: '12' }, { recordset: [] });
check(/select partType,prisma,x_pick\/1000 as x,Y_PICK\/1000 as y, status, order_ID, FLOOR_MAG, SUB_POS from COORDINATES_PIECES_TRAYS/.test(r.query), 'SELECT con SUB_POS dalla STESSA vista');
check(/order by SUB_POS;/.test(r.query), 'ordinamento per SUB_POS invariato');

console.log('\nX) declareTrayType: il CONTENUTO del cassetto, a cassetto chiuso (16/9)');
// PERCHE'. POSITION.Part_Type e' il codice che il cassetto contiene: il ciclo
// cerca STATUS=4 AND Part_Type=<pezzo dell'ordine>, e la vista 4Robot ci
// aggancia PIECE per sapere a che quota scendere. A cassetto FUORI la stessa
// dichiarazione la fa il PLC col comando 44; qui c'e' la strada a cassetto
// CHIUSO, quella che serve mentre si prepara o si rifornisce la produzione.
//
// La route fa tre passi: contesto -> tasche -> scrittura.
const ctxOK = (extra) => ({ recordset: [Object.assign({
	EXTRACTED: 0, TX: 820000, TY: 610000, THICKNESS: null,
	PID: 1033, PX: 40000, PY: 70000, Z_PICK: 15000, Z_PLACE: 15000,
	RESERVED: 0, IN_POOL: 0 }, extra || {})] });
// griglia vera 13x7: passo 60000 su Y robot, 80000 su X robot
const tasche = { recordset: [] };
for (let c = 0; c < 7; c++) for (let rr = 0; rr < 13; rr++) tasche.recordset.push({ X: 45000 + 80000 * c, Y: 50000 + 60000 * rr });
const scritto = { recordset: [{ ris: 'OK', positions: 91 }] };

r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '1033' }, {}, [ctxOK(), tasche, scritto]);
check(r.res.body.ris === 'OK' && r.res.body.positions === 91, 'strada pulita: dichiarato, 91 tasche');
check(/UPDATE \[POSITION\] SET Part_Type=1033 WHERE \(PARENT = 'TRAY_12'\);/.test(r.query), 'scrive Part_Type su TUTTE le tasche del cassetto');
check(!/STATUS=/.test(r.query) && !/Order_ID=/.test(r.query), 'e NON tocca stato ne\' ordine: dire cosa c\'e\' dentro non e\' dire quanto ce n\'e\'');
check(/DECLARE @n INT = \(SELECT COUNT\(\*\) FROM \[POSITION\]/.test(r.query), 'conteggio con COUNT esplicita: su [POSITION] c\'e\' POSITION_trig e rowsAffected mente');

console.log('\nX.1) ORDINE ATTIVO: si ferma SOLO il cassetto che il ciclo sta usando');
// Il requisito e' proprio rifornire a meta' produzione: mentre la cella
// lavora sul 12, l'operatore riempie il 5 e lo dichiara. Il pericolo non e'
// 'c'e' un ordine attivo', e' 'sto cambiando il pezzo al cassetto da cui la
// cella sta pescando adesso'.
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '5', pieceId: '1033' }, {}, [ctxOK(), tasche, scritto]);
check(r.res.body.ris === 'OK', 'ordine attivo altrove: il cassetto 5 si dichiara lo stesso');
// 1) tasche PRENOTATE da un ordine attivo (Order_ID): e' anche dove tornera'
//    il finito che il robot ha a bordo, quindi vale a cassetto chiuso
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '1033' }, {}, [ctxOK({ RESERVED: 1 })]);
check(r.res.body.ris === errorCodes.KO_ACTIVE_ORDER && r.res.body.reserved === 1, 'tasche prenotate da un ordine attivo -> rifiutato, e dice quale dei due motivi');
// 2) grezzi del codice di un ordine attivo: dal cambio di modello il PLC NON
//    guarda piu' Order_ID, pesca su STATUS=4 AND Part_Type. Un cassetto mai
//    prenotato puo' essere nel mucchio da cui il ciclo attinge ADESSO.
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '1033' }, {}, [ctxOK({ IN_POOL: 1 })]);
check(r.res.body.ris === errorCodes.KO_ACTIVE_ORDER && r.res.body.inPool === 1, 'grezzi del codice in lavorazione -> rifiutato anche senza prenotazione');
// e la query chiede proprio quelle due cose, sul cassetto richiesto
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '7', pieceId: '1033' }, {}, [ctxOK(), tasche, scritto]);
const ctxQ = queries[queries.length - 3].replace(/\s+/g, ' ');
check(/JOIN WORKORDERS w ON w\.ID = p2\.Order_ID WHERE \(p2\.PARENT = 'TRAY_7'\) AND w\.STATUS = 3/.test(ctxQ), 'prenotazione cercata SOLO sulle tasche di questo cassetto');
check(/p3\.PARENT = 'TRAY_7'\) AND p3\.STATUS = 4 AND p3\.Part_Type IN \(SELECT PIECE_ID FROM WORKORDERS WHERE STATUS = 3\)/.test(ctxQ), 'e il mucchio del ciclo idem, per codice');

console.log('\nX.2) IL PEZZO DICHIARATO DEVE STARE NELLE TASCHE');
// Prima era garantito per costruzione: la griglia nasceva DAL pezzo. Adesso
// il codice si dichiara a posteriori, su un cassetto gia' generato, e si puo'
// dichiarare un particolare piu' grande dell'alloggiamento. A valle NON c'e'
// nessun controllo: la vista 4Robot somma le quote e basta, il robot ci
// andrebbe sopra.
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '22' }, {},
	[ctxOK({ PID: 22, PX: 71000, PY: 90000 }), tasche]);
check(r.res.body.ris === errorCodes.KO_PIECE_TOO_BIG, 'pezzo 71x90 in tasche da 60x80 di passo -> RIFIUTATO');
check(r.res.body.pitch === 11000, 'e dice di quanto invade la tasca vicina: 11 mm');
check(!queries.slice(-1)[0].includes('UPDATE'), 'nessuna scrittura: il rifiuto arriva PRIMA');
// il pezzo della griglia passa: il controllo non e' un blocco generico
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '1033' }, {}, [ctxOK(), tasche, scritto]);
check(r.res.body.ris === 'OK', 'il pezzo per cui la griglia e\' stata fatta passa');
// sforo sul CONTORNO del cassetto, non sul passo
const strette = { recordset: [{ X: 5000, Y: 5000 }] };
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '1033' }, {},
	[ctxOK({ PX: 40000, PY: 70000 }), strette]);
check(r.res.body.ris === errorCodes.KO_PIECE_TOO_BIG && r.res.body.over > 0, 'tasca troppo vicina al bordo: il pezzo sporgerebbe dal cassetto -> rifiutato');
// anti-urto VERTICALE: stessa regola dell'associazione
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '1033' }, {},
	[ctxOK({ THICKNESS: 14000, Z_PICK: 5000, Z_PLACE: 5000 }), tasche]);
check(r.res.body.ris === errorCodes.KO_Z_BELOW_GRATING && r.res.body.min === 15000, 'quota di presa sotto lo spessore del grigliato + franco -> rifiutato');

console.log('\nX.3) le altre guardie e gli input');
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '1033' }, {}, [ctxOK({ PID: null })]);
check(r.res.body.ris === errorCodes.KO_NO_PIECE_DECLARED, 'codice inesistente -> rifiutato (renderebbe il cassetto invisibile al ciclo)');
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '1033' }, {}, [ctxOK({ EXTRACTED: 1 })]);
check(r.res.body.ris === errorCodes.KO_TRAY_EXTRACTED, 'cassetto fuori -> si passa dal comando 44');
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '13', pieceId: '1033' }, {});
check(!r.ranQuery && r.res.body.ris === 'KO_BAD_INPUT', 'cassetto fuori range -> KO_BAD_INPUT senza query');
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: '0' }, {});
check(!r.ranQuery && r.res.body.ris === 'KO_BAD_INPUT', 'codice 0 -> KO_BAD_INPUT: e\' il valore che rende invisibili le tasche');
r = call('POST /declareTrayType/:floor/:pieceId', { floor: '12', pieceId: 'x' }, {});
check(!r.ranQuery && r.res.body.ris === 'KO_BAD_INPUT', 'codice non intero -> KO_BAD_INPUT');
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
