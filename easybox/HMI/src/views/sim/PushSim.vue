<!--
  PushSim.vue — SIMULAZIONE del ciclo di SPINTA IN BATTUTA (push-to-stop 15/9)

  SCOPO: far vedere all'operatore cosa fara' il robot PRIMA di lanciare il
  ciclo, e far capire a colpo d'occhio il caso che conta di piu': un pezzo che
  ECCEDE la ganascia della morsa non appoggia sulla fine della ganascia ma su
  un riferimento dichiarato piu' avanti.

  DUE MODALITA' PER LIVELLO:
    livello 0 (operatore)      -> SOLA LETTURA, dati reali del database
    livello 1+ (manutentore)   -> parametri modificabili, disegno e quote dal vivo
  Il livello decade da solo dopo cinque minuti: la pagina torna in sola lettura
  SENZA perdere il disegno, perche' i valori simulati stanno nello stato del
  componente e non nei campi.

  QUESTA PAGINA SCRIVE, ma mai in silenzio (deciso dopo la prova in cella:
  far saltare il tecnico da una pagina all'altra costava piu' di quanto
  proteggesse). Il rischio resta quello di sempre: un manutentore che muove i
  numeri finche' il disegno "torna" scrive misure che non corrispondono agli
  oggetti reali, e siccome VICE/GRIPPER/PIECE non hanno colonna di autore ne'
  di data, quel valore diventerebbe indistinguibile da uno misurato col
  calibro. E quelle colonne alimentano la vista che legge il PLC.

  Contro quel rischio ci sono DUE difese, e servono tutte e due:
    - la CONFERMA nomina l'oggetto fisico e dice da quale valore a quale, con
      le stesse parole che userebbe chi ha il calibro in mano. Copre
      l'INTENZIONE, nel momento in cui si scrive;
    - la riga in LOG (serverDati/auditLog.js) dice dopo che quella misura e'
      stata cambiata dalla simulazione, da quanto a quanto. Copre la
      PROVENIENZA, che senza colonne di audit sarebbe persa per sempre.

  L'etichetta di divergenza e il pulsante di ripristino restano: finche' non si
  conferma, il disegno non e' lo stato dell'impianto e deve dirlo.

  DISEGNO: SVG inline, unita' utente = MICRON, viewBox calcolata (stesso
  pattern della pagina Grigliato). Niente libreria: la vista e' piatta e fatta
  di rettangoli, e come nodi del DOM scalano nitidi sul touch e si stampano.

  ORIENTAMENTO: il disegno e' RIBALTATO sull'asse verticale rispetto al frame
  del robot, cioe' la X del robot cresce verso SINISTRA sullo schermo. Non e'
  una scelta grafica: e' come si vede la cella stando davanti (verificato sul
  pannello il 15/9). Il ribaltamento e' una convenzione di VISTA e basta: le
  quote non cambiano di un micron, e il test lo verifica confrontando i numeri
  prima e dopo. Il pezzo misura PIECE.Y lungo X e PIECE.X lungo Y: e' la
  rotazione fra disegno e robot, ed e' la cosa piu' utile che questa pagina
  insegna.

  CORPO DELLA MORSA DISEGNATO TENUE: la lunghezza della ganascia e' misurata,
  quindi e' piena; VICE.X e VICE.Y sono ingombri la cui orientazione sul
  pallet nessuno ha dichiarato, quindi niente deve far leggere precisione
  dove non ce n'e'.
