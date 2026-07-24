<script setup>
    // MODELLO ESCLUSIVO (dal creatore del progetto, AB): ogni pallet monta
    // UNA sola morsa O UNA sola attrezzatura, mai entrambe. Morsa = ciclo
    // EasyBox pieno (grezzi/finiti dai cassetti); attrezzatura = lavorazione
    // speciale (entra in macchina col grezzo gia' montato). Una riga con
    // entrambe o con piu' attrezzature e' un DATO SPORCO: si mostra col
    // badge di anomalia (mai sanatorie automatiche, si sistema con gli
    // smonta).
    import { dataStored } from '../../data';
    import { palletGridOrder, palletPositionLabel } from '../../util/warehouseGrid';
    import { buildRigRows, rigState } from '../../util/rigging';
    import { KO_OCCUPIED, KO_DISABLED } from '../../util/errorCodes';
    // (edit-remove-place) voci "In macchina" dalla configurazione (cantiere AS)
    import { MACHINE_POSITIONS } from '../../util/machineBrands';
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
                            <!-- (edit-remove-place) MODIFICA: solo montaggi SANI
                                 (vice|fixture) — sull'anomalia l'unica azione e'
                                 lo smonta (D5). Gating D1: bottone SEMPRE
                                 visibile, disabilitato col motivo sotto. -->
                            <button v-if="rowState(row)=='vice' || rowState(row)=='fixture'"
                                class="btn-ghost action-btn"
                                :disabled="rowBlockReason(row)!=''"
                                @click="askEdit(row)">
                                {{$t('attrezzaggi.edit')}}
                            </button>
                            <button v-if="row.vice" class="btn-ghost action-btn"
                                :disabled="rowBlockReason(row)!=''"
                                @click="askUnmount('vice', row.pallet.ID, row.vice.ID)">
                                {{$t('attrezzaggi.unmountVice')}}
                            </button>
                            <button v-for="f in row.fixtures" :key="'u'+f.FIXTURE_ID" class="btn-ghost action-btn"
                                :disabled="rowBlockReason(row)!=''"
                                @click="askUnmount('fixture', row.pallet.ID, f.FIXTURE_ID)">
                                {{$t('attrezzaggi.unmountFixture')}} {{ row.fixtures.length>1 ? '#'+f.FIXTURE_ID : '' }}
                            </button>
                            <!-- D1: mai bottoni muti — il motivo del blocco -->
                            <div class="action-hint" v-if="rowBlockReason(row)">{{ rowBlockReason(row) }}</div>
                        </td>
                    </tr>
                    <!-- popup di conferma canonico (pattern popUpOnLine delle conf view).
                         (edit-remove-place) arricchito col CONTENUTO REALE della
                         riga + conferma RAFFORZATA se il pallet e' a magazzino -->
                    <tr v-if="pending && pending.palletID==row.pallet.ID">
                        <td class="popUpOnLine" colspan="20">
                            <div class="center">
                                <h3>{{ pending.type=='vice' ? $t('attrezzaggi.sureUnmountVice') : $t('attrezzaggi.sureUnmountFixture') }}</h3>
                                <h4 class="unmount-detail">{{ pendingDetail(row) }}</h4>
                                <h4 class="mag-warning" v-if="row.pallet.MAG_POS > 0">{{ $t('attrezzaggi.magWarning') }}</h4>
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
                    <!-- (edit-remove-place, D1) conferma RAFFORZATA della
                         Modifica quando il pallet e' A MAGAZZINO: l'attrezzaggio
                         fisico si fa a banco -->
                    <tr v-if="pendingEdit==row.pallet.ID">
                        <td class="popUpOnLine" colspan="20">
                            <div class="center">
                                <h3>{{ $t('attrezzaggi.sureEdit') }}</h3>
                                <h4 class="mag-warning">{{ $t('attrezzaggi.magWarning') }}</h4>
                                <span class="pure-g">
                                    <button class="pure-button-micromission specialCMD pure-u-1" @click="goEdit(row.pallet.ID)">
                                        {{$t('attrezzaggi.edit')}}
                                    </button>
                                    <button class="btn-ghost pure-u-1" @click="pendingEdit=null">
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

            <!-- AD: celle disabilitate (STATUS 9) spente con stile DISTINTO
                 dalle occupate; righe di coda tagliate da posGridOrder. -->
            <div class="pos-grid">
                <button v-for="n in posGridOrder" :key="n" class="pos-cell"
                    :class="{ selected: placeSel===n, 'disabled-slot': disabledSlots.has(n) }"
                    :disabled="!!occupantOf(n) || disabledSlots.has(n)"
                    @click="placeSel=n">
                    <span class="pos-num">{{ n }}</span>
                    <span v-if="occupantOf(n)" class="pos-occ">
                        #{{ occupantOf(n).ID }} {{ (occupantOf(n).FAMILY || '').trim() }}
                    </span>
                    <span v-else-if="disabledSlots.has(n)" class="pos-occ">
                        {{ $t('warehouses.disabled') }}
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

            <!-- (edit-remove-place, R-C) dichiarazione IN MACCHINA: voci dalla
                 configurazione (MACHINE_POSITIONS, cantiere AS — con MC2 non
                 configurata compare una voce sola). Guardia R-B sdoppiata:
                 OCCUPATA nomina il pallet, AMBIGUA segnala il dato anomalo. -->
            <button v-for="mpos in MACHINE_POSITIONS" :key="mpos.mc" class="mission-dialog-item"
                :class="{ selected: placeSel==='mc'+mpos.n }"
                :disabled="machineBlock(mpos.n) != ''"
                @click="placeSel='mc'+mpos.n">
                {{ $t('attrezzaggi.inMachine', { mc: $t(mpos.labelKey) }) }}
                <span v-if="machineBlock(mpos.n)" class="cell-empty">{{ machineBlock(mpos.n) }}</span>
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
            wpallet:[],      // righe [POSITION] WPALLET (per gli slot disabilitati, AD)
            pending:null,    // {type:'vice'|'fixture', palletID, id} in attesa di conferma
            pendingEdit:null,// palletID in attesa di conferma RAFFORZATA della Modifica
            orders:[],       // WORKORDERS per la guardia D1 (ordine attivo)
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
            get('api/conf/position/showWarehouse/WPALLET', d => this.wpallet = d || []);
            // (edit-remove-place) guardia D1: ordini per PALLET_ID+Status,
            // stessa cadenza del poll 3s gia' in casa
            get('api/order/show/all', d => this.orders = d || []);
        },
        // AE: decodifica portata a utility condivisa (riuso non copia)
        getPosition(pal){
            return palletPositionLabel(pal, this.$t);
        },
        fixtureName(fixtureID){
            const f = this.fixtures.find(x => x.ID == fixtureID);
            return f ? ((f.FAMILY || '').trim()+' '+(f.DESCR || '').trim()) : ('#'+fixtureID);
        },
        // AB: stato semantico della riga — logica portata nell'utility
        // condivisa util/rigging.js (riuso con selectRig, regola AE).
        rowState(row){
            return rigState(row);
        },
        // ===== (edit-remove-place) GUARDIE D1 =====
        // ordine ATTIVO = Status 3 (contratto PLC; stesso riconoscimento
        // ratificato del guardrail grigliati) che referenzia il pallet
        activeOrderOf(palletID){
            return (this.orders || []).find(o => o.PALLET_ID == palletID && o.STATUS == 3) || null;
        },
        // pallet DICHIARATO in macchina: fascia 100 <= x < 1000 (1000=Robot
        // escluso; il legacy POS_PLANT=2 e' fuori fascia: dato valido in sola
        // lettura, azioni permesse — D5)
        palletInMachine(p){
            return p.POS_PLANT >= 100 && p.POS_PLANT < 1000;
        },
        // motivo di blocco riga per Modifica/Smonta ('' = azione permessa).
        // D1: il bottone resta visibile, il motivo e' SEMPRE esposto.
        rowBlockReason(row){
            const ord = this.activeOrderOf(row.pallet.ID);
            if (ord) return this.$t('attrezzaggi.blockedOrder', { id: ord.ID });
            if (this.palletInMachine(row.pallet)) return this.$t('attrezzaggi.blockedInMachine');
            return '';
        },
        // contenuto REALE della riga per il popup smonta
        pendingDetail(row){
            if (!this.pending) return '';
            if (this.pending.type == 'vice' && row.vice)
                return (row.vice.FAMILY || '').trim() + ' ' + (row.vice.DESCR || '').trim() + ' (ID ' + row.vice.ID + ')';
            return this.fixtureName(this.pending.id) + ' (ID ' + this.pending.id + ')';
        },
        // (D1) Modifica: conferma RAFFORZATA solo col pallet a magazzino
        askEdit(row){
            if (this.rowBlockReason(row) != '') return;   // difesa: bottone gia' disabled
            if (row.pallet.MAG_POS > 0) {
                this.pendingEdit = row.pallet.ID;
                return;
            }
            this.goEdit(row.pallet.ID);
        },
        goEdit(palletID){
            this.pendingEdit = null;
            this.$router.push('/conf/Attrezzaggio?edit=' + palletID);
        },
        // (R-B) guardia voce macchina, SDOPPIATA:
        //  OCCUPATA: un ALTRO pallet esattamente a POS_PLANT == 100+n -> hint
        //  che lo NOMINA;
        //  AMBIGUA: un ALTRO pallet in fascia macchina (100 <= x < 1000,
        //  1000=Robot escluso) il cui valore NON mappa a NESSUNA macchina
        //  configurata (incluso 100 esatto) -> blocco conservativo con hint
        //  dedicato. Regge all'abilitazione di MC2 senza modifiche.
        machineBlock(n){
            if (!this.placeTarget) return '';
            const others = this.pallets.filter(p => p.ID != this.placeTarget.ID);
            const occ = others.find(p => p.POS_PLANT == 100 + n);
            if (occ) return this.$t('attrezzaggi.machineOccupied', { id: occ.ID });
            const amb = others.find(p => p.POS_PLANT >= 100 && p.POS_PLANT < 1000 &&
                !MACHINE_POSITIONS.some(m => m.n === p.POS_PLANT - 100));
            if (amb) return this.$t('attrezzaggi.machineAmbiguous', { id: amb.ID });
            return '';
        },
        askUnmount(type, palletID, id){
            const row = this.rows.find(r => r.pallet.ID == palletID);
            if (row && this.rowBlockReason(row) != '') return;   // difesa D1
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
            // (R-C) tre destinazioni: casella (sel>0), Rimuovi (-1),
            // In macchina ('mc'+n)
            const isMachine = typeof sel === 'string' && sel.indexOf('mc') === 0;
            const machineN = isMachine ? parseInt(sel.slice(2)) : 0;
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
            // (R-B/D4) re-check FRESCO della guardia macchina alla conferma
            if (isMachine && this.machineBlock(machineN) != '') {
                this.closePlace();
                dataStored.alert.title = this.$t('WARNING');
                dataStored.alert.desc = 'robot.dialog.stateChanged';
                dataStored.alert.type = 'warning';
                return;
            }
            // TRAPPOLA NOTA (incidente storico form Pallet, 396000->396):
            // update PASS-THROUGH — la riga viene rimandata ESATTAMENTE come
            // letta da show/all (X/Y/Z/CORR/FAMILY/DESCR/MAG mai toccati ne'
            // convertiti).
            const row = this.pallets.find(p => p.ID == t.ID);
            if (!row) { this.closePlace(); return; }
            // casella di PROVENIENZA (per il trasferimento del flag D3)
            const fromSlot = row.MAG_POS > 0 ? row.MAG_POS : 0;
            // (am-casella-magpos) POS_PLANT e MAG_POS ESPLICITI per ramo
            // (tabella ratificata — la vista COORDINATES_FOR_PALLET_WAREHOUSE
            // e le gambe automatiche di deposito/prelievo vivono di MAG_POS):
            //   casella N   -> MAG_POS=N,         POS_PLANT=0
            //   In macchina -> MAG_POS INVARIATO (la CASA resta), POS_PLANT=100+n
            //   Rimuovi     -> MAG_POS=-1,        POS_PLANT=0 (chiude il buco
            //                  del pallet a 101 rimosso che restava a 101)
            let newMagPos, newPosPlant;
            if (isMachine) {
                newMagPos = row.MAG_POS;          // la casa resta (pass-through fresh)
                newPosPlant = 100 + machineN;     // canone D2
            } else if (sel > 0) {
                newMagPos = sel;
                newPosPlant = 0;
            } else {
                newMagPos = -1;                   // -1 = fuori magazzino (decodifica PalletsView)
                newPosPlant = 0;
            }
            const params = new URLSearchParams({
                ID: row.ID,
                FAMILY: row.FAMILY,
                DESCR: row.DESCR,
                X: row.X, Y: row.Y, Z: row.Z,
                X_CORR: row.X_CORR, Y_CORR: row.Y_CORR, Z_CORR: row.Z_CORR,
                MAG: row.MAG,
                MAG_POS: newMagPos,
                POS_PLANT: newPosPlant
            });
            // AD (chiusura finestra nota): l'endpoint ora rifiuta con codici
            // KO_OCCUPIED/KO_DISABLED (HTTP 200, body = codice) — qui si
            // mostra il messaggio, si rifa' la foto e il dialog RESTA aperto
            // perche' l'operatore scelga un altro posto.
            fetch(dataStored.server+'api/conf/pallet/updatePallet?'+params.toString(), { method: 'GET' })
                .then(r => {
                    if (!r.ok) throw new Error('Network response was not ok');
                    return r.text();
                })
                .then(body => {
                    if (body == KO_OCCUPIED || body == KO_DISABLED) {
                        const occ = sel > 0 ? this.pallets.find(p => p.MAG_POS == sel && p.ID != t.ID) : null;
                        dataStored.alert.title = this.$t('WARNING');
                        dataStored.alert.desc = body == KO_OCCUPIED
                            ? this.$t('warehouses.occupiedBy', { name: occ ? ('#'+occ.ID+' '+(occ.FAMILY || '').trim()) : '?' })
                            : this.$t('warehouses.disabledPos');
                        dataStored.alert.type = 'warning';
                        this.placeSel = null;
                        this.getDataTable();
                        return;
                    }
                    // (D3, am-inmacchina-free) flag casella [POSITION] WPALLET
                    // via warehouseSlot (transizioni STRETTE: occupy 2->4,
                    // free 4->2, mai toccato 9):
                    //   verso casella -> occupy(destinazione) + free(provenienza)
                    //   In macchina   -> free(provenienza): il rientro
                    //                    automatico PLC cerca la casa con
                    //                    STATUS=2 — una casella lasciata a 4
                    //                    = rientro senza destinazione. La
                    //                    casa (MAG_POS) resta del pallet e
                    //                    palletSlotGuard la protegge dalle
                    //                    occupazioni altrui: liberare e' sicuro.
                    //   Rimuovi       -> free(provenienza)
                    const slotCalls = [];
                    const slotUrl = (action, n) =>
                        fetch(dataStored.server+'api/conf/position/warehouseSlot/'+action+'/WPALLET/'+n, { method: 'GET' })
                            .catch(e => { console.info(e); });
                    if (sel > 0) {
                        slotCalls.push(slotUrl('occupy', sel));
                        if (fromSlot > 0 && fromSlot != sel) slotCalls.push(slotUrl('free', fromSlot));
                    } else if (fromSlot > 0) {
                        slotCalls.push(slotUrl('free', fromSlot));
                    }
                    Promise.all(slotCalls).then(() => {
                        this.closePlace();
                        this.getDataTable();
                    });
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
        // UNA RIGA PER PALLET (fonte dati come da audit U) — costruzione
        // portata nell'utility condivisa util/rigging.js (riuso con selectRig).
        rows(){
            return buildRigRows(this.pallets, this.vices, this.fop);
        },
        locked(){
            if (dataStored.userLevel<=1)
                return 'locked4maintenance'
            return ''
        },
        // AD: slot disabilitati del magazzino pallet (POSITION STATUS=9)
        disabledSlots(){
            return new Set(this.wpallet.filter(r => r.STATUS == 9).map(r => r.SUB_POS));
        },
        // AC/AD: convenzione fisica (riga 1 in basso, pos. 1 in basso a
        // destra -> render N..1) + REGOLA RIGHE DI CODA ora nell'utility
        // CONDIVISA util/warehouseGrid.js: le righe interamente disabilitate
        // spariscono solo dalla coda in alto; le intermedie restano
        // visibili ma spente.
        posGridOrder(){
            return palletGridOrder(this.disabledSlots);
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

    /* AD: slot DISABILITATO — stile distinto dall'occupato (bordo
       tratteggiato warning, nessun fill), stessa grammatica della vista
       Magazzini. */
    .pos-cell.disabled-slot {
        border: 2px dashed var(--color-warning);
        background: transparent;
        color: var(--text-muted);
        opacity: 1;
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

    /* (edit-remove-place) motivo di blocco riga (D1: mai bottoni muti) */
    .action-hint {
        color: var(--text-muted);
        font-size: var(--font-size-xs);
        font-style: italic;
        margin-top: var(--space-1);
    }

    .unmount-detail {
        color: var(--text-secondary);
        font-weight: var(--font-weight-normal);
    }

    .mag-warning {
        background: var(--color-warning-bg);
        color: var(--color-warning);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-normal);
    }
</style>
