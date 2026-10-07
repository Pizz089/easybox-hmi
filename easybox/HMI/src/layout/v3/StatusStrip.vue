<!-- ==========================================================================
     StatusStrip.vue — striscia di stato in alto, sempre visibile (tavole
     Main, Home43, Tablet). Mostra SOLO dati che esistono (stores/
     plantStatus.js): stato cella dal robot, Robot, MC1 (MC2 se
     configurata), EasyBox col cassetto fuori, collegamento col server,
     campanella con gli allarmi attivi, utente, lingua, ora, e a destra il
     pulsante HOLD / Riprendi / START.
     NON mostrati perche' oggi non hanno una fonte: percentuale e tempo
     residuo del ciclo MC1, stato del PLC (il backend non ha un battito
     del PLC): vedi il report della fase A.

     HOLD / Riprendi / START. Stesso comando e stessa logica a tre stati
     del pulsante di robotView: sendToRobot(17) (util/globalFunction),
     testo secondo lo STATUS del robot — HOLD se il robot non e' ne' in
     HOLD ne' spento, "Riprendi" (oggi "HOLD => CONTINUA") in HOLD, START
     da spento con la stessa animazione (blinker). La mappa golden dei
     comandi lo verifica. (fase E1.3, verso definitivo 2.1) Il 17 e' un
     interruttore: dopo un tocco il pulsante resta spento finche' STATUS non
     cambia, o al massimo 5 s; senza cambio, avviso «HOLD non confermato dal
     PLC» (util/holdGuard.js).

     (fase E1.3, 7/10, Dario in cella: «nelle versioni rimpicciolite voglio
     vedere anche lo stato di robot e EasyBox», «l'operatore deve essere
     selezionabile anche dalla Home», «manca il logo»)
       - LARGO: logo (40 px) a sinistra, stato cella, Robot, MC, EasyBox,
         collegamento, campanella, utente (icona del livello ed etichetta),
         lingua, ora, HOLD;
       - COMPATTO: Robot col suo stato al posto della chip «stato cella» (e'
         la stessa informazione: la chip cella e' calcolata da plant.robot),
         col tono della cella (ambra in HOLD, rossa in allarme); MC, EasyBox
         (o «Cassetto N fuori»), il pallino del collegamento, campanella,
         utente (solo l'icona), HOLD; logo a 28 px e ora se ci stanno;
       - se non ci sta tutto si toglie prima l'ora, poi il logo, poi si
         passa ai testi brevi (strip.short.*). Mai Robot, MC, EasyBox,
         campanella, utente e HOLD; niente a capo, niente scorrimento, e lo
         stato non si taglia con «…». La misura e' quella vera della striscia
         (scrollWidth contro clientWidth), rifatta al ridimensionamento e
         quando cambia un testo. Se il logo esce dalla striscia, in compatto
         lo mostra l'intestazione della Home (util/stripLayout.js).
     ========================================================================== -->
<template>
  <header ref="striscia" class="strip" :class="{ 'strip--compact': compact, 'strip--stretta': stretta }" :data-ripiego="ripiego">
    <img v-if="mostraLogo" src="@/assets/logo.png" class="strip__logo" alt="ADMG" @load="misura" />

    <!-- largo: stato cella; compatto: Robot col tono della cella -->
    <UiChip v-if="!compact" :tone="cella.tone" :dot="cella.dot" strong>
      <b>{{ t(cella.label) }}</b><span v-if="cella.sub">{{ t(cella.sub) }}</span>
    </UiChip>
    <UiChip :tone="compact ? cella.tone : 'neutral'" :dot="punto(plant.robot)" data-strip="robot">
      {{ t(brevi ? 'strip.short.robot' : 'strip.robot') }} <b>{{ testo(plant.robot) }}</b>
    </UiChip>
    <UiChip v-for="m in macchine" :key="m.n" :dot="punto(m.status)" :data-strip="'mc' + m.n">MC{{ m.n }} <b>{{ testo(m.status) }}</b></UiChip>
    <UiChip :dot="plant.trayOut > 0 ? 'warning' : punto(plant.box)" data-strip="easybox">
      {{ t(brevi ? 'strip.short.easybox' : 'strip.easybox') }}
      <b>{{ plant.trayOut > 0 ? t(brevi ? 'strip.short.trayOut' : 'strip.trayOut', { n: plant.trayOut }) : testo(plant.box) }}</b>
    </UiChip>

    <div class="strip__sp"></div>

    <!-- collegamento col server. (7/10 sera, B54) da scollegato i comandi non
         partono (util/socketCommands.js): la striscia lo dice -->
    <UiChip v-if="!dataStored.WS.connected" tone="danger" dot="danger" :title="t('shell.offline')" :aria-label="t('shell.offline')">
      <span v-if="!compact">{{ t('shell.offline') }}</span>
    </UiChip>
    <span v-else-if="compact" class="strip__conn" :title="t('strip.online')" aria-hidden="true"></span>

    <RouterLink to="/alarms" class="strip__ib" :aria-label="t('strip.alarms', { n: alarms })">
      <Bell :stroke-width="2" aria-hidden="true" />
      <span v-if="alarms > 0" class="strip__badge">{{ alarms }}</span>
    </RouterLink>
    <!-- utente, in tutte e due le misure: icona del livello (lucide), in
         largo anche l'etichetta; apre il cambio utente -->
    <button type="button" class="strip__user" data-strip="user" :aria-label="t('strip.user') + ': ' + t('changeUser.levelLabel.' + livello)"
      :title="t('changeUser.levelLabel.' + livello)" @click="$emit('open-user')">
      <component :is="iconaLivello(livello)" :stroke-width="2" aria-hidden="true" />
      <span v-if="!compact">{{ t('changeUser.levelLabel.' + livello) }}</span>
    </button>
    <UiChip v-if="!compact" clickable :aria-label="t('strip.lang')" @click="cambiaLingua">{{ locale.toUpperCase() }}</UiChip>
    <span v-if="mostraOra" class="strip__clock">{{ ora }}</span>

    <!-- HOLD / Riprendi / START: stesso comando del pulsante di robotView.
         STATUS ignoto o NOT_DEFINED: il 17 e' un toggle nel PLC, "HOLD"
         potrebbe togliere l'hold -> visibile ma disabilitato, "—"
         (util/holdState.js). Dopo un tocco: spento finche' STATUS non
         cambia, al massimo 5 s (util/holdGuard.js) -->
    <button v-if="plant.robot != dataStored.status_off" type="button" class="strip__hold" data-strip="hold"
      :class="{ 'strip__hold--held': plant.robot == dataStored.status_hold }"
      :disabled="ignoto || holdGuard.attesa" :title="ignoto ? t('cmd.holdUnknown') : null" @click="premi">
      <template v-if="ignoto">—</template>
      <template v-else>
        <Play v-if="plant.robot == dataStored.status_hold" :stroke-width="2" aria-hidden="true" />
        <Pause v-else :stroke-width="2" aria-hidden="true" />
        {{ plant.robot == dataStored.status_hold ? t('strip.resume') : t('cmd.hold') }}
      </template>
    </button>
    <button v-else type="button" class="strip__hold strip__hold--start" data-strip="hold" :disabled="holdGuard.attesa" @click="premi">
      <Play :stroke-width="2" aria-hidden="true" />{{ t('cmd.start') }}
    </button>
  </header>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Bell, Play, Pause } from 'lucide-vue-next';
import { dataStored } from '@/data';
import { sendToRobot } from '@/util/globalFunction.js';
import { configuredMachineNumbers } from '@/util/machineBrands';
import { useCompact } from '@/util/breakpoints';
import { plant } from '@/stores/plantStatus.js';
import { robotStatoIgnoto } from '@/util/holdState.js';
import { createHoldGuard } from '@/util/holdGuard.js';
import { statusName, statusKey, statusTone } from '@/util/unitStatus.js';
import { iconaLivello } from '@/util/userLevel.js';
import { striscia as statoStriscia, RIPIEGHI } from '@/util/stripLayout.js';
import { useLingua } from '@/util/lingua.js';
import UiChip from '@/components/ui/UiChip.vue';

defineProps({ alarms: { type: Number, default: 0 } });
defineEmits(['open-user']);
const { t } = useI18n();
const { locale, cambiaLingua } = useLingua();
const compact = useCompact();
const livello = computed(() => Number(dataStored.userLevel) || 0);
const ignoto = computed(() => robotStatoIgnoto(plant.robot));

// codice di [UNIT].STATUS -> testo e pallino: util/unitStatus.js, la stessa
// mappatura delle card Stato e delle tile della Home
const nome = statusName;
const testo = code => t((brevi.value ? 'strip.short.st.' : 'strip.st.') + statusKey(code).split('.').pop());
const punto = statusTone;

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

// ---- HOLD: antirimbalzo (verso definitivo 2.1)
const holdGuard = createHoldGuard({
	stato: () => plant.robot,
	avvisa: () => {
		dataStored.alert.title = 'WARNING';
		dataStored.alert.desc = 'cmd.holdNotConfirmed';
		dataStored.alert.type = 'warning';
	},
});
watch(() => plant.robot, v => holdGuard.stato(v));
const premi = () => { holdGuard.premi(() => sendToRobot(17)); };

// ---- ripiego quando non ci sta tutto: 0 tutto, 1 senza ora, 2 senza ora e
// logo, 3 anche testi brevi, 4 anche spazi stretti (util/stripLayout.js)
const striscia = ref(null);
const ripiego = ref(0);
const mostraOra = computed(() => ripiego.value < RIPIEGHI.senzaOra);
const mostraLogo = computed(() => ripiego.value < RIPIEGHI.senzaLogo);
const brevi = computed(() => ripiego.value >= RIPIEGHI.brevi);
const stretta = computed(() => ripiego.value >= RIPIEGHI.stretta);
// nessuna tolleranza: anche 1 px fuori taglia il bordo del pulsante HOLD
const sfora = () => !!striscia.value && striscia.value.scrollWidth > striscia.value.clientWidth;
let misurando = false;
let ancora = false;    // richiesta arrivata a misura in corso: si rifa' dopo
async function misura() {
	if (!striscia.value) return;
	if (misurando) { ancora = true; return; }
	misurando = true;
	try {
		ripiego.value = 0;
		await nextTick();
		while (sfora() && ripiego.value < RIPIEGHI.stretta) {
			ripiego.value++;
			await nextTick();
		}
		statoStriscia.ripiego = ripiego.value;
		statoStriscia.logoNascosto = !mostraLogo.value;
		statoStriscia.sfora = sfora();
	} finally {
		misurando = false;
		if (ancora) { ancora = false; misura(); }
	}
}
watch(() => [compact.value, locale.value, plant.robot, plant.mc1, plant.mc2, plant.box, plant.trayOut, livello.value, dataStored.WS.connected], () => { misura(); });

// ora locale, ogni 10 s
const ora = ref('');
const aggiornaOra = () => { const d = new Date(); ora.value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
let timer = null;
let osservatore = null;
onMounted(() => {
	aggiornaOra();
	timer = setInterval(aggiornaOra, 10000);
	misura();
	if (typeof ResizeObserver !== 'undefined' && striscia.value) {
		osservatore = new ResizeObserver(() => misura());
		osservatore.observe(striscia.value);
	} else window.addEventListener('resize', misura);
});
onUnmounted(() => {
	clearInterval(timer);
	if (osservatore) osservatore.disconnect(); else window.removeEventListener('resize', misura);
	holdGuard.annulla();
	statoStriscia.logoNascosto = false;
});
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
.strip > * { flex: none; }
.strip__sp { flex: 1 1 0 !important; min-width: 0; }
.strip__logo { height: 40px; width: auto; aspect-ratio: 500 / 133; display: block; margin-right: 6px; }
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
/* utente: bersaglio di almeno 48 x 48, icona del livello */
.strip__user {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 52px;
  height: 52px;
  padding: 0 14px;
  border: 0;
  border-radius: 14px;
  background: var(--bg-chip);
  color: var(--text-chip);
  font-family: inherit;
  font-size: 15px;
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
}
.strip__user svg { width: var(--icon-size-md); height: var(--icon-size-md); flex: none; }
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
   (blinker, definita in assets/css/unit-views.css); ferma mentre aspetta la
   conferma del PLC (antirimbalzo) */
.strip__hold--start { animation: blinker 1s linear infinite; }
.strip__hold--start:disabled { animation: none; }

@media (max-width: 1599px) {
  .strip { gap: 8px; padding: 0 12px 0 16px; }
  .strip__logo { height: 28px; margin-right: 2px; }
  .strip__ib { width: 48px; height: 48px; border-radius: 13px; }
  .strip__ib svg { width: 22px; height: 22px; }
  .strip__user { min-width: 48px; height: 48px; padding: 0 12px; border-radius: 13px; }
  .strip__user svg { width: 22px; height: 22px; }
  .strip__hold { min-height: 48px; padding: 0 18px; font-size: var(--font-size-base); }
}
/* ultimo passo del ripiego: spazi e margini interni stretti (bersagli
   invariati: utente, campanella e HOLD restano alti 48) */
.strip--stretta { gap: 4px; padding: 0 8px 0 10px; }
.strip--stretta :deep(.ui-chip) { padding: 0 8px; gap: 5px; }
.strip--stretta .strip__user { padding: 0 8px; }
.strip--stretta .strip__hold { padding: 0 12px; }
</style>
