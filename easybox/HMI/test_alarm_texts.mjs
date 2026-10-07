// ============================================================================
// test_alarm_texts.mjs — testi dei codici nuovi del PLC (P5 5/10)
//
// Il pannello traduce gli errori robot (DB_Robot.Error) e gli allarmi MC1
// (FROM_PLANT/ALARM/MC1 -> evento ALARM/MC1) con la STESSA famiglia di chiavi:
// robot.alarm_<codice> (StandardMenu.vue, units.vue, robotView.vue). Si
// verifica che ogni codice nuovo abbia il testo in it.json E in en.json, che
// nei due file non ci siano chiavi doppie (JSON.parse le scarterebbe in
// silenzio: si controlla il testo grezzo), che il 947 abbia il testo nuovo e
// che 18 e 20006 non siano stati toccati.
//
// Uso:   node test_alarm_texts.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// Chiavi doppie nello STESSO oggetto, sul testo grezzo. Scanner minimo:
// stringhe con escape, oggetti/array annidati, una chiave = stringa seguita da ':'.
function duplicateKeys(text) {
	const dups = [];
	const stack = [];   // per ogni livello: { keys: Set, path, isObj }
	let i = 0;
	// percorso dei livelli SOPRA quello corrente (la chiave corrente si aggiunge a parte)
	const path = () => stack.slice(0, -1).filter(s => s.isObj && s.cur !== undefined).map(s => s.cur).join('.');
	while (i < text.length) {
		const ch = text[i];
		if (ch === '"') {
			let j = i + 1, str = '';
			while (text[j] !== '"') { if (text[j] === '\\') { str += text[j] + text[j + 1]; j += 2; } else { str += text[j++]; } }
			let k = j + 1;
			while (/\s/.test(text[k])) k++;
			const top = stack[stack.length - 1];
			if (text[k] === ':' && top && top.isObj) {
				const key = JSON.parse('"' + str + '"');
				if (top.keys.has(key)) dups.push((path() ? path() + '.' : '') + key);
				top.keys.add(key);
				top.cur = key;
			}
			i = j + 1;
			continue;
		}
		if (ch === '{') stack.push({ keys: new Set(), isObj: true, cur: undefined });
		else if (ch === '[') stack.push({ isObj: false });
		else if (ch === '}' || ch === ']') stack.pop();
		i++;
	}
	return dups;
}

const CODES = {
	// 970/971 dalla consegna 30 (6/10), 972 dalla consegna 33 (7/10),
	// 1419/1519/19005/19006/19007/20011 dalla consegna 34 (7/10, uncino),
	// 973 e 691 (tasca non vuota) dalla consegna 35 (7/10); 948, 951, 996,
	// 997, 999 dalla simulazione bis (B61, 7/10 sera)
	robot: [961, 962, 964, 967, 19004, 20009, 2205, 970, 971, 972, 1419, 1519, 19005, 19006, 19007, 20011, 973, 691, 948, 951, 996, 997, 999],
	mc1: [952, 953, 954, 955, 956, 957, 958, 959, 947],
};
const raw = { it: readFileSync('src/locales/it.json', 'utf8'), en: readFileSync('src/locales/en.json', 'utf8') };
const loc = { it: JSON.parse(raw.it), en: JSON.parse(raw.en) };

console.log('1) nessuna chiave doppia');
for (const l of ['it', 'en']) {
	const d = duplicateKeys(raw[l]);
	check(d.length === 0, l + '.json: ' + (d.length ? 'doppie ' + d.join(', ') : 'nessuna chiave doppia'));
}
// lo scanner trova davvero i doppioni (controllo del controllo)
check(duplicateKeys('{"a":{"x":1,"x":2},"b":[{"x":1},{"x":2}]}').join() === 'a.x', 'lo scanner riconosce un doppione e ignora le chiavi uguali in oggetti diversi');

console.log('\n2) ogni codice ha il testo in it e in en');
for (const [fam, codes] of Object.entries(CODES))
	for (const c of codes) {
		const it = loc.it.robot['alarm_' + c], en = loc.en.robot['alarm_' + c];
		check(typeof it === 'string' && it.trim() && typeof en === 'string' && en.trim() && it !== en,
			fam + ' ' + c + ': it "' + it + '" / en "' + en + '"');
	}

console.log('\n3) 947 col testo nuovo, 18 e 20006 non toccati');
check(loc.it.robot.alarm_947 === 'Comando macchina rifiutato: ciclo attivo o pallet già dichiarato. Portare la cella in HOLD e ripetere.', '947 it: testo nuovo (vale anche per morsa, pallet e porta)');
check(/HOLD/.test(loc.en.robot.alarm_947), '947 en: testo inglese equivalente');
// (7/10, consegna 33) il 970 vale anche per l'ordine avviato; il 972 e' nuovo
check(/avviato, in coda o in pausa/.test(loc.it.robot.alarm_970) && /non serve avviarlo/.test(loc.it.robot.alarm_970) && /started, queued or paused/.test(loc.en.robot.alarm_970),
	'970: nessun ordine di MC1 avviato, in coda o in pausa (consegna 33)');
check(/errore attivo/.test(loc.it.robot.alarm_972) && /938/.test(loc.it.robot.alarm_972) && /active error/.test(loc.en.robot.alarm_972),
	'972: comando rifiutato con un errore attivo; con il 938 prima la dichiarazione dello stato cella');
