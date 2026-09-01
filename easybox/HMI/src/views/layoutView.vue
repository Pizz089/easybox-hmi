<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../data.js'

    import prisma from '../components/layout/prisma.vue'
    import cylinder from '../components/layout/cylinder.vue'
    import { DIR_X, DIR_Y, ROBOT_AXIS_ALONG } from '../util/gratingAxes.js'
    import { KO_ACTIVE_ORDER } from '../util/errorCodes.js'
</script>


<template>
  <div class="view-shell">
    <h2 class="layout-title view-title">LAYOUT {{ $t('TRAY')}} ID{{$route.params.trayID }} - {{$t('piano')}}{{$route.params.floorMag }}</h2>
	
    <div class="pure-u-1">
        <svg width="480" height="360" 
            version="1.1" xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 -20 820 650" > 
            <!-- vassoio -->
            <rect x="0" y="0" width="820" height="615" style="fill:lightgray" />
            <image v-if="!robotSide" href="../assets/centro.png" x="-20" y="-20" width="40px"/>
            <image v-if="robotSide" href="../assets/centro.png" x="800" y="595" width="40px"/>
            
            <!-- (layout-axes, 1/9) tasche in coordinate DISEGNO {w,h} ricavate
                 dalle coordinate robot con l'inversa di gratingAxes (vedi
                 drawPz): w = orizzontale (lato lungo, asse robot Y), h =
                 verticale (asse robot X). Prima: x<-X, y<- -Y e filtro
                 p.y<0 — con la convenzione corretta (Y positive) restavano
                 disegnate solo le 7 tasche a Y=-65: strisce in un angolo. -->
            <g v-for="(p, index) in drawPz" :key="index" >
                <prisma v-if="p.prisma"
                        :x="p.w-dim_x/2" :y="p.h-dim_y/2"
                        :width="dim_x" :height="dim_y"
                        :status="p.status"
                        :diffOrder="checkIfOrderChanged(index)"
                        @click_obj="clickPiece(index)" >
                        {{ index+1 }}
                </prisma>
                <cylinder v-if="!p.prisma"
                        :x="p.w" :y="p.h"
                        :width="radius"
                        :status="p.status"
                        :diffOrder="checkIfOrderChanged(index)"
                        @click_obj="clickPiece(index)" >
                        {{ index+1 }}
                </cylinder>
            </g>
            
            <!--image href="../assets/reload.png" x="365" y="568" width="65px" @click="changeSide()">
                <animateTransform
                    attributeName="transform"
                    attributeType="XML"
                    type="rotate"
                    from="0 398 600"
                    to="360 398 600"
                    dur="2s"
                    repeatCount="2" />
            </image-->

            <!--text v-if="!robotSide" x='186' y='14' style="fill:blue;font-family:times;font-size:50"  @click="changeSide()">
                OPERATOR VIEW
            </text>
            <text v-if="robotSide" x='230' y='14' style="fill:blue;font-family:times;font-size:50"  @click="changeSide()">
                ROBOT VIEW
            </text-->
            <!--text x='160' y='620' style="fill:blue;font-family:times;font-size:50"  @click="changeSide()">
                {{ robotSide?'   Robot':'Operator' }} view 
            </text-->
            <!--text x='460' y='620' style="fill:blue;font-family:times;font-size:20"  @click="changeSide()">
                (click to switch)
            </text-->

            <!--text x='190' y='320' style="fill:gray;font-family:times;font-size:80">
                {{ robotSide?'   Robot':'Operator' }} view
            </text-->
        </svg>
    </div>

    <div class="pure-u-1">
        <svg width="480" height="100" 
            version="1.1" xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 480 100" style="margin-left:60px">
            
            <rect x="51" y="0" width="50" height="50" style="fill:lightgray" />
            <text x="58" y="28" style="fill:white;font-family:times;font-size:10">EMPTY</text>

            <rect x="103" y="0" width="50" height="50" style="fill:green" />
            <text x="116" y="28" style="fill:white;font-family:times;font-size:10">RAW</text>

            <rect x="155" y="0" width="50" height="50" style="fill:black" />
            <text x="159" y="28" style="fill:white;font-family:times;font-size:10">NOT DEF</text>

            <rect x="207" y="0" width="50" height="50" style="fill:coral" />
            <text x="217" y="28" style="fill:white;font-family:times;font-size:10">LOCK</text>

            <rect x="259" y="0" width="50" height="50" style="fill:#080866" />
            <text x="261" y="28" style="fill:white;font-family:times;font-size:10">FINISHED</text>

            <rect x="311" y="0" width="50" height="50" style="fill:red" />
            <text x="318" y="28" style="fill:white;font-family:times;font-size:10">ABORT</text>

            <text x="0" y="28" style="fill:white;font-family:times;font-size:10">LEGEND:</text>
        </svg>
    </div>

    <div class="pure-u-3-4" v-if="$route.params.modifyEnable==1">
        <div class="btn-group">
            <button class="btn-ghost" @click="allRaugh()">Tutti grezzi </button>
            <button class="btn-ghost" @click="allEmpty()">Tutti vuoti </button>
            <!-- AZZERA STATO CASSETTO (1/9): a differenza di "Tutti grezzi"
                 (modifica LOCALE, scritta solo col Save! tasca per tasca e
                 senza toccare Order_ID) e' un ripristino IMMEDIATO e atomico
                 lato backend: STATUS=4 + Order_ID=0 su tutte le tasche, con
                 guardia ordine attivo e conferma esplicita -->
            <button class="pure-button-micromission specialCMD" @click="openTrayReset()">
                {{ $t('layout.reset.button') }}
            </button>
        </div>

        <div v-if="trayReset.open" class="mission-dialog-overlay">
            <div class="mission-dialog">
                <h3 class="command-section-title">{{ $t('layout.reset.title', { floor: $route.params.floorMag }) }}</h3>
                <div class="reset-text">{{ $t('layout.reset.what', { n: listPz.length }) }}</div>
                <div class="reset-warn">{{ $t('layout.reset.warn') }}</div>
                <div class="pure-g">
                    <div class="pure-u-1-2">
                        <button style="width:100%" class="button_pressed"
                            :class="[trayReset.busy ? 'pure-button-disable' : 'pure-button-mission']"
                            @click="trayReset.busy ? '' : confirmTrayReset()">
                            {{ $t('layout.reset.confirm') }}
                        </button>
                    </div>
                    <div class="pure-u-1-2">
                        <button style="width:100%" class="btn-ghost" @click="trayReset.open=false">
                            {{ $t('robot.dialog.cancel') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div class="btn-group save-row">
            <button class="pure-button-primary" @click="saveAllData()">
                Save!
                <progress v-if="avanzamento>0" max="100" :value="avanzamento"> {{avanzamento}} </progress>
            </button>
        </div>
    </div>
    <div class="pure-u-1" v-if="$route.params.modifyEnable==0">
        <h2 class="blink"> VIEW ONLY!! </h2>
    </div>
  </div>
</template>

<script>
    export default {
        data() {
            return {
                listPz:[
                    //{prisma:true, x:700, y:500, status:7},
                ],
                dim_x:0,
                dim_y:0,
                radius:0,
                robotSide:false,   //visualizzazione del layout da parte del robot o dell'operatore
                avanzamento:0,
                trayReset: { open: false, busy: false }   // dialog AZZERA STATO CASSETTO
            }
        },
        methods: {
            getDataTable() {
                //console.log("mostro layout per cassetto con ID: "+this.$route.params.trayID )
                fetch(dataStored.server+'api/conf/tray/layout/'+ this.$route.params.floorMag ,{ method: 'GET'})
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json()
                    })
                    .then(pz => {
                        console.log("ricevo dati per "+pz.length+"  posizioni")  
                        this.listPz=pz;
                        //console.log(JSON.stringify(pz,null,4))

                        //alert(JSON.stringify(this.listPz,null,4))

                        //console.log("tipo pezzo: "+pz[0].partType)
                        if (this.listPz[0].partType==0){
                            //caso speciale: grigliato importato dal mondo reale
                            fetch(dataStored.server+'api/conf/grating/showFromTray/'+ this.$route.params.floorMag,{ method: 'GET'})
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error('Network response was not ok');
                                    }
                                    return response.json()
                                })
                                .then(dim => {
                                    console.log("ricevo dati sulla dimensione "+dim.length)
                                    // (layout-axes) passo dedotto dalle tasche: SUB_POS
                                    // consecutive avanzano sull'asse robot Y (= lungo
                                    // width -> dim_x); la prima tasca con X diversa da'
                                    // il passo lungo height (-> dim_y). Versi
                                    // ininfluenti: ampiezze in valore assoluto.
                                    const d = this.listPz;
                                    this.dim_x = (d.length > 1 ? Math.abs(d[1].y - d[0].y) : 0) - dim[0].SAFEX;
                                    const other = d.find(p => p.x != d[0].x);
                                    this.dim_y = (other ? Math.abs(other.x - d[0].x) : 0) - dim[0].SAFEY;
                                    this.radius=Math.round(this.dim_x/2);
                                 })
                                .catch(error => {
                                    console.info("-------------")
                                    console.info(error);
                                });
                        }else{
                            fetch(dataStored.server+'api/conf/piece/show/'+pz[0].partType,{ method: 'GET'})
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error('Network response was not ok');
                                    }
                                    return response.json()
                                })
                                .then(dim => {
                                    console.log("ricevo dati sulla dimensione "+dim.length)  
                                    this.dim_x=dim[0].X/1000;
                                    this.dim_y=dim[0].Y/1000;
                                    this.radius=Math.round((dim[0].X/1000)/2);
                                    this.avanzamento=0;
                                })
                                .catch(error => {
                                    console.info("-------------")
                                    console.info(error);
                                });
                        }
                    })
                    .catch(error => {
                        console.info("-------------")
                        console.info(error);
                    });
                
            },
            changeSide(){
                this.robotSide =! this.robotSide;
                
                let temp = [];
                console.log(this.listPz.length)
                //for (let i=0; i<this.listPz.length; i++){
                //let obj = {}
                //    obj.partType=this.listPz[this.listPz.length-1-i].partType;
                //    obj.prisma=this.listPz[this.listPz.length-1-i].prisma;
                //    if (this.robotSide){
                //        obj.x=820-this.listPz[this.listPz.length-1-i].x;
                //        obj.y=615-this.listPz[this.listPz.length-1-i].y;
                //    }else{
                //        obj.x=this.listPz[this.listPz.length-1-i].x;
                //        obj.y=this.listPz[this.listPz.length-1-i].y;
                //    }
                //    obj.status=this.listPz[i].status;
                //    obj.order_ID=this.listPz[i].order_ID;
                //    
                //    temp.push(obj);
                //}
                
                for (let i=this.listPz.length; i>0; i--){
                    let obj = {}
                    obj.partType=this.listPz[i-1].partType;
                    obj.prisma=this.listPz[i-1].prisma;
                    if (this.robotSide){
                        obj.x=820-this.listPz[i-1].x;
                        obj.y=615-this.listPz[i-1].y;
                    }else{
                        obj.x=this.listPz[i-1].x;
                        obj.y=this.listPz[i-1].y;
                    }
                    obj.status=this.listPz[i-1].status;
                    obj.order_ID=this.listPz[i-1].order_ID;
                    
                    if (i==1 || i==12)
                        console.log(i+":\n"+JSON.stringify(obj, null,4))
                    temp.push(obj);
                }

                this.listPz = temp;
            },
            clickPiece(index){
                //if (this.$route.params.modifyEnable==0) 
                //    return
                //alert(this.robotSide?this.listPz.length-index:index+1);
                //let idx=0;
                //if (this.robotSide)
                //    idx=this.listPz.length-index
                //else
                //    idx=index
                if (this.listPz[index].order_ID>0){
                    dataStored.alert.title="POSITION LOCKED!";
                    dataStored.alert.desc="Position already associated with an order and order active!";
                    return
                }
                if (this.$route.params.modifyEnable==0){
                    dataStored.alert.title="ATTENTION";
                    dataStored.alert.desc="VIEW ONLY!";
                    return
                }
                switch (this.listPz[index].status){
                    case dataStored.status_notDef:                          //NOT DEFINITED    
                        this.listPz[index].status=dataStored.status_empty;  //EMPTY     
                        break;                       
                    case dataStored.status_empty:                           //EMPTY
                        this.listPz[index].status=dataStored.status_raw;    //RAW    
                        break;
                    case dataStored.status_raw:                             //RAW    
                        this.listPz[index].status=dataStored.status_finished;//NOT DEFINITED    
                        break;
                    case dataStored.status_finished:                        //FINISHED
                        this.listPz[index].status=dataStored.status_notDef; //NOT DEFINITED    
                        break;
                    case dataStored.status_aborted:                         //ABORT
                        this.listPz[index].status=dataStored.status_notDef; //NOT DEFINITED    
                        break;
                    case 9: //LOCKED
                        alert("POSITION LOCKED!");
                        break;
                } 
            },
            checkIfOrderChanged(i){
                if (this.listPz[i].order_ID==0) 
                    return false
                if ( this.listPz[0].order_ID != this.listPz[i].order_ID)
                    return true;
                else 
                    return true
            },
            // AZZERA STATO CASSETTO: solo via dialog; l'esecuzione e' del
            // backend (POST resetTray/:floor, guardia ordine attivo inclusa)
            openTrayReset() {
                this.trayReset.open = true;
            },
            confirmTrayReset() {
                if (this.trayReset.busy) return;
                this.trayReset.busy = true;
                fetch(dataStored.server + 'api/conf/position/resetTray/' + this.$route.params.floorMag, { method: 'POST' })
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.text(); })
                    .then(body => {
                        let row = null;
                        try { row = JSON.parse(body); } catch (_) { row = { ris: body.trim() }; }
                        this.trayReset.open = false;
                        if (row.ris === 'OK') {
                            dataStored.alert.title = 'INFO';
                            dataStored.alert.desc = this.$t('layout.reset.done', { n: row.positions });
                            dataStored.alert.type = 'message';
                            this.getDataTable();
                        } else if (row.ris === KO_ACTIVE_ORDER) {
                            dataStored.alert.title = this.$t('WARNING');
                            dataStored.alert.desc = 'layout.reset.activeOrder';
                            dataStored.alert.type = 'warning';
                        } else {
                            dataStored.alert.title = this.$t('WARNING');
                            dataStored.alert.desc = 'layout.reset.failed';
                            dataStored.alert.type = 'warning';
                        }
                    })
                    .catch(e => {
                        console.info(e);
                        this.trayReset.open = false;
                        dataStored.alert.title = this.$t('WARNING');
                        dataStored.alert.desc = 'layout.reset.failed';
                        dataStored.alert.type = 'warning';
                    })
                    .finally(() => { this.trayReset.busy = false; });
            },
            allRaugh(){
                for (let i=0; i<this.listPz.length; i++){
                    this.listPz[i].status = 4;
                }
            },
            allEmpty(){
                for (let i=0; i<this.listPz.length; i++){
                    this.listPz[i].status = 2;
                }
            },
            saveAllData(){
                for (let i=0; i<this.listPz.length; i++){
                    fetch(dataStored.server+'api/conf/position/updatePositionStatus/'+this.$route.params.floorMag+"/"+(i+1)+"/"+this.listPz[i].status ,{ method: 'GET'})
                        .then( response => {
                            if (!response.ok) {
                                throw new Error('Network response was not ok');
                            }
                            this.avanzamento = Math.round(this.avanzamento + 100/this.listPz.length)
                        })
                        .catch(error => {
                            console.info("-------------")
                            console.info(error);
                        });
                }
                this.getDataTable();
            }
        },
        computed: {
            // (layout-axes, 1/9) INVERSA di gratingAxes.drawingToRobot, con i
            // suoi stessi DIR_X/DIR_Y (nessuna costante duplicata):
            //   X = w1 + DIR_X*(h - h1),  Y = -h1 + DIR_Y*(w - w1)
            // con origine = tasca 1 (w1 = X1, h1 = -Y1), quindi
            //   h = -Y1 + DIR_X*(X - X1),  w = X1 + DIR_Y*(Y - Y1).
            // w e h sono le distanze disegno dai bordi (lato lungo / corto):
            // qui vanno dritte su x/y schermo, come faceva gia' il layout
            // (vista ruotata di 180 gradi rispetto all'anteprima Grigliati).
            // ROBOT_AXIS_ALONG documenta l'accoppiamento: width <-> Y, height <-> X.
            drawPz() {
                if (!this.listPz || this.listPz.length === 0) return [];
                const X1 = Number(this.listPz[0].x), Y1 = Number(this.listPz[0].y);
                return this.listPz.map(p => Object.assign({}, p, {
                    w: X1 + DIR_Y * (Number(p.y) - Y1),
                    h: -Y1 + DIR_X * (Number(p.x) - X1),
                }));
            },
            robotAxisAlong() { return ROBOT_AXIS_ALONG; }
        },
        mounted(){
            this.getDataTable()
        }
    }
</script>    


<style scoped>
    .layout-title {
        color: var(--text-secondary);
    }

    /* LY4: warning lampeggiante (status, non azione -> --color-warning);
       niente font-family locale, governa il token globale. */
    .blink {
        animation: blinker 1.5s linear infinite;
        color: var(--color-warning);
        text-align: center;
    }
    @keyframes blinker {
        50% {
            opacity: 0;
        }
    }

    /* Spaziatura extra della riga Save sotto i bulk (il resto dal .btn-group). */
    .save-row {
        margin-top: var(--space-2);
    }

    /* dialog AZZERA STATO CASSETTO: stesso overlay delle view missione */
    .mission-dialog-overlay {
        position: fixed;
        inset: 0;
        background: var(--bg-backdrop);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .mission-dialog {
        background: var(--bg-surface);
        border: var(--border-card);
        border-radius: var(--radius-md);
        box-shadow: var(--elevation-3);
        padding: var(--space-4);
        width: min(520px, 92vw);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }
    .reset-text {
        color: var(--text-primary);
    }
    .reset-warn {
        background: var(--color-warning-bg);
        color: var(--color-warning);
        border: 1px solid var(--color-warning);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font-weight: var(--font-weight-semibold);
    }
</style>