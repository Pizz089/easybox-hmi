<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../../data.js'
    import { palletPositionLabel } from '../../../util/warehouseGrid.js'

    import { ref, onMounted } from 'vue'
    const el = ref()
</script>

<template>   
      <div class="view-shell conf-card">
        <h2 v-if="!createNew" class="view-title">{{ $t('pallet.data')}} : {{ pallet.ID }}</h2>
        <h2 v-if="createNew" class="view-title"> {{ $t('pallet.createNew')}} </h2>

        <div class="pure-form pure-form-aligned" >
            <fieldset>
                <input type="hidden" name="ID" v-model="pallet.ID" />

                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.family')}}</label>
                    <input type="text" id="aligned-foo" name="FAMIGLIA" v-model="pallet.FAMILY" placeholder="" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.descr')}}</label>
                    <input type="text" id="aligned-foo" name="DESCR" v-model="pallet.DESCR" placeholder="" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.lunghezza')}}</label>
                    <input type="number" id="aligned-foo" name="LUNGHEZZA" v-model="pallet.Y" placeholder="0" :readonly="dataStored.userLevel==0" /> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.larghezza')}}</label>
                    <input type="number" id="aligned-foo" name="LARGHEZZA" v-model="pallet.X" placeholder="0" :readonly="dataStored.userLevel==0" /> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.altezza')}}</label>
                    <input type="number" id="aligned-foo" name="NUM_POSTI" v-model="pallet.Z" placeholder="0" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.X_Corr')}}</label>
                    <input type="number" id="aligned-foo" name="X_CORR" v-model="pallet.X_CORR" placeholder="0" :readonly="dataStored.userLevel==0"/> 0.001mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.Y_Corr')}}</label>
                    <input type="number" id="aligned-foo" name="Y_CORR" v-model="pallet.Y_CORR" placeholder="0" :readonly="dataStored.userLevel==0"/> 0.001mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.Z_Corr')}}</label>
                    <input type="number" id="aligned-foo" name="Z_CORR" v-model="pallet.Z_CORR" placeholder="0" :readonly="dataStored.userLevel==0"/> 0.001mm
                </div>
                <!-- AE: la posizione a magazzino NON si edita piu' da qui —
                     blocco informativo in SOLA LETTURA (decodifica condivisa
                     palletPositionLabel); si imposta solo dal dialog
                     Posiziona della vista Attrezzaggi. -->
                <div class="pure-control-group">
                    <label>{{$t('pallet.posizione')}}</label>
                    <span class="pos-readonly">
                        {{ createNew ? $t('fuori_magazzino') : palletPositionLabel(pallet, $t) }}
                    </span>
                </div>
                <div class="pure-control-group">
                    <label>&nbsp;</label>
                    <span class="pos-hint">{{ $t('pallet.positionHint') }}</span>
                </div>

                <div class="pure-controls">
                    <button class="pure-button pure-button-primary" @click="saveData()" :disabled="dataStored.userLevel==0">
                        Save
                    </button>
                </div>
            </fieldset>
        </div>
      </div>
</template>

