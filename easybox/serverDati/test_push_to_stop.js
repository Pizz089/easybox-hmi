// ============================================================================
// test_push_to_stop.js — ciclo di SPINTA IN BATTUTA (15/9), lato backend.
//
//  1. pushQuotes: le tre quote e gli esiti, con la PARITA' fra la copia server
//     e quella del pannello (le formule vivono in due posti, come per gli assi
//     del grigliato: se divergono il pannello blocca cio' che il PLC farebbe,
//     o peggio lascia passare cio' che il PLC non sa fare).
//  2. insertOrder: istantanea del bit dal PEZZO e guardie KO_PUSH_*.
//  3. colonne nuove scritte davvero da Piece/Vice/Gripper — con particolare
//     attenzione a corsa, spessore e LUNGHEZZA della chela: i primi due il form
//     li mandava da sempre e il backend li perdeva in silenzio, la terza nasce
//     adesso e non deve ricadere nella stessa trappola.
//
// RISCONTRO SU PEZZO NON QUADRATO: i numeri qui sotto vengono dal pezzo 1029
// (PIECE.X 40000, PIECE.Y 120000). Con un pezzo quadrato (il 1033 e' 100.6 x
// 100.6) uno scambio d'asse darebbe lo stesso risultato e il test passerebbe
// sbagliato: e' esattamente l'errore corretto il 15/9.
//
// IL PEZZO CHE ECCEDE LA GANASCIA e' invece COSTRUITO, e va detto. In cella
// esiste il 1032 (101 x 303), che su una ganascia da 150 sporgerebbe di 76.5
// PER LATO: e' una sporgenza grande, e nessuno ha confermato che quel pezzo
// venga davvero lavorato con la spinta in battuta. Per non verificare una
// situazione che in cella potrebbe non esistere, i casi "oltre la ganascia"
// usano un pezzo da 180000 lungo la spinta sulla stessa ganascia da 150000:
// sporge 15000 per lato, una sporgenza ordinaria, e le misure restano nella
// scala dei pezzi reali (il piu' grande a database e' 200 x 200). La formula
// e' la stessa per qualunque sporgenza: cambiano solo i numeri.
//  4. lo script della vista NON crea una vista cifrata.
//
// Uso:   node test_push_to_stop.js
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const routes = {};
const modRoutes = {};
let currentMod = '';
const queries = [];
let results = [];
const fakeRouter = () => {
	const reg = method => (p, h) => {
		routes[method + ' ' + p] = h;
		(modRoutes[currentMod] = modRoutes[currentMod] || {})[method + ' ' + p] = h;
	};
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
currentMod = 'piece';   require(path.join(__dirname, 'CONF', 'Piece.js'));
currentMod = 'vice';    require(path.join(__dirname, 'CONF', 'Vice.js'));
currentMod = 'gripper'; require(path.join(__dirname, 'CONF', 'Gripper.js'));
currentMod = 'order';   require(path.join(__dirname, 'WORKORDER', 'Order.js'));
const errorCodes = require(path.join(__dirname, 'errorCodes.js'));
const srv = require(path.join(__dirname, 'pushQuotes.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const norm = q => q.replace(/\s+/g, ' ');
function callIn(mod, key, params, resultQueue) {
	results = resultQueue || [];
	const before = queries.length;
	const res = { code: 200, body: null, status(n) { this.code = n; return this; }, send(b) { this.body = b; }, json(o) { this.body = o; } };
	const table = mod ? modRoutes[mod] : routes;
	if (!table || !table[key]) throw new Error('rotta non registrata: ' + (mod || '*') + ' ' + key);
	table[key]({ params, query: params }, res);
	return { res, n: queries.length - before, q: queries.slice(before).map(norm) };
}
// senza modulo: la rotta e' unica in tutto il backend
function call(key, params, resultQueue) { return callIn(null, key, params, resultQueue); }

(async () => {

console.log('1) pushQuotes: quote, esiti e parita\' server/pannello');
const hmi = await import(pathToFileURL(path.join(__dirname, '..', 'HMI', 'src', 'util', 'pushQuotes.js')).href);
// caso cella: deposito X -16084, pezzo 1029 NON QUADRATO (X 40000, Y 120000:
// nel conto entra la Y, che corre lungo la X del robot), chela pinza 30000,
// ganascia morsa 150000 -> corsa 15000 (gli stessi numeri della vista)
const PIECE_X = 40000, PIECE_Y = 120000;
const cella = { enabled: true, hasVice: true, xPlace: -16084, pieceY: PIECE_Y, viceClawLength: 150000, gripperClawLength: 30000 };
const r1 = srv.pushQuotes(cella);
check(r1.status === 'OK', 'dati completi -> OK');
check(r1.xPush === -16084 - 60000 - 15000, 'spinta = deposito - pezzo/2 - MEZZA lunghezza chela (' + r1.xPush + ')');
check(r1.clearance === 15000, 'corsa = (ganascia - pezzo)/2 = 15000');
check(r1.xStop === r1.xPush + 15000, 'arrivo = spinta + corsa (' + r1.xStop + ')');
check(r1.xPush === -91084 && r1.xStop === -76084, 'riscontro numerico del 15/9 sul pezzo 1029: -91084 e -76084');
// guardia d'asse: col pezzo 1029 le due dimensioni differiscono di 80 mm,
// quindi usare PIECE.X al posto di PIECE.Y si vede subito. Questo check
// fallirebbe se qualcuno riscambiasse gli assi.
const conX = srv.pushQuotes(Object.assign({}, cella, { pieceY: PIECE_X }));
check(conX.xPush !== r1.xPush && conX.clearance !== r1.clearance, 'pezzo NON quadrato: con PIECE.X i numeri cambiano, lo scambio d\'asse non passerebbe inosservato');
check(r1.stopRef === srv.STOP_REF.CLAW, 'pezzo dentro la ganascia: appoggia sulla FINE GANASCIA');

// pezzo che ECCEDE la ganascia (180000 su 150000: sporge 15000 per lato)
const LUNGO = 180000;
const oltre = (stop) => srv.pushQuotes(Object.assign({}, cella, { pieceY: LUNGO, stopBeyondClaw: stop }));
const rDich = oltre(25000);
check(rDich.status === 'OK' && rDich.stopRef === srv.STOP_REF.DECLARED, 'pezzo oltre la ganascia con appoggio dichiarato: valido, e appoggia sul RIFERIMENTO');
check(rDich.clearance === 10000, 'corsa = (150000-180000)/2 + 25000 = 10000, cioe\' meno della sporgenza');
check(rDich.xPush === -16084 - 90000 - 15000, 'la quota di SPINTA non cambia nei due casi: dipende dal bordo del pezzo, non dalla ganascia');
check(rDich.xStop === rDich.xPush + 10000, 'arrivo = spinta + corsa anche nel caso dichiarato');
check(oltre(0).status === 'NO_ROOM', 'zero DICHIARATO e\' un valore, non un\'assenza: qui la corsa sarebbe negativa');
check(oltre(undefined).status === 'NO_FIT' && oltre(undefined).stopRef === srv.STOP_REF.DECLARED, 'riga assente = appoggio non dichiarato -> NO_FIT, ma il riferimento implicato si sa gia\'');
check(srv.pushQuotes(Object.assign({}, cella, { pieceY: 120000, stopBeyondClaw: 25000 })).clearance === 15000, 'pezzo DENTRO la ganascia: la dichiarazione si ignora, si ferma prima sulla ganascia');
// stesso troncamento verso lo zero di SQL Server su differenza NEGATIVA
check(srv.pushQuotes(Object.assign({}, cella, { pieceY: 180001, stopBeyondClaw: 25000 })).clearance === 10000, 'differenza negativa dispari: troncamento verso lo zero, come la divisione intera di SQL');
// ---------------------------------------------------------------------------
// COMPENSAZIONE SPINTA (COMP_PUSH): di quanto il pezzo si ferma PRIMA della
// battuta teorica (semantica ratificata il 17/9). Sempre positiva, SI SOTTRAE
// dalla sola quota di arrivo: corsa e spinta restano la geometria teorica, la
// corsa effettiva risulta minore, e la taratura si legge come differenza fra
// le quote. Non puo' produrre NO_ROOM.
// Base: pezzo 1029 dentro la ganascia, corsa 15000.
const comp = (c) => srv.pushQuotes(Object.assign({}, cella, { compPush: c }));
check(comp(null).clearance === 15000 && comp(undefined).clearance === 15000,
	'compensazione assente: corsa 15000');
check(comp(0).clearance === 15000, 'compensazione ZERO = nessuna compensazione: qui assenza e zero coincidono');
check(comp(200).clearance === 15000 && comp(200).xPush === r1.xPush,
	'compensazione 200: corsa e spinta NON cambiano, restano la geometria teorica');
check(comp(200).xStop === r1.xStop - 200, 'si arretra il solo ARRIVO, e di 200: il pezzo si ferma prima');
check((comp(200).xPush + comp(200).clearance) - comp(200).xStop === 200,
	'(spinta + corsa) - arrivo = compensazione: e\' cosi\' che si legge, come nella vista');
// COMPENSAZIONE OLTRE LA CORSA -> NO_COMP, non OK e non NO_ROOM.
// L'arrivo finirebbe DIETRO la partenza e il robot spingerebbe nel verso
// opposto contro il pezzo gia' in morsa. In cella non lo ferma nessuno: il
// controllo di plausibilita' di FB7 guarda la DISTANZA da X_PLACE, non il
// verso, quindi 3300 e -300 gli passano uguale. Con l'esito diverso da OK le
// quote escono NULL e FB7 le scarta: meglio nessuna spinta che una rovesciata.
check(comp(15000).status === 'OK' && comp(15000).xStop === comp(15000).xPush,
	'compensazione PARI alla corsa: arrivo sulla partenza, corsa effettiva zero — ancora valido');
check(comp(15001).status === 'NO_COMP', 'un micron oltre: la spinta si rovescerebbe -> NO_COMP');
check(comp(20000).status === 'NO_COMP' && comp(20000).xPush === null && comp(20000).xStop === null
	&& comp(20000).clearance === null,
	'e le quote escono NULL, come per ogni altro esito diverso da OK');
check(comp(20000).stopRef === srv.STOP_REF.CLAW,
	'su NO_COMP il riferimento resta valorizzato: serve al pannello per spiegare');
check(comp(20000).status !== 'NO_ROOM',
	'e NON e\' NO_ROOM: quello resta il caso geometrico, questo e\' la taratura');
// pezzo oltre la ganascia: la corsa resta quella dichiarata, la compensazione
// non la tocca e finisce tutta sull'arrivo
const oltreComp = srv.pushQuotes(Object.assign({}, cella, { pieceY: LUNGO, stopBeyondClaw: 25000, compPush: 4000 }));
check(oltreComp.status === 'OK' && oltreComp.clearance === 10000,
	'pezzo oltre la ganascia: corsa 10000, la compensazione non la tocca');
check(oltreComp.xStop === oltreComp.xPush + 10000 - 4000, 'e l\'arrivo la toglie tutta');
check(oltreComp.stopRef === srv.STOP_REF.DECLARED, 'e il riferimento resta quello dichiarato');
// NO_ROOM resta SOLO geometrico: ci si arriva per l'appoggio dichiarato
check(srv.pushQuotes(Object.assign({}, cella, { pieceY: LUNGO, stopBeyondClaw: 10000, compPush: 5000 })).status === 'NO_ROOM',
	'NO_ROOM resta un fatto di geometria: lo produce l\'appoggio dichiarato, mai la compensazione');
// il troncamento riguarda la sola divisione: la compensazione si somma dopo
check(srv.pushQuotes(Object.assign({}, cella, { pieceY: 120001, compPush: 1 })).xStop
	=== srv.pushQuotes(Object.assign({}, cella, { pieceY: 120001 })).xStop - 1,
	'la compensazione si sottrae DOPO il troncamento, non dentro');
// RISCONTRO DI CAMPO, ordine 1104 (17/9): sono i numeri letti in cella, con la
// geometria vera del pezzo 1034. Il segno sbagliato qui darebbe 243900.
const o1104 = srv.pushQuotes({ enabled: true, hasVice: true, xPlace: 311000,
	pieceY: 100000, viceClawLength: 107200, gripperClawLength: 42000, compPush: 300 });
check(o1104.xPush === 240000 && o1104.clearance === 3600 && o1104.xStop === 243300,
	'ordine 1104: spinta 240000, corsa 3600, arrivo 243300 — corsa effettiva 3300');

const casi = [
	{ name: 'bit spento', v: Object.assign({}, cella, { enabled: false }), st: 'DISABLED' },
	{ name: 'nessuna morsa sul pallet', v: Object.assign({}, cella, { hasVice: false }), st: 'NO_VICE' },
	{ name: 'ganascia non misurata', v: Object.assign({}, cella, { viceClawLength: null }), st: 'NO_DATA' },
	{ name: 'ganascia a zero', v: Object.assign({}, cella, { viceClawLength: 0 }), st: 'NO_DATA' },
	{ name: 'lunghezza chela pinza mancante', v: Object.assign({}, cella, { gripperClawLength: null }), st: 'NO_DATA' },
	{ name: 'pezzo senza misura', v: Object.assign({}, cella, { pieceY: 0 }), st: 'NO_DATA' },
	{ name: 'pezzo oltre la ganascia senza dichiarazione', v: Object.assign({}, cella, { pieceY: 160000 }), st: 'NO_FIT' },
	{ name: 'pezzo oltre la ganascia con dichiarazione valida', v: Object.assign({}, cella, { pieceY: 180000, stopBeyondClaw: 25000 }), st: 'OK' },
	{ name: 'appoggio dichiarato piu\' vicino della sporgenza', v: Object.assign({}, cella, { pieceY: 180000, stopBeyondClaw: 10000 }), st: 'NO_ROOM' },
	{ name: 'appoggio dichiarato a zero su pezzo che sporge', v: Object.assign({}, cella, { pieceY: 180000, stopBeyondClaw: 0 }), st: 'NO_ROOM' },
	{ name: 'dichiarazione presente ma pezzo dentro la ganascia', v: Object.assign({}, cella, { pieceY: 120000, stopBeyondClaw: 25000 }), st: 'OK' },
	{ name: 'pezzo esattamente lungo come la ganascia', v: Object.assign({}, cella, { pieceY: 150000 }), st: 'OK' },
	{ name: 'pezzo girato (entrerebbe la X): resta un caso valido ma diverso', v: Object.assign({}, cella, { pieceY: PIECE_X }), st: 'OK' },
	{ name: 'valori dispari (troncamento come SQL)', v: Object.assign({}, cella, { pieceY: 120001, viceClawLength: 150001, gripperClawLength: 30001 }), st: 'OK' },
	{ name: 'compensazione assente', v: Object.assign({}, cella, { compPush: null }), st: 'OK' },
	{ name: 'compensazione: il pezzo si ferma prima', v: Object.assign({}, cella, { compPush: 200 }), st: 'OK' },
	{ name: 'compensazione pari alla corsa: arrivo sulla partenza', v: Object.assign({}, cella, { compPush: 15000 }), st: 'OK' },
	{ name: 'compensazione oltre la corsa: spinta rovesciata', v: Object.assign({}, cella, { compPush: 20000 }), st: 'NO_COMP' },
	{ name: 'compensazione oltre la corsa su pezzo dichiarato', v: Object.assign({}, cella, { pieceY: LUNGO, stopBeyondClaw: 25000, compPush: 12000 }), st: 'NO_COMP' },
	{ name: 'riscontro di campo ordine 1104', v: { enabled: true, hasVice: true, xPlace: 311000, pieceY: 100000, viceClawLength: 107200, gripperClawLength: 42000, compPush: 300 }, st: 'OK' },
	{ name: 'compensazione su pezzo oltre la ganascia', v: Object.assign({}, cella, { pieceY: LUNGO, stopBeyondClaw: 25000, compPush: 4000 }), st: 'OK' },
];
for (const c of casi) {
	const a = srv.pushQuotes(c.v), b = hmi.pushQuotes(c.v);
	check(a.status === c.st, c.name + ' -> ' + a.status);
	check(JSON.stringify(a) === JSON.stringify(b), '  parita\' server/pannello: ' + JSON.stringify(a));
}
check(srv.pushQuotes(casi[0].v).xPush === null && srv.pushQuotes(casi[6].v).xStop === null, 'quote NULL quando l\'esito non e\' OK (come la vista)');
check(srv.PUSH_BIT === 2 && hmi.PUSH_BIT === 2, 'bit 1 di OPTION2 (valore 2), il bit 0 resta al gripper doppio');
check(srv.isPushEnabled(2) && srv.isPushEnabled(3) && !srv.isPushEnabled(1) && !srv.isPushEnabled(0), 'isPushEnabled legge il solo bit 1 (3 = gripper doppio + spinta)');

console.log('\n2) insertOrder: istantanea dal pezzo e guardie');
const ORD = { pieceID: '1029', gripperID: '26', viceID: '0', fixtureID: '1', palletID: '9', machineID: '1', quantity: '3', PP: '12' };
let r = call('GET /insertOrder', ORD, [{ recordset: [{ ris: 'OK' }] }]);
let t = r.q[0];
check(/DECLARE @push int = ISNULL\(\(SELECT CASE WHEN PUSH_TO_STOP = 1 THEN 2 ELSE 0 END FROM PIECE WHERE ID=1029\), 0\)/.test(t), 'il bit lo legge il SQL dall\'anagrafica pezzo: istantanea non falsificabile dal client');
check(/DECLARE @claw int = \(SELECT TOP 1 CLAW_LENGTH FROM VICE WHERE PALLET_ID=9\)/.test(t), 'ganascia morsa dal pallet dell\'ordine');
check(/DECLARE @tool int = \(SELECT TOP 1 CLAW_LENGTH FROM GRIPPER WHERE ID=26\)/.test(t), 'lunghezza chela dalla pinza dell\'ordine');
check(/DECLARE @pieceY int = \(SELECT TOP 1 Y FROM PIECE WHERE ID=1029\)/.test(t), 'dal pezzo entra la Y, quella che corre lungo la X del robot');
check(!/SELECT TOP 1 X FROM PIECE/.test(t), 'PIECE.X non entra nel conto della spinta');
check(/ELSE IF @push <> 0 AND \(ISNULL\(@claw,0\) <= 0 OR ISNULL\(@tool,0\) <= 0 OR ISNULL\(@pieceY,0\) <= 0\) SELECT 'KO_PUSH_NO_DATA'/.test(t), 'guardia dati mancanti');
check(/DECLARE @viceID int = \(SELECT TOP 1 ID FROM VICE WHERE PALLET_ID=9\)/.test(t), 'la morsa si risolve dal pallet dell\'ordine, poi la dichiarazione segue la MORSA');
check(/DECLARE @stop int = \(SELECT TOP 1 STOP_BEYOND_CLAW FROM PIECE_ON_VICE WHERE VICE_ID=@viceID AND PIECE_ID=1029\)/.test(t), 'appoggio dichiarato letto per la coppia morsa+pezzo');
check(!/PIECE_ON_VICE WHERE PALLET_ID/.test(t), 'la dichiarazione NON e\' agganciata al pallet: una morsa spostata si porta dietro la sua battuta');
check(/DECLARE @travel int = \(@claw - @pieceY\)\/2 \+ CASE WHEN @pieceY > @claw THEN ISNULL\(@stop,0\) ELSE 0 END/.test(t), 'corsa: il tratto dichiarato entra SOLO quando il pezzo eccede la ganascia');
check(/ELSE IF @push <> 0 AND @pieceY > @claw AND @stop IS NULL SELECT 'KO_PUSH_NO_FIT'/.test(t), 'rifiuto solo se eccede la ganascia E l\'appoggio non e\' dichiarato');
check(/ELSE IF @push <> 0 AND @travel < 0 SELECT 'KO_PUSH_NO_ROOM'/.test(t), 'rifiuto se la corsa verrebbe negativa (appoggio piu\' vicino della sporgenza)');
check(t.indexOf('KO_PUSH_NO_FIT') < t.indexOf('KO_PUSH_NO_ROOM'), 'prima si controlla la dichiarazione mancante, poi la corsa: un\'assenza non deve presentarsi come corsa negativa');
check(/PartProg_ID, DECLARED_PIECE_ID, OPTION1, OPTION2\)/.test(t) && /0, @push\s*\);/.test(t), 'OPTION1 0 e OPTION2 = istantanea scritti nella INSERT');
check(t.indexOf('@push') < t.indexOf('INSERT INTO WORKORDER'), 'le guardie girano PRIMA della INSERT');
r = call('GET /insertOrder', ORD, [{ recordset: [{ ris: errorCodes.KO_PUSH_NO_FIT }] }]);
check(r.res.body === errorCodes.KO_PUSH_NO_FIT && r.res.code === 200, 'esito applicativo inoltrato con stato 200');

console.log('\n3) colonne nuove scritte davvero');
r = call('GET /updatePiece', { ID: '1029', FAMILY: 'F', DESCR: 'D', PARTPROGRAM: '12', MC1_ONLY: '0', MC2_ONLY: '0', MC3_ONLY: '0', PRISMA: '1', X: '1', Y: '1', Z: '1', Z_PICK: '1', Z_PLACE: '1', PUSH_TO_STOP: '1' }, [{}]);
check(/PUSH_TO_STOP=CONVERT\(bit,'1'\)/.test(r.q[0]), 'pezzo: PUSH_TO_STOP in update');
r = call('GET /insertPiece', { FAMILY: 'F', DESCR: 'D', PARTPROGRAM: '12', MC1_ONLY: '0', MC2_ONLY: '0', MC3_ONLY: '0', PRISMA: '1', X: '1', Y: '1', Z: '1', Z_PICK: '1', Z_PLACE: '1' }, [{}]);
check(/, PUSH_TO_STOP\)/.test(r.q[0]) && /CONVERT\(bit,'0'\)\);/.test(r.q[0]), 'pezzo: colonna in insert, assente -> 0 (nessun ciclo)');
r = call('GET /updateVice', { ID: '1', FAMILY: 'M', DESCR: 'D', STATUS: '2', X: '1', Y: '1', Z: '1', Z_CLAW: '1', Z_SINK_CLAW: '1', MAG: '1', MAG_POS: '1', POS_PLANT: '1', CLAW_LENGTH: '150000' }, [{}]);
check(/CLAW_LENGTH=150000/.test(r.q[0]), 'morsa: ganascia in update');
r = call('GET /updateVice', { ID: '1', FAMILY: 'M', DESCR: 'D', STATUS: '2', X: '1', Y: '1', Z: '1', Z_CLAW: '1', Z_SINK_CLAW: '1', MAG: '1', MAG_POS: '1', POS_PLANT: '1', CLAW_LENGTH: '' }, [{}]);
check(/CLAW_LENGTH=NULL/.test(r.q[0]), 'morsa: campo vuoto -> NULL (non misurata)');
r = call('GET /updateGripper', { ID: '26', FAMILY: 'P', DESCR: 'D', X_BODY: '1', Y_BODY: '1', Z_BODY: '1', X_CLAW: '1', Y_CLAW: '1', Z_CLAW: '1', STATUS: '2', POS_MAG: '2', POS_PLANT: '0', STROKE_CLAW: '10000', TICKNESS_CLAW: '5000', CLAW_LENGTH: '30000' }, [{ rowsAffected: [1] }]);
check(/Stroke_CLAW=10000/.test(r.q[0]) && /Tickness_CLAW=5000/.test(r.q[0]), 'pinza: corsa e spessore ORA salvati (prima si perdevano in silenzio)');
check(/CLAW_LENGTH=30000/.test(r.q[0]), 'pinza: la LUNGHEZZA della chela arriva davvero alla UPDATE');
r = call('GET /updateGripper', { ID: '26', FAMILY: 'P', DESCR: 'D', X_BODY: '1', Y_BODY: '1', Z_BODY: '1', X_CLAW: '1', Y_CLAW: '1', Z_CLAW: '1', STATUS: '2', POS_MAG: '2', POS_PLANT: '0' }, [{ rowsAffected: [1] }]);
check(/Stroke_CLAW=Stroke_CLAW/.test(r.q[0]) && /Tickness_CLAW=Tickness_CLAW/.test(r.q[0]), 'pinza: client che non manda i campi NON azzera il dato a DB');
check(/CLAW_LENGTH=CLAW_LENGTH/.test(r.q[0]), 'pinza: nemmeno la lunghezza chela viene azzerata da un client vecchio');
r = call('GET /insertGripper', { FAMILY: 'P', DESCR: 'D', X_BODY: '1', Y_BODY: '1', Z_BODY: '1', X_CLAW: '1', Y_CLAW: '1', Z_CLAW: '1', STATUS: '2', POS_MAG: '0', POS_PLANT: '0' }, [{ rowsAffected: [1] }]);
check(/, Stroke_CLAW, Tickness_CLAW, CLAW_LENGTH\)/.test(r.q[0]) && /10000,\s*10000,/.test(r.q[0]), 'pinza: in INSERT..SELECT il fallback e\' il default di schema, non il nome colonna');
check(/10000,\s*NULL/.test(r.q[0]), 'pinza: lunghezza chela assente -> NULL, cioe\' non misurata (0 direbbe misurata e nulla)');
r = call('GET /insertGripper', { FAMILY: 'P', DESCR: 'D', X_BODY: '1', Y_BODY: '1', Z_BODY: '1', X_CLAW: '1', Y_CLAW: '1', Z_CLAW: '1', STATUS: '2', POS_MAG: '0', POS_PLANT: '0', CLAW_LENGTH: '30000' }, [{ rowsAffected: [1] }]);
check(/10000,\s*30000/.test(r.q[0]), 'pinza: lunghezza chela salvata anche in creazione');

