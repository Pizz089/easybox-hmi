// ============================================================================
// util/lingua.js — lingua del pannello: lo stesso ciclo it -> en della barra
// di prima (barraInAlto.changeLang), in un posto solo. Lo usano la striscia
// di stato e la scheda Impostazioni > Utente e lingua.
// ============================================================================
import { useI18n } from 'vue-i18n';

export const LINGUE = ['it', 'en'];

export function useLingua() {
	const { locale } = useI18n();
	function cambiaLingua() {
		locale.value = LINGUE[(LINGUE.indexOf(locale.value) + 1) % LINGUE.length];
	}
	return { locale, cambiaLingua };
}
