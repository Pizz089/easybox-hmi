<script setup>
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

                <!-- ===== 2. MORSA ===== -->
                <h4 class="section-label">{{ $t('attrezzaggi.sectionVice') }}</h4>
                <!-- pallet gia' con morsa: si smonta dalla lista, qui solo info -->
                <div class="pure-control-group" v-if="mountedVice">
                    <label>&nbsp;</label>
                    <span class="already-info">
                        {{ $t('attrezzaggi.viceAlreadyMounted') }}:
                        {{ (mountedVice.FAMILY || '').trim() }} {{ (mountedVice.DESCR || '').trim() }}
                    </span>
                </div>
                <div class="pure-control-group" v-else>
                    <label for="att-vice">{{$t('attrezzaggi.vice')}}</label>
                    <select id="att-vice" v-model="viceID">
                        <option :value="0">{{ $t('attrezzaggi.none') }}</option>
                        <option v-for="v in freeVices" :key="v.ID" :value="v.ID">
                            #{{ v.ID }} {{ (v.FAMILY || '').trim() }} - {{ (v.DESCR || '').trim() }}
                        </option>
                    </select>
                    <button class="btn-ghost inline-new" @click="$router.push('/conf/vice?returnTo=/conf/Attrezzaggio')">
                        {{ $t('attrezzaggi.createNew') }}
                    </button>
                </div>

                <!-- ===== 3. ATTREZZATURA (+ offset POS di FIXTURE_ON_PALLET) ===== -->
                <h4 class="section-label">{{ $t('attrezzaggi.sectionFixture') }}</h4>
                <div class="pure-control-group">
                    <label for="att-fixture">{{$t('attrezzaggi.fixture')}}</label>
                    <select id="att-fixture" v-model="fixtureID">
                        <option :value="0">{{ $t('attrezzaggi.none') }}</option>
                        <option v-for="f in freeFixtures" :key="f.ID" :value="f.ID">
                            #{{ f.ID }} {{ (f.FAMILY || '').trim() }} - {{ (f.DESCR || '').trim() }}
                        </option>
                    </select>
                    <button class="btn-ghost inline-new" @click="$router.push('/conf/fixture?returnTo=/conf/Attrezzaggio')">
                        {{ $t('attrezzaggi.createNew') }}
                    </button>
                </div>

                <span v-if="fixtureID>0">
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
                    <button class="pure-button pure-button-primary" :class="{'pure-button-disabled': palletID==0}" @click="palletID>0 ? saveData() : ''">
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
        // Salvataggio composito: SOLO chiamate agli endpoint esistenti/commit 2
        // (dato normalizzato intatto): morsa = updateVice con PALLET_ID,
        // attrezzatura = insertFixtureOnPallet (nomi espliciti, CORR restano 0).
        saveData() {
            const calls = [];

            if (this.viceID > 0 && !this.mountedVice) {
                const v = this.vices.find(x => x.ID == this.viceID);
                if (v) {
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
                    calls.push(fetch(dataStored.server+'api/conf/vice/updateVice?'+params.toString(), { method: 'GET' }));
                }
            }

            if (this.fixtureID > 0) {
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
                calls.push(fetch(dataStored.server+'api/conf/fixture/insertFixtureOnPallet?'+params.toString(), { method: 'GET' }));
            }

            Promise.all(calls)
                .then(rs => {
                    if (rs.some(r => !r.ok)) throw new Error('Network response was not ok');
                    this.$router.push('/conf/Attrezzaggi');
                })
                .catch(error => {
                    console.info(error);
                    alert("errore");
                });
        }
    },
    computed:{
        // morsa gia' montata sul pallet scelto (VICE.PALLET_ID)
        mountedVice(){
            if (this.palletID == 0) return null;
            return this.vices.find(v => v.PALLET_ID == this.palletID) || null;
        },
        // solo morse smontate: una morsa sta su un solo pallet
        freeVices(){
            return this.vices.filter(v => v.PALLET_ID == null);
        },
        // attrezzature non gia' montate sul pallet scelto
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

    .pure-controls .btn-ghost {
        margin-left: var(--space-2);
    }
</style>
