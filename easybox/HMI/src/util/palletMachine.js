// ============================================================================
// palletMachine.js — pallet IN MACCHINA: comandi 40 / 41 con la loro eco (7/10)
//
// Estratto da CNC1View.vue (doppia mossa ECO-DRIVEN del 16/9) perche' lo
// usano anche il dialog Posiziona di Attrezzaggi («In macchina», «Rimuovi»)
// e la dichiarazione del pallet a bordo del robot (util/palletOnRobot.js):
//   1. comando MQTT: TO_PLANT/CMD/MC<n> "40;<pallet>" (dichiara) o "41" (toglie);
//   2. attesa dell'eco FROM_PLANT/DECLARE/MC<n> "pallet;manualVice;pezzo"
//      COERENTE (pallet = quello mandato col 40, 0 col 41), 3 s;
//   3. SOLO dopo l'eco, la posizione nel database (REST updatePallet).
// Senza eco, o con il rifiuto 947 di FB204 (FB_Machine_Autonomous, REGION
// "Declare MC1 from HMI": 40 con ciclo macchina avviato o con un pallet gia'
// dichiarato; 41 con ciclo avviato), NESSUNA scrittura REST: il registro
// DB_MC1.pallet e il database restano allineati.
//
// IL PROBLEMA (simulazione del 7/10, problema 16): «In macchina» e «Rimuovi»
// del Posiziona scrivevano solo il database, e il registro del PLC restava
// com'era. Dal 7/10 sera anche «Casella» di un pallet in macchina.
// ============================================================================

export const ECO_MC_MS = 3000;      // come la pagina Macchine dal 16/9
export const RIFIUTI_MC = [947];    // FB204: ciclo macchina avviato / pallet gia' dichiarato
export const REGISTRO_MS = 1500;    // risposta allo snapshot del registro

// Attende UN'eco COERENTE con quanto mandato, con timeout. Un rifiuto del PLC
// fra i codici attesi chiude subito l'attesa.
// Risolve { ok, codice, scaduto } — mai una rejection.
export function aspettaEco(socket, { evento, coerente, allarme, codici, ms }) {
	return new Promise(resolve => {
		let fatto = false;
		const fine = (esito) => {
			if (fatto) return;
			fatto = true;
			clearTimeout(t);
			socket.off(evento, suEco);
			if (allarme) socket.off(allarme, suAllarme);
			resolve(esito);
		};
		const suEco = (payload) => { if (!coerente || coerente(String(payload))) fine({ ok: true, codice: 0, scaduto: false }); };
		const suAllarme = (payload) => {
			const c = parseInt(String(payload).trim(), 10);
			if ((codici || []).indexOf(c) >= 0) fine({ ok: false, codice: c, scaduto: false });
		};
		const t = setTimeout(() => fine({ ok: false, codice: 0, scaduto: true }), ms);
		socket.on(evento, suEco);
		if (allarme) socket.on(allarme, suAllarme);
	});
}

// Manda il 40 (tipo 'set') o il 41 (tipo 'clear') a MC<mc> e ne aspetta
// l'eco. Il comando parte SUBITO, in modo sincrono: chi chiama puo' contare
// su questo. Risolve { ok, codice, scaduto }.
export function mandaComandoPallet(socket, { mc, tipo, palletId, ms }) {
	const unita = 'MC' + mc;
	const atteso = tipo === 'set' ? Number(palletId) : 0;
	const eco = aspettaEco(socket, {
		evento: 'DECLARE/' + unita,
		coerente: p => parseInt(p.split(';')[0], 10) === atteso,
		allarme: 'ALARM/' + unita,
		codici: RIFIUTI_MC,
		ms: ms || ECO_MC_MS,
	});
	socket.emit('TO_PLANT/CMD/' + unita, tipo === 'set' ? '40;' + Number(palletId) : '41');
	return eco;
}

// Il pallet che il DATABASE dice in macchina mc: POS_PLANT esatto 100+mc,
// altrimenti la fascia 101..999 (dati legacy). 0 se nessuno.
export function inMacchina(pallets, mc = 1) {
	const exact = (pallets || []).find(p => Number(p.POS_PLANT) === 100 + mc);
	if (exact) return Number(exact.ID);
	const inBand = (pallets || []).find(p => p.POS_PLANT > 100 && p.POS_PLANT < 1000);
	return inBand ? Number(inBand.ID) : 0;
}

