// ============================================================================
// caricaElenco.js — leggere un elenco sapendo distinguere VUOTO da GUASTO
// (usabilita' 15/9)
//
// PERCHE' ESISTE. Le pagine leggevano cosi':
//     fetch(url).then(...).catch(error => { console.info(error); });
// e il guasto finiva nella console, che in cella non guarda nessuno. A video
// restava una tabella senza righe, identica a "non c'e' niente da fare".
// La pagina Produzione arrivava a scrivere "Nessun ordine al momento" mentre
// la richiesta era fallita: un'affermazione FALSA, non un errore.
//
// Distinguere serve perche' l'operatore deve fare due cose diverse:
//   - elenco davvero vuoto  -> crea qualcosa, o non c'e' lavoro;
//   - server irraggiungibile -> il servizio dati non gira, si avvia;
//   - server che risponde 500 -> il servizio gira ma non riesce a leggere il
//     database, e questo non lo sistema l'operatore.
// Le ultime due si distinguono grazie al contratto HTTP messo a posto il 15/9:
// i fallimenti tecnici rispondono 500, gli esiti applicativi 200 con il codice
// nel corpo. Prima erano tutti indistinguibili.
//
// Ritorna SEMPRE un oggetto, non lancia: chi chiama non deve ricordarsi il
// catch, che e' come il problema e' nato.
// ============================================================================

export const STATO = {
	ATTESA: 'attesa',   // richiesta in corso: non si dice ancora niente
	OK: 'ok',           // risposta arrivata (l'elenco puo' essere vuoto davvero)
	IRRAGGIUNGIBILE: 'irraggiungibile', // nessuna risposta: servizio spento o rete
	GUASTO: 'guasto',   // risposta 500: il servizio c'e' ma non ce la fa
};

// url: percorso relativo, es. 'api/order/show/all'
// base: dataStored.server
export async function caricaElenco(base, url) {
	let r;
	try {
		r = await fetch(base + url, { method: 'GET' });
	} catch (e) {
		// fetch rifiuta solo se non si e' arrivati al server
		return { stato: STATO.IRRAGGIUNGIBILE, dati: [], dettaglio: String(e && e.message || e) };
	}
	if (r.status >= 500) return { stato: STATO.GUASTO, dati: [], dettaglio: 'HTTP ' + r.status };
	if (!r.ok) return { stato: STATO.GUASTO, dati: [], dettaglio: 'HTTP ' + r.status };
	let dati;
	try {
		dati = await r.json();
	} catch (e) {
		// risposta arrivata ma illeggibile: e' un guasto del servizio, non un
		// elenco vuoto
		return { stato: STATO.GUASTO, dati: [], dettaglio: 'risposta non leggibile' };
	}
	return { stato: STATO.OK, dati: Array.isArray(dati) ? dati : (dati ? [dati] : []) };
}

// chiave i18n del messaggio da mostrare per uno stato non OK
export function messaggioPer(stato) {
	if (stato === STATO.IRRAGGIUNGIBILE) return 'elenco.irraggiungibile';
	if (stato === STATO.GUASTO) return 'elenco.guasto';
	return '';
}
