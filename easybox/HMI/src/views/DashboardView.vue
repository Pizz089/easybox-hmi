<script setup>
import { RouterLink, RouterView } from 'vue-router'
//import Card from './components/Cards/Card.vue'
//import stats_card from './components/Cards/StatsCard.vue'
import unitsList from '../components/units.vue'
import prodtable from '../components/productionTable.vue'

</script>

<template>
    <div class="pure-u-1 dashboard-view-root view-shell view-shell--fill">
        <div>
            <unitsList></unitsList>
        </div>
        <div class="dashboard-prodtable-wrap">
            <prodtable></prodtable>
        </div>
    </div>
</template>

<style scoped>
/* Shell interamente dal globale .view-shell--fill (identico px-per-px al
   vecchio scoped: flex column + gap space-4 + calc(100vh - 100px)). */

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