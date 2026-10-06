<!-- ==========================================================================
     AlarmsView.vue — /alarms, pannello v3 (fase D, tavola Allarmi).
     Pagina in stile HMS: a sinistra il DETTAGLIO dell'allarme scelto, a
     destra l'elenco con le schede Attivi e Storico. SOLO DATI CHE ESISTONO:
       - attivi: le unita' in stato di allarme (stores/plantStatus.js, la
         stessa fonte del badge della barra e della campanella); il codice
         c'e' solo per il robot (ROBOT/DESCR), per le altre unita' lo stato
         dice "in allarme" e basta; l'ora non c'e';
       - storico: GET api/alarm/show/all (ultime 50 righe di LOG ALARM%),
         ora e descrizione come le scrive il backend; l'unita' non c'e'.
     Testi: "Cosa e' successo" e' il testo robot.alarm_<codice> che esiste
     gia', intero (lo usano anche i toast: non si tocca). "Cosa fare"
     compare SOLO se esiste la chiave robot.alarm_<codice>_fix: oggi
     nessuna, il meccanismo e' pronto e i testi li scrive Dario.
     Livello: i dati non lo portano, sono tutti allarmi (errore).
     Codici lunghi (docs/ALLARMI-PLC.md): missione * 100 + errore, solo i
     due numeri (nel pannello non c'e' una tabella dei nomi delle missioni).
     Niente "Riconosci": nessun endpoint lo fa. Nessun comando: solo la
     navigazione ai Controlli dell'unita' in allarme.
     tests/test_alarms_v3.mjs
     ========================================================================== -->
<template>
  <div class="view-shell view-shell--fill alarms">
    <div class="alarms-head">
      <h2 class="alarms-head__title">{{ t('nav.alarms') }}</h2>
      <UiSegmented v-model="scheda" :options="schede" class="alarms-head__tabs" />
    </div>

    <div class="alarms-body">
      <!-- dettaglio -->
      <section class="alarm-detail" :aria-label="t('alarms.detail')">
        <template v-if="sel">
          <header class="alarm-detail__head">
            <span class="alarm-sev alarm-sev--lg" aria-hidden="true"><CircleX :stroke-width="2" /></span>
            <div class="alarm-detail__id">
              <span class="alarm-detail__level">{{ t('alarms.levelError') }}<b v-if="sel.code" class="mono">{{ sel.code }}</b></span>
              <span class="alarm-detail__meta">{{ quando(sel) }} · {{ origine(sel) }}</span>
            </div>
          </header>
          <p v-if="scomposto(sel)" class="alarm-detail__decoded mono">
            {{ t('alarms.decoded', scomposto(sel)) }}
          </p>

          <span class="alarm-label">{{ t('alarms.whatHappened') }}</span>
          <p class="alarm-detail__text" :class="{ 'alarm-detail__text--long': testo(sel).length > 90 }">{{ testo(sel) }}</p>
          <p v-if="sel.code && !haTesto(sel)" class="alarm-detail__note">{{ t('alarms.noText') }}</p>

          <template v-if="rimedio(sel)">
            <span class="alarm-label">{{ t('alarms.whatToDo') }}</span>
            <p class="alarm-detail__fix">{{ rimedio(sel) }}</p>
          </template>

          <div v-if="sel.unit && CONTROLLI[sel.unit]" class="alarm-detail__actions">
            <UiButton variant="primary" size="main" :icon="ArrowUpRight" @click="router.push(CONTROLLI[sel.unit])">
              {{ t('alarms.openControls', { unit: nomeUnita(sel.unit) }) }}
            </UiButton>
          </div>
        </template>
        <p v-else class="alarm-detail__empty">{{ scheda === 'attivi' ? t('alarms.noneActive') : t('alarms.selectHint') }}</p>
      </section>

      <!-- elenco -->
      <section class="alarm-list" :aria-label="scheda === 'attivi' ? t('alarms.activeNow') : t('alarms.history')">
        <span class="alarm-label">{{ scheda === 'attivi' ? t('alarms.activeNow') : t('alarms.history') }}</span>
        <template v-if="scheda === 'storico' && stato !== 'ok'">
          <StatoElenco :stato="stato" :vuoto="false" @riprova="carica" />
        </template>
        <p v-else-if="!elenco.length" class="alarm-list__empty">
          {{ scheda === 'attivi' ? t('alarms.noneActive') : t('alarms.historyEmpty') }}
        </p>
        <div v-else class="alarm-list__rows">
          <button v-for="a in elenco" :key="a.key" type="button" class="alarm-row"
            :class="{ on: sel && sel.key === a.key }" :aria-pressed="!!(sel && sel.key === a.key)"
            @click="scegli(a)">
            <span class="alarm-sev" aria-hidden="true"><CircleX :stroke-width="2" /></span>
            <span class="alarm-row__text">
              <b>{{ testo(a) }}</b>
              <small><span v-if="a.code" class="mono">{{ a.code }}</span><template v-if="a.code && a.unit"> · </template>{{ a.unit ? nomeUnita(a.unit) : '' }}</small>
            </span>
            <span class="alarm-row__time" :class="{ mono: a.ora }">{{ a.ora ? orario(a.ora) : t('alarms.now') }}</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { CircleX, ArrowUpRight } from 'lucide-vue-next';
