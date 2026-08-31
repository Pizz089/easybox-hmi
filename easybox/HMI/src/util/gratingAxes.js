// ============================================================================
// gratingAxes.js — convenzione assi robot dei grigliati, in UN punto solo
// (grating-axis-swap-2, 1/9 — condiviso da Grating.vue e ImportGrating.vue).
//
// CONVENZIONE VALIDATA SUL FERRO (TRAY_9, 91 tasche, riscontro DB cella 1/9:
// X = 13 valori da 50000 con passo +60000 lungo il lato LUNGO; Y = 7 valori
// da -65000 con passo -80000 lungo il lato corto, tutte negative):
//   - X robot corre lungo la WIDTH del disegno (lato lungo del cassetto),
//     verso POSITIVO: X = w;
//   - Y robot corre lungo la HEIGHT del disegno NEGATA (lo zero e' il bordo
//     del cassetto verso il robot, le quote scendono verso il fondo): Y = -h;
//   - numerazione SUB_POS colonna per colonna: il loop INTERNO del generatore
//     avanza lungo X robot, quello ESTERNO lungo Y robot (verso negativo);
//   - ORIGINE = tasca 1 (w1, -h1), che NON si muove: ingloba il teaching del
//     TRAY. La formula sotto e' scritta in forma origine+versi per renderlo
//     esplicito (DIR_X=+1, DIR_Y=-1 ==> X=w, Y=-h).
// STORIA: il fix(grating-axis-swap) del 23/7 (70a5262) aveva INVERTITO i
// ruoli (X lungo height, Y lungo width positivo) sulla base di numeri attesi,
// mai riscontrati sul ferro (DIR_X era marcato "ASSUNTO — validazione
// PENDENTE"): incidente TRAY_8 dell'1/9, griglia fuori cassetto di 110 mm.
// I dati DB di TRAY_9 (pre-23/7, validati in produzione) sono il canone.
// ============================================================================

export const DIR_X = +1;   // X lungo width — VALIDATO sul ferro (TRAY_9, 1/9)
export const DIR_Y = -1;   // Y lungo height NEGATA — VALIDATO sul ferro (TRAY_9, 1/9)

// centers = [{w, h}] in mm, coordinate DISEGNO del CENTRO tasca (w lungo
// width, h lungo height), nell'ordine SUB_POS. Ritorna [{X, Y}] in micron,
// origine = primo elemento (tasca 1).
export function drawingToRobot(centers) {
	if (!centers || centers.length === 0) return [];
	const w1 = centers[0].w, h1 = centers[0].h;
	return centers.map(c => ({
		X: Math.round((w1 + DIR_X * (c.w - w1)) * 1000),
		Y: Math.round((-h1 + DIR_Y * (c.h - h1)) * 1000),
	}));
}

// Verifica ingombro griglia vs contorno cassetto. Tutto in MICRON.
// robotPts = output di drawingToRobot (centri tasca); halfW/halfH = mezzo
// ingombro tasca lungo X/Y (0 se ignoto). Finestra nominale: X in [0, trayX],
// Y in [-trayY, 0]. I CORR del teaching TRAY NON entrano: nella vista
// COORDINATES_PIECES_TRAYS_4Robot sono un termine additivo UGUALE per tutte
// le tasche (spostano il cassetto nel frame robot, non la griglia dentro il
// contorno). Al limite esatto passa (>=/<=).
// Ritorna { ok, overX, overY } con gli sforamenti massimi per asse (micron).
export function gridFit(robotPts, { trayX, trayY, halfW, halfH }) {
	if (!robotPts || robotPts.length === 0) return { ok: true, overX: 0, overY: 0 };
	const hw = halfW || 0, hh = halfH || 0;
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	for (const p of robotPts) {
		if (p.X < minX) minX = p.X;
		if (p.X > maxX) maxX = p.X;
		if (p.Y < minY) minY = p.Y;
		if (p.Y > maxY) maxY = p.Y;
	}
	const overX = Math.max(0, (maxX + hw) - trayX, -(minX - hw));
	const overY = Math.max(0, (maxY + hh), -(minY - hh) - trayY);
	return { ok: overX === 0 && overY === 0, overX, overY };
}
