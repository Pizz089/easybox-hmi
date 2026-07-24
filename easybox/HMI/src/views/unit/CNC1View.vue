<script setup>
    import { dataStored } from '../../data.js'
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
            // ===== FASE B: attrezzaggio macchina (echi DECLARE/MC1) =====
            declKnown: false,      // primo eco ricevuto
            declPallet: 0,
            declManualVice: 0,
            palletSel: 0,
            palletsList: [],
            orders: [],
            // doppia mossa ECO-DRIVEN: publish 40/41 -> attesa eco coerente
            // -> SOLO allora REST POS_PLANT. Timeout 3s = errore, zero REST.
            pendingDecl: null,     // {type:'set'|'clear', palletId}
            declTimer: null,
            declWaiting: false,
            pollTimer: null
        }
    },
    methods: {
      sendToPLC(val) {
        dataStored.WS.socket.emit("TO_PLANT/CMD/MC1", val);
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
        // video; se c'e' una doppia mossa armata e l'eco e' COERENTE, parte
        // la scrittura REST POS_PLANT (mai prima dell'eco).
        declareMc1Handler(payload) {
            const parts = String(payload).split(';');
            const pallet = parseInt(parts[0], 10);
            const mv = parseInt(parts[1], 10);
            if (!Number.isInteger(pallet)) return;
            this.declPallet = pallet;
            this.declManualVice = Number.isInteger(mv) ? mv : 0;
            this.declKnown = true;
            const p = this.pendingDecl;
            if (!p) return;
            const coherent = (p.type == 'set' && pallet == p.palletId) ||
                             (p.type == 'clear' && pallet == 0);
            if (!coherent) return;   // eco spontaneo non pertinente: resto in attesa
            clearTimeout(this.declTimer);
            this.pendingDecl = null;
            this.declWaiting = false;
            this.applyPosPlant(p.type, p.palletId);
        },
        declarePallet() {
            if (this.rigBlockReason != '' || this.declWaiting || !(this.palletSel > 0)) return;
            this.armDecl({ type: 'set', palletId: this.palletSel });
            dataStored.WS.socket.emit('TO_PLANT/CMD/MC1', '40;' + this.palletSel);
        },
        removePallet() {
            if (this.rigBlockReason != '' || this.declWaiting || !(this.declPallet > 0)) return;
            this.armDecl({ type: 'clear', palletId: this.declPallet });
            dataStored.WS.socket.emit('TO_PLANT/CMD/MC1', '41');
        },
        toggleManualVice() {
            if (this.rigBlockReason != '' || this.declWaiting) return;
            // SOLO MQTT: lo stato a video cambiera' con l'eco DECLARE/MC1
            dataStored.WS.socket.emit('TO_PLANT/CMD/MC1', this.declManualVice ? '43' : '42');
        },
        armDecl(pending) {
            this.pendingDecl = pending;
            this.declWaiting = true;
            clearTimeout(this.declTimer);
            this.declTimer = setTimeout(() => {
                // nessun eco entro 3s: errore a video, NESSUNA scrittura REST
                this.pendingDecl = null;
                this.declWaiting = false;
                dataStored.alert.title = this.$t('WARNING');
                dataStored.alert.desc = 'machine.echoTimeout';
                dataStored.alert.type = 'warning';
            }, 3000);
        },
        // REST POS_PLANT (stesso endpoint del dialog Posiziona "In macchina
        // MC1"): dichiara -> 101, rimuovi -> 0; MAG_POS=-1; pass-through
        // FRESCO (pattern AE) di tutti gli altri campi; per la dichiarazione
        // da magazzino si libera la casella di provenienza (free 4->2).
        async applyPosPlant(type, palletId) {
            try {
                const pallets = await fetch(dataStored.server + 'api/conf/pallet/show/all', { method: 'GET' })
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); });
                const id = type == 'set' ? palletId : this.findInMachine(pallets);
                const row = (pallets || []).find(p => p.ID == id);
                if (!row) return;   // niente riga fresca: nessuna scrittura cieca
                const fromSlot = row.MAG_POS > 0 ? row.MAG_POS : 0;
                // (am-casella-magpos) tabella ratificata: in macchina la
                // CASA resta (MAG_POS invariato); il rimuovi (41) porta
                // fuori magazzino (-1) come il ramo Rimuovi del dialog
                const params = new URLSearchParams({
                    ID: row.ID, FAMILY: row.FAMILY, DESCR: row.DESCR,
                    X: row.X, Y: row.Y, Z: row.Z,
                    X_CORR: row.X_CORR, Y_CORR: row.Y_CORR, Z_CORR: row.Z_CORR,
                    MAG: row.MAG,
                    MAG_POS: type == 'set' ? row.MAG_POS : -1,
                    POS_PLANT: type == 'set' ? 101 : 0
                });
                const body = await fetch(dataStored.server + 'api/conf/pallet/updatePallet?' + params.toString(), { method: 'GET' })
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.text(); });
                if (body != 'OK') throw new Error(body);
                // (am-casella-magpos) NIENTE free al set: la casa resta del
                // pallet dichiarato in macchina (casella riservata)
            } catch (e) {
                console.info(e);
                dataStored.alert.title = this.$t('WARNING');
                dataStored.alert.desc = 'machine.restFailed';
                dataStored.alert.type = 'warning';
            }
        },
        // per il RIMUOVI: il pallet da riportare a POS_PLANT=0 e' quello
        // attualmente dichiarato in MC1 (101; fascia per i legacy)
        findInMachine(pallets) {
            const exact = (pallets || []).find(p => p.POS_PLANT == 101);
            if (exact) return exact.ID;
            const inBand = (pallets || []).find(p => p.POS_PLANT > 100 && p.POS_PLANT < 1000);
            return inBand ? inBand.ID : 0;
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
        dataStored.WS.socket.emit('GRIPPER/REQUEST_SNAPSHOT');
    },
    unmounted(){
        this.polling=false;
        clearInterval(this.pollTimer);
        clearTimeout(this.declTimer);
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
</style>