import { dataStored } from '@/data';
import { isMachineConfigured } from '@/util/machineBrands';
import { caricaElenco, STATO } from '@/util/caricaElenco.js';
import { plant, activeAlarmUnits } from '@/stores/plantStatus.js';
import { codiceAllarme as codice, scomponiCodice } from '@/util/alarmCodes.js';
import UiSegmented from '@/components/ui/UiSegmented.vue';
import UiButton from '@/components/ui/UiButton.vue';
import StatoElenco from '@/components/StatoElenco.vue';

const { t, te } = useI18n();
const router = useRouter();

// Controlli dell'unita' in allarme (le rotte di oggi)
const CONTROLLI = { ROBOT: '/unit/robot', MC1: '/unit/CNC1', MC2: '/unit/CNC2', BOX: '/unit/smallbox' };
const NOMI = { ROBOT: 'menu.robot', MC1: 'nav.tab.mc1', MC2: 'nav.tab.mc2', BOX: 'menu.smallbox' };
const nomeUnita = u => (NOMI[u] ? t(NOMI[u]) : u);

const attivi = computed(() => activeAlarmUnits(isMachineConfigured(2)).map(unit => {
	// solo il robot ha un codice live (ROBOT/DESCR)
	const c = unit === 'ROBOT' ? codice(plant.robotAlarm) : '';
	return { key: 'a-' + unit, unit, code: Number(c) > 0 ? c : '', ora: '' };
}));
const stato = ref(STATO.ATTESA);
const righe = ref([]);
const storico = computed(() => righe.value.map((r, i) => ({
	key: 's-' + i, unit: '', code: codice(r.descr), descr: String(r.descr == null ? '' : r.descr).trim(), ora: String(r.Timestamp || ''),
})));

const scheda = ref('attivi');
const schede = computed(() => [
	{ value: 'attivi', label: t('alarms.tabActive'), count: attivi.value.length },
	{ value: 'storico', label: t('alarms.tabHistory'), count: storico.value.length },
]);
const elenco = computed(() => (scheda.value === 'attivi' ? attivi.value : storico.value));
const scelto = ref(null);
const sel = computed(() => elenco.value.find(a => a.key === scelto.value) || elenco.value[0] || null);
watch(scheda, () => { scelto.value = null; });
function scegli(a) { scelto.value = a.key; }

const chiave = a => 'robot.alarm_' + a.code;
const haTesto = a => !!a.code && te(chiave(a));
function testo(a) {
	if (haTesto(a)) return t(chiave(a));
	if (a.unit) return t('alarms.unitInAlarm', { unit: nomeUnita(a.unit) });
	return a.descr;
}
// "Cosa fare": solo dove esiste un testo di rimedio separato
const rimedio = a => (a.code && te(chiave(a) + '_fix') ? t(chiave(a) + '_fix') : '');
// missione * 100 + errore (util/alarmCodes.js)
const scomposto = a => scomponiCodice(a.code);
const quando = a => (a.ora || t('alarms.now'));
const origine = a => (a.unit ? nomeUnita(a.unit) : t('alarms.originLog', { descr: a.descr }));
// nell'elenco basta l'ora: "dd/MM/yyyy hh:mm:ss" -> "hh:mm" (la data e' nel dettaglio)
const orario = s => { const m = String(s).match(/(\d{1,2}:\d{2})(:\d{2})?\s*$/); return m ? m[1] : s; };

