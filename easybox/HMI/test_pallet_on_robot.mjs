// ============================================================================
// test_pallet_on_robot.mjs — dichiarare un pallet «a bordo del robot» (7/10)
//
// util/palletOnRobot.js con socket e fetch finti:
//   1. comandi esatti (41 e 35) e il loro ordine; il 35 parte solo dopo
//      l'eco del 41;
//   2. ogni guardia (nessun comando oltre alla richiesta di snapshot);
//   3. eco riuscita, rifiuti (947 sul 41; 944/945/946 sul 35), timeout, eco
//      non coerente;
//   4. nessuna scrittura diretta: mai updatePallet, mai POS_PLANT=1000;
//   (7/10) il 41 passa dalla guardia di «Rimuovi» (guardia41): con un altro
//   pallet nel registro, o col registro non letto, nessun comando; col
//   registro gia' a 0 niente 41;
//   5. le due pagine (Attrezzaggi, Robot) usano lo STESSO modulo.
//
// Uso:   node test_pallet_on_robot.mjs
// ============================================================================
import { readFileSync } from 'node:fs';

globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const M = await server.ssrLoadModule('/src/util/palletOnRobot.js');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const HOLD = dataStored.status_hold;
const OPZ = { ms41: 60, ms35: 60, msSensori: 40 };

// ---------------------------------------------------------------- scenario
// sensori: risposta allo snapshot; risp41 / risp35: 'eco' | numero (allarme)
// | 'zitto' | stringa di eco diversa (non coerente)
function scenario(o) {
	const s = Object.assign({
		robot: [{ UNIT: 'ROBOT', STATUS: HOLD }],
		righe: [{ ID: 50, STATUS: dataStored.status_empty, SUB_POS: 0 }],
		pallets: [{ ID: 901, FAMILY: 'PAL-A', POS_PLANT: 0, MAG_POS: 4 }, { ID: 902, FAMILY: 'PAL-B', POS_PLANT: 0, MAG_POS: 5 }],
		sensori: { 'GRIPPER/MOUNTED': '1', 'GRIPPER/CLOSED1': '1', 'GRIPPER/REGISTERED': '50', 'DECLARE/MC1': '0;0;0' },
		risp41: 'eco', risp35: 'eco', fetchKo: false,
	}, o);
	const handlers = new Map();
	const emessi = [];
	const consegna = (e, p) => setTimeout(() => { for (const f of [...(handlers.get(e) || [])]) f(p); }, 2);
	const socket = {
		on(e, f) { if (!handlers.has(e)) handlers.set(e, new Set()); handlers.get(e).add(f); },
		off(e, f) { if (handlers.has(e)) handlers.get(e).delete(f); },
		emit(e, p) {
			emessi.push(p === undefined ? e : e + ' ' + p);
			if (e === 'GRIPPER/REQUEST_SNAPSHOT') { for (const [k, v] of Object.entries(s.sensori)) if (v !== undefined) consegna(k, v); return; }
			if (e === 'TO_PLANT/CMD/MC1' && p === '41') {
				if (s.risp41 === 'eco') consegna('DECLARE/MC1', '0;0;0');
				else if (typeof s.risp41 === 'number') consegna('ALARM/MC1', String(s.risp41));
				else if (s.risp41 !== 'zitto') consegna('DECLARE/MC1', s.risp41);
				return;
			}
			if (e === 'TO_PLANT/CMD/ROBOT' && String(p).startsWith('35;')) {
				const x = String(p).split(';');
				if (s.risp35 === 'eco') consegna('DECLARE/ROBOT', x[1] + ';' + x[2] + ';' + x[4]);
				else if (typeof s.risp35 === 'number') consegna('ALARM/ROBOT', String(s.risp35));
				else if (s.risp35 !== 'zitto') consegna('DECLARE/ROBOT', s.risp35);
			}
		},
		ascoltatori: () => [...handlers.values()].reduce((n, x) => n + x.size, 0),
	};
	const chiamate = [];
	const fetchFn = async (url) => {
		const u = String(url);
		chiamate.push(u);
		if (s.fetchKo) return { ok: false, json: async () => [] };
		const j = /unit\/show\/robot/.test(u) ? s.robot : /gripper\/onrobot/.test(u) ? s.righe : /pallet\/show\/all/.test(u) ? s.pallets : [];
		return { ok: true, json: async () => j, text: async () => 'OK' };
	};
	return { s, socket, emessi, chiamate, fetchFn };
}
async function dichiara(o, palletId = 901, missione = false) {
	const sc = scenario(o);
	const esito = await M.dichiaraPalletABordo({ server: 'http://x/', socket: sc.socket, palletId, missioneInCorso: missione, fetchFn: sc.fetchFn, opz: OPZ });
	return Object.assign(sc, { esito, cmd: sc.emessi.filter(e => e.startsWith('TO_PLANT/')) });
}
const nessunaScrittura = sc => !sc.chiamate.some(u => /updatePallet|POS_PLANT=1000|POS_PLANT%3D1000/.test(u));

