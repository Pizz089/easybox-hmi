<!-- ==========================================================================
     StatusStrip.vue — striscia di stato in alto, sempre visibile (tavole
     Main, Home43, Tablet). Mostra SOLO dati che esistono (stores/
     plantStatus.js): stato cella dal robot, Robot, MC1 (MC2 se
     configurata), EasyBox col cassetto fuori, collegamento col server,
     campanella con gli allarmi attivi, livello utente, lingua, ora, e a
     destra il pulsante HOLD / Riprendi / START.
     NON mostrati perche' oggi non hanno una fonte: percentuale e tempo
     residuo del ciclo MC1, stato del PLC (il backend non ha un battito
     del PLC): vedi il report della fase A.

     HOLD / Riprendi / START. Stesso comando e stessa logica a tre stati
     del pulsante di robotView: sendToRobot(17) (util/globalFunction),
     testo secondo lo STATUS del robot — HOLD se il robot non e' ne' in
     HOLD ne' spento, "Riprendi" (oggi "HOLD => CONTINUA") in HOLD, START
     da spento con la stessa animazione (blinker). La mappa golden dei
     comandi lo verifica.

     Compatto (< 1600 px): restano stato cella, MC1, collegamento (solo il
     pallino), campanella, ora e pulsante.
     ========================================================================== -->
<template>
  <header class="strip">
    <UiChip :tone="cella.tone" :dot="cella.dot" strong>
      <b>{{ t(cella.label) }}</b><span v-if="cella.sub">{{ t(cella.sub) }}</span>
    </UiChip>
    <UiChip v-if="!compact" :dot="punto(plant.robot)">{{ t('strip.robot') }} <b>{{ testo(plant.robot) }}</b></UiChip>
    <UiChip v-for="m in macchine" :key="m.n" :dot="punto(m.status)">MC{{ m.n }} <b v-if="!compact">{{ testo(m.status) }}</b></UiChip>
    <UiChip v-if="!compact" :dot="plant.trayOut > 0 ? 'warning' : punto(plant.box)">
      {{ t('strip.easybox') }} <b>{{ plant.trayOut > 0 ? t('strip.trayOut', { n: plant.trayOut }) : testo(plant.box) }}</b>
    </UiChip>

    <div class="strip__sp"></div>

    <!-- collegamento col server: oggi "IN ATTESA DI CONNESSIONE!!" nella barra -->
    <UiChip v-if="!dataStored.WS.connected" tone="danger" dot="danger" :title="t('strip.offline')">
      <span v-if="!compact">{{ t('strip.offline') }}</span>
    </UiChip>
    <span v-else-if="compact" class="strip__conn" :title="t('strip.online')" aria-hidden="true"></span>

    <RouterLink to="/alarms" class="strip__ib" :aria-label="t('strip.alarms', { n: alarms })">
      <Bell :stroke-width="2" aria-hidden="true" />
      <span v-if="alarms > 0" class="strip__badge">{{ alarms }}</span>
    </RouterLink>
    <UiChip v-if="!compact" clickable :aria-label="t('strip.user')" @click="$emit('open-user')">{{ t('changeUser.levelLabel.' + livello) }}</UiChip>
    <UiChip v-if="!compact" clickable :aria-label="t('strip.lang')" @click="cambiaLingua">{{ locale.toUpperCase() }}</UiChip>
    <span class="strip__clock">{{ ora }}</span>

    <!-- HOLD / Riprendi / START: stesso comando del pulsante di robotView.
         STATUS ignoto o NOT_DEFINED: il 17 e' un toggle nel PLC, "HOLD"
         potrebbe togliere l'hold -> visibile ma disabilitato, "—"
         (util/holdState.js) -->
    <button v-if="plant.robot != dataStored.status_off" type="button" class="strip__hold"
      :class="{ 'strip__hold--held': plant.robot == dataStored.status_hold }"
      :disabled="ignoto" :title="ignoto ? t('cmd.holdUnknown') : null" @click="sendToRobot(17)">
      <template v-if="ignoto">—</template>
      <template v-else>
        <Play v-if="plant.robot == dataStored.status_hold" :stroke-width="2" aria-hidden="true" />
        <Pause v-else :stroke-width="2" aria-hidden="true" />
        {{ plant.robot == dataStored.status_hold ? t('strip.resume') : t('cmd.hold') }}
      </template>
    </button>
    <button v-else type="button" class="strip__hold strip__hold--start" @click="sendToRobot(17)">
      <Play :stroke-width="2" aria-hidden="true" />{{ t('cmd.start') }}
    </button>
  </header>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Bell, Play, Pause } from 'lucide-vue-next';
import { dataStored } from '@/data';
import { sendToRobot } from '@/util/globalFunction.js';
import { configuredMachineNumbers } from '@/util/machineBrands';
import { useCompact } from '@/util/breakpoints';
import { plant } from '@/stores/plantStatus.js';
import { robotStatoIgnoto } from '@/util/holdState.js';
import UiChip from '@/components/ui/UiChip.vue';

