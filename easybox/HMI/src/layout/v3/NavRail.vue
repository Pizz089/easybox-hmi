<!-- ==========================================================================
     NavRail.vue — barra di navigazione a sinistra del pannello v3 (tavole
     Main, Home43, Tablet). Sette voci con icona ed etichetta; la voce
     attiva ha icona e testo nell'accento su --bg-raised; Allarmi porta il
     badge rosso col numero degli allarmi attivi. Larga 104 px (84 in
     compatto, dove alcune etichette si accorciano: "Attrezz.", "Impost.").
     Una voce porta alla PRIMA scheda visibile a questo livello (le rotte
     sono quelle di oggi). Se a questo livello non ha schede (Impostazioni
     per l'operatore) apre il cambio utente: nessuna voce che dice "non
     abilitato".
     ========================================================================== -->
<template>
  <nav class="rail" :aria-label="t('nav.aria')">
    <div v-if="!compact" class="rail__mark" aria-hidden="true">EB</div>
    <template v-for="s in NAV" :key="s.id">
      <RouterLink v-if="primaScheda(s)" :to="primaScheda(s).to" class="rail__item"
        :class="{ on: attiva && attiva.id === s.id, 'rail__item--bottom': s.bottom }"
        :aria-current="attiva && attiva.id === s.id ? 'page' : undefined">
        <component :is="s.icon" class="rail__icon" :stroke-width="2" aria-hidden="true" />
        <span>{{ etichetta(s) }}</span>
        <span v-if="s.badge && alarms > 0" class="rail__badge">{{ alarms }}</span>
      </RouterLink>
      <button v-else type="button" class="rail__item" :class="{ 'rail__item--bottom': s.bottom }"
        @click="$emit('open-user')">
        <component :is="s.icon" class="rail__icon" :stroke-width="2" aria-hidden="true" />
        <span>{{ etichetta(s) }}</span>
      </button>
    </template>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { dataStored } from '@/data';
import { isMachineConfigured } from '@/util/machineBrands';
import { useCompact } from '@/util/breakpoints';
import { NAV, sectionOf, visibleTabs } from '../navConfig.js';

defineProps({ alarms: { type: Number, default: 0 } });
defineEmits(['open-user']);
const { t } = useI18n();
const route = useRoute();
const compact = useCompact();
const attiva = computed(() => sectionOf(route.path));
const primaScheda = s => visibleTabs(s, dataStored.userLevel, isMachineConfigured)[0] || null;
const etichetta = s => (compact.value && s.short ? t(s.short) : t(s.label));
</script>

<style scoped>
.rail {
  width: var(--rail-width);
  flex: none;
  height: 100%;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 0;
  box-sizing: border-box;
  overflow-y: auto;
}
.rail__mark {
  width: 56px;
  height: 56px;
  flex: none;
  border-radius: var(--radius-btn);
  background: var(--bg-raised);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-extrabold);
  margin-bottom: 14px;
}
.rail__item {
  position: relative;
  flex: none;
  width: 84px;
  height: 78px;
  border: 0;
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: inherit;
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-bold);
  text-decoration: none;
  cursor: pointer;
}
.rail__item.on { color: var(--accent); background: var(--bg-raised); }
.rail__item--bottom { margin-top: auto; }
.rail__icon { width: var(--icon-size-nav); height: var(--icon-size-nav); }
.rail__badge {
  position: absolute;
  top: 8px;
  right: 14px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  box-sizing: border-box;
  border-radius: 11px;
  background: var(--color-danger);
  color: #fff;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-extrabold);
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1599px) {
  .rail { padding: 12px 0; gap: 2px; }
  .rail__item { width: 72px; height: 66px; gap: 4px; border-radius: 14px; font-size: 11px; }
  .rail__icon { width: 26px; height: 26px; }
  .rail__badge { top: 5px; right: 10px; min-width: 20px; height: 20px; font-size: 11px; }
}
</style>
