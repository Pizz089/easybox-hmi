<script setup>
import { computed, reactive, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { dataStored } from "@/data";

const props = defineProps({
  open: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["toggle"]);

const { t } = useI18n();

const tr = (key, fallback) => {
  const res = t(key);
  return res === key ? fallback : res;
};

const menuItems = [
  { key: "menu.dashboard", fallback: "Dashboard", path: "/dashboard" },
  { key: "menu.production", fallback: "Produzione", path: "/production" },
];

const unitItems = [
  { key: "menu.robot", fallback: "Robot", path: "/unit/robot" },
  { key: "menu.cnc1", fallback: "CNC 1", path: "/unit/CNC1" },
  { key: "menu.cnc2", fallback: "CNC 2", path: "/unit/CNC2" },
  { key: "menu.smallbox", fallback: "EasyBox", path: "/unit/smallbox" },
];

// U-FASE2 (setup impianto): CONFIGURAZIONE divisa in due gruppi che seguono
// i due percorsi cliente — MAGAZZINO (cosa produco: pezzo->grigliato->
// cassetto->posizioni) e ATTREZZAGGIO (con cosa: pallet+morsa+attrezzatura,
// pinze, macchine).
const magItems = [
  { key: "menu.parts", fallback: "Pezzi", path: "/conf/Parts" },
  { key: "menu.gratings", fallback: "Grigliati", path: "/conf/Gratings" },
  { key: "menu.trays", fallback: "Cassetti", path: "/conf/Trays" },
];

const toolItems = [
  // Vista aggregata pallet+morsa+attrezzatura: prima voce del blocco,
  // e' il punto d'ingresso del percorso attrezzaggio.
  { key: "menu.attrezzaggi", fallback: "Attrezzaggi", path: "/conf/Attrezzaggi" },
  { key: "menu.pallets", fallback: "Pallets", path: "/conf/Pallets" },
  { key: "menu.vices", fallback: "Morse", path: "/conf/Vices" },
  { key: "menu.fixtures", fallback: "Attrezzature", path: "/conf/Fixtures" },
  { key: "menu.grippers", fallback: "Pinze", path: "/conf/Grippers" },
  // Config macchina (selettore brand): area tecnico, stesso pattern
  // requiresLevel introdotto in N1-2a per la voce diagnostica.
  { key: "menu.machines", fallback: "Macchine", path: "/conf/Machines", requiresLevel: 2 },
];

// W: sezione IMPOSTAZIONI — quote e coordinate fini (Posizioni, spostata da
// MAGAZZINO: e' taratura impianto, non flusso quotidiano di magazzino).
const setItems = [
  { key: "menu.position", fallback: "Posizioni", path: "/conf/Position" },
  // AD: abilita/disabilita posizioni dei magazzini pallet/pinze — area
  // tecnico (gate ratificato: livello >= 1, view gated allo stesso modo).
  { key: "menu.warehouses", fallback: "Magazzini", path: "/conf/Warehouses", requiresLevel: 1 },
];

const diagItems = [
  { key: "menu.mqttDiag", fallback: "MQTT Live", path: "/diag/mqtt", requiresLevel: 1 },
];

// Filtro per voci con `requiresLevel`: nasconde la voce se userLevel < requiresLevel.
// Voci senza requiresLevel sono sempre visibili. Pattern riutilizzabile: per
// nascondere una voce a utenti di basso livello, aggiungere requiresLevel alla
// sua dichiarazione, niente codice ad hoc.
function filterByLevel(items) {
  return computed(() =>
    items.filter(
      (i) => !i.requiresLevel || Number(dataStored.userLevel) >= i.requiresLevel
    )
  );
}

const filteredMenuItems = filterByLevel(menuItems);
const filteredUnitItems = filterByLevel(unitItems);
const filteredMagItems = filterByLevel(magItems);
const filteredToolItems = filterByLevel(toolItems);
const filteredSetItems = filterByLevel(setItems);
const filteredDiagItems = filterByLevel(diagItems);

// W: gruppi COLLASSABILI — tutti tranne MENU (che resta hardcoded nel
// template, header slim non interattivo). Una sezione senza voci visibili
// al livello corrente sparisce (era gia' cosi' per Diagnostica).
const groups = computed(() =>
  [
    { id: "unit", key: "sidebar.section.unit", fallback: "Unit", items: filteredUnitItems.value },
    { id: "warehouse", key: "sidebar.section.warehouse", fallback: "Magazzino", items: filteredMagItems.value },
    { id: "tooling", key: "sidebar.section.tooling", fallback: "Attrezzaggio", items: filteredToolItems.value },
    { id: "settings", key: "sidebar.section.settings", fallback: "Impostazioni", items: filteredSetItems.value },
    { id: "diagnostics", key: "sidebar.section.diagnostics", fallback: "Diagnostica", items: filteredDiagItems.value },
  ].filter((g) => g.items.length > 0)
);

// W: stato collasso per gruppo, default TUTTO APERTO (chiave assente =
// aperto), persistito in localStorage = per postazione (ogni kiosk il suo).
const COLLAPSE_KEY = "easybox.sidebar.collapsed";
function loadCollapsed() {
  try {
    const raw = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}
const collapsed = reactive(loadCollapsed());

function persistCollapsed() {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
  } catch (e) {
    /* storage pieno/negato: lo stato resta solo in sessione */
  }
}

function toggleGroup(id) {
  collapsed[id] = !collapsed[id];
  persistCollapsed();
}

// REGOLA W (punto 4): il gruppo che contiene la voce attiva si espande
// automaticamente alla navigazione (match esatto sul path della voce;
// immediate: vale anche per la route di primo caricamento).
const route = useRoute();
watch(
  () => route.path,
  (p) => {
    const target = (p || "").toLowerCase();
    for (const g of groups.value) {
      if (collapsed[g.id] && g.items.some((i) => i.path.toLowerCase() === target)) {
        collapsed[g.id] = false;
        persistCollapsed();
      }
    }
  },
  { immediate: true }
);
</script>

<template>
  <aside class="sb" :class="{ open: props.open }">
    <nav class="sb-nav">
      <div class="section">
        <h4 v-if="props.open" class="section-title">
          {{ tr("sidebar.section.menu", "Menu") }}
        </h4>
        <ul>
          <li v-for="item in filteredMenuItems" :key="item.path">
            <RouterLink :to="item.path">
              <span v-if="props.open">
                {{ tr(item.key, item.fallback) }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </div>

      <!-- W: gruppi collassabili (tutti tranne MENU sopra). Header
           interattivo touch 44, chevron che ruota, a11y minima
           (role button + tastiera). -->
      <div class="section section--collapsible" v-for="g in groups" :key="g.id">
        <h4 v-if="props.open" class="section-title section-title--toggle"
          role="button"
          tabindex="0"
          :aria-expanded="!collapsed[g.id]"
          @click="toggleGroup(g.id)"
          @keydown.enter.prevent="toggleGroup(g.id)"
          @keydown.space.prevent="toggleGroup(g.id)">
          {{ tr(g.key, g.fallback) }}
          <svg class="chevron" :class="{ closed: collapsed[g.id] }"
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </h4>
        <ul v-show="!collapsed[g.id]">
          <li v-for="item in g.items" :key="item.path">
            <RouterLink :to="item.path">
              <span v-if="props.open">
                {{ tr(item.key, item.fallback) }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.sb {
  position: fixed;
  top: 64px;                                     /* parte sotto la TopBar fissa */
  left: 0;
  height: calc(100vh - 64px);                    /* altezza viewport meno TopBar */
  width: 220px;
  background: #141D2A;
  /* DEBITO TECNICO: mid-tone calcolato tra --bg-base (#050A12) e
     --bg-surface (#243043) per differenziare la sidebar dalla
     TopBar (entrambe userebbero bg-surface) e creare gerarchia
     visiva (sidebar incassata sotto TopBar alzata). Da promuovere
     a token --bg-sidebar o --bg-surface-0-5 in un futuro sub-step
     di tokens consolidation. */
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;  /* solo angoli destri, coerenti con TopBar */
  color: var(--text-primary);
  box-shadow: var(--elevation-2);
  overflow: hidden;
  z-index: 900;
  transition: width 0.25s ease-in-out;
  display: flex;
  flex-direction: column;
}

.sb:not(.open) {
  width: 0;                                       /* sidebar invisibile (era 70px) */
}

.sb-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-2) 0;
  overflow-y: auto;
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Header base = solo MENU (non collassabile, non interattivo): resta slim
   (~30px a blocco) — nessun requisito touch su un elemento non cliccabile.
   W: per i gruppi collassabili la deroga --space-1 del dimagrimento
   (77fca84) SI RIENTRA: l'altezza la governa il min-height 44 interattivo
   (vedi .section-title--toggle), l'aria e' tornata a token. */
.section-title {
  padding: var(--space-1) var(--space-4);
  margin: 0;
  background: var(--bg-input);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  text-transform: uppercase;
  text-align: center;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

/* W: gap header->lista 8->0 SOLO per i gruppi collassabili (opzione D):
   l'aria la da' gia' l'header interattivo a 44. Gap fra sezioni e altezza
   voci invariati. */
.section--collapsible {
  gap: 0;
}

/* W: header interattivo dei gruppi collassabili — touch 44, label centrata
   come il canone, chevron ancorato a destra. */
.section-title--toggle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: var(--space-2) var(--space-6);   /* orizzontale > per non finire sotto il chevron */
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.section-title--toggle:hover,
.section-title--toggle:focus-visible {
  background: var(--bg-surface-2);
  color: var(--text-primary);
}

.section-title--toggle:focus {
  outline: none;               /* feedback tastiera dato da :focus-visible sopra */
}

/* W: chevron che ruota — transizione leggera (solo transform, kiosk-safe) */
.chevron {
  position: absolute;
  right: var(--space-3);
  width: 14px;
  height: 14px;
  transition: transform var(--transition-fast);
}

.chevron.closed {
  transform: rotate(-90deg);
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 0;
}

a {
  color: var(--text-secondary);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  /* 2px verticale: micro-spaziatura tra voci (eccezione §2.1) */
  margin: 2px var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  /* Touch 44 (deroga al 52 preferito, documentata §3.4): il menu completo
     ha 17 voci, a 52px sforerebbe il viewport del pannello. NON scendere
     sotto 44. Regola documentata (doc, deroga sidebar): il set OPERATORE
     (liv. 0) deve stare in 1080p SENZA scroll; per i livelli tecnici lo
     scroll (overflow-y della .sb-nav) e' accettato. */
  min-height: 44px;
  transition: all 0.18s ease-out;
}

/* Active route: barra bianca verticale a sinistra via inset shadow.
   Vantaggio vs border-left: no layout shift del testo.
   Vue Router applica .router-link-active automaticamente al link che matcha. */
a.router-link-active {
  color: var(--text-primary);
  box-shadow:
    inset 4px 0 0 var(--text-primary),
    inset 0 0 0 2px var(--text-primary);
}

/* Hover + focus-visible (navigazione tastiera): stesso stile. */
a:hover,
a:focus-visible {
  background: var(--bg-surface-2);
  color: var(--text-primary);
}

/* HMI touch/mouse: rimuovo outline focus default browser.
   Feedback navigazione tastiera dato da :focus-visible sopra. */
a:focus {
  outline: none;
}

.sb-nav::-webkit-scrollbar {
  width: 5px;
}
.sb-nav::-webkit-scrollbar-track {
  background: transparent;
}
.sb-nav::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: var(--radius-pill);
}

.sb:not(.open) .section-title,
.sb:not(.open) a span {
  display: none;
}

.sb:not(.open) .sb-nav {
  justify-content: center;
  padding: 0;
}
</style>
