// ============================================================================
// tests/test_golden_equivalenza.mjs — i comandi restano gli stessi anche
// quando le pagine si rifanno (pannello v3, fasi B-D)
//
// PERCHE'. tests/golden/comandi.json si rigenera a ogni fase: quando una
// pagina viene ridisegnata i controlli cambiano nome (tag, posizione) e il
// confronto controllo-per-controllo non dice piu' niente. Qui il confronto
// e' per COMANDO: cosa parte verso l'impianto premendo un controllo (emit
// MQTT con payload, chiamate HTTP) e, se apre un dialog, cosa parte
// confermando. Riferimento: tests/golden/comandi_riferimento.json, la mappa
// presa dopo la fase A e le correzioni del 6/10, PRIMA di rifare le pagine.
//
// Controlli:
//   1. nessun comando sparito, nessun comando nuovo (su tutto il pannello);
//   2. per ogni pagina presente in entrambe con gli stessi scenari: in ogni
//      scenario gli STESSI comandi abilitati (abilitazioni identiche);
//   3. navigazione (router): solo informativa, non e' un comando.
// Le differenze VOLUTE stanno in AMMESSE, ognuna col suo motivo: e' l'elenco
// da mettere nel report di fase.
//
// Uso: node tests/test_golden_equivalenza.mjs   (dalla cartella easybox/HMI)
// ============================================================================
import { readFileSync } from 'node:fs';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const RIF = JSON.parse(readFileSync('tests/golden/comandi_riferimento.json', 'utf8'));
const ORA = JSON.parse(readFileSync('tests/golden/comandi.json', 'utf8'));
const COMANDO = /^(emit|fetch) /;

