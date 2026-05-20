# HANDOFF — sessione di refactor maggio 2026

Documento di handoff per riprendere il lavoro sul backend/HMI EasyBox.
Generato 2026-05-13 al termine della sessione di refactor con Claude Code.

---

## Repository di lavoro

**Root**: `C:\Users\biagi\Desktop\newInterface\`

| Cartella | Cosa |
|---|---|
| `easybox\serverDati\` | Backend Node.js (`industri4.0_node`). Express HTTP porta **8080**, Socket.IO porta **3000**. Entry: `server.js` |
| `easybox\HMI\` | Frontend Vue 3 + Vite (`admg`). Source di verità |
| `HMI\` (fratello di `easybox\`) | Copia/fallback della HMI. **Non modificare**, è il backup |
| `easybox\` | Mosquitto config, log, modelli 3D |

**Repo separati di reference (non in scope)**:
- `Desktop\vecchiaInterfacciaEasy\` — versione precedente, reference storico
- `Desktop\InterfacciaVertibox\` — prototipo standalone magazzino verticale (Three.js + Babylon.js)
- `Desktop\VERTIBOX\` — solo CAD `.stp`

---

## Cosa è stato fatto nella sessione

### ✅ N1 — Pannello diagnostica MQTT (CHIUSO AL 100%)

Sub-step completati e applicati:

- **2a** — Scaffold vista `/diag/mqtt`, connessione Socket.IO namespace `/diag`, voce menu "MQTT Live" con `requiresLevel: 1`, i18n keys
- **2b** — Tabella scrollabile, filtri (topic/dir/source), pause/clear/export CSV, stats msg/sec, auto-scroll con anti-eco, inline expand
- **2c-A** — Persistenza filtri in `localStorage` (key `mqttdiag:filters`), validazione enum, fail silent
- **2c-B** — Lifecycle broker (`_BROKER/CONNECT`/`/CLOSE`/`/RECONNECT`) con flag anti-spam, URL sanitizzato (no credenziali)
- **2c-C** — Snapshot al reconnect (handler `request-snapshot` backend, flag `bulkReceived` client)

File toccati per N1:
- **Backend**: `serverDati\MQTTDiag.js` (nuovo), `serverDati\MQTT_Client.js` (+ ~70 righe in hook + lifecycle)
- **Frontend**: `HMI\src\views\diag\MqttDiag.vue` (nuovo, ~510 righe), `HMI\src\components\SidebarPlugin\SideBar.vue` (pattern `requiresLevel` + sezione Diagnostica), `HMI\src\router\index.js`, `HMI\src\data.js`, `HMI\src\locales\it.json`/`en.json`

### ✅ Cleanup (D1 + B3)

- `HMI\package.json` ripulito da deps inutilizzate (`mqtt`, `socket.io-client`, `fix`)
- Marker `TODO_DEADCODE` su `getWorkOrderLogs` in `DBFunct.js`, e in cima a `HMI.js` / `REST.js` (router non montati)

### ⚙️ N4 — Modulo HAAS via W-protocol (IN CORSO)

- **N4-1 applicato**: helper `getCnType(mcNum)` in `MQTT_Client.js`, sanity check nel case `STARTPP` di MC1 con publish `_HAAS/CONFIG_MISMATCH` al diag, `.env` con `CN_TYPE_MC<n>` (commentate, default heidenhain), estensione `isErrorTopic` suffix-based in `MqttDiag.vue` per evidenziare anche `_*/MISMATCH`
- **N4-2 scritto MA IN ATTESA DI REVIEW**: file `serverDati\CN\HAAS.js` (~245 righe). **È inerte**: nessun import attualmente lo punta, zero side effects runtime. Rivedere prima di procedere
- **N4-3 non iniziato**: integrazione MQTT dispatcher per `TO_PLANT/HAAS_CMD/<MC_num>` (payload JSON) + publish `FROM_PLANT/HAAS_ACK/<MC_num>`
- **N5 non iniziato**: viste CNC HMI riscritte per HAAS

---

## Convenzioni in vigore

### Topic MQTT
- `FROM_PLANT/*` — messaggi dal PLC verso backend
- `TO_PLANT/*` — comandi/richieste verso impianto (PLC o sotto-componenti come HAAS)
- `_<COMPONENT>/<EVENT>` — eventi interni backend, non topic MQTT reali (es. `_BROKER/ERROR`, `_HAAS/CONFIG_MISMATCH`)
- Topic HAAS Rizzo: `TO_PLANT/HAAS_CMD/<MC_num>` con payload JSON `{"cmd":"setMacro","var":500,"value":3}` → ACK su `FROM_PLANT/HAAS_ACK/<MC_num>` JSON `{"cmd":"setMacro","status":"OK","value":3.0}`
- Topic Heidenhain legacy: `FROM_PLANT/STARTPP/MC<n>` (intoccato, backwards-compat)

### Marker codice
- `TODO_SECURITY` — punti SQL injection a rischio (correzione consolidata con migrazione WPF + Entity Framework)
- `TODO_DB_VERIFY` — nomi tabella/schema da confermare con `SELECT name FROM sys.tables` quando avrò accesso al DB
- `TODO_DEADCODE` — codice non raggiungibile, da rimuovere dopo verifica
- `TODO_VERIFY` — assunzione tecnica da confermare con manuale/test (es. sintassi W-protocol HAAS)

### Convenzione i18n
- Chiavi nidificate sotto `menu.*`, `unit.*`, `conf.*`, ecc. in `it.json`/`en.json`
- Helper `tr(key, fallback)` in SideBar.vue fa fallback automatico se chiave assente

### Multi-CNC (introdotto in N4-1)
- `.env` per-macchina: `CN_TYPE_MC1=haas`, `CN_TYPE_MC2=heidenhain` (default heidenhain via fallback)
- Helper `getCnType(mcNum)` in `MQTT_Client.js` con validazione fail-safe
- Heidenhain (`HEIDENHAIN.js`) NON va rimosso, resta come fratello di `HAAS.js` per impianti esistenti
- Pattern modulo CNC: `serverDati\CN\<CN_NAME>.js` (nome neutro sul protocollo)

### userLevel HMI
Schema a 3 livelli: `0`=operatore (default), `1`=manutentore, `2`=tecnico/amministratore.
Pattern menu introdotto in N1-2a: voci sidebar con campo `requiresLevel`. Filtro via `computed`. Pattern riutilizzabile per future voci.

---

## Test pendenti in laboratorio

### N1 — sub-step 2c (mai validato)
- 2c-A: persistenza filtri in localStorage (cambio filtro, reload, sopravvive)
- 2c-B: lifecycle broker (stop/start Mosquitto, vedere `_BROKER/CONNECT`/`/CLOSE`/`/RECONNECT` nel pannello)
- 2c-C: snapshot al reconnect (riavvio backend, verifica request-snapshot)

### N4-1 (mai validato)
- Sanity check: `CN_TYPE_MC1=haas` + pubblicare `FROM_PLANT/STARTPP/MC1` con `mosquitto_pub` → vedere `_HAAS/CONFIG_MISMATCH` nel pannello rosso-rosa
- Fail-safe: `CN_TYPE_MC1=banana` → log warning + default heidenhain

---

## Decisioni aperte / da decidere

### N4-2 (review settimana prossima)
- Sintassi W-protocol esatta (`?E<var> <val>\r\n` è ipotesi, da confermare con manuale HAAS Macro Programming Reference)
- IP/porta HAAS in cantiere Rizzo (da settare in `.env` `HAAS_MC1_IP`, `HAAS_MC1_PORT`)
- Macro var trigger sottoprogramma (`HAAS_PROGRAM_TRIGGER_VAR`, default 500 — da confermare con programma macro caricato sulla HAAS)

### N4-3 (non iniziato)
- Subscribe MQTT al nuovo topic `TO_PLANT/HAAS_CMD/+`
- Parsing JSON payload + dispatch su `HAAS.requestProgram` / `HAAS.setMacroVar`
- Publish `FROM_PLANT/HAAS_ACK/<MC_num>` con esito (OK/KO + dettagli)
- Sanity check inverso: se PLC pubblica `HAAS_CMD/MC<n>` ma `CN_TYPE_MC<n>=heidenhain` → `_HAAS/CONFIG_MISMATCH` ignorato

### N5 (non iniziato)
- Viste `CNC1View.vue` / `CNC2View.vue` da rivedere in funzione dell'architettura PLC↔HAAS via I/O fisici + backend↔HAAS via W-protocol
- Possibili nuovi controlli HMI specifici HAAS (es. visualizzazione macro var corrente)

### Schema DB SQL Server (sospeso)
- Quando avrò accesso al DB: `SELECT name FROM sys.tables` su database `ADMG` per allineare i marker `TODO_DB_VERIFY` (nome `WORKORDER` vs `WORKORDERS`, esistenza tabella `pinza`, ecc.)

---

## Backlog P3 (post-Rizzo)

In ordine sparso, da affrontare in fase di cleanup dopo consegna:

- **D2** — credenziali DB hardcoded in `DBFunct.js` → spostare in `.env`
- **D3** — `data.js` HMI: rimuovere `server:"http://127.0.0.1:8080/"` morto, rinominare `brokerURL` → `socketURL`
- **D4** — `.env` HMI `WS_IP` duplicato (refuso)
- **D5** — dark mode integrare `useTheme()` con `initTheme()` (attualmente non funzionante)
- **D6** — rimuovere file `_ori`/`_old`/`Origi`/`1`/`copy` dopo check di `Dashboard_ori.vue` e `robotView copy.vue`
- **D7** — marcare con `TODO_SECURITY` i punti SQL injection più esposti
- **D8** — decidere se rimuovere `app.use('/api/rest', restRouter)` commentato in `server.js:65` (e i file `HMI.js`/`REST.js` orphan)
- **D9** — completare i18n keys mancanti per `sidebar.section.menu`, `sidebar.section.unit`, `sidebar.section.conf` (oggi vivono di fallback hardcoded)
- **B1** — apostrofi malposti in `WORKORDER\Order.js:73-91` (UPDATE query rotta)
- **B2** — naming inconsistente `WORKORDER` vs `WORKORDERS` (richiede accesso DB)
- **B3** — `getWorkOrderLogs` + intero `HMI.js`/`REST.js` rimovibili (già marcati `TODO_DEADCODE`)
- **N2** — reset errore PLC 9999 → **fuori scope di questo repo**, è fix lato PLC TIA Portal nel progetto separato

---

## Memoria persistente Claude Code

I file di memoria sono in `C:\Users\biagi\.claude\projects\C--Users-biagi-Desktop-newInterface\memory\` (spostati qui dalla sessione `InterfacciaVertibox` precedente).

Indice: `MEMORY.md`
File:
- `user_profile.md` — profilo utente, ruolo, preferenze
- `feedback_workflow.md` — workflow concordato per le edit (leggi → proponi → diff → conferma)
- `project_structure.md` — struttura repo, percorsi, porte
- `project_easybox_scope.md` — scope EasyBox: lavori incompleti, integrazione HAAS, marker security
- `project_easybox_decisions.md` — decisioni: commessa Rizzo, multi-CNC, priorità, stato N4
- `project_n1_diag_mqtt.md` — specifiche N1 chiuse al 100%
