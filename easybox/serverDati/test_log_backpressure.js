// ============================================================================
// test_log_backpressure.js — il log non fa piu' crescere la memoria (18/9)
//
// COSA E' SUCCESSO. Il processo e' morto dopo ore con "Fatal process out of
// memory: Zone", mentre il PLC pubblicava a raffica su due topic. Una delle
// strutture che crescevano senza tetto era il buffer interno dello stream di
// log: nessuno guardava il valore di ritorno di write() e non si aspettava mai
// 'drain', quindi quando il disco (o una rotazione, che a 1 MB sotto raffica
// capita di continuo) non stava dietro, i chunk si accumulavano in memoria.
//
// Qui si verifica che adesso il log PERDA righe invece di accumularle, e che
// lo dica. Un log che perde e lo dichiara e' meglio di un log che tiene tutto
// e fa morire il ponte.
//
// Lo stream rotante e' finto: il test non deve scrivere nel log vero, e
// soprattutto deve poter DECIDERE quando write() risponde false.
//
// Uso:   node test_log_backpressure.js
// ============================================================================

const Module = require('module');
const path = require('path');

// ------------------------------------------------------------ stream finto
const stream = {
	righe: [],
	accetta: true,          // cosa risponde write(): true = passa, false = pieno
	drain: null,            // callback registrata con once('drain')
	write(s) { this.righe.push(String(s)); return this.accetta; },
	once(ev, fn) { if (ev === 'drain') this.drain = fn; },
	// il buffer si e' svuotato: si richiama chi aspettava
	svuota() { this.accetta = true; const fn = this.drain; this.drain = null; if (fn) fn(); },
	scritte() { return this.righe.length; },
	testo() { return this.righe.join(''); },
	azzera() { this.righe.length = 0; },
};

const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'rotating-file-stream') return { createStream: () => stream };
	return origLoad.apply(this, arguments);
};

const LOG = path.join(__dirname, 'LogFunct.js');
function caricaLog(livello) {
	delete require.cache[require.resolve(LOG)];
	if (livello === undefined) delete process.env.LOG_LEVEL;
	else process.env.LOG_LEVEL = String(livello);
	stream.azzera();
	stream.accetta = true;
	stream.drain = null;
	return require(LOG);
}

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

console.log('1) livello 2 di default: la query a ogni chiamata DB non si scrive piu\'');
let log = caricaLog();
log.info('query: SELECT qualcosa di molto lungo');
check(stream.scritte() === 0, 'info() al livello di default non scrive: e\' la riga per messaggio che gonfiava il log');
log.standard('ricevo MQTT: FROM_PLANT/STATUS/ROBOT');
check(stream.scritte() === 1, 'standard() invece scrive: quello che serve a capire cosa succede resta');
log.error('rotto qualcosa');
check(stream.testo().includes('ERR'), 'e gli errori pure');

log = caricaLog(1);
log.info('query: la stessa di prima');
check(stream.scritte() === 1, 'con LOG_LEVEL=1 il debug torna: si puo\' riaccendere quando serve davvero');

console.log('\n2) buffer pieno: si SCARTA, non si accoda');
log = caricaLog();
log.standard('prima riga');
check(stream.scritte() === 1, 'la prima passa');
stream.accetta = false;          // il Writable dice "sono pieno"
log.standard('riga che riempie');
check(stream.scritte() === 2, 'la riga che riceve il false viene comunque scritta (era gia\' partita)');
const dopoIlPieno = stream.scritte();
for (let i = 0; i < 500; i++) log.standard('riga di raffica ' + i);
check(stream.scritte() === dopoIlPieno,
	'e da li\' in poi NESSUNA riga tocca lo stream: 500 righe scartate, zero accodate in memoria');
check(log.righeScartate() === 500, 'ma sono contate tutte e 500, non perse di nascosto');

