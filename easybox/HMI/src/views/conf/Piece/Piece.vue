<script setup>
// MODELLO PART PROGRAM (cantiere AG fase 2): il part program e' proprieta'
// del PARTICOLARE — numero di sottoprogramma HAAS inserito a mano qui in
// anagrafica (PIECE.PARTPROGRAM, nchar a DB: trim al load, validazione
// intero positivo max 6 cifre al save, nessun default). L'ordine lo eredita
// alla creazione come snapshot (WORKORDERS.PP_ID, vedi lastData.vue).
// (v3 fase D-bis) RouterLink non serve piu': Annulla e' un UiButton che torna all'elenco
import { dataStored } from "../../../data.js";
import { ref } from "vue";
import UiButton from "../../../components/ui/UiButton.vue";
import UiSegmented from "../../../components/ui/UiSegmented.vue";
// (machines-gating) vincoli "solo per MC..." limitati alle macchine
// configurate; con UNA sola macchina l'intera sezione sparisce (un vincolo
// "solo MC1" con una macchina sola e' ridondante). Le colonne DB restano.
import { MACHINE_POSITIONS, isMachineConfigured } from "../../../util/machineBrands";
const multiMachine = MACHINE_POSITIONS.length > 1;

const el = ref();
</script>

<template>
  <!-- (v3 fase C) conf-v3: titolo, card e bersagli v3 (assets/css/catalog-v3.css).
       (v3 fase D-bis) unita' staccate, forma su UiSegmented, Salva/Annulla
       UiButton. Solo aspetto: campi, disegno, quote evidenziate al focus e
       salvataggio non cambiano; le etichette L/W/H restano (voce aperta in
       LAVORI-IN-CODA, la decide Dario). -->
  <div class="piece-page conf-v3">
    <header class="piece-header">
      <h1 v-if="!createNew">
        {{ $t("piece.welcome") }}
        <span class="piece-id">#{{ piece.ID }}</span>
      </h1>
      <h1 v-else>
        {{ $t("piece.createNew") }}
      </h1>
    </header>

    <div class="piece-card">
      <form class="pure-form pure-form-aligned" @submit.prevent>
        <input type="hidden" name="ID" v-model="piece.ID" />

        <div class="pure-control-group">
          <label for="family">{{ $t("piece.family") }}</label>
          <input
            id="family"
            type="text"
            name="FAMIGLIA"
            v-model="piece.FAMILY"
          />
        </div>

        <div class="pure-control-group">
          <label for="descr">{{ $t("piece.descr") }}</label>
          <input id="descr" type="text" name="DESCR" v-model="piece.DESCR" />
        </div>

        <div class="pure-control-group">
          <label for="partprogram">{{ $t("piece.partProgramLabel") }}</label>
          <input
            id="partprogram"
            type="number"
            name="PARTPROGRAM"
            v-model="piece.PARTPROGRAM"
            min="1"
            max="999999"
            step="1"
          />
        </div>

        <div class="pure-control-group mc-group" v-if="multiMachine">
          <label class="mc-label">

          </label>
          <div class="mc-switches">
            <label class="mc-toggle" v-if="isMachineConfigured(1)">
              <input
                type="checkbox"
                name="MC1_ONLY"
                v-model="piece.MC1_ONLY"
              />
              <span class="mc-track">
                <span class="mc-knob"></span>
              </span>
              <span class="mc-text">{{ $t("piece.MC1_ONLY") }}</span>
            </label>

            <label class="mc-toggle" v-if="isMachineConfigured(2)">
              <input
                type="checkbox"
                name="MC2_ONLY"
                v-model="piece.MC2_ONLY"
              />
              <span class="mc-track">
                <span class="mc-knob"></span>
              </span>
              <span class="mc-text">{{ $t("piece.MC2_ONLY") }}</span>
            </label>

            <label class="mc-toggle" v-if="isMachineConfigured(3)">
              <input
                type="checkbox"
                name="MC3_ONLY"
                v-model="piece.MC3_ONLY"
              />
              <span class="mc-track">
                <span class="mc-knob"></span>
              </span>
              <span class="mc-text">{{ $t("piece.MC3_ONLY") }}</span>
            </label>
          </div>
        </div>

        <div class="piece-main">
          <div class="piece-fields">
            <div class="pure-control-group">
              <label for="z">H</label>
              <input
                id="z"
                type="number"
                name="Z"
                v-model="piece.Z"
                @focus="setActiveDim('H')"
                @blur="setActiveDim(null)"
              />
              <span class="unit">mm</span>
            </div>

            <div class="pure-control-group" v-if="piece.PRISMA">
              <label for="y">W</label>
              <input
                id="y"
                type="number"
                name="Y"
                v-model="piece.Y"
                @focus="setActiveDim('W')"
                @blur="setActiveDim(null)"
              />
              <span class="unit">mm</span>
            </div>

            <div class="pure-control-group">
              <label for="x">{{ piece.PRISMA ? "L" : "D" }}</label>
              <input
                id="x"
                type="number"
                name="X"
                v-model.number="piece.X"
                @focus="setActiveDim('L')"
                @blur="setActiveDim(null)"
              />
              <span class="unit">mm</span>
            </div>

            <!-- (push-to-stop 15/9) SPINTA IN BATTUTA: proprieta' del PEZZO,
                 l'ordine la eredita come istantanea alla creazione (stesso
                 meccanismo del part program). Se attiva, il robot dopo il
                 deposito spinge il pezzo contro la battuta della morsa; le
                 quote le ricava il sistema dalle dimensioni dichiarate. -->
            <div class="pure-control-group push-row">
              <label for="push_to_stop">{{ $t("piece.pushToStop") }}</label>
              <input
                id="push_to_stop"
                type="checkbox"
                name="PUSH_TO_STOP"
                v-model="piece.PUSH_TO_STOP"
              />
              <small class="push-hint">{{ $t("piece.pushToStopHint") }}</small>
            </div>
            <div class="pure-control-group">
              <label for="z_pick">{{ $t("piece.Z_PICK") }}</label>
              <input
                id="z_pick"
                type="number"
                name="Z_PICK"
                v-model="piece.Z_PICK"
                @focus="setActiveDim('ZPICK')"
                @blur="setActiveDim(null)"
              />
              <span class="unit">mm</span>
            </div>

            <div class="pure-control-group">
              <label for="z_place">{{ $t("piece.Z_PLACE") }}</label>
              <input
                id="z_place"
                type="number"
                name="Z_PLACE"
                v-model="piece.Z_PLACE"
                @focus="setActiveDim('ZPLACE')"
                @blur="setActiveDim(null)"
              />
              <span class="unit">mm</span>
            </div>
          </div>

          <div class="piece-svg">
            <!-- forma: selettore a segmenti v3, stessi due valori (false =
                 cilindrica, true = prismatica) -->
            <UiSegmented
              class="shape-toggle"
              :options="[{ value: false, label: $t('piece.CILINDRICO') }, { value: true, label: $t('piece.PRISMATICO') }]"
              :model-value="!!piece.PRISMA"
              @update:model-value="(v) => (piece.PRISMA = v)"
            />

            <!-- Solido istruzioni (campione CubeIcon3D, cantiere AK):
                 geometria REATTIVA alle quote del form (computed prismGeom/
                 cylGeom), quote H/W/L evidenziate al focus, livelli Z
                 prelievo/deposito tratteggiati (dash lungo=prelievo,
                 corto=deposito; fuori pezzo = warning). -->
            <svg v-if="piece.PRISMA" viewBox="0 0 160 120" class="dim-svg">
              <polygon :points="prismFaces.left" class="face-left" />
              <polygon :points="prismFaces.right" class="face-right" />
              <polygon :points="prismFaces.top" class="face-top" />

              <line :x1="prismQuotes.H.x1" :y1="prismQuotes.H.y1" :x2="prismQuotes.H.x2" :y2="prismQuotes.H.y2"
                :class="['dim-line', { active: activeDim === 'H' }]" />
              <text :x="prismQuotes.H.tx" :y="prismQuotes.H.ty" text-anchor="end"
                :class="['dim-text', { active: activeDim === 'H' }]">H</text>

              <line :x1="prismQuotes.W.x1" :y1="prismQuotes.W.y1" :x2="prismQuotes.W.x2" :y2="prismQuotes.W.y2"
                :class="['dim-line', { active: activeDim === 'W' }]" />
              <text :x="prismQuotes.W.tx" :y="prismQuotes.W.ty" text-anchor="middle"
                :class="['dim-text', { active: activeDim === 'W' }]">W</text>

              <line :x1="prismQuotes.L.x1" :y1="prismQuotes.L.y1" :x2="prismQuotes.L.x2" :y2="prismQuotes.L.y2"
                :class="['dim-line', { active: activeDim === 'L' }]" />
              <text :x="prismQuotes.L.tx" :y="prismQuotes.L.ty" text-anchor="middle"
                :class="['dim-text', { active: activeDim === 'L' }]">L</text>

              <template v-for="z in zLevels" :key="z.key">
                <polyline :points="z.points" fill="none"
                  :class="['dim-line', z.dashClass, { active: activeDim === z.key, 'z-over': z.over }]" />
                <line :x1="z.tickX1" :y1="z.tickY" :x2="z.tickX2" :y2="z.tickY"
                  :class="['dim-line', z.dashClass, { active: activeDim === z.key, 'z-over': z.over }]" />
                <text :x="z.tx" :y="z.ty"
                  :class="['dim-text', 'z-text', { active: activeDim === z.key, 'z-over': z.over }]">{{ $t(z.labelKey) }}</text>
              </template>
            </svg>

            <svg v-else viewBox="0 0 160 120" class="dim-svg">
              <path :d="cylBodyPath" class="face-left" />
              <ellipse :cx="cylGeom.cx" :cy="cylGeom.topCy" :rx="cylGeom.rx" :ry="cylGeom.ry" class="face-top" />

              <line :x1="cylQuotes.H.x1" :y1="cylQuotes.H.y1" :x2="cylQuotes.H.x2" :y2="cylQuotes.H.y2"
                :class="['dim-line', { active: activeDim === 'H' }]" />
              <text :x="cylQuotes.H.tx" :y="cylQuotes.H.ty" text-anchor="end"
                :class="['dim-text', { active: activeDim === 'H' }]">H</text>

              <line :x1="cylQuotes.D.x1" :y1="cylQuotes.D.y1" :x2="cylQuotes.D.x2" :y2="cylQuotes.D.y2"
                :class="['dim-line', { active: activeDim === 'L' }]" />
              <text :x="cylQuotes.D.tx" :y="cylQuotes.D.ty" text-anchor="middle"
                :class="['dim-text', { active: activeDim === 'L' }]">D</text>

              <!-- livello Z sul cilindro: un piano orizzontale taglia il
                   cilindro in un'ELLISSE (stessi rx/ry della top), qui
                   tratteggiata; tick ed etichetta dal punto destro -->
              <template v-for="z in zLevels" :key="z.key">
                <ellipse :cx="z.cx" :cy="z.cy" :rx="z.rx" :ry="z.ry" fill="none"
                  :class="['dim-line', z.dashClass, { active: activeDim === z.key, 'z-over': z.over }]" />
                <line :x1="z.tickX1" :y1="z.tickY" :x2="z.tickX2" :y2="z.tickY"
                  :class="['dim-line', z.dashClass, { active: activeDim === z.key, 'z-over': z.over }]" />
                <text :x="z.tx" :y="z.ty"
                  :class="['dim-text', 'z-text', { active: activeDim === z.key, 'z-over': z.over }]">{{ $t(z.labelKey) }}</text>
              </template>
            </svg>
          </div>
        </div>

        <div class="pure-controls piece-actions">
          <UiButton variant="primary" class="piece-save" @click="saveData()">
            {{ $t("Save") }}
          </UiButton>
          <!-- Annulla torna all'elenco dei pezzi, come il link di prima -->
          <UiButton variant="outline" class="piece-cancel" @click="$router.push('/conf/Parts')">
            {{ $t("common.cancel") }}
          </UiButton>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { dataStored } from "../../../data.js";

