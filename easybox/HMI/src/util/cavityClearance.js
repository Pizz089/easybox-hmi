// ============================================================================
// cavityClearance.js — franco delle cavita' nei SOLI file di fabbricazione
// (DXF, SVG modello / stampa / download del grigliato).
//
// CAVITY_CLEARANCE_UM e' il DEFAULT del TOTALE aggiunto alla MISURA della
// cavita' su ciascun asse, ripartito simmetricamente rispetto al centro:
// 50 um per lato (la cavita' fresata deve accogliere il grezzo nominale con
// gioco). Il centro di ogni cavita' NON si muove.
// (1/9, richiesta cliente) il valore e' MODIFICABILE all'atto dell'export
// (grezzi storti = piu' gioco): le funzioni lo ricevono come parametro
// `clearanceUm` con default alla costante; niente persistenza, a ogni
// apertura della pagina torna il default. Range 0..CAVITY_CLEARANCE_MAX_UM
// (0 = nessun franco). L'operatore ragiona in mm con un decimale, il codice
// in micron: la conversione sta SOLO qui (clearanceMmToUm / clearanceUmToMm).
// Il franco NON entra da nessun'altra parte: passo, coordinate robot in
// [POSITION], quote a schermo e anteprima restano sul NOMINALE del grezzo.
// ============================================================================

export const CAVITY_CLEARANCE_UM = 100;        // default: 0.1 mm totali
export const CAVITY_CLEARANCE_MAX_UM = 2000;   // 2.0 mm totali

// mm (un decimale) -> micron interi, multipli di 100 (es. 0.1 -> 100)
export function clearanceMmToUm(mm) {
	// campo vuoto NON e' zero: Number('') darebbe 0 = "nessun franco" per sbaglio
	if (mm === null || mm === undefined || String(mm).trim() === '') return NaN;
	const n = Number(mm);
	if (!Number.isFinite(n)) return NaN;
	return Math.round(Math.round(n * 10) / 10 * 1000);
}

// micron -> mm con un decimale (es. 100 -> 0.1)
export function clearanceUmToMm(um) {
	return Math.round(Number(um) / 100) / 10;
}

// valido = intero, 0 <= um <= max (0 = nessun franco)
export function isValidClearanceUm(um) {
	return Number.isInteger(um) && um >= 0 && um <= CAVITY_CLEARANCE_MAX_UM;
}

const halfMm = clearanceUm => clearanceUm / 1000 / 2;

// Rettangolo (mm, spigolo x/y + lati w/h) -> cavita' con franco, centro invariato
export function cavityRect(x, y, w, h, clearanceUm = CAVITY_CLEARANCE_UM) {
	const half = halfMm(clearanceUm);
	return {
		x: Number(x) - half,
		y: Number(y) - half,
		w: Number(w) + 2 * half,
		h: Number(h) + 2 * half,
	};
}

// Raggio (mm) -> raggio della cavita' con franco (diametro + totale)
export function cavityRadius(r, clearanceUm = CAVITY_CLEARANCE_UM) {
	return Number(r) + halfMm(clearanceUm);
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

export function applyCavityClearanceToSvg(svgString, clearanceUm = CAVITY_CLEARANCE_UM) {
	let out = String(svgString);
	out = out.replace(/<g id="prisma_obj"[^>]*>[\s\S]*?<\/g>/g, group =>
		group.replace(/<rect\b[^>]*\/?>/g, tag => {
			if (/lightcyan/.test(tag)) return tag;
			const c = cavityRect(ATTR(tag, 'x'), ATTR(tag, 'y'), ATTR(tag, 'width'), ATTR(tag, 'height'), clearanceUm);
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
		return group.replace(main, SET_ATTR(main, 'r', NUM(cavityRadius(ATTR(main, 'r'), clearanceUm))));
	});
	return out;
}
