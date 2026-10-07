// ============================================================================
// robotAlarm.js — il riquadro globale degli allarmi (PLC/ALARM/ROBOT e
// ALARM/MC1)
//
// Il riquadro e' uno solo e mostra l'ultimo codice arrivato, con la chiave
// i18n robot.alarm_<codice>. Un punto solo: gli handler li usano
// StandardMenu.vue (ui-lifting) e layout/plantGlobals.js (ui-v3). Pura:
// niente dataStored importato, t/te e l'orologio arrivano dal chiamante
// (test: test_alarm_972.mjs).
//
// 972 SEGUITO DAL CODICE (consegna 35, 7/10). Quando il PLC rifiuta un
// comando di missione per un errore attivo pubblica sullo stesso topic prima
// 972 e subito dopo, nello stesso ciclo, il codice dell'errore attivo
// (FB_Robot, REGION Manager CMD from HMI). Da soli, a video restava il
// secondo, senza dire che il comando era stato rifiutato. Un 972 seguito
// entro ALARM_PAIR_MS da un altro codice diventa un avviso unico, «Comando
// rifiutato: c'e' un errore attivo, <codice> <testo>. Premi RESET e ripeti
// il comando.» (robot.alarm972Code). Un 972 senza seguito resta com'e'.
//
// (7/10 sera, simulazione bis)
//   B60  il codice passa da parseInt prima di comporre la chiave: "+900001"
//        e " 18 " diventano 900001 e 18 (prima robot.alarm_+900001, grezza);
//   B61  il 99 pubblicato su ALARM/BOX (numero di cassetto fuori intervallo)
//        ha un testo suo, robot.alarmBox_99: robot.alarm_99 e' "ALLARME
//        GENERICO" del robot. Il backend manda ALARM/BOX e subito dopo lo
//        stesso codice su PLC/ALARM/ROBOT: l'handler box se lo segna;
//   B61  il riquadro non compare per un codice che un dialog aperto sta gia'
//        mostrando: chi aspetta un eco (palletMachine.aspettaEco) o tiene
//        aperta la Reimposta stato cella registra i codici che mostra
//        (codiciInDialog), e li toglie quando ha finito, con un margine
//        (l'eco ALARM/ROBOT arriva prima di PLC/ALARM/ROBOT).
// ============================================================================

export const ALARM_REJECT_ACTIVE = 972;
export const ALARM_PAIR_MS = 1000;
// dopo che un dialog smette di aspettare, i suoi codici restano zitti ancora
// per questo tempo: lo stesso allarme arriva al riquadro un attimo dopo
export const DIALOG_GRACE_MS = 1500;

// "+900001" -> 900001; " 18 " -> 18; un testo che non e' un numero -> NaN
export function codiceAllarme(payload) {
	const testo = String(payload).trim();
	return /^[+-]?\d+$/.test(testo) ? parseInt(testo, 10) : NaN;
}

// la chiave del testo: robot.alarm_<codice> col codice ripulito, oppure
// robot.alarm_<payload> com'e' se non e' un numero (come prima)
export function chiaveAllarme(payload) {
	const c = codiceAllarme(payload);
	return 'robot.alarm_' + (Number.isInteger(c) ? c : payload);
}

// ---------------------------------------------------------------- dialog
const inDialog = new Map();
let prossimo = 0;
// registra i codici che un dialog sta mostrando; ritorna la funzione che li
// toglie (dopo DIALOG_GRACE_MS)
export function codiciInDialog(codici, { graziaMs = DIALOG_GRACE_MS } = {}) {
	const id = ++prossimo;
	inDialog.set(id, new Set((codici || []).map(Number)));
	let tolto = false;
	return () => {
		if (tolto) return;
		tolto = true;
		if (graziaMs > 0) setTimeout(() => inDialog.delete(id), graziaMs);
		else inDialog.delete(id);
	};
}
export function codiceInDialog(codice) {
	const c = Number(codice);
	for (const s of inDialog.values()) if (s.has(c)) return true;
	return false;
}

// ---------------------------------------------------------------- 972 + codice
// payload -> desc del riquadro: la chiave robot.alarm_<codice>, come prima,
// oppure il testo gia' tradotto dell'avviso unico 972 + codice.
// daBox(codice) dice se lo stesso codice e' appena arrivato su ALARM/BOX.
export function robotAlarmCombiner({ t, te, now = () => Date.now(), finestraMs = ALARM_PAIR_MS, daBox = () => false } = {}) {
	let ultimo972 = null;
	return payload => {
		const code = codiceAllarme(payload);
		const ora = now();
		if (code === ALARM_REJECT_ACTIVE) {
			ultimo972 = ora;
			return chiaveAllarme(payload);
		}
		const coppia = ultimo972 !== null && ora - ultimo972 <= finestraMs && Number.isInteger(code) && code > 0;
		ultimo972 = null;
		if (!coppia) {
			// (B61) il codice viene dal cassetto e ha un testo suo
			if (Number.isInteger(code) && daBox(code) && te && te('robot.alarmBox_' + code)) return 'robot.alarmBox_' + code;
			return chiaveAllarme(payload);
		}
		const chiave = 'robot.alarm_' + code;
		const descrizione = te && te(chiave) ? String(t(chiave)).trim().replace(/[.\s]+$/, '') : '';
		return t('robot.alarm972Code', { errore: descrizione ? code + ' ' + descrizione : String(code) });
	};
}

// ---------------------------------------------------------------- handler
// gli handler del riquadro globale (store = dataStored):
//   robot  PLC/ALARM/ROBOT
//   box    ALARM/BOX (si segna il codice: il testo lo mostra robot)
//   mc1    ALARM/MC1
export function makePlcAlarmHandlers(store, opzioni = {}) {
	const now = opzioni.now || (() => Date.now());
	let ultimoBox = null;
	const daBox = code => !!ultimoBox && ultimoBox.code === code && now() - ultimoBox.ora <= ALARM_PAIR_MS;
	const desc = robotAlarmCombiner(Object.assign({}, opzioni, { now, daBox }));
	return {
		robot: payload => {
			const d = desc(payload);
			// (B61) lo sta gia' mostrando un dialog aperto: niente riquadro
			if (codiceInDialog(codiceAllarme(payload))) return;
			store.alert.title = 'PLC_Error';
			store.alert.desc = d;
			store.alert.type = 'warning';
		},
		box: payload => {
			const code = codiceAllarme(payload);
			if (Number.isInteger(code)) ultimoBox = { code, ora: now() };
		},
		// (fase B) ALARM/MC1 (es. 947: dichiarazione macchina rifiutata):
		// chiave robot.alarm_<codice>, il payload grezzo se non e' un codice
		mc1: payload => {
			const code = codiceAllarme(payload);
			if (codiceInDialog(code)) return;
			store.alert.title = 'MC1';
			store.alert.desc = Number.isInteger(code) && code > 0 ? 'robot.alarm_' + code : String(payload);
			store.alert.type = 'warning';
		},
	};
}

// l'handler di PLC/ALARM/ROBOT da solo (compatibilita')
export function makePlcAlarmRobotHandler(store, opzioni) {
	return makePlcAlarmHandlers(store, opzioni).robot;
}
