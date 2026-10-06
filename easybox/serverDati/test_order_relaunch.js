// ============================================================================
// test_order_relaunch.js — Rilancia ordine finito (P2 5/10, versione rivista
// dopo l'audit)
//
// Rifare lo stesso lotto quando l'ordine e' finito (STATUS 5). Due modi:
//   replaced : "ho rimesso i grezzi al posto dei finiti" -> le tasche finite
//              dell'ordine tornano a 4 e restano legate all'ordine. Solo a
//              cella ferma.
//   available: "uso i grezzi che ci sono" -> le tasche finite restano a 5 ma
//              si scollegano (Order_ID=0); ammesso anche a cella in lavoro,
//              rifiutato senza grezzi (KO_NO_RAW).
// In tutti e due l'ordine torna a 3 e il backend gli PRENOTA i grezzi che
// mancano (Order_ID=ordine), perche' la vista del robot prende i decentrati
// dall'ordine via pos.Order_ID. Nessuna guardia sugli altri ordini a 3.
//
// Qui si verifica la COMPOSIZIONE delle query (guardie per modo, conteggi,
// prenotazione dopo l'UPDATE delle finite, transazione con XACT_ABORT), la
// formula della prenotazione valutata su casi concreti, e la gestione delle
// risposte: OK con log ed emit, rifiuti col loro codice, input validato.
//
// Uso:   node test_order_relaunch.js
// NON richiede DB ne' backend attivo (stessi stub di test_http_status).
// ============================================================================

const Module = require('module');
const path = require('path');

