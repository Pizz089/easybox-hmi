"use strict";
// Error contract cross-modulo (regola di progetto: CODICI con costanti
// esportate, mai confronti su substring di messaggi). Questi codici
// viaggiano come body della risposta HTTP degli endpoint conf; l'HMI
// tiene una copia speculare delle stesse costanti.
// Cantiere AD (anti-sovrapposizione magazzini pallet/pinze):
exports.KO_OCCUPIED = "KO_OCCUPIED";   // posizione gia' occupata da un altro elemento
exports.KO_DISABLED = "KO_DISABLED";   // posizione disabilitata (POSITION.STATUS=9)
// Fix tray-parent-predicate (guardia server-side sulle delete cassetto):
exports.KO_ACTIVE_ORDER = "KO_ACTIVE_ORDER";   // il cassetto ha una posizione legata a un ordine ATTIVO (WORKORDERS.STATUS=3)
// Comandi di ripristino (1/9): la cella sta lavorando (UNIT_STATUS ROBOT in missione o sconosciuto)
exports.KO_CELL_RUNNING = "KO_CELL_RUNNING";
// Grigliato come MODELLO + associazione dalla gestione cassetti (cantiere
// grating-model): i codici viaggiano nel body/JSON delle route
// associateGrating/dissociateGrating (CONF/Tray.js) e di CONF/Grating.js.
exports.KO_TRAY_EXTRACTED     = "KO_TRAY_EXTRACTED";     // TRAY.EXTRACT<>0: cassetto fuori o in manovra (guardia conservativa)
exports.KO_ALREADY_ASSOCIATED = "KO_ALREADY_ASSOCIATED"; // il cassetto ha gia' un grigliato o tasche a DB: passare da "Sostituisci"
exports.KO_SOURCE_EMPTY       = "KO_SOURCE_EMPTY";       // cassetto sorgente senza tasche o con un grigliato diverso
exports.KO_OUT_OF_TRAY        = "KO_OUT_OF_TRAY";        // griglia generata FUORI dall'ingombro del cassetto target (verifica server)
exports.KO_IN_USE             = "KO_IN_USE";             // grigliato usato da almeno un cassetto: cancellazione rifiutata
exports.KO_DUP_NAME           = "KO_DUP_NAME";           // nome grigliato gia' esistente (NAME e' la chiave del legame TRAY.FAMILY)
// Spessore grigliato (grating-thickness 14/9): quota di prelievo/deposito del pezzo sotto THICKNESS + franco
exports.KO_Z_BELOW_GRATING   = "KO_Z_BELOW_GRATING";   // Z_PICK o Z_PLACE del pezzo < GRATING.THICKNESS + 1000 um: generazione rifiutata
