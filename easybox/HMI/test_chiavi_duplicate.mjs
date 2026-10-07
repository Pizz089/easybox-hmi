// ============================================================================
// test_chiavi_duplicate.mjs — nessun componente con la stessa chiave due volte
// fra computed, methods, data (e watch).
//
// Il 6/10 in views/conf/Vice/Vice.vue c'erano DUE blocchi "computed:": in un
// oggetto letterale vince l'ultimo, il primo sparisce senza errori ne'
// avvisi. clawLengthMicron era undefined dal 15/9 e la sezione «Appoggi
// dichiarati» non compariva mai. Qui si legge ogni .vue (e .js) di src con il
// parser di Vue/Babel e si cerca:
//   1. un blocco di opzioni ripetuto (computed, methods, data, watch, props);
//   2. una chiave ripetuta dentro lo stesso blocco;
//   3. la stessa chiave in due blocchi fra data, props, computed e methods:
//      Vue ne tiene una sola e l'altra e' morta.
// watch e' controllato solo al suo interno: una chiave di watch che coincide
// con una di data o computed e' il modo normale di osservarla, non un doppio.
//   4. (6/10 sera) una chiamata this.nome() a un metodo che il componente non
//      ha: Vice.vue chiamava this.updatePreviewFromModel(), MAI esistito, il
//      catch mangiava l'eccezione e gli appoggi non si caricavano. Valgono
//      come definiti methods, computed, props, inject, le chiavi di data() e
//      di setup(), e i nomi assegnati con this.nome = ...; i commenti non
//      contano (si legge l'AST). Le eccezioni stanno in CHIAMATE_AMMESSE, col
//      motivo.
//
// Uso:   node test_chiavi_duplicate.mjs
// ============================================================================
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { parse as parseJs } from '@babel/parser';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const SRC = new URL('./src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
function files(dir) {
	const out = [];
	for (const n of readdirSync(dir)) {
		const p = join(dir, n);
		if (statSync(p).isDirectory()) out.push(...files(p));
		else if (/\.(vue|js)$/.test(n)) out.push(p);
	}
	return out;
}

const nome = k => k.type === 'Identifier' ? k.name : k.type === 'StringLiteral' ? k.value : null;
const chiavi = obj => (obj && obj.type === 'ObjectExpression' ? obj.properties : [])
	.filter(p => (p.type === 'ObjectProperty' || p.type === 'ObjectMethod') && !p.computed)
	.map(p => ({ k: nome(p.key), line: p.loc.start.line }))
	.filter(x => x.k !== null);

// le chiavi di data(): l'oggetto restituito dalla funzione
function chiaviData(prop) {
	const corpo = prop.type === 'ObjectMethod' ? prop.body : prop.value && prop.value.body;
	if (!corpo) return [];
	if (corpo.type === 'ObjectExpression') return chiavi(corpo);
	const ret = (corpo.body || []).filter(s => s.type === 'ReturnStatement').pop();
	return ret ? chiavi(ret.argument) : [];
}
function chiaviProps(prop) {
	const v = prop.value;
	if (v && v.type === 'ArrayExpression') return v.elements.filter(e => e && e.type === 'StringLiteral').map(e => ({ k: e.value, line: e.loc.start.line }));
	return chiavi(v);
}

// il primo oggetto di opzioni: export default { ... } o defineComponent({ ... })
function opzioni(ast) {
	for (const s of ast.program.body) {
		if (s.type !== 'ExportDefaultDeclaration') continue;
		let d = s.declaration;
		if (d.type === 'CallExpression' && d.arguments[0]) d = d.arguments[0];
		if (d.type === 'ObjectExpression') return d;
	}
	return null;
}

const BLOCCHI = ['data', 'props', 'computed', 'methods', 'watch'];
const problemi = [];
let componenti = 0;

// (4) chiamate this.nome() e assegnazioni this.nome = ..., dall'AST
function visita(n, fn) {
	if (!n || typeof n.type !== 'string') return;
	fn(n);
	for (const k of Object.keys(n)) {
		if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments') continue;
		const v = n[k];
		if (Array.isArray(v)) v.forEach(x => visita(x, fn));
		else if (v && typeof v.type === 'string') visita(v, fn);
	}
}
const suThis = m => m && (m.type === 'MemberExpression' || m.type === 'OptionalMemberExpression') && m.object.type === 'ThisExpression' && !m.computed && m.property.type === 'Identifier';
// eccezioni dichiarate: pagina e nome, col motivo
const CHIAMATE_AMMESSE = [
	{ file: 'views/conf/Grating/GratingTest.vue', nome: 'calculateCylinder',
		motivo: 'pagina di prova senza rotta, tenuta apposta (router: "rotta /conf/Gratingtest RIMOSSA"); la definizione e\' commentata. Dal pannello non ci si arriva' },
];
const chiamateMancanti = [];
for (const f of files(SRC)) {
	const testo = readFileSync(f, 'utf8');
	let script = testo, scarto = 0;
	if (f.endsWith('.vue')) {
		const { descriptor } = parseSfc(testo, { filename: f });
		if (!descriptor.script) continue;            // solo <script setup>, o niente
		script = descriptor.script.content;
		scarto = descriptor.script.loc.start.line - 1;  // righe del file, non dello script
	} else if (!/export default\s*(\{|defineComponent\()/.test(testo)) continue;
	let ast;
	try { ast = parseJs(script, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true, startLine: scarto + 1 }); }
	catch (e) { problemi.push(relative(SRC, f) + ': non si legge (' + e.message + ')'); continue; }
	const o = opzioni(ast);
	if (!o) continue;
	componenti++;
	const dove = relative(SRC, f).replace(/\\/g, '/');
	const visti = {};
	const perBlocco = {};
	for (const p of o.properties) {
		const b = p.key && nome(p.key);
		if (!BLOCCHI.includes(b)) continue;
		if (visti[b]) problemi.push(`${dove}: blocco "${b}" ripetuto (righe ${visti[b]} e ${p.loc.start.line}): vince l'ultimo`);
		visti[b] = p.loc.start.line;
		const ks = b === 'data' ? chiaviData(p) : b === 'props' ? chiaviProps(p) : chiavi(p.value);
		(perBlocco[b] = perBlocco[b] || []).push(...ks);
	}
	for (const [b, ks] of Object.entries(perBlocco)) {
		const prima = {};
		for (const { k, line } of ks) {
			if (prima[k]) problemi.push(`${dove}: "${k}" due volte in ${b} (righe ${prima[k]} e ${line})`);
			else prima[k] = line;
		}
	}
	const dove1 = {};
	for (const b of ['data', 'props', 'computed', 'methods']) {
		for (const { k, line } of perBlocco[b] || []) {
			if (dove1[k] && dove1[k].b !== b) problemi.push(`${dove}: "${k}" sia in ${dove1[k].b} (riga ${dove1[k].line}) sia in ${b} (riga ${line})`);
			else if (!dove1[k]) dove1[k] = { b, line };
		}
	}
	// (4) chiamate a metodi che non esistono
	const definiti = new Set(Object.keys(dove1));
	for (const p of o.properties) {
		const b = p.key && nome(p.key);
		if (b === 'inject') (p.value.type === 'ArrayExpression' ? p.value.elements.filter(e => e && e.type === 'StringLiteral').map(e => e.value) : chiavi(p.value).map(x => x.k)).forEach(k => definiti.add(k));
		if (b === 'setup') chiaviData(p).forEach(x => definiti.add(x.k));
	}
	const chiamate = [];
	visita(ast.program, n => {
		if (n.type === 'AssignmentExpression' && suThis(n.left)) definiti.add(n.left.property.name);
		if ((n.type === 'CallExpression' || n.type === 'OptionalCallExpression') && suThis(n.callee)) chiamate.push({ k: n.callee.property.name, line: n.loc.start.line });
	});
	for (const { k, line } of chiamate) {
		// $t, $router, $emit, $nextTick...: proprieta' dell'istanza Vue
		if (k.startsWith('$') || definiti.has(k) || CHIAMATE_AMMESSE.some(a => a.file === dove && a.nome === k)) continue;
		chiamateMancanti.push(`${dove}: this.${k}() alla riga ${line}, ma il componente non ha "${k}"`);
	}
}

for (const p of problemi) console.log('       ' + p);
// soglia di sanita': il parser legge davvero i componenti. Su ui-lifting
// sono 75; sul pannello v3 meno (molte pagine in <script setup>, e la fase
// D-bis ha tolto la shell vecchia): 50 il 6/10.
check(componenti >= 30, 'letti ' + componenti + ' componenti con l\'oggetto di opzioni');
check(problemi.length === 0, 'nessuna chiave ripetuta fra computed, methods, data, props (e watch al suo interno)');
for (const p of chiamateMancanti) console.log('       ' + p);
check(chiamateMancanti.length === 0, 'nessuna chiamata this.nome() a un metodo che il componente non ha'
	+ (CHIAMATE_AMMESSE.length ? ' (eccezioni dichiarate: ' + CHIAMATE_AMMESSE.map(a => a.file.split('/').pop() + ' ' + a.nome).join(', ') + ')' : ''));

// controprova: il caso del 6/10 il test lo vede davvero
{
	const caso = 'export default { data() { return { a: 1 } }, computed: { x() { return 1 } }, methods: { m() {} }, computed: { y() { return 2 } } }';
	const o = opzioni(parseJs(caso, { sourceType: 'module', errorRecovery: true }));
	const n = o.properties.filter(p => nome(p.key) === 'computed').length;
	check(n === 2, 'controprova: due blocchi computed nello stesso oggetto si vedono (Vice.vue fino al 6/10)');
}
// controprova della (4): una chiamata a un metodo assente si vede, una
// commentata no, una a un nome assegnato a runtime no
{
	const caso = 'export default { methods: { a() { this.b(); /* this.c(); */ this.d = () => 1; this.d(); } } }';
	const ast = parseJs(caso, { sourceType: 'module', errorRecovery: true });
	const viste = [];
	visita(ast.program, n => { if (n.type === 'CallExpression' && suThis(n.callee)) viste.push(n.callee.property.name); });
	check(viste.join() === 'b,d', 'controprova: si vedono this.b() e this.d(), non la chiamata nel commento (' + viste.join() + ')');
}

console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
