<script setup>
import {
  ref, reactive, computed, watch,
  onMounted, onBeforeUnmount, nextTick, markRaw,
} from 'vue'
import { dataStored } from '@/data'

// ============================================================================
// COSTANTI E CONFIGURAZIONE
// ============================================================================

const MAX_VISIBLE         = 500;     // cap rigido tabella (FIFO)
const MAX_PENDING         = 500;     // cap buffer accumulo durante pausa (FIFO)
const SCROLL_THRESHOLD_PX = 5;       // distanza dal bottom per considerare "in fondo"
const STATS_WINDOW_MS     = 10000;   // sliding window per msg/sec
const STATS_TICK_MS       = 500;     // intervallo aggiornamento stats e session duration
const PAYLOAD_PREVIEW_MAX = 100;     // troncamento preview payload in tabella
const STORAGE_KEY_FILTERS = 'mqttdiag:filters';   // chiave dedicata, namespace mqttdiag per evitare collisioni

// ============================================================================
// STATO REATTIVO
// ============================================================================

// Lista messaggi visualizzati. Gli elementi sono markRaw → Vue non avvolge
// in proxy reactive i campi interni (i messaggi sono immutabili dopo il push).
const messages = ref([])

// Counter monotono per assegnare _id stabili (key v-for performante).
let msgIdCounter = 0;

// Buffer non-reattivo per messaggi accumulati durante pausa.
// Non serve reactivity: leggo length tramite pendingCount.
let pendingBuffer = [];
const pendingCount       = ref(0);
const pendingCapReached  = ref(false);

const paused      = ref(false);
const autoScroll  = ref(true);
const connected   = ref(false);
const received    = ref(0);          // totale messaggi arrivati nella sessione

// 2c-C: distinguiamo primo connect (backend manda mqtt-bulk automaticamente)
// da reconnect (dobbiamo chiederlo esplicitamente con request-snapshot).
// Non reactive: serve solo come flag logico interno.
let bulkReceived = false;

// Filtri client-side (combinati in AND).
const filters = reactive({
  topic:  '',
  dir:    'ALL',     // ALL | IN | OUT
  source: 'ALL',     // ALL | PLC | HMI | BACKEND
});

// Set di _id dei messaggi attualmente espansi nel dettaglio inline.
// reactive(new Set()) traccia mutazioni .add/.delete in Vue 3.
const expandedSet = reactive(new Set());

// ============================================================================
// STATS (msg/sec, durata sessione)
// ============================================================================

const timestampWindow = [];          // array dei ts dei messaggi ultimi STATS_WINDOW_MS
const msgPerSec  = ref(0);
const sessionStart = ref(0);         // settato in onMounted
const nowTick    = ref(0);           // aggiornato ogni STATS_TICK_MS per session duration reactive
let statsInterval = null;

function pruneTimestampWindow() {
  const cutoff = Date.now() - STATS_WINDOW_MS;
  while (timestampWindow.length > 0 && timestampWindow[0] < cutoff) {
    timestampWindow.shift();
  }
}

function tickStats() {
  pruneTimestampWindow();
  msgPerSec.value = +(timestampWindow.length / (STATS_WINDOW_MS / 1000)).toFixed(1);
  nowTick.value = Date.now();
}

const sessionDuration = computed(() => {
  if (sessionStart.value === 0) return '00:00:00';
  return fmtDuration(nowTick.value - sessionStart.value);
});

// ============================================================================
// FILTRI E COMPUTED
// ============================================================================

// 2c-A: persistenza filtri in localStorage. Fail silent se non disponibile
// (privacy mode, quota piena, JSON corrotto) — filtri restano ai default.
function loadFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FILTERS);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    if (typeof parsed.topic === 'string') filters.topic = parsed.topic;
    if (parsed.dir === 'ALL' || parsed.dir === 'IN' || parsed.dir === 'OUT') {
      filters.dir = parsed.dir;
    }
    if (parsed.source === 'ALL' || parsed.source === 'PLC'
        || parsed.source === 'HMI' || parsed.source === 'BACKEND') {
      filters.source = parsed.source;
    }
  } catch (_) { /* silent: localStorage indisponibile o JSON corrotto */ }
}

