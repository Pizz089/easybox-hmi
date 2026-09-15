// rigging.js — MODELLO A DUE ASPETTI (15/9, sostituisce il modello esclusivo).
//
// Morsa e attrezzatura NON sono due oggetti alternativi: sono due aspetti
// dello stesso oggetto fisico.
//   GEOMETRIA (sempre): la riga FIXTURE_ON_PALLET dice QUANTO E' ALTO cio'
//     che sta sul pallet. Il PLC somma FIXTURE.Z alla quota di deposito in
//     macchina (P.Z + PIECE.Z_PLACE + FIXTURE.Z) e non sa nulla di VICE:
//     senza quella riga l'ordine muore con l'errore 799, robot gia' in moto.
//   COMPORTAMENTO (solo la morsa): VICE.PALLET_ID dice che quel pallet fa il
//     ciclo EasyBox pieno (grezzi/finiti dai cassetti). Senza morsa il pallet
//     e' attrezzatura: lavorazione speciale, entra in macchina col grezzo
//     gia' montato.
//
// Il modello ESCLUSIVO precedente (morsa O attrezzatura, mai entrambe)
// confondeva "quale ciclo" con "quale oggetto": vietava proprio la coppia che
// serve (la morsa PIU' la sua geometria) e lasciava passare la morsa nuda,
// che e' lo stato che ha rotto la cella il 15/9 (pallet 9).
//
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

// Stato semantico della riga:
//   'bare'           = niente sul pallet, da attrezzare;
//   'fixture'        = attrezzatura sola: lavorazione speciale;
//   'vice'           = morsa PIU' la sua geometria: ciclo EasyBox pieno,
//                      pallet pronto per gli ordini;
//   'vice-incomplete'= morsa SENZA geometria: il PLC non saprebbe a che quota
//                      depositare (errore 799). Si mostra a pannello e si
//                      completa dalla Modifica, MAI ordini da qui;
//   'anomaly'        = piu' di una attrezzatura sullo stesso pallet (dato
//                      sporco: si MOSTRA col badge, mai sanatorie automatiche).
// Solo 'vice' e 'fixture' sono stati COMPLETI: da li' nascono ordini, e in
// entrambi i casi l'ordine porta il FIXTURE_ID della riga di geometria.
export function rigState(row) {
    const hasVice = !!row.vice;
    const nFix = row.fixtures.length;
    if (nFix > 1) return 'anomaly';
    if (hasVice && nFix == 1) return 'vice';
    if (hasVice) return 'vice-incomplete';
    if (nFix == 1) return 'fixture';
    return 'bare';
}

// Stati da cui puo' nascere un ordine (il pallet ha tutto quello che serve
// al PLC). Usato dal wizard per il gate di selezione.
export function rigComplete(state) {
    return state == 'vice' || state == 'fixture';
}

// FIXTURE_ID che l'ordine deve portare per quel pallet: SEMPRE quello della
// riga di geometria, in entrambi i rami. 0 = non determinabile (stato
// incompleto o sporco): l'ordine non deve nascere.
export function rigFixtureId(row) {
    return rigComplete(rigState(row)) ? Number(row.fixtures[0].FIXTURE_ID) : 0;
}
