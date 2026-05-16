<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { dataStored } from '@/data'

// Scaffold 2a — solo bootstrap connessione e raccolta messaggi.
// Tabella completa con filtri/controlli/stats arriva nel sub-step 2b.

const MAX_VISIBLE = 500;     // cap rigido lato client (FIFO)

const messages   = ref([])
const received   = ref(0)
const connected  = ref(false)

function appendBatch(batch) {
  if (!Array.isArray(batch) || batch.length === 0) return;
  received.value += batch.length;
  for (const m of batch) messages.value.push(m);
  if (messages.value.length > MAX_VISIBLE) {
    messages.value.splice(0, messages.value.length - MAX_VISIBLE);
  }
}

onMounted(() => {
  // `io` è esposto globalmente da public/socket.io.min.js (vedi index.html).
  const socket = io(dataStored.WS.brokerURL + '/diag');
  dataStored.WS.diagSocket = socket;

  socket.on('connect',    () => { connected.value = true;  });
  socket.on('disconnect', () => { connected.value = false; });
  socket.on('mqtt-bulk',  appendBatch);    // snapshot iniziale (ultimi ~200 msg dal buffer)
  socket.on('mqtt-batch', appendBatch);    // stream live (ogni 100ms quando ci sono messaggi)
});

onUnmounted(() => {
  // Chiudo la connessione /diag quando lascio la vista per non sprecare banda.
  if (dataStored.WS.diagSocket) {
    try { dataStored.WS.diagSocket.disconnect(); } catch (_) {}
    dataStored.WS.diagSocket = null;
  }
});

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('it-IT', { hour12: false })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}
</script>

<template>
  <div class="diag-mqtt">
    <div class="diag-header">
      <h2>Diagnostica MQTT — Live</h2>
      <div class="diag-status">
        <span :class="connected ? 'st-on' : 'st-off'">●</span>
        <span>{{ connected ? 'connesso al namespace /diag' : 'disconnesso' }}</span>
        <span class="diag-counter">
          {{ received }} msg totali · in memoria {{ messages.length }}/{{ MAX_VISIBLE }}
        </span>
      </div>
    </div>

    <div class="diag-list">
      <div v-if="messages.length === 0" class="diag-empty">
        Nessun messaggio ricevuto.
        {{ connected ? 'In attesa di traffico MQTT...' : 'Connessione al namespace /diag in corso...' }}
      </div>
      <div v-else>
        <div class="diag-row diag-row-head">
          <span>orario</span><span>dir</span><span>source</span><span>topic</span><span>payload</span>
        </div>
        <div v-for="(m, i) in messages.slice(-20)" :key="i" class="diag-row">
          <span class="m-time">{{ fmtTime(m.ts) }}</span>
          <span class="m-dir" :class="'dir-' + m.dir">{{ m.dir }}</span>
          <span class="m-src">{{ m.source }}</span>
          <span class="m-topic" :title="m.topic">{{ m.topic }}</span>
          <span class="m-payload" :title="m.payload">{{ m.payload }}</span>
        </div>
        <div class="diag-footnote">
          Scaffold 2a — mostrati solo ultimi 20 messaggi raw, niente filtri/auto-scroll/export.
          Tabella completa con filtri arriva nel sub-step 2b.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diag-mqtt { padding: 16px; font-family: 'DM Mono', monospace, system-ui, sans-serif; }
.diag-header { margin-bottom: 16px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
.diag-header h2 { margin: 0 0 6px 0; font-size: 18px; }
.diag-status { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #555; }
.st-on { color: #00aa44; font-size: 16px; }
.st-off { color: #c00; font-size: 16px; }
.diag-counter { margin-left: auto; color: #888; }
.diag-list { background: #fafafa; border: 1px solid #ddd; border-radius: 4px; max-height: 60vh; overflow-y: auto; }
.diag-empty { padding: 20px; text-align: center; color: #999; font-style: italic; }
.diag-row { display: grid; grid-template-columns: 120px 40px 80px 1fr 1fr; gap: 8px; padding: 4px 8px; font-size: 12px; border-bottom: 1px solid #eee; }
.diag-row-head { background: #efefef; font-weight: 600; color: #444; text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em; position: sticky; top: 0; }
.m-time { color: #888; }
.m-dir.dir-IN { color: #0066cc; font-weight: bold; }
.m-dir.dir-OUT { color: #cc6600; font-weight: bold; }
.m-src { color: #444; }
.m-topic { color: #000; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-payload { color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.diag-footnote { padding: 8px 12px; color: #999; font-style: italic; font-size: 11px; background: #f5f5f5; }
</style>
