// ============================================================================
// palletOnRobot.js — dichiarare un pallet «a bordo del robot» (7/10)
//
// IL PROBLEMA (Dario, 6/10 sera): dopo un prelievo del pallet dalla macchina
// il sistema non sapeva che il pallet era in pinza. Il pannello vedeva la
// pinza vuota, il PLC rifiutava il deposito a magazzino (errore 23 di
// MISSION_Unload_Pallet) e non c'era un modo semplice di dirglielo.
//
// PERCHE' PASSA DAL PLC. Per il robot il database non basta: il pannello
// Robot decide su GRIPPER.STATUS, il PLC su GripperOccuped[1]. Scrivere solo
// PALLET.POS_PLANT=1000 lascerebbe la stessa incoerenza. Il comando 35
// (FB_Robot, REGION Declare_State) fa tutto insieme: GripperOccuped, STATUS
// della pinza e "UPDATE Pallet SET POS_PLANT=1000" (stato 68), con le sue
// validazioni (944, 945, 946). Il pannello quindi NON scrive POS_PLANT=1000.
//
// ATTENZIONE: il 35 parte con RESET_ALL_DISPATCH (stato 10), cioe' annulla
// tutte le catene in corso nel PLC. Per questo le guardie chiedono la cella
// in HOLD e nessuna missione in corso, e la conferma lo dice.
//
// PALLET IN MACCHINA. Se il pallet risulta in macchina (POS_PLANT 100+n, o e'
// quello del registro DB_MC1.pallet) prima si manda il 41, come la pagina
// Macchine, e si aspetta la sua eco: il 35 non tocca quel registro. Se il 41
// non conferma ci si ferma li'. Il 41 passa dalla STESSA guardia di «Rimuovi»
// e «Casella» del Posiziona (guardia41 di util/palletMachine.js): con un
// altro pallet nel registro, o col registro non letto, nessun comando; col
// registro gia' a 0 niente 41. NON si fa la scrittura REST che la pagina
// Macchine fa dopo il 41 (MAG_POS=-1, POS_PLANT=0): azzererebbe la casa del
// pallet, e POS_PLANT lo scrive il 35.
//
// Un solo modulo per le due pagine che dichiarano (Attrezzaggi, «A bordo del
// robot»; Robot, «Dichiara quale pallet e' in pinza»).
// ============================================================================
import { dataStored } from '../data.js';
import { aspettaEco, mandaComandoPallet, guardia41, ECO_MC_MS, RIFIUTI_MC } from './palletMachine.js';

// attese, le stesse delle pagine che mandano gia' questi comandi
export const ECO_41_MS = ECO_MC_MS;  // pagina Macchine (util/palletMachine.js)
export const ECO_35_MS = 5000;     // Reimposta stato cella (declEchoMs)
export const SENSORI_MS = 1500;    // risposta allo snapshot dei sensori
export const RIFIUTI_41 = RIFIUTI_MC;  // FB204: ciclo macchina avviato
export const RIFIUTI_35 = [944, 945, 946, 968, 969];   // come Reimposta stato cella

// Contenuto di un lato per il 35 (0 vuoto, 1 grezzo, 2 finito, 3 pallet) a
// partire dallo STATUS della riga GRIPPER a bordo. null = stato che il 35
// non sa dire: meglio fermarsi che inventarlo.
export function contenutoLato(status) {
	const s = Number(status);
	if (s === dataStored.status_empty) return 0;
	if (s === dataStored.status_raw) return 1;
	if (s === dataStored.status_finished) return 2;
	return null;
}

const nomePallet = p => ('#' + p.ID + ' ' + String(p.FAMILY || '').trim()).trim();

