# Verifica estetica del pannello EasyBox rispetto ai pannelli Bambu Lab (5/10)

Solo analisi: nessuna modifica al codice dell'app, niente commit. Tutto quello che c'è in questa cartella è materiale di lavoro.

| File / cartella | Cosa contiene |
|---|---|
| `screens/` | 83 schermate del pannello di cella: 36 rotte a 1920×1080 e a 1280×800, più le schede di Posizioni e la sidebar chiusa a 1280 |
| `rilievo.json` | misure per pagina (target touch, font, colori, sbordi, scroll) e il log completo della guardia di rete |
| `riferimenti/` | 11 screenshot ufficiali del touchscreen Bambu X1/H2D, scaricati dal wiki Bambu Lab (fonti al §1) |
| `mockup/` | `home.html`, `robot.html`, `produzione.html`: si aprono con doppio click |
| `REPORT.md` | questo documento |

---

## 0. Come è stato fatto il rilievo

- **Pannello:** `https://172.20.70.80:5173`, aperto con Chrome headless (Playwright), con `ignoreHTTPSErrors`.
- **Livello utente:** quello di apertura, cioè operatore. `userLevel` era assente in sessionStorage e non è stato alzato.
- **Pagine:** aperte digitando la rotta. Ho cliccato solo le schede della pagina Posizioni (cambiano un filtro locale) e la linguetta della sidebar.
- **Versione fotografata:** quella che gira in cella oggi. Contiene i lavori del 5/10 mattina (badge di livello in alto a destra, titoli uniformi, Robot su due colonne, Cassetti su una riga) e P1 (niente Aggiungi né Elimina cassetto). **Non** contiene la parte A di oggi: il layout mostra ancora "LAYOUT Cassetto ID22 - piano8". Non corrisponde quindi esattamente né a `4d264aa` né a `ui-lifting`.
- **Guardia di rete:** esito al §7. Nessun comando è arrivato alla cella.
- **Limiti del rilievo:**
  - Le schede **Pinza** e **Morsa** (`/conf/Gripper/gripper`, `/conf/vice`) usano una scena 3D Babylon/WebGL. A 1920 in headless sono uscite nere; a 1280 Pinza si è disegnata. Vanno guardate a mano sul pannello.
  - La guardia blocca `PLC/REFRESH_REQUEST`. Il polling del socket va quindi in riconnessione, e in alcune schermate la barra in alto dice "IN ATTESA DI CONNESSIONE!!". È un effetto della guardia, non un difetto del pannello.
  - La pagina **Grigliato** (`/conf/Grating/2095`) ha avuto 4 richieste di sola lettura bloccate per prudenza (`showcompleteData`, vedi §7): potrebbe mancare qualche dato nella sua schermata.
  - **Risoluzione reale dello schermo di cella:** non è documentata. `layout-shell.css` dichiara "target primario kiosk 1920", e `docs/PWA-TABLET.md` descrive il tablet Android in orizzontale. A 1280 la sidebar resta aperta, perché la soglia è sotto i 1200 px.

---

## 1. Il riferimento: touchscreen Bambu Lab X1 / H2D

