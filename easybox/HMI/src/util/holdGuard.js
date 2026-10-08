// ============================================================================
// holdGuard.js — antirimbalzo del pulsante HOLD (verso definitivo 2.1, fase
// E1.3, 7/10)
//
// Nel PLC il 17 e' un interruttore (util/holdState.js): due tocchi
// ravvicinati rimettono in moto la cella. Dopo un tocco il pulsante resta
// disabilitato. Un'attesa sola per tutto il pannello: ovunque si mandi il 17
// si usa la stessa (sul v3 oggi lo manda solo la striscia).
//
// (8/10, prompt 7, S1) QUANDO SI RIACCENDE: al PIU' TARDI fra
//   «cambio di STATUS + RIARMO_DOPO_CAMBIO_MS» (1 s) e
//   «tocco + RIARMO_MIN_MS» (1,5 s).
// Prima si riaccendeva al primo cambio di STATUS: se il PLC rispondeva prima
// del secondo tocco di un doppio tocco, il pulsante era gia' «Riprendi» e il
// secondo 17 rimetteva in moto la cella (prova dell'audit con un PLC finto,
// due tocchi a 300 ms: eco a 100 e 200 ms -> due 17; eco a 400 ms -> uno).
// Un passaggio a uno stato ignoto o a NOT_DEFINED (0) non e' la risposta al
// 17 e non chiude l'attesa. Se in HOLD_CONFIRM_MS (5 s) STATUS non cambia:
// pulsante riacceso e avviso «HOLD non confermato dal PLC».
// Due tocchi da due dispositivi diversi (PC di cella e tablet) il pannello
// non li ferma: ogni pannello ha la sua attesa (LAVORI-IN-CODA, «Comandi
// espliciti di HOLD nel PLC»).
//
// Pura: lo stato da guardare e l'orologio arrivano da chi la crea; il
// pannello usa holdGuard, creata sullo store (plant.robot).
// ============================================================================
import { reactive } from 'vue';

export const HOLD_CONFIRM_MS = 5000;
export const RIARMO_MIN_MS = 1500;
export const RIARMO_DOPO_CAMBIO_MS = 1000;

// uno STATUS che vale come risposta al 17: noto e diverso da NOT_DEFINED
// (dataStored.status_notDef = 0, la stessa regola di util/holdState.js)
export function statoRisposta(v) {
	if (v === null || v === undefined || String(v).trim() === '') return false;
	const n = Number(v);
	return Number.isFinite(n) && n !== 0;
}

export function createHoldGuard({ stato, avvisa, ms = HOLD_CONFIRM_MS, minMs = RIARMO_MIN_MS, dopoCambioMs = RIARMO_DOPO_CAMBIO_MS, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
	const g = reactive({ attesa: false });
	let prima = null;
	let tMax = null, tMin = null, tDopo = null;
	let cambiato = false, minPassato = false, dopoPassato = false;
	const ferma = t => { if (t !== null) clearTimer(t); return null; };
	const fine = () => {
		g.attesa = false;
		prima = null;
		tMax = ferma(tMax); tMin = ferma(tMin); tDopo = ferma(tDopo);
		cambiato = minPassato = dopoPassato = false;
	};
	const forseFine = () => { if (g.attesa && cambiato && minPassato && dopoPassato) fine(); };
	// manda(): chi preme passa l'invio. false se c'era gia' un'attesa (il
	// secondo tocco non parte)
	g.premi = manda => {
		if (g.attesa) return false;
		prima = stato();
		g.attesa = true;
		manda();
		tMin = setTimer(() => { tMin = null; minPassato = true; forseFine(); }, minMs);
		tMax = setTimer(() => {
			tMax = null;
			if (!g.attesa || cambiato) return;
			// lo STATUS letto adesso e' gia' cambiato (evento perso): niente avviso
			const ora = stato();
			const confermato = statoRisposta(ora) && String(ora) !== String(prima);
			fine();
			if (!confermato && avvisa) avvisa();
		}, ms);
		return true;
	};
	// da chiamare quando arriva uno STATUS nuovo del robot: il primo cambio
	// valido ferma l'attesa dei 5 s e fa partire il secondo di riarmo
	g.stato = nuovo => {
		if (!g.attesa || cambiato || !statoRisposta(nuovo) || String(nuovo) === String(prima)) return;
		cambiato = true;
		tMax = ferma(tMax);
		tDopo = setTimer(() => { tDopo = null; dopoPassato = true; forseFine(); }, dopoCambioMs);
	};
	g.annulla = fine;
	return g;
}
