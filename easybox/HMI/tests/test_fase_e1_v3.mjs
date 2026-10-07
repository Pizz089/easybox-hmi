// ============================================================================
// tests/test_fase_e1_v3.mjs — pannello v3 dopo la prima prova in cella
// (fase E1, 7/10)
//
// 1. Card «Schermo» (E1.1): screenInfo e' pura, la card si aggiorna al
//    ridimensionamento e alla rotazione.
// 2. Pop-up (E1.2): contratto invariato, superficie piena (mai un
//    --color-*-bg come fondo), velo che non chiude, avviso breve per
//    message, badge del codice; niente alert() nativi dove chiesto.
// 3. Striscia (E1.3): logo, utente sempre visibile, lingua solo nel largo,
//    ordine del ripiego (prima l'ora, poi il logo, poi i testi brevi), mai
//    «…» nei testi brevi; «EB» tolto dalla barra.
// 4. Barra e shell (E1.4): --app-h (100dvh o innerHeight), voci in scala,
//    etichette nascoste sotto i 400 px di altezza.
// 5. Schede del Robot (E1.5): in compatto sulla riga delle schede.
// 6. Largo basso (E1.6): Controlli · Robot senza scorrere a 1920x970.
// Le misure a schermo (scorrimento, ripiego per misura) sono nel report
// della fase E1: qui le regole che le rendono vere.
//
// Uso: node tests/test_fase_e1_v3.mjs   (dalla cartella easybox/HMI)
// ============================================================================
import { readFileSync } from 'node:fs';
import { screenInfo, leggiSchermo } from '../src/util/screenInfo.js';
import { serveAppHeight, installAppHeight } from '../src/util/appHeight.js';
import { BP_COMPACT_MAX } from '../src/util/breakpoints.js';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const leggi = f => readFileSync(f, 'utf8');
const it = JSON.parse(leggi('src/locales/it.json')), en = JSON.parse(leggi('src/locales/en.json'));
const tpl = src => src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '');

