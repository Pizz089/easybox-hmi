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
// entro ALARM_PAIR_MS da un altro codice diventa un avviso unico.
// (7/10 sera, risposte sulla consegna 35) com'e' fatto l'avviso unico:
//   titolo  «Comando rifiutato: errore attivo <codice>» (robot.alarm972Title);
//   testo   quello del codice (robot.alarm_<codice>), che dice gia' cosa
//           fare: «Premi RESET» non si ripete;
//   coda    «Premi RESET e ripeti il comando.» (robot.alarm972NoText) SOLO
//           se il codice non ha un testo.
// Un 972 senza seguito resta com'e'. QUALE messaggio si abbina (8/10, prompt
// 7): solo quello che segue il 972 sull'evento ALARM/ROBOT, entro 1 s. Nella
// 35 il PLC mette in coda i due messaggi uno dopo l'altro, nello stesso ciclo
// e sullo stesso topic FROM_PLANT/ALARM/ROBOT (FB_Robot, REGION Manager, due
// FC_MQTT con insert := true): il secondo e' #Error di FB_Robot. Il backend
// (MQTT_Client.js) per FROM_PLANT/ALARM/ROBOT manda ALARM/ROBOT e subito dopo
// PLC/ALARM/ROBOT; ma PLC/ALARM/ROBOT lo manda per OGNI FROM_PLANT/ALARM/*
// tranne MC1: anche ALARM/BOX e le emergenze 900001, 900002, 900010, 900011,
// che il PLC pubblica su FROM_PLANT/ALARM (FB_plant.scl). Prima l'abbinamento
// si decideva su PLC/ALARM/ROBOT, e un'emergenza arrivata entro 1 s da un 972
// diventava «Comando rifiutato: errore attivo 900010». Adesso:
//   ALARM/ROBOT      (handler alarmRobot) decide l'abbinamento, non tocca il
//                    riquadro;
//   PLC/ALARM/ROBOT  (handler robot) sceglie il testo e mostra il riquadro,
//                    una volta sola per messaggio.
// Mai ALARM/MC1 ne' PLC/ALARM/GENERIC, che hanno handler loro e non passano
// di qui; un 972 che segue un altro 972 non si abbina.
//
// (7/10 sera, simulazione bis)
//   B60  il codice passa da parseInt prima di comporre la chiave: "+900001"
//        e " 18 " diventano 900001 e 18 (prima robot.alarm_+900001, grezza);
//   B61  il 99 pubblicato su ALARM/BOX (numero di cassetto fuori intervallo)
//        ha un testo suo, robot.alarmBox_99: robot.alarm_99 e' "ALLARME
//        GENERICO" del robot. Il backend manda ALARM/BOX e subito dopo lo
//        stesso codice su PLC/ALARM/ROBOT: l'handler box se lo segna;
//   B61  il riquadro non compare per un codice che un dialog aperto sta gia'
//        mostrando: chi aspetta un eco (palletMachine.aspettaEco) registra i
//        codici che mostra (codiciInDialog), e li toglie quando ha finito, con
//        un margine (l'eco ALARM/ROBOT arriva prima di PLC/ALARM/ROBOT).
//        (8/10, prompt 7) la Reimposta stato cella li registra solo mentre
//        aspetta un eco, non per tutto il tempo in cui e' aperta: nei passi
//        che non li mostrano il riquadro deve comparire.
// ============================================================================

import { timer } from './orologio.js';

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
// (8/10) rilascia({ subito: true }) li toglie senza margine: attesa
// annullata (dialog chiuso, pagina smontata), nessun allarme in arrivo da
// lasciar passare
export function codiciInDialog(codici, { graziaMs = DIALOG_GRACE_MS } = {}) {
	const id = ++prossimo;
	inDialog.set(id, new Set((codici || []).map(Number)));
	let tolto = false;
	return ({ subito = false } = {}) => {
		if (tolto) return;
		tolto = true;
		if (graziaMs > 0 && !subito) timer.dopo(() => inDialog.delete(id), graziaMs);
		else inDialog.delete(id);
	};
}
export function codiceInDialog(codice) {
	const c = Number(codice);
	for (const s of inDialog.values()) if (s.has(c)) return true;
	return false;
}

