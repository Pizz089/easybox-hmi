# Audit Sistema B — bottoni fuori dalle unit view

> Audit richiesto da UI-DESIGN-SYSTEM.md §3.4 per decidere i 3 buchi doc-vs-codice.
> Branch: `ui-lifting` post-merge `cella-missioni` (commit `737ec32`). Data: 2026-07-13.
> SOLO AUDIT: nessun file modificato oltre a questo report.
>
> Nota sul conteggio: gli usi sono separati in **attivi** (file raggiunti dal router
> attivo `router/index.js` o componenti effettivamente importati), **morti** (file
> `*_old`, `*1`, `Grating/old/`, o raggiungibili solo dal router di backup
> `router/index1.js`) e **commentati** (dentro `<!-- -->`). I numeri di sessione 2
> nel doc (§3.4) contavano i grep grezzi; qui la base è ripulita.

---

## 1. Doppio Primary — `.pure-button-micromission` (A) vs `.pure-button-primary` (B)

### 1.1 Confronto proprietà per proprietà

`.pure-button-micromission` → `unit-views.css:56`. `.pure-button-primary` → `pure.css:481`,
che di suo dichiara SOLO fill e testo: tutto il resto arriva (se e solo se il template
mette anche la classe base) da `.pure-button` (`pure.css:437`).

| Proprietà | A — micromission | B — primary (+ base `.pure-button`) | Divergenza |
|---|---|---|---|
| background | `var(--accent)` **#4A9EFF** | **#0078e7** hardcoded | due blu diversi, B fuori token |
| color | `var(--text-primary)` #E8EEF7 | `#fff` hardcoded | simile a occhio, B fuori token |
| border | `0` | `none transparent` (da base) | equivalente |
| border-radius | `var(--radius-md)` **8px** | **2px** (da base) | vistosa |
| min-height | **52px** (touch target §3.1) | **assente** | B sotto il minimo touch |
| padding | `var(--space-4) var(--space-5)` **16/24px** | `.5em 1em` ≈ **8/16px** (da base) | B molto più compatto |
| font | weight 500 + `letter-spacing: 0.025em` | `font-family: inherit; font-size: 100%`, **nessun weight** (da base) | B senza enfasi |
| hover | `filter: brightness(1.12)` | gradient overlay scuro (`.pure-button:hover`, pure.css:448) | B *scurisce*, A *schiarisce* |
| cursor / transition | pointer / `filter var(--transition-fast)` | nessuno dei due dichiarato | — |
| disabled | selettore dedicato `:disabled` (vedi §2) | via `.pure-button-disabled` / `[disabled]` (vedi §2) | sistemi diversi |

**Terzo "primary" di fatto**: `Gripper.vue:877` e `Vice.vue:622` sovrascrivono
`.pure-button-primary` in scoped con regole identiche tra loro e tutte `!important`:
gradient `#3b82f6→#2563eb`, padding `12px 28px`, radius 8px, font-size `.95rem`,
weight 600, box-shadow, hover `translateY(-2px)`. Quindi oggi i "primary" visibili
sono **tre**: accent tokenizzato (unit view), blu PureCSS piatto (config/production),
gradient con ombra (form Gripper/Vice).

**Uso senza classe base**: in `layoutView.vue:104` (e nella morta `ChangeUserView.vue:15`)
`pure-button-primary` compare **senza** `.pure-button` → il bottone ha solo fill+testo,
padding/radius dal default browser.

### 1.2 Usi post-merge

**`.pure-button-micromission` — 22 usi template attivi** (invariati dal merge: i nuovi
bottoni missione usano `pure-button-mission`, non micromission):

| File | Usi | Nota |
|---|---|---|
| `views/unit/robotView.vue` | 10 | 4 fissi con `.specialCMD`, 6 in ternario con `pure-button-disable` |
| `views/unit/CNC1View.vue` | 6 | |
| `views/unit/smallboxView.vue` | 3 | |
| `views/unit/CNC2View.vue` | 2 | |
| `views/conf/Machine/MachineConfigView.vue` | 1 | con `.specialCMD` (conferma cambio marca) — **unico uso Sistema A fuori dalle unit view** |

**`.pure-button-primary` — 21 usi template attivi in 18 view** (nessun nuovo uso dal
merge; PositionView ne ha solo di commentati):