console.log('\n3b) dichiarazione dell\'appoggio: rotte PIECE_ON_VICE');
r = call('GET /stops/:viceID', { viceID: '1' }, [{ recordset: [] }]);
check(/from PIECE_ON_VICE pv/.test(r.q[0]) && /where pv\.VICE_ID = 1/.test(r.q[0]), 'elenco delle dichiarazioni di una morsa');
check(/inner join PIECE p on p\.ID = pv\.PIECE_ID/.test(r.q[0]), 'porta anche le misure del pezzo, servono a dire di quanto sporge');
r = call('GET /stops/:viceID', { viceID: 'x' }, []);
check(r.res.code === 400 && r.n === 0, 'morsa non numerica -> 400 senza toccare il database');
r = call('GET /setStop', { VICE_ID: '1', PIECE_ID: '1029', STOP_BEYOND_CLAW: '25000' }, [{}]);
check(/UPDATE PIECE_ON_VICE SET STOP_BEYOND_CLAW=25000/.test(r.q[0]) && /WHERE VICE_ID=1 AND PIECE_ID=1029/.test(r.q[0]), 'upsert: prima l\'UPDATE');
check(/IF @@ROWCOUNT = 0/.test(r.q[0]) && /INSERT INTO PIECE_ON_VICE/.test(r.q[0]), 'e la INSERT se non c\'era: l\'UPDATE da solo cercherebbe la riga che deve creare');
check(r.res.body === 'OK' && r.res.code === 200, 'esito applicativo nel body, stato 200');
r = call('GET /setStop', { VICE_ID: '1', PIECE_ID: '1029', STOP_BEYOND_CLAW: '0' }, [{}]);
check(/STOP_BEYOND_CLAW=0/.test(r.q[0]), 'lo ZERO si salva: e\' una dichiarazione, non un\'assenza');
r = call('GET /setStop', { VICE_ID: '1', PIECE_ID: '1029', STOP_BEYOND_CLAW: '' }, []);
check(r.res.code === 400 && r.n === 0, 'campo vuoto -> 400: per togliere la dichiarazione si cancella la riga');
r = call('GET /setStop', { VICE_ID: '1', PIECE_ID: '1029', STOP_BEYOND_CLAW: '-1' }, []);
check(r.res.code === 400 && r.n === 0, 'distanza negativa -> 400: il riferimento sta oltre la ganascia, mai prima');
r = call('GET /deleteStop', { VICE_ID: '1', PIECE_ID: '1029' }, [{}]);
check(/DELETE FROM PIECE_ON_VICE WHERE VICE_ID=1 AND PIECE_ID=1029/.test(r.q[0]), 'cancellazione della dichiarazione');
r = call('GET /deleteStop', { VICE_ID: '0', PIECE_ID: '1029' }, []);
check(r.res.code === 400 && r.n === 0, 'morsa non valida -> 400 senza toccare il database');