console.log('\n3) alla ripresa lo dice, in una riga sola');
stream.svuota();                 // arriva 'drain'
const nota = stream.righe[stream.righe.length - 1];
check(/500 righe di log scartate/.test(nota), 'una riga sola dice quante ne sono andate perse: ' + nota.trim());
check(log.righeScartate() === 0, 'e il contatore riparte da zero');
const primaDiScrivere = stream.scritte();
log.standard('si ricomincia');
check(stream.scritte() === primaDiScrivere + 1, 'dopo il drain si scrive di nuovo');

console.log('\n4) tetto in byte al secondo: la rotazione a 1 MB limita il FILE, non la memoria');
log = caricaLog();
const lunga = 'x'.repeat(2000);
for (let i = 0; i < 100; i++) log.standard(lunga + i);   // ~200 KB in un colpo
check(log.righeScartate() > 0, 'oltre il tetto le righe si scartano invece di essere accodate');
check(stream.scritte() < 100, 'e allo stream ne arriva solo una parte (' + stream.scritte() + ' su 100)');
const scritteOra = stream.scritte();
log.error('errore DENTRO la raffica');
check(stream.scritte() === scritteOra + 1,
	'ma un ERRORE passa sopra il tetto: perderlo costerebbe piu\' del traffico che fa');

console.log('\n5) niente accodamento nascosto');
const src = require('fs').readFileSync(LOG, 'utf8');
const codice = src.split(/\r?\n/).filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
check(/accessLogStream\.write\(str\) === false/.test(codice), 'il valore di ritorno di write() viene guardato');
check(/once\('drain'/.test(codice), 'e si aspetta drain invece di insistere');
check((codice.match(/accessLogStream\.write\(/g) || []).length === 1,
	'un solo punto scrive sullo stream: il freno non si puo\' aggirare per distrazione');

console.log('\n6) l\'orario delle righe');
// Serviva alla riga periodica di memoria: un andamento nel tempo non si legge
// con un orologio rotto. Si finge il clock per coprire i casi al bordo.
const RealDate = Date;
function conOrologio(iso, fn) {
	globalThis.Date = class extends RealDate { constructor() { super(iso); } };
	try { return fn(); } finally { globalThis.Date = RealDate; }
}
log = caricaLog();
const casi = [
	// il 10 esatto: giorno, ora, minuti e secondi. Prima finiva nel ramo dello
	// zero davanti (il confronto era > 10, non >= 10) e usciva "010"
	['2026-09-10T10:10:10.005', '10-09-26 10:10:10.005: '],
	// ora sotto le dieci: prima al posto dell'ora stampava il MESE
	['2026-01-05T09:00:07.000', '05-01-26 09:00:07.000: '],
	// minuti e secondi a 59: prima i minuti erano +1, quindi "60"
	['2026-03-01T23:59:59.999', '01-03-26 23:59:59.999: '],
	// minuti sotto i dieci: prima '0'+5+1 concatenava e usciva "051"
	['2026-12-31T00:05:00.042', '31-12-26 00:05:00.042: '],
];
for (const [iso, atteso] of casi) {
	const avuto = conOrologio(iso, () => log.formatLogTime(false));
	check(avuto === atteso, iso.replace('T', ' ') + ' -> ' + JSON.stringify(avuto));
}
check(conOrologio(casi[0][0], () => log.formatLogTime(true)) === '\n' + casi[0][1],
	'e con newline=true davanti c\'e\' solo l\'a capo');
// sul CODICE senza commenti: la testata di LogFunct cita apposta le vecchie
// espressioni rotte per spiegare cosa sono state, e leggerle li' non varrebbe
check(!/getMinutes\(\)\s*\+\s*1/.test(codice), 'sparito il +1 sui minuti');
check(!/'0'\s*\+\s*d\.getMonth\(\)/.test(codice), 'sparito il mese al posto dell\'ora');
check(!/>\s*10\s*\?/.test(codice), 'e sparito il confronto > 10, che sbagliava il valore 10 esatto');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
