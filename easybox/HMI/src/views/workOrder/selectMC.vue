<script setup>
    //import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../data.js'
    import  workOrderStep  from '../../components/workOrder_step.vue'
    // (machines-gating) fonte di verita' UNICA: MACHINE_POSITIONS. La
    // vecchia lista da UNIT_STATUS mostrava anche macchine NON configurate
    // (la riga MC2 esiste a DB anche con una macchina sola: e' la tabella
    // degli STATI unita', non della configurazione).
    import { MACHINE_POSITIONS, singleMachine } from '../../util/machineBrands'
</script>

<template>
  <div class="view-shell">
    <workOrderStep></workOrderStep>
    <h3 class="view-title"> Macchina </h3>
    <!-- (machines-gating) NESSUNA macchina configurata: difetto di config,
         deve urlare — mai un machineID inventato, il wizard si ferma qui -->
    <h4 v-if="MACHINE_POSITIONS.length==0" class="no-machines">
      {{ $t('wizard.noMachines') }}
    </h4>
    <div class="pure-g">
      <div v-for="pos in MACHINE_POSITIONS" :key="pos.mc"
        class="container_card pure-u-1-2 pure-u-md-1-4 pure-u-xl-1-4">

        <div class="card" @click="nextStep(pos.n)">
            <div class="container">
                <h4><b>{{ $t(pos.labelKey) }}</b></h4>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
    methods: {
        nextStep(n){
            dataStored.createWorkOrder.machineID=n;
            this.$router.push('/lastData');
        }
      },
      mounted(){
        // (machines-gating) UNA sola macchina configurata: lo step non
        // esiste — auto-selezione e avanti. replace(): il back non deve
        // ributtare l'operatore su uno step fantasma.
        const single = singleMachine();
        if (single) {
            dataStored.createWorkOrder.machineID = single.n;
            this.$router.replace('/lastData');
        }
      }
    }
  </script>

<style scoped>
    .no-machines {
        color: var(--color-danger);
        background: var(--color-danger-bg);
        border-radius: var(--radius-md);
        padding: var(--space-4);
    }
</style>
