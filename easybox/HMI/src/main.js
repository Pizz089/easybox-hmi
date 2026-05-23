import '@/assets/css/design-tokens.css'
import '@/assets/css/typography.css'
import './assets/pure.css'
import './assets/email.css'
import './assets/card.css'
import './assets/grid_responsive.css'
import './styles/theme.css'
import '@/assets/css/custom-fix.css'
import '@/assets/css/unit-views.css'


import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'

import App from './App.vue'
import router from './router'

import it from './locales/it.json'
import en from './locales/en.json'

import MenuLayout from './components/menu.vue'

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

app.component('menu', MenuLayout)

app.mount('#app')
