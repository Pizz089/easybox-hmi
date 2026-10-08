// ============================================================================
// orologio.js — i timer delle attese del pannello (8/10, prompt 7)
//
// Le attese degli echi dei comandi (palletMachine.aspettaEco), la lettura del
// registro della macchina (leggiRegistroMacchina) e il margine dei codici
// mostrati da un dialog (robotAlarm.codiciInDialog) passano da qui. In
// produzione e' setTimeout / clearTimeout e basta.
//
// Perche': i test aspettavano davvero (80 ms, 3 s) e sotto carico fallivano a
// caso (test_pallet_machine «41 rifiutato (947)», test_cell_declare 8-ter).
// Un test che fallisce a caso nasconde le regressioni. Con usaOrologio un
// test mette un orologio finto (orologioFinto) e fa passare il tempo quando
// vuole lui: il timeout scatta quando il test avanza, non quando la macchina
// e' lenta.
// ============================================================================
const vero = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: t => clearTimeout(t) };
let attuale = vero;

export const timer = {
	dopo: (f, ms) => attuale.setTimeout(f, ms),
	annulla: t => attuale.clearTimeout(t),
};

// o = { setTimeout, clearTimeout } (un orologioFinto), null = quello vero
export function usaOrologio(o) {
	attuale = o || vero;
}

// orologio finto per i test: il tempo passa solo con avanza(ms), e i timer
// scaduti partono in ordine di scadenza
export function orologioFinto() {
	let ora = 0, prossimo = 1;
	const coda = new Map();
	return {
		setTimeout: (f, ms) => { const id = prossimo++; coda.set(id, { quando: ora + Math.max(0, Number(ms) || 0), f }); return id; },
		clearTimeout: id => { coda.delete(id); },
		avanza(ms) {
			const fine = ora + ms;
			for (;;) {
				let primo = null;
				for (const [id, x] of coda) if (x.quando <= fine && (!primo || x.quando < primo[1].quando)) primo = [id, x];
				if (!primo) break;
				coda.delete(primo[0]);
				ora = primo[1].quando;
				primo[1].f();
			}
			ora = fine;
		},
		attivi: () => coda.size,
		adesso: () => ora,
	};
}
