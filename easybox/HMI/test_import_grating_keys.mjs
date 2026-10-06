// ============================================================================
// test_import_grating_keys.mjs — Importa grigliato senza chiavi grezze
//
// La pagina (Grigliati > "Grigliato esistente") mostrava "grating.associate"
// sul pulsante di associazione: la chiave non esisteva in nessuna lingua e
// vue-i18n stampa la chiave stessa. Qui: ogni chiave scritta per esteso nei
// $t('...') della pagina esiste, come testo, in italiano e in inglese.
//
// Uso:   node test_import_grating_keys.mjs     (dalla cartella easybox/HMI)
// ============================================================================
import { readFileSync } from 'node:fs';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
const get = (o, k) => k.split('.').reduce((a, p) => (a && typeof a === 'object' ? a[p] : undefined), o);

const src = readFileSync('src/views/conf/Grating/ImportGrating.vue', 'utf8');
const tpl = src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '');
// solo le chiavi letterali: $t('a.b') / $t("a.b"), non quelle composte
const chiavi = [...new Set([...tpl.matchAll(/\$t\(\s*(['"])([A-Za-z0-9_.]+)\1\s*[,)]/g)].map(m => m[2]))];

check(chiavi.includes('grating.associate'), 'la pagina usa grating.associate (pulsante di associazione)');
for (const k of chiavi)
	check(typeof get(it, k) === 'string' && typeof get(en, k) === 'string', k + ' tradotta in italiano e in inglese');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
