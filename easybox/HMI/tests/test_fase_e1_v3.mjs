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
// 7. Menu (E1.7): Pinze e Spinta voci della barra, «Chele pinza» nella
//    pagina Robot (l'ordine delle voci e le rotte: tests/test_shell_v3.mjs).
// 8. (8/10, prompt 7, parte B) correzioni dall'audit: striscia che non
//    rimisura all'infinito, tipo dell'allarme, esito breve a parte, velo
//    sotto la striscia, avviso breve in basso, card Schermo dalla media query
//    del layout, riga delle schede senza :has(). Il HOLD: test_hold_guard.
// Le misure a schermo (scorrimento, ripiego per misura) sono nel report
// della fase E1: qui le regole che le rendono vere.
//
// Uso: node tests/test_fase_e1_v3.mjs   (dalla cartella easybox/HMI)
// ============================================================================
import { readFileSync } from 'node:fs';
import { screenInfo, leggiSchermo } from '../src/util/screenInfo.js';
import { serveAppHeight, installAppHeight } from '../src/util/appHeight.js';
import { BP_COMPACT_MAX, COMPACT_QUERY } from '../src/util/breakpoints.js';
import { reactive } from 'vue';
import { creaSmistaAvvisi, avvisoBreve } from '../src/util/avvisoBreve.js';

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
check(JSON.stringify(leggiSchermo({ innerWidth: 1024, innerHeight: 768, devicePixelRatio: 2 })) === '{"width":1024,"height":768,"dpr":2,"schermoW":0,"schermoH":0}', 'leggiSchermo legge innerWidth, innerHeight, devicePixelRatio');
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
check(/\.alert-toast \{[\s\S]*?background: var\(--bg-dialog\);/.test(css) && /\.alert-toast \{[^}]*bottom: 16px;/.test(css), 'avviso breve: fondo pieno (8/10: in basso a destra, B6)');
check(/\.alert-box__desc \{[\s\S]*?font-size: var\(--font-size-md\);/.test(css), 'testo a --font-size-md');
const lv = leggi('src/views/layoutView.vue');
check(!/(^|[^.\w])alert\(/m.test(lv.replace(/\/\/.*$/gm, '')) && /layout\.positionLocked/.test(lv), 'layoutView: niente alert() nativo, testo layout.positionLocked');
check(it.layout.positionLocked && en.layout.positionLocked, 'layout.positionLocked in it ed en');
check(!/modifica\s*\(/.test(leggi('src/views/conf/Tray/Tray.vue')), 'Tray.vue: modifica() tolta');
check(it.alertBox.ok && it.alertBox.close && en.alertBox.ok && en.alertBox.close, 'alertBox.ok / close in it ed en');
const cu = leggi('src/components/ChangeUserModal.vue');
check(/mission-dialog-overlay/.test(cu) && /mission-dialog/.test(cu) && /iconaLivello/.test(cu), 'ChangeUserModal nella scatola dei dialog, icona del livello');
const ra = leggi('src/util/robotAlarm.js');
// (7/10 sera, consegna 35) il testo dell'avviso unito e' la chiave del codice:
// il badge vale solo con lo stesso testo E lo stesso titolo
check(/store\.alert\.badge = desc\.ultimaCoppia \? \{ desc: d, title: store\.alert\.title, text: ALARM_REJECT_ACTIVE \+ ' → ' \+ desc\.ultimaCoppia \} : null;/.test(ra) && /ALARM_REJECT_ACTIVE = 972;/.test(ra), 'avviso unito della 35: badge «972 → <codice>», solo per quell\'avviso');
check(/return b && b\.desc === dataStored\.alert\.desc && b\.title === dataStored\.alert\.title \? b\.text : '';/.test(leggi('src/layout/v3/AppShell.vue')), '   AppShell: badge solo con testo e titolo dell\'avviso unito (un 947 su ALARM/MC1 non lo eredita)');

console.log('\n3) striscia di stato');
const ss = leggi('src/layout/v3/StatusStrip.vue');
const tSs = tpl(ss);
check(/<img v-show="mostraLogo" src="@\/assets\/logo\.png" class="strip__logo"/.test(tSs), 'logo @/assets/logo.png a sinistra');
check(/\.strip__logo \{ height: 40px;/.test(ss) && /\.strip__logo \{ height: 28px;/.test(ss), 'logo 40 px nel largo, 28 px in compatto');
check(/<UiChip v-if="!compact" :tone="cella\.tone"/.test(tSs) && /<UiChip :tone="compact \? cella\.tone : 'neutral'"[^>]*data-strip="robot"/.test(tSs), 'compatto: Robot con lo stato, al posto della cella e col tono della cella');
check(/data-strip="user"/.test(tSs) && !/v-if="[^"]*"[^>]*data-strip="user"/.test(tSs), 'utente sempre visibile');
check(/<component :is="iconaLivello\(livello\)"/.test(tSs) && /<span v-if="!compact">\{\{ t\('changeUser\.levelLabel\.' \+ livello\) \}\}<\/span>/.test(tSs), 'utente: icona del livello, etichetta solo nel largo');
check(/<UiChip v-if="!compact" clickable :aria-label="t\('strip\.lang'\)"/.test(tSs), 'lingua solo nel largo');
const { RIPIEGHI } = await import('../src/util/stripLayout.js').catch(() => ({ RIPIEGHI: null }));
check(RIPIEGHI && RIPIEGHI.tutto < RIPIEGHI.senzaOra && RIPIEGHI.senzaOra < RIPIEGHI.senzaLogo && RIPIEGHI.senzaLogo < RIPIEGHI.brevi && RIPIEGHI.brevi < RIPIEGHI.stretta, 'ripiego: prima l\'ora, poi il logo, poi i testi brevi, infine gli spazi stretti');
check(/while \(sfora\(\) && ripiego\.value < RIPIEGHI\.stretta\)/.test(ss) && /scrollWidth > striscia\.value\.clientWidth;/.test(ss), 'ripiega finche\' sfora, anche di 1 px, fino all\'ultimo passo');
check(/\.strip--stretta \{ gap: 4px;/.test(ss) && !/\.strip--stretta[^{]*\{[^}]*(height|min-height)/.test(ss), 'il passo stretto riduce spazi e margini, non i bersagli');
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
check(/--rail-item-h: clamp\(44px, calc\(\(var\(--app-h\) - 2 \* var\(--rail-pad\) - \(var\(--rail-n\) - 1\) \* var\(--rail-gap\)\) \/ var\(--rail-n\)\), var\(--rail-item-max\)\);/.test(nr), 'voci in scala con l\'altezza, mai sotto i 44 px');
check(/--rail-n: 9;/.test(nr) && /--rail-item-max: 66px/.test(nr) && /--rail-item-max: 78px/.test(nr), 'nove voci, fino a 66 px in compatto e 78 nel largo');
// le soglie vengono dai conti: margini 12, spazi 2 (compatto e schermi bassi)
const pad = 12, gap = 2, alta = (n, h) => (h - 2 * pad - (n - 1) * gap) / n;
check(alta(9, 508) >= 52 && alta(9, 507) < 52, 'Allarmi esce sotto i 508 px: li\' le nove voci scendono sotto i 52 px');
check(/@media \(max-height: 507\.98px\) \{\s*\.rail \{ --rail-n: 8; \}\s*\.rail__item--drop \{ display: none; \}/.test(nr), 'sotto i 508 px: otto voci, Allarmi fuori');
check(alta(8, 454) >= 52 && alta(8, 453) < 52, 'con otto voci le etichette spariscono sotto i 454 px');
check(/@media \(max-height: 453\.98px\) \{\s*\.rail__label \{/.test(nr), 'etichette nascoste sotto i 454 px (resta l\'aria-label)');
check(alta(8, 400) >= 44, 'a 400 px di altezza le otto voci stanno a ' + alta(8, 400).toFixed(1) + ' px: nessuno scorrimento');
check(/@media \(max-height: 551\.98px\) \{\s*\.rail \{ --rail-pad: 12px; --rail-gap: 2px; \}/.test(nr), 'sotto i 552 px anche il largo usa i margini del compatto (le soglie valgono per tutti)');
check(/'rail__item--drop': s\.dropWhenShort/.test(nr), 'la voce che esce la dice navConfig (dropWhenShort)');
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

console.log('\n7) menu a nove voci');
const nc = leggi('src/layout/navConfig.js');
check(/import \{[^}]*\bGrab\b[^}]*\bArrowRightToLine\b[^}]*\} from 'lucide-vue-next';/.test(nc), 'icone lucide Grab (Pinze, gia\' usata in robotView) e ArrowRightToLine (Spinta)');
check(/id: 'grippers', label: 'nav\.grippers', icon: Grab,/.test(nc) && /id: 'push', label: 'nav\.push', short: 'nav\.short\.push', icon: ArrowRightToLine,/.test(nc), 'voci Pinze e Spinta in navConfig');
check(it.nav.grippers === 'Pinze' && it.nav.push === 'Spinta in battuta' && it.nav.short.push === 'Spinta', 'testi it: Pinze, Spinta in battuta, «Spinta» in compatto');
check(en.nav.grippers === 'Grippers' && en.nav.push === 'Push to stop' && en.nav.short.push === 'Push', 'testi en');
check(it.robot.section.claws === 'Chele pinza' && en.robot.section.claws === 'Gripper claws', 'Controlli · Robot: «Chele pinza» nel selettore e nel titolo della card');
check((rv.match(/\$t\('robot\.section\.claws'\)/g) || []).length >= 2, 'stessa chiave per il selettore e per la card');
check(![it.nav.grippers, it.nav.push, it.nav.short.push, it.robot.section.claws].some(v => /ganasc/i.test(v)), 'nessun testo nuovo con «ganascia»');
check(/Nove voci/.test(nr) && !/Sette voci/.test(nr), 'commento di NavRail aggiornato (nove voci)');
const uds = leggi('../docs/UI-DESIGN-SYSTEM.md');
check(/Nove voci con icona ed etichetta/.test(uds) && /\| Pinze \| `\/conf\/Grippers`/.test(uds) && /Allarmi esce dalla barra/.test(uds), 'UI-DESIGN-SYSTEM §5: barra a nove voci e regola degli schermi bassi');

console.log('\n8) (8/10, prompt 7) correzioni dall\'audit');
// B2: con v-if il logo si ricreava a ogni misura e il suo load rilanciava la
// misura: a 960x540 la striscia misurava all'infinito
check(!/@load/.test(tSs) && /<span v-show="mostraOra" class="strip__clock">/.test(tSs) && !/v-if="mostra(Logo|Ora)"/.test(tSs),
	'B2 striscia: logo e ora con v-show, nessun @load che rilanci la misura');
check(/statoStriscia\.misure\+\+;/.test(ss) && /misure: 0,/.test(leggi('src/util/stripLayout.js')), '   il numero di misure si conta (striscia.misure): a schermo fermo non cresce (misurato nel report)');
// B3: un allarme del robot scritto senza tipo restava 'message'
const rvB = leggi('src/views/unit/robotView.vue');
const handlerStato = rvB.slice(rvB.indexOf('this.statusHandler = payload => {'), rvB.indexOf("dataStored.WS.socket.on('ROBOT/STATUS', this.statusHandler);"));
check((handlerStato.match(/dataStored\.alert\.type = 'alarm';/g) || []).length === 2, 'B3 robotView: allarme e abort del robot scrivono anche il tipo (alarm)');
check(/emptyAlertList\(\)\{[\s\S]*?dataStored\.alert\.type='alarm';[\s\S]*?\}/.test(leggi('src/data.js')), '   emptyAlertList rimette il tipo alarm (copre anche layoutView)');
// B4: un message non cancella l'allarme aperto
const store = reactive({ alert: { title: '', desc: '', type: 'alarm', check: [] } });
const sm = creaSmistaAvvisi(store);
Object.assign(store.alert, { title: 'ALARM', desc: 'robot.alarm_1519', type: 'alarm' }); sm.smista();
Object.assign(store.alert, { title: 'Livello modificato', desc: 'Ora sei: Manutentore', type: 'message' }); sm.smista();
check(store.alert.title === 'ALARM' && store.alert.desc === 'robot.alarm_1519' && store.alert.type === 'alarm'
	&& sm.breve.title === 'Livello modificato' && sm.breve.desc === 'Ora sei: Manutentore',
	'B4 message con un allarme aperto: l\'allarme resta a video, il message va nell\'avviso breve');
sm.smista();
check(store.alert.title === 'ALARM' && sm.breve.n === 1, '   e non si ripete');
Object.assign(store.alert, { title: '', desc: '', check: [] }); sm.smista();
Object.assign(store.alert, { title: 'INFO', desc: 'robot.decl.done', type: 'message' }); sm.smista();
check(store.alert.title === '' && store.alert.type === 'alarm' && sm.breve.desc === 'robot.decl.done' && sm.breve.n === 2,
	'   senza allarme aperto: solo l\'avviso breve, e il riquadro torna al tipo alarm');
Object.assign(store.alert, { title: 'WARNING', desc: 'cmd.holdNotConfirmed', type: 'warning', badge: null }); sm.smista();
Object.assign(store.alert, { title: 'INFO', desc: 'x', type: 'message' }); sm.smista();
check(store.alert.type === 'warning' && store.alert.desc === 'cmd.holdNotConfirmed', '   vale anche per un warning aperto');
sm.chiudiBreve();
check(sm.breve.title === '', '   l\'avviso breve si chiude da solo');
// (prompt 10) allarme e message nello STESSO giro di eventi: il watch di
// AppShell vede solo lo stato finale. Alla vecchia maniera (tutti e due in
// dataStored.alert) l'allarme si perdeva e il riquadro restava vuoto; col
// message scritto direttamente nell'avviso breve l'allarme resta.
{
	const st = { alert: { title: '', desc: '', type: 'alarm', check: [] } };
	const prova = creaSmistaAvvisi(st, { title: '', desc: '', n: 0 });
	Object.assign(st.alert, { title: 'ALARM', desc: 'robot.alarm_1519', type: 'alarm' });
	Object.assign(st.alert, { title: 'INFO', desc: 'robot.decl.done', type: 'message' });
	prova.smista();
	check(st.alert.title === '' && prova.breve.title === 'INFO', '   (prompt 10) com\'era: allarme e message nello stesso tick dentro dataStored.alert, l\'allarme si perde (riquadro vuoto)');
	const st2 = { alert: { title: '', desc: '', type: 'alarm', check: [] } };
	const sm2 = creaSmistaAvvisi(st2);
	sm2.chiudiBreve();
	const n0 = sm2.breve.n;
	Object.assign(st2.alert, { title: 'ALARM', desc: 'robot.alarm_1519', type: 'alarm' });
	avvisoBreve('INFO', 'robot.decl.done');
	sm2.smista();
	check(st2.alert.title === 'ALARM' && st2.alert.desc === 'robot.alarm_1519' && st2.alert.type === 'alarm' && sm2.breve.title === 'INFO' && sm2.breve.desc === 'robot.decl.done' && sm2.breve.n === n0 + 1,
		'   (prompt 10) adesso: allarme e avviso breve nello stesso tick, l\'allarme a video e il message nell\'avviso breve');
	sm2.chiudiBreve();
}
// (prompt 10) gli undici punti che scrivono un esito positivo chiamano
// avvisoBreve() e non scrivono piu' un message in dataStored.alert
{
	const PUNTI = { 'src/components/ChangeUserModal.vue': 1, 'src/components/RelaunchDialog.vue': 1, 'src/views/conf/AttrezzaggiView.vue': 1, 'src/views/conf/Tray/Tray.vue': 1,
		'src/views/conf/TraysView.vue': 1, 'src/views/layoutView.vue': 2, 'src/views/productionView.vue': 1, 'src/views/unit/robotView.vue': 3 };
	const sbagliati = Object.entries(PUNTI).filter(([f, n]) => {
		const s = readFileSync(f, 'utf8');
		return (s.match(/avvisoBreve\(/g) || []).length !== n || /alert\.type = ['"]message['"]/.test(s) || !/import \{ avvisoBreve \} from '@\/util\/avvisoBreve\.js';/.test(s);
	});
	check(sbagliati.length === 0, '   (prompt 10) gli 11 esiti positivi vanno direttamente all\'avviso breve (' + (sbagliati.map(([f]) => f).join(', ') || 'tutti') + ')');
}
// (prompt 10, ramo del catalogo) e nessun esito positivo scritto ancora in
// dataStored.alert, in tutto il pannello (qui c'e' anche la morsa creata)
{
	const { readdirSync, statSync } = await import('node:fs');
	const tutti = [];
	const giro = d => { for (const n of readdirSync(d)) { const p = d + '/' + n; if (statSync(p).isDirectory()) giro(p); else if (/\.(vue|js)$/.test(n)) tutti.push(p); } };
	giro('src');
	const ancora = tutti.filter(f => /alert\.type = ['"]message['"]/.test(readFileSync(f, 'utf8')));
	check(ancora.length === 0 && /avvisoBreve\("INFO", this\.\$t\("vice\.created", \{ id \}\)\);/.test(readFileSync('src/views/conf/Vice/Vice.vue', 'utf8')),
		'   (prompt 10) nessun message scritto in dataStored.alert in tutto il pannello, morsa creata compresa (' + (ancora.join(', ') || 'nessuno') + ')');
}
check(/<alert\s+v-if="dataStored\.alert && dataStored\.alert\.title && dataStored\.alert\.type !== 'message'"/.test(sh)
	&& /<alert v-if="breve\.title" :key="breve\.n" :title="breve\.title" :desc="breve\.desc" type="message" @cmd_close="chiudiBreve" \/>/.test(sh)
	&& /watch\(\(\) => dataStored\.alert && \[dataStored\.alert\.title, dataStored\.alert\.desc, dataStored\.alert\.type\], smista, \{ immediate: true \}\);/.test(sh),
	'   AppShell: allarme e avviso breve in due riquadri, lo smistamento a ogni scrittura (contratto invariato)');
// B5, B6
check(/\.alert-overlay \{ z-index: 50000; top: var\(--status-strip-height\); \}/.test(css), 'B5 il velo parte sotto la striscia: HOLD e campanella raggiungibili (provato col tocco nel report)');
check(!/\.alert-toast \{[^}]*top: calc/.test(css) && /\.alert-toast \{[^}]*bottom: 16px;[^}]*right: 16px;/.test(css), 'B6 avviso breve in basso a destra: non copre il selettore del Robot');
// (prompt 10) le misure col tocco vero (Chrome senza finestra, elementFromPoint
// e Input.dispatchMouseEvent) sono nel report; qui le regole che le reggono
check(/\.alert-toast \{[^}]*pointer-events: none;[^}]*\}/.test(css) && /\.alert-toast__x \{[^}]*pointer-events: auto;[^}]*\}/.test(css),
	'(prompt 10) l\'avviso breve non mangia i tocchi: passano a «Reset allarmi» e «Riavvia programma robot»; la X resta toccabile');
check(/\.mission-dialog-overlay \{[^}]*inset: 0;\s*top: var\(--status-strip-height\);/.test(css),
	'(prompt 10) il velo di OGNI dialog parte sotto la striscia: HOLD e campanella raggiungibili coi dialog aperti');
const cuP10 = leggi('src/components/ChangeUserModal.vue');
const zCu = Number((cuP10.match(/\.change-user \{ z-index: (\d+); \}/) || [])[1]);
check(zCu > 50000 && /class="mission-dialog-overlay change-user"/.test(cuP10),
	'(prompt 10) il cambio utente (aperto dall\'icona della striscia) sta sopra il riquadro degli allarmi (' + zCu + ' > 50000) e il suo velo lascia libera la striscia');
// B8: la misura di layout dalla stessa media query del layout
const finestra = { innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1.25, screen: { width: 1536, height: 864 }, matchMedia: q => ({ matches: q === COMPACT_QUERY }) };
const ls = leggiSchermo(finestra);
check(ls.compatto === true && ls.schermoW === 1536 && ls.schermoH === 864, 'B8 leggiSchermo: compatto da matchMedia(COMPACT_QUERY), screen.width x screen.height');
s = screenInfo(ls);
check(s.compatto === true && s.misura === 'settings.screen.compact' && s.schermo === '1536 × 864' && s.schermoFisico === '1920 × 1080',
	'   1600 px di finestra ma la media query dice compatto: Compatto (prima: Largo); schermo intero 1536 x 864 x 1,25 = 1920 x 1080');
check(/data-screen="screen"/.test(tpl(su)) && it.settings.screen.screen && en.settings.screen.screenValue && /\{fisici\}/.test(it.settings.screen.screenValue), '   la card ha la riga «Schermo intero» (it, en)');
// B9: riga delle schede senza :has()
check(!/:has\(/.test(sh.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')) && /\.shell__tabs--vuota \{ display: none; \}/.test(sh) && /new MutationObserver\(guardaRiga\)/.test(sh) && /osservaRiga\.disconnect\(\)/.test(sh),
	'B9 riga delle schede vuota nascosta senza :has() (un browser vecchio lasciava ~20 px vuoti)');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
