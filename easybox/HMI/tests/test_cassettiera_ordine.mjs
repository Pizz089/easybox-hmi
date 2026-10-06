// ============================================================================
// tests/test_cassettiera_ordine.mjs — la cassettiera nell'ordine FISICO
// (pannello v3, Magazzino · Cassetti; Dario, 6/10: «i cassetti devono essere
// numerati dal 12 al 1 come sono fisicamente»)
//
// La pagina Cassetti si rende con la sua logica vera (Vite ssrLoadModule,
// render SSR di Vue, i18n italiano) su cassettiere di prova, e si legge
// l'HTML:
//   1. dall'alto in basso le righe sono 12, 11, ..., 1; quelle senza piano
//      (fuori) restano sotto; i piani senza cassetto si saltano;
//   2. restano come prima: il numero mostrato (FLOOR_MAG), il cassetto
//      scelto all'apertura (quello fuori, altrimenti il piano piu' basso) e
//      le frecce (precedente = numero piu' basso, i buchi si saltano);
//   3. "in largo e in compatto": una sola lista disegna la cassettiera nelle
//      due disposizioni, e nessuna regola CSS della pagina ne cambia l'ordine
//      (order, *-reverse, direction). Il rilievo con Playwright misura
//      l'ordine vero, dall'alto in basso, a 1920 x 1080 e 1024 x 768.
//
// Uso: node tests/test_cassettiera_ordine.mjs   (dalla cartella easybox/HMI)
// ============================================================================
const noop = () => {};
globalThis.window = {
	location: { hostname: 'localhost', reload: noop },
	matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
	addEventListener: noop, removeEventListener: noop,
	performance: globalThis.performance,   // vue-i18n
};
globalThis.sessionStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
// nessuna chiamata verso la cella: in SSR mounted non parte, ma per sicurezza
globalThis.fetch = () => Promise.reject(new Error('fetch non ammesso nel test'));
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
const TraysView = (await server.ssrLoadModule('/src/views/conf/TraysView.vue')).default;
const { createSSRApp, h } = await import('vue');
const { renderToString } = await import('vue/server-renderer');
const { createI18n } = await import('vue-i18n');
const IT = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));

// cassettiera di prova: ID che NON seguono il numero del piano (come in cella
// dopo il reinserimento dei piani 9-11), in ordine sparso come dal DB
function cassettiera(piani, { fuori = 0, senzaPiano = false } = {}) {
	const t = piani.map(f => ({ ID: 100 + ((f * 7) % 13), FLOOR_MAG: f, EXTRACT: f === fuori ? 1 : 0, STATUS: 0, FAMILY: '', DESCR: 'cassetto ' + f, X: 820, Y: 610 }));
	if (senzaPiano) t.push({ ID: 199, FLOOR_MAG: 0, EXTRACT: 0, STATUS: 0, FAMILY: '', DESCR: 'senza piano', X: 0, Y: 0 });
	return t.sort((a, b) => (a.ID * 37) % 11 - (b.ID * 37) % 11);
}

