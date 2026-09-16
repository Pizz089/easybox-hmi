import { MACHINE_POSITIONS } from './machineBrands';

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

// AE: decodifica testuale della posizione pallet, RIUSO (non copia) da
// AttrezzaggiView / form Pallet / selectRig. t = la $t del chiamante.
// (attrezzaggi-edit-remove-place, R-A) decodifica ALLINEATA al canone
// POS_PLANT = 100 + n (101=MC1, 102=MC2 — D2), quattro rami in ORDINE:
//   1000                 -> Robot (esplicito, coerente con PalletsView);
//   fascia macchina con n CONFIGURATA (machineBrands, cantiere AS) -> label
//   macchina;
//   fascia macchina NON riconosciuta (incluso 100 esatto e macchine non
//   configurate) -> etichetta esplicita col valore: MAI cadere in silenzio
//   nella decodifica MAG_POS su un dato anomalo;
//   altrimenti -> decodifica storica da MAG_POS.
// (Il vecchio quirk -99 etichettava 101 come "Machine 2" e 1000 come
// "Machine 901": rimosso col canone.)
export function palletPositionLabel(pal, t) {
  if (pal.POS_PLANT == 1000)
    return t('position.onRobot');
  if (pal.POS_PLANT >= 100 && pal.POS_PLANT < 1000) {
    const n = pal.POS_PLANT - 100;
    if (MACHINE_POSITIONS.some((p) => p.n === n))
      return t('Machine') + ' ' + n;
    return t('position.plantUnknown', { v: pal.POS_PLANT });
  }
  if (pal.MAG_POS < 0)
    return t('fuori_magazzino');
  return t('Mag') + " " + pal.MAG_POS;
}

// ============================================================================
// POSIZIONE nei comandi 13 (preleva) e 14 (deposita) — cantiere pallet 16/9
//
// Contratto PLC: "13;objectType;palletID;posizione" (e 14 simmetrico), con
// objectType 3 = pallet. In FB7 il ramo e' esplicito:
//   posizione = 0  -> MISSION_PickPallet_MC_HMI  (dalla MACCHINA)
//   posizione > 0  -> MISSION_Load_Pallet        (dal magazzino, posto n)
//
// PERCHE' SERVE QUESTA FUNZIONE. Il pannello passava PALLET.MAG_POS grezzo.
// Ma MAG_POS NEGATIVO vuol dire "fuori magazzino" (convenzione gia' usata da
// palletPositionLabel qui sopra e da AttrezzaggiView), non "posizione -3":
// per il pallet che sta in macchina si mandava un numero che FB7 non sa
// leggere — non e' 0 e non e' un posto a scaffale. E il bottone era spento
// prima ancora di provarci, perche' il gate chiedeva MAG_POS >= 0.
// Dove sta davvero il pallet lo dice POS_PLANT (1000 = in pinza sul robot,
// 100+n = macchina n), non MAG_POS.
// ============================================================================

export const PALLET_POS_MACHINE = 0;   // posizione 0 = dalla/alla macchina

export function palletIsInMachine(pal) {
  const pp = Number(pal && pal.POS_PLANT);
  return pp >= 100 && pp < 1000;
}

export function palletIsOnRobot(pal) {
  return Number(pal && pal.POS_PLANT) === 1000;
}

// PRELIEVO (13): da dove si va a prendere il pallet.
//   in macchina -> 0 | a scaffale -> il posto | altrove -> null
// null = non si sa da dove prenderlo: il comando NON si compone. Meglio un
// bottone spento con la ragione scritta che una posizione inventata.
export function palletPickPosition(pal) {
  if (!pal) return null;
  if (palletIsOnRobot(pal)) return null;          // gia' in pinza: non si preleva
  if (palletIsInMachine(pal)) return PALLET_POS_MACHINE;
  const mag = Number(pal.MAG_POS);
  return mag > 0 ? mag : null;                    // negativo = fuori magazzino
}

// DEPOSITO (14): dove si va a posare. NON e' la posizione attuale — e' la
// destinazione, e per il magazzino e' il posto assegnato al pallet. Per il
// deposito IN MACCHINA la destinazione e' 0, e la sceglie il chiamante
// (bottone dedicato), non si deduce da dove il pallet si trovava.
export function palletPlacePosition(pal) {
  const mag = Number(pal && pal.MAG_POS);
  return mag > 0 ? mag : null;                    // senza posto assegnato non si deduce
}