console.log('\n3c) salvataggio di UNA misura dalla simulazione');
// La pagina di simulazione adesso salva. Non puo' usare updateVice/
// updateGripper/updatePiece, che scrivono OGNI colonna dai parametri: una
// chiamata parziale svuoterebbe il resto della riga. Da qui le rotte mirate.
r = callIn('vice', 'GET /setClawLength', { ID: '1', CLAW_LENGTH: '160000' }, [{ recordset: [{ n: 1, old: 150000, fam: 'ADMG' }] }, {}]);
check(/UPDATE VICE SET CLAW_LENGTH=160000 WHERE ID=1/.test(r.q[0]), 'morsa: scrive SOLO la lunghezza ganascia');
check(!/FAMILY=|DESCR=|MAG=/.test(r.q[0]), 'morsa: nessun altra colonna viene toccata');
check(/SELECT @@ROWCOUNT AS n/.test(r.q[0]), 'morsa: il rowcount viene controllato');
check(r.res.body === 'OK' && r.res.code === 200, 'morsa: esito nel body, stato 200');
check(r.q.some(q => /INSERT INTO LOG/.test(q) && /Morsa ADMG \(ID 1\)/.test(q) && /150000 um a 160000 um/.test(q)),
	'morsa: la modifica finisce nel diario, con oggetto e valori vecchio e nuovo');
