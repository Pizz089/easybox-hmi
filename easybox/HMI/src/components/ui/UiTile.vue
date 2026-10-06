<!-- ==========================================================================
     UiTile.vue — tile di comando del pannello v3 (tavola Robot: Movimenti,
     Missioni). Neutra (--bg-input), icona in alto a sinistra (28 px),
     testo in basso. Variante "row" per il compatto (icona a sinistra,
     testo accanto: tavola Robot43). Come UiButton non conosce il comando.
     ========================================================================== -->
<template>
  <button type="button" class="ui-tile" :class="{ 'ui-tile--row': row }" :disabled="disabled">
    <component :is="icon" v-if="icon" class="ui-tile__icon" :stroke-width="2" aria-hidden="true" />
    <span class="ui-tile__text"><slot /></span>
  </button>
</template>

<script setup>
defineProps({
  icon: { type: [Object, Function], default: null },
  row: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});
</script>

<style scoped>
.ui-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 120px;
  padding: var(--space-4) 18px;
  border: 0;
  border-radius: var(--radius-btn);
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  line-height: 1.25;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
  transition: background var(--transition-fast);
}
.ui-tile:hover:not(:disabled) { background: var(--bg-surface-2); }
.ui-tile__icon { width: var(--icon-size-tile); height: var(--icon-size-tile); color: var(--text-secondary); flex: none; }

.ui-tile--row {
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  min-height: var(--touch-primary);
  padding: 0 var(--space-3);
  font-size: var(--font-size-body);
}
.ui-tile--row .ui-tile__icon { width: var(--icon-size-md); height: var(--icon-size-md); }

.ui-tile:disabled { color: var(--text-muted); cursor: not-allowed; }
.ui-tile:disabled .ui-tile__icon { color: var(--text-disabled); }
</style>
