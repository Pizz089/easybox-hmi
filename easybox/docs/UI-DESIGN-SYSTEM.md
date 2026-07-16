# EasyBox / Vertibox HMI — Design System

> Documento di riferimento vincolante per il refactor estetico del pannello.
> Ogni sessione di refactor view-by-view deve rispettare queste regole.
> Stato: **v1 stabile** — approvato, base per l'esecuzione.
> Tema: dark. Target: kiosk Chrome su Windows, touch panel.

---

## 0. Principi

1. **Token-first.** Nessun valore estetico hardcoded nei `.vue`. Colori, spacing, tipografia, radius, elevation, transizioni vengono SEMPRE da `design-tokens.css`. Se manca un token per un caso reale, si aggiunge al file token, non si scrive il px crudo nel componente.
2. **Uniformità prima di originalità.** Una view non inventa un suo stile: usa i pattern qui definiti. Le eccezioni vanno motivate e annotate.
3. **Leggibilità da operatore.** Il pannello è letto a distanza di lavoro su touch panel. In caso di dubbio tra "compatto" e "leggibile", vince leggibile.
4. **Refactor non distruttivo.** I nomi dei token esistenti NON si rinominano (romperebbe tutti i `.vue`). Si cambiano i valori o si introducono regole di disciplina d'uso.

---

## 1. Tipografia

### 1.1 Font family

Flotta 100% Windows → Segoe UI è il font di sistema e va dichiarato come scelta intenzionale, primo nella cascade.

```css
--font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
```

Modifica rispetto allo stato attuale:
- `'Segoe UI'` portato in **prima** posizione (prima era dietro a `-apple-system` e `BlinkMacSystemFont`, che su Windows non risolvono — quindi Segoe UI era già il font effettivo ma per ripiego, non per scelta).
- `'Inter'` **rimosso**: non è installato sulla macchina e non self-hostato, quindi non ha mai avuto effetto.

> **Nota architetturale (catena CSS reale, verificata in audit sessione 1):** il token `--font-family` NON è consumato da nessuno. La font effettiva oggi viene da `pure.css` (`html { font-family: sans-serif }`), che su Chrome/Windows rende ≈ Arial — NON Segoe UI, NON Inter. (`base.css` contiene una regola body con Inter ma è **file morto**: importato solo da `main.css`, che non è importato da nessuna parte → mai nel bundle.) Per far governare la font dal token, la regola corretta è `body { font-family: var(--font-family); }` in **`typography.css`** (il file tipografia, che già annota il font-family come rinvio). Si usa `body` e non `html`: l'ereditarietà copre tutto il contenuto visibile e vince sulla regola `html` di pure.css, indipendentemente dall'ordine di import (le custom properties si risolvono sul computed value, non sulla posizione in sorgente). La regola `pure.css html { font-family: sans-serif }` resta come fallback per l'`<html>` nudo. Regola consolidata: **la font si governa SOLO dal token `--font-family`**; nessuna nuova dichiarazione `font-family` hardcoded nei CSS o nei componenti.

### 1.2 Scala dimensioni — "+1 step" uniforme

La scala viene alzata di un gradino su tutta la linea per migliorare la leggibilità a distanza. Body passa da 14px a 16px.

| Token | Valore attuale | Valore NUOVO | Uso |
|---|---|---|---|
| `--font-size-xs` | 12px | **12px** (invariato) | micro-label, note, hint secondari — tenuto a 12px dopo verifica visiva: a 13px causava wrap in celle strette (productionTable). Il micro-testo non beneficia dell'aumento quanto il body. |
| `--font-size-sm` | 13px | **14px** | subsection title, label dense |
| `--font-size-base` | 14px | **16px** | body di default, testo corrente |
| `--font-size-md` | 16px | **18px** | testo enfatizzato, valori |
| `--font-size-lg` | 18px | **22px** | section title, intestazioni card |
| `--font-size-xl` | 22px | **28px** | titoli view, heading principali |
| `--font-size-2xl` | 28px | **34px** | display, valori grandi dashboard |

