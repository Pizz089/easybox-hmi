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
    },
  }
})
