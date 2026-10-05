<script setup>
import { dataStored } from '../data.js'
</script>

<!--
  (P2 5/10, rivisto dopo l'audit) RILANCIA ORDINE FINITO. Dialog aperto dal
  pulsante "Rilancia" di una riga a STATUS 5 della tabella produzione.
  L'anteprima mostra NUMERI VERI letti dal backend (tasche finite dell'ordine,
  grezzi disponibili per il pezzo nei cassetti, QUANTITY, altri ordini in
  lavorazione con lo stesso pezzo), poi chiede se i grezzi sono stati rimessi
  al posto dei finiti:
    SI' -> mode 'replaced' : i finiti tornano grezzi e restano dell'ordine.
           Solo a cella ferma: il backend lo rifiuta con la cella in lavoro.
    NO  -> mode 'available': i finiti restano finiti ma escono dall'ordine e si
           lavorano i grezzi che ci sono (se sono 0 il NO non si puo' scegliere).
  In tutti e due i casi l'ordine torna in lavorazione (STATUS 3) e il backend
  gli prenota i grezzi che mancano. Nessuna promessa sulla posizione in coda:
  con piu' ordini sulla stessa macchina la sceglie il PLC.
  Le guardie vere stanno nel backend (WORKORDER/Order.js); qui si spiega il
  motivo del blocco prima che l'operatore confermi.
-->
<template>
    <div class="mission-dialog-overlay">
        <div class="mission-dialog mission-dialog--wide">
            <h3 class="command-section-title">{{ $t('production.relaunch.title', { id: order.ID }) }}</h3>
            <div class="relaunch-piece">{{ (order.PIECE || '').trim() }} — MC{{ order.MACHINE_ID }}</div>

            <div v-if="loading" class="relaunch-hint">{{ $t('production.reset.loading') }}</div>
            <template v-else-if="preview">
                <ul class="relaunch-numbers">
                    <li>{{ $t('production.relaunch.finishedLabel', { n: preview.finished }) }}</li>
                    <li>{{ $t('production.relaunch.rawLabel', { n: preview.raw }) }}</li>
                    <li>{{ $t('production.relaunch.quantityLabel', { n: preview.quantity }) }}</li>
                </ul>

                <div class="relaunch-blocked" v-if="preview.blocked">{{ $t(blockedKey(preview.blocked)) }}</div>
                <template v-else>
                    <div class="relaunch-warn" v-if="Number(preview.otherActive) > 0">
                        {{ $t('production.relaunch.otherActive', { n: preview.otherActive }) }}
                    </div>
                    <div class="relaunch-question">{{ $t('production.relaunch.question') }}</div>
                    <div class="relaunch-choice">
                        <button class="button_pressed"
                            :class="[canReplace ? 'pure-button-mission' : 'pure-button-disable']"
                            @click="canReplace ? confirm('replaced') : ''">
                            {{ $t('production.relaunch.yes') }}
                        </button>
                        <small class="relaunch-hint">{{ $t('production.relaunch.yesHint', { n: preview.finished }) }}</small>
                        <div class="relaunch-blocked" v-if="preview.replacedBlocked">{{ $t(blockedKey(preview.replacedBlocked)) }}</div>
                    </div>
                    <div class="relaunch-choice">
                        <button class="button_pressed"
                            :class="[canUseAvailable ? 'pure-button-mission' : 'pure-button-disable']"
                            @click="canUseAvailable ? confirm('available') : ''">
                            {{ $t('production.relaunch.no') }}
                        </button>
                        <small class="relaunch-hint">{{ $t('production.relaunch.noHint') }}</small>
                        <div class="relaunch-blocked" v-if="preview.availableBlocked">{{ $t(blockedKey(preview.availableBlocked)) }}</div>
                        <div class="relaunch-warn" v-else-if="Number(preview.raw) < Number(preview.quantity)">
                            {{ $t('production.relaunch.partial', { raw: preview.raw, qty: preview.quantity }) }}
                        </div>
                    </div>
                </template>
            </template>
            <div v-else class="relaunch-blocked">{{ $t('production.relaunch.previewFailed') }}</div>

            <button class="btn-ghost relaunch-cancel" @click="$emit('close')">
                {{ $t('robot.dialog.cancel') }}
            </button>
        </div>
    </div>
</template>

<script>
import { KO_CELL_RUNNING, KO_NOT_FOUND, KO_ORDER_NOT_FINISHED, KO_NO_RAW } from '../util/errorCodes';

// codice del backend -> chiave del messaggio (anteprima e risposta del rilancio)
const BLOCKED_KEYS = {
    [KO_CELL_RUNNING]: 'production.relaunch.cellRunning',
    [KO_NOT_FOUND]: 'production.relaunch.notFound',
    [KO_ORDER_NOT_FINISHED]: 'production.relaunch.notFinished',
    [KO_NO_RAW]: 'production.relaunch.noRaw',
};

export default {
    props: {
        order: { type: Object, required: true },   // riga di WORKORDERS (ID, PIECE, MACHINE_ID, ...)
    },
    emits: ['close'],
    data() {
        return {
            loading: false,
            // { blocked, replacedBlocked, availableBlocked, status, machineId,
            //   pieceId, finished, raw, quantity, otherActive, piece }
            preview: null,
            busy: false,
        };
    },
    computed: {
        // blocco comune (ordine inesistente o non finito): nessuno dei due modi
        ready() {
            return !!(this.preview && !this.loading && !this.busy && !this.preview.blocked);
        },
        // SI': solo a cella ferma
        canReplace() {
            return this.ready && !this.preview.replacedBlocked;
        },
        // NO: solo con grezzi disponibili
        canUseAvailable() {
            return this.ready && !this.preview.availableBlocked && Number(this.preview.raw) > 0;
        },
    },
    methods: {
        blockedKey(code) {
            return BLOCKED_KEYS[code] || 'production.relaunch.failed';
        },
        loadPreview() {
            this.loading = true;
            this.preview = null;
            fetch(dataStored.server + 'api/order/relaunch/preview/' + this.order.ID, { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(p => { this.preview = (p && p.finished !== undefined) ? p : null; })
                .catch(e => { console.info(e); this.preview = null; })
                .finally(() => { this.loading = false; });
        },
        confirm(mode) {
            if (mode === 'replaced' ? !this.canReplace : !this.canUseAvailable) return;
            this.busy = true;
            fetch(dataStored.server + 'api/order/relaunch/' + this.order.ID + '?mode=' + mode, { method: 'POST' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(row => {
                    this.$emit('close');
                    if (row && row.ris === 'OK') {
                        dataStored.alert.title = 'INFO';
                        dataStored.alert.desc = this.$t('production.relaunch.done', { id: this.order.ID, reserved: row.reserved });
                        dataStored.alert.type = 'message';
                    } else {
                        dataStored.alert.title = this.$t('WARNING');
                        dataStored.alert.desc = this.blockedKey(row && row.ris);
                        dataStored.alert.type = 'warning';
                    }
                })
                .catch(e => {
                    console.info(e);
                    this.$emit('close');
                    dataStored.alert.title = this.$t('WARNING');
                    dataStored.alert.desc = 'production.relaunch.failed';
                    dataStored.alert.type = 'warning';
                })
                .finally(() => { this.busy = false; });
        },
    },
    mounted() {
        this.loadPreview();
    },
};
</script>

<style scoped>
/* stesso overlay e stessi blocchi del dialog "Azzera produzione" (productionView) */
/* dialog: stile comune in assets/css/dialogs.css (UI-DESIGN-SYSTEM v2 §12) */
.relaunch-piece {
    color: var(--text-secondary);
}
.relaunch-numbers {
    margin: 0;
    padding-left: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-weight: var(--font-weight-semibold);
}
.relaunch-question {
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
}
.relaunch-choice {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}
.relaunch-choice button {
    width: 100%;
    min-height: 52px;
}
.relaunch-cancel {
    width: 100%;
    min-height: 52px;
}
.relaunch-hint {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
}
.relaunch-warn {
    background: var(--color-warning-bg);
    color: var(--color-warning);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
}
.relaunch-blocked {
    background: var(--color-danger-bg);
    color: var(--color-danger);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    font-weight: var(--font-weight-semibold);
}
</style>
