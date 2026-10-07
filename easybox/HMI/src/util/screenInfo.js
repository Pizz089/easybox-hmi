// ============================================================================
// screenInfo.js — i numeri veri dello schermo (pannello v3, fase E1.1, 7/10)
//
// In cella il pannello gira in compatto, quindi la finestra e' larga meno di
// 1600 px CSS: la scala di Windows (125 %: 1920 / 1,25 = 1536) o lo zoom del
// browser sono un'ipotesi, la risoluzione vera non e' documentata. La card
// «Schermo» di Impostazioni > Utente e lingua mostra cosa vede il browser:
//   innerWidth x innerHeight  in px CSS (quelli che decidono il layout);
//   devicePixelRatio          (scala di Windows x zoom del browser);
//   px fisici                 innerWidth x devicePixelRatio, circa;
//   misura di layout          Largo (>= 1600 px CSS) o Compatto.
// Non cambia il punto di rottura dei 1600 px: lo decide Dario dopo la
// lettura (util/breakpoints.js).
// ============================================================================
import { BP_COMPACT_MAX } from './breakpoints.js';

const due = v => String(Math.round(Number(v) * 100) / 100);

export function screenInfo({ width, height, dpr } = {}, compactMax = BP_COMPACT_MAX) {
	const w = Math.round(Number(width) || 0);
	const h = Math.round(Number(height) || 0);
	const r = Number(dpr) > 0 ? Number(dpr) : 1;
	const compatto = w <= compactMax;
	return {
		css: w + ' × ' + h,
		dpr: due(r),
		fisici: Math.round(w * r) + ' × ' + Math.round(h * r),
		compatto,
		misura: compatto ? 'settings.screen.compact' : 'settings.screen.wide',
		soglia: compactMax + 1,
	};
}

// i valori del browser adesso (window), per la card
export function leggiSchermo(win = typeof window !== 'undefined' ? window : null) {
	if (!win) return { width: 0, height: 0, dpr: 1 };
	return { width: win.innerWidth, height: win.innerHeight, dpr: win.devicePixelRatio || 1 };
}
