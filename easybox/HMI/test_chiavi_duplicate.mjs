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
}

for (const p of problemi) console.log('       ' + p);
check(componenti > 50, 'letti ' + componenti + ' componenti con l\'oggetto di opzioni');
check(problemi.length === 0, 'nessuna chiave ripetuta fra computed, methods, data, props (e watch al suo interno)');

// controprova: il caso del 6/10 il test lo vede davvero
{
	const caso = 'export default { data() { return { a: 1 } }, computed: { x() { return 1 } }, methods: { m() {} }, computed: { y() { return 2 } } }';
	const o = opzioni(parseJs(caso, { sourceType: 'module', errorRecovery: true }));
	const n = o.properties.filter(p => nome(p.key) === 'computed').length;
	check(n === 2, 'controprova: due blocchi computed nello stesso oggetto si vedono (Vice.vue fino al 6/10)');
}

console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
