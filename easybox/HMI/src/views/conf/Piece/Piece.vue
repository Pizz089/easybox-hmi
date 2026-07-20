<script setup>
// MODELLO PART PROGRAM (cantiere AG fase 2): il part program e' proprieta'
// del PARTICOLARE — numero di sottoprogramma HAAS inserito a mano qui in
// anagrafica (PIECE.PARTPROGRAM, nchar a DB: trim al load, validazione
// intero positivo max 6 cifre al save, nessun default). L'ordine lo eredita
// alla creazione come snapshot (WORKORDERS.PP_ID, vedi lastData.vue).
import { RouterLink } from "vue-router";
import { dataStored } from "../../../data.js";
import { ref } from "vue";

const el = ref();
</script>

<template>
  <div class="piece-page">
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

        <div class="pure-control-group mc-group">
          <label class="mc-label">

          </label>
          <div class="mc-switches">
            <label class="mc-toggle">
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

            <label class="mc-toggle">
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

            <label class="mc-toggle">
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
              <small>mm</small>
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
              <small>mm</small>
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
              <small>mm</small>
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
              <small>mm</small>
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
              <small>mm</small>
            </div>
          </div>

          <div class="piece-svg">
            <div class="shape-toggle">
              <span
                class="shape-pill"
                :class="{ active: !piece.PRISMA }"
                @click="piece.PRISMA = false"
              >
                {{ $t("piece.CILINDRICO") }}
              </span>
              <span
                class="shape-pill"
                :class="{ active: piece.PRISMA }"
                @click="piece.PRISMA = true"
              >
                {{ $t("piece.PRISMATICO") }}
              </span>
            </div>

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
          <button type="button" class="piece-save" @click="saveData()">
            {{ $t("Save") }}
          </button>
          <RouterLink class="piece-cancel" to="/conf/Parts">
            {{ $t("common.cancel") }}
          </RouterLink>
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
   in P3. Deroghe annotate inline; layout (larghezze colonne form) invariato. */
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

.pure-form-aligned .pure-control-group small {
  margin-left: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--text-muted);
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
  min-height: 44px;            /* touch: l'intera label e' il target */
  font-size: var(--font-size-sm);
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
  background: var(--color-success);
  border-color: var(--color-success);
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

/* segmented control forma pezzo: selezione attiva = accent (stesso pattern
   .selected dei dialog / .active dello speed selector); squadrato, non pill
   (pill riservata a critical, doc §7) */
.shape-toggle {
  display: inline-flex;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 2px;
  gap: 2px;
}

