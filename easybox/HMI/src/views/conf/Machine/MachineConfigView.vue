<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { dataStored } from '@/data'
import {
  MACHINE_POSITIONS, BRAND_CATALOG, isValidBrandId, brandName,
} from '@/util/machineBrands'

const { t } = useI18n()

// ============================================================================
// STATO PER POSIZIONE MACCHINA
// ============================================================================
// Chiave = pos.mc ('MC1', ...). known=false finche' non arriva il primo
// payload '<MC>/BRAND' dal backend (snapshot richiesto al mount/reconnect,
// poi eventi live rilanciati da FROM_PLANT/BRAND/<MC>). Niente polling.
const machines = reactive({})
for (const pos of MACHINE_POSITIONS) {
  machines[pos.mc] = {
    known: false,
    req: 0,             // brandID_req  (richiesto, scritto dalla HMI)
    act: 0,             // brandID_act  (attivo, latchato dal PLC a macchina ferma)
    lastError: 0,       // DB_MachineConfig.lastError (0 = config OK)
    lastErrorBrand: 0,  // brand a cui si riferisce lastError
    selected: '',       // valore della select (stringa, v-model)
    touched: false,     // true se l'utente ha toccato la select (no auto-prefill)
    confirming: false,  // conferma inline aperta
  }
}

const m = (pos) => machines[pos.mc]

// Livello tecnico/amministratore per inviare il cambio marca
// (stesso gate delle azioni di config, vedi VicesView userLevel).
const canEdit = computed(() => Number(dataStored.userLevel) >= 2)

// ============================================================================
// HELPERS PRESENTAZIONE
// ============================================================================
function brandLabel(id) {
  if (!isValidBrandId(id)) return '—'
  const name = brandName(id)
  return id + ' — ' + (name || t('machine.unknown'))
}

function isPending(pos) {
  const st = m(pos)
  return st.known && isValidBrandId(st.req) && st.req !== st.act
}

function selId(pos) {
  return parseInt(m(pos).selected, 10)
}

// Invio possibile: livello utente, socket su, selezione valida e diversa
// dal brand gia' richiesto (rimandare lo stesso req non ha effetto).
function canSend(pos) {
  const st = m(pos)
  const id = selId(pos)
  return canEdit.value && dataStored.WS.connected && st.known
    && isValidBrandId(id) && id !== st.req
}

// ============================================================================
// SOCKET: ricezione stato brand + invio richiesta
// ============================================================================
function onBrandPayload(mc, payload) {
  let obj
  try {
    obj = JSON.parse(payload)
  } catch (error) {
    console.info('BRAND: payload non valido per ' + mc, error)
    return
  }
  const st = machines[mc]
  if (!st) return
  st.req = parseInt(obj.req, 10) || 0
  st.act = parseInt(obj.act, 10) || 0
  st.lastError = parseInt(obj.lastError, 10) || 0
  st.lastErrorBrand = parseInt(obj.lastErrorBrand, 10) || 0
  st.known = true
  clearPlcSilent()
  // Prefill select con il brand richiesto (o attivo) finche' l'utente
  // non fa una scelta sua.
  if (!st.touched) {
    const pre = isValidBrandId(st.req) ? st.req : (isValidBrandId(st.act) ? st.act : 0)
    st.selected = pre ? String(pre) : ''
  }
}

// ============================================================================
// PLC MUTO: "non ancora" vs "nessuna risposta"
// ============================================================================
// Su cache vuota il backend risponde SNAPSHOT/MISS e chiede al PLC il refresh
// 90. Se entro PLC_SILENT_MS nessun payload '<MC>/BRAND' arriva, il PLC non
// ha risposto: la view lo dice e offre Riprova (nuovo refresh 90 via backend).
const PLC_SILENT_MS = 8000
const plcSilent = ref(false)
let plcSilentTimer = null

