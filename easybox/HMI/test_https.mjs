// ============================================================================
// test_https.mjs — HTTPS del pannello e via di ritorno (cantiere pwa-https)
//
// Il tablet arriva per indirizzo IP e Chrome installa una PWA solo da contesto
// sicuro: senza HTTPS il manifest non basta. Il touch di cella invece apre
// localhost, che Chrome considera sicuro anche in HTTP, e funzionava gia'.
// Accendere HTTPS non deve romperlo: e' il vincolo principale di questo
// cantiere, e da li' vengono meta' dei controlli qui sotto.
//
// Cosa si verifica:
//  1. Vite passa a HTTPS SOLO se il certificato c'e', e resta in HTTP se no;
//  2. la via di ritorno e' UNA variabile, e spegne sia Vite sia lo script del
//     certificato (altrimenti lo rigenererebbe e non si tornerebbe indietro);
//  3. lo script mette gli indirizzi IP nel campo giusto del certificato, che
//     e' la ragione per cui Chrome li accetta;
//  4. rinnovo automatico prima della scadenza, firmato dalla STESSA CA, cosi'
//     i tablet non vanno ritoccati;
//  5. la CA e' scaricabile in chiaro dal backend, che e' il passo uno della
//     procedura per aggiungere un tablet;
//  6. chiavi e certificati non finiscono nel repository.
//
// Uso:   node test_https.mjs     (dalla cartella easybox/HMI)
// ============================================================================
import { readFileSync, existsSync } from 'node:fs';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const ps = readFileSync('tools/ensure-cert.ps1', 'utf8');
const cfg = readFileSync('vite.config.js', 'utf8');

console.log('1) Vite accende HTTPS solo quando il certificato c\'e\'');
const mod = await import('./vite.config.js');
const conf = await mod.default({ mode: 'development', command: 'serve' });
const certPresenti = existsSync('certs/panel.pfx') && existsSync('certs/panel.pass');
check(!!conf.server.https === certPresenti, certPresenti
  ? 'certificato presente -> HTTPS acceso'
  : 'certificato assente -> si resta in HTTP (nessun errore, nessun blocco)');
check(/existsSync\(pfxFile\)/.test(cfg), 'la decisione si basa sulla presenza del file, non su una scelta scritta a mano');
// i commenti spiegano le scelte nominandole: i controlli guardano il solo
// codice, altrimenti passerebbero (o fallirebbero) leggendo una frase
const cfgCode = cfg.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
check(!/redirect|301|308/.test(cfgCode), 'nessun redirect automatico da http a https: un problema di certificato non deve diventare una pagina che non si apre');
if (conf.server.https) {
  check(Buffer.isBuffer(conf.server.https.pfx) && conf.server.https.pfx.length > 0, 'il certificato viene passato a Vite come file, non come percorso');
  check(typeof conf.server.https.passphrase === 'string' && conf.server.https.passphrase.length > 0, 'con la sua password');
  check(conf.preview.https === conf.server.https, 'anche vite preview usa lo stesso certificato');
}

console.log('\n2) via di ritorno: una variabile sola');
check(/HMI_HTTP_ONLY/.test(cfg), 'Vite conosce l\'interruttore');
check(/HMI_HTTP_ONLY/.test(ps), 'lo script del certificato conosce lo STESSO interruttore');
check(/HMI_HTTP_ONLY['"\s]*-eq\s*'1'[\s\S]{0,200}exit 0/.test(ps), 'con l\'interruttore lo script esce subito: senza, rigenererebbe il certificato e non si tornerebbe indietro');
const appunti = readFileSync('../docs/APPUNTI-CELLA.md', 'utf8');
check(/HMI_HTTP_ONLY/.test(appunti), 'la procedura di ritorno e\' negli appunti di cella');
check(/tornare in HTTP|ritorno in HTTP/i.test(appunti), 'ed e\' scritta come si cerca quando serve');

console.log('\n3) indirizzi IP nel certificato');
check(/IPAddress=/.test(ps), 'gli IP finiscono nel SAN come indirizzi');
check(/2\.5\.29\.17=\{text\}/.test(ps), 'il SAN e\' scritto a mano, non lasciato a -DnsName');
const psCode = ps.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
check(!/-DnsName/.test(psCode), 'niente -DnsName: scriverebbe l\'IP come se fosse un nome, e Chrome non lo accetterebbe');
check(/DNS=\$n/.test(ps) && /ExtraDns/.test(ps), 'nel certificato ci sono anche nomi host, per il giorno in cui si usera\' un nome al posto dell\'IP');
if (existsSync('certs/san.txt')) {
  const san = readFileSync('certs/san.txt', 'utf8');
  check(/IPAddress=/.test(san) && /DNS=localhost/.test(san), 'il certificato generato copre IP e localhost (' + san.slice(0, 60) + '...)');
}

console.log('\n4) rinnovo automatico');
check(/RenewDays\s*=\s*30/.test(ps), 'soglia di rinnovo a 30 giorni');
check(/\$giorni -lt \$RenewDays/.test(ps), 'il confronto con la scadenza esiste davvero');
check(/AddYears\(10\)/.test(ps), 'la CA dura dieci anni');
check(/-Signer \$caIn/.test(ps), 'il rinnovo firma con la STESSA CA: i dispositivi non vanno ritoccati');
check(/gli indirizzi della macchina sono cambiati/.test(ps), 'si rigenera anche se cambia l\'indirizzo del PC impianto');
check(/Cert:\\CurrentUser\\Root/.test(ps), 'la CA viene resa fidata sul PC impianto: senza, il touch di cella vedrebbe l\'avviso di certificato');

console.log('\n5) la CA si scarica dal backend, in chiaro');
const srv = readFileSync('../serverDati/server.js', 'utf8');
check(/app\.get\('\/ca\.crt'/.test(srv), 'endpoint presente');
check(!/app\.get\('\/api\/ca\.crt'/.test(srv), 'NON sotto /api: /api e\' quello che il proxy gira, questo va aperto diretto dal tablet');
check(/application\/x-x509-ca-cert/.test(srv), 'tipo MIME che fa aprire ad Android la finestra di installazione');
check(/ca\.crt'\);[\s\S]{0,200}existsSync/.test(srv) || /existsSync\(caPath\)/.test(srv), 'se la CA non c\'e\' ancora lo dice, invece di servire un file vuoto');

console.log('\n6) chiavi e certificati fuori dal repository');
const ign = readFileSync('.gitignore', 'utf8');
check(/^certs\/$/m.test(ign), 'la cartella dei certificati e\' ignorata da git');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
check(/ensure-cert\.ps1/.test(pkg.scripts.cert || ''), 'npm run cert richiama lo script');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
