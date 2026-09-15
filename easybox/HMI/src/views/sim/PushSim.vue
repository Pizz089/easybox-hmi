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

  QUESTA PAGINA NON SCRIVE MAI. Un manutentore che muove i numeri finche' il
  disegno "torna" scriverebbe misure che non corrispondono agli oggetti reali,
  e siccome VICE/GRIPPER/PIECE non hanno colonna di autore ne' di data, un
  valore aggiustato diventerebbe indistinguibile da uno misurato col calibro.
  E quelle colonne alimentano la vista che legge il PLC. Per salvare si va in
  anagrafica, dove il campo sta accanto alle altre misure dell'oggetto: i
  collegamenti qui sotto ci portano, col valore simulato gia' in mano.
  L'etichetta di divergenza e il pulsante di ripristino servono a non
  scambiare mai il disegno per lo stato corrente dell'impianto.

  DISEGNO: SVG inline, unita' utente = MICRON, viewBox calcolata (stesso
  pattern della pagina Grigliato). Niente libreria: la vista e' piatta e fatta
  di rettangoli, e come nodi del DOM scalano nitidi sul touch e si stampano.

  FRAME: quello del ROBOT, X crescente verso DESTRA. La spinta si legge da
  sinistra a destra e la battuta sta a destra. Il pezzo misura PIECE.Y lungo X
  e PIECE.X lungo Y: e' la rotazione fra disegno e robot, ed e' la cosa piu'
  utile che questa pagina insegna.

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

        <p class="sim-hint">{{ t("pushSim.noSave") }}</p>
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
          <text
            v-if="exceeds && stopDeclared === null"
            class="lbl-missing"
            :x="g.claw / 2 + g.overhang"
            :y="-g.viceY / 2 - g.line * 6"
            :font-size="g.font"
            text-anchor="middle"
          >?</text>

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
            <text
              class="dim-lbl"
              :x="(g.claw / 2 + stopX) / 2"
              :y="g.viceY / 2 + g.line * 5"
              :font-size="g.font"
              text-anchor="middle"
            >{{ mm(stopDeclared) }}</text>
          </g>

          <!-- quote del pezzo: le due dimensioni, e la rotazione che confonde -->
          <text class="dim-lbl" :x="0" :y="-g.pieceWid / 2 - g.line * 2" :font-size="g.font" text-anchor="middle">
            {{ mm(g.pieceLen) }}
          </text>
          <text
            class="dim-lbl"
            :x="-g.pieceLen / 2 - g.line * 2"
            :y="0"
            :font-size="g.font"
            text-anchor="end"
            dominant-baseline="middle"
          >{{ mm(g.pieceWid) }}</text>

          <!-- verso della X del robot -->
          <line class="axis" :x1="axis.x1" :x2="axis.x2" :y1="axis.y" :y2="axis.y" :stroke-width="g.line" />
          <text class="axis-lbl" :x="axis.x2" :y="axis.y - g.line * 2" :font-size="g.font" text-anchor="end">
            X
          </text>
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
      return [x, -halfH - pad, w, halfH * 2 + pad * 2].map(Math.round).join(" ");
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

    onSelectionChange() {
      const piece = this.pieces.find((p) => p.ID == this.sel.pieceID);
      const vice = this.vices.find((v) => v.ID == this.sel.viceID);
      const grip = this.grippers.find((g) => g.ID == this.sel.gripperID);
      this.real.pieceLen = piece ? Number(piece.Y) / 1000 : null;
      this.real.pieceWid = piece ? Number(piece.X) / 1000 : null;
      this.real.viceClaw = vice && vice.CLAW_LENGTH != null ? Number(vice.CLAW_LENGTH) / 1000 : null;
      this.real.toolClaw = grip && grip.CLAW_LENGTH != null ? Number(grip.CLAW_LENGTH) / 1000 : null;
      this.real.stopBeyond = null;
      this.copyRealToSim();
      this.phase = 0;
      if (this.sel.viceID) this.loadStop();
    },

    // l'appoggio dichiarato vive nella coppia morsa+pezzo
    loadStop() {
      this.get("api/conf/vice/stops/" + this.sel.viceID)
        .then((rows) => {
          const row = (rows || []).find((x) => x.PIECE_ID == this.sel.pieceID) || null;
          this.real.stopBeyond = row ? Number(row.STOP_BEYOND_CLAW) / 1000 : null;
          if (!this.diverged || this.sim.stopBeyond === null) this.sim.stopBeyond = this.real.stopBeyond;
        })
        .catch(console.info);
    },

    copyRealToSim() {
      for (const f of this.fields) this.sim[f.key] = this.real[f.key];
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
</style>