check(r.q.some(q => /INSERT INTO LOG/.test(q) && /'PUSH_SIM'/.test(q)), 'il diario dice DA DOVE arriva la modifica');
r = callIn('vice', 'GET /setClawLength', { ID: '99', CLAW_LENGTH: '160000' }, [{ recordset: [] }]);
check(r.res.body === errorCodes.KO_NOT_FOUND, 'morsa inesistente -> KO_NOT_FOUND, non OK');
check(!r.q.some(q => /INSERT INTO LOG/.test(q)), 'niente riga di diario se non e\' stato cambiato niente');
r = callIn('vice', 'GET /setClawLength', { ID: '1', CLAW_LENGTH: '0' }, []);
check(r.res.code === 400 && r.n === 0, 'ganascia a zero -> 400 senza toccare il database');
r = callIn('vice', 'GET /setClawLength', { ID: 'x', CLAW_LENGTH: '1' }, []);
check(r.res.code === 400 && r.n === 0, 'morsa non numerica -> 400');

r = callIn('gripper', 'GET /setClawLength', { ID: '26', CLAW_LENGTH: '32000' }, [{ recordset: [{ n: 1, old: 30000, fam: 'P' }] }, {}]);
check(/UPDATE GRIPPER SET CLAW_LENGTH=32000 WHERE ID=26/.test(r.q[0]), 'pinza: scrive SOLO la lunghezza chela');
check(modRoutes.vice['GET /setClawLength'] !== modRoutes.gripper['GET /setClawLength'],
	'morsa e pinza hanno DUE rotte distinte: stesso nome, prefissi diversi in server.js');
