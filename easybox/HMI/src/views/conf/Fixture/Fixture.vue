<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../../data.js'
    import { statoComposizione, quoteComposizione, scostamentoMm } from '../../../util/fixtureComposition.js'

    import { ref, onMounted } from 'vue'
    const el = ref()
</script>

<template>   
      <div class="view-shell conf-card">
        <h2 v-if="!createNew" class="view-title">{{ $t('fixture.data')}} : {{ fixture.ID }}</h2>
        <h2 v-if="createNew" class="view-title"> {{ $t('fixture.create')}} </h2>

        <div class="pure-form pure-form-aligned" >
            <fieldset>
                <input type="hidden" name="ID" v-model="fixture.ID" />

                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.family')}}</label>
                    <input type="text" id="aligned-foo" name="FAMIGLIA" v-model="fixture.FAMILY" placeholder=""/>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.descr')}}</label>
                    <input type="text" id="aligned-foo" name="DESCR" v-model="fixture.DESCR" placeholder=""/>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.bodyX')}}</label>
                    <input type="number" step="0.02" id="aligned-foo" name="X_BODY" v-model="fixture.X" placeholder="0"/> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.bodyY')}}</label>
                    <input type="number" step="0.02" id="aligned-foo" name="Y_BODY" v-model="fixture.Y" placeholder="0"/> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.bodyZ')}}</label>
                    <input type="number" step="0.02" id="aligned-foo" name="Z_BODY" v-model="fixture.Z" placeholder="0"/> mm
                </div>

                <!-- ===== (composizione 16/9) DI COSA E' FATTA QUESTA QUOTA =====
                     FIXTURE.Z e' il solo valore che il PLC legge per il deposito
                     in macchina, ed e' una somma fatta a mano. Qui si dichiara da
                     cosa viene, e si vede subito se la somma torna. -->
                <div class="pure-control-group comp-header">
                    <label>{{$t('fixture.composition.title')}}</label>
                    <small class="comp-note">{{$t('fixture.composition.note')}}</small>
                </div>

                <div class="pure-control-group">
                    <label for="comp-pallet">{{$t('fixture.composition.pallet')}}</label>
                    <select id="comp-pallet" v-model="fixture.PALLET_ID">
                        <option :value="null">{{$t('fixture.composition.none')}}</option>
                        <option v-for="p in palletList" :key="p.ID" :value="p.ID">
                            {{ etichettaPallet(p) }}
                        </option>
                    </select>
                </div>

                <div class="pure-control-group">
                    <label for="comp-vice">{{$t('fixture.composition.vice')}}</label>
                    <select id="comp-vice" v-model="fixture.VICE_ID">
                        <option :value="null">{{$t('fixture.composition.none')}}</option>
                        <option v-for="v in viceList" :key="v.ID" :value="v.ID">
                            {{ etichettaMorsa(v) }}
                        </option>
                    </select>
                </div>

                <!-- le due quote e la somma, dai dati. La somma la calcola la
                     VISTA, non il pannello: rifarla qui significherebbe avere
                     due aritmetiche che possono divergere, che e' esattamente
                     il difetto che questo cantiere sta chiudendo. Percio' se
                     la scelta e' cambiata si dice che il conto arriva dopo il
                     salvataggio, invece di indovinarlo. -->
                <div class="pure-control-group" v-if="statoComp === 'coerente' || statoComp === 'diverge'">
                    <label>{{$t('fixture.composition.sumLabel')}}</label>
                    <span class="comp-sum">{{ $t('fixture.composition.sum', quoteComp) }}</span>
                </div>
                <div class="pure-control-group" v-if="sceltaCambiata">
                    <label>&nbsp;</label>
                    <small class="comp-note">{{ $t('fixture.composition.afterSave') }}</small>
                </div>

                <!-- DIVERGE: motivo, conseguenza, cosa fare -->
                <div class="pure-control-group comp-block comp-block--warn" v-if="statoComp === 'diverge'">
                    <label>&nbsp;</label>
                    <div>
                        <p class="comp-why">{{ $t('fixture.composition.divergeWhy', quoteComp) }}</p>
                        <p class="comp-what">{{ $t('fixture.composition.divergeUses', quoteComp) }}</p>
                        <button type="button" class="btn-ghost comp-align" @click="chiediAllineamento()">
                            {{ $t('fixture.composition.alignAction') }}
                        </button>
                    </div>
                </div>

                <!-- NON DICHIARATA: non e' un guasto, e non deve sembrarlo -->
                <div class="pure-control-group comp-block" v-if="statoComp === 'nonDichiarata'">
                    <label>&nbsp;</label>
                    <p class="comp-what">{{ $t('fixture.composition.undeclaredForm') }}</p>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.chelaZ')}}</label>
                    <input type="number" step="0.02" id="aligned-foo" name="Z_CHELE" v-model="fixture.Z_CLAW" placeholder="0"/> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.scassoChelaZ')}}</label>
                    <input type="number" step="0.02" id="aligned-foo" name="Z_SCASSO_CHELE" v-model="fixture.Z_SINK_CLAW" placeholder="0"/> mm
                </div>
                <!--div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.stato')}}</label>
                    <input type="number" id="aligned-foo" name="STATO" v-model="fixture.STATUS" placeholder="0"/>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.posMag')}}</label>
                    <input type="number" id="aligned-foo" name="POS_IN_MAGAZZINO" v-model="fixture.MAG_POS" placeholder="0"/>
                </div-->
                
                <div class="pure-controls">
                    <button class="pure-button pure-button-primary" @click="saveData()">>> NEXT >></button>
                </div>

                <!-- L'allineamento NON parte da un click: la quota dichiarata e'
                     quella che il robot usa davvero, e sovrascriverla sposta il
                     deposito. La conferma dice di quanti mm si sposta e in che
                     verso; e comunque scrive solo il campo, il salvataggio
                     resta un gesto separato. -->
                <div v-if="alignDialog" class="mission-dialog-overlay">
                    <div class="mission-dialog">
                        <h3 class="command-section-title">{{ $t('fixture.composition.alignTitle') }}</h3>
                        <p class="comp-why">{{ $t('fixture.composition.alignWhat', quoteComp) }}</p>
                        <p class="comp-move">{{ $t(scostamento >= 0 ? 'fixture.composition.alignUp' : 'fixture.composition.alignDown', { mm: Math.abs(scostamento) }) }}</p>
                        <small class="comp-note">{{ $t('fixture.composition.alignThenSave') }}</small>
                        <div class="pure-g">
                            <div class="pure-u-1-2">
                                <button style="width:100%" class="pure-button-mission button_pressed" @click="confermaAllineamento()">
                                    {{ $t('robot.dialog.confirm') }}
                                </button>
                            </div>
                            <div class="pure-u-1-2">
                                <button style="width:100%" class="btn-ghost" @click="alignDialog=false">
                                    {{ $t('robot.dialog.cancel') }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </fieldset>
        </div>
      </div>
</template>

<script>
export default {
    data(){
        return {
            fixture:{ },
            createNew:false,
            palletList:[],
            viceList:[],
            alignDialog:false,
            // composizione com'era al caricamento, per sapere se la scelta e'
            // cambiata rispetto a quella su cui la vista ha fatto il conto
            compIniziale:{ pallet:null, vice:null }
        }
    },
    methods: {
        getDataTable() {
            if (this.$route.query.fixtureID==undefined){
                this.createNew=true;
                return;
            }
            fetch( dataStored.server+'api/conf/fixture/show/'+this.$route.query.fixtureID,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.fixture = data[0]
                    this.fixture.X              /= 1000;
                    this.fixture.Y              /= 1000;
                    this.fixture.Z              /= 1000;
                    this.fixture.Z_CLAW         /= 1000;
                    this.fixture.Z_SINK_CLAW    /= 1000;
                    this.fixture.DESCR          = this.fixture.DESCR.trim();
                    this.fixture.FAMILY         = this.fixture.FAMILY.trim();
                    //Aggiungo le voci di FixtureOnPallet
                    this.fixture.POS_X          /= 1000;
                    this.fixture.POS_Y          /= 1000;
                    this.fixture.POS_Z          /= 1000;
                    this.fixture.POS_X_CORR     /= 1000;
                    this.fixture.POS_Y_CORR     /= 1000;
                    this.fixture.POS_Z_CORR     /= 1000;
                    this.fixture.POS_X_ROT      /= 1000;
                    this.fixture.POS_Y_ROT      /= 1000;
                    this.fixture.POS_Z_ROT      /= 1000;
                    this.compIniziale = { pallet: this.fixture.PALLET_ID, vice: this.fixture.VICE_ID };
                })
                .catch(error => {
                    console.info(error);
                });
        },
        etichettaPallet(p) {
            return '#' + p.ID + ' ' + String(p.FAMILY || '').trim();
        },
        etichettaMorsa(v) {
            return '#' + v.ID + ' ' + String(v.FAMILY || '').trim();
        },
        chiediAllineamento() {
            this.alignDialog = true;
        },
        // scrive SOLO il campo: il salvataggio resta un gesto separato, cosi'
        // il robot non si sposta per un click
        confermaAllineamento() {
            this.alignDialog = false;
            const q = this.quoteComp;
            if (q.somma === null) return;
            this.fixture.Z = q.somma;
        },
        getViceList() {
            fetch( dataStored.server+'api/conf/vice/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json()
                })
                .then(data => { this.viceList = data || []; })
                .catch(error => { console.info(error); });
        },
        getPalletList() {
            fetch( dataStored.server+'api/conf/pallet/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.palletList = data || [];
                })
                .catch(error => {
                    console.info(error);
                });
        },
        saveData() {
            var cmd = ""
            if (!this.createNew){
                //eseguo aggiornamento -> update DB
                cmd = dataStored.server+'api/conf/fixture/updateFixture?' + new URLSearchParams( this.fixture ).toString();
                //alert(cmd)
            }else{
                //nuova pinza -> insert DB
                cmd = dataStored.server+'api/conf/fixture/insertFixture?' + new URLSearchParams( this.fixture ).toString();
            }
            fetch( cmd ,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        alert("Network response was not ok")
                        throw new Error('Network response was not ok');
                    }
                    //return this.$router.push("/conf/Fixtures")
                    // U-FASE2: ritorno opzionale al chiamante (form composito Attrezzaggio)
                    return this.$router.push(this.$route.query.returnTo || ("/conf/Fixtureonpallet?fixtureID="+this.fixture.ID))
                })
                .catch(error => {
                    console.info(error);
                    alert("errore")
                });
        }
    },
    computed:{
        // stato e numeri dal modulo condiviso con la lista: una fonte sola
        statoComp() {
            return statoComposizione(this.fixture);
        },
        // la scelta a video non coincide piu' con quella su cui la vista ha
        // fatto il conto
        sceltaCambiata() {
            return String(this.fixture.PALLET_ID || '') !== String(this.compIniziale.pallet || '')
                || String(this.fixture.VICE_ID || '') !== String(this.compIniziale.vice || '');
        },
        quoteComp() {
            // nel form la Z sta in millimetri (divisa al caricamento), le quote
            // della vista sono in micron: si convertono qui, non nei dati
            const q = quoteComposizione(this.fixture);
            return { dichiarata: this.fixture.Z, pallet: q.pallet, morsa: q.morsa, somma: q.somma };
        },
        scostamento() {
            const q = this.quoteComp;
            if (q.somma === null || q.dichiarata === null || q.dichiarata === undefined) return 0;
            return Math.round((q.somma - Number(q.dichiarata)) * 10) / 10;
        },
        getPositionOnPlant() {
            if (this.fixture.POS_PLANT==1000)
                return "=> ROBOT";
            if (this.fixture.POS_PLANT<0)
                return "=> OUT";
            return "";
        }
    },
    mounted(){
        this.getDataTable();
        // servono per i due selettori della composizione
        this.getPalletList();
        this.getViceList();
    }
}
</script>

<style scoped>
    /* (composizione 16/9) */
    .comp-note { display:block; color: var(--text-muted); font-size: var(--font-size-sm); line-height: var(--line-height-normal); }
    .comp-sum { font-variant-numeric: tabular-nums; color: var(--text-primary); }
    .comp-block { align-items: flex-start; }
    .comp-block--warn > div { padding: var(--space-3); border-radius: var(--radius-sm); background: var(--color-warning-bg); max-width: 44rem; }
    .comp-why { margin: 0 0 var(--space-2); color: var(--color-warning); font-weight: var(--font-weight-semibold); line-height: var(--line-height-normal); }
    .comp-what { margin: 0; color: var(--text-primary); line-height: var(--line-height-normal); }
    .comp-move { margin: var(--space-2) 0; color: var(--text-primary); font-size: var(--font-size-md); }
    .comp-align { margin-top: var(--space-3); min-height: 44px; }
    select { min-height: 44px; }

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
</style>
