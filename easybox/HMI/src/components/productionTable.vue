<script setup>
    import orderCMD from './Comands/ComandsRows.vue'
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../data.js'
</script>

<template>
    <div class="prodtable-wrapper">
        <table v-if="orders.length>0" class="pure-table pure-table-horizontal">
            <thead>
                <tr class="prodtable-head">
                    <th>{{ $t('production.part') }}</th>
                    <th>{{ $t('production.machine') }}</th>
                    <th></th>
                    <th>{{ $t('production.status') }}</th>
                    <th>{{ $t('production.production') }}</th>
                    <th></th>
                </tr>
            </thead>
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
                            <hr class="status-divider">
                            <!-- PP (path+name Heidenhain) e' vuoto per gli ordini
                                 a numero libero HAAS: fallback sul numero PP_ID -->
                            [ {{ (o.PP && o.PP.trim()) ? o.PP : o.PP_ID }} ]
                        </td>
                        <!--td>{{ o.GRIPPER }}</td-->

                        <td :class="{'td_odd':index%2==1}">
                            {{ o.PRODUCTED }} / {{ o.QUANTITY }}<br>
                            <progress :value="o.PRODUCTED" :max="o.QUANTITY" class="prod-progress"> {{ o.PRODUCTED }} </progress>
                        </td>
                        <td :class="{'td_odd':index%2==1}">
                            <orderCMD
                                :play=true         @cmdPlay="modifyOrderStatus(o.ID,dataStored.status_working,o.PIECE_ID)"
                                :stop=true         @cmdStop="modifyOrderStatus(o.ID,dataStored.status_raw,o.PIECE_ID)"
                                :del=true          @cmdDel="sicurezza(o.ID, o.STATUS_DESC)"
                                :delDisable="o.STATUS_DESC=='WORKING'"
                            />
                            <!-- (P2 5/10) RILANCIA: solo sugli ordini FINITI (5). Apre il
                                 dialog con l'anteprima vera. Abilitato anche per
                                 l'operatore (livello 0, deciso con Dario): le guardie
                                 sono nel backend (WORKORDER/Order.js). -->
                            <button v-if="isFinished(o)" type="button"
                                class="btn-ghost btn-relaunch"
                                @click="relaunchOrder = o">
                                {{ $t('production.relaunch.button') }}
                            </button>
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
                                    <button class="pure-button-micromission specialCMD pure-u-1-3" @click="deleteOrder(o.ID)">
                                        {{ $t('rowCmd.delete') }}
                                    </button>
                                    <button class="btn-ghost pure-u-1" @click="showPopUp=0">
                                        {{ $t('common.cancel') }}
                                    </button>
                                </span>
                            </div>
                        </td>
                    </tr>
                </template>
            </tbody>
        </table>
        <!-- (usabilita' 15/9) prima qui c'era solo "Nessun ordine al momento",
             che con la richiesta fallita era un'affermazione FALSA: l'elenco
             non era vuoto, non si era riusciti a chiederlo. -->
        <StatoElenco
          v-else
          :stato="statoElenco"
          :vuoto="true"
          :messaggio-vuoto="$t('production.noOrderYet')"
          @riprova="getDataTable()"
        />
        <RelaunchDialog v-if="relaunchOrder" :order="relaunchOrder" @close="relaunchOrder = null" />
    </div>
</template>

<script>
import StatoElenco from './StatoElenco.vue';
import RelaunchDialog from './RelaunchDialog.vue';
import { caricaElenco, STATO } from '../util/caricaElenco.js';

export default {
    components: { StatoElenco, RelaunchDialog },
    data(){
        return {
            // (P2 5/10) riga dell'ordine finito da rilanciare (null = dialog chiuso)
            relaunchOrder: null,
            // 'attesa' finche' non si sa: non si scrive "nessun ordine" prima
            // di avere una risposta
            statoElenco: STATO.ATTESA,
            orders:[],
            createNew:false,
            showPopUp:false
        }
    },
    methods: {
        getDataTable() {
            this.statoElenco = STATO.ATTESA;
            caricaElenco(dataStored.server, 'api/order/show/all').then(esito => {
                this.statoElenco = esito.stato;
                if (esito.stato === STATO.OK) this.orders = esito.dati;
                else console.info('elenco ordini non letto: ' + esito.dettaglio);
            });
        },
        // FINITO = STATUS 5 (dataStored.status_finished); STATUS_DESC come
        // riserva, e' quello che la riga usa gia' per il colore dello stato.
        isFinished(o){
            return Number(o.STATUS) === dataStored.status_finished || String(o.STATUS_DESC || '').trim().toUpperCase() === 'FINISHED';
        },
        modifyOrder(i){
            this.$router.push('/selectRig');
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
        this.productionChangedHandler = ()=>{
            this.getDataTable();
        };
        dataStored.WS.socket.on('PRODUCTION/CHANGED', this.productionChangedHandler);
    },
    unmounted(){
        // off SPECIFICO (evento + callback), stesso pattern di robotView (e4ab4e5).
        dataStored.WS.socket.off('PRODUCTION/CHANGED', this.productionChangedHandler);
    }
}
</script>

<style scoped>
/* ============ WRAPPER ============ */
/* E2: pattern outlined §4.1 (era bg-surface-2 + radius-lg senza bordo).
   padding verticale 0 (non --space-4): il thead sticky aggancia il bordo
   superiore del contenitore scroll — un padding-top mostrerebbe le righe
   che scorrono sopra l'header. */
.prodtable-wrapper {
    background: var(--bg-card);
    border: var(--border-card);
    border-radius: var(--radius-md);
    padding: 0 var(--space-4);
    margin-top: var(--space-4);
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
}


/* ============ EX INLINE (A12) ============ */
/* hr sotto STATUS_DESC: separatore corto allineato a sinistra. */
.status-divider {
    width: 30%;
    margin-left: 0;
}

/* 80px: geometria barra avanzamento in cella (non spacing). */
.prod-progress {
    width: 80px;
}
/* (P2 5/10) "Rilancia" accanto ai comandi riga, touch 44 */
.btn-relaunch {
    min-height: 44px;
    margin-left: var(--space-2);
}


/* ============ STATUS BADGE ============ */
/* Le classi status (WORKING/RAW/PAUSED/STOP/ABORT/FINISHED) sono applicate
   al td.table-divisor che e' largo 0 (custom-fix.css). Per rendere il
   badge visibile applichiamo lo stile al td adiacente (quello con il
   testo STATUS_DESC) via sibling combinator '+ td'. */

td.table-divisor.WORKING + td,
td.table-divisor.working + td,
td.table-divisor.RAW + td,
td.table-divisor.raw + td,
td.table-divisor.PAUSED + td,
td.table-divisor.paused + td,
td.table-divisor.STOP + td,
td.table-divisor.stop + td,
td.table-divisor.ABORT + td,
td.table-divisor.abort + td,
td.table-divisor.FINISHED + td,
td.table-divisor.finished + td {
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* (UI v2 fase 1.5) colori = quelli delle tasche (doc §11, util/pocketColors.js):
   lo stesso stato ha lo stesso colore nel disegno, nella legenda e qui.
   Prima WORKING era verde e RAW azzurro qui, il contrario nel disegno. */

/* WORKING = in lavoro = ambra */
main.content table.pure-table tbody tr td.table-divisor.WORKING + td,
main.content table.pure-table tbody tr td.table-divisor.working + td {
    color: var(--pocket-working) !important;
    background: var(--color-warning-bg) !important;
}

/* RAW = grezzo in attesa = azzurro */
main.content table.pure-table tbody tr td.table-divisor.RAW + td,
main.content table.pure-table tbody tr td.table-divisor.raw + td {
    color: var(--pocket-raw) !important;
    background: var(--color-info-bg) !important;
}

/* PAUSED = stato pausa = grigio neutro, no bg colorato */
main.content table.pure-table tbody tr td.table-divisor.PAUSED + td,
main.content table.pure-table tbody tr td.table-divisor.paused + td {
    color: var(--text-muted) !important;
}

/* STOP / ABORT = errore o interrotto = rosso (ABORT = scarto, come la tasca) */
main.content table.pure-table tbody tr td.table-divisor.STOP + td,
main.content table.pure-table tbody tr td.table-divisor.stop + td,
main.content table.pure-table tbody tr td.table-divisor.ABORT + td,
main.content table.pure-table tbody tr td.table-divisor.abort + td {
    color: var(--pocket-abort) !important;
    background: var(--color-danger-bg) !important;
}

/* FINISHED = finito = verde (v1: neutro) */
main.content table.pure-table tbody tr td.table-divisor.FINISHED + td,
main.content table.pure-table tbody tr td.table-divisor.finished + td {
    color: var(--pocket-finished) !important;
    background: var(--color-success-bg) !important;
}


/* ============ SMALL TEXT (PIECE_DESC sotto PIECE) ============ */
small {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
}


/* ============ PROGRESS BAR ============ */
/* height/border-radius/overflow gia' gestiti da custom-fix.css.
   Bg-surface-2 contrasta sia con bg-base (row pari) che bg-input (row dispari). */
progress::-webkit-progress-bar {
    background: var(--bg-surface-2);
    border-radius: var(--radius-pill);
}

progress::-webkit-progress-value {
    background: var(--accent);
    border-radius: var(--radius-pill);
    transition: width var(--transition-base);
}

progress::-moz-progress-bar {
    background: var(--accent);
    border-radius: var(--radius-pill);
}


/* ============ DELETE POPUP ============ */
.popUpOnLine {
    background: var(--bg-surface-2) !important;
    padding: var(--space-4) !important;
}

.popUpOnLine h3 {
    color: var(--text-primary);
    margin-bottom: var(--space-4);
}

/* B1/B2: bottoni popup su varianti canoniche (Critical per DELETE = conferma
   delete §3.2, Ghost per EXIT). Qui resta solo lo spacing tra i due. */
.popUpOnLine .btn-ghost {
    margin-top: var(--space-2);
    /* border-strong: il popup sta su bg-surface-2, dove border-default
       fa solo 2.10:1 (audit WCAG) -> 3.15. */
    border-color: var(--border-strong);
}
</style>
