<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';
    import UiButton from '../../components/ui/UiButton.vue';
    import { Lock, Plus } from 'lucide-vue-next';
    
    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    // (pallet MC 16/9) la posizione dei comandi 13/14 NON e' MAG_POS grezzo:
    // MAG_POS negativo vuol dire "fuori magazzino", e il pallet in macchina
    // vuole posizione 0. Regola in un punto solo, condivisa con la pagina robot.
    import { palletPickPosition, palletPlacePosition, palletIsInMachine } from '../../util/warehouseGrid';
    const el = ref()
</script>

<template>
      <!-- (v3 fase D) Attrezzaggio · Pallet: card come i cataloghi del
           Magazzino (assets/css/catalog-v3.css), invece della tabella.
           Comandi, guardie e conferme quelli di prima: Modifica, Cancella e Muovi dal
           componente di sempre (ComandsRows, stesse props ed eventi),
           la conferma di cancellazione nella card con gli stessi testi. Aggiungi spento sotto il livello 2, come prima
           (pure-button-disabled). tests/test_golden_equivalenza.mjs -->
      <div class="view-shell view-shell--fill cat">
        <div class="cat-head">
          <h2 class="cat-head__title">{{$t('pallet.welcome')}}</h2>
          <UiButton variant="primary" :icon="dataStored.userLevel<=1 ? Lock : Plus"
                  :disabled="dataStored.userLevel<=1" @click="createPallet()">
            {{$t('pallet.add_Pallet')}}
          </UiButton>
        </div>
        <div class="cat-list">
          <template v-for="dt in datiTab" :key="dt.ID" >
            <article class="cat-card">
              <div class="cat-card__head">
                <span class="cat-card__code">{{dt.FAMILY}}</span>
              </div>
              <span class="cat-card__desc">{{dt.DESCR.trim()}}</span>
              <dl class="cat-card__facts">
                <!-- (16/9) "OUT" non diceva DOVE: col pallet in macchina
                     l'operatore non capiva perche' non poteva comandarlo -->
                <div><dt>{{$t('pallet.name')}}</dt>
                  <dd v-if="dt.MAG_POS>0">{{dt.MAG}}.{{dt.MAG_POS}}</dd>
                  <dd v-else-if="inMachine(dt)">{{ $t('pallet.inMachine') }}</dd>
                  <dd v-else>{{ $t('common.out') }}</dd>
                </div>
              </dl>
              <div class="cat-card__actions">
                <!-- (pallet MC 16/9) il gate del Muovi e' "la posizione si sa
                     comporre": per la macchina vale 0, come chiede FB7 -->
                                <orderCMD  
                                    modify="true"   @cmdModify="updatePallet(dt.ID)"
                                    del="true"      @cmdDel="sicurezza(dt.ID)"
                :move="movePos(dt) !== null && (palletID_OnRobot==0 || palletID_OnRobot==dt.ID)"     
                                                    @cmdMove="sendToRobot( (dataGripper.STATUS==2?'13;':'14;')+
                                                        dataStored.Pallet+';'+
                                                        dt.ID+';'+
                                                        movePos(dt)
                                                    )"
                                    :moveDisable="!dataStored.cmdActiveMission"                                             
                                />
              </div>
              <div v-if="_showPopUp(dt.ID)" class="cat-card__confirm">
                <div class="cat-card__sure"><b>{{ $t('pallet.sure') }}</b><span>{{ $t('pallet.delete') }}</span></div>
                <UiButton variant="danger" size="min" @click="deletePallet(dt.ID)">
                  {{ $t('rowCmd.delete') }}
                </UiButton>
                <UiButton variant="outline" size="min" @click="showPopUp=0">
                  {{ $t('common.cancel') }}
                </UiButton>
              </div>
            </article>
          </template>
        </div>
      </div>
</template>

<script>
export default {
    data(){
        return {
            datiTab:[],
            showPopUp:0,
            polling:true,
            dataGripper:{},
            palletID_OnRobot:0
        }
    },
    methods: {
        getDataTable() {
            fetch(dataStored.server+'api/conf/pallet/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    console.log("ricevo dati per "+data.length+" pallet")  
                    this.datiTab=data;
                    
                    for(let i=0;i<this.datiTab.length;i++){
                        if (this.datiTab[i].POS_PLANT == 1000){
                            this.palletID_OnRobot = this.datiTab[i].ID; 
                            return
                        }
                    }
                    this.palletID_OnRobot = 0;
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        getDataGripperOnRobot() {
            fetch(dataStored.server + 'api/conf/gripper/onrobot', { method: 'GET' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                    })
                .then(gripper => {
                    if (JSON.stringify(gripper) == JSON.stringify([]))
                        this.dataGripper = {}
                    else
                        this.dataGripper = gripper[0];
                    })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        updatePallet(i){
            this.$router.push('/conf/pallet?palletID='+i);
            //this.$router.push({ name: 'conf/tray', params:{trayID: i}} );
        },
        sicurezza(i){
            this.showPopUp=i
            //alert("ricevo "+i)
        },
        deletePallet(i){
            this.showPopUp=0
            fetch(dataStored.server+'api/conf/pallet/'+i ,{ method: 'delete'})
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
        createPallet(){
            this.$router.push('/conf/pallet');
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
        },
        // Posizione per il comando: PRELIEVO se la pinza pallet e' vuota
        // (dataGripper.STATUS==2 -> 13), DEPOSITO altrimenti (14). Il prelievo
        // sa leggere anche "dalla macchina" (0); il deposito vuole un posto
        // assegnato, perche' la destinazione non si deduce da dove il pallet
        // stava. null = comando non componibile -> bottone assente.
        movePos(dt) {
            return this.dataGripper && this.dataGripper.STATUS == 2
                ? palletPickPosition(dt)
                : palletPlacePosition(dt);
        },
        inMachine(dt) {
            return palletIsInMachine(dt);
        },
        sendToRobot(val) {
            dataStored.WS.socket.emit("TO_PLANT/CMD/ROBOT", val);
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
        this.getDataGripperOnRobot();
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
