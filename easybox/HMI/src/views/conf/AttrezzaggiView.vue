<script setup>
    // MODELLO ESCLUSIVO (dal creatore del progetto, AB): ogni pallet monta
    // UNA sola morsa O UNA sola attrezzatura, mai entrambe. Morsa = ciclo
    // EasyBox pieno (grezzi/finiti dai cassetti); attrezzatura = lavorazione
    // speciale (entra in macchina col grezzo gia' montato). Una riga con
    // entrambe o con piu' attrezzature e' un DATO SPORCO: si mostra col
    // badge di anomalia (mai sanatorie automatiche, si sistema con gli
    // smonta).
    import { dataStored } from '../../data';
</script>

<template>
      <div class="view-shell view-shell--fill conf-card">
        <div class="view-header">
          <h3 class="view-title">{{$t('attrezzaggi.welcome')}}</h3>
          <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="$router.push('/conf/Attrezzaggio')">
            {{$t('attrezzaggi.add')}}
          </button>
        </div>
        <div class="table-scroll">
        <table class="pure-table pure-table-horizontal">
            <thead>
                <tr>
                    <th>{{$t('attrezzaggi.pallet')}}</th>
                    <th>{{$t('attrezzaggi.position')}}</th>
                    <th>{{$t('attrezzaggi.type')}}</th>
                    <th>{{$t('attrezzaggi.vice')}}</th>
                    <th style='width:25%'>{{$t('attrezzaggi.fixture')}}</th>
                    <th>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <template v-for="row in rows" :key="row.pallet.ID">
                    <tr :class="{'pure-table-odd':(row.pallet.ID % 2==1)}">
                        <td>#{{row.pallet.ID}} {{(row.pallet.FAMILY || '').trim()}} - {{(row.pallet.DESCR || '').trim()}}</td>
                        <td>{{ getPosition(row.pallet) }}</td>

                        <!-- AB: badge semantico del modello esclusivo — nudo
                             (warning), Morsa/Attrezzatura (informativi),
                             ANOMALIA (entrambe o piu' attrezzature: dato
                             sporco MOSTRATO, mai nascosto ne' sanato). -->
                        <td>
                            <span v-if="rowState(row)=='bare'" class="badge badge-missing">{{$t('attrezzaggi.bare')}}</span>
                            <span v-else-if="rowState(row)=='vice'" class="badge badge-type">{{$t('attrezzaggi.vice')}}</span>
                            <span v-else-if="rowState(row)=='fixture'" class="badge badge-type">{{$t('attrezzaggi.fixture')}}</span>
                            <span v-else class="badge badge-anomaly">{{$t('attrezzaggi.anomaly')}}</span>
                        </td>

                        <td>
                            <span v-if="row.vice">{{(row.vice.FAMILY || '').trim()}} {{(row.vice.DESCR || '').trim()}}</span>
                            <span v-else class="cell-empty">—</span>
                        </td>

                        <td>
                            <span v-if="row.fixtures.length>0">
                                <div v-for="f in row.fixtures" :key="f.FIXTURE_ID">
                                    {{ fixtureName(f.FIXTURE_ID) }}
                                </div>
                            </span>
                            <span v-else class="cell-empty">—</span>
                        </td>

                        <td>
                            <!-- AC: posizione a magazzino del pallet -->
                            <button class="btn-ghost action-btn"
                                @click="openPlace(row.pallet)">
                                {{$t('attrezzaggi.place')}}
                            </button>
                            <button v-if="row.vice" class="btn-ghost action-btn"
                                @click="askUnmount('vice', row.pallet.ID, row.vice.ID)">
                                {{$t('attrezzaggi.unmountVice')}}
                            </button>
                            <button v-for="f in row.fixtures" :key="'u'+f.FIXTURE_ID" class="btn-ghost action-btn"
                                @click="askUnmount('fixture', row.pallet.ID, f.FIXTURE_ID)">
                                {{$t('attrezzaggi.unmountFixture')}} {{ row.fixtures.length>1 ? '#'+f.FIXTURE_ID : '' }}
                            </button>
                        </td>
                    </tr>
                    <!-- popup di conferma canonico (pattern popUpOnLine delle conf view) -->
                    <tr v-if="pending && pending.palletID==row.pallet.ID">
                        <td class="popUpOnLine" colspan="20">
                            <div class="center">
                                <h3>{{ pending.type=='vice' ? $t('attrezzaggi.sureUnmountVice') : $t('attrezzaggi.sureUnmountFixture') }}</h3>
                                <span class="pure-g">
                                    <button class="pure-button-micromission specialCMD pure-u-1" @click="confirmUnmount()">
                                        {{$t('attrezzaggi.unmount')}}
                                    </button>
                                    <button class="btn-ghost pure-u-1" @click="pending=null">
                                        EXIT
                                    </button>
                                </span>
                            </div>
                        </td>
                    </tr>
                </template>
            </tbody>
        </table>
        </div>

        <!-- AC: dialog posizione a magazzino — overlay canonico (pattern
             mission-dialog delle unit view). Griglia dei 20 posti del
             magazzino pallet: occupati marcati e non selezionabili. -->
        <div v-if="placeTarget" class="mission-dialog-overlay">
          <div class="mission-dialog">
            <h3 class="command-section-title">
                {{ $t('attrezzaggi.placeTitle') }} — #{{ placeTarget.ID }} {{ (placeTarget.FAMILY || '').trim() }}
            </h3>

            <!-- AC (punto 3): avviso NON bloccante — POS_PLANT dice che il
                 pallet e' al robot o in macchina: campo gestito
                 dall'impianto, la posizione a mano si imposta a fermo. -->
            <div class="plant-warning" v-if="placeTarget.POS_PLANT>=100">
                {{ $t('attrezzaggi.plantWarning') }}
            </div>

            <div class="pos-grid">
                <button v-for="n in posGridOrder" :key="n" class="pos-cell"
                    :class="{ selected: placeSel===n }"
                    :disabled="!!occupantOf(n)"
                    @click="placeSel=n">
                    <span class="pos-num">{{ n }}</span>
                    <span v-if="occupantOf(n)" class="pos-occ">
                        #{{ occupantOf(n).ID }} {{ (occupantOf(n).FAMILY || '').trim() }}
                    </span>
                </button>
            </div>

            <button class="mission-dialog-item"
                :class="{ selected: placeSel===-1 }"
                :disabled="placeTarget.MAG_POS<0"
                @click="placeSel=-1">
                {{ $t('attrezzaggi.removeFromMag') }}
                <span v-if="placeTarget.MAG_POS<0">({{ $t('fuori_magazzino') }})</span>
            </button>

            <div class="pure-g">
              <div class="pure-u-1-2">
                <button style="width:100%" class="button_pressed"
                  :class="[placeSel==null? 'pure-button-disable' : 'pure-button-mission']"
                  @click="placeSel!=null?confirmPlace():''">
                  {{ $t('robot.dialog.confirm') }}
                </button>
              </div>
              <div class="pure-u-1-2">
                <button style="width:100%" class="btn-ghost" @click="closePlace()">
                  {{ $t('robot.dialog.cancel') }}
                </button>
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
            fop:[],          // righe FIXTURE_ON_PALLET
            pending:null,    // {type:'vice'|'fixture', palletID, id} in attesa di conferma
            // AC: dialog posizione a magazzino.
            // magPositions = 20: layout fisico della cella, magazzino pallet
            // a 5 file x 4 posti. placeSel: null | -1 (fuori magazzino,
            // MAG_POS=-1 come da decodifica PalletsView) | 1..20.
            magPositions: 20,
            placeTarget:null,
            placeSel:null,
            polling:true,
            pollTimer:null   // handle del setInterval: senza, il timer sopravvive alla view
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
        getPosition(pal){
            if (pal.POS_PLANT>=100)
                return this.$t('Mag')+" "+pal.MAG_POS+' >> '+this.$t('Machine')+' '+(pal.POS_PLANT-99);
            if (pal.MAG_POS<0)
                return this.$t('fuori_magazzino')
            return this.$t('Mag')+" "+pal.MAG_POS;
        },
        fixtureName(fixtureID){
            const f = this.fixtures.find(x => x.ID == fixtureID);
            return f ? ((f.FAMILY || '').trim()+' '+(f.DESCR || '').trim()) : ('#'+fixtureID);
        },
        // AB: stato semantico della riga nel modello esclusivo.
        // 'bare' = da attrezzare; 'vice'/'fixture' = tipo montato;
        // 'anomaly' = entrambe o piu' di un'attrezzatura (configurazione
        // impossibile nel modello, es. il pallet 1 storico con 2 fixture).
        rowState(row){
            const hasVice = !!row.vice;
            const nFix = row.fixtures.length;
            if ((hasVice && nFix > 0) || nFix > 1) return 'anomaly';
            if (hasVice) return 'vice';
            if (nFix == 1) return 'fixture';
            return 'bare';
        },
        askUnmount(type, palletID, id){
            this.pending = { type, palletID, id };
        },
        confirmUnmount(){
            const p = this.pending;
            this.pending = null;
            if (!p) return;
            if (p.type == 'vice')
                this.unmountVice(p.id);
            else
                this.unmountFixture(p.palletID, p.id);
        },
        // Smonta morsa: updateVice ESISTENTE con l'intera riga (i valori
        // tornano identici, sono gia' in micron dalla vista VICES) e
        // PALLET_ID vuoto -> NULL (clausola condizionale del commit 2).
        unmountVice(viceID){
            const v = this.vices.find(x => x.ID == viceID);
            if (!v) return;
            const params = new URLSearchParams({
                ID: v.ID,
                FAMILY: (v.FAMILY || '').trim(),
                DESCR: (v.DESCR || '').trim(),
                STATUS: v.STATUS,
                X: v.X, Y: v.Y, Z: v.Z,
                Z_CLAW: v.Z_CLAW, Z_SINK_CLAW: v.Z_SINK_CLAW,
                MAG: v.MAG, MAG_POS: v.MAG_POS, POS_PLANT: v.POS_PLANT,
                PALLET_ID: ''
            });
            fetch(dataStored.server+'api/conf/vice/updateVice?'+params.toString(), { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); this.getDataTable(); })
                .catch(error => { console.info(error); });
        },
        // ===== AC: posizione a magazzino =====
        openPlace(pallet){
            this.placeTarget = pallet;
            this.placeSel = null;
        },
        closePlace(){
            this.placeTarget = null;
            this.placeSel = null;
        },
        // Occupante del posto n (qualunque pallet, incluso il target: la
        // posizione corrente non e' riselezionabile). Il polling 3s tiene
        // la fotografia fresca anche col dialog aperto.
        occupantOf(n){
            return this.pallets.find(p => p.MAG_POS == n) || null;
        },
        // AC: conferma con RE-CHECK (pattern stateChanged delle missioni):
        // se nel frattempo il posto e' stato preso da un altro pallet,
        // chiudi con warning e NON scrivere.
        confirmPlace(){
            const t = this.placeTarget;
            const sel = this.placeSel;
            if (!t || sel == null) return;
            if (sel > 0) {
                const occ = this.pallets.find(p => p.MAG_POS == sel && p.ID != t.ID);
                if (occ) {
                    this.closePlace();
                    dataStored.alert.title = this.$t('WARNING');
                    dataStored.alert.desc = 'robot.dialog.stateChanged';
                    dataStored.alert.type = 'warning';
                    return;
                }
            }
            // TRAPPOLA NOTA (incidente storico form Pallet, 396000->396):
            // update PASS-THROUGH — la riga viene rimandata ESATTAMENTE come
            // letta da show/all (X/Y/Z/CORR/FAMILY/DESCR/MAG/POS_PLANT mai
            // toccati ne' convertiti: updatePallet scrive i valori raw cosi'
            // come arrivano); cambia SOLO MAG_POS.
            const row = this.pallets.find(p => p.ID == t.ID);
            if (!row) { this.closePlace(); return; }
            const params = new URLSearchParams({
                ID: row.ID,
                FAMILY: row.FAMILY,
                DESCR: row.DESCR,
                X: row.X, Y: row.Y, Z: row.Z,
                X_CORR: row.X_CORR, Y_CORR: row.Y_CORR, Z_CORR: row.Z_CORR,
                MAG: row.MAG,
                MAG_POS: sel > 0 ? sel : -1,   // -1 = fuori magazzino (decodifica PalletsView)
                POS_PLANT: row.POS_PLANT
            });
            fetch(dataStored.server+'api/conf/pallet/updatePallet?'+params.toString(), { method: 'GET' })
                .then(r => {
                    if (!r.ok) throw new Error('Network response was not ok');
                    this.closePlace();
                    this.getDataTable();
                })
                .catch(error => { console.info(error); });
        },
        // Smonta attrezzatura: rimozione della riga FIXTURE_ON_PALLET.
        // NB: FIXTURE.POS_PLANT (anagrafica) non viene toccato qui — lo
        // gestisce il form attrezzatura come sempre (divergenza storica
        // documentata nel commento dell'endpoint updateFixtureOnPallet).
        unmountFixture(palletID, fixtureID){
            fetch(dataStored.server+'api/conf/fixture/fixtureOnPallet/'+palletID+'/'+fixtureID, { method: 'delete' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); this.getDataTable(); })
                .catch(error => { console.info(error); });
        }
    },
    computed:{
        // UNA RIGA PER PALLET: morsa da VICE.PALLET_ID, attrezzature dalle
        // righe FIXTURE_ON_PALLET (fonte dati come da audit U).
        rows(){
            return this.pallets.map(p => ({
                pallet: p,
                vice: this.vices.find(v => v.PALLET_ID == p.ID) || null,
                fixtures: this.fop.filter(f => f.PALLET_ID == p.ID)
            }));
        },
        locked(){
            if (dataStored.userLevel<=1)
                return 'locked4maintenance'
            return ''
        },
        // AC: la griglia rispecchia la disposizione FISICA del magazzino
        // pallet, vista come la vede l'operatore davanti al magazzino:
        // 5 righe x 4 posti, RIGA 1 IN BASSO, POSIZIONE 1 in basso a DESTRA;
        // la numerazione procede verso sinistra lungo la riga (1->4), poi
        // sale alla riga sopra (5->8, sempre da destra) fino alla 20 in
        // alto a sinistra. La CSS grid riempie da sinistra a destra, riga
        // per riga dall'alto: quell'ordine fisico equivale quindi al
        // semplice 20..1 discendente (riga alta: 20 19 18 17; ...;
        // riga bassa: 4 3 2 1).
        posGridOrder(){
            const out = [];
            for (let n = this.magPositions; n >= 1; n--) out.push(n);
            return out;
        }
    },
    mounted(){
        this.getDataTable()
        // handle salvato + clearInterval in unmounted: il flag polling da solo
        // (pattern storico delle conf view) lascia il timer a girare a vuoto
        // per sempre dopo l'uscita dalla view.
        this.pollTimer = setInterval(() => {
            if(this.polling)
                this.getDataTable()
        }, 3000);
    },
    unmounted(){
        this.polling=false;
        clearInterval(this.pollTimer);
    }
}
</script>

