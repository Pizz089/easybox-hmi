// ============================================================================
// appHeight.js — altezza della shell dove il browser non conosce 100dvh
// (fase E1.4, 7/10)
//
// La shell (layout/v3/AppShell.vue) e la barra a sinistra usano --app-h:
// 100dvh dove esiste (design-tokens.css, @supports). Su un browser vecchio
// 100vh comprende anche la barra degli indirizzi nascosta, e il fondo della
// shell, dove sta Impostazioni, finiva sotto il bordo. Li' --app-h si prende
// da innerHeight, al ridimensionamento e alla rotazione.
// Ritorna la funzione che stacca gli ascoltatori ('' se non serve).
// ============================================================================
export function serveAppHeight(win = typeof window !== 'undefined' ? window : null) {
	if (!win || !win.CSS || typeof win.CSS.supports !== 'function') return !!win;
	return !win.CSS.supports('height', '100dvh');
}

export function installAppHeight(win = typeof window !== 'undefined' ? window : null) {
	if (!serveAppHeight(win)) return () => {};
	const metti = () => win.document.documentElement.style.setProperty('--app-h', win.innerHeight + 'px');
	metti();
	win.addEventListener('resize', metti);
	win.addEventListener('orientationchange', metti);
	return () => {
		win.removeEventListener('resize', metti);
		win.removeEventListener('orientationchange', metti);
	};
}
