<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';
    import UiButton from '../../components/ui/UiButton.vue';
    import { Lock, Plus } from 'lucide-vue-next';
    
    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    const el = ref()
</script>

<template>
      <!-- (v3 fase D) Attrezzaggio · Morse: card come i cataloghi del
           Magazzino (assets/css/catalog-v3.css), invece della tabella.
           Comandi, guardie e conferme quelli di prima: Modifica e Cancella dal
           componente di sempre (ComandsRows, stesse props ed eventi),
           la conferma di cancellazione nella card con gli stessi testi. Aggiungi spento sotto il livello 2, come prima
           (pure-button-disabled). tests/test_golden_equivalenza.mjs -->
      <div class="view-shell view-shell--fill cat">
        <div class="cat-head">
          <h2 class="cat-head__title">{{$t('vice.welcome')}}</h2>
          <UiButton variant="primary" :icon="dataStored.userLevel<=1 ? Lock : Plus"
                  :disabled="dataStored.userLevel<=1" @click="createVice()">
            {{$t('vice.add_Vice')}}
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
                <div><dt>{{$t('vice.name')}}</dt>
                  <dd v-if="dt.MAG>0">{{dt.MAG}}.{{dt.MAG_POS}}</dd>
                  <dd v-else>{{ $t('common.out') }}</dd>
                </div>
                <div><dt>{{$t('vice.stato')}}</dt><dd :class="dt.STATUS_DESC">{{ dt.STATUS_DESC.trim() }}</dd></div>
              </dl>
              <div class="cat-card__actions">
                <orderCMD  
                    modify="true"   @cmdModify="updateVice(dt.ID)"
                    del="true"      @cmdDel="sicurezza(dt.ID)"
                />
              </div>
              <div v-if="_showPopUp(dt.ID)" class="cat-card__confirm">
                <div class="cat-card__sure"><b>{{ $t('vice.sure') }}</b><span>{{ $t('vice.delete') }}</span></div>
                <UiButton variant="danger" size="min" @click="deleteVice(dt.ID)">
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
    /* (UI v2 fase 1.5) colori degli stati = quelli delle tasche (doc §11),
       come FixturesView e productionTable */
    .PAUSED {
        color: var(--text-muted);
        border-radius: var(--radius-lg);
    }

    .FINISHED {
        background-color: var(--color-success-bg);
        color: var(--pocket-finished);
        border-radius: var(--radius-lg);
    }

    .STOP {
        background-color: var(--color-danger-bg);
        color: var(--color-danger);
        border-radius: var(--radius-lg);
    }

    .ABORT {
        background-color: var(--color-danger-bg);
        color: var(--pocket-abort);
        border-radius: var(--radius-lg);
    }

    .WORKING {
        background-color: var(--color-warning-bg);
        color: var(--pocket-working);
        border-radius: var(--radius-lg);
    }

    .RAW {
        background-color: var(--color-info-bg);
        color: var(--pocket-raw);
        border-radius: var(--radius-lg);
    }

    /* grigio e nero: testo leggibile, il colore dello stato sul bordo */
    .EMPTY {
        border: 2px solid var(--pocket-empty);
        color: var(--text-secondary);
        border-radius: var(--radius-lg);
    }

    .LOCK,
    .LOCKED {
        background-color: var(--color-warning-bg);
        color: var(--pocket-locked);
        border-radius: var(--radius-lg);
    }

    .NOT_DEFINED {
        background-color: var(--pocket-undef);
        border: 2px solid var(--pocket-undef-border);
        color: var(--text-primary);
        border-radius: var(--radius-lg);
    }
</style>
