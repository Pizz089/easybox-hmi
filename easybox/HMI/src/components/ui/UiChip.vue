<!-- ==========================================================================
     UiChip.vue — chip della striscia di stato (tavola Main: "HOLD Cella
     ferma", "Robot AUTO · fermo", "MC1 ..."). Pallino col colore dello
     stato, testo neutro; il tono "warning"/"danger" colora tutto il chip
     per lo stato cella (HOLD ambra, ALLARME rosso). Se ha un @click e' un
     collegamento (diventa <button>), altrimenti e' solo informazione.
     ========================================================================== -->
<template>
  <component :is="clickable ? 'button' : 'span'" :type="clickable ? 'button' : undefined"
    class="ui-chip" :class="['ui-chip--' + tone, { 'ui-chip--strong': strong }]">
    <i v-if="dot" class="ui-chip__dot" :class="'ui-chip__dot--' + dot" aria-hidden="true"></i>
    <slot />
  </component>
</template>

<script setup>
defineProps({
  // pallino: success / warning / danger / info / accent / muted (assente = niente pallino)
  dot: { type: String, default: '' },
  // tono del chip intero: neutral (default), warning (HOLD), danger (ALLARME)
  tone: { type: String, default: 'neutral' },
  strong: { type: Boolean, default: false },
  clickable: { type: Boolean, default: false },
});
</script>

<style scoped>
.ui-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: var(--radius-chip);
  background: var(--bg-chip);
  color: var(--text-chip);
  font-family: inherit;
  font-size: 15px;
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  box-sizing: border-box;
}
button.ui-chip { cursor: pointer; }
.ui-chip :deep(b) { color: var(--text-primary); font-weight: var(--font-weight-extrabold); }
.ui-chip__dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.ui-chip__dot--success { background: var(--color-success); }
.ui-chip__dot--warning { background: var(--color-warning); }
.ui-chip__dot--danger  { background: var(--color-danger); }
.ui-chip__dot--info    { background: var(--color-info); }
.ui-chip__dot--accent  { background: var(--accent); }
.ui-chip__dot--muted   { background: var(--text-muted); }

.ui-chip--warning { background: var(--color-warning-bg); color: var(--color-warning-fg); }
.ui-chip--danger  { background: var(--color-danger-bg);  color: var(--color-danger-fg); }
.ui-chip--warning :deep(b), .ui-chip--danger :deep(b) { color: inherit; }
.ui-chip--strong { font-size: 16px; }

@media (max-width: 1599px) {
  .ui-chip { height: 40px; padding: 0 12px; gap: 8px; font-size: 14px; border-radius: 11px; }
  .ui-chip--strong { font-size: 15px; }
}
</style>
