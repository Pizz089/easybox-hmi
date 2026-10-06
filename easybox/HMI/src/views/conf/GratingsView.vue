<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';


    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    import { KO_IN_USE } from '../../util/errorCodes';
    // (grating-thickness) stessa regola del dialog cassetti e del server
    import { pickClearance } from '../../util/gratingGrid.js';
    // (v3 fase C) catalogo in card, componenti v3 (stili in assets/css/catalog-v3.css)
    import UiButton from '../../components/ui/UiButton.vue'
    import UiBadge from '../../components/ui/UiBadge.vue'
    import { Plus, Lock, FileInput, Grid3x3 } from 'lucide-vue-next'

    const el = ref()
</script>

<!-- (grating-model) CATALOGO dei modelli: il grigliato e' un'entita' a se',
     senza cassetto. La colonna Cassetti e' SOLO informativa (TRAY.FAMILY =
     NAME): associare, sostituire, rigenerare e dissociare si fa dalla
     pagina Cassetti. La cancellazione e' rifiutata se un cassetto usa il
     modello (KO_IN_USE). -->
<template>
      <!-- (v3 fase C) Magazzino · Grigliati: catalogo dei modelli in card,
           componenti v3. Campi, chiamate e conferme quelli di prima:
           Crea / Grigliato esistente dal livello 2 (lucchetto sotto),
           Modifica e Cancella da ComandsRows (stesse guardie), la conferma
           di cancellazione nella card con lo stesso testo (spenta se un
           cassetto usa il grigliato: prima si dissocia dalla pagina
           Cassetti). I cassetti che usano il modello portano alle loro
           tasche, come prima. -->
      <div class="view-shell view-shell--fill cat">
        <div class="cat-head">
          <h2 class="cat-head__title">{{$t('grating.welcome')}}</h2>
          <UiButton variant="secondary" :icon="dataStored.userLevel<=1 ? Lock : Plus" :disabled="dataStored.userLevel<=1" @click="createGrating()">
            {{$t('grating.createNew')}}
          </UiButton>
          <UiButton variant="primary" :icon="dataStored.userLevel<=1 ? Lock : FileInput" :disabled="dataStored.userLevel<=1" @click="importGrating()">
            {{$t('grating.importNew')}}
          </UiButton>
        </div>
        <p class="cat-note">{{ $t('grating.catalogHint') }}</p>
        <div class="cat-list">
          <template v-for="(dt) in datiTab" :key="dt.ID" >
            <article class="cat-card">
              <header class="cat-card__head">
                <span class="cat-card__code">{{dt.NAME.trim()}}</span>
                <!-- (grating-thickness) indicatore nel catalogo: pezzo del
                     modello sotto spessore + franco. Si vede QUI, non solo
                     quando qualcuno prova ad associare. -->
                <UiBadge v-if="thicknessIssue(dt)" class="thick-badge" tone="warning"
                      :title="$t('grating.thicknessWarn', { min: thicknessIssue(dt).min / 1000, pick: thicknessIssue(dt).zPick / 1000, place: thicknessIssue(dt).zPlace / 1000 })">
                    {{ $t('grating.thicknessBadge') }}
                </UiBadge>
              </header>
              <div class="cat-card__desc">{{dt.DESCR.trim()}}</div>
              <dl class="cat-card__facts">
                <div class="cat-card__trays">
                  <dt>{{$t('grating.usedByCol')}}</dt>
                  <dd>
                    <template v-if="dt.trays.length">
                      <button v-for="t in dt.trays" :key="t.TRAY_ID" type="button" class="cat-chip"
                              @click="goToLayout(t.TRAY_ID, t.TraySTATUS, t.FLOOR_MAG)">
                        <Grid3x3 class="cat-chip__icon" :stroke-width="2" aria-hidden="true" />{{ $t('TRAY') }} {{ t.FLOOR_MAG }}
                      </button>
                    </template>
                    <span v-else class="cat-muted">{{ $t('grating.usedByNone') }}</span>
                  </dd>
                </div>
                <div><dt>{{$t('GRIPPER')}}</dt><dd>{{ dt.GRIPPER_DESC }}</dd></div>
                <div><dt>{{$t('PIECE')}}</dt><dd>{{ dt.PIECE_ID }}</dd></div>
              </dl>
              <div class="cat-card__actions">
                <orderCMD  :reference="createLink( dt.ID )"
                           :index="dt.ID"
                           modify="true" @cmdModify="$router.push('/conf/grating/'+dt.ID);"
                           del="true"	 @cmdDel="sicurezza(dt.ID)"
                           >
                </orderCMD>
              </div>
              <div v-if="_showPopUp(dt.ID)" class="cat-card__confirm">
                <div class="cat-card__sure">
                  <b>{{ $t('tray.sure') }}</b>
                  <span v-if="dt.trays.length">{{ $t('grating.deleteInUse', { floors: dt.trays.map(t => t.FLOOR_MAG).join(', ') }) }}</span>
                  <span v-else>{{ $t('grating.delete') }}</span>
                </div>
                <UiButton variant="danger" size="min" :disabled="dt.trays.length>0" @click="deleteGrating(dt.ID)">
                  {{ $t('rowCmd.delete') }}
                </UiButton>
                <UiButton variant="outline" size="min" @click="showPopUp=0">
                  {{ $t('common.cancel') }}
                </UiButton>
              </div>
            </article>
          </template>
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
    /* (v3 fase C) card, intestazione e chip da assets/css/catalog-v3.css.
       (grating-thickness) il badge di spessore e' un UiBadge di attenzione. */
    .thick-badge { flex: none; }
</style>