check(r.q.some(q => /INSERT INTO LOG/.test(q) && /Pinza P \(ID 26\)/.test(q)), 'pinza: modifica a diario');

r = call('GET /setSize', { ID: '1029', X: '40000', Y: '185000' }, [{ recordset: [{ n: 1, ox: 40000, oy: 180000, fam: 'P1029' }] }, {}]);
check(/UPDATE PIECE SET X=40000, Y=185000 WHERE ID=1029/.test(r.q[0]), 'pezzo: scrive SOLO le due dimensioni');
check(!/PARTPROGRAM=|PUSH_TO_STOP=/.test(r.q[0]), 'pezzo: part program e spunta spinta restano intatti');
check(r.q.some(q => /INSERT INTO LOG/.test(q) && /passo delle tasche/.test(q)),
	'pezzo: il diario ricorda che quella misura e\' anche il passo delle tasche');
r = call('GET /setSize', { ID: '1029', X: '40000', Y: '0' }, []);
check(r.res.code === 400 && r.n === 0, 'dimensione a zero -> 400');

console.log('\n4) lo script della vista non nasconde la definizione');
const view = fs.readFileSync(path.join(__dirname, 'scripts', 'coordinates-push-mc.sql'), 'utf8');
// i commenti PARLANO di WITH ENCRYPTION (per dire che non si usa): il controllo
// guarda il solo SQL eseguibile
const viewSql = view.split(/\r?\n/).filter(l => !/^\s*--/.test(l)).join('\n');
check(!/WITH\s+ENCRYPTION/i.test(viewSql), 'nessun WITH ENCRYPTION: la vista nasce IN CHIARO');
check(/ALTER VIEW dbo\.COORDINATES_PUSH_MC AS/.test(view) && /PUSH_STATUS/.test(view), 'definizione completa versionata nel repo');
check(/p\.X - pz\.Y\/2 - g\.CLAW_LENGTH\/2/.test(viewSql), 'quota di spinta identica alla formula del modulo condiviso: si muove la X');
check(/\(v\.CLAW_LENGTH - pz\.Y\)\/2/.test(viewSql), 'corsa identica alla formula del modulo condiviso');
check(/case when pz\.Y > v\.CLAW_LENGTH[\s\S]{0,80}ISNULL\(pv\.STOP_BEYOND_CLAW, 0\)/.test(viewSql), 'il tratto dichiarato entra solo quando il pezzo eccede la ganascia');
check(/left  join PIECE_ON_VICE pv\s+on pv\.VICE_ID = v\.ID and pv\.PIECE_ID = w\.PIECE_ID/.test(viewSql), 'la dichiarazione e\' agganciata alla MORSA, non al pallet');
check(/'NO_FIT'/.test(viewSql) && /pv\.VICE_ID is null/.test(viewSql), 'NO_FIT solo quando la dichiarazione manca');
check(/'NO_ROOM'/.test(viewSql), 'esito NO_ROOM presente nella vista');
// NO_COMP: stessa corsa geometrica del ramo NO_ROOM, meno la compensazione
check(/- ISNULL\(pv\.COMP_PUSH, 0\) < 0\s+then 'NO_COMP'/.test(viewSql),
	'esito NO_COMP: la compensazione oltre la corsa rovescerebbe la spinta');
