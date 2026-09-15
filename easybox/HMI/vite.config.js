import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
// AA: l'overlay flottante Vue DevTools e' iniettato in modalita' dev da
// vite-plugin-vue-devtools — e i kiosk cliente/azienda girano proprio in
// dev (porta fissa 5173). Quindi il plugin e' OPT-IN esplicito: si attiva
// SOLO con VITE_DEVTOOLS=1 (nel .env locale, gia' solo-dev e gitignorato,
// oppure come variabile di shell). Di default: MAI.
// (origine singola) Il browser parla solo con questa origine; le chiamate dati
// e il socket le gira Vite al backend, in chiaro e su 127.0.0.1.
//
// Perche' non basta cambiare gli indirizzi nel pannello: il backend sta su due
// porte diverse dalla pagina, e il giorno in cui la pagina passa a HTTPS il
// browser bloccherebbe come contenuto misto sia le chiamate dati sia il
// socket. Con il proxy il certificato, quando arrivera', riguarda una porta
// sola e qui non cambia piu' niente.
//
// changeOrigin resta FALSO: il backend non guarda l'header Host, e lasciarlo
// intatto rende piu' leggibili i suoi log.
// Le chiavi sono ESPRESSIONI REGOLARI (iniziano con ^) e non prefissi, e non
// e' un dettaglio: con il prefisso '/socket.io' Vite girava al backend anche
// /socket.io.min.js, cioe' la LIBRERIA CLIENT che sta in public/. Il file
// tornava 503, `io` restava indefinito e il pannello perdeva la connessione
// viva. Visto in prova, non dedotto. La barra finale in '^/socket\.io/'
// distingue l'endpoint (/socket.io/?EIO=4...) dal file.
const backendProxy = {
  // tutte le rotte del backend stanno sotto /api (vedi serverDati/server.js)
  '^/api/': {
    target: 'http://127.0.0.1:8080',
    ws: false,
  },
  // socket.io sta su una porta sua (DBFunct.js: new Server(3000)) e usa il
  // percorso predefinito /socket.io/. ws:true serve per l'upgrade: senza,
  // resterebbe in polling e il pannello sembrerebbe lento senza motivo.
  '^/socket\.io/': {
    target: 'http://127.0.0.1:3000',
    ws: true,
  },
}

export default defineConfig(({ mode }) => {
  const devtoolsOn =
    (process.env.VITE_DEVTOOLS || loadEnv(mode, process.cwd()).VITE_DEVTOOLS) === '1'

  return {
    plugins: [
      vue(),
      ...(devtoolsOn ? [vueDevTools()] : []),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    assetsInclude: ['**/*.PNG'],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: backendProxy,
    },
    // stesso proxy per `vite preview`, cosi' una prova sul pacchetto
    // compilato si comporta come il pannello vero. NB: servire dist/ con un
    // server statico qualunque NON avrebbe il proxy, e le chiamate dati
    // finirebbero a vuoto: il pannello va servito da Vite, come oggi.
    preview: {
      host: true,
      port: 4173,
      strictPort: true,
      proxy: backendProxy,
    },
  }
})