| View (routed) | Usi |
|---|---|
| `conf/GratingsView.vue`, `conf/Grating/Grating.vue`, `conf/Grating/ImportGrating.vue` | 2 + 2 + 2 |
| `layoutView.vue`, `conf/Fixture/Fixture.vue`, `conf/Fixture/FixtureOnPallet.vue`, `conf/FixturesView.vue`, `conf/GrippersView.vue`, `conf/Gripper/Gripper.vue`, `conf/PartsView.vue`, `conf/Grating/GratingTest.vue`, `conf/Pallet/Pallet.vue`, `conf/TraysView.vue`, `conf/PalletsView.vue`, `conf/Tray/Tray.vue`, `conf/Vice/Vice.vue`, `conf/VicesView.vue`, `conf/Machine/MachineConfigView.vue` | 1 ciascuna |

Fuori conteggio: **8 usi in file morti/non-routed** (`ChangeUserView`, `conf/Position.vue`,
`conf/Tray.vue` flat, `FixturesView_old`, `PartsView_cards`, `GratingsView1`,
`Grating/old/` ×2) e **5 commentati** (`selectPallet`, `FixturesView`, `Grating`,
`PositionView` ×2).

### 1.3 Elementi per la decisione

- Il B "nudo" (PureCSS) è sotto standard doc su tutto: radius 2px, niente min-height 52,
  padding metà del canonico, colori hardcoded.
- Il pattern d'uso B è però diverso dall'A: quasi sempre è il **bottone "crea/salva"
  singolo** di una view di gestione, non una colonna di comandi macchina.
- MachineConfigView è la view-ponte: usa entrambi i sistemi nello stesso template
  (B per "applica", A+specialCMD per la conferma critica, `btn-ghost` per annulla).
  È il prototipo naturale di come apparirebbe la riconciliazione.

---

## 2. Doppio Disabled — `.pure-button-disable` (A) vs `.pure-button-disabled` (B)

### 2.1 Definizioni

**A — `unit-views.css:90`** (selettore condiviso con `:disabled` delle varianti A):

| Proprietà | Valore |
|---|---|
| background | `var(--bg-input)` |
| color | `var(--text-secondary)` |
| opacity | **0.7** (scelta HMI "subdued ma leggibile", UI-7.5) |
| cursor | `not-allowed` |
| pointer-events | **non toccato** — il click è bloccato dal ternario in `@click` |

**B — `pure.css:464`** (`.pure-button-disabled` e stati, più `.pure-button[disabled]`):

| Proprietà | Valore |
|---|---|
| background | **non cambia il colore** — solo `background-image: none` (resta il blu primary) |
| opacity | **0.4** |
| border / box-shadow | `none` |
| cursor | `not-allowed` |
| pointer-events | **`none`** (blocco click via CSS) |

Divergenze chiave: filosofia diversa (A ricolora su grigio leggibile, B sbiadisce il
colore originale), opacity 0.7 vs 0.4, gestione click JS vs CSS.

**Terza definizione locale**: `ComandsRows.vue:236` (style **scoped**, quindi vale solo
per i bottoni della barra comandi) ridefinisce sia `.pure-button[disabled]` sia
`.pure-button-disabled`: `--bg-input` + `--text-disabled` `!important`, opacity 0.5,
`transform: none`. È già "a metà strada" verso la variante A ma con testo più spento.

### 2.2 Usi post-merge

**A — `.pure-button-disable`: 14 usi attivi** (↑ dal merge: erano 8, i dialog missione
ne aggiungono 6): `robotView.vue` 13 (righe 105–220, tutti in ternario), `smallboxView.vue` 1.
CNC1/CNC2 non usano la classe: disabilitano con l'attributo `:disabled`, coperto dagli
stessi stili via selettore `:disabled`.

**B — `.pure-button-disabled`: 9 usi attivi** (+1 nella morta `GratingsView1`):
`GratingsView` 2, `FixturesView`, `PartsView`, `TraysView`, `PalletsView`, `GrippersView`,
`VicesView`, `MachineConfigView` 1 ciascuna — tutti col pattern
`:class="{'pure-button-disabled': condizione}"` (quasi sempre `userLevel<=1`).

### 2.3 Compaiono mai da sole senza classe base?

- **B: mai da sola.** In tutti i 9 usi attivi è aggiunta sopra
  `pure-button pure-button-primary` (in MachineConfigView anche con `:disabled` insieme).