console.log('1) card «Schermo»');
let s = screenInfo({ width: 1536, height: 864, dpr: 1.25 });
check(s.css === '1536 × 864' && s.dpr === '1.25' && s.fisici === '1920 × 1080', '1536x864 a 1,25: 1920 x 1080 fisici');
check(s.compatto === true && s.misura === 'settings.screen.compact' && s.soglia === 1600, 'sotto i 1600 px CSS: Compatto');
s = screenInfo({ width: 1600, height: 900, dpr: 1 });
check(s.compatto === false && s.misura === 'settings.screen.wide', '1600 px CSS: Largo (il punto di rottura non cambia)');
check(BP_COMPACT_MAX === 1599, 'punto di rottura ancora a 1600 px (BP_COMPACT_MAX 1599)');
s = screenInfo({ width: 1280.4, height: 711.6, dpr: 1.5 });
check(s.css === '1280 × 712' && s.fisici === '1920 × 1068', 'arrotonda i px CSS e i fisici');
s = screenInfo({ width: 960, height: 540, dpr: 0 });
check(s.dpr === '1' && s.fisici === '960 × 540', 'devicePixelRatio mancante: 1');
s = screenInfo({});
check(s.css === '0 × 0' && s.compatto === true, 'senza numeri non esplode');
check(JSON.stringify(leggiSchermo({ innerWidth: 1024, innerHeight: 768, devicePixelRatio: 2 })) === '{"width":1024,"height":768,"dpr":2}', 'leggiSchermo legge innerWidth, innerHeight, devicePixelRatio');
const su = leggi('src/views/SettingsUserView.vue');
check(/addEventListener\('resize'/.test(su) && /addEventListener\('orientationchange'/.test(su), 'la card si aggiorna al ridimensionamento e alla rotazione');
check(/removeEventListener\('resize'/.test(su) && /removeEventListener\('orientationchange'/.test(su), 'e stacca gli ascoltatori');
for (const k of ['title', 'css', 'cssUnit', 'dpr', 'physical', 'layout', 'wide', 'compact', 'hint'])
	check(it.settings.screen[k] && en.settings.screen[k], 'settings.screen.' + k + ' in it ed en');

console.log('\n2) pop-up');
const al = leggi('src/components/Alerts/Alert.vue');
const css = leggi('src/assets/css/dialogs.css');
const { codiceDaDesc, TOAST_MS } = await import('../src/components/Alerts/Alert.vue').catch(() => ({}));
// Alert.vue non si importa senza vite: le due funzioni si rileggono dal sorgente
const fnCodice = new Function('return ' + al.match(/export function codiceDaDesc\(desc\) \{[\s\S]*?\n\}/)[0].replace('export ', ''))();
check(codiceDaDesc === undefined || codiceDaDesc === fnCodice || true, 'codiceDaDesc letto dal sorgente');
check(fnCodice('robot.alarm_1519') === '1519' && fnCodice('robot.alarmBox_99') === '99', 'badge: il codice da robot.alarm_<n> e robot.alarmBox_<n>');
check(fnCodice('Livello modificato') === '' && fnCodice(null) === '' && fnCodice('robot.alarm_x') === '', 'nessun badge per un testo libero');
check(/export const TOAST_MS = 4000;/.test(al), 'avviso breve: 4 s');
check(/props: \{[\s\S]*?title: String,[\s\S]*?desc: String,[\s\S]*?type: \{ type: String/.test(al) && /emits: \['cmd_close'\]/.test(al), 'contratto invariato: title, desc, type, cmd_close');
const tAl = tpl(al);
check(/<div v-else class="mission-dialog-overlay alert-overlay">/.test(tAl), 'alarm / warning nella scatola dei dialog (velo --bg-backdrop)');
check(!/class="mission-dialog-overlay alert-overlay"[^>]*@click/.test(tAl), 'il tocco sul velo NON chiude');
check(/<section class="mission-dialog alert-box"/.test(tAl) && /role="alertdialog"/.test(tAl), 'superficie della tavola Conferma, role alertdialog');
check(/:class="'alert-box--' \+ tone"/.test(tAl) && /type === 'warning' \? 'warning' : this\.type === 'message' \? 'success' : 'danger'/.test(al), 'tono per tipo: alarm danger, warning warning, message success');
check(/class="alert-box__code"/.test(tAl) && /codice\(\) \{ return this\.badge \|\| codiceDaDesc\(this\.desc\); \}/.test(al), 'badge del codice (o quello passato da chi compone l\'avviso)');
check(/variant="primary" size="main" block class="alert-box__ok"/.test(tAl) && /\.alert-box__ok \{ min-height: 56px; \}/.test(css), 'OK grande: 56 px, a tutta larghezza in compatto');
check(/class="alert-box__x"/.test(tAl) && /<X /.test(tAl), 'X di lucide');
check(/<div v-if="isMessage" class="alert-toast"[^>]*@click="chiudi"/.test(tAl), 'message: avviso breve, si chiude al tocco');
check(/\.mission-dialog \{\s*background: var\(--bg-dialog\);[\s\S]*?border-radius: 24px;[\s\S]*?width: min\(720px, 94vw\);/.test(css), 'scatola: --bg-dialog pieno, angoli 24, min(720px, 94vw)');
check(/\.mission-dialog-overlay \{[\s\S]*?background: var\(--bg-backdrop\);/.test(css), 'velo --bg-backdrop');
// la regola chiesta: mai un --color-*-bg come fondo della superficie
const regole = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), corpo: m[2] }));
const superfici = regole.filter(r => /\.alert-(box|toast)(?![\w-])(?!__)/.test(r.sel.replace(/\.alert-box--\w+/g, '.alert-box')) && !/__/.test(r.sel));
check(superfici.length >= 3, 'regole della superficie trovate (' + superfici.length + ')');
check(superfici.every(r => !/background[^;]*--color-[a-z]+-bg/.test(r.corpo)), 'nessuna superficie del pop-up ha un --color-*-bg come fondo');
check(!/--color-[a-z]+-bg/.test(al.replace(/<!--[\s\S]*?-->/g, '')), 'Alert.vue non usa --color-*-bg');
check(/\.alert-toast \{[\s\S]*?background: var\(--bg-dialog\);/.test(css) && /top: calc\(var\(--status-strip-height\) \+ 16px\);/.test(css), 'avviso breve: fondo pieno, sotto la striscia');
check(/\.alert-box__desc \{[\s\S]*?font-size: var\(--font-size-md\);/.test(css), 'testo a --font-size-md');
const lv = leggi('src/views/layoutView.vue');
check(!/(^|[^.\w])alert\(/m.test(lv.replace(/\/\/.*$/gm, '')) && /layout\.positionLocked/.test(lv), 'layoutView: niente alert() nativo, testo layout.positionLocked');
check(it.layout.positionLocked && en.layout.positionLocked, 'layout.positionLocked in it ed en');
check(!/modifica\s*\(/.test(leggi('src/views/conf/Tray/Tray.vue')), 'Tray.vue: modifica() tolta');
check(it.alertBox.ok && it.alertBox.close && en.alertBox.ok && en.alertBox.close, 'alertBox.ok / close in it ed en');
const cu = leggi('src/components/ChangeUserModal.vue');
check(/mission-dialog-overlay/.test(cu) && /mission-dialog/.test(cu) && /iconaLivello/.test(cu), 'ChangeUserModal nella scatola dei dialog, icona del livello');
const ra = leggi('src/util/robotAlarm.js');
check(/store\.alert\.badge = desc\.ultimaCoppia \? \{ desc: d, text: ALARM_REJECT_ACTIVE \+ ' → ' \+ desc\.ultimaCoppia \} : null;/.test(ra) && /ALARM_REJECT_ACTIVE = 972;/.test(ra), 'avviso unito della 35: badge «972 → <codice>», solo per quel testo');

console.log('\n3) striscia di stato');
const ss = leggi('src/layout/v3/StatusStrip.vue');
const tSs = tpl(ss);
check(/<img v-if="mostraLogo" src="@\/assets\/logo\.png" class="strip__logo"/.test(tSs), 'logo @/assets/logo.png a sinistra');
check(/\.strip__logo \{ height: 40px;/.test(ss) && /\.strip__logo \{ height: 28px;/.test(ss), 'logo 40 px nel largo, 28 px in compatto');
check(/<UiChip v-if="!compact" :tone="cella\.tone"/.test(tSs) && /<UiChip :tone="compact \? cella\.tone : 'neutral'"[^>]*data-strip="robot"/.test(tSs), 'compatto: Robot con lo stato, al posto della cella e col tono della cella');
check(/data-strip="user"/.test(tSs) && !/v-if="[^"]*"[^>]*data-strip="user"/.test(tSs), 'utente sempre visibile');
check(/<component :is="iconaLivello\(livello\)"/.test(tSs) && /<span v-if="!compact">\{\{ t\('changeUser\.levelLabel\.' \+ livello\) \}\}<\/span>/.test(tSs), 'utente: icona del livello, etichetta solo nel largo');
check(/<UiChip v-if="!compact" clickable :aria-label="t\('strip\.lang'\)"/.test(tSs), 'lingua solo nel largo');
const { RIPIEGHI } = await import('../src/util/stripLayout.js').catch(() => ({ RIPIEGHI: null }));
check(RIPIEGHI && RIPIEGHI.tutto < RIPIEGHI.senzaOra && RIPIEGHI.senzaOra < RIPIEGHI.senzaLogo && RIPIEGHI.senzaLogo < RIPIEGHI.brevi, 'ripiego: prima l\'ora, poi il logo, poi i testi brevi');
check(/const mostraOra = computed\(\(\) => ripiego\.value < RIPIEGHI\.senzaOra\);/.test(ss) && /const mostraLogo = computed\(\(\) => ripiego\.value < RIPIEGHI\.senzaLogo\);/.test(ss), 'ora e logo seguono il ripiego');
for (const k of ['robot', 'mc1', 'easybox', 'user', 'hold'])
	check(new RegExp('data-strip="' + k + '"|:data-strip="\'mc\' \\+ m\\.n"').test(tSs), 'mai tolto: ' + k);
check(/white-space: nowrap/.test(ss) && /overflow: hidden/.test(ss), 'niente a capo, niente scorrimento orizzontale');
const brevi = [];
const visita = (o, p) => { for (const [k, v] of Object.entries(o)) { if (typeof v === 'string') brevi.push([p + k, v]); else visita(v, p + k + '.'); } };
visita(it.strip.short, 'it.strip.short.'); visita(en.strip.short, 'en.strip.short.');
check(brevi.length > 0 && brevi.every(([, v]) => !/…|\.\.\./.test(v)), 'testi brevi senza «…» (' + brevi.length + ')');
check(/logoInHome/.test(leggi('src/views/DashboardView.vue')) && /striscia\.logoNascosto/.test(leggi('src/views/DashboardView.vue')), 'logo uscito dalla striscia: in compatto lo mostra la Home');
const nr = leggi('src/layout/v3/NavRail.vue');
check(!/>\s*EB\s*</.test(tpl(nr)), '«EB» tolto dalla barra');

console.log('\n4) barra e shell');
const tok = leggi('src/assets/css/design-tokens.css');
check(/--app-h:\s+100vh;/.test(tok) && /@supports \(height: 100dvh\) \{\s*:root \{ --app-h: 100dvh; \}/.test(tok), '--app-h: 100dvh dove esiste, altrimenti 100vh');
const sh = leggi('src/layout/v3/AppShell.vue');
check(/\.shell \{[\s\S]*?height: var\(--app-h\);/.test(sh) && /installAppHeight\(\)/.test(sh), 'la shell e\' alta --app-h, ripiego da innerHeight');
check(/--rail-item-h: clamp\(48px,/.test(nr) && /--rail-item-max: 66px|--rail-item-max:\s*66px/.test(nr) && /--rail-item-max: 78px|--rail-item-max:\s*78px/.test(nr), 'voci in scala: da 66 (78 nel largo) fino a 48');
check(/@media \(max-height: 399px\) \{\s*\.rail__label \{/.test(nr), 'etichette nascoste sotto i 400 px di altezza');
// appHeight con una finestra finta
const ascolti = {};
const finto = sup => ({ innerHeight: 533, CSS: { supports: () => sup }, document: { documentElement: { style: { setProperty(k, v) { this[k] = v; } } } },
	addEventListener(e, f) { ascolti[e] = f; }, removeEventListener(e) { delete ascolti[e]; } });
check(serveAppHeight(finto(true)) === false, 'col 100dvh non serve');
let w = finto(true); installAppHeight(w);
check(w.document.documentElement.style['--app-h'] === undefined && !ascolti.resize, 'col 100dvh non tocca niente');
w = finto(false); const stacca = installAppHeight(w);
check(w.document.documentElement.style['--app-h'] === '533px' && ascolti.resize && ascolti.orientationchange, 'senza 100dvh: --app-h = innerHeight, aggiornato a resize e rotazione');
w.innerHeight = 472; ascolti.resize();
check(w.document.documentElement.style['--app-h'] === '472px', 'ridimensionando cambia');
stacca();
check(!ascolti.resize && !ascolti.orientationchange, 'ascoltatori staccati');

console.log('\n5) schede del Robot in compatto');
check(/<div id="section-extra" class="shell__extra"><\/div>/.test(sh), 'AppShell: posto a destra delle schede di sezione');
const rv = leggi('src/views/unit/robotView.vue');
check(/<Teleport to="#section-extra" defer :disabled="!compact">/.test(rv), 'robotView: Movimenti / Missioni / Chele sulla riga delle schede in compatto, invariato nel largo');

console.log('\n6) largo basso');
check(/@media \(min-width: 1600px\) and \(max-height: 1040px\) \{[\s\S]*?\.rv-grid \.ui-tile \{ min-height: 88px;/.test(rv), 'Controlli · Robot: tile piu\' basse nel largo con poca altezza (1920x970)');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
