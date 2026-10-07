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
	// 970/971 dalla consegna 30 (6/10), 972 dalla consegna 33 (7/10)
	robot: [961, 962, 964, 967, 19004, 20009, 2205, 970, 971, 972],
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
// (v3) gli handler globali sono in layout/plantGlobals.js (prima in StandardMenu)
const menu = readFileSync('src/layout/plantGlobals.js', 'utf8');
check(/'robot\.alarm_' \+ code/.test(menu) && /socket\.on\('ALARM\/MC1'/.test(menu), 'allarmi MC1: evento ALARM/MC1 -> robot.alarm_<codice>');
check(/'robot\.alarm_' \+ payload/.test(menu), 'errori robot: robot.alarm_<codice>');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
