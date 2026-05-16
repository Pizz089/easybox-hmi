<script setup>
import { RouterLink, RouterView } from 'vue-router'
//import Card from './components/Cards/Card.vue'
//import stats_card from './components/Cards/StatsCard.vue'
import unitsList from '../components/units.vue'
import prodtable from '../components/productionTable.vue'

</script>

<template>
    <div  class="pure-u-1" >
    
        <unitsList></unitsList>
    </div>

    <div class="pure-u-1" >
        <prodtable></prodtable>
    </div>

</template>

<script>
</script>