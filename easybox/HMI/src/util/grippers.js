// ============================================================================
// grippers.js — CONVENZIONE PINZA A DOPPIA PRESA (ufficiale dall'1/9,
// validata sul ferro dal PLC).
//
// Una pinza doppia e' DUE righe gemelle in GRIPPER con lo STESSO SUB_POS
// (> 0, < 1000) e lo stesso POS_MAG (in cella: ID 26 e 37, SUB_POS 3,
// POS_MAG 3). SUB_POS > 1000 identifica i GANCI (_Gripper_Hook_Search),
// quindi le gemelle stanno fra 1 e 1000. Il PLC trova la gemella con
//   SUB_POS>0 and SUB_POS in (select SUB_POS from GRIPPER where ID=<g>)
// La riga con ID MINORE e' la pinza CANONICA: e' quella che si mostra negli
// elenchi e che va scritta in ordini (WORKORDERS.GRIPPER_ID) e grigliati
// (GRATING.GRIPPER_ID). Il modello legacy "lato 1 = SUB_POS <= 1, lato 2 =
// SUB_POS 2, ID composito ID*1000+subID" e' SUPERATO.
//
// Dove le gemelle restano DISTINTE (non passare da qui): righe onRobot
// (dataGripper[0]/[1] = lati a bordo, stato pezzo per lato), dialog
// "Reimposta stato cella" e dialog di collaudo (anagrafica completa voluta).
// ============================================================================

// rows = righe GRIPPERS (qualsiasi ordine). Ritorna una voce per pinza
// fisica: chiave (POS_MAG, SUB_POS) solo su slot reali (POS_MAG > 0) — due
// pinze diverse fuori magazzino (POS_MAG <= 0) non vengono mai fuse. Per
// ogni voce: la riga canonica (ID minore) + onBoard (una gemella a bordo
// basta) + twinIDs (tutti gli ID fusi, canonico incluso, crescenti).
export function dedupeGrippers(rows) {
	const out = [];
	const byKey = new Map();
	for (const r of rows || []) {
		const item = Object.assign({}, r, { onBoard: r.POS_PLANT == 1000, twinIDs: [Number(r.ID)] });
		const key = r.POS_MAG > 0 ? r.POS_MAG + '|' + r.SUB_POS : null;
		if (key === null || !byKey.has(key)) {
			if (key !== null) byKey.set(key, out.length);
			out.push(item);
			continue;
		}
		const idx = byKey.get(key);
		const cur = out[idx];
		const twinIDs = cur.twinIDs.concat(item.twinIDs).sort((a, b) => a - b);
		const keep = Number(item.ID) < Number(cur.ID) ? item : cur;
		out[idx] = Object.assign({}, keep, { onBoard: cur.onBoard || item.onBoard, twinIDs });
	}
	return out;
}

// true se la voce (output di dedupeGrippers) rappresenta una pinza doppia
export function isTwinGripper(item) {
	return !!(item && item.twinIDs && item.twinIDs.length > 1);
}
