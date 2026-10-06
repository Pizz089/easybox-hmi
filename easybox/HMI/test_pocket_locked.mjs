// ============================================================================
// test_pocket_locked.mjs — tasca BLOCCATA (9) nel disegno del cassetto
//
// Nel disegno (prisma.vue, cylinder.vue) la tasca BLOCCATA usciva nera come
// la "non definita" (0): l'operatore non distingueva una tasca bloccata da
// una di cui il sistema non sa niente. Ogni stato ha il suo colore, e quello
// di BLOCCATA e' diverso da quello di NON DEFINITA e da tutti gli altri.
// Carica i VERI componenti via Vite e ne legge lo stile per stato.
//
// Uso:   node test_pocket_locked.mjs     (dalla cartella easybox/HMI)
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const STATI = { 0: 'non definita', 2: 'vuota', 3: 'in lavoro', 4: 'grezzo', 5: 'finito', 7: 'scarto', 9: 'bloccata' };
const riempimento = st => ((String(st).match(/fill:\s*([^;]+)/) || [])[1] || '').trim();

for (const nome of ['prisma', 'cylinder']) {
	console.log('\n' + nome + '.vue');
	const comp = (await server.ssrLoadModule('/src/components/layout/' + nome + '.vue')).default;
	const g = (comp.computed && comp.computed.getStyle) || (comp.methods && comp.methods.getStyle);
	const stile = status => {
		const vm = { status, hideCenter: false, diffOrder: false };
		return typeof g === 'function' ? g.call(vm) : g.get.call(vm);
	};
	const fill = {};
	for (const s of Object.keys(STATI)) fill[s] = riempimento(stile(Number(s)));
	check(!!fill[9] && fill[9] !== fill[0], 'bloccata (' + fill[9] + ') diversa da non definita (' + fill[0] + ')');
	check(!/^black$/i.test(fill[9]), 'bloccata non e\' nera');
	const altri = Object.keys(STATI).filter(s => s !== '9' && fill[s] === fill[9]);
	check(altri.length === 0, 'nessun altro stato ha il colore della bloccata' + (altri.length ? ': ' + altri.map(s => STATI[s]).join(', ') : ''));
}

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