defineProps({ alarms: { type: Number, default: 0 } });
defineEmits(['open-user']);
const { t, locale } = useI18n();
const compact = useCompact();
const livello = computed(() => Number(dataStored.userLevel) || 0);
const ignoto = computed(() => robotStatoIgnoto(plant.robot));

// codice di [UNIT].STATUS -> testo e pallino (costanti in data.js)
function nome(code) {
	const S = dataStored;
	if (code === null || code === undefined) return 'unknown';
	switch (Number(code)) {
		case S.status_hold: return 'hold';
		case S.status_alarm: return 'alarm';
		case S.status_off: return 'off';
		case S.status_working: return 'working';
		case S.status_auto: return 'auto';
		case S.status_remote: return 'remote';
		case S.status_local: return 'local';
		case S.status_manual: return 'manual';
		case S.status_notDef: return 'notDef';
		default: return 'other';
	}
}
// codici senza nome (es. MC1 = 2): "normale", come le tile della Dashboard
// (units.vue getStatusDesc -> "normal")
const testo = code => t('strip.st.' + (nome(code) === 'other' ? 'normal' : nome(code)));
const punto = code => ({ hold: 'warning', alarm: 'danger', working: 'accent', auto: 'success', remote: 'success', local: 'success', manual: 'info' }[nome(code)] || 'muted');

// chip dello stato cella: dal robot, che e' chi va in HOLD
const cella = computed(() => {
	switch (nome(plant.robot)) {
		case 'hold': return { tone: 'warning', dot: 'warning', label: 'strip.cell.hold', sub: 'strip.cell.holdSub' };
		case 'alarm': return { tone: 'danger', dot: 'danger', label: 'strip.cell.alarm', sub: '' };
		case 'off': return { tone: 'neutral', dot: 'muted', label: 'strip.cell.off', sub: '' };
		case 'manual': return { tone: 'neutral', dot: 'info', label: 'strip.cell.manual', sub: '' };
		case 'auto': case 'remote': case 'local': case 'working': return { tone: 'neutral', dot: 'success', label: 'strip.cell.auto', sub: '' };
		default: return { tone: 'neutral', dot: 'muted', label: 'strip.cell.unknown', sub: '' };
	}
});
const macchine = computed(() => configuredMachineNumbers().map(n => ({ n, status: plant['mc' + n] })));

// lingua: stesso ciclo it -> en della barra di oggi
function cambiaLingua() {
	const lingue = ['it', 'en'];
	locale.value = lingue[(lingue.indexOf(locale.value) + 1) % lingue.length];
}

// ora locale, ogni 10 s
const ora = ref('');
const aggiornaOra = () => { const d = new Date(); ora.value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
let timer = null;
onMounted(() => { aggiornaOra(); timer = setInterval(aggiornaOra, 10000); });
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.strip {
  height: var(--status-strip-height);
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 0 24px;
  background: var(--bg-strip);
  border-bottom: 1px solid var(--border-subtle);
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;
}
.strip__sp { flex: 1; }
.strip__conn { width: 10px; height: 10px; border-radius: 50%; background: var(--color-success); flex: none; margin: 0 6px; }
.strip__ib {
  position: relative;
  width: 52px;
  height: 52px;
  flex: none;
  border-radius: 14px;
  background: var(--bg-chip);
  color: var(--text-chip);
  display: flex;
  align-items: center;
  justify-content: center;
}
.strip__ib svg { width: var(--icon-size-md); height: var(--icon-size-md); }
.strip__badge {
  position: absolute;
  top: -6px;
  right: -6px;
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
.strip__clock {
  padding: 0 var(--space-2);
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
}
.strip__hold {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 0 28px;
  border: 0;
  border-radius: var(--radius-btn);
  background: var(--accent);
  color: var(--accent-on);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-extrabold);
  white-space: nowrap;
  cursor: pointer;
  flex: none;
}
.strip__hold svg { width: var(--icon-size-md); height: var(--icon-size-md); }
.strip__hold:hover:not(:disabled) { background: var(--accent-hover); }
.strip__hold:disabled { background: var(--bg-input); color: var(--text-muted); cursor: not-allowed; }
/* START da spento: la stessa animazione del pulsante di robotView
   (blinker, definita in assets/css/unit-views.css) */
.strip__hold--start { animation: blinker 1s linear infinite; }

@media (max-width: 1599px) {
  .strip { gap: 8px; padding: 0 12px 0 16px; }
  .strip__ib { width: 48px; height: 48px; border-radius: 13px; }
  .strip__ib svg { width: 22px; height: 22px; }
  .strip__hold { min-height: 48px; padding: 0 20px; font-size: var(--font-size-base); }
}
</style>
