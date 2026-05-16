<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../data.js'

    import prisma from '../components/layout/prisma.vue'
    import cylinder from '../components/layout/cylinder.vue'
</script>


<template>   
    <h2 style="color:grey;">&nbsp;LAYOUT {{ $t('TRAY')}} ID{{$route.params.trayID }} - {{$t('piano')}}{{$route.params.floorMag }}</h2>
	
    <div class="pure-u-1">
        <svg width="480" height="360" 
            version="1.1" xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 -20 820 650" > 
            <!-- vassoio -->
            <rect x="0" y="0" width="820" height="615" style="fill:lightgray" />
            <image v-if="!robotSide" href="../assets/centro.png" x="-20" y="-20" width="40px"/>
            <image v-if="robotSide" href="../assets/centro.png" x="800" y="595" width="40px"/>
            
            <g v-for="(p, index) in listPz" :key="index" >
                <prisma v-if="p.prisma && p.x>0 && p.y<0"
                        :x="p.x-dim_x/2" :y="-p.y-dim_y/2" 
                        :width="dim_x" :height="dim_y" 
                        :status="p.status"
                        :diffOrder="checkIfOrderChanged(index)"
                        @click_obj="clickPiece(index)" >
                        {{ index+1 }}
                </prisma>
                <cylinder v-if="!p.prisma && p.x>0 && p.y>0"
                        :x="p.x" :y="p.y" 
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
            viewBox="0 0 480 100" style="margin-top:20px;margin-left:60px"> 
            
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
        <div class="pure-u-1">
            <button class="pure-button pure-u-1-2" @click="allRaugh()" style="padding:2px;margin:5px">Tutti grezzi </button>
            <button class="pure-button pure-u-1-2" @click="allEmpty()" style="padding:2px;margin:5px">Tutti vuoti </button>
        </div>
        <div class="pure-u-1">
            <button class="pure-button-primary pure-u-1-2" @click="saveAllData()" style="padding:2px;margin:15px 5px 5px">
                Save!
                <progress v-if="avanzamento>0" max="100" :value="avanzamento"> {{avanzamento}} </progress>
            </button>
        </div>
    </div>
    <div class="pure-u-1" v-if="$route.params.modifyEnable==0">
        <h2 class="blink" style="margin-left:140px"> VIEW ONLY!! </h2>
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
                avanzamento:0
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
                                    this.dim_x=this.listPz[1].x-this.listPz[0].x-dim[0].SAFEX;
                                    let found=false;
                                    for(let index=0; index<this.listPz.length; index++){
                                        if (!found && (-this.listPz[index].y+this.listPz[0].y) > 0) {
                                            //console.log("index "+index +" -> "+this.listPz[index].y)
                                            this.dim_y=-this.listPz[index].y+this.listPz[0].y-dim[0].SAFEY;
                                            found = true;
                                        }
                                    }
                                    this.radius=Math.round((this.listPz[1].x-this.listPz[0].x-dim[0].SAFEX)/2);
                                    //console.log(this.dim_x + " - "+this.dim_y)
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
        mounted(){
            this.getDataTable()
        }
    }
</script>    


<style scoped>
    .blink {
        animation: blinker 1.5s linear infinite;
        color: coral;
        font-family: sans-serif;
    }
    @keyframes blinker {
        50% {
            opacity: 0;
        }
    }

/* Tooltip container */
.tooltip {
  position: relative;
  display: inline-block;
  /*border-bottom: 1px dotted black;  If you want dots under the hoverable text */
}

/* Tooltip text */
.tooltip .tooltiptext {
  visibility: hidden;
  width: 120px;
  background-color: black;
  color: #fff;
  text-align: center;
  padding: 5px 0;
  border-radius: 6px;
 
  /* Position the tooltip text - see examples below! */
  position: absolute;
  z-index: 1;
}

/* Show the tooltip text when you mouse over the tooltip container */
.tooltip:hover .tooltiptext {
  visibility: visible;
}
</style>