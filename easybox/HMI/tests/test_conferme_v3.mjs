// ============================================================================
// tests/test_conferme_v3.mjs — colore delle conferme nei dialog (v3, 6/10)
//
// Regola di Dario: il pulsante che conferma nei dialog e' PRIMARIO (accento);
// il rosso pieno resta solo sui comandi PERICOLOSI; niente conferme grigie.
// Le conferme dei dialog di oggi hanno .pure-button-mission (in v3 il
// secondario neutro): dialogs.css le porta a primario, e a rosso nei dialog
// marcati .mission-dialog--danger. Qui si controlla che i dialog pericolosi
// siano marcati e che quelli normali no.
//
// Uso: node tests/test_conferme_v3.mjs   (dalla cartella easybox/HMI)
// ============================================================================
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('@vue/compiler-sfc');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// contenitore .mission-dialog che racchiude il pulsante con quell'handler
function contenitore(file, handler) {
	const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file });
	let trovato = null;
	const classi = n => ((n.props || []).find(p => p.type === 6 && p.name === 'class') || { value: { content: '' } }).value.content
		+ ' ' + (((n.props || []).find(p => p.type === 7 && p.name === 'bind' && p.arg && p.arg.content === 'class') || {}).exp || { content: '' }).content;
	const walk = (n, dlg) => {
		if (n.type !== 1) { (n.children || []).forEach(c => walk(c, dlg)); return; }
		const c = classi(n);
		const d = /(^|\s)mission-dialog(\s|$)/.test(c) ? c : dlg;
		const on = (n.props || []).find(p => p.type === 7 && p.name === 'on');
		if (n.tag === 'button' && on && on.exp && on.exp.content.includes(handler)) trovato = d;
		// (v3 fase B) UiConfirmDialog: rosso se tone="danger" (il default)
		const conf = (n.props || []).find(p => p.type === 7 && p.name === 'on' && p.arg && p.arg.content === 'confirm');
		if (n.tag === 'UiConfirmDialog' && conf && conf.exp && conf.exp.content.includes(handler)) {
			const tone = ((n.props || []).find(p => p.type === 6 && p.name === 'tone') || { value: { content: 'danger' } }).value.content;
			trovato = 'mission-dialog' + (tone === 'danger' ? ' mission-dialog--danger' : '');
		}
		(n.children || []).forEach(ch => walk(ch, d));
	};
	walk(descriptor.template.ast, null);
	return trovato;
}

console.log('1) dialog dei comandi pericolosi: conferma rossa');
const PERICOLOSI = [
	['src/views/unit/robotView.vue', 'confirmCritical()', 'reset (99) e riavvio del programma (18)'],
	['src/views/unit/robotView.vue', 'confirmClawOpen()', 'apertura chela: il pezzo puo\' cadere'],
	['src/views/unit/CNC1View.vue', 'confirmViceLock()', 'blocco morsa (11): si chiude, mani fuori'],
	['src/views/layoutView.vue', 'confirmTrayReset()', 'azzera stato cassetto: dichiara tutto grezzo'],
	['src/views/layoutView.vue', 'confirmTrayType()', 'dichiara contenuto: cambia il codice di tutte le tasche'],
	['src/views/layoutView.vue', 'confirmDiscard()', 'scarta le modifiche non salvate'],
	['src/views/productionView.vue', 'confirmReset()', 'azzera produzione'],
];
for (const [f, h, cosa] of PERICOLOSI) {
	const c = contenitore(f, h);
	check(c && /mission-dialog--danger/.test(c), cosa + ' (' + f.split('/').pop() + ')');
}
const assoc = contenitore('src/views/conf/TraysView.vue', 'confirmAssoc()');
check(assoc && /'mission-dialog--danger': assoc\.mode !== 'associate'/.test(assoc), 'grigliato: rosso per sostituisci / rigenera / dissocia, primario per associa');

console.log('\n2) gli altri dialog: conferma primaria, non rossa');
const NORMALI = [
	['src/views/unit/robotView.vue', 'confirmUnload()'], ['src/views/unit/robotView.vue', 'confirmPickPlace()'],
	['src/views/unit/robotView.vue', 'confirmDialog()'], ['src/views/unit/robotView.vue', 'confirmTestDialog()'],
	['src/views/conf/Fixture/Fixture.vue', 'confermaAllineamento()'], ['src/views/conf/WarehousesView.vue', 'confirmToggle()'],
	// (6/10) la conferma di "0 CASSETTIERA" (confirmTeach) non c'e' piu': comando eliminato
	['src/components/RelaunchDialog.vue', "confirm('replaced')"],
];
for (const [f, h] of NORMALI) {
	const c = contenitore(f, h);
	check(c !== null && !/mission-dialog--danger/.test(c), h + ' (' + f.split('/').pop() + ')');
}

console.log('\n3) regole CSS');
const css = readFileSync('src/assets/css/dialogs.css', 'utf8');
const regola = sel => (css.match(new RegExp(sel.replace(/[.()]/g, m => '\\' + m) + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
check(/background: var\(--accent\)/.test(regola('.mission-dialog .pure-button-mission:not(:disabled)')), 'conferma nei dialog = primario (accento), non piu\' il secondario grigio');
check(/background: var\(--color-critical\)/.test(regola('.mission-dialog--danger .pure-button-mission:not(:disabled)')), 'nei dialog pericolosi = rosso pieno');
check(css.indexOf('.mission-dialog--danger .pure-button-mission:not(:disabled)') > css.indexOf('.mission-dialog .pure-button-mission:not(:disabled)'), 'la regola rossa viene dopo (a parita\' di specificita\' vince)');
const ui = readFileSync('src/components/ui/UiConfirmDialog.vue', 'utf8');
check(/:variant="tone === 'danger' \? 'danger' : 'primary'"/.test(ui), 'UiConfirmDialog: rosso solo se pericoloso, altrimenti primario');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
