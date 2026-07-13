<script setup>
import { RouterLink, RouterView } from 'vue-router'
//import Card from './components/Cards/Card.vue'
//import stats_card from './components/Cards/StatsCard.vue'
import unitsList from '../components/units.vue'
import prodtable from '../components/productionTable.vue'

</script>

<template>
    <div class="pure-u-1 dashboard-view-root">
        <div>
            <unitsList></unitsList>
        </div>
        <div class="dashboard-prodtable-wrap">
            <prodtable></prodtable>
        </div>
    </div>
</template>

<style scoped>
.dashboard-view-root {
    display: flex;
    flex-direction: column;
    /* 100px = offset strutturale (topbar fissa 64px + margini content),
       non estetica: resta in px, nessun token adatto. */
    height: calc(100vh - 100px);
    gap: var(--space-4);
}

.dashboard-prodtable-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

.dashboard-prodtable-wrap > * {
    flex: 1;
    min-height: 0;
}
</style>

<script>
</script>