check(viewSql.indexOf("'NO_COMP'") < viewSql.indexOf("else 'OK'"),
	'e il ramo sta PRIMA di OK, altrimenti non scatterebbe mai');
// (comp-push 17/9) la compensazione sta sulla SOLA quota di arrivo
check(/q\.X_PUSH_RAW \+ q\.TRAVEL_RAW - q\.COMP_PUSH end\s+as X_STOP/.test(viewSql),
	'X_STOP SOTTRAE la compensazione; X_PUSH e CLEARANCE restano geometria');
// il segno va cercato nel SOLO corpo della vista: le guardie nominano apposta
// anche la variante col piu', perche' devono riconoscerla per correggerla
const viewBody = viewSql.slice(viewSql.indexOf('ALTER VIEW dbo.COORDINATES_PUSH_MC AS'));
check(!/q\.TRAVEL_RAW \+ q\.COMP_PUSH/.test(viewBody),
	'nel corpo non resta traccia della variante col piu\', quella finita in cella per sbaglio');
check(/q\.TRAVEL_RAW \+ q\.COMP_PUSH end\s+as X_STOP/.test(viewSql),
	'ma le guardie la nominano: il segno sbagliato va CORRETTO, non scambiato per lavoro gia\' fatto');
check(!/- ISNULL\(pv\.COMP_PUSH, 0\)\s+as TRAVEL_RAW/.test(viewSql),
	'la compensazione non si sottrae da TRAVEL_RAW: la corsa esposta resta geometrica');