// Le guardie, su dati letti ADESSO. Ritorna { ok:false, motivo, parametri }
// oppure il piano: { ok:true, pallet, pinza, cont2, mc, cmd41, cmd35 }.
//   palletId        il pallet scelto
//   pallets         api/conf/pallet/show/all
//   robotStatus     STATUS di api/unit/show/robot
//   missioneInCorso true se il pannello sa di una missione partita
//   righePinza      api/conf/gripper/onrobot (righe GRIPPER a POS_PLANT=1000)
//   sensori         { mounted, closed1, registered, mc1Pallet } (leggiSensori)
export function pianoDichiarazione({ palletId, pallets, robotStatus, missioneInCorso, righePinza, sensori }) {
	const no = (motivo, parametri) => ({ ok: false, motivo, parametri: parametri || {} });
	const lista = Array.isArray(pallets) ? pallets : [];
	const pallet = lista.find(p => Number(p.ID) === Number(palletId));
	if (!pallet) return no('palletOnRobot.err.palletGone', { id: palletId });
	// cella in HOLD e comandi attivi, come per Reimposta stato cella
	if (Number(robotStatus) !== dataStored.status_hold) return no('palletOnRobot.err.notHold');
	// il 35 annullerebbe la missione: se il pannello lo sa, si ferma
	if (missioneInCorso) return no('palletOnRobot.err.mission');
	// pinza a bordo: sensore E database
	const righe = Array.isArray(righePinza) ? righePinza.filter(r => r && r.ID != null) : [];
	const s = sensori || {};
	if (s.mounted !== 1) return no('palletOnRobot.err.noGripperSensor');
	if (righe.length === 0) return no('palletOnRobot.err.noGripperDb');
	// la pinza da dichiarare e' quella che il PLC ha registrata come lato 1
	// (GRIPPER/REGISTERED): il 35 mette in Gripper_ID[1] l'ID ricevuto, e per
	// una pinza doppia la riga sbagliata scambierebbe i lati. Se il PLC non ne
	// ha una, o non e' fra quelle a bordo nel DB, e' un'incoerenza da
	// sistemare con Reimposta stato cella.
	const pinza = Number(s.registered);
	if (!(pinza > 0) || !righe.some(r => Number(r.ID) === pinza))
		return no('palletOnRobot.err.gripperMismatch', { registered: pinza > 0 ? pinza : '-', db: righe.map(r => r.ID).join(', ') });
	// regola RATIFICATA: chele aperte = niente in mano
	if (s.closed1 === 0) return no('palletOnRobot.err.clawsOpen');
	// un solo pallet a bordo: il 35 scrive POS_PLANT=1000 senza liberare l'altro
	const altro = lista.find(p => Number(p.POS_PLANT) === 1000 && Number(p.ID) !== Number(pallet.ID));
	if (altro) return no('palletOnRobot.err.otherOnBoard', { name: nomePallet(altro) });
	// lato 2: la gemella a bordo (pinza doppia) col suo contenuto attuale; una
	// pinza a un lato solo ha una riga sola, e il lato 2 vale 0
	const gemella = righe.find(r => Number(r.ID) !== pinza);
	const cont2 = gemella ? contenutoLato(gemella.STATUS) : 0;
	if (cont2 === null) return no('palletOnRobot.err.side2Unknown', { id: gemella.ID, status: gemella.STATUS });
	// pallet in macchina: POS_PLANT 100+n, oppure il registro della macchina.
	// (7/10) la guardia del 41 di «Rimuovi»: prima il 41 partiva anche con un
	// altro pallet nel registro (e lo toglieva) o col registro non letto
	const g = guardia41({ palletId: pallet.ID, posPlant: pallet.POS_PLANT, registro: s.mc1Pallet });
	if (!g.ok) return no(g.motivo, g.parametri);
	const mc = g.mc;
	return {
		ok: true,
		pallet,
		pinza,
		cont2,
		mc,
		cmd41: mc > 0 ? { unit: 'MC' + mc, cmd: '41' } : null,
		cmd35: { unit: 'ROBOT', cmd: '35;' + pinza + ';3;' + Number(pallet.ID) + ';' + cont2 + ';0' },
	};
}

// I sensori della pinza e il registro della macchina, dallo snapshot del
// backend (GRIPPER/REQUEST_SNAPSHOT ripubblica MOUNTED, CLOSED1, REGISTERED
// e DECLARE/MC1). Risolve con quello che e' arrivato entro ms; un valore
// mancante resta undefined e le guardie lo trattano come non noto.
// NB: si chiede PRIMA di mandare 41 e 35, mai durante l'attesa di un'eco: lo
// snapshot ripete anche le ultime DECLARE/*, che sembrerebbero conferme.
export function leggiSensori(socket, ms = SENSORI_MS) {
	return new Promise(resolve => {
		const v = {};
		const num = x => { const n = parseInt(String(x).trim(), 10); return Number.isInteger(n) ? n : undefined; };
		const h = {
			'GRIPPER/MOUNTED': x => { v.mounted = num(x); },
			'GRIPPER/CLOSED1': x => { v.closed1 = num(x); },
			'GRIPPER/REGISTERED': x => { v.registered = num(x); },
			'DECLARE/MC1': x => { v.mc1Pallet = num(String(x).split(';')[0]); },
		};
		const tutti = () => ['mounted', 'closed1', 'registered', 'mc1Pallet'].every(k => v[k] !== undefined);
		// gli handler registrati sono queste funzioni: l'off usa lo stesso riferimento
		const registrati = {};
		let chiuso = false;
		const fine = () => {
			if (chiuso) return;
			chiuso = true;
			clearTimeout(t);
			for (const [e, f] of Object.entries(registrati)) socket.off(e, f);
			resolve(v);
		};
		for (const [e, f] of Object.entries(h)) {
			registrati[e] = x => { f(x); if (tutti()) fine(); };
			socket.on(e, registrati[e]);
		}
		const t = setTimeout(fine, ms);
		socket.emit('GRIPPER/REQUEST_SNAPSHOT');
	});
}

