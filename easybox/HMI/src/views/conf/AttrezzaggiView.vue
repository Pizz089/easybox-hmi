<script setup>
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

                        <td>
                            <span v-if="row.vice">{{(row.vice.FAMILY || '').trim()}} {{(row.vice.DESCR || '').trim()}}</span>
                            <span v-else class="badge badge-missing">{{$t('attrezzaggi.noVice')}}</span>
                        </td>

                        <td>
                            <span v-if="row.fixtures.length>0">
                                <div v-for="f in row.fixtures" :key="f.FIXTURE_ID">
                                    {{ fixtureName(f.FIXTURE_ID) }}
                                </div>
                            </span>
                            <span v-else class="badge badge-missing">{{$t('attrezzaggi.noFixture')}}</span>
                        </td>

                        <td>
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

    /* Badge di completezza: stessa grammatica dei badge status WORKING/EMPTY
       delle conf view (bg semantico + testo colore pieno + radius-lg),
       warning = attrezzaggio incompleto. */
    .badge {
        display: inline-block;
        padding: var(--space-1) var(--space-3);
        border-radius: var(--radius-lg);
        font-size: var(--font-size-sm);
    }

    .badge-missing {
        background-color: var(--color-warning-bg);
        color: var(--color-warning);
    }

    .action-btn {
        min-height: 44px;              /* azione secondaria in cella: deroga 44 come sidebar/diag */
        padding: var(--space-1) var(--space-3);
        font-size: var(--font-size-sm);
        margin: 2px var(--space-1);
    }
</style>
