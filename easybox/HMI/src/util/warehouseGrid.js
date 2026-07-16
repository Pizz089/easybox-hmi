// Griglia magazzino pallet (cantiere AD) — utility CONDIVISA fra il dialog
// "Posiziona" (AttrezzaggiView) e la vista IMPOSTAZIONI > Magazzini.
//
// CONVENZIONE FISICA (vista come la vede l'operatore davanti al magazzino):
// 5 righe x 4 posti, RIGA 1 IN BASSO, POSIZIONE 1 in basso a DESTRA; la
// numerazione procede verso sinistra lungo la riga (1->4) e poi sale alla
// riga sopra (5->8, sempre da destra) fino alla 20 in alto a sinistra.
// Con una CSS grid che riempie da sinistra a destra, riga per riga
// dall'alto, l'ordine di render equivale al semplice N..1 discendente.
//
// REGOLA RIGHE DI CODA (AD-R2, per i SELETTORI): le righe fisiche
// interamente disabilitate spariscono SOLO dalla coda in alto —
// righe renderizzate = max(1, ceil(maxEnabled/4)) con maxEnabled = max
// SUB_POS NON disabilitato. Le righe intermedie interamente disabilitate
// restano visibili ma spente. Uno slot SENZA riga [POSITION] conta come
// abilitato (regola "STATUS 9 = disabilitata, qualunque altro = abilitata").
// NB: la vista Magazzini NON usa il taglio di coda (deve mostrare anche le
// posizioni disabilitate in coda per poterle riabilitare): usa fullGridOrder.

export const WPALLET_TOTAL = 20;
export const WPALLET_COLS = 4;

// Ordine di render del selettore, con taglio delle righe di coda.
export function palletGridOrder(disabledSet, total = WPALLET_TOTAL, cols = WPALLET_COLS) {
  let maxEnabled = 0;
  for (let n = 1; n <= total; n++) {
    if (!disabledSet || !disabledSet.has(n)) maxEnabled = n;
  }
  const rows = Math.max(1, Math.ceil(maxEnabled / cols));
  const out = [];
  for (let n = rows * cols; n >= 1; n--) out.push(n);
  return out;
}

// Ordine di render COMPLETO (vista Magazzini: nessun taglio di coda).
export function fullGridOrder(total = WPALLET_TOTAL) {
  const out = [];
  for (let n = total; n >= 1; n--) out.push(n);
  return out;
}
