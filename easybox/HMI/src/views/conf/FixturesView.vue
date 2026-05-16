<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';
    
    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    const el = ref()
</script>

<template>   
      <div class="pure-u-1-24">
          &nbsp;
      </div>
      
      <div class="pure-u-23-24">
        <h3>{{$t('fixture.welcome')}}
            &nbsp;
            <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="createfixture()">
            {{$t('fixture.add_fixture')}}
          </button>
          &nbsp;
          <!--button class="pure-button pure-button-primary" @click="$router.push('/conf/fixtureOnPallet');">
            {{$t('fixture.PosOnPallet')}}
          </button-->
        </h3>
        <table class="pure-table pure-table-horizontal" style="margin-top: 30px;">
            <thead>
                <tr>
                    <!--th>ID</th-->
                    <th>{{$t('fixture.posizione')}}</th>
                    <th>{{$t('fixture.stato')}}</th>
                    <th>{{$t('fixture.family')}}</th>
                    <th style='width:20%'>{{$t('fixture.descr')}}</th>
                    <!--th>{{$t('fixture.posizione')}}</th-->
                    
                    <!--th>{{$t('fixture.comands')}}</th-->
                    <th>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <template v-for="dt in datiTab" :key="dt.ID" >
                    <tr :class="{'pure-table-odd':(dt.ID % 2==1)}">
                        <!--td>{{dt.ID}} </td-->
                        <!--td v-if="dt.MAG>0">{{dt.MAG}}.{{dt.MAG_POS}} </td>
                        <td v-else><strong>OUT</strong></td-->

                        <td>{{dt.POS_PLANT<=0?'OUT':'PALLET '+dt.POS_PLANT}}</td>
                            
                        <td :class="dt.STATUS_DESC">{{ dt.STATUS_DESC.trim() }}</td>
                        <td>{{dt.FAMILY}} </td>
                    
                        <td>{{dt.DESCR.trim()}}</td>
                        
                        <td>
                            <orderCMD  
                                modify="true"   @cmdModify="updatefixture(dt.ID)"
                                del="true"      @cmdDel="sicurezza(dt.ID)"
                            />
                            <!--place="true"    @cmdPlace="callPage(dt.ID)" -->
                        </td>
                    </tr>
                    <tr v-if="_showPopUp(dt.ID)">
                        <td class="popUpOnLine" colspan="20" >
                            <div class="center">
                                <h3>{{ $t('fixture.sure') }}</h3>
                                <!--h4>{{ $t('fixture.delete') }}</h4-->
                                <span class="pure-g">
                                    <button class="pure-button button-error pure-u-1" @click="deletefixture(dt.ID)">
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
      </div>
</template>

<script>
export default {
    data(){
        return {
            datiTab:[],
            showPopUp:0,
            polling:true
        }
    },
    methods: {
        getDataTable() {
            fetch(dataStored.server+'api/conf/fixture/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    console.log("ricevo dati per "+data.length+" Attrezzature")  
                    this.datiTab=data                    
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        updatefixture(i){
            //alert("modifica "+i);
            this.$router.push('/conf/Fixture?fixtureID='+i);
            //this.$router.push({ name: 'conf/tray', params:{trayID: i}} );
        },
        sicurezza(i){
            this.showPopUp=i
            //alert("ricevo "+i)
        },
        movefixture(i){
            //comando il ROBOT a estrarre/riporre il cassetto
        },
        deletefixture(i){
            this.showPopUp=0
            fetch(dataStored.server+'api/conf/fixture/'+i ,{ method: 'delete'})
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
        createfixture(){
            this.$router.push('/conf/fixture');
        },
        callPage(id){
            this.$router.push('/conf/fixtureOnPallet/'+id);
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
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
    
    .PAUSED {
        color: gray;
        background-color: lightblue;
        opacity: 90%;
        color: black;
        border-radius: 20px;
    }

    .FINISHED {
        background-color: #080866;
        /*#ff0000ab;*/
        opacity: 90%;
        color: white;
        border-radius: 12px;
    }

    .STOP {
        background-color: #eb2c2c;
        opacity: 90%;
        color: black;
        border-radius: 12px;
        /* background-image: url('../assets/stop.png');
            background-repeat: no-repeat;
            */
    }

    .ABORT {
        background-color: #ff0000ab;
        opacity: 90%;
        color: white;
        border-radius: 12px;
    }

    .WORKING {
        background-color: lightblue;
        opacity: 90%;
        color: black;
        border-radius: 12px;
    }

    .EMPTY {
        background-color: green;
        /*lime;*/
        opacity: 90%;
        color: white;
        border-radius: 12px;
    }
</style>
