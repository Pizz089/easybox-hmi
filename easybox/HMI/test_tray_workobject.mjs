// ============================================================================
// test_tray_workobject.mjs — cassetti e work object per cassetto (6/10)
//
// Dalla vista 4Robot v4 (serverDati/scripts/robot-tray-view-v4.sql) le
// correzioni del cassetto (TRAY.X_CORR, Y_CORR, Z_CORR) restano nel DB ma NON
// entrano piu' nelle quote del robot, e le quote di estrazione sono relative
// al cassetto (scripts/extract-coords-workobject.sql). Quindi:
//   1. pagina Cassetto: avviso fisso sopra i campi X/Y/Z e, accanto alle
//      rotazioni, la riga che dice che si impostano li', cassetto per cassetto;
//   2. "0 CASSETTIERA" ELIMINATO (decisione di Dario): in TraysView nessun
//      pulsante, nessun dialog, nessuna chiamata a teachTrays/extractCoords;
//   3. testi in italiano e in inglese, chiavi del dialog tolte.
//
// Uso:   node test_tray_workobject.mjs     (dalla cartella easybox/HMI)
// ============================================================================
import { readFileSync } from 'node:fs';

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const leggi = f => readFileSync(f, 'utf8');
const tpl = s => s.slice(s.indexOf('<template>'), s.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '');
const it = JSON.parse(leggi('src/locales/it.json'));
const en = JSON.parse(leggi('src/locales/en.json'));

console.log('1) pagina Cassetto');
const tray = tpl(leggi('src/views/conf/Tray/Tray.vue'));
const iAvviso = tray.indexOf("$t('tray.workObjectNotice')");
const iX = tray.indexOf("$t('tray.X_Corr')");
check(iAvviso > 0 && iAvviso < iX, 'avviso sopra le correzioni X/Y/Z');
const iRotSez = tray.indexOf("$t('tray.sectionRot')");
const iRot = tray.indexOf("$t('tray.workObjectRotations')");
const iXRot = tray.indexOf("$t('tray.X_Rot')");
check(iRotSez > 0 && iRot > iRotSez && iRot < iXRot, 'riga sulle rotazioni accanto ai campi delle rotazioni');
// (v3 fase C) il paragrafo che contiene il testo: icona + testo, stessa
// classe di base, un tono ciascuno (attenzione / informazione), mai un v-if
const paragrafo = i => { const a = tray.lastIndexOf('<p ', i); return tray.slice(a, tray.indexOf('>', a) + 1); };
const pA = paragrafo(iAvviso), pR = paragrafo(iRot);
check(/class="tray-wo-notice tray-wo-notice--warn"/.test(pA) && /class="tray-wo-notice tray-wo-notice--info"/.test(pR) && !/v-if|v-show/.test(pA + pR),
  'stessa classe dei due avvisi (tray-wo-notice, un tono ciascuno), nessuna condizione');
check(tray.slice(tray.lastIndexOf('<p ', iAvviso), iAvviso).indexOf('</p>') < 0 && tray.slice(tray.lastIndexOf('<p ', iRot), iRot).indexOf('</p>') < 0, 'il testo sta dentro il suo avviso');
check(/propagateTeaching/.test(leggi('src/views/conf/Tray/Tray.vue')), 'il salvataggio porta ancora le rotazioni alle tasche (propagateTeaching)');

console.log('\n2) "0 CASSETTIERA" eliminato');
const traysSrc = leggi('src/views/conf/TraysView.vue');
const trays = tpl(traysSrc);
check(!/tray\.teach\.button|openTeach|teach\.open/.test(trays), 'nessun pulsante e nessun dialog del teaching in TraysView');
check(!/openTeach|closeTeach|calcPreview\(|confirmTeach|eligibleFloors|teachTrays|extractCoords|numericField/.test(traysSrc.replace(/<!--[\s\S]*?-->/g, '')), 'nessun metodo, dato o chiamata del teaching (codice, commenti esclusi)');
check(!/\.teach-field|\.teach-table|teach-wo-note/.test(traysSrc), 'via gli stili usati solo dal teaching');
check(/\.teach-hint|\.teach-warning/.test(traysSrc) && /class="teach-hint"/.test(trays), 'restano quelli che usa anche il dialog del grigliato');
check(/"0 CASSETTIERA" ELIMINATO[\s\S]{0,600}7fc7964/.test(traysSrc), 'commento: perche\' e dove ritrovare il codice di prima');

console.log('\n3) testi');
check(it.tray.workObjectNotice && en.tray.workObjectNotice && /work object/i.test(it.tray.workObjectNotice) && /work object/i.test(en.tray.workObjectNotice), 'avviso sulle correzioni in italiano e in inglese');
check(it.tray.workObjectRotations === "Con i work object per cassetto le rotazioni si impostano qui, cassetto per cassetto: al salvataggio vanno a tutte le tasche del cassetto."
	&& en.tray.workObjectRotations === "With one work object per tray, rotations are set here, tray by tray: on save they are applied to all the tray's pockets.", 'riga sulle rotazioni, testi decisi');
check(JSON.stringify(Object.keys(it.tray.teach).sort()) === JSON.stringify(['applied', 'back', 'lockedHint', 'next']) && JSON.stringify(Object.keys(en.tray.teach).sort()) === JSON.stringify(Object.keys(it.tray.teach).sort()),
	'di tray.teach restano solo le chiavi usate altrove (applied, back, lockedHint, next)');

console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