.shape-pill {
  padding: var(--space-2) var(--space-4);
  min-height: 44px;            /* touch: deroga 44 per segmented control */
  display: inline-flex;
  align-items: center;
  font-size: var(--font-size-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-secondary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.shape-pill.active {
  background: var(--accent);
  color: var(--bg-base);
  font-weight: var(--font-weight-semibold);
}

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
  stroke: var(--color-warning);
}

.dim-text.z-over {
  fill: var(--color-warning);
}

.piece-actions {
  margin-top: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

/* Bottoni azione GEMELLI (regola pill: azione = --radius-btn 999px).
   Metrica identica imposta su button E RouterLink: height FISSA 52 (non
   min-height: il reset pure.css da' al button line-height 1.15 e box model
   diverso dall'<a>, min-height+padding verticale producevano taglie
   diverse), stesso box-sizing, stesso padding orizzontale, inline-flex
   centrato per entrambi. */
/* GEMELLI TOTALI (cantiere AK-BIS): oltre alla metrica fissa di a888df6
   (che gia' vinceva la cascata: le sole regole globali matchanti sono i
   reset element-level 0-0-1 di pure.css 'button' ed email/theme 'a'),
   min-width CONDIVISA 140px: copre la label piu' lunga nelle due lingue
   ("Annulla"/"Cancel" a font 16 medium + padding 48 ~ 115px) cosi' nemmeno
   la lunghezza del testo differenzia i due bottoni. Selettore rinforzato
   col metodo dei toggle (prevenzione: vince anche su eventuali regole
   future .pure-form/.pure-controls a specificity piu' alta). */
.pure-form .pure-controls .piece-save,
.pure-form .pure-controls .piece-cancel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 52px;
  min-width: 140px;
  padding: 0 var(--space-5);
  margin: 0;
  border-radius: var(--radius-btn);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  font-family: inherit;
  line-height: 1;
  letter-spacing: 0.025em;
  text-decoration: none;
  cursor: pointer;
}

/* Save: Primary pill */
.piece-save {
  background: var(--accent);
  color: var(--text-primary);
  border: 0;
  transition: filter var(--transition-fast);
}

.piece-save:hover {
  filter: brightness(1.12);
}

/* Annulla: Ghost pill */
.piece-cancel {
  background: transparent;
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.piece-cancel:hover {
  background: var(--bg-surface);
  border-color: var(--border-strong);
  color: var(--text-primary);
  text-decoration: none;
}
</style>





<!--vecchio piece-->
<!--script setup>
import { RouterLink } from "vue-router";
import { dataStored } from "../../../data.js";
import { ref } from "vue";

const el = ref();
</script-->

<!--template>
  <div class="piece-page">
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
          <label for="partprogram">PART PROGRAM</label>
          <input
            id="partprogram"
            type="number"
            name="PARTPROGRAM"
            v-model="piece.PARTPROGRAM"
            placeholder="0"
          />
        </div>

        <div class="pure-control-group mc-group">
          <label class="mc-label">
            {{ $t("piece.onlyFor") || "Solo per" }}
          </label>
          <div class="mc-switches">
            <label>
              {{ $t("piece.MC1_ONLY") }}
              <input type="checkbox" name="MC1_ONLY" v-model="piece.MC1_ONLY" />
            </label>
            <label>
              {{ $t("piece.MC2_ONLY") }}
              <input type="checkbox" name="MC2_ONLY" v-model="piece.MC2_ONLY" />
            </label>
            <label>
              {{ $t("piece.MC3_ONLY") }}
              <input type="checkbox" name="MC3_ONLY" v-model="piece.MC3_ONLY" />
            </label>
          </div>
        </div>

        <div class="pure-control-group">
          <label>{{ $t("piece.Forma") || "Forma" }}</label>
          <div class="shape-toggle">
            <span
              class="shape-pill"
              :class="{ active: !piece.PRISMA }"
              @click="piece.PRISMA = false"
            >
              {{ $t("piece.CILINDRICO") }}
            </span>
            <span
              class="shape-pill"
              :class="{ active: piece.PRISMA }"
              @click="piece.PRISMA = true"
            >
              {{ $t("piece.PRISMATICO") }}
            </span>
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
              <small>mm</small>
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
              <small>mm</small>
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
              <small>mm</small>
            </div>

            <div class="pure-control-group">
              <label for="z_pick">{{ $t("piece.Z_PICK") }}</label>
              <input
                id="z_pick"
                type="number"
                name="Z_PICK"
                v-model="piece.Z_PICK"
              />
              <small>mm</small>
            </div>

            <div class="pure-control-group">
              <label for="z_place">{{ $t("piece.Z_PLACE") }}</label>
              <input
                id="z_place"
                type="number"
                name="Z_PLACE"
                v-model="piece.Z_PLACE"
              />
              <small>mm</small>
            </div>
          </div>

          <div class="piece-svg">
            <svg v-if="piece.PRISMA" viewBox="0 0 120 120" class="dim-svg">
              <rect x="20" y="40" width="50" height="40" class="cube-face" />
              <polyline
                points="20,40 40,25 90,25 70,40 20,40"
                class="cube-edge"
              />
              <polyline points="70,40 70,80 90,65 90,25" class="cube-edge" />
              <polyline points="20,80 70,80 90,65" class="cube-edge" />

              <line
                x1="20"
                y1="40"
                x2="20"
                y2="80"
                :class="['dim-line', { active: activeDim === 'H' }]"
              />
              <text
                x="8"
                y="65"
                :class="['dim-text', { active: activeDim === 'H' }]"
              >
                H
              </text>

              <line
                x1="20"
                y1="80"
                x2="70"
                y2="80"
                :class="['dim-line', { active: activeDim === 'W' }]"
              />
              <text
                x="40"
                y="98"
                :class="['dim-text', { active: activeDim === 'W' }]"
              >
                W
              </text>

              <line
                x1="70"
                y1="80"
                x2="90"
                y2="65"
                :class="['dim-line', { active: activeDim === 'L' }]"
              />
              <text
                x="92"
                y="60"
                :class="['dim-text', { active: activeDim === 'L' }]"
              >
                L
              </text>
            </svg>

            <svg v-else viewBox="0 0 120 120" class="dim-svg">
              <ellipse cx="45" cy="35" rx="20" ry="8" class="cube-face" />
              <line x1="25" y1="35" x2="25" y2="75" class="cube-edge" />
              <line x1="65" y1="35" x2="65" y2="75" class="cube-edge" />
              <ellipse cx="45" cy="75" rx="20" ry="8" class="cube-edge" />

              
              <line
                x1="80"
                y1="35"
                x2="80"
                y2="75"
                :class="['dim-line', { active: activeDim === 'H' }]"
              />
              <text
                x="76"
                y="30"
                :class="['dim-text', { active: activeDim === 'H' }]"
              >
                H
              </text>

              
              <line
                x1="25"
                y1="20"
                x2="65"
                y2="20"
                :class="['dim-line', { active: activeDim === 'L' }]"
              />
              <text
                x="42"
                y="14"
                :class="['dim-text', { active: activeDim === 'L' }]"
              >
                D
              </text>
            </svg>
          </div>
        </div>

        <div class="pure-controls piece-actions">
          <button type="button" class="piece-save" @click="saveData()">
            Save
          </button>
          <RouterLink class="piece-cancel" to="/conf/Parts">
            {{
              $t("common.cancel") === "common.cancel"
                ? "Cancel"
                : $t("common.cancel")
            }}
          </RouterLink>
        </div>
      </form>
    </div>
  </div>
</template-->

<!--script>
import { dataStored } from "../../../data.js";

export default {
  data() {
    return {
      piece: {
        FAMILY: "",
        DESCR: "",
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
          this.piece.Z_PICK /= 1000;
          this.piece.Z_PLACE /= 1000;
        })
        .catch((error) => {
          console.info(error);
        });
    },
    saveData() {
      let cmd = "";
      if (!this.piece.PRISMA) this.piece.Y = this.piece.X;

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
  mounted() {
    this.getDataTable();
  },
};
</script-->

<!--style scoped>
.piece-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #e5e7eb;
}

.piece-header {
  margin: 4px 0 0;
}

.piece-header h1 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: #e5e7eb;
  margin: 0;
}

.piece-id {
  margin-left: 6px;
  color: #38bdf8;
  font-weight: 500;
}

.piece-card {
  width: 100%;
  max-width: 1150px;
  margin: 8px 0 32px;
  background: rgba(9, 9, 11, 0.97);
  border-radius: 16px;
  padding: 20px 26px 24px;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(63, 63, 70, 0.9);
}

.pure-form-aligned .pure-control-group {
  display: flex;
  align-items: center;
  margin: 8px 0;
}

.pure-form-aligned .pure-control-group label {
  width: 170px;
  margin-right: 12px;
  text-align: right;
  font-size: 12px;
  color: #9ca3af;
}

.pure-form-aligned .pure-control-group input[type="text"],
.pure-form-aligned .pure-control-group input[type="number"] {
  width: 280px;
  padding: 6px 9px;
  border-radius: 8px;
  border: 1px solid rgba(75, 85, 99, 0.9);
  background: #020817;
  color: #e5e7eb;
  font-size: 12px;
  outline: none;
  transition: all 0.18s ease-out;
}

.pure-form-aligned .pure-control-group input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25);
}

