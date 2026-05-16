<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';
    
    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    const el = ref()
</script>

<template>   
    &nbsp;      
    &nbsp;
    
      <div class="pure-u-23-24">
        <h3>
            {{$t('tray.welcome')}}
            <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="createTray()">
                {{$t('tray.add_Tray')}}
            </button>
        </h3>
        <table class="pure-table pure-table-horizontal" style="margin-top: 30px;">
            <thead>
                <tr>
                    <!--th>ID</th-->
                    <th>{{$t('tray.name')}}</th>
                    <th>{{$t('tray.family')}}</th>
                    <!--th>{{$t('tray.stato')}}</th-->
                    <th style='width:20%' id='hide'>{{$t('tray.descr')}}</th>
                    <!--th>{{$t('tray.num_posti')}}</th-->
                    
                    <!--th>{{$t('tray.num_grezzi')}}</th>
                    <th>{{$t('tray.num_vuoti')}}</th>
                    <th>{{$t('tray.num_finiti')}}</th-->
                    <th>{{$t('tray.comands')}}</th>
                </tr>
            </thead>
            <tbody>
                <template v-for="(dt,index) in datiTab" :key="dt.ID" >
                    <tr :class="{'pure-table-odd':(index%2==1),'extractedRow':dt.EXTRACT>0 && dt.EXTRACT<1000}">
                        <!--td>{{dt.ID}} </td-->
                        <td v-if="dt.FLOOR_MAG>0" :class="{'extract':(dt.EXTRACT>0 && dt.EXTRACT<1000),'extractBlink':dt.EXTRACT==1000,'releaseBlink':dt.EXTRACT==2000}" >
                            {{dt.MAG}}.<strong>{{dt.FLOOR_MAG}} </strong>
                        </td>
                        <td v-else><strong>OUT</strong></td>
                        
                        <!--td v-if="dt.FLOOR_MAG>0">{{dt.FLOOR_MAG}} </td>
                        <td v-else></td-->

                        <td v-if="dt.FAMILY.trim().length>0" @click="goToLayout(dt.ID, dt.EXTRACT, dt.STATUS, dt.FLOOR_MAG)">
                            <span>
                                <img src="../../assets/link.png" width="20em"/>
                                &nbsp;
                                {{dt.FAMILY}}
                            </span>
                        </td>
                        <td v-else></td>

                        <!--td  :class="getClassFromStatusDesc(dt.STATUS_DESC)">
                            {{ dt.STATUS_DESC.toString().trim() }}
                        </td-->

                        <td  id='hide'>{{dt.DESCR.trim()}}</td>
                        <!--td>{{dt.N_PLACE}}</td-->
                        <!--td>{{dt.N_RAW}}</td>
                        <td>{{dt.N_EMPTY}}</td>
                        <td>{{dt.N_FINISHED}}</td-->
                        <td>
                            <orderCMD  
                                modify="true"               @cmdModify="updateTray(dt.ID)"
                                del="true"                  @cmdDel="sicurezza(dt.ID)"
                                :move="dt.FLOOR_MAG>0 && (dt.EXTRACT==1 || allInside)"  @cmdMove="sendToBox(dt.EXTRACT, dt.FLOOR_MAG)"
                                :moveDisable="!dataStored.cmdActiveMission" 
                            />
                        </td>
                    </tr>
                    <tr v-if="_showPopUp(dt.ID)">
                        <td class="popUpOnLine" colspan="20" >
                            <div class="center">
                                <h3>{{ $t('tray.sure') }}</h3>
                                <h4>{{ $t('tray.delete') }}</h4>
                                <span class="pure-g">
                                    <button class="pure-button button-error pure-u-1" @click="deleteTray(dt.ID)">
                                        DELETE
                                    </button>
                                    <button class="pure-button butto-secondary pure-u-1" @click="showPopUp=0" style="margin-top:9px">
                                        EXIT
                                    </button>
                                </span>
                            </div>
                        </td>
                    </tr>
                </template>
            </tbody>
        </table>
        <br><br><br><br><br><br><br><br>
      </div>
</template>

