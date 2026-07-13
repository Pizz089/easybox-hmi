<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';
    
    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    const el = ref()
</script>

<template>   
      <div class="view-shell conf-card">
        <div class="view-header">
          <h3 class="view-title">{{$t('fixture.welcome')}}</h3>
          <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="createfixture()">
            {{$t('fixture.add_fixture')}}
          </button>
          <!--button class="pure-button pure-button-primary" @click="$router.push('/conf/fixtureOnPallet');">
            {{$t('fixture.PosOnPallet')}}
          </button-->
        </div>
        <table class="pure-table pure-table-horizontal">
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
                                    <button class="pure-button-micromission specialCMD pure-u-1" @click="deletefixture(dt.ID)">
                                        DELETE
                                    </button>
                                    <button class="btn-ghost pure-u-1" @click="showPopUp=0">
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

    .popUpOnLine{
        background-image: url(/src/assets/up_red.png);
        background-repeat: no-repeat;
        background-position-x: 14.6em;
    }

    .popUpOnLine .btn-ghost {
        margin-top: var(--space-2);
    }

    /* 2px (non 1px --border-card): il popup di conferma delete deve
       staccare piu' di un bordo card. */
    .center {
        margin: auto;
        width: 20%;
        border: 2px solid var(--color-critical);
        padding: var(--space-6);
    }

    /* Badge status: semantica allineata a productionTable (dashboard). */
    .PAUSED {
        color: var(--text-muted);
        border-radius: var(--radius-lg);
    }

    .FINISHED {
        background-color: var(--bg-surface-2);
        color: var(--text-secondary);
        border-radius: var(--radius-lg);
    }

    .STOP {
        background-color: var(--color-danger-bg);
        color: var(--color-danger);
        border-radius: var(--radius-lg);
    }

    .ABORT {
        background-color: var(--color-danger-bg);
        color: var(--color-danger);
        border-radius: var(--radius-lg);
    }

    .WORKING {
        background-color: var(--color-success-bg);
        color: var(--color-success);
        border-radius: var(--radius-lg);
    }

    .EMPTY {
        background-color: var(--color-info-bg);
        color: var(--color-info);
        border-radius: var(--radius-lg);
    }
</style>
