// ============================================================================
// test_log_table_cleanup.js — pulizia a blocchi della tabella LOG (17/11)
//
// La DELETE unica ogni 4 h ("data <= ora - 3 giorni") non riusciva da
// settembre: una transazione sola superava il log del database (MAXSIZE
// 100 MB), lo riempiva (ACTIVE_TRANSACTION) e tornava indietro.
// logTableCleanup cancella a blocchi da 2000 righe, solo se ci sono righe piu'
// vecchie del limite e solo (a) senza produzione attiva o (b) con la HAAS in
// lavorazione e il robot fermo.
//
// Si verifica: i testi delle query (nessuna DELETE senza TOP), i giorni dal
// .env con default 60, nessun controllo nei primi 10 minuti, nessuna partenza
// senza (a) ne' (b) o senza righe vecchie, i blocchi fino a 0 righe con la
// condizione ricontrollata prima di ogni blocco, lo stop se la condizione cade
// a meta', la riga di log standard per passata, gli errori di connessione e
// SQL loggati senza crash, server.js che la avvia al posto del setInterval.
//
// Uso:   node test_log_table_cleanup.js
// NON richiede DB ne' backend attivo: sql, log e timer sono finti.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { createLogTableCleanup, giorniDaConfig, DELETE_QUERY, OLD_ROW_QUERY, ACTIVE_ORDER_QUERY,
	INTERVAL_MS, DEFAULT_GIORNI } = require(path.join(__dirname, 'logTableCleanup.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const norm = s => String(s).replace(/\s+/g, ' ').trim();

// sql finto: risponde da solo secondo lo stato di h (produzione attiva, righe
// vecchie, righe cancellate da ogni blocco). h.dopoQuery puo' cambiare lo
// stato a meta' passata; h.sospendi tiene ferma la prossima risposta.
function harness() {
	const h = {
		queries: [], inputs: [], logs: [], errors: [], inits: [], timers: [], connects: 0,
		connectErr: null, attiva: false, vecchie: true, blocchi: [], erroreDelete: {}, dispatch: {},
		dopoQuery: null, sospendi: false, sospesa: null,
	};
	const rispondi = (q) => {
		if (/FROM WORKORDERS/.test(q)) return { recordset: h.attiva ? [{ ID: 7 }] : [] };
		if (/^SELECT TOP 1 ID FROM LOG /.test(q)) return { recordset: h.vecchie ? [{ ID: 1 }] : [] };
		if (/DELETE TOP/.test(q)) {
			const i = h.queries.filter(x => /DELETE/.test(x)).length;
			if (h.erroreDelete[i]) return h.erroreDelete[i];
			// rowsAffected volutamente sbagliato: il conteggio deve venire da @@ROWCOUNT
			return { recordset: [{ n: h.blocchi.length ? h.blocchi.shift() : 0 }], rowsAffected: [99999] };
		}
		return new Error('query inattesa: ' + q);
	};
	h.sql = {
		Int: 'Int',
		connect: (cfg, cb) => { h.connects++; cb(h.connectErr); },
		Request: function () {
			this.input = (name, type, value) => { h.inputs.push([name, type, value]); return this; };
			this.query = (q, cb) => {
				h.queries.push(q);
				const r = rispondi(q);
				const fine = () => { if (h.dopoQuery) h.dopoQuery(q); r instanceof Error ? cb(r) : cb(null, r); };
				if (h.sospendi) { h.sospendi = false; h.sospesa = fine; } else fine();
			};
		},
	};
	h.deps = {
		sql: h.sql, configDB: {}, giorni: undefined,
		log: { standard: s => h.logs.push(String(s)), error: s => h.errors.push(String(s)), init: s => h.inits.push(String(s)) },
		ultimoDispatch: (unit, n) => h.dispatch[unit + '/' + n],
		setTimeout: (fn, ms) => { h.timers.push({ fn, ms }); return h.timers.length; },
	};
	h.fire = () => h.timers.shift().fn();
	h.deletes = () => h.queries.filter(q => /DELETE/.test(q));
	h.reset = () => { h.queries.length = 0; h.inputs.length = 0; h.logs.length = 0; h.errors.length = 0; };
	return h;
}
const flush = () => new Promise(r => setImmediate(r));

(async () => {

console.log('1) le query');
check(norm(DELETE_QUERY) === 'SET DEADLOCK_PRIORITY LOW; DELETE TOP (2000) FROM LOG WHERE DATA < DATEADD(day, -@giorni, GETDATE()); SELECT @@ROWCOUNT AS n;',
	'DELETE a blocchi da 2000, priorita\' bassa nei deadlock, righe cancellate da @@ROWCOUNT');
check(!/NOCOUNT/i.test(DELETE_QUERY), 'niente SET NOCOUNT nella DELETE');
check(norm(OLD_ROW_QUERY) === 'SELECT TOP 1 ID FROM LOG WHERE DATA < DATEADD(day, -@giorni, GETDATE());', 'righe piu\' vecchie del limite: SELECT TOP 1, stesso limite della DELETE');
check(norm(ACTIVE_ORDER_QUERY) === 'SELECT TOP 1 ID FROM WORKORDERS WHERE STATUS=3 AND PRODUCTED<QUANTITY;', 'produzione attiva: la regola di FB204 (Status=3 AND PRODUCTED<QUANTITY)');
check(INTERVAL_MS === 10 * 60 * 1000, 'un controllo ogni 10 minuti');
check(DEFAULT_GIORNI === 60, 'default 60 giorni');

console.log('\n2) nessuna DELETE senza TOP (modulo e server.js)');
// CRLF -> LF prima di tutto: col checkout di Windows (autocrlf) il "." della
// regex dei commenti non passa il \r, e i commenti resterebbero nel codice
const codice = s => s.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(r => r.replace(/\/\/.*$/, '')).join('\n');
const mod = codice(fs.readFileSync(path.join(__dirname, 'logTableCleanup.js'), 'utf8'));
const delMod = mod.match(/\bDELETE\b[^;`'"]*/gi) || [];
check(delMod.length >= 1 && delMod.every(d => /^DELETE TOP \(2000\) FROM LOG /.test(d)), 'logTableCleanup.js: ogni DELETE e\' DELETE TOP (2000) FROM LOG');
const srv = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
check(!/DELETE\s+FROM\s+log/i.test(codice(srv)), 'server.js: via la DELETE unica');
check(!/4\s*\*\s*3600\s*\*\s*1000/.test(codice(srv)), 'server.js: via il setInterval da 4 h');

console.log('\n3) giorni da tenere: LOG_TABLE_KEEP_DAYS, default 60');
check(giorniDaConfig(undefined).giorni === 60, 'variabile assente -> 60');
check(giorniDaConfig('').giorni === 60, 'variabile vuota -> 60');
check(giorniDaConfig('45').giorni === 45, '45 -> 45');
check(giorniDaConfig(' 90 ').giorni === 90, '" 90 " -> 90');
check(['abc', '0', '-5', '7.5', '30gg'].every(v => giorniDaConfig(v).giorni === 60), 'non intero o non positivo -> 60 (mai "cancella tutto")');
check(giorniDaConfig('abc').fonte !== giorniDaConfig('45').fonte, 'la fonte dice se e\' il valore configurato o il default');

console.log('\n4) avvio: nessun controllo nei primi 10 minuti');
let h = harness();
let c = createLogTableCleanup(h.deps);
c.start();
await flush();
check(h.connects === 0 && h.queries.length === 0, 'all\'avvio nessuna connessione e nessuna query');
check(h.timers.length === 1 && h.timers[0].ms === 600000, 'un solo timer, da 10 minuti');
check(h.inits.some(s => /60 giorni/.test(s) && /default/.test(s)), 'riga di avvio: 60 giorni, default');
h = harness();
h.deps.giorni = '45';
createLogTableCleanup(h.deps).start();
check(h.inits.some(s => /45 giorni/.test(s) && /LOG_TABLE_KEEP_DAYS/.test(s)), 'con LOG_TABLE_KEEP_DAYS=45 la riga di avvio dice 45 giorni');

console.log('\n5) blocchi fino a 0 righe (condizione a: nessuna produzione attiva)');
h = harness();
h.blocchi = [2000, 2000, 500, 0];
c = createLogTableCleanup(h.deps);
c.start();
await h.fire();
check(h.deletes().length === 4, 'quattro DELETE: 2000, 2000, 500, poi 0 e stop');
check(h.deletes().every(q => q === DELETE_QUERY), 'tutte col testo a blocchi');
const seq = h.queries.map(q => /WORKORDERS/.test(q) ? 'W' : /DELETE/.test(q) ? 'D' : /FROM LOG/.test(q) ? 'L' : '?').join('');
check(seq === 'WLDWDWDWD', 'ordine: produzione, righe vecchie, poi condizione ricontrollata prima di ogni blocco (' + seq + ')');
check(h.inputs.filter(i => i[0] === 'giorni').length === 5 && h.inputs.filter(i => i[0] === 'giorni').every(i => i[1] === 'Int' && i[2] === 60),
	'@giorni = 60 (Int) nella SELECT e in ogni DELETE');
check(h.logs.length === 1, 'una riga di log standard per passata');
const riga = h.logs[0] || '';
check(/4500 righe/.test(riga) && /3 blocchi/.test(riga), 'righe cancellate (da @@ROWCOUNT, non da rowsAffected) e blocchi: ' + riga);
check(/condizione a/.test(riga) && /fine: finito/.test(riga) && /\d+\.\d s/.test(riga), 'condizione a, durata, fine: finito');
check(h.errors.length === 0, 'nessun errore');
check(h.timers.length === 1 && h.timers[0].ms === 600000, 'giro dopo programmato fra 10 minuti');

console.log('\n6) giorni configurati: arrivano alla query');
h = harness();
h.deps.giorni = '45';
h.blocchi = [10, 0];
c = createLogTableCleanup(h.deps);
c.start();
await h.fire();
check(h.inputs.length > 0 && h.inputs.every(i => i[0] === 'giorni' && i[2] === 45), '@giorni = 45 in tutte le query su LOG');
check(h.deletes().length === 2, 'e la pulizia gira');

console.log('\n7) nessuna partenza senza (a) ne\' (b)');
h = harness();
h.attiva = true;
c = createLogTableCleanup(h.deps);
c.start();
await h.fire();
check(h.deletes().length === 0 && !h.queries.some(q => /FROM LOG/.test(q)), 'produzione attiva, nessun DISPATCH ricevuto: niente SELECT su LOG, niente DELETE');
check(h.logs.length === 0 && h.errors.length === 0, 'e nessuna riga di log (non e\' una passata)');
check(h.timers.length === 1, 'giro dopo programmato');
for (const [mc1, robot, cosa] of [[95, undefined, 'MC1/0 = 95, ROBOT/0 mai ricevuto'], [95, 5, 'MC1/0 = 95, ROBOT/0 = 5'],
	[100, 0, 'MC1/0 = 100, ROBOT/0 = 0'], [undefined, 0, 'MC1/0 mai ricevuto, ROBOT/0 = 0']]) {
	h.reset();
	h.dispatch = { 'MC1/0': mc1, 'ROBOT/0': robot };
	await h.fire();
	check(h.deletes().length === 0, 'produzione attiva e ' + cosa + ': niente DELETE');
}

console.log('\n8) condizione b: HAAS in lavorazione (MC1/0 = 95) e robot fermo (ROBOT/0 = 0)');
h = harness();
h.attiva = true;
h.dispatch = { 'MC1/0': 95, 'ROBOT/0': 0 };
h.blocchi = [2000, 300, 0];
c = createLogTableCleanup(h.deps);
c.start();
await h.fire();
check(h.deletes().length === 3, 'con la produzione attiva la pulizia parte lo stesso');
check(/2300 righe/.test(h.logs[0]) && /condizione b/.test(h.logs[0]) && /fine: finito/.test(h.logs[0]), 'riga di log con condizione b: ' + h.logs[0]);

console.log('\n9) nessuna riga piu\' vecchia del limite: niente DELETE');
h = harness();
h.vecchie = false;
c = createLogTableCleanup(h.deps);
c.start();
await h.fire();
check(h.queries.some(q => q === OLD_ROW_QUERY) && h.deletes().length === 0, 'SELECT TOP 1 senza righe: nessuna DELETE');
check(h.logs.length === 0, 'nessuna riga di log');

console.log('\n10) la condizione cade a meta\': stop, si riprende al giro dopo');
h = harness();
h.blocchi = [2000, 2000, 2000, 700, 0];
h.dopoQuery = q => { if (h.deletes().length === 2 && /DELETE/.test(q)) h.attiva = true; };
c = createLogTableCleanup(h.deps);
c.start();
await h.fire();
check(h.deletes().length === 2, 'parte una produzione dopo il secondo blocco: il terzo non parte');
check(/4000 righe/.test(h.logs[0]) && /2 blocchi/.test(h.logs[0]) && /fine: condizione caduta/.test(h.logs[0]), 'riga di log: ' + h.logs[0]);
check(h.timers.length === 1 && h.timers[0].ms === 600000, 'giro dopo programmato');
h.reset();
h.dopoQuery = null;
h.attiva = false;
await h.fire();
check(h.deletes().length === 3 && /2700 righe/.test(h.logs[0]) && /fine: finito/.test(h.logs[0]), 'al giro dopo riprende e finisce: ' + h.logs[0]);
// condizione b che cade: il robot riparte
h = harness();
h.attiva = true;
h.dispatch = { 'MC1/0': 95, 'ROBOT/0': 0 };
h.blocchi = [2000, 2000, 0];
h.dopoQuery = q => { if (/DELETE/.test(q)) h.dispatch['ROBOT/0'] = 10; };
c = createLogTableCleanup(h.deps);
c.start();
await h.fire();
check(h.deletes().length === 1 && /fine: condizione caduta/.test(h.logs[0]), 'condizione b: il robot riparte dopo il primo blocco, stop');

console.log('\n11) errore di connessione: loggato, nessuna query, nessun crash');
h = harness();
h.connectErr = new Error('ECONNREFUSED');
c = createLogTableCleanup(h.deps);
c.start();
let threw = false;
try { await h.fire(); } catch (e) { threw = true; }
check(!threw, 'nessuna eccezione');
check(h.errors.some(s => /pulizia LOG/.test(s) && /connessione/.test(s) && /ECONNREFUSED/.test(s)), 'errore di connessione nel log: ' + h.errors[0]);
check(h.queries.length === 0, 'nessuna query');
check(h.timers.length === 1 && !c.isRunning(), 'giro dopo programmato');

console.log('\n12) errore SQL a meta\': riga con fine errore, giro dopo programmato');
h = harness();
h.blocchi = [2000, 2000, 0];
h.erroreDelete = { 2: new Error('Lock request time out') };
c = createLogTableCleanup(h.deps);
c.start();
threw = false;
try { await h.fire(); } catch (e) { threw = true; }
check(!threw && h.deletes().length === 2, 'secondo blocco in errore: nessuna eccezione, nessun terzo blocco');
check(h.errors.some(s => /Lock request time out/.test(s)), 'errore nel log');
check(/2000 righe/.test(h.logs[0]) && /1 blocco/.test(h.logs[0]) && /fine: errore/.test(h.logs[0]), 'riga della passata con fine: errore: ' + h.logs[0]);
check(h.timers.length === 1, 'giro dopo programmato');

console.log('\n13) i giri non si sovrappongono');
h = harness();
h.blocchi = [5, 0];
c = createLogTableCleanup(h.deps);
c.start();
h.sospendi = true;
const giro = h.fire();
await flush();
check(c.isRunning() === true, 'passata in corso (query senza risposta)');
check(c.tick() === false, 'un secondo giro mentre il primo e\' in corso non parte');
check(h.timers.length === 0, 'e non c\'e\' un timer finche\' il primo non ha finito');
h.sospesa();
await giro;
check(!c.isRunning() && h.timers.length === 1, 'finito il primo, un solo timer');

console.log('\n14) server.js e .env.example');
check(/require\('\.\/logTableCleanup'\)\.createLogTableCleanup\(\{[\s\S]{0,300}\}\)\.start\(\);/.test(srv), 'server.js la avvia una volta');
check(/giorni:\s*process\.env\.LOG_TABLE_KEEP_DAYS/.test(srv), 'giorni dal .env (LOG_TABLE_KEEP_DAYS)');
check(/ultimoDispatch:\s*MQTT\.lastDispatch/.test(srv), 'condizione b dai DISPATCH ricevuti dal client MQTT');
check(/configDB:\s*DBf\.configDB/.test(srv.slice(srv.indexOf('logTableCleanup'))), 'stessa configurazione DB del backend');
const envEx = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8');
check(/^#\s*LOG_TABLE_KEEP_DAYS=60\s*$/m.test(envEx), '.env.example: LOG_TABLE_KEEP_DAYS documentata, default 60');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);

})().catch(e => { console.log('  FAIL eccezione nel test: ' + (e && e.stack || e)); process.exit(1); });
