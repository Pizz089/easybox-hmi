// ============================================================================
// buildInfo.js — dist/build.txt: da che commit viene il pannello compilato
// (7/10 sera, B59)
//
// In cella il pannello si serve compilato (vite preview su easybox\HMI\dist).
// Dopo un git pull la dist resta quella di prima finche' non si lancia
// servizi-cella.ps1 -Azione aggiorna, e dal browser non si capisce. La build
// scrive accanto a index.html un build.txt con ramo, commit e data;
// servizi-cella.ps1 (-Azione stato, servito) e pannello.ps1 -Versione stato
// lo confrontano col commit piu' recente che tocca easybox/HMI.
//
// Formato: righe chiave=valore, ASCII (le legge PowerShell 5.1):
//   ramo=ui-v3
//   commit=<sha completo di git rev-parse HEAD>
//   data=2026-10-07 21:15
// Senza git (o fuori dal repo) i valori sono "sconosciuto": la build non si
// ferma per questo.
// ============================================================================
import { execSync } from 'node:child_process'

const git = (args, cwd) => {
  try {
    return execSync('git ' + args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'sconosciuto'
  } catch (e) {
    return 'sconosciuto'
  }
}

const due = n => String(n).padStart(2, '0')

export function buildInfoText({ ramo, commit, data }) {
  const d = data instanceof Date ? data : new Date(data)
  const quando = d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate()) + ' ' + due(d.getHours()) + ':' + due(d.getMinutes())
  const pulito = v => String(v == null || v === '' ? 'sconosciuto' : v).replace(/[^\x20-\x7E]/g, '?')
  return 'ramo=' + pulito(ramo) + '\n' + 'commit=' + pulito(commit) + '\n' + 'data=' + quando + '\n'
}

export function leggiGit(cwd) {
  return { ramo: git('rev-parse --abbrev-ref HEAD', cwd), commit: git('rev-parse HEAD', cwd) }
}

// plugin di Vite: solo in build, scrive build.txt nella cartella di uscita
// (dist_build in cella, che poi diventa dist)
export function buildInfoPlugin({ cwd = process.cwd(), now = () => new Date(), leggi = leggiGit } = {}) {
  return {
    name: 'easybox-build-info',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build.txt', source: buildInfoText(Object.assign({ data: now() }, leggi(cwd))) })
    },
  }
}
