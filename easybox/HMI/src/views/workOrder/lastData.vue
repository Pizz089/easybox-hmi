<script setup>
    // MODELLO PART PROGRAM (cantiere AG fase 2): il part program NON si sceglie
    // qui — e' proprieta' del particolare (PIECE.PARTPROGRAM, numero di
    // sottoprogramma HAAS). L'ordine lo eredita come snapshot in
    // WORKORDERS.PP_ID; qui viene solo mostrato in sola lettura e, se il
    // pezzo non ce l'ha, il salvataggio e' bloccato (un ordine HAAS senza
    // ricetta non deve nascere). La tendina sulla tabella PARTPROGRAM
    // (flusso Heidenhain) e' stata rimossa.
    import { dataStored } from '../../data.js'
    import { KO_NO_FIXTURE, KO_PUSH_NO_DATA, KO_PUSH_NO_FIT, KO_PUSH_NO_ROOM } from '../../util/errorCodes.js'
    // (push-to-stop 15/9) stessa formula della vista COORDINATES_PUSH_MC
    import { pushQuotes, PUSH_STATUS } from '../../util/pushQuotes.js'
    import { useI18n } from 'vue-i18n'
    import workOrderStep from '../../components/workOrder_step.vue'

    const { t } = useI18n()
</script>

<template>
  <workOrderStep />

  <div class="last-data-page view-shell">

    <!-- ===== SETUP CARD: Quantita' + Part Program ===== -->
    <section class="setup-card">
      <h2 class="setup-title">{{ t('wizard.lastData.setupSection') }}</h2>

      <div class="form-row">
        <label for="ld-quantity" class="form-label">
          {{ t('quantity') }}<span class="required">*</span>
        </label>
        <input
          id="ld-quantity"
          type="number"
          class="form-input form-input--small"
          v-model="dataStored.createWorkOrder.quantity"
          min="1"
        />
      </div>

      <div class="form-row">
        <label class="form-label">
          {{ t('wizard.lastData.partProgram') }}<span class="required">*</span>
        </label>
        <span v-if="piecePPValid" class="pp-value">
          {{ piecePP }}
          <span class="pp-origin">{{ t('wizard.lastData.partProgramFromPiece') }}</span>
        </span>
        <span v-else class="pp-missing">
          {{ t('wizard.lastData.partProgramMissing') }}
        </span>
      </div>

      <!-- (rig-two-aspects 15/9) GEOMETRIA: l'ordine deve portare il FIXTURE_ID
           di cio' che sta sul pallet, altrimenti il PLC non sa a che quota
           depositare in macchina (errore 799, robot gia' in movimento). Qui e'
           sola lettura: lo imposta selectRig dal pallet scelto. -->
      <div class="form-row" v-if="!fixtureOk">
        <label class="form-label">
          {{ t('wizard.lastData.geometry') }}<span class="required">*</span>
        </label>
        <span class="pp-missing">{{ t('wizard.lastData.geometryMissing') }}</span>
      </div>

      <!-- (push-to-stop 15/9) spinta in battuta: attiva sul pezzo, si mostra la
           corsa che il robot fara'. L'ordine e' bloccato qui se manca un dato
           fisico, se il pezzo eccede la ganascia senza che sia stato dichiarato
           dove appoggia davvero, o se l'appoggio dichiarato e' piu' vicino di
           quanto il pezzo gia' sporge. Il messaggio porta i millimetri e
           rimanda alla pagina dove si compila il dato che manca. -->
      <div class="form-row" v-if="!pushOk">
        <label class="form-label">
          {{ t('wizard.lastData.push') }}<span class="required">*</span>
        </label>
        <span class="pp-missing">{{ t(pushMessage, { piece: pieceY/1000, claw: (viceClaw || 0)/1000 }) }}</span>
        <!-- (push-to-stop 15/9) il momento del dubbio e' questo: si apre
             la simulazione gia' sul caso reale, dove si VEDE perche' non
             ci sta. La simulazione non scrive nulla. -->
        <router-link
          class="pure-button push-why"
          :to="{ path: '/sim/push', query: {
            pieceID: dataStored.createWorkOrder.pieceID,
            gripperID: dataStored.createWorkOrder.gripperID,
            palletID: dataStored.createWorkOrder.palletID,
            machineID: dataStored.createWorkOrder.machineID } }"
        >{{ t('wizard.lastData.pushWhy') }}</router-link>
      </div>
      <div class="form-row" v-else-if="piecePush">
        <label class="form-label">{{ t('wizard.lastData.push') }}</label>
        <span class="pp-value">{{ t('wizard.lastData.pushOn', { mm: pushCheck.clearance/1000 }) }}</span>
      </div>
    </section>

    <!-- (1/9) La card POSIZIONAMENTO (8 decentramenti X/Y prelievo/deposito
         cassetto e macchina) e' stata RIMOSSA: la regolazione della presa e'
         SOLO in Z, via PIECE.Z_PICK / Z_PLACE dell'anagrafica pezzo. Le colonne
         WORKORDER.*_DECENTRATED_* restano a DB, scritte a 0 fisso dal backend. -->

    <!-- ===== SAVE ===== -->
    <div class="save-row btn-group btn-group--center">
      <button
        type="button"
        class="pure-button-primary"
        @click="saveData"
        :disabled="!piecePPValid || !fixtureOk || !pushOk || dataStored.createWorkOrder.quantity<=0"
      >
        {{ t('wizard.lastData.save') }}
      </button>
    </div>

  </div>