export default {
  data() {
    return {
      piece: {
        FAMILY: "",
        DESCR: "",
        // (push-to-stop 15/9) spinta in battuta: proprieta' del pezzo
        PUSH_TO_STOP: false,
        PARTPROGRAM: "",
        MC1_ONLY: false,
        MC2_ONLY: false,
        MC3_ONLY: false,
        PRISMA: true,
        X: 0,
        Y: 0,
        Z: 0,
        Z_PICK: 0,
        Z_PLACE: 0,
      },
      createNew: false,
      activeDim: null,
    };
  },
  methods: {
    setActiveDim(dim) {
      this.activeDim = dim;
    },
    getDataTable() {
      if (this.$route.query.pieceID == undefined) {
        this.createNew = true;
        return;
      }
      fetch(
        dataStored.server + "api/conf/piece/show/" + this.$route.query.pieceID,
        { method: "GET" }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          this.piece = data[0];
          this.piece.X /= 1000;
          this.piece.Y /= 1000;
          this.piece.Z /= 1000;
          // (push-to-stop) bit a DB -> booleano per la spunta
          this.piece.PUSH_TO_STOP = !!this.piece.PUSH_TO_STOP;
          this.piece.Z_PICK /= 1000;
          this.piece.Z_PLACE /= 1000;
          // PARTPROGRAM e' nchar a DB: arriva blank-padded, senza trim
          // l'input number mostrerebbe vuoto ma il save rispedirebbe spazi
          this.piece.PARTPROGRAM = (this.piece.PARTPROGRAM || '').toString().trim();
        })
        .catch((error) => {
          console.info(error);
        });
    },
    saveData() {
      let cmd = "";
      // Validazione part program: campo facoltativo (nessun default), ma se
      // valorizzato deve essere un intero positivo max 6 cifre (numero di
      // sottoprogramma HAAS). Ordini senza PP vengono bloccati a valle, in
      // lastData.vue.
      const pp = (this.piece.PARTPROGRAM || '').toString().trim();
      if (pp !== '' && !/^[1-9][0-9]{0,5}$/.test(pp)) {
        dataStored.alert.title = this.$t("WARNING");
        dataStored.alert.desc = this.$t("piece.partProgramInvalid");
        dataStored.alert.type = "warning";
        return;
      }
      this.piece.PARTPROGRAM = pp;
      if (!this.piece.PRISMA) this.piece.Y = this.piece.X;

      // (z-pick 14/9) Z_PICK e Z_PLACE sono QUOTE DAL FONDO del cassetto
      // (vista 4Robot v3: Z = TRAY.Z_CORR + Z_PICK): devono stare fra 0
      // escluso e l'altezza del pezzo inclusa. Zero = chiusura sul fondo,
      // mai corretto per una pinza a ganasce: rifiutato PRIMA di scrivere.
      const hZ = Number(this.piece.Z), zp = Number(this.piece.Z_PICK), zl = Number(this.piece.Z_PLACE);
      if (!(hZ > 0) || !(zp > 0) || zp > hZ || !(zl > 0) || zl > hZ) {
        dataStored.alert.title = this.$t("WARNING");
        dataStored.alert.desc = this.$t("piece.zPickRange", { h: hZ });
        dataStored.alert.type = "warning";
        return;
      }

      // (push-to-stop) il backend converte con CONVERT(bit, ...): 1/0 espliciti
      this.piece.PUSH_TO_STOP = this.piece.PUSH_TO_STOP ? 1 : 0;
      this.piece.X *= 1000;
      this.piece.Y *= 1000;
      this.piece.Z *= 1000;
      this.piece.Z_PICK *= 1000;
      this.piece.Z_PLACE *= 1000;

      if (!this.createNew) {
        cmd =
          dataStored.server +
          "api/conf/piece/updatePiece?" +
          new URLSearchParams(this.piece).toString();
      } else {
        cmd =
          dataStored.server +
          "api/conf/piece/insertPiece?" +
          new URLSearchParams(this.piece).toString();
      }
      fetch(cmd, { method: "GET" })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return this.$router.push("/conf/Parts");
        })
        .catch((error) => {
          console.info(error);
        });
    },
  },
  // ==========================================================================
  // CANTIERE AK — computed del DISEGNO REATTIVO (unica sezione <script>
  // ammessa dal gate): geometria del solido derivata dai soli campi del form
  // (X/Y/Z/Z_PICK/Z_PLACE/PRISMA gia' esistenti), zero nuovi dati, zero API.
  // Linguaggio del campione CubeIcon3D: isometrica cos30/sin30, facce a
  // gerarchia luce, normalizzazione sul massimo.
  // ==========================================================================
  computed: {
    // Quote normalizzate 0..1. Robustezza: campo vuoto/0/NaN -> asse pieno
    // (1.0, il solido di default: MAI collasso a zero); clamp di leggibilita'
    // MIN_RATIO = 0.15 (nessun asse sotto il 15% del massimo: spigoli ed
    // etichette leggibili anche con rapporti estremi tipo 500/50/50).
    drawNorm() {
      const MIN_RATIO = 0.15;
      const num = (v) => {
        const n = parseFloat(v);
        return Number.isFinite(n) && n > 0 ? n : 0;
      };
      const w = num(this.piece.X);
      const d = this.piece.PRISMA ? num(this.piece.Y) : num(this.piece.X);
      const h = num(this.piece.Z);
      const max = Math.max(w, d, h);
      if (max <= 0) return { wn: 1, dn: 1, hn: 1 };
      const clamp = (v) => (v > 0 ? Math.max(v / max, MIN_RATIO) : 1);
      return { wn: clamp(w), dn: clamp(d), hn: clamp(h) };
    },
    // Vertici del prisma isometrico (SCALE 42, viewBox 160x120), centrati
    // via bounding box su (60, 56): destra libera per i livelli Z.
    prismGeom() {
      const { wn, dn, hn } = this.drawNorm;
      const S = 42;
      const wx = wn * S * 0.866, wy = wn * S * 0.5;
      const dx = dn * S * 0.866, dy = dn * S * 0.5;
      const hz = hn * S;
      const rel = {
        front:  { x: 0,       y: 0 },
        right:  { x: wx,      y: -wy },
        back:   { x: wx - dx, y: -wy - dy },
        left:   { x: -dx,     y: -dy },
        frontT: { x: 0,       y: -hz },
        rightT: { x: wx,      y: -wy - hz },
        backT:  { x: wx - dx, y: -wy - dy - hz },
        leftT:  { x: -dx,     y: -dy - hz },
      };
      const xs = Object.values(rel).map((p) => p.x);
      const ys = Object.values(rel).map((p) => p.y);
      const ox = 60 - (Math.min(...xs) + Math.max(...xs)) / 2;
      const oy = 56 - (Math.min(...ys) + Math.max(...ys)) / 2;
      const v = {};
      for (const [k, p] of Object.entries(rel))
        v[k] = { x: +(p.x + ox).toFixed(1), y: +(p.y + oy).toFixed(1) };
      return v;
    },
    prismFaces() {
      const p = this.prismGeom;
      const pts = (...ks) => ks.map((k) => p[k].x + ',' + p[k].y).join(' ');
      return {
        left:  pts('frontT', 'leftT', 'left', 'front'),
        right: pts('frontT', 'rightT', 'right', 'front'),
        top:   pts('frontT', 'rightT', 'backT', 'leftT'),
      };
    },
    // Quote H (spigolo verticale sinistro), W e L (spigoli di base),
    // parallele e staccate dal solido.
    prismQuotes() {
      const p = this.prismGeom;
      return {
        H: { x1: p.left.x - 8, y1: p.leftT.y, x2: p.left.x - 8, y2: p.left.y,
             tx: p.left.x - 11, ty: +(((p.leftT.y + p.left.y) / 2) + 3).toFixed(1) },
        W: { x1: p.front.x - 3, y1: p.front.y + 7, x2: p.left.x - 3, y2: p.left.y + 7,
             tx: +(((p.front.x + p.left.x) / 2) - 4).toFixed(1), ty: +(((p.front.y + p.left.y) / 2) + 18).toFixed(1) },
        L: { x1: p.front.x + 3, y1: p.front.y + 7, x2: p.right.x + 3, y2: p.right.y + 7,
             tx: +(((p.front.x + p.right.x) / 2) + 4).toFixed(1), ty: +(((p.front.y + p.right.y) / 2) + 18).toFixed(1) },
      };
    },
    // Cilindro come il campione: body path chiuso + ellisse top, centrato su
    // (60, 56); D = diametro dal campo X.
    cylGeom() {
      const { wn, hn } = this.drawNorm;
      const S = 42;
      const rx = +(wn * S * 0.75).toFixed(1);
      const ry = +(rx * 0.4).toFixed(1);
      const hz = hn * S * 1.3;
      return { cx: 60, rx, ry, topCy: +(56 - hz / 2).toFixed(1), botCy: +(56 + hz / 2).toFixed(1) };
    },
    cylBodyPath() {
      const c = this.cylGeom;
      return 'M ' + (c.cx - c.rx) + ' ' + c.topCy +
             ' L ' + (c.cx - c.rx) + ' ' + c.botCy +
             ' A ' + c.rx + ' ' + c.ry + ' 0 0 0 ' + (c.cx + c.rx) + ' ' + c.botCy +
             ' L ' + (c.cx + c.rx) + ' ' + c.topCy +
             ' A ' + c.rx + ' ' + c.ry + ' 0 0 1 ' + (c.cx - c.rx) + ' ' + c.topCy + ' Z';
    },
    cylQuotes() {
      const c = this.cylGeom;
      return {
        H: { x1: c.cx - c.rx - 10, y1: c.topCy, x2: c.cx - c.rx - 10, y2: c.botCy,
             tx: c.cx - c.rx - 13, ty: +(((c.topCy + c.botCy) / 2) + 3).toFixed(1) },
        D: { x1: c.cx - c.rx, y1: +(c.topCy - c.ry - 8).toFixed(1), x2: c.cx + c.rx, y2: +(c.topCy - c.ry - 8).toFixed(1),
             tx: c.cx, ty: +(c.topCy - c.ry - 11).toFixed(1) },
      };
    },
    // Livelli Z prelievo/deposito: frazione z/H proiettata sull'altezza del
    // solido. Z assente o 0 -> livello non disegnato. Z > H -> linea resa al
    // TOP del solido in stato 'z-over' (warning): l'operatore vede subito la
    // quota fuori pezzo, nessun errore silenzioso. Dash lungo = prelievo,
    // dash corto = deposito (distinguibili a colpo d'occhio, palette dim).
    zLevels() {
      const H = parseFloat(this.piece.Z);
      const mk = (raw, key, labelKey, dashClass) => {
        const z = parseFloat(raw);
        if (!Number.isFinite(z) || z <= 0 || !Number.isFinite(H) || H <= 0) return null;
        const over = z > H;
        const f = over ? 1 : z / H;
        if (this.piece.PRISMA) {
          const p = this.prismGeom;
          const hz = p.front.y - p.frontT.y;
          const lift = (pt) => ({ x: pt.x, y: +(pt.y - f * hz).toFixed(1) });
          const a = lift(p.left), b = lift(p.front), c = lift(p.right);
          return { key, labelKey, dashClass, over,
                   points: a.x + ',' + a.y + ' ' + b.x + ',' + b.y + ' ' + c.x + ',' + c.y,
                   tickX1: c.x, tickX2: 128, tickY: c.y, tx: 130, ty: +(c.y + 3).toFixed(1) };
        }
        const c = this.cylGeom;
        const y = +(c.botCy - f * (c.botCy - c.topCy)).toFixed(1);
        // ellisse di livello (cantiere AK-BIS): il piano orizzontale taglia
        // il cilindro in un'ellisse con gli stessi rx/ry della top, centrata
        // su cx alla quota y; tick/etichetta dal punto destro (cx+rx, y)
        return { key, labelKey, dashClass, over,
                 cx: c.cx, cy: y, rx: c.rx, ry: c.ry,
                 tickX1: c.cx + c.rx, tickX2: 128, tickY: y, tx: 130, ty: +(y + 3).toFixed(1) };
      };
      return [
        mk(this.piece.Z_PICK,  'ZPICK',  'piece.zPickShort',  'z-dash-pick'),
        mk(this.piece.Z_PLACE, 'ZPLACE', 'piece.zPlaceShort', 'z-dash-place'),
      ].filter(Boolean);
    },
  },
  mounted() {
    this.getDataTable();
  },
};
</script>

