"use strict";
// ============================================================================
// pushQuotes.js — le tre quote del ciclo di SPINTA IN BATTUTA (push-to-stop
// 15/9), lato server. Copia speculare di HMI/src/util/pushQuotes.js: la
// parita' e' verificata da test_push_to_stop.js.
//
// La FONTE DI VERITA' per il PLC e' la vista COORDINATES_PUSH_MC
// (scripts/coordinates-push-mc.sql). Questo modulo serve alla GUARDIA: un
// ordine che il PLC non saprebbe eseguire non deve nascere, e il messaggio
// all'operatore deve portare i millimetri. Le due formule devono restare
// identiche, da cui il test.
//
// CONVENZIONI: tutto in MICRON, asse di battuta = Y con battuta a Y
// CRESCENTI (fissa, non un dato). Le divisioni per due TRONCANO come la
// divisione intera di SQL Server: 1 micron di scarto, ma le due formule
// devono dare lo stesso numero.
//
//   deposito = yPlace
//   spinta   = yPlace - pezzo.Y/2 - spessore_ganascia_pinza/2
//   arrivo   = spinta + (ganascia_morsa - pezzo.Y)/2
//
// Sulla spinta si compensa MEZZO spessore di ganascia: il TCP sta al centro
// della chela, il punto che tocca il pezzo e' il bordo.
// IPOTESI (confermata 15/9): deposito SEMPRE CENTRATO sulla morsa.
// ============================================================================

// divisione intera con troncamento verso zero, come SQL Server
const div2 = (v) => Math.trunc(Number(v) / 2);

// Stessi esiti della colonna PUSH_STATUS della vista.
exports.PUSH_STATUS = { DISABLED: 'DISABLED', NO_VICE: 'NO_VICE', NO_DATA: 'NO_DATA', NO_FIT: 'NO_FIT', OK: 'OK' };

// enabled: bit di spinta dell'ordine (istantanea di PIECE.PUSH_TO_STOP).
// hasVice: c'e' una morsa sul pallet dell'ordine.
// yPlace, pieceY, viceClawLength, gripperThickness: micron (null/0 = dato mancante).
// Ritorna { status, yPush, yStop, clearance }: quote null se status != OK,
// esattamente come la vista.
exports.pushQuotes = function ({ enabled, hasVice, yPlace, pieceY, viceClawLength, gripperThickness }) {
	const none = (s) => ({ status: s, yPush: null, yStop: null, clearance: null });
	if (!enabled) return none(exports.PUSH_STATUS.DISABLED);
	if (!hasVice) return none(exports.PUSH_STATUS.NO_VICE);
	const py = Number(pieceY) || 0;
	const claw = Number(viceClawLength) || 0;
	const tick = Number(gripperThickness) || 0;
	if (claw <= 0 || tick <= 0 || py <= 0) return none(exports.PUSH_STATUS.NO_DATA);
	if (claw - py < 0) return none(exports.PUSH_STATUS.NO_FIT);
	const yPush = Number(yPlace) - div2(py) - div2(tick);
	const clearance = div2(claw - py);
	return { status: exports.PUSH_STATUS.OK, yPush, yStop: yPush + clearance, clearance };
};

// Bit 1 di WORKORDER.OPTION2 = istantanea di PIECE.PUSH_TO_STOP (il bit 0
// resta al gripper doppio). La vista legge (OPTION2 & 2) <> 0.
exports.PUSH_BIT = 2;
exports.isPushEnabled = function (option2) {
	return ((Number(option2) || 0) & exports.PUSH_BIT) !== 0;
};
