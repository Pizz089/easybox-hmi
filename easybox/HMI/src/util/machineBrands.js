// machineBrands.js
// Catalogo marche macchina (brand selezionabile a runtime, DB_MC<n> lato PLC)
// e posizioni macchina che espongono il selettore nella view di configurazione.
//
// UNICO punto di verita' frontend:
// - aggiungere la marca 3 = una riga in BRAND_CATALOG;
// - abilitare MC2       = una riga in MACHINE_POSITIONS.
// I nomi marca sono nomi propri (Spinner, HAAS): niente i18n.

export const BRAND_CATALOG = [
  { id: 1, name: 'Spinner' },
  { id: 2, name: 'HAAS' },
  // id 3..16 riservati lato PLC
];

// Range valido di brandID. Deve combaciare con la validazione backend
// (MQTT_Client.js, handler TO_PLANT/BRAND/MC<n>) e con il PLC.
export const BRAND_ID_MIN = 1;
export const BRAND_ID_MAX = 16;

// mc = suffisso usato in topic/eventi socket:
//   invio  -> socket event 'TO_PLANT/CMD/BRAND<mc>' (sotto TO_PLANT/CMD/
//             perche' il PLC e' sottoscritto solo a TO_PLANT/CMD/#)
//   ricevo -> socket event '<mc>/BRAND'
// labelKey = chiave i18n del nome posizione (top-level, come in CNC1View).
export const MACHINE_POSITIONS = [
  { mc: 'MC1', labelKey: 'MC1' },
  //{ mc: 'MC2', labelKey: 'MC2' },  // abilitare quando esiste DB_MC2 lato PLC
];

export function isValidBrandId(id) {
  return Number.isInteger(id) && id >= BRAND_ID_MIN && id <= BRAND_ID_MAX;
}

// Nome marca dal catalogo, null se id fuori catalogo (es. 3..16 riservati).
export function brandName(id) {
  const brand = BRAND_CATALOG.find((b) => b.id === id);
  return brand ? brand.name : null;
}