<style scoped>
/* Cantiere AJ (style-only): blocco riscritto sul design system — era una
   mini-palette Tailwind hardcoded (~25 font px, ~69 colori), debito censito
   in P3. Deroghe annotate inline; layout (larghezze colonne form) invariato.
   (v3 fase D-bis) titolo, card e campi a 48 px da catalog-v3.css (.conf-v3);
   qui unita', interruttori MC a 48, forma e pulsanti v3. */
.piece-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  color: var(--text-primary);
}

.piece-header {
  margin: var(--space-1) 0 0; /* micro-aggiustamento ottico consentito */
}

.piece-header h1 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.03em;
  color: var(--text-primary);
  margin: 0;
}

.piece-id {
  margin-left: var(--space-2);
  color: var(--accent);
  font-weight: var(--font-weight-medium);
}

/* contenitore form: pattern outlined (doc §4.1) */
.piece-card {
  width: 100%;
  max-width: 1150px;
  margin: var(--space-2) 0 var(--space-6);
  background: var(--bg-card);
  border: var(--border-card);
  border-radius: var(--radius-md);
  padding: var(--space-5);
}

.pure-form-aligned .pure-control-group {
  display: flex;
  align-items: center;
  margin: var(--space-2) 0;
}

.pure-form-aligned .pure-control-group label {
  width: 170px;               /* larghezza colonna label: layout, non estetica */
  margin-right: var(--space-4);
  text-align: right;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.pure-form-aligned .pure-control-group input[type="text"],
.pure-form-aligned .pure-control-group input[type="number"] {
  width: 280px;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  min-height: 44px;           /* touch: deroga 44 per campi form */
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.pure-form-aligned .pure-control-group input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

/* unita' staccata dal campo (.conf-v3 .unit, catalog-v3.css); qui resta solo
   il suggerimento sotto la spunta della spinta */
.pure-form-aligned .pure-control-group small {
  margin-left: var(--space-2);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: var(--text-secondary);
}

/* riga MC centrata: toggle e label colonna sulla stessa mediana */
.mc-group {
  align-items: center;
}

.pure-form-aligned .pure-control-group label.mc-label {
  width: 170px;                /* stessa colonna delle altre label (vince sul 13em globale) */
  margin-right: var(--space-4);
  text-align: right;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  padding-top: 0;
}

/* toggle+label = unita' visiva: riga centrata, gap uniforme tra i tre
   gruppi, track indeformabile e testo senza min-width fantasma */
.mc-switches {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  flex-wrap: wrap;
}

/* CAUSA VERA dei toggle sfasati (terza iterazione): pure.css:702
   '.pure-form-aligned .pure-control-group label' (specificity 0-3-1) impone
   display:inline-block + vertical-align:middle + width:10em (e App.vue
   globale width:13em) a TUTTE le label del gruppo — i selettori corti
   .mc-toggle/.mc-label (scoped, 0-2-0) PERDEVANO la cascata: il flex non si
   e' mai attivato a schermo (track su baseline inline = flottante alto,
   label strizzata a 13em). Selettori rinforzati a 0-4-1 per vincere. */
.pure-form-aligned .pure-control-group label.mc-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: auto;                 /* annulla il 10em/13em ereditato */
  margin: 0;
  text-align: left;
  min-height: var(--touch-target-min); /* touch v3: l'intera label e' il target */
  font-size: var(--font-size-base);
  line-height: var(--line-height-tight);
  color: var(--text-primary);
  cursor: pointer;
}

.mc-toggle input {
  display: none;
}

/* switch fisico: pill per natura del CONTROLLO (non variante bottone) */
.mc-track {
  flex-shrink: 0;              /* il track non si deforma mai */
  width: 42px;
  height: 20px;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  padding: 2px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.mc-knob {
  width: 14px;
  height: 14px;
  border-radius: var(--radius-pill);
  background: var(--text-primary);
  transition: transform var(--transition-fast);
}

.mc-toggle input:checked + .mc-track {
  background: var(--accent);
  border-color: var(--accent);
}

.mc-toggle input:checked + .mc-track .mc-knob {
  transform: translateX(20px);
}

.mc-text {
  white-space: nowrap;         /* niente min-width fantasma: gap uniformi reali */
}

.piece-main {
  display: flex;
  align-items: flex-start;
  gap: var(--space-6);
  margin-top: var(--space-8);
}

.piece-fields {
  flex: 1.6;
}

.piece-svg {
  flex: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

/* forma del pezzo: UiSegmented (segmenti da 48, il scelto su
   --bg-segment-on), come i selettori a segmenti delle altre pagine v3 */

.dim-svg {
  width: 240px;                /* viewBox 160x120 (4:3): spazio per quote e livelli Z */
  height: 180px;
}

/* solido istruzioni: STESSO linguaggio del campione CubeIcon3D —
   facce con gerarchia luce (top chiara / right media / left ombra),
   stroke text-secondary width 1, giunzioni round.
   Stroke/font in unita' del viewBox (120), non px schermo. */
.face-top,
.face-right,
.face-left {
  stroke: var(--text-secondary);
  stroke-width: 1;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.face-top {
  fill: var(--bg-surface-2);
}

.face-right {
  fill: var(--bg-input);
}

.face-left {
  fill: var(--bg-base);
}

.dim-line {
  stroke: var(--text-muted);
  stroke-width: 2;
}

.dim-text {
  font-size: 10px;             /* unita' viewBox SVG, non px schermo */
  fill: var(--text-muted);
  font-weight: var(--font-weight-medium);
}

.dim-line.active {
  stroke: var(--accent);
  stroke-width: 3;
}

.dim-text.active {
  fill: var(--accent);
  font-weight: var(--font-weight-bold);
}

/* livelli Z: dash lungo = prelievo, corto = deposito */
.z-dash-pick {
  stroke-dasharray: 6 3;
}

.z-dash-place {
  stroke-dasharray: 2 3;
}

.z-text {
  font-size: 8px;              /* unita' viewBox SVG, non px schermo */
}

/* Z fuori pezzo (Z > H): warning, vince anche sul focus (l'anomalia ha
   priorita' sull'evidenziazione) */
.dim-line.z-over {
  stroke: var(--color-warning-fg);
}

.dim-text.z-over {
  fill: var(--color-warning-fg);
}

.piece-actions {
  margin-top: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

/* (v3 fase D-bis) Salva e Annulla sono UiButton (primary e outline, 56 px):
   altezza, colori e stato li da' il componente. Resta solo la larghezza
   minima comune, perche' i due gemelli non si distinguano per la lunghezza
   del testo. */
.piece-actions .piece-save,
.piece-actions .piece-cancel {
  min-width: 140px;
}
</style>
