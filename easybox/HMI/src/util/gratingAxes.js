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
