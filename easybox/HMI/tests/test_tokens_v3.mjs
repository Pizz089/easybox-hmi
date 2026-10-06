// ============================================================================
// tests/test_tokens_v3.mjs — token del design system v3 (approvato 6/10).
//
// 1. I valori sono quelli della tabella approvata da Dario (un cambio di
//    colore deve passare da qui, non da un .vue).
// 2. Contrasti minimi richiesti dal prompt v3:
//      --text-muted su --bg-surface  >= 4.5:1
//      --border-strong su --bg-input >= 3:1
//      --accent-on su --accent       >= 4.5:1
// 3. Font inclusi nel pannello (@fontsource), nessun font da internet.
// 4. Il compatto (< 1600 px) ridefinisce solo le misure, non i colori.
//
// Uso: node tests/test_tokens_v3.mjs   (dalla cartella easybox/HMI)
// ============================================================================
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const css = readFileSync('src/assets/css/design-tokens.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const iMedia = css.indexOf('@media');
const root = css.slice(0, iMedia < 0 ? undefined : iMedia);
const media = iMedia < 0 ? '' : css.slice(iMedia);
const tok = {};
for (const m of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tok[m[1]] = m[2].trim();
const risolvi = (v, giro = 0) => {
	const m = String(v).match(/^var\((--[\w-]+)\)$/);
	return m && giro < 5 ? risolvi(tok[m[1]], giro + 1) : v;
};
const hex = n => String(risolvi(tok[n])).toUpperCase();

console.log('1) valori della tabella v3');
const TABELLA = {
	'--bg-base': '#121314', '--bg-surface': '#1B1C1F', '--bg-surface-2': '#2A2C30', '--bg-input': '#232528',
	'--bg-sidebar': '#17181A', '--bg-icon': '#2A2C30', '--bg-strip': '#151618', '--bg-raised': '#222428',
	'--text-primary': '#ECEDEE', '--text-secondary': '#A4A8AE', '--text-muted': '#868A90', '--text-disabled': '#5F636A',
	'--border-subtle': '#24262A', '--border-default': '#3A3D42', '--border-strong': '#7D8188',
	'--accent': '#4D9BFF', '--accent-hover': '#6AACFF', '--accent-active': '#3A86EB', '--accent-on': '#0A1220',
	'--color-success': '#45C27D', '--color-warning': '#F2B230', '--color-danger': '#E5484D', '--color-info': '#5BC0EB',
	'--color-success-fg': '#5ED394', '--color-warning-fg': '#F6C65B', '--color-danger-fg': '#F26B6F', '--color-info-fg': '#7FD0F0',
	'--color-critical': '#D93B3B', '--color-critical-hover': '#C23232',
	'--pocket-empty': '#3A3D42', '--pocket-raw': '#5BC0EB', '--pocket-working': '#F2B230', '--pocket-finished': '#45C27D',
	'--pocket-abort': '#E5484D', '--pocket-locked': '#F47B2A', '--pocket-undef': '#0B0C0D', '--pocket-undef-border': '#4A4D53',
	'--pocket-on': '#0B1218',
};
const diversi = Object.entries(TABELLA).filter(([k, v]) => hex(k) !== v);
check(diversi.length === 0, 'colori come da tabella' + (diversi.length ? ': ' + diversi.map(([k, v]) => k + ' ' + hex(k) + ' (atteso ' + v + ')').join(', ') : ' (' + Object.keys(TABELLA).length + ' token)'));
const TINTE = { '--color-success-bg': 'rgba(69, 194, 125, 0.14)', '--color-warning-bg': 'rgba(242, 178, 48, 0.14)', '--color-danger-bg': 'rgba(229, 72, 77, 0.16)', '--color-info-bg': 'rgba(91, 192, 235, 0.16)' };
check(Object.entries(TINTE).every(([k, v]) => tok[k].replace(/\s/g, '') === v.replace(/\s/g, '')), '--color-*-bg sono tinte, non colori pieni');
check(tok['--radius-lg'] === '20px' && tok['--radius-btn'] === '16px' && tok['--radius-chip'] === '12px', 'forme: card 20, pulsanti e tile 16, chip 12');
check(tok['--touch-primary'] === '64px' && tok['--touch-target'] === '56px' && tok['--touch-target-min'] === '48px', 'bersagli: principali 64, secondari 56, minimo 48');
check(tok['--rail-width'] === '104px' && tok['--status-strip-height'] === '76px', 'shell: barra 104, striscia 76');
check(['--elevation-1', '--elevation-2'].every(k => tok[k] === 'none') && tok['--elevation-3'] !== 'none', 'ombra solo sui dialog (elevation-3)');
check(/Manrope/.test(tok['--font-family']) && /IBM Plex Mono/.test(tok['--font-mono']), 'Manrope per tutto, IBM Plex Mono per codici e ID');
const SCALA = { '--font-size-hero': '96px', '--font-size-state': '34px', '--font-size-title': '32px', '--font-size-body': '17px', '--font-size-label': '13px' };
check(Object.entries(SCALA).every(([k, v]) => tok[k] === v), 'scala tipografica larga 96 / 34 / 32 / 17 / 13');

console.log('\n2) contrasti minimi');
const L = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const C = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const coppie = [['--text-muted', '--bg-surface', 4.5], ['--border-strong', '--bg-input', 3], ['--accent-on', '--accent', 4.5]];
for (const [a, b, min] of coppie) { const r = C(hex(a), hex(b)); check(r >= min, a + ' su ' + b + ': ' + r.toFixed(2) + ':1 (minimo ' + min + ')'); }

console.log('\n3) compatto: solo misure');
const mediaTok = [...media.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]);
check(/max-width:\s*1599px/.test(media), 'punto di rottura a 1600 px');
check(mediaTok.length > 0 && mediaTok.every(([k, v]) => /px$/.test(v)), 'il compatto ridefinisce solo misure in px (' + mediaTok.map(([k]) => k).join(', ') + ')');
const M = Object.fromEntries(mediaTok);
check(M['--font-size-hero'] === '60px' && M['--font-size-state'] === '22px' && M['--font-size-title'] === '26px' && M['--font-size-label'] === '12px', 'scala compatta 60 / 22 / 26 / 12');
check(M['--rail-width'] === '84px' && M['--status-strip-height'] === '64px' && M['--radius-lg'] === '16px' && M['--touch-primary'] === '56px', 'compatto: barra 84, striscia 64, card 16, principali 56');
const bp = readFileSync('src/util/breakpoints.js', 'utf8');
check(/1599/.test(bp), 'stesso punto di rottura in util/breakpoints.js');

console.log('\n4) font inclusi, niente da internet');
const main = readFileSync('src/main.js', 'utf8');
check(/@fontsource\/manrope\/latin-(400|600|700|800)\.css/.test(main) && /@fontsource\/ibm-plex-mono\/latin-500\.css/.test(main), 'font importati da @fontsource nel bundle');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
check(!!(pkg.dependencies['@fontsource/manrope'] && pkg.dependencies['@fontsource/ibm-plex-mono'] && pkg.dependencies['lucide-vue-next']), 'dipendenze dichiarate: @fontsource/manrope, @fontsource/ibm-plex-mono, lucide-vue-next');
const files = [];
const scan = d => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) scan(p); else if (/\.(vue|css|js|html)$/.test(f)) files.push(p); } };
scan('src'); files.push('index.html');
const esterni = files.filter(f => /fonts\.googleapis|fonts\.gstatic|use\.typekit|fonts\.bunny/.test(readFileSync(f, 'utf8')));
check(esterni.length === 0, 'nessun font caricato da internet' + (esterni.length ? ': ' + esterni.join(', ') : ''));

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
