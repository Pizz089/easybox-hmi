<script setup>
import { computed } from 'vue'

const props = defineProps({
  w: { type: [Number, String], default: 1 },     // larghezza (X)
  d: { type: [Number, String], default: 1 },     // profondita' (Y)
  h: { type: [Number, String], default: 1 },     // altezza (Z)
  prisma: { type: Boolean, default: true },      // true=cubo, false=cilindro
  bgMode: { type: Boolean, default: false },     // true=watermark background della card
})

// Normalizza al max dim per fit nel viewBox 80x80.
// Math dimensionless: i valori assoluti (mm, micron, ecc.) sono irrilevanti.
const maxDim = computed(() => Math.max(+props.w || 1, +props.d || 1, +props.h || 1))
const wn = computed(() => (+props.w || 1) / maxDim.value)
const dn = computed(() => (+props.d || 1) / maxDim.value)
const hn = computed(() => (+props.h || 1) / maxDim.value)

// Isometric: cos(30deg)=0.866, sin(30deg)=0.5. SCALE=30 -> max dim = 30 unit.
const SCALE = 30

// 8 vertici cubo (4 base + 4 top), centrati dinamicamente nel viewBox
// 80x80 via bounding box (centro a 40, 40). Garantisce centratura
// indipendente dalle proporzioni w/d/h.
const v = computed(() => {
  const wx = wn.value * SCALE * 0.866
  const wy = wn.value * SCALE * 0.5
  const dx = dn.value * SCALE * 0.866
  const dy = dn.value * SCALE * 0.5
  const hz = hn.value * SCALE

  // Vertici RELATIVI a origin (0, 0) front-bottom
  const rel = {
    front:  { x: 0,        y: 0 },
    right:  { x: wx,       y: -wy },
    back:   { x: wx - dx,  y: -wy - dy },
    left:   { x: -dx,      y: -dy },
    frontT: { x: 0,        y: -hz },
    rightT: { x: wx,       y: -wy - hz },
    backT:  { x: wx - dx,  y: -wy - dy - hz },
    leftT:  { x: -dx,      y: -dy - hz },
  }

  // Bounding box e offset per centrare bbox in (40, 40) del viewBox
  const xs = Object.values(rel).map(p => p.x)
  const ys = Object.values(rel).map(p => p.y)
  const ox = 40 - (Math.min(...xs) + Math.max(...xs)) / 2
  const oy = 40 - (Math.min(...ys) + Math.max(...ys)) / 2

  const result = {}
  for (const [k, p] of Object.entries(rel)) {
    result[k] = { x: p.x + ox, y: p.y + oy }
  }
  return result
})

// 3 facce visibili del cubo
const topFace = computed(() => {
  const p = v.value
  return `${p.frontT.x},${p.frontT.y} ${p.rightT.x},${p.rightT.y} ${p.backT.x},${p.backT.y} ${p.leftT.x},${p.leftT.y}`
})
const rightFace = computed(() => {
  const p = v.value
  return `${p.frontT.x},${p.frontT.y} ${p.rightT.x},${p.rightT.y} ${p.right.x},${p.right.y} ${p.front.x},${p.front.y}`
})
const leftFace = computed(() => {
  const p = v.value
  return `${p.frontT.x},${p.frontT.y} ${p.leftT.x},${p.leftT.y} ${p.left.x},${p.left.y} ${p.front.x},${p.front.y}`
})

// Cilindro: usa wn (raggio) + hn (altezza), ignora dn.
// Body centrato verticalmente in y=40 del viewBox.
const cylinder = computed(() => {
  const rx = wn.value * SCALE * 0.6
  const ry = rx * 0.4
  const hz = hn.value * SCALE
  return {
    topCx: 40, topCy: 40 - hz / 2,
    botCx: 40, botCy: 40 + hz / 2,
    rx, ry,
  }
})
</script>

<template>
  <svg
    viewBox="0 0 80 80"
    :class="['cube-icon', { 'bg-mode': bgMode }]"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  >
    <!-- PRISMA: 3 facce visibili (top piu' chiara, right mid, left scuro = ombra) -->
    <g v-if="prisma">
      <polygon :points="leftFace" class="face-left" />
      <polygon :points="rightFace" class="face-right" />
      <polygon :points="topFace" class="face-top" />
    </g>

    <!-- CILINDRO: body chiuso (no rect+arc separati, niente bordi flat artefatti)
         + top ellipse sovrapposta per effetto "luce dall'alto". -->
    <g v-else>
      <!-- Body: path chiuso (bordo sx + arc bottom front + bordo dx + arc top back).
           Usa face-left (bg-base scuro) per contrasto con top ellipse chiara:
           stesso pattern visivo del cubo (left = ombra). -->
      <path
        :d="`M ${cylinder.topCx - cylinder.rx} ${cylinder.topCy}
             L ${cylinder.topCx - cylinder.rx} ${cylinder.botCy}
             A ${cylinder.rx} ${cylinder.ry} 0 0 0 ${cylinder.topCx + cylinder.rx} ${cylinder.botCy}
             L ${cylinder.topCx + cylinder.rx} ${cylinder.topCy}
             A ${cylinder.rx} ${cylinder.ry} 0 0 1 ${cylinder.topCx - cylinder.rx} ${cylinder.topCy}
             Z`"
        class="face-left"
      />
      <!-- Top ellipse (sopra il body, riempie con face-top piu' chiaro) -->
      <ellipse
        :cx="cylinder.topCx"
        :cy="cylinder.topCy"
        :rx="cylinder.rx"
        :ry="cylinder.ry"
        class="face-top"
      />
    </g>
  </svg>
</template>

<style scoped>
.cube-icon {
  width: 80px;
  height: 80px;
  display: block;
}

/* Background mode: cubo fill 100% della card parent, opacity ridotta,
   non clickabile, z-index 0 sotto il testo container. */
.cube-icon.bg-mode {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.4;
  pointer-events: none;
  z-index: 0;
}

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
</style>
