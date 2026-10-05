// ============================================================================
// tools/haas-probe-live.js — SONDA LIVE del dispatch ricetta HAAS via MQTT
//
// NON e' un test: pubblica un comando VERO. Simula quello che fa il PLC
// (setMacro su FROM_PLANT/HAAS_CMD/MC1) e il backend collegato a quel broker
// SCRIVE la macro sulla HAAS della macchina, poi risponde con l'ack.
//
// Era serverDati/test_haas.js: col nome test_ finiva nei cicli "lancia tutti
// i test", e il 5/10/2026 ha scritto la #10200 sulla HAAS MC1 della cella
// durante le prove PLC (docs/APPUNTI-CELLA.md). Da allora:
//   - sta fuori da test_*: nessun ciclo sui test la prende;
//   - nessun broker di default: senza MQTT_BROKER_URL esce con errore;
//   - senza --live esce con errore PRIMA di collegarsi: niente pubblicato.
//
// Richiede il backend in esecuzione (node server.js) con la patch HAAS_CMD.
//
// Uso (dalla cartella easybox/serverDati):
//   bash:        MQTT_BROKER_URL=mqtt://utente:password@host:porta node tools/haas-probe-live.js --live
//   PowerShell:  $env:MQTT_BROKER_URL='mqtt://utente:password@host:porta'; node tools/haas-probe-live.js --live
//   ricetta 3 invece di 1: aggiungere 3 dopo --live
// ============================================================================

// --- guardie: prima di tutto, prima di qualsiasi connessione ---
const args   = process.argv.slice(2);
const LIVE   = args.includes('--live');
const extra  = args.filter(a => a !== '--live');
const BROKER = (process.env.MQTT_BROKER_URL || '').trim();

if (!BROKER) {
  console.error('ERRORE: MQTT_BROKER_URL non impostato. Questa sonda non ha un broker di default:');
  console.error('        il broker va scritto a mano ogni volta. Nessuna connessione, niente pubblicato.');
  process.exit(1);
}
if (!LIVE) {
  console.error('ERRORE: manca --live. La sonda scrive una macro VERA sulla HAAS collegata a');
  console.error('        ' + BROKER.replace(/\/\/([^:@/]+):[^@/]*@/, '//$1:***@') + ': senza --live non si collega e non pubblica niente.');
  process.exit(1);
}
if (extra.length > 1 || (extra.length === 1 && !Number.isFinite(Number(extra[0])))) {
  console.error('ERRORE: argomenti non validi: ' + extra.join(' ') + '. Uso: --live [ricetta]. Niente pubblicato.');
  process.exit(1);
}

const mqtt = require('mqtt');

// --- parametri ---
const MC     = 'MC1';
const VAR    = 10200;                                     // macro ricetta
const VALUE  = extra.length ? Number(extra[0]) : 1;       // ricetta da inviare (default 1)

console.log('1. Avvio sonda LIVE: setMacro #' + VAR + ' = ' + VALUE + ' su ' + MC);
// password mascherata nel log
console.log('2. Connessione a', BROKER.replace(/\/\/([^:@/]+):[^@/]*@/, '//$1:***@'));

// clientId riconoscibile nei log del broker
const client = mqtt.connect(BROKER, { clientId: 'HAAS_PROBE_LIVE_' + Math.random().toString(16).substr(2, 8) });

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