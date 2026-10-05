// ============================================================================
// test_order_autoclose.js — chiusura automatica degli ordini (P4 5/10)
//
// Gli ordini restavano a STATUS=3 con PRODUCTED >= QUANTITY perche' la
// chiusura scatta solo su FROM_PLANT/PART/BOX/TRAY, che nessun blocco PLC
// pubblica. orderAutoClose li porta a 5 ogni 30 s e una volta all'avvio.
//
// Si verifica: la query (base table WORKORDER, condizione dalla vista
// WORKORDERS, ID chiusi da OUTPUT), log ed emit solo se ha chiuso qualcosa,
// errore SQL senza crash e con nuovo giro, e soprattutto che i giri NON si
// sovrappongano quando una query e' lenta.
//
// Uso:   node test_order_autoclose.js
// NON richiede DB ne' backend attivo: sql, io, log e timer sono finti.
// ============================================================================

const path = require('path');
const { createOrderAutoClose, CLOSE_QUERY, INTERVAL_MS } = require(path.join(__dirname, 'orderAutoClose.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// sql finto: la query NON risponde finche' il test non lo decide (query lenta)
function harness() {
	const h = { queries: [], pending: [], emitted: [], logs: [], errors: [], timers: [], connectErr: null };
	h.sql = {
		connect: (cfg, cb) => cb(h.connectErr),
		Request: function () { this.query = (q, cb) => { h.queries.push(q); h.pending.push(cb); }; },
	};
	h.deps = {
		sql: h.sql, configDB: {},
		io: { emit: ev => h.emitted.push(ev) },
		log: { standard: s => h.logs.push(s), error: s => h.errors.push(s) },
		setTimeout: (fn, ms) => { h.timers.push({ fn, ms }); return h.timers.length; },
	};
	h.answer = (err, ids) => h.pending.shift()(err, err ? undefined : { recordset: (ids || []).map(ID => ({ ID })), rowsAffected: [99] });
	h.fireTimer = () => h.timers.shift().fn();
	return h;
}

console.log('1) la query');
const q = CLOSE_QUERY.replace(/\s+/g, ' ');
check(q === 'UPDATE WORKORDER SET STATUS=5 OUTPUT inserted.ID WHERE STATUS=3 AND ID IN (SELECT ID FROM WORKORDERS WHERE STATUS=3 AND PRODUCTED>=QUANTITY);', 'testo esatto della decisione D4-A');
check(/^UPDATE WORKORDER /.test(q) && /FROM WORKORDERS WHERE/.test(q), 'scrive sulla base table, legge PRODUCTED dalla vista');
check(/OUTPUT inserted\.ID/.test(q), 'ordini chiusi da OUTPUT, non da rowsAffected');
check(INTERVAL_MS === 30000, 'un giro ogni 30 s');

console.log('\n2) avvio: un giro subito, il successivo solo a giro finito');
let h = harness();
let ac = createOrderAutoClose(h.deps);
ac.start();
check(h.queries.length === 1 && h.queries[0] === CLOSE_QUERY, 'all\'avvio parte subito una query');
check(h.timers.length === 0, 'nessun timer finche\' la query non ha risposto');
h.answer(null, []);
check(h.timers.length === 1 && h.timers[0].ms === 30000, 'risposta arrivata -> UN timer da 30 s');
check(h.emitted.length === 0 && h.logs.length === 0, 'niente chiuso: nessun log e nessun emit');

console.log('\n3) chiude qualcosa: log con gli ID ed emit');
h.fireTimer();
check(h.queries.length === 2, 'scaduto il timer, secondo giro');
h.answer(null, [1100, 1101]);
check(h.logs.some(s => /2 ordini/.test(s) && /1100, 1101/.test(s)), 'log standard con gli ID chiusi (da OUTPUT, non dal rowsAffected=99)');
check(h.emitted.join() === 'PRODUCTION/CHANGED', 'emit PRODUCTION/CHANGED');
check(h.timers.length === 1, 'e di nuovo un solo timer');

console.log('\n4) query lenta: i giri non si sovrappongono');
h = harness();
ac = createOrderAutoClose(h.deps);
ac.start();
check(ac.isRunning() === true, 'giro in corso (query senza risposta)');
check(ac.tick() === false && h.queries.length === 1, 'un secondo tick mentre il primo e\' in corso non parte');
check(h.timers.length === 0, 'e non c\'e\' nessun timer che possa farne partire un altro');
h.answer(null, []);
check(ac.isRunning() === false && h.timers.length === 1, 'solo a risposta arrivata si programma il giro dopo');

console.log('\n5) errore SQL: log, nessun crash, riprova al giro dopo');
h.fireTimer();
let threw = false;
try { h.answer(new Error('timeout'), null); } catch (e) { threw = true; }
check(!threw && h.errors.some(s => /errore SQL/.test(s)), 'errore loggato, nessuna eccezione');
check(h.emitted.length === 0, 'nessun emit');
check(h.timers.length === 1, 'giro successivo comunque programmato');
h.fireTimer();
check(h.queries.length === 3, 'e al giro dopo si riprova');

console.log('\n6) connessione DB fallita: stesso trattamento');
h = harness();
h.connectErr = new Error('ECONNREFUSED');
ac = createOrderAutoClose(h.deps);
threw = false;
try { ac.start(); } catch (e) { threw = true; }
check(!threw && h.errors.some(s => /connessione/.test(s)) && h.queries.length === 0, 'errore loggato, nessuna query, nessun crash');
check(h.timers.length === 1 && ac.isRunning() === false, 'giro successivo programmato');

console.log('\n7) avviato da server.js all\'ascolto');
const srv = require('fs').readFileSync(path.join(__dirname, 'server.js'), 'utf8');
check(/require\('\.\/orderAutoClose'\)\.createOrderAutoClose\(\{[\s\S]{0,200}\}\)\.start\(\);/.test(srv), 'server.js lo avvia una volta');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