<script>
export default {
    data(){
        return {
            pallet:{
                FAMILY:'',
                DESCR:'',
                X:0,
                Y:0,
                Z:0,
                X_CORR:0,
                Y_CORR:0,
                Z_CORR:0,
                MAG:0,
                MAG_POS:0,
                POS_PLANT:0
            },
            createNew:false
        }
    },
    methods: {
        getDataTable() {
            if (this.$route.query.palletID==undefined){
                this.createNew=true;
                return;
            }
            //alert("ID: "+this.$route.query.palletID)
            fetch( dataStored.server+'api/conf/pallet/show/'+this.$route.query.palletID,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    //console.log("pallet:"+JSON.stringify(pallet,null,4))
                    this.pallet=data[0];
                    //elimino un po di spazi vuoti
                    this.pallet.FAMILY=this.pallet.FAMILY.trim();
                    this.pallet.DESCR=this.pallet.DESCR.trim();
                    //trasformo le dimensioni in mm
                    this.pallet.X = this.pallet.X /1000;
                    this.pallet.Y = this.pallet.Y /1000;
                    this.pallet.Z = this.pallet.Z /1000;
                    //this.pallet.X_CORR = this.pallet.X_CORR /10;
                    //this.pallet.Y_CORR = this.pallet.Y_CORR /10;
                    //this.pallet.Z_CORR = this.pallet.Z_CORR /10;
                })
                .catch(error => {
                    console.info(error);
                });
        },
        // AE: campi che il form EDITA davvero. Le dimensioni sono mostrate
        // in mm (getDataTable divide per 1000) e il DB le vuole in micron:
        // la rimoltiplicazione qui CHIUDE l'incidente storico 396000->396
        // (il vecchio saveData rispediva this.pallet cosi' com'era, in mm,
        // e updatePallet scrive raw: ogni salvataggio anagrafica corrompeva
        // le dimensioni di un fattore 1000). CORR restano raw (il form li
        // edita gia' in 0.001mm).
        editedFields() {
            return {
                FAMILY: this.pallet.FAMILY,
                DESCR: this.pallet.DESCR,
                X: this.pallet.X * 1000,
                Y: this.pallet.Y * 1000,
                Z: this.pallet.Z * 1000,
                X_CORR: this.pallet.X_CORR,
                Y_CORR: this.pallet.Y_CORR,
                Z_CORR: this.pallet.Z_CORR
            };
        },
        saveData() {
            if (this.createNew) {
                // AE: il pallet NASCE FUORI MAGAZZINO — MAG_POS=-1 (stessa
                // codifica del "Rimuovi dal magazzino" del dialog Posiziona),
                // POS_PLANT=0 (convenzione dei pallet fuori impianto: il
                // Rimuovi lo passa through e i pallet fuori hanno 0), MAG=1
                // (magazzino unico della cella). La posizione si assegna poi
                // SOLO dal dialog Posiziona di Attrezzaggi.
                const params = new URLSearchParams({
                    ...this.editedFields(),
                    MAG: 1,
                    MAG_POS: -1,
                    POS_PLANT: 0
                });
                fetch(dataStored.server+'api/conf/pallet/insertpallet?' + params.toString(), { method: 'GET' })
                    .then(response => {
                        if (!response.ok) throw new Error('Network response was not ok');
                        return this.$router.push(this.$route.query.returnTo || '/conf/pallets');
                    })
                    .catch(error => { console.info(error); });
                return;
            }
            // AE + TRAPPOLA PASS-THROUGH (incidente storico 396000->396: mai
            // rimandare valori trasformati o stantii): updatePallet esige
            // TUTTI i campi, quindi prima del submit la riga viene RILETTA
            // FRESCA e i campi posizione (MAG/MAG_POS/POS_PLANT) ripartono
            // da li' — un'altra postazione (o il PLC) puo' aver spostato il
            // pallet mentre il form era aperto: la posizione fresca vince,
            // mai quella caricata all'apertura. I campi editati vengono dal
            // form (dimensioni riconvertite in micron, vedi editedFields).
            fetch(dataStored.server+'api/conf/pallet/show/'+this.pallet.ID, { method: 'GET' })
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(rows => {
                    const fresh = rows[0];
                    const params = new URLSearchParams({
                        ID: this.pallet.ID,
                        ...this.editedFields(),
                        MAG: fresh.MAG,
                        MAG_POS: fresh.MAG_POS,
                        POS_PLANT: fresh.POS_PLANT
                    });
                    return fetch(dataStored.server+'api/conf/pallet/updatepallet?' + params.toString(), { method: 'GET' });
                })
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    // U-FASE2: ritorno opzionale al chiamante (form composito Attrezzaggio)
                    return this.$router.push(this.$route.query.returnTo || '/conf/pallets');
                })
                .catch(error => {
                    console.info(error);
                });
        }
    },
    mounted(){
        this.getDataTable();
    }
}
</script>

<style scoped>
    .pure-table-horizontal  #td {
        justify-content: center;
        display: flex;
    }
    .pure-table{
        width: inherit;
    }

    #aligned-foo{
        width:300px;
    }

    /* AE: posizione in sola lettura + hint */
    .pos-readonly {
        color: var(--text-primary);
        font-weight: var(--font-weight-semibold);
    }

    .pos-hint {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
    }
</style>
