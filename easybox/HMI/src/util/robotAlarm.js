// ============================================================================
// robotAlarm.js — il riquadro globale degli allarmi robot (PLC/ALARM/ROBOT)
//
// Il riquadro e' uno solo e mostra l'ultimo codice arrivato, con la chiave
// i18n robot.alarm_<codice>. Dalla consegna 35 (7/10) il PLC, quando rifiuta
// un comando di missione perche' c'e' un errore attivo, pubblica sullo stesso
// topic prima 972 e subito dopo, nello stesso ciclo, il codice dell'errore
// attivo (FB_Robot, REGION Manager CMD from HMI). Da soli, a video restava il
// secondo, senza dire che il comando era stato rifiutato.
//
// Qui: un 972 seguito entro ALARM_PAIR_MS da un altro codice diventa un
// avviso unico, «Comando rifiutato: c'e' un errore attivo, <codice> <testo>.
// Premi RESET e ripeti il comando.» (robot.alarm972Code). Un 972 senza
// seguito, e ogni altro codice, restano come prima.
//
// Un punto solo: l'handler lo usano StandardMenu.vue (ui-lifting) e
// layout/plantGlobals.js (ui-v3). Pura: niente dataStored importato, t/te
// e l'orologio arrivano dal chiamante (test: test_alarm_972.mjs).
// ============================================================================

export const ALARM_REJECT_ACTIVE = 972;
export const ALARM_PAIR_MS = 1000;

// payload -> desc del riquadro: la chiave robot.alarm_<payload>, come prima,
// oppure il testo gia' tradotto dell'avviso unico 972 + codice
export function robotAlarmCombiner({ t, te, now = () => Date.now(), finestraMs = ALARM_PAIR_MS } = {}) {
	let ultimo972 = null;
	return payload => {
		const testo = String(payload).trim();
		const code = /^\d+$/.test(testo) ? parseInt(testo, 10) : NaN;
		const ora = now();
		if (code === ALARM_REJECT_ACTIVE) {
			ultimo972 = ora;
			return 'robot.alarm_' + payload;
		}
		const coppia = ultimo972 !== null && ora - ultimo972 <= finestraMs && Number.isInteger(code) && code > 0;
		ultimo972 = null;
		if (!coppia) return 'robot.alarm_' + payload;
		const chiave = 'robot.alarm_' + code;
		const descrizione = te && te(chiave) ? String(t(chiave)).trim().replace(/[.\s]+$/, '') : '';
		return t('robot.alarm972Code', { errore: descrizione ? code + ' ' + descrizione : String(code) });
	};
}

// l'handler di PLC/ALARM/ROBOT: scrive il riquadro globale (store = dataStored)
export function makePlcAlarmRobotHandler(store, opzioni) {
	const desc = robotAlarmCombiner(opzioni);
	return payload => {
		store.alert.title = 'PLC_Error';
		store.alert.desc = desc(payload);
		store.alert.type = 'warning';
	};
}
