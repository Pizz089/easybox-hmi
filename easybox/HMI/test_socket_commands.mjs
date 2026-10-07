// ============================================================================
// test_socket_commands.mjs — i comandi non partono a pannello scollegato
// (7/10 sera, simulazione bis B54)
//
// Col client socket.io VERO del pannello (public/socket.io.min.js, 4.8.1) e
// il server socket.io del backend (serverDati/node_modules), su una porta
// locale qualunque di 127.0.0.1:
//   1. collegato: comandi e richieste passano;
//   2. scollegato: emit di TO_PLANT/CMD/... e di snapshot/refresh, poi la
//      riconnessione: arrivano le richieste, nessun comando;
//   3. dropBufferedCommands sul buffer vero di socket.io (pacchetti fatti
//      dal client stesso): via i comandi, restano le richieste;
//   4. App.vue mette la guardia dove nasce il socket; la barra dice
//      «Pannello scollegato: i comandi non partono».
//
// Uso:   node test_socket_commands.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { guardOfflineCommands, dropBufferedCommands, isCommand, CMD_PREFIX } from './src/util/socketCommands.js';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const dorme = ms => new Promise(r => setTimeout(r, ms));
const aspetta = async (cond, ms = 4000) => { const fine = Date.now() + ms; while (Date.now() < fine) { if (cond()) return true; await dorme(20); } return cond(); };

// il client del pannello, cosi' com'e' (UMD): copiato in un .cjs per require
const tmp = mkdtempSync(join(tmpdir(), 'socket-cmd-'));
const clientCjs = join(tmp, 'socket.io.cjs');
writeFileSync(clientCjs, readFileSync('public/socket.io.min.js'));
const io = createRequire(import.meta.url)(clientCjs);
const { Server } = createRequire(new URL('../serverDati/package.json', import.meta.url))('socket.io');

const httpServer = http.createServer();
await new Promise(r => httpServer.listen(0, '127.0.0.1', r));
const porta = httpServer.address().port;
const srv = new Server(httpServer);
const ricevuti = [];
srv.on('connection', s => s.onAny(ev => ricevuti.push(ev)));

const scartati = [];
const socket = guardOfflineCommands(io('http://127.0.0.1:' + porta, { transports: ['websocket'], reconnectionDelay: 100, reconnectionDelayMax: 200 }), { onDrop: (ev, n) => scartati.push([ev, n]) });

try {
	console.log('1) collegato');
	check(CMD_PREFIX === 'TO_PLANT/CMD/' && isCommand('TO_PLANT/CMD/ROBOT') && !isCommand('GRIPPER/REQUEST_SNAPSHOT') && !isCommand('PLC/REFRESH_REQUEST'), 'comando = evento che comincia con TO_PLANT/CMD/');
	check(await aspetta(() => socket.connected), 'client collegato al server socket.io');
	socket.emit('TO_PLANT/CMD/ROBOT', '17');
	socket.emit('GRIPPER/REQUEST_SNAPSHOT');
	check(await aspetta(() => ricevuti.length === 2) && ricevuti.join() === 'TO_PLANT/CMD/ROBOT,GRIPPER/REQUEST_SNAPSHOT' && scartati.length === 0, 'collegato: il comando e la richiesta passano come prima');

	console.log('\n2) scollegato, poi la riconnessione');
	ricevuti.length = 0;
	socket.io.engine.close();               // il trasporto cade: socket.io si riconnettera' da solo
	check(await aspetta(() => !socket.connected), 'scollegato');
	socket.emit('TO_PLANT/CMD/ROBOT', '11;26');
	socket.emit('TO_PLANT/CMD/BOX', '25;8');
	socket.emit('GRIPPER/REQUEST_SNAPSHOT');
	socket.emit('PLC/REFRESH_REQUEST');
	check(!socket.sendBuffer.some(p => isCommand(p.data[0])) && socket.sendBuffer.length === 2, 'da scollegato i comandi non entrano nel buffer, le due richieste si\'');
	check(scartati.length === 2 && scartati.every(([ev]) => isCommand(ev)), 'onDrop avvisato per i due comandi scartati');
	check(await aspetta(() => socket.connected), 'riconnesso');
	await aspetta(() => ricevuti.length >= 2, 2000);
	await dorme(200);
	check(ricevuti.join() === 'GRIPPER/REQUEST_SNAPSHOT,PLC/REFRESH_REQUEST', 'alla riconnessione arrivano le richieste di snapshot e refresh, nessun TO_PLANT/CMD (' + ricevuti.join(', ') + ')');

	console.log('\n3) il buffer vero di socket.io');
	const spento = io('http://127.0.0.1:' + porta, { transports: ['websocket'], autoConnect: false });
	spento.emit('TO_PLANT/CMD/MC1', '12');
	spento.emit('UNIT/STATUS/REQUEST');
	spento.emit('TO_PLANT/CMD/ORDER', '{"id":1}');
	check(spento.sendBuffer.length === 3 && spento.sendBuffer.every(p => Array.isArray(p.data)), 'senza guardia, socket.io tiene in coda tutto (3 pacchetti, data = [evento, ...])');
	const tolti = dropBufferedCommands(spento);
	check(tolti === 2 && spento.sendBuffer.length === 1 && spento.sendBuffer[0].data[0] === 'UNIT/STATUS/REQUEST', 'dropBufferedCommands: via i 2 comandi, resta la richiesta');
	check(dropBufferedCommands({ sendBuffer: [] }) === 0 && dropBufferedCommands({}) === 0, 'buffer vuoto o assente: niente da togliere');
	spento.close();
	check(guardOfflineCommands(socket) === socket && socket.__guardiaComandi === true, 'la guardia non si mette due volte');

	console.log('\n4) dove sta, e l\'avviso');
	const app = readFileSync('src/App.vue', 'utf8');
	check(/import \{ guardOfflineCommands \} from '\.\/util\/socketCommands\.js'/.test(app) && /dataStored\.WS\.socket = guardOfflineCommands\(io\(dataStored\.WS\.brokerURL\)\)/.test(app), 'App.vue: la guardia dove nasce il socket, un punto solo');
	const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
	check(it.shell && it.shell.offline === 'Pannello scollegato: i comandi non partono' && en.shell && /disconnected/.test(en.shell.offline), 'testo «Pannello scollegato: i comandi non partono» (it, en)');
	const avvisi = ['src/components/barraInAlto.vue', 'src/layout/v3/StatusStrip.vue'].filter(f => { try { readFileSync(f); return true; } catch (e) { return false; } });
	check(avvisi.length > 0 && avvisi.every(f => /\$t\('shell\.offline'\)/.test(readFileSync(f, 'utf8'))), 'avviso visibile a pannello scollegato: ' + avvisi.join(', '));
} finally {
	socket.close();
	srv.close();
	httpServer.close();
	rmSync(tmp, { recursive: true, force: true });
}

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
