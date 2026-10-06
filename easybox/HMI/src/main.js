// (v3) font INCLUSI nel pannello, mai da internet (@fontsource, licenza
// OFL): Manrope per tutto, IBM Plex Mono per codici e ID. Solo il subset
// latino, che copre italiano e inglese.
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/manrope/latin-800.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '@/assets/css/design-tokens.css'
import '@/assets/css/typography.css'
import './assets/pure.css'
import './assets/email.css'
import './assets/card.css'
import './assets/grid_responsive.css'
import './styles/theme.css'
import '@/assets/css/custom-fix.css'
// buttons.css dopo design-tokens (token) e dopo pure.css (alias .pure-button-primary)
import '@/assets/css/buttons.css'
// (v2 §12) dialog di conferma: sede unica, al posto delle copie scoped
import '@/assets/css/dialogs.css'
// (v3 fase B) pezzi comuni delle pagine Controlli: colonne, stato, segmenti
import '@/assets/css/controls-v3.css'
// (v3 fase C) cataloghi del Magazzino in card (Grigliati, Pezzi)
import '@/assets/css/catalog-v3.css'
// (v2 fase 1.2) campi form scuri: dopo pure.css e theme.css, che li facevano bianchi
import '@/assets/css/forms.css'
import '@/assets/css/layout-shell.css'
import '@/assets/css/unit-views.css'


import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'

import App from './App.vue'
import router from './router'

import it from './locales/it.json'
import en from './locales/en.json'

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'it',
  fallbackLocale: 'en',
  messages: { it, en },
})

const app = createApp(App)

app.use(router)
app.use(i18n)

app.mount('#app')