function saveFilters() {
  try {
    localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify({
      topic:  filters.topic,
      dir:    filters.dir,
      source: filters.source,
    }));
  } catch (_) { /* silent: localStorage indisponibile o quotaExceeded */ }
}

function matchesFilter(m) {
  if (filters.topic) {
    if (!m.topic.toLowerCase().includes(filters.topic.toLowerCase())) return false;
  }
  if (filters.dir !== 'ALL' && m.dir !== filters.dir) return false;
  if (filters.source !== 'ALL' && m.source !== filters.source) return false;
  return true;
}

const filteredMessages = computed(() => {
  if (filters.topic === '' && filters.dir === 'ALL' && filters.source === 'ALL') {
    return messages.value;
  }
  return messages.value.filter(matchesFilter);
});

const filterActive = computed(() =>
  filters.topic !== '' || filters.dir !== 'ALL' || filters.source !== 'ALL'
);

const autoScrollEffective = computed(() =>
  autoScroll.value && expandedSet.size === 0
);

// ============================================================================
// HANDLER MESSAGGI IN ARRIVO
// ============================================================================

function addToMessages(rawMsg) {
  // Shallow clone + _id + markRaw: l'oggetto entra in array reattivo
  // ma Vue non avvolge i suoi campi in proxy (sono immutabili).
  const tagged = markRaw({ ...rawMsg, _id: ++msgIdCounter });
  messages.value.push(tagged);
  if (messages.value.length > MAX_VISIBLE) {
    messages.value.splice(0, messages.value.length - MAX_VISIBLE);
  }
}

function addToPending(rawMsg) {
  pendingBuffer.push(rawMsg);
  if (pendingBuffer.length > MAX_PENDING) {
    pendingBuffer.shift();
    pendingCapReached.value = true;
  }
  pendingCount.value = pendingBuffer.length;
}

function onIncomingBatch(batch) {
  if (!Array.isArray(batch) || batch.length === 0) return;
  received.value += batch.length;

  // alimenta finestra stats (uso il "now" del batch, non msg.ts che può essere lievemente sfasato)
  const now = Date.now();
  for (let i = 0; i < batch.length; i++) timestampWindow.push(now);

  if (paused.value) {
    for (const m of batch) addToPending(m);
  } else {
    for (const m of batch) addToMessages(m);
    if (autoScrollEffective.value) {
      nextTick(() => scrollToBottom());
    }
  }
}

// ============================================================================
// AZIONI UTENTE — pause/resume/clear/export/expand
// ============================================================================

function pause() {
  paused.value = true;
  pendingCapReached.value = false;     // reset flag, ricomincia a contare
}

function resume() {
  paused.value = false;
  // accoda i pending nell'ordine in cui sono arrivati
  for (const m of pendingBuffer) addToMessages(m);
  pendingBuffer = [];
  pendingCount.value = 0;
  pendingCapReached.value = false;
  if (autoScrollEffective.value) {
    nextTick(() => scrollToBottom());
  }
}

function togglePause() {
  if (paused.value) resume(); else pause();
}

function clearAll() {
  messages.value = [];
  pendingBuffer = [];
  pendingCount.value = 0;
  pendingCapReached.value = false;
  expandedSet.clear();
  autoScroll.value = true;
}

function toggleExpand(id) {
  if (expandedSet.has(id)) expandedSet.delete(id);
  else                     expandedSet.add(id);
}

function clearFilters() {
  filters.topic = '';
  filters.dir = 'ALL';
  filters.source = 'ALL';
}

// ============================================================================
// SCROLL MANAGEMENT (auto-scroll + anti-eco)
// ============================================================================

const scrollContainer = ref(null);
let programmaticScroll = false;
let rafScheduled = false;

function scrollToBottom() {
  const el = scrollContainer.value;
  if (!el) return;
  programmaticScroll = true;
  el.scrollTop = el.scrollHeight;
  // reset flag dopo che lo scroll event si è propagato (next macrotask)
  setTimeout(() => { programmaticScroll = false; }, 0);
}

