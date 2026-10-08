// ============================================================================
// pushQuotes.js — le tre quote del ciclo di SPINTA IN BATTUTA (push-to-stop
// 15/9), lato pannello. Copia speculare di serverDati/pushQuotes.js: la
// parita' e' verificata da serverDati/test_push_to_stop.js.
//
// La FONTE DI VERITA' per il PLC e' la vista COORDINATES_PUSH_MC
// (scripts/coordinates-push-mc.sql): qui si calcola per BLOCCARE la creazione
// di un ordine che il PLC non saprebbe eseguire, per dire all'operatore i
// millimetri che non tornano, e per disegnare la pagina di simulazione.
//
// CONVENZIONI: tutto in MICRON. L'asse di battuta e' la X del ROBOT (quella
// che il PLC manda come X_Pick-Place, non l'asse della macchina utensile).
// Durante la spinta la Y resta quella del deposito. La Z (6/10) scende di
// zPushDrop() sotto la Z di deposito: la chela spinge a PIECE_ON_VICE.Z_PUSH
// dal fondo del pezzo; con Z_PUSH vuota la Z resta quella del deposito.
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
// COMPENSAZIONE SPINTA (PIECE_ON_VICE.COMP_PUSH, micron, NULL = nessuna).
// Serve ai SEMILAVORATI, che non devono arrivare in battuta come il grezzo:
// dice di quanto il pezzo si deve fermare PRIMA della battuta teorica, quindi
// e' SEMPRE POSITIVO e SI SOTTRAE. La corsa effettiva risulta MINORE della
// corsa geometrica.
//
// E' uno scostamento fine sulla SOLA QUOTA DI ARRIVO: xPush e corsa restano il
// valore geometrico TEORICO, cosi' la compensazione resta LEGGIBILE come
// differenza fra le quote —
//
//   (xPush + corsa) - xStop = compensazione
//
// — e si distingue a colpo d'occhio cosa viene dal modello e cosa dalla
// taratura.
//
// NO_ROOM resta un fatto di GEOMETRIA (corsa teorica negativa: la spinta
// andrebbe all'indietro) e la compensazione non lo produce. Ma una
// compensazione PIU' GRANDE della corsa ha il suo esito, 'NO_COMP': l'arrivo
// finirebbe dietro la partenza e il robot spingerebbe nel verso opposto
// contro il pezzo gia' in morsa. In cella non c'e' niente che lo fermi (il
// controllo di plausibilita' di FB7 guarda la distanza da X_PLACE, non il
// verso), quindi lo deve dire questo modulo, mentre l'operatore digita.
//
// LA SIMULAZIONE DEVE DIRE QUELLO CHE FA IL PLC. Questa formula e' la stessa
// della vista COORDINATES_PUSH_MC: un pannello che mostrasse NO_ROOM mentre
// la cella parte si farebbe smettere di credere, e allora tanto vale non
// averlo. Riscontro di campo 17/9, ordine 1104: pezzo 1034 Y 100000, ganascia
// morsa 107200, chela pinza 42000, deposito 311000, compensazione 300 ->
// xPush 240000, corsa 3600, xStop 243300 (corsa effettiva 3300).
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
//   NO_COMP = la compensazione supera la corsa: l'arrivo finirebbe DIETRO la
//             partenza e la spinta si rovescerebbe
export const PUSH_STATUS = { DISABLED: 'DISABLED', NO_VICE: 'NO_VICE', NO_DATA: 'NO_DATA', NO_FIT: 'NO_FIT', NO_ROOM: 'NO_ROOM', NO_COMP: 'NO_COMP', OK: 'OK' };
// Su cosa appoggia il pezzo a fine corsa.
export const STOP_REF = { CLAW: 'CLAW', DECLARED: 'DECLARED' };

// Bit 1 di WORKORDER.OPTION2 = istantanea di PIECE.PUSH_TO_STOP (bit 0 al
// gripper doppio). Lo scrive il backend leggendo l'anagrafica.
// (6/10) QUOTA Z DELLA SPINTA: di quanto scende la chela sotto la Z di
// deposito. IDENTICA a COORDINATES_PUSH_MC.Z_PUSH_DROP (test di parita' in
// test_push_to_stop.js): mai null; vuota, pezzo senza quota di presa o valore
// oltre la quota di presa (pezzo cambiato dopo) -> 0, come prima; altrimenti
// Z_PICK - Z_PUSH. In micron. Il TCP e' in punta alla chela: a Z_PUSH = 0 la
// chela sta sul fondo del pezzo e non sfonda l'appoggio.
export function zPushDrop({ zPush, zPick }) {
  if (zPush === null || zPush === undefined || zPush === '') return 0;
  const ref = Number(zPick) || 0;        // ISNULL(pz.Z_PICK, 0)
  if (ref <= 0) return 0;
  const z = Number(zPush);
  if (z > ref) return 0;
  return ref - z;
}
export const PUSH_BIT = 2;