// Il registro della macchina (DB_MC1.pallet) dallo snapshot del backend:
// GRIPPER/REQUEST_SNAPSHOT ripubblica anche DECLARE/MC1. Risolve col numero
// del pallet, o undefined se non arriva entro ms. Da chiedere PRIMA di
// mandare un comando, mai durante l'attesa della sua eco (lo snapshot ripete
// l'ultima DECLARE/MC1, che sembrerebbe una conferma).
export function leggiRegistroMacchina(socket, ms = REGISTRO_MS) {
	return new Promise(resolve => {
		let fatto = false;
		const fine = (v) => { if (fatto) return; fatto = true; clearTimeout(t); socket.off('DECLARE/MC1', suEco); resolve(v); };
		const suEco = (p) => { const n = parseInt(String(p).split(';')[0], 10); fine(Number.isInteger(n) ? n : undefined); };
		const t = setTimeout(() => fine(undefined), ms);
		socket.on('DECLARE/MC1', suEco);
		socket.emit('GRIPPER/REQUEST_SNAPSHOT');
	});
}

// LA GUARDIA DEL 41 (7/10), la stessa in tutti i percorsi che tolgono un
// pallet dalla macchina: «Rimuovi» e «Casella» del Posiziona, pallet a bordo
// del robot (util/palletOnRobot.js).
//   posPlant  POS_PLANT del pallet nel database
//   registro  il registro della macchina (DB_MC1.pallet) letto ADESSO,
//             undefined se non ha risposto
// Ritorna { ok:true, mc }: mc = la macchina a cui mandare il 41, 0 = nessun
// 41 (il pallet non e' in macchina, oppure il registro e' gia' a 0 e basta il
// database: il 41 azzererebbe anche il pezzo in macchina). Oppure
// { ok:false, motivo, parametri }:
//   - nel registro c'e' un ALTRO pallet: il 41 toglierebbe quello, si dice quale;
//   - il registro non ha risposto: niente 41 alla cieca, si riprova.
// Il pannello legge il registro solo di MC1 (DECLARE/MC1 nello snapshot): per
// un'altra macchina vale come non letto.
export function guardia41({ palletId, posPlant, registro }) {
	const id = Number(palletId), pp = Number(posPlant);
	const mcDb = pp > 100 && pp < 1000 ? pp - 100 : 0;
	if (registro === id) return { ok: true, mc: 1 };
	if (mcDb === 0) return { ok: true, mc: 0 };
	if (mcDb !== 1 || registro === undefined) return { ok: false, motivo: 'palletMachine.err.registerUnread', parametri: {} };
	if (registro > 0) return { ok: false, motivo: 'palletMachine.err.otherInMachine', parametri: { id: registro } };
	return { ok: true, mc: 0 };
}

// La posizione nel database DOPO l'eco (logica di CNC1View.applyPosPlant).
// Riga riletta adesso, pass-through di tutti gli altri campi (pattern AE).
//   set   -> MAG_POS invariato (la casa resta del pallet), POS_PLANT 100+mc
//   clear -> MAG_POS -1 (fuori magazzino), POS_PLANT 0
// palletId null col clear: il pallet che il database dice in macchina.
// liberaCasella: la casella di provenienza (MAG_POS > 0) va liberata (4->2):
// il rientro automatico del PLC cerca la casa con STATUS=2.
// Risolve { ok, body } oppure { ok:false, errore }.
export async function scriviPosizione({ server, fetchFn, tipo, palletId, mc = 1, liberaCasella }) {
	const f = fetchFn || fetch;
	try {
		const pallets = await f(server + 'api/conf/pallet/show/all', { method: 'GET' })
			.then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); });
		const id = palletId != null ? Number(palletId) : inMacchina(pallets, mc);
		const row = (pallets || []).find(p => Number(p.ID) === id);
		if (!row) return { ok: false, errore: 'riga' };   // niente riga fresca: nessuna scrittura cieca
		const fromSlot = row.MAG_POS > 0 ? row.MAG_POS : 0;
		const params = new URLSearchParams({
			ID: row.ID, FAMILY: row.FAMILY, DESCR: row.DESCR,
			X: row.X, Y: row.Y, Z: row.Z,
			X_CORR: row.X_CORR, Y_CORR: row.Y_CORR, Z_CORR: row.Z_CORR,
			MAG: row.MAG,
			MAG_POS: tipo === 'set' ? row.MAG_POS : -1,
			POS_PLANT: tipo === 'set' ? 100 + mc : 0,
		});
		const body = await f(server + 'api/conf/pallet/updatePallet?' + params.toString(), { method: 'GET' })
			.then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.text(); });
		if (body != 'OK') return { ok: false, errore: 'body', body };
		if (liberaCasella && fromSlot > 0)
			await f(server + 'api/conf/position/warehouseSlot/free/WPALLET/' + fromSlot, { method: 'GET' }).catch(e => { console.info(e); });
		return { ok: true, body };
	} catch (e) {
		console.info(e);
		return { ok: false, errore: 'rete' };
	}
}

// Il messaggio per un comando 40/41 non confermato.
export function messaggioEsitoMacchina(esito, tipo) {
	if (esito.codice === 947) return tipo === 'set' ? 'palletMachine.err.set947' : 'palletMachine.err.clear947';
	return 'machine.echoTimeout';
}