// ---------------------------------------------------------------- ammesse
// tipo: 'spostato' (il comando c'e' ancora, altrove: vedi motivo),
//       'cambiato' (stesso comando, nuovo modo di darlo: vedi motivo),
//       'nuovo'    (comando che prima su questa pagina non c'era),
//       'tolto'    (comando eliminato per decisione: vedi motivo).
export const AMMESSE = [
	// ---- fase B
	{ pagina: 'robotView', tipo: 'spostato', firma: /^emit TO_PLANT\/CMD\/ROBOT 17$/,
		motivo: 'HOLD / Riprendi / START esce dalla pagina Robot e resta solo nella striscia di stato (stessa logica a tre stati, stesso 17: test_shell_v3 lo confronta col riferimento)' },
	{ pagina: 'robotView', tipo: 'cambiato', firma: /^emit TO_PLANT\/CMD\/ROBOT "100;\d+"$/,
		motivo: 'velocita\': stesso comando "100;<val>" (1..100, eco CHANGESPEED), dato con passi -10/-1/+1/+10 (un invio dopo 400 ms senza tocchi) e valori fissi 10/25/50/100 al posto di cursore e campo numerico; il valore nel payload dipende dal controllo premuto' },
	// ---- work object per cassetto (6/10, da ui-lifting c1ad480)
	{ pagina: 'TraysView', tipo: 'tolto', firma: /^fetch GET api\/conf\/position\/show\/all \| fetch GET api\/conf\/tray\/extractCoords \| fetch GET api\/conf\/piece\/show\/all$/,
		motivo: '"0 CASSETTIERA" eliminato (decisione di Dario, work object per cassetto): via il pulsante che apriva il dialog del teaching (queste tre letture) e con lui la scrittura teachTrays, che ora risponde 410 KO_WORKOBJECT. Le rotazioni si impostano dalla scheda del cassetto' },
	// ---- fase C (risposte di Dario alla fase B, 6/10)
	// Cassetti: estrai/rilascia, associa/sostituisci/rigenera/dissocia si
	// danno dal cassetto SCELTO invece che dalla riga. Nello scenario di base
	// si vede solo il cassetto fuori: il controllo 2c sceglie un cassetto alla
	// volta e vuole, riunite, esattamente le firme e le abilitazioni della
	// tabella di prima. La deroga qui vale solo per gli scenari di base.
	{ pagina: 'TraysView', tipo: 'tolto', firma: /^emit TO_PLANT\/CMD\/BOX "2[56];\d+"$/,
		motivo: '(C-bis, decisione di Dario) Estrai / Rilascia (25 / 26) tolto dalla pagina Cassetti, come "Inserisci cassetto": non ha mai mandato il comando, perche\' la guardia di ComandsRows voleva RobotInLocalMode, che non scrive nessuno. Al suo posto il rimando ai Controlli Robot, dove i comandi del cassetto funzionano' },
	{ pagina: 'TraysView', tipo: 'spostato', firma: /^fetch GET api\/conf\/grating\/show\/all \| fetch GET api\/conf\/position\/show\/all \| fetch GET api\/conf\/piece\/show\/all/,
		motivo: 'associa / sostituisci / rigenera / dissocia il grigliato dal pannello del cassetto scelto, (C-bis) nel menu "...", stesso dialog e stesse guardie (assocAllowed): verificato dal controllo 2c' },
	// (C-bis) Produzione: un'azione principale per stato, le altre nel menu
	// "..." della card; Azzera produzione nel menu "..." della pagina. Negli
	// scenari di base non si vedono tutte: il controllo 2c apre i menu.
	{ pagina: 'productionTable', tipo: 'spostato', firma: /^emit TO_PLANT\/CMD\/ORDER /,
		motivo: 'Avvia / Ferma: uno principale per stato sulla card (in lavoro Ferma, gli altri Avvia), l\'altro nel menu "..." della card; stessi payload e abilitazioni (2c)' },
	{ pagina: 'productionTable', tipo: 'spostato', firma: /^conferma: fetch DELETE api\/order\/\d+$/,
		motivo: 'Cancella nel menu "..." della card, stessa guardia di livello e stessa conferma "sei sicuro?" (2c)' },
	{ pagina: 'productionView', tipo: 'spostato', firma: /^fetch GET api\/order\/resetProduction\/preview\//,
		motivo: 'Azzera produzione fuori dalla testata, nel menu "..." della pagina, stessa abilitazione e stesso dialog di conferma (2c)' },
	// ---- difetti del pannello stabile (6/10 sera, da ui-lifting 3aa0f80 e e3d4387)
	{ pagina: 'Vice', tipo: 'nuovo', firma: /^fetch GET api\/conf\/vice\/(setStop\?VICE_ID=\d+&PIECE_ID=\d+&STOP_BEYOND_CLAW=\d+|deleteStop\?VICE_ID=\d+&PIECE_ID=\d+) \| fetch GET api\/conf\/piece\/show\/all \| fetch GET api\/conf\/vice\/stops\/\d+$/,
		motivo: 'Appoggi dichiarati: Salva / Cancella c\'erano nel template dal 15/9 ma non comparivano mai (due blocchi computed, clawLengthMicron undefined). Corretto il difetto: sono le stesse scritture setStop / deleteStop della pagina Spinta in battuta, con la sua stessa regola (livello >= 1: a liv0 spenti)' },
	// ---- pallet «a bordo del robot» (7/10, da ui-lifting 086ed93)
	{ pagina: 'robotView', tipo: 'nuovo', firma: /^fetch GET api\/conf\/pallet\/show\/all$/,
		motivo: '«Dichiara quale pallet e\' in pinza»: con pinza pallet occupata e nessun pallet a bordo, al posto del solo avviso palletUnknownOnBoard. (prompt 10) Cambio di visibilita\': in quel caso la tile prende il POSTO di «Gestione pallet», che e\' spenta (prima comparivano tutte e due, undici tile e una terza riga che nel largo basso faceva scorrere la pagina). Negli scenari HOLD della golden «Gestione pallet» risulta nascosta invece che spenta: nessun comando cambia. Il tocco apre la scelta del pallet (rilegge l\'elenco); la dichiarazione (41 se il pallet e\' in macchina, poi 35) parte solo dalla conferma, col modulo util/palletOnRobot.js, e la coprono i controlli di test_pallet_on_robot.mjs' },
	// ---- Posiziona: «In macchina» e «Rimuovi» dal PLC (7/10, da ui-lifting 9c507df)
	{ pagina: 'AttrezzaggiView', tipo: 'cambiato', firma: /^fetch GET api\/conf\/pallet\/updatePallet\?ID=\d+&.*&MAG_POS=-1&POS_PLANT=(0|101)( \| .*)?$/,
		motivo: '«In macchina» e «Rimuovi» non scrivono piu\' subito il database (simulazione del 7/10, problema 16: DB_MC1.pallet restava com\'era). La stessa scrittura, con gli stessi valori, arriva dopo il 40;<pallet> / 41 e la sua eco (util/palletMachine.js, la logica della pagina Macchine); 947 o niente eco: nessuna scrittura. Coperto da test_pallet_machine.mjs' },
	{ pagina: 'AttrezzaggiView', tipo: 'cambiato', firma: /^emit GRIPPER\/REQUEST_SNAPSHOT undefined$/,
		motivo: 'primo passo della conferma di «In macchina» / «Rimuovi» e (7/10 sera) «Casella»: si legge il registro della macchina (snapshot DECLARE/MC1) prima di decidere se mandare il 40 / 41; il resto (comando, eco, database) e\' asincrono e lo copre test_pallet_machine.mjs' },
	// ---- Posiziona: «Casella» di un pallet in macchina col 41 (7/10 sera, da ui-lifting d3dee0f)
	{ pagina: 'AttrezzaggiView', tipo: 'cambiato', firma: /^fetch GET api\/conf\/pallet\/updatePallet\?ID=\d+&.*&MAG_POS=\d+&POS_PLANT=0 \| fetch GET api\/conf\/position\/warehouseSlot\/occupy\/WPALLET\/\d+( \| .*)?$/,
		motivo: '«Casella» non scrive piu\' subito il database: prima legge il registro della macchina e, se il pallet e\' in macchina, manda il 41 con la stessa guardia di «Rimuovi» (guardia41) e ne aspetta l\'eco. Poi la stessa scrittura di prima, con gli stessi valori (MAG_POS = casella, POS_PLANT 0, occupy della casella, free della provenienza). Pallet a magazzino: nessun 41, la stessa scrittura dopo la lettura del registro. Coperto da test_pallet_machine.mjs' },
	{ pagina: 'smallboxView', tipo: 'tolto', firma: /^emit TO_PLANT\/CMD\/ROBOT 26$/,
		motivo: '"Inserisci cassetto" tolto dai Controlli EasyBox (decisione di Dario): era sempre spento, perche\' la sua condizione RobotInLocalMode non la scrive nessuno (le assegnazioni in robotView sono commentate). Il cassetto si rilascia da Robot -> Gestione cassetto' },
	// ---- consegna 34: uncino per i cassetti, pinza ferma col cassetto fuori (7/10, da ui-lifting 1687c2b e 9650792)
	// (scenario: la deroga vale solo negli scenari che corrispondono)
	{ pagina: 'robotView', tipo: 'cambiato', scenario: /cassetto \d+ fuori/, firma: /^conferma: emit TO_PLANT\/CMD\/ROBOT 12 \+ /,
		motivo: 'con un cassetto fuori «Gestione pinza» e\' spento (decisione di Dario del 7/10: niente pinze dallo scaffale col cassetto aperto; il PLC 34 rifiuta con 1419 / 1519), col motivo «Cassetto fuori: prima rientralo». Solo negli scenari col cassetto fuori; coperto da test_gripper_hook.mjs' },
	{ pagina: 'Gripper', tipo: 'cambiato', firma: /^fetch GET api\/conf\/gripper\/(updateGripper|insertGripper)\?ID=\d+&.*&CLAW_LENGTH=\d*(&HAS_HOOK=[01]?)?&STATUS=\d+&.*$/,
		motivo: 'stessa scrittura della pinza con in piu\' HAS_HOOK, la casella «Uncino per cassetti»: 1/0 quando il valore e\' noto, vuoto quando la vista non lo espone o la pinza non e\' ancora letta (il backend lascia la colonna, o mette 0 in creazione). Su una pinza doppia la gemella si allinea dopo, con setHasHook. Coperto da test_gripper_hook.mjs e test_gripper_hook_route.js' },
	// (parte: il pezzo aggiunto alla firma. Il controllo 2c lo toglie dalle
	// firme di oggi prima del confronto, quindi verifica anche che il comando
	// di avvio sia rimasto identico)
	{ pagina: 'productionTable', tipo: 'cambiato', parte: ' | fetch GET api/conf/gripper/show/all', firma: /^emit TO_PLANT\/CMD\/ORDER \{"id":\d+,"status":3,"pieceID":\d+\} \| fetch GET api\/conf\/gripper\/show\/all$/,
		motivo: 'Avvia: stesso comando di prima, poi la lettura delle pinze per l\'AVVISO (non blocca) quando la pinza dell\'ordine non ha l\'uncino e il ciclo si fermerebbe all\'estrazione del cassetto (19005). Coperto da test_gripper_hook.mjs' },
	// (7/10 sera, verso definitivo 1.5, simulazione bis B2 e B8) abilitazioni
	// col cassetto fuori. Gli scenari della golden oggi non arrivano a queste
	// conferme: le voci dichiarano il cambio, la copertura e' test_gripper_hook
	{ pagina: 'robotView', tipo: 'cambiato', scenario: /cassetto \d+ fuori/, firma: /^conferma: emit TO_PLANT\/CMD\/ROBOT 13;3;\d+;\d+/,
		motivo: 'Gestione pallet col cassetto fuori (o in manovra): il pallet la cui pinza (PALLET.GripperREQ) non e\' quella che il PLC tiene come lato 1 (dall\'8/10: la gemella del lato 2 conta come cambio, come nel PLC) e\' spento nel dialog, e il bottone si spegne se nessun pallet si carica senza cambio pinza, col motivo «Cassetto fuori: prima rientralo». Il carico comincerebbe con un cambio pinza, che il PLC 35 rifiuta col 1519 (e il PLC 34 eseguiva). Stesso comando 13;3;<pallet>;<posizione> per i pallet della pinza a bordo. Coperto da test_gripper_hook.mjs' },
	{ pagina: 'robotView', tipo: 'cambiato', scenario: /cassetto \d+ fuori/, firma: /^conferma: emit TO_PLANT\/CMD\/ROBOT 3[13];/,
		motivo: 'collaudo 31/33 col cassetto fuori: si offre solo la pinza a bordo (prima l\'elenco completo, e con un\'altra pinza il PLC restava appeso al 1110/1210). Stessi comandi 31;tasca;pinza e 33;pinza. Coperto da test_gripper_hook.mjs' },
	// ---- catalogo delle chele, audit dell'8/10 (prompt 8, da ui-lifting 6a289f7)
	{ pagina: 'AttrezzaggiView', tipo: 'cambiato', firma: /fetch GET api\/conf\/vice\/updateVice\?ID=\d+&FAMILY=[^&]*&DESCR=[^&]*&STATUS=\d+&X=\d+&Y=\d+&Z=\d+&(Z_CLAW=\d*&Z_SINK_CLAW=\d*&)?MAG=/,
		motivo: 'Smonta morsa: la stessa scrittura della morsa senza Z_CLAW e Z_SINK_CLAW. Le misure stanno sul tipo di chele montato, e lette all\'apertura della pagina possono essere vecchie; su una morsa senza tipo un\'altezza mandata faceva rifiutare lo smontaggio (KO_NO_JAW). In piu\' il rifiuto si mostra (prima si guardava solo r.ok). Coperto da test_chele_morsa.mjs e test_vice_jaw_db.js' },
	{ pagina: 'Attrezzaggio', tipo: 'cambiato', firma: /fetch GET api\/conf\/vice\/updateVice\?ID=\d+&FAMILY=[^&]*&DESCR=[^&]*&STATUS=\d+&X=\d+&Y=\d+&Z=\d+&(Z_CLAW=\d*&Z_SINK_CLAW=\d*&)?MAG=/,
		motivo: 'monta e smonta la morsa sul pallet con la stessa scrittura, senza Z_CLAW e Z_SINK_CLAW (stanno sul tipo di chele montato; con una morsa senza tipo il backend rifiutava). Coperto da test_chele_morsa.mjs e test_vice_jaw_db.js' },
	{ pagina: 'Vice', tipo: 'cambiato', firma: /fetch GET api\/conf\/vice\/insertVice\?(ID=\d+&)?FAMILY=/,
		motivo: 'Crea morsa senza ID: in cella VICE.ID e\' IDENTITY e l\'INSERT con l\'ID esplicito falliva. L\'ID torna nella risposta ({"ris":"OK","ID":n}) e il form lo usa (messaggio, ritorno ad Attrezzaggio con la morsa gia\' scelta). Coperto da test_chele_morsa.mjs e test_vice_jaw_db.js' },
	// (fase E1.3, verso definitivo 2.1) antirimbalzo del HOLD della striscia
	{ pagina: 'StatusStrip', tipo: 'cambiato', firma: /^emit TO_PLANT\/CMD\/ROBOT 17$/,
		motivo: 'HOLD / Riprendi / START: stesso comando 17. Il 17 e\' un interruttore nel PLC, due tocchi rimettono in moto la cella: dopo un tocco il pulsante resta spento e (8/10) si riaccende al piu\' tardi fra «cambio di STATUS + 1 s» e «tocco + 1,5 s» (prima al primo cambio: con l\'eco a 100 ms un doppio tocco a 300 ms mandava due 17); un passaggio a ignoto o a 0 non conta; senza cambio in 5 s, avviso «HOLD non confermato dal PLC» (util/holdGuard.js). Negli scenari della golden (nessun tocco in corso) le abilitazioni sono quelle di prima. Coperto da test_hold_guard.mjs' },
];
const ammessa = (pagina, firma, scenario) => AMMESSE.find(a => (!a.pagina || a.pagina === pagina) && a.firma.test(firma)
	&& (!a.scenario || (scenario !== undefined && a.scenario.test(scenario))));
