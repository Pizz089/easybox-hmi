<!-- ==========================================================================
     UiBadge.vue — badge di STATO (tavole Produzione, Home: "In lavoro",
     "Finito", "In pausa: HOLD"). Il colore e' quello dello stato, mai
     decorativo: success / warning / danger / info / neutral; "accent" solo
     per lo stato in corso (contorno, tavola Produzione).
     ========================================================================== -->
<template>
  <span class="ui-badge" :class="'ui-badge--' + tone">
    <i v-if="dot" class="ui-badge__dot" aria-hidden="true"></i>
    <slot />
  </span>
</template>

<script setup>
defineProps({
  tone: { type: String, default: 'neutral', validator: v => ['success', 'warning', 'danger', 'info', 'neutral', 'accent'].includes(v) },
  dot: { type: Boolean, default: true },
});
</script>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 11px;
  border-radius: 9px;
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
  box-sizing: border-box;
}
.ui-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none; }
.ui-badge--success { background: var(--color-success-bg); color: var(--color-success-fg); }
.ui-badge--warning { background: var(--color-warning-bg); color: var(--color-warning-fg); }
.ui-badge--danger  { background: var(--color-danger-bg);  color: var(--color-danger-fg); }
.ui-badge--info    { background: var(--color-info-bg);    color: var(--color-info-fg); }
.ui-badge--neutral { background: var(--bg-chip);          color: var(--text-chip); }
.ui-badge--neutral .ui-badge__dot { background: var(--text-muted); }
.ui-badge--accent  { background: transparent; color: var(--accent); box-shadow: inset 0 0 0 1.5px var(--accent); }
</style>
