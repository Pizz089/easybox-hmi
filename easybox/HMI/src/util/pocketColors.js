// ============================================================================
// util/pocketColors.js — colori degli stati tasca (UI-DESIGN-SYSTEM v2 §11)
//
// UNA sola tabella stato -> token, per il disegno (prisma.vue, cylinder.vue,
// dentro TrayPockets e Grigliato), la legenda (layoutView) e l'export SVG del
// grigliato. Le tabelle e i badge (productionTable, FixturesView,
// custom-fix.css) usano gli stessi token in CSS: test_pocket_colors.mjs
// controlla che per ogni stato sia lo stesso token dappertutto.
// Prima il disegno aveva RAW verde e WORKING azzurro, le tabelle il
// contrario; BLOCCATA (9) non aveva colore (usciva nera come "non definita")
// e la legenda la mostrava corallo.
//
// I valori stanno SOLO in design-tokens.css: qui ci sono i nomi.
// ============================================================================

// ordine = ordine della legenda
export const POCKET_STATES = [
	{ status: 2, key: 'empty',    label: 'status.empty',    token: '--pocket-empty' },
	{ status: 4, key: 'raw',      label: 'status.raw',      token: '--pocket-raw' },
	{ status: 3, key: 'working',  label: 'status.working',  token: '--pocket-working' },
	{ status: 5, key: 'finished', label: 'status.finished', token: '--pocket-finished' },
	{ status: 7, key: 'abort',    label: 'status.aborted',  token: '--pocket-abort' },
	{ status: 9, key: 'locked',   label: 'status.locked',   token: '--pocket-locked' },
	{ status: 0, key: 'undef',    label: 'status.notDef',   token: '--pocket-undef' },
];

const BY_STATUS = new Map(POCKET_STATES.map(s => [s.status, s]));

// Stati fuori tabella (es. 6 in pausa, che e' uno stato d'ordine) -> non
// definita, come faceva il disegno di prima (nero).
export function pocketState(status) {
	return BY_STATUS.get(Number(status)) || BY_STATUS.get(0);
}

// Stile SVG della sagoma (rect di prisma, circle di cylinder). Bordo nero
// sottile su vuota e in lavoro come prima; non definita: nero col suo bordo,
// cosi' si stacca dal vassoio scuro. exportMode (hideCenter: il disegno che
// diventa file) mette il bordo rosso al posto del nero, come prima.
export function pocketShapeStyle(status, exportMode = false) {
	const s = pocketState(status);
	let style = 'fill:var(' + s.token + ')';
	if (s.key === 'empty' || s.key === 'working') style += ';stroke:black;stroke-width:1';
	if (s.key === 'undef') style += ';stroke:var(--pocket-undef-border);stroke-width:1';
	if (exportMode) style = style.replace('stroke:black', 'stroke:red');
	return style;
}

// Numero della tasca (v3): --pocket-on, scuro, sulle tasche colorate;
// --text-secondary sulla vuota e sulla non definita, che sono scure. Il
// bianco della v1 su azzurro/ambra/verde restava sotto 2:1.
export function pocketLabelFill(status) {
	const k = pocketState(status).key;
	return k === 'empty' || k === 'undef' ? 'var(--text-secondary)' : 'var(--pocket-on)';
}

// Export (XMLSerializer): un var(--x) non vive fuori dal documento, nel
// file SVG/PDF il colore sparirebbe. Si risolve in esadecimale con i valori
// calcolati del documento. Un nome che non si risolve resta com'e'.
export function resolveCssVars(svgString, root = (typeof document !== 'undefined' ? document.documentElement : null)) {
	if (!root || typeof getComputedStyle !== 'function') return String(svgString);
	const cs = getComputedStyle(root);
	return String(svgString).replace(/var\((--[a-zA-Z0-9-]+)\)/g, (m, name) => {
		const v = cs.getPropertyValue(name).trim();
		return v || m;
	});
}