> Nota implementativa: cambiare un token tipografico ha effetto a cascata su tutte le view che lo usano già. La prima sessione di refactor deve verificare visivamente che nessuna view "esploda" (testo che sfora i contenitori). Dove succede, si corregge il layout, non si riabbassa il token.

### 1.3 Pesi e interlinea (invariati)

```css
--font-weight-normal:   400;
--font-weight-medium:   500;
--font-weight-semibold: 600;
--font-weight-bold:     700;
--line-height-tight:  1.2;
--line-height-normal: 1.5;
```

Regole d'uso:
- **Titoli sezione** (`section-title`): semibold, uppercase, `letter-spacing: 0.05em`.
- **Sub-heading**: medium, uppercase, `letter-spacing: 0.05em`, colore più tenue.
- **Body**: normal, `line-height-normal`.
- **Bottoni**: medium (mission/micromission), bold (critical/specialCMD).

---

## 2. Spacing

### 2.1 Disciplina 8-base (nomi token invariati)

La scala resta quella esistente (4-base, `--space-1`..`--space-8`), ma si adotta una **disciplina 8-base**: nel codice nuovo si usano solo i gradini multipli di 8.

| Token | Valore | Stato |
|---|---|---|
| `--space-1` | 4px | ⛔ **BLACKLIST** — non usare nel codice nuovo |
| `--space-2` | 8px | ✅ canonico |
| `--space-3` | 12px | ⛔ **BLACKLIST** — non usare nel codice nuovo |
| `--space-4` | 16px | ✅ canonico |
| `--space-5` | 24px | ✅ canonico |
| `--space-6` | 32px | ✅ canonico |
| `--space-7` | 48px | ✅ canonico |
| `--space-8` | 64px | ✅ canonico |