// (7/10, consegna 34) uncino per i cassetti e pinza ferma col cassetto fuori
// (consegna 35, simulazione bis B8) l'ordine giusto: prima RESET (col 972 il
// rientro sarebbe rifiutato finche' l'errore resta), poi il cassetto, poi il comando
check([1419, 1519].every(c => /cassetto fuori/.test(loc.it.robot['alarm_' + c])
	&& /Premi RESET, rientra il cassetto \(Gestione cassetto\), poi ripeti il comando\.$/.test(loc.it.robot['alarm_' + c])
	&& /tray is out/.test(loc.en.robot['alarm_' + c]) && /Press RESET, put the tray back \(Tray handling\), then repeat the command\.$/.test(loc.en.robot['alarm_' + c]))
	&& /Carico/.test(loc.it.robot.alarm_1419) && /Deposito/.test(loc.it.robot.alarm_1519) && [1419, 1519].every(c => /cambio pinza/.test(loc.it.robot['alarm_' + c])),
	'1419 (carico) e 1519 (deposito), anche dal cambio pinza: «Premi RESET, rientra il cassetto (Gestione cassetto), poi ripeti il comando»');
check(!/Chiudi il cassetto e premi RESET/.test(loc.it.robot.alarm_1419 + loc.it.robot.alarm_1519), '   l\'ordine vecchio (prima il cassetto, poi RESET) non c\'e\' piu\'');
check(/non ha l'uncino/.test(loc.it.robot.alarm_19005) && /né a bordo né a scaffale/.test(loc.it.robot.alarm_19006)
	&& /deve essere vuota/.test(loc.it.robot.alarm_19007) && /non ha l'uncino/.test(loc.it.robot.alarm_20011) && /si rientra a mano/.test(loc.it.robot.alarm_20011),
	'19005, 19006, 19007, 20011: i testi della consegna 34');
// (consegna 35, 7/10)
check(/Rientrato il cassetto a mano: Reimposta stato cella con cassetto 0\.$/.test(loc.it.robot.alarm_20011) && /Reset cell state with tray 0\.$/.test(loc.en.robot.alarm_20011),
	'20011: in fondo «Rientrato il cassetto a mano: Reimposta stato cella con cassetto 0»');
check(loc.it.robot.alarm_973 === "Comando rifiutato: c'è una missione in corso o in pausa. CONTINUA per riprenderla, oppure RESET (o la procedura dopo una missione interrotta)."
	&& /mission is running or paused/.test(loc.en.robot.alarm_973) && /CONTINUE/.test(loc.en.robot.alarm_973), '973: missione in corso o in pausa, CONTINUA oppure RESET');
check(loc.it.robot.alarm_691 === 'Tasca di destinazione non trovata o non vuota a database: controlla la tasca e dichiarala (39), poi RESET e ripeti.'
	&& /not empty in the database/.test(loc.en.robot.alarm_691), '691: tasca non trovata o non vuota a database, dichiarala (39)');
check(loc.it.robot.alarm972Code === "Comando rifiutato: c'è un errore attivo, {errore}. Premi RESET e ripeti il comando." && /\{errore\}/.test(loc.en.robot.alarm972Code),
	'972 + codice: «Comando rifiutato: c\'è un errore attivo, <codice> <testo>. Premi RESET e ripeti il comando.»');
let head = null;
try { head = { it: JSON.parse(execSync('git show HEAD:easybox/HMI/src/locales/it.json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) }; } catch (e) { head = null; }
if (head) {
	check(loc.it.robot.alarm_18 === head.it.robot.alarm_18, '18 aveva gia\' un testo: invariato ("' + loc.it.robot.alarm_18 + '")');
	const has20006 = o => JSON.stringify(o).match(/"[^"]*20006[^"]*":"[^"]*"/g) || [];
	check(JSON.stringify(has20006(loc.it)) === JSON.stringify(has20006(head.it)), '20006 non toccato (lo usa declErr)');
} else {
	check(typeof loc.it.robot.alarm_18 === 'string', '18 ha un testo (HEAD non leggibile: confronto saltato)');
}
check(loc.it.robot.alarm_20006 === undefined, 'nessuna robot.alarm_20006 aggiunta');
// (audit 5/10) in en.json il 18 era rimasto in italiano
check(loc.en.robot.alarm_18 === 'Gripper not empty' && loc.en.robot.alarm_18 !== loc.it.robot.alarm_18, '18 in en.json tradotto ("' + loc.en.robot.alarm_18 + '")');

console.log('\n4) la famiglia e\' quella che il pannello usa davvero');
const menu = readFileSync('src/layout/StandardMenu.vue', 'utf8');
// (consegna 35, 7/10 sera) gli handler di PLC/ALARM/ROBOT, ALARM/MC1 e
// ALARM/BOX stanno in util/robotAlarm.js
const robotAlarm = readFileSync('src/util/robotAlarm.js', 'utf8');
check(/'robot\.alarm_' \+ code/.test(robotAlarm) && /socket\.on\('ALARM\/MC1', alarmMc1Handler\)/.test(menu) && /alarmMc1Handler = allarmi\.mc1/.test(menu), 'allarmi MC1: evento ALARM/MC1 -> robot.alarm_<codice>');
check(/makePlcAlarmHandlers\(dataStored/.test(menu) && /socket\.on\('PLC\/ALARM\/ROBOT', plcAlarmRobotHandler\)/.test(menu)
	&& /return 'robot\.alarm_' \+ \(Number\.isInteger\(c\) \? c : payload\)/.test(robotAlarm), 'errori robot: robot.alarm_<codice> (util/robotAlarm.js, codice ripulito con parseInt)');
check(typeof loc.it.robot.alarmBox_99 === 'string' && typeof loc.en.robot.alarmBox_99 === 'string' && loc.it.robot.alarmBox_99 !== loc.it.robot.alarm_99, '99 su ALARM/BOX: un testo suo (robot.alarmBox_99), diverso da "ALLARME GENERICO"');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