</template>

<script>
export default {
    data(){
        return {
            createNew:true,
            piecePP:null,  // part program ereditato dal particolare (int) o null
            // (push-to-stop 15/9) dati per la guardia della spinta in battuta:
            // il pezzo dice se il ciclo e' attivo, la morsa del pallet quanto e'
            // lunga la ganascia, la pinza quanto e' lunga la chela. Tutte
            // dimensioni fisiche da calibro, nessuna coordinata insegnata.
            // pieceY e' PIECE.Y perche' e' la misura che corre lungo la X del
            // robot, cioe' la direzione della spinta.
            piecePush:false,
            pieceY:0,
            viceClaw:null,
            viceID:null,
            gripperClaw:null,
            // appoggio dichiarato per la coppia morsa+pezzo (micron). null =
            // nessuna riga in PIECE_ON_VICE, cioe' non dichiarato: e' diverso
            // da zero, che e' una dichiarazione valida.
            pieceStop:null,
            viceFound:false
        }
    },
    computed: {
        // (rig-two-aspects 15/9) geometria del pallet presente: senza, il PLC
        // non sa eseguire l'ordine. Lo stato incompleto e' gia' filtrato da
        // selectRig; questa e' la difesa finale prima della scrittura.
        fixtureOk(){
            return Number(dataStored.createWorkOrder.fixtureID) > 0;
        },
        // (push-to-stop 15/9) esito della spinta con i dati attuali. Stessa
        // funzione della vista: qui serve solo lo stato, le quote le calcola
        // il PLC leggendo COORDINATES_PUSH_MC.
        pushCheck(){
            return pushQuotes({
                enabled: this.piecePush,
                hasVice: this.viceFound,
                xPlace: 0,
                pieceY: this.pieceY,
                viceClawLength: this.viceClaw,
                gripperClawLength: this.gripperClaw,
                stopBeyondClaw: this.pieceStop,
            });
        },
        pushOk(){
            const st = this.pushCheck.status;
            return st === PUSH_STATUS.DISABLED || st === PUSH_STATUS.OK;
        },
        pushMessage(){
            const st = this.pushCheck.status;
            if (st === PUSH_STATUS.NO_VICE)  return 'wizard.lastData.pushNoVice';
            if (st === PUSH_STATUS.NO_DATA)  return 'wizard.lastData.pushNoData';
            if (st === PUSH_STATUS.NO_FIT)   return 'wizard.lastData.pushNoFit';
            if (st === PUSH_STATUS.NO_ROOM)  return 'wizard.lastData.pushNoRoom';
            return '';
        },
        piecePPValid(){
            return Number.isInteger(this.piecePP) && this.piecePP > 0;
        }
    },
    methods: {
        // Legge il PARTPROGRAM del pezzo del wizard: e' la sola sorgente del
        // PP dell'ordine (snapshot in WORKORDER.PartProg_ID al save).
        // Ramo attrezzatura: la sorgente e' il pezzo DICHIARATO
        // (declaredPieceID); ramo morsa: il pezzo reale (pieceID).
        getPiecePP(){
            const wo = dataStored.createWorkOrder;
            const pieceID = wo.rigType == 'fixture' ? wo.declaredPieceID : wo.pieceID;
            if (pieceID == null || pieceID <= 0)
                return;
            fetch( dataStored.server+'api/conf/piece/show/'+pieceID,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    // PARTPROGRAM e' nchar a DB: trim del padding prima del parse
                    const raw = ((data[0] || {}).PARTPROGRAM || '').toString().trim();
                    const n = parseInt(raw, 10);
                    this.piecePP = (/^[1-9][0-9]{0,5}$/.test(raw) && n > 0) ? n : null;
                    this.piecePush = !!(data[0] || {}).PUSH_TO_STOP;
                    this.pieceY = Number((data[0] || {}).Y) || 0;
                    if (this.piecePush) this.getPushData();
                })
                .catch(error => {
                    console.info(error);
                    this.piecePP = null;
                });
        },
        // (push-to-stop 15/9) morsa del pallet dell'ordine e pinza scelta: i due
        // dati fisici da cui il sistema ricava le quote di spinta. Si leggono
        // solo se il pezzo ha il ciclo attivo.
        getPushData(){
            const wo = dataStored.createWorkOrder;
            const get = (url) => fetch(dataStored.server + url, { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); });
            get('api/conf/vice/show/all')
                .then(rows => {
                    const v = (rows || []).find(x => x.PALLET_ID == wo.palletID) || null;
                    this.viceFound = !!v;
                    this.viceClaw = v ? v.CLAW_LENGTH : null;
                    this.viceID = v ? v.ID : null;
                    // la dichiarazione dell'appoggio segue la MORSA, quindi si
                    // legge solo dopo aver risolto quale morsa c'e' sul pallet
                    if (v) return get('api/conf/vice/stops/' + v.ID)
                        .then(list => {
                            const row = (list || []).find(x => x.PIECE_ID == wo.pieceID) || null;
                            this.pieceStop = row ? row.STOP_BEYOND_CLAW : null;
                        });
                })
                .catch(e => { console.info(e); this.viceFound = false; this.viceClaw = null; this.viceID = null; this.pieceStop = null; });
            get('api/conf/gripper/show/all')
                .then(rows => {
                    const g = (rows || []).find(x => x.ID == wo.gripperID) || null;
                    this.gripperClaw = g ? g.CLAW_LENGTH : null;
                })
                .catch(e => { console.info(e); this.gripperClaw = null; });
        },
        saveData() {
            // guardia: senza part program dal particolare l'ordine non nasce
            // (il bottone e' gia' disabilitato, questa e' la difesa in piu')
            if (!this.piecePPValid)
                return;
            // (rig-two-aspects 15/9) stessa difesa sulla geometria: un ordine
            // senza FIXTURE_ID valido e' garantito rompersi al primo deposito
            // in macchina. Il backend lo rifiuta comunque (KO_NO_FIXTURE).
            if (!this.fixtureOk) {
                dataStored.alert.title = this.$t('WARNING');
                dataStored.alert.desc = 'wizard.lastData.geometryMissing';
                dataStored.alert.type = 'warning';
                return;
            }
            // (push-to-stop 15/9) il pezzo chiede la spinta in battuta ma i dati
            // fisici non ci sono o il pezzo non entra nella ganascia: l'ordine
            // non nasce. Il backend rifiuta comunque (KO_PUSH_*).
            if (!this.pushOk) {
                dataStored.alert.title = this.$t('WARNING');
                dataStored.alert.desc = this.pushMessage;
                dataStored.alert.type = 'warning';
                return;
            }
            var cmd = ""
            dataStored.createWorkOrder.PP                        = this.piecePP;

            if (!this.createNew){
                //eseguo aggiornamento -> update DB
                cmd = dataStored.server+'api/order/updateOrder?' + new URLSearchParams( dataStored.createWorkOrder ).toString();
            }else{
                //nuovo ordine -> insert DB
                cmd = dataStored.server+'api/order/insertOrder?' + new URLSearchParams( dataStored.createWorkOrder ).toString();
                //console.log(JSON.stringify(dataStored.createWorkOrder ,null,4))
            }
            fetch( cmd ,{ method: 'GET'})
                .then(async response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    // (http-status 15/9) l'esito applicativo viaggia nel CORPO
                    // con stato 200: va letto, altrimenti un rifiuto passa per
                    // ordine creato. Era la trappola di quasi tutte le pagine.
                    const esito = (await response.text()).trim();
                    if (esito != 'OK') {
                        dataStored.alert.title = this.$t('WARNING');
                        dataStored.alert.desc =
                            esito == KO_NO_FIXTURE   ? 'wizard.lastData.geometryMissing' :
                            esito == KO_PUSH_NO_DATA ? 'wizard.lastData.pushNoData' :
                            esito == KO_PUSH_NO_FIT  ? 'wizard.lastData.pushNoFit' :
                            esito == KO_PUSH_NO_ROOM ? 'wizard.lastData.pushNoRoom' :
                                                       'wizard.lastData.saveFailed';
                        dataStored.alert.type = 'warning';
                        return;
                    }
                    dataStored.emptingStructure()
                    this.$router.push("/production")
                })
                .catch(error => {
                    console.info(error);
                });
        }
      },
      mounted(){
        this.getPiecePP()
      }
    }
  </script>

