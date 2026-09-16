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
     ========================================================================== -->
<template>
    <svg :width="width" :height="height"
        version="1.1" xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -20 820 650">
        <!-- vassoio -->
        <rect x="0" y="0" width="820" height="615" style="fill:lightgray" />
        <image v-if="!robotSide" :href="originIcon" x="-20" y="-20" width="40px"/>
        <image v-if="robotSide" :href="originIcon" x="800" y="595" width="40px"/>

        <!-- (dup-guard 4/9) etichetta e chiave = SUB_POS REALE della riga, mai
             l'indice: con buchi o anomalie a DB i numeri restano quelli veri -->
        <g v-for="(p, index) in drawPz" :key="p.SUB_POS != null ? p.SUB_POS : index">
            <!-- tasca scelta nel dialog di correzione: cornice, non un colore
                 nuovo (i colori sono gia' presi dagli stati) -->
            <rect v-if="isSelected(p, index)"
                :x="p.w-dimX/2-10" :y="p.h-dimY/2-10"
                :width="dimX+20" :height="dimY+20"
                style="fill:none;stroke:#ff9800;stroke-width:8" />
            <prisma v-if="p.prisma"
                    :x="p.w-dimX/2" :y="p.h-dimY/2"
                    :width="dimX" :height="dimY"
                    :status="p.status"
                    :diffOrder="orderChanged(index)"
                    @click_obj="pick(index)" >
                    {{ p.SUB_POS != null ? p.SUB_POS : index+1 }}
            </prisma>
            <cylinder v-if="!p.prisma"
                    :x="p.w" :y="p.h"
                    :width="radius"
                    :status="p.status"
                    :diffOrder="orderChanged(index)"
                    @click_obj="pick(index)" >
                    {{ p.SUB_POS != null ? p.SUB_POS : index+1 }}
            </cylinder>
        </g>
    </svg>
</template>

<script>
import prisma from './prisma.vue'
import cylinder from './cylinder.vue'
import { robotToDrawing } from '../../util/gratingAxes.js'
import centro from '../../assets/centro.png'

export default {
    components: { prisma, cylinder },
    emits: ['pick'],
    props: {
        // righe cosi' come arrivano da loadTrayPockets: x/y in mm robot
        pockets: { type: Array, default: () => [] },
        dimX: { type: Number, default: 0 },
        dimY: { type: Number, default: 0 },
        radius: { type: Number, default: 0 },
        width: { type: [Number, String], default: 480 },
        height: { type: [Number, String], default: 360 },
        robotSide: { type: Boolean, default: false },
        // SUB_POS evidenziato (null = nessuno)
        selected: { type: Number, default: null }
    },
    computed: {
        // (layout-axes 1/9; origin-fix 14/9) INVERSA di drawingToRobot presa
        // dalla util: w orizzontale (asse robot Y), h verticale (asse robot X)
        drawPz() {
            if (!this.pockets || this.pockets.length === 0) return [];
            const wh = robotToDrawing(this.pockets.map(p => ({ X: Math.round(Number(p.x) * 1000), Y: Math.round(Number(p.y) * 1000) })));
            return this.pockets.map((p, i) => Object.assign({}, p, { w: wh[i].w, h: wh[i].h }));
        },
        originIcon() { return centro; }
    },
    methods: {
        // riproduce checkIfOrderChanged del layout: alone solo dove c'e' un
        // ordine associato (order_ID 0 -> niente alone)
        orderChanged(i) {
            return !!(this.pockets[i] && this.pockets[i].order_ID != 0);
        },
        isSelected(p, index) {
            if (this.selected === null || this.selected === undefined) return false;
            const sub = p.SUB_POS != null ? p.SUB_POS : index + 1;
            return sub == this.selected;
        },
        pick(index) {
            const p = this.pockets[index];
            this.$emit('pick', {
                index: index,
                subPos: p && p.SUB_POS != null ? p.SUB_POS : index + 1,
                status: p ? p.status : null,
                orderID: p ? p.order_ID : 0
            });
        }
    }
}
</script>
