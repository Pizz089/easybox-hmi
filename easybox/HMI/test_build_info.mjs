// ============================================================================
// test_build_info.mjs — dist/build.txt (7/10 sera, B59)
//
// La build del pannello scrive build.txt con ramo, commit e data
// (buildInfo.js, plugin in vite.config.js): servizi-cella.ps1 e pannello.ps1
// lo leggono per dire da che commit viene il pannello servito.
//   1. formato: righe chiave=valore, ASCII, data AAAA-MM-GG HH:MM;
//   2. il plugin scrive build.txt solo in build, coi dati di git;
//   3. senza git i valori sono "sconosciuto" e la build non si ferma;
//   4. vite.config.js usa il plugin.
//
// Uso:   node test_build_info.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { buildInfoText, buildInfoPlugin, leggiGit } from './buildInfo.js';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

console.log('1) formato');
const t = buildInfoText({ ramo: 'ui-v3', commit: 'abc123', data: new Date(2026, 9, 7, 21, 5) });
check(t === 'ramo=ui-v3\ncommit=abc123\ndata=2026-10-07 21:05\n', 'tre righe chiave=valore: ' + JSON.stringify(t));
check(/^[\x20-\x7E\n]*$/.test(buildInfoText({ ramo: 'perché', commit: '', data: new Date(0) })) && /commit=sconosciuto/.test(buildInfoText({ ramo: 'x', commit: '', data: new Date(0) })),
	'solo ASCII (PowerShell 5.1), valori vuoti = sconosciuto');

console.log('\n2) il plugin');
const emessi = [];
const p = buildInfoPlugin({ now: () => new Date(2026, 9, 7, 8, 0), leggi: () => ({ ramo: 'ui-lifting', commit: 'f00d' }) });
check(p.apply === 'build' && typeof p.generateBundle === 'function', 'solo in build (vite preview e il server di sviluppo non lo toccano)');
p.generateBundle.call({ emitFile: f => emessi.push(f) });
check(emessi.length === 1 && emessi[0].type === 'asset' && emessi[0].fileName === 'build.txt' && emessi[0].source === 'ramo=ui-lifting\ncommit=f00d\ndata=2026-10-07 08:00\n',
	'scrive build.txt nella cartella di uscita, accanto a index.html');
const vero = leggiGit(process.cwd());
const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
check(vero.commit === head && vero.ramo === execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(), 'dati veri di git: ramo ' + vero.ramo + ', commit ' + vero.commit.slice(0, 7));

console.log('\n3) senza git');
const fuori = mkdtempSync(join(tmpdir(), 'build-info-'));
try {
	const g = leggiGit(fuori);
	check(g.ramo === 'sconosciuto' && g.commit === 'sconosciuto', 'fuori da un repo: sconosciuto, nessuna eccezione');
} finally { rmSync(fuori, { recursive: true, force: true }); }

console.log('\n4) vite.config.js');
const cfg = readFileSync('vite.config.js', 'utf8');
check(/import \{ buildInfoPlugin \} from '\.\/buildInfo\.js'/.test(cfg) && /plugins: \[[\s\S]*buildInfoPlugin\(\)[\s\S]*\]/.test(cfg), 'il plugin e\' fra i plugin della build');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
