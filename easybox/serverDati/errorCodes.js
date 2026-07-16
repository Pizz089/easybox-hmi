"use strict";
// Error contract cross-modulo (regola di progetto: CODICI con costanti
// esportate, mai confronti su substring di messaggi). Questi codici
// viaggiano come body della risposta HTTP degli endpoint conf; l'HMI
// tiene una copia speculare delle stesse costanti.
// Cantiere AD (anti-sovrapposizione magazzini pallet/pinze):
exports.KO_OCCUPIED = "KO_OCCUPIED";   // posizione gia' occupata da un altro elemento
exports.KO_DISABLED = "KO_DISABLED";   // posizione disabilitata (POSITION.STATUS=9)
