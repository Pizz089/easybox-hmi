<!-- ==========================================================================
     AppShell.vue — layout del pannello v3 (UI-DESIGN-SYSTEM v3 §13).
     Barra di navigazione a sinistra, striscia di stato in alto sempre
     visibile, schede della sezione, contenuto. Sostituisce StandardMenu
     (sidebar + barraInAlto), che resta nel repo fino alla fase D.

     La shell e' ferma: scorre solo l'area del contenuto. Il contenitore
     resta <main class="content">, che custom-fix.css e productionTable
     usano nei selettori. Le pagine "a tutta altezza" (.view-shell--fill)
     riempiono l'area invece di calcolare 100vh meno la barra di prima.

     Gli handler globali (toast allarmi, SAFETY/AUX, snapshot e refresh 90
     alla connessione) sono quelli di StandardMenu, dalla stessa sorgente:
     layout/plantGlobals.js.
     ========================================================================== -->
<template>
  <div class="shell">
    <NavRail :alarms="nAllarmi" @open-user="utente = true" />
    <div class="shell__main">
      <StatusStrip :alarms="nAllarmi" @open-user="utente = true" />
      <main class="content shell__content">
        <SectionTabs />
        <alert
          v-if="dataStored.alert && dataStored.alert.title"
          :title="dataStored.alert.title"
          :desc="dataStored.alert.desc"
          :type="dataStored.alert.type"
          @cmd_close="dataStored.emptyAlertList && dataStored.emptyAlertList()"
        />
        <div class="shell__page">
          <slot />
        </div>
      </main>
    </div>
    <ChangeUserModal :open="utente" @close="utente = false" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { dataStored } from '@/data';
import { isMachineConfigured } from '@/util/machineBrands';
import alert from '@/components/Alerts/Alert.vue';
import ChangeUserModal from '@/components/ChangeUserModal.vue';
import { usePlantGlobals } from '../plantGlobals.js';
import { startPlantStatus, stopPlantStatus, activeAlarmUnits } from '@/stores/plantStatus.js';
import NavRail from './NavRail.vue';
import StatusStrip from './StatusStrip.vue';
import SectionTabs from './SectionTabs.vue';

usePlantGlobals();
onMounted(startPlantStatus);
onUnmounted(stopPlantStatus);

const utente = ref(false);
const nAllarmi = computed(() => activeAlarmUnits(isMachineConfigured(2)).length);
</script>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--bg-base);
  color: var(--text-primary);
}
.shell__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.shell__content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--page-padding);
  box-sizing: border-box;
  overflow: hidden;
}
.shell__page {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
@media (max-width: 1599px) {
  .shell__content { gap: var(--space-4); }
}
</style>
