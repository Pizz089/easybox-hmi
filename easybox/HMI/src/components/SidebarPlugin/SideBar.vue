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
];

const confItems = [
  { key: "menu.grippers", fallback: "Pinze", path: "/conf/Grippers" },
  { key: "menu.parts", fallback: "Pezzi", path: "/conf/Parts" },
  { key: "menu.trays", fallback: "Cassetti", path: "/conf/Trays" },
  { key: "menu.fixtures", fallback: "Attrezzature", path: "/conf/Fixtures" },
  { key: "menu.vices", fallback: "Morse", path: "/conf/Vices" },
  { key: "menu.pallets", fallback: "Pallets", path: "/conf/Pallets" },
  { key: "menu.gratings", fallback: "Grigliati", path: "/conf/Gratings" },
  { key: "menu.position", fallback: "Posizioni", path: "/conf/Position" },
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
const filteredConfItems = filterByLevel(confItems);
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
          {{ tr("sidebar.section.conf", "Conf") }}
        </h4>
        <ul>
          <li v-for="item in filteredConfItems" :key="item.path">
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
  background: radial-gradient(circle at top, var(--bg-surface), var(--bg-base) 55%);
  color: var(--text-primary);
  box-shadow: var(--elevation-2);
  overflow: hidden;
  z-index: 900;
  transition: width 0.25s ease-in-out;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

.sb:not(.open) {
  width: 0;                                       /* sidebar invisibile (era 70px) */
}

.sb-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
  padding: 0 6px;
  overflow-y: auto;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  margin: 0 14px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.18em;
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
  gap: 10px;
  padding: 9px 12px;
  margin: 2px 8px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.18s ease-out;
}

/* Active route: barra bianca verticale a sinistra via inset shadow.
   Vantaggio vs border-left: no layout shift del testo.
   Vue Router applica .router-link-active automaticamente al link che matcha. */
a.router-link-active {
  color: var(--text-primary);
  box-shadow:
    inset 4px 0 0 var(--text-primary),
    0 0 0 1px var(--border-default);
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
  border-radius: 999px;
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
