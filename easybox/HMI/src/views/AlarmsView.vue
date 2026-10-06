<!-- ==========================================================================
     AlarmsView.vue — /alarms, rotta nuova del pannello v3.

     FASE A: versione di base, perche' la voce Allarmi della barra e la
     campanella della striscia portino a qualcosa di vero anche per
     l'operatore. Solo dati che esistono:
       - unita' in allarme ADESSO (stato STATUS = allarme, stores/
         plantStatus.js), col testo i18n robot.alarm_<codice> dove c'e';
       - storico: GET api/alarm/show/all (ultime 50 righe di LOG ALARM%),
         ora e descrizione come le scrive il backend.
     La pagina in stile HMS (dettaglio, "Cosa e' successo", "Cosa fare",
     attivi/storico, riconoscimento) e' la fase D.
     ========================================================================== -->
<template>
  <div class="view-shell alarms">
    <h2 class="view-title">{{ t('nav.alarms') }}</h2>

    <UiCard :label="t('alarms.activeNow')">
      <ul v-if="attivi.length" class="alarms__list">
        <li v-for="a in attivi" :key="a.unit" class="alarms__row">
          <span class="alarms__sev" aria-hidden="true"><CircleX :stroke-width="2" /></span>
          <span class="alarms__text">
            <b>{{ a.titolo }}</b>
            <small>{{ a.unit }}<template v-if="a.code"> · <span class="mono">{{ a.code }}</span></template></small>
          </span>
        </li>
      </ul>
      <p v-else class="alarms__empty">{{ t('alarms.noneActive') }}</p>
    </UiCard>

    <UiCard :label="t('alarms.history')">
      <StatoElenco v-if="stato !== 'ok'" :stato="stato" :vuoto="false" @riprova="carica" />
      <p v-else-if="!storico.length" class="alarms__empty">{{ t('alarms.historyEmpty') }}</p>
      <ul v-else class="alarms__list">
        <li v-for="(r, i) in storico" :key="i" class="alarms__row">
          <span class="alarms__time mono">{{ r.Timestamp }}</span>
          <span class="alarms__text">
            <b>{{ testoAllarme(r.descr) }}</b>
            <small v-if="codice(r.descr)" class="mono">{{ codice(r.descr) }}</small>
          </span>
        </li>
      </ul>
    </UiCard>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CircleX } from 'lucide-vue-next';
import { dataStored } from '@/data';
import { isMachineConfigured } from '@/util/machineBrands';
import { caricaElenco, STATO } from '@/util/caricaElenco.js';
import { plant, activeAlarmUnits } from '@/stores/plantStatus.js';
import UiCard from '@/components/ui/UiCard.vue';
import StatoElenco from '@/components/StatoElenco.vue';

const { t, te } = useI18n();
const attivi = computed(() => activeAlarmUnits(isMachineConfigured(2)).map(unit => {
	// solo il robot ha un codice live (ROBOT/DESCR): per le altre unita' lo
	// stato dice "in allarme", il codice non arriva qui
	const code = unit === 'ROBOT' ? plant.robotAlarm : '';
	const k = code ? 'robot.alarm_' + code : '';
	return { unit, code, titolo: k && te(k) ? t(k) : t('alarms.unitInAlarm', { unit }) };
}));

// LOG.descr e' il codice grezzo ("+900011", "23"): se c'e' un testo
// robot.alarm_<codice> si mostra quello (testi gia' esistenti, nessuno
// inventato), altrimenti la descrizione com'e'
const codice = d => { const m = String(d == null ? '' : d).trim().match(/^\+?(\d+)$/); return m ? m[1] : ''; };
const testoAllarme = d => { const c = codice(d); return c && te('robot.alarm_' + c) ? t('robot.alarm_' + c) : String(d == null ? '' : d).trim(); };

const stato = ref(STATO.ATTESA);
const storico = ref([]);
function carica() {
	stato.value = STATO.ATTESA;
	caricaElenco(dataStored.server, 'api/alarm/show/all').then(e => {
		stato.value = e.stato;
		if (e.stato === STATO.OK) storico.value = e.dati || [];
	});
}
onMounted(carica);
</script>

<style scoped>
.alarms__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.alarms__row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: 64px;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-btn);
  background: var(--bg-row);
  box-sizing: border-box;
}
.alarms__sev {
  width: 48px;
  height: 48px;
  flex: none;
  border-radius: var(--radius-chip);
  background: var(--color-danger-bg);
  color: var(--color-danger-fg);
  display: flex;
  align-items: center;
  justify-content: center;
}
.alarms__sev svg { width: 26px; height: 26px; }
.alarms__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; color: var(--text-primary); font-size: var(--font-size-body); }
.alarms__text small { color: var(--text-muted); font-size: var(--font-size-sm); }
.alarms__time { flex: none; color: var(--text-secondary); font-size: var(--font-size-sm); }
.alarms__empty { margin: 0; color: var(--text-secondary); }
</style>
