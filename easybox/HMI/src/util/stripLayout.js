// ============================================================================
// stripLayout.js — cosa la striscia di stato ha dovuto togliere (fase E1.3,
// 7/10)
//
// La striscia (layout/v3/StatusStrip.vue) misura se ci sta tutto e, se no,
// ripiega a passi: prima toglie l'ora, poi il logo, poi passa ai testi
// brevi (strip.short.*), infine stringe spazi e margini interni (serve con
// MC2 configurata sotto i 900 px). Mai Robot, MC, EasyBox, campanella,
// utente e HOLD.
// Se il logo e' uscito dalla striscia, in compatto lo mostra l'intestazione
// della Home (views/DashboardView: logoInHome). Qui lo stato condiviso.
// ============================================================================
import { reactive } from 'vue';

export const RIPIEGHI = { tutto: 0, senzaOra: 1, senzaLogo: 2, brevi: 3, stretta: 4 };

export const striscia = reactive({
	ripiego: 0,           // l'ultimo passo usato (RIPIEGHI)
	logoNascosto: false,  // il logo non c'e' nella striscia
	sfora: false,         // anche coi testi brevi non ci sta (da segnalare)
});
