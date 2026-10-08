// Copia SPECULARE di serverDati/errorCodes.js (error contract cross-modulo:
// CODICI con costanti esportate, mai confronti su substring di messaggi).
// I codici arrivano come body testuale delle risposte degli endpoint conf.
export const KO_OCCUPIED = "KO_OCCUPIED";   // posizione gia' occupata da un altro elemento
export const KO_DISABLED = "KO_DISABLED";   // posizione disabilitata (POSITION.STATUS=9)
export const KO_ACTIVE_ORDER = "KO_ACTIVE_ORDER";   // il cassetto ha una posizione legata a un ordine ATTIVO (WORKORDERS.STATUS=3)
export const KO_CELL_RUNNING = "KO_CELL_RUNNING";   // la cella sta lavorando (robot in missione o stato sconosciuto)
// (grating-model) associazione grigliato-cassetto dalla gestione cassetti
export const KO_TRAY_EXTRACTED     = "KO_TRAY_EXTRACTED";     // cassetto fuori o in manovra (TRAY.EXTRACT<>0)
export const KO_ALREADY_ASSOCIATED = "KO_ALREADY_ASSOCIATED"; // cassetto gia' associato / tasche presenti: usare Sostituisci
export const KO_SOURCE_EMPTY       = "KO_SOURCE_EMPTY";       // sorgente senza tasche o con grigliato diverso
export const KO_OUT_OF_TRAY        = "KO_OUT_OF_TRAY";        // griglia fuori ingombro (verifica lato server)
export const KO_IN_USE             = "KO_IN_USE";             // grigliato in uso: cancellazione rifiutata
export const KO_DUP_NAME           = "KO_DUP_NAME";           // nome grigliato duplicato
// (16/9) grigliato senza pezzo: genererebbe tasche con Part_Type non agganciabile
// a nessun PIECE, quindi invisibili al robot. Associazione rifiutata.
// (16/9) pezzo dichiarato piu' grande dell'alloggiamento: il robot ci sbatterebbe
export const KO_PIECE_TOO_BIG     = "KO_PIECE_TOO_BIG";
export const KO_NO_PIECE_DECLARED = "KO_NO_PIECE_DECLARED";
// (grating-thickness 14/9) Z_PICK/Z_PLACE del pezzo sotto spessore grigliato + franco
export const KO_Z_BELOW_GRATING   = "KO_Z_BELOW_GRATING";   // generazione rifiutata dal server
// (rig-two-aspects 15/9) ordine senza geometria: il PLC non saprebbe a che quota depositare
export const KO_NO_FIXTURE        = "KO_NO_FIXTURE";
// (push-to-stop 15/9) ciclo di spinta in battuta: dati mancanti, appoggio
// non dichiarato per un pezzo che eccede la ganascia, o corsa negativa
export const KO_PUSH_NO_DATA      = "KO_PUSH_NO_DATA";
export const KO_PUSH_NO_FIT       = "KO_PUSH_NO_FIT";
export const KO_Z_PUSH_RANGE      = "KO_Z_PUSH_RANGE";  // (6/10) quota Z della spinta oltre la quota di presa del pezzo
export const KO_PUSH_NO_ROOM      = "KO_PUSH_NO_ROOM";
// (push-sim-save 15/9) la riga da aggiornare non esiste: una UPDATE a zero
// righe non deve mai rispondere OK
export const KO_NOT_FOUND         = "KO_NOT_FOUND";
// (P1 5/10) aggiunta/eliminazione cassetti disabilitata: insertTray e
// DELETE /tray/:ID rispondono 403 con questo codice
export const KO_TRAY_LOCKED       = "KO_TRAY_LOCKED";
export const KO_WORKOBJECT        = "KO_WORKOBJECT";        // "0 CASSETTIERA" eliminato (6/10): /teachTrays risponde 410
// (P2 5/10) rilancia ordine finito
export const KO_ORDER_NOT_FINISHED = "KO_ORDER_NOT_FINISHED"; // ordine non finito (STATUS<>5)
export const KO_NO_RAW             = "KO_NO_RAW";             // nessun grezzo disponibile: reinserire i grezzi e scegliere Si'
// (7/10, prompt 5 di 5) catalogo delle chele della morsa
export const KO_NO_JAW             = "KO_NO_JAW";             // la morsa non ha un tipo di chele montato
export const KO_JAW_ACTIVE_ORDER   = "KO_JAW_ACTIVE_ORDER";   // ordine a STATUS 3 sul pallet di una morsa con quel tipo
export const KO_JAW_RETIRED        = "KO_JAW_RETIRED";        // tipo dismesso: non si monta
export const KO_JAW_MOUNTED        = "KO_JAW_MOUNTED";        // tipo montato: non si dismette
export const KO_JAW_IN_USE         = "KO_JAW_IN_USE";         // tipo gia' montato o usato da un ordine: non si cancella
export const KO_JAW_DUP_CODE       = "KO_JAW_DUP_CODE";       // codice gia' usato
// (8/10, prompt 8) Play o rilancio rifiutati per le chele
export const KO_ORDER_VICE_NO_JAW  = "KO_ORDER_VICE_NO_JAW";  // morsa del pallet senza tipo di chele montato
export const KO_ORDER_JAW_MISMATCH = "KO_ORDER_JAW_MISMATCH"; // chele dell'ordine diverse da quelle montate
