// ============================================================================
// gratingAxes.js — convenzione assi robot dei grigliati, in UN punto solo
// (condiviso da Grating.vue e ImportGrating.vue).
//
// CONVENZIONE VALIDATA SUL ROBOT (1/9, TRAY_9 corretto a DB, tasche 1 e 2
// verificate fisicamente; pezzo 40x70, SAFEX 20, SAFEY 10, 13 x 7 = 91):
//   SUB_POS  1 -> X  50000  Y  -65000      (origine = tasca 1)
//   SUB_POS  2 -> X  50000  Y   -5000      (+60000 su Y = pezzo.X + SAFEX)
//   SUB_POS 13 -> X  50000  Y  655000
//   SUB_POS 14 -> X 130000  Y  -65000      (+80000 su X = pezzo.Y + SAFEY)
//   SUB_POS 91 -> X 530000  Y  655000
// Quindi:
//   - Y robot corre lungo la WIDTH del disegno (lato lungo, TRAY.X), verso
//     POSITIVO, ed e' l'asse su cui avanza SUB_POS (loop interno);
//   - X robot corre lungo la HEIGHT del disegno (lato corto, TRAY.Y), verso
//     positivo, ed e' l'asse delle colonne (loop esterno);
//   - ORIGINE = tasca 1 (w1, -h1), che NON si muove: ingloba il teaching.
//     X = w1 + DIR_X*(h - h1),  Y = -h1 + DIR_Y*(w - w1),  DIR_X = DIR_Y = +1.
// STORIA: e8ad81d (1/9 mattina) aveva riprodotto le VECCHIE righe di TRAY_9
// (X lungo width, Y = -height) credendole validate: la prova fisica le ha
// smentite e il DB e' stato corretto. Questa e' la convenzione del 23/7
// (70a5262), ora confermata sul ferro.
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
// width, h lungo height), nell'ordine SUB_POS. Ritorna [{X, Y}] in micron,
// origine = primo elemento (tasca 1).
export function drawingToRobot(centers) {
	if (!centers || centers.length === 0) return [];
	const w1 = centers[0].w, h1 = centers[0].h;
	return centers.map(c => ({
		X: Math.round((w1 + DIR_X * (c.h - h1)) * 1000),
		Y: Math.round((-h1 + DIR_Y * (c.w - w1)) * 1000),
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
