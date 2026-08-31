<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';


    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    import { KO_ACTIVE_ORDER } from '../../util/errorCodes';

    const el = ref()
</script>

<template>   
      <div class="view-shell view-shell--fill conf-card">
        <div class="view-header">
          <h3 class="view-title">{{$t('grating.welcome')}}</h3>
          <div class="btn-group">
            <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="createGrating()">
              {{$t('grating.createNew')}}
            </button>
            <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="importGrating()">
              {{$t('grating.importNew')}}
            </button>
          </div>
        </div>
        <div class="table-scroll">
        <table class="pure-table pure-table-horizontal">
            <thead>
                <tr>
                    <th>{{$t('grating.name')}}</th>
                    <th>{{$t('grating.descr')}}</th>
                    <th>{{$t('TRAY')}}</th>
                    <th>{{$t('GRIPPER')}}</th>
                    <th>{{$t('PIECE')}}</th>
                    <th>{{$t('grating.comands')}}</th>
                </tr>
            </thead>
            <tbody>
                <template v-for="(dt) in datiTab" :key="dt.ID" >
                    <tr :class="{'pure-table-odd':(dt.ID % 2==1)}">
                        <td>{{dt.NAME.trim()}} </td>
                        <td>{{dt.DESCR.trim()}}</td>
                        <td @click="goToLayout(dt.TRAY_ID, dt.TraySTATUS, dt.FLOOR_MAG)">
                            <span>
                                <img src="../../assets/link.png" width="20em"/>
                                &nbsp;
                                {{ dt.FLOOR_MAG>=0?dt.FLOOR_MAG:'OUT' }}
                            </span>
                        </td>
                        <td>{{ dt.GRIPPER_DESC }}</td>
                        <td>{{ dt.PIECE_ID }}</td>
                        <td>
                            <orderCMD  :reference="createLink( dt.ID )" 
                                       :index="dt.ID"
                                       modify="true" @cmdModify="$router.push('/conf/grating/'+dt.ID);"
                                       del="true"	 @cmdDel="sicurezza(dt.ID)"
                                       >
                            </orderCMD>
                        </td>
                    </tr>
                    <tr v-if="_showPopUp(dt.ID)">
                        <td class="popUpOnLine" colspan="20" >
                            <div class="center">
                                <h3>{{ $t('tray.sure') }}</h3>
                                <h4>{{ $t('grating.delete') }}</h4>
                                <span class="pure-g">
                                    <button class="pure-button-micromission specialCMD pure-u-1" @click="deleteGrating(dt.ID)">
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
      </div>
</template>

<script>
export default {
    data(){
        return {
            datiTab:[],
            statusList:[],
            showPopUp:0,
			polling:true
        }
    },
    methods: {
        getDataTable() {
            fetch(dataStored.server+'api/conf/grating/showcompleteData/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(gratings => {
                    //console.log(JSON.stringify(order,null,4))
                    console.log("ricevo dati per "+gratings.length+" grigliati")  
                    this.datiTab=gratings
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        createGrating(){
            this.$router.push('/conf/grating/0');  //passando ID=0 allora significa che è un nuovo grigliato da fare
        },
        importGrating(){
            this.$router.push('/conf/importGrating');  //prova bottone grating esistente
        },
        createLink(id) {
            let stringObj = new String(id);
            return "/conf/Grating/"+ stringObj ;
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
        },
        sicurezza(i){
            this.showPopUp=i
        },
		deleteGrating(id) {
			this.showPopUp=0
            // (tray-parent-predicate) la route server cancella GIA' in un
            // colpo solo GRATING + tasche [POSITION] del cassetto associato
            // (con guardia ordine attivo). La vecchia chiamata concatenata
            // deletePositionsTray(id) e' stata rimossa: passava l'ID del
            // GRIGLIATO come numero di cassetto (chiave sbagliata).
            fetch(dataStored.server+'api/conf/grating/'+id ,{ method: 'delete'})
                .then(async response => {
                    if (!response.ok) {
                        alert('Network response was not ok');
                        throw new Error('Network response was not ok');
                    }
                    const esito = (await response.text()).trim();
                    if (esito == KO_ACTIVE_ORDER) {
                        alert(this.$t('grating.deleteBlockedOrder'));
                        return;
                    }
                    if (esito != 'OK')
                        alert('KO ['+esito+']');
                })
                .catch(error => {
                    console.info(error);
					alert(error);
                });
        },
        goToLayout(Tray_ID,TraySTATUS,floor_MAG){
            if (TraySTATUS==dataStored.status_working) 
                this.$router.push('/layout/'+Tray_ID+'/0/'+floor_MAG);
            else    
                this.$router.push('/layout/'+Tray_ID+'/1/'+floor_MAG);
        },
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
    .popUpOnLine .btn-ghost {
        margin-top: var(--space-2);
    }

    /* Uniformato alle altre list view: 2px (non 1px --border-card), il popup
       di conferma delete deve staccare piu' di un bordo card. */
    .center {
        margin: auto;
        width: 20%;
        border: 2px solid var(--color-critical);
        padding: var(--space-6);
    }
</style>
