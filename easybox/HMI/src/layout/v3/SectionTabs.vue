<!-- ==========================================================================
     SectionTabs.vue — schede in testa alle pagine che raggruppano piu'
     rotte (Controlli: Robot / Macchina MC1 / EasyBox; Magazzino: Cassetti /
     Grigliati / Pezzi; ...). Le prende da layout/navConfig.js secondo la
     rotta corrente, filtrate per livello utente e macchine configurate. Con
     una scheda sola non si mostra niente (Home, Produzione).
     ========================================================================== -->
<template>
  <UiTabBar v-if="schede.length > 1" class="section-tabs" :tabs="schede" :label="t('nav.tabsAria')" />
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { dataStored } from '@/data';
import { isMachineConfigured } from '@/util/machineBrands';
import UiTabBar from '@/components/ui/UiTabBar.vue';
import { sectionOf, visibleTabs } from '../navConfig.js';

const { t } = useI18n();
const route = useRoute();
const schede = computed(() => {
	const s = sectionOf(route.path);
	if (!s) return [];
	return visibleTabs(s, dataStored.userLevel, isMachineConfigured).map(x => ({ to: x.to, label: t(x.label), match: x.match }));
});
</script>

<style scoped>
.section-tabs { align-self: flex-start; }
</style>