check(/else 0 end < 0\s+then 'NO_ROOM'/.test(viewSql),
	'e non entra nel ramo NO_ROOM, che resta il solo caso geometrico');
check(/ISNULL\(pv\.COMP_PUSH, 0\)\s+as COMP_PUSH/.test(viewSql),
	'COMP_PUSH esposto con ISNULL: e\' NULL sui pezzi non tarati e il ponte SQL non lo converte in zero');
check(/'DECLARED'/.test(viewSql) && /'CLAW'/.test(viewSql), 'la vista dice su cosa appoggia il pezzo');
const viewStatuses = ['DISABLED', 'NO_VICE', 'NO_DATA', 'NO_FIT', 'NO_ROOM', 'NO_COMP', 'OK'];
check(viewStatuses.every(st => Object.values(srv.PUSH_STATUS).includes(st) && new RegExp("'" + st + "'").test(viewSql)), 'gli esiti della vista e quelli del modulo sono lo stesso insieme');
check(!/p\.Y - pz\./.test(viewSql) && !/pz\.X/.test(viewSql), 'la vista non spinge sulla Y e non usa PIECE.X');
check(/RTRIM\(p\.PARENT\) = CONCAT\('MC_', w\.MACHINE_ID\)/.test(view), 'posizione legata alla macchina dell\'ordine (la query storica non filtrava)');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