console.log('1) comandi esatti e ordine');
let r = await dichiara({});
check(r.esito.ok && JSON.stringify(r.cmd) === JSON.stringify(['TO_PLANT/CMD/ROBOT 35;50;3;901;0;0']),
	'pallet a magazzino, pinza a un lato: solo il 35 "35;50;3;901;0;0" (' + r.cmd.join(' | ') + ')');
check(r.emessi[0] === 'GRIPPER/REQUEST_SNAPSHOT', '   prima i sensori freschi (snapshot), poi il comando');
check(nessunaScrittura(r) && r.chiamate.length === 3, '   nessuna scrittura: solo le tre letture (robot, pinza a bordo, pallet)');
check(r.socket.ascoltatori() === 0, '   nessun ascoltatore lasciato appeso sul socket');

// registro della macchina sul pallet: '901;0;1' (pallet 901, pezzo in macchina)
const SENS = reg => ({ 'GRIPPER/MOUNTED': '1', 'GRIPPER/CLOSED1': '1', 'GRIPPER/REGISTERED': '50', 'DECLARE/MC1': reg });
const SENZA_REGISTRO = { 'GRIPPER/MOUNTED': '1', 'GRIPPER/CLOSED1': '1', 'GRIPPER/REGISTERED': '50' };
const IN_MC = [{ ID: 901, FAMILY: 'PAL-A', POS_PLANT: 101, MAG_POS: 4 }];
r = await dichiara({ pallets: IN_MC, sensori: SENS('901;0;1') });
check(r.esito.ok && JSON.stringify(r.cmd) === JSON.stringify(['TO_PLANT/CMD/MC1 41', 'TO_PLANT/CMD/ROBOT 35;50;3;901;0;0']),
	'pallet in macchina (POS_PLANT 101, nel registro): prima il 41 a MC1, poi il 35 (' + r.cmd.join(' | ') + ')');
r = await dichiara({ pallets: IN_MC, sensori: SENS('0;0;0') });
check(r.esito.ok && JSON.stringify(r.cmd) === JSON.stringify(['TO_PLANT/CMD/ROBOT 35;50;3;901;0;0']),
	'   POS_PLANT 101 ma registro gia\' a 0: niente 41 (azzererebbe il pezzo in macchina), solo il 35, come «Rimuovi»');
r = await dichiara({ sensori: SENZA_REGISTRO });
check(r.esito.ok && JSON.stringify(r.cmd) === JSON.stringify(['TO_PLANT/CMD/ROBOT 35;50;3;901;0;0']),
	'   pallet a magazzino e registro non letto: nessun 41 da mandare, il 35 parte');
