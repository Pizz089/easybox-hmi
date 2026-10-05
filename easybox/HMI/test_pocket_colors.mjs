// ============================================================================
// test_pocket_colors.mjs — colori degli stati tasca (UI-DESIGN-SYSTEM v2 §11).
// Lo STESSO stato ha lo STESSO colore nel disegno (prisma/cylinder, dentro
// TrayPockets e Grigliato), nella legenda (layoutView) e nelle tabelle/badge
// (productionTable, FixturesView, VicesView, custom-fix.css). Prima il disegno
// aveva RAW verde e WORKING azzurro, le tabelle il contrario; BLOCCATA usciva
// nera nel disegno e corallo nella legenda.
// Export del grigliato: i var(--...) diventano esadecimali.
//
// Uso:   node test_pocket_colors.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const pc = await server.ssrLoadModule('/src/util/pocketColors.js');
const prisma = (await server.ssrLoadModule('/src/components/layout/prisma.vue')).default;
const cylinder = (await server.ssrLoadModule('/src/components/layout/cylinder.vue')).default;
const read = p => readFileSync(p, 'utf8');
// markup vivo: senza i commenti HTML (righe commentate e note di storia)
const live = p => read(p).replace(/<!--[\s\S]*?-->/g, '');
const tokens = read('src/assets/css/design-tokens.css');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// decisione 4 di Dario (REPORT §4.6), doc §11
const ATTESI = {
	2: ['empty', '--pocket-empty'], 4: ['raw', '--pocket-raw'], 3: ['working', '--pocket-working'],
	5: ['finished', '--pocket-finished'], 7: ['abort', '--pocket-abort'], 9: ['locked', '--pocket-locked'],
	0: ['undef', '--pocket-undef'],
};

console.log('1) una tabella sola, coi valori decisi');
check(pc.POCKET_STATES.length === 7, 'sette stati in tabella');
for (const [st, [key, tok]] of Object.entries(ATTESI)) {
	const s = pc.pocketState(Number(st));
	check(s.key === key && s.token === tok, `stato ${st} -> ${key} ${tok}`);
	check(new RegExp('\\n\\s*' + tok + ':').test(tokens), `${tok} definito in design-tokens.css`);
}
const val = name => (tokens.match(new RegExp('\\n\\s*' + name + ':\\s*([^;]+);')) || [])[1];
check(val('--pocket-raw') === 'var(--color-info)' && val('--pocket-working') === 'var(--color-warning)'
	&& val('--pocket-finished') === 'var(--color-success)' && val('--pocket-abort') === 'var(--color-danger)',
	'grezzo = info, in lavoro = warning, finito = success, scarto = danger');
check(val('--pocket-locked') && val('--pocket-locked') !== val('--color-warning') && !/color-warning/.test(val('--pocket-locked')),
	'bloccata ha un suo arancio, distinto dall\'ambra');
check(pc.pocketState(6).key === 'undef' && pc.pocketState(undefined).key === 'undef', 'stati fuori tabella (6 in pausa) -> non definita, come prima');

