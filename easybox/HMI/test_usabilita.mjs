// ============================================================================
// test_usabilita.mjs — i quattro difetti gravi trovati misurando il pannello
// il 15/9, e i due medi corretti insieme a loro.
//
// Ogni check qui sotto corrisponde a una cosa che in cella si sbagliava:
//  1. RESET e RESTART erano a 8 px dal pulsante che serve a RIPRENDERE;
//  2. 24 comandi a sola icona senza etichetta, con il CESTINO in mezzo a due
//     azioni innocue;
//  3. guasto del server che a video sembrava un elenco vuoto, e in Produzione
//     diventava l'affermazione falsa "Nessun ordine al momento";
//  4. campo Quantita' a 120x38 che bloccava il salvataggio SENZA dirlo.
//
// MODELLO delle frasi: l'avviso degli attrezzaggi incompleti nel wizard, che
// dice il motivo E cosa fare. I messaggi nuovi devono fare lo stesso.
//
// Uso:   node test_usabilita.mjs     (dalla cartella easybox/HMI)
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { dataStored } = await server.ssrLoadModule('/src/data.js');
const Robot = (await server.ssrLoadModule('/src/views/unit/robotView.vue')).default;


let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };
const leggi = (p) => readFileSync(p, 'utf8');
const it = JSON.parse(leggi('src/locales/it.json'));
const en = JSON.parse(leggi('src/locales/en.json'));

console.log('1) comandi critici del robot');
const robot = leggi('src/views/unit/robotView.vue');
const iCont = robot.indexOf("sendToRobot(17)");
const iReset = robot.indexOf('askCritical(\'reset\')');
const iRestart = robot.indexOf('askCritical(\'restart\')');
check(iReset > 0 && iRestart > 0, 'RESET e RESTART passano da una conferma, non partono al primo tocco');
check(iCont < iReset && iCont < iRestart, 'il pulsante che RIPRENDE viene prima: non e\' piu\' in mezzo ai due rossi');
check(/restore-title[\s\S]{0,200}border-top/.test(robot), 'il gruppo di ripristino e\' staccato da una riga, non solo da spazio');
check(/\.restore-title[\s\S]{0,160}margin-top: var\(--space-5\)/.test(robot), 'e da 24 px di stacco');
check(!/@click="sendToRobot\(99\)"/.test(robot), 'nessuna strada diretta al RESET senza conferma');
for (const k of ['confirmTitle', 'resetWhat', 'resetNotThis', 'restartWhat', 'restartNotThis'])
	check(!!it.robot.critical[k] && !!en.robot.critical[k], 'testo presente: robot.critical.' + k);
check(/CONTINUA ESECUZIONE/.test(it.robot.critical.resetNotThis), 'la conferma di RESET dice qual e\' il comando giusto per riprendere');
check(/CONTINUA ESECUZIONE/.test(it.robot.critical.restartNotThis), 'idem per RESTART');

console.log('\n1b) i comandi di ripristino ARRIVANO davvero al robot');
// Questo blocco nasce da un difetto vero: askCritical usava this.dataStored,
// che in quel componente non esiste (dataStored e' il modulo importato).
// Il metodo lanciava un TypeError, il dialogo non si apriva e RESTART non
// partiva piu'. RESET continuava a funzionare perche' la condizione si
// fermava prima di valutare l'operando rotto: per questo il difetto si vedeva
// su un comando solo. Un test sul sorgente non poteva accorgersene.
function vmRobot(stato) {
	const vm = Object.assign({}, Robot.data.call({}), {
		dataRobot: { STATUS: stato },
		$t: (k) => k,
		$router: { push: () => {} },
	});
	for (const [k, f] of Object.entries(Robot.methods || {})) vm[k] = f.bind(vm);
	vm.inviati = [];
	vm.sendToRobot = (cmd) => vm.inviati.push(cmd);
	return vm;
}

// robot in HOLD: e' lo stato in cui RESTART e' ammesso
const inHold = vmRobot(dataStored.status_hold);
inHold.askCritical('restart');
check(inHold.criticalDialog.type === 'restart', 'RESTART apre la conferma invece di non fare niente');
inHold.confirmCritical();
check(inHold.inviati.length === 1 && inHold.inviati[0] === 18, 'e confermando arriva al robot il comando 18 (era il difetto: non arrivava piu\')');
check(inHold.criticalDialog.type === '', 'la conferma si chiude dopo l\'invio');

const perReset = vmRobot(dataStored.status_hold);
perReset.askCritical('reset');
check(perReset.criticalDialog.type === 'reset', 'RESET apre la conferma');
perReset.confirmCritical();
check(perReset.inviati.length === 1 && perReset.inviati[0] === 99, 'e confermando arriva il comando 99');

// annullare non deve mandare niente
const annulla = vmRobot(dataStored.status_hold);
annulla.askCritical('reset');
annulla.criticalDialog.type = '';
annulla.confirmCritical();
check(annulla.inviati.length === 0, 'annullando non parte nessun comando');

// fuori da HOLD il RESTART resta bloccato, come il pulsante disabilitato
const nonHold = vmRobot(dataStored.status_hold + 1);
nonHold.askCritical('restart');
check(nonHold.criticalDialog.type === '', 'fuori da HOLD il RESTART non apre nemmeno la conferma');
nonHold.askCritical('reset');
check(nonHold.criticalDialog.type === 'reset', 'il RESET invece resta disponibile in ogni stato');

