<script setup>
    import { dataStored } from '../../data.js'
    // (v3 fase B) stato MC1 dallo store della shell (stessa fonte della
    // striscia), componenti v3
    import { plant } from '../../stores/plantStatus.js'
    import { statusKey, statusTone } from '../../util/unitStatus.js'
    import UiCard from '../../components/ui/UiCard.vue'
    import UiButton from '../../components/ui/UiButton.vue'
    import UiConfirmDialog from '../../components/ui/UiConfirmDialog.vue'
    // (7/10) la doppia mossa 40/41 -> eco -> REST sta in util/palletMachine.js,
    // condivisa col Posiziona di Attrezzaggi e col pallet a bordo del robot
    import { mandaComandoPallet, scriviPosizione, messaggioEsitoMacchina } from '../../util/palletMachine.js'
</script>

<template>
  <!-- (v3 fase B) Controlli · Macchina MC1, stesso schema della pagina Robot
       (non disegnata nelle tavole). A sinistra lo stato: STATUS di MC1 (la
       stessa fonte e lo stesso nome della striscia) e attrezzatura in
       macchina. A destra i comandi: Porta / Pallet / Morsa e l'attrezzaggio.
       Porta, pallet e morsa NON hanno uno stato letto (nessun topic del PLC
       lo pubblica): due comandi, nessuna posizione accesa. La morsa manuale
       si': l'eco DECLARE/MC1 accende la posizione letta.
       Comandi, abilitazioni e conferme quelli di prima
       (tests/test_golden_equivalenza.mjs). -->
  <div class="ctl">
    <div class="ctl__col">
      <UiCard :label="$t('Stato')">
        <div class="ctl-state-title" :class="'ctl-tone--' + statusTone(plant.mc1)">
          <i class="ctl-dot" aria-hidden="true"></i><span>{{ $t(statusKey(plant.mc1)) }}</span>
        </div>
      </UiCard>

      <!-- attrezzatura sulla macchina (api fixture/showOnMC/1, poll 3 s) -->
      <UiCard :label="$t('machine.fixtureSection')">
        <template v-if="dataFixture.ID>0">
          <div class="ctl-value">{{ dataFixture.FAMILY }}</div>
          <div class="ctl-sub">
            <span v-if="(dataFixture.DESCR || '').trim().length">{{ dataFixture.DESCR }} · </span>ID {{ dataFixture.ID }}
          </div>
          <div class="ctl-sub">{{ $t('Stato') }}: {{ dataFixture.STATUS_DESC }}</div>
        </template>
        <div v-else class="ctl-value ctl-muted">{{ $t('machine.noFixture') }}</div>
      </UiCard>
    </div>

    <div class="ctl__col">
      <!-- comandi macchina su TO_PLANT/CMD/MC1: porta 30/31, pallet 20/21,
           morsa 10/11. Nessun gating, come prima. Il BLOCCO MORSA (11)
           passa SOLO dal dialog di conferma perche' la morsa si chiude. -->
      <UiCard :label="$t('machine.cmdSection')">
        <div class="ctl-row">
          <span class="ctl-row__label">{{ $t('machine.door') }}</span>
          <div class="ctl-seg">
            <button type="button" class="ctl-seg__opt" @click="sendToPLC(30)">{{ $t('machine.open') }}</button>
            <button type="button" class="ctl-seg__opt" @click="sendToPLC(31)">{{ $t('machine.close') }}</button>
          </div>
        </div>
        <div class="ctl-row">
          <span class="ctl-row__label">{{ $t('machine.pallet') }}</span>
          <div class="ctl-seg">
            <button type="button" class="ctl-seg__opt" @click="sendToPLC(20)">{{ $t('machine.unlock') }}</button>
            <button type="button" class="ctl-seg__opt" @click="sendToPLC(21)">{{ $t('machine.lock') }}</button>
          </div>
        </div>
        <div class="ctl-row">
          <span class="ctl-row__label">{{ $t('machine.vice') }}</span>
          <div class="ctl-seg">
            <button type="button" class="ctl-seg__opt" @click="sendToPLC(10)">{{ $t('machine.unlock') }}</button>
            <button type="button" class="ctl-seg__opt" @click="openViceLockDialog()">{{ $t('machine.lock') }}</button>
          </div>
        </div>
      </UiCard>

      <!-- ===== FASE B: Attrezzaggio macchina (DECLARE/MC1) =====
           Lo stato mostrato viene SOLO dagli echi PLC (niente optimistic
           update): FROM_PLANT/DECLARE/MC1 "pallet;manualVice" e' la fonte
           di verita', ripubblicata a power-on e su refresh 90. -->
      <UiCard :label="$t('machine.rigSection')">
        <div class="ctl-row">
          <span class="ctl-row__label">{{ $t('machine.declaredPallet') }}</span>
          <span class="mc-decl-value">{{ declKnown ? (declPallet > 0 ? '#' + declPallet : $t('machine.noPallet')) : '—' }}</span>
        </div>
        <!-- morsa manuale: SOLO MQTT 42/43, lo stato cambia con l'eco. Due
             posizioni: quella accesa e' l'eco; si preme l'altra (toggle
             invariato: manda 42 da OFF, 43 da ON) -->
        <div class="ctl-row">
          <span class="ctl-row__label">{{ $t('machine.manualVice') }}</span>
          <div class="ctl-seg">
            <button type="button" class="ctl-seg__opt"
              :class="{ on: declKnown && !declManualVice }"
              :disabled="rigBlockReason!='' || declWaiting || !declManualVice"
              @click="toggleManualVice()">OFF</button>
            <button type="button" class="ctl-seg__opt"
              :class="{ on: declKnown && !!declManualVice }"
              :disabled="rigBlockReason!='' || declWaiting || !!declManualVice"
              @click="toggleManualVice()">ON</button>
          </div>
        </div>

        <!-- gating D1: mai bottoni muti, il motivo e' esposto -->
        <div class="decl-hint" v-if="rigBlockReason">{{ rigBlockReason }}</div>

        <div class="decl-actions">
          <select v-model.number="palletSel" :disabled="rigBlockReason!='' || declWaiting">
            <option :value="0">-</option>
            <option v-for="p in palletsList" :key="p.ID" :value="p.ID">
              #{{ p.ID }} {{ (p.FAMILY || '').trim() }}
            </option>
          </select>
          <UiButton variant="primary"
            :disabled="rigBlockReason!='' || declWaiting || !(palletSel>0)"
            @click="declarePallet()">
            {{ $t('machine.declarePallet') }}
          </UiButton>
          <button type="button" class="ctl-outline"
            :disabled="rigBlockReason!='' || declWaiting || !(declPallet>0)"
            @click="removePallet()">
            {{ $t('machine.removePallet') }}
          </button>
        </div>
        <div class="decl-hint" v-if="declWaiting">{{ $t('machine.waitingEcho') }}</div>
      </UiCard>
    </div>

    <!-- conferma BLOCCO MORSA (11): la morsa si chiude, mani fuori -->
    <template v-if="viceLockOpen">
      <UiConfirmDialog open tone="danger"
        :title="$t('machine.viceLockConfirm')"
        :text="$t('machine.viceLockWarn')"
        :confirm-label="$t('machine.viceLockAction')"
        :cancel-label="$t('robot.dialog.cancel')"
        @confirm="confirmViceLock()"
        @cancel="closeViceLockDialog()" />
    </template>
  </div>
