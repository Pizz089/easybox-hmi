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

### 2.3 Regole spacing per contenitori

- Padding interno card: `--space-4` (16px) standard, `--space-5` (24px) per card primarie ariose.
- Gap tra elementi in colonna: `--space-2` (8px) denso, `--space-4` (16px) standard.
- Gap tra card sorelle: `--space-4` (16px). (Vedi §4 nota sul margin-top vs gap parent.)
- Margine esterno view / padding pagina: `--space-5` o `--space-6`.

---

## 3. Bottoni — 6 varianti canoniche

Tutti i bottoni del pannello devono ricondursi a una di queste 6 varianti. Niente stili bottone ad-hoc nelle singole view.

> I nomi legacy (`.pure-button-micromission`, `.pure-button-mission`, `.pure-button-disable`, `.specialCMD`) restano per non rompere i template, ma il documento li mappa a ruoli semantici chiari. Rename semantico = candidato a step successivo separato.

### 3.1 Base comune a tutti i bottoni azione

```css
border: 0;
border-radius: var(--radius-md);     /* 8px; pill solo per critical */
min-height: 52px;                     /* touch target industriale */
padding: var(--space-4) var(--space-5); /* 16 / 24 */
font-weight: var(--font-weight-medium);
letter-spacing: 0.025em;
cursor: pointer;
transition: filter var(--transition-fast);
```

Hover comune (dove non sovrascritto): `filter: brightness(1.12)`.

### 3.2 Le 6 varianti

| # | Variante | Classe legacy | Ruolo | Fill | Testo |
|---|---|---|---|---|---|
| 1 | **Primary** | `.pure-button-micromission` | azione di flusso normale (comando standard) | `--accent` | `--text-primary` |
| 2 | **Warning / Mission** | `.pure-button-mission` | azione che avvia missione / attenzione | `--color-warning-button` (#D4A017 amber desaturato) | `--color-warning-text` |
| 3 | **Critical** | `.specialCMD` | macro action critica (RESET/HOLD/START/RESTART, conferme delete) | `--color-critical` (#E63946) | `--text-primary` |
| 4 | **Disabled** | `.pure-button-disable` / `:disabled` | comando non disponibile | `--bg-input`, opacity 0.7 | `--text-secondary` |
| 5 | **Ghost** *(NUOVO)* | da definire | azione minore / secondaria, no fill | trasparente + `--border-default` | `--text-secondary` |
| 6 | **Icon-only** *(NUOVO)* | da definire | toolbar dense, azioni compatte | trasparente, hover `--bg-surface-2` | icona, `--text-secondary` |

### 3.3 Specifiche varianti nuove (proposta da validare)

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

---

## 7. Radius / Elevation / Transition — riferimento

```css
--radius-sm: 4px;    /* icon button, input */
--radius-md: 8px;    /* card, bottoni standard */
--radius-lg: 12px;   /* contenitori grandi */
--radius-pill: 999px;/* solo critical/specialCMD */

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