function armPlcSilentTimer() {
  clearTimeout(plcSilentTimer)
  plcSilentTimer = setTimeout(() => {
    plcSilentTimer = null
    const stillUnknown = MACHINE_POSITIONS.some(pos => !machines[pos.mc].known)
    if (stillUnknown) plcSilent.value = true
  }, PLC_SILENT_MS)
}

function clearPlcSilent() {
  clearTimeout(plcSilentTimer)
  plcSilentTimer = null
  plcSilent.value = false
}

function onSnapshotMiss(payload) {
  let obj
  try {
    obj = JSON.parse(payload)
  } catch (error) {
    console.info('SNAPSHOT/MISS: payload non valido', error)
    return
  }
  if (obj.channel !== 'BRAND') return
  armPlcSilentTimer()
}

function retryPlcRefresh() {
  plcSilent.value = false
  dataStored.WS.socket.emit('PLC/REFRESH_REQUEST')
  armPlcSilentTimer()
}

function askConfirm(pos) {
  if (!canSend(pos)) return
  m(pos).confirming = true
}

function sendBrand(pos) {
  const st = m(pos)
  const id = selId(pos)
  st.confirming = false
  // Ri-validazione difensiva al momento dell'invio (range 1..16).
  if (!canSend(pos) || !isValidBrandId(id)) return
  dataStored.WS.socket.emit('TO_PLANT/CMD/BRAND' + pos.mc, id)
}

// Snapshot on-demand dalla cache backend (stesso spirito del
// 'request-snapshot' del diag MQTT): al mount e ad ogni reconnect.
function requestSnapshot() {
  dataStored.WS.socket.emit('BRAND/REQUEST_SNAPSHOT')
}

const socketHandlers = {}

onMounted(() => {
  const socket = dataStored.WS.socket
  if (!socket) return
  for (const pos of MACHINE_POSITIONS) {
    const ev = pos.mc + '/BRAND'
    socketHandlers[ev] = (payload) => onBrandPayload(pos.mc, payload)
    socket.on(ev, socketHandlers[ev])
  }
  socketHandlers['connect'] = requestSnapshot
  socket.on('connect', requestSnapshot)
  socketHandlers['SNAPSHOT/MISS'] = onSnapshotMiss
  socket.on('SNAPSHOT/MISS', onSnapshotMiss)
  if (dataStored.WS.connected) requestSnapshot()
})

onBeforeUnmount(() => {
  clearTimeout(plcSilentTimer)
  plcSilentTimer = null
  const socket = dataStored.WS.socket
  if (!socket) return
  for (const [ev, handler] of Object.entries(socketHandlers)) {
    socket.off(ev, handler)
  }
})
</script>

