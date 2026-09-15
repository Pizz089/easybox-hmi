// ============================================================================
// test_single_origin.mjs — il pannello parla con UNA sola origine (15/9)
//
// PERCHE' ESISTE. Il pannello viveva su tre origini: la pagina sulla 5173, i
// dati sulla 8080, il socket sulla 3000. Adesso il browser parla solo con
// l'origine da cui e' stato caricato, e Vite gira le chiamate al backend.
// Serve a due cose: una porta sola esposta alla rete di cella, e la
// possibilita' di accendere HTTPS senza riscrivere niente (con tre origini in
// chiaro una pagina in https vedrebbe dati e socket bloccati come contenuto
// misto).
//
// IL CHECK CHE CONTA e' quello sul percorso della libreria del socket. Con la
// chiave del proxy scritta come PREFISSO ('/socket.io'), Vite girava al
// backend anche /socket.io.min.js, cioe' la libreria client che sta in
// public/: tornava 503, `io` restava indefinito e il pannello perdeva la
// connessione viva. Visto in prova sul browser, non dedotto. Da qui le chiavi
// come espressioni regolari con la barra finale.
//
// Uso:   node test_single_origin.mjs     (dalla cartella easybox/HMI)
// ============================================================================
import { readFileSync, existsSync } from 'node:fs';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

console.log('1) il pannello non nomina piu\' porte e indirizzi');
// i commenti parlano del vecchio meccanismo per spiegarlo: il controllo
// guarda il solo codice eseguibile
const dataSrc = readFileSync('src/data.js', 'utf8');
const data = dataSrc.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
check(/server:\s*'\/'/.test(data), 'le chiamate dati partono da un indirizzo RELATIVO');
check(!/:8080/.test(data), 'la porta dei dati non e\' piu\' scritta nel pannello');
check(!/:3000/.test(data), 'la porta del socket non e\' piu\' scritta nel pannello');
check(/brokerURL:\s*window\.location\.origin/.test(data), 'il socket punta all\'origine della pagina');
check(!/window\.location\.hostname/.test(data), 'niente indirizzo ricostruito a mano: vale sia da localhost sia da IP');

console.log('\n2) il proxy di Vite');
const cfgMod = await import('./vite.config.js');
const cfg = await cfgMod.default({ mode: 'development', command: 'serve' });
const keys = Object.keys(cfg.server.proxy || {});
check(keys.length === 2, 'due regole: dati e socket (' + keys.join(', ') + ')');
check(cfg.server.proxy[keys.find(k => k.includes('api'))].target === 'http://127.0.0.1:8080', 'i dati vanno al backend in chiaro su 127.0.0.1');
const sockKey = keys.find(k => k.includes('socket'));
check(cfg.server.proxy[sockKey].target === 'http://127.0.0.1:3000', 'il socket va al suo server, che sta su una porta sua');
check(cfg.server.proxy[sockKey].ws === true, 'ws attivo: senza, il socket resterebbe in polling');

console.log('\n3) il proxy NON deve mangiarsi la libreria del socket');
// le chiavi sono espressioni regolari perche' iniziano con ^ (regola di Vite)
const rx = keys.map((k) => ({ k, re: new RegExp(k) }));
const match = (path) => rx.filter((r) => r.re.test(path)).map((r) => r.k);
check(match('/socket.io/?EIO=4&transport=polling').length === 1, 'l\'endpoint del socket viene girato al backend');
check(match('/socket.io.min.js').length === 0, 'la LIBRERIA del socket NON viene girata: la serve Vite da public/ (era il difetto)');
check(existsSync('public/socket.io.min.js'), 'e infatti la libreria sta in public/');
check(match('/api/conf/vice/show/all').length === 1, 'le chiamate dati vengono girate');
check(match('/sim/push').length === 0, 'le pagine del pannello restano a Vite');
check(match('/manifest.webmanifest').length === 0, 'il manifest resta a Vite');
check(match('/pwa-192.png').length === 0, 'le icone restano a Vite');
check(match('/apix/qualcosa').length === 0, 'la barra finale in ^/api/ evita di prendersi percorsi che iniziano per api');

console.log('\n4) stessa configurazione per vite preview');
const keysPrev = Object.keys(cfg.preview.proxy || {});
check(keysPrev.length === keys.length && keysPrev.every((k) => keys.includes(k)), 'preview ha lo stesso proxy: una prova sul compilato si comporta come il pannello vero');

console.log('\n5) pronto per HTTPS senza altri cambiamenti');
const cfgSrc = readFileSync('vite.config.js', 'utf8');
check(/contenuto misto/i.test(cfgSrc), 'il motivo (contenuto misto) e\' scritto dove serve');
check(!/https:/.test(JSON.stringify(cfg.server)), 'oggi si resta in HTTP: il certificato e\' una decisione separata');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