// (consegna 34) firma di oggi senza le parti aggiunte dichiarate in AMMESSE
const senzaParti = (pagina, f) => AMMESSE.filter(a => a.parte && a.pagina === pagina && a.firma.test(f)).reduce((x, a) => x.split(a.parte).join(''), f);

// firma di un esito: i comandi che partono, piu' quelli delle conferme
function firma(r) {
	if (!r || typeof r !== 'object') return '';
	const parti = r.effetti.filter(e => COMANDO.test(e));
	for (const c of r.conferme || []) {
		const cc = c.effetti.filter(e => COMANDO.test(e));
		if (cc.length) parti.push('conferma' + (c.abilitato === true ? '' : '(spenta)') + ': ' + cc.join(' + '));
	}
	return parti.join(' | ');
}
function righe(esito) { return Array.isArray(esito) ? esito : [esito]; }
// per pagina: firme visibili per scenario, con abilitazione
function mappa(pagina) {
	const per = {};
	for (const s of pagina.scenari) {
		const m = new Map();
		for (const c of pagina.controlli)
			for (const r of righe(c.esiti[s])) {
				if (!r || r === 'nascosto' || typeof r !== 'object') continue;
				const f = firma(r);
				if (!f) continue;
				m.set(f, (m.get(f) || false) || r.abilitato === true);
			}
		per[s] = m;
	}
	return per;
}
// tutte le firme di una mappa. Per la mappa di oggi contano solo gli scenari
// che il riferimento conosce: uno scenario aggiunto dopo (es. "eco morsa
// manuale ON", fase B) puo' far comparire un payload che il riferimento non
// ha mai provato, senza che il comando sia nuovo.
const tutte = (g, rif) => {
	const out = new Map();
	for (const [n, p] of Object.entries(g.pagine)) {
		const m = mappa(p);
		const scen = rif && rif.pagine[n] ? p.scenari.filter(s => rif.pagine[n].scenari.includes(s)) : p.scenari;
		for (const s of scen) for (const f of m[s].keys()) { if (!out.has(f)) out.set(f, new Set()); out.get(f).add(n); }
	}
	return out;
};

