<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../data.js'

    import TrayPockets from '../components/layout/TrayPockets.vue'
    import { ROBOT_AXIS_ALONG } from '../util/gratingAxes.js'
    import { loadTrayPockets } from '../util/trayPockets.js'
    import { KO_ACTIVE_ORDER, KO_TRAY_EXTRACTED, KO_NO_PIECE_DECLARED, KO_PIECE_TOO_BIG, KO_Z_BELOW_GRATING } from '../util/errorCodes.js'
</script>


<template>
  <div class="view-shell">
    <h2 class="layout-title view-title">LAYOUT {{ $t('TRAY')}} ID{{$route.params.trayID }} - {{$t('piano')}}{{$route.params.floorMag }}</h2>
	
    <div class="pure-u-1">
        <!-- (stato cella 16/9) il disegno delle tasche vive adesso in
             TrayPockets.vue: la stessa griglia serve al dialog "Reimposta
             stato cella" per far cliccare la tasca da correggere (comando
             39). Qui restano i dati e le regole di modifica. -->
        <TrayPockets
            :pockets="listPz"
            :dimX="dim_x" :dimY="dim_y" :radius="radius"
            :robotSide="robotSide"
            @pick="clickPiece($event.index)" />
    </div>

    <div class="pure-u-1">
        <svg width="480" height="100" 
            version="1.1" xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 480 100" style="margin-left:60px">
            
            <rect x="51" y="0" width="50" height="50" style="fill:lightgray" />
            <text x="58" y="28" style="fill:white;font-family:times;font-size:10">EMPTY</text>

            <rect x="103" y="0" width="50" height="50" style="fill:green" />
            <text x="116" y="28" style="fill:white;font-family:times;font-size:10">RAW</text>

            <rect x="155" y="0" width="50" height="50" style="fill:black" />
            <text x="159" y="28" style="fill:white;font-family:times;font-size:10">NOT DEF</text>

            <rect x="207" y="0" width="50" height="50" style="fill:coral" />
            <text x="217" y="28" style="fill:white;font-family:times;font-size:10">LOCK</text>

            <rect x="259" y="0" width="50" height="50" style="fill:#080866" />
            <text x="261" y="28" style="fill:white;font-family:times;font-size:10">FINISHED</text>

            <rect x="311" y="0" width="50" height="50" style="fill:red" />
            <text x="318" y="28" style="fill:white;font-family:times;font-size:10">ABORT</text>

            <text x="0" y="28" style="fill:white;font-family:times;font-size:10">LEGEND:</text>
        </svg>
    </div>

    <div class="pure-u-3-4" v-if="$route.params.modifyEnable==1">
        <div class="btn-group">
            <button class="btn-ghost" @click="allRaugh()">Tutti grezzi </button>
            <button class="btn-ghost" @click="allEmpty()">Tutti vuoti </button>
            <!-- AZZERA STATO CASSETTO (1/9): a differenza di "Tutti grezzi"
                 (modifica LOCALE, scritta solo col Save! tasca per tasca e
                 senza toccare Order_ID) e' un ripristino IMMEDIATO e atomico
                 lato backend: STATUS=4 + Order_ID=0 su tutte le tasche, con
                 guardia ordine attivo e conferma esplicita -->
            <button class="pure-button-micromission specialCMD" @click="openTrayReset()">
                {{ $t('layout.reset.button') }}
            </button>
            <!-- DICHIARA CONTENUTO (16/9): il codice pezzo del cassetto e'
                 POSITION.Part_Type, ed e' quello che il ciclo cerca. Finora
                 si poteva cambiare solo riassociando il grigliato, cioe'
                 rifacendo l'attrezzaggio per svuotare un cassetto e
                 riempirlo con un altro particolare. Il grigliato e' la
                 geometria e non cambia: cambia cosa c'e' dentro. Sta qui
                 perche' questa e' la pagina del CONTENUTO del cassetto, la
                 stessa dove si dichiara quali tasche sono piene. -->
            <button class="pure-button-micromission specialCMD" @click="openTrayType()">
                {{ $t('layout.type.button') }}
            </button>
        </div>

        <div v-if="trayReset.open" class="mission-dialog-overlay">
            <div class="mission-dialog">
                <h3 class="command-section-title">{{ $t('layout.reset.title', { floor: $route.params.floorMag }) }}</h3>
                <div class="reset-text">{{ $t('layout.reset.what', { n: listPz.length }) }}</div>
                <div class="reset-warn">{{ $t('layout.reset.warn') }}</div>
                <div class="pure-g">
                    <div class="pure-u-1-2">
                        <button style="width:100%" class="button_pressed"
                            :class="[trayReset.busy ? 'pure-button-disable' : 'pure-button-mission']"
                            @click="trayReset.busy ? '' : confirmTrayReset()">
                            {{ $t('layout.reset.confirm') }}
                        </button>
                    </div>
                    <div class="pure-u-1-2">
                        <button style="width:100%" class="btn-ghost" @click="trayReset.open=false">
                            {{ $t('robot.dialog.cancel') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <!-- si sceglie il codice, e la conferma dice quante tasche cambiano e
             che il ciclo guardera' quel codice: non e' un'etichetta -->
        <div v-if="trayType.open" class="mission-dialog-overlay">
            <div class="mission-dialog">
                <h3 class="command-section-title">{{ $t('layout.type.title', { floor: $route.params.floorMag }) }}</h3>
                <div class="reset-text">{{ $t('layout.type.current', { code: currentTypeLabel }) }}</div>
                <div class="type-field">
                    <label for="tray-type">{{ $t('layout.type.choose') }}</label>
                    <select id="tray-type" v-model.number="trayType.pieceId" class="type-select">
                        <option :value="0">-</option>
                        <option v-for="p in pieces" :key="p.ID" :value="p.ID">
                            #{{ p.ID }} {{ (p.FAMILY || '').trim() }} - {{ (p.DESCR || '').trim() }}
                        </option>
                    </select>
                </div>
                <div class="reset-warn" v-if="trayType.pieceId > 0">
                    {{ $t('layout.type.what', { n: listPz.length, code: trayType.pieceId }) }}
                </div>
                <div class="reset-text">{{ $t('layout.type.hint') }}</div>
                <div class="reset-warn" v-if="trayType.error">{{ $t(trayType.error, trayType.errorParams) }}</div>
                <div class="pure-g">
                    <div class="pure-u-1-2">
                        <button style="width:100%" class="button_pressed"
                            :class="[trayType.busy || !(trayType.pieceId > 0) ? 'pure-button-disable' : 'pure-button-mission']"
                            @click="(trayType.busy || !(trayType.pieceId > 0)) ? '' : confirmTrayType()">
                            {{ $t('layout.type.confirm') }}
                        </button>
                    </div>
                    <div class="pure-u-1-2">
                        <button style="width:100%" class="btn-ghost" @click="trayType.open=false">
                            {{ $t('robot.dialog.cancel') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div class="btn-group save-row">
            <button class="pure-button-primary" @click="saveAllData()">
                Save!
                <progress v-if="avanzamento>0" max="100" :value="avanzamento"> {{avanzamento}} </progress>
            </button>
        </div>
    </div>
    <div class="pure-u-1" v-if="$route.params.modifyEnable==0">
        <h2 class="blink"> VIEW ONLY!! </h2>
    </div>
  </div>
</template>

<script>
    export default {
        data() {
            return {
                listPz:[
                    //{prisma:true, x:700, y:500, status:7},
                ],
                dim_x:0,
                dim_y:0,
                radius:0,
                robotSide:false,   //visualizzazione del layout da parte del robot o dell'operatore
                avanzamento:0,
                trayReset: { open: false, busy: false },  // dialog AZZERA STATO CASSETTO
                // dialog DICHIARA CONTENUTO: scrive Part_Type su tutte le tasche
                trayType: { open: false, busy: false, pieceId: 0, error: '', errorParams: {} },
                pieces: []
            }
        },
        methods: {
            // (stato cella 16/9) la lettura delle tasche e la deduzione del
            // passo stanno in util/trayPockets.js: le usa anche il dialog di
            // dichiarazione della pagina robot, e una seconda copia sarebbe
            // divergita al primo ritocco.
            getDataTable() {
                loadTrayPockets(dataStored.server, this.$route.params.floorMag)
                    .then(d => {
                        // righe duplicate a DB: si disegnano le prime, ma
                        // l'anomalia si dice (mai in silenzio)
                        if (d.dups > 0) {
                            dataStored.alert.title = this.$t('WARNING');
                            dataStored.alert.desc = this.$t('layout.dupRows', { n: d.dups, floor: this.$route.params.floorMag });
                            dataStored.alert.type = 'warning';
                        }
                        this.listPz = d.rows;
                        this.dim_x = d.dimX;
                        this.dim_y = d.dimY;
                        this.radius = d.radius;
                        this.avanzamento = 0;
                    });
            },
            getPieces() {
                fetch(dataStored.server + 'api/conf/piece/show/all', { method: 'GET' })
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                    .then(d => { this.pieces = (d || []).filter(p => p.X > 0 && p.Y > 0); })
                    .catch(e => { console.info(e); this.pieces = []; });
            },
            openTrayType() {
                this.trayType.open = true;
                this.trayType.busy = false;
                this.trayType.error = '';
                this.trayType.errorParams = {};
                // si parte dal codice attuale: si CONFERMA o si cambia, non si
                // riparte da vuoto con la lista davanti
                this.trayType.pieceId = this.listPz.length ? (Number(this.listPz[0].partType) || 0) : 0;
            },
            confirmTrayType() {
                if (this.trayType.busy || !(this.trayType.pieceId > 0)) return;
                this.trayType.busy = true;
                this.trayType.error = '';
                this.trayType.errorParams = {};
                fetch(dataStored.server + 'api/conf/position/declareTrayType/' +
                      this.$route.params.floorMag + '/' + this.trayType.pieceId, { method: 'POST' })
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                    .then(out => {
                        this.trayType.busy = false;
                        // (http-status) l'esito applicativo viaggia nel CORPO: va
                        // letto, altrimenti un rifiuto passa per dichiarazione fatta
                        if (!out || out.ris != 'OK') {
                            const code = out ? out.ris : 'KO';
                            this.trayType.error =
                                code == KO_ACTIVE_ORDER      ? 'layout.type.err.activeOrder' :
                                code == KO_TRAY_EXTRACTED    ? 'layout.type.err.extracted' :
                                code == KO_NO_PIECE_DECLARED ? 'layout.type.err.noPiece' :
                                // il pezzo dichiarato non ci sta: si dicono i
                                // millimetri di sforo, non "non valido"
                                code == KO_PIECE_TOO_BIG     ? 'layout.type.err.tooBig' :
                                code == KO_Z_BELOW_GRATING   ? 'layout.type.err.thickness' :
                                                               'layout.type.err.generic';
                            this.trayType.errorParams =
                                code == KO_PIECE_TOO_BIG   ? { pitch: (out.pitch || 0) / 1000, over: (out.over || 0) / 1000 } :
                                code == KO_Z_BELOW_GRATING ? { min: (out.min || 0) / 1000, pick: (out.zPick || 0) / 1000, place: (out.zPlace || 0) / 1000 } : {};
                            return;
                        }
                        this.trayType.open = false;
                        dataStored.alert.title = 'INFO';
                        dataStored.alert.desc = this.$t('layout.type.done', { n: out.positions, code: this.trayType.pieceId });
                        dataStored.alert.type = 'message';
                        this.getDataTable();
                    })
                    .catch(e => { console.info(e); this.trayType.busy = false; this.trayType.error = 'layout.type.err.generic'; });
            },
            changeSide(){
                this.robotSide =! this.robotSide;
                
                let temp = [];
                console.log(this.listPz.length)
                //for (let i=0; i<this.listPz.length; i++){
                //let obj = {}
                //    obj.partType=this.listPz[this.listPz.length-1-i].partType;
                //    obj.prisma=this.listPz[this.listPz.length-1-i].prisma;
                //    if (this.robotSide){
                //        obj.x=820-this.listPz[this.listPz.length-1-i].x;
                //        obj.y=615-this.listPz[this.listPz.length-1-i].y;
                //    }else{
                //        obj.x=this.listPz[this.listPz.length-1-i].x;
                //        obj.y=this.listPz[this.listPz.length-1-i].y;
                //    }
                //    obj.status=this.listPz[i].status;
                //    obj.order_ID=this.listPz[i].order_ID;
                //    
                //    temp.push(obj);
                //}
                
                for (let i=this.listPz.length; i>0; i--){
                    let obj = {}
                    obj.partType=this.listPz[i-1].partType;
                    obj.prisma=this.listPz[i-1].prisma;
                    if (this.robotSide){
                        obj.x=820-this.listPz[i-1].x;
                        obj.y=615-this.listPz[i-1].y;
                    }else{
                        obj.x=this.listPz[i-1].x;
                        obj.y=this.listPz[i-1].y;
                    }
                    obj.status=this.listPz[i-1].status;
                    obj.order_ID=this.listPz[i-1].order_ID;
                    
                    if (i==1 || i==12)
                        console.log(i+":\n"+JSON.stringify(obj, null,4))
                    temp.push(obj);
                }

                this.listPz = temp;
            },
            clickPiece(index){
                //if (this.$route.params.modifyEnable==0) 
                //    return
                //alert(this.robotSide?this.listPz.length-index:index+1);
                //let idx=0;
                //if (this.robotSide)
                //    idx=this.listPz.length-index
                //else
                //    idx=index
                if (this.listPz[index].order_ID>0){
                    dataStored.alert.title="POSITION LOCKED!";
                    dataStored.alert.desc="Position already associated with an order and order active!";
                    return
                }
                if (this.$route.params.modifyEnable==0){
                    dataStored.alert.title="ATTENTION";
                    dataStored.alert.desc="VIEW ONLY!";
                    return
                }
                switch (this.listPz[index].status){
                    case dataStored.status_notDef:                          //NOT DEFINITED    
                        this.listPz[index].status=dataStored.status_empty;  //EMPTY     
                        break;                       
                    case dataStored.status_empty:                           //EMPTY
                        this.listPz[index].status=dataStored.status_raw;    //RAW    
                        break;
                    case dataStored.status_raw:                             //RAW    
                        this.listPz[index].status=dataStored.status_finished;//NOT DEFINITED    
                        break;
                    case dataStored.status_finished:                        //FINISHED
                        this.listPz[index].status=dataStored.status_notDef; //NOT DEFINITED    
                        break;
                    case dataStored.status_aborted:                         //ABORT
                        this.listPz[index].status=dataStored.status_notDef; //NOT DEFINITED    
                        break;
                    case 9: //LOCKED
                        alert("POSITION LOCKED!");
                        break;
                } 
            },
            checkIfOrderChanged(i){
                if (this.listPz[i].order_ID==0) 
                    return false
                if ( this.listPz[0].order_ID != this.listPz[i].order_ID)
                    return true;
                else 
                    return true
            },
            // AZZERA STATO CASSETTO: solo via dialog; l'esecuzione e' del
            // backend (POST resetTray/:floor, guardia ordine attivo inclusa)
            openTrayReset() {
                this.trayReset.open = true;
            },
            confirmTrayReset() {
                if (this.trayReset.busy) return;
                this.trayReset.busy = true;
                fetch(dataStored.server + 'api/conf/position/resetTray/' + this.$route.params.floorMag, { method: 'POST' })
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.text(); })
                    .then(body => {
                        let row = null;
                        try { row = JSON.parse(body); } catch (_) { row = { ris: body.trim() }; }
                        this.trayReset.open = false;
                        if (row.ris === 'OK') {
                            dataStored.alert.title = 'INFO';
                            dataStored.alert.desc = this.$t('layout.reset.done', { n: row.positions });
                            dataStored.alert.type = 'message';
                            this.getDataTable();
                        } else if (row.ris === KO_ACTIVE_ORDER) {
                            dataStored.alert.title = this.$t('WARNING');
                            dataStored.alert.desc = 'layout.reset.activeOrder';
                            dataStored.alert.type = 'warning';
                        } else {
                            dataStored.alert.title = this.$t('WARNING');
                            dataStored.alert.desc = 'layout.reset.failed';
                            dataStored.alert.type = 'warning';
                        }
                    })
                    .catch(e => {
                        console.info(e);
                        this.trayReset.open = false;
                        dataStored.alert.title = this.$t('WARNING');
                        dataStored.alert.desc = 'layout.reset.failed';
                        dataStored.alert.type = 'warning';
                    })
                    .finally(() => { this.trayReset.busy = false; });
            },
            allRaugh(){
                for (let i=0; i<this.listPz.length; i++){
                    this.listPz[i].status = 4;
                }
            },
            allEmpty(){
                for (let i=0; i<this.listPz.length; i++){
                    this.listPz[i].status = 2;
                }
            },
            saveAllData(){
                for (let i=0; i<this.listPz.length; i++){
                    // (dup-guard 4/9) si scrive il SUB_POS REALE della riga,
                    // non (i+1): con buchi/anomalie l'indice colpiva la tasca
                    // sbagliata (e SUB_POS oltre il massimo, no-op silenziosi)
                    const subPos = this.listPz[i].SUB_POS != null ? this.listPz[i].SUB_POS : (i+1);
                    fetch(dataStored.server+'api/conf/position/updatePositionStatus/'+this.$route.params.floorMag+"/"+subPos+"/"+this.listPz[i].status ,{ method: 'GET'})
                        .then( response => {
                            if (!response.ok) {
                                throw new Error('Network response was not ok');
                            }
                            this.avanzamento = Math.round(this.avanzamento + 100/this.listPz.length)
                        })
                        .catch(error => {
                            console.info("-------------")
                            console.info(error);
                        });
                }
                this.getDataTable();
            }
        },
        computed: {
            // (layout-axes 1/9) ROBOT_AXIS_ALONG documenta l'accoppiamento
            // fra assi robot e assi disegno (width <-> Y, height <-> X). La
            // conversione la fa TrayPockets con robotToDrawing: qui non c'e'
            // nessuna formula, e non deve tornarci.
            robotAxisAlong() { return ROBOT_AXIS_ALONG; },
            // codice dichiarato ADESSO: viene dalle tasche, non dal grigliato.
            // 0 o assente = nessun codice, cassetto invisibile al ciclo: si
            // dice, non si mostra un numero che sembra un dato.
            currentTypeLabel() {
                const t = this.listPz.length ? Number(this.listPz[0].partType) : 0;
                if (!(t > 0)) return this.$t('layout.type.none');
                const p = this.pieces.find(x => x.ID == t);
                return '#' + t + (p ? ' ' + String(p.FAMILY || '').trim() : '');
            }
        },
        mounted(){
            this.getDataTable()
            this.getPieces()
        }
    }
</script>    


<style scoped>
    .layout-title {
        color: var(--text-secondary);
    }

    /* LY4: warning lampeggiante (status, non azione -> --color-warning);
       niente font-family locale, governa il token globale. */
    .blink {
        animation: blinker 1.5s linear infinite;
        color: var(--color-warning);
        text-align: center;
    }
    @keyframes blinker {
        50% {
            opacity: 0;
        }
    }

    /* Spaziatura extra della riga Save sotto i bulk (il resto dal .btn-group). */
    .save-row {
        margin-top: var(--space-2);
    }

    /* dialog AZZERA STATO CASSETTO: stesso overlay delle view missione */
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
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }
    .reset-text {
        color: var(--text-primary);
    }
    .reset-warn {
        background: var(--color-warning-bg);
        color: var(--color-warning);
        border: 1px solid var(--color-warning);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font-weight: var(--font-weight-semibold);
    }
</style>