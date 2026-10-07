// ============================================================================
// layout/navConfig.js — navigazione del pannello v3 (UI-DESIGN-SYSTEM v3 §13)
//
// Nove voci nella barra a sinistra (fase E1.7, decisione di Dario del 7/10:
// Pinze e Spinta in battuta escono da Attrezzaggio e diventano voci); ogni
// voce raggruppa rotte di OGGI in schede. Le rotte NON cambiano nome (test,
// link, preferiti del tablet): qui si dice solo in che voce e in che scheda
// stanno.
//   match     prefissi di rotta che accendono la voce/scheda (senza
//             distinguere maiuscole: il router del pannello non le distingue)
//   level     livello utente minimo: sotto, la scheda NON si mostra
//             (all'operatore nessuna voce che dice "non abilitato")
//   machine   la scheda esiste solo se quella macchina e' configurata
//             (stessa regola della sidebar di oggi, util/machineBrands)
//   short     etichetta corta della barra in compatto
//   dropWhenShort  la voce esce dalla barra quando le nove non ci stanno a
//             52 px l'una (schermi bassi, fase E1.4): solo Allarmi, che
//             resta raggiungibile dalla campanella della striscia, col numero
// ============================================================================
import { House, SlidersHorizontal, List, Layers, Wrench, Grab, ArrowRightToLine, Bell, Settings } from 'lucide-vue-next';

export const NAV = [
	{ id: 'home', label: 'nav.home', icon: House, tabs: [
		{ to: '/dashboard', label: 'nav.home', match: ['/dashboard'] },
	], match: ['/dashboard'], exact: ['/'] },
	{ id: 'controls', label: 'nav.controls', icon: SlidersHorizontal, tabs: [
		{ to: '/unit/robot', label: 'menu.robot', match: ['/unit/robot'] },
		{ to: '/unit/CNC1', label: 'nav.tab.mc1', match: ['/unit/CNC1'], machine: 1 },
		{ to: '/unit/CNC2', label: 'nav.tab.mc2', match: ['/unit/CNC2'], machine: 2 },
		{ to: '/unit/smallbox', label: 'menu.smallbox', match: ['/unit/smallbox'] },
	] },
	{ id: 'production', label: 'nav.production', icon: List, tabs: [
		{ to: '/production', label: 'nav.production', match: ['/production', '/selectRig', '/selectPiece', '/selectGripper', '/selectPallet', '/selectVice', '/selectFixture', '/selectMC', '/lastData'] },
	] },
	{ id: 'warehouse', label: 'nav.warehouse', icon: Layers, tabs: [
		{ to: '/conf/Trays', label: 'menu.trays', match: ['/conf/Trays', '/conf/tray', '/layout'] },
		{ to: '/conf/Gratings', label: 'menu.gratings', match: ['/conf/Gratings', '/conf/Grating', '/conf/importGrating'] },
		{ to: '/conf/Parts', label: 'menu.parts', match: ['/conf/Parts', '/conf/piece'] },
	] },
	// la scheda «Chele morsa», fra Morse e Attrezzature, la aggiunge il
	// prompt 5 di 5
	{ id: 'tooling', label: 'nav.tooling', short: 'nav.short.tooling', icon: Wrench, tabs: [
		{ to: '/conf/Attrezzaggi', label: 'menu.attrezzaggi', match: ['/conf/Attrezzaggi', '/conf/Attrezzaggio'] },
		{ to: '/conf/Pallets', label: 'menu.pallets', match: ['/conf/Pallets', '/conf/pallet'] },
		{ to: '/conf/Vices', label: 'menu.vices', match: ['/conf/Vices', '/conf/vice'] },
		{ to: '/conf/Fixtures', label: 'menu.fixtures', match: ['/conf/Fixtures', '/conf/Fixture', '/conf/FixtureOnPallet'] },
	] },
	{ id: 'grippers', label: 'nav.grippers', icon: Grab, tabs: [
		{ to: '/conf/Grippers', label: 'menu.grippers', match: ['/conf/Grippers', '/conf/Gripper'] },
	] },
	{ id: 'push', label: 'nav.push', short: 'nav.short.push', icon: ArrowRightToLine, tabs: [
		{ to: '/sim/push', label: 'menu.pushSim', match: ['/sim/push'] },
	] },
	{ id: 'alarms', label: 'nav.alarms', icon: Bell, badge: true, dropWhenShort: true, tabs: [
		{ to: '/alarms', label: 'nav.alarms', match: ['/alarms'] },
		{ to: '/diag/mqtt', label: 'menu.mqttDiag', match: ['/diag/mqtt'], level: 1 },
	] },
	{ id: 'settings', label: 'nav.settings', short: 'nav.short.settings', icon: Settings, bottom: true, tabs: [
		{ to: '/conf/Position', label: 'menu.position', match: ['/conf/Position'], level: 1 },
		{ to: '/conf/Machines', label: 'menu.machines', match: ['/conf/Machines'], level: 2 },
		{ to: '/conf/Warehouses', label: 'menu.warehouses', match: ['/conf/Warehouses'], level: 1 },
		// livello 0: cambio utente (stesso dialog di oggi) e lingua (stesso
		// ciclo della striscia), cosi' anche sul tablet in compatto
		{ to: '/settings/user', label: 'nav.tab.userLang', match: ['/settings/user'] },
	] },
];

const norm = p => String(p || '').toLowerCase().replace(/\/+$/, '') || '/';
export function matchPath(path, prefixes) {
	const p = norm(path);
	return (prefixes || []).some(m => { const x = norm(m); return p === x || p.startsWith(x + '/'); });
}
// voce attiva per la rotta corrente
export function sectionOf(path) {
	const p = norm(path);
	return NAV.find(s => (s.exact || []).some(e => norm(e) === p) || matchPath(p, s.match) || s.tabs.some(t => matchPath(p, t.match))) || null;
}
// schede visibili a questo livello e con queste macchine
export function visibleTabs(section, level, isMachineConfigured) {
	const lv = Number(level) || 0;
	return section.tabs.filter(t => (!t.level || lv >= t.level) && (t.machine === undefined || isMachineConfigured(t.machine)));
}