console.log('\n2) disegno: prisma e cylinder prendono il colore dalla tabella');
for (const [st, [, tok]] of Object.entries(ATTESI)) {
	const p = prisma.computed.getStyle.call({ status: Number(st), hideCenter: false });
	const c = cylinder.computed.getStyle.call({ status: Number(st), diffOrder: false });
	check(p.includes('fill:var(' + tok + ')') && c.includes('fill:var(' + tok + ')'), `stato ${st}: prisma e cylinder fill:var(${tok})`);
}
const vecchi = /green|#080866|lightblue|#ff0000ab|fill:lightgray|fill:black/;
check(!vecchi.test(live('src/components/layout/prisma.vue')) && !vecchi.test(live('src/components/layout/cylinder.vue')), 'nessun colore di stato scritto a mano nei due componenti');
check(/style='fill:lightcyan'/.test(read('src/components/layout/prisma.vue')), 'alone cambio-ordine ancora lightcyan (lo riconosce cavityClearance.js)');
check(pc.pocketShapeStyle(2, true).includes('stroke:red') && !pc.pocketShapeStyle(2, false).includes('stroke:red'), 'export (hideCenter): bordo rosso al posto del nero, come prima');
check(prisma.computed.getStyle.call({ status: 3, hideCenter: 'false' }).includes('stroke:red'), 'hideCenter="false" stringa (Grating.vue) resta vera, come prima');
const tp = live('src/components/layout/TrayPockets.vue');
check(!/#ff9800/i.test(tp), 'cornice di selezione non piu\' arancio (si confondeva con BLOCCATA)');

console.log('\n3) legenda: tutti gli stati, dalla stessa tabella');
const lv = read('src/views/layoutView.vue');
const leg = lv.slice(lv.indexOf('class="pocket-legend"'), lv.indexOf('</div>', lv.indexOf('class="pocket-legend"')));
check(/import \{ POCKET_STATES \} from '\.\.\/util\/pocketColors\.js'/.test(lv) && /v-for="s in POCKET_STATES"/.test(leg), 'la legenda cicla POCKET_STATES');
check(/'var\(' \+ s\.token \+ '\)'/.test(leg) && /\$t\(s\.label\)/.test(leg), 'colore = token dello stato, testo = etichetta i18n dello stato');
check(!/fill:|#[0-9a-f]{3,6}\b|coral|green|lightgray/i.test(leg), 'nessun colore scritto a mano nella legenda');
check(pc.POCKET_STATES.some(s => s.key === 'locked') && pc.POCKET_STATES.some(s => s.key === 'working'), 'BLOCCATA e IN LAVORO in legenda');

console.log('\n4) tabelle e badge: stesso token per lo stesso stato');
// blocco CSS il cui selettore nomina la classe di stato
const tokenFor = (css, cls) => {
	const re = new RegExp('[^{}]*\\.' + cls + '\\b[^{}]*\\{([^}]*)\\}', 'g');
	const found = new Set();
	for (const m of css.matchAll(re)) for (const t of m[1].matchAll(/var\((--pocket-[a-z-]+)\)/g)) if (!t[1].endsWith('-border')) found.add(t[1]);
	return [...found];
};
const DESC = { RAW: '--pocket-raw', WORKING: '--pocket-working', FINISHED: '--pocket-finished', ABORT: '--pocket-abort' };
const sorgenti = {
	productionTable: read('src/components/productionTable.vue'),
	FixturesView: read('src/views/conf/FixturesView.vue'),
	VicesView: read('src/views/conf/VicesView.vue'),
};
for (const [nome, css] of Object.entries(sorgenti))
	for (const [cls, tok] of Object.entries(DESC)) {
		const t = tokenFor(css, cls);
		check(t.length === 1 && t[0] === tok, `${nome} .${cls} -> ${tok} (trovato: ${t.join(',') || 'niente'})`);
	}
for (const nome of ['FixturesView', 'VicesView']) {
	check(tokenFor(sorgenti[nome], 'EMPTY')[0] === '--pocket-empty', `${nome} .EMPTY -> --pocket-empty (non piu' l'azzurro del grezzo)`);
	check(tokenFor(sorgenti[nome], 'LOCKED')[0] === '--pocket-locked', `${nome} .LOCKED -> --pocket-locked`);
}
const cf = read('src/assets/css/custom-fix.css');
check(/td\.RAW:not\(\.table-divisor\)::before \{\s*background: var\(--pocket-raw\)/.test(cf)
	&& /td\.WORKING:not\(\.table-divisor\)::before \{\s*background: var\(--pocket-working\)/.test(cf), 'custom-fix: barretta RAW azzurra, WORKING ambra');
// stesso token = stesso colore anche fra disegno e tabelle
for (const [cls, tok] of Object.entries(DESC)) {
	const st = pc.POCKET_STATES.find(s => s.token === tok);
	check(st && prisma.computed.getStyle.call({ status: st.status, hideCenter: false }).includes(tok), `${cls}: tabella e disegno usano ${tok}`);
}

console.log('\n5) export del grigliato: var() risolti in esadecimale');
const finto = { '--pocket-raw': ' #60A5FA', '--pocket-empty': '#6B7889' };
globalThis.getComputedStyle = () => ({ getPropertyValue: n => finto[n] || '' });
const svg = '<rect style="fill:var(--pocket-raw)"/><rect style="fill:var(--pocket-empty);stroke:red"/><rect style="fill:var(--sconosciuto)"/><rect style="fill:lightcyan"/>';
const out = pc.resolveCssVars(svg, {});
check(out.includes('fill:#60A5FA') && out.includes('fill:#6B7889;stroke:red'), 'i token noti diventano esadecimali');
check(out.includes('var(--sconosciuto)') && out.includes('fill:lightcyan'), 'il resto non si tocca (lightcyan compreso)');
const gr = read('src/views/conf/Grating/Grating.vue');
const serial = gr.match(/serializeToString\(/g) || [];
const risolti = gr.match(/resolveCssVars\(serializer\.serializeToString\(/g) || [];
check(serial.length === 3 && risolti.length === 3, 'Grating.vue: tutti e 3 gli export (download, stampa, modello) passano da resolveCssVars');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
