// ============================================================================
// test_haas.js — test del dispatch ricetta HAAS via MQTT
// Simula quello che fa il PLC: pubblica un comando setMacro e attende l'ack.
//
// Uso:   node test_haas.js
//        node test_haas.js 3        (per provare la ricetta 3 invece di 1)
//
// Richiede il backend in esecuzione (node server.js) con la patch HAAS_CMD.
// ============================================================================

const mqtt = require('mqtt');

// --- parametri ---
// stesso broker del backend; override via env per girare su dev (stessa
// convenzione MQTT_BROKER_URL di MQTT_Client.js)
const BROKER = process.env.MQTT_BROKER_URL || 'mqtt://HMI:HMI@172.20.70.80:9001';
const MC     = 'MC1';
const VAR    = 10200;                                 // macro ricetta
const VALUE  = Number(process.argv[2] || 1);          // ricetta da inviare (default 1)

console.log('1. Avvio script...');
console.log('2. Connessione a', BROKER);

const client = mqtt.connect(BROKER, { clientId: 'TEST_' + Math.random().toString(16).substr(2, 8) });

client.on('connect', () => {
  console.log('3. ✓ CONNESSO al broker');

  // l'esito arriva sotto TO_PLANT/CMD/ (il PLC è sottoscritto a TO_PLANT/CMD/#):
  // HAAS_ACK per esito ok, HAAS_NACK per esito ko (vedi publishHaasAck).
  // Sottoscrivo entrambi: un ko deve essere stampato come NACK, non
  // confuso col timeout del test.
  client.subscribe(['TO_PLANT/CMD/HAAS_ACK/' + MC, 'TO_PLANT/CMD/HAAS_NACK/' + MC], { qos: 1 }, (err) => {
    if (err) console.log('   ✗ Errore subscribe:', err.message);
    else     console.log('4. ✓ Sottoscritto a TO_PLANT/CMD/HAAS_ACK|HAAS_NACK/' + MC);
  });

  const payload = JSON.stringify({ cmd: 'setMacro', var: VAR, value: VALUE });
  client.publish('FROM_PLANT/HAAS_CMD/' + MC, payload, { qos: 2 }, (err) => {
    if (err) console.log('   ✗ Errore publish:', err.message);
    else     console.log('5. ✓ PUBBLICATO su FROM_PLANT/HAAS_CMD/' + MC + ':', payload);
  });
});

client.on('message', (topic, msg) => {
  const esito = topic.indexOf('HAAS_NACK') !== -1 ? '✗✗ NACK RICEVUTO' : '✓✓ ACK RICEVUTO';
  console.log('6.', esito, '→', topic, '=', msg.toString());
  client.end();
  process.exit(0);
});

client.on('error',     (e) => console.log('   ✗ ERRORE broker:', e.message));
client.on('close',     ()  => console.log('   · connessione chiusa'));
client.on('offline',   ()  => console.log('   · client offline (broker non raggiungibile?)'));
client.on('reconnect', ()  => console.log('   · tentativo riconnessione...'));

setTimeout(() => {
  console.log('7. --- timeout 10s, nessun ack ---');
  client.end();
  process.exit(0);
}, 10000);