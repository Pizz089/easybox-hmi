<script setup>
    import orderCMD from './Comands/ComandsRows.vue'
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../data.js'
</script>

<template>
    <div class="pure-u-1-24"> 
    </div>
    <div class="pure-u-23-24"> 
        <table v-if="orders.length>0" class="pure-table pure-table-horizontal " style="margin-top: 30px;">
            <!--thead>
                <tr>
                    <th>{{ $t('production.order')}}</th>
                    <th>{{ $t('production.status')}}</th>
                    <th>{{ $t('production.part')}}</th>
                    <th>MC</th>
                    <th>{{ $t('production.quantity')}}</th>
                    <th>{{ $t('production.comand')}}</th>
                </tr>
            </thead-->
            <tbody>
                <template v-for="(o,index) in orders" :key="o.ID" >
                    <tr :class="{'pure-table-odd':index%2==1}">
                        <!--td>{{ o.ID }}</td-->
                        <td :class="{'td_odd':index%2==1}">
                            {{ o.PIECE }}
                            <br>
                            <small>{{ o.PIECE_DESC }}</small>
                        </td>
                        <td :class="{'td_odd':index%2==1}">
                            MC{{ o.MACHINE_ID}} 
                        </td>
                        <td class="table-divisor" :class="o.STATUS_DESC">
                        </td>
                        <td :class="{'td_odd':index%2==1}" 
                            style="width: 20%;margin: 0 auto;">
                            {{ o.STATUS_DESC }} 
                            <hr width="30%" style="margin-left:0px">
                            [ {{ o.PP }} ]
                        </td>
                        <!--td>{{ o.GRIPPER }}</td-->
                        
                        <td :class="{'td_odd':index%2==1}">
                            {{ o.PRODUCTED }} / {{ o.QUANTITY }}<br>
                            <progress :value="o.PRODUCTED" :max="o.QUANTITY" style="width:80px"> {{ o.PRODUCTED }} </progress>
                        </td>
                        <td :class="{'td_odd':index%2==1}">
                            <orderCMD 
                                :play=true         @cmdPlay="modifyOrderStatus(o.ID,dataStored.status_working,o.PIECE_ID)"
                                :stop=true         @cmdStop="modifyOrderStatus(o.ID,dataStored.status_raw,o.PIECE_ID)"
                                :del=true          @cmdDel="sicurezza(o.ID, o.STATUS_DESC)"
                                :delDisable="o.STATUS_DESC=='WORKING'"
                            />
                            <!-- PaoloG 30/09
                                :modify=true       @cmdModify="modifyOrder(o.ID)"
                                :modifyDisable="o.STATUS_DESC=='WORKING'"
                            -->
                        </td>
                    </tr>  
                    <tr v-if="_showPopUp(o.ID)">
                        <td class="popUpOnLine" colspan="20" >
                            <div class="center">
                                <h3>{{ $t('production.sure') }}</h3>
                                <!--h4>{{ $t('fixture.delete') }}</h4-->
                                <span class="pure-g">
                                    <span class="pure-u-1-3">&nbsp;</span>
                                    <button class="pure-button button-error pure-u-1-3" style="background-color:coral" @click="deleteOrder(o.ID)">
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
        <h4 v-else>No order yet...</h4>
    </div>
</template>

<script>
export default {
    data(){
        return {
            orders:{},
            createNew:false,
            showPopUp:false
        }
    },
    methods: {
        getDataTable() {
            fetch( dataStored.server+'api/order/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    //console.log("pieces: "+JSON.stringify(data,null,4))
                    //console.log(`Ricevo dati per ${data.length} ordini`);
                    this.orders=data;
                })
                .catch(error => {
                    console.info(error);
                });
        },
        modifyOrder(i){
            //alert("modifica "+i);
            this.$router.push('/selectPiece');
        },
        modifyOrderStatus(id, stat, pieceID){
            dataStored.WS.socket.emit("TO_PLANT/CMD/ORDER", 
                {
                    id: id,
                    status: stat,
                    pieceID: pieceID
                }
            );
        },
        sicurezza(id, desc){
            if (desc == "WORKING") 
                alert ("impossibile cancellare se è in esecuzione")
            else
                this.showPopUp=id
        },
        deleteOrder(i){
            this.showPopUp=0
            fetch(dataStored.server+'api/order/'+i ,{ method: 'delete'})
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
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
        }
    },
    mounted(){
        this.getDataTable();
        dataStored.WS.socket.on('PRODUCTION/CHANGED', ()=>{
            this.getDataTable();
        });
    },
    unmounted(){
       //dataStored.WS.socket.off('PRODUCTION/CHANGED');
    }
}
</script>

<style scoped>
.table-divisor {
    width: 10px;        
    padding: 0px;         
    border-radius: 30px;
}

.pure-table-horizontal #td {
    justify-content: center;
    display: flex;
}

.pure-table {
    width: inherit;
    background-color: transparent;
}

.td_odd{
        background-color: transparent;
}

.PAUSED, .paused {
    color: gray;
    background-color: lightblue;
    opacity: 90%;
    color: black;
    /*border-radius: 12px;*/
    /* background-image: url(/src/assets/pause.png);
        background-repeat: no-repeat;
        background-size: 50px;
        background-position-x: 0%;
        background-color:lightgray;*/
}

.FINISHED, .finished {
    background-color: #080866;
    /*#ff0000ab;*/
    opacity: 90%;
    color: white;    
    /*border-radius: 12px;*/
}

.STOP, .stop {
    background-color: #eb2c2c;
    opacity: 90%;
    color: black;
    /*border-radius: 12px;*/
    /* background-image: url('../assets/stop.png');
        background-repeat: no-repeat;
        */
}

.ABORT, .abort {
    background-color: #ff0000ab;
    opacity: 90%;
    color: white;
    /*border-radius: 12px;*/
}

.WORKING, .working{
    background-color: lightblue;
    opacity: 90%;
    color: gray;
    /*border-radius: 12px;*/
}

.RAW, .raw{
    background-color: limegreen;
    opacity: 90%;
    color: white;
    /*border-radius: 20px;*/
}
</style>
