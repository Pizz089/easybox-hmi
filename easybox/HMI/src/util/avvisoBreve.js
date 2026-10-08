// ============================================================================
// avvisoBreve.js — un esito breve (type 'message') non cancella un allarme
// aperto (pannello v3, 8/10, prompt 7, B4)
//
// Il riquadro globale e' uno solo: dataStored.alert (title, desc, type,
// check), scritto da molti punti del pannello. Un «Livello modificato»
// (message) arrivato con un allarme aperto lo sostituiva, e poi spariva da
// solo dopo 4 s: l'allarme non si vedeva piu'.
// Il contratto NON cambia: chi scrive continua a scrivere dataStored.alert.
// AppShell chiama smista() dopo ogni scrittura (watch, flush 'pre': vede lo
// stato finale delle scritture fatte insieme) e:
//   - se e' un message: lo sposta nell'avviso breve (breve.title/desc), e
//     rimette in dataStored.alert l'allarme che c'era (o lo svuota);
//   - altrimenti si segna l'allarme a video, per poterlo rimettere.
//
// (prompt 10) I MESSAGE VANNO DIRETTAMENTE ALL'AVVISO BREVE. Lo smistamento
// vede solo lo stato finale: un allarme e un message scritti nello stesso giro
// di eventi (PLC che risponde con un errore mentre arriva l'esito di un
// salvataggio) lasciavano il riquadro vuoto, perche' l'allarme scritto prima
// non era mai stato «a video» e non si poteva rimettere. Adesso chi ha un esito
// positivo chiama avvisoBreve(titolo, testo) e non tocca dataStored.alert.
// AppShell mostra lo stesso avviso unico; lo smistamento resta come rete per
// un message scritto ancora alla vecchia maniera.
// ============================================================================
import { reactive } from 'vue';

const breveUnico = reactive({ title: '', desc: '', n: 0 });

// l'esito breve, senza passare dal riquadro degli allarmi
export function avvisoBreve(title, desc) {
	breveUnico.title = title;
	breveUnico.desc = desc;
	breveUnico.n++;
}
// lo stato dell'avviso breve (title, desc, n = quante volte e' stato scritto)
// e la sua chiusura: per AppShell e per le prove
export function avvisoBreveAttuale() { return breveUnico; }
export function chiudiAvvisoBreve() { breveUnico.title = ''; breveUnico.desc = ''; }

export function creaSmistaAvvisi(store, breve = breveUnico) {
	let allarme = null;
	const smista = () => {
		const a = store.alert;
		if (!a) return;
		if (a.type === 'message' && a.title) {
			breve.title = a.title;
			breve.desc = a.desc;
			breve.n++;
			if (allarme) {
				a.title = allarme.title;
				a.desc = allarme.desc;
				a.type = allarme.type;
				a.check = allarme.check;
				a.badge = allarme.badge;
			} else {
				a.title = '';
				a.desc = '';
				a.type = 'alarm';
				a.check = [];
			}
			return;
		}
		allarme = a.title ? { title: a.title, desc: a.desc, type: a.type, check: a.check, badge: a.badge } : null;
	};
	const chiudiBreve = () => { breve.title = ''; breve.desc = ''; };
	return { breve, smista, chiudiBreve };
}
