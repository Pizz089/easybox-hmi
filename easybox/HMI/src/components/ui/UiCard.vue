<!-- ==========================================================================
     UiCard.vue — contenitore del pannello v3: piena su --bg-surface, angoli
     20 (16 in compatto), niente bordo e niente ombra. Etichetta in alto in
     MAIUSCOLO (prop label o slot "label"), azioni a destra (slot "actions").
     ========================================================================== -->
<template>
  <section class="ui-card" :class="{ 'ui-card--flush': flush }">
    <header v-if="label || $slots.label || $slots.actions" class="ui-card__head">
      <span class="ui-card__label"><slot name="label">{{ label }}</slot></span>
      <span v-if="$slots.actions" class="ui-card__actions"><slot name="actions" /></span>
    </header>
    <slot />
  </section>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  flush: { type: Boolean, default: false },   // senza padding (liste a filo)
});
</script>

<style scoped>
.ui-card {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: var(--card-padding);
  box-sizing: border-box;
  min-width: 0;
}
.ui-card--flush { padding: 0; }
.ui-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}
.ui-card__label {
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  color: var(--text-muted);
}
.ui-card__actions { display: inline-flex; gap: var(--space-2); }

</style>
