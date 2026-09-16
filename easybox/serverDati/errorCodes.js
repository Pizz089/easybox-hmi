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
// Pezzo del modello grigliato (16/9): dal cambio di modello PLC, POSITION.Part_Type
// decide QUALE pezzo il robot preleva e a CHE QUOTA (la vista 4Robot aggancia PIECE
// con join INTERNO su quel campo e ne somma Z_PICK). Un grigliato senza pezzo
// genererebbe tasche invisibili alla cella: l'associazione viene rifiutata.
// (16/9) il pezzo DICHIARATO non entra nelle tasche che ci sono: prima era
// impossibile per costruzione (la griglia nasceva dal pezzo), adesso il codice
// si dichiara a posteriori. Nessun controllo a valle lo prenderebbe.
exports.KO_PIECE_TOO_BIG     = "KO_PIECE_TOO_BIG";     // ingombro oltre il passo delle tasche o oltre il contorno del cassetto
exports.KO_NO_PIECE_DECLARED = "KO_NO_PIECE_DECLARED"; // nessun codice pezzo dichiarato per il contenuto del cassetto
exports.KO_Z_BELOW_GRATING   = "KO_Z_BELOW_GRATING";   // Z_PICK o Z_PLACE del pezzo < GRATING.THICKNESS + 1000 um: generazione rifiutata
// Modello a DUE ASPETTI degli attrezzaggi (15/9): ogni ordine deve portare la
// geometria di cio' che sta sul pallet, perche' il PLC somma FIXTURE.Z alla
// quota di deposito in macchina e non conosce VICE.
exports.KO_NO_FIXTURE        = "KO_NO_FIXTURE";        // FIXTURE_ID assente o senza riga FIXTURE corrispondente
// Ciclo di SPINTA IN BATTUTA (push-to-stop 15/9): un ordine che il PLC non
// saprebbe eseguire non deve nascere. Stessi esiti della colonna PUSH_STATUS
// della vista COORDINATES_PUSH_MC.
exports.KO_PUSH_NO_DATA      = "KO_PUSH_NO_DATA";      // manca la ganascia morsa, lo spessore ganascia pinza o la misura del pezzo
exports.KO_PUSH_NO_FIT       = "KO_PUSH_NO_FIT";       // pezzo oltre la ganascia e appoggio NON dichiarato in PIECE_ON_VICE
exports.KO_PUSH_NO_ROOM      = "KO_PUSH_NO_ROOM";      // appoggio dichiarato piu' vicino di quanto il pezzo gia' sporge: corsa negativa
// Salvataggio di una singola misura (push-sim-save 15/9): la riga da
// aggiornare non esiste. Senza questo codice una UPDATE a zero righe
// risponderebbe OK, ed e' il difetto silenzioso che ha causato l'errore 799.
exports.KO_NOT_FOUND         = "KO_NOT_FOUND";
