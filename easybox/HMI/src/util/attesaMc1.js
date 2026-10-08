// ============================================================================
// util/attesaMc1.js — perche' il ciclo MC1 e' fermo: le regole dell'avviso
// fisso del pannello v3 (consegna 36, 8/10)
//
// FB7 pubblica ogni 3 s FROM_PLANT/WAIT/MC1, "codice;stato di FB204;dato";
// il backend lo passa come MC1/WAIT (serverDati/MQTT_Client.js), con
// l'ultimo allarme MC1 quando il codice e' 10, e codice null quando per 10 s
// non arriva niente. Tabella dei codici: docs/ALLARMI-PLC.md, «Consegna 36».
//
// L'8/10 la cella e' rimasta ferma per ore senza un messaggio a video.
// Decisioni di Dario (8/10): l'avviso e' FISSO e copre tutti i motivi; testo
// e link alla pagina giusta; NESSUN pulsante di comando.
//
// Regole (rigaAttesa):
//   - niente da mostrare se il backend non ha mai mandato niente (un PLC
//     senza la 36 il topic non lo pubblica) o col codice 0;
//   - codice null: riga grigia «Stato del ciclo non aggiornato»;
//   - codice 30, oppure FB204 a 0, 10 o 20 senza un ordine di MC1 in Play
//     (STATUS 3, PRODUCTED < QUANTITY): riga grigia «Nessun ordine in Play
//     per MC1», senza avviso giallo. Se gli ordini non si sono potuti
//     leggere non si decide «nessun ordine»: resta l'avviso del codice;
//   - altrimenti l'avviso giallo col testo del codice e, dove c'e', il link.
// I testi (testiAttesa) vengono da cycleWait.* e, per l'errore robot (8) e
// l'allarme MC1 (10), da robot.alarm_<codice>.
// Funzioni pure: t/te e l'ora arrivano dal chiamante (test:
// tests/test_attesa_mc1_v3.mjs).
// ============================================================================

export const TIPO = { NESSUNA: 'nessuna', NEUTRA: 'neutra', AVVISO: 'avviso', STANTIA: 'stantia' };

// FB204 fermo all'inizio del ciclo: senza un ordine in Play non aspetta niente
export const FB204_SENZA_ORDINE = [0, 10, 20];
export const CODICE_ATTESA_ORDINI = 30;
export const CODICE_ERRORE_ROBOT = 8;
export const CODICE_FB204_ERRORE = 10;

// pagine dei link: rotta, testo lungo e breve (cycleWait.page.*), livello
// minimo (la pagina MQTT Live la barra la mostra dal livello 1)
export const PAGINE = {
	robot: { to: '/unit/robot', label: 'cycleWait.page.robot', breve: 'cycleWait.short.page.robot' },
	macchina: { to: '/unit/CNC1', label: 'cycleWait.page.machine', breve: 'cycleWait.short.page.machine' },
	diagnostica: { to: '/diag/mqtt', label: 'cycleWait.page.diag', breve: 'cycleWait.short.page.diag', livello: 1 },
};

// codice -> pagina del link (null: nessun link)
export const CODICI = {
	1: 'robot', 2: null, 3: null, 4: null, 5: null, 6: null, 7: null,
	8: 'robot', 9: 'robot', 10: 'robot', 11: 'macchina', 12: null, 13: null,
	14: 'macchina', 15: 'robot', 16: 'robot', 20: 'robot', 21: 'diagnostica',
};

const intero = v => (v === null || v === undefined || v === '' ? null : (Number.isInteger(Number(v)) ? Number(v) : NaN));

// payload di MC1/WAIT -> { codice, statoFB204, dato, ts, allarme } oppure
// null se non e' leggibile (allora si tiene quello che c'era)
export function normalizzaAttesa(p) {
	let o = p;
	if (typeof o === 'string') { try { o = JSON.parse(o); } catch { return null; } }
	if (!o || typeof o !== 'object') return null;
	const codice = intero(o.codice), statoFB204 = intero(o.statoFB204), dato = intero(o.dato);
	if (Number.isNaN(codice) || Number.isNaN(statoFB204) || Number.isNaN(dato)) return null;
	let allarme = null;
	if (o.allarme && typeof o.allarme === 'object' && Number.isInteger(Number(o.allarme.codice)))
		allarme = { codice: Number(o.allarme.codice), ts: Number(o.allarme.ts) || null };
	return { codice, statoFB204, dato, ts: Number(o.ts) || null, allarme };
}