<script>
export default {
    data(){
        return {
            datiTab:[],
            showPopUp:0,
            //polling:true,
			allInside:false
        }
    },
    methods: {
        getDataTable() {
            fetch(dataStored.server+'api/conf/tray/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(trays => {
                    console.log("ricevo dati per "+trays.length+" cassetti")  
                    //console.log(trays[0].FLOOR_MAG + " "+trays[0].EXTRACT)
                    //console.log(trays[1].FLOOR_MAG + " "+trays[1].EXTRACT)
                    this.datiTab=trays  
					this.allInside=true;
					for (let i=0; i<this.datiTab.length; i++){
						if (this.datiTab[i].EXTRACT == 1)
							this.allInside=false;
					}
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        updateTray(i){
            //alert("modifica "+i);
            this.$router.push('/conf/tray?trayID='+i);
            //this.$router.push({ name: 'conf/tray', params:{trayID: i}} );
        },
        sicurezza(i){
            this.showPopUp=i
            //alert("ricevo "+i)
        },
        /*moveTray(ID){
            let query = 'api/conf/tray/extract/'
            for(let j=0;j<this.datiTab.length;j++){
                if (this.datiTab[j].ID != ID ) continue;
                if(this.datiTab[j].EXTRACT==1){
                    //se è estratto 
                    query = 'api/conf/tray/insert/'
                }else
                    if(this.datiTab[j].EXTRACT==1000){
                        //se è in estrazione
                        query = 'api/conf/tray/resetExtract/';
                    }else
                        if (this.datiTab[j].EXTRACT==2000) {
                            //se è in inserimento 
                            query = 'api/conf/tray/resetInsert/';
                        }
            }
            fetch(dataStored.server+query+ID ,{ method: 'get'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        */
        deleteTray(i){
            this.showPopUp=0
            fetch(dataStored.server+'api/conf/tray/'+i ,{ method: 'delete'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
            this.getDataTable();
        },
        createTray(){
            this.$router.push('/conf/tray');
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
        },
        getClassFromStatusDesc(status){
            //alert(JSON.stringify(status,null,4))
            return status.toString().trim().toLowerCase();
        },
        goToLayout(trayID, extracted, status, floorMag){
            //this.$router.push('/conf/Grating/'+trayID);
            if (extracted || 
                status==dataStored.status_working || 
                status==dataStored.status_locked  ||
                status==dataStored.status_paused  )
                //modifiche non permesse
                this.$router.push('/layout/'+trayID+"/0/"+floorMag);
            else
                this.$router.push('/layout/'+trayID+"/1/"+floorMag);
        },
        sendToBox(extracted,num){
            if (extracted)
			    dataStored.WS.socket.emit("TO_PLANT/CMD/BOX", "26;"+num); //release  ??? codice missione scritto
            else
                dataStored.WS.socket.emit("TO_PLANT/CMD/BOX", "25;"+num); //extract
		}
    },
    computed:{
        locked(){
            if (dataStored.userLevel<=1)
                return 'locked4maintenance'
            return ''
        }
    },
    mounted(){
        this.getDataTable();
        //setInterval(() => {
        //    if(this.polling)
        //        this.getDataTable()
        //}, 3000);
        dataStored.WS.socket.on('BOX/STATUS', ()=>{
          this.getDataTable()
        })
    },
    unmounted(){
        //this.polling=false;
        //dataStored.WS.socket.off('BOX/STATUS');
    }
}
</script>

<style scoped>
    .pure-table-horizontal  #td {
        justify-content: center;
        display: flex;
    }
    .pure-table{
        width: inherit;
    }

    .extractedRow {
        border: dashed 4px;
        border-color: blue;
    }
    .extractReq{
        border: dashed 2px;
        border-color: ligthblue;

    }

    .extract{
        background-image: url('/src/assets/extractTray.PNG');
        background-position-x: 56px;
        background-position-y: 50%;
        background-repeat: no-repeat;
    }

    .extractBlink{
        background-image: url('/src/assets/extractTray.PNG');
        background-position-x: 56px;
        background-position-y: 50%;
        background-repeat: no-repeat;
        animation: blink 1s;
        animation-iteration-count: infinite;
    }

    .releaseBlink{
        background-image: url('/src/assets/insertTray.PNG');
        background-position-x: 56px;
        background-position-y: 50%;
        background-repeat: no-repeat;
        animation: blink 1s;
        animation-iteration-count: infinite;
    }

    @keyframes blink {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
    }
    
    .button-error {
        background: rgb(202, 60, 60);
        color: white;
        border-radius: 4px;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
    }

    .popUpOnLine{
        background-image: url(/src/assets/up_red.png);
        background-repeat: no-repeat;
        background-position-x: 14.6em;
    }
    
    .center {
        margin: auto;
        width: 20%;
        border: 3px solid #ef000082;
        /*background-color: #ef000036;*/
        padding: 40px;
    }
    
</style>

<style scoped>
    #locked4OP{
        background-image:url('/src/assets/chiaveIng.svg');
        background-repeat: no-repeat;
        background-size: 1.5em;
        background-position-x: 100%;
        background-position-y: 100%;
    } 
    .paused {
        color: gray;
        background-color: lightblue;
        opacity: 90%;
        color: black;
        border-radius: 20px;
        /* background-image: url(/src/assets/pause.png);
            background-repeat: no-repeat;
            background-size: 50px;
            background-position-x: 0%;
            background-color:lightgray;*/
    }

    .finished {
        background-color: #080866;
        /*#ff0000ab;*/
        opacity: 90%;
        color: white;
        border-radius: 12px;
    }

    .stop {
        background-color: #eb2c2c;
        opacity: 90%;
        color: black;
        border-radius: 12px;
        /* background-image: url('../assets/stop.png');
            background-repeat: no-repeat;
            */
    }

    .abort {
        background-color: #ff0000ab;
        opacity: 90%;
        color: white;
        border-radius: 12px;
    }

    .working {
        background-color: lightblue;
        opacity: 90%;
        color: black;
        border-radius: 12px;
    }

    .raw {
        background-color: green;
        /*lime;*/
        opacity: 90%;
        color: white;
        border-radius: 12px;
    }
</style>
