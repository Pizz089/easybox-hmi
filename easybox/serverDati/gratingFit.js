"use strict";
// ============================================================================
// gratingFit.js — replica CommonJS (lato server) di HMI/src/util/gratingAxes.js
// per la GENERAZIONE dall'header di associateGrating (CONF/Tray.js).
//
// PERCHE' esiste: i centri tasca li calcola il client, ma la griglia la
// SCRIVE il server, e un client con dati vecchi in cache (misure cassetto
// cambiate) potrebbe mandare una griglia che fisicamente non ci sta: il
// robot ci andrebbe sopra. Quindi il server RIPETE il check di ingombro
// contro TRAY.X/TRAY.Y e PIECE.X/PIECE.Y letti dal DB (mai dal payload) e
// converte lui i centri in coordinate robot (origine = tasca 1).
//
// Le formule DEVONO restare identiche a gratingAxes.js: lo garantisce
// test_grating_fit_parity.js (importa entrambe e confronta).
// ============================================================================

const DIR_X = +1;   // X robot lungo height (TRAY.Y) — validato sul robot (TRAY_9, 1/9)
const DIR_Y = +1;   // Y robot lungo width  (TRAY.X)

// centers = [{w, h}] mm (coordinate DISEGNO del centro tasca, ordine SUB_POS)
// -> [{X, Y}] micron nel frame cassetto: X lungo height, Y lungo width,
// origine = angolo del cassetto (tasca 1 = (h1, w1), i suoi margini).
// (origin-fix 14/9) prima la costante era (w1, -h1): componenti scambiate e
// Y negativa, ereditate dalla convenzione pre-1/9. Verificato sul pendant
// su TRAY_1: (83.8, 108.5) calcolati vs (84.0, 102.5) reali con X_CORR 0.2
// e Y_CORR -6.0. Stessa formula di gratingAxes.js (test di parita').
exports.drawingToRobot = function (centers) {
	if (!centers || centers.length === 0) return [];
	const w1 = centers[0].w, h1 = centers[0].h;
	return centers.map(c => ({
		X: Math.round((h1 + DIR_X * (c.h - h1)) * 1000),
		Y: Math.round((w1 + DIR_Y * (c.w - w1)) * 1000),
	}));
};

// Ingombro griglia vs contorno [0,width] x [0,height] (mm). halfW/halfH =
// mezzo ingombro tasca. Ritorna { ok, overW, overH } (mm di sforo).
exports.gridFit = function (centers, { width, height, halfW, halfH }) {
	if (!centers || centers.length === 0) return { ok: true, overW: 0, overH: 0 };
	const hw = halfW || 0, hh = halfH || 0;
	let minW = Infinity, maxW = -Infinity, minH = Infinity, maxH = -Infinity;
	for (const c of centers) {
		if (c.w < minW) minW = c.w;
		if (c.w > maxW) maxW = c.w;
		if (c.h < minH) minH = c.h;
		if (c.h > maxH) maxH = c.h;
	}
	const r6 = v => Math.round(v * 1e6) / 1e6;
	const overW = r6(Math.max(0, (maxW + hw) - width, -(minW - hw)));
	const overH = r6(Math.max(0, (maxH + hh) - height, -(minH - hh)));
	return { ok: overW === 0 && overH === 0, overW, overH };
};

// Validazione strutturale del payload centers: array 1..500 di {w,h} numeri
// finiti. Ritorna l'array normalizzato (Number) o null.
exports.parseCenters = function (centers) {
	if (!Array.isArray(centers) || centers.length < 1 || centers.length > 500) return null;
	const out = [];
	for (const c of centers) {
		const w = Number(c && c.w), h = Number(c && c.h);
		if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
		out.push({ w, h });
	}
	return out;
};