console.log('1) nessun comando sparito, nessun comando nuovo');
const A = tutte(RIF), B = tutte(ORA, RIF);
const sparite = [...A.keys()].filter(f => !B.has(f)).filter(f => ![...A.get(f)].every(p => ammessa(p, f)));
const nuove = [...B.keys()].filter(f => !A.has(f)).filter(f => ![...B.get(f)].every(p => ammessa(p, f)));
check(sparite.length === 0, 'comandi del riferimento ancora presenti (' + A.size + ')' + (sparite.length ? ':\n       - ' + sparite.join('\n       - ') : ''));
check(nuove.length === 0, 'nessun comando che prima non c\'era (' + B.size + ' ora)' + (nuove.length ? ':\n       + ' + nuove.join('\n       + ') : ''));

console.log('\n2) stesse abilitazioni, pagina per pagina e scenario per scenario');
for (const [nome, rp] of Object.entries(RIF.pagine)) {
	const op = ORA.pagine[nome];
	if (!op) { check(AMMESSE.some(a => a.pagina === nome && a.tipo === 'spostato'), nome + ': pagina sparita'); continue; }
	const comuni = rp.scenari.filter(s => op.scenari.includes(s));
	const mr = mappa(rp), mo = mappa(op);
	const diff = [];
	for (const s of comuni) {
		const abR = [...mr[s]].filter(([, ab]) => ab).map(([f]) => f), abO = [...mo[s]].filter(([, ab]) => ab).map(([f]) => f);
		for (const f of abR) if (!abO.includes(f) && !ammessa(nome, f, s)) diff.push(s + ': non piu\' abilitato -> ' + f);
		for (const f of abO) if (!abR.includes(f) && !ammessa(nome, f, s)) diff.push(s + ': abilitato in piu\' -> ' + f);
	}
	const mancanti = rp.scenari.filter(s => !op.scenari.includes(s));
	check(diff.length === 0 && mancanti.length === 0, nome + ' (' + comuni.length + ' scenari)' + (mancanti.length ? ' scenari spariti: ' + mancanti.join(', ') : '') + (diff.length ? ':\n       ' + diff.join('\n       ') : ''));
}