- **A: sempre da sola** come variante. Il ternario scambia
  `pure-button-disable` ↔ `pure-button-micromission/mission`, quindi quando il comando è
  disabilitato il bottone ha solo classi layout (`pure-u-1`, `button_pressed`, che a
  riposo non dà stile: `App.vue:310` definisce solo `:active`). ⚠️ **Effetto collaterale
  rilevato**: `.pure-button-disable` non dichiara radius/min-height/padding/font, quindi
  il bottone disabilitato **perde la forma** della variante (radius 8→default, niente
  min-height 52, padding da UA stylesheet). Vale per tutti i 14 usi, inclusi i nuovi
  bottoni missione. Se in visivo non si nota è perché `pure-u-1` forza la larghezza; in
  altezza però il target touch scende sotto i 52px. Da sanare quando si unifica la
  variante Disabled (basta completare la classe A con la base §3.1, o passare tutto ad
  `:disabled` + attributo).

---

## 3. Secondary → Ghost

### 3.1 `.pure-button-secondary`: classe FANTASMA

**Non esiste alcuna definizione CSS** di `.pure-button-secondary` nel progetto:
non in `pure.css` (PureCSS non ha mai avuto una variante secondary), non nei CSS custom,
non negli scoped. I 2 usi censiti in sessione 2 sono:

| File | Riga | Stato |
|---|---|---|
| `conf/Fixture/FixtureOnPallet.vue` | 36 (`reset position`) | **attivo** (view routed) |
| `components/popup_old.vue` | 26 | morto |

