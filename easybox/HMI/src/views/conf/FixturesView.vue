<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';
    import UiButton from '../../components/ui/UiButton.vue';
    import { Lock, Plus } from 'lucide-vue-next';
    
    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    import { statoComposizione, quoteComposizione } from '../../util/fixtureComposition.js';
    const el = ref()
</script>

<template>
      <!-- (v3 fase D) Attrezzaggio · Attrezzature: card come i cataloghi del
           Magazzino (assets/css/catalog-v3.css), invece della tabella.
           Comandi, guardie e conferme quelli di prima: Modifica, Cancella e Posiziona dal
           componente di sempre (ComandsRows, stesse props ed eventi),
           la conferma di cancellazione nella card con lo stesso testo. Aggiungi spento sotto il livello 2, come prima
           (pure-button-disabled). tests/test_golden_equivalenza.mjs -->
      <div class="view-shell view-shell--fill cat">
        <div class="cat-head">
          <h2 class="cat-head__title">{{$t('fixture.welcome')}}</h2>
          <UiButton variant="primary" :icon="dataStored.userLevel<=1 ? Lock : Plus"
                  :disabled="dataStored.userLevel<=1" @click="createfixture()">
            {{$t('fixture.add_fixture')}}
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
                <div><dt>{{$t('fixture.posizione')}}</dt><dd>{{dt.POS_PLANT<=0?'OUT':'PALLET '+dt.POS_PLANT}}</dd></div>
                <div><dt>{{$t('fixture.stato')}}</dt><dd :class="dt.STATUS_DESC">{{ dt.STATUS_DESC.trim() }}</dd></div>
                <!-- (composizione 16/9) DI COSA e' fatta la quota, non un
                     numero solo -->
                <div class="cat-card__wide comp-cell"><dt>{{$t('fixture.composition.column')}}</dt>
                  <dd>
                    <template v-if="stato(dt) === 'coerente'">
                      <span class="comp-sum">{{ $t('fixture.composition.sum', quote(dt)) }}</span>
                    </template>

                    <template v-else-if="stato(dt) === 'diverge'">
                      <span class="badge badge-diverge">{{ $t('fixture.composition.divergeBadge') }}</span>
                      <div class="comp-hint">{{ $t('fixture.composition.divergeWhy', quote(dt)) }}</div>
                      <div class="comp-hint">{{ $t('fixture.composition.divergeWhat') }}</div>
                    </template>

                    <!-- non e' un guasto: e' una composizione che nessuno
                         ha ancora dichiarato. Tono neutro, apposta. -->
                    <template v-else-if="stato(dt) === 'nonDichiarata'">
                      <span class="badge badge-undeclared">{{ $t('fixture.composition.undeclaredBadge') }}</span>
                      <div class="comp-hint">{{ $t('fixture.composition.undeclaredWhat') }}</div>
                    </template>

                    <span v-else class="cell-empty">&mdash;</span>
                  </dd>
                </div>
              </dl>
              <div class="cat-card__actions">
                <orderCMD
                    modify="true"   @cmdModify="updatefixture(dt.ID)"
                    del="true"      @cmdDel="sicurezza(dt.ID)"
                    place="true"    @cmdPlace="callPage(dt.ID)"
                />
              </div>
              <div v-if="_showPopUp(dt.ID)" class="cat-card__confirm">
                <div class="cat-card__sure"><b>{{ $t('fixture.sure') }}</b></div>
                <UiButton variant="danger" size="min" @click="deletefixture(dt.ID)">
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
        // stato e numeri arrivano dal modulo condiviso: la lista e il form
        // devono raccontare la stessa cosa
        stato(row) {
            return statoComposizione(row);
        },
        quote(row) {
            const q = quoteComposizione(row);
            return { dichiarata: q.dichiarata, pallet: q.pallet, morsa: q.morsa, somma: q.somma };
        },
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
            // U-FASE2 (punto 6): la route e' /conf/FixtureOnPallet SENZA
            // parametro di path e la view legge $route.query.fixtureID —
            // il vecchio push('/conf/fixtureOnPallet/'+id) non matchava
            // nessuna route (ingresso morto).
            this.$router.push('/conf/FixtureOnPallet?fixtureID='+id);
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
/* (composizione 16/9) la cella della composizione: la somma in tono quieto,
   la divergenza con la coppia colore/fondo degli avvisi, la composizione non
   dichiarata in tono neutro perche' NON e' un guasto. */
.comp-cell {
  min-width: 18rem;
}

.comp-sum {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.comp-hint {
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: var(--text-secondary);
}

.badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.badge-diverge {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  font-weight: var(--font-weight-semibold);
}

/* neutro: informazione mancante, non allarme */
.badge-undeclared {
  background-color: var(--bg-input);
  color: var(--text-secondary);
}

.cell-empty {
  color: var(--text-muted);
}

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

    /* Badge status: semantica allineata a productionTable (dashboard).
       (UI v2 fase 1.5) colori = quelli delle tasche (doc §11): WORKING ambra
       (era verde), FINISHED verde (era neutro), EMPTY grigio (era azzurro,
       il colore del GREZZO); aggiunti RAW, LOCK/LOCKED e NOT_DEFINED. */
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
