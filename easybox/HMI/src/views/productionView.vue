<script setup>
import prodtable from '../components/productionTable.vue'
import { dataStored } from '../data';
</script>

<template>
    <div class="pure-u-1">
        <div class="page-header">
            <h2 class="page-title">{{ $t('production.welcome') }}</h2>
            <button
                type="button"
                class="btn-add-order"
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
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-5);
    padding: 0 var(--space-3);
}

.page-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.btn-add-order {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--text-primary);
    color: var(--bg-base);
    border: 0;
    border-radius: var(--radius-md);
    padding: 12px 24px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: filter var(--transition-fast), opacity var(--transition-fast);
}

.btn-add-order:hover:not(:disabled),
.btn-add-order:focus-visible:not(:disabled) {
    filter: brightness(0.92);
    outline: none;
}

.btn-add-order:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-lock-icon {
    flex-shrink: 0;
}
</style>
