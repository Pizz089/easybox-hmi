<template>
    <g id="prisma_obj" :transform="calcolatransform()" @click="$emit('click_obj')" >
        <rect v-if="diffOrder" :x='x-8' :y='y-13' :width='width+16' :height='height+26' style='fill:lightcyan' />
        
        <rect class="pocket-shape" :x='x' :y='y' :width='width' :height='height' :style='getStyle'/> 
        <!--rect :x='x-6+width/2' :y='y-6+height/2' :width='12' :height='12' style='fill:none;stroke-width:2;stroke:blue'/--> 

        <circle v-if="!hideCenter && showCenter" :cx='parseInt(x)+width/2'  :cy="parseInt(y)+height/2" :r="centerR" style="stroke:red;fill:red" />
        <text v-if="labelMode === 'v3' && showLabel" class="pocket-label" :x="x+width/2" :y="labelY" text-anchor="middle"
            :style="'fill:' + labelFill + ';font-family:var(--font-family);font-weight:700;font-size:' + labelSize + 'px'">
            <slot></slot>
        </text>
        <text v-else-if="labelMode !== 'v3'" :x='parseInt(x)+10' :y='parseInt(y)+25' :style="'fill:' + labelFill + ';font-family:times;font-size:34'">
            <slot></slot>
        </text>        
        <!--text :x='parseInt(x)+5' :y='parseInt(y)+15' style="fill:black;font-family:times;font-size:18">
            ({{X_tray-(x+width/2)}},{{y_tray-(y+height/2)}})
        </text-->
    </g>
</template>

<script>
    // (UI v2 fase 1.5) colori degli stati da util/pocketColors.js, la stessa
    // tabella della legenda e delle tabelle (doc §11)
    import { pocketShapeStyle, pocketLabelFill } from '../../util/pocketColors.js'

    export default {
        emits:[ 'click_obj'],
        props: {
            x: {
                type: Number,
                default: 0,
            },
            y: {
                type: Number,
                default: 0,
            },
            width: {
                type: Number,
                default: 0,
            },
            height: {
                type: Number,
                default: 0,
            },
            status: {
                type: Number,
                default: 4,  //-> raw
            },
            diffOrder:{
                type: Boolean,
                default: false
            },
            hideCenter:{
                type: Boolean,
                default: false
            },
            // (v3 fase C) disegno del cassetto in scala (TrayPockets): numero
            // centrato, nel font del pannello, proporzionato alla tasca.
            // 'legacy' (default) = il disegno di prima, quello che il
            // Grigliato esporta in SVG: non cambia.
            labelMode: {
                type: String,
                default: 'legacy'
            },
            labelSize: {
                type: Number,
                default: 34
            },
            showLabel: {
                type: Boolean,
                default: true
            },
            // pallino rosso del centro (punto di presa): la vista d'insieme
            // del Magazzino non lo mostra, la pagina layout si'
            showCenter: {
                type: Boolean,
                default: true
            }
        }, 
        data() {
            return { 
                X_tray:800,
                y_tray:600,
                //x:0,
                //y:0, 
                //width:50,
                //height:50,
                //pos:1
            }
        },
        methods: {
            calcolatransform() {
                //return "rotate(-45 "+ parseInt(this.x)+this.width/2 + " "+ parseInt(this.y)+this.height/2+")";
                //return "rotate(-45 0 0)"
                let ris = "rotate(0 $1 $2)"  //-30
                ris=ris.replace("$1", this.x+this.width/2);
                ris=ris.replace("$2", this.y+this.height/2);
                return ris;
            }
        },
        computed: {
            getStyle() {
                // hideCenter lo uso per quando voglio esportare lo svg: bordo
                // rosso al posto del nero (in pocketShapeStyle). I var(--...)
                // li risolve in esadecimale l'export (Grating.vue).
                return pocketShapeStyle(this.status, !!this.hideCenter);
            },
            labelFill() {
                return pocketLabelFill(this.status);
            },
            // pallino del centro: 4 mm come prima, ma mai piu' di un ottavo
            // della tasca nel disegno v3 (su un grigliato fitto la copriva)
            centerR() {
                return this.labelMode === 'v3' ? Math.min(4, Math.min(this.width, this.height) / 8) : 4;
            },
            // (v3) numero in alto nella tasca; su una tasca bassa, al centro
            labelY() {
                const pad = this.labelSize * 0.3;
                if (this.height >= this.labelSize * 1.6) return this.y + pad + this.labelSize * 0.8;
                return this.y + this.height / 2 + this.labelSize * 0.35;
            }
        }
    }
</script>
