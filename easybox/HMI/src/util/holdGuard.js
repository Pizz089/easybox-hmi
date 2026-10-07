// ============================================================================
// holdGuard.js — antirimbalzo del pulsante HOLD (verso definitivo 2.1, fase
// E1.3, 7/10)
//
// Nel PLC il 17 e' un interruttore (util/holdState.js): due tocchi
// ravvicinati rimettono in moto la cella. Dopo un tocco il pulsante resta
// disabilitato finche' STATUS del robot non cambia, o al massimo
// HOLD_CONFIRM_MS. Se in quel tempo STATUS non cambia, avviso «HOLD non
// confermato dal PLC». Un'attesa sola per tutto il pannello: ovunque si
// mandi il 17 si usa la stessa (sul v3 oggi lo manda solo la striscia).
//
// Pura: lo stato da guardare e l'orologio arrivano da chi la crea; il
// pannello usa holdGuard, creata sullo store (plant.robot).
// ============================================================================
import { reactive } from 'vue';

export const HOLD_CONFIRM_MS = 5000;

export function createHoldGuard({ stato, avvisa, ms = HOLD_CONFIRM_MS, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
	const g = reactive({ attesa: false });
	let prima = null;
	let timer = null;
	const fine = () => { g.attesa = false; prima = null; if (timer !== null) { clearTimer(timer); timer = null; } };
	// manda(): chi preme passa l'invio. false se c'era gia' un'attesa (il
	// secondo tocco non parte)
	g.premi = manda => {
		if (g.attesa) return false;
		prima = stato();
		g.attesa = true;
		manda();
		timer = setTimer(() => {
			timer = null;
			if (!g.attesa) return;
			const confermato = String(stato()) !== String(prima);
			fine();
			if (!confermato && avvisa) avvisa();
		}, ms);
		return true;
	};
	// da chiamare quando arriva uno STATUS nuovo del robot
	g.stato = nuovo => {
		if (g.attesa && String(nuovo) !== String(prima)) fine();
	};
	g.annulla = fine;
	return g;
}