<template>
  <div class="view-shell">
    <h1 class="view-title">{{ $t('machine.welcome') }}</h1>

    <div v-for="pos in MACHINE_POSITIONS" :key="pos.mc" class="command-section machine-card">
      <h3 class="command-section-title">
        {{ $t(pos.labelKey) }} &mdash; {{ $t('machine.brandSection') }}
      </h3>

      <!-- Allarme config brand invalida (lastError != 0, settato al boot PLC) -->
      <div v-if="m(pos).known && m(pos).lastError !== 0" class="banner banner-alarm">
        <strong>{{ $t('machine.configError') }}</strong>
        <span>
          {{ $t('machine.configErrorDetail', {
            err: m(pos).lastError,
            brand: brandLabel(m(pos).lastErrorBrand),
          }) }}
        </span>
      </div>

      <!-- Cambio in attesa: req != act, il PLC latcha solo a macchina ferma.
           Informativo, non blocca nuove richieste. -->
      <div v-if="isPending(pos)" class="banner banner-pending">
        {{ $t('machine.pending') }}
      </div>

      <div v-if="!m(pos).known && !plcSilent" class="waiting">
        {{ $t('machine.waiting') }}
      </div>

      <!-- PLC muto: SNAPSHOT/MISS ricevuto e nessun payload BRAND entro il
           timeout. Riprova = nuovo refresh 90 tramite backend. -->
      <div v-else-if="!m(pos).known" class="banner banner-pending plc-silent">
        <span>{{ $t('machine.plcSilent') }}</span>
        <button class="btn-ghost" @click="retryPlcRefresh">
          {{ $t('common.retry') }}
        </button>
      </div>

      <template v-else>
        <div class="brand-row">
          <span class="brand-label">{{ $t('machine.activeBrand') }}</span>
          <span class="brand-value">{{ brandLabel(m(pos).act) }}</span>
        </div>
        <div class="brand-row">
          <span class="brand-label">{{ $t('machine.requestedBrand') }}</span>
          <span class="brand-value" :class="{ pending: isPending(pos) }">
            {{ brandLabel(m(pos).req) }}
          </span>
        </div>

        <div class="brand-row">
          <label class="brand-label" :for="'brand-select-' + pos.mc">
            {{ $t('machine.selectBrand') }}
          </label>
          <select
            :id="'brand-select-' + pos.mc"
            v-model="m(pos).selected"
            class="brand-select"
            :disabled="!canEdit"
            @change="m(pos).touched = true"
          >
            <option v-for="b in BRAND_CATALOG" :key="b.id" :value="String(b.id)">
              {{ b.id }} &mdash; {{ b.name }}
            </option>
          </select>
          <button
            class="pure-button pure-button-primary"
            :class="{ 'pure-button-disabled': !canSend(pos) }"
            :disabled="!canSend(pos)"
            @click="askConfirm(pos)"
          >
            {{ $t('machine.apply') }}
          </button>
        </div>

        <!-- Conferma inline: il cambio marca riconfigura gli I/O macchina -->
        <div v-if="m(pos).confirming" class="confirm-box">
          <h3>{{ $t('machine.confirmTitle') }}</h3>
          <h4>
            {{ $t('machine.confirmText', {
              from: brandLabel(m(pos).act),
              to: brandLabel(selId(pos)),
            }) }}
          </h4>
          <span class="btn-group">
            <button class="pure-button-micromission specialCMD" @click="sendBrand(pos)">
              {{ $t('machine.apply') }}
            </button>
            <button class="btn-ghost" @click="m(pos).confirming = false">
              {{ $t('machine.cancel') }}
            </button>
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.machine-card {
  max-width: 720px;
  /* il gap verticale lo da' il .view-shell (doc §4.3: parent flex con gap
     -> via il margin-top ereditato da .command-section) */
  margin-top: 0;
}

.banner {
  border-radius: var(--radius-md);
  padding: var(--space-4);
  font-size: var(--font-size-base);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Status semantici: --color-danger/--color-warning (status), NON i token
   azione (--color-critical/--color-warning-button). Glow come .status-card.alarm:
   l'allarme deve gridare da lontano. */
.banner-alarm {
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger);
  box-shadow: 0 0 8px var(--color-danger);
}

.banner-pending {
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
}

.waiting {
  color: var(--text-muted);
  font-size: var(--font-size-base);
  padding: var(--space-2) 0;
}

.plc-silent {
  align-items: flex-start;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.brand-label {
  min-width: 10em;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.brand-value {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.brand-value.pending {
  color: var(--color-warning);
}

.brand-select {
  background: var(--bg-input);
  color: var(--text-primary);
  /* border-strong sugli input (audit WCAG: default su bg-input 2.88 -> 4.31) */
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-4);
  min-height: 44px; /* touch target minimo */
  font-size: var(--font-size-base);
}

.brand-select:disabled {
  color: var(--text-secondary);
  opacity: 0.7;
  cursor: not-allowed;
}

.confirm-box {
  border: 1px solid var(--color-critical);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-top: var(--space-2);
}

.confirm-box h3 {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-md);
  color: var(--text-primary);
}

.confirm-box h4 {
  margin: 0 0 var(--space-4);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  color: var(--text-secondary);
}

</style>
