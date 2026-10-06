<template>
    <g id="cylinder_obj" @click="$emit('click_obj')">
        <!--rect v-if="diffOrder" :x='x-width-16' :y='y-width-12' :width='2*(width+16)' :height='2*(width+12)' style='fill:lightcyan' /-->
        
        <circle class="pocket-shape" :cx='x' :cy='y' :r="width" :style='getStyle' />
                <!--stroke-width="8" stroke="red" stroke-dasharray="3"/-->

        <circle v-if="showCenter" :cx='parseInt(x)'  :cy="parseInt(y)" r="4" style="stroke:red;fill:red" />
        <text v-if="labelMode === 'v3' && showLabel" class="pocket-label" :x="x" :y="y + labelSize * 0.35" text-anchor="middle"
            :style="'fill:' + labelFill + ';font-family:var(--font-family);font-weight:700;font-size:' + labelSize + 'px'">
            <slot></slot>
        </text>
        <text v-else-if="labelMode !== 'v3'" :x='parseInt(x)-18' :y='parseInt(y)-10' :style="'fill:' + labelFill + ';font-family:times;font-size:34'">
            <slot></slot>
        </text>
        
        <!--text :x='parseInt(x)-40' :y='parseInt(y)+25' style="fill:black;font-family:times;font-size:22">
            ({{ X_tray-x }},{{ y_tray-y }})
        </text-->
    </g>
</template>

<script>
    // (UI v2 fase 1.5) colori degli stati da util/pocketColors.js, la stessa
    // tabella della legenda e delle tabelle (doc §11)
    import { pocketShapeStyle, pocketLabelFill } from '../../util/pocketColors.js'

    export default {
        emits:['click_obj'],
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
            status: {
                type: Number,
                default: 4, // -> "raw",
            },
            diffOrder:{
                type: Boolean,
                default: false
            },
            // (v3 fase C) come in prisma.vue: numero centrato e proporzionato
            // nel disegno in scala; 'legacy' = il disegno di prima
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
            changeLang() {
                this.x = this.X_tray-(this.x_sic-this.width)*this.pos;
                this.y = this.Y_tray-(this.x_sic-this.width)*this.pos;
            }
        },
        computed: {
            getStyle() {
                const ris = pocketShapeStyle(this.status);
                // cambio ordine: tratteggio sulla sagoma (il prisma usa l'alone
                // lightcyan). Invariato.
                if ( this.diffOrder)
                    return ris+'; stroke-width:10; stroke:yellow;stroke-dasharray:15,10'; //
                else
                    return ris;
            },
            labelFill() {
                return pocketLabelFill(this.status);
            }
        }
    }
</script>