> Eccezione consentita per `--space-1`(4px) e `--space-3`(12px): solo micro-aggiustamenti tipografici motivati (es. allineamento ottico di un'icona) e con commento esplicito nel CSS. Mai per layout/spacing strutturale.

### 2.2 Debito di migrazione (spacing fuori scala già nel codice)

Da correggere durante il refactor delle unit views:

- `unit-views.css` `.status-card`: `padding: var(--space-3)` → `var(--space-4)`; `margin-top: var(--space-3)` → `var(--space-4)`.
- `unit-views.css` `.command-section`: `gap: var(--space-3)` → `var(--space-2)` o `var(--space-4)` (da decidere visivamente).
- `unit-views.css` `.command-subsection-title`: `margin: var(--space-3) 0 0` → `var(--space-4) 0 0`.
- `unit-views.css` bottoni: `padding: 14px 24px` → **token, non px**. Target proposto: `padding: var(--space-4) var(--space-5)` (16/24) oppure `var(--space-3-deprecato)`... no → usare 16/24. Da validare che il touch target 52px regga con padding 16.

### 2.3 Shell di pagina (audit matriciale 2026-07, sede: `layout-shell.css`)

Ogni view usa il guscio standard:

- **Wrapper**: `.view-shell` (flex column, `gap: --space-4`); variante `.view-shell--fill` per le view kiosk full-height (scroll interno, `calc(100vh - 100px)`).
- **Larghezza contenuto**: piena del `.content` (che dà già `padding: 80px --space-5 --space-4`); l'eventuale limite si mette come `max-width` sulla card (es. `.machine-card`), non con colonne-spacer.
- **Titolo**: sempre `.view-title` (`--font-size-xl`, semibold, `margin: 0` — lo spazio sotto lo dà il gap del shell); il tag (h1..h3) è libero. Titolo + azioni sulla stessa riga = `.view-header`.
- **Gruppi bottoni**: `.btn-group` (flex, `gap: --space-4`, wrap) + varianti `--end`/`--center`.
- **Etichette di sezione dentro le card**: `.section-label` (`--font-size-sm`, semibold, uppercase, 0.05em, `--text-muted`; `margin-top: --space-4` quando segue contenuto, 0 se apre la card) — usata dalle unit view per i gruppi comandi.
- **Tab di navigazione**: `.tab-bar` + `.tab` (`.active` con underline `--accent` + semibold) — pattern per filtri/viste alternative sopra un contenuto (es. categorie in Posizioni). Squadrate perché sono navigazione, non azione (niente pill) né selezione a fill (niente segmented ROBOT SPEED); touch 52; riga dedicata dentro la card, sotto la `.view-header`.
- **VIETATI nel guscio**: colonne spacer `pure-u-1-24`, `&nbsp;` e `<br>` come spaziatori.

**Deroghe shell**: Dashboard senza titolo (è il pannello di default kiosk); MqttDiag guscio denso proprio (vedi deroga light §3.4); Gripper/Vice fino alla ritematizzazione glassmorphism (§4.2); TestView escluso (playground di sviluppo); i `margin-left` della scena SVG di Grating (deroga GR3); le griglie comando frazionali delle unit view (`pure-u-1-2/1-3/1-5`) restano — si uniforma solo il gap.

### 2.4 Regole spacing per contenitori

- Padding interno card: `--space-4` (16px) standard, `--space-5` (24px) per card primarie ariose.
- Gap tra elementi in colonna: `--space-2` (8px) denso, `--space-4` (16px) standard.
- Gap tra card sorelle: `--space-4` (16px). (Vedi §4 nota sul margin-top vs gap parent.)
- Margine esterno view / padding pagina: `--space-5` o `--space-6`.

---

## 3. Bottoni — 6 varianti canoniche

Tutti i bottoni del pannello devono ricondursi a una di queste 6 varianti. Niente stili bottone ad-hoc nelle singole view.

> **Sede unica: `assets/css/buttons.css`** (dalla sessione post-audit-sistema-b). Le varianti NON vivono più in `unit-views.css` né nei singoli `.vue`. Import in `main.js` dopo `design-tokens.css` (token) e dopo `pure.css` (necessario: l'alias `.pure-button-primary` ridefinisce una classe PureCSS a parità di specificità).

> I nomi legacy (`.pure-button-micromission`, `.pure-button-mission`, `.pure-button-disable`, `.specialCMD`) restano per non rompere i template, ma il documento li mappa a ruoli semantici chiari. Rename semantico = candidato a step successivo separato.

### 3.1 Base comune a tutti i bottoni azione

```css
border: 0;
border-radius: var(--radius-btn);    /* 999px: PILL = AZIONE, squadrato = informazione (K-FIX 2026-07) */
min-height: 52px;                     /* touch target industriale */
padding: var(--space-4) var(--space-5); /* 16 / 24 */
font-weight: var(--font-weight-medium);
letter-spacing: 0.025em;
cursor: pointer;
transition: filter var(--transition-fast);
```

Hover comune (dove non sovrascritto): `filter: brightness(1.12)`.

### 3.2 Le 6 varianti

| # | Variante | Classi (buttons.css) | Ruolo | Fill | Testo |
|---|---|---|---|---|---|
| 1 | **Primary** | `.pure-button-micromission`, `.pure-button-primary` (alias) | azione di flusso normale (comando standard) | `--accent` | `--text-primary` |
| 2 | **Warning / Mission** | `.pure-button-mission` | azione che avvia missione / attenzione | `--color-warning-button` (#D4A017 amber desaturato) | `--color-warning-text` |
| 3 | **Critical** | `.specialCMD` | macro action critica (RESET/HOLD/START/RESTART, conferme delete) | `--color-critical` (#E63946) | `--text-primary` |
| 4 | **Disabled** | `.pure-button-disable`, `.pure-button-disabled` (unificate) / `:disabled` | comando non disponibile | `--bg-input`, opacity 0.7 | `--text-secondary` |
| 5 | **Ghost** | `.btn-ghost` | azione minore / secondaria, no fill | trasparente + `--border-default` | `--text-secondary` |
| 6 | **Icon-only** | `.btn-icon` | toolbar dense, azioni compatte | trasparente, hover `--bg-surface-2` | icona, `--text-secondary` |

Note di dettaglio (post-audit-sistema-b):
- **Primary alias**: `.pure-button-primary` (ex PureCSS #0078e7) è ridefinito sullo stile canonico — i 21 usi nei template config/production NON sono stati migrati. **Convergenza dei nomi a fine cantiere** (un solo nome Primary quando si farà il rename semantico).
- **Disabled unificato**: definizione unica a doppio selettore, filosofia "subdued ma leggibile" (opacity 0.7 + `--text-secondary`) **+ box-model base §3.1 incluso** (radius/min-height 52/padding token: la classe compare da sola nei ternari delle unit view e senza base perdeva la forma) **+ `pointer-events: none`**. Ultima nella cascade di buttons.css: vince sulle combo `primary + disabled` del codice config. Eccezione: `.specialCMD` disabilitato conserva il radius pill ("pill solo per critical" vale anche da spento).
- **Stato trasversale `.btn-mission-running`** (feat mission-feedback): classe di STATO, non settima variante — il componente la applica al SOLO bottone la cui missione robot è in corso (una alla volta: HOME/MAINTENANCE, punti di destinazione `15;N`, Gestione pinza/pallet/cassetto; RESET/HOLD/RESTART esclusi, sono comandi critici non missioni). Stile: bordo 2px `--accent` + fill `--color-info-bg`, testo `--text-primary`, **nessuna animazione** (kiosk). Definita in buttons.css DOPO il blocco disabled e con selettori combo (`.pure-button-disable.btn-mission-running`, `:disabled`): durante la missione il robot esce da HOLD e il gating disabilita i comandi, ma il bottone in corso deve restare visibile e distinguibile — vince sul grigio (opacity 1) per quel solo bottone; il `pointer-events: none` del disabled resta attivo. Accensione all'invio del comando, spegnimento al RIENTRO dello STATUS in HOLD (macchinetta armato→attivo→spento in robotView, uscite di sicurezza ~5s missione rifiutata / 180s assoluto / allarme-Sconosciuto).

### 3.3 Specifiche varianti Ghost / Icon-only (implementate in buttons.css)

**Ghost** — per azioni che non devono competere visivamente con le primary (es. "Annulla", filtri, toggle minori):
```css
.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
  /* base comune §3.1 per radius/min-height/padding/font */
}
.btn-ghost:hover:not(:disabled) {
  background: var(--bg-surface);
  border-color: var(--border-strong);
  color: var(--text-primary);
}
```

**Icon-only** — per toolbar dense (es. diagnostica MQTT, header tabelle). Deroga consentita al min-height 52px → quadrato 44×44 minimo (touch) per non sprecare spazio orizzontale:
```css
.btn-icon {
  background: transparent;
  border: 0;
  color: var(--text-secondary);
  min-height: 44px;
  min-width: 44px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.btn-icon:hover:not(:disabled) {
  background: var(--bg-surface-2);
  color: var(--text-primary);
}
```

### 3.4 Sistema B — bottoni fuori dalle unit view (mappato in audit sessione 2)

L'audit ha rivelato che il pannello aveva DUE sistemi di bottoni paralleli: il **Sistema A** (le 4 classi unit-view: micromission/mission/specialCMD/disable, già a norma) e il **Sistema B** (resto del pannello: classi PureCSS + classi ad-hoc per-view). Dalla sessione post-audit i due sistemi sono riconciliati via alias in buttons.css (vedi sotto); restano fuori solo le deroghe documentate in coda a questa sezione.

Censimento Sistema B (sessione 2): `pure-button-primary` (39 usi, la classe bottone più usata in assoluto), `pure-button-disabled` (13), `pure-button-secondary` (2), `pure-button-group` (16, è wrapper layout non variante), ~25 classi `btn-*` ad-hoc (btn-save, btn-add-order, btn-primary, btn-resume, btn-pause, btn-lock-icon, btn-clear-filter, btn-round, btn-rotate, btn-outline), ~140 tag `<button>` totali, e un componente condiviso `Button.vue` da ispezionare. Nessuna libreria UI esterna (no el-button).

**Tre buchi doc-vs-codice — RISOLTI (sessione post-audit, dettagli in `audit-sistema-b.md`):**

1. **Doppio "Primary" → alias.** ✅ Il Primary canonico è lo stile §3.1 tokenizzato; `.pure-button-primary` è ridefinito in buttons.css come alias sullo stesso stile (niente migrazione dei 21 template attivi). Rimossi anche gli override gradient `!important` locali di Gripper.vue/Vice.vue e il "quarto primary" bianco invertito (`btn-add-order`/`btn-primary`/`btn-save` → migrati alla canonica; restano solo layout hook scoped annotati: flex+gap per l'icona in productionView, width:100% nel ChangeUserModal).
2. **Doppia grafia disabled → unificata.** ✅ Definizione unica a doppio selettore in buttons.css (vedi note §3.2). Deroga residua: la barra comandi (`ComandsRows.vue`) ha una sua definizione disabled scoped che diverge (opacity 0.5, `--text-disabled`, copre anche `[disabled]` via attributo) — da riconciliare nel refactor Dashboard (§8 step 3).
3. **secondary → ghost.** ✅ `pure-button-secondary` era una classe FANTASMA (mai definita in nessun CSS); l'unico uso attivo (FixtureOnPallet) è migrato a `.btn-ghost`.

**Deroga documentata — palette ComandsRows (dashboard).** La barra comandi della tabella ordini (`ComandsRows.vue`) usa icon-button quadrati con fill semantico per-tipo (play = `--color-success`, stop = bianco/`--text-primary`, del = `--color-danger`, icona via `currentColor`): pattern UI-2 approvato, NON riconducibile a Ghost/Icon-only senza perdere la semantica colore. Restano scoped anche: disabled con copertura `[disabled]` via attributo + `transform: none` (valori colore/opacity allineati alla canonica dalla sessione Dashboard), e **touch target 48×48** — deroga: sotto il 52 preferito ma sopra il minimo 44, perché a 52 le righe della tabella ordini perdono densità.

**Deroga documentata — touch 44 sidebar.** Le voci di menu della SideBar e il collapse toggle usano il minimo touch **44px** (non il 52 preferito): il menu completo conta 17 voci e a 52px sforerebbe il viewport del pannello. Stessa classe di deroga della toolbar diag qui sotto. **Tecnica linguetta toggle (Y2/Y3)**: il toggle apri/chiudi sidebar è una linguetta a filo del bordo destro (visivo 24×44, solo il fondo della sidebar senza bordatura — stessa estetica della sua base, angoli arrotondati a destra) — la soglia touch 44 resta rispettata NELLA SOSTANZA con uno pseudo-elemento `::before` invisibile 44×44 centrato sul visivo: pattern riutilizzabile quando un controllo deve essere visivamente più piccolo del suo target di tocco. Il `<main>` tiene una clearance di ≥5px dal bordo destro della linguetta in entrambi gli stati (margin 225/5 + padding 24), con la stessa transizione 0.25s del `left`.

**Regola sidebar — fit operatore (U-FASE2/W, vincolante per ogni voce futura).** Il set visibile all'**OPERATORE (userLevel 0) DEVE stare in 1080p senza scroll nello stato TUTTO APERTO** (budget: 1016px utili sotto la TopBar); i gruppi collassabili (W) non attenuano la regola. Per i livelli tecnici (voci `requiresLevel`: Macchine, MQTT Live) lo scroll della `.sb-nav` è accettato: sotto piega finiscono solo voci tecniche, mai operative — e col collasso si governa. Le voci NON scendono sotto 44px (già in deroga). Deroga `--space-1` del dimagrimento header (77fca84): **risolta** per i gruppi collassabili — l'altezza la governa il `min-height: 44` dell'header interattivo (aria a token normale); resta lo slim ~30px solo sull'header MENU, non interattivo e senza requisito touch. **Costi unitari** per il calcolo a ogni voce nuova: voce ≈ 46px, header interattivo = 44px + gap 0 verso la lista, header MENU ≈ 30px, gap fra sezioni 16px, padding-top nav 16px. A oggi (MENU, UNIT, MAGAZZINO, ATTREZZAGGIO, IMPOSTAZIONI + DIAGNOSTICA tecnica): operatore tutto-aperto ≈ 986px ✅, tecnico ≈ 1140px (scroll accettato). **ATTENZIONE: il margine residuo operatore è ~30px e una voce nuova ne costa ~46 — la prossima voce visibile a liv. 0 NON entra gratis, servirà una decisione strutturale (non comprimere: decidere).**

**Deroga documentata — diagnostica MQTT light-theme (INTERA view).** `MqttDiag.vue` resta deliberatamente su **palette chiara** — non solo i bottoni `tb-btn-*` ma tutta la view (log tecnico denso, ~40 colori light locali, nessun componente condiviso, quindi la deroga non contagia il resto del pannello). Dalla sessione diag (§8 step 5, strada "i") sono comunque **a canone**: spacing a token, scala font (minimo `--font-size-xs`), radius a token, monospace di sistema esplicito (`ui-monospace, 'Consolas', monospace` — il vecchio 'DM Mono' non era installato), e **touch target 44** su bottoni/input/toggle — deroga al 52 preferito, documentata: toolbar tecnica, view gated `userLevel>=1`, densità voluta; le uniche eccezioni sotto-token restanti sono i micro-padding annotati nel CSS (4px verticale righe log, 2px inline-code, per densità §2.1). Le varianti canoniche NON sono applicabili qui: i loro token colore presuppongono il tema dark. **La ritematizzazione dark completa (strada "ii") resta come eventuale sessione futura a bordo macchina con traffico MQTT reale** — non validabile in dev (log vuoto senza PLC); punti critici già censiti nell'audit: separazione righe, hover, timestamp attenuati, alone errori, payload JSON lunghi.

**Candidato variante futura — Segmented toggle (`.shelfPos`, Gripper/Vice).** Gruppo di bottoni-toggle quadrati (~48×44) per la scelta della posizione a scaffale: selezione esclusiva, stato `.active` con fill `--accent` + bordo `--accent-active`. Non è una delle 6 varianti azione (è selezione, come il selectable list item qui sotto): se il pattern ricorre altrove, promuoverlo a variante canonica `btn-toggle` in buttons.css.

**Settimo pattern — Selectable list item (`.mission-dialog-item`).** Introdotto dai dialog missione di robotView: `<button>` voce-elenco selezionabile a tap (min-height 52, `--bg-input`, radius-md; stato `.selected` = fill `--accent` + bordo `--accent-hover` + semibold). NON è una variante azione: è un pattern di selezione (nessuna preselezione, la conferma è un bottone separato). Va riusato tale e quale per futuri elenchi selezionabili touch, non sostituito con una delle 6 varianti.

> Nota touch: 44px è il minimo iOS/Material per target tappabili. Sotto i 44px su touch panel diventa difficile centrare il dito. Se la toolbar lo consente, preferire 52px anche per icon-only.

---

## 4. Card / contenitori

### 4.1 Pattern outlined (default, da estendere ovunque)

Il pattern `.command-section` di UI-7.6 diventa il contenitore standard di TUTTE le view:

```css
background: var(--bg-card);          /* rgba(255,255,255,0.08) overlay */
border: var(--border-card);          /* 1px solid rgba(255,255,255,0.22) */
border-radius: var(--radius-md);     /* 8px */
padding: var(--space-4);             /* 16px */
```

Titolo card: classe `section-title` (semibold, uppercase, 0.05em, `--text-secondary`).
Sub-heading: classe `subsection-title` (medium, uppercase, 0.05em, `--text-muted`).

### 4.2 Casi data-heavy (da raffinare, non bloccante in v1)

Su view con molte card o tabelle (dashboard, diagnostica MQTT, produzione), il triplo bordo+overlay+padding può appesantire. Strategia: **estendere comunque** il pattern outlined in prima battuta, poi in una passata di raffinamento valutare per i casi pesanti:
- bordo solo esterno, non su ogni riga;
- `--bg-card` più tenue o assente su contenitori annidati;
- card "flat" (solo bg, no border) per elementi di secondo livello.

Queste eccezioni vanno annotate nel documento quando emergono, non improvvisate.

**Deroga documentata — card "glassmorphism" Gripper/Vice.** Le view `Gripper.vue` e `Vice.vue` usano per form e preview 3D un tema alternativo coerente e intenzionale (bg `rgba(30,41,59,.6)` + `backdrop-filter: blur`, radius 16px, palette slate `#0f172a/#1e293b/#3b82f6`, ~125 `!important` per file) che NON segue il pattern outlined §4.1 né i token. Decisione sessione conf (audit voce GV1): **deroga temporanea** — la ritematizzazione completa è una sessione dedicata futura. Nel frattempo sono stati comunque allineati: font-size → token scala, bottoni shelfPos → touch 44 + active su `--accent` (vedi §3.4 "segmented toggle").

**Deroga documentata — tile unità dashboard (`units.vue` `.card`).** Le 4 tile cliccabili della dashboard restano su pattern **elevation** (`--bg-surface` + `--elevation-2`, senza bordo, hover `--elevation-3`): sono semanticamente affini alle status card §5 (portano lo stato unità sul wrapper immagine e devono "staccare" dal fondo, caso che §7 riserva alle ombre). Decisione sessione Dashboard, opzione (i) dell'audit.

### 4.3 Spacing tra card — nota tecnica ereditata

Attualmente `.command-section` usa `margin-top` sul figlio invece di `gap` sul parent, perché il parent è una colonna PureCSS grid (`pure-u-*`). Regola: finché il layout resta su PureCSS grid, lo spacing verticale tra card sta sul `margin-top` del figlio. Se/quando un parent viene rifatto a flex column, lo spacing si sposta su `gap` del container e il `margin-top` si rimuove.

---

## 5. Status card (stato unità) — invariato, documentato

Le status card (`.status-card` + modifier `.normal/.auto/.manual/.working/.alarm/.hold`) restano come da UI-3.3/UI-6.1. Documentate qui per completezza, NON sono nel pattern outlined §4 (hanno semantica di stato, non di raggruppamento comandi).

| Modifier | Background | Note |
|---|---|---|
| `.normal` | `--bg-surface` | stato neutro |
| `.auto` | `--color-success-bg` | automatico |
| `.manual` | `--color-warning-bg` | manuale |
| `.working` | `--color-info-bg` | in lavoro |
| `.alarm` | `--color-danger-bg` + glow | allarme, deve "gridare" da lontano |
| `.hold` | `--color-info-bg` + blink | in attesa |

---

## 6. Token di colore — riferimento

(Nessuna modifica in v1, elencati per completezza d'uso.)

- **Superfici**: `--bg-base` (#050A12 fondo), `--bg-surface` (#243043 card neutra), `--bg-surface-2` (#3A4A60 hover/elevata), `--bg-input` (#2A3548 campi/disabled).
- **Testo**: `--text-primary` (#E8EEF7), `--text-secondary` (#A4B0C2), `--text-muted` (#6B7889), `--text-disabled` (#4A5468).
- **Bordi**: `--border-subtle` / `--border-default` / `--border-strong`.
- **Accent**: `--accent` (#4A9EFF) + hover/active.
- **Semantici status**: success/warning/danger/info + relative `-bg`.
- **Semantici azione**: `--color-warning-button` (#D4A017 amber, CTA mission), `--color-critical` (#E63946 rosso urgente, macro action) + hover.

Regola chiave già consolidata: **`--color-warning`** (#FBBF24 saturato) per **status/badge**; **`--color-warning-button`** (#D4A017 desaturato) per **azioni**. **`--color-danger`** per **status alarm**; **`--color-critical`** per **azioni critiche operatore**. Non confondere status e azione.

**Regola bordi input (audit WCAG 2026-07):** i campi form (`input`, `select`) su `--bg-input` usano **`--border-strong`** (4.31:1). Né `--border-subtle` (1.77:1) né `--border-default` (2.88:1) raggiungono il 3:1 richiesto per i componenti UI su quel fondo — `subtle`/`default` restano per separatori decorativi e per bordi su fondi più scuri (`--bg-base`: default fa 4.62:1, ok per ghost).

---

## 7. Radius / Elevation / Transition — riferimento

```css
--radius-sm: 4px;    /* input, micro-elementi */
--radius-md: 8px;    /* card, elementi informativi */
--radius-lg: 12px;   /* contenitori grandi */
--radius-pill: 999px;/* forma pill generica */
--radius-btn: 999px; /* bottoni AZIONE (tutte le varianti canoniche + icon
                        button circolari). Regola: PILL = AZIONE, SQUADRATO =
                        INFORMAZIONE (card, badge, status, input, voci elenco).
                        Esclusi: segmenti ROBOT SPEED, voci sidebar, palette
                        ComandsRows solo nei colori (la forma e' pill/cerchio). */

--elevation-1/2/3    /* ombre crescenti; outlined card preferisce border a elevation */

--transition-fast: 150ms ease;  /* hover bottoni, micro-interazioni */
--transition-base: 250ms ease;  /* cambio stato card, transizioni più ampie */
```

Regola: il pattern outlined (§4) preferisce **border** a **elevation**. Le ombre si usano sulle status card e su elementi che devono "staccare" dal fondo, non sulle outlined card.

---

## 8. Ordine di refactor proposto (per priorità d'uso)

1. **design-tokens.css** — applicare §1.1 (font), §1.2 (scala +1), preparare i token nuovi per ghost/icon-only.
2. **unit-views.css** — saldare il debito §2.2 (spacing, padding bottoni a token), verificare scala tipografica nuova.
3. **Dashboard** — la view più vista; card outlined, badge, button palette in ComandsRows.
4. **Configurazioni** (incl. Grating) — form, input, bottoni ghost.
5. **Diagnostica MQTT** — data-heavy, banco di prova per icon-only e per i casi §4.2.
6. **Sidebar** — già tokenizzata in UI-3, riallineare a font/spacing nuovi.
7. **Login + modali** (ChangeUserModal, ecc.) — coerenza finale.

Ogni step è una sessione separata, audit-first, con verifica visiva prima del commit.

---

## 9. Decisioni confermate (v1)

Tutti i punti aperti della bozza sono stati confermati come da proposta:

- [x] §1.2 — scala "+1 step" confermata con i valori in tabella (xs 13 / sm 14 / base 16 / md 18 / lg 22 / xl 28 / 2xl 34). In sede di refactor delle view dense, se xl/2xl risultano eccessivi si abbassano localmente con annotazione — la scala a monte resta questa.
- [x] §2.2 — `gap` di `.command-section`: decisione visiva rimandata al refactor di unit-views.css (default proposto `--space-4`/16px, si valuta 8px se troppo arioso).
- [x] §3.3 — specifiche ghost e icon-only confermate come da proposta.
- [x] §4.2 — strategia "estendi outlined ovunque poi raffina i data-heavy" confermata.
- [x] §3.2 — i nomi legacy dei bottoni RESTANO in v1 (no rename in questa fase). Il rename semantico (`.btn-primary`, `.btn-critical`, ecc.) è un possibile step futuro dedicato, non bloccante.
