// ============================================================================
// test_mqtt_offline.js — un comando a broker giu' va perso, non ritardato
// (7/10 sera, simulazione bis B54)
//
// Di default mqtt.js tiene in coda le pubblicazioni QoS 0 fatte senza broker
// e le spedisce alla riconnessione: un TO_PLANT/CMD dato minuti prima
// partirebbe da solo. MQTT_Client.js apre il client con queueQoSZero: false.
//   1. il sorgente: mqtt.connect con queueQoSZero: false;
//   2. mqtt.js vero (la versione del backend), senza broker: col default la
//      pubblicazione resta in coda, con queueQoSZero: false no, e chi
//      pubblica riceve l'errore.
//
// Uso:   node test_mqtt_offline.js
// Nessun broker: il client punta a una porta chiusa di 127.0.0.1 e non si
// riconnette (reconnectPeriod 0).
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
const fs = require('fs');
const path = require('path');
const net = require('net');
const mqtt = require('mqtt');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

console.log('1) MQTT_Client.js');
const src = fs.readFileSync(path.join(__dirname, 'MQTT_Client.js'), 'utf8');
// ^ con /m: non la riga commentata (//const client = mqtt.connect(...)) sopra
const connect = (src.match(/^const client = mqtt\.connect\([\s\S]*?\);/m) || [''])[0];
check(/queueQoSZero:\s*false/.test(connect), 'mqtt.connect con queueQoSZero: false');
check(/publish\("TO_PLANT\/CMD\/ROBOT", cmd\.toString\(\)\)/.test(src), 'i comandi del pannello si pubblicano QoS 0 (nessuna opzione qos): valgono le regole della coda QoS 0');

// una porta locale sicuramente chiusa
function portaChiusa() {
	return new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
}

(async () => {
	console.log('\n2) mqtt.js ' + require('mqtt/package.json').version + ' senza broker');
	const porta = await portaChiusa();
	const prova = (opzioni) => new Promise(resolve => {
		const c = mqtt.connect('mqtt://127.0.0.1:' + porta, Object.assign({ reconnectPeriod: 0, connectTimeout: 500 }, opzioni));
		c.on('error', () => {});
		let errore = null;
		c.publish('TO_PLANT/CMD/ROBOT', '17', err => { errore = err || null; });
		setTimeout(() => { const coda = c.queue.length; c.end(true); resolve({ coda, errore }); }, 300);
	});
	const def = await prova({});
	check(def.coda === 1, 'col default il comando resta in coda per la riconnessione (' + def.coda + ')');
	const nostro = await prova({ queueQoSZero: false });
	check(nostro.coda === 0 && nostro.errore && /No connection to broker/.test(nostro.errore.message), 'con queueQoSZero: false niente coda, e chi pubblica riceve «' + (nostro.errore && nostro.errore.message) + '»');
	console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
	process.exit(failed ? 1 : 0);
})();
