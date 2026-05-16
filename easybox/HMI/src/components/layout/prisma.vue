<template>
    <g id="prisma_obj" :transform="calcolatransform()" @click="$emit('click_obj')" >
        <rect v-if="diffOrder" :x='x-8' :y='y-13' :width='width+16' :height='height+26' style='fill:lightcyan' />
        
        <rect :x='x' :y='y' :width='width' :height='height' :style='getStyle'/> 
        <!--rect :x='x-6+width/2' :y='y-6+height/2' :width='12' :height='12' style='fill:none;stroke-width:2;stroke:blue'/--> 

        <circle v-if="!hideCenter" :cx='parseInt(x)+width/2'  :cy="parseInt(y)+height/2" r="4" style="stroke:red;fill:red" />
        <text :x='parseInt(x)+10' :y='parseInt(y)+25' style="fill:white;font-family:times;font-size:34">
            <slot></slot>
        </text>        
        <!--text :x='parseInt(x)+5' :y='parseInt(y)+15' style="fill:black;font-family:times;font-size:18">
            ({{X_tray-(x+width/2)}},{{y_tray-(y+height/2)}})
        </text-->
    </g>
</template>

<script>
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
                
                if (this.hideCenter) {
                    //hideCenter lo uso per quando voglio esportare lo svg
                    ris = ris.replace("stroke:black","stroke:red")
                }
                
                //if ( this.diffOrder)
                //    return ris+'; stroke-width:20; stroke:gray; '; //stroke-dasharray:9
                //else
                    return ris;
            }
        }
    }
</script>