// (7/10, prompt 5 di 5) BATTUTA CORRETTA per le chele montate. La battuta
// dichiarata (PIECE_ON_VICE.STOP_BEYOND_CLAW) e' misurata dalla FINE della
// chela con cui e' stata dichiarata, ma il riferimento sta sulla MORSA:
// montate chele di un'altra lunghezza, la fine della chela si sposta e la
// battuta va riportata. Identica alle viste COORDINATES_PUSH_MC e
// COORDINATES_BLOW_MC:
//   dichiarata + REF/2 - montata/2          (divisioni intere, verso lo zero)
// cosi' X_Support del PLC (montata/2 + battuta) resta REF/2 + dichiarata al
// micron.
// (8/10, prompt 8) REF e' la lunghezza ADESSO del TIPO di chele con cui la
// battuta e' stata dichiarata (PIECE_ON_VICE.CLAW_JAW_REF -> VICE_JAW), non
// piu' una lunghezza salvata: se si corregge la misura del tipo montato, che e'
// anche quello di riferimento, la battuta la segue (X_Support cambia di meta'
// della correzione); con un altro tipo montato, la battuta si riporta.
// REF o montata non misurate (o nessun tipo di riferimento): la dichiarata
// com'e'. null/undefined/'' in ingresso = battuta non dichiarata -> null.
export function stopCorrected(stopBeyondClaw, clawLengthRef, viceClawLength) {
	if (stopBeyondClaw === null || stopBeyondClaw === undefined || stopBeyondClaw === '') return null;
	const d = Number(stopBeyondClaw);
	const ref = Number(clawLengthRef);
	const m = Number(viceClawLength) || 0;
	if (clawLengthRef === null || clawLengthRef === undefined || clawLengthRef === '' || !(ref > 0) || m <= 0) return d;
	return d + div2(ref) - div2(m);
}

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
// clawLengthRef: (8/10) la lunghezza del tipo di chele di riferimento della
//   battuta (PIECE_ON_VICE.CLAW_JAW_REF -> VICE_JAW.CLAW_LENGTH): la battuta
//   si corregge per le chele montate (stopCorrected). null/assente = nessuna
//   correzione.
// compPush: PIECE_ON_VICE.COMP_PUSH, di quanto il pezzo si ferma PRIMA della
//   battuta teorica (semilavorati): sempre positivo, si sottrae dal solo
//   ARRIVO. null/undefined/assente = nessuna compensazione = 0.
//   Qui l'assenza e lo zero coincidono, a differenza di stopBeyondClaw: non
//   compensare e compensare di zero sono la stessa cosa.
// Tutto in micron; per le altre misure null/0 = dato mancante.
// Ritorna { status, xPush, xStop, clearance, stopRef }: quote null se status
// non e' OK, esattamente come la vista. stopRef e' valorizzato anche su
// NO_FIT, NO_ROOM e NO_COMP, perche' li' la geometria il riferimento lo
// implica gia'.
export function pushQuotes({ enabled, hasVice, xPlace, pieceY, viceClawLength, gripperClawLength, stopBeyondClaw, compPush, clawLengthRef }) {
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
	// corsa TEORICA: la compensazione non entra qui
	// (7/10) la battuta corretta per le chele montate (stopCorrected)
	const stop = exceeds ? stopCorrected(declared, clawLengthRef, claw) : 0;
	const clearance = div2(claw - py) + (exceeds ? stop : 0);
	// < 0 e NON <= 0: corsa zero e' valida, vuol dire pezzo gia' a contatto
	if (clearance < 0) return none(PUSH_STATUS.NO_ROOM, ref);
	// la compensazione arretra il solo ARRIVO, quindi
	// (xPush + clearance) - xStop resta uguale a comp: e' cosi' che si legge
	const comp = Number(compPush) || 0;
	// ma se supera la corsa l'arrivo finisce DIETRO la partenza: la spinta si
	// rovescerebbe contro il pezzo in morsa. Meglio nessuna spinta.
	if (clearance - comp < 0) return none(PUSH_STATUS.NO_COMP, ref);
	const xPush = Number(xPlace) - div2(py) - div2(tool);
	return { status: PUSH_STATUS.OK, xPush, xStop: xPush + clearance - comp, clearance, stopRef: ref };
}