console.log('\n2) comandi di riga: etichette e cestino');
const cmd = leggi('src/components/Comands/ComandsRows.vue');
const bottoni = (cmd.match(/<button /g) || []).length;
const conTitolo = (cmd.match(/:title="\$t\('rowCmd\./g) || []).length;
check(conTitolo === bottoni, 'tutti i comandi hanno un\'etichetta (' + conTitolo + ' su ' + bottoni + ')');
check((cmd.match(/:aria-label="\$t\('rowCmd\./g) || []).length === bottoni, 'e la stessa etichetta per chi legge lo schermo');
const iDel = cmd.indexOf('v-if="del"');
const altri = ['v-if="play"', 'v-if="modify"', 'v-if="move"', 'v-if="save"'].map((k) => cmd.indexOf(k));
check(altri.every((i) => i > 0 && i < iDel), 'la CANCELLAZIONE e\' l\'ultima del gruppo, non piu\' in mezzo');
check(/\.cmd-destructive[\s\S]{0,120}margin-left: var\(--space-5\)/.test(cmd), 'ed e\' staccata di 24 px dalle altre');
for (const k of ['play', 'stop', 'modify', 'move', 'save', 'delete'])
	check(!!it.rowCmd[k] && !!en.rowCmd[k], 'etichetta presente: rowCmd.' + k);

console.log('\n3) guasto del server contro elenco vuoto');
const util = leggi('src/util/caricaElenco.js');
check(/IRRAGGIUNGIBILE/.test(util) && /GUASTO/.test(util), 'si distingue il server spento dal server che risponde male');
check(/r\.status >= 500/.test(util), 'il 500 del contratto HTTP viene riconosciuto come guasto tecnico');
check(/catch[\s\S]{0,120}IRRAGGIUNGIBILE/.test(util), 'la fetch che non parte e\' "irraggiungibile", non un elenco vuoto');
check(!/throw/.test(util), 'non lancia: chi chiama non deve ricordarsi il catch, che e\' come il difetto e\' nato');
const prod = leggi('src/components/productionTable.vue');
check(/StatoElenco/.test(prod) && /caricaElenco/.test(prod), 'Produzione usa il nuovo caricamento');
check(!/\.catch\(error => \{\s*console\.info\(error\);\s*\}\)/.test(prod), 'il guasto non finisce piu\' solo in console');
for (const f of ['src/views/conf/TraysView.vue', 'src/views/conf/AttrezzaggiView.vue', 'src/views/conf/PartsView.vue'])
	check(/StatoElenco/.test(leggi(f)) && /caricaElenco/.test(leggi(f)), 'usa il nuovo caricamento: ' + f.split('/').pop());
// le frasi devono dire motivo E cosa fare, come il wizard
check(/non è vuoto/.test(it.elenco.irraggiungibile), 'la frase nega esplicitamente il malinteso ("non e\' vuoto")');
check(/Controlla che il servizio dati sia avviato/.test(it.elenco.irraggiungibileDaFare), 'e dice cosa fare');
check(/non si risolve dal pannello/i.test(it.elenco.guastoDaFare), 'sul guasto del server dice che non si risolve dal pannello');
check(!!it.tray.nessuno && !!it.attrezzaggi.nessuno && !!it.piece.nessuno, 'gli elenchi davvero vuoti hanno un loro messaggio');
check(/Creane uno/.test(it.tray.nessuno), 'e anche quello dice cosa fare');

console.log('\n4) campo Quantita\'');
const last = leggi('src/views/workOrder/lastData.vue');
check(/\.form-input--small \{[\s\S]{0,140}min-height: 52px/.test(last), 'il campo e\' alto 52 px (era 38)');
check(/quantityValid/.test(last), 'la condizione di blocco ha un nome');
check(/:disabled="!piecePPValid \|\| !fixtureOk \|\| !pushOk \|\| !quantityValid"/.test(last), 'il pulsante usa quella condizione');
check(/v-if="!quantityValid"[\s\S]{0,200}quantityMissing/.test(last), 'e quando blocca, lo dice');
check(/con 0 l'ordine non si può creare/.test(it.wizard.lastData.quantityMissing), 'il messaggio dice perche\'');

console.log('\n5) distanze fra azioni distruttive e innocue');
const attr = leggi('src/views/conf/AttrezzaggiView.vue');
check(/action-destructive/.test(attr) && /\.action-destructive[\s\S]{0,120}margin-top: var\(--space-4\)/.test(attr), 'Attrezzaggi: gli smonta vanno a capo e si staccano (erano a 4 px da Modifica)');
const trays = leggi('src/views/conf/TraysView.vue');
check(/assoc-destructive/.test(trays) && /\.assoc-destructive[\s\S]{0,120}margin-top: var\(--space-4\)/.test(trays), 'Cassetti: Rigenera e Dissocia staccati (erano a 4 px da Sostituisci)');
const side = leggi('src/components/SidebarPlugin/SideBar.vue');
check(/margin: 4px var\(--space-2\)/.test(side), 'menu: 4 px verticali invece di 2, cioe\' il doppio di stacco fra le voci');
check(/gap: var\(--space-3\)/.test(side), 'lo spazio si e\' preso dai gruppi, dove abbondava');
check(/1080p/.test(side) && /1010/.test(side), 'e il vincolo del menu operatore dentro 1080p resta scritto, con la misura fatta');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