// Manda il piano: prima il 41 (se il pallet e' in macchina) e la sua eco,
// poi il 35 e la sua eco. Si ferma al primo passo che non conferma.
// Il 41 e l'attesa delle eco sono quelli di util/palletMachine.js (la stessa
// logica della pagina Macchine e del Posiziona): qui NON si fa la scrittura
// REST che li' segue il 41, perche' POS_PLANT lo scrive il 35.
// Risolve { ok, fase: '41'|'35', codice, scaduto }.
export async function eseguiDichiarazione(socket, piano, opz = {}) {
	if (piano.cmd41) {
		const r = await mandaComandoPallet(socket, { mc: piano.mc, tipo: 'clear', ms: opz.ms41 || ECO_41_MS });
		if (!r.ok) return Object.assign({ fase: '41' }, r);
	}
	const eco35 = aspettaEco(socket, {
		// eco DECLARE/ROBOT "Gripper_ID[1];cont1;cont2" (stato 70)
		evento: 'DECLARE/ROBOT',
		coerente: p => {
			const x = p.split(';').map(v => parseInt(v, 10));
			return x[0] === piano.pinza && x[1] === 3 && x[2] === piano.cont2;
		},
		allarme: 'ALARM/ROBOT',
		codici: RIFIUTI_35,
		ms: opz.ms35 || ECO_35_MS,
	});
	socket.emit('TO_PLANT/CMD/' + piano.cmd35.unit, piano.cmd35.cmd);
	const r = await eco35;
	return Object.assign({ fase: '35' }, r);
}

// Tutto il giro, dalla conferma: dati freschi, guardie, comandi, eco.
// Risolve { ok, motivo, parametri, fase, codice, scaduto, piano }:
//   - guardia non passata: ok false, motivo (chiave i18n) e parametri;
//   - comando non confermato: ok false, fase, codice (rifiuto) o scaduto.
export async function dichiaraPalletABordo({ server, socket, palletId, missioneInCorso, fetchFn, opz }) {
	const f = fetchFn || fetch;
	const get = url => f(server + url, { method: 'GET' }).then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); });
	let robot, righePinza, pallets;
	try {
		[robot, righePinza, pallets] = await Promise.all([
			get('api/unit/show/robot'), get('api/conf/gripper/onrobot'), get('api/conf/pallet/show/all'),
		]);
	} catch (e) {
		return { ok: false, motivo: 'palletOnRobot.err.read', parametri: {} };
	}
	const r0 = Array.isArray(robot) ? robot[0] : robot;
	const sensori = await leggiSensori(socket, (opz && opz.msSensori) || SENSORI_MS);
	const piano = pianoDichiarazione({
		palletId, pallets, robotStatus: r0 ? r0.STATUS : null, missioneInCorso: !!missioneInCorso, righePinza, sensori,
	});
	if (!piano.ok) return piano;
	const esito = await eseguiDichiarazione(socket, piano, opz);
	return Object.assign({ piano }, esito);
}

// Il messaggio da mostrare per un esito non riuscito: guardia, rifiuto del
// PLC (i testi esistenti di Reimposta stato cella) o eco mancante.
export function messaggioEsito(esito) {
	if (esito.motivo) return { chiave: esito.motivo, parametri: esito.parametri || {} };
	if (esito.codice) return { chiave: 'robot.declErr.' + esito.codice, parametri: {} };
	return { chiave: esito.fase === '41' ? 'palletOnRobot.err.noEcho41' : 'robot.decl.noEcho', parametri: {} };
}