-->
<template>
  <div class="view-shell view-shell--fill conf-card push-sim">
    <h1 class="sim-title">{{ t("pushSim.title") }}</h1>

    <p class="sim-intro">{{ t("pushSim.intro") }}</p>

    <div class="sim-layout">
      <!-- ------------------------------------------------ scelta e parametri -->
      <section class="sim-panel">
        <h2 class="sim-h2">{{ t("pushSim.choice") }}</h2>

        <div class="sim-field">
          <label for="sim-piece">{{ t("pushSim.piece") }}</label>
          <select id="sim-piece" v-model="sel.pieceID" @change="onSelectionChange">
            <option :value="0">{{ t("pushSim.pick") }}</option>
            <option v-for="p in pieces" :key="p.ID" :value="p.ID">
              {{ pieceLabel(p) }}
            </option>
          </select>
        </div>

        <div class="sim-field">
          <label for="sim-vice">{{ t("pushSim.vice") }}</label>
          <select id="sim-vice" v-model="sel.viceID" @change="onSelectionChange">
            <option :value="0">{{ t("pushSim.pick") }}</option>
            <option v-for="v in vices" :key="v.ID" :value="v.ID">
              {{ viceLabel(v) }}
            </option>
          </select>
        </div>

        <div class="sim-field">
          <label for="sim-gripper">{{ t("pushSim.gripper") }}</label>
          <select id="sim-gripper" v-model="sel.gripperID" @change="onSelectionChange">
            <option :value="0">{{ t("pushSim.pick") }}</option>
            <option v-for="g in grippers" :key="g.ID" :value="g.ID">
              {{ gripperLabel(g) }}
            </option>
          </select>
        </div>

        <h2 class="sim-h2">{{ t("pushSim.measures") }}</h2>
        <p class="sim-hint">{{ canEdit ? t("pushSim.measuresEdit") : t("pushSim.measuresRead") }}</p>

        <!-- In sola lettura i valori sono TESTO, non campi disabilitati: su un
             touch un campo grigio invita comunque a toccarlo. -->
        <div v-for="f in fields" :key="f.key" class="sim-field">
          <label :for="'sim-' + f.key">{{ t(f.label) }}</label>
          <input
            v-if="canEdit"
            :id="'sim-' + f.key"
            class="sim-input"
            type="number"
            step="0.1"
            min="0"
            inputmode="decimal"
            autocomplete="off"
            v-model="sim[f.key]"
          />
          <span v-else class="sim-readonly">{{ mmText(sim[f.key]) }}</span>
          <span class="sim-unit">mm</span>
          <!-- il pulsante compare SOLO sul campo che e' stato cambiato: e'
               anche il modo piu' semplice per vedere cosa si sta per salvare -->
          <button
            v-if="canEdit && fieldChanged(f.key)"
            type="button"
            class="pure-button button_pressed sim-save"
            :disabled="saving"
            @click="askSave(f.key)"
          >
            {{ t("pushSim.save") }}
          </button>
        </div>

        <p v-if="stopDeclaredReal === null && exceeds" class="sim-warn">
          {{ t("pushSim.stopMissing") }}
        </p>

        <div v-if="diverged" class="sim-diverged">
          <strong>{{ t("pushSim.diverged") }}</strong>
          <button type="button" class="pure-button button_pressed" @click="restoreReal">
            {{ t("pushSim.restore") }}
          </button>
        </div>

        <p class="sim-hint">{{ t("pushSim.saveHint") }}</p>
        <div class="sim-links">
          <router-link v-if="sel.viceID" class="pure-button" :to="{ path: '/conf/vice', query: { viceID: sel.viceID } }">
            {{ t("pushSim.goVice") }}
          </router-link>
          <router-link v-if="sel.gripperID" class="pure-button" :to="{ path: '/conf/Gripper/gripper', query: { gripperID: sel.gripperID } }">
            {{ t("pushSim.goGripper") }}
          </router-link>
          <router-link v-if="sel.pieceID" class="pure-button" :to="{ path: '/conf/piece/piece', query: { pieceID: sel.pieceID } }">
            {{ t("pushSim.goPiece") }}
          </router-link>
        </div>
      </section>

      <!-- CONFERMA: nomina l'oggetto FISICO che si sta ridefinendo e dice da
           quale valore a quale. Non e' un "sei sicuro?": chi legge deve poter
           riconoscere l'oggetto che ha davanti. -->
      <div v-if="confirm" class="sim-confirm-back" @click.self="confirm = null">
        <div class="sim-confirm" role="dialog" aria-modal="true">
          <h2 class="sim-h2">{{ t("pushSim.confirmTitle") }}</h2>
          <p class="confirm-what">{{ confirm.text }}</p>
          <p v-if="confirm.warn" class="confirm-warn">{{ confirm.warn }}</p>
          <div class="confirm-buttons">
            <button type="button" class="pure-button" @click="confirm = null">
              {{ t("pushSim.cancel") }}
            </button>
            <button type="button" class="pure-button button_pressed" :disabled="saving" @click="doSave">
              {{ t("pushSim.confirmSave") }}
            </button>
          </div>
        </div>
      </div>

      <!-- ------------------------------------------------------- il disegno -->
      <section class="sim-stage">
        <svg
          class="sim-svg"
          :viewBox="viewBox"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          :aria-label="t('pushSim.title')"
        >
          <defs>
            <!-- la parte di pezzo NON sostenuta dalla ganascia -->
            <pattern id="overhangHatch" width="9000" height="9000" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="9000" height="9000" fill="#7a5a10" />
              <rect width="4500" height="9000" fill="#b07f15" />
            </pattern>
            <!-- ingombro spazzato dal pezzo durante la spinta -->
            <pattern id="sweptHatch" width="7000" height="7000" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <rect width="7000" height="7000" fill="#1d2a3a" />
              <rect width="3500" height="7000" fill="#26384d" />
            </pattern>
            <clipPath id="jawClip">
              <rect :x="-g.claw / 2" :y="-g.viceY" :width="g.claw" :height="g.viceY * 2" />
            </clipPath>
          </defs>

          <!-- RIBALTAMENTO sull'asse verticale: la X del robot cresce verso
               sinistra sullo schermo, che e' come si vede la cella stando
               davanti. Tutta la geometria resta scritta nel frame del robot e
               viene specchiata QUI, in un punto solo; le scritte dentro il
               gruppo si rimettono dritte con una contro-specchiatura locale,
               altrimenti uscirebbero allo specchio. Le quote non cambiano. -->
          <g transform="scale(-1 1)">

          <!-- corpo morsa: TENUE, l'orientazione non e' dichiarata -->
          <rect
            class="vice-body"
            :x="-g.viceX / 2"
            :y="-g.viceY / 2"
            :width="g.viceX"
            :height="g.viceY"
          />

          <!-- ganasce: si aprono lungo Y, quindi stringono di traverso alla
               spinta; la loro LUNGHEZZA lungo X e' il dato misurato -->
          <rect class="jaw" :x="-g.claw / 2" :y="-g.jawY - g.jawT" :width="g.claw" :height="g.jawT" />
          <rect class="jaw" :x="-g.claw / 2" :y="g.jawY" :width="g.claw" :height="g.jawT" />

          <!-- ingombro spazzato dal pezzo -->
          <rect
            v-if="ok && g.travel > 0"
            :x="-g.pieceLen / 2"
            :y="-g.pieceWid / 2"
            :width="g.pieceLen + g.travel"
            :height="g.pieceWid"
            fill="url(#sweptHatch)"
          />

          <!-- pezzo: base tratteggiata (parte che sporge) + parte sostenuta
               dalla ganascia, ritagliata sulla campata -->
          <g class="moving" :transform="'translate(' + pieceOffset + ' 0)'">
            <rect
              :x="-g.pieceLen / 2"
              :y="-g.pieceWid / 2"
              :width="g.pieceLen"
              :height="g.pieceWid"
              fill="url(#overhangHatch)"
              stroke="#e8a317"
              :stroke-width="g.line"
            />
            <rect
              clip-path="url(#jawClip)"
              :x="-g.pieceLen / 2"
              :y="-g.pieceWid / 2"
              :width="g.pieceLen"
              :height="g.pieceWid"
              fill="#3f7fbf"
              stroke="#8fc4ff"
              :stroke-width="g.line"
            />
          </g>

          <!-- chela della pinza: due chele che stringono lungo Y, lunghe lungo
               X; il TCP sta al centro, il contatto e' sul bordo -->
          <g
            class="moving"
            :transform="'translate(' + clawOffset + ' 0)'"
            :opacity="phase === 0 ? 0 : 1"
          >
            <rect
              class="tool"
              :x="-g.pieceLen / 2 - g.tool"
              :y="-g.pieceWid / 2 - g.toolT - g.line"
              :width="g.tool"
              :height="g.toolT"
            />
            <rect
              class="tool"
              :x="-g.pieceLen / 2 - g.tool"
              :y="g.pieceWid / 2 + g.line"
              :width="g.tool"
              :height="g.toolT"
            />
          </g>

          <!-- BATTUTA. Sulla fine della ganascia, oppure sul riferimento
               dichiarato oltre di essa. Sono due segni diversi apposta. -->
          <line
            v-if="stopX !== null"
            :class="restsOnClaw ? 'stop-claw' : 'stop-declared'"
            :x1="stopX"
            :x2="stopX"
            :y1="-g.viceY / 2 - g.line * 3"
            :y2="g.viceY / 2 + g.line * 3"
            :stroke-width="g.line * 2"
          />
          <!-- riferimento NON dichiarato: posizione ignota -->
          <g
            v-if="exceeds && stopDeclared === null"
            :transform="'translate(' + (g.claw / 2 + g.overhang) + ' ' + (-g.viceY / 2 - g.line * 6) + ') scale(-1 1)'"
          >
            <text class="lbl-missing" x="0" y="0" :font-size="g.font" text-anchor="middle">?</text>
          </g>

          <!-- quota della distanza dichiarata -->
          <g v-if="!restsOnClaw && stopDeclared !== null">
            <line
              class="dim"
              :x1="g.claw / 2"
              :x2="stopX"
              :y1="g.viceY / 2 + g.line * 6"
              :y2="g.viceY / 2 + g.line * 6"
              :stroke-width="g.line"
            />
            <g :transform="'translate(' + (g.claw / 2 + stopX) / 2 + ' ' + (g.viceY / 2 + g.line * 5) + ') scale(-1 1)'">
              <text class="dim-lbl" x="0" y="0" :font-size="g.font" text-anchor="middle">{{ mm(stopDeclared) }}</text>
            </g>
          </g>

          <!-- quote del pezzo: le due dimensioni, e la rotazione che confonde -->
          <g :transform="'translate(0 ' + (-g.pieceWid / 2 - g.line * 2) + ') scale(-1 1)'">
            <text class="dim-lbl" x="0" y="0" :font-size="g.font" text-anchor="middle">{{ mm(g.pieceLen) }}</text>
          </g>
          <g :transform="'translate(' + (-g.pieceLen / 2 - g.line * 2) + ' 0) scale(-1 1)'">
            <text
              class="dim-lbl"
              x="0"
              y="0"
              :font-size="g.font"
              text-anchor="start"
              dominant-baseline="middle"
            >{{ mm(g.pieceWid) }}</text>
          </g>

          <!-- verso della X del robot: la punta sta dal lato in cui la X
               cresce, che dopo il ribaltamento e' a sinistra sullo schermo -->
          <line class="axis" :x1="axis.x1" :x2="axis.x2" :y1="axis.y" :y2="axis.y" :stroke-width="g.line" />
          <g :transform="'translate(' + axis.x2 + ' ' + (axis.y - g.line * 2) + ') scale(-1 1)'">
            <text class="axis-lbl" x="0" y="0" :font-size="g.font" text-anchor="start">X</text>
          </g>

          </g>
        </svg>

        <div class="sim-phases">
          <button
            v-for="(lbl, i) in phaseLabels"
            :key="i"
            type="button"
            class="pure-button phase-btn"
            :class="{ 'phase-active': phase === i }"
            :disabled="!ok"
            @click="goPhase(i)"
          >
            {{ t(lbl) }}
          </button>
          <button type="button" class="pure-button button_pressed play-btn" :disabled="!ok" @click="play">
            {{ t("pushSim.play") }}
          </button>
        </div>
      </section>

      <!-- ---------------------------------------------------------- le quote -->
      <aside class="sim-quotes">
        <h2 class="sim-h2">{{ t("pushSim.quotes") }}</h2>

        <div class="quote-row" :class="{ 'quote-na': !ok }">
          <span>{{ t("pushSim.qPlace") }}</span><strong>{{ mmText(quotes.xPlaceMm) }}</strong>
        </div>
        <div class="quote-row" :class="{ 'quote-na': !ok }">
          <span>{{ t("pushSim.qPush") }}</span><strong>{{ mmText(quotes.xPushMm) }}</strong>
        </div>
        <div class="quote-row" :class="{ 'quote-na': !ok }">
          <span>{{ t("pushSim.qStop") }}</span><strong>{{ mmText(quotes.xStopMm) }}</strong>
        </div>
        <div class="quote-row quote-travel" :class="{ 'quote-na': !ok }">
          <span>{{ t("pushSim.qTravel") }}</span><strong>{{ mmText(quotes.travelMm) }}</strong>
        </div>

        <h2 class="sim-h2">{{ t("pushSim.outcome") }}</h2>
        <p class="sim-status" :class="ok ? 'st-ok' : 'st-ko'">
          {{ t("pushSim.status." + check.status) }}
        </p>
        <p class="sim-reason">{{ t("pushSim.reason." + check.status, reasonArgs) }}</p>
        <p v-if="ok" class="sim-rest">
          {{ restsOnClaw ? t("pushSim.restsOnClaw") : t("pushSim.restsOnDeclared", { mm: mm(stopDeclared) }) }}
        </p>
        <p v-if="!pieceHasPush && sel.pieceID" class="sim-hint">{{ t("pushSim.pushOff") }}</p>

        <!-- Quando la pagina si apre su un ordine VERO si mostra la riga
             LETTA dalla vista, cioe' quello che leggera' il PLC. Se i
             parametri vengono modificati quella lettura non descrive piu' il
             disegno, quindi si dichiara superata invece di restare li' a
             confondere. -->
        <div v-if="viewRow" class="sim-view">
          <h2 class="sim-h2">{{ t("pushSim.fromView") }}</h2>
          <p v-if="diverged" class="sim-hint">{{ t("pushSim.viewStale") }}</p>
          <template v-else>
            <div class="quote-row"><span>{{ t("pushSim.qOrder") }}</span><strong>{{ viewRow.ORDER_ID }}</strong></div>
            <div class="quote-row"><span>{{ t("pushSim.qPush") }}</span><strong>{{ mmText(viewRow.X_PUSH / 1000) }}</strong></div>
            <div class="quote-row"><span>{{ t("pushSim.qStop") }}</span><strong>{{ mmText(viewRow.X_STOP / 1000) }}</strong></div>
            <div class="quote-row"><span>{{ t("pushSim.outcome") }}</span><strong>{{ viewRow.PUSH_STATUS }}</strong></div>
          </template>
        </div>
      </aside>
    </div>
  </div>
