<script setup>
import { RouterLink, RouterView } from 'vue-router'
//import Card from './components/Cards/Card.vue'
//import stats_card from './components/Cards/StatsCard.vue'
import unitsList from '../components/units.vue'
import prodtable from '../components/productionTable.vue'

</script>

<template>
    <div class="pure-u-1 dashboard-view-root view-shell view-shell--fill">
        <div class="dashboard-units">
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

/* K-FIX2: gestione esplicita del wrap delle tile. Il flex item aveva
   min-height:auto (incomprimibile): se le tile andavano a capo (viewport
   stretta / UI scaling) il contenuto sforava il budget del --fill e #app
   diventava un secondo scroller, staccando lo sticky della tabella.
   Ora la zona tile si comprime e scrolla internamente; il root non
   trabocca mai. NIENTE overflow su root/#app (le pagine lunghe devono
   continuare a scrollare per intero). */
.dashboard-units {
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
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