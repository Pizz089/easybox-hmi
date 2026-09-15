<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';
    
    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    import { statoComposizione, quoteComposizione } from '../../util/fixtureComposition.js';
    const el = ref()
</script>

<template>   
      <div class="view-shell view-shell--fill conf-card">
        <div class="view-header">
          <h3 class="view-title">{{$t('fixture.welcome')}}</h3>
          <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="createfixture()">
            {{$t('fixture.add_fixture')}}
          </button>
          <!--button class="pure-button pure-button-primary" @click="$router.push('/conf/fixtureOnPallet');">
            {{$t('fixture.PosOnPallet')}}
          </button-->
        </div>
        <div class="table-scroll">
        <table class="pure-table pure-table-horizontal">
            <thead>
                <tr>
                    <!--th>ID</th-->
                    <th>{{$t('fixture.posizione')}}</th>
                    <th>{{$t('fixture.stato')}}</th>
                    <th>{{$t('fixture.family')}}</th>
                    <th style='width:20%'>{{$t('fixture.descr')}}</th>
                    <!-- (composizione 16/9) prima si vedeva un solo numero,
                         FIXTURE.Z, senza sapere da dove venisse. Adesso si
                         vede DI COSA e' fatta la quota. -->
                    <th>{{$t('fixture.composition.column')}}</th>
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

                        <td class="comp-cell">
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
                        </td>
                        
                        <td>
                            <!-- U-FASE2 (punto 6): riattivato il bottone place
                                 verso FixtureOnPallet — era commentato e
                                 callPage puntava a un path inesistente. -->
                            <orderCMD
                                modify="true"   @cmdModify="updatefixture(dt.ID)"
                                del="true"      @cmdDel="sicurezza(dt.ID)"
                                place="true"    @cmdPlace="callPage(dt.ID)"
                            />
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
