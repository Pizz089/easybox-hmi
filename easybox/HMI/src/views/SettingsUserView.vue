<!-- ==========================================================================
     SettingsUserView.vue — Impostazioni > Utente e lingua (/settings/user).
     Visibile anche all'operatore (livello 0): e' la scheda che fa esistere
     Impostazioni per lui, e porta la lingua dove la striscia compatta non
     ce l'ha (tablet, 4:3).
       - Utente: livello attuale e il cambio livello, con LO STESSO dialog
         di oggi (components/ChangeUserModal.vue);
       - Lingua: lo stesso ciclo it -> en della striscia (util/lingua.js).
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
    </div>
    <ChangeUserModal :open="aperto" @close="aperto = false" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { UserRound, Languages } from 'lucide-vue-next';
import { dataStored } from '@/data';
import { useLingua } from '@/util/lingua.js';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import ChangeUserModal from '@/components/ChangeUserModal.vue';

const { t } = useI18n();
const { locale, cambiaLingua } = useLingua();
const livello = computed(() => Number(dataStored.userLevel) || 0);
const aperto = ref(false);
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
</style>
