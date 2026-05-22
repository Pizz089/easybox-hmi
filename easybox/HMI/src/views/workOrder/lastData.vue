<script setup>
    import { dataStored } from '../../data.js'
    import { useI18n } from 'vue-i18n'
    import workOrderStep from '../../components/workOrder_step.vue'

    const { t } = useI18n()
</script>

<template>
  <workOrderStep />

  <div class="last-data-page">

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
        <label for="ld-pp" class="form-label">
          {{ t('wizard.lastData.partProgram') }}<span class="required">*</span>
        </label>
        <select
          id="ld-pp"
          class="form-select"
          v-model="PPindex"
          :readonly="dataStored.userLevel<0"
        >
          <option value="0">{{ t('wizard.lastData.partProgramPlaceholder') }}</option>
          <option v-for="(pp, index) in PPList" :key="pp.ID" :value="index+1">
            {{ pp.NAME.trim() }}
          </option>
        </select>
      </div>
    </section>

    <!-- ===== POSITIONING CARD: 2-col Cassetto vs Macchina ===== -->
    <section class="positioning-card">
      <header class="positioning-header">
        <h2 class="positioning-title">{{ t('wizard.lastData.positioningSection') }}</h2>
        <span class="positioning-unit">{{ t('wizard.lastData.positioningUnit') }}</span>
      </header>

      <div class="positioning-cols">

        <!-- LEFT: CASSETTO -->
        <div class="positioning-col">
          <h3 class="col-title">{{ t('wizard.lastData.trayColumn') }}</h3>

          <div class="sub-section">
            <h4 class="sub-title">
              <svg class="sub-icon" width="16" height="16" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
              {{ t('wizard.lastData.pickup') }}
            </h4>
            <div class="xy-row">
              <div class="xy-pair">
                <label class="xy-label">X</label>
                <input type="number" class="form-input form-input--xs"
                       v-model="dataStored.createWorkOrder.decentrated_tray_x_pick" />
                <span class="input-unit">0.01 mm</span>
              </div>
              <div class="xy-pair">
                <label class="xy-label">Y</label>
                <input type="number" class="form-input form-input--xs"
                       v-model="dataStored.createWorkOrder.decentrated_tray_y_pick" />
                <span class="input-unit">0.01 mm</span>
              </div>
            </div>
          </div>

          <div class="sub-section">
            <h4 class="sub-title">
              <svg class="sub-icon" width="16" height="16" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 5v14M19 12l-7 7-7-7"/>
              </svg>
              {{ t('wizard.lastData.deposit') }}
            </h4>
            <div class="xy-row">
              <div class="xy-pair">
                <label class="xy-label">X</label>
                <input type="number" class="form-input form-input--xs"
                       v-model="dataStored.createWorkOrder.decentrated_MC_x_place" />
                <span class="input-unit">0.01 mm</span>
              </div>
              <div class="xy-pair">
                <label class="xy-label">Y</label>
                <input type="number" class="form-input form-input--xs"
                       v-model="dataStored.createWorkOrder.decentrated_MC_y_place" />
                <span class="input-unit">0.01 mm</span>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: MACCHINA -->
        <div class="positioning-col">
          <h3 class="col-title">{{ t('wizard.lastData.machineColumn') }}</h3>

          <div class="sub-section">
            <h4 class="sub-title">
              <svg class="sub-icon" width="16" height="16" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
              {{ t('wizard.lastData.pickup') }}
            </h4>
            <div class="xy-row">
              <div class="xy-pair">
                <label class="xy-label">X</label>
                <input type="number" class="form-input form-input--xs"
                       v-model="dataStored.createWorkOrder.decentrated_MC_x_pick" />
                <span class="input-unit">0.01 mm</span>
              </div>
              <div class="xy-pair">
                <label class="xy-label">Y</label>
                <input type="number" class="form-input form-input--xs"
                       v-model="dataStored.createWorkOrder.decentrated_MC_y_pick" />
                <span class="input-unit">0.01 mm</span>
              </div>
            </div>
          </div>

          <div class="sub-section">
            <h4 class="sub-title">
              <svg class="sub-icon" width="16" height="16" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 5v14M19 12l-7 7-7-7"/>
              </svg>
              {{ t('wizard.lastData.deposit') }}
            </h4>
            <div class="xy-row">
              <div class="xy-pair">
                <label class="xy-label">X</label>
                <input type="number" class="form-input form-input--xs"
                       v-model="dataStored.createWorkOrder.decentrated_tray_x_place" />
                <span class="input-unit">0.01 mm</span>
              </div>
              <div class="xy-pair">
                <label class="xy-label">Y</label>
                <input type="number" class="form-input form-input--xs"
                       v-model="dataStored.createWorkOrder.decentrated_tray_y_place" />
                <span class="input-unit">0.01 mm</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- ===== SAVE ===== -->
    <div class="save-row">
      <button
        type="button"
        class="btn-save"
        @click="saveData"
        :disabled="PPindex<=0 || dataStored.createWorkOrder.quantity<=0"
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
            PPList:{},
            PPindex:0
        }
    },
    methods: {
        getPPList(){
            fetch( dataStored.server+'api/pp/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.PPList=data;
                    console.log(JSON.stringify(data,null,4))
                })
                .catch(error => {
                    console.info(error);
                });
        },
        saveData() {
            var cmd = ""
            dataStored.createWorkOrder.decentrated_tray_x_pick  *= 100;
            dataStored.createWorkOrder.decentrated_tray_y_pick  *= 100;
            dataStored.createWorkOrder.decentrated_tray_x_place *= 100;
            dataStored.createWorkOrder.decentrated_tray_y_place *= 100;
            dataStored.createWorkOrder.decentrated_MC_x_pick    *= 100;
            dataStored.createWorkOrder.decentrated_MC_y_pick    *= 100;
            dataStored.createWorkOrder.decentrated_MC_x_place   *= 100;
            dataStored.createWorkOrder.decentrated_MC_y_place   *= 100;
            dataStored.createWorkOrder.PP                        = this.PPindex;

            if (!this.createNew){
                //eseguo aggiornamento -> update DB
                cmd = dataStored.server+'api/order/updateOrder?' + new URLSearchParams( dataStored.createWorkOrder ).toString();
            }else{
                //nuovo ordine -> insert DB
                cmd = dataStored.server+'api/order/insertOrder?' + new URLSearchParams( dataStored.createWorkOrder ).toString();
                //console.log(JSON.stringify(dataStored.createWorkOrder ,null,4))
            }
            fetch( cmd ,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
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
        this.getPPList()
      }
    }
  </script>

<style scoped>
.last-data-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
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
.form-input--xs    { width: 80px; text-align: center; }

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

/* ============ Positioning card ============ */
.positioning-card {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.positioning-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.positioning-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-primary);
}

.positioning-unit {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
}

.positioning-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
}

.positioning-col {
  background: var(--bg-base);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.col-title {
  margin: 0 0 var(--space-3);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-primary);
}

.sub-section {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sub-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.sub-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.xy-row {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.xy-pair {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.xy-label {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 14px;
  width: 16px;
}

.input-unit {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 2px;
  white-space: nowrap;
}

/* ============ Save button ============ */
.save-row {
  display: flex;
  justify-content: center;
  padding: var(--space-3) 0 var(--space-5);
}

.btn-save {
  background: var(--text-primary);
  color: var(--bg-base);
  border: 0;
  border-radius: var(--radius-md);
  padding: 14px 48px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: filter var(--transition-fast), opacity var(--transition-fast);
}

.btn-save:hover:not(:disabled),
.btn-save:focus-visible:not(:disabled) {
  filter: brightness(0.92);
  outline: none;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
