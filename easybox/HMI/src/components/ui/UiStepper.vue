<!-- ==========================================================================
     UiStepper.vue — passi numerici (tavola Robot: velocita' −10 −1 +1 +10).
     Emette SOLO il passo scelto (@step con il delta): il valore, i limiti,
     l'eco del PLC e l'invio unico dopo la pausa li decide chi lo usa
     (fase B, pagina Robot). Lo slot di default va fra i passi negativi e
     quelli positivi (es. la barra del valore).
     ========================================================================== -->
<template>
  <div class="ui-stepper" role="group">
    <button v-for="d in negativi" :key="d" type="button" class="ui-stepper__btn"
      :disabled="disabled" @click="$emit('step', d)">{{ etichetta(d) }}</button>
    <div class="ui-stepper__mid"><slot /></div>
    <button v-for="d in positivi" :key="d" type="button" class="ui-stepper__btn"
      :disabled="disabled" @click="$emit('step', d)">{{ etichetta(d) }}</button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({
  steps: { type: Array, default: () => [-10, -1, 1, 10] },
  disabled: { type: Boolean, default: false },
});
defineEmits(['step']);
const negativi = computed(() => props.steps.filter(d => d < 0));
const positivi = computed(() => props.steps.filter(d => d > 0));
// il segno meno tipografico, come nelle tavole
const etichetta = d => (d < 0 ? '−' + Math.abs(d) : '+' + d);
</script>

<style scoped>
.ui-stepper { display: flex; align-items: center; gap: var(--space-3); }
.ui-stepper__mid { flex: 1; min-width: 0; }
.ui-stepper__btn {
  width: 76px;
  min-height: var(--touch-primary);
  border: 0;
  border-radius: var(--radius-btn);
  background: var(--bg-surface-2);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 20px;
  font-weight: var(--font-weight-extrabold);
  cursor: pointer;
}
.ui-stepper__btn:disabled { background: var(--bg-input); color: var(--text-muted); cursor: not-allowed; }
@media (max-width: 1599px) { .ui-stepper__btn { width: 68px; font-size: 18px; } }
</style>
