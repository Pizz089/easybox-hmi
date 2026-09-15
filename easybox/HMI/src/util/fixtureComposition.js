// ============================================================================
// fixtureComposition.js — leggere la COMPOSIZIONE di un'attrezzatura
// (cantiere composizione-attrezzatura 16/9)
//
// PERCHE' ESISTE. FIXTURE.Z e' la quota del piano su cui appoggia il pezzo in
// morsa, ed e' il SOLO valore che il PLC legge per calcolare il deposito in
// macchina. Oggi quella quota e' una somma fatta a mano (pallet + morsa), e
// l'anagrafica VICE non entra in nessun calcolo: chi ritocca VICE.Z crede di
// aver aggiornato la quota di deposito e non ha aggiornato niente. E' costato
// due giorni.
//
// La vista FIXTURES adesso denuncia il disallineamento con Z_DIVERGE. Questo
// modulo traduce quel numero in uno stato che pannello e messaggi usano allo
// stesso modo, cosi' lista e form non possono raccontare due storie diverse.
//
// IL PLC NON E' TOCCATO: continua a leggere FIXTURE.Z dalla tabella. La vista
// denuncia, non corregge, e nemmeno questo modulo.
// ============================================================================

export const COMPOSIZIONE = {
	COERENTE: 'coerente',        // Z_DIVERGE 0: la somma dichiarata torna
	DIVERGE: 'diverge',          // Z_DIVERGE 1: NON torna, e il robot usa la dichiarata
	NON_DICHIARATA: 'nonDichiarata', // Z_DIVERGE 2: manca VICE_ID o PALLET_ID
	SCONOSCIUTA: 'sconosciuta',  // la vista non espone Z_DIVERGE (impianto non aggiornato)
};

// La colonna puo' mancare: se in cella la vista non fosse ancora estesa, il
// pannello non deve rompersi ne' inventare uno stato. Meglio tacere.
export function statoComposizione(row) {
	if (!row || row.Z_DIVERGE === undefined || row.Z_DIVERGE === null) return COMPOSIZIONE.SCONOSCIUTA;
	const d = Number(row.Z_DIVERGE);
	if (d === 0) return COMPOSIZIONE.COERENTE;
	if (d === 1) return COMPOSIZIONE.DIVERGE;
	if (d === 2) return COMPOSIZIONE.NON_DICHIARATA;
	return COMPOSIZIONE.SCONOSCIUTA;
}

// micron -> millimetri per il testo, con un decimale. null resta null: un
// valore mancante non si mostra come 0, che sarebbe una misura.
export function mm(micron) {
	if (micron === null || micron === undefined || micron === '') return null;
	const n = Number(micron);
	if (!Number.isFinite(n)) return null;
	return Math.round(n / 100) / 10;
}

// I numeri da mettere nel messaggio, gia' in millimetri. Si prendono dai dati,
// mai da un esempio.
export function quoteComposizione(row) {
	return {
		dichiarata: mm(row && row.Z),
		pallet: mm(row && row.PALLET_Z),
		morsa: mm(row && row.VICE_Z),
		somma: mm(row && row.Z_CALC),
	};
}

// Di quanto si sposterebbe il deposito allineando FIXTURE.Z alla somma dei
// componenti. Positivo = il robot depositerebbe piu' in alto. null se non si
// puo' dire. Serve alla CONFERMA dell'allineamento: nessuno deve spostare il
// robot senza leggere di quanto.
export function scostamentoMm(row) {
	const q = quoteComposizione(row);
	if (q.dichiarata === null || q.somma === null) return null;
	return Math.round((q.somma - q.dichiarata) * 10) / 10;
}
