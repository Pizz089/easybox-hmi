<template>
    <g id="cylinder_obj" @click="$emit('click_obj')">
        <!--rect v-if="diffOrder" :x='x-width-16' :y='y-width-12' :width='2*(width+16)' :height='2*(width+12)' style='fill:lightcyan' /-->
        
        <circle :cx='x' :cy='y' :r="width" :style='getStyle' />
                <!--stroke-width="8" stroke="red" stroke-dasharray="3"/-->

        <circle :cx='parseInt(x)'  :cy="parseInt(y)" r="4" style="stroke:red;fill:red" />
        <text :x='parseInt(x)-18' :y='parseInt(y)-10' style="fill:white;font-family:times;font-size:34">
            <slot></slot>
        </text>
        
        <!--text :x='parseInt(x)-40' :y='parseInt(y)+25' style="fill:black;font-family:times;font-size:22">
            ({{ X_tray-x }},{{ y_tray-y }})
        </text-->
    </g>
</template>

<script>
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
            getStyle_old() {
                if (this.status==4)  //RAW
                    return "fill:green";
                if (this.status==5)  //finished
                    return "fill:#080866";
                if (this.status==7)  //abort
                    return "fill:#ff0000ab";
                if (this.status==3)  //working
                    return "fill:lightblue;stroke:black;stroke-width:1";
                if (this.status==2)  //empty
                    return "fill:lightgray;stroke:black;stroke-width:1";
                //not defined
                return "fill:black";
            },
            getStyle() {
                let ris = ''
                //not defined
                ris = "fill:black";
                if (this.status==4)  //RAW
                    ris = "fill:green";
                if (this.status==5)  //finished
                    ris = "fill:#080866";
                if (this.status==7)  //abort
                    ris = "fill:#ff0000ab";
                if (this.status==3)  //working
                    ris = "fill:lightblue;stroke:black;stroke-width:1";
                if (this.status==2)  //empty
                    ris = "fill:lightgray;stroke:black;stroke-width:1";
                
                if ( this.diffOrder)
                    return ris+'; stroke-width:10; stroke:yellow;stroke-dasharray:15,10'; //
                else
                    return ris;
            }
        }
    }
</script>