</template>

<script>
import { dataStored } from "../../data.js";
import { pushQuotes, PUSH_STATUS, STOP_REF } from "../../util/pushQuotes.js";
import { KO_NOT_FOUND } from "../../util/errorCodes.js";

// millimetri -> micron e viceversa, con il vuoto che resta vuoto: lo ZERO e'
// un valore, l'assenza e' un'altra cosa (vale per l'appoggio dichiarato)
const toMicron = (mm) =>
  mm === null || mm === undefined || String(mm).trim() === "" ? null : Math.round(Number(mm) * 1000);

export default {
  name: "PushSim",

  data() {
    return {
      dataStored,
      pieces: [],
      vices: [],
      grippers: [],
      positions: [],
      stops: [],
      sel: { pieceID: 0, viceID: 0, gripperID: 0, machineID: 1 },
      // valori SIMULATI, in millimetri (quelli che si toccano)
      sim: { pieceLen: null, pieceWid: null, viceClaw: null, toolClaw: null, stopBeyond: null },
      // copia dei valori REALI letti dal database, in millimetri
      real: { pieceLen: null, pieceWid: null, viceClaw: null, toolClaw: null, stopBeyond: null },
      phase: 0,
      timers: [],
      viewRow: null,
      // conferma in corso: { key, text, warn, run }
      confirm: null,
      saving: false,
      fields: [
        { key: "pieceLen", label: "pushSim.fPieceLen" },
        { key: "pieceWid", label: "pushSim.fPieceWid" },
        { key: "viceClaw", label: "pushSim.fViceClaw" },
        { key: "toolClaw", label: "pushSim.fToolClaw" },
        { key: "stopBeyond", label: "pushSim.fStopBeyond" },
      ],
      phaseLabels: ["pushSim.phPlace", "pushSim.phPush", "pushSim.phStop"],
    };
  },

  computed: {
    // livello 1 = manutentore. Letto dallo store a ogni render: quando il
    // livello decade da solo dopo cinque minuti la pagina torna in sola
    // lettura senza ricaricare e senza perdere il disegno.
    canEdit() {
      return Number(dataStored.userLevel) >= 1;
    },

    // misure simulate in micron (quelle che entrano nel calcolo)
    m() {
      return {
        pieceLen: toMicron(this.sim.pieceLen) || 0,
        pieceWid: toMicron(this.sim.pieceWid) || 0,
        viceClaw: toMicron(this.sim.viceClaw) || 0,
        toolClaw: toMicron(this.sim.toolClaw) || 0,
        stopBeyond: toMicron(this.sim.stopBeyond),
      };
    },

    xPlace() {
      const row = this.positions.find(
        (p) => String(p.PARENT || "").trim() === "MC_" + this.sel.machineID
      );
      return row ? Number(row.X) : 0;
    },

    // il pezzo eccede la ganascia?
    exceeds() {
      return this.m.viceClaw > 0 && this.m.pieceLen > this.m.viceClaw;
    },

    stopDeclared() {
      return this.m.stopBeyond;
    },

    stopDeclaredReal() {
      return toMicron(this.real.stopBeyond);
    },

    // STESSA funzione del backend e della vista: qui non si ricalcola niente
    // a mano, altrimenti il disegno potrebbe raccontare una cosa diversa da
    // quella che fara' il PLC.
    check() {
      return pushQuotes({
        enabled: true,
        hasVice: !!this.sel.viceID,
        xPlace: this.xPlace,
        pieceY: this.m.pieceLen,
        viceClawLength: this.m.viceClaw,
        gripperClawLength: this.m.toolClaw,
        stopBeyondClaw: this.m.stopBeyond,
      });
    },

    ok() {
      return this.check.status === PUSH_STATUS.OK;
    },

    restsOnClaw() {
      return this.check.stopRef !== STOP_REF.DECLARED;
    },

    pieceHasPush() {
      const p = this.pieces.find((x) => x.ID == this.sel.pieceID);
      return !!(p && Number(p.PUSH_TO_STOP));
    },

    quotes() {
      const c = this.check;
      return {
        xPlaceMm: this.xPlace / 1000,
        xPushMm: c.xPush === null ? null : c.xPush / 1000,
        xStopMm: c.xStop === null ? null : c.xStop / 1000,
        travelMm: c.clearance === null ? null : c.clearance / 1000,
      };
    },

    reasonArgs() {
      return {
        piece: this.m.pieceLen / 1000,
        claw: this.m.viceClaw / 1000,
        over: Math.trunc((this.m.pieceLen - this.m.viceClaw) / 2) / 1000,
        stop: this.stopDeclared === null ? "-" : this.stopDeclared / 1000,
      };
    },

    diverged() {
      return this.fields.some((f) => {
        const a = toMicron(this.sim[f.key]);
        const b = toMicron(this.real[f.key]);
        return a !== b;
      });
    },

    // geometria del disegno, tutta in micron
    g() {
      const m = this.m;
      const vice = this.vices.find((v) => v.ID == this.sel.viceID) || {};
      const viceX = Number(vice.X) || Math.max(m.viceClaw * 1.4, 120000);
      const viceY = Number(vice.Y) || Math.max(m.pieceWid * 2.2, 120000);
      const pieceLen = m.pieceLen || 60000;
      const pieceWid = m.pieceWid || 40000;
      const claw = m.viceClaw || 100000;
      const span = Math.max(viceX, claw, pieceLen) + Math.abs(this.stopDeclared || 0);
      return {
        viceX,
        viceY,
        claw,
        pieceLen,
        pieceWid,
        tool: m.toolClaw || 20000,
        toolT: Math.max(pieceWid * 0.18, 6000),
        jawY: pieceWid / 2 + Math.max(pieceWid * 0.06, 2000),
        jawT: Math.max(pieceWid * 0.22, 8000),
        travel: this.check.clearance === null ? 0 : this.check.clearance,
        overhang: this.exceeds ? Math.trunc((m.pieceLen - claw) / 2) : 0,
        line: span / 260,
        font: span / 26,
      };
    },

    // la battuta: fine ganascia, oppure riferimento dichiarato oltre di essa.
    // null quando il pezzo eccede e nessuno ha dichiarato dove appoggia.
    stopX() {
      if (this.exceeds && this.stopDeclared === null) return null;
      return this.g.claw / 2 + (this.exceeds ? this.stopDeclared : 0);
    },

    pieceOffset() {
      return this.phase === 2 && this.ok ? this.g.travel : 0;
    },

    clawOffset() {
      return this.pieceOffset;
    },

    axis() {
      const g = this.g;
      const y = g.viceY / 2 + g.line * 14;
      return { x1: -g.viceX / 2, x2: g.viceX / 2, y };
    },

    // il ribaltamento e' una convenzione di VISTA: la geometria resta nel
    // frame del robot e viene specchiata nel disegno. Qui si specchia la
    // finestra, altrimenti inquadrerebbe il lato sbagliato.
    viewBox() {
      const g = this.g;
      const right = Math.max(
        g.viceX / 2,
        g.claw / 2 + Math.max(this.stopDeclared || 0, g.overhang),
        g.pieceLen / 2 + g.travel
      );
      const left = Math.max(g.viceX / 2, g.pieceLen / 2 + g.tool);
      const pad = Math.max(right + left, 1) * 0.12;
      const x = -left - pad;
      const w = left + right + pad * 2;
      const halfH = Math.max(g.viceY / 2, g.pieceWid / 2 + g.toolT) + g.line * 18;
      return [-(x + w), -halfH - pad, w, halfH * 2 + pad * 2].map(Math.round).join(" ");
    },
  },

  methods: {
    t(k, p) {
      return this.$t(k, p);
    },
    mm(micron) {
      return micron === null || micron === undefined ? "-" : Math.round(Number(micron) / 100) / 10;
    },
    mmText(v) {
      return v === null || v === undefined || v === "" ? "-" : Math.round(Number(v) * 10) / 10 + " mm";
    },
    pieceLabel(p) {
      const n = String(p.FAMILY || "").trim() || "#" + p.ID;
      return n + " (" + Math.round(Number(p.X) / 1000) + " x " + Math.round(Number(p.Y) / 1000) + ")";
    },
    viceLabel(v) {
      return (String(v.FAMILY || "").trim() || "#" + v.ID) + (v.PALLET_ID ? " — pallet " + v.PALLET_ID : "");
    },
    gripperLabel(g) {
      return (String(g.FAMILY || "").trim() || "#" + g.ID) + " #" + g.ID;
    },

    get(url) {
      return fetch(dataStored.server + url, { method: "GET" }).then((r) => {
        if (!r.ok) throw new Error("Network response was not ok");
        return r.json();
      });
    },

    loadAll() {
      Promise.all([
        this.get("api/conf/piece/show/all"),
        this.get("api/conf/vice/show/all"),
        this.get("api/conf/gripper/show/all"),
        this.get("api/conf/position/show/all"),
      ])
        .then(([pieces, vices, grippers, positions]) => {
          this.pieces = (pieces || []).filter((p) => Number(p.ID) > 0);
          this.vices = vices || [];
          this.grippers = grippers || [];
          this.positions = positions || [];
          this.applyQuery();
        })
        .catch(console.info);
    },

    // la pagina si puo' aprire gia' sul caso reale: dal wizard quando l'esito
    // non e' OK, o dalla pagina macchina
    applyQuery() {
      const q = this.$route.query || {};
      if (q.pieceID) this.sel.pieceID = Number(q.pieceID);
      if (q.gripperID) this.sel.gripperID = Number(q.gripperID);
      if (q.machineID) this.sel.machineID = Number(q.machineID);
      if (q.viceID) this.sel.viceID = Number(q.viceID);
      else if (q.palletID) {
        const v = this.vices.find((x) => x.PALLET_ID == q.palletID);
        if (v) this.sel.viceID = v.ID;
      }
      this.onSelectionChange();
      if (q.orderID) this.loadViewRow(Number(q.orderID));
    },

    // quello che leggera' il PLC, letto dalla vista e non ricalcolato
    loadViewRow(orderID) {
      if (!Number.isInteger(orderID) || orderID < 1) return;
      this.get("api/order/pushQuotes/" + orderID)
        .then((rows) => {
          this.viewRow = Array.isArray(rows) && rows.length ? rows[0] : null;
        })
        .catch(console.info);
    },

    // i valori REALI ricavati dalle anagrafiche gia' caricate. Separato dal
    // resto perche' dopo un salvataggio serve aggiornare i valori reali SENZA
    // buttare via le prove lasciate a meta' negli altri campi.
    recomputeReal() {
      const piece = this.pieces.find((p) => p.ID == this.sel.pieceID);
      const vice = this.vices.find((v) => v.ID == this.sel.viceID);
      const grip = this.grippers.find((g) => g.ID == this.sel.gripperID);
      this.real.pieceLen = piece ? Number(piece.Y) / 1000 : null;
      this.real.pieceWid = piece ? Number(piece.X) / 1000 : null;
      this.real.viceClaw = vice && vice.CLAW_LENGTH != null ? Number(vice.CLAW_LENGTH) / 1000 : null;
      this.real.toolClaw = grip && grip.CLAW_LENGTH != null ? Number(grip.CLAW_LENGTH) / 1000 : null;
    },

    onSelectionChange() {
      this.recomputeReal();
      this.real.stopBeyond = null;
      this.copyRealToSim();
      this.phase = 0;
      if (this.sel.viceID) this.loadStop(true);
    },

    // l'appoggio dichiarato vive nella coppia morsa+pezzo
    // syncSim=false serve dopo il salvataggio di un ALTRO campo: il valore
    // reale si aggiorna, ma quello che l'operatore stava provando resta.
    loadStop(syncSim) {
      return this.get("api/conf/vice/stops/" + this.sel.viceID)
        .then((rows) => {
          const row = (rows || []).find((x) => x.PIECE_ID == this.sel.pieceID) || null;
          this.real.stopBeyond = row ? Number(row.STOP_BEYOND_CLAW) / 1000 : null;
          if (syncSim) this.sim.stopBeyond = this.real.stopBeyond;
        })
        .catch(console.info);
    },

    copyRealToSim() {
      for (const f of this.fields) this.sim[f.key] = this.real[f.key];
    },

    // ---------------------------------------------------------------
    // SALVATAGGIO, sempre con conferma esplicita
    // ---------------------------------------------------------------
    fieldChanged(key) {
      const a = toMicron(this.sim[key]);
      const b = toMicron(this.real[key]);
      return a !== b;
    },

    objName(list, id, fallbackKey) {
      const o = (list || []).find((x) => x.ID == id);
      const fam = o ? String(o.FAMILY || "").trim() : "";
      return (fam || this.t(fallbackKey)) + " #" + id;
    },

    valText(micron) {
      return micron === null || micron === undefined
        ? this.t("pushSim.notMeasured")
        : Math.round(Number(micron) / 100) / 10 + " mm";
    },

    // Prepara la frase di conferma. Nomina l'OGGETTO FISICO, non il campo del
    // database: chi salva deve riconoscere la morsa che ha davanti.
    askSave(key) {
      const now = toMicron(this.sim[key]);
      const was = toMicron(this.real[key]);
      const args = { from: this.valText(was), to: this.valText(now) };

      if (key === "viceClaw") {
        if (now === null || now <= 0) return;
        this.confirm = {
          key,
          text: this.t("pushSim.confirmVice", { ...args, obj: this.objName(this.vices, this.sel.viceID, "pushSim.vice") }),
          run: () => this.send("api/conf/vice/setClawLength", { ID: this.sel.viceID, CLAW_LENGTH: now }),
        };
      } else if (key === "toolClaw") {
        if (now === null || now <= 0) return;
        this.confirm = {
          key,
          text: this.t("pushSim.confirmGripper", { ...args, obj: this.objName(this.grippers, this.sel.gripperID, "pushSim.gripper") }),
          run: () => this.send("api/conf/gripper/setClawLength", { ID: this.sel.gripperID, CLAW_LENGTH: now }),
        };
      } else if (key === "pieceLen" || key === "pieceWid") {
        const x = toMicron(this.sim.pieceWid), y = toMicron(this.sim.pieceLen);
        if (!x || !y || x <= 0 || y <= 0) return;
        this.confirm = {
          key,
          text: this.t("pushSim.confirmPiece", {
            obj: this.objName(this.pieces, this.sel.pieceID, "pushSim.piece"),
            from: this.valText(toMicron(this.real.pieceWid)) + " x " + this.valText(toMicron(this.real.pieceLen)),
            to: this.valText(x) + " x " + this.valText(y),
          }),
          // la Y del pezzo e' anche il passo delle tasche: chi salva lo deve
          // sapere PRIMA, non scoprirlo alla prossima generazione di griglia
          warn: this.t("pushSim.confirmPieceWarn"),
          run: () => this.send("api/conf/piece/setSize", { ID: this.sel.pieceID, X: x, Y: y }),
        };
      } else if (key === "stopBeyond") {
        if (!this.sel.viceID || !this.sel.pieceID) return;
        if (now === null) {
          // togliere la dichiarazione NON e' salvare uno zero: da quel momento
          // gli ordini con quel pezzo su quella morsa tornano a essere rifiutati
          this.confirm = {
            key,
            text: this.t("pushSim.confirmStopDelete", { obj: this.objName(this.vices, this.sel.viceID, "pushSim.vice"), piece: this.objName(this.pieces, this.sel.pieceID, "pushSim.piece") }),
            warn: this.t("pushSim.confirmStopDeleteWarn"),
            run: () => this.send("api/conf/vice/deleteStop", { VICE_ID: this.sel.viceID, PIECE_ID: this.sel.pieceID }),
          };
        } else {
          this.confirm = {
            key,
            text: this.t("pushSim.confirmStop", { ...args, obj: this.objName(this.vices, this.sel.viceID, "pushSim.vice"), piece: this.objName(this.pieces, this.sel.pieceID, "pushSim.piece") }),
            run: () => this.send("api/conf/vice/setStop", { VICE_ID: this.sel.viceID, PIECE_ID: this.sel.pieceID, STOP_BEYOND_CLAW: now }),
          };
        }
      }
    },

    send(path, params) {
      const url = dataStored.server + path + "?" + new URLSearchParams(params).toString();
      return fetch(url, { method: "GET" }).then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      });
    },

    doSave() {
      if (!this.confirm || this.saving) return;
      const c = this.confirm;
      this.saving = true;
      c.run()
        .then((body) => {
          this.saving = false;
          this.confirm = null;
          if (String(body).trim() === KO_NOT_FOUND) {
            dataStored.alert.title = this.t("WARNING");
            dataStored.alert.desc = this.t("pushSim.saveNotFound");
            dataStored.alert.type = "warning";
            return;
          }
          // si rilegge dal database invece di fidarsi: dopo il salvataggio la
          // divergenza deve sparire perche' i due valori coincidono davvero
          this.reloadAfterSave(c.key);
        })
        .catch((e) => {
          console.info(e);
          this.saving = false;
          this.confirm = null;
          dataStored.alert.title = this.t("WARNING");
          dataStored.alert.desc = this.t("pushSim.saveError");
          dataStored.alert.type = "warning";
        });
    },

    // savedKey e' l'unico campo che deve tornare al valore del database: le
    // prove lasciate a meta' sugli ALTRI campi non si buttano via, salvare una
    // misura non deve cancellare il ragionamento in corso sulle altre
    reloadAfterSave(savedKey) {
      const keep = { ...this.sim };
      // le due dimensioni del pezzo viaggiano insieme: si salvano con una
      // chiamata sola, quindi tornano insieme dal database
      const saved = savedKey === "pieceLen" || savedKey === "pieceWid"
        ? ["pieceLen", "pieceWid"] : [savedKey];
      return Promise.all([
        this.get("api/conf/piece/show/all"),
        this.get("api/conf/vice/show/all"),
        this.get("api/conf/gripper/show/all"),
      ])
        .then(([pieces, vices, grippers]) => {
          this.pieces = (pieces || []).filter((p) => Number(p.ID) > 0);
          this.vices = vices || [];
          this.grippers = grippers || [];
          this.recomputeReal();
          // il campo salvato torna dal database (si rilegge invece di fidarsi:
          // e' la prova che la scrittura e' arrivata). Quello che l'operatore
          // stava provando sugli ALTRI campi resta dov'era.
          for (const f of this.fields)
            this.sim[f.key] = saved.includes(f.key) ? this.real[f.key] : keep[f.key];
          if (this.sel.viceID) return this.loadStop(saved.includes("stopBeyond"));
        })
        .catch(console.info);
    },

    restoreReal() {
      this.copyRealToSim();
      this.phase = 0;
    },

    clearTimers() {
      for (const id of this.timers) clearTimeout(id);
      this.timers = [];
    },

    goPhase(i) {
      this.clearTimers();
      this.phase = i;
    },

    // le tre fasi in sequenza; la transizione la fa il CSS sul transform
    play() {
      this.clearTimers();
      this.phase = 0;
      this.timers.push(setTimeout(() => (this.phase = 1), 700));
      this.timers.push(setTimeout(() => (this.phase = 2), 1600));
    },
  },

  mounted() {
    this.loadAll();
  },

  beforeUnmount() {
    this.clearTimers();
  },
};
</script>

