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
];
const ammessa = (pagina, firma) => AMMESSE.find(a => (!a.pagina || a.pagina === pagina) && a.firma.test(firma));

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
		for (const f of abR) if (!abO.includes(f) && !ammessa(nome, f)) diff.push(s + ': non piu\' abilitato -> ' + f);
		for (const f of abO) if (!abR.includes(f) && !ammessa(nome, f)) diff.push(s + ': abilitato in piu\' -> ' + f);
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

console.log('\n3) navigazione (informativa)');
const nav = g => new Set(Object.values(g.pagine).flatMap(p => p.controlli.flatMap(c => Object.values(c.esiti).flatMap(righe)).filter(r => r && typeof r === 'object').flatMap(r => r.effetti.filter(e => /^router /.test(e)).map(e => e.toLowerCase()))));
const nA = nav(RIF), nB = nav(ORA);
console.log('       destinazioni: ' + nA.size + ' nel riferimento, ' + nB.size + ' ora; nuove: ' + ([...nB].filter(x => !nA.has(x)).join(', ') || 'nessuna') + '; tolte: ' + ([...nA].filter(x => !nB.has(x)).join(', ') || 'nessuna'));

if (AMMESSE.length) {
	console.log('\n   differenze volute dichiarate:');
	for (const a of AMMESSE) console.log('     [' + a.tipo + '] ' + (a.pagina || '*') + ' ' + a.firma + ' — ' + a.motivo);
}
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
