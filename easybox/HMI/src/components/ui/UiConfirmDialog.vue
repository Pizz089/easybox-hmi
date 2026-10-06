<!-- ==========================================================================
     UiConfirmDialog.vue — conferma di un comando (tavola Conferma).
     Icona nel cerchio colorato, titolo, testo che dice cosa fa e cosa NON
     fa, elenco delle precondizioni verificate, Annulla in contorno e il
     comando (rosso pieno se pericoloso). Si appoggia alle classi uniche di
     assets/css/dialogs.css (fase 0): stesso velo e stessa scatola di tutti
     i dialog del pannello.
     Il dialog NON manda comandi: emette "confirm" e chi lo usa decide
     (ricontrollando lo stato, come fa oggi confirmCritical in robotView).
     ========================================================================== -->
<template>
  <div v-if="open" class="mission-dialog-overlay" @click.self="$emit('cancel')">
    <section class="mission-dialog ui-confirm" role="dialog" aria-modal="true" :aria-labelledby="idTitolo">
      <div class="ui-confirm__icon" :class="'ui-confirm__icon--' + tone">
        <component :is="icon || TriangleAlert" :stroke-width="2" aria-hidden="true" />
      </div>
      <div>
        <h2 :id="idTitolo" class="ui-confirm__title">{{ title }}</h2>
        <p v-if="text" class="ui-confirm__text">{{ text }}</p>
        <slot />
      </div>
      <ul v-if="checks && checks.length" class="ui-confirm__checks">
        <li v-for="c in checks" :key="c"><Check :stroke-width="2.5" aria-hidden="true" />{{ c }}</li>
      </ul>
      <div class="ui-confirm__actions">
        <UiButton variant="outline" size="main" block @click="$emit('cancel')">{{ cancelLabel }}</UiButton>
        <UiButton :variant="tone === 'danger' ? 'danger' : 'primary'" size="main" block :icon="confirmIcon"
          :disabled="confirmDisabled" @click="$emit('confirm')">{{ confirmLabel }}</UiButton>
      </div>
    </section>
  </div>
</template>

<script setup>
import { TriangleAlert, Check } from 'lucide-vue-next';
import UiButton from './UiButton.vue';

let n = 0;
const idTitolo = 'ui-confirm-' + (++n) + '-' + Math.random().toString(36).slice(2, 7);
defineProps({
  open: { type: Boolean, default: false },
  tone: { type: String, default: 'danger', validator: v => ['danger', 'warning', 'info'].includes(v) },
  icon: { type: [Object, Function], default: null },
  title: { type: String, required: true },
  text: { type: String, default: '' },
  checks: { type: Array, default: () => [] },   // precondizioni verificate
  confirmLabel: { type: String, required: true },
  cancelLabel: { type: String, required: true },
  confirmIcon: { type: [Object, Function], default: null },
  confirmDisabled: { type: Boolean, default: false },
});
defineEmits(['confirm', 'cancel']);
</script>

<style scoped>
.ui-confirm__icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ui-confirm__icon svg { width: 30px; height: 30px; }
.ui-confirm__icon--danger  { background: var(--color-danger-bg);  color: var(--color-danger-fg); }
.ui-confirm__icon--warning { background: var(--color-warning-bg); color: var(--color-warning-fg); }
.ui-confirm__icon--info    { background: var(--color-info-bg);    color: var(--color-info-fg); }
.ui-confirm__title { margin: 0; font-size: 30px; font-weight: var(--font-weight-extrabold); line-height: 1.2; color: var(--text-primary); text-transform: none; letter-spacing: 0; }
.ui-confirm__text { margin: 12px 0 0; font-size: var(--font-size-md); line-height: 1.55; color: var(--text-secondary); }
.ui-confirm__checks {
  list-style: none;
  margin: 0;
  padding: 18px 20px;
  border-radius: var(--radius-btn);
  background: var(--bg-well);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.ui-confirm__checks li { display: flex; align-items: center; gap: var(--space-3); font-size: var(--font-size-body); font-weight: var(--font-weight-bold); color: var(--text-primary); }
.ui-confirm__checks svg { width: 22px; height: 22px; color: var(--color-success-fg); flex: none; }
.ui-confirm__actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: var(--space-1); }
@media (max-width: 1599px) { .ui-confirm__title { font-size: 24px; } }
</style>
