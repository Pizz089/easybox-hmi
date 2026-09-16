// ============================================================================
// gratingAxes.js — convenzione assi robot dei grigliati, in UN punto solo
// (condiviso da Grating.vue e ImportGrating.vue).
//
// CONVENZIONE (assi validati sul ferro l'1/9 su TRAY_9, ORIGINE corretta il
// 14/9 su TRAY_1 col pendant):
//   - Y robot corre lungo la WIDTH del disegno (lato lungo, TRAY.X), verso
//     POSITIVO, ed e' l'asse su cui avanza SUB_POS (loop interno):
//     passo = pezzo.X + SAFEX;
//   - X robot corre lungo la HEIGHT del disegno (lato corto, TRAY.Y), verso
//     positivo, ed e' l'asse delle colonne (loop esterno): passo = pezzo.Y + SAFEY;
//   - ORIGINE = angolo del cassetto: X = h, Y = w (con DIR = +1). La tasca 1
//     sta in (h1, w1) = (margine lato corto, margine lato lungo), le stesse
//     distanze dai bordi che mostrano anteprima e DXF.
// RISCONTRO 14/9 (TRAY_1, pezzo 100.6x100.6, SAFEX 20, SAFEY 10, 6 x 5):
//   tasca 1 disegno (w 108.5, h 83.8) -> robot (83.8, 108.5);
//   pendant in presa: X 84.0, Y 102.5 (con TRAY.X_CORR 0.2, Y_CORR -6.0).
// STORIA: fino al 14/9 la costante d'origine era (w1, -h1), ereditata dalla
// convenzione ANTERIORE all'1/9 (X lungo width, Y = -height) e tenuta "per
// non spostare la tasca 1 del TRAY_9": componenti scambiate rispetto agli
// incrementi e Y sempre negativa. Sul TRAY_9 (margini 50/65) non si vedeva
// perche' X_CORR/Y_CORR di piano (10/100) erano stati tarati sopra l'errore;
// su TRAY_1 (margini 108.5/83.8) il PLC mandava (118.5, 16.2) contro
// (84, 102.5) reali. Le correzioni di piano vanno ri-insegnate dopo il fix.
// ============================================================================

export const DIR_X = +1;   // X lungo height — VALIDATO sul robot (TRAY_9, 1/9)
export const DIR_Y = +1;   // Y lungo width  — VALIDATO sul robot (TRAY_9, 1/9)

// Quale dimensione del cassetto limita quale asse robot (discende dal
// mapping sopra): X robot corre lungo height (TRAY.Y), Y robot lungo width
// (TRAY.X). Riscontro dati: TRAY_9 estende 720000 su Y > TRAY.Y 610000 ma
// < TRAY.X 820000 — un check Y<->TRAY.Y avrebbe rifiutato il cassetto
// validato.
export const ROBOT_AXIS_ALONG = { width: 'Y', height: 'X' };

// centers = [{w, h}] in mm, coordinate DISEGNO del CENTRO tasca (w lungo
// width, h lungo height), nell'ordine SUB_POS. Ritorna [{X, Y}] in micron
// nel frame cassetto del robot: X lungo height, Y lungo width, origine
// l'angolo del cassetto (tasca 1 = (h1, w1), i suoi margini dai bordi).
// (origin-fix 14/9) scritta in forma "tasca 1 + incremento" per tenere i
// versi DIR in un punto solo; con DIR = +1 e' semplicemente X = h, Y = w.
export function drawingToRobot(centers) {
	if (!centers || centers.length === 0) return [];
	const w1 = centers[0].w, h1 = centers[0].h;
	return centers.map(c => ({
		X: Math.round((h1 + DIR_X * (c.h - h1)) * 1000),
		Y: Math.round((w1 + DIR_Y * (c.w - w1)) * 1000),
	}));
}

// INVERSA esatta di drawingToRobot: points = [{X, Y}] micron (righe
// [POSITION] di un cassetto) -> [{w, h}] mm in coordinate DISEGNO. Unico
// punto per chi deve DISEGNARE tasche lette dal DB (layoutView).
export function robotToDrawing(points) {
	if (!points || points.length === 0) return [];
	return points.map(p => ({
		h: (DIR_X * Number(p.X)) / 1000,
		w: (DIR_Y * Number(p.Y)) / 1000,
	}));
}

// Verifica ingombro griglia vs contorno cassetto, in coordinate DISEGNO (mm):
// e' l'unico spazio in cui il contorno e' la finestra fissa [0,width] x
// [0,height] — nello spazio robot l'origine e' la tasca 1 e le finestre
// dipendono da dove sta (Y parte negativa). Convenzione-indipendente: un
// cambio di versi/assi non puo' rompere il check. I CORR del teaching TRAY
// non entrano (offset additivo uguale per tutte le tasche nella vista
// 4Robot). halfW/halfH = mezzo ingombro tasca lungo width/height (0 se
// ignoto). Al limite esatto passa (>=/<=).
// Ritorna { ok, overW, overH } in mm: overW = sforo lungo width (asse robot
// ROBOT_AXIS_ALONG.width = Y), overH = lungo height (asse robot X).
export function gridFit(centers, { width, height, halfW, halfH }) {
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
}

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
export function pieceFitsPockets(pockets, { trayX, trayY, pieceX, pieceY }) {
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
}
