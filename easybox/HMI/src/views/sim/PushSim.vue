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

  STILE: guscio .view-shell + .conf-card, titolo .view-title, etichette di
  sezione .section-label, bottoni dalle sei varianti canoniche
  (assets/css/buttons.css), colori e spaziature SOLO da token. Niente valori
  inventati qui: la pagina deve sembrare parte dello stesso applicativo.
  DEROGA ANNOTATA (doc UI-DESIGN-SYSTEM §4.2 chiede di annotarle): i tre
  riquadri interni sono di SECONDO livello dentro una .conf-card, quindi
  hanno bordo ma NON l'overlay --bg-card. Tre overlay dentro un overlay
  facevano sembrare la pagina una pila di scatole.
-->
<template>
  <div class="view-shell view-shell--fill conf-card push-sim">
    <div class="view-header">
      <h3 class="view-title">{{ t("pushSim.title") }}</h3>
    </div>

    <p class="sim-intro">{{ t("pushSim.intro") }}</p>

    <div class="sim-layout">
      <!-- ------------------------------------------------ scelta e parametri -->
      <section class="sim-panel sim-box">
        <h3 class="section-label">{{ t("pushSim.choice") }}</h3>

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

        <h3 class="section-label">{{ t("pushSim.measures") }}</h3>
        <p class="sim-hint">{{ canEdit ? t("pushSim.measuresEdit") : t("pushSim.measuresRead") }}</p>

        <!-- In sola lettura i valori sono TESTO, non campi disabilitati: su un
             touch un campo grigio invita comunque a toccarlo. -->
        <div v-for="f in fields" :key="f.key" class="sim-field">
          <label :for="'sim-' + f.key">{{ t(f.label) }}</label>
          <!-- campo, unita' e pulsante sono UN blocco: nella colonna stretta
               vanno a capo insieme, non si separa il "mm" dal numero -->
          <span class="sim-control">
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
              class="btn-ghost sim-save"
              :disabled="saving"
              @click="askSave(f.key)"
            >
              {{ t("pushSim.save") }}
            </button>
          </span>
        </div>

        <!-- (comp-push) la CORSA accanto al campo: sull'ordine in produzione
             e' 3,3 mm, e senza questo riscontro una compensazione da qualche
             decimo si dichiara alla cieca. La corsa NON la tocca: quando c'e'
             una compensazione si dice anche quanto prima si ferma il pezzo. -->
        <p v-if="compPreview.travelMm !== null" class="sim-hint">
          {{ compPreview.comp
             ? t("pushSim.compTravel", { travel: compPreview.travelMm, comp: compPreview.comp / 1000 })
             : t("pushSim.compTravelNone", { travel: compPreview.travelMm }) }}
        </p>

        <!-- senza riga PIECE_ON_VICE la compensazione non ha dove scriversi:
             lo si dice PRIMA di far compilare il campo, non dopo il salvataggio.
             La riga nasce dichiarando l'appoggio: e' quello l'ordine giusto. -->
        <p v-if="compNeedsRow" class="sim-warn">
          {{ t("pushSim.compNoRow") }}
        </p>

        <p v-if="stopDeclaredReal === null && exceeds" class="sim-warn">
          {{ t("pushSim.stopMissing") }}
        </p>

        <div v-if="diverged" class="sim-diverged">
          <strong>{{ t("pushSim.diverged") }}</strong>
          <button type="button" class="btn-ghost" @click="restoreReal">
            {{ t("pushSim.restore") }}
          </button>
        </div>

        <p class="sim-hint">{{ t("pushSim.saveHint") }}</p>
        <div class="sim-links">
          <router-link v-if="sel.viceID" class="btn-ghost" :to="{ path: '/conf/vice', query: { viceID: sel.viceID } }">
            {{ t("pushSim.goVice") }}
          </router-link>
          <router-link v-if="sel.gripperID" class="btn-ghost" :to="{ path: '/conf/Gripper/gripper', query: { gripperID: sel.gripperID } }">
            {{ t("pushSim.goGripper") }}
          </router-link>
          <router-link v-if="sel.pieceID" class="btn-ghost" :to="{ path: '/conf/piece/piece', query: { pieceID: sel.pieceID } }">
            {{ t("pushSim.goPiece") }}
          </router-link>
        </div>
      </section>

      <!-- CONFERMA: nomina l'oggetto FISICO che si sta ridefinendo e dice da
           quale valore a quale. Non e' un "sei sicuro?": chi legge deve poter
           riconoscere l'oggetto che ha davanti. -->
      <div v-if="confirm" class="sim-dialog-overlay" @click.self="confirm = null">
        <div class="sim-dialog" role="dialog" aria-modal="true">
          <h3 class="section-label">{{ t("pushSim.confirmTitle") }}</h3>
          <p class="confirm-what">{{ confirm.text }}</p>
          <p v-if="confirm.warn" class="confirm-warn">{{ confirm.warn }}</p>
          <div class="confirm-buttons">
            <button type="button" class="btn-ghost" @click="confirm = null">
              {{ t("pushSim.cancel") }}
            </button>
            <button type="button" class="pure-button pure-button-primary" :disabled="saving" @click="doSave">
              {{ t("pushSim.confirmSave") }}
            </button>
          </div>
        </div>
      </div>

      <!-- ------------------------------------------------------- il disegno -->
      <section class="sim-stage sim-box">
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
              <rect class="hatch-over-a" width="9000" height="9000" />
              <rect class="hatch-over-b" width="4500" height="9000" />
            </pattern>
            <!-- ingombro spazzato dal pezzo durante la spinta -->
            <pattern id="sweptHatch" width="7000" height="7000" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <rect class="hatch-swept-a" width="7000" height="7000" />
              <rect class="hatch-swept-b" width="3500" height="7000" />
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
            class="swept"
            v-if="ok && g.travel > 0"
            :x="-g.pieceLen / 2"
            :y="-g.pieceWid / 2"
            :width="g.pieceLen + g.travel"
            :height="g.pieceWid"
          />

          <!-- pezzo: base tratteggiata (parte che sporge) + parte sostenuta
               dalla ganascia, ritagliata sulla campata -->
          <g class="moving" :transform="'translate(' + pieceOffset + ' 0)'">
            <rect
              class="piece-over"
              :x="-g.pieceLen / 2"
              :y="-g.pieceWid / 2"
              :width="g.pieceLen"
              :height="g.pieceWid"
              :stroke-width="g.line"
            />
            <rect
              class="piece-in"
              clip-path="url(#jawClip)"
              :x="-g.pieceLen / 2"
              :y="-g.pieceWid / 2"
              :width="g.pieceLen"
              :height="g.pieceWid"
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
            class="btn-ghost phase-btn"
            :class="{ 'phase-active': phase === i }"
            :disabled="!ok"
            @click="goPhase(i)"
          >
            {{ t(lbl) }}
          </button>
          <button type="button" class="pure-button pure-button-primary play-btn" :disabled="!ok" @click="play">
            {{ t("pushSim.play") }}
          </button>
        </div>
      </section>

      <!-- ---------------------------------------------------------- le quote -->
      <aside class="sim-quotes sim-box">
        <h3 class="section-label">{{ t("pushSim.quotes") }}</h3>

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

        <h3 class="section-label">{{ t("pushSim.outcome") }}</h3>
        <p class="sim-status">
          <span class="sim-badge" :class="ok ? 'sim-badge--ok' : 'sim-badge--ko'">
            {{ t("pushSim.status." + check.status) }}
          </span>
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
          <h3 class="section-label">{{ t("pushSim.fromView") }}</h3>
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
      sim: { pieceLen: null, pieceWid: null, viceClaw: null, zClaw: null, zSink: null, toolClaw: null, stopBeyond: null, compPush: null },
      // copia dei valori REALI letti dal database, in millimetri
      real: { pieceLen: null, pieceWid: null, viceClaw: null, zClaw: null, zSink: null, toolClaw: null, stopBeyond: null, compPush: null },
      phase: 0,
      timers: [],
      viewRow: null,
      // riga PIECE_ON_VICE della coppia morsa+pezzo, o null se non esiste
      stopRow: null,
      // conferma in corso: { key, text, warn, run }
      confirm: null,
      saving: false,
      fields: [
        { key: "pieceLen", label: "pushSim.fPieceLen" },
        { key: "pieceWid", label: "pushSim.fPieceWid" },
        // (claw-geometry 18/9) le TRE misure della chela della morsa, una
        // accanto all'altra: quando si sostituiscono le chele cambiano
        // insieme, ed e' per questo che la pagina e' l'unico punto dove
        // impostarle. Solo la lunghezza entra nel calcolo della spinta; le
        // altre due servono al soffiaggio (COORDINATES_BLOW_MC) e non toccano
        // le quote disegnate qui sotto.
        { key: "viceClaw", label: "pushSim.fViceClaw" },
        { key: "zClaw", label: "pushSim.fZClaw" },
        { key: "zSink", label: "pushSim.fZSink" },
        { key: "toolClaw", label: "pushSim.fToolClaw" },
        { key: "stopBeyond", label: "pushSim.fStopBeyond" },
        // (comp-push) compensazione per SEMILAVORATI: accorcia la corsa, il
        // pezzo si ferma prima della battuta. Stessa chiave e stesso
        // salvataggio dell'appoggio dichiarato: segue la morsa, non il pallet.
        { key: "compPush", label: "pushSim.fCompPush" },
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
        compPush: toMicron(this.sim.compPush),
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
        compPush: this.m.compPush,
      });
    },

    // (comp-push) LA CORSA, in millimetri, accanto al campo. E' di pochi
    // millimetri: senza questo riscontro l'operatore dichiara una
    // compensazione alla cieca.
    //
    // (17/9) la compensazione NON entra nella corsa: si sottrae dalla sola
    // quota di arrivo, e quando la supera l'esito e' NO_COMP.
    //
    // La corsa si calcola SENZA compensazione apposta: e' il tetto oltre il
    // quale la spinta si rovescia, ed e' il numero che serve per scegliere il
    // valore. Su NO_COMP le quote di this.check sono NULL — come nella vista —
    // quindi da li' non si potrebbe leggere proprio quando serve di piu'.
    compPreview() {
      const geom = pushQuotes({
        enabled: true,
        hasVice: !!this.sel.viceID,
        xPlace: this.xPlace,
        pieceY: this.m.pieceLen,
        viceClawLength: this.m.viceClaw,
        gripperClawLength: this.m.toolClaw,
        stopBeyondClaw: this.m.stopBeyond,
      });
      return {
        travelMm: geom.clearance === null ? null : geom.clearance / 1000,
        comp: this.m.compPush,
      };
    },

    // la compensazione si scrive su una riga che deve gia' esistere: senza
    // appoggio dichiarato non c'e' riga, e il campo e' inutile finche' non
    // si passa da li'. stopRow e' la riga letta da /stops, non un calcolo.
    compNeedsRow() {
      return !!this.sel.viceID && !!this.sel.pieceID && !this.stopRow;
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
        // per NO_COMP: la corsa GEOMETRICA e la compensazione che la supera
        travel: this.compPreview.travelMm === null ? "-" : this.compPreview.travelMm,
        comp: this.m.compPush === null ? "-" : this.m.compPush / 1000,
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
      // != null copre NULL e undefined: CLAW_LENGTH e' NULL sulle morse mai
      // misurate (la 2 lo e' adesso) e il campo deve restare VUOTO, non
      // mostrare uno zero che sembrerebbe una misura presa
      this.real.viceClaw = vice && vice.CLAW_LENGTH != null ? Number(vice.CLAW_LENGTH) / 1000 : null;
      this.real.zClaw = vice && vice.Z_CLAW != null ? Number(vice.Z_CLAW) / 1000 : null;
      this.real.zSink = vice && vice.Z_SINK_CLAW != null ? Number(vice.Z_SINK_CLAW) / 1000 : null;
      this.real.toolClaw = grip && grip.CLAW_LENGTH != null ? Number(grip.CLAW_LENGTH) / 1000 : null;
    },

    onSelectionChange() {
      this.recomputeReal();
      this.real.stopBeyond = null;
      this.real.compPush = null;
      this.stopRow = null;
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
          // la riga serve anche a sapere se la compensazione ha dove scriversi
          this.stopRow = row;
          this.real.stopBeyond = row ? Number(row.STOP_BEYOND_CLAW) / 1000 : null;
          // COMP_PUSH e' NULL quando non c'e' compensazione: resta null, non
          // diventa zero — il campo deve restare vuoto, non mostrare "0"
          this.real.compPush = row && row.COMP_PUSH !== null && row.COMP_PUSH !== undefined
            ? Number(row.COMP_PUSH) / 1000 : null;
          if (syncSim) {
            this.sim.stopBeyond = this.real.stopBeyond;
            this.sim.compPush = this.real.compPush;
          }
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
      } else if (key === "zClaw") {
        if (now === null || now <= 0) return;
        this.confirm = {
          key,
          text: this.t("pushSim.confirmZClaw", { ...args, obj: this.objName(this.vices, this.sel.viceID, "pushSim.vice") }),
          run: () => this.send("api/conf/vice/setClawHeight", { ID: this.sel.viceID, Z_CLAW: now }),
        };
      } else if (key === "zSink") {
        // lo ZERO e' un valore vero (ganascia piatta), non un dato mancante:
        // qui si rifiuta il VUOTO, non lo zero
        if (now === null || now < 0) return;
        this.confirm = {
          key,
          text: this.t("pushSim.confirmZSink", { ...args, obj: this.objName(this.vices, this.sel.viceID, "pushSim.vice") }),
          run: () => this.send("api/conf/vice/setClawSink", { ID: this.sel.viceID, Z_SINK_CLAW: now }),
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
      } else if (key === "compPush") {
        if (!this.sel.viceID || !this.sel.pieceID) return;
        // senza riga il backend rifiuterebbe: lo si dice qui, senza far
        // partire una richiesta che si sa gia' come finisce
        if (this.compNeedsRow) {
          dataStored.alert.title = this.t("WARNING");
          dataStored.alert.desc = this.t("pushSim.compNoRow");
          dataStored.alert.type = "warning";
          return;
        }
        // qui il vuoto e lo zero vogliono dire la stessa cosa (nessuna
        // compensazione): niente conferma di cancellazione separata come per
        // l'appoggio dichiarato, si scrive NULL e basta.
        this.confirm = {
          key,
          text: this.t(now === null ? "pushSim.confirmCompClear" : "pushSim.confirmComp", {
            ...args,
            obj: this.objName(this.vices, this.sel.viceID, "pushSim.vice"),
            piece: this.objName(this.pieces, this.sel.pieceID, "pushSim.piece"),
          }),
          run: () => this.send("api/conf/vice/setCompPush", {
            VICE_ID: this.sel.viceID, PIECE_ID: this.sel.pieceID,
            COMP_PUSH: now === null ? "" : now,
          }),
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
            // la compensazione ha un motivo suo per non trovare la riga, e
            // soprattutto una via d'uscita precisa: dichiarare prima
            // l'appoggio. Dirlo genericamente lascerebbe l'operatore fermo.
            dataStored.alert.desc = this.t(
              c.key === "compPush" ? "pushSim.compNoRow" : "pushSim.saveNotFound"
            );
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
/* Stile allineato al design system del pannello (docs/UI-DESIGN-SYSTEM.md):
   guscio .view-shell + .conf-card, titolo .view-title, etichette
   .section-label, bottoni dalle sei varianti canoniche. Qui sotto solo cio'
   che e' specifico di questa pagina, e sempre con i token: nessun colore,
   nessuna spaziatura e nessuna dimensione di carattere inventata. */

.push-sim {
  min-height: 0;
  /* La pagina si adatta alla PROPRIA larghezza, non a quella della finestra.
     Conta perche' la barra laterale porta via circa 220 px: con le soglie
     sulla finestra, su un tablet il disegno si schiacciava a pochi pixel
     mentre le due colonne laterali tenevano il loro minimo, e la soglia non
     scattava mai. Verificato misurando la pagina: a 900 px di contenitore la
     colonna del disegno restava larga 114 px. */
  container-type: inline-size;
}

.sim-intro {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

/* UNA colonna di partenza, due e poi tre quando c'e' posto davvero. L'ordine
   e' questo e non il contrario: se le query sul contenitore non fossero
   supportate resta la colonna singola, che e' solo piu' alta ma non rompe
   niente. minmax(0, ...) ovunque e' cio' che permette al disegno di
   RIMPICCIOLIRSI invece di spingere fuori le altre due colonne. */
.sim-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
  /* dentro .view-shell--fill lo scroll sta QUI, come la .table-scroll delle
     view di configurazione: la pagina non scrolla mai da sola */
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* tablet in mano, o cella con la barra laterale aperta */
@container (min-width: 820px) {
  .sim-layout {
    grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
  }
  .sim-quotes {
    grid-column: 1 / -1;
  }
}

/* touch di cella a schermo intero */
@container (min-width: 1280px) {
  .sim-layout {
    grid-template-columns: minmax(0, 22rem) minmax(0, 1fr) minmax(0, 20rem);
  }
  .sim-quotes {
    grid-column: auto;
  }
}

/* DEROGA ANNOTATA (doc §4.2): riquadri di SECONDO livello dentro una
   .conf-card. Tengono il bordo del pattern outlined ma non l'overlay
   --bg-card, altrimenti tre overlay dentro un overlay fanno sembrare la
   pagina una pila di scatole. */
.sim-box {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.sim-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

/* Riga di campo: etichetta, valore, unita', e il salva che compare solo sul
   campo cambiato. Va a capo da sola quando la colonna e' stretta. */
.sim-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.sim-field label {
  flex: 1 1 10rem;
  min-width: 8rem;
  font-size: var(--font-size-sm);
}

/* valore, unita' e pulsante: un blocco solo, allineato a destra */
.sim-control {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
  flex: 0 0 auto;
}

.sim-input,
.sim-field select {
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-base);
  font-family: inherit;
  min-height: 52px;
}

.sim-input {
  width: 7rem;
}

.sim-field select {
  flex: 1 1 12rem;
  min-width: 0;
}

.sim-readonly {
  min-width: 7rem;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.sim-unit {
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

.sim-save {
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
}

/* Avvisi: stessa coppia colore/fondo dei badge di stato delle altre view. */
.sim-warn,
.sim-diverged {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  font-size: var(--font-size-sm);
}

.sim-diverged {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.sim-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* ------------------------------------------------------------- il disegno */
.sim-svg {
  width: 100%;
  height: auto;
  max-height: 60vh;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.vice-body {
  fill: var(--bg-surface-2);
  opacity: 0.55;
}

.jaw {
  fill: var(--border-default);
}

.tool {
  fill: var(--text-secondary);
}

.piece-in {
  fill: var(--accent);
  stroke: var(--text-primary);
}

.piece-over {
  fill: url(#overhangHatch);
  stroke: var(--color-warning);
}

.swept {
  fill: url(#sweptHatch);
}

.hatch-over-a {
  fill: var(--color-warning-bg);
}

.hatch-over-b {
  fill: var(--color-warning-button);
}

.hatch-swept-a {
  fill: var(--bg-surface);
}

.hatch-swept-b {
  fill: var(--bg-surface-2);
}

/* battuta sulla ganascia = esito normale; battuta dichiarata = il caso che
   questa pagina esiste per spiegare, quindi colore diverso e tratteggio */
.stop-claw {
  stroke: var(--color-success);
}

.stop-declared {
  stroke: var(--color-warning);
  stroke-dasharray: 9000 6000;
}

.dim {
  stroke: var(--text-muted);
}

.dim-lbl {
  fill: var(--text-secondary);
}

.lbl-missing {
  fill: var(--color-danger);
  font-weight: var(--font-weight-bold);
}

.axis {
  stroke: var(--text-disabled);
}

.axis-lbl {
  fill: var(--text-muted);
}

/* L'animazione delle tre fasi: la fa il CSS, il componente cambia solo
   l'offset. La corsa e' diversa nei tre casi, quindi le tre situazioni si
   distinguono anche dal movimento. */
.moving {
  transition: transform var(--transition-base), opacity var(--transition-fast);
}

/* Fasi come selettore segmentato (doc §3.4): ghost, la fase corrente piena
   su --accent. */
.sim-phases {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.phase-btn,
.play-btn {
  min-width: 6rem;
}

.phase-active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg-base);
  font-weight: var(--font-weight-semibold);
}

/* -------------------------------------------------------------- le quote */
.quote-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--font-size-sm);
}

.quote-row span {
  color: var(--text-muted);
}

.quote-row strong {
  color: var(--text-primary);
  font-size: var(--font-size-base);
  font-variant-numeric: tabular-nums;
}

.quote-travel strong {
  font-size: var(--font-size-md);
}

.quote-na strong {
  color: var(--text-disabled);
}

.sim-status {
  margin: 0;
}

/* Stesse regole dei badge di stato di Attrezzaggi e selectRig. Sono
   duplicate in piu' view perche' la classe .badge non ha una sede comune:
   discrepanza segnalata, non propagata oltre il necessario. */
.sim-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.sim-badge--ok {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.sim-badge--ko {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.sim-reason,
.sim-rest {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: var(--text-secondary);
}

.sim-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

/* ------------------------------------------------------------- conferma */
/* Stesse regole del dialogo di Attrezzaggi (overlay --bg-backdrop, superficie
   --bg-surface, elevazione 3): anche questo e' duplicato perche' il dialogo
   non ha una sede comune. */
.sim-dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-backdrop);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.sim-dialog {
  background: var(--bg-surface);
  border: var(--border-card);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
  padding: var(--space-4);
  width: min(520px, 92vw);
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.confirm-what {
  margin: 0;
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
  color: var(--text-primary);
}

.confirm-warn {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.confirm-buttons {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
