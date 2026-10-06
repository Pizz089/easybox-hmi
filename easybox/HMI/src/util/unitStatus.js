// ============================================================================
// util/unitStatus.js — codice di [UNIT].STATUS -> nome, testo e tono (v3)
//
// Una mappatura sola per la striscia di stato, le card Stato dei Controlli e
// le tile della Home: lo stesso codice si legge allo stesso modo ovunque.
// Costanti dei codici in data.js. I testi stanno in strip.st.*.
// ============================================================================
import { dataStored } from '../data.js';

export function statusName(code) {
	const S = dataStored;
	if (code === null || code === undefined || String(code).trim() === '') return 'unknown';
	switch (Number(code)) {
		case S.status_hold: return 'hold';
		case S.status_alarm: return 'alarm';
		case S.status_off: return 'off';
		case S.status_working: return 'working';
		case S.status_auto: return 'auto';
		case S.status_remote: return 'remote';
		case S.status_local: return 'local';
		case S.status_manual: return 'manual';
		case S.status_notDef: return 'notDef';
		default: return 'other';
	}
}

// codici senza nome (es. MC1 = 2): "normale", come le tile della Dashboard
// di prima (units.vue getStatusDesc -> "normal")
export const statusKey = code => 'strip.st.' + (statusName(code) === 'other' ? 'normal' : statusName(code));

const TONI = { hold: 'warning', alarm: 'danger', working: 'accent', auto: 'success', remote: 'success', local: 'success', manual: 'info' };
export const statusTone = code => TONI[statusName(code)] || 'muted';
