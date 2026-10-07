// ============================================================================
// cassettoFuori.js — c'e' un cassetto fuori? (7/10, consegna 34)
//
// Decisione di Dario del 7/10: con un cassetto aperto niente deposito ne'
// prelievo di pinze dallo scaffale (rischio d'urto). Dalla consegna 34 il PLC
// rifiuta 1419 il carico (11) e 1519 il deposito (12), nelle catene pinza. Il
// cambio pinza (27, swap) non passa dalle catene: lo copre la consegna 35
// (7/10 sera), non la 34 come si era scritto qui; dalla 35 anche i master
// pallet. Il pannello spegne prima i comandi pinza, cambio compreso, con la
// ragione scritta, cosi' l'operatore non ci arriva.
//
// Il dato e' quello che il pannello ha gia' per il cassetto estratto, dalla
// vista dei cassetti (api/conf/tray/show/all), con le stesse regole della
// pagina Robot:
//   estratto = la riga con EXTRACT = 1 (fuori, confermato dal PLC) fra i
//              cassetti fisici 1..12;
//   manovra  = una riga con EXTRACT 1000 / 2000 (estrazione o rilascio in
//              corso): anche li' il PLC conta il cassetto come fuori.
// ============================================================================

export function statoCassetti(trays) {
	const righe = Array.isArray(trays) ? trays : [];
	return {
		estratto: righe.find(t => t.EXTRACT == 1 && t.FLOOR_MAG >= 1 && t.FLOOR_MAG <= 12) || null,
		manovra: righe.some(t => t.EXTRACT == 1000 || t.EXTRACT == 2000),
	};
}

// Il motivo per cui i comandi pinza (carica, scarica, cambio) sono spenti,
// '' se il cassetto non c'entra.
export function motivoPinzaCassetto(stato) {
	if (stato && stato.estratto) return 'robot.hint.trayOutGripper';
	if (stato && stato.manovra) return 'robot.hint.trayBusy';
	return '';
}

// (7/10 sera, simulazione bis B2) il pallet da caricare chiede un cambio
// pinza? Il PLC prende la pinza del pallet da PALLET.GripperREQ (vista
// pallets_grippers, FB_Robot Gripper4Pallet_Search): se non e' quella a bordo,
// il carico comincia con un cambio pinza, che col cassetto fuori e' vietato.
// pinzeABordo = gli ID delle righe della pinza a bordo (la doppia ne ha due).
// GripperREQ assente o 0: nessun cambio da dire (il PLC risponde 1722).
export function palletCambiaPinza(pallet, pinzeABordo) {
	const req = Number(pallet && pallet.GripperREQ);
	if (!(req > 0)) return false;
	return !(pinzeABordo || []).some(id => Number(id) === req);
}
