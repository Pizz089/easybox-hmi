<script setup>
    import { dataStored } from '../../data.js'
    // (7/10) la doppia mossa 40/41 -> eco -> REST sta in util/palletMachine.js,
    // condivisa col Posiziona di Attrezzaggi e col pallet a bordo del robot
    import { mandaComandoPallet, scriviPosizione, messaggioEsitoMacchina } from '../../util/palletMachine.js'
</script>

<template>
  <div class="pure-u-1 unit-columns">
    <div class="pure-u-10-24">
      <h1 class="view-title">{{$t('Stato')}} {{ $t('MC1') }}</h1>
      <div class="status-card pure-u-1">
          <h5 v-if="dataFixture.ID>0"> {{$t('Fixture')}} ID: {{ dataFixture.ID }} </h5>
          <h5 v-if="dataFixture.ID>0"> 
            {{ dataFixture.FAMILY }} 
            {{ (dataFixture.DESCR.trim().length)? ' - '+dataFixture.DESCR:'' }}  
          </h5>
          <h5 v-if="dataFixture.ID>0"> Status: {{ dataFixture.STATUS_DESC }}</h5>
          <h5 v-if="!dataFixture.ID>0"> NO FIXTURE MOUNTED! </h5>
      </div>

    </div>
    <div class="pure-u-10-24">
      <h1 class="view-title"> {{$t('Comandi')}} </h1>
      
      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"
                @click="sendToPLC(30)">
                {{ $t('APRI_PORTA')}}
        </button>
      </div>
      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"
              @click="sendToPLC(31)">
              {{ $t('CHIUDI_PORTA')}}
        </button>
      </div>  
      
      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"
                @click="sendToPLC(20)">
                SBLOCCO PALLET
        </button>
      </div>
      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"
              @click="sendToPLC(21)">
              BLOCCO PALLET
        </button>
      </div> 

      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"
                @click="sendToPLC(10)">
                SBLOCCO MORSA
        </button>
      </div>
      <!-- BLOCCO MORSA (11): gemello dello sblocco, stesso invio e stesso
           (non-)gating dei comandi macchina della pagina; passa SOLO dal
           dialog di conferma perche' la morsa si chiude. Nessun fallback ne'
           timeout: il pannello manda e basta, come gli altri comandi. -->
      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"
                @click="openViceLockDialog()">
                {{ $t('machine.viceLock') }}
        </button>
      </div>

      <div v-if="viceLockOpen" class="mission-dialog-overlay">
        <div class="mission-dialog">
          <h3 class="command-section-title">{{ $t('machine.viceLockConfirm') }}</h3>
          <div class="vice-lock-warn">{{ $t('machine.viceLockWarn') }}</div>
          <div class="pure-g">
            <div class="pure-u-1-2">
              <button style="width:100%" class="button_pressed pure-button-mission" @click="confirmViceLock()">
                {{ $t('robot.dialog.confirm') }}
              </button>
            </div>
            <div class="pure-u-1-2">
              <button style="width:100%" class="btn-ghost" @click="closeViceLockDialog()">
                {{ $t('robot.dialog.cancel') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== FASE B: Attrezzaggio macchina (DECLARE/MC1) =====
           Lo stato mostrato viene SOLO dagli echi PLC (niente optimistic
           update): FROM_PLANT/DECLARE/MC1 "pallet;manualVice" e' la fonte
           di verita', ripubblicata a power-on e su refresh 90. -->
      <section class="command-section decl-section">
        <h3 class="section-label">{{ $t('machine.rigSection') }}</h3>

        <div class="decl-row">
          <span class="decl-label">{{ $t('machine.declaredPallet') }}</span>
          <span class="decl-value">{{ declKnown ? (declPallet > 0 ? '#' + declPallet : $t('machine.noPallet')) : '—' }}</span>
        </div>
        <div class="decl-row">
          <span class="decl-label">{{ $t('machine.manualVice') }}</span>
          <span class="decl-value">{{ declKnown ? (declManualVice ? 'ON' : 'OFF') : '—' }}</span>
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
          <button class="pure-button pure-button-primary"
            :disabled="rigBlockReason!='' || declWaiting || !(palletSel>0)"
            @click="declarePallet()">
            {{ $t('machine.declarePallet') }}
          </button>
          <button class="btn-ghost"
            :disabled="rigBlockReason!='' || declWaiting || !(declPallet>0)"
            @click="removePallet()">
            {{ $t('machine.removePallet') }}
          </button>
          <!-- morsa manuale: SOLO MQTT 42/43, lo stato cambia con l'eco -->
          <button class="btn-ghost"
            :disabled="rigBlockReason!='' || declWaiting"
            @click="toggleManualVice()">
            {{ $t('machine.manualVice') }}: {{ declManualVice ? 'OFF' : 'ON' }}
          </button>
        </div>
        <div class="decl-hint" v-if="declWaiting">{{ $t('machine.waitingEcho') }}</div>
      </section>

    </div>
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
    /* FASE B: sezione attrezzaggio macchina (pattern command-section) */
    .decl-section {
        margin-top: var(--space-4);
    }

    .decl-row {
        display: flex;
        gap: var(--space-4);
        align-items: center;
        padding: 2px 0;
    }

    .decl-label {
        min-width: 10em;
        font-size: var(--font-size-sm);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
    }

    .decl-value {
        font-weight: var(--font-weight-semibold);
    }

    .decl-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        align-items: center;
        margin-top: var(--space-2);
    }

    .decl-actions select {
        min-height: 44px;
        background: var(--bg-input);
        color: var(--text-primary);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        padding: var(--space-2) var(--space-4);
    }

    .decl-hint {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
        font-style: italic;
        margin-top: var(--space-1);
    }

    /* dialog conferma BLOCCO MORSA: stesso overlay delle view missione */
    .mission-dialog-overlay {
        position: fixed;
        inset: 0;
        background: var(--bg-backdrop);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .mission-dialog {
        background: var(--bg-surface);
        border: var(--border-card);
        border-radius: var(--radius-md);
        box-shadow: var(--elevation-3);
        padding: var(--space-4);
        width: min(520px, 92vw);
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    /* avviso di sicurezza: la morsa si chiude (status warning, non muted) */
    .vice-lock-warn {
        background: var(--color-warning-bg);
        color: var(--color-warning);
        border: 1px solid var(--color-warning);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
    }
</style>
