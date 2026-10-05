// ============================================================================
// trayNeighbors.js — cassetto del piano precedente e successivo (P3 5/10)
//
// La pagina layout (/layout/:trayID/:modifyEnable/:floorMag) ha due frecce
// che portano al cassetto del piano sotto e del piano sopra. I piani senza
// cassetto si SALTANO; agli estremi non c'e' vicino (null) e la freccia si
// disabilita. L'elenco e' quello di api/conf/tray/show/all, lo stesso di
// TraysView: un cassetto "c'e'" se ha FLOOR_MAG > 0 (0 o assente = fuori).
//
// Funzioni pure, senza Vue ne' rete: le usano layoutView e TraysView e le
// verifica test_layout_nav.mjs.
// ============================================================================
import { dataStored } from '../data.js'

// (P3 audit 5/10) UNICA regola per "questo cassetto si apre in sola lettura":
// cassetto estratto (EXTRACT diverso da 0, anche in manovra) oppure STATUS
// working, locked o paused. La usano TraysView.goToLayout (click sul
// grigliato) e le frecce della pagina layout: una regola sola, cosi' le due
// strade non possono divergere. tray = riga di api/conf/tray/show/all.
export function trayOpensReadOnly(tray) {
	const t = tray || {};
	return !!(t.EXTRACT ||
		t.STATUS == dataStored.status_working ||
		t.STATUS == dataStored.status_locked ||
		t.STATUS == dataStored.status_paused);
}

// Modalita' della pagina di arrivo con le frecce: resta quella corrente, con
// un'eccezione decisa con Dario: in modifica, un cassetto che TraysView
// aprirebbe in sola lettura si apre in sola lettura (0). In sola lettura si
// resta in sola lettura.
export function layoutModeFor(currentMode, tray) {
	if (String(currentMode) === '1' && trayOpensReadOnly(tray)) return '0';
	return String(currentMode);
}

// trays: righe di TRAYS ({ ID, FLOOR_MAG, EXTRACT, STATUS, ... });
// currentFloor: piano attuale (numero o stringa del parametro di rotta).
// Ritorna { prev, next }, ciascuno { trayID, floor, tray } oppure null
// (tray = la riga, serve per decidere la modalita' di arrivo).
export function neighborTrays(trays, currentFloor) {
	const cur = Number(currentFloor);
	const floors = new Map();
	for (const t of (trays || [])) {
		const f = Number(t && t.FLOOR_MAG);
		const id = Number(t && t.ID);
		if (!Number.isInteger(f) || f <= 0 || !Number.isInteger(id) || id <= 0) continue;
		if (!floors.has(f)) floors.set(f, t);   // due righe sullo stesso piano: vale la prima
	}
	let prev = null, next = null;
	for (const [floor, tray] of floors) {
		const trayID = Number(tray.ID);
		if (floor < cur && (!prev || floor > prev.floor)) prev = { trayID, floor, tray };
		if (floor > cur && (!next || floor < next.floor)) next = { trayID, floor, tray };
	}
	return { prev, next };
}

// Stato delle tasche come stringa confrontabile: serve a sapere se ci sono
// modifiche locali non salvate (Tutti grezzi/vuoti, click sulle tasche).
export function pocketsSignature(list) {
	return (list || []).map(p => (p.SUB_POS != null ? p.SUB_POS : '') + ':' + p.status).join(',');
}
