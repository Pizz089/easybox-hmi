<!-- ==========================================================================
     NavRail.vue — barra di navigazione a sinistra del pannello v3 (tavole
     Main, Home43, Tablet). Nove voci con icona ed etichetta (fase E1.7:
     Home, Controlli, Produzione, Magazzino, Attrezzaggio, Pinze, Spinta,
     Allarmi, Impostazioni in fondo); la voce attiva ha icona e testo
     nell'accento su --bg-raised; Allarmi porta il badge rosso col numero
     degli allarmi attivi. Larga 104 px (84 in compatto, dove alcune
     etichette si accorciano: "Attrezz.", "Spinta", "Impost.").
     (fase E1.3) il marchio «EB» in cima non c'e' piu': il logo aziendale
     sta nella striscia di stato.
     (fase E1.4, tablet 16:10) nessuno scorrimento della barra fino a 400 px
     CSS di altezza: Impostazioni, in fondo, resta sempre visibile. Le voci
     scalano con l'altezza disponibile: (altezza - margini) / voci, fino a
     66 px in compatto e 78 in largo, mai sotto i 44.
       - Decisione di Dario (7/10): quando le nove voci non ci stanno a
         52 px l'una (sotto i 508 px di altezza: 9 x 52 + 2 x 12 di margine
         + 8 x 2 di spazio), Allarmi esce dalla barra (navConfig,
         dropWhenShort). Resta la campanella della striscia, col numero.
       - Con otto voci, sotto i 454 px di altezza le voci scendono sotto i
         52 px: le etichette spariscono, restano l'icona e l'aria-label.
       - Sotto i 508 px i margini sono quelli del compatto anche nel largo.
     L'altezza e' --app-h (100dvh, o innerHeight dove il browser non conosce
     dvh: AppShell).
     Una voce porta alla PRIMA scheda visibile a questo livello (le rotte
     sono quelle di oggi). Se a questo livello non ha schede (Impostazioni
     per l'operatore) apre il cambio utente: nessuna voce che dice "non
     abilitato".
     ========================================================================== -->
<template>
  <nav class="rail" :aria-label="t('nav.aria')">
    <template v-for="s in NAV" :key="s.id">
      <RouterLink v-if="primaScheda(s)" :to="primaScheda(s).to" class="rail__item"
        :class="{ on: attiva && attiva.id === s.id, 'rail__item--bottom': s.bottom, 'rail__item--drop': s.dropWhenShort }"
        :aria-current="attiva && attiva.id === s.id ? 'page' : undefined" :aria-label="etichetta(s)">
        <component :is="s.icon" class="rail__icon" :stroke-width="2" aria-hidden="true" />
        <span class="rail__label">{{ etichetta(s) }}</span>
        <span v-if="s.badge && alarms > 0" class="rail__badge">{{ alarms }}</span>
      </RouterLink>
      <button v-else type="button" class="rail__item" :class="{ 'rail__item--bottom': s.bottom, 'rail__item--drop': s.dropWhenShort }"
        :aria-label="etichetta(s)" @click="$emit('open-user')">
        <component :is="s.icon" class="rail__icon" :stroke-width="2" aria-hidden="true" />
        <span class="rail__label">{{ etichetta(s) }}</span>
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
  /* altezza di una voce: le voci nell'altezza disponibile (fasi E1.4, E1.7) */
  --rail-n: 9;
  --rail-pad: 18px;
  --rail-gap: 6px;
  --rail-item-max: 78px;
  --rail-item-h: clamp(44px, calc((var(--app-h) - 2 * var(--rail-pad) - (var(--rail-n) - 1) * var(--rail-gap)) / var(--rail-n)), var(--rail-item-max));
  width: var(--rail-width);
  flex: none;
  height: 100%;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rail-gap);
  padding: var(--rail-pad) 0;
  box-sizing: border-box;
  overflow-y: auto;
}
.rail__item {
  position: relative;
  flex: none;
  width: 84px;
  height: var(--rail-item-h);
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
/* (fase E1.7) «Spinta in battuta» nel largo va su due righe: centrate */
.rail__label { text-align: center; line-height: 1.15; }
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
  .rail { --rail-pad: 12px; --rail-gap: 2px; --rail-item-max: 66px; }
  .rail__item { width: 72px; gap: 4px; border-radius: 14px; font-size: 11px; }
  .rail__icon { width: 26px; height: 26px; }
  .rail__badge { top: 5px; right: 10px; min-width: 20px; height: 20px; font-size: 11px; }
}
/* schermi bassi (fase E1.4): sotto i 552 px i margini del compatto anche nel
   largo; sotto i 508 px le nove voci non stanno a 52 px l'una e Allarmi
   esce (resta la campanella della striscia); con otto voci, sotto i 454 px
   le voci scendono sotto i 52 px: solo l'icona (l'etichetta resta come
   aria-label) */
@media (max-height: 551.98px) {
  .rail { --rail-pad: 12px; --rail-gap: 2px; }
}
@media (max-height: 507.98px) {
  .rail { --rail-n: 8; }
  .rail__item--drop { display: none; }
}
@media (max-height: 453.98px) {
  .rail__label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
}
</style>