r = await dichiara({ sensori: { 'GRIPPER/MOUNTED': '1', 'GRIPPER/CLOSED1': '1', 'GRIPPER/REGISTERED': '50', 'DECLARE/MC1': '901;0;1' } });
check(r.esito.ok && r.cmd[0] === 'TO_PLANT/CMD/MC1 41' && r.cmd.length === 2, 'POS_PLANT 0 ma nel registro della macchina (DECLARE/MC1 "901;..."): anche il 41');
r = await dichiara({ righe: [{ ID: 26, STATUS: dataStored.status_empty }, { ID: 37, STATUS: dataStored.status_finished }], sensori: { 'GRIPPER/MOUNTED': '1', 'GRIPPER/CLOSED1': '1', 'GRIPPER/REGISTERED': '26', 'DECLARE/MC1': '0;0;0' } });
check(r.esito.ok && r.cmd[0] === 'TO_PLANT/CMD/ROBOT 35;26;3;901;2;0', 'pinza doppia (26 + 37, finito sul lato 2): lato 2 ripetuto "35;26;3;901;2;0"');
r = await dichiara({ righe: [{ ID: 26, STATUS: dataStored.status_raw }, { ID: 37, STATUS: dataStored.status_empty }], sensori: { 'GRIPPER/MOUNTED': '1', 'GRIPPER/CLOSED1': '1', 'GRIPPER/REGISTERED': '37', 'DECLARE/MC1': '0;0;0' } });
check(r.esito.ok && r.cmd[0] === 'TO_PLANT/CMD/ROBOT 35;37;3;901;1;0', '   la pinza e\' quella registrata dal PLC come lato 1 (37), il lato 2 e\' la gemella (26, grezzo)');
r = await dichiara({ pallets: [{ ID: 901, FAMILY: 'PAL-A', POS_PLANT: 1000, MAG_POS: 4 }] });
check(r.esito.ok && r.cmd.length === 1, 'pallet gia\' a 1000 (lo stesso): si ridichiara, il PLC riallinea pinza e registri');

console.log('\n2) guardie (nessun comando)');
const guardia = async (o, chiave, palletId, missione) => {
	const x = await dichiara(o, palletId, missione);
	check(!x.esito.ok && x.esito.motivo === chiave && x.cmd.length === 0 && nessunaScrittura(x), chiave + (x.esito.motivo !== chiave ? ' (era ' + x.esito.motivo + ')' : ''));
	return x;
};
await guardia({ robot: [{ UNIT: 'ROBOT', STATUS: 10 }] }, 'palletOnRobot.err.notHold');
await guardia({}, 'palletOnRobot.err.mission', 901, true);
await guardia({ sensori: { 'GRIPPER/MOUNTED': '0', 'GRIPPER/CLOSED1': '1', 'GRIPPER/REGISTERED': '50', 'DECLARE/MC1': '0;0;0' } }, 'palletOnRobot.err.noGripperSensor');
await guardia({ sensori: { 'GRIPPER/CLOSED1': '1', 'GRIPPER/REGISTERED': '50' } }, 'palletOnRobot.err.noGripperSensor');
await guardia({ righe: [] }, 'palletOnRobot.err.noGripperDb');
await guardia({ sensori: { 'GRIPPER/MOUNTED': '1', 'GRIPPER/CLOSED1': '1', 'GRIPPER/REGISTERED': '0', 'DECLARE/MC1': '0;0;0' } }, 'palletOnRobot.err.gripperMismatch');
let g = await guardia({ sensori: { 'GRIPPER/MOUNTED': '1', 'GRIPPER/CLOSED1': '1', 'GRIPPER/REGISTERED': '26', 'DECLARE/MC1': '0;0;0' } }, 'palletOnRobot.err.gripperMismatch');
check(g.esito.parametri.registered === 26 && g.esito.parametri.db === '50', '   e dice quale registra il PLC e quale e\' a bordo nel DB');
await guardia({ sensori: { 'GRIPPER/MOUNTED': '1', 'GRIPPER/CLOSED1': '0', 'GRIPPER/REGISTERED': '50', 'DECLARE/MC1': '0;0;0' } }, 'palletOnRobot.err.clawsOpen');
g = await guardia({ pallets: [{ ID: 901, FAMILY: 'PAL-A', POS_PLANT: 0 }, { ID: 902, FAMILY: 'PAL-B', POS_PLANT: 1000 }] }, 'palletOnRobot.err.otherOnBoard');
check(g.esito.parametri.name === '#902 PAL-B', '   col nome di quello gia\' a bordo (' + g.esito.parametri.name + ')');
// (7/10) la guardia del 41, la stessa di «Rimuovi» e «Casella»
g = await guardia({ pallets: IN_MC, sensori: SENS('902;0;1') }, 'palletMachine.err.otherInMachine');
check(g.esito.parametri.id === 902, '   pallet in macchina ma nel registro un ALTRO pallet: niente 41 (toglierebbe il 902), si dice quale');
await guardia({ pallets: IN_MC, sensori: SENZA_REGISTRO }, 'palletMachine.err.registerUnread');
await guardia({ righe: [{ ID: 26, STATUS: dataStored.status_empty }, { ID: 37, STATUS: dataStored.status_working }], sensori: { 'GRIPPER/MOUNTED': '1', 'GRIPPER/CLOSED1': '1', 'GRIPPER/REGISTERED': '26', 'DECLARE/MC1': '0;0;0' } }, 'palletOnRobot.err.side2Unknown');
await guardia({}, 'palletOnRobot.err.palletGone', 999);
g = await dichiara({ fetchKo: true });
check(!g.esito.ok && g.esito.motivo === 'palletOnRobot.err.read' && g.emessi.length === 0, 'palletOnRobot.err.read: lettura fallita, niente snapshot e niente comandi');

