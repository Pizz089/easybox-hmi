<script setup>
    // MODELLO (cantiere AG fase 2): PRIMO step del wizard ordini. La cella
    // lavora per PALLET ATTREZZATI (modello esclusivo AB, util/rigging.js):
    // la scelta del pallet deriva palletID e il RAMO del flusso —
    //   morsa       -> selectPiece (filtri attuali) -> selectGripper -> selectMC
    //   attrezzatura-> selectPiece DICHIARATIVO (pezzo gia' sul pallet,
    //                  sorgente del part program) -> selectMC (niente pinza)
    // Pallet nudi o in anomalia si MOSTRANO ma non si selezionano (mai
    // ordini su dati sporchi). Cambiare rig azzera il ramo a valle;
    // riselezionare lo stesso rig conserva le scelte fatte.
    import { dataStored } from '../../data.js'
    import { useI18n } from 'vue-i18n'
    import workOrderStep from '../../components/workOrder_step.vue'
    import { buildRigRows, rigState } from '../../util/rigging'
    import { palletPositionLabel } from '../../util/warehouseGrid'

    const { t } = useI18n()
</script>

<template>
  <div class="view-shell">
    <workOrderStep></workOrderStep>
    <h3 class="view-title">{{ t('wizard.rig.title') }}</h3>

    <div v-if="selectableRows.length==0 && rows.length>0" class="rig-empty">
      {{ t('wizard.rig.noneSelectable') }}
    </div>

    <div class="pure-g">
      <div v-for="row in rows" :key="row.pallet.ID"
        class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-lg-1-4">

        <div class="card rig-card"
          :class="{ 'rig-card--disabled': !isSelectable(row),
                    'rig-card--current': isCurrent(row) }"
          @click="isSelectable(row) ? pick(row) : null">

          <span class="rig-name">#{{ row.pallet.ID }} {{ (row.pallet.FAMILY || '').trim() }}</span>

          <span v-if="state(row)=='bare'" class="badge badge-missing">{{ t('attrezzaggi.bare') }}</span>
          <span v-else-if="state(row)=='vice'" class="badge badge-type">{{ t('attrezzaggi.vice') }}</span>
          <span v-else-if="state(row)=='fixture'" class="badge badge-type">{{ t('attrezzaggi.fixture') }}</span>
          <span v-else class="badge badge-anomaly">{{ t('attrezzaggi.anomaly') }}</span>

          <div class="rig-meta">
            <span v-if="row.vice" class="rig-detail">
              {{ (row.vice.FAMILY || '').trim() }} {{ (row.vice.DESCR || '').trim() }}
            </span>
            <span v-else-if="row.fixtures.length==1" class="rig-detail">
              {{ fixtureName(row.fixtures[0].FIXTURE_ID) }}
            </span>
            <!-- posizione a magazzino: info, non filtrante -->
            <span class="rig-pos">{{ getPosition(row.pallet) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
    data(){
        return {
            pallets:[],
            vices:[],
            fixtures:[],
            fop:[]
        }
    },
    methods: {
        getDataTable() {
            const get = (url, cb) =>
                fetch(dataStored.server + url, { method: 'GET' })
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                    .then(cb)
                    .catch(error => { console.info("-------------"); console.info(error); });

            get('api/conf/pallet/show/all',  d => this.pallets  = d || []);
            get('api/conf/vice/show/all',    d => this.vices    = d || []);
            get('api/conf/fixture/show/all', d => this.fixtures = d || []);
            get('api/conf/fixture/showFixtureOnPallet/all', d => this.fop = d || []);
        },
        state(row){
            return rigState(row);
        },
        isSelectable(row){
            const s = rigState(row);
            return s == 'vice' || s == 'fixture';
        },
        isCurrent(row){
            const wo = dataStored.createWorkOrder;
            return wo.palletID == row.pallet.ID && wo.rigType == rigState(row);
        },
        getPosition(pal){
            return palletPositionLabel(pal, this.$t);
        },
        fixtureName(fixtureID){
            const f = this.fixtures.find(x => x.ID == fixtureID);
            return f ? ((f.FAMILY || '').trim()+' '+(f.DESCR || '').trim()) : ('#'+fixtureID);
        },
        pick(row){
            const s = rigState(row);
            if (s != 'vice' && s != 'fixture') return;
            const wo = dataStored.createWorkOrder;
            // stesso rig -> conserva il ramo e le scelte a valle;
            // rig DIVERSO -> azzera tutto e reimposta (il ramo cambia semantica)
            if (!this.isCurrent(row)) {
                dataStored.emptingStructure();
                wo.palletID = row.pallet.ID;
                wo.rigType = s;
                if (s == 'fixture') {
                    // convenzioni PLC ramo attrezzatura: niente missione di
                    // carico (pieceID 0), niente pinza; fixtureID solo uso HMI
                    wo.pieceID = 0;
                    wo.gripperID = 0;
                    wo.fixtureID = row.fixtures[0].FIXTURE_ID;
                }
            }
            this.$router.push('/selectPiece');
        }
    },
    computed:{
        rows(){
            return buildRigRows(this.pallets, this.vices, this.fop);
        },
        selectableRows(){
            return this.rows.filter(r => this.isSelectable(r));
        }
    },
    mounted(){
        // primo ingresso nel wizard (rigType vuoto = ciclo nuovo): riparto
        // da struttura pulita. Ritorno indietro dallo stepper (rigType
        // valorizzato): conservo le scelte, azzera solo un CAMBIO di rig.
        if (dataStored.createWorkOrder.rigType == '')
            dataStored.emptingStructure();
        this.getDataTable();
    }
}
</script>

<style scoped>
/* Badge: stessa grammatica di AttrezzaggiView (bg semantico + testo pieno) */
.badge {
    display: inline-block;
    padding: var(--space-1) var(--space-3); /* micro-aggiustamento ottico badge, come AttrezzaggiView */
    border-radius: var(--radius-lg);
    font-size: var(--font-size-sm);
    white-space: nowrap;
}

.badge-missing {
    background-color: var(--color-warning-bg);
    color: var(--color-warning);
}

.badge-type {
    background-color: var(--color-info-bg);
    color: var(--color-info);
}

.badge-anomaly {
    background-color: var(--color-danger-bg);
    color: var(--color-danger);
    font-weight: var(--font-weight-semibold);
}

/* eredita dal .card globale (App.vue, wizard UI-5.5b) flex column centrata,
   min-height 240 e padding: qui solo il ritmo verticale interno */
.rig-card {
    gap: var(--space-2);
}

.rig-name {
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
}

.rig-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.rig-detail {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
}

.rig-pos {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
}

/* nudo/anomalia: visibile ma non azionabile (mai ordini su dati sporchi) */
.rig-card--disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

/* rig attualmente selezionato (ritorno indietro dallo stepper) */
.rig-card--current {
    border: 2px solid var(--accent);
}

.rig-empty {
    background: var(--color-warning-bg);
    color: var(--color-warning);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    font-size: var(--font-size-base);
}
</style>
