<script setup>
    // IMPOSTAZIONI > Magazzini (cantiere AD-R1): abilita/disabilita le
    // singole posizioni dei due magazzini fisici — pallet (WPALLET, griglia
    // 5x4) e scaffale pinze (SHELF). Il flag vive in [POSITION].STATUS:
    // 9 = disabilitata, qualunque altro valore = abilitata (in cella
    // esistono 2 e 4: mai pretendere il 2). Le celle OCCUPATE non sono
    // disabilitabili; l'occupante e' derivato client-side dalle liste
    // pallet/gripper gia' in polling (stessa fonte delle altre view).
    // Vista GATED a userLevel>=1 (pattern commit X), voce sidebar inclusa.
    import { dataStored } from '../../data';
    import { fullGridOrder } from '../../util/warehouseGrid';
</script>

<template>
      <div class="view-shell view-shell--fill conf-card" v-if="dataStored.userLevel>=1">
        <div class="view-header">
          <h3 class="view-title">{{$t('warehouses.welcome')}}</h3>
        </div>

        <!-- tab di navigazione canoniche (doc par.2.3) -->
        <div class="tab-bar">
            <button class="tab" :class="{active: tab=='pallet'}" @click="tab='pallet'">
                {{$t('warehouses.tabPallet')}}
            </button>
            <button class="tab" :class="{active: tab=='gripper'}" @click="tab='gripper'">
                {{$t('warehouses.tabGrippers')}}
            </button>
        </div>

        <!-- ===== TAB PALLET: griglia FISICA 5x4, identica al dialog
             Posiziona (convenzione in util/warehouseGrid.js: riga 1 in
             basso, pos. 1 in basso a destra -> render 20..1). QUI nessun
             taglio righe di coda: le disabilitate si devono VEDERE per
             poterle riabilitare. ===== -->
        <div class="pos-grid" v-if="tab=='pallet'">
            <button v-for="n in palletOrder" :key="'p'+n" class="pos-cell"
                :class="cellClass('WPALLET', n)"
                :disabled="!cellToggleable('WPALLET', n)"
                @click="askToggle('WPALLET', n)">
                <span class="pos-num">{{ n }}</span>
                <span class="pos-state">{{ cellStateLabel('WPALLET', n) }}</span>
            </button>
        </div>

        <!-- ===== TAB PINZE: fila degli slot reali di SHELF ===== -->
        <div class="shelf-row" v-if="tab=='gripper'">
            <button v-for="row in shelf" :key="'s'+row.SUB_POS" class="pos-cell"
                :class="cellClass('SHELF', row.SUB_POS)"
                :disabled="!cellToggleable('SHELF', row.SUB_POS)"
                @click="askToggle('SHELF', row.SUB_POS)">
                <span class="pos-num">{{ row.SUB_POS }}</span>
                <span class="pos-state">{{ cellStateLabel('SHELF', row.SUB_POS) }}</span>
            </button>
        </div>

        <!-- conferma canonica (overlay pattern mission-dialog) -->
        <div v-if="pending" class="mission-dialog-overlay">
          <div class="mission-dialog">
            <h3 class="command-section-title">
                {{ pending.action=='disable'
                    ? $t('warehouses.sureDisable', { n: pending.subpos })
                    : $t('warehouses.sureEnable',  { n: pending.subpos }) }}
            </h3>
            <div class="pure-g">
              <div class="pure-u-1-2">
                <button style="width:100%" class="button_pressed pure-button-mission" @click="confirmToggle()">
                  {{ $t('robot.dialog.confirm') }}
                </button>
              </div>
              <div class="pure-u-1-2">
                <button style="width:100%" class="btn-ghost" @click="pending=null">
                  {{ $t('robot.dialog.cancel') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- gate livello: stessa filosofia del commit X -->
      <div class="view-shell conf-card" v-else>
        <h3 class="view-title">{{ $t('user_not_enabled') }}</h3>
      </div>
</template>

<script>
export default {
    data(){
        return {
            tab:'pallet',
            wpallet:[],      // righe [POSITION] parent WPALLET (ID, SUB_POS, STATUS)
            shelf:[],        // righe [POSITION] parent SHELF
            pallets:[],
            grippers:[],
            pending:null,    // {parent, subpos, action:'disable'|'enable'} in conferma
            polling:true,
            pollTimer:null
        }
    },
    methods: {
        getDataTable() {
            const get = (url, cb) =>
                fetch(dataStored.server + url, { method: 'GET' })
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                    .then(cb)
                    .catch(error => { console.info("-------------"); console.info(error); });

            get('api/conf/position/showWarehouse/WPALLET', d => this.wpallet = d || []);
            get('api/conf/position/showWarehouse/SHELF',   d => this.shelf = (d || []).filter(r => r.SUB_POS > 0 && r.SUB_POS < 1000).sort((a,b) => a.SUB_POS - b.SUB_POS));
            get('api/conf/pallet/show/all',  d => this.pallets  = d || []);
            get('api/conf/gripper/show/all', d => this.grippers = d || []);
        },
        slotRow(parent, n){
            const list = parent == 'WPALLET' ? this.wpallet : this.shelf;
            return list.find(r => r.SUB_POS == n) || null;
        },
        // Occupante: pallet per MAG_POS; pinza con la semantica di
        // showWarehousePos (POS_MAG<1000 e POS_PLANT>=0 — la pinza a bordo
        // robot tiene RISERVATO il suo slot, decisione ratificata C1).
        occupantOf(parent, n){
            if (parent == 'WPALLET')
                return this.pallets.find(p => p.MAG_POS == n) || null;
            return this.grippers.find(g => g.POS_MAG == n && g.POS_MAG < 1000 && g.POS_PLANT >= 0) || null;
        },
        occupantName(parent, n){
            const o = this.occupantOf(parent, n);
            return o ? ('#' + o.ID + ' ' + (o.FAMILY || '').trim()) : '';
        },
        isDisabled(parent, n){
            const row = this.slotRow(parent, n);
            return !!row && row.STATUS == 9;
        },
        // Toggle possibile solo su celle censite a DB e NON occupate.
        // (WPALLET sul dev/cella puo' avere buchi: le righe mancanti le crea
        // lo script d'impianto scripts/warehouse-positions.sql, commit 4.)
        cellToggleable(parent, n){
            return !!this.slotRow(parent, n) && !this.occupantOf(parent, n);
        },
        cellClass(parent, n){
            if (this.occupantOf(parent, n)) return 'occupied';
            if (this.isDisabled(parent, n)) return 'disabled-slot';
            if (!this.slotRow(parent, n))   return 'not-in-db';
            return 'free';
        },
        cellStateLabel(parent, n){
            const occ = this.occupantOf(parent, n);
            if (occ) return this.occupantName(parent, n);
            if (this.isDisabled(parent, n)) return this.$t('warehouses.disabled');
            if (!this.slotRow(parent, n))   return this.$t('warehouses.notInDb');
            return this.$t('warehouses.enabled');
        },
        askToggle(parent, n){
            if (!this.cellToggleable(parent, n)) return;
            this.pending = {
                parent,
                subpos: n,
                action: this.isDisabled(parent, n) ? 'enable' : 'disable'
            };
        },
        // Conferma con FOTO FRESCA: rifetch sincrono di occupazione e stato
        // prima di scrivere (pattern stateChanged) — se nel frattempo la
        // posizione e' stata presa o lo stato e' cambiato, warning e stop.
        confirmToggle(){
            const p = this.pending;
            this.pending = null;
            if (!p) return;
            const listUrl = p.parent == 'WPALLET' ? 'api/conf/pallet/show/all' : 'api/conf/gripper/show/all';
            fetch(dataStored.server + listUrl, { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(fresh => {
                    const occupied = p.parent == 'WPALLET'
                        ? (fresh || []).some(x => x.MAG_POS == p.subpos)
                        : (fresh || []).some(x => x.POS_MAG == p.subpos && x.POS_MAG < 1000 && x.POS_PLANT >= 0);
                    if (p.action == 'disable' && occupied) {
                        dataStored.alert.title = this.$t('WARNING');
                        dataStored.alert.desc = 'robot.dialog.stateChanged';
                        dataStored.alert.type = 'warning';
                        this.getDataTable();
                        return;
                    }
                    return fetch(dataStored.server + 'api/conf/position/warehouseSlot/' + p.action + '/' + p.parent + '/' + p.subpos, { method: 'GET' })
                        .then(r => { if (!r.ok) throw new Error('Network response was not ok'); this.getDataTable(); });
                })
                .catch(error => { console.info(error); });
        }
    },
    computed:{
        palletOrder(){
            return fullGridOrder();
        }
    },
    mounted(){
        this.getDataTable()
        this.pollTimer = setInterval(() => {
            if(this.polling)
                this.getDataTable()
        }, 3000);
    },
    unmounted(){
        this.polling=false;
        clearInterval(this.pollTimer);
    }
}
</script>

<style scoped>
    /* griglia fisica 5x4 (pallet) — stesse metriche del dialog Posiziona */
    .pos-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-2);
        max-width: 640px;
    }

    /* scaffale pinze: fila orizzontale */
    .shelf-row {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
    }

    .shelf-row .pos-cell {
        min-width: 120px;
    }

    .pos-cell {
        min-height: 64px;
        padding: var(--space-1);
        background: var(--bg-input);
        color: var(--text-primary);
        border: 2px solid transparent;
        border-radius: var(--radius-md);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
    }

    .pos-num {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
    }

    .pos-state {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* occupata: non disabilitabile, l'occupante resta leggibile */
    .pos-cell.occupied {
        opacity: 0.7;
        cursor: not-allowed;
    }

    /* disabilitata: stile distinto dall'occupata (bordo tratteggiato
       warning, stessa grammatica del disabled-slot del dialog AC) */
    .pos-cell.disabled-slot {
        border: 2px dashed var(--color-warning);
        background: transparent;
        color: var(--text-muted);
    }

    /* non censita a DB (buco reale: righe create dallo script d'impianto) */
    .pos-cell.not-in-db {
        opacity: 0.4;
        cursor: not-allowed;
    }

    /* overlay conferma canonico (pattern mission-dialog) */
    .mission-dialog-overlay {
        position: fixed;
        inset: 0;
        background: var(--bg-backdrop);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .mission-dialog {
        background: var(--bg-surface);
        border: var(--border-card);
        border-radius: var(--radius-md);
        box-shadow: var(--elevation-3);
        padding: var(--space-4);
        width: min(520px, 92vw);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }
</style>
