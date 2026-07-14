<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import CMDlist from '../../components/Comands/ComandsRows.vue';
    
    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    const el = ref()
</script>

<template>   
      <div class="view-shell view-shell--fill conf-card">
        <div class="view-header">
          <h3 class="view-title">{{$t('position.welcome')}}</h3>
          <!--button class="pure-button pure-button-primary" @click="createposition()">
            {{$t('position.add_position')}}
          </button-->
          <!--button class="pure-button pure-button-primary" @click="$router.push('/conf/positionOnPallet');">
            {{$t('position.PosOnPallet')}}
          </button-->
          <div class="searchBar">
            <input type="text" placeholder="search" v-model="searchQuery" class="search-input">
          </div>
        </div>

        <!-- Tab per categoria (pattern .tab-bar, doc §2.3): stesso stato del
             vecchio select (categoryFilter, ""=Tutte), stessi categoryOptions -->
        <div class="tab-bar">
          <button class="tab" :class="{ active: categoryFilter=='' }" @click="categoryFilter=''">
            {{$t('position.cat.all')}}
          </button>
          <button v-for="opt in categoryOptions" :key="opt.id"
            class="tab" :class="{ active: categoryFilter==opt.id }"
            @click="categoryFilter=opt.id">
            {{ opt.label }}
          </button>
        </div>
        <!-- zona tabella condivisa (.conf-card .table-scroll, custom-fix):
             pattern FILL, il thead sticky si aggancia qui -->
        <div class="table-scroll">
        <table class="pure-table pure-table-horizontal">
            <thead>
                <tr>
                    <!--th>ID</th-->
                    <th class="th-sort" @click="setSort('category')">
                        <img src="../../assets/lente.png" width="15px">
                        <br>
                        {{$t('name')}}
                        <span class="sort-ind" v-if="sortField=='category'">{{ sortDir==1?'▲':'▼' }}</span>
                    </th>
                    <th class="th-sort" @click="setSort('SUB_POS')">
                        <img src="../../assets/lente.png" width="15px">
                        <br>
                        {{$t('position.position')}}
                        <span class="sort-ind" v-if="sortField=='SUB_POS'">{{ sortDir==1?'▲':'▼' }}</span>
                    </th>
                    <th></th>
                    <th style="text-align:right">{{$t('position.Pos')}} [mm]</th>
                    <th style="text-align:right">{{$t('position.Correzione')}} [mm]</th>

                    <th style="text-align:right">{{$t('position.Rotazione')}} [°]</th>
                    <th style="text-align:right">{{$t('position.Correzione')}} [°]</th>
                    
                    <th style="text-align:right">{{$t('position.approach')}} [mm]</th>
                    <!--th>{{$t('position.comands')}}</th-->
                    <th>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <template v-for="group in viewGroups" :key="group.key">
                <template v-for="(dt,index) in group.rows" :key="dt.ID" >
                    <tr :class="{'pure-table-odd':(index % 2==1)}">
                        <!--td>{{dt.ID}} </td-->
                        <!--td v-if="dt.MAG>0">{{dt.MAG}}.{{dt.MAG_POS}} </td>
                        <td v-else><strong>OUT</strong></td-->

                        <td>{{getDescription(dt.PARENT.trim())}}</td>    
                        
                        <td>{{dt.SUB_POS>0?dt.SUB_POS:""}}</td>    

                        <td style="text-align:right">
                            <strong>X</strong><br>
                            <strong>Y</strong><br>
                            <strong>Z</strong>
                        </td>
                        <td style="text-align:right" :class="{'locked4OP':dt.ID==editID && dataStored.userLevel==0}">
                            <span v-if="dt.ID!=editID || dataStored.userLevel==0"> 
                                <span>{{getFormat(dt.X, dt.ID==editID)}} </span><br>
                                <span>{{getFormat(dt.Y, dt.ID==editID)}} </span><br>
                                <span>{{getFormat(dt.Z, dt.ID==editID)}} </span>
                            </span>
                            <span v-if="dt.ID==editID && dataStored.userLevel>=1"> 
                                <input type="number" step="0.01" v-model="datiInEdit.X" class="pos-input" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Y" class="pos-input" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Z" class="pos-input" />
                            </span>
                            <br>
                        </td>
                        <td style="text-align:right">
                            <span v-if="dt.ID!=editID"> 
                                <span>{{getFormat(dt.X_CORR, dt.ID==editID)}}</span><br>
                                <span>{{getFormat(dt.Y_CORR, dt.ID==editID)}}</span><br>
                                <span>{{getFormat(dt.Z_CORR, dt.ID==editID)}}</span>
                            </span>
                            <span v-if="dt.ID==editID"> 
                                <input type="number" step="0.01" v-model="datiInEdit.X_CORR" class="pos-input" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Y_CORR" class="pos-input" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Z_CORR" class="pos-input" />
                            </span>
                        </td>
                        
                        <td style="text-align:right" :class="{'locked4OP':dt.ID==editID && dataStored.userLevel==0}" >
                            <span v-if="dt.ID!=editID || dataStored.userLevel==0"> 
                                <span>{{getFormat(dt.X_ROT, dt.ID==editID)}}</span><br>
                                <span>{{getFormat(dt.Y_ROT, dt.ID==editID)}}</span><br>
                                <span>{{getFormat(dt.Z_ROT, dt.ID==editID)}}</span>
                            </span>
                            <span v-if="dt.ID==editID && dataStored.userLevel>=1"> 
                                <input type="number" step="0.01" v-model="datiInEdit.X_ROT" class="pos-input" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Y_ROT" class="pos-input" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Z_ROT" class="pos-input" />
                            </span>
                            <br>
                        </td>
                        <td style="text-align:right">
                            <span v-if="dt.ID!=editID "> 
                                <span>{{getFormat(dt.X_ROT_CORR)}}</span><br>
                                <span>{{getFormat(dt.Y_ROT_CORR)}}</span><br>
                                <span>{{getFormat(dt.Z_ROT_CORR)}}</span>
                            </span>
                            <span v-if="dt.ID==editID"> 
                                <input type="number" step="0.01" v-model="datiInEdit.X_ROT_CORR" class="pos-input" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Y_ROT_CORR" class="pos-input" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Z_ROT_CORR" class="pos-input" />
                            </span>
                        </td>

                        <td style="text-align:right">
                            <span v-if="dt.ID!=editID "> 
                                <span>{{getFormat(dt.APPROACH_X)}}</span><br>
                                <span>{{getFormat(dt.APPROACH_Y)}}</span><br>
                                <span>{{getFormat(dt.APPROACH_Z)}}</span>
                            </span>
                            <span v-if="dt.ID==editID"> 
                                <input type="number" step="0.001" v-model="datiInEdit.APPROACH_X" class="pos-input" /><br>
                                <input type="number" step="0.001" v-model="datiInEdit.APPROACH_Y" class="pos-input" /><br>
                                <input type="number" step="0.001" v-model="datiInEdit.APPROACH_Z" class="pos-input" />
                            </span>
                        </td>
                        
                        <td>
                            <CMDlist  
                                :modify="true && editID==0" @cmdModify="updatePosition(dt.ID)"
                                :save="editID==dt.ID"       @cmdSave="updatePosition(dt.ID)"
                            />
                            
                        </td>
                    </tr>
                    <tr v-if="_showPopUp(dt.ID)">
                        <td class="popUpOnLine" colspan="20" >
                            <div class="center">
                                <h3>{{ $t('position.sure') }}</h3>
                                <!--h4>{{ $t('position.delete') }}</h4-->
                                <span class="pure-g">
                                    <button class="pure-button-micromission specialCMD pure-u-1" @click="deleteposition(dt.ID)">
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
            datiTab:[],
            datiTabFiltred:[],
            showPopUp:0,
            polling:false,
            editID:0,
            datiInEdit:{},
            searchQuery:"",
            categoryFilter:"",      // id categoria selezionata, ""=Tutte
            sortField:"category",   // 'category' | 'SUB_POS'
            sortDir:1               // 1=asc, -1=desc
        }
    },
    methods: {
        getDataTable() {
            fetch(dataStored.server+'api/conf/position/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    console.log("ricevo dati per "+data.length+"  posizioni")  
                    this.datiTab=data    
                    this.datiTabFiltred = data;
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        getDescription(parent){
            let ris = parent
            if (parent.startsWith("SHELF"))
                ris = 'position.SHELF' 
            if (parent.startsWith("TRAY"))
                ris = 'position.TRAY' 
            if (parent.startsWith("EXTRACT_TRAY"))
                ris = 'position.EXTRACT_TRAY' 
            if (parent.startsWith("MC"))
                ris = 'position.MC'
            if (parent.startsWith("WPALLET"))
                ris = 'position.WPALLET'
            if (parent.startsWith("Pal"))
                return this.$t('Pallet') 
                       +" "+ 
                       parent.substring(parent.indexOf("Pal")+3,parent.indexOf("_"))
                       +" "+ 
                       this.$t('Fixture')
                       +" "+ 
                       parent.substring(parent.lastIndexOf("Fx")+2)
                
            if (parent.lastIndexOf("_")>0)
                return this.$t(ris)+ " "+ parent.substring(parent.lastIndexOf("_")+1);
            return this.$t(ris)
        },
        // Macro-categoria per filtro/raggruppamento/ordinamento, derivata da
        // PARENT (stessi prefissi di getDescription). id = chiave stabile e
        // ordinabile (prefisso alfabetico = ordine di presentazione),
        // label = testo per select e separatori. Cassetti e Pallet/Fixture
        // sono categorie UNICHE: il dettaglio resta nella colonna nome.
        getCategory(parent){
            if (parent.startsWith("SHELF"))
                return { id:'a_shelf',   label:this.$t('position.cat.shelf') };
            if (parent.startsWith("EXTRACT_TRAY"))
                return { id:'c_extract', label:this.$t('position.EXTRACT_TRAY').trim() };
            if (parent.startsWith("TRAY"))
                return { id:'b_tray',    label:this.$t('position.cat.trays') };
            if (parent.startsWith("MC")){
                let n = parent.lastIndexOf("_")>0 ? parent.substring(parent.lastIndexOf("_")+1) : '';
                return { id:'d_mc_'+n.padStart(2,'0'), label:(this.$t('position.MC')+' '+n).trim() };
            }
            if (parent.startsWith("WPALLET"))
                return { id:'e_wpallet', label:this.$t('position.cat.wpallet') };
            if (parent.startsWith("Pal"))
                return { id:'f_palfix',  label:this.$t('position.cat.palfix') };
            return { id:'z_other', label:this.$t('position.cat.other') };
        },
        setSort(field){
            if (this.sortField==field)
                this.sortDir = -this.sortDir;
            else{
                this.sortField = field;
                this.sortDir = 1;
            }
        },
        updatePosition(id){
            if (this.editID >0){
                //leggo i dati modificati e salvo su DB
                for (let i=0; i<this.datiTab.length; i++){
                    if (this.datiTab[i].ID == this.editID){
                        this.datiTab[i]             = this.datiInEdit;
                        this.datiInEdit.X           = this.datiInEdit.X          * 1000;
                        this.datiInEdit.Y           = this.datiInEdit.Y          * 1000;
                        this.datiInEdit.Z           = this.datiInEdit.Z          * 1000;
                        this.datiInEdit.X_CORR      = this.datiInEdit.X_CORR     * 1000;
                        this.datiInEdit.Y_CORR      = this.datiInEdit.Y_CORR     * 1000;
                        this.datiInEdit.Z_CORR      = this.datiInEdit.Z_CORR     * 1000;
                        this.datiInEdit.X_ROT       = this.datiInEdit.X_ROT      * 1000;
                        this.datiInEdit.Y_ROT       = this.datiInEdit.Y_ROT      * 1000;
                        this.datiInEdit.Z_ROT       = this.datiInEdit.Z_ROT      * 1000;
                        this.datiInEdit.X_ROT_CORR  = this.datiInEdit.X_ROT_CORR * 1000;
                        this.datiInEdit.Y_ROT_CORR  = this.datiInEdit.Y_ROT_CORR * 1000;
                        this.datiInEdit.Z_ROT_CORR  = this.datiInEdit.Z_ROT_CORR * 1000;
                        this.datiInEdit.APPROACH_X  = this.datiInEdit.APPROACH_X * 1000;
                        this.datiInEdit.APPROACH_Y  = this.datiInEdit.APPROACH_Y * 1000;
                        this.datiInEdit.APPROACH_Z  = this.datiInEdit.APPROACH_Z * 1000;

                        var cmd = dataStored.server+'api/conf/position/updateposition?' + new URLSearchParams( this.datiTab[i] ).toString();
                        fetch( cmd ,{ method: 'GET'})
                        .then(response => {
                            if (!response.ok) {
                                alert('Network response was not ok')
                                throw new Error('Network response was not ok');
                            }
                        })
                        .catch(error => {
                            alert(error);
                        });
                    }
                }
                this.editID = 0
                
            }else{
                //richiedo la modifica di una riga della tabella
                this.editID = id;
                for (let i=0; i<this.datiTab.length; i++)
                    if (this.datiTab[i].ID == id){
                        this.datiInEdit             = this.datiTab[i];
                        this.datiInEdit.X           = this.getFormat(this.datiInEdit.X);
                        this.datiInEdit.Y           = this.getFormat(this.datiInEdit.Y);
                        this.datiInEdit.Z           = this.getFormat(this.datiInEdit.Z);
                        this.datiInEdit.X_CORR      = this.getFormat(this.datiInEdit.X_CORR);
                        this.datiInEdit.Y_CORR      = this.getFormat(this.datiInEdit.Y_CORR);
                        this.datiInEdit.Z_CORR      = this.getFormat(this.datiInEdit.Z_CORR);
                        this.datiInEdit.X_ROT_CORR  = this.getFormat(this.datiInEdit.X_ROT_CORR);
                        this.datiInEdit.Y_ROT_CORR  = this.getFormat(this.datiInEdit.Y_ROT_CORR);
                        this.datiInEdit.Z_ROT_CORR  = this.getFormat(this.datiInEdit.Z_ROT_CORR);
                        this.datiInEdit.X_ROT       = this.getFormat(this.datiInEdit.X_ROT);
                        this.datiInEdit.Y_ROT       = this.getFormat(this.datiInEdit.Y_ROT);
                        this.datiInEdit.Z_ROT       = this.getFormat(this.datiInEdit.Z_ROT);
                        this.datiInEdit.APPROACH_X  = this.getFormat(this.datiInEdit.APPROACH_X);
                        this.datiInEdit.APPROACH_Y  = this.getFormat(this.datiInEdit.APPROACH_Y);
                        this.datiInEdit.APPROACH_Z  = this.getFormat(this.datiInEdit.APPROACH_Z);
                    }
            }
        },
        //getFormat(data){
        //    return (data/1000).toFixed(3); //.replace(".",",");
        //},
        getFormat(data, selected=false){
            if (selected && dataStored.userLevel==0)
                return (data/1).toFixed(3);    
            else
                return (data/1000).toFixed(3);
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
        }
    },
    watch:{
        searchQuery(search){
            //console.log(JSON.stringify(this.datiTab,null,4))
            if (search=="") 
                this.datiTabFiltred = this.datiTab;
            else{
                let query=search.toLowerCase();
                this.datiTabFiltred = this.datiTab.filter(item => {
                    let campoTradotto = this.getDescription(item.PARENT.trim())
                    return (
                        campoTradotto.toLowerCase().includes(query) ||
                        item.SUB_POS.toString().includes(query)
                    );
                })
            }
        },
        'datiInEdit.X_CORR'(newValue){
            if (newValue>dataStored.linTollerance)  this.datiInEdit.X_CORR = dataStored.linTollerance;
            if (newValue<-dataStored.linTollerance) this.datiInEdit.X_CORR = -dataStored.linTollerance;
        },
        'datiInEdit.Y_CORR'(newValue){
            if (newValue*1000>dataStored.linTollerance*1000)  this.datiInEdit.Y_CORR = dataStored.linTollerance;
            if (newValue<-dataStored.linTollerance) this.datiInEdit.Y_CORR = -dataStored.linTollerance;
            //if (newValue>dataStored.linTollerance*1000)  this.datiInEdit.Y_CORR = dataStored.linTollerance*1000;  //corregge durante la visualizzazione ma al DB arriva valore >5mm
        },
        'datiInEdit.Z_CORR'(newValue){
            if (newValue>dataStored.linTollerance)  this.datiInEdit.Z_CORR = dataStored.linTollerance;
            if (newValue<-dataStored.linTollerance) this.datiInEdit.Z_CORR = -dataStored.linTollerance;
        },
        'datiInEdit.X_ROT_CORR'(newValue){
            if (newValue>dataStored.rotTollerance)  this.datiInEdit.X_ROT_CORR = dataStored.rotTollerance;
            if (newValue<-dataStored.rotTollerance) this.datiInEdit.X_ROT_CORR = -dataStored.rotTollerance;
        },
        'datiInEdit.Y_ROT_CORR'(newValue){
            if (newValue>dataStored.rotTollerance)  this.datiInEdit.Y_ROT_CORR = dataStored.rotTollerance;
            if (newValue<-dataStored.rotTollerance) this.datiInEdit.Y_ROT_CORR = -dataStored.rotTollerance;
        },
        'datiInEdit.Z_ROT_CORR'(newValue){
            if (newValue>dataStored.rotTollerance)  this.datiInEdit.Z_ROT_CORR = dataStored.rotTollerance;
            if (newValue<-dataStored.rotTollerance) this.datiInEdit.Z_ROT_CORR = -dataStored.rotTollerance;
        }
    },
    computed: {
        // Opzioni del select categoria: solo categorie presenti nei dati.
        categoryOptions(){
            const seen = new Map();
            for (const dt of this.datiTab){
                const cat = this.getCategory(dt.PARENT.trim());
                if (!seen.has(cat.id))
                    seen.set(cat.id, cat);
            }
            return Array.from(seen.values()).sort((a,b)=>a.id.localeCompare(b.id));
        },
        // Vista a valle di datiTabFiltred (ricerca invariata): filtro
        // categoria -> sort -> gruppi. SOLO filter/slice().sort(): le
        // reference delle righe restano quelle di datiTab, obbligatorio
        // per non rompere l'aliasing datiInEdit del flusso di salvataggio.
        viewGroups(){
            let rows = this.datiTabFiltred;
            if (this.categoryFilter!="")
                rows = rows.filter(dt => this.getCategory(dt.PARENT.trim()).id==this.categoryFilter);
            const dir = this.sortDir;
            rows = rows.slice().sort((a,b)=>{
                const ca = this.getCategory(a.PARENT.trim()).id;
                const cb = this.getCategory(b.PARENT.trim()).id;
                if (this.sortField=='SUB_POS'){
                    const d = (a.SUB_POS-b.SUB_POS)*dir;
                    return d!=0 ? d : ca.localeCompare(cb);
                }
                const d = ca.localeCompare(cb)*dir;
                return d!=0 ? d : (a.SUB_POS-b.SUB_POS);
            });
            // Tab per categoria (feat positions-tabs, D3): niente piu'
            // righe-label di gruppo in tabella; l'ordinamento per categoria
            // nel tab "Tutte" resta invariato (sort qui sopra).
            return [{ key:'flat', label:null, rows:rows }];
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
    @media only screen and (max-width: 1028px) {
        .pure-table-horizontal  td {
            text-align: center;
        }
    }
    /* Zebra righe come productionTable (righe dispari --bg-input), riancorata
       alla .table-scroll condivisa. La classe pure-table-odd e' gia' bindata
       sulle righe ma il suo bg era sovrascritto dal td bg-base !important
       globale di custom-fix; questa regola piu' specifica lo ripristina.
       :not(.locked4OP) preserva l'evidenziazione warning delle celle bloccate.
       Promozione globale a tutte le liste: annotata in P3, post A/B. */
    .table-scroll tr.pure-table-odd td:not(.locked4OP){
        background: var(--bg-input) !important;
    }

    .popUpOnLine{
        background-image: url(/src/assets/up_red.png);
        background-repeat: no-repeat;
        background-position-x: 34%;
    }

    .popUpOnLine .btn-ghost {
        margin-top: var(--space-2);
    }

    /* 2px (non 1px --border-card): il popup di conferma delete deve
       staccare piu' di un bordo card. */
    .center {
        margin: auto;
        width: 20%;
        border: 2px solid var(--color-critical);
        padding: var(--space-6);
    }

    .locked4OP{
        background-image:url('/src/assets/chiaveIng.svg');

        background-repeat: no-repeat;
        background-size: 1.7em;
        /*background-position: left;*/
        background-position-x: 100%;
        background-position-y: 100%;
        background-color: var(--color-warning-bg);
    }

    /* K-FIX punto 5: search+filtro affiancati nella .view-header; via
       l'icona lente in background (era per il vecchio look chiaro). */
    .searchBar{
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-width: 0;   /* comprimibile dentro la view-header */
    }

    /* K-FIX3 2a: l'header non deve mai sforare il viewport — niente nowrap
       sul titolo (puo' andare a capo), la riga puo' wrappare e la search
       si comprime. */
    .view-header{
        flex-wrap: wrap;
    }

    /* Contenitore di scroll: ora e' la .table-scroll condivisa di custom-fix
       (flex:1 + min-height:0 + overflow y/x) — CSS scoped duplicato rimosso. */

    .th-sort{
        cursor: pointer;
        user-select: none;
    }

    .sort-ind{
        font-size: var(--font-size-xs);
    }

    /* Input canonico dark (regola F10: --border-strong sugli input). */
    .search-input{
        background: var(--bg-input);
        color: var(--text-primary);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        min-height: 44px;   /* touch target, come .cat-filter */
        padding: var(--space-2);
        font-size: var(--font-size-base);
        /* elastica: si comprime senza far sforare l'header (K-FIX3 2a) */
        flex: 1;
        min-width: 120px;
        max-width: 280px;
    }

    /* K-FIX2: larghezza fluida (segue il resize), min-width per i numeri
       a 2 decimali, cap per non allargare la colonna. */
    .pos-input{
        width: 100%;
        min-width: 80px;
        max-width: 120px;
        text-align: right;
    }

    /* .cat-filter e .cat-separator rimossi (feat positions-tabs): il select
       e le righe-label di gruppo sono sostituiti dalle tab .tab-bar. */
</style>
