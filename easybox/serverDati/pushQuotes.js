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
// CONVENZIONI: tutto in MICRON. L'asse di battuta e' la X del ROBOT (quella
// che il PLC manda come X_Pick-Place, non l'asse della macchina utensile).
// Durante la spinta Y e Z restano quelle del deposito: si muove solo la X.
// Le divisioni per due TRONCANO VERSO LO ZERO come la divisione intera di SQL
// Server, anche quando la differenza e' negativa (pezzo oltre la ganascia).
//
//   deposito = xPlace
//   spinta   = xPlace - pezzo.Y/2 - lunghezza_chela_pinza/2
//   arrivo   = spinta + corsa
//
// LA CORSA HA DUE CASI (chiarito da Dario 15/9). Un pezzo PIU' LUNGO della
// ganascia non e' un errore: e' legittimo e succede. Allora non appoggia sulla
// fine della ganascia ma piu' avanti, su un altro riferimento fisico, e quella
// distanza va DICHIARATA (PIECE_ON_VICE.STOP_BEYOND_CLAW, riga per coppia
// morsa+pezzo).
//
//   corsa = (ganascia - pezzo)/2               pezzo <= ganascia -> 'CLAW'
//   corsa = (ganascia - pezzo)/2 + dichiarata  pezzo >  ganascia -> 'DECLARED'
//
// Col pezzo DENTRO la ganascia il valore dichiarato si ignora: la fine della
// ganascia arriva prima e il pezzo si ferma li'. La quota di SPINTA invece non
// cambia mai, perche' la chela tocca il bordo vicino del pezzo e dove sta quel
// bordo non dipende dalla ganascia.
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
//   NO_FIT  = il pezzo eccede la ganascia e NESSUNO ha dichiarato dove appoggia
//   NO_ROOM = l'appoggio dichiarato e' piu' vicino di quanto il pezzo gia'
//             sporge: al deposito il pezzo sarebbe gia' oltre la battuta e la
//             corsa verrebbe negativa, cioe' la spinta andrebbe all'indietro
const PUSH_STATUS = { DISABLED: 'DISABLED', NO_VICE: 'NO_VICE', NO_DATA: 'NO_DATA', NO_FIT: 'NO_FIT', NO_ROOM: 'NO_ROOM', OK: 'OK' };
// Su cosa appoggia il pezzo a fine corsa.
const STOP_REF = { CLAW: 'CLAW', DECLARED: 'DECLARED' };
exports.PUSH_STATUS = PUSH_STATUS;
exports.STOP_REF = STOP_REF;

// enabled: bit di spinta dell'ordine (istantanea di PIECE.PUSH_TO_STOP).
// hasVice: c'e' una morsa sul pallet dell'ordine.
// xPlace: quota di deposito sulla X del robot.
// pieceY: PIECE.Y, la dimensione del pezzo che corre lungo la X.
// viceClawLength: VICE.CLAW_LENGTH. gripperClawLength: GRIPPER.CLAW_LENGTH.
// stopBeyondClaw: PIECE_ON_VICE.STOP_BEYOND_CLAW, cioe' quanto oltre la fine
//   della ganascia sta il vero appoggio. null/undefined = RIGA ASSENTE = non
//   dichiarato; lo ZERO e' un valore legittimo e diverso (appoggio dichiarato
//   sulla fine della ganascia anche per un pezzo che sporge). Il "non
//   dichiarato" sta nell'assenza, mai dentro il numero.
// Tutto in micron; per le altre misure null/0 = dato mancante.
// Ritorna { status, xPush, xStop, clearance, stopRef }: quote null se status
// non e' OK, esattamente come la vista. stopRef e' valorizzato anche su NO_FIT
// e NO_ROOM, perche' li' la geometria il riferimento lo implica gia'.
exports.pushQuotes = function ({ enabled, hasVice, xPlace, pieceY, viceClawLength, gripperClawLength, stopBeyondClaw }) {
	const none = (s, ref) => ({ status: s, xPush: null, xStop: null, clearance: null, stopRef: ref || null });
	if (!enabled) return none(PUSH_STATUS.DISABLED);
	if (!hasVice) return none(PUSH_STATUS.NO_VICE);
	const py = Number(pieceY) || 0;
	const claw = Number(viceClawLength) || 0;
	const tool = Number(gripperClawLength) || 0;
	if (claw <= 0 || tool <= 0 || py <= 0) return none(PUSH_STATUS.NO_DATA);
	const exceeds = py > claw;
	const ref = exceeds ? STOP_REF.DECLARED : STOP_REF.CLAW;
	const declared = stopBeyondClaw === null || stopBeyondClaw === undefined || stopBeyondClaw === ''
		? null : Number(stopBeyondClaw);
	if (exceeds && (declared === null || isNaN(declared))) return none(PUSH_STATUS.NO_FIT, ref);
	const clearance = div2(claw - py) + (exceeds ? declared : 0);
	if (clearance < 0) return none(PUSH_STATUS.NO_ROOM, ref);
	const xPush = Number(xPlace) - div2(py) - div2(tool);
	return { status: PUSH_STATUS.OK, xPush, xStop: xPush + clearance, clearance, stopRef: ref };
};

// Bit 1 di WORKORDER.OPTION2 = istantanea di PIECE.PUSH_TO_STOP (il bit 0
// resta al gripper doppio). La vista legge (OPTION2 & 2) <> 0.
exports.PUSH_BIT = 2;
exports.isPushEnabled = function (option2) {
	return ((Number(option2) || 0) & exports.PUSH_BIT) !== 0;
};
