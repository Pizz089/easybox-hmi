<script setup>
    // MODELLO PART PROGRAM (cantiere AG fase 2): il part program NON si sceglie
    // qui — e' proprieta' del particolare (PIECE.PARTPROGRAM, numero di
    // sottoprogramma HAAS). L'ordine lo eredita come snapshot in
    // WORKORDERS.PP_ID; qui viene solo mostrato in sola lettura e, se il
    // pezzo non ce l'ha, il salvataggio e' bloccato (un ordine HAAS senza
    // ricetta non deve nascere). La tendina sulla tabella PARTPROGRAM
    // (flusso Heidenhain) e' stata rimossa.
    import { dataStored } from '../../data.js'
    import { KO_NO_FIXTURE } from '../../util/errorCodes.js'
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
        :disabled="!piecePPValid || !fixtureOk || dataStored.createWorkOrder.quantity<=0"
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
            piecePP:null   // part program ereditato dal particolare (int) o null
        }
    },
    computed: {
        // (rig-two-aspects 15/9) geometria del pallet presente: senza, il PLC
        // non sa eseguire l'ordine. Lo stato incompleto e' gia' filtrato da
        // selectRig; questa e' la difesa finale prima della scrittura.
        fixtureOk(){
            return Number(dataStored.createWorkOrder.fixtureID) > 0;
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
                })
                .catch(error => {
                    console.info(error);
                    this.piecePP = null;
                });
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
                        dataStored.alert.desc = esito == KO_NO_FIXTURE
                            ? 'wizard.lastData.geometryMissing'
                            : 'wizard.lastData.saveFailed';
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