// le differenze ammesse non devono diventare un buco: la velocita' (fase B)
// cambia controllo, non abilitazione. Passi e valori fissi si accendono
// esattamente dove si accendeva il cursore del riferimento.
console.log('\n2b) velocita\': passi e valori fissi abilitati dove lo era il cursore');
{
	const VEL = /^emit TO_PLANT\/CMD\/ROBOT "100;\d+"$/;
	const rp = RIF.pagine.robotView, op = ORA.pagine.robotView;
	const mr = mappa(rp), mo = mappa(op);
	const diff = [];
	for (const s of rp.scenari.filter(x => op.scenari.includes(x))) {
		const prima = [...mr[s]].filter(([f]) => VEL.test(f)), dopo = [...mo[s]].filter(([f]) => VEL.test(f));
		const abPrima = prima.some(([, ab]) => ab);
		// nessuna firma = i controlli ci sono ma non mandano niente (spenti e
		// con la guardia nel metodo): va bene solo se anche il cursore era spento
		if (!dopo.length) { if (abPrima) diff.push(s + ': nessun comando velocita\', il cursore era acceso'); continue; }
		for (const [f, ab] of dopo) if (ab !== abPrima) diff.push(s + ': ' + f + ' ' + (ab ? 'acceso' : 'spento') + ', il cursore era ' + (abPrima ? 'acceso' : 'spento'));
	}
	check(diff.length === 0, 'robotView: stessa abilitazione in tutti gli scenari' + (diff.length ? ':\n       ' + diff.join('\n       ') : ''));
}

