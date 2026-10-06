<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../data.js'
    // (v3 fase C) ordini in card, componenti v3
    import UiButton from './ui/UiButton.vue'
    import UiSegmented from './ui/UiSegmented.vue'
    import CubeIcon3D from './CubeIcon3D.vue'
    import { Play, Square, RotateCcw, Trash2, Lock, Ellipsis } from 'lucide-vue-next'
</script>

<template>
    <!-- (v3 fase C) Produzione, tavola Produzione: un ordine per card, con
         disegno del pezzo, codice e ID, macchina e attrezzaggio, avanzamento
         grande, stato, azioni. Le azioni sono quelle della riga di prima,
         con le stesse conferme: Avvia e Ferma (stato 3 / 4 su
         TO_PLANT/CMD/ORDER, senza conferma come prima), Rilancia sui finiti
         (stesso dialog), Cancella (spenta sull'ordine in lavorazione, dal
         livello 1 come in ComandsRows, conferma "sei sicuro?" nella card).
         NIENTE maniglia di trascinamento: la coda ordini e' un cantiere a
         parte, l'ordine resta quello di oggi. I filtri cambiano solo cosa
         si vede.
         (C-bis, decisione di Dario) come nella tavola: UN'azione principale
         per stato (in lavoro: Ferma; finito: Rilancia; gli altri: Avvia) e
         le altre nel menu "..." della card. Stessi comandi, stesse
         abilitazioni, stessa conferma: test_golden_equivalenza (2c) apre il
         menu di un ordine alla volta e vuole, riuniti, i comandi di prima. -->
    <div class="prod">
        <div v-if="orders.length>0" class="prod-filter">
            <UiSegmented v-model="filtro" :options="opzioniFiltro" />
        </div>
        <div v-if="orders.length>0" class="prod-list">
            <template v-for="o in ordiniVisibili" :key="o.ID" >
                <article class="prod-card" :class="'prod-card--' + stato(o).key">
                    <div class="prod-card__draw" aria-hidden="true">
                        <CubeIcon3D v-if="pezzoDi(o)" :w="pezzoDi(o).X" :d="pezzoDi(o).Y" :h="pezzoDi(o).Z" :prisma="pezzoDi(o).PRISMA" :size="76" />
                    </div>
                    <div class="prod-card__piece">
                        <div class="prod-card__code">{{ o.PIECE }} <span class="prod-card__id">#{{ o.ID }}</span></div>
                        <div class="prod-card__desc">{{ descrizione(o) }}</div>
                    </div>
                    <div class="prod-card__mc">
                        <!-- PP (path+name Heidenhain) e' vuoto per gli ordini
                             a numero libero HAAS: si mostra il numero PP_ID -->
                        <span class="prod-card__label">MC{{ o.MACHINE_ID }} · {{ $t('home.program', { pp: programma(o) }) }}</span>
                        <span class="prod-card__rig">{{ attrezzaggio(o) }}</span>
                    </div>
                    <div class="prod-card__progress">
                        <div class="prod-card__count"><b>{{ o.PRODUCTED }}</b> / {{ o.QUANTITY }}</div>
                        <div class="prod-bar" :class="'prod-bar--' + stato(o).key"><i :style="{ width: avanzamento(o) + '%' }"></i></div>
                    </div>
                    <!-- (fase 1.5) uno stato = un colore: il badge prende lo
                         stesso token delle tasche (grezzo/in coda azzurro, in
                         lavoro ambra, finito verde, abortito rosso), dalla
                         classe STATUS_DESC come la riga di prima -->
                    <div class="prod-card__status">
                        <span class="prod-badge" :class="String(o.STATUS_DESC || '').trim()"><i aria-hidden="true"></i>{{ stato(o).label ? $t(stato(o).label) : o.STATUS_DESC }}</span>
                    </div>
                    <div class="prod-card__actions">
                        <!-- azione principale dello stato -->
                        <UiButton v-if="principale(o) === 'ferma'" variant="secondary" size="min" :icon="Square"
                            @click="modifyOrderStatus(o.ID,dataStored.status_raw,o.PIECE_ID)">{{ $t('rowCmd.stop') }}</UiButton>
                        <UiButton v-if="principale(o) === 'avvia'" variant="secondary" size="min" :icon="Play"
                            @click="modifyOrderStatus(o.ID,dataStored.status_working,o.PIECE_ID)">{{ $t('rowCmd.play') }}</UiButton>
                        <!-- (P2 5/10) RILANCIA: solo sugli ordini FINITI (5). Apre il
                             dialog con l'anteprima vera. Abilitato anche per
                             l'operatore (livello 0, deciso con Dario): le guardie
                             sono nel backend (WORKORDER/Order.js). -->
                        <UiButton v-if="isFinished(o)" variant="secondary" size="min" :icon="RotateCcw"
                            @click="relaunchOrder = o">{{ $t('production.relaunch.button') }}</UiButton>
                        <!-- (C-bis) le altre azioni nel menu "..." della card -->
                        <UiButton class="prod-card__more-btn" variant="outline" size="min" :icon="Ellipsis"
                            :title="$t('production.moreActions')" :aria-label="$t('production.moreActions')"
                            :aria-expanded="menuOrdine === o.ID" @click="apriMenu(o.ID)" />
                    </div>
                    <!-- menu "..." della card: si apre DENTRO la card (una lista
                         che scorre taglierebbe un menu sovrapposto). Il tocco su
                         una voce lo chiude risalendo al contenitore. -->
                    <div v-if="menuOrdine === o.ID" class="prod-card__more" role="menu" @click="menuOrdine = null">
                        <button v-if="principale(o) !== 'avvia'" type="button" role="menuitem" class="v3-menu__item"
                            @click="modifyOrderStatus(o.ID,dataStored.status_working,o.PIECE_ID)">
                            <Play :stroke-width="2" aria-hidden="true" />{{ $t('rowCmd.play') }}
                        </button>
                        <button v-if="principale(o) !== 'ferma'" type="button" role="menuitem" class="v3-menu__item"
                            @click="modifyOrderStatus(o.ID,dataStored.status_raw,o.PIECE_ID)">
                            <Square :stroke-width="2" aria-hidden="true" />{{ $t('rowCmd.stop') }}
                        </button>
                        <!-- CANCELLA per ultimo e staccato dagli altri: e' l'unico
                             irreversibile. Spento sull'ordine in lavorazione. -->
                        <span class="prod-card__more-sep" aria-hidden="true"></span>
                        <button type="button" role="menuitem" class="v3-menu__item v3-menu__item--danger"
                            :disabled="o.STATUS_DESC=='WORKING'"
                            @click="chiediCancella(o)">
                            <component :is="dataStored.userLevel > 0 ? Trash2 : Lock" :stroke-width="2" aria-hidden="true" />{{ $t('rowCmd.delete') }}
                        </button>
                    </div>
                    <div v-if="_showPopUp(o.ID)" class="prod-card__confirm">
                        <span class="prod-card__sure">{{ $t('production.sure') }}</span>
                        <UiButton variant="danger" size="min" @click="deleteOrder(o.ID)">{{ $t('rowCmd.delete') }}</UiButton>
                        <UiButton variant="outline" size="min" @click="showPopUp=0">{{ $t('common.cancel') }}</UiButton>
                    </div>
                </article>
            </template>
            <p v-if="ordiniVisibili.length === 0" class="prod-empty">{{ $t('production.filter.none') }}</p>
        </div>
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
            showPopUp:false,
            // (v3 fase C) filtro della lista (solo vista) e anagrafica pezzi
            // per il disegno e le misure
            filtro: 'tutti',
            pezzi: [],
            // (C-bis) ordine col menu "..." aperto (null = nessuno)
            menuOrdine: null
        }
    },
    computed: {
        conteggi(){
            const c = { tutti: this.orders.length, working: 0, queued: 0, finished: 0 };
            for (const o of this.orders) { const k = this.stato(o).key; if (k in c) c[k]++; }
            return c;
        },
        opzioniFiltro(){
            const c = this.conteggi;
            return [
                { value: 'tutti', label: this.$t('production.filter.all'), count: c.tutti },
                { value: 'working', label: this.$t('production.filter.working'), count: c.working },
                { value: 'queued', label: this.$t('production.filter.queued'), count: c.queued },
                { value: 'finished', label: this.$t('production.filter.finished'), count: c.finished },
            ];
        },
        // l'ordine e' quello di oggi: si filtra, non si riordina
        ordiniVisibili(){
            if (this.filtro === 'tutti') return this.orders;
            return this.orders.filter(o => this.stato(o).key === this.filtro);
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
        // (v3 fase C) stato dell'ordine -> chiave del filtro e testo del
        // badge (il colore lo da' la classe STATUS_DESC, token delle tasche)
        stato(o){
            const s = Number(o.STATUS), d = String(o.STATUS_DESC || '').trim().toUpperCase();
            if (s === dataStored.status_working || d === 'WORKING') return { key: 'working', label: 'production.st.working' };
            if (s === dataStored.status_finished || d === 'FINISHED') return { key: 'finished', label: 'production.st.finished' };
            if (s === dataStored.status_paused || d === 'PAUSED') return { key: 'paused', label: 'production.st.paused' };
            if (s === dataStored.status_aborted || d === 'ABORTED' || d === 'ABORT') return { key: 'aborted', label: 'production.st.aborted' };
            if (s === dataStored.status_raw || d === 'RAW') return { key: 'queued', label: 'production.st.queued' };
            return { key: 'other', label: null };
        },
        // (C-bis) azione principale dello stato, come nella tavola: in lavoro
        // Ferma, finito Rilancia, tutti gli altri Avvia
        principale(o){
            const k = this.stato(o).key;
            return k === 'working' ? 'ferma' : k === 'finished' ? 'rilancia' : 'avvia';
        },
        // menu "..." della card: apre e chiude, nient'altro
        apriMenu(id){
            this.menuOrdine = this.menuOrdine === id ? null : id;
        },
        pezzoDi(o){
            return this.pezzi.find(p => p.ID == o.PIECE_ID) || null;
        },
        mm(v){
            return Math.round((Number(v) || 0) / 100) / 10;
        },
        descrizione(o){
            const d = String(o.PIECE_DESC || '').trim();
            const p = this.pezzoDi(o);
            const misure = p ? this.mm(p.X) + ' × ' + this.mm(p.Y) + ' × ' + this.mm(p.Z) + ' mm' : '';
            return [d, misure].filter(Boolean).join(' · ');
        },
        programma(o){
            return (o.PP && String(o.PP).trim()) ? String(o.PP).trim() : o.PP_ID;
        },
        attrezzaggio(o){
            const parti = [];
            if (o.PALLET_ID != null && o.VICE_ID != null) parti.push(this.$t('home.rigValue', { pallet: o.PALLET_ID, vice: o.VICE_ID }));
            const g = [o.GRIPPER, o.GRIPPER_DESC].map(x => String(x || '').trim()).filter(Boolean).join(' ');
            if (g) parti.push(this.$t('home.gripper') + ' ' + g);
            return parti.join(' · ');
        },
        avanzamento(o){
            const q = Number(o.QUANTITY) || 0;
            return q > 0 ? Math.min(100, Math.round(100 * (Number(o.PRODUCTED) || 0) / q)) : 0;
        },
        caricaPezzi(){
            fetch(dataStored.server + 'api/conf/piece/show/all', { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(d => { this.pezzi = Array.isArray(d) ? d : []; })
                .catch(e => { console.info(e); });
        },
        // (v3 fase C) CANCELLA: come il cestino di ComandsRows (deleteItem),
        // dal livello 1 in su; poi la stessa "sicurezza" di prima
        chiediCancella(o){
            if (dataStored.userLevel > 0)
                this.sicurezza(o.ID, o.STATUS_DESC);
            else {
                dataStored.alert.title = this.$t('WARNING');
                dataStored.alert.desc = this.$t('user_not_enabled');
                dataStored.alert.type = 'alarm';
            }
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
        this.caricaPezzi();
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
/* (v3 fase C) tavola Produzione: filtri, poi la lista che scorre dentro la
   pagina (la shell resta ferma) */
.prod {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    flex: 1;
    min-height: 0;
}
.prod-filter { display: flex; }
.prod-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}
.prod-card {
    flex: none;
    display: grid;
    /* stato e azioni a larghezza fissa: le colonne restano allineate da una
       card all'altra anche quando c'e' Rilancia */
    grid-template-columns: 88px minmax(220px, 1.3fr) minmax(220px, 1.2fr) minmax(170px, 0.9fr) 150px 260px;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--radius-lg);
    background: var(--bg-surface);
}
/* l'ordine in lavorazione si stacca dagli altri (tavola: fondo rialzato) */
.prod-card--working { background: var(--bg-raised); }
.prod-card__draw {
    width: 88px;
    height: 88px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: var(--bg-input);
    overflow: hidden;
}
/* il solido di CubeIcon3D, nei grigi della v3 (come nella Home) */
.prod-card__draw :deep(.face-top),
.prod-card__draw :deep(.face-right),
.prod-card__draw :deep(.face-left) { stroke: var(--bg-input); stroke-width: 0.45; }
.prod-card__draw :deep(.face-top) { fill: var(--text-disabled); }
.prod-card__draw :deep(.face-right) { fill: var(--border-default); }
.prod-card__draw :deep(.face-left) { fill: var(--bg-segment-on); }
.prod-card__piece, .prod-card__mc { min-width: 0; }
.prod-card__code {
    font-size: 24px;
    font-weight: var(--font-weight-extrabold);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.prod-card__id {
    margin-left: var(--space-1);
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: var(--font-weight-semibold);
    color: var(--text-muted);
}
.prod-card__desc { margin-top: 4px; font-size: var(--font-size-md); color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prod-card__mc { display: flex; flex-direction: column; gap: 6px; }
.prod-card__label {
    font-size: var(--font-size-label);
    font-weight: var(--font-weight-extrabold);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
    color: var(--text-muted);
}
.prod-card__rig { font-size: var(--font-size-base); color: var(--text-secondary); }
.prod-card__progress { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.prod-card__count { font-size: 20px; font-weight: var(--font-weight-bold); color: var(--text-muted); font-variant-numeric: tabular-nums; }
.prod-card__count b { font-size: 34px; font-weight: var(--font-weight-extrabold); color: var(--text-primary); }
.prod-bar { height: 8px; border-radius: 4px; overflow: hidden; background: var(--bg-input); }
.prod-bar i { display: block; height: 100%; border-radius: 4px; background: var(--accent); }
.prod-bar--finished i { background: var(--color-success); }
/* badge di stato: (fase 1.5) uno stato = un colore, lo stesso token delle
   tasche e delle altre tabelle (test_pocket_colors) */
.prod-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 30px;
    padding: 0 11px;
    border-radius: 9px;
    font-size: var(--font-size-label);
    font-weight: var(--font-weight-bold);
    white-space: nowrap;
    background: var(--bg-chip);
    color: var(--text-chip);
}
.prod-badge i { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none; }
.prod-badge.RAW { color: var(--pocket-raw); background: var(--color-info-bg); }
.prod-badge.WORKING { color: var(--pocket-working); background: var(--color-warning-bg); }
.prod-badge.FINISHED { color: var(--pocket-finished); background: var(--color-success-bg); }
.prod-badge.ABORT { color: var(--pocket-abort); background: var(--color-danger-bg); }
.prod-badge.ABORTED { color: var(--color-danger-fg); background: var(--color-danger-bg); }
.prod-card__actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-2); }
/* (C-bis) menu "..." della card, aperto dentro la card */
.prod-card__more {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-subtle);
}
.prod-card__more .v3-menu__item { background: var(--bg-surface-2); }
/* (usabilita' 15/9) Cancella sta in fondo e staccato dagli altri */
.prod-card__more-sep { align-self: stretch; width: 1px; margin: 0 var(--space-3); background: var(--border-default); }
.prod-card__confirm {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-subtle);
}
.prod-card__sure { margin-right: auto; font-size: var(--font-size-md); font-weight: var(--font-weight-bold); color: var(--color-danger-fg); }
.prod-empty { margin: var(--space-4) 0; color: var(--text-muted); font-size: var(--font-size-md); }

/* compatto: due righe di informazioni, le azioni sotto */
@media (max-width: 1599px) {
    .prod-card {
        grid-template-columns: 64px minmax(0, 1fr) minmax(0, 1fr) auto;
        grid-template-areas:
            "draw piece piece status"
            "draw mc prog prog"
            "act act act act";
        gap: var(--space-2) var(--space-4);
        padding: var(--space-3) var(--space-4);
    }
    .prod-card__draw { grid-area: draw; width: 64px; height: 64px; align-self: start; }
    .prod-card__piece { grid-area: piece; }
    .prod-card__status { grid-area: status; }
    .prod-card__mc { grid-area: mc; }
    .prod-card__progress { grid-area: prog; }
    .prod-card__actions { grid-area: act; justify-content: flex-start; flex-wrap: wrap; }
    .prod-card__code { font-size: 20px; }
    .prod-card__desc { font-size: var(--font-size-base); }
    .prod-card__count b { font-size: 26px; }
    .prod-card__count { font-size: 17px; }
    .prod-card__more-btn { margin-left: auto; }
    .prod-card__more { justify-content: flex-start; }
}
</style>