<style scoped>
    .pure-table{
        width: inherit;
    }

    .popUpOnLine .btn-ghost {
        margin-top: var(--space-2);
    }

    /* 2px (non 1px --border-card): il popup di conferma deve staccare piu'
       di un bordo card (pattern FixturesView). */
    .center {
        margin: auto;
        width: 20%;
        border: 2px solid var(--color-critical);
        padding: var(--space-6);
    }

    /* Badge semantici (grammatica badge status WORKING/EMPTY delle conf
       view: bg semantico + testo colore pieno + radius-lg).
       AB: warning = pallet nudo ("Da attrezzare"); info = tipo montato
       (Morsa/Attrezzatura, informativi non warning); danger semibold =
       ANOMALIA (doppio montaggio, ben visibile). */
    .badge {
        display: inline-block;
        padding: var(--space-1) var(--space-3);
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

    .cell-empty {
        color: var(--text-muted);
    }

    .action-btn {
        min-height: 44px;              /* azione secondaria in cella: deroga 44 come sidebar/diag */
        padding: var(--space-1) var(--space-3);
        font-size: var(--font-size-sm);
        margin: 2px var(--space-1);
    }

    /* AC: overlay canonico (stesso pattern scoped di robotView: overlay a
       schermo pieno z 1000, card dialog, voci touch). */
    .mission-dialog-overlay {
        position: fixed;
        inset: 0;
        background: var(--bg-backdrop);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .mission-dialog {
        background: var(--bg-surface);
        border: var(--border-card);
        border-radius: var(--radius-md);
        box-shadow: var(--elevation-3);
        padding: var(--space-4);
        width: min(520px, 92vw);
        max-height: 80vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .mission-dialog-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-4);
        min-height: 52px;
        padding: var(--space-2) var(--space-4);
        background: var(--bg-input);
        color: var(--text-primary);
        border: 2px solid transparent;
        border-radius: var(--radius-md);
        font-size: var(--font-size-base);
        cursor: pointer;
        text-align: left;
    }

    .mission-dialog-item.selected {
        background: var(--accent);
        border-color: var(--accent-hover);
        font-weight: var(--font-weight-semibold);
    }

    .mission-dialog-item:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    /* AC: griglia 4 colonne x 5 file = i 20 posti fisici del magazzino
       pallet della cella, orientata come la vede l'operatore davanti al
       magazzino (riga 1 in basso, pos. 1 in basso a destra — l'ordine di
       render lo da' il computed posGridOrder). */
    .pos-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-2);
    }

    .pos-cell {
        min-height: 52px;
        padding: var(--space-1);
        background: var(--bg-input);
        color: var(--text-primary);
        border: 2px solid transparent;
        border-radius: var(--radius-md);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
    }

    .pos-cell.selected {
        background: var(--accent);
        border-color: var(--accent-hover);
        color: var(--bg-base);
        font-weight: var(--font-weight-semibold);
    }

    /* occupato: subdued ma leggibile (chi lo occupa resta visibile) */
    .pos-cell:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .pos-num {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
    }

    .pos-occ {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* AC: avviso NON bloccante POS_PLANT (warning informativo, non danger) */
    .plant-warning {
        background: var(--color-warning-bg);
        color: var(--color-warning);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font-size: var(--font-size-sm);
    }
</style>
