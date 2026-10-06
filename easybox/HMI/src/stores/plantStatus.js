// ============================================================================
// stores/plantStatus.js — stato dell'impianto per la striscia di stato v3
//
// SOLO DATI CHE ESISTONO GIA'. Le stesse fonti che usano oggi units.vue
// (Dashboard) e robotView:
//   - eventi socket ROBOT/STATUS, MC1/STATUS, MC2/STATUS, BOX/STATUS
//     (codici di [UNIT].STATUS, costanti in data.js), ROBOT/DESCR (codice
//     allarme robot), TRAY/EXTRACT (piano del cassetto fuori, 0 = nessuno);
//   - all'avvio: GET api/unit/show/all (stati) e api/conf/tray/show/all
//     (EXTRACT = 1 sul cassetto fuori), sola lettura;
//   - replay della cache del backend con UNIT/STATUS/REQUEST, come fa
//     units.vue al mount e a ogni riconnessione (non arriva al PLC: il
//     refresh verso il PLC resta quello globale di plantGlobals.js).
// Niente comandi, niente valori stimati: quello che non ha fonte (ciclo
// MC1 in %, stato del PLC) qui non c'e' e la striscia non lo mostra.
//
// start/stop contati: la shell li chiama al mount/unmount; i listener sono
// nominati e si staccano con off specifico.
// ============================================================================
import { reactive } from 'vue';
import { dataStored } from '../data.js';

export const plant = reactive({
	robot: null,        // codice STATUS robot (null = non ancora noto)
	mc1: null,
	mc2: null,
	box: null,
	robotAlarm: '',     // ROBOT/DESCR: codice allarme robot
	trayOut: null,      // piano del cassetto fuori; 0 = nessuno; null = non noto
});

const num = p => { const n = parseInt(String(p).trim(), 10); return Number.isInteger(n) ? n : null; };
const H = {
	'ROBOT/STATUS': p => { plant.robot = num(p); },
	'MC1/STATUS': p => { plant.mc1 = num(p); },
	'MC2/STATUS': p => { plant.mc2 = num(p); },
	'BOX/STATUS': p => { plant.box = num(p); },
	'ROBOT/DESCR': p => { plant.robotAlarm = String(p == null ? '' : p).trim(); },
	'TRAY/EXTRACT': p => { const n = num(p); if (n !== null) plant.trayOut = n; },
};
const requestSnapshots = () => {
	for (const u of ['ROBOT', 'MC1', 'MC2', 'BOX'])
		dataStored.WS.socket.emit('UNIT/STATUS/REQUEST', u);
};

function loadInitial() {
	fetch(dataStored.server + 'api/unit/show/all', { method: 'GET' })
		.then(r => { if (!r.ok) throw new Error('unit/show/all ' + r.status); return r.json(); })
		.then(rows => {
			for (const r of rows || []) {
				const u = String(r.UNIT || '').trim().toUpperCase();
				const k = u === 'ROBOT' ? 'robot' : u === 'MC1' ? 'mc1' : u === 'MC2' ? 'mc2' : (u === 'BOX' || u === 'SMALLBOX') ? 'box' : null;
				// l'evento live, se e' gia' arrivato, vince sulla lettura iniziale
				if (k && plant[k] === null) plant[k] = num(r.STATUS);
				if (k === 'robot' && !plant.robotAlarm && r.DESCR != null) plant.robotAlarm = String(r.DESCR).trim();
			}
		})
		.catch(e => console.info('plantStatus: ' + e.message));
	fetch(dataStored.server + 'api/conf/tray/show/all', { method: 'GET' })
		.then(r => { if (!r.ok) throw new Error('tray/show/all ' + r.status); return r.json(); })
		.then(rows => {
			if (plant.trayOut !== null) return;
			const fuori = (rows || []).find(t => Number(t.EXTRACT) === 1);
			plant.trayOut = fuori ? Number(fuori.FLOOR_MAG) : 0;
		})
		.catch(e => console.info('plantStatus: ' + e.message));
}

let utenti = 0;
export function startPlantStatus() {
	if (utenti++ > 0) return;
	const s = dataStored.WS && dataStored.WS.socket;
	if (!s) return;
	for (const [ev, h] of Object.entries(H)) s.on(ev, h);
	s.on('connect', requestSnapshots);
	requestSnapshots();
	loadInitial();
}
export function stopPlantStatus() {
	if (--utenti > 0) return;
	utenti = 0;
	const s = dataStored.WS && dataStored.WS.socket;
	if (!s) return;
	for (const [ev, h] of Object.entries(H)) s.off(ev, h);
	s.off('connect', requestSnapshots);
}

// Allarmi ATTIVI per la campanella e il badge della barra: le unita' che
// oggi sono nello stato di allarme (STATUS = status_alarm). E' l'unico
// "attivo" che il pannello conosce davvero: l'elenco di api/alarm/show/all
// e' uno storico (ultime righe di LOG), senza un "risolto".
export function activeAlarmUnits(conMc2) {
	const out = [];
	if (plant.robot === dataStored.status_alarm) out.push('ROBOT');
	if (plant.mc1 === dataStored.status_alarm) out.push('MC1');
	if (conMc2 && plant.mc2 === dataStored.status_alarm) out.push('MC2');
	if (plant.box === dataStored.status_alarm) out.push('BOX');
	return out;
}