// un ordine di MC1 in Play: STATUS 3 e non ancora completo
export function ordineMc1InPlay(ordini) {
	return (ordini || []).some(o => Number(o.MACHINE_ID) === 1 && Number(o.STATUS) === 3
		&& Number(o.PRODUCTED) < Number(o.QUANTITY));
}

// la riga da mostrare: { tipo, codice, link }
export function rigaAttesa(attesa, { ordini = [], ordiniNoti = false, livello = 0 } = {}) {
	if (!attesa) return { tipo: TIPO.NESSUNA, codice: null, link: null };
	const { codice } = attesa;
	if (codice === null) return { tipo: TIPO.STANTIA, codice: null, link: null };
	if (codice === 0) return { tipo: TIPO.NESSUNA, codice: 0, link: null };
	if (codice === CODICE_ATTESA_ORDINI
		|| (FB204_SENZA_ORDINE.includes(attesa.statoFB204) && ordiniNoti && !ordineMc1InPlay(ordini)))
		return { tipo: TIPO.NEUTRA, codice, link: null };
	const pagina = PAGINE[CODICI[codice]] || null;
	const link = pagina && (!pagina.livello || (Number(livello) || 0) >= pagina.livello) ? pagina : null;
	return { tipo: TIPO.AVVISO, codice, link };
}

const oraDi = ts => {
	const d = new Date(Number(ts));
	if (!ts || Number.isNaN(d.getTime())) return '';
	return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};
// il testo di un allarme dentro una frase: senza il punto finale
const senzaPunto = s => String(s).trim().replace(/[.\s]+$/, '');

// i testi della riga: { lungo, breve, link, linkBreve }
export function testiAttesa(riga, attesa, { t, te }) {
	const out = { lungo: '', breve: '', link: '', linkBreve: '' };
	if (!riga || riga.tipo === TIPO.NESSUNA) return out;
	if (riga.tipo === TIPO.STANTIA) { out.lungo = out.breve = t('cycleWait.stale'); return out; }
	if (riga.tipo === TIPO.NEUTRA) { out.lungo = out.breve = t('cycleWait.noOrder'); return out; }
	const c = riga.codice, dato = attesa.dato;
	if (CODICI[c] === undefined) {
		out.lungo = out.breve = t('cycleWait.unknown', { codice: c, dato });
	} else if (c === CODICE_ERRORE_ROBOT) {
		const k = 'robot.alarm_' + dato;
		out.lungo = te(k) ? t('cycleWait.c8', { dato, testo: senzaPunto(t(k)) }) : t('cycleWait.c8NoText', { dato });
		out.breve = t('cycleWait.short.c8', { dato });
	} else if (c === CODICE_FB204_ERRORE) {
		const a = attesa.allarme;
		let allarme;
		if (!a) allarme = t('cycleWait.alarmUnknown');
		else {
			const k = 'robot.alarm_' + a.codice;
			allarme = te(k) ? t('cycleWait.alarm', { codice: a.codice, ora: oraDi(a.ts), testo: senzaPunto(t(k)) })
				: t('cycleWait.alarmNoText', { codice: a.codice, ora: oraDi(a.ts) });
		}
		out.lungo = t('cycleWait.c10', { allarme });
		out.breve = a ? t('cycleWait.short.c10', { codice: a.codice }) : t('cycleWait.short.c10NoAlarm');
	} else {
		out.lungo = t('cycleWait.c' + c, { dato });
		out.breve = t('cycleWait.short.c' + c, { dato });
	}
	if (riga.link) {
		out.link = t('cycleWait.goTo', { pagina: t(riga.link.label) });
		out.linkBreve = t('cycleWait.goTo', { pagina: t(riga.link.breve) });
	}
	return out;
}