async function rendi(datiTab, selFloor = null) {
	// la pagina vera con i dati di prova (extends non porta con se' il render SSR)
	const pagina = { ...TraysView, data() { return { ...TraysView.data.call(this), datiTab, selFloor }; } };
	const app = createSSRApp({ render: () => h(pagina) });
	app.use(createI18n({ legacy: false, globalInjection: true, locale: 'it', messages: { it: IT } }));
	app.config.globalProperties.$router = { push: noop };
	app.config.warnHandler = noop;
	return renderToString(app);
}
const testi = (html, cls) => [...html.matchAll(new RegExp('class="' + cls + '"[^>]*>([^<]*)<', 'g'))].map(m => m[1].trim());
// le righe della cassettiera nell'ordine dell'HTML: numero, classi, title
// (Vue in SSR scrive le classi in un ordine suo: "on rack-row")
const righeHtml = html => [...html.matchAll(/<button([^>]*)class="([^"]*)"([^>]*)>\s*<span class="rack-row__n"[^>]*>([^<]*)</g)]
	.filter(m => m[2].split(/\s+/).includes('rack-row'))
	.map(m => ({ n: m[4].trim(), on: m[2].split(/\s+/).includes('on'), title: ((m[1] + m[3]).match(/title="([^"]*)"/) || [])[1] }));
const righe = html => righeHtml(html).map(r => r.n);
const scelto = html => { const s = righeHtml(html).filter(r => r.on); return s.length === 1 ? s[0].n : s.length ? 'piu\' di uno' : null; };
const frecce = html => testi(html, 'tray-panel__navlbl');
const DODICI = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(String);
const FUORI = IT.common.out;

console.log('1) dall\'alto in basso: 12, 11, ..., 1');
{
	const html = await rendi(cassettiera([3, 9, 1, 12, 6, 4, 10, 2, 8, 11, 5, 7]));
	check(JSON.stringify(righe(html)) === JSON.stringify(DODICI), 'righe: ' + righe(html).join(', '));
}
{
	const html = await rendi(cassettiera([5, 1, 12, 9, 2, 11, 7, 3, 10, 8, 4, 6], { senzaPiano: true }));
	check(JSON.stringify(righe(html)) === JSON.stringify(DODICI.concat(FUORI)), 'con un cassetto senza piano: in fondo, sotto il piano 1 (' + righe(html).join(', ') + ')');
}
{
	const html = await rendi(cassettiera([12, 11, 9, 8, 5, 4, 2, 1]));
	check(righe(html).join(',') === '12,11,9,8,5,4,2,1', 'piani senza cassetto (10, 7, 6, 3): si saltano (' + righe(html).join(', ') + ')');
}

console.log('\n2) numero, scelta e frecce come prima');
{
	const t = cassettiera([3, 9, 1, 12, 6, 4, 10, 2, 8, 11, 5, 7]);
	const html = await rendi(t);
	check(scelto(html) === '1', 'nessun cassetto fuori: all\'apertura e\' scelto il piano piu\' basso, 1 (' + scelto(html) + ')');
	check(frecce(html).join(' | ') === 'Cassetto 2', '   frecce: precedente nessuno, successivo 2 (' + frecce(html).join(' | ') + ')');
}
{
	const html = await rendi(cassettiera([3, 9, 1, 12, 6, 4, 10, 2, 8, 11, 5, 7], { fuori: 8 }));
	check(scelto(html) === '8', 'cassetto 8 fuori: all\'apertura e\' scelto l\'8 (' + scelto(html) + ')');
	check(frecce(html).join(' | ') === 'Cassetto 7 | Cassetto 9', '   frecce: precedente 7, successivo 9 (' + frecce(html).join(' | ') + ')');
}
{
	const html = await rendi(cassettiera([3, 9, 1, 12, 6, 4, 10, 2, 8, 11, 5, 7]), 12);
	check(scelto(html) === '12' && frecce(html).join(' | ') === 'Cassetto 11', 'scelto il 12 (in alto): precedente 11, successivo nessuno (' + frecce(html).join(' | ') + ')');
}
{
	const html = await rendi(cassettiera([12, 11, 9, 8, 5, 4, 2, 1]), 11);
	check(scelto(html) === '11' && frecce(html).join(' | ') === 'Cassetto 9 | Cassetto 12', 'scelto l\'11 con il 10 mancante: precedente 9, successivo 12 (' + frecce(html).join(' | ') + ')');
}
{
	// il numero mostrato e' FLOOR_MAG, non l'ID (ID e piano qui non coincidono mai)
	const t = cassettiera([3, 9, 1, 12, 6, 4, 10, 2, 8, 11, 5, 7]);
	const html = await rendi(t);
	const titoli = righeHtml(html).map(r => r.title);
	const attesi = DODICI.map(f => IT.tray.dbId.replace('{id}', t.find(x => String(x.FLOOR_MAG) === f).ID));
	check(titoli.length === 12 && JSON.stringify(titoli) === JSON.stringify(attesi), 'ogni riga mostra il suo FLOOR_MAG e porta l\'ID del suo cassetto nel title');
}

console.log('\n3) in largo e in compatto: una lista, nessun riordino da CSS');
{
	const src = readFileSync('src/views/conf/TraysView.vue', 'utf8');
	const tpl = src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '');
	const liste = [...tpl.matchAll(/v-for="(\w+) in (\w+)"[^>]*class="rack-row"/g)];
	check(liste.length === 1 && liste[0][2] === 'pila', 'una sola lista di righe della cassettiera, su pila (' + liste.map(m => m[2]).join(', ') + ')');
	const css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
	const regole = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => /trays-rack|rack-row/.test(m[1]));
	const riordino = regole.filter(m => /(^|;|\s)order\s*:|-reverse|direction\s*:\s*rtl|grid-auto-flow\s*:[^;]*dense/.test(m[2]));
	check(regole.length > 0 && riordino.length === 0, 'nessuna regola (' + regole.length + ' su cassettiera e righe, largo e compatto) con order, *-reverse, rtl o dense' + (riordino.length ? ': ' + riordino.map(m => m[1].trim()).join(', ') : ''));
	const lista = regole.find(m => /^\s*\.trays-rack__list\s*$/.test(m[1]));
	check(!!lista && /flex-direction\s*:\s*column\s*;/.test(lista[2]), '.trays-rack__list e\' una colonna: la prima riga in alto');
	const altrove = ['src/assets/css/controls-v3.css', 'src/assets/css/catalog-v3.css', 'src/assets/css/tokens.css'].filter(f => { try { return /rack-row|trays-rack/.test(readFileSync(f, 'utf8')); } catch { return false; } });
	check(altrove.length === 0, 'nessun foglio di stile comune tocca la cassettiera (' + (altrove.join(', ') || 'nessuno') + ')');
}

await server.close();
console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
