// ============================================================================
// stores/attesaMc1.js — perche' il ciclo MC1 e' fermo, per l'avviso fisso
// del pannello v3 (consegna 36, 8/10)
//
// Fonti, sola lettura:
//   - evento socket MC1/WAIT dal backend (FROM_PLANT/WAIT/MC1 del PLC, con la
//     cache: a ogni messaggio, a ogni connessione e su MC1/WAIT/REQUEST, che
//     qui si manda all'avvio e a ogni riconnessione);
//   - api/order/show/all (gli ordini di Produzione), all'avvio, a ogni
//     riconnessione e a ogni PRODUCTION/CHANGED: serve a dire «nessun
//     ordine in Play per MC1».
// Socket scollegato: lo stato non e' piu' aggiornato (codice null), se ne
// era arrivato uno. Le regole stanno in util/attesaMc1.js.
//
// start/stop contati, come stores/plantStatus.js: la shell li chiama al
// mount/unmount; i listener sono nominati e si staccano con off specifico.
// ============================================================================
import { reactive } from 'vue';
import { dataStored } from '../data.js';
import { caricaElenco, STATO } from '../util/caricaElenco.js';
import { normalizzaAttesa } from '../util/attesaMc1.js';

export const attesaMc1 = reactive({
	attesa: null,       // ultimo MC1/WAIT; null = mai arrivato
	ordini: [],         // api/order/show/all
	ordiniNoti: false,  // l'ultima lettura degli ordini e' riuscita
});

let lettura = 0;
export function caricaOrdini() {
	const n = ++lettura;
	return caricaElenco(dataStored.server, 'api/order/show/all').then(e => {
		if (n !== lettura) return;   // e' gia' partita una lettura piu' nuova
		if (e.stato === STATO.OK) { attesaMc1.ordini = e.dati; attesaMc1.ordiniNoti = true; }
		else attesaMc1.ordiniNoti = false;
	});
}

const H = {
	'MC1/WAIT': p => { const a = normalizzaAttesa(p); if (a) attesaMc1.attesa = a; },
	'PRODUCTION/CHANGED': () => { caricaOrdini(); },
	disconnect: () => {
		if (attesaMc1.attesa && attesaMc1.attesa.codice !== null)
			attesaMc1.attesa = { codice: null, statoFB204: null, dato: null, ts: Date.now(), allarme: null };
	},
};
const chiedi = () => {
	dataStored.WS.socket.emit('MC1/WAIT/REQUEST');
	caricaOrdini();
};

let utenti = 0;
export function startAttesaMc1() {
	if (utenti++ > 0) return;
	const s = dataStored.WS && dataStored.WS.socket;
	if (!s) return;
	for (const [ev, h] of Object.entries(H)) s.on(ev, h);
	s.on('connect', chiedi);
	chiedi();
}
export function stopAttesaMc1() {
	if (--utenti > 0) return;
	utenti = 0;
	const s = dataStored.WS && dataStored.WS.socket;
	if (!s) return;
	for (const [ev, h] of Object.entries(H)) s.off(ev, h);
	s.off('connect', chiedi);
}
