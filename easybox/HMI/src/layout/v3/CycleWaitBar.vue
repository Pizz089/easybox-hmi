<!-- ==========================================================================
     CycleWaitBar.vue — avviso fisso «perche' il ciclo MC1 e' fermo» (consegna
     36, 8/10), sotto la striscia di stato, in tutte le pagine della shell.

     L'8/10 la cella e' rimasta ferma per ore senza un messaggio a video.
     Decisioni di Dario: l'avviso e' FISSO (non un avviso breve, non un
     velo) e copre tutti i motivi; testo e link alla pagina giusta; NESSUN
     pulsante di comando. L'unico elemento toccabile e' il link «Vai a ...».

     Sta nella colonna della shell fra la striscia e il contenuto: spinge il
     contenuto in basso e non copre niente (HOLD e campanella restano nella
     striscia, sopra). Una riga sola: in compatto il testo breve; in largo il
     testo lungo, e quello breve se il lungo non ci sta; se non ci sta
     nemmeno il breve, «…» (il link resta intero).

     Regole e testi: util/attesaMc1.js; dati: stores/attesaMc1.js (la shell
     lo avvia). Niente riquadro col codice 0, o se il backend non ha mai
     mandato niente (PLC senza la 36).
     ========================================================================== -->
<template>
  <div v-if="riga.tipo !== 'nessuna'" ref="barra" class="cycle-wait" :class="'cycle-wait--' + riga.tipo"
    role="status" aria-live="polite" :data-tipo="riga.tipo" :data-codice="riga.codice">
    <component :is="icona" class="cycle-wait__icon" :stroke-width="2" aria-hidden="true" />
    <span ref="testo" class="cycle-wait__text">{{ brevi ? testi.breve : testi.lungo }}</span>
    <a v-if="riga.link" class="cycle-wait__link" :href="href" @click.prevent="vai">
      {{ brevi ? testi.linkBreve : testi.link }}<ChevronRight :stroke-width="2" aria-hidden="true" />
    </a>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { TriangleAlert, Info, Clock, ChevronRight } from 'lucide-vue-next';
import { dataStored } from '@/data';
import { attesaMc1 } from '@/stores/attesaMc1.js';
import { rigaAttesa, testiAttesa, TIPO } from '@/util/attesaMc1.js';
import { useCompact } from '@/util/breakpoints';

const { t, te, locale } = useI18n();
const router = useRouter();
const compact = useCompact();

const riga = computed(() => rigaAttesa(attesaMc1.attesa, {
  ordini: attesaMc1.ordini, ordiniNoti: attesaMc1.ordiniNoti, livello: dataStored.userLevel,
}));
const testi = computed(() => testiAttesa(riga.value, attesaMc1.attesa, { t, te }));
const icona = computed(() => (riga.value.tipo === TIPO.AVVISO ? TriangleAlert : riga.value.tipo === TIPO.STANTIA ? Clock : Info));
const href = computed(() => (riga.value.link ? router.resolve(riga.value.link.to).href : null));
// il link e' navigazione, non un comando
function vai() {
  if (riga.value.link) router.push(riga.value.link.to);
}

// ---- testo breve: in compatto sempre; in largo se il lungo non ci sta
const barra = ref(null);
const testo = ref(null);
const sfora = ref(false);
const brevi = computed(() => compact.value || sfora.value);
let misurando = false;
let ancora = false;    // richiesta arrivata a misura in corso: si rifa' dopo
async function misura() {
  if (misurando) { ancora = true; return; }
  misurando = true;
  try {
    sfora.value = false;
    await nextTick();
    const el = testo.value;
    sfora.value = !!el && el.scrollWidth > el.clientWidth;
  } finally {
    misurando = false;
    if (ancora) { ancora = false; misura(); }
  }
}
watch(() => [testi.value.lungo, testi.value.link, compact.value, locale.value], () => { misura(); });
let osservatore = null;
watch(barra, el => {
  if (osservatore) { osservatore.disconnect(); osservatore = null; }
  if (el && typeof ResizeObserver !== 'undefined') {
    osservatore = new ResizeObserver(() => misura());
    osservatore.observe(el);
  }
});
onMounted(misura);
onUnmounted(() => { if (osservatore) osservatore.disconnect(); });
</script>

<style scoped>
.cycle-wait {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--touch-target-min);
  padding: 0 var(--page-padding);
  box-sizing: border-box;
  min-width: 0;
  /* la riga di separazione senza un bordo: col bordo la riga, che ha dentro
     il link alto 48, diventava alta 49 */
  box-shadow: inset 0 -1px 0 var(--border-subtle);
  font-size: var(--font-size-base);
  line-height: 1.25;
}
.cycle-wait--avviso { background: var(--color-warning-bg); color: var(--color-warning-fg); }
.cycle-wait--neutra,
.cycle-wait--stantia { background: var(--bg-surface); color: var(--text-secondary); }
.cycle-wait__icon { flex: none; width: var(--icon-size-md); height: var(--icon-size-md); }
.cycle-wait__text {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: var(--font-weight-bold);
}
.cycle-wait--avviso .cycle-wait__text { color: var(--text-primary); }
/* il link: bersaglio alto quanto la riga (48), mai tagliato */
.cycle-wait__link {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--touch-target-min);
  padding: 0 var(--space-2);
  color: inherit;
  font-weight: var(--font-weight-extrabold);
  white-space: nowrap;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.cycle-wait__link svg { width: var(--icon-size-sm); height: var(--icon-size-sm); flex: none; }
@media (max-width: 1599px) {
  .cycle-wait { gap: var(--space-2); font-size: var(--font-size-sm); }
  .cycle-wait__icon { width: 20px; height: 20px; }
}
</style>
