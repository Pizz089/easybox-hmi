// ============================================================================
// util/holdState.js — quando il pulsante HOLD / CONTINUA / START si puo' usare
//
// Nel PLC il comando 17 e' un TOGGLE (FB_Robot, CMD_HOLD: IF NOT #holdButton
// THEN #HOLD := NOT #HOLD). Se il pannello non sa in che stato e' il robot,
// un pulsante con scritto "HOLD" potrebbe in realta' TOGLIERE l'hold.
// Due casi:
//   - STATUS ignoto: nessun dato ancora (null / undefined / vuoto);
//   - STATUS = NOT_DEFINED (0): FB7 lo pubblica quando communication_OK e'
//     falso, anche con HOLD vero nel PLC.
// In questi casi il pulsante resta visibile ma DISABILITATO, testo "—",
// tooltip "Stato del robot non noto" (views/unit/robotView.vue).
// ============================================================================
import { dataStored } from '../data.js';

export function robotStatoIgnoto(status) {
	if (status === null || status === undefined || String(status).trim() === '') return true;
	const n = Number(status);
	return !Number.isFinite(n) || n === dataStored.status_notDef;
}