Effetto reale dell'unico uso attivo: si applica solo la base `.pure-button`
(grigio chiaro #e6e6e6, testo scuro) — che peraltro sul tema dark risulta un bottone
chiaro "alieno". La classe è puro intento semantico mai implementato.

### 3.2 `.btn-ghost` (sessione 2, `unit-views.css:122`)

Conforme a §3.3 + base §3.1: transparent, `1px solid var(--border-default)`,
`--text-secondary`, radius-md, min-height 52, padding 16/24, weight 500; hover su
bg/border/color (non filter). **Usi attivi: 2** — `MachineConfigView.vue:218` (annulla
conferma) e `robotView.vue:226` (annulla dialog missione, arrivato dal merge).

### 3.3 Elementi per la decisione

La migrazione secondary→ghost è quasi gratis: **un solo uso attivo** da convertire
(`FixtureOnPallet:36`, un "reset position" che è semanticamente proprio un'azione
minore → ghost calza). Unica avvertenza: `btn-ghost` oggi vive in `unit-views.css` —
se diventa la variante canonica anche per config/production va spostata (o va garantito
che `unit-views.css` sia importato globalmente, com'è oggi via import in `main.js`/App).

---

## 4. Censimento classi bottone ad-hoc (post-merge)

Classi `btn-*` e affini definite per-view, con proposta di mappatura verso le 6 varianti
canoniche (§3.2: Primary / Mission / Critical / Disabled / Ghost / Icon-only).

### 4.1 File attivi

| Classe | File | Occorrenze template | Com'è oggi | Mappatura proposta |
|---|---|---|---|---|
| `.btn-add-order` | `productionView.vue` (def 74) | 1 | fill **bianco invertito** (`--text-primary` su `--bg-base`), radius-md, padding `12px 24px` px crudi, weight 700, `:disabled` opacity .5 | **Primary** — ma vedi nota "primary invertito" sotto |
| `.btn-primary` | `components/ChangeUserModal.vue` (def 279) | 1 | identico impianto: bianco invertito, padding `14px 24px`, weight 700 | **Primary** (stessa nota) |
| `.btn-save` | `views/workOrder/lastData.vue` (def 455) | 1 | identico impianto: bianco invertito, padding `14px 48px`, weight 700 | **Primary** (stessa nota) |
| `.btn-lock-icon` | `productionView.vue` (def 100) | 1 (su `<svg>`) | solo `flex-shrink: 0` | **non mappa** — non è un bottone, è utility di layout icona; rinominare fuori dal namespace `btn-*` o lasciare annotata |
| `.tb-btn` + `.tb-btn-pause` / `.tb-btn-resume` / `.tb-btn-clear-filter` | `views/diag/MqttDiag.vue` (def 661–670) | 2 bottoni (pause/resume è la stessa `<button>` con classe dinamica) | mini-bottoni **tema chiaro** (bg white, bordi colorati per semantica, font 10–11px) dentro la diag light-theme | **caso che non mappa oggi**: la diag è volutamente fuori tema dark. Se/quando la diag rientra nel tema (§8 step 5), diventano **Ghost** (outline colorato) o **Icon-only**; finché resta light, annotare come deroga |
| `.btn-rotate` | `components/Dropdown.vue:10` | 1 | **mai definita** nel progetto (residuo template paper-dashboard) | **rimuovere la classe** dal template, nessuna mappatura |
| `.btn-ghost` / `.btn-icon` | `unit-views.css` (def 122 / 142) | 2 / 0 | canoniche §3.3 | — (sono già le varianti 5 e 6) |

> **Nota "primary invertito"**: `btn-add-order`, `btn-primary` (modal) e `btn-save` sono
> di fatto **la stessa variante non dichiarata**, coerente tra loro (bianco su dark,
> weight 700, radius-md, hover `brightness(0.92)`) ma diversa sia dal Primary A (accent)
> sia dal B (#0078e7). Sono i CTA delle superfici "gestionali" più recenti. La decisione
> del punto 1 dovrebbe dire esplicitamente se il Primary canonico è **accent** (allora
> questi tre migrano ad accent e la variante bianca muore) o se il bianco invertito
> diventa il Primary ufficiale di config/production (allora è il Sistema B legacy a
> migrare qui). Tenerli "terzo incomodo" non è tra le opzioni sane.

### 4.2 Dialog missione arrivati dal merge (`robotView.vue`)

I bottoni dei 5 dialog usano già classi canoniche: conferma = `pure-button-mission` /
`pure-button-disable` (ternario, quindi eredita il buco §2.3), annulla = `btn-ghost`,
trigger = `pure-button-mission`/`pure-button-disable`. Classi nuove introdotte:

| Classe | Occorrenze | Com'è | Mappatura |
|---|---|---|---|
| `.mission-dialog-item` (+ `.selected`) | 1 (v-for sulle voci) | `<button>` voce-elenco selezionabile: `--bg-input`, min-height 52, radius-md, selected = fill `--accent` | **non mappa nelle 6 varianti**: non è un'azione, è un pattern "selectable list item". Proposta: annotarlo nel doc come pattern nuovo (candidato §4/§5), non forzarlo su una variante bottone |
| `.mission-dialog-overlay` / `.mission-dialog` / `.mission-dialog-list` / `.mission-dialog-empty` | 1 ciascuna | contenitori (overlay, card dialog, lista, empty-state) | non sono bottoni; il dialog-card di fatto segue il pattern outlined §4 con token |

### 4.3 File morti (nessuna azione nell'ambito Sistema B, candidati P3 cleanup)

- `components/Button.vue` (`p-button`, genera `btn-round/-block/-just-icon/-{type}/-outline-{type}/-link`):
  importato solo da `components/index.js`, che **non è importato da nessuno** → componente morto.
- `ComandsRows_old.vue` (ha una sua `.pure-button-disabled`), `popup_old.vue`
  (usa la fantasma `pure-button-secondary`), `FixturesView_old.vue`, `GratingsView1.vue`,
  `PartsView_cards.vue`, `Grating/old/*`, `ChangeUserView.vue` (solo nel router di backup
  `index1.js`), `conf/Position.vue` e `conf/Tray.vue` flat (soppiantate dalle versioni
  in sottocartella, non routed).

---

## 5. Sintesi per le 3 decisioni

1. **Doppio Primary** — B nudo è sotto standard su radius/min-height/padding/colori; in
   più esistono già un terzo primary (gradient Gripper/Vice) e un quarto (bianco
   invertito §4.1). La decisione vera non è "A o B" ma **quale dei 4 aspetti diventa il
   Primary di config/production**; MachineConfigView mostra già la convivenza A+ghost in
   una view gestionale.
2. **Doppio Disabled** — B è additivo (si somma alla base), A è sostitutivo (ternario) e
   ha il difetto forma-persa §2.3. Unificare conviene sulla **semantica A** (grigio
   leggibile, opacity 0.7) completando però la classe con la base §3.1, e decidendo lo
   standard per il blocco click (attributo `:disabled` > ternario > pointer-events).
3. **secondary→ghost** — `pure-button-secondary` è una classe mai definita con **1 solo
   uso attivo**: la migrazione a `btn-ghost` è a costo quasi zero; da decidere solo la
   collocazione del CSS di `btn-ghost` (oggi in `unit-views.css`).
