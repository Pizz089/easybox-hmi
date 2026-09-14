<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';


    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    import { KO_IN_USE } from '../../util/errorCodes';
    // (grating-thickness) stessa regola del dialog cassetti e del server
    import { pickClearance } from '../../util/gratingGrid.js';

    const el = ref()
</script>

<!-- (grating-model) CATALOGO dei modelli: il grigliato e' un'entita' a se',
     senza cassetto. La colonna Cassetti e' SOLO informativa (TRAY.FAMILY =
     NAME): associare, sostituire, rigenerare e dissociare si fa dalla
     pagina Cassetti. La cancellazione e' rifiutata se un cassetto usa il
     modello (KO_IN_USE). -->
<template>
      <div class="view-shell view-shell--fill conf-card">
        <div class="view-header">
          <h3 class="view-title">{{$t('grating.welcome')}}</h3>
          <div class="btn-group">
            <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="createGrating()">
              {{$t('grating.createNew')}}
            </button>
            <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="importGrating()">
              {{$t('grating.importNew')}}
            </button>
          </div>
        </div>
        <div class="model-note">{{ $t('grating.catalogHint') }}</div>
        <div class="table-scroll">
        <table class="pure-table pure-table-horizontal">
            <thead>
                <tr>
                    <th>{{$t('grating.name')}}</th>
                    <th>{{$t('grating.descr')}}</th>
                    <th>{{$t('grating.usedByCol')}}</th>
                    <th>{{$t('GRIPPER')}}</th>
                    <th>{{$t('PIECE')}}</th>
                    <th>{{$t('grating.comands')}}</th>
                </tr>
            </thead>
            <tbody>
                <template v-for="(dt) in datiTab" :key="dt.ID" >
                    <tr :class="{'pure-table-odd':(dt.ID % 2==1)}">
                        <td>
                            {{dt.NAME.trim()}}
                            <!-- (grating-thickness) indicatore nel catalogo: pezzo del
                                 modello sotto spessore + franco. Si vede QUI, non solo
                                 quando qualcuno prova ad associare. -->
                            <span v-if="thicknessIssue(dt)" class="thick-badge"
                                  :title="$t('grating.thicknessWarn', { min: thicknessIssue(dt).min / 1000, pick: thicknessIssue(dt).zPick / 1000, place: thicknessIssue(dt).zPlace / 1000 })">
                                &#9888; {{ $t('grating.thicknessBadge') }}
                            </span>
                        </td>
                        <td>{{dt.DESCR.trim()}}</td>
                        <td>
                            <template v-if="dt.trays.length">
                                <button v-for="t in dt.trays" :key="t.TRAY_ID" class="btn-ghost tray-chip"
                                        @click="goToLayout(t.TRAY_ID, t.TraySTATUS, t.FLOOR_MAG)">
                                    <img src="../../assets/link.png" width="20em"/>&nbsp;{{ t.FLOOR_MAG }}
                                </button>
                            </template>
                            <span v-else class="model-muted">{{ $t('grating.usedByNone') }}</span>
                        </td>
                        <td>{{ dt.GRIPPER_DESC }}</td>
                        <td>{{ dt.PIECE_ID }}</td>
                        <td>
                            <orderCMD  :reference="createLink( dt.ID )"
                                       :index="dt.ID"
                                       modify="true" @cmdModify="$router.push('/conf/grating/'+dt.ID);"
                                       del="true"	 @cmdDel="sicurezza(dt.ID)"
                                       >
                            </orderCMD>
                        </td>
                    </tr>
                    <tr v-if="_showPopUp(dt.ID)">
                        <td class="popUpOnLine" colspan="20" >
                            <div class="center">
                                <h3>{{ $t('tray.sure') }}</h3>
                                <h4 v-if="dt.trays.length">{{ $t('grating.deleteInUse', { floors: dt.trays.map(t => t.FLOOR_MAG).join(', ') }) }}</h4>
                                <h4 v-else>{{ $t('grating.delete') }}</h4>
                                <span class="pure-g">
                                    <button class="pure-button-micromission specialCMD pure-u-1" :disabled="dt.trays.length>0" @click="deleteGrating(dt.ID)">
                                        DELETE
                                    </button>
                                    <button class="btn-ghost pure-u-1" @click="showPopUp=0">
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
// (grating-model) l'endpoint torna UNA riga per coppia modello-cassetto:
// qui si aggrega per ID -> { ...modello, trays: [{TRAY_ID, FLOOR_MAG, TraySTATUS}] }
export function groupGratings(rows) {
    const byId = new Map();
    for (const r of rows || []) {
        if (!byId.has(r.ID)) {
            const { TRAY_ID, FLOOR_MAG, MAG, TraySTATUS, ...model } = r;
            byId.set(r.ID, Object.assign(model, { trays: [] }));
        }
        if (r.FLOOR_MAG != null && r.FLOOR_MAG > 0)
            byId.get(r.ID).trays.push({ TRAY_ID: r.TRAY_ID, FLOOR_MAG: r.FLOOR_MAG, TraySTATUS: r.TraySTATUS });
    }
    const out = Array.from(byId.values());
    out.forEach(g => g.trays.sort((a, b) => a.FLOOR_MAG - b.FLOOR_MAG));
    return out;
}