const routes = {};
const queries = [];
const emitted = [];
const logs = [];
let results = [];
let queryErr = null;
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return {
		connect: (cfg, cb) => cb(null),
		Request: function () { this.query = (q, cb) => { queries.push(q); cb(queryErr, results.length ? results.shift() : { recordset: [] }); }; },
	};
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: ev => emitted.push(ev), on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: s => logs.push(s), error: s => logs.push(s), info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
const SRV = __dirname;
require(path.join(SRV, 'WORKORDER/Order.js'));
const ERR = require(path.join(SRV, 'errorCodes.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
function call(key, params, query, resultQueue) {
	results = resultQueue || [];
	queries.length = 0; emitted.length = 0; logs.length = 0;
	const res = { code: 200, body: null, status(n) { this.code = n; return this; }, send(b) { this.body = b; }, json(o) { this.body = o; } };
	routes[key]({ params: params || {}, query: query || {}, body: {} }, res);
	return res;
}
const flat = q => q.replace(/\s+/g, ' ');
const before = (q, a, b) => q.indexOf(a) >= 0 && q.indexOf(b) > q.indexOf(a);
const post = (mode, ris) => call('POST /relaunch/:orderId', { orderId: '42' }, { mode },
	[{ recordset: [{ ris: ris || 'OK', finished: 24, raw: 10, quantity: 24, reserved: 10 }] }]);

console.log('0) codici in tutte e due le copie');
const hmi = require('fs').readFileSync(path.join(SRV, '../HMI/src/util/errorCodes.js'), 'utf8');
for (const k of ['KO_ORDER_NOT_FINISHED', 'KO_NO_RAW'])
	check(ERR[k] === k && new RegExp('export const ' + k + '\\s*=\\s*"' + k + '"').test(hmi), k + ' in serverDati e HMI');

console.log('\n1) input validato come resetProduction');
for (const [id, mode] of [['0', 'replaced'], ['-3', 'replaced'], ['1.5', 'replaced'], ['abc', 'replaced'], ['12', 'boh'], ['12', undefined]]) {
	const r = call('POST /relaunch/:orderId', { orderId: id }, { mode });
	check(r.code === 400 && queries.length === 0, `ordine ${id} mode ${mode} -> ${r.code}, nessuna query`);
}
let r = call('GET /relaunch/preview/:orderId', { orderId: 'x' });
check(r.code === 400 && queries.length === 0, 'anteprima con ID non intero -> 400');

console.log('\n2) tutti e due i modi portano l\'ordine a 3, mai a 6');
const q = {};
for (const mode of ['replaced', 'available']) {
	r = post(mode);
	q[mode] = flat(queries[0] || '');
	check(q[mode].includes('UPDATE WORKORDER SET STATUS=3 WHERE ID=@id AND STATUS=5;'), mode + ': ordine -> 3, solo se ancora a 5');
	check(!/SET STATUS=6/.test(q[mode]), mode + ': nessuna pausa (6)');
	check(r.body && r.body.ris === 'OK' && emitted.includes('PRODUCTION/CHANGED'), mode + ': OK ed emit PRODUCTION/CHANGED');
	check(logs.some(s => s.includes('RILANCIA ORDINE 42 (' + mode + ')') && /ordine -> 3/.test(s) && /prenotate 10 tasche/.test(s)), mode + ': log "ordine -> 3" con le tasche prenotate');
}

console.log('\n3) guardie: comune, solo replaced, solo available; nessuna sugli altri ordini a 3');
for (const mode of ['replaced', 'available']) {
	const s = q[mode];
	check(/DECLARE @id INT = 42;/.test(s), mode + ': ordine passato come intero validato');
	check(before(s, 'SET XACT_ABORT ON;', 'BEGIN TRAN;') && /FROM WORKORDER WITH \(UPDLOCK, HOLDLOCK\) WHERE ID=@id/.test(s), mode + ': transazione con XACT_ABORT, ordine in UPDLOCK');
	check(s.includes("WHEN @st IS NULL THEN '" + ERR.KO_NOT_FOUND + "'") && s.includes("WHEN @st<>5 THEN '" + ERR.KO_ORDER_NOT_FINISHED + "'"), mode + ': sempre ordine esistente e a 5');
	check(!/KO_ACTIVE_ORDER/.test(s) && !/STATUS=3 AND MACHINE_ID/.test(s), mode + ': nessuna guardia sugli altri ordini a 3 della macchina');
	check(/IF @ko IS NOT NULL BEGIN ROLLBACK TRAN;/.test(s), mode + ': rifiuto -> ROLLBACK, niente scritto');
}
check(q.replaced.includes('IF @ko IS NULL SET @ko = @koReplaced;') && !q.replaced.includes('@ko = @koAvailable'), 'replaced: si aggiunge solo la guardia della cella');
check(/@koReplaced VARCHAR\(40\) = CASE WHEN \(SELECT COUNT\(\*\) FROM UNIT_STATUS WHERE UNIT='ROBOT' AND STATUS IS NOT NULL AND STATUS NOT IN \(3,6\)\) = 0 THEN 'KO_CELL_RUNNING'/.test(q.replaced), 'replaced: cella in lavoro -> KO_CELL_RUNNING (cellRunningGuard)');
check(q.available.includes('IF @ko IS NULL SET @ko = @koAvailable;') && !q.available.includes('@ko = @koReplaced'), 'available: la cella in lavoro NON blocca, conta solo la guardia sui grezzi');
check(q.available.includes("@koAvailable VARCHAR(40) = CASE WHEN @raw=0 THEN '" + ERR.KO_NO_RAW + "'"), 'available: senza grezzi -> KO_NO_RAW');
check(/@raw INT = \(SELECT COUNT\(\*\) FROM \[POSITION\] WHERE PARENT LIKE 'TRAY%' AND STATUS=4 AND Part_Type=@piece AND Order_ID IN \(0, @id\)\)/.test(q.available), 'grezzi = tasche di cassetto a 4 del pezzo, libere o dell\'ordine');

console.log('\n4) rifiuti: arrivano al pannello col loro codice, senza emit');
for (const [mode, code, label] of [
	['replaced', ERR.KO_CELL_RUNNING, 'replaced con la cella in lavoro'],
	['available', ERR.KO_NO_RAW, 'available senza grezzi'],
	['available', ERR.KO_ORDER_NOT_FINISHED, 'ordine non finito'],
]) {
	r = post(mode, code);
	check(r.code === 200 && r.body.ris === code && !emitted.includes('PRODUCTION/CHANGED'), `${label} -> 200 ${code}, nessun emit`);
	check(logs.some(s => s.includes('rifiutato: ' + code)), `${label}: riga di log del rifiuto`);
}
r = post('available', 'OK');
check(r.body.ris === 'OK', 'available con la cella in lavoro: accettato (nessuna guardia di cella nella query, vedi sopra)');

console.log('\n5) le tasche finite');
check(q.replaced.includes('UPDATE [POSITION] SET STATUS=4 WHERE STATUS=5 AND Order_ID=@id;') && !q.replaced.includes('SET Order_ID=0 WHERE STATUS=5'), 'replaced: finiti -> 4, restano legati all\'ordine');
check(q.available.includes('UPDATE [POSITION] SET Order_ID=0 WHERE STATUS=5 AND Order_ID=@id;') && !q.available.includes('SET STATUS=4 WHERE STATUS=5'), 'available: finiti restano a 5 ma scollegati');

console.log('\n6) prenotazione delle tasche grezze');
for (const mode of ['replaced', 'available']) {
	const s = q[mode];
	const fin = mode === 'replaced' ? 'UPDATE [POSITION] SET STATUS=4 WHERE STATUS=5' : 'UPDATE [POSITION] SET Order_ID=0 WHERE STATUS=5';
	check(before(s, fin, 'DECLARE @gia INT'), mode + ': conta le tasche gia\' legate DOPO l\'UPDATE delle finite');
	check(s.includes('DECLARE @gia INT = (SELECT COUNT(*) FROM [POSITION] WHERE STATUS=4 AND Order_ID=@id);'), mode + ': @gia = tasche a 4 gia\' dell\'ordine');
	check(before(s, 'DECLARE @res INT', 'UPDATE [POSITION] SET Order_ID=@id'), mode + ': quante prenotare si calcola PRIMA dell\'UPDATE (niente rowsAffected)');
	check(s.includes("IF @res > 0 UPDATE [POSITION] SET Order_ID=@id WHERE ID IN ( SELECT TOP (@res) ID FROM [POSITION] WHERE PARENT LIKE 'TRAY%' AND STATUS=4 AND Part_Type=@piece AND Order_ID=0);"), mode + ': prenota TOP(@res) grezzi liberi DEL CASSETTO (filtro TRAY: niente tasca macchina)');
	check(before(s, 'UPDATE [POSITION] SET Order_ID=@id', 'UPDATE WORKORDER SET STATUS=3'), mode + ': prenotazione prima del passaggio a 3, stessa transazione');
	check(/@free INT = \(SELECT COUNT\(\*\) FROM \[POSITION\] WHERE PARENT LIKE 'TRAY%' AND STATUS=4 AND Part_Type=@piece AND Order_ID=0\)/.test(s), mode + ': grezzi liberi contati con lo stesso filtro TRAY');
}
// la formula, valutata: si estrae dalla query e si traduce in JS
const m = q.replaced.match(/DECLARE @res INT = (CASE .*? END);/);
check(!!m, 'formula della prenotazione trovata nella query');
const js = m[1]
	.replace(/CASE WHEN (.*?) THEN (.*?) WHEN (.*?) THEN (.*?) ELSE (.*?) END/, '(($1) ? ($2) : ($3) ? ($4) : ($5))')
	.replace(/@(\w+)/g, 'v.$1');
const reserve = v => Function('v', 'return ' + js)(v);
check(reserve({ qty: 24, gia: 0, free: 50 }) === 24, 'ordine scoperto, grezzi abbondanti: prenota QUANTITY (24)');
check(reserve({ qty: 24, gia: 24, free: 50 }) === 0, 'replaced, tasche dell\'ordine gia\' tornate a 4: nessuna prenotazione (non raddoppia)');
check(reserve({ qty: 24, gia: 30, free: 50 }) === 0, 'gia\' piu\' del necessario: nessuna prenotazione');
check(reserve({ qty: 24, gia: 20, free: 50 }) === 4, 'mancano 4: prenota 4');
check(reserve({ qty: 24, gia: 0, free: 10 }) === 10, 'grezzi liberi insufficienti: prenota quelli che ci sono (10)');
check(r.body.reserved === 10 && q.available.includes('@res AS reserved'), 'il numero prenotato torna al pannello e nel log');

console.log('\n7) anteprima: motivi separati, nessuna scrittura');
r = call('GET /relaunch/preview/:orderId', { orderId: '42' }, {}, [{ recordset: [{ blocked: null, replacedBlocked: 'KO_CELL_RUNNING', availableBlocked: null, status: 5, machineId: 1, pieceId: 9, finished: 24, raw: 10, quantity: 24, otherActive: 2, piece: 'P' }] }]);
const pq = flat(queries[0] || '');
check(!/UPDATE|INSERT|DELETE|BEGIN TRAN/.test(pq) && !/UPDLOCK/.test(pq), 'nessuna scrittura, nessuna transazione, nessun lock');
check(/SELECT @ko AS blocked, @koReplaced AS replacedBlocked, @koAvailable AS availableBlocked/.test(pq), 'blocco comune e i due motivi dei modi, separati');
check(/@others INT = \(SELECT COUNT\(\*\) FROM WORKORDER WHERE STATUS=3 AND PIECE_ID=@piece AND ID<>@id\)/.test(pq) && /@others AS otherActive/.test(pq), 'altri ordini a 3 con lo stesso pezzo (avviso, non blocco)');
check(r.body && r.body.replacedBlocked === 'KO_CELL_RUNNING' && r.body.availableBlocked === null && r.body.otherActive === 2, 'numeri e motivi passati al dialog');

console.log('\n8) errore SQL -> 500, nessun emit');
queryErr = new Error('boom');
r = call('POST /relaunch/:orderId', { orderId: '42' }, { mode: 'replaced' });
check(r.code === 500 && !emitted.length, 'rilancio con errore SQL -> ' + r.code + ', nessun emit');
r = call('GET /relaunch/preview/:orderId', { orderId: '42' });
check(r.code === 500, 'anteprima con errore SQL -> ' + r.code);
queryErr = null;

console.log('\n9) pannello: Rilancia anche per l\'operatore, niente pausa ne\' Play nel dialog');
const fs = require('fs');
const table = fs.readFileSync(path.join(SRV, '../HMI/src/components/productionTable.vue'), 'utf8');
// (v3 fase C) il pulsante puo' essere un <button> o un UiButton: si taglia
// alla sua chiusura, qualunque sia
const iRil = table.indexOf('v-if="isFinished(o)"');
const fineRil = ['</button>', '</UiButton>'].map(t => table.indexOf(t, iRil)).filter(i => i > 0);
const btn = iRil < 0 || !fineRil.length ? '' : table.slice(iRil, Math.min(...fineRil));
check(btn.length > 0 && !/userLevel/.test(btn), 'pulsante Rilancia senza blocco di livello');
const dlg = fs.readFileSync(path.join(SRV, '../HMI/src/components/RelaunchDialog.vue'), 'utf8');
const dlgTpl = dlg.slice(dlg.indexOf('<template>'), dlg.indexOf('</template>', dlg.lastIndexOf('</template>') - 1));
check(/preview\.replacedBlocked/.test(dlg) && /!this\.preview\.replacedBlocked/.test(dlg), 'dialog: "Si\'" disabilitato con la cella in lavoro, e ne spiega il motivo');
check(/!this\.preview\.availableBlocked && Number\(this\.preview\.raw\) > 0/.test(dlg), 'dialog: "No" disabilitato con 0 grezzi');
check(/production\.relaunch\.partial/.test(dlgTpl) && /production\.relaunch\.otherActive/.test(dlgTpl), 'dialog: avviso "disponibili X su N" e avviso altri ordini col pezzo');
check(!/relaunch\.paused/.test(dlg), 'dialog: nessun riferimento alla pausa');
const it = JSON.parse(fs.readFileSync(path.join(SRV, '../HMI/src/locales/it.json'), 'utf8')).production.relaunch;
check(!Object.values(it).some(t => /pausa|play|coda/i.test(t)), 'testi it: niente pausa, Play o posizione in coda');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
