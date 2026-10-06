<!-- ==========================================================================
     UiTabBar.vue — schede in testa alle pagine che raggruppano piu' rotte
     (tavole Robot e Magazzino: "Robot | Macchina MC1 | EasyBox"). Ogni
     scheda e' un RouterLink a una rotta di OGGI: le rotte non cambiano
     nome, la scheda le raggruppa. Attiva se la rotta corrente comincia
     con uno dei suoi prefissi (match), senza distinguere maiuscole (il
     router del pannello non le distingue).
     ========================================================================== -->
<template>
  <nav class="ui-tabs" :aria-label="label">
    <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" class="ui-tabs__tab" :class="{ on: attiva(t) }"
      :aria-current="attiva(t) ? 'page' : undefined">
      {{ t.label }}
    </RouterLink>
  </nav>
</template>

<script setup>
import { RouterLink, useRoute } from 'vue-router';
defineProps({
  tabs: { type: Array, required: true },   // [{ to, label, match?: [prefissi] }]
  label: { type: String, default: '' },
});
const route = useRoute();
const attiva = t => {
  const p = route.path.toLowerCase();
  return (t.match || [t.to]).some(m => p === m.toLowerCase() || p.startsWith(m.toLowerCase().replace(/\/$/, '') + '/'));
};
</script>

<style scoped>
.ui-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  padding: var(--space-1);
  border-radius: 16px;
  background: var(--bg-chip);
}
.ui-tabs__tab {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-target-min);
  padding: 0 22px;
  border-radius: 12px;
  color: var(--text-secondary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  text-decoration: none;
  white-space: nowrap;
}
.ui-tabs__tab.on { background: var(--bg-segment-on); color: var(--text-primary); }
@media (max-width: 1599px) { .ui-tabs__tab { padding: 0 16px; font-size: 15px; } }
</style>
