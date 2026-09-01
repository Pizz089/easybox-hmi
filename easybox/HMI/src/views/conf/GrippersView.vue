<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import buttonsCMD from '../../components/Comands/ComandsRows.vue';

    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    import { dedupeGrippers, isTwinGripper } from '../../util/grippers.js';
    const el = ref()
</script>

<template>   
      <div class="view-shell view-shell--fill conf-card">
        <div class="view-header">
          <h3 class="view-title">{{$t('gripper.welcome')}}</h3>
          <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="CreateGripper()" >
            {{$t('gripper.add_gripper')}}
          </button>
        </div>

        <div class="table-scroll">
        <table class="pure-table pure-table-horizontal">
            <thead>
                <tr>
                    <!--th>{{$t('gripper.name')}}</th-->
                    <th>{{$t('gripper.family')}}</th>
                    <th style='width:22%'>{{$t('gripper.descr')}}</th>
                    <th>{{$t('gripper.stato')}}</th>
                    <th>{{$t('gripper.position')}}</th>
                    <th>{{$t('gripper.comands')}}</th>
                </tr>
            </thead>
            <tbody>
                <template v-for="(dt, index) in datiTab" :key="dt.ID" >
                    <tr :class="{'pure-table-odd':(index%2==1)}" >
                        <!--td>{{dt.ID}} </td-->
                        <!-- (gripper-twins) UNA riga per pinza fisica (util/grippers.js,
                             riga canonica = ID minore): via le celle unite del
                             modello legacy SUB_POS 0/1/>1 che lasciavano la
                             FAMILY vuota sulla doppia (gemelle a SUB_POS 3) -->
                        <td>
                            {{dt.FAMILY.trim()}}
                            <span v-if="isTwinGripper(dt)" class="twin-badge">{{ $t('gripper.twinBadge', { ids: dt.twinIDs.join('+') }) }}</span>
                        </td>
                        <td class="cell-descr">{{dt.DESCR.trim()}}</td>
                        <td>{{ $t(dt.STATUS_DESC.trim()) }}</td>
                        <td v-html="calculatePos(index)" class="cell-pos"> </td>
                        <td>
                            <buttonsCMD  :reference="createLink( dt.ID )"
                                       :index="toStr(dt.ID)"
                                       modify=true                      @cmdModify="modifyGripper(dt.ID)"
                                       del=true                         @cmdDel="deleteGripper(dt.ID)"
                                       :move="dt.POS_PLANT>=0 && (!gripperOnRobot || (gripperOnRobot && dt.POS_PLANT==1000))"   @cmdMove="PickReleaseGripper(dt.ID)"
                                       :moveDisable="!dataStored.cmdActive" >
                                       <!--:move="dt.POS_PLANT!=1000 || !gripperOnRobot"   @cmdMove="PickReleaseGripper(dt.ID)"-->
                            </buttonsCMD>
                        </td>
                    </tr>
                </template>
            </tbody>
        </table>
        </div>
      </div>
</template>

<script>
export default {
    data(){
        return {
            popup:false,
            datiTab:[],
            statusList:[],
            polling:true
        }
    },
    methods: {
        getDataTable() {
            fetch(dataStored.server+'api/conf/gripper/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(pinze => {
                    //console.log(JSON.stringify(order,null,4))
                    console.log("ricevo dati per "+pinze.length+" pinze")
                    // (gripper-twins) una riga per pinza fisica
                    const rows = dedupeGrippers(pinze);
                    if (JSON.stringify(this.datiTab) !== JSON.stringify(rows)){
                        this.datiTab=rows
						//this.gripperOnRobot=false
						//for (let i=0; i<this.datiTab.length; i++){
                        //    if (this.datiTab[i].POS_PLANT > 1000)
                        //        this.gripperOnRobot=true;
                        //}
                    }
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        CreateGripper(){
            this.$router.push('/conf/Gripper/Gripper');
        },
        createLink(id) {
            let stringObj = new String(id);
            return "/conf/Gripper/gripper" ;
            //return "/conf/Gripper/gripper/"+stringObj ;
        },
        toStr(id) {
            let stringObj = new String(id);
            return parseInt(stringObj);
        },
        calculatePos(i) {
            //console.log("ui "+JSON.stringify(this.datiTab[i],null,4))
            if (this.datiTab[i].POS_PLANT==1000)
                return '<strong>ROBOT<strong>';
            if (this.datiTab[i].POS_PLANT<0)
                return this.$t('OUT');
            // (gripper-twins) SUB_POS non e' una sotto-posizione di scaffale ma
            // la chiave delle gemelle: la posizione e' il solo POS_MAG
            return this.datiTab[i].POS_MAG;
        },
        PickReleaseGripper(ID){
            for(let i=0; i<this.datiTab.length; i++){
                if (this.datiTab[i].POS_PLANT==1000){    
                    //c'e' almeno una pinza montata su robot => la scarico
                    this.sendToRobot(12);
                    return;
                }
            }
            //robot senza pinza => carico la pinza richiesta
            this.sendToRobot("11;"+ID);
        },
        modifyGripper(gripperID){
            this.$router.push('/conf/gripper/gripper?gripperID='+gripperID);
        },
        deleteGripper(ID){
            if (window.confirm(this.$t('gripper.delete'))){
                fetch(dataStored.server+'api/conf/gripper/'+ID ,{ method: 'delete'})
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
            }
        },
        sendToRobot(val) {
            dataStored.WS.socket.emit("TO_PLANT/CMD/ROBOT", val);
        }
    },
    computed:{
        gripperOnRobot(){
            for(let i=0; i<this.datiTab.length; i++){
                if (this.datiTab[i].POS_PLANT==1000)
                    return true;
            }
            return false;
        },
        locked(){
            if (dataStored.userLevel<=1)
                return 'locked4maintenance'
            return ''
        }
    },
    mounted(){
        this.getDataTable()
        setInterval(() => {
            if(this.polling)
                this.getDataTable()
        }, 3000);
    },
    unmounted(){
        this.polling=false;
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

    /* (gripper-twins) badge "doppia" sulla riga canonica */
    .twin-badge {
        display: inline-block;
        margin-left: var(--space-2);
        padding: 0 var(--space-2);
        border: 1px solid var(--accent);
        border-radius: var(--radius-sm);
        color: var(--accent);
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .cell-descr {
        max-width: 20%;
    }
    .cell-pos {
        max-width: 30px;
    }
</style>