export default {
    data(){
        return {
            datiTab:[],
            statusList:[],
            showPopUp:0,
			polling:true
        }
    },
    methods: {
        getDataTable() {
            fetch(dataStored.server+'api/conf/grating/showcompleteData/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(rows => {
                    this.datiTab = groupGratings(rows);
                    console.log("ricevo dati per "+this.datiTab.length+" grigliati")
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        createGrating(){
            this.$router.push('/conf/grating/0');  //passando ID=0 allora significa che è un nuovo grigliato da fare
        },
        importGrating(){
            this.$router.push('/conf/importGrating');  //prova bottone grating esistente
        },
        createLink(id) {
            let stringObj = new String(id);
            return "/conf/Grating/"+ stringObj ;
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
        },
        sicurezza(i){
            this.showPopUp=i
        },
		deleteGrating(id) {
			this.showPopUp=0
            // (grating-model) si cancella SOLO il modello: il backend rifiuta
            // (KO_IN_USE) se un cassetto lo usa — prima si dissocia dalla
            // pagina Cassetti. Nessuna cascata su tasche/TRAY.
            fetch(dataStored.server+'api/conf/grating/'+id ,{ method: 'delete'})
                .then(async response => {
                    if (!response.ok) {
                        alert('Network response was not ok');
                        throw new Error('Network response was not ok');
                    }
                    const esito = (await response.text()).trim();
                    if (esito == KO_IN_USE) {
                        alert(this.$t('grating.inUse'));
                        return;
                    }
                    if (esito != 'OK')
                        alert('KO ['+esito+']');
                    this.getDataTable();
                })
                .catch(error => {
                    console.info(error);
					alert(error);
                });
        },
        // (grating-thickness) null = ok o spessore non misurato; altrimenti
        // { min, zPick, zPlace } in micron per il badge e il suo tooltip
        thicknessIssue(dt){
            if (!(Number(dt.THICKNESS) > 0)) return null;
            const c = pickClearance({ thickness: dt.THICKNESS, zPick: dt.Z_PICK, zPlace: dt.Z_PLACE });
            return c.ok ? null : c;
        },
        goToLayout(Tray_ID,TraySTATUS,floor_MAG){
            if (TraySTATUS==dataStored.status_working)
                this.$router.push('/layout/'+Tray_ID+'/0/'+floor_MAG);
            else
                this.$router.push('/layout/'+Tray_ID+'/1/'+floor_MAG);
        },
    },
    computed:{
        locked(){
            if (dataStored.userLevel<=1)
                return 'locked4maintenance'
            return ''
        }
    },
    mounted(){
        this.getDataTable()
        setInterval(() => {
            if(this.polling)
                this.getDataTable()
        }, 3000);
    },
    unmounted(){
        this.polling=false;
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
    .popUpOnLine .btn-ghost {
        margin-top: var(--space-2);
    }
    /* (grating-model) chip per cassetto che usa il modello (link al layout) */
    .tray-chip {
        margin: 0 var(--space-1) var(--space-1) 0;
    }
    .model-muted {
        color: var(--text-muted);
    }
    /* (grating-thickness) pezzo del modello sotto spessore + franco */
    .thick-badge {
        color: var(--color-danger);
        font-size: 0.85em;
        margin-left: var(--space-1);
        white-space: nowrap;
    }
    .model-note {
        color: var(--text-secondary);
        font-size: 0.9em;
        margin-bottom: var(--space-2);
    }

    /* Uniformato alle altre list view: 2px (non 1px --border-card), il popup
       di conferma delete deve staccare piu' di un bordo card. */
    .center {
        margin: auto;
        width: 20%;
        border: 2px solid var(--color-critical);
        padding: var(--space-6);
    }
</style>
