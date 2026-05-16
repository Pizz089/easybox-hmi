<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import buttonsCMD from '../../components/Comands/ComandsRows.vue';

    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    const el = ref()
</script>

<template>   
      <div class="pure-u-1-24">
          &nbsp;
      </div>

      <div class="pure-u-23-24">
            
        <h3>{{$t('gripper.welcome')}}
          <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="CreateGripper()" >
            {{$t('gripper.add_gripper')}}
          </button>
        </h3>

        <table class="pure-table pure-table-horizontal" style="margin-top: 30px;">
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
                        <!--<td v-if="dt.SUB_POS<=1" :rowspan="getSpan(dt.SUB_POS)"-->
                        <td v-if="dt.SUB_POS==0"  >
                            {{dt.FAMILY.trim()}} 
                        </td>
                        <td v-if="dt.SUB_POS==1" style="border-bottom:0px">
                            {{dt.FAMILY.trim()}} 
                        </td>
                        <td v-if="dt.SUB_POS>1" style="border-top:0px">
                            &nbsp;
                        </td>
                        <td style="max-width:20%">{{dt.DESCR.trim()}}</td>
                        <td>{{ $t(dt.STATUS_DESC.trim()) }}</td>
                        <td v-html="calculatePos(index)" style="max-width: 30px;"> </td>
                        <td>  
                            <buttonsCMD  :reference="createLink( dt.ID )" 
                                       :index="toStr(dt.ID)"
                                       modify=true                      @cmdModify="modifyGripper(dt.ID)"
                                       del=true                         @cmdDel="deleteGripper(dt.ID)"
                                       :move="dt.POS_PLANT>=0 && dt.SUB_POS<=1 && (!gripperOnRobot || (gripperOnRobot && dt.POS_PLANT==1000))"   @cmdMove="PickReleaseGripper(dt.ID)"
                                       :moveDisable="!dataStored.cmdActive" >
                                       <!--:move="dt.POS_PLANT!=1000 || !gripperOnRobot"   @cmdMove="PickReleaseGripper(dt.ID)"-->
                            </buttonsCMD>
                        </td>
                    </tr>
                </template>
            </tbody>
        </table>
        <br>
        <br>
        <br>
        <br>
        <br>
        <br>
        <br>
        <br>
        <br>
        <br>
        <br>
        <br>
        <br>
        <br>
        <br>
        <br>
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
                    if (JSON.stringify(this.datiTab) !== JSON.stringify(pinze)){
                        this.datiTab=pinze
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
            if (this.datiTab[i].SUB_POS>0)
                return this.datiTab[i].POS_MAG+"."+this.datiTab[i].SUB_POS;
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
        },
        getSpan(subpos){
            if (subpos>=1)
                return 2
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
</style>
