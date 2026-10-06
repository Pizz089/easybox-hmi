// ============================================================================
// util/breakpoints.js — le due misure di layout del pannello v3
//
// LARGO    >= 1600 px (verificato a 1920x1080, il kiosk di cella)
// COMPATTO <  1600 px (verificato a 1024x768, schermi 4:3, e 1280x800, tablet)
//
// Lo stesso punto di rottura sta in assets/css/design-tokens.css
// (@media (max-width: 1599px)), dove il compatto ridefinisce le misure.
// Qui per chi deve cambiare STRUTTURA da JS (es. schede al posto di
// colonne): i colori e le misure restano nel CSS.
// ============================================================================
import { ref, onMounted, onUnmounted } from 'vue';

export const BP_COMPACT_MAX = 1599;
export const COMPACT_QUERY = '(max-width: ' + BP_COMPACT_MAX + 'px)';

// true sotto i 1600 px. Si aggiorna se la finestra cambia (rotazione del
// tablet, finestra ridimensionata).
export function useCompact() {
	const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(COMPACT_QUERY) : null;
	const compact = ref(mq ? mq.matches : false);
	const onChange = e => { compact.value = e.matches; };
	onMounted(() => mq && mq.addEventListener('change', onChange));
	onUnmounted(() => mq && mq.removeEventListener('change', onChange));
	return compact;
}