// (v3 fase C) Cassetti: i comandi della tabella di prima stavano su ogni
// riga; ora si danno dal cassetto scelto. Per ogni scenario del riferimento,
// l'UNIONE degli scenari "un cassetto scelto alla volta" deve dare
// esattamente le sue firme, con le stesse abilitazioni. Il riferimento non
// leggeva le guardie dentro ComandsRows (moveDisable, modalita' locale): gli
// scenari di scelta le mettono nello stato in cui il comando partiva, e due
// scenari a parte controllano che con le missioni spente il rilascio sia
// spento e che senza modalita' locale non parta nessun comando.
// UNIONE di piu' scenari della mappa di oggi contro UNO scenario del
// riferimento: stesse firme, stesse abilitazioni. Serve dove un comando che
// prima si vedeva subito ora sta dietro una scelta (il cassetto) o un menu
// "..." (C-bis): ogni scenario "aperto" mostra una parte, e l'unione deve
// rifare il riferimento. Le firme tolte per decisione non si cercano.
function unioneUguale(pagina, base, da) {
	const mr = mappa(RIF.pagine[pagina]), mo = mappa(ORA.pagine[pagina]);
	const diff = [];
	const unione = new Map();
	for (const s of da) {
		if (!mo[s]) { diff.push('scenario mancante: ' + s); continue; }
		for (const [f0, ab] of mo[s]) { const f = senzaParti(pagina, f0); unione.set(f, (unione.get(f) || false) || ab); }
	}
	const atteso = new Map([...mr[base]].filter(([f]) => !AMMESSE.some(a => a.pagina === pagina && a.tipo === 'tolto' && a.firma.test(f))));
	for (const [f, ab] of atteso) {
		if (!unione.has(f)) diff.push('manca: ' + f);
		else if (unione.get(f) !== ab) diff.push((ab ? 'era acceso, ora spento: ' : 'era spento, ora acceso: ') + f);
	}
	for (const f of unione.keys()) if (!atteso.has(f)) diff.push('in piu\': ' + f);
	check(diff.length === 0, pagina + ': ' + base + ' = unione di ' + da.length + ' scenari (' + atteso.size + ' firme)' + (diff.length ? ':\n       ' + diff.join('\n       ') : ''));
}

