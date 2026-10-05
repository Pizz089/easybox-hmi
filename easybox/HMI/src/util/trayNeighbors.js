// ============================================================================
// trayNeighbors.js — cassetto del piano precedente e successivo (P3 5/10)
//
// La pagina layout (/layout/:trayID/:modifyEnable/:floorMag) ha due frecce
// che portano al cassetto del piano sotto e del piano sopra. I piani senza
// cassetto si SALTANO; agli estremi non c'e' vicino (null) e la freccia si
// disabilita. L'elenco e' quello di api/conf/tray/show/all, lo stesso di
// TraysView: un cassetto "c'e'" se ha FLOOR_MAG > 0 (0 o assente = fuori).
//
// Funzione pura, senza Vue ne' rete: la usa layoutView e la verifica
// test_layout_nav.mjs.
// ============================================================================

// trays: righe di TRAYS ({ ID, FLOOR_MAG, ... }); currentFloor: piano attuale
// (numero o stringa del parametro di rotta). Ritorna { prev, next }, ciascuno
// { trayID, floor } oppure null.
export function neighborTrays(trays, currentFloor) {
	const cur = Number(currentFloor);
	const floors = new Map();
	for (const t of (trays || [])) {
		const f = Number(t && t.FLOOR_MAG);
		const id = Number(t && t.ID);
		if (!Number.isInteger(f) || f <= 0 || !Number.isInteger(id) || id <= 0) continue;
		if (!floors.has(f)) floors.set(f, id);   // due righe sullo stesso piano: vale la prima
	}
	let prev = null, next = null;
	for (const [floor, trayID] of floors) {
		if (floor < cur && (!prev || floor > prev.floor)) prev = { trayID, floor };
		if (floor > cur && (!next || floor < next.floor)) next = { trayID, floor };
	}
	return { prev, next };
}

// Stato delle tasche come stringa confrontabile: serve a sapere se ci sono
// modifiche locali non salvate (Tutti grezzi/vuoti, click sulle tasche).
export function pocketsSignature(list) {
	return (list || []).map(p => (p.SUB_POS != null ? p.SUB_POS : '') + ':' + p.status).join(',');
}