</template>

<script>
export default {
    data(){
        return {
          dataFixture:{},
            polling:true,
            viceLockOpen: false,   // dialog conferma BLOCCO MORSA (unico overlay della pagina)
            // ===== FASE B: attrezzaggio macchina (echi DECLARE/MC1) =====
            declKnown: false,      // primo eco ricevuto
            declPallet: 0,
            declManualVice: 0,
            palletSel: 0,
            palletsList: [],
            orders: [],
            // doppia mossa ECO-DRIVEN: publish 40/41 -> attesa eco coerente
            // -> SOLO allora REST POS_PLANT. Timeout 3s o rifiuto 947 =
            // errore, zero REST (util/palletMachine.js, dal 7/10).
            declWaiting: false,
            pollTimer: null
        }
    },
    methods: {
      sendToPLC(val) {
        dataStored.WS.socket.emit("TO_PLANT/CMD/MC1", val);
      },
      // ===== BLOCCO MORSA (11) =====
      // La pagina non ha altri overlay (gli alert passano dal popup globale
      // dataStored.alert): questo e' l'unico, l'invariante vale per costruzione.
      openViceLockDialog() {
        this.viceLockOpen = true;
      },
      closeViceLockDialog() {
        this.viceLockOpen = false;
      },
      confirmViceLock() {
        this.viceLockOpen = false;
        this.sendToPLC('11');
      },
        // ===== FASE B =====
        getRigLists() {
            fetch(dataStored.server + 'api/conf/pallet/show/all', { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(d => { this.palletsList = d || []; })
                .catch(e => { console.info(e); });
            fetch(dataStored.server + 'api/order/show/all', { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(d => { this.orders = d || []; })
                .catch(e => { console.info(e); });
        },
        // eco DECLARE/MC1 "pallet;manualVice": UNICA sorgente dello stato a
        // video. L'attesa dell'eco di un 40/41 mandato da qui la fa il modulo
        // (util/palletMachine.js), con la sua coerenza e il rifiuto 947.
        declareMc1Handler(payload) {
            const parts = String(payload).split(';');
            const pallet = parseInt(parts[0], 10);
            const mv = parseInt(parts[1], 10);
            if (!Number.isInteger(pallet)) return;
            this.declPallet = pallet;
            this.declManualVice = Number.isInteger(mv) ? mv : 0;
            this.declKnown = true;
        },
        declarePallet() {
            if (this.rigBlockReason != '' || this.declWaiting || !(this.palletSel > 0)) return;
            // (16/9) il 40 finisce dritto in DB_MC1.pallet e il PLC non lo
            // valida: da li' in poi tutto quello che dipende dal pallet segue
            // quel numero. L'ID puo' venire SOLO dall'elenco che si sta
            // guardando — ricontrollato adesso, non quando il select e' stato
            // popolato: una lista stantia (pallet cancellato, refresh perso)
            // non deve poter mandare un ID che non esiste piu'.
            const scelto = (this.palletsList || []).some(p => p.ID === this.palletSel);
            if (!scelto) {
                dataStored.alert.title = this.$t('WARNING');
                dataStored.alert.desc = 'machine.palletNotInList';
                dataStored.alert.type = 'warning';
                this.getRigLists();
                return;
            }
            this.mandaPallet('set', this.palletSel);
        },
        removePallet() {
            if (this.rigBlockReason != '' || this.declWaiting || !(this.declPallet > 0)) return;
            this.mandaPallet('clear', this.declPallet);
        },
        // 40;<pallet> o 41 su MC1, eco coerente, poi la posizione nel DB:
        // dichiara -> POS_PLANT 101 (la casa resta, la casella di provenienza
        // si libera), rimuovi -> il pallet in macchina a MAG_POS -1 /
        // POS_PLANT 0. Timeout o 947 = messaggio e NESSUNA scrittura REST.
        // Il comando parte subito (in modo sincrono): l'attesa e' dopo.
        mandaPallet(tipo, palletId) {
            this.declWaiting = true;
            mandaComandoPallet(dataStored.WS.socket, { mc: 1, tipo, palletId }).then(r => {
                this.declWaiting = false;
                if (!r.ok) {
                    dataStored.alert.title = this.$t('WARNING');
                    dataStored.alert.desc = messaggioEsitoMacchina(r, tipo);
                    dataStored.alert.type = 'warning';
                    return;
                }
                return scriviPosizione({
                    server: dataStored.server, tipo, mc: 1,
                    palletId: tipo === 'set' ? palletId : null,
                    liberaCasella: tipo === 'set',
                }).then(w => {
                    if (w.ok) return;
                    dataStored.alert.title = this.$t('WARNING');
                    dataStored.alert.desc = 'machine.restFailed';
                    dataStored.alert.type = 'warning';
                });
            });
        },
        toggleManualVice() {
            if (this.rigBlockReason != '' || this.declWaiting) return;
            // SOLO MQTT: lo stato a video cambiera' con l'eco DECLARE/MC1
            dataStored.WS.socket.emit('TO_PLANT/CMD/MC1', this.declManualVice ? '43' : '42');
        },
        getGripperData() {
            fetch(dataStored.server+'api/conf/fixture/showOnMC/1',{ method: 'GET'})
              .then(response => {
                  if (!response.ok) {
                      throw new Error('Network response was not ok');
                  }
                  return response.json()
              })
              .then(fx => {
                  if (JSON.stringify(fx)==JSON.stringify([]))
                    this.dataFixture = {}
                  else
                    this.dataFixture = fx[0];
              })
              .catch(error => {
                  console.info("-------------")
                  console.info(error);
              });
        },
    },
    computed: {
        // (D1) ordine ATTIVO (Status 3) sulla macchina 1: azioni di
        // dichiarazione bloccate col motivo esposto (mai in silenzio)
        rigBlockReason() {
            const ord = (this.orders || []).find(o => o.STATUS == 3 && o.MACHINE_ID == 1);
            if (ord) return this.$t('machine.blockedOrder', { id: ord.ID });
            return '';
        }
    },
    mounted(){
        this.getGripperData()
        this.getRigLists()
        setInterval(() => {
            if(this.polling)
                this.getGripperData()
        }, 3000);
        // FASE B: poll leggero di pallet/ordini per select e guardia D1
        this.pollTimer = setInterval(() => {
            if (this.polling)
                this.getRigLists()
        }, 3000);
        // handler nominato + snapshot (il backend replaya anche DECLARE/MC1)
        this.mc1DeclHandler = p => this.declareMc1Handler(p);
        dataStored.WS.socket.on('DECLARE/MC1', this.mc1DeclHandler);
        // (oneshot-refresh, 3/9) la dichiarazione DECLARE/MC1 e' one-shot:
        // replay dalla cache backend + refresh 90 (throttle 5 s lato
        // backend) al mount e a ogni riconnessione del socket.
        this.requestSnapshots = () => {
            dataStored.WS.socket.emit('GRIPPER/REQUEST_SNAPSHOT');
            dataStored.WS.socket.emit('PLC/REFRESH_REQUEST');
        };
        dataStored.WS.socket.on('connect', this.requestSnapshots);
        this.requestSnapshots();
    },
    unmounted(){
        this.polling=false;
        clearInterval(this.pollTimer);
        dataStored.WS.socket.off('connect', this.requestSnapshots);
        dataStored.WS.socket.off('DECLARE/MC1', this.mc1DeclHandler);
    }
  }
</script>

<style scoped>
    /* (v3 fase B) colonne, segmenti e stato da assets/css/controls-v3.css */
    .mc-decl-value {
        font-size: var(--font-size-md);
        font-weight: var(--font-weight-bold);
    }

    .decl-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        align-items: center;
        margin-top: var(--space-4);
    }

    .decl-actions select {
        flex: 1;
        min-width: 160px;
        min-height: var(--touch-target-min);
        background: var(--bg-input);
        color: var(--text-primary);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-btn);
        padding: var(--space-2) var(--space-4);
        font: inherit;
    }

    .decl-hint {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
        font-style: italic;
        margin-top: var(--space-3);
    }
</style>