// ---------------------------------------------------------------- 972 + codice
// payload -> desc del riquadro, sempre una CHIAVE (il riquadro mostra
// $t(desc)): robot.alarm_<codice> come prima; nell'avviso unico la chiave del
// codice se ha un testo, altrimenti robot.alarm972NoText (la coda).
// Dopo ogni chiamata, f.ultimaCoppia e' il codice abbinato al 972 (null se
// non era una coppia): l'handler ne fa il titolo.
// f(payload) e' PLC/ALARM/ROBOT; f.eco(payload) e' ALARM/ROBOT, che il
// backend manda subito PRIMA del PLC/ALARM/ROBOT dello stesso messaggio, e
// solo per FROM_PLANT/ALARM/ROBOT: e' li' che si decide l'abbinamento.
// daBox(codice) dice se lo stesso codice e' appena arrivato su ALARM/BOX.
export function robotAlarmCombiner({ t, te, now = () => Date.now(), finestraMs = ALARM_PAIR_MS, daBox = () => false } = {}) {
	let ultimo972 = null;   // ora dell'ultimo 972 arrivato su ALARM/ROBOT
	let coppia = null;      // { code, ora }: il codice che su ALARM/ROBOT ha seguito il 972
	const eco = payload => {
		const code = codiceAllarme(payload);
		const ora = now();
		coppia = null;
		if (code === ALARM_REJECT_ACTIVE) {
			ultimo972 = ora;
			return;
		}
		if (ultimo972 !== null && ora - ultimo972 <= finestraMs && Number.isInteger(code) && code > 0)
			coppia = { code, ora };
		ultimo972 = null;
	};
	// (E1.2) f.ultimaCoppia serve anche al badge del riquadro («972 → <codice>»)
	const f = payload => {
		const code = codiceAllarme(payload);
		const ora = now();
		f.ultimaCoppia = null;
		// la coppia vale per il PLC/ALARM/ROBOT dello stesso messaggio, che
		// arriva subito dopo: si consuma comunque
		const abbinato = coppia !== null && Number.isInteger(code) && code === coppia.code && ora - coppia.ora <= finestraMs;
		coppia = null;
		if (!abbinato) {
			// (B61) il codice viene dal cassetto e ha un testo suo
			if (Number.isInteger(code) && daBox(code) && te && te('robot.alarmBox_' + code)) return 'robot.alarmBox_' + code;
			return chiaveAllarme(payload);
		}
		f.ultimaCoppia = code;
		const chiave = 'robot.alarm_' + code;
		return te && te(chiave) ? chiave : 'robot.alarm972NoText';
	};
	f.eco = eco;
	f.ultimaCoppia = null;
	return f;
}

// il titolo del riquadro per l'avviso unico: «Comando rifiutato: errore
// attivo <codice>», gia' tradotto ($t lo lascia com'e': solo testo e numeri)
export function titoloCoppia(t, codice) {
	return t('robot.alarm972Title', { codice: String(codice) });
}

// ---------------------------------------------------------------- handler
// gli handler del riquadro globale (store = dataStored):
//   robot       PLC/ALARM/ROBOT (il testo e il riquadro)
//   alarmRobot  ALARM/ROBOT (l'abbinamento del 972: il riquadro lo mostra
//               robot, che arriva subito dopo per lo stesso messaggio)
//   box         ALARM/BOX (si segna il codice: il testo lo mostra robot)
//   mc1         ALARM/MC1
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
			// (7/10 sera) l'avviso unico 972 + codice ha il titolo suo
			store.alert.title = desc.ultimaCoppia && opzioni.t ? titoloCoppia(opzioni.t, desc.ultimaCoppia) : 'PLC_Error';
			store.alert.desc = d;
			store.alert.type = 'warning';
			// (E1.2) badge del riquadro per l'avviso unito; per gli altri il
			// codice lo ricava il riquadro dalla chiave. Vale solo per QUESTO
			// avviso: chi scrive dopo un altro avviso non si porta dietro il
			// badge. (7/10 sera) il testo dell'avviso unito ora e' la chiave
			// del codice, la stessa che puo' scrivere un altro handler (947 su
			// ALARM/MC1): il badge vale solo con lo stesso testo E lo stesso
			// titolo, che per l'avviso unito e' suo
			store.alert.badge = desc.ultimaCoppia ? { desc: d, title: store.alert.title, text: ALARM_REJECT_ACTIVE + ' → ' + desc.ultimaCoppia } : null;
		},
		alarmRobot: payload => { desc.eco(payload); },
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
