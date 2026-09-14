// ============================================================================
// gratingGrid.js — generazione della griglia di un grigliato (MODELLO) in UN
// punto solo, condiviso da:
//   - Grating.vue        (anteprima del modello sulle misure della cassettiera)
//   - TraysView.vue      (dialog "Associa/Rigenera": griglia sul cassetto target)
//
// (grating-model) Il grigliato NON ha geometria persistita: GRATING porta solo
// pezzo, pinza, SAFEX e SAFEY. La griglia si RICALCOLA da pezzo + misure
// cassetto + distanze — per questo una rigenerazione perde la taratura per
// tasca: l'unica copia delle quote insegnate sta in [POSITION]. Da qui anche
// i due helper di confronto passi reali/teorici (taughtSteps/taughtMismatch)
// usati dall'avviso di taratura di "Rigenera tasche".
//
// FORMULA DICHIARATA (grating-pitch, invariata da Grating.vue):
//   passo X (centro-centro) = pezzo.x + SAFEX   ; passo Y = pezzo.y + SAFEY
//   area utile = width/height - 2*minBordo ; fencepost: n pezzi occupano
//   n*pezzo + (n-1)*distanza ; il residuo centra la griglia.
// Unita': mm. Ordine listPz = SUB_POS (loop esterno righe r, interno colonne c).
// ============================================================================

export const MIN_BORDER_MM = 20;     // bordo minimo dx/sx e sopra/sotto (Grating.vue minBordoX/Y)
export const TAUGHT_TOL_UM = 500;    // tolleranza passi reali vs teorici: 0.5 mm

// Minimi di sicurezza pinza-derivati (mm). prismatic: SAFEY minimo = solo
// spessore chela; cilindrico: corsa + spessore su entrambi.
export function gripperMinSafe(gripper, prismatic) {
	const stroke = Number(gripper && gripper.STROKE_CLAW) / 1000 || 0;
	const tick   = Number(gripper && gripper.TICKNESS_CLAW) / 1000 || 0;
	return { minSafeX: stroke + tick, minSafeY: prismatic ? tick : stroke + tick };
}

// Griglia del modello. Input mm: pieceX/pieceY (ingombro pezzo), prismatic,
// safeX/safeY (distanze), width/height (misure cassetto).
// Ritorna { n_cln, n_row, spaceNullX, spaceNullY, listPz, dim_x, dim_y, radius }
// con listPz = [{prisma, x, y, status:2}] in coordinate DISEGNO (x,y =
// spigolo del prisma / centro-equivalente del cilindro, come Grating.vue).
export function buildGrid({ pieceX, pieceY, prismatic, safeX, safeY, width, height, minBorderX = MIN_BORDER_MM, minBorderY = MIN_BORDER_MM }) {
	const x = Number(pieceX) || 0, y = Number(pieceY) || 0;
	const SAFEX = Number(safeX) || 0, SAFEY = Number(safeY) || 0;
	const W = Number(width) || 0, H = Number(height) || 0;
	const stepX = x + SAFEX;
	const stepY = y + SAFEY;
	const utilX = W - 2 * minBorderX;
	const utilY = H - 2 * minBorderY;
	const n_cln = (x > 0 && stepX > 0) ? Math.max(0, Math.floor((utilX + SAFEX) / stepX)) : 0;
	const n_row = (y > 0 && stepY > 0) ? Math.max(0, Math.floor((utilY + SAFEY) / stepY)) : 0;
	const spaceNullX = n_cln > 0 ? utilX - n_cln * x - (n_cln - 1) * SAFEX : utilX;
	const spaceNullY = n_row > 0 ? utilY - n_row * y - (n_row - 1) * SAFEY : utilY;
	const listPz = [];
	for (let r = 1; r <= n_row; r++) {
		for (let c = 1; c <= n_cln; c++) {
			if (prismatic) {
				listPz.push({ prisma: true, status: 2,
					x: -minBorderX + W + SAFEX - stepX * c - spaceNullX / 2,
					y: -minBorderY + H + SAFEY - stepY * r - spaceNullY / 2 });
			} else {
				// centro cerchio: spigolo prisma equivalente + pezzo/2
				listPz.push({ prisma: false, status: 2,
					x: -minBorderX + W + SAFEX - stepX * c + x / 2 - spaceNullX / 2,
					y: -minBorderY + H + SAFEY - stepY * r + y / 2 - spaceNullY / 2 });
			}
		}
	}
	return { n_cln, n_row, spaceNullX, spaceNullY, listPz,
		dim_x: prismatic ? x : 0, dim_y: prismatic ? y : 0, radius: prismatic ? 0 : x / 2 };
}

// Centri tasca in coordinate DISEGNO {w,h} (mm) nell'ordine SUB_POS — adapter
// unico per drawingToRobot/gridFit (util/gratingAxes.js). Per il prisma il
// centro e' spigolo + meta' ingombro; per il cilindro x,y sono gia' il centro.
export function gridCenters(listPz, { width, height, dim_x, dim_y }) {
	return (listPz || []).map(p => ({
		w: p.prisma ? width  - (p.x + dim_x / 2) : width  - p.x,
		h: p.prisma ? height - (p.y + dim_y / 2) : height - p.y,
	}));
}

// Passi REALI dalle righe [POSITION] di un cassetto (micron): SUB_POS
// consecutive avanzano sull'asse robot Y (passo lungo width), la prima riga
// con X diversa da' il passo lungo height (asse X). null se < 2 righe.
export function taughtSteps(rows) {
	const sorted = (rows || []).slice().sort((a, b) => a.SUB_POS - b.SUB_POS);
	if (sorted.length < 2) return null;
	const realW = Math.abs(Number(sorted[1].Y) - Number(sorted[0].Y));
	const colRow = sorted.find(p => Number(p.X) !== Number(sorted[0].X));
	const realH = colRow ? Math.abs(Number(colRow.X) - Number(sorted[0].X)) : 0;
	return { realW, realH };
}

// Avviso taratura: le tasche a DB (rows) hanno passi diversi da quelli che
// la rigenerazione produrrebbe (genW/genH micron, = pezzo+distanza)? Ritorna
// null se coincidono entro TOL o non ci sono abbastanza righe, altrimenti
// { realW, realH, genW, genH } in micron (per il messaggio a video).
export function taughtMismatch(rows, genW, genH, tol = TAUGHT_TOL_UM) {
	const real = taughtSteps(rows);
	if (!real) return null;
	const badW = Math.abs(real.realW - genW) > tol;
	const badH = real.realH > 0 && Math.abs(real.realH - genH) > tol;
	return (badW || badH) ? { realW: real.realW, realH: real.realH, genW, genH } : null;
}
