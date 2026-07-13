<script setup>
import prodtable from '../components/productionTable.vue'
import { dataStored } from '../data';
</script>

<template>
    <div class="pure-u-1 production-view-root view-shell view-shell--fill">
        <div class="view-header">
            <h2 class="view-title">{{ $t('production.welcome') }}</h2>
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
    </div>
</template>

<script>
export default {
    methods: {
        navigateToWizard() {
            this.$router.push('/selectPiece');
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
</style>
