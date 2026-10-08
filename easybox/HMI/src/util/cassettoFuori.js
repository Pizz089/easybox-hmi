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

// (8/10, prompt 7) la pinza che il PLC tiene come lato 1 (Gripper_ID[1]).
// La fonte e' il registro del PLC: FROM_PLANT/GRIPPER/ROBOT, che il PLC
// pubblica col valore di Gripper_ID[1] a ogni aggiornamento della pinza a
// bordo (FB_Robot, updateGripperOnRobot) e che il pannello riceve come
// GRIPPER/REGISTERED (anche dalla cache del backend, GRIPPER/REQUEST_SNAPSHOT).
// Il database non lo dice: POS_PLANT = 1000 marca tutte e due le righe di una
// pinza doppia, e la gemella ha lo stesso SUB_POS.
// Registro non arrivato: con una riga sola a bordo il lato 1 e' quella (pinza
// singola, Gripper_ID[2] = 0); con due righe non si sa (null).
// (prompt 10) REGISTRO A 0. Il PLC pubblica 0 per la FLANGIA NUDA, ma qui lo
// 0 vale come «registro non arrivato» e si guardano le righe a bordo del
// database: senza righe il lato 1 non si sa (null), palletCambiaPinza lo conta
// come cambio e col cassetto fuori «Gestione pallet» resta spenta. E' la
// scelta prudente, e con la consegna 35 e' anche quella giusta. La regola vera
// del master 1010 (FB_Robot):
//   - consegna 34: cambio solo se GripperRequested <> Gripper_ID[1] AND
//     Gripper_ID[1] > 0; con la flangia nuda saltava al 1050 e lanciava il
//     prelievo del pallet senza pinza;
//   - consegna 35: ogni GripperRequested <> Gripper_ID[1] e' un cambio, anche
//     con la flangia nuda (carica la pinza, 1030); col cassetto fuori il 1010
//     lo rifiuta con 1519 prima di muovere.
export function pinzaLato1(registro, righeABordo) {
	const r = Number(registro);
	if (registro != null && r > 0) return r;
	const ids = (Array.isArray(righeABordo) ? righeABordo : [])
		.map(g => Number(g && g.ID)).filter(id => id > 0);
	return ids.length === 1 ? ids[0] : null;
}

// (8/10, prompt 7) la pinza richiesta dal pallet, letta senza badare alle
// maiuscole. Il pannello prende il pallet da `select * from PALLET`
// (serverDati/CONF/Pallet.js, /show/all): in JavaScript il campo ha il nome
// della colonna con le sue maiuscole, in SQL no. La grafia vera della colonna
// non e' nel repo (le viste scrivono pal.GripperREQ, il PLC GRIPPERREQ): se
// fosse GRIPPERREQ, pallet.GripperREQ sarebbe undefined e la guardia di
// «Gestione pallet» spenta senza avvisi. Un alias nella SELECT non va bene con
// `select *`: se la colonna si chiama gia' GripperREQ il driver mssql
// restituisce la colonna doppia come array.
export function pinzaRichiesta(pallet) {
	if (!pallet || typeof pallet !== 'object') return undefined;
	if (Object.prototype.hasOwnProperty.call(pallet, 'GripperREQ')) return pallet.GripperREQ;
	const k = Object.keys(pallet).find(c => c.toLowerCase() === 'gripperreq');
	return k === undefined ? undefined : pallet[k];
}

// (7/10 sera, simulazione bis B2) il pallet da caricare chiede un cambio
// pinza? Il PLC prende la pinza del pallet da PALLET.GripperREQ (vista
// pallets_grippers, FB_Robot Gripper4Pallet_Search) e la cambia quando
// GripperRequested <> Gripper_ID[1] (FB_Robot, master 1010): il confronto e'
// col SOLO lato 1, non con la gemella (8/10, prompt 7: prima il pannello
// contava anche la riga del lato 2 come «stessa pinza», e col cassetto fuori
// lasciava acceso un carico che comincia con un cambio pinza).
// lato1 = pinzaLato1(...). GripperREQ assente o 0: nessun cambio da dire (il
// PLC risponde 1722). Lato 1 non noto: si conta come cambio, perche' il PLC
// potrebbe farlo.
export function palletCambiaPinza(pallet, lato1) {
	const req = Number(pinzaRichiesta(pallet));
	if (!(req > 0)) return false;
	const l1 = Number(lato1);
	if (lato1 == null || !(l1 > 0)) return true;
	return req !== l1;
}
