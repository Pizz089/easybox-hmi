// ============================================================================
// test_pwa.mjs — supporto PWA per l'uso da tablet Android (15/9).
//
// Cosa protegge: il manifest e' un file che nessuno guarda finche' non serve,
// e basta una parola cambiata perche' il tablet torni ad aprire una scheda
// normale con tutte le barre. In particolare:
//   - display DEVE essere "fullscreen": con "standalone" resta la barra di
//     stato di Android, che e' esattamente cio' che si voleva togliere;
//   - start_url e scope non devono contenere indirizzi: l'indirizzo del PC di
//     cella non e' scritto da nessuna parte e puo' cambiare;
//   - le icone dichiarate devono esistere davvero ed essere delle dimensioni
//     dichiarate (Chrome pretende 192 e 512 per offrire l'installazione).
//
// Non serve Vite: si leggono i file. Uso:  node test_pwa.mjs
// ============================================================================
import { readFileSync, existsSync } from 'node:fs';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// dimensioni di un PNG dall'header IHDR, senza dipendenze
function pngSize(file) {
	const b = readFileSync(file);
	const sig = [137, 80, 78, 71, 13, 10, 26, 10];
	for (let i = 0; i < 8; i++) if (b[i] !== sig[i]) return null;
	return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
}

console.log('1) manifest');
check(existsSync('public/manifest.webmanifest'), 'il manifest sta in public/, quindi viene servito alla radice');
const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
check(m.display === 'fullscreen', 'display fullscreen: con standalone resterebbe la barra di stato di Android');
check(String(m.orientation).startsWith('landscape'), 'orientamento bloccato in landscape (' + m.orientation + ')');
check(m.orientation === 'landscape', 'landscape e non landscape-primary: il tablet si puo\' rovesciare di 180 gradi');
// La proprieta' che conta non e' "relativo" ma "senza indirizzo dentro": il
// manifest non deve nominare host ne' porta, altrimenti smetterebbe di
// funzionare il giorno in cui cambia l'indirizzo del PC di cella. Sia "." sia
// "/" vanno bene; si e' passati a "/" il 15/9 provando a sbloccare
// l'installazione sul tablet (non era quello il problema, vedi PWA-TABLET.md).
check(!/^https?:\/\//.test(m.start_url), 'start_url senza indirizzo dentro (' + m.start_url + '): vale con qualunque indirizzo del PC di cella');
check(!/^https?:\/\//.test(m.scope), 'scope senza indirizzo dentro (' + m.scope + ')');
check(!!m.name && !!m.short_name, 'nome e nome breve presenti (Chrome li pretende per installare)');
check(m.background_color === m.theme_color, 'schermata di avvio e barra dello stesso colore (' + m.theme_color + ')');

// start_url e scope si risolvono sull'indirizzo del tablet, non su uno scritto
// a mano: e' la ragione per cui devono restare relativi
const base = 'http://192.168.1.50:5173/manifest.webmanifest';
check(new URL(m.start_url, base).href === 'http://192.168.1.50:5173/', 'start_url risolto da un indirizzo di rete -> radice del pannello');
check(new URL(m.scope, base).href === 'http://192.168.1.50:5173/', 'scope risolto -> radice del pannello');
check(new URL(m.start_url, base).href.startsWith(new URL(m.scope, base).href), 'start_url dentro lo scope: se non lo fosse, Chrome rifiuterebbe di installare');

console.log('\n2) icone');
const wanted = { '192x192': false, '512x512': false };
let maskable = false;
for (const ic of m.icons) {
	const f = 'public/' + ic.src;
	check(existsSync(f), 'esiste ' + ic.src);
	const s = existsSync(f) ? pngSize(f) : null;
	check(!!s, ic.src + ' e\' un PNG valido');
	if (s) {
		const dim = s.w + 'x' + s.h;
		check(dim === ic.sizes, ic.src + ': dimensione reale ' + dim + ' = dichiarata ' + ic.sizes);
		check(s.w === s.h, ic.src + ' e\' quadrata');
		if (dim in wanted && ic.purpose !== 'maskable') wanted[dim] = true;
	}
	if (ic.purpose === 'maskable') maskable = true;
	check(!/^https?:|^\//.test(ic.src), ic.src + ': percorso relativo');
}
check(wanted['192x192'] && wanted['512x512'], 'ci sono le due misure che Chrome pretende per installare');
check(maskable, 'c\'e\' un\'icona maskable: senza, Android la incornicia lui e viene piccola e storta');

console.log('\n3) index.html');
const html = readFileSync('index.html', 'utf8');
check(/<link rel="manifest" href="\/manifest\.webmanifest">/.test(html), 'il manifest e\' collegato');
check(new RegExp('<meta name="theme-color" content="' + m.theme_color + '">').test(html), 'theme-color allineato al manifest');
check(/viewport-fit=cover/.test(html), 'viewport-fit=cover: a schermo intero la pagina arriva ai bordi');
check(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(html), 'lo zoom con le dita NON e\' disabilitato: su un tablet in mano serve');

console.log('\n4) niente service worker (scelta dichiarata)');
check(!existsSync('public/sw.js') && !existsSync('src/sw.js'), 'nessun service worker: il pannello vive di dati in tempo reale e la cella gira in modalita\' sviluppo con HMR');
check(existsSync('../docs/PWA-TABLET.md'), 'la procedura per il tablet e il vincolo del contesto sicuro sono documentati');
const doc = readFileSync('../docs/PWA-TABLET.md', 'utf8');
check(/contesto sicuro/i.test(doc) && /https/.test(doc), 'il documento dice che Chrome installa solo da contesto sicuro');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
