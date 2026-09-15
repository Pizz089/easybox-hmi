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
// CONVENZIONI: tutto in MICRON. L'asse di battuta e' la X del ROBOT (quella
// che il PLC manda come X_Pick-Place, non l'asse della macchina utensile).
// Durante la spinta Y e Z restano quelle del deposito: si muove solo la X.
// Le divisioni per due TRONCANO come la divisione intera di SQL Server.
//
//   deposito = xPlace
//   spinta   = xPlace - pezzo.Y/2 - lunghezza_chela_pinza/2
//   arrivo   = spinta + (ganascia_morsa - pezzo.Y)/2
//
// PERCHE' pezzo.Y SULLA X: fra disegno e robot c'e' una rotazione. Nel cassetto
// il passo lungo la X del robot vale PIECE.Y + SAFEY (convenzione validata sul
// ferro, util/gratingAxes.js), quindi e' PIECE.Y a correre lungo la X; il pezzo
// non ruota fra presa e deposito, percio' in morsa presenta la stessa
// dimensione. Riscontro pezzo 1029 (PIECE.X 40, PIECE.Y 120): nel cassetto
// occupa 120 mm sulla X del robot e 40 sulla Y.
//
// Chele della pinza e ganasce della morsa si aprono entrambe lungo la Y, cioe'
// stringono DI TRAVERSO rispetto alla spinta: la chela presenta la sua
// LUNGHEZZA nella direzione in cui spinge (si compensa mezza lunghezza, il TCP
// e' al centro e il contatto e' al bordo) e la ganascia della morsa CONTIENE il
// pezzo nella direzione in cui scorre fino alla battuta.
// IPOTESI (confermata 15/9): deposito SEMPRE CENTRATO sulla morsa.
// ============================================================================

// divisione intera con troncamento verso zero, come SQL Server
const div2 = (v) => Math.trunc(Number(v) / 2);

// Stessi esiti della colonna PUSH_STATUS della vista.
export const PUSH_STATUS = { DISABLED: 'DISABLED', NO_VICE: 'NO_VICE', NO_DATA: 'NO_DATA', NO_FIT: 'NO_FIT', OK: 'OK' };

// Bit 1 di WORKORDER.OPTION2 = istantanea di PIECE.PUSH_TO_STOP (bit 0 al
// gripper doppio). Lo scrive il backend leggendo l'anagrafica.
export const PUSH_BIT = 2;

// quote in micron; null se lo stato non e' OK, come la vista.
export function pushQuotes({ enabled, hasVice, xPlace, pieceY, viceClawLength, gripperClawLength }) {
	const none = (s) => ({ status: s, xPush: null, xStop: null, clearance: null });
	if (!enabled) return none(PUSH_STATUS.DISABLED);
	if (!hasVice) return none(PUSH_STATUS.NO_VICE);
	const py = Number(pieceY) || 0;
	const claw = Number(viceClawLength) || 0;
	const tool = Number(gripperClawLength) || 0;
	if (claw <= 0 || tool <= 0 || py <= 0) return none(PUSH_STATUS.NO_DATA);
	if (claw - py < 0) return none(PUSH_STATUS.NO_FIT);
	const xPush = Number(xPlace) - div2(py) - div2(tool);
	const clearance = div2(claw - py);
	return { status: PUSH_STATUS.OK, xPush, xStop: xPush + clearance, clearance };
}
