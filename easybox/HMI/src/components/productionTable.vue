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
                            <hr width="30%" style="margin-left:0px">
                            [ {{ o.PP }} ]
                        </td>
                        <!--td>{{ o.GRIPPER }}</td-->

                        <td :class="{'td_odd':index%2==1}">
                            {{ o.PRODUCTED }} / {{ o.QUANTITY }}<br>
                            <progress :value="o.PRODUCTED" :max="o.QUANTITY" style="width:80px"> {{ o.PRODUCTED }} </progress>
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
                                    <button class="pure-button button-error pure-u-1-3" style="background-color:coral" @click="deleteOrder(o.ID)">
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
        dataStored.WS.socket.on('PRODUCTION/CHANGED', ()=>{
            this.getDataTable();
        });
    },
    unmounted(){
       //dataStored.WS.socket.off('PRODUCTION/CHANGED');
    }
}
</script>

<style scoped>
/* ============ WRAPPER ============ */
.prodtable-wrapper {
    background: var(--bg-surface-2);
    border-radius: var(--radius-lg);
    padding: 0 var(--space-3);
    margin-top: var(--space-4);
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
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
    letter-spacing: 0.5px;
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
    margin-bottom: var(--space-3);
}

/* Override inline style="background-color:coral" su bottone DELETE */
.popUpOnLine button.button-error {
    background: var(--color-danger) !important;
    color: var(--text-primary);
    border: 0;
    border-radius: var(--radius-md);
    font-weight: var(--font-weight-semibold);
    padding: var(--space-2) var(--space-4);
}

.popUpOnLine button.button-error:hover {
    background: var(--color-danger-bg) !important;
    color: var(--color-danger);
}

/* Bottone EXIT (class typo 'butto-secondary' non matcha niente, stiliziamo
   come secondary tramite :not(.button-error) sui bottoni del popup) */
.popUpOnLine button:not(.button-error) {
    background: var(--bg-input);
    color: var(--text-primary);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
}

.popUpOnLine button:not(.button-error):hover {
    background: var(--bg-surface-2);
    border-color: var(--border-strong);
}
</style>
