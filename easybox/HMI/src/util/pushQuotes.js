// ============================================================================
// pushQuotes.js — le tre quote del ciclo di SPINTA IN BATTUTA (push-to-stop
// 15/9), lato pannello. Copia speculare di serverDati/pushQuotes.js: la
// parita' e' verificata da serverDati/test_push_to_stop.js.
//
// La FONTE DI VERITA' per il PLC e' la vista COORDINATES_PUSH_MC
// (scripts/coordinates-push-mc.sql): qui si calcola solo per BLOCCARE la
// creazione di un ordine che il PLC non saprebbe eseguire, e per dire
// all'operatore i millimetri che non tornano.
//
// CONVENZIONI: tutto in MICRON, asse di battuta = Y con battuta a Y
// CRESCENTI (fissa, non un dato). Le divisioni per due TRONCANO come la
// divisione intera di SQL Server.
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
export const PUSH_STATUS = { DISABLED: 'DISABLED', NO_VICE: 'NO_VICE', NO_DATA: 'NO_DATA', NO_FIT: 'NO_FIT', OK: 'OK' };

// Bit 1 di WORKORDER.OPTION2 = istantanea di PIECE.PUSH_TO_STOP (bit 0 al
// gripper doppio). Lo scrive il backend leggendo l'anagrafica: qui serve solo
// per l'anteprima.
export const PUSH_BIT = 2;

// enabled/hasVice/quote in micron; quote null se lo stato non e' OK, come la vista.
export function pushQuotes({ enabled, hasVice, yPlace, pieceY, viceClawLength, gripperThickness }) {
	const none = (s) => ({ status: s, yPush: null, yStop: null, clearance: null });
	if (!enabled) return none(PUSH_STATUS.DISABLED);
	if (!hasVice) return none(PUSH_STATUS.NO_VICE);
	const py = Number(pieceY) || 0;
	const claw = Number(viceClawLength) || 0;
	const tick = Number(gripperThickness) || 0;
	if (claw <= 0 || tick <= 0 || py <= 0) return none(PUSH_STATUS.NO_DATA);
	if (claw - py < 0) return none(PUSH_STATUS.NO_FIT);
	const yPush = Number(yPlace) - div2(py) - div2(tick);
	const clearance = div2(claw - py);
	return { status: PUSH_STATUS.OK, yPush, yStop: yPush + clearance, clearance };
}
