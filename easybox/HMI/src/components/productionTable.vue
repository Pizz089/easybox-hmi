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
                            [ {{ o.PP }} ]
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
        <h4 v-else>{{ $t('production.noOrderYet') }}</h4>
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
                    this.orders=data;
                })
                .catch(error => {
                    console.info(error);
                });
        },
        modifyOrder(i){
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

/* WORKING = lavorazione attiva = success/verde */
main.content table.pure-table tbody tr td.table-divisor.WORKING + td,
main.content table.pure-table tbody tr td.table-divisor.working + td {
    color: var(--color-success) !important;
    background: var(--color-success-bg) !important;
}

/* RAW = materia grezza in attesa = info/blu */
main.content table.pure-table tbody tr td.table-divisor.RAW + td,
main.content table.pure-table tbody tr td.table-divisor.raw + td {
    color: var(--color-info) !important;
    background: var(--color-info-bg) !important;
}

/* PAUSED = stato pausa = grigio neutro, no bg colorato */
main.content table.pure-table tbody tr td.table-divisor.PAUSED + td,
main.content table.pure-table tbody tr td.table-divisor.paused + td {
    color: var(--text-muted) !important;
}

/* STOP / ABORT = errore o interrotto = danger/rosso */
main.content table.pure-table tbody tr td.table-divisor.STOP + td,
main.content table.pure-table tbody tr td.table-divisor.stop + td,
main.content table.pure-table tbody tr td.table-divisor.ABORT + td,
main.content table.pure-table tbody tr td.table-divisor.abort + td {
    color: var(--color-danger) !important;
    background: var(--color-danger-bg) !important;
}

/* FINISHED = concluso = neutro */
main.content table.pure-table tbody tr td.table-divisor.FINISHED + td,
main.content table.pure-table tbody tr td.table-divisor.finished + td {
    color: var(--text-secondary) !important;
    background: var(--bg-surface-2) !important;
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
