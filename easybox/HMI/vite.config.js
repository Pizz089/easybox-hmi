import { existsSync, readFileSync } from 'node:fs'
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

// (pwa-https) HTTPS quando il certificato c'e', HTTP quando non c'e'.
//
// PERCHE' SERVE: Chrome installa una PWA solo da contesto sicuro. Il touch di
// cella apre localhost, che Chrome considera sicuro anche in HTTP, quindi li'
// funzionava gia'; il TABLET arriva per indirizzo IP e senza HTTPS non ha
// contesto sicuro. Il certificato lo prepara tools/ensure-cert.ps1, che gira
// prima di Vite (npm run cert, chiamato da start_hmi.bat).
//
// VIA DI RITORNO, una riga sola: con HMI_HTTP_ONLY=1 si torna in HTTP, e lo
// stesso interruttore ferma anche lo script del certificato, che altrimenti lo
// rigenererebbe. Procedura scritta in docs/APPUNTI-CELLA.md, perche' se serve
// sara' probabilmente a cella ferma e di fretta.
//
// NB: il pannello resta raggiungibile anche in HTTP finche' nessuno accende il
// certificato; non c'e' nessun redirect automatico da http a https, di
// proposito. Un redirect trasformerebbe un problema di certificato in una
// pagina che non si apre e basta.
const certDir = fileURLToPath(new URL('./certs', import.meta.url))
const pfxFile = certDir + '/panel.pfx'
const passFile = certDir + '/panel.pass'
const httpOnly = process.env.HMI_HTTP_ONLY === '1'
const httpsOptions =
  !httpOnly && existsSync(pfxFile) && existsSync(passFile)
    ? { pfx: readFileSync(pfxFile), passphrase: readFileSync(passFile, 'utf8').trim() }
    : undefined

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
      // undefined = HTTP, come prima. Con il certificato presente Vite passa a
      // HTTPS sulla stessa porta, e l'HMR passa da solo a wss.
      https: httpsOptions,
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
      https: httpsOptions,
    },
  }
})