.pure-form-aligned .pure-control-group small {
  margin-left: 6px;
  font-size: 10px;
  color: #6b7280;
}

.mc-group {
  align-items: flex-start;
}

.mc-label {
  width: 170px;
  margin-right: 12px;
  text-align: right;
  font-size: 12px;
  color: #9ca3af;
  padding-top: 6px;
}

.mc-switches {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.mc-switches label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #e5e7eb;
}

.shape-toggle {
  display: inline-flex;
  background: #020817;
  border-radius: 999px;
  padding: 2px;
  gap: 2px;
  border: 1px solid rgba(75, 85, 99, 0.9);
}

.shape-pill {
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 999px;
  cursor: pointer;
  color: #9ca3af;
  transition: all 0.18s ease-out;
}

.shape-pill.active {
  background: #22c55e;
  color: #020817;
  font-weight: 600;
}

.piece-main {
  display: flex;
  align-items: flex-start;
  gap: 40px;
  margin-top: 10px;
}

.piece-fields {
  flex: 1.6;
}

.piece-svg {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.dim-svg {
  width: 160px;
  height: 160px;
}

.cube-face {
  fill: rgba(15, 23, 42, 0.9);
  stroke: rgba(75, 85, 99, 0.9);
  stroke-width: 1;
}

.cube-edge {
  fill: none;
  stroke: rgba(107, 114, 128, 0.9);
  stroke-width: 1;
}

.dim-line {
  stroke: rgba(148, 163, 253, 0.7);
  stroke-width: 2;
}

.dim-text {
  font-size: 10px;
  fill: rgba(148, 163, 253, 0.7);
  font-weight: 500;
}

.dim-line.active {
  stroke: #38bdf8;
  stroke-width: 3;
}

.dim-text.active {
  fill: #38bdf8;
  font-weight: 700;
}

.piece-actions {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.piece-save {
  background: #38bdf8;
  border-radius: 8px;
  padding: 7px 18px;
  border: none;
  color: #020817;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease-out;
}

.piece-save:hover {
  background: #0ea5e9;
  box-shadow: 0 4px 12px rgba(56, 189, 248, 0.35);
}

.piece-cancel {
  font-size: 11px;
  color: #9ca3af;
  text-decoration: none;
}

.piece-cancel:hover {
  color: #e5e7eb;
  text-decoration: underline;
}
</style-->
