// ============================================================================
// test_listener_off.mjs — ascoltatori socket nominati e staccati (7/10 sera,
// simulazione bis B64)
//
// Un ascoltatore registrato con una funzione anonima non si puo' staccare:
// a ogni apertura della pagina se ne aggiunge uno, e i vecchi restano
// attaccati a una view smontata (fanno fetch, scrivono dati, rallentano).
// Per i punti della simulazione bis: robotView (ROBOT/DESCR,
// ROBOT/UPDATEGRIPPER, ROBOT/CHANGESPEED), TraysView (BOX/STATUS),
// dispatch.vue (DISPATCH), e il primo setInterval di CNC1View.
//
// Per ogni evento: on con un handler NOMINATO in mounted, e off SPECIFICO
// (evento + lo stesso handler) in unmounted. Sul testo, senza commenti.
//
// Uso:   node test_listener_off.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
import { readFileSync } from 'node:fs';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const codice = f => readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
const blocco = (src, nome) => {
	const i = src.search(new RegExp('\\n\\s*' + nome + '\\s*\\(\\)\\s*\\{'));
	if (i < 0) return '';
	let d = 0, j = src.indexOf('{', i);
	for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } }
	return '';
};
const quote = s => s.replace(/[/]/g, '\\/');

const casi = [
	['src/views/unit/robotView.vue', [['ROBOT/DESCR', 'robotDescrHandler'], ['ROBOT/UPDATEGRIPPER', 'robotUpdateGripperHandler'], ['ROBOT/CHANGESPEED', 'robotChangeSpeedHandler']]],
	['src/views/conf/TraysView.vue', [['BOX/STATUS', 'boxStatusHandler']]],
	['src/components/dispatch.vue', [['DISPATCH', 'dispatchHandler']]],
];
for (const [file, eventi] of casi) {
	const src = codice(file);
	const mnt = blocco(src, 'mounted'), unm = blocco(src, 'unmounted');
	for (const [ev, h] of eventi) {
		const on = new RegExp("socket\\.on\\(['\"]" + quote(ev) + "['\"],\\s*this\\." + h + '\\)');
		const off = new RegExp("socket\\.off\\(['\"]" + quote(ev) + "['\"],\\s*this\\." + h + '\\)');
		const anonimo = new RegExp("socket\\.on\\(['\"]" + quote(ev) + "['\"],\\s*(\\(|[a-zA-Z_]+\\s*=>|function)");
		check(on.test(mnt) && off.test(unm) && !anonimo.test(src), file.split('/').pop() + ': ' + ev + ' con this.' + h + ', off specifico in unmounted, nessun handler anonimo');
	}
}
const cnc = codice('src/views/unit/CNC1View.vue');
const mntC = blocco(cnc, 'mounted'), unmC = blocco(cnc, 'unmounted');
const intervalli = (mntC.match(/setInterval\(/g) || []).length;
const salvati = (mntC.match(/this\.[a-zA-Z]+ = setInterval\(/g) || []).length;
check(intervalli === salvati && intervalli === 2 && /clearInterval\(this\.gripperTimer\)/.test(unmC) && /clearInterval\(this\.pollTimer\)/.test(unmC), 'CNC1View: i due setInterval salvati e cancellati in unmounted');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
