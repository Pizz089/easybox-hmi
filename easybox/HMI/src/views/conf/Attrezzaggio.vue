<script setup>
    // MODELLO A DUE ASPETTI (15/9, vedi util/rigging.js): la riga
    // FIXTURE_ON_PALLET e' la GEOMETRIA di cio' che sta sul pallet e c'e'
    // SEMPRE — il PLC somma FIXTURE.Z alla quota di deposito in macchina e
    // non conosce VICE. La MORSA (VICE.PALLET_ID) aggiunge il comportamento:
    // ciclo EasyBox pieno, carico grezzi e scarico finiti dai cassetti. Senza
    // morsa il pallet e' attrezzatura: lavorazione speciale, entra in macchina
    // col grezzo gia' montato.
    // Quindi il ramo MORSA chiede DUE cose: quale morsa e quale attrezzatura
    // ne descrive l'altezza. Una morsa senza geometria e' lo stato INCOMPLETO
    // che ha fermato la cella il 15/9 (errore 799): da qui non si crea.
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
                    <!-- (rig-two-aspects 15/9) la morsa porta anche la sua
                         GEOMETRIA: il PLC somma FIXTURE.Z alla quota di deposito
                         in macchina e non conosce VICE. Obbligatoria: senza,
                         l'ordine morirebbe con l'errore 799. -->
                    <div class="pure-control-group">
                        <label for="att-geom">{{$t('attrezzaggi.geometry')}}</label>
                        <select id="att-geom" v-model="fixtureID">
                            <option :value="0">-</option>
                            <option v-for="f in freeFixtures" :key="f.ID" :value="f.ID">
                                #{{ f.ID }} {{ (f.FAMILY || '').trim() }} - {{ (f.DESCR || '').trim() }}
                            </option>
                        </select>
                        <button class="btn-ghost inline-new" @click="$router.push('/conf/fixture?returnTo=/conf/Attrezzaggio')">
                            {{ $t('attrezzaggi.createNew') }}
                        </button>
                    </div>
                    <div class="pure-control-group">
                        <label>&nbsp;</label>
                        <span class="geom-hint">{{$t('attrezzaggi.geometryHint')}}</span>
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

                <!-- (15/9) gli offset appartengono alla riga di geometria, che
                     ora esiste anche nel ramo morsa: stessa sezione per tutti -->
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
            // (15/9) morsa PIU' la sua geometria e' lo stato COMPLETO, non
            // piu' un'anomalia: la Modifica lo accetta (ed e' l'unico posto da
            // cui si completa una morsa nuda). Resta anomalia la sola
            // condizione di piu' attrezzature sullo stesso pallet.
            if (fops.length > 1 || !this.pallets.find(p => p.ID == this.editPalletId)) {
                this.$router.replace('/conf/Attrezzaggi');
                return;
            }
            // il watcher palletID azzera tipo/selezioni: in precarico va
            // sospeso (flag), poi riattivato al tick successivo
            this.preloading = true;
            this.palletID = this.editPalletId;
            // (15/9) il RAMO lo decide la morsa; la geometria si precarica in
            // entrambi i casi (con la morsa nuda resta 0: e' quello che
            // l'operatore viene qui a completare).
            this.rigType = v ? 'vice' : (fops.length == 1 ? 'fixture' : '');
            if (v) this.viceID = v.ID;
            if (fops.length == 1) {
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
        // (http-status 15/9) scrittura con controllo dell'ESITO: lo stato HTTP
        // non basta, i codici KO viaggiano nel CORPO con stato 200. Usato da
        // creazione e modifica: un fallimento non passa piu' per successo.
        apiWrite(url){
            return fetch(url, { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('net'); return r.text(); })
                .then(body => { const b = String(body).trim(); if (b.indexOf('KO') === 0) throw new Error(b); return b; });
        },
        // parametri della riga di GEOMETRIA (FIXTURE_ON_PALLET) per l'upsert.
        // I CORR non sono editabili dal form: pass-through dalla riga fresca
        // se e' la stessa attrezzatura, altrimenti 0.
        geometryParams(palletId, fresh){
            const same = fresh && fresh.FIXTURE_ID == this.fixtureID;
            return new URLSearchParams({
                PALLET_ID: palletId,
                FIXTURE_ID: this.fixtureID,
                POS_X: this.pos.POS_X || 0,
                POS_Y: this.pos.POS_Y || 0,
                POS_Z: this.pos.POS_Z || 0,
                POS_X_CORR: (same ? (fresh.POS_X_CORR || 0) : 0) / 1000,
                POS_Y_CORR: (same ? (fresh.POS_Y_CORR || 0) : 0) / 1000,
                POS_Z_CORR: (same ? (fresh.POS_Z_CORR || 0) : 0) / 1000,
                POS_X_ROT: this.pos.POS_X_ROT || 0,
                POS_Y_ROT: this.pos.POS_Y_ROT || 0,
                POS_Z_ROT: this.pos.POS_Z_ROT || 0
            }).toString();
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
            const GET = (url) => this.apiWrite(url);
            const upsertGeometry = () => GET(dataStored.server+'api/conf/fixture/updateFixtureOnPallet?'+this.geometryParams(this.editPalletId, freshFops[0]));
            try {
                // MODELLO A DUE ASPETTI: la geometria (riga FIXTURE_ON_PALLET)
                // c'e' SEMPRE; la morsa si aggiunge o si toglie sopra.
                // Ordine: si smonta cio' che non serve piu', poi si scrive.
                // Caso peggiore su errore: pallet INCOMPLETO — stato previsto
                // dal modello, visibile a pannello e recuperabile ripetendo.
                if (!(this.fixtureID > 0)) return;
                // morsa diversa (o non voluta): smonto quella attuale
                if (freshV && (this.rigType != 'vice' || freshV.ID != this.viceID))
                    await GET(dataStored.server+'api/conf/vice/updateVice?'+this.buildViceParams(freshV, '').toString());
                // geometria diversa: via la riga vecchia (l'indice unico
                // (PALLET_ID, FIXTURE_ID) non ammette comunque doppioni)
                if (freshFops.length == 1 && freshFops[0].FIXTURE_ID != this.fixtureID)
                    await fetch(dataStored.server+'api/conf/fixture/fixtureOnPallet/'+this.editPalletId+'/'+freshFops[0].FIXTURE_ID, { method: 'delete' });
                // morsa voluta e non ancora montata su questo pallet
                if (this.rigType == 'vice' && (!freshV || freshV.ID != this.viceID)) {
                    const newV = (freshVices || []).find(x => x.ID == this.viceID);
                    if (!newV) throw new Error('vice not found');
                    await GET(dataStored.server+'api/conf/vice/updateVice?'+this.buildViceParams(newV, this.editPalletId).toString());
                }
                // geometria: UPSERT (crea la riga se manca, aggiorna gli offset
                // se c'e' gia') — e' la route che prima non creava mai nulla
                await upsertGeometry();
                this.$router.push('/conf/Attrezzaggi');
            } catch (e) {
                console.info(e);
                // fallita a meta': il pallet puo' essere rimasto INCOMPLETO
                // (morsa senza geometria) — si vede nell'elenco e si ripete
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
        // CREAZIONE (la modifica ha il suo flusso: saveEdit).
        // (rig-two-aspects 15/9) la GEOMETRIA si scrive SEMPRE, in tutti e due
        // i rami: e' la riga che il PLC usa per la quota di deposito. Nel ramo
        // morsa si monta prima la morsa, poi la geometria.
        async saveData() {
            if (this.palletGateActive || !this.canSave) return;
            if (this.editMode) {
                this.saveEdit();
                return;
            }
            const GET = (url) => this.apiWrite(url);
            try {
                if (this.rigType == 'vice') {
                    const v = this.vices.find(x => x.ID == this.viceID);
                    if (!v) return;
                    await GET(dataStored.server+'api/conf/vice/updateVice?'+this.buildViceParams(v, this.palletID).toString());
                }
                // upsert: crea la riga di geometria (o ne aggiorna gli offset)
                await GET(dataStored.server+'api/conf/fixture/updateFixtureOnPallet?'+this.geometryParams(this.palletID, null));
                this.$router.push('/conf/Attrezzaggi');
            } catch (error) {
                console.info(error);
                alert(this.$t('attrezzaggi.editIncomplete'));
            }
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
        // salva solo col ramo scelto completo. (15/9) il ramo morsa richiede
        // ANCHE la geometria: un pallet con la sola morsa e' uno stato che il
        // PLC non sa eseguire, e questo form non deve poterlo creare.
        canSave(){
            if (this.palletID == 0 || this.palletGateActive) return false;
            if (this.rigType == 'vice')    return this.viceID > 0 && this.fixtureID > 0;
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
/* (15/9) perche' la morsa chiede anche la geometria */
.geom-hint {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
}
</style>
