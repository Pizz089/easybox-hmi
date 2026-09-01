<script setup>
import prodtable from '../components/productionTable.vue'
import { dataStored } from '../data';
import { MACHINE_POSITIONS } from '../util/machineBrands';
import { KO_CELL_RUNNING } from '../util/errorCodes';
</script>

<template>
    <div class="pure-u-1 production-view-root view-shell view-shell--fill">
        <div class="view-header">
            <h2 class="view-title">{{ $t('production.welcome') }}</h2>
            <!-- AZZERA PRODUZIONE (1/9): ripristino distruttivo, solo via dialog
                 con numeri veri letti dal backend (anteprima) -->
            <button
                type="button"
                class="pure-button-micromission specialCMD btn-reset-prod"
                :disabled="dataStored.userLevel == 0"
                @click="openResetDialog"
            >
                {{ $t('production.reset.button') }}
            </button>
            <button
                type="button"
                class="pure-button-primary btn-add-order"
                :disabled="dataStored.userLevel == 0"
                @click="navigateToWizard"
            >
                <svg
                    v-if="dataStored.userLevel == 0"
                    class="btn-lock-icon"
                    width="16" height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {{ $t('production.addOrder') }}
            </button>
        </div>

        <prodtable></prodtable>

        <!-- dialog conferma AZZERA PRODUZIONE: cosa cambia, con numeri veri -->
        <div v-if="reset.open" class="mission-dialog-overlay">
            <div class="mission-dialog">
                <h3 class="command-section-title">{{ $t('production.reset.title', { mc: reset.machineId }) }}</h3>

                <div class="reset-machine" v-if="MACHINE_POSITIONS.length > 1">
                    <label>{{ $t('production.machine') }}</label>
                    <select v-model.number="reset.machineId" @change="loadPreview()">
                        <option v-for="pos in MACHINE_POSITIONS" :key="pos.mc" :value="pos.n">{{ $t(pos.labelKey) }}</option>
                    </select>
                </div>

                <div v-if="reset.loading" class="reset-hint">{{ $t('production.reset.loading') }}</div>
                <template v-else-if="reset.preview">
                    <div class="reset-block">
                        <div class="reset-label">{{ $t('production.reset.ordersLabel', { n: reset.preview.orders.length }) }}</div>
                        <ul class="reset-list" v-if="reset.preview.orders.length">
                            <li v-for="o in reset.preview.orders" :key="o.ID">#{{ o.ID }} — {{ (o.PIECE || '').trim() || ('PIECE ' + o.PIECE_ID) }}</li>
                        </ul>
                        <div class="reset-hint" v-else>{{ $t('production.reset.noOrders') }}</div>
                    </div>
                    <div class="reset-block">
                        <div class="reset-label">{{ $t('production.reset.positionsLabel', { n: reset.preview.positions }) }}</div>
                    </div>
                    <div class="reset-warn">{{ $t('production.reset.notPhysical') }}</div>
                    <div class="reset-blocked" v-if="reset.preview.blocked">{{ $t('production.reset.cellRunning') }}</div>
                </template>
                <div v-else class="reset-blocked">{{ $t('production.reset.previewFailed') }}</div>

                <div class="pure-g">
                    <div class="pure-u-1-2">
                        <button style="width:100%" class="button_pressed"
                            :class="[resetConfirmEnabled ? 'pure-button-mission' : 'pure-button-disable']"
                            @click="resetConfirmEnabled ? confirmReset() : ''">
                            {{ $t('production.reset.confirm') }}
                        </button>
                    </div>
                    <div class="pure-u-1-2">
                        <button style="width:100%" class="btn-ghost" @click="closeResetDialog()">
                            {{ $t('robot.dialog.cancel') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            // AZZERA PRODUZIONE: dialog + anteprima dal backend (numeri veri)
            reset: {
                open: false,
                machineId: 1,
                loading: false,
                preview: null,   // { orders:[{ID,PIECE_ID,PIECE}], positions, robotStatus, blocked }
                busy: false
            }
        }
    },
    computed: {
        resetConfirmEnabled() {
            const p = this.reset.preview;
            return !!(p && !this.reset.loading && !this.reset.busy && !p.blocked && p.orders.length > 0);
        }
    },
    methods: {
        navigateToWizard() {
            this.$router.push('/selectRig');
        },
        openResetDialog() {
            this.reset.machineId = MACHINE_POSITIONS.length ? MACHINE_POSITIONS[0].n : 1;
            this.reset.open = true;
            this.loadPreview();
        },
        closeResetDialog() {
            this.reset.open = false;
            this.reset.preview = null;
        },
        loadPreview() {
            this.reset.loading = true;
            this.reset.preview = null;
            fetch(dataStored.server + 'api/order/resetProduction/preview/' + this.reset.machineId, { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(p => { this.reset.preview = (p && Array.isArray(p.orders)) ? p : null; })
                .catch(e => { console.info(e); this.reset.preview = null; })
                .finally(() => { this.reset.loading = false; });
        },
        confirmReset() {
            if (!this.resetConfirmEnabled) return;
            this.reset.busy = true;
            fetch(dataStored.server + 'api/order/resetProduction/' + this.reset.machineId, { method: 'POST' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.text(); })
                .then(body => {
                    let row = null;
                    try { row = JSON.parse(body); } catch (_) { row = { ris: body.trim() }; }
                    this.closeResetDialog();
                    if (row.ris === 'OK') {
                        dataStored.alert.title = 'INFO';
                        dataStored.alert.desc = this.$t('production.reset.done', { orders: row.orders, positions: row.positions });
                        dataStored.alert.type = 'message';
                    } else if (row.ris === KO_CELL_RUNNING) {
                        dataStored.alert.title = this.$t('WARNING');
                        dataStored.alert.desc = 'production.reset.cellRunning';
                        dataStored.alert.type = 'warning';
                    } else {
                        dataStored.alert.title = this.$t('WARNING');
                        dataStored.alert.desc = 'production.reset.failed';
                        dataStored.alert.type = 'warning';
                    }
                })
                .catch(e => {
                    console.info(e);
                    this.closeResetDialog();
                    dataStored.alert.title = this.$t('WARNING');
                    dataStored.alert.desc = 'production.reset.failed';
                    dataStored.alert.type = 'warning';
                })
                .finally(() => { this.reset.busy = false; });
        }
    }
}
</script>

<style scoped>
/* Shell dal globale .view-shell--fill (gap 12 -> 16, esce dalla blacklist);
   header e titolo dai globali .view-header/.view-title. */

/* Layout hook (opzione A audit-sistema-b): SOLO allineamento icona lucchetto,
   l'estetica viene dalla variante Primary canonica (buttons.css). */
.btn-add-order {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
}

.btn-lock-icon {
    flex-shrink: 0;
}

/* AZZERA PRODUZIONE: bottone critico a fianco dell'aggiunta ordine */
.btn-reset-prod {
    margin-right: var(--space-2);
}

/* dialog conferma: stesso overlay delle view missione */
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
    width: min(560px, 92vw);
    max-height: 80vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}
.reset-machine {
    display: flex;
    gap: var(--space-2);
    align-items: center;
}
.reset-machine select {
    min-height: 44px;
    background: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-4);
}
.reset-label {
    font-weight: var(--font-weight-semibold);
}
.reset-list {
    margin: var(--space-2) 0 0;
    padding-left: var(--space-4);
    max-height: 30vh;
    overflow-y: auto;
}
.reset-hint {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
}
.reset-warn {
    background: var(--color-warning-bg);
    color: var(--color-warning);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-base);
}
.reset-blocked {
    background: var(--color-danger-bg);
    color: var(--color-danger);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    font-weight: var(--font-weight-semibold);
}
</style>
