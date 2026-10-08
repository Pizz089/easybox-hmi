<!-- ==========================================================================
     Alert.vue — il riquadro globale degli allarmi e degli esiti (pannello
     v3, fase E1.2, 7/10). Montato una volta in AppShell, sopra a tutto.

     CONTRATTO INVARIATO: dataStored.alert (title, desc, type, check) e
     emptyAlertList; gli stessi handler (layout/plantGlobals.js, combinazione
     972 della consegna 35 compresa). title e desc passano da $t come prima:
     una chiave si traduce, un testo gia' tradotto resta com'e'.

     ASPETTO: quello della tavola Conferma (assets/css/dialogs.css, sede
     unica, UI-DESIGN-SYSTEM §7). Prima il fondo era --color-*-bg, che e'
     trasparente al 14-16 %: la pagina si leggeva attraverso.
       - alarm / warning: velo --bg-backdrop, superficie piena --bg-dialog,
         angoli 24, min(720px, 94vw); il tono (danger / warning) sta in
         icona, titolo e bordo, mai nel fondo. Si chiude solo con OK (grande,
         a tutta larghezza in compatto) o con la X: il tocco sul velo NON
         chiude, un allarme non si chiude per sbaglio senza leggerlo;
       - message (esito positivo, es. «Livello modificato»): avviso breve
         senza velo, in basso a destra (8/10: in alto copriva il selettore
         della pagina Robot), fondo pieno; si chiude da solo dopo 4 s o al
         tocco. Non blocca la pagina. AppShell lo mostra a parte: non
         cancella un allarme aperto (util/avvisoBreve.js);
       - il velo parte sotto la striscia di stato (8/10): HOLD e campanella
         restano raggiungibili.
     CODICE: se desc e' robot.alarm_<n> (o robot.alarmBox_<n>) il codice va
     in un badge accanto al titolo; per l'avviso unito della 35 il badge lo
     passa chi lo compone (prop badge: «972 → <codice>»).
     ========================================================================== -->
<template>
  <div v-if="isMessage" class="alert-toast" role="status" aria-live="polite" @click="chiudi">
    <CircleCheck class="alert-toast__icon" :stroke-width="2" aria-hidden="true" />
    <div class="alert-toast__body">
      <p class="alert-toast__title">{{ $t(title) }}</p>
      <p class="alert-toast__desc">{{ $t(desc) }}</p>
    </div>
    <button type="button" class="alert-box__x alert-toast__x" :aria-label="$t('alertBox.close')" @click.stop="chiudi">
      <X :stroke-width="2" aria-hidden="true" />
    </button>
  </div>
  <div v-else class="mission-dialog-overlay alert-overlay">
    <section class="mission-dialog alert-box" :class="'alert-box--' + tone" role="alertdialog" aria-modal="true"
      :aria-labelledby="idTitolo" :aria-describedby="idTesto">
      <header class="alert-box__head">
        <span class="alert-box__icon"><component :is="icona" :stroke-width="2" aria-hidden="true" /></span>
        <h2 :id="idTitolo" class="alert-box__title">{{ $t(title) }}</h2>
        <span v-if="codice" class="alert-box__code">{{ codice }}</span>
        <button type="button" class="alert-box__x" :aria-label="$t('alertBox.close')" @click="chiudi">
          <X :stroke-width="2" aria-hidden="true" />
        </button>
      </header>
      <p :id="idTesto" class="alert-box__desc">{{ $t(desc) }}</p>
      <ul v-if="checks && checks.length" class="alert-box__checks">
        <li v-for="chk in checks" :key="chk">{{ chk }}</li>
      </ul>
      <slot />
      <UiButton variant="primary" size="main" block class="alert-box__ok" @click="chiudi">{{ $t('alertBox.ok') }}</UiButton>
    </section>
  </div>
</template>

<script>
import { OctagonAlert, TriangleAlert, CircleCheck, X } from 'lucide-vue-next';
import UiButton from '@/components/ui/UiButton.vue';

// il codice per il badge, dalla chiave del testo (o quello passato da chi
// compone l'avviso); '' se non c'e' un codice
export function codiceDaDesc(desc) {
	const m = String(desc == null ? '' : desc).match(/^robot\.alarm(?:Box)?_(\d+)$/);
	return m ? m[1] : '';
}
export const TOAST_MS = 4000;

let n = 0;
export default {
	components: { UiButton, CircleCheck, X },
	emits: ['cmd_close'],
	props: {
		title: String,
		desc: String,
		type: { type: String, default: 'alarm' },
		checks: { type: Array, default: () => [] },
		badge: { type: String, default: '' },
	},
	data() {
		const id = 'alert-' + (++n);
		return { idTitolo: id + '-t', idTesto: id + '-d', timer: null };
	},
	computed: {
		isMessage() { return this.type === 'message'; },
		tone() { return this.type === 'warning' ? 'warning' : this.type === 'message' ? 'success' : 'danger'; },
		icona() { return this.type === 'warning' ? TriangleAlert : this.type === 'message' ? CircleCheck : OctagonAlert; },
		codice() { return this.badge || codiceDaDesc(this.desc); },
	},
	watch: {
		// un esito nuovo mentre il precedente e' ancora a video: 4 s da capo
		desc() { this.armaToast(); },
		type() { this.armaToast(); },
	},
	mounted() { this.armaToast(); },
	unmounted() { clearTimeout(this.timer); },
	methods: {
		armaToast() {
			clearTimeout(this.timer);
			this.timer = this.isMessage ? setTimeout(() => this.chiudi(), TOAST_MS) : null;
		},
		chiudi() {
			clearTimeout(this.timer);
			this.$emit('cmd_close');
		},
	},
};
</script>
