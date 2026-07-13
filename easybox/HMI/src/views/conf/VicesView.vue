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
          <h3 class="view-title">{{$t('vice.welcome')}}</h3>
          <button class="pure-button pure-button-primary"  :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="createVice()">
            {{$t('vice.add_Vice')}}
          </button>
        </div>
        <table class="pure-table pure-table-horizontal">
            <thead>
                <tr>
                    <!--th>ID</th-->
                    <th>{{$t('vice.name')}}</th>
                    <th>{{$t('vice.stato')}}</th>
                    <th>{{$t('vice.family')}}</th>
                    <th>{{$t('vice.descr')}}</th>
                    <th>{{$t('vice.posizione')}}</th>
                    
                    <th>{{$t('vice.comands')}}</th>
                </tr>
            </thead>
            <tbody>
                <template v-for="dt in datiTab" :key="dt.ID" >
                    <tr :class="{'pure-table-odd':(dt.ID % 2==1)}">
                        <!--td>{{dt.ID}} </td-->
                        <td v-if="dt.MAG>0">{{dt.MAG}}.{{dt.MAG_POS}} </td>
                        <td v-else><strong>OUT</strong></td>
                            
                        <td :class="dt.STATUS_DESC">{{ dt.STATUS_DESC.trim() }}</td>
                        <td>{{dt.FAMILY}} </td>
                    
                        <td>{{dt.DESCR.trim()}}</td>
                        <td>{{dt.POS_PLANT>200?'MC 2':dt.POS_PLANT>100?'MC 1':'MAG '+dt.MAG}}</td>
                        
                        <td>
                            <orderCMD  
                                modify="true"   @cmdModify="updateVice(dt.ID)"
                                del="true"      @cmdDel="sicurezza(dt.ID)"
                            />
                        </td>
                    </tr>
                    <tr v-if="_showPopUp(dt.ID)">
                        <td class="popUpOnLine" colspan="20" >
                            <div class="center">
                                <h3>{{ $t('vice.sure') }}</h3>
                                <h4>{{ $t('vice.delete') }}</h4>
                                <span class="pure-g">
                                    <button class="pure-button-micromission specialCMD pure-u-1" @click="deleteVice(dt.ID)">
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
            fetch(dataStored.server+'api/conf/vice/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    console.log("ricevo dati per "+data.length+" morse")  
                    this.datiTab=data                    
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        updateVice(i){
            //alert("modifica "+i);
            this.$router.push('/conf/vice?viceID='+i);
            //this.$router.push({ name: 'conf/tray', params:{trayID: i}} );
        },
        sicurezza(i){
            this.showPopUp=i
            //alert("ricevo "+i)
        },
        moveVice(i){
            //comando il ROBOT a estrarre/riporre il cassetto
        },
        deleteVice(i){
            this.showPopUp=0
            fetch(dataStored.server+'api/conf/vice/'+i ,{ method: 'delete'})
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
        createVice(){
            this.$router.push('/conf/vice');
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
        background-position-x: 34%;
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
