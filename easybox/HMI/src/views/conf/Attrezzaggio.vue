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
        <h2 class="view-title">{{ editMode ? ($t('attrezzaggi.editTitle') + ' — #' + editPalletId) : $t('attrezzaggi.create') }}</h2>

        <div class="pure-form pure-form-aligned">
            <fieldset>
                <!-- ===== 1. PALLET ===== -->
                <h4 class="section-label">{{ $t('attrezzaggi.sectionPallet') }}</h4>
                <div class="pure-control-group">
                    <label for="att-pallet">{{$t('attrezzaggi.pallet')}}</label>
                    <!-- (edit) il pallet della modifica e' FISSO: si modifica
                         l'attrezzaggio di QUEL pallet, non si cambia pallet -->
                    <select id="att-pallet" v-model="palletID" :disabled="editMode">
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
                <div class="pure-control-group" v-if="palletGateActive">
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
                <template v-if="palletID>0 && !palletGateActive">
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
                <template v-if="palletID>0 && !palletGateActive && rigType=='vice'">
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
                <template v-if="palletID>0 && !palletGateActive && rigType=='fixture'">
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
            pos:{ POS_X:0, POS_Y:0, POS_Z:0, POS_X_ROT:0, POS_Y_ROT:0, POS_Z_ROT:0 },
            // (edit-remove-place) modalita' MODIFICA esplicita:
            // /conf/Attrezzaggio?edit=<palletID> (pattern query-param come
            // ?returnTo=). editLoaded = snapshot del montaggio caricato, per
            // il re-check stateChanged al salvataggio.
            editPalletId: 0,
            preloading: false,
            editLoaded: { viceID: 0, fixtureID: 0 }
        }
    },
    methods: {
        getDataTable() {
            const get = (url, cb) =>
                fetch(dataStored.server + url, { method: 'GET' })
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                    .then(cb)
                    .catch(error => { console.info("-------------"); console.info(error); });

            // (edit) ritorna la Promise: il precarico edit parte SOLO a
            // liste caricate (niente race sul primo render)
            return Promise.all([
                get('api/conf/pallet/show/all',  d => this.pallets  = d || []),
                get('api/conf/vice/show/all',    d => this.vices    = d || []),
                get('api/conf/fixture/show/all', d => this.fixtures = d || []),
                get('api/conf/fixture/showFixtureOnPallet/all', d => this.fop = d || [])
            ]);
        },
        // ===== (edit-remove-place) MODALITA' MODIFICA =====
        // Precarica pallet/tipo/entita'/offset dall'attrezzaggio corrente.
        // Anomalia (doppio montaggio) o pallet inesistente: la Modifica non
        // e' offerta (D5) — difesa: si torna alla lista.
        preloadEdit(){
            if (!this.editPalletId) return;
            const v = this.vices.find(x => x.PALLET_ID == this.editPalletId) || null;
            const fops = this.fop.filter(f => f.PALLET_ID == this.editPalletId);
            if ((v && fops.length > 0) || fops.length > 1 || !this.pallets.find(p => p.ID == this.editPalletId)) {
                this.$router.replace('/conf/Attrezzaggi');
                return;
            }
            // il watcher palletID azzera tipo/selezioni: in precarico va
            // sospeso (flag), poi riattivato al tick successivo
            this.preloading = true;
            this.palletID = this.editPalletId;
            if (v) {
                this.rigType = 'vice';
                this.viceID = v.ID;
            } else if (fops.length == 1) {
                this.rigType = 'fixture';
                this.fixtureID = fops[0].FIXTURE_ID;
                // FOP a DB in MICRON, form in mm: /1000 al precarico (il
                // server ri-moltiplica *1000 al salvataggio — mai rimandare
                // il raw DB nel campo: pattern-incidente 396000)
                this.pos.POS_X = (fops[0].POS_X || 0) / 1000;
                this.pos.POS_Y = (fops[0].POS_Y || 0) / 1000;
                this.pos.POS_Z = (fops[0].POS_Z || 0) / 1000;
                this.pos.POS_X_ROT = (fops[0].POS_X_ROT || 0) / 1000;
                this.pos.POS_Y_ROT = (fops[0].POS_Y_ROT || 0) / 1000;
                this.pos.POS_Z_ROT = (fops[0].POS_Z_ROT || 0) / 1000;
            }
            this.editLoaded = { viceID: v ? v.ID : 0, fixtureID: fops.length == 1 ? fops[0].FIXTURE_ID : 0 };
            this.$nextTick(() => { this.preloading = false; });
        },
        // pass-through IDENTICO a unmountVice di AttrezzaggiView: la riga
        // torna come letta (micron inclusi), cambia SOLO PALLET_ID — che va
        // passato SEMPRE esplicitamente (clausola condizionale server:
        // assente = montaggio preservato, presente vuoto = NULL).
        buildViceParams(v, palletIdValue){
            return new URLSearchParams({
                ID: v.ID,
                FAMILY: (v.FAMILY || '').trim(),
                DESCR: (v.DESCR || '').trim(),
                STATUS: v.STATUS,
                X: v.X, Y: v.Y, Z: v.Z,
                Z_CLAW: v.Z_CLAW, Z_SINK_CLAW: v.Z_SINK_CLAW,
                MAG: v.MAG, MAG_POS: v.MAG_POS, POS_PLANT: v.POS_PLANT,
                PALLET_ID: palletIdValue
            });
        },
        async saveEdit(){
            // (pattern AE) righe FRESCHE rilette ORA — mai lo stato caricato
            // all'apertura del form
            let freshVices, freshFop;
            try {
                [freshVices, freshFop] = await Promise.all([
                    fetch(dataStored.server+'api/conf/vice/show/all', { method: 'GET' })
                        .then(r => { if (!r.ok) throw new Error('net'); return r.json(); }),
                    fetch(dataStored.server+'api/conf/fixture/showFixtureOnPallet/all', { method: 'GET' })
                        .then(r => { if (!r.ok) throw new Error('net'); return r.json(); })
                ]);
            } catch (e) {
                console.info(e);
                alert(this.$t('attrezzaggi.editIncomplete'));
                return;
            }
            const freshV = (freshVices || []).find(x => x.PALLET_ID == this.editPalletId) || null;
            const freshFops = (freshFop || []).filter(f => f.PALLET_ID == this.editPalletId);
            // re-check stateChanged: il montaggio a DB dev'essere ANCORA
            // quello caricato (un'altra postazione puo' averlo cambiato)
            const freshViceId = freshV ? freshV.ID : 0;
            const freshFixId = freshFops.length == 1 ? freshFops[0].FIXTURE_ID : (freshFops.length > 1 ? -1 : 0);
            if (freshViceId != this.editLoaded.viceID || freshFixId != this.editLoaded.fixtureID) {
                dataStored.alert.title = this.$t('WARNING');
                dataStored.alert.desc = 'robot.dialog.stateChanged';
                dataStored.alert.type = 'warning';
                this.getDataTable().then(() => this.preloadEdit());
                return;
            }
            const GET = url => fetch(url, { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('net'); return r.text(); })
                .then(body => { if (body == 'KO') throw new Error('KO'); return body; });
            try {
                if (this.rigType == 'vice' && this.viceID > 0) {
                    if (this.editLoaded.viceID == this.viceID && this.editLoaded.fixtureID == 0) {
                        // stessa morsa: la morsa non ha offset — niente da scrivere
                        this.$router.push('/conf/Attrezzaggi');
                        return;
                    }
                    // SMONTA POI MONTA, mai l'inverso: l'ordine inverso apre
                    // una finestra di doppio montaggio vietata dal modello
                    // esclusivo. Caso peggiore su errore: pallet
                    // temporaneamente NUDO — accettabile e recuperabile.
                    if (freshV)
                        await GET(dataStored.server+'api/conf/vice/updateVice?'+this.buildViceParams(freshV, '').toString());
                    if (freshFops.length == 1)
                        await fetch(dataStored.server+'api/conf/fixture/fixtureOnPallet/'+this.editPalletId+'/'+freshFops[0].FIXTURE_ID, { method: 'delete' });
                    const newV = (freshVices || []).find(x => x.ID == this.viceID);
                    if (!newV) throw new Error('vice not found');
                    await GET(dataStored.server+'api/conf/vice/updateVice?'+this.buildViceParams(newV, this.editPalletId).toString());
                } else if (this.rigType == 'fixture' && this.fixtureID > 0) {
                    if (this.editLoaded.fixtureID == this.fixtureID && this.editLoaded.viceID == 0) {
                        // stessa attrezzatura: update IN LOCO dei soli offset.
                        // Firma QUIRK dell'endpoint: POS_PLANT=palletID,
                        // ID=fixtureID (documentata sull'endpoint). I CORR,
                        // che il form NON edita, ripartono dalla riga FRESCA
                        // /1000 (il server ri-moltiplica *1000): pass-through.
                        const fr = freshFops[0];
                        const params = new URLSearchParams({
                            POS_PLANT: this.editPalletId,
                            ID: this.fixtureID,
                            POS_X: this.pos.POS_X || 0,
                            POS_Y: this.pos.POS_Y || 0,
                            POS_Z: this.pos.POS_Z || 0,
                            POS_X_CORR: (fr.POS_X_CORR || 0) / 1000,
                            POS_Y_CORR: (fr.POS_Y_CORR || 0) / 1000,
                            POS_Z_CORR: (fr.POS_Z_CORR || 0) / 1000,
                            POS_X_ROT: this.pos.POS_X_ROT || 0,
                            POS_Y_ROT: this.pos.POS_Y_ROT || 0,
                            POS_Z_ROT: this.pos.POS_Z_ROT || 0
                        });
                        await GET(dataStored.server+'api/conf/fixture/updateFixtureOnPallet?'+params.toString());
                    } else {
                        // cambio attrezzatura o cambio TIPO: SMONTA POI MONTA
                        if (freshV)
                            await GET(dataStored.server+'api/conf/vice/updateVice?'+this.buildViceParams(freshV, '').toString());
                        if (freshFops.length == 1)
                            await fetch(dataStored.server+'api/conf/fixture/fixtureOnPallet/'+this.editPalletId+'/'+freshFops[0].FIXTURE_ID, { method: 'delete' });
                        const params = new URLSearchParams({
                            PALLET_ID: this.editPalletId,
                            FIXTURE_ID: this.fixtureID,
                            POS_X: this.pos.POS_X || 0,
                            POS_Y: this.pos.POS_Y || 0,
                            POS_Z: this.pos.POS_Z || 0,
                            POS_X_ROT: this.pos.POS_X_ROT || 0,
                            POS_Y_ROT: this.pos.POS_Y_ROT || 0,
                            POS_Z_ROT: this.pos.POS_Z_ROT || 0
                        });
                        await GET(dataStored.server+'api/conf/fixture/insertFixtureOnPallet?'+params.toString());
                    }
                } else
                    return;
                this.$router.push('/conf/Attrezzaggi');
            } catch (e) {
                console.info(e);
                // fase 2 fallita dopo lo smonta: pallet temporaneamente NUDO
                // (coerente col modello, MAI doppio montaggio) — recuperabile
                // ripetendo l'operazione dall'elenco
                alert(this.$t('attrezzaggi.editIncomplete'));
                this.getDataTable().then(() => this.preloadEdit());
            }
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
            if (this.palletGateActive) return;
            // (edit) il salvataggio della MODIFICA ha il suo flusso
            // (fresh+re-check+smonta-poi-monta)
            if (this.editMode) {
                this.saveEdit();
                return;
            }
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
        // AB: pallet nuovo = scelta da rifare (tipo e selezioni azzerati).
        // (edit) in PRECARICO il watcher e' sospeso: gli indici vengono
        // impostati subito dopo il set del pallet e non vanno azzerati.
        palletID() {
            if (this.preloading) return;
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
        editMode(){
            return this.editPalletId > 0;
        },
        // (edit-remove-place) il gate anti-doppio-montaggio resta INTATTO per
        // tutti: e' ESENTE il SOLO pallet in edit (la modifica dell'attrezzaggio
        // corrente non e' un secondo montaggio)
        palletGateActive(){
            return this.palletMounted && !(this.editMode && this.palletID == this.editPalletId);
        },
        // AB: salva solo col ramo scelto completo
        canSave(){
            if (this.palletID == 0 || this.palletGateActive) return false;
            if (this.rigType == 'vice')    return this.viceID > 0;
            if (this.rigType == 'fixture') return this.fixtureID > 0;
            return false;
        },
        // solo morse smontate: una morsa sta su un solo pallet.
        // (edit) la morsa ATTUALE del pallet in edit resta selezionabile
        // (e' la selezione corrente del form)
        freeVices(){
            return this.vices.filter(v => v.PALLET_ID == null ||
                (this.editMode && v.PALLET_ID == this.editPalletId));
        },
        // attrezzature montabili (il gate vero e' palletMounted: qui si
        // arriva solo a pallet nudo, il filtro resta per robustezza)
        freeFixtures(){
            const mounted = this.fop.filter(f => f.PALLET_ID == this.palletID).map(f => f.FIXTURE_ID);
            return this.fixtures.filter(f => !mounted.includes(f.ID));
        }
    },
    mounted(){
        // (edit) /conf/Attrezzaggio?edit=<palletID>: precarico a liste pronte
        this.editPalletId = parseInt(this.$route.query.edit) || 0;
        this.getDataTable().then(() => this.preloadEdit());
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