**Fonti ufficiali:**
- wiki "Screen Operation": [X1](https://wiki.bambulab.com/en/x1/manual/screen-operation), [H2D](https://wiki.bambulab.com/en/h2/manual/screen-operation);
- [HMS](https://wiki.bambulab.com/en/x1/troubleshooting/intro-hms);
- [skipping objects](https://wiki.bambulab.com/en/general/skipping-objects) (Home durante la stampa e dialog di conferma);
- specifiche: X1 "5-inch 1280×720" ([wiki](https://wiki.bambulab.com/en/x1/maintenance/replace-high-resolution-screen)), H2D "5-inch 720×1280" ([tech-specs](https://bambulab.com/en/h2d/tech-specs)).

Gli screenshot del wiki sono PNG nativi a 1280×720. I colori qui sotto sono campionati dai pixel; li ho controllati a vista sulle immagini salvate in `riferimenti/`.

**Verificato dalle immagini** (file in `riferimenti/`):
| Elemento | Come appare | Immagine |
|---|---|---|
| Navigazione | rail verticale a sinistra (128 px su 1280), sfondo #242424, 5 icone piene: Home, Controls, Filament, Settings, HMS. La voce attiva ha solo l'**icona lime**, senza pillola né sfondo. Badge rosso #E14747 con il numero sull'icona HMS | `h2d_in-stampa.png`, `h2d_controls.png` |
| Sfondo / card | sfondo #141414, card #242424 con raggio ~16 px, margine 32 px, gap 24 px | tutte |
| Accento | **lime #A5F960**: icona attiva, barra di avanzamento, pulsante d'azione ("Go to Calibration", "Confirm"), toggle attivo. Il verde del brand **#00AE42** compare solo sul sito, non sullo schermo | `h2d_hms-warning.png`, `h2d_in-stampa.png` |
| Testo | primario #E0E0E0, secondario #A3A3A3, terziario #8A8A8A | — |
| Home in stampa | card anteprima + card stampante con le temperature in **pillole scure con numero grande** (~36 px su 720); in basso % e layer 0/175 grandi, barra sottile lime, tile Skip / Pause / Stop (Stop = quadrato rosso), tile Assistant | `h2d_in-stampa.png` |
| Controls | tile con **icona in un cerchio #474747**, titolo grigio, valore grande ("Cooling", "Standard", "28 °C") sopra il render della macchina; toggle Light lime | `h2d_controls.png` |
| Comandi a passi | D-pad con anello esterno ±10 e anello interno ±1; piatto ↑10 ↑1 ↓1 ↓10. Speed: 4 modalità impilate, la selezionata piena lime con testo scuro | `h2d_motion-dpad.png`, `h2d_speed.png` |
| Dialog | modale ~640 px #242424, icona "!" rossa a contorno, titolo + testo grigio, **due comandi solo testo** (Cancel / Confirm) separati da una linea, sfondo quasi nero | `h2d_dialogo-conferma.png` |
| HMS | due pannelli: dettaglio a sinistra con il pulsante d'azione lime, lista a destra. Ogni voce ha una **barra colorata a sinistra** (arancio = warning, azzurro = notifica, rosso = errore) e il codice [xxxx-xxxx] in grigio | `h2d_hms-warning.png`, `x1_hms-foto.png` |
| Barra di stato in alto | **non c'è** negli screenshot ufficiali | — |

**Non verificato (ipotesi):**
- il font: sembra un sans tipo HarmonyOS/MiSans;
- animazioni e dimensioni minime dei target;
- il lampeggio degli allarmi: nel wiki lampeggia ufficialmente solo l'icona del sensore fiamma del modulo laser H2D, non l'HMS.

**Attenzione alla scala:** Bambu disegna per uno schermo da 5" tenuto a mezzo metro. Il nostro kiosk da 1920 si legge a circa 1 m, con i guanti. Le proporzioni si possono prendere, le misure in pixel no: i numeri grandi di Bambu (~36 px su 720) corrispondono a ~48 px sul nostro 1080.

---

## 2. Pagina per pagina

Legenda delle colonne:
- **Bambu**: dove ci si discosta dallo stile di riferimento;
- **Design system**: violazioni di `docs/UI-DESIGN-SYSTEM.md` v1, con le righe da un'analisi statica dei sorgenti;
- **Misure**: dal rilievo a 1920, "<44" = elementi interattivi sotto i 44 px e "font" = dimensioni più usate.

Valgono per **tutte** le pagine (non li ripeto nella tabella):
- **Navigazione:** menu testuale da 220 px con 17 voci in 6 gruppi. Bambu ha 5 icone.
- **Barra in alto (`barraInAlto.vue`):** logo, icona del livello utente, lingua. Non mostra lo stato della cella. La lingua è un `<h6 @click>` con un'immagine da 45 px, non un pulsante.
- **Palette:** blu-ardesia (#050A12 / #243043) con accento blu #4A9EFF. Bambu è neutra (#141414 / #242424) con accento lime.
- **CSS globale non scoped in `App.vue`:** 19 hex, `body{background:white}`, font a 12/14 px.

| Pagina (rotta) | Bambu | Design system / altro | Misure |
|---|---|---|---|
| **Dashboard** `/dashboard` | Tre card con icona e stato in maiuscolo: è l'idea giusta (Home), ma: le icone sono foto o clipart su riquadri di colore diverso (blu, verde, grigio); lo stato sta a 18 px, non grande; "Ordine di lavoro :" resta vuoto; lo stato della cella non si vede a colpo d'occhio. La tabella ordini sotto è densa, con avanzamento "0 / 1" piccolo e barra da 80 px | `units.vue`: 20 px scritti a mano, 4 `style=` (`--tile-w:220px`). Titolo assente (deroga di §2.3) | <44: 1, font 12/16/18 |
| **Produzione** `/production` | Tabella e non card: l'avanzamento, che è il numero che conta, sta a 16 px. "Azzera produzione" (critico) e "Aggiungi ordine" sono due pill grigie uguali | `productionTable.vue:76` usa lo spaziatore vietato `&nbsp;` (pure-u-1-3); DELETE/EXIT scritti in inglese nel template (`:78/81`); stati in inglese (RAW, [28]) | <44: 1 |
| **Robot** `/unit/robot` | Due colonne di pulsanti pill a tutta larghezza: è una pagina di comandi, non di stato. Lo stato (HOLD) sta in un banner con testo piccolo. La velocità è uno slider con un campo; Bambu userebbe passi −10/−1/+1/+10 o preset. Tre colori pieni (blu, rosso, giallo) per tre famiglie di comandi | `robotView.vue`: 28 `style=`, 24 dei quali sono `style="width:100%"` sui pulsanti dei dialog; `:611` grigio fisso che scavalca il Disabled canonico; testi fissi NO GRIPPER MOUNTED!, ROBOT SPEED:, RESTART MAIN PROGRAM | 45 interattivi; scroll interno 1155/1080: "Preleva finito e deposita grezzo" esce di 75 px |
| **CNC 1** `/unit/CNC1` | Metà sinistra vuota sotto "NO FIXTURE MOUNTED!"; i 6 comandi porta/pallet/morsa sono pill che si toccano. Bambu: tile di stato (porta, pallet, morsa) con toggle | testi fissi SBLOCCO/BLOCCO PALLET/MORSA (`:39-52`) e NO FIXTURE MOUNTED! (`:16`) | — |
| **CNC 2** `/unit/CNC2` | — | macchina non configurata: la guardia della rotta rimanda a `/dashboard`, corretto | — |
| **EasyBox** `/unit/smallbox` | Due banner piccoli e un solo comando; nessuna vista della cassettiera (12 piani), che sarebbe il suo "Filament" | RESET scritto fisso (`:46`) | — |
| **Pezzi** `/conf/Parts` | Tabella con righe da 90 px e azioni a cerchio rosa (bloccate per l'operatore). È la pagina più "lista dati": in Bambu vivrebbe dentro Settings | titolo letterale "Tipo pezzi" (`PartsView:14`), DELETE/EXIT fissi | <44: 1 |
| **Grigliati** `/conf/Gratings` | come Pezzi | DELETE/EXIT fissi | — |
| **Cassetti** `/conf/Trays` | Ora azioni su una riga. Il numero del cassetto (1.12…1.5) è piccolo: in Bambu sarebbe la tile grande | 11 px fissi, 10 `style=` (width:100% nei dialog) | 60 interattivi, scroll interno |
| **Attrezzaggi** `/conf/Attrezzaggi` | Titolo lungo "(pallet + morsa / attrezzatura)"; azioni a pill sparse | `--space-1/3` in blacklist (6/2), EXIT fisso | — |
| **Pallets / Morse / Attrezzature / Pinze** | tabelle con poche righe, molto vuoto | DELETE/EXIT fissi; `GrippersView.vue:207` `.twin-link` con min-height **32 px** (il commento dice "come i ghost", il valore no) | Pinze <44: 2 |
| **Spinta in battuta** `/sim/push` | La più vicina a Bambu: tre colonne, disegno centrale, esito a badge | input su `--bg-input` con `--border-subtle`, contro la regola §6 (`PushSim.vue:1145`) | font 4615 px = testo SVG ridimensionato, non è un errore visibile |
| **Macchine** `/conf/Machines` | a livello operatore: modifica disabilitata (corretto) | — | — |
| **Posizioni** `/conf/Position` (+ 5 schede) | Tabella di coordinate X/Y/Z: da Settings tecnico, giusto che sia densa. Le schede sono già il pattern Bambu per le sottopagine | 25 `<br>` usati come spaziatori, 12 `text-align:right` inline, placeholder "search" in inglese | font 16 px ×86 |
| **Magazzini** `/conf/Warehouses` | a livello operatore mostra solo "UTENTE NON ABILITATO A ESEGUIRE QUESTO C[OMANDO]" in maiuscolo spaziato. Pagina vuota: andrebbe nascosta dal menu, come Macchine | — | non rilevabile a livello 0 |
| **Diagnostica MQTT** `/diag/mqtt` | Strumento tecnico, monospazio, 1000 righe a 12 px: corretto che sia così (in Bambu starebbe sotto HMS/Assistant) | 58 hex, statistiche in testata quasi illeggibili | font 12 px ×1023 |
| **Wizard ordine** `/selectRig`, `/selectPiece`, `/selectGripper`, `/selectMC`→`/lastData` | Le card dei pezzi con disegno sono già "Bambu" (tile con immagine). Passo corrente solo con un anello bianco. Riepilogo con due etichette "Quantità*" e errori rossi in blocco | testi a 11 px (sotto il minimo xs 12) in `workOrder_step.vue:210/227`; `lastData.vue` 5 font in px e senza `.view-title`; "Tipo Pinza" letterale; `selectPiece.vue:165` bordo input contro §6 | font 11 px ×4 su tutte |
| **Cassetto (dettaglio)** `/conf/tray?trayID=22` | **campi bianchi** su tema scuro; titolo "Configurazione del cassetto : 22" con l'**ID** del database per il cassetto del **piano 8** (corretto nella parte A) | 7 `&nbsp;`; numericField con pulsanti −/+ da 44 | <44: 6, scroll 1324/1080 |
| **Pezzo (dettaglio)** `/conf/piece/piece?pieceID=1035` | buona: campi scuri, scelta a segmenti Cilindrica/Prismatica, disegno quotato. Salva/Annulla pill | `Piece.vue`: header `h1` custom senza `.view-title` (non è in deroga); `.piece-save` reimplementa il Primary | font 10 px ×3 (quote del disegno) |
| **Pallet** `/conf/pallet?palletID=2` | campi bianchi; unità "0.001mm" accanto a correzioni mostrate in mm (da verificare: l'unità a video potrebbe essere sbagliata) | Save fisso | <44: 9 |
| **Attrezzatura** `/conf/Fixture?fixtureID=1` | campi chiari; composizione chiara | **`Fixture.vue:127` usa `.mission-dialog-overlay` senza averne lo stile**: la classe è scoped in altri 10 file, quindi qui il dialog non ha overlay | <44: 8 |
| **Grigliato** `/conf/Grating/2095` | disegno di ingombro + form | 26 hex che copiano i token negli attributi SVG (servono per la stampa: un `var()` non sopravvive a XMLSerializer) | scroll 1108/1080 |
| **Nuovo attrezzaggio** `/conf/Attrezzaggio` | form a passi | — | <44: 2 |
| **Importa grigliato** `/conf/importGrating` | **chiavi i18n mostrate grezze** ("grating.associate", "referenceGrating"), campi bianchi, nessun titolo, Save/Reset/Genera in tre stili | 12 `style=`, `<br>` dentro le label, `coral` ×4 | <44: **13** |
| **Layout cassetto** `/layout/22/0/8` | Il disegno delle tasche è un SVG fisso da 480×360 su 1920: occupa un quarto della pagina. Legenda in Times a 10 px, "VIEW ONLY!!" spaziato giallo, "LEGEND:" | Colori fissi `lightgray/green/black/coral/#080866/red`. **Incoerenza di significato:** nel disegno RAW è verde e WORKING azzurro, nelle tabelle RAW è blu (`--color-info`) e WORKING verde (`--color-success`). La legenda non ha WORKING; LOCK non ha uno stato nel disegno | font 34 px ×52 (numeri tasche), 10 px ×7 |
| **Dispatcher** `/dispatcher` | pagina tecnica **senza layout** (niente sidebar né barra), titoli spaziati, celle `border:solid 2px lightblue` | rotta raggiungibile solo da URL | — |
| **Test** `/test` | pagina di prova Babylon raggiungibile da URL | pulsanti senza classe | <44: 3 |

### 2.1 Pagine e componenti vecchi ancora nel repo
Non raggiungibili: nessuna rotta e nessun import li usa.
- `router/index1.js`: punta a viste che non esistono più;
- `views/Dashboard_ori.vue` (ignorato da git);
- `GratingsView1.vue`, `FixturesView_old.vue`, `PartsView_cards.vue`;
- `views/conf/Tray.vue` (doppione di `Tray/Tray.vue`) e `views/conf/Position.vue` (doppione di `PositionView.vue`): mostrano ancora `tray.ID` come numero di cassetto;
- `_fixtureOnPallet.vue`, `Grating/old/*`, `Grating/GratingTest.vue` (rotta rimossa);
- `Comands/ComandsRows_old.vue`, `OrderComands_old.vue`, `Comand4Conf.vue`;
- `popup.vue`, `popup_old.vue`, `Alerts/popup.vue`, `keyboard.vue`, `toggleButton.vue`;
- `SidebarPlugin/index.js`, `SidebarLink.vue`, `MovingArrow.vue`, `PaperTable.vue`, `Dropdown.vue`, `ChartCard.vue`, `layout/dashboard/*`.

Importati ma inutili:
- `Cards/Card.vue` e `StatsCard.vue`, registrati in `App.vue` e mai usati;
- `views/HomeView.vue`, importato da `router/index.js` e non usato da nessuna rotta.

Raggiungibili solo da URL: `/dispatcher` (senza layout) e `/test`.

### 2.2 Cose trovate che vanno oltre l'estetica
- **Allarmi:** il backend ha `GET /api/alarm/show/all`, ma nel pannello non c'è una pagina allarmi. Gli allarmi arrivano solo come toast (`StandardMenu.vue`) e come banner nelle pagine. È proprio la parte che in Bambu è l'HMS.
- **Dialog:** lo stesso CSS è duplicato, scoped, in 10 file (RelaunchDialog, robotView, CNC1View, productionView, layoutView, TraysView, WarehousesView, AttrezzaggiView, Grating, PushSim). In `Fixture.vue` manca del tutto (vedi la tabella).
- **Stringhe fisse non tradotte:** DELETE/EXIT in 8 viste, Save/Save! in 7, VIEW ONLY!!, LEGEND, EMPTY/RAW/…, RESET, OUT. Per molte la chiave esiste già in `it.json` (EMPTY/RAW/WORKING, Save).
- **Contraddizioni del documento con i token:**
  - `--color-critical`: il doc dice #E63946, il token è #C92434;
  - `--text-secondary` e `--text-muted`: i valori del §6 sono superati;
  - testo del Primary: il doc dice `--text-primary`, `buttons.css` usa `--bg-base`;
  - `--font-size-xs`: il §9 dice 13, il §1.2 dice 12.

---

## 3. Dove siamo rispetto a Bambu, in sintesi
| Aspetto | Bambu | EasyBox oggi | Distanza |
|---|---|---|---|
| Navigazione | 5 icone, voce attiva colorata, badge errori | 17 voci testuali in 6 gruppi | alta |
| Struttura delle pagine | tile/card con stato grande + comandi del contesto | colonne di pulsanti e tabelle | alta (Robot, CNC, Dashboard), media (config) |
| Numeri di stato | grandi (~36/720) in pillole | 16-18 px, a volte maiuscoli piccoli | alta |
| Palette | neutra #141414/#242424, accento lime | blu-ardesia, accento blu | media (sono solo token) |
| Comandi | rettangoli arrotondati, tile icona+testo, passi ±1/±10, toggle | pill a tutta larghezza, slider | media |
| Dialog | modale unica, due comandi a testo | modale simile, CSS duplicato 10 volte | bassa |
| Errori | pagina HMS con livelli e codici | toast e banner | alta (manca la pagina) |
| Form | liste scorrevoli in Settings | form con campi a volte bianchi | media |

---

## 4. Proposta di direzione

### 4.1 Token: valori da cambiare (i nomi restano, regola §0.4)
| Token | Oggi | Proposto | Perché |
|---|---|---|---|
| `--bg-base` | #050A12 | **#141414** | sfondo Bambu (neutro, non blu) |
| `--bg-surface` | #243043 | **#242424** | card e rail Bambu |
| `--bg-surface-2` | #3A4A60 | **#333333** | pulsanti secondari Bambu |
| `--bg-input` | #2A3548 | **#2E2E2E** | campi scuri; risolve anche i campi bianchi, se le pagine usano il token |
| `--text-primary` / `-secondary` / `-muted` / `-disabled` | #E8EEF7 / #B2BDCE / #92A0B2 / #6B7889 | **#EDEDED / #A3A3A3 / #8F8F8F / #5C5C5C** | grigi neutri Bambu. Contrasto su #242424: secondario ~6,2:1, muted ~4,6:1 |
| `--border-subtle` / `-default` / `-strong` | #4A5A75 / #6B7B95 / #8B9AAE | **#333333 / #474747 / #8A8A8A** | neutri. Lo strong resta ≥ 3:1 su `--bg-input` (regola §6) |
| `--accent` (+ hover/active) | #4A9EFF | **#A5F960** (#B9FB82 / #8EE63F) | accento UI Bambu verificato. **Decisione per Dario, vedi §4.6** |
| `--color-warning` | #FBBF24 | **#FFA500** | warning HMS Bambu |
| `--color-danger` / `--color-critical` | #F87171 / #C92434 | **#E14747** per tutti e due | errore e Stop Bambu. Allinea anche la contraddizione del doc (#E63946) |
| `--radius-lg` | 12px | **16px** | card Bambu |
| `--radius-btn` | 999px (pill) | **14px** | in Bambu le azioni sono rettangoli arrotondati, non pill. **Cambia la regola §7 "PILL = AZIONE": vedi §4.5** |

`--color-success` e `--color-info` restano; le loro varianti `-bg` vanno solo riportate su base neutra. `--font-family` resta Segoe UI: il font Bambu non è verificato e la flotta è Windows.

### 4.2 Token nuovi
| Token | Valore | Uso |
|---|---|---|
| `--accent-on` | #141414 | testo e icone sopra l'accento (oggi `buttons.css` usa `--bg-base` per questo) |
| `--bg-sidebar` | #242424 | chiude il debito `#141D2A` scritto a mano in `SideBar.vue:220` e `menu.vue:119` |
| `--bg-icon` | #474747 | cerchio dietro le icone dei tile (Controls Bambu) |
| `--font-size-display` | 48px | numeri di stato grandi (avanzamento, velocità, stato unità) letti a ~1 m |
| `--rail-width` | 120px | rail di navigazione a icone |
| `--status-strip-height` | 56px | striscia di stato in alto (§4.3) |
| `--touch-target` / `--touch-target-min` | 52px / 44px | oggi 52 e 44 sono scritti a mano in decine di punti |
| `--icon-size-rail` / `--icon-size-tile` | 44px / 32px | icone |
| `--pocket-empty`, `--pocket-raw`, `--pocket-working`, `--pocket-finished`, `--pocket-abort`, `--pocket-undef`, `--pocket-locked` | da fissare con Dario | colori delle tasche: un solo significato fra disegno, legenda e tabelle (oggi RAW e WORKING sono invertiti). **Vincolo:** il disegno del grigliato si esporta con XMLSerializer, quindi all'export i token vanno risolti in esadecimale con `getComputedStyle`. `cavityClearance.js:77` riconosce la stringa `lightcyan`: quel colore non si tocca senza toccare la logica |

### 4.3 Pattern da adottare
1. **Rail di navigazione a icone** (Bambu). Sei voci: Home, Controlli, Produzione, Magazzino, Impostazioni, Allarmi. Le 17 voci di oggi diventano **schede** dentro la pagina (pattern `.tab-bar`, che esiste già). La voce attiva ha solo l'icona accent; Allarmi ha il badge rosso con il numero. Le voci per livello tecnico (Macchine, Magazzini, MQTT) si vedono come schede solo a quel livello; oggi Magazzini appare all'operatore e dice "non abilitato".
2. **Striscia di stato in alto: scelta nostra, non Bambu.** In cella lo stato deve restare sempre in vista: stato cella (HOLD/AUTO/allarme), PLC collegato, livello utente, lingua. Sostituisce `barraInAlto` (logo + icone).
3. **Tile di stato:** icona in cerchio, titolo grigio, **valore grande** (`--font-size-display`). Per Robot, Macchina, EasyBox, pinza, velocità, ordine in corso.
4. **Comandi a passi:** velocità robot con −10 / −1 / +1 / +10, più i preset impilati (100/50/25/10 %). Il comando resta quello di oggi (`updateSpeed`, "100;val").
5. **Toggle** per gli stati on/off: morsa manuale e porta in CNC, eventuali luci/aria.
6. **Dialog di conferma unico:** un solo componente, o una sola classe globale, al posto dei 10 CSS duplicati. Stile Bambu: icona "!", titolo, testo, due comandi in fondo separati da una linea. **Eccezione voluta:** il comando pericoloso resta **riempito di rosso**. Il solo testo distingue troppo poco con i guanti (vedi `mockup/robot.html`).
7. **Pagina Allarmi in stile HMS:** lista con una barra colorata per livello (errore/warning/info), codice decodificato (i codici lunghi sono MissionCode×100 + errore), dettaglio con il rimedio. Dati da `api/alarm/show/all` e dagli eventi live già esistenti (`PLC/ALARM/*`, `ALARM/MC1`). Badge sul rail.
8. **Card al posto delle tabelle** dove le righe sono poche e gli stati contano: Produzione, Attrezzaggi, Pallet/Morse/Pinze. Le tabelle restano dove i dati sono tanti (Posizioni, MQTT).

### 4.4 Come le nostre pagine si mappano su Bambu
| Bambu | EasyBox | Note |
|---|---|---|
| **Homepage** | Dashboard | tile Robot / EasyBox / Macchina + ordine in corso con avanzamento grande e Avvia/Ferma + ultimi allarmi (`mockup/home.html`) |
| **Controls** | Robot, CNC 1, CNC 2, EasyBox come **schede** | tile di stato a sinistra, comandi a destra (`mockup/robot.html`) |
| *(Home → "Files")* | Produzione + wizard nuovo ordine | ordini in card con avanzamento grande (`mockup/produzione.html`) |
| **Filament** | Magazzino: Cassetti (12 piani), Grigliati, Pezzi | la cassettiera è il nostro "materiale caricato": vista a piani con il contenuto, come le bobine AMS |
| **Settings** | Attrezzaggio (Attrezzaggi, Pallet, Morse, Attrezzature, Pinze, Spinta, Macchine) + Impostazioni (Posizioni, Magazzini) | griglia di card come i Settings Bambu, sottopagine a lista |
| **HMS** | **Allarmi** (nuova) + Diagnostica MQTT come scheda tecnica | — |

### 4.5 Cosa cambierebbe in `docs/UI-DESIGN-SYSTEM.md` (v2)
- **§0 Principi:** una riga sulla struttura (rail + tile + schede) e il riferimento Bambu con i limiti di scala (5" contro kiosk 1920 a 1 m).
- **§1.2:** aggiungere `--font-size-display` (48) e la regola "i valori di stato si scrivono grandi". Correggere la contraddizione xs 12/13.
- **§3 Bottoni:** se si adotta `--radius-btn` 14 px la regola diventa "AZIONE = rettangolo arrotondato pieno; INFORMAZIONE = card/badge senza fill d'azione". I pulsanti tondi da 48 (ComandsRows) diventano quadrati arrotondati, come Skip/Pause/Stop di Bambu. Primary con testo `--accent-on`.
- **§5 Status card → Tile di stato** (struttura icona, titolo, valore).
- **§6 Colori:** nuova palette neutra + accento lime; regola "lime = selezione e azione primaria, mai stato"; i token `--pocket-*`; i valori del doc riallineati ai token.
- **Nuove sezioni:**
  - Navigazione (rail + schede + badge);
  - Striscia di stato;
  - Comandi a passi e toggle;
  - Dialog di conferma unico (eccezione: rosso pieno sul comando pericoloso);
  - Pagina Allarmi (livelli, barra, codice, rimedio).

### 4.6 Decisioni che servono da Dario prima di implementare
1. **Accento lime #A5F960 (fedele a Bambu) o accento attuale con la sola struttura Bambu.** Il rischio del lime: è vicino a `--color-success` (#4ADE80, verde di WORKING/AUTO). Si mitiga con la regola "lime solo per azione e selezione, gli stati hanno sempre testo o badge", e si verifica a distanza in cella. In alternativa: lime per l'accento e uno stato success più freddo (verde-acqua).
2. **`--radius-btn`: pill o rettangolo arrotondato.** Il rettangolo è più Bambu, ma cambia la regola §7 approvata a luglio.
3. **Striscia di stato in alto:** sì (consigliato) o no (fedeltà a Bambu).
4. **Colori delle tasche** (`--pocket-*`): fissarli una volta e correggere l'inversione RAW/WORKING.
5. **Pagina Allarmi:** è funzionale, non solo estetica. Va confermato che entri in questo lavoro.

---

## 5. Mockup (`mockup/`)
- `home.html`: rail con la voce attiva lime e il badge allarmi, striscia di stato, tre tile di stato con valore grande, ordine in corso (0 / 1 grande, barra lime, Avvia/Ferma a tile), lista allarmi stile HMS.
- `robot.html`: schede Robot / Macchina 1 / EasyBox, tile di stato (HOLD grande, pinza, coerenza), velocità a passi e preset, comandi a gruppi; dialog di conferma aperto apposta per mostrarne lo stile.
- `produzione.html`: ordini in card con stato a badge, avanzamento grande e azioni a tile. "Rilancia" compare sull'ordine finito.

Usano **solo** i token del §4.1/§4.2, ripetuti in testa a ogni file, e l'impaginazione delle schermate di cella; codici pezzo e descrizioni sono inventati (il repo è pubblico). Due righe di Produzione sono esempi nello stesso formato, per mostrare gli stati WORKING e FINITO. Sono pensati per 1920×1080.

---

## 6. Piano a fasi
Le stime sono in giornate di lavoro, verifica visiva compresa. Ogni fase si chiude con un rilievo delle schermate in locale, lo stesso script di questo audit lanciato su `localhost`.

| Fase | Cosa | File | Stima | Rischi |
|---|---|---|---|---|
| **0. Fondamenta** (nessun cambiamento visibile) | token nuovi (§4.2); dialog unico in un file globale o componente, togliendo le 10 copie; `--bg-sidebar`; stringhe fisse in i18n | `design-tokens.css`, `buttons.css` o `layout-shell.css`, i 10 `.vue` con dialog, `Fixture.vue`, `it/en.json`, le viste con DELETE/EXIT/Save | 1 | test che leggono i template dei dialog: `test_reset_dialogs`, `test_pickplace`, `test_robot_claw`, `test_usabilita` |
| **1. Palette e forme** | valori del §4.1; correzione dei campi bianchi (Tray, Pallet, Fixture, ImportGrating usano il token) | `design-tokens.css`, `buttons.css`, `App.vue` (CSS globale: `body{background:white}`, rgb fissi), `numericField.vue` | 1–1,5 | contrasto (rifare il calcolo WCAG di §6); lime contro success; leggibilità a distanza da provare in cella |
| **2. Navigazione** | rail a icone + schede nelle pagine; striscia di stato al posto di `barraInAlto`; badge allarmi; Magazzini nascosto all'operatore | `SideBar.vue`, `menu.vue`, `StandardMenu.vue`, `barraInAlto.vue`, `router/index.js` (meta del gruppo), le viste che diventano schede | 2 | `test_usabilita` (misure del menu 1080, gap, margini), `test_oneshot_refresh` (StandardMenu); abitudini degli operatori: serve una prova in cella |
| **3. Home e Controlli** | Dashboard a tile; Robot, CNC, EasyBox con tile di stato e comandi a gruppi; velocità a passi | `DashboardView.vue`, `units.vue`, `productionTable.vue`, `robotView.vue`, `CNC1View.vue`, `CNC2View.vue`, `smallboxView.vue` | 2–3 | **pagine critiche per la sicurezza**: HOLD/RESET/RESTART e i dialog di conferma devono restare distinguibili e nello stesso ordine; test strutturali `test_pickplace` (marcatori CARD), `test_robot_claw`, `test_cell_declare`, `test_cnc1_vice_lock`; il gating dei comandi non deve cambiare |
| **4. Allarmi (HMS)** | pagina nuova + badge | nuova vista, `router/index.js`, `StandardMenu.vue`, eventuale rotta backend per la decodifica dei codici | 1,5 | è funzionale: decidere cosa mostra (storico da DB o solo attivi), codici decodificati |
| **5. Produzione e configurazione** | Produzione a card; liste config a card dove servono; layout cassetto ridisegnato con i colori `--pocket-*` e un disegno che usa la pagina | `productionView.vue`, `productionTable.vue`, viste `conf/*`, `layoutView.vue`, `TrayPockets.vue`, `prisma.vue`, `cylinder.vue`, `Grating.vue` (export SVG) | 2–3 | export e stampa del grigliato (XMLSerializer); `cavityClearance.js` (`lightcyan`); `test_layout_view`, `test_layout_nav`, `test_grating_*`, `test_cavity_clearance` |
| **6. Pulizia e documento** | rimozione dei file morti (§2.1); `UI-DESIGN-SYSTEM.md` v2 (§4.5) | file elencati, `docs/` | 0,5–1 | nessuno funzionale; verificare che nessun test importi i file morti |

**Totale indicativo: 10–13 giornate.**

**Ordine consigliato:** 0 → 1 → 2 → 3, poi 4 e 5 in parallelo, poi 6. Le fasi 1 e 3 si provano in cella prima di andare avanti: leggibilità a distanza, guanti, luce del reparto.

---

## 7. Guardia di rete del rilievo: esito
Regole:
- **HTTP:** verso `/api/` passano solo le GET di lettura di una lista di permessi, costruita leggendo i router di `serverDati`. Sono state escluse le 36 GET che scrivono, trovate scandendo i corpi delle rotte, e per prudenza anche `pushQuotes`, `insertTray` e `setClaw*`. Ogni altro metodo è bloccato.
- **Socket.io:** sono filtrati sia i POST del polling sia i frame websocket. Passano solo `UNIT/STATUS/REQUEST`, `GRIPPER/REQUEST_SNAPSHOT`, `BRAND/REQUEST_SNAPSHOT` (letture dalla cache) e `request-snapshot` (diagnostica). Bloccati `TO_PLANT/*`, `PLC/REFRESH_REQUEST` ed eventi sconosciuti.

Esito:
- **Comandi verso la cella: zero.** Nessun `TO_PLANT/*` emesso, nessun POST/PUT/DELETE verso `/api/`, nessuna GET di scrittura.
- **Bloccate: 196 `PLC/REFRESH_REQUEST`** (166 via polling, 30 via websocket). Il pannello lo chiede a ogni pagina; per la guardia è un comando verso il PLC (refresh 90), quindi è stato fermato.
- **Bloccate: 4 GET `/api/conf/grating/showcompleteData/all`.** È una lettura, ma il pannello la chiama con la "c" minuscola e la lista di permessi la scriveva maiuscola: un eccesso di prudenza. Effetto: la schermata della pagina Grigliato potrebbe avere dati incompleti.
- **`SNAPSHOT/MISS` ricevuti: 0.** Le cache del backend erano piene, quindi le richieste di snapshot ammesse non hanno fatto partire nessun refresh verso il PLC.
- **Errori JavaScript delle pagine: 0.**

Il log completo, richiesta per richiesta, è in `rilievo.json` → `guardia`.

---

## 8. Dubbi
- La **versione in cella** non coincide né con `4d264aa` (citato nel prompt P1-P8) né con `ui-lifting`: le schermate mostrano i lavori del 5/10 mattina e P1. Conviene annotare da quale commit viene il deploy attuale.
- **Unità della scheda Pallet:** le correzioni sono etichettate "0.001mm" ma mostrano valori in mm. Da verificare: potrebbe essere solo l'etichetta.
- **Magazzini a livello operatore:** la voce di menu porta a una pagina "non abilitato". Va nascosta come Macchine e MQTT, oppure va bene così?
- I **mockup** usano icone SVG disegnate a mano, segnaposto: la scelta di un set di icone (pieno per il rail, come Bambu) è un'altra decisione.
