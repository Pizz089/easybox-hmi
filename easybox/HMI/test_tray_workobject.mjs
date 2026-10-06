// ============================================================================
// test_tray_workobject.mjs — correzioni del cassetto e work object (6/10)
//
// Dalla vista 4Robot v4 (serverDati/scripts/robot-tray-view-v4.sql) le
// correzioni del cassetto (TRAY.X_CORR, Y_CORR, Z_CORR) restano nel DB ma NON
// entrano piu' nelle quote del robot: la posizione del cassetto e' nel robot.
// Il pannello lo dice dove l'operatore le vedrebbe o le scriverebbe:
//   1. pagina Cassetto: avviso fisso sopra i campi X/Y/Z;
//   2. "0 CASSETTIERA": il comando resta (scrive le rotazioni anche nelle
//      tasche), la conferma dice che X/Y/Z non contano piu';
//   3. testi in italiano e in inglese; nessun cambio al comando.
//
// Uso:   node test_tray_workobject.mjs     (dalla cartella easybox/HMI)
// ============================================================================
import { readFileSync } from 'node:fs';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const tpl = f => { const s = readFileSync(f, 'utf8'); return s.slice(s.indexOf('<template>'), s.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g, ''); };
const it = JSON.parse(readFileSync('src/locales/it.json', 'utf8'));
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

console.log('1) pagina Cassetto');
const tray = tpl('src/views/conf/Tray/Tray.vue');
const iAvviso = tray.indexOf("$t('tray.workObjectNotice')");
const iX = tray.indexOf("$t('tray.X_Corr')");
check(iAvviso > 0 && iAvviso < iX, 'avviso sopra le correzioni X/Y/Z');
check(!/v-if|v-show/.test((tray.slice(0, iAvviso).match(/<[^<]*$/) || [''])[0]), 'avviso fisso (nessuna condizione)');

console.log('\n2) 0 CASSETTIERA');
const trays = tpl('src/views/conf/TraysView.vue');
const passo3 = trays.slice(trays.indexOf('v-if="teach.step==3"'), trays.indexOf('confirmTeach()'));
check(passo3.includes("$t('tray.teach.workObjectNote')"), 'la conferma (passo 3, prima di CONFERMA E SCRIVI) dice che X/Y/Z non contano piu\'');
const src = readFileSync('src/views/conf/TraysView.vue', 'utf8');
check(/api\/conf\/tray\/teachTrays\?rows=/.test(src) && /dataStored\.userLevel>1 \? openTeach\(\) : ''/.test(src), 'il comando teachTrays resta, con lo stesso gate');

console.log('\n3) testi');
const parla = t => /work object/i.test(t) && /robot/i.test(t);
check(parla(it.tray.workObjectNotice) && parla(en.tray.workObjectNotice), 'avviso della pagina Cassetto in italiano e in inglese');
check(parla(it.tray.teach.workObjectNote) && parla(en.tray.teach.workObjectNote) && /X\/Y\/Z/.test(it.tray.teach.workObjectNote) && /rotazioni/.test(it.tray.teach.workObjectNote),
	'nota della conferma: X/Y/Z non contano, il comando serve per le rotazioni');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
