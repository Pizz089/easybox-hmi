<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
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
  { key: "menu.position", fallback: "Posizioni", path: "/conf/Position" },
];

const toolItems = [
  { key: "menu.pallets", fallback: "Pallets", path: "/conf/Pallets" },
  { key: "menu.vices", fallback: "Morse", path: "/conf/Vices" },
  { key: "menu.fixtures", fallback: "Attrezzature", path: "/conf/Fixtures" },
  { key: "menu.grippers", fallback: "Pinze", path: "/conf/Grippers" },
  // Config macchina (selettore brand): area tecnico, stesso pattern
  // requiresLevel introdotto in N1-2a per la voce diagnostica.
  { key: "menu.machines", fallback: "Macchine", path: "/conf/Machines", requiresLevel: 2 },
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
const filteredDiagItems = filterByLevel(diagItems);
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

      <div class="section">
        <h4 v-if="props.open" class="section-title">
          {{ tr("sidebar.section.unit", "Unit") }}
        </h4>
        <ul>
          <li v-for="item in filteredUnitItems" :key="item.path">
            <RouterLink :to="item.path">
              <span v-if="props.open">
                {{ tr(item.key, item.fallback) }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </div>

      <div class="section">
        <h4 v-if="props.open" class="section-title">
          {{ tr("sidebar.section.warehouse", "Magazzino") }}
        </h4>
        <ul>
          <li v-for="item in filteredMagItems" :key="item.path">
            <RouterLink :to="item.path">
              <span v-if="props.open">
                {{ tr(item.key, item.fallback) }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </div>

      <div class="section">
        <h4 v-if="props.open" class="section-title">
          {{ tr("sidebar.section.tooling", "Attrezzaggio") }}
        </h4>
        <ul>
          <li v-for="item in filteredToolItems" :key="item.path">
            <RouterLink :to="item.path">
              <span v-if="props.open">
                {{ tr(item.key, item.fallback) }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </div>

      <div class="section" v-if="filteredDiagItems.length > 0">
        <h4 v-if="props.open" class="section-title">
          {{ tr("sidebar.section.diagnostics", "Diagnostica") }}
        </h4>
        <ul>
          <li v-for="item in filteredDiagItems" :key="item.path">
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

/* U-FASE2: header DIMAGRITI (~30px a blocco, prima ~51): con 5 sezioni il
   costo verticale degli header pesava piu' delle voci risparmiate. Padding
   verticale 8->4 (space-1), margin-bottom 8->0 (resta il gap 8 della
   .section), line-height 1.6 ereditata -> tight. Il blocco header vale ora
   4+4+14.4+8(gap) ~= 30px. */
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
