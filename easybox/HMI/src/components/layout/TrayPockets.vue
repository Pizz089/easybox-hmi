<!-- ==========================================================================
     TrayPockets.vue — la griglia delle tasche di un cassetto

     Era il corpo del disegno dentro layoutView, inline. Il dialog "Reimposta
     stato cella" deve far CLICCARE la tasca da correggere (comando 39): senza
     estrarlo, la stessa griglia sarebbe stata ridisegnata una seconda volta e
     le due copie sarebbero divergute. Qui c'e' solo il disegno: i dati li
     porta il chiamante (util/trayPockets.js), e il click esce come evento.

     Le coordinate tasca arrivano in coordinate ROBOT (mm) e diventano
     coordinate DISEGNO con robotToDrawing: la formula sta nella util
     gratingAxes, mai duplicata qui.

     (v3 fase C, regola 4) IN SCALA, MAI STIRATO. Il disegno e' tutto in mm
     dentro il viewBox e scala in modo UNIFORME (preserveAspectRatio meet):
     niente piu' 480x360 fissi, la larghezza la da' il contenitore (fill:
     anche l'altezza). Il contorno del cassetto e' TRAY.X x TRAY.Y (trayX,
     trayY in mm) quando il dato c'e'; senza, resta l'820 x 615 di prima
     (data-tray-known="0", chi disegna lo dice). Con una zona (zone, mm del
     disegno) il viewBox e' la zona: stessa scala uniforme, piu' grande
     (util/trayZoom.js, tasche sotto i 44 px).
     ========================================================================== -->
<template>
    <svg class="tray-pockets" :class="{ 'tray-pockets--fill': fill }"
        version="1.1" xmlns="http://www.w3.org/2000/svg"
        :viewBox="viewBox" preserveAspectRatio="xMidYMid meet"
        width="100%" :height="fill ? '100%' : null"
        :data-tray-known="trayKnown ? '1' : '0'">
        <!-- vassoio: (UI v2 fase 1.5) fondo --bg-surface-2; (v3) bordo a
             spessore costante sullo schermo, qualunque sia la scala -->
        <rect class="tray-pockets__tray" x="0" y="0" :width="trayW" :height="trayH"
            style="fill:var(--bg-surface-2);stroke:var(--border-default);stroke-width:1.5"
            vector-effect="non-scaling-stroke" @click="tap($event)" />
        <image v-if="showOrigin && !robotSide" :href="originIcon" x="-20" y="-20" width="40px"/>
        <image v-if="showOrigin && robotSide" :href="originIcon" :x="trayW - 20" :y="trayH - 20" width="40px"/>

        <!-- (dup-guard 4/9) etichetta e chiave = SUB_POS REALE della riga, mai
             l'indice: con buchi o anomalie a DB i numeri restano quelli veri -->
        <g v-for="(p, index) in drawPz" :key="p.SUB_POS != null ? p.SUB_POS : index">
            <!-- tasca scelta nel dialog di correzione: cornice, non un colore
                 nuovo (i colori sono gia' presi dagli stati). (v2 1.5) era
                 arancio #ff9800, ora confondibile con BLOCCATA: chiara. -->
            <rect v-if="isSelected(p, index)"
                :x="p.w-dimX/2-10" :y="p.h-dimY/2-10"
                :width="dimX+20" :height="dimY+20"
                style="fill:none;stroke:var(--text-primary);stroke-width:8" />
            <prisma v-if="p.prisma"
                    :x="p.w-dimX/2" :y="p.h-dimY/2"
                    :width="dimX" :height="dimY"
                    :status="p.status"
                    :diffOrder="orderChanged(index)"
                    labelMode="v3" :labelSize="labelSize" :showLabel="showLabels" :showCenter="showCenters"
                    @click_obj="pick(index)" >
                    {{ p.SUB_POS != null ? p.SUB_POS : index+1 }}
            </prisma>
            <cylinder v-if="!p.prisma"
                    :x="p.w" :y="p.h"
                    :width="radius"
                    :status="p.status"
                    :diffOrder="orderChanged(index)"
                    labelMode="v3" :labelSize="labelSize" :showLabel="showLabels" :showCenter="showCenters"
                    @click_obj="pick(index)" >
                    {{ p.SUB_POS != null ? p.SUB_POS : index+1 }}
            </cylinder>
            <!-- bersaglio del tocco: la cella intera (il passo), non solo la
                 tasca, trasparente e sopra di lei -->
            <rect class="tray-pockets__hit"
                :x="p.w-hitW/2" :y="p.h-hitH/2" :width="hitW" :height="hitH"
                style="fill:transparent" @click="pick(index)" />
        </g>
    </svg>
</template>

<script>
import prisma from './prisma.vue'
import cylinder from './cylinder.vue'
import { robotToDrawing } from '../../util/gratingAxes.js'
import { pitchOf, TRAY_FALLBACK } from '../../util/trayZoom.js'
import centro from '../../assets/centro.png'

export default {
    components: { prisma, cylinder },
    emits: ['pick', 'tap', 'scale'],
    props: {
        // righe cosi' come arrivano da loadTrayPockets: x/y in mm robot
        pockets: { type: Array, default: () => [] },
        dimX: { type: Number, default: 0 },
        dimY: { type: Number, default: 0 },
        radius: { type: Number, default: 0 },
        // misure del cassetto in mm (TRAY.X / 1000, TRAY.Y / 1000); 0 = non note
        trayX: { type: Number, default: 0 },
        trayY: { type: Number, default: 0 },
        // true: riempie il contenitore in larghezza E altezza (meet); false:
        // larghezza del contenitore, altezza dalle proporzioni del cassetto
        fill: { type: Boolean, default: false },
        // zona ingrandita { x, y, w, h } in mm del disegno (null = tutto)
        zone: { type: Object, default: null },
        robotSide: { type: Boolean, default: false },
        showOrigin: { type: Boolean, default: true },
        showCenters: { type: Boolean, default: true },
        // alone delle tasche legate a un ordine (la pagina layout lo usa; la
        // vista d'insieme del Magazzino no: l'ordine e' nel dettaglio tasca)
        showOrders: { type: Boolean, default: true },
        // SUB_POS evidenziato (null = nessuno)
        selected: { type: Number, default: null }
    },
    data() {
        return { pxPerMm: 0 };
    },
    computed: {
        // (layout-axes 1/9; origin-fix 14/9) INVERSA di drawingToRobot presa
        // dalla util: w orizzontale (asse robot Y), h verticale (asse robot X)
        drawPz() {
            if (!this.pockets || this.pockets.length === 0) return [];
            const wh = robotToDrawing(this.pockets.map(p => ({ X: Math.round(Number(p.x) * 1000), Y: Math.round(Number(p.y) * 1000) })));
            return this.pockets.map((p, i) => Object.assign({}, p, { w: wh[i].w, h: wh[i].h }));
        },
        trayKnown() { return this.trayX > 0 && this.trayY > 0; },
        trayW() { return this.trayKnown ? this.trayX : TRAY_FALLBACK.w; },
        trayH() { return this.trayKnown ? this.trayY : TRAY_FALLBACK.h; },
        viewBox() {
            const z = this.zone;
            if (z && z.w > 0 && z.h > 0) return [z.x, z.y, z.w, z.h].join(' ');
            // margine per l'icona dell'origine (40 mm, centrata sull'angolo)
            const m = this.showOrigin ? 20 : 2;
            return [-m, -m, this.trayW + 2 * m, this.trayH + 2 * m].join(' ');
        },
        // passo fra i centri (mm): bersaglio del tocco
        pitchW() { return pitchOf(this.drawPz.map(p => p.w)); },
        pitchH() { return pitchOf(this.drawPz.map(p => p.h)); },
        hitW() { return this.pitchW > 0 ? this.pitchW : Math.max(this.dimX, 2 * this.radius); },
        hitH() { return this.pitchH > 0 ? this.pitchH : Math.max(this.dimY, 2 * this.radius); },
        // numeri delle tasche: proporzionati alla tasca, leggibili
        labelSize() {
            const lato = this.drawPz.length && !this.drawPz[0].prisma ? 2 * this.radius : Math.min(this.dimX, this.dimY);
            return Math.max(4, Math.min(34, Math.round((lato || 40) * 0.5)));
        },
        // sotto i 7 px sullo schermo i numeri sono solo rumore: si
        // nascondono (nella zona ingrandita tornano)
        showLabels() { return !(this.pxPerMm > 0) || this.labelSize * this.pxPerMm >= 7; },
        originIcon() { return centro; }
    },
    watch: {
        viewBox() { this.$nextTick(() => this.misura()); }
    },
    mounted() {
        this.misura();
        if (typeof ResizeObserver !== 'undefined') {
            this.osservatore = new ResizeObserver(() => this.misura());
            this.osservatore.observe(this.$el);
        }
    },
    unmounted() {
        if (this.osservatore) this.osservatore.disconnect();
    },
    methods: {
        // px per mm del disegno, come lo scala il browser (meet: il minore
        // dei due rapporti). Lo usa chi decide se serve la zona ingrandita.
        misura() {
            const el = this.$el;
            if (!el || typeof el.getBoundingClientRect !== 'function') return;
            const r = el.getBoundingClientRect();
            const vb = this.viewBox.split(' ').map(Number);
            if (!(r.width > 0) || !(r.height > 0) || !(vb[2] > 0) || !(vb[3] > 0)) return;
            const s = Math.min(r.width / vb[2], r.height / vb[3]);
            if (Math.abs(s - this.pxPerMm) < 1e-4) return;
            this.pxPerMm = s;
            this.$emit('scale', { pxPerMm: s, zoned: !!this.zone });
        },
        // riproduce checkIfOrderChanged del layout: alone solo dove c'e' un
        // ordine associato (order_ID 0 -> niente alone)
        orderChanged(i) {
            return this.showOrders && !!(this.pockets[i] && this.pockets[i].order_ID != 0);
        },
        isSelected(p, index) {
            if (this.selected === null || this.selected === undefined) return false;
            const sub = p.SUB_POS != null ? p.SUB_POS : index + 1;
            return sub == this.selected;
        },
        pick(index) {
            const p = this.pockets[index];
            const d = this.drawPz[index] || {};
            this.$emit('pick', {
                index: index,
                subPos: p && p.SUB_POS != null ? p.SUB_POS : index + 1,
                status: p ? p.status : null,
                orderID: p ? p.order_ID : 0,
                w: d.w, h: d.h
            });
        },
        // tocco sul vassoio fuori dalle tasche: punto in mm del disegno
        tap(ev) {
            const el = this.$el;
            if (!ev || !el || typeof el.getScreenCTM !== 'function' || typeof el.createSVGPoint !== 'function') return;
            const m = el.getScreenCTM();
            if (!m) return;
            const pt = el.createSVGPoint();
            pt.x = ev.clientX; pt.y = ev.clientY;
            const q = pt.matrixTransform(m.inverse());
            this.$emit('tap', { w: q.x, h: q.y });
        }
    }
}
</script>

<style scoped>
.tray-pockets { display: block; max-width: 100%; }
.tray-pockets--fill { max-height: 100%; }
.tray-pockets__hit { cursor: pointer; }
</style>