<style scoped>
/* colonna/gap dal .view-shell globale (gap 24 -> 16, standard shell) */
.last-data-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

/* ============ Setup card ============ */
.setup-card {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.setup-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.form-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.form-label {
  flex: 0 0 200px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.required {
  color: var(--color-danger);
  margin-left: 2px;
}

.form-input,
.form-select {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 10px 16px;
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  transition: border-color var(--transition-fast);
}

.form-input--small { width: 120px; }

/* PP ereditato dal particolare: valore sola-lettura + origine */
.pp-value {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.pp-origin {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 400;
  margin-left: var(--space-2);
}

.pp-missing {
  color: var(--color-danger);
  font-size: 14px;
  font-weight: 600;
}

.form-select {
  width: 300px;
  max-width: 100%;
  appearance: none;
  -webkit-appearance: none;
  padding-right: 36px;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A4B0C2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  cursor: pointer;
}

.form-input:focus,
.form-input:focus-visible,
.form-select:focus,
.form-select:focus-visible {
  outline: none;
  border-color: var(--text-primary);
}

/* Hide native number spinners (HMI touch, no +/- arrows) */
.form-input[type="number"]::-webkit-outer-spin-button,
.form-input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.form-input[type="number"] {
  -moz-appearance: textfield;
}

/* ============ Save button ============ */
/* flex/centratura dal .btn-group--center globale */
.save-row {
  padding: var(--space-3) 0 var(--space-5);
}

/* Save: variante Primary canonica (buttons.css), CSS ad-hoc .btn-save rimosso
   (decisione audit-sistema-b). */
</style>
