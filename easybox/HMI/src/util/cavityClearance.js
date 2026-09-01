// ============================================================================
// cavityClearance.js — franco delle cavita' nei SOLI file di fabbricazione
// (DXF, SVG modello / stampa / download del grigliato).
//
// CAVITY_CLEARANCE_UM e' il TOTALE aggiunto alla MISURA della cavita' su
// ciascun asse, ripartito simmetricamente rispetto al centro: 50 um per lato
// (la cavita' fresata deve accogliere il grezzo nominale con gioco).
// Il centro di ogni cavita' NON si muove. Il franco NON entra da nessun'altra
// parte: passo, coordinate robot in [POSITION], quote a schermo e anteprima
// del layout restano sul NOMINALE del grezzo (unico punto: questo modulo).
// ============================================================================

export const CAVITY_CLEARANCE_UM = 100;
export const CAVITY_CLEARANCE_MM = CAVITY_CLEARANCE_UM / 1000;   // 0.1 mm totali
const HALF_MM = CAVITY_CLEARANCE_MM / 2;                        // 0.05 mm per lato

// Rettangolo (mm, spigolo x/y + lati w/h) -> cavita' con franco, centro invariato
export function cavityRect(x, y, w, h) {
	return {
		x: Number(x) - HALF_MM,
		y: Number(y) - HALF_MM,
		w: Number(w) + CAVITY_CLEARANCE_MM,
		h: Number(h) + CAVITY_CLEARANCE_MM,
	};
}

// Raggio (mm) -> raggio della cavita' con franco (diametro + totale)
export function cavityRadius(r) {
	return Number(r) + HALF_MM;
}

// Post-processing dell'SVG SERIALIZZATO dall'anteprima (#trayLayout): allarga
// le sole sagome tasca — il <rect> principale di ogni <g id="prisma_obj">
// (escluso l'alone diffOrder lightcyan) e il <circle> maggiore di ogni
// <g id="cylinder_obj"> (escluso il marker di centro r=4). Il DOM a schermo
// non viene toccato: si lavora sulla stringa che va nel file.
const NUM = v => String(Math.round(Number(v) * 1e6) / 1e6);
const ATTR = (tag, name) => {
	const m = tag.match(new RegExp('\\s' + name + '="([^"]*)"'));
	return m ? m[1] : null;
};
const SET_ATTR = (tag, name, value) => tag.replace(new RegExp('(\\s' + name + '=")[^"]*(")'), '$1' + value + '$2');

export function applyCavityClearanceToSvg(svgString) {
	let out = String(svgString);
	out = out.replace(/<g id="prisma_obj"[^>]*>[\s\S]*?<\/g>/g, group =>
		group.replace(/<rect\b[^>]*\/?>/g, tag => {
			if (/lightcyan/.test(tag)) return tag;
			const c = cavityRect(ATTR(tag, 'x'), ATTR(tag, 'y'), ATTR(tag, 'width'), ATTR(tag, 'height'));
			let t = SET_ATTR(tag, 'x', NUM(c.x));
			t = SET_ATTR(t, 'y', NUM(c.y));
			t = SET_ATTR(t, 'width', NUM(c.w));
			return SET_ATTR(t, 'height', NUM(c.h));
		})
	);
	out = out.replace(/<g id="cylinder_obj"[^>]*>[\s\S]*?<\/g>/g, group => {
		const circles = group.match(/<circle\b[^>]*\/?>/g) || [];
		if (circles.length === 0) return group;
		const main = circles.reduce((a, b) => (Number(ATTR(b, 'r')) > Number(ATTR(a, 'r')) ? b : a));
		return group.replace(main, SET_ATTR(main, 'r', NUM(cavityRadius(ATTR(main, 'r')))));
	});
	return out;
}