console.log('\n2c) comandi dietro una scelta o un menu "...": l\'unione rifa\' il riferimento');
// Cassetti: un cassetto scelto alla volta, menu del grigliato aperto
for (const liv of [2, 0])
	unioneUguale('TraysView', 'due cassetti liv' + liv, ['due cassetti liv' + liv, 'due cassetti liv' + liv + ', scelto 7', 'due cassetti liv' + liv + ', scelto 8']);
check(!Object.values(mappa(ORA.pagine.TraysView)).some(m => [...m.keys()].some(f => /^emit TO_PLANT\/CMD\/BOX/.test(f))),
	'TraysView: nessun comando alla cassettiera in nessuno scenario (Estrai/Rilascia tolto, C-bis)');
// Produzione (C-bis): la card con l'azione principale, piu' il menu "..." di
// un ordine alla volta; la pagina col suo menu "..." aperto
for (const base of ['tre ordini liv2', 'tre ordini, popup elimina aperto'])
	unioneUguale('productionTable', base, [base].concat([101, 102, 103].map(id => base + ', menu ' + id)));
for (const liv of ['liv2', 'liv0'])
	unioneUguale('productionView', liv, [liv, liv + ', menu']);

console.log('\n3) navigazione (informativa)');
const nav = g => new Set(Object.values(g.pagine).flatMap(p => p.controlli.flatMap(c => Object.values(c.esiti).flatMap(righe)).filter(r => r && typeof r === 'object').flatMap(r => r.effetti.filter(e => /^router /.test(e)).map(e => e.toLowerCase()))));
const nA = nav(RIF), nB = nav(ORA);
console.log('       destinazioni: ' + nA.size + ' nel riferimento, ' + nB.size + ' ora; nuove: ' + ([...nB].filter(x => !nA.has(x)).join(', ') || 'nessuna') + '; tolte: ' + ([...nA].filter(x => !nB.has(x)).join(', ') || 'nessuna'));

if (AMMESSE.length) {
	console.log('\n   differenze volute dichiarate:');
	for (const a of AMMESSE) console.log('     [' + a.tipo + '] ' + (a.pagina || '*') + ' ' + a.firma + (a.scenario ? ' (scenari ' + a.scenario + ')' : '') + ' — ' + a.motivo);
}
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
