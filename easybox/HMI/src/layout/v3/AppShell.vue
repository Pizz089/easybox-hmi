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
        <!-- (fase E1.5) riga delle schede: a destra il punto di aggancio per i
             selettori delle pagine (in compatto le schede Movimenti /
             Missioni / Chele di robotView arrivano qui con un <Teleport>).
             Vuota senza schede e senza aggancio: non occupa spazio. -->
        <div class="shell__tabs">
          <SectionTabs />
          <div id="section-extra" class="shell__extra"></div>
        </div>
        <!-- (E1.2) riquadro globale v3: stesso contratto (title, desc, type,
             check); il badge «972 → codice» vale solo per il desc per cui
             e' stato scritto -->
        <alert
          v-if="dataStored.alert && dataStored.alert.title"
          :title="dataStored.alert.title"
          :desc="dataStored.alert.desc"
          :type="dataStored.alert.type"
          :checks="dataStored.alert.check || []"
          :badge="badgeAllarme"
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
import { installAppHeight } from '@/util/appHeight.js';

usePlantGlobals();
onMounted(startPlantStatus);
onUnmounted(stopPlantStatus);
// (fase E1.4) --app-h da innerHeight dove il browser non conosce 100dvh
let staccaAppHeight = () => {};
onMounted(() => { staccaAppHeight = installAppHeight(); });
onUnmounted(() => staccaAppHeight());

const utente = ref(false);
const badgeAllarme = computed(() => {
  const b = dataStored.alert && dataStored.alert.badge;
  return b && b.desc === dataStored.alert.desc && b.title === dataStored.alert.title ? b.text : '';
});
const nAllarmi = computed(() => activeAlarmUnits(isMachineConfigured(2)).length);
</script>

<style scoped>
.shell {
  display: flex;
  /* (fase E1.4) --app-h: 100dvh, o innerHeight dove il browser non conosce
     dvh (design-tokens.css e appHeight.js). Con 100vh su un browser vecchio
     la barra degli indirizzi nascosta spingeva il fondo della shell, e
     Impostazioni, sotto il bordo. */
  height: var(--app-h);
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
.shell__tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  min-width: 0;
}
.shell__tabs:not(:has(.section-tabs)):not(:has(#section-extra > *)) { display: none; }
.shell__extra { display: flex; justify-content: flex-end; min-width: 0; }
.shell__extra:empty { display: none; }
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
