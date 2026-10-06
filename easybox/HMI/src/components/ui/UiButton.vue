<!-- ==========================================================================
     UiButton.vue — pulsante del pannello v3 (UI-DESIGN-SYSTEM v3 §3)

     Quattro varianti:
       primary   accento pieno, testo --accent-on: SOLO l'azione primaria
       secondary grafite (--bg-surface-2): i comandi normali, nessun colore
                 per famiglia (le missioni non sono piu' gialle)
       outline   contorno: Annulla, azioni minori
       danger    rosso pieno, testo bianco: comandi distruttivi
     Tre altezze: main 64 (56 in compatto), default 56, min 48 (minimo
     assoluto touch). L'icona e' un componente lucide (stroke 2, 24 px).
     Il pulsante non conosce il comando: chi lo usa passa @click, e la
     mappa golden dei comandi controlla che resti lo stesso.
     ========================================================================== -->
<template>
  <button
    :type="type"
    class="ui-btn"
    :class="['ui-btn--' + variant, 'ui-btn--' + size, { 'ui-btn--block': block }]"
    :disabled="disabled"
  >
    <component :is="icon" v-if="icon" class="ui-btn__icon" :stroke-width="2" aria-hidden="true" />
    <span v-if="$slots.default" class="ui-btn__label"><slot /></span>
  </button>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'secondary', validator: v => ['primary', 'secondary', 'outline', 'danger'].includes(v) },
  size: { type: String, default: 'default', validator: v => ['main', 'default', 'min'].includes(v) },
  icon: { type: [Object, Function], default: null },
  block: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  type: { type: String, default: 'button' },
});
</script>

<style scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  padding: 0 var(--space-5);
  border: 0;
  border-radius: var(--radius-btn);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
  transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
}
.ui-btn--main { min-height: var(--touch-primary); }
.ui-btn--min  { min-height: var(--touch-target-min); padding: 0 var(--space-4); font-size: var(--font-size-base); }
.ui-btn--block { display: flex; width: 100%; }

.ui-btn__icon { width: var(--icon-size-md); height: var(--icon-size-md); flex: none; }

.ui-btn--primary   { background: var(--accent); color: var(--accent-on); }
.ui-btn--primary:hover:not(:disabled)   { background: var(--accent-hover); }
.ui-btn--primary:active:not(:disabled)  { background: var(--accent-active); }

.ui-btn--secondary { background: var(--bg-surface-2); color: var(--text-primary); }
.ui-btn--secondary:hover:not(:disabled) { background: var(--bg-segment-on); }

.ui-btn--outline   { background: transparent; color: var(--text-primary); box-shadow: inset 0 0 0 1.5px var(--border-default); }
.ui-btn--outline:hover:not(:disabled)   { box-shadow: inset 0 0 0 1.5px var(--border-strong); }

.ui-btn--danger    { background: var(--color-critical); color: #fff; }
.ui-btn--danger:hover:not(:disabled)    { background: var(--color-critical-hover); }

/* spento: leggibile ma chiaramente non disponibile */
.ui-btn:disabled {
  background: var(--bg-input);
  color: var(--text-muted);
  box-shadow: none;
  cursor: not-allowed;
}

@media (max-width: 1599px) {
  .ui-btn { font-size: var(--font-size-base); padding: 0 var(--space-4); }
}
</style>
