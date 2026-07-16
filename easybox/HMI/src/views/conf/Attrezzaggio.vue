<script setup>
    // MODELLO ESCLUSIVO (dal creatore del progetto, AB): morsa e attrezzatura
    // sono ALTERNATIVE mutuamente esclusive — ogni pallet monta UNA sola
    // morsa O UNA sola attrezzatura, mai entrambe. Morsa = ciclo EasyBox
    // pieno (carico grezzi/scarico finiti dai cassetti); attrezzatura =
    // lavorazione speciale, entra in macchina col grezzo gia' montato.
    // Il dato normalizzato (VICE.PALLET_ID / FIXTURE_ON_PALLET) resta com'e'.
    import { dataStored } from '../../data.js'
</script>

<template>
      <div class="view-shell conf-card">
        <h2 class="view-title">{{ $t('attrezzaggi.create') }}</h2>

        <div class="pure-form pure-form-aligned">
            <fieldset>
                <!-- ===== 1. PALLET ===== -->
                <h4 class="section-label">{{ $t('attrezzaggi.sectionPallet') }}</h4>
                <div class="pure-control-group">
                    <label for="att-pallet">{{$t('attrezzaggi.pallet')}}</label>
                    <select id="att-pallet" v-model="palletID">
                        <option :value="0">-</option>
                        <option v-for="p in pallets" :key="p.ID" :value="p.ID">
                            #{{ p.ID }} {{ (p.FAMILY || '').trim() }} - {{ (p.DESCR || '').trim() }}
                        </option>
                    </select>
                    <button class="btn-ghost inline-new" @click="$router.push('/conf/pallet?returnTo=/conf/Attrezzaggio')">
                        {{ $t('attrezzaggi.createNew') }}
                    </button>
                </div>

                <!-- AB: pallet GIA' attrezzato (morsa O attrezzatura, di
                     qualunque tipo): nessuna selezione possibile — info +
                     rimando allo smonta in lista. E' anche il gate che rende
                     impossibile una seconda FIXTURE_ON_PALLET dal form. -->
                <div class="pure-control-group" v-if="palletMounted">
                    <label>&nbsp;</label>
                    <span class="already-info">
                        {{ $t('attrezzaggi.alreadyMounted') }}:
                        <template v-if="mountedVice">
                            {{ $t('attrezzaggi.vice') }} {{ (mountedVice.FAMILY || '').trim() }} {{ (mountedVice.DESCR || '').trim() }}
                        </template>
                        <template v-for="f in mountedFixtures" :key="f.FIXTURE_ID">
                            {{ $t('attrezzaggi.fixture') }} {{ fixtureName(f.FIXTURE_ID) }}
                        </template>
                        — {{ $t('attrezzaggi.unmountHint') }}
                    </span>
                </div>

                <!-- ===== 2. TIPO DI ATTREZZAGGIO (esclusivo) ===== -->
                <template v-if="palletID>0 && !palletMounted">
                    <h4 class="section-label">{{ $t('attrezzaggi.sectionType') }}</h4>
                    <div class="pure-control-group">
                        <label>&nbsp;</label>
                        <span class="type-picker">
                            <button type="button"
                                :class="[rigType=='vice' ? 'pure-button-primary' : 'btn-ghost']"
                                @click="setType('vice')">
                                {{ $t('attrezzaggi.vice') }}
                            </button>
                            <button type="button"
                                :class="[rigType=='fixture' ? 'pure-button-primary' : 'btn-ghost']"
                                @click="setType('fixture')">
                                {{ $t('attrezzaggi.fixture') }}
                            </button>
                        </span>
                    </div>
                </template>

                <!-- ===== 3a. MORSA (solo ramo scelto) ===== -->
                <template v-if="palletID>0 && !palletMounted && rigType=='vice'">
                    <h4 class="section-label">{{ $t('attrezzaggi.sectionVice') }}</h4>
                    <div class="pure-control-group">
                        <label for="att-vice">{{$t('attrezzaggi.vice')}}</label>
                        <select id="att-vice" v-model="viceID">
                            <option :value="0">-</option>
                            <option v-for="v in freeVices" :key="v.ID" :value="v.ID">
                                #{{ v.ID }} {{ (v.FAMILY || '').trim() }} - {{ (v.DESCR || '').trim() }}
                            </option>
                        </select>
                        <button class="btn-ghost inline-new" @click="$router.push('/conf/vice?returnTo=/conf/Attrezzaggio')">
                            {{ $t('attrezzaggi.createNew') }}
                        </button>
                    </div>
                </template>

                <!-- ===== 3b. ATTREZZATURA (solo ramo scelto, offset FIXTURE_ON_PALLET) ===== -->
                <template v-if="palletID>0 && !palletMounted && rigType=='fixture'">
                    <h4 class="section-label">{{ $t('attrezzaggi.sectionFixture') }}</h4>
                    <div class="pure-control-group">
                        <label for="att-fixture">{{$t('attrezzaggi.fixture')}}</label>
                        <select id="att-fixture" v-model="fixtureID">
                            <option :value="0">-</option>
                            <option v-for="f in freeFixtures" :key="f.ID" :value="f.ID">
                                #{{ f.ID }} {{ (f.FAMILY || '').trim() }} - {{ (f.DESCR || '').trim() }}
                            </option>
                        </select>
                        <button class="btn-ghost inline-new" @click="$router.push('/conf/fixture?returnTo=/conf/Attrezzaggio')">
                            {{ $t('attrezzaggi.createNew') }}
                        </button>
                    </div>
                </template>

                <span v-if="rigType=='fixture' && fixtureID>0">
                    <h5 class="section-label">{{ $t('attrezzaggi.offsets') }}</h5>
                    <div class="pure-control-group">
                        <label for="att-posx">X</label>
                        <input type="number" step="0.02" id="att-posx" v-model="pos.POS_X" placeholder="0"/> mm
                    </div>
                    <div class="pure-control-group">
                        <label for="att-posy">Y</label>
                        <input type="number" step="0.02" id="att-posy" v-model="pos.POS_Y" placeholder="0"/> mm
                    </div>
                    <div class="pure-control-group">
                        <label for="att-posz">Z</label>
                        <input type="number" step="0.02" id="att-posz" v-model="pos.POS_Z" placeholder="0"/> mm
                    </div>
                    <div class="pure-control-group group-spaced">
                        <label for="att-rotx">X_ROT</label>
                        <input type="number" step="0.02" id="att-rotx" v-model="pos.POS_X_ROT" placeholder="0"/> °
                    </div>
                    <div class="pure-control-group">
                        <label for="att-roty">Y_ROT</label>
                        <input type="number" step="0.02" id="att-roty" v-model="pos.POS_Y_ROT" placeholder="0"/> °
                    </div>
                    <div class="pure-control-group">
                        <label for="att-rotz">Z_ROT</label>
                        <input type="number" step="0.02" id="att-rotz" v-model="pos.POS_Z_ROT" placeholder="0"/> °
                    </div>
                </span>

                <div class="pure-controls">
                    <!-- AB: salva solo col ramo scelto completo (tipo + entita') -->
                    <button class="pure-button pure-button-primary" :class="{'pure-button-disabled': !canSave}" @click="canSave ? saveData() : ''">
                        {{ $t('attrezzaggi.save') }}
                    </button>
                    <button class="btn-ghost" @click="$router.push('/conf/Attrezzaggi')">
                        {{ $t('robot.dialog.cancel') }}
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
            pallets:[],
            vices:[],
            fixtures:[],
            fop:[],
            palletID:0,
            // AB: tipo di attrezzaggio ESCLUSIVO — '' | 'vice' | 'fixture'.
            // Si sceglie un ramo solo e si salva solo quello.
            rigType:'',
            viceID:0,
            fixtureID:0,
            pos:{ POS_X:0, POS_Y:0, POS_Z:0, POS_X_ROT:0, POS_Y_ROT:0, POS_Z_ROT:0 }
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
        // AB: cambio tipo = ramo esclusivo — azzera la selezione dell'altro
        // ramo, cosi' il salvataggio non puo' mai portarsi dietro residui.
        setType(type) {
            this.rigType = type;
            this.viceID = 0;
            this.fixtureID = 0;
        },
        fixtureName(fixtureID){
            const f = this.fixtures.find(x => x.ID == fixtureID);
            return f ? ((f.FAMILY || '').trim()+' '+(f.DESCR || '').trim()) : ('#'+fixtureID);
        },
        // Salvataggio ESCLUSIVO (modello AB): scrive SOLO il ramo scelto,
        // sempre via endpoint esistenti/commit 2 (dato normalizzato intatto):
        // morsa = updateVice con PALLET_ID, attrezzatura =
        // insertFixtureOnPallet (nomi espliciti, CORR restano 0).
        // Il re-check palletMounted difende dal dato cambiato sotto (polling
        // di un'altra postazione): mai un secondo montaggio dallo stesso form.
        saveData() {
            if (this.palletMounted) return;
            let call = null;

            if (this.rigType == 'vice' && this.viceID > 0) {
                const v = this.vices.find(x => x.ID == this.viceID);
                if (!v) return;
                const params = new URLSearchParams({
                    ID: v.ID,
                    FAMILY: (v.FAMILY || '').trim(),
                    DESCR: (v.DESCR || '').trim(),
                    STATUS: v.STATUS,
                    X: v.X, Y: v.Y, Z: v.Z,
                    Z_CLAW: v.Z_CLAW, Z_SINK_CLAW: v.Z_SINK_CLAW,
                    MAG: v.MAG, MAG_POS: v.MAG_POS, POS_PLANT: v.POS_PLANT,
                    PALLET_ID: this.palletID
                });
                call = fetch(dataStored.server+'api/conf/vice/updateVice?'+params.toString(), { method: 'GET' });
            }

            if (this.rigType == 'fixture' && this.fixtureID > 0) {
                const params = new URLSearchParams({
                    PALLET_ID: this.palletID,
                    FIXTURE_ID: this.fixtureID,
                    POS_X: this.pos.POS_X || 0,
                    POS_Y: this.pos.POS_Y || 0,
                    POS_Z: this.pos.POS_Z || 0,
                    POS_X_ROT: this.pos.POS_X_ROT || 0,
                    POS_Y_ROT: this.pos.POS_Y_ROT || 0,
                    POS_Z_ROT: this.pos.POS_Z_ROT || 0
                });
                call = fetch(dataStored.server+'api/conf/fixture/insertFixtureOnPallet?'+params.toString(), { method: 'GET' });
            }

            if (!call) return;
            call
                .then(r => {
                    if (!r.ok) throw new Error('Network response was not ok');
                    this.$router.push('/conf/Attrezzaggi');
                })
                .catch(error => {
                    console.info(error);
                    alert("errore");
                });
        }
    },
    watch: {
        // AB: pallet nuovo = scelta da rifare (tipo e selezioni azzerati)
        palletID() {
            this.rigType = '';
            this.viceID = 0;
            this.fixtureID = 0;
        }
    },
    computed:{
        // morsa gia' montata sul pallet scelto (VICE.PALLET_ID)
        mountedVice(){
            if (this.palletID == 0) return null;
            return this.vices.find(v => v.PALLET_ID == this.palletID) || null;
        },
        // attrezzature gia' montate sul pallet scelto (righe FIXTURE_ON_PALLET)
        mountedFixtures(){
            if (this.palletID == 0) return [];
            return this.fop.filter(f => f.PALLET_ID == this.palletID);
        },
        // AB: pallet gia' attrezzato con QUALUNQUE tipo -> niente selezione
        // (modello esclusivo: si smonta dalla lista, poi si riattrezza)
        palletMounted(){
            return this.palletID > 0 && (!!this.mountedVice || this.mountedFixtures.length > 0);
        },
        // AB: salva solo col ramo scelto completo
        canSave(){
            if (this.palletID == 0 || this.palletMounted) return false;
            if (this.rigType == 'vice')    return this.viceID > 0;
            if (this.rigType == 'fixture') return this.fixtureID > 0;
            return false;
        },
        // solo morse smontate: una morsa sta su un solo pallet
        freeVices(){
            return this.vices.filter(v => v.PALLET_ID == null);
        },
        // attrezzature montabili (il gate vero e' palletMounted: qui si
        // arriva solo a pallet nudo, il filtro resta per robustezza)
        freeFixtures(){
            const mounted = this.fop.filter(f => f.PALLET_ID == this.palletID).map(f => f.FIXTURE_ID);
            return this.fixtures.filter(f => !mounted.includes(f.ID));
        }
    },
    mounted(){
        this.getDataTable();
    }
}
</script>

<style scoped>
    .section-label {
        margin: var(--space-4) 0 var(--space-2) 0;
        color: var(--text-secondary);
    }

    .inline-new {
        margin-left: var(--space-2);
        min-height: 44px;              /* azione secondaria inline: deroga 44 */
        padding: var(--space-1) var(--space-3);
        font-size: var(--font-size-sm);
    }

    .already-info {
        color: var(--color-info);
    }

    /* AB: selettore tipo esclusivo — due bottoni canonici affiancati
       (selezionato = Primary, alternativa = Ghost), nessuno stile ad-hoc. */
    .type-picker {
        display: inline-flex;
        gap: var(--space-2);
    }

    .pure-controls .btn-ghost {
        margin-left: var(--space-2);
    }
</style>
