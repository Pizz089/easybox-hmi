// rigging.js — MODELLO ESCLUSIVO attrezzaggi (dal creatore del progetto, AB):
// ogni pallet monta UNA sola morsa O UNA sola attrezzatura, mai entrambe.
// Morsa = ciclo EasyBox pieno (grezzi/finiti dai cassetti); attrezzatura =
// lavorazione speciale (entra in macchina col grezzo gia' montato).
// Logica CONDIVISA tra AttrezzaggiView (gestione attrezzaggi) e selectRig
// (primo step del wizard ordini): riuso non copia (regola AE).

// Una riga per pallet: morsa da VICE.PALLET_ID, attrezzature dalle righe
// FIXTURE_ON_PALLET.
export function buildRigRows(pallets, vices, fop) {
    return (pallets || []).map(p => ({
        pallet: p,
        vice: (vices || []).find(v => v.PALLET_ID == p.ID) || null,
        fixtures: (fop || []).filter(f => f.PALLET_ID == p.ID)
    }));
}

// Stato semantico della riga nel modello esclusivo:
// 'bare' = da attrezzare; 'vice'/'fixture' = tipo montato; 'anomaly' =
// entrambe o piu' attrezzature (dato sporco: si MOSTRA col badge, mai
// sanatorie automatiche e mai utilizzabile per creare ordini).
export function rigState(row) {
    const hasVice = !!row.vice;
    const nFix = row.fixtures.length;
    if ((hasVice && nFix > 0) || nFix > 1) return 'anomaly';
    if (hasVice) return 'vice';
    if (nFix == 1) return 'fixture';
    return 'bare';
}
