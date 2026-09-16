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

// (16/9) IL PEZZO DICHIARATO CI STA NELLE TASCHE?
//
// Prima questa domanda non esisteva: la griglia nasceva DAL pezzo, quindi il
// contenuto ci stava per costruzione. Adesso il codice si dichiara a
// posteriori — su un cassetto gia' generato, e anche a distanza di mesi —
// quindi qualcuno puo' dichiarare un particolare piu' grande
// dell'alloggiamento. Se passasse, il robot andrebbe a prendere un pezzo che
// invade la tasca accanto, o che sporge dal contorno del cassetto: ci
// sbatterebbe, e nessuno l'avrebbe guardato.
//
// Due misure, entrambe sui dati veri del cassetto (le tasche a DB), in
// coordinate ROBOT e micron:
//  - PASSO fra tasche adiacenti: l'ingombro non deve invadere la vicina.
//    ROBOT_AXIS_ALONG dice l'accoppiamento — lungo Y robot (largo del
//    cassetto) conta PIECE.X, lungo X robot conta PIECE.Y.
//  - CONTORNO: mezzo ingombro oltre la tasca piu' esterna deve restare
//    dentro TRAY.X / TRAY.Y, e non sotto zero (origine = angolo cassetto).
//
// Il franco SAFEX/SAFEY del modello NON viene richiesto qui: e' il margine
// che si vuole in generazione, non il minimo fisico. Qui si rifiuta la
// COLLISIONE, che e' un'altra soglia e piu' bassa.
//
// pockets = [{X, Y}] micron (coordinate robot, come stanno in [POSITION]).
// Ritorna { ok, overPitchX, overPitchY, overW, overH } in MICRON di sforo.
exports.pieceFitsPockets = function (pockets, { trayX, trayY, pieceX, pieceY }) {
	const zero = { ok: true, overPitchX: 0, overPitchY: 0, overW: 0, overH: 0 };
	if (!pockets || pockets.length === 0) return zero;
	const px = Number(pieceX) || 0, py = Number(pieceY) || 0;
	if (px <= 0 || py <= 0) return zero;          // misure assenti: non si inventa un rifiuto
	const xs = pockets.map(p => Number(p.X));
	const ys = pockets.map(p => Number(p.Y));
	// passo = minima distanza fra due valori DISTINTI sullo stesso asse: con
	// una sola fila su un asse il passo non esiste e non si vincola
	const passo = (v) => {
		const u = Array.from(new Set(v.filter(n => !isNaN(n)))).sort((a, b) => a - b);
		let m = Infinity;
		for (let i = 1; i < u.length; i++) if (u[i] - u[i - 1] < m) m = u[i] - u[i - 1];
		return m;
	};
	const passoX = passo(xs), passoY = passo(ys);
	const overPitchX = passoX === Infinity ? 0 : Math.max(0, py - passoX);
	const overPitchY = passoY === Infinity ? 0 : Math.max(0, px - passoY);
	const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
	const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
	const tx = Number(trayX) || 0, ty = Number(trayY) || 0;
	const overW = tx <= 0 ? 0 : Math.max(0, (maxY + px / 2) - tx, -(minY - px / 2));
	const overH = ty <= 0 ? 0 : Math.max(0, (maxX + py / 2) - ty, -(minX - py / 2));
	const r = (v) => Math.round(v);
	return {
		ok: overPitchX <= 0 && overPitchY <= 0 && overW <= 0 && overH <= 0,
		overPitchX: r(overPitchX), overPitchY: r(overPitchY), overW: r(overW), overH: r(overH),
	};
};

// (grating-thickness 14/9) protezione anti-urto: franco sopra lo spessore
// del grigliato, UN punto solo lato server (parita' con gratingGrid.js).
exports.GRATING_CLEARANCE_UM = 1000;

// Regola: con THICKNESS > 0, Z_PICK e Z_PLACE del pezzo (quote dal fondo,
// micron) devono essere >= THICKNESS + franco. NULL/0 = non misurato: nessun
// vincolo (comportamento invariato). Ritorna { ok, min, zPick, zPlace }.
exports.pickClearance = function ({ thickness, zPick, zPlace }) {
	const t = Number(thickness), zp = Number(zPick), zl = Number(zPlace);
	const min = (Number.isFinite(t) && t > 0) ? t + exports.GRATING_CLEARANCE_UM : 0;
	const ok = min === 0 || (zp >= min && zl >= min);
	return { ok, min, zPick: zp, zPlace: zl };
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
