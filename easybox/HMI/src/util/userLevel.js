// ============================================================================
// userLevel.js — l'icona del livello utente (pannello v3, fase E1.3, 7/10)
//
// Al posto dei PNG di prima (casco.png, chiaveIng.svg, laurea.png) le icone
// lucide, nello stesso set del resto del pannello:
//   0 operatore    HardHat
//   1 manutentore  Wrench
//   2 ingegnere    GraduationCap
// Le usano la striscia di stato (pulsante utente, in tutte e due le misure)
// e il dialog del cambio utente (components/ChangeUserModal.vue).
// ============================================================================
import { HardHat, Wrench, GraduationCap } from 'lucide-vue-next';

export const ICONE_LIVELLO = { 0: HardHat, 1: Wrench, 2: GraduationCap };

export function iconaLivello(livello) {
	return ICONE_LIVELLO[Number(livello)] || HardHat;
}