<style scoped>
.push-sim {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sim-title {
  margin: 0;
  font-size: 1.4rem;
}
.sim-intro,
.sim-hint {
  margin: 0;
  opacity: 0.8;
}
.sim-h2 {
  margin: 10px 0 4px;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.85;
}
.sim-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}
.sim-panel {
  flex: 1 1 260px;
  min-width: 250px;
}
.sim-stage {
  flex: 2 1 420px;
  min-width: 280px;
}
.sim-quotes {
  flex: 1 1 220px;
  min-width: 220px;
}
.sim-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.sim-field label {
  flex: 1 1 130px;
  min-width: 120px;
}
.sim-input,
.sim-field select {
  flex: 0 0 auto;
  width: 120px;
  min-height: 44px;
}
.sim-field select {
  width: 100%;
  max-width: 260px;
}
.sim-readonly {
  min-width: 120px;
  font-weight: 600;
}
.sim-unit {
  opacity: 0.7;
}
.sim-warn {
  margin: 6px 0;
  padding: 8px;
  border-left: 3px solid var(--color-warning, #e8a317);
}
.sim-diverged {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 8px 0;
  padding: 8px;
  border-left: 3px solid var(--color-warning, #e8a317);
}
.sim-diverged .pure-button {
  min-height: 44px;
}
.sim-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.sim-links .pure-button {
  min-height: 44px;
}
.sim-svg {
  width: 100%;
  height: auto;
  max-height: 60vh;
  background: #16202c;
  border-radius: 8px;
}
.vice-body {
  fill: #223043;
  stroke: #33455c;
  stroke-width: 0;
  opacity: 0.55;
}
.jaw {
  fill: #5b6b80;
}
.tool {
  fill: #cfd8e3;
}
.stop-claw {
  stroke: #57d08a;
}
.stop-declared {
  stroke: #e8a317;
  stroke-dasharray: 9000 6000;
}
.dim {
  stroke: #9fb3c8;
}
.dim-lbl {
  fill: #cfd8e3;
}
.lbl-missing {
  fill: #ff6b6b;
  font-weight: 700;
}
.axis {
  stroke: #6b7c92;
}
.axis-lbl {
  fill: #9fb3c8;
}
/* l'animazione delle tre fasi: la fa il CSS, il componente cambia solo
   l'offset. Corsa diversa nei tre casi, quindi le tre situazioni si
   distinguono anche dal movimento. */
.moving {
  transition: transform 0.6s ease-in-out, opacity 0.3s linear;
}
.sim-phases {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.phase-btn,
.play-btn {
  min-height: 44px;
  min-width: 96px;
}
.phase-active {
  outline: 2px solid var(--accent, #4a9eff);
}
.quote-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border, #2a3444);
}
.quote-travel strong {
  font-size: 1.1rem;
}
.quote-na strong {
  opacity: 0.5;
}
.sim-status {
  margin: 4px 0;
  font-weight: 700;
}
.st-ok {
  color: #57d08a;
}
.st-ko {
  color: #ff6b6b;
}
.sim-reason,
.sim-rest {
  margin: 4px 0;
}
@media (max-width: 760px) {
  .sim-layout {
    flex-direction: column;
  }
  .sim-panel,
  .sim-stage,
  .sim-quotes {
    width: 100%;
  }
}
.sim-save {
  min-height: 44px;
}
/* la conferma copre la pagina: chi salva deve leggere, non sfiorare */
.sim-confirm-back {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 50;
}
.sim-confirm {
  background: var(--bg, #0b0f14);
  border: 1px solid var(--border, #2a3444);
  border-radius: 10px;
  padding: 16px;
  max-width: 520px;
  width: 100%;
}
.confirm-what {
  font-size: 1.05rem;
  margin: 8px 0;
}
.confirm-warn {
  margin: 8px 0;
  padding: 8px;
  border-left: 3px solid var(--color-warning, #e8a317);
}
.confirm-buttons {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
  margin-top: 12px;
}
.confirm-buttons .pure-button {
  min-height: 44px;
  min-width: 120px;
}
</style>
