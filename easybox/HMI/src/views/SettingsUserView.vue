<!-- ==========================================================================
     SettingsUserView.vue — Impostazioni > Utente e lingua (/settings/user).
     Visibile anche all'operatore (livello 0): e' la scheda che fa esistere
     Impostazioni per lui, e porta la lingua dove la striscia compatta non
     ce l'ha (tablet, 4:3).
       - Utente: livello attuale e il cambio livello, con LO STESSO dialog
         di oggi (components/ChangeUserModal.vue);
       - Lingua: lo stesso ciclo it -> en della striscia (util/lingua.js).
       - Schermo (fase E1.1, 7/10): i numeri che vede il browser, per leggere
         quelli veri del PC di cella e del tablet (util/screenInfo.js). Si
         aggiorna al ridimensionamento e alla rotazione. Non cambia il punto
         di rottura dei 1600 px.
     ========================================================================== -->
<template>
  <!-- (v3 fase D) conf-v3: titolo, campi e schede v3 (assets/css/catalog-v3.css). Solo aspetto. -->
  <div class="view-shell settings-user conf-v3">
    <h2 class="view-title">{{ t('nav.tab.userLang') }}</h2>
    <div class="settings-user__grid">
      <UiCard :label="t('settings.user')">
        <p class="settings-user__value">{{ t('changeUser.levelLabel.' + livello) }}</p>
        <UiButton variant="secondary" :icon="UserRound" @click="aperto = true">{{ t('settings.changeLevel') }}</UiButton>
      </UiCard>
      <UiCard :label="t('settings.language')">
        <p class="settings-user__value">{{ t('settings.langName.' + locale) }}</p>
        <UiButton variant="secondary" :icon="Languages" @click="cambiaLingua">{{ t('settings.changeLanguage') }}</UiButton>
      </UiCard>
      <UiCard :label="t('settings.screen.title')" class="settings-user__screen">
        <dl class="settings-screen">
          <dt>{{ t('settings.screen.css') }}</dt>
          <dd data-screen="css">{{ schermo.css }} <small>{{ t('settings.screen.cssUnit') }}</small></dd>
          <dt>{{ t('settings.screen.dpr') }}</dt>
          <dd data-screen="dpr">{{ schermo.dpr }}</dd>
          <dt>{{ t('settings.screen.physical') }}</dt>
          <dd data-screen="physical">{{ schermo.fisici }}</dd>
          <dt>{{ t('settings.screen.layout') }}</dt>
          <dd data-screen="layout">{{ t(schermo.misura, { n: schermo.soglia }) }}</dd>
        </dl>
        <p class="settings-screen__hint">{{ t('settings.screen.hint', { n: schermo.soglia }) }}</p>
      </UiCard>
    </div>
    <ChangeUserModal :open="aperto" @close="aperto = false" />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { UserRound, Languages } from 'lucide-vue-next';
import { dataStored } from '@/data';
import { useLingua } from '@/util/lingua.js';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import ChangeUserModal from '@/components/ChangeUserModal.vue';
import { screenInfo, leggiSchermo } from '@/util/screenInfo.js';

const { t } = useI18n();
const { locale, cambiaLingua } = useLingua();
const livello = computed(() => Number(dataStored.userLevel) || 0);
const aperto = ref(false);

// (E1.1) schermo: si rilegge al ridimensionamento e alla rotazione
const misure = ref(leggiSchermo());
const schermo = computed(() => screenInfo(misure.value));
const rileggi = () => { misure.value = leggiSchermo(); };
onMounted(() => {
  rileggi();
  window.addEventListener('resize', rileggi);
  window.addEventListener('orientationchange', rileggi);
});
onUnmounted(() => {
  window.removeEventListener('resize', rileggi);
  window.removeEventListener('orientationchange', rileggi);
});
</script>

<style scoped>
.settings-user__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-5);
}
.settings-user__value {
  margin: 0 0 var(--space-4);
  font-size: var(--font-size-state);
  font-weight: var(--font-weight-extrabold);
  color: var(--text-primary);
}
.settings-screen {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-2) var(--space-5);
  margin: 0 0 var(--space-4);
  font-size: var(--font-size-md);
}
.settings-screen dt { color: var(--text-secondary); font-weight: var(--font-weight-bold); }
.settings-screen dd { margin: 0; color: var(--text-primary); font-weight: var(--font-weight-extrabold); font-variant-numeric: tabular-nums; }
.settings-screen dd small { color: var(--text-secondary); font-weight: var(--font-weight-bold); }
.settings-screen__hint { margin: 0; color: var(--text-secondary); font-size: var(--font-size-body); }
</style>
