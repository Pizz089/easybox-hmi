// ============================================================================
// declEcho.js — l'eco giusto della Reimposta stato cella (7/10 sera,
// simulazione bis B55)
//
// runDeclSequence (robotView) manda 36/37, 38 e 35 uno alla volta e passa al
// successivo quando arriva l'eco. Fino al 7/10 bastava che arrivasse UN eco
// qualunque sull'evento: un eco on-change di un'altra cosa (un refresh 90,
// la catena di un prelievo) chiudeva il passo come se la dichiarazione fosse
// riuscita. Qui, per ogni comando, l'eco coerente: stessa logica di
// palletMachine.aspettaEco (un eco non coerente non chiude il passo: si va al
// timeout, col messaggio di oggi).
//
// FORMATI DEI PAYLOAD, dal PLC (export plc/FB del 7/10):
//   DECLARE/MC1      pallet;morsa;pezzo        FB_Machine_Autonomous.scl:1721
//                    (pezzo = piecepresent[1]: l'ID del 36, 0 col 37)
//   TRAY/EXTRACT     cassetto (0 = nessuno)   FB_easyBox.scl:349-357
//                    (FROM_PLANT/TRAY/BOX/EXTRACT, girato dal backend)
//   DECLARE/ROBOT    pinza;cont1;cont2         FB_Robot.scl:5575
//                    (Gripper_ID[1] e i contenuti dichiarati col 35)
//   DECLARE/TRAY     cassetto;tasca;stato      FB_Robot.scl:5397 (39); anche
//                    FB_Robot.scl:3304 (cassetto;tasca;2 dopo un prelievo)
//   DECLARE/TRAYTYPE cassetto;tipo             FB_Robot.scl:5389 (44)
// ============================================================================

// il campo i (da 0) di un payload a punti e virgola, come intero
export function campo(payload, i) {
	const v = parseInt(String(payload).split(';')[i], 10);
	return Number.isInteger(v) ? v : NaN;
}

// 36;pezzo -> terzo campo = pezzo; 37 -> terzo campo = 0
export const ecoMc = pezzo => p => campo(p, 2) === Number(pezzo || 0);
// 38;cassetto -> il cassetto dichiarato (0 = nessuno)
export const ecoBox = cassetto => p => campo(p, 0) === Number(cassetto || 0);
// 35;pinza;c1;id1;c2;id2 -> pinza;c1;c2
export const ecoRobot = (pinza, c1, c2) => p => campo(p, 0) === Number(pinza || 0) && campo(p, 1) === Number(c1 || 0) && campo(p, 2) === Number(c2 || 0);
// 39;tasca;stato -> cassetto disegnato, tasca e stato
export const ecoTasca = (cassetto, tasca, stato) => p => campo(p, 0) === Number(cassetto) && campo(p, 1) === Number(tasca) && campo(p, 2) === Number(stato);
// 44;tipo -> cassetto disegnato e tipo
export const ecoTipoCassetto = (cassetto, tipo) => p => campo(p, 0) === Number(cassetto) && campo(p, 1) === Number(tipo);
