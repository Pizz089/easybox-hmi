// ============================================================================
// test_layout_nav.mjs — frecce fra cassetti nella pagina layout (P3 5/10)
//
// layoutView (/layout/:trayID/:modifyEnable/:floorMag) porta al cassetto del
// piano precedente e successivo. Si verifica:
//  - la scelta del vicino con piani mancanti ed estremi (util trayNeighbors);
//  - che la freccia NON navighi con modifiche locali non salvate senza prima
//    chiedere, e che la modalita' (modifyEnable) resti quella corrente;
//  - che i dati si ricarichino al cambio dei soli parametri (Vue riusa il
//    componente) e che una risposta in ritardo del cassetto vecchio si scarti;
//  - che il Save scriva sul piano fissato all'avvio, mai su quello di arrivo.
//
// Uso:   node test_layout_nav.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { neighborTrays, pocketsSignature } = await server.ssrLoadModule('/src/util/trayNeighbors.js');
const comp = (await server.ssrLoadModule('/src/views/layoutView.vue')).default;
const src = readFileSync('src/views/layoutView.vue', 'utf8');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// cassettiera come la ritorna api/conf/tray/show/all (ordinata per piano
// decrescente, come in cella): mancano i piani 3, 6 e 7, e una riga e' fuori (0)
const trays = [12, 11, 10, 9, 8, 5, 4, 2, 1].map(f => ({ ID: 100 + f, FLOOR_MAG: f }));
trays.push({ ID: 999, FLOOR_MAG: 0 });

console.log('1) scelta del piano precedente e successivo');
let n = neighborTrays(trays, 5);
check(n.prev && n.prev.floor === 4 && n.prev.trayID === 104, 'da 5: precedente = 4 (cassetto 104)');
check(n.next && n.next.floor === 8 && n.next.trayID === 108, 'da 5: successivo = 8, saltati i piani 6 e 7 senza cassetto');
n = neighborTrays(trays, 4);
check(n.prev && n.prev.floor === 2, 'da 4: precedente = 2, saltato il piano 3');
n = neighborTrays(trays, 1);
check(n.prev === null && n.next && n.next.floor === 2, 'piano 1: nessun precedente (estremo), successivo = 2');
n = neighborTrays(trays, 12);
check(n.next === null && n.prev && n.prev.floor === 11, 'piano 12: nessun successivo (estremo)');
n = neighborTrays(trays, '9');
check(n.prev.floor === 8 && n.next.floor === 10, 'parametro di rotta stringa ("9") gestito');
check(neighborTrays(trays, 5).prev.trayID !== 999 && !Object.values(neighborTrays(trays, 1)).some(v => v && v.floor === 0), 'cassetto fuori (FLOOR_MAG 0) mai proposto');
n = neighborTrays([], 5);
check(n.prev === null && n.next === null, 'elenco vuoto (backend non risponde): frecce disabilitate');
n = neighborTrays([{ ID: 50, FLOOR_MAG: 6 }, { ID: 51, FLOOR_MAG: 6 }], 5);
check(n.next.trayID === 50, 'due righe sullo stesso piano: vale la prima');

console.log('\n2) freccia e modifiche non salvate');
function makeVm(params, listPz, loadedSig) {
	const pushed = [];
	const vm = { ...comp.data(), $route: { params }, $router: { push: p => pushed.push(p) }, $t: k => k };
	vm.trays = trays; vm.listPz = listPz; vm.loadedSig = loadedSig;
	for (const [k, f] of Object.entries(comp.methods || {})) vm[k] = f.bind(vm);
	for (const [k, c] of Object.entries(comp.computed || {}))
		Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
	return { vm, pushed };
}
const pz = () => [{ SUB_POS: 1, status: 2 }, { SUB_POS: 2, status: 4 }];
let { vm, pushed } = makeVm({ trayID: '105', modifyEnable: '1', floorMag: '5' }, pz(), pocketsSignature(pz()));
check(vm.isDirty === false, 'appena letto: nessuna modifica');
vm.goNeighbor('next');
check(pushed.join() === '/layout/108/1/8' && vm.navConfirm === null, 'senza modifiche: va subito al piano 8, modalita\' 1 invariata');

({ vm, pushed } = makeVm({ trayID: '105', modifyEnable: '1', floorMag: '5' }, pz(), pocketsSignature(pz())));
vm.allRaugh();
check(vm.isDirty === true, '"Tutti grezzi" senza Save -> modifiche non salvate');
vm.goNeighbor('prev');
check(pushed.length === 0 && vm.navConfirm && vm.navConfirm.floor === 4, 'la freccia NON naviga: chiede conferma');
vm.navConfirm = null;
check(pushed.length === 0, 'annullando si resta sul cassetto, modifiche intatte');
vm.goNeighbor('prev');
vm.confirmDiscard();
check(pushed.join() === '/layout/104/1/4' && vm.navConfirm === null, 'confermando lo scarto si va al piano 4, senza salvare niente');

({ vm, pushed } = makeVm({ trayID: '105', modifyEnable: '0', floorMag: '5' }, pz(), pocketsSignature(pz())));
vm.listPz[0].status = 4;
check(vm.isDirty === false, 'in sola lettura non ci sono modifiche da proteggere');
vm.goNeighbor('next');
check(pushed.join() === '/layout/108/0/8', 'in sola lettura si resta in sola lettura (modalita\' 0 invariata)');

({ vm, pushed } = makeVm({ trayID: '101', modifyEnable: '1', floorMag: '1' }, pz(), pocketsSignature(pz())));
vm.goNeighbor('prev');
check(pushed.length === 0, 'agli estremi la freccia non fa niente');
check(/:disabled="!neighbors\.prev \|\| navBlocked"/.test(src) && /:disabled="!neighbors\.next \|\| navBlocked"/.test(src), 'e nel template e\' disabilitata');

({ vm, pushed } = makeVm({ trayID: '105', modifyEnable: '1', floorMag: '5' }, pz(), pocketsSignature(pz())));
vm.saving = true;
vm.goNeighbor('next');
check(pushed.length === 0, 'durante il Save le frecce sono ferme');

console.log('\n3) ricaricamento al cambio dei parametri e risposte in ritardo');
check(/'\$route\.params': \{[\s\S]{0,600}this\.getDataTable\(\)/.test(src), 'watch su $route.params che rilegge le tasche');
check(/'\$route\.params': \{[\s\S]{0,600}this\.loadedSig = null/.test(src), 'e azzera lo stato "letto" del cassetto vecchio');
check(/const floor = String\(this\.\$route\.params\.floorMag\);[\s\S]{0,600}if \(String\(this\.\$route\.params\.floorMag\) !== floor\) return;/.test(src), 'risposta del cassetto vecchio arrivata dopo il cambio: scartata');

console.log('\n4) il Save scrive sul piano fissato all\'avvio');
const save = src.slice(src.indexOf('saveAllData(){'), src.indexOf('computed: {'));
check(/const floor = this\.\$route\.params\.floorMag;/.test(save), 'piano fissato una volta, all\'inizio del Save');
check(/updatePositionStatus\/'\+floor\+/.test(save) && !/updatePositionStatus\/'\+this\.\$route/.test(save), 'le scritture usano quel piano, mai la rotta corrente');
check(/Promise\.all\(writes\)\.finally/.test(save) && /this\.saving = false/.test(save), 'rilettura e sblocco frecce solo a scritture finite');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
