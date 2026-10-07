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

// (7/10) le righe GEMELLE della pinza id (stessa pinza fisica, id escluso),
// con la stessa regola di dedupeGrippers. Serve a scrivere su tutte e due le
// righe un dato della pinza fisica, come l'uncino per i cassetti (HAS_HOOK).
// Una pinza semplice non ha gemelle: [].
export function twinRowsOf(rows, id) {
	const voce = dedupeGrippers(rows).find(v => v.twinIDs.includes(Number(id)));
	if (!voce) return [];
	return (rows || []).filter(r => voce.twinIDs.includes(Number(r.ID)) && Number(r.ID) !== Number(id));
}

// (7/10) HAS_HOOK come arriva dalla vista GRIPPERS (bit -> true/false, o
// 1/0): true, false, oppure null se la vista non lo espone ancora (script
// gripper-has-hook.sql non lanciato) e quindi non si sa.
export function hasHook(row) {
	if (!row || row.HAS_HOOK === undefined || row.HAS_HOOK === null) return null;
	return row.HAS_HOOK === true || Number(row.HAS_HOOK) === 1;
}

// (7/10, consegna 34) nel ciclo automatico la pinza a bordo all'estrazione
// del cassetto e' quella dell'ordine e non si cambia: senza uncino il PLC si
// ferma con 19005. Produzione lo dice prima, come AVVISO (non blocca), quando
// si crea o si avvia l'ordine. rows = righe GRIPPERS, gripperId =
// WORKORDERS.GRIPPER_ID. Ritorna la chiave del testo, oppure '' se la pinza
// ha l'uncino o non si sa (vista senza HAS_HOOK, pinza non trovata).
export function avvisoUncinoOrdine(rows, gripperId) {
	const r = (rows || []).find(x => Number(x.ID) === Number(gripperId));
	return r && hasHook(r) === false ? 'production.noHookWarning' : '';
}
