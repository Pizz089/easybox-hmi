# EasyBox HMI — Design System v3

> **v3, 6/10/2026 — nuova linea grafica approvata da Dario.** Linguaggio Bambu Lab con un'identità nostra: fondo grafite neutro, **un solo accento** (blu cobalto `#4D9BFF`), colore riservato a **stati e allarmi** (principio ISA-101). Le tavole di riferimento sono in [`ui-v3/`](ui-v3/): fanno fede per aspetto, misure e disposizione. I dati delle tavole sono inventati.
>
> Il testo della v1 (luglio) e della v2 (5/10, decisioni sull'audit [`ui-audit-2026-10/`](ui-audit-2026-10/)) è nella storia git di questo file: qui restano le regole in vigore.

Sedi nel codice:

| Cosa | Dove |
|---|---|
| Token (colori, misure, compatto) | `HMI/src/assets/css/design-tokens.css` |
| Componenti base | `HMI/src/components/ui/` (`UiButton`, `UiCard`, `UiTile`, `UiBadge`, `UiChip`, `UiSegmented`, `UiStepper`, `UiTabBar`, `UiConfirmDialog`) |
| Shell (barra, striscia, schede) | `HMI/src/layout/v3/` (`AppShell`, `NavRail`, `StatusStrip`, `SectionTabs`), `layout/navConfig.js` |
| Stato impianto per la striscia | `HMI/src/stores/plantStatus.js` |
| Handler globali del layout | `HMI/src/layout/plantGlobals.js` |
| Classi legacy dei pulsanti | `HMI/src/assets/css/buttons.css` |
| Dialog unico | `HMI/src/assets/css/dialogs.css` |
| Campi form sul tema scuro | `HMI/src/assets/css/forms.css` |
| Stati delle tasche | `HMI/src/util/pocketColors.js` |
| Punto di rottura (JS) | `HMI/src/util/breakpoints.js` |

---

## 0. Principi

1. **I comandi restano identici.** Ogni pulsante manda lo stesso comando di prima (topic e payload MQTT, o chiamata HTTP), con le stesse abilitazioni e conferme. Cambiano solo posizione e aspetto. La prova è la **mappa golden dei comandi** (`HMI/tests/test_golden_comandi.mjs`, `tests/golden/comandi.md`): presa prima di toccare una pagina, deve restare uguale dopo.
2. **Nessun dato inventato.** Un elemento delle tavole senza una fonte vera (topic, endpoint, campo) non si mostra. Niente valori finti, niente segnaposto.
3. **Rotte invariate.** Gli URL restano tutti: la navigazione li raggruppa senza rinominarli.
4. **Un accento, colore solo per lo stato.** L'accento si usa per l'azione primaria, la voce attiva e le barre di avanzamento. Verde OK/finito, ambra attenzione/HOLD/in lavoro, rosso errore e comandi distruttivi, azzurro grezzo/informazione, arancio tasca bloccata. Le famiglie di comandi **non** hanno colore: le missioni non sono più gialle.
5. **Livelli utente come oggi.** All'operatore non si mostrano voci che dicono "non abilitato".
6. **Niente dati del cliente nel repo** (pubblico): screenshot e immagini solo con dati inventati.

---

## 1. Colori (token)

Valori della tabella approvata (test: `HMI/tests/test_tokens_v3.mjs`). I nomi sono quelli di v1/v2.

| Token | Valore | Uso |
|---|---|---|
| `--bg-base` | `#121314` | fondo pagina |
| `--bg-surface` | `#1B1C1F` | card |
| `--bg-surface-2` | `#2A2C30` | pulsante secondario, cerchio delle icone |
| `--bg-input` | `#232528` | campi, tile |
| `--bg-sidebar` | `#17181A` | barra di navigazione |
| `--bg-icon` | `#2A2C30` | cerchio dietro le icone dei tile |
| `--bg-strip` | `#151618` | striscia di stato |
| `--bg-raised` | `#222428` | voce attiva della barra, riga selezionata |
| `--text-primary` / `-secondary` / `-muted` / `-disabled` | `#ECEDEE` / `#A4A8AE` / `#868A90` / `#5F636A` | testo |
| `--border-subtle` / `-default` / `-strong` | `#24262A` / `#3A3D42` / `#7D8188` | bordi (`-strong` sui campi) |
| `--accent` / `-hover` / `-active` | `#4D9BFF` / `#6AACFF` / `#3A86EB` | l'unico accento |
| `--accent-on` | `#0A1220` | testo scuro sull'accento |
| `--color-success` / `-warning` / `-danger` / `-info` | `#45C27D` / `#F2B230` / `#E5484D` / `#5BC0EB` | stati |
| `--color-*-bg` | tinte `rgba(…, .14/.16)` | fondi di badge e chip di stato |
| `--color-*-fg` | `#5ED394` / `#F6C65B` / `#F26B6F` / `#7FD0F0` | testo colorato su fondo scuro |
| `--color-critical` / `-hover` | `#D93B3B` / `#C23232` | comando distruttivo pieno, testo bianco |

**Presi dalle tavole** (non nella tabella, servono a riprodurle): `--bg-chip #1F2023` (chip, tracce dei selettori, pulsanti icona della striscia), `--bg-segment-on #2E3034` (segmento scelto), `--bg-row #202124` (righe di elenco), `--bg-well #1A1B1E` (riquadro interno, es. precondizioni), `--bg-dialog #212226`, `--text-chip #C4C7CC`, velo `--bg-backdrop rgba(6,7,8,.72)`.

**Nomi tenuti con un valore nuovo:** `--bg-card` = `--bg-surface` e `--border-card` = 1px `--border-subtle` (card piene, niente contorno bianco); `--color-warning-button` = `--bg-surface-2` e `--color-warning-text` = `--text-primary` (le missioni diventano secondarie).

**Contrasti minimi** (verificati dal test): `--text-muted` su `--bg-surface` 4.91:1 (≥ 4.5), `--border-strong` su `--bg-input` 3.93:1 (≥ 3), `--accent-on` su `--accent` 6.65:1 (≥ 4.5).

---

## 2. Tipografia

- **Manrope** (400/600/700/800) per tutto, **IBM Plex Mono** (500/600) per codici e ID (`--font-family`, `--font-mono`, classe `.mono`).
- **Inclusi nel pannello** (`@fontsource/manrope`, `@fontsource/ibm-plex-mono`, licenza OFL, subset latino, importati in `main.js`): mai caricati da internet. Il test controlla che nessun file punti a un servizio di font.
- Numeri **tabellari** ovunque (`font-variant-numeric: tabular-nums` sul body).

| Ruolo | Token | Largo | Compatto |
|---|---|---|---|
| Numero pezzi in Home | `--font-size-hero` | 96 | 60 |
| Valore di stato | `--font-size-state` | 34 | 22 |
| Titolo pagina | `--font-size-title` | 32 | 26 |
| Testo | `--font-size-body` | 17 | 15 |
| Etichetta (MAIUSCOLA, `.08em`, peso 800) | `--font-size-label` | 13 | 12 |

La scala storica (`--font-size-xs` … `-2xl`, `-display`) resta per le pagine di oggi.

---

## 3. Forme, bersagli, icone

- **Forme:** card `--radius-lg` 20 (16 in compatto), tile e pulsanti `--radius-btn` 16, chip `--radius-chip` 12, dialog 24. **Niente gradienti; ombra solo sui dialog** (`--elevation-1/2` = none, `--elevation-3` per i dialog).
- **Bersagli touch:** comandi principali `--touch-primary` 64 (56 in compatto), secondari `--touch-target` 56, **minimo assoluto** `--touch-target-min` 48. Un controllo cliccabile non scende sotto 48 anche se la tavola lo disegna più piccolo (es. i chip Utente/Lingua della striscia: 44 nella tavola, 48 nel pannello).
- **Icone:** un solo set lineare, `lucide-vue-next` (licenza ISC), stroke 2. 30 px nella barra (`--icon-size-nav`), 28 nei tile (`--icon-size-tile`), 24 nei pulsanti (`--icon-size-md`).
- **Margini fluidi** tarati sulle tre tavole: `--page-padding` 16/20/28 e `--card-padding` 18/20/24 a 1024/1280/1920.

---

## 4. Componenti base (`components/ui/`)

| Componente | Cosa | Note |
|---|---|---|
| `UiButton` | `primary` (accento), `secondary` (grafite), `outline`, `danger` (rosso pieno); altezze `main` 64/56, `default` 56, `min` 48; icona lucide | non conosce il comando: chi lo usa passa `@click` |
| `UiCard` | contenitore pieno, etichetta MAIUSCOLA e azioni in testa | `flush` per le liste a filo |
| `UiTile` | tile di comando neutra (icona in alto, testo in basso); `row` per il compatto | tavole Robot / Robot43 |
| `UiBadge` | badge di **stato**: `success`, `warning`, `danger`, `info`, `neutral`; `accent` solo per lo stato in corso | tavole Produzione, Home |
| `UiChip` | chip della striscia: pallino col colore dello stato; tono `warning`/`danger` per HOLD/ALLARME | `clickable` → `<button>` alto 48 |
| `UiSegmented` | selettore a segmenti con `v-model` e contatori | chele, preset, filtri, Attivi/Storico |
| `UiStepper` | passi numerici (−10 −1 +1 +10): emette **solo** il passo | valore, limiti, eco del PLC e invio unico li decide la pagina |
| `UiTabBar` | schede come `RouterLink` alle rotte di oggi | attiva per prefisso, senza maiuscole |
| `UiConfirmDialog` | icona nel cerchio, titolo, cosa fa e cosa non fa, precondizioni verificate, Annulla in contorno + comando | **non** manda comandi: emette `confirm`/`cancel` |

**Classi legacy** (`buttons.css`), restano nei template di oggi e prendono l'aspetto v3: `.pure-button-primary` / `.pure-button-micromission` → primario (accento); `.pure-button-mission` → secondario neutro (via token); `.specialCMD` → pericoloso (rosso pieno, testo bianco); `.btn-ghost` → contorno; spento (`.pure-button-disable(d)`, `:disabled`) → `--bg-input` con testo `--text-muted`.

**Deroghe che restano** (dalla v2): la barra comandi della tabella ordini (`ComandsRows.vue`) tiene i quadrati 48 col fill per tipo (play verde, stop chiaro, cancella rosso) finché la Produzione non è rifatta (fase C); la diagnostica MQTT resta a palette chiara (vista tecnica, livello 1); il pattern di selezione `.mission-dialog-item` dei dialog missione resta com'è.

---

## 5. Shell (`layout/v3/`)

- **Barra di navigazione** a sinistra, `--rail-width` 104 (84 in compatto). Nove voci con icona ed etichetta (fase E1.7, decisione di Dario del 7/10), nell'ordine: Home, Controlli, Produzione, Magazzino, Attrezzaggio, Pinze, Spinta in battuta, Allarmi (badge rosso col numero degli allarmi attivi) e, in fondo, Impostazioni. Voce attiva: icona e testo nell'accento su `--bg-raised`. In compatto alcune etichette si accorciano ("Attrezz.", "Spinta", "Impost."). Niente marchio "EB": il logo aziendale sta nella striscia.
  - **Schermi bassi** (fase E1.4, tablet 16:10): la barra non scorre fino a 400 px CSS di altezza, Impostazioni sempre visibile. Le voci scalano con l'altezza (`--app-h`: `100dvh`, o `innerHeight` dove il browser non conosce `dvh`), fino a 66 px in compatto e 78 in largo, mai sotto i 44. Sotto i 508 px le nove voci non stanno a 52 px l'una e **Allarmi esce dalla barra** (decisione di Dario del 7/10): resta la campanella della striscia, col numero. Con otto voci, sotto i 454 px le etichette spariscono e restano l'icona e l'`aria-label`.
- **Striscia di stato** in alto, sempre visibile, `--status-strip-height` 76 (64 in compatto). Da sinistra: logo aziendale (40 px in largo, 28 in compatto), stato cella (dal robot: HOLD ambra, ALLARME rosso), Robot, MC1 (MC2 se configurata), EasyBox o «cassetto N fuori», collegamento col server, campanella degli allarmi, utente (icona del livello: `HardHat` operatore, `Wrench` manutentore, `GraduationCap` ingegnere, con l'etichetta in largo; apre il cambio utente), lingua, ora, e a destra **HOLD / Riprendi / START**.
  - **In compatto** (fase E1.3) la chip Robot prende il posto di quella della cella, col suo tono; restano MC, EasyBox, il pallino del collegamento, campanella, utente e HOLD; la lingua sta in Impostazioni › Utente e lingua. Se non ci sta tutto la striscia ripiega a passi: prima toglie l'ora, poi il logo (che passa nell'intestazione della Home), poi passa ai testi brevi `strip.short.*`. Mai Robot, MC, EasyBox, campanella, utente e HOLD; niente a capo, niente scorrimento, niente «…».
  - **HOLD / Riprendi / START** = stesso comando e stessa logica del pulsante della pagina Robot: `sendToRobot(17)`; testo "HOLD" se il robot non è né in HOLD né spento, "Riprendi" in HOLD, "START" da spento con la stessa animazione (`blinker`). La golden lo verifica stato per stato. **Antirimbalzo** (fase E1.3): il 17 è un interruttore nel PLC e due tocchi rimettono in moto la cella; dopo un tocco il pulsante resta spento finché lo STATUS del robot non cambia, al massimo 5 s, poi avviso «HOLD non confermato dal PLC» (`util/holdGuard.js`).
  - **Solo dati esistenti** (`stores/plantStatus.js`): eventi `ROBOT/STATUS`, `MC1/STATUS`, `MC2/STATUS`, `BOX/STATUS`, `ROBOT/DESCR`, `TRAY/EXTRACT`; lettura iniziale di `api/unit/show/all` e `api/conf/tray/show/all`; replay della cache del backend con `UNIT/STATUS/REQUEST`. Lo store non manda comandi.
  - **Allarmi attivi** = unità con `STATUS` = allarme. È l'unico "attivo" che il pannello conosce: `api/alarm/show/all` è uno storico (ultime righe di LOG), senza un "risolto".
  - **Non mostrati, senza fonte:** percentuale e tempo residuo del ciclo MC1, stato del PLC (il backend non ha un battito del PLC; c'è solo il collegamento col server).
- **Schede** in testa alle pagine che raggruppano più rotte (`navConfig.js`):

| Voce | Schede → rotte di oggi |
|---|---|
| Home | `/dashboard` |
| Controlli | Robot `/unit/robot` · Macchina MC1 `/unit/CNC1` · (MC2 `/unit/CNC2` se configurata) · EasyBox `/unit/smallbox` |
| Produzione | `/production` + il wizard del nuovo ordine (`/selectRig` … `/lastData`) |
| Magazzino | Cassetti (`/conf/Trays`, `/conf/tray`, `/layout/...`) · Grigliati (`/conf/Gratings`, `/conf/Grating/:id`, `/conf/importGrating`) · Pezzi (`/conf/Parts`, `/conf/piece/piece`) |
| Attrezzaggio | Attrezzaggi · Pallet · Morse · Attrezzature (la scheda Chele morsa, fra Morse e Attrezzature, arriva col prompt 5 di 5) |
| Pinze | `/conf/Grippers` (e `/conf/Gripper/...`) |
| Spinta in battuta | `/sim/push` |
| Allarmi | `/alarms` · Diagnostica MQTT `/diag/mqtt` (livello 1) |
| Impostazioni | Posizioni (livello 1) · Macchine (livello 2) · Magazzini (livello 1). Per l'operatore la voce apre il cambio utente |

- La shell è ferma: scorre solo l'area del contenuto. Il contenitore resta `<main class="content">` (lo usano `custom-fix.css` e `productionTable`). `.view-shell--fill` riempie l'area.
- Gli handler globali (toast allarmi, SAFETY/AUX, snapshot e refresh 90 alla connessione) sono in `layout/plantGlobals.js`, una copia sola.

---

## 6. Layout responsivo

- **Largo** ≥ 1600 px (verificato a 1920×1080, il kiosk di cella); **compatto** < 1600 px (verificato a 1024×768, schermi 4:3, e 1280×800, tablet). Punto di rottura in `design-tokens.css` (`@media (max-width: 1599px)`, solo misure) e in `util/breakpoints.js` (`useCompact()`, per cambiare struttura).
- Home e Controlli: **nessuno scroll di pagina** sia a 1920×1080 sia a 1024×768 (fase B). Le pagine di configurazione scorrono dentro l'area del contenuto.
- Compatto: Home su una colonna (ordine, tre tile, banner dell'allarme); Controlli robot con i comandi in schede Movimenti / Missioni / Chele pinza, sulla riga delle schede della sezione, a destra, larghe quanto la colonna dei comandi (fase E1.5: `#section-extra` in `AppShell` e `<Teleport>` solo in compatto); Magazzino con la cassettiera in una colonna stretta.
- Largo anche a **1920×970**, la finestra massimizzata di Windows con cui si apre la cella (fase E1.6): Home, Controlli · Robot, Produzione e Magazzino · Cassetti senza scorrimento di pagina.
- La card «Schermo» di Impostazioni › Utente e lingua (fase E1.1) mostra la finestra in px CSS, il `devicePixelRatio` e la misura di layout: serve a leggere i numeri veri della cella prima di decidere sul punto di rottura.
- Contenitore di pagina fluido (grid/flex e `gap`), niente larghezze fisse sul contenitore.

---

## 7. Dialog di conferma (`dialogs.css`, `UiConfirmDialog`)

Sede unica dalla fase 0 (v2), aspetto della tavola Conferma: `--bg-dialog`, angoli 24, l'unica ombra del pannello, velo `--bg-backdrop`, larghezza 720 (`--wide` 800, `--narrow` 560), 14 px fra Conferma e Annulla. Il comando pericoloso è **rosso pieno**, Annulla in contorno. Testo: cosa fa e cosa NON fa; sotto, le precondizioni verificate. Ogni dialog nuovo usa queste classi o `UiConfirmDialog`: niente CSS di dialog scoped nei `.vue`.

**Riquadro globale degli allarmi** (`components/Alerts/Alert.vue`, fase E1.2): stessa scatola, sopra a tutto. Superficie sempre piena `--bg-dialog`, **mai un `--color-*-bg` come fondo** (sono trasparenti al 14-16 %: la pagina si leggeva attraverso). Il tono (allarme rosso, avviso ambra) sta in icona, titolo e bordo. Codice in un badge accanto al titolo (`robot.alarm_<n>`; «972 → codice» per l'avviso unito della consegna 35). Testo a `--font-size-md`. Si chiude solo con OK (56 px, a tutta larghezza in compatto) o con la X: il tocco sul velo non chiude. Gli esiti positivi (`message`) sono un avviso breve senza velo, in alto a destra sotto la striscia, che si chiude da sé dopo 4 s o al tocco. Allineati allo stesso aspetto il cambio utente (`ChangeUserModal`) e `RelaunchDialog`.

---

## 8. Campi form (`forms.css`)

Campi su `--bg-input`, testo `--text-primary`, bordo `--border-strong` (≥ 3:1). Sola lettura e disabilitati: stesso fondo, testo `--text-secondary`, bordo `--border-default`. Le regole hanno la stessa specificità di quelle che correggono (`theme.css`, `pure.css`), quindi gli stili scoped più specifici delle pagine vincono. Slider, checkbox, radio, colore e file restano nativi.

---

## 9. Stati delle tasche (`util/pocketColors.js`)

Un solo significato per lo stesso stato nel **disegno** (`TrayPockets`, `prisma`, `cylinder`), nella **legenda** e nelle **tabelle/badge**.

| Stato (codice) | Colore | Token |
|---|---|---|
| Vuota (2) | grafite `#3A3D42` | `--pocket-empty` |
| Grezzo (4) | azzurro | `--pocket-raw` (= `--color-info`) |
| In lavoro (3) | ambra | `--pocket-working` (= `--color-warning`) |
| Finito (5) | verde | `--pocket-finished` (= `--color-success`) |
| Scarto (7) | rosso | `--pocket-abort` (= `--color-danger`) |
| Bloccata (9) | arancio `#F47B2A`, distinto dall'ambra | `--pocket-locked` |
| Non definita (0) | nero `#0B0C0D` col bordo `#4A4D53` | `--pocket-undef` + `--pocket-undef-border` |

- Numero sulle tasche colorate `--pocket-on` (`#0B1218`); sulla vuota e sulla non definita `--text-secondary`.
- **Export SVG del grigliato** (`Grating.vue`, XMLSerializer): all'export i `var(--…)` diventano esadecimali con `getComputedStyle` (`resolveCssVars`).
- **`util/cavityClearance.js`** riconosce la stringa `lightcyan` (alone del cambio ordine): quel colore non si tocca senza toccare la logica.
- **Il cassetto si disegna in scala** (fase C): `TrayPockets` tiene il suo motore di geometria (posizioni da DB con `util/trayPockets.js` e `util/gratingAxes.js`), scala uniforme (`viewBox` + `preserveAspectRatio="xMidYMid meet"`), niente griglia stirata. Sotto i 44 px di tasca, "Modifica tasche" apre una vista ingrandita.
- Test: `test_pocket_colors.mjs`.

---

## 10. Pagina Allarmi

`/alarms`. In fase A versione di base: unità in allarme adesso e storico di `api/alarm/show/all`, coi testi `robot.alarm_<codice>` che esistono già. In fase D diventa la pagina in stile HMS: dettaglio a sinistra (livello, codice, ora, origine, "Cosa è successo", "Cosa fare" solo dove esiste già un rimedio scritto), elenco attivi/storico a destra.

---

## 11. Fasi del pannello v3

Un commit per passo; a fine fase report e stop: Dario la guarda prima che parta la successiva.

| Fase | Contenuto |
|---|---|
| **A** fondamenta | token v3, font e icone inclusi, componenti base, dialog v3, breakpoint, shell su tutte le pagine col contenuto di oggi, golden dei comandi, questo documento, tavole in `ui-v3/` |
| **B** | Home e Controlli (Robot, MC1, EasyBox); il HOLD resta solo nella striscia |
| **C** | Produzione e Magazzino (Cassetti con `TrayPockets` in scala, Grigliati, Pezzi) |
| **D** | Allarmi (HMS), Attrezzaggio, Impostazioni; pulizia dei componenti vecchi (`SideBar.vue`, `menu.vue`, `StandardMenu.vue`, `barraInAlto.vue` e l'elenco al §2.1 del REPORT dell'audit) |

Verifica per ogni fase: test HMI e serverDati verdi, build ok, golden dei comandi identica, test del cassetto (fase C), rilievo Playwright a 1920×1080, 1024×768 e 1280×800 con la guardia di rete dell'audit.