console.log('\n3) eco, rifiuti, timeout');
r = await dichiara({ pallets: [{ ID: 901, POS_PLANT: 101 }], sensori: SENS('901;0;1'), risp41: 947 });
check(!r.esito.ok && r.esito.fase === '41' && r.esito.codice === 947 && r.cmd.length === 1, '41 rifiutato (947): ci si ferma, il 35 non parte');
check(M.messaggioEsito(r.esito).chiave === 'robot.declErr.947', '   messaggio: il testo esistente del 947');
r = await dichiara({ pallets: [{ ID: 901, POS_PLANT: 101 }], sensori: SENS('901;0;1'), risp41: 'zitto' });
check(!r.esito.ok && r.esito.fase === '41' && r.esito.scaduto && r.cmd.length === 1 && M.messaggioEsito(r.esito).chiave === 'palletOnRobot.err.noEcho41', '41 senza eco: fermo, 35 non partito, messaggio dedicato');
r = await dichiara({ pallets: [{ ID: 901, POS_PLANT: 101 }], sensori: SENS('901;0;1'), risp41: '901;0;1' });
check(!r.esito.ok && r.esito.scaduto && r.cmd.length === 1, '   un\'eco DECLARE/MC1 col pallet ancora dentro non vale come conferma');
for (const c of [944, 945, 946]) {
	r = await dichiara({ risp35: c });
	check(!r.esito.ok && r.esito.fase === '35' && r.esito.codice === c && M.messaggioEsito(r.esito).chiave === 'robot.declErr.' + c, '35 rifiutato (' + c + '): testo esistente robot.declErr.' + c);
}
r = await dichiara({ risp35: 'zitto' });
check(!r.esito.ok && r.esito.scaduto && M.messaggioEsito(r.esito).chiave === 'robot.decl.noEcho', '35 senza eco: robot.decl.noEcho');
r = await dichiara({ risp35: '50;0;0' });
check(!r.esito.ok && r.esito.scaduto, '   un\'eco DECLARE/ROBOT diversa (pallet non dichiarato) non vale come conferma');
check(r.socket.ascoltatori() === 0, '   anche dopo un timeout nessun ascoltatore resta appeso');

console.log('\n4) le pagine: stesso modulo, nessuna scrittura diretta');
const att = readFileSync('src/views/conf/AttrezzaggiView.vue', 'utf8');
const rob = readFileSync('src/views/unit/robotView.vue', 'utf8');
const imp = /import \{ dichiaraPalletABordo, messaggioEsito \} from '\.\.\/\.\.\/util\/palletOnRobot\.js'/;
check(imp.test(att) && imp.test(rob), 'Attrezzaggi e Robot importano lo STESSO modulo (util/palletOnRobot.js)');
check(/const g = guardia41\(\{ palletId: pallet\.ID, posPlant: pallet\.POS_PLANT, registro: s\.mc1Pallet \}\);/.test(readFileSync('src/util/palletOnRobot.js', 'utf8')),
	'   e il 41 passa da guardia41 di util/palletMachine.js, come «Rimuovi» e «Casella»');