function onScroll() {
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    if (programmaticScroll) return;
    const el = scrollContainer.value;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom <= SCROLL_THRESHOLD_PX) {
      autoScroll.value = true;
    } else {
      autoScroll.value = false;
    }
  });
}

const showGoToBottom = computed(() =>
  !autoScroll.value && !paused.value && messages.value.length > 0
);

function goToBottom() {
  autoScroll.value = true;
  scrollToBottom();
}

// ============================================================================
// EXPORT CSV (client-side via Blob)
// ============================================================================

function escapeCsv(s) {
  if (s == null) return '';
  const str = String(s);
  if (/[";\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsv(rows) {
  const header = 'ts_iso;dir;source;topic;payload;size';
  const lines = rows.map(m => [
    new Date(m.ts).toISOString(),
    escapeCsv(m.dir),
    escapeCsv(m.source),
    escapeCsv(m.topic),
    escapeCsv(m.payload),
    m.size,
  ].join(';'));
  return [header, ...lines].join('\n');
}

function downloadCsv() {
  const data = filteredMessages.value;
  if (data.length === 0) return;
  const csv = buildCsv(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fileName = `mqtt-diag-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`
                 + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================================
// HELPERS DI FORMATTAZIONE
// ============================================================================

function fmtTime(ts) {
  const d = new Date(ts);
  const p2 = n => String(n).padStart(2, '0');
  const p3 = n => String(n).padStart(3, '0');
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p3(d.getMilliseconds())}`;
}

function fmtTimeIso(ts) {
  return new Date(ts).toISOString();
}

function fmtDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = n => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

function payloadPreview(p) {
  if (p == null) return '';
  const str = String(p);
  if (str.length <= PAYLOAD_PREVIEW_MAX) return str;
  return str.slice(0, PAYLOAD_PREVIEW_MAX) + '…';
}

// 2c-N1 + N4-1: pattern generico per evidenziare in rosso eventi anomali
// del backend. Convenzione "_" topic + suffisso ERROR/MISMATCH cattura sia
// _BROKER/ERROR sia _HAAS/CONFIG_MISMATCH e futuri _<X>/ERROR/MISMATCH
// senza bisogno di hardcodare un elenco di topic.
function isErrorTopic(topic) {
  if (!topic || !topic.startsWith('_')) return false;
  return topic.endsWith('/ERROR') || topic.endsWith('/MISMATCH');
}

function tryPrettyJson(payload) {
  if (payload == null || payload === '') return '';
  try {
    const parsed = JSON.parse(payload);
    return JSON.stringify(parsed, null, 2);
  } catch (_) {
    return String(payload);
  }
}

function copyToClipboard(m) {
  const text = JSON.stringify({
    ts:      fmtTimeIso(m.ts),
    dir:     m.dir,
    source:  m.source,
    topic:   m.topic,
    payload: m.payload,
    size:    m.size,
  }, null, 2);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

// ============================================================================
// LIFECYCLE
// ============================================================================

onMounted(() => {
  // 2c-A: ripristina filtri persistiti prima del setup socket, poi attiva il
  // watcher che li salva ad ogni cambio (deep perché filters è reactive nested).
  loadFilters();
  watch(filters, saveFilters, { deep: true });

  sessionStart.value = Date.now();
  nowTick.value = Date.now();

  // `io` esposto globalmente da public/socket.io.min.js (vedi index.html)
  const socket = io(dataStored.WS.brokerURL + '/diag');
  dataStored.WS.diagSocket = socket;

  socket.on('connect', () => {
    connected.value = true;
    // 2c-C: al primo connect il backend manda mqtt-bulk automaticamente.
    // Su reconnect (bulkReceived già true), richiediamo esplicitamente lo snapshot.
    // Fallimento silenzioso accettato (caso edge raro, non vale retry).
    if (bulkReceived) {
      try { socket.emit('request-snapshot'); } catch (_) {}
    }
  });
  socket.on('disconnect', () => { connected.value = false; });
  socket.on('mqtt-bulk', (batch) => {
    bulkReceived = true;
    onIncomingBatch(batch);
  });
  socket.on('mqtt-batch', onIncomingBatch);   // stream live (ogni 100ms)

  statsInterval = setInterval(tickStats, STATS_TICK_MS);
});

onBeforeUnmount(() => {
  if (statsInterval) { clearInterval(statsInterval); statsInterval = null; }
  if (dataStored.WS.diagSocket) {
    try { dataStored.WS.diagSocket.disconnect(); } catch (_) {}
    dataStored.WS.diagSocket = null;
  }
});
</script>

<template>
  <div class="diag-mqtt">

    <!-- HEADER: stato connessione + stats -->
    <div class="diag-header">
      <h2>Diagnostica MQTT — Live</h2>
      <div class="diag-status">
        <span class="st-dot" :class="connected ? 'st-on' : 'st-off'">●</span>
        <span>{{ connected ? 'connesso al namespace /diag' : 'disconnesso' }}</span>
        <span class="diag-stats">
          <span><strong>{{ msgPerSec }}</strong> msg/s</span>
          <span>sessione <strong>{{ sessionDuration }}</strong></span>
          <span>totali <strong>{{ received }}</strong></span>
          <span>in memoria <strong>{{ messages.length }}/{{ MAX_VISIBLE }}</strong></span>
        </span>
      </div>
    </div>

    <!-- TOOLBAR: filtri + controlli -->
    <div class="diag-toolbar">
      <div class="tb-filters">
        <label class="tb-field">
          <span>Topic</span>
          <input
            v-model="filters.topic"
            type="text"
            placeholder="filtra per substring..."
            class="tb-input"
          />
        </label>
        <label class="tb-field">
          <span>Dir</span>
          <select v-model="filters.dir" class="tb-input">
            <option value="ALL">TUTTI</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
        </label>
        <label class="tb-field">
          <span>Source</span>
          <select v-model="filters.source" class="tb-input">
            <option value="ALL">TUTTI</option>
            <option value="PLC">PLC</option>
            <option value="HMI">HMI</option>
            <option value="BACKEND">BACKEND</option>
          </select>
        </label>
        <button
          v-if="filterActive"
          class="tb-btn tb-btn-clear-filter"
          @click="clearFilters"
          title="Rimuove tutti i filtri attivi"
        >
          ✕ filtri
        </button>
      </div>

      <div class="tb-controls">
        <button
          class="tb-btn"
          :class="paused ? 'tb-btn-resume' : 'tb-btn-pause'"
          @click="togglePause"
        >
          {{ paused ? '▶ RIPRENDI' : '⏸ PAUSA' }}
        </button>
        <button
          class="tb-btn"
          @click="clearAll"
          :disabled="messages.length === 0 && pendingBuffer.length === 0"
        >
          ✕ CLEAR
        </button>
        <label class="tb-toggle">
          <input type="checkbox" v-model="autoScroll" />
          <span>Auto-scroll</span>
        </label>
        <button
          class="tb-btn"
          @click="downloadCsv"
          :disabled="filteredMessages.length === 0"
          :title="filterActive
            ? 'Esporta solo i ' + filteredMessages.length + ' messaggi filtrati'
            : 'Esporta tutti i ' + messages.length + ' messaggi in memoria'"
        >
          ⬇ EXPORT CSV
        </button>
      </div>

      <div class="tb-info">
        <span v-if="filterActive">
          Mostrati <strong>{{ filteredMessages.length }}</strong> /
          {{ messages.length }} messaggi
          ({{ messages.length - filteredMessages.length }} filtrati fuori)
        </span>
        <span v-else>
          Mostrati <strong>{{ messages.length }}</strong> messaggi
        </span>
      </div>
    </div>

    <!-- BANNER PAUSA -->
    <div v-if="paused" class="diag-banner diag-banner-pause">
      ⏸ Stream in pausa — accumulati <strong>{{ pendingCount }}</strong> msg
      <span v-if="pendingCapReached">
        <strong>*</strong> (cap {{ MAX_PENDING }} raggiunto, alcuni più vecchi scartati)
      </span>
    </div>

    <!-- BANNER ESPANSIONE -->
    <div v-if="expandedSet.size > 0" class="diag-banner diag-banner-expand">
      🔍 Scroll pausato — chiudi i {{ expandedSet.size }} dettagli aperti per riprendere l'auto-scroll
    </div>

    <!-- TABELLA -->
    <div class="diag-table-wrap">
      <div class="diag-table-head">
        <span>orario</span>
        <span>dir</span>
        <span>source</span>
        <span>topic</span>
        <span>payload</span>
      </div>
      <div class="diag-table-body" ref="scrollContainer" @scroll="onScroll">
        <div v-if="filteredMessages.length === 0" class="diag-empty">
          <template v-if="messages.length === 0">
            Nessun messaggio ricevuto.
            {{ connected ? 'In attesa di traffico MQTT...' : 'Connessione al namespace /diag in corso...' }}
          </template>
          <template v-else>
            Nessun messaggio corrisponde ai filtri attivi.
          </template>
        </div>
        <template v-else>
          <template v-for="m in filteredMessages" :key="m._id">
            <div
              class="diag-row"
              :class="{
                'row-error': isErrorTopic(m.topic),
                'row-expanded': expandedSet.has(m._id),
              }"
              @click="toggleExpand(m._id)"
            >
              <span class="m-time">{{ fmtTime(m.ts) }}</span>
              <span class="m-dir" :class="'dir-' + m.dir">{{ m.dir }}</span>
              <span class="m-src">{{ m.source }}</span>
              <span class="m-topic" :title="m.topic">{{ m.topic }}</span>
              <span class="m-payload" :title="m.payload">{{ payloadPreview(m.payload) }}</span>
            </div>
            <div v-if="expandedSet.has(m._id)" class="diag-row-detail">
              <div class="dd-meta">
                <span><strong>ts:</strong> {{ fmtTimeIso(m.ts) }}</span>
                <span><strong>dir:</strong> {{ m.dir }}</span>
                <span><strong>source:</strong> {{ m.source }}</span>
                <span><strong>size:</strong> {{ m.size }} byte</span>
              </div>
              <div class="dd-topic">
                <strong>topic:</strong> <code>{{ m.topic }}</code>
              </div>
              <div class="dd-payload">
                <strong>payload:</strong>
                <pre>{{ tryPrettyJson(m.payload) }}</pre>
              </div>
              <div class="dd-actions">
                <button class="dd-btn" @click.stop="copyToClipboard(m)">📋 Copia JSON</button>
                <button class="dd-btn" @click.stop="toggleExpand(m._id)">✕ Chiudi</button>
              </div>
            </div>
          </template>
        </template>
      </div>

      <!-- Floating "vai in fondo" -->
      <button
        v-if="showGoToBottom"
        class="diag-goto-bottom"
        @click="goToBottom"
        title="Riprendi auto-scroll e vai in fondo"
      >
        ↓ vai in fondo
      </button>
    </div>

  </div>
</template>

<style scoped>
.diag-mqtt {
  padding: 16px;
  font-family: 'DM Mono', monospace, system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 32px);
  box-sizing: border-box;
}

/* HEADER */
.diag-header {
  margin-bottom: 10px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 8px;
  flex-shrink: 0;
}
.diag-header h2 { margin: 0 0 6px 0; font-size: 18px; }
.diag-status {
  display: flex; align-items: center; gap: 12px;
  font-size: 12px; color: #555;
}
.st-dot { font-size: 14px; }
.st-on  { color: #00aa44; }
.st-off { color: #c00; }
.diag-stats {
  margin-left: auto; display: flex; gap: 18px;
  color: #666;
}
.diag-stats strong { color: #222; }

/* TOOLBAR */
.diag-toolbar {
  display: flex; flex-wrap: wrap; gap: 12px;
  align-items: center; padding: 10px 12px;
  background: #f4f4f4; border: 1px solid #ddd;
  border-radius: 4px; margin-bottom: 8px;
  flex-shrink: 0;
}
.tb-filters, .tb-controls {
  display: flex; gap: 8px; align-items: center;
}
.tb-field { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: #666; }
.tb-input {
  font-family: inherit; font-size: 12px;
  padding: 4px 8px; border: 1px solid #ccc; border-radius: 3px;
  background: white; min-width: 80px;
}
.tb-input:focus { outline: 1px solid #0066cc; border-color: #0066cc; }
.tb-btn {
  font-family: inherit; font-size: 11px; font-weight: 600;
  padding: 6px 12px; border: 1px solid #aaa; border-radius: 3px;
  background: white; cursor: pointer; color: #333;
}
.tb-btn:hover:not(:disabled) { background: #eee; }
.tb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tb-btn-pause      { border-color: #cc6600; color: #cc6600; }
.tb-btn-resume     { border-color: #00aa44; color: #00aa44; }
.tb-btn-clear-filter { border-color: #c00; color: #c00; font-size: 10px; padding: 4px 8px; }
.tb-toggle { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #555; cursor: pointer; }
.tb-info {
  margin-left: auto; font-size: 11px; color: #666;
}

/* BANNER */
.diag-banner {
  padding: 6px 12px; font-size: 12px; border-radius: 3px;
  margin-bottom: 8px;
}
.diag-banner-pause { background: #fff5e0; border: 1px solid #cc6600; color: #663300; }
.diag-banner-expand { background: #e6f4ff; border: 1px solid #0066cc; color: #003366; }

/* TABELLA */
.diag-table-wrap {
  position: relative; flex: 1;
  display: flex; flex-direction: column;
  border: 1px solid #ddd; border-radius: 4px;
  overflow: hidden; background: white;
}
.diag-table-head, .diag-row {
  display: grid;
  grid-template-columns: 120px 50px 80px 1.2fr 2fr;
  gap: 8px; padding: 4px 10px; font-size: 12px;
  align-items: center;
}
.diag-table-head {
  background: #efefef; font-weight: 600; color: #444;
  text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em;
  border-bottom: 1px solid #ccc; flex-shrink: 0;
}
.diag-table-body {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  background: #fafafa;
}
.diag-row {
  border-bottom: 1px solid #eee; cursor: pointer;
  transition: background 0.08s;
}
.diag-row:hover { background: #f0f0f0; }
.diag-row.row-expanded { background: #e6f4ff; }
.diag-row.row-error { background: #ffe6e6; border-left: 3px solid #c00; }
.diag-row.row-error.row-expanded { background: #ffcccc; }

.m-time { color: #888; font-variant-numeric: tabular-nums; }
.m-dir.dir-IN  { color: #0066cc; font-weight: bold; }
.m-dir.dir-OUT { color: #cc6600; font-weight: bold; }
.m-src { color: #444; font-size: 11px; }
.m-topic   { color: #000; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-payload { color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.diag-row-detail {
  background: #f8fbff; border-bottom: 1px solid #ddd;
  border-left: 3px solid #0066cc; padding: 10px 16px;
  display: flex; flex-direction: column; gap: 6px;
  font-size: 12px;
}
.dd-meta { display: flex; gap: 16px; flex-wrap: wrap; color: #555; }
.dd-topic { color: #333; }
.dd-topic code, .dd-payload pre {
  font-family: inherit; background: white; padding: 2px 6px;
  border: 1px solid #ddd; border-radius: 2px;
}
.dd-payload pre {
  display: block; max-height: 300px; overflow: auto;
  margin: 4px 0 0 0; white-space: pre-wrap; word-break: break-all;
  font-size: 11px;
}
.dd-actions { display: flex; gap: 6px; margin-top: 4px; }
.dd-btn {
  font-family: inherit; font-size: 10px; padding: 4px 10px;
  border: 1px solid #aaa; border-radius: 3px; background: white;
  cursor: pointer;
}
.dd-btn:hover { background: #eee; }

.diag-empty {
  padding: 30px 20px; text-align: center;
  color: #999; font-style: italic; font-size: 12px;
}

/* GO TO BOTTOM FLOATING */
.diag-goto-bottom {
  position: absolute; bottom: 12px; right: 16px;
  font-family: inherit; font-size: 11px; font-weight: 600;
  padding: 8px 14px; border: 1px solid #0066cc; border-radius: 18px;
  background: rgba(255, 255, 255, 0.95); color: #0066cc;
  cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.diag-goto-bottom:hover { background: #0066cc; color: white; }
</style>
