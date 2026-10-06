// ============================================================================
// trayZoom.js — tasche troppo piccole da toccare: vista ingrandita su una
// zona del cassetto (pannello v3, regola 4)
//
// PERCHE'. Il cassetto si disegna in scala (TrayPockets, viewBox + meet): su
// uno schermo 4:3 o con un grigliato fitto la tasca scende sotto i 44 px, e
// un dito non la prende senza prendere anche la vicina. Allora il primo
// tocco NON agisce sulla tasca: ingrandisce la zona intorno al punto
// toccato, abbastanza da portare il passo fra le tasche ad almeno TARGET px.
// Il tocco successivo, nella zona ingrandita, agisce sulla tasca.
//
// La zona ha le stesse proporzioni del cassetto: nella stessa cornice il
// disegno si ingrandisce di un fattore intero k, uniforme (nessuna
// deformazione). Funzioni pure, in mm del DISEGNO (w orizzontale, h
// verticale, come robotToDrawing): le usano TraysView e layoutView, le
// verifica tests/test_cassetto_scala.mjs.
// ============================================================================

export const MIN_TOUCH_PX = 44;   // sotto: il tocco ingrandisce invece di agire
// contorno del cassetto di prima (mm), quando TRAY.X / TRAY.Y non ci sono
export const TRAY_FALLBACK = { w: 820, h: 615 };
export const TARGET_PX = 56;      // passo minimo nella zona ingrandita

// Passo fra le tasche lungo un asse: la minima distanza fra due valori
// DISTINTI (centri a DB). Una sola fila su quell'asse: passo non definito (0).
export function pitchOf(values) {
	const u = Array.from(new Set((values || []).map(Number).filter(v => !isNaN(v)))).sort((a, b) => a - b);
	let m = Infinity;
	for (let i = 1; i < u.length; i++) if (u[i] - u[i - 1] > 1e-6 && u[i] - u[i - 1] < m) m = u[i] - u[i - 1];
	return m === Infinity ? 0 : Math.round(m * 1000) / 1000;
}

// Bersaglio di una tasca in px a disegno intero: il passo orizzontale (la
// cella che la tasca occupa), o la tasca stessa se c'e' una sola colonna.
export function targetPx({ pitchW, dimX }, pxPerMm) {
	const mm = pitchW > 0 ? pitchW : (dimX || 0);
	return mm * (pxPerMm || 0);
}

export function needsZoom(geom, pxPerMm, min = MIN_TOUCH_PX) {
	const px = targetPx(geom, pxPerMm);
	return px > 0 && px < min;
}

// Fattore intero che porta il bersaglio ad almeno TARGET px (minimo 2).
export function zoomFactor(geom, pxPerMm, target = TARGET_PX) {
	const px = targetPx(geom, pxPerMm);
	if (!(px > 0)) return 1;
	return Math.max(2, Math.ceil(target / px));
}

// Zona (mm disegno) di lato tray/k centrata su (w, h), tenuta dentro il
// cassetto. Ritorna { x, y, w, h, k }.
export function zoneAround(point, { trayW, trayH }, k) {
	const kk = Math.max(1, Number(k) || 1);
	const zw = trayW / kk, zh = trayH / kk;
	const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
	const x = clamp(Number(point.w) - zw / 2, 0, trayW - zw);
	const y = clamp(Number(point.h) - zh / 2, 0, trayH - zh);
	const r = v => Math.round(v * 1000) / 1000;
	return { x: r(x), y: r(y), w: r(zw), h: r(zh), k: kk };
}