// corpo del metodo per graffe, senza i commenti (che PARLANO di POS_PLANT)
const metodo = (src, nome) => {
	const i = src.indexOf(nome + '(');
	if (i < 0) return '';
	let j = src.indexOf('{', src.indexOf(')', i)), n = 0, k = j;
	for (; k < src.length; k++) { if (src[k] === '{') n++; else if (src[k] === '}' && --n === 0) break; }
	return src.slice(i, k + 1).replace(/\/\/.*$/gm, '');
};
const onRobot = metodo(att, 'async confirmOnRobot'), decl = metodo(rob, 'async confirmPalletDecl');
check(onRobot && decl && [onRobot, decl].every(m => /dichiaraPalletABordo\(/.test(m) && !/'35;|'41'|updatePallet|POS_PLANT/.test(m)),
	'   i due metodi chiamano il modulo: nessun 35/41 scritto a mano, nessun updatePallet, nessun POS_PLANT');
check(/if \(sel === 'robot'\) \{ this\.confirmOnRobot\(\); return; \}/.test(att) && att.indexOf("if (sel === 'robot')") < att.indexOf("api/conf/pallet/updatePallet?"),
	'Attrezzaggi: «A bordo del robot» esce prima di updatePallet');
// (7/10) «In macchina» e «Rimuovi» scrivono dopo l'eco del PLC, con
// scriviPosizione di util/palletMachine.js: stessi valori di prima
const pmsrc = readFileSync('src/util/palletMachine.js', 'utf8');
check(/const newMagPos = sel;/.test(att) && /MAG_POS: tipo === 'set' \? row\.MAG_POS : tipo === 'casella' \? Number\(casella\) : -1,/.test(pmsrc) && /POS_PLANT: tipo === 'set' \? 100 \+ mc : 0,/.test(pmsrc),
	'   le destinazioni esistenti scrivono gli stessi valori: casella (pagina), In macchina e Rimuovi (palletMachine, dopo l\'eco)');
check(/placeSel='robot'/.test(att) && /palletOnRobot\.confirmText/.test(att), '   voce nuova nel dialog Posiziona, con il testo che dice cosa fa');
// (prompt 10, v3) la tile della dichiarazione prende il posto di «Gestione
// pallet» (v-if / v-else su palletDeclInstead); il pannello vecchio le mostra
// tutte e due
const sostituisce = /<UiTile v-if="!palletDeclInstead"[\s\S]{0,1200}?<UiTile v-else[\s\S]{0,200}openPalletDecl\(\)/.test(rob)
	&& /palletDeclInstead\(\) \{\s*return !this\.palletBranchEnabled && this\.palletDisabledReason === 'robot\.hint\.palletUnknownOnBoard';/.test(rob);
const accanto = /palletDisabledReason !== 'robot\.hint\.palletUnknownOnBoard'/.test(rob) && /palletDisabledReason === 'robot\.hint\.palletUnknownOnBoard'"[\s\S]{0,200}openPalletDecl\(\)/.test(rob);
check(sostituisce || accanto,
	'Robot: al posto dell\'avviso palletUnknownOnBoard, l\'azione «Dichiara quale pallet e\' in pinza»' + (sostituisce ? ' (v3: al posto di «Gestione pallet»)' : ''));
check(/missioneInCorso: this\.missionRunning !== ''/.test(rob), '   la pagina Robot passa la missione appena mandata (missionRunning)');
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8')), en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
const chiavi = o => Object.entries(o).flatMap(([k, v]) => typeof v === 'object' ? chiavi(v).map(x => k + '.' + x) : [k]);
check(JSON.stringify(chiavi(it.palletOnRobot)) === JSON.stringify(chiavi(en.palletOnRobot)) && /ANNULLA le missioni in corso/.test(it.palletOnRobot.confirmText),
	'testi it/en con le stesse chiavi; la conferma dice che annulla le missioni in corso');
const modulo = readFileSync('src/util/palletOnRobot.js', 'utf8').replace(/\/\/.*$/gm, '');
check(!/updatePallet|fetch\([^)]*POS_PLANT/.test(modulo) && /UPDATE Pallet SET POS_PLANT=1000/.test(readFileSync('../../plc/FB/FB_Robot.scl', 'utf8')),
	'il modulo non scrive il DB; POS_PLANT=1000 lo scrive il PLC col 35 (FB_Robot, stato 68)');

await server.close();
console.log(failed ? `\n${failed} CHECK FALLITI` : '\nTUTTI I CHECK PASSATI');
process.exit(failed ? 1 : 0);