function carica() {
	stato.value = STATO.ATTESA;
	caricaElenco(dataStored.server, 'api/alarm/show/all').then(e => {
		stato.value = e.stato;
		if (e.stato === STATO.OK) righe.value = e.dati || [];
	});
}
onMounted(carica);
</script>

<style scoped>
.alarms { gap: var(--space-4); }
.alarms-head { display: flex; align-items: center; gap: var(--space-5); flex-wrap: wrap; }
.alarms-head__title {
  margin: 0;
  font-size: 32px;
  font-weight: var(--font-weight-extrabold);
  letter-spacing: -0.01em;
  text-transform: none;
  color: var(--text-primary);
}
.alarms-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: var(--space-5);
}
.alarm-detail,
.alarm-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--card-padding);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  box-sizing: border-box;
  overflow-y: auto;
}
.alarm-label {
  display: block;
  margin: var(--space-5) 0 var(--space-2);
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  color: var(--text-muted);
}
.alarm-list > .alarm-label { margin-top: 0; }
.alarm-sev {
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
.alarm-sev svg { width: 26px; height: 26px; }
.alarm-sev--lg { width: 64px; height: 64px; border-radius: var(--radius-btn); }
.alarm-sev--lg svg { width: 32px; height: 32px; }
/* IBM Plex Mono e' incluso solo nei pesi 500 e 600 (main.js) */
.mono { font-family: var(--font-mono); font-weight: 500; font-variant-numeric: tabular-nums; }

/* ---- dettaglio ---- */
.alarm-detail__head { display: flex; align-items: center; gap: var(--space-4); }
.alarm-detail__id { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.alarm-detail__level {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-extrabold);
  text-transform: uppercase;
  color: var(--color-danger-fg);
}
.alarm-detail__level b { color: var(--text-primary); font-weight: var(--font-weight-semibold); text-transform: none; }
.alarm-detail__meta { font-size: var(--font-size-base); color: var(--text-secondary); overflow-wrap: anywhere; }
.alarm-detail__decoded { margin: var(--space-4) 0 0; font-size: var(--font-size-base); color: var(--text-secondary); }
.alarm-detail__text {
  margin: 0;
  font-size: 28px;
  font-weight: var(--font-weight-extrabold);
  line-height: 1.25;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}
.alarm-detail__text--long { font-size: 24px; font-weight: var(--font-weight-bold); line-height: 1.35; }
.alarm-detail__note { margin: var(--space-2) 0 0; font-size: var(--font-size-base); color: var(--text-muted); }
.alarm-detail__fix { margin: 0; font-size: var(--font-size-body); line-height: 1.5; color: var(--text-primary); white-space: pre-line; }
.alarm-detail__actions { display: flex; gap: var(--space-3); margin-top: auto; padding-top: var(--space-5); }
.alarm-detail__empty { margin: auto 0; text-align: center; color: var(--text-secondary); font-size: var(--font-size-body); }

/* ---- elenco ---- */
.alarm-list__rows { display: flex; flex-direction: column; gap: var(--space-2); }
.alarm-list__empty { margin: 0; color: var(--text-secondary); }
.alarm-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: 76px;
  padding: var(--space-3) var(--space-4);
  border: 0;
  border-radius: var(--radius-btn);
  background: var(--bg-row);
  color: var(--text-primary);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}
.alarm-row.on { background: var(--bg-raised); box-shadow: inset 0 0 0 2px var(--accent); }
.alarm-row__text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.alarm-row__text b {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.alarm-row__text small { font-size: var(--font-size-sm); color: var(--text-muted); }
.alarm-row__time { flex: none; font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--text-secondary); }
.alarm-row__time.mono { font-weight: 600; }

/* ---- compatto ---- */
@media (max-width: 1599px) {
  .alarms { gap: var(--space-3); }
  .alarms-head { gap: var(--space-4); }
  .alarms-head__title { font-size: 26px; }
  .alarms-body { gap: var(--space-3); grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .alarm-detail__text { font-size: 22px; }
  .alarm-detail__text--long { font-size: 19px; }
  .alarm-sev--lg { width: 56px; height: 56px; }
  .alarm-row { min-height: 64px; gap: var(--space-3); padding: var(--space-2) var(--space-3); }
  .alarm-sev { width: 44px; height: 44px; }
  .alarm-label { margin-top: var(--space-4); }
}
</style>
