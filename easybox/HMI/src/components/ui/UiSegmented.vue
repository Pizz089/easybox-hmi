<!-- ==========================================================================
     UiSegmented.vue — selettore a segmenti (tavole Robot: Apri/Chiusa delle
     chele, preset di velocita'; Produzione: filtri; Allarmi: Attivi/
     Storico). v-model sul valore scelto; ogni opzione puo' avere un
     contatore. Traccia --bg-chip, segmento scelto --bg-segment-on.
     ========================================================================== -->
<template>
  <div class="ui-seg" role="group" :class="{ 'ui-seg--block': block }">
    <button v-for="o in options" :key="o.value" type="button"
      class="ui-seg__opt" :class="{ on: o.value === modelValue }"
      :aria-pressed="o.value === modelValue" :disabled="disabled || o.disabled"
      @click="$emit('update:modelValue', o.value)">
      {{ o.label }}<span v-if="o.count !== undefined && o.count !== null" class="ui-seg__count">{{ o.count }}</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  options: { type: Array, required: true },        // [{ value, label, count?, disabled? }]
  modelValue: { type: [String, Number, Boolean], default: null },
  block: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);
</script>

<style scoped>
.ui-seg {
  display: inline-flex;
  gap: var(--space-1);
  padding: var(--space-1);
  border-radius: 14px;
  background: var(--bg-chip);
  box-sizing: border-box;
}
.ui-seg--block { display: flex; }
.ui-seg--block .ui-seg__opt { flex: 1; }
.ui-seg__opt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch-target-min);
  padding: 0 22px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
}
.ui-seg__opt.on { background: var(--bg-segment-on); color: var(--text-primary); }
.ui-seg__opt:disabled { color: var(--text-disabled); cursor: not-allowed; }
.ui-seg__count { color: var(--text-muted); }
</style>
