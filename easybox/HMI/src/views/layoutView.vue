<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../data.js'

    import TrayPockets from '../components/layout/TrayPockets.vue'
    import { ROBOT_AXIS_ALONG } from '../util/gratingAxes.js'
    import { loadTrayPockets } from '../util/trayPockets.js'
    import { neighborTrays, pocketsSignature, layoutModeFor } from '../util/trayNeighbors.js'
    import { KO_ACTIVE_ORDER, KO_TRAY_EXTRACTED, KO_NO_PIECE_DECLARED, KO_PIECE_TOO_BIG, KO_Z_BELOW_GRATING } from '../util/errorCodes.js'
    import { POCKET_STATES } from '../util/pocketColors.js'
    // (v3 fase C, regola 4) tasche sotto i 44 px: il primo tocco ingrandisce
    import { pitchOf, needsZoom, zoomFactor, zoneAround, TRAY_FALLBACK } from '../util/trayZoom.js'
    import UiButton from '../components/ui/UiButton.vue'
    import { ZoomOut } from 'lucide-vue-next'
</script>


<template>
  <div class="view-shell">
    <!-- (P3 5/10) frecce al cassetto del piano precedente/successivo: i piani
         senza cassetto si saltano, agli estremi la freccia e' disabilitata,
         la modalita' (modifyEnable) resta quella corrente. -->
    <div class="layout-nav">
        <button type="button" class="btn-ghost layout-nav-btn"
            :disabled="!neighbors.prev || navBlocked"
            :title="neighbors.prev ? $t('layout.nav.toFloor', { floor: neighbors.prev.floor }) : $t('layout.nav.none')"
            @click="goNeighbor('prev')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 6 9 12 15 18" /></svg>
            <span v-if="neighbors.prev">{{ $t('TRAY') }} {{ neighbors.prev.floor }}</span>
        </button>
        <!-- (5/10) il cassetto si chiama col suo NUMERO (FLOOR_MAG, lo stesso di
             ExtractedTray nel PLC), non con l'ID della tabella TRAY: dopo il
             reinserimento dei piani 9-11 gli ID non corrispondono piu'. L'ID
             del database resta solo come tooltip. -->
        <h2 class="layout-title view-title" :title="$t('tray.dbId', { id: $route.params.trayID })">LAYOUT {{ $t('TRAY') }} {{ $route.params.floorMag }}</h2>
        <button type="button" class="btn-ghost layout-nav-btn"
            :disabled="!neighbors.next || navBlocked"
            :title="neighbors.next ? $t('layout.nav.toFloor', { floor: neighbors.next.floor }) : $t('layout.nav.none')"
            @click="goNeighbor('next')">
            <span v-if="neighbors.next">{{ $t('TRAY') }} {{ neighbors.next.floor }}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18" /></svg>
        </button>
    </div>

    <!-- (P3 5/10) modifiche locali non salvate: la freccia chiede prima di
         scartarle. Mai portare le tasche di questo cassetto su quello di arrivo. -->
    <div v-if="navConfirm" class="mission-dialog-overlay">
        <div class="mission-dialog mission-dialog--danger">
            <h3 class="command-section-title">{{ $t('layout.nav.discardTitle') }}</h3>
            <div class="reset-warn">{{ $t('layout.nav.discardText', { floor: $route.params.floorMag, to: navConfirm.floor }) }}</div>
            <div class="pure-g">
                <div class="pure-u-1-2">
                    <button style="width:100%" class="button_pressed pure-button-mission" @click="confirmDiscard()">
                        {{ $t('layout.nav.discardConfirm') }}
                    </button>
                </div>
                <div class="pure-u-1-2">
                    <button style="width:100%" class="btn-ghost" @click="navConfirm = null">
                        {{ $t('robot.dialog.cancel') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
	
    <div class="pure-u-1">
        <!-- (stato cella 16/9) il disegno delle tasche vive adesso in
             TrayPockets.vue: la stessa griglia serve al dialog "Reimposta
             stato cella" per far cliccare la tasca da correggere (comando
             39). Qui restano i dati e le regole di modifica. -->
        <!-- (v3 fase C, regola 4) in scala: contorno da TRAY.X x TRAY.Y,
             il disegno riempie il riquadro senza deformarsi. Se la tasca
             scende sotto i 44 px (4:3, grigliati fitti) il primo tocco
             ingrandisce la zona intorno (util/trayZoom.js) e solo nella zona
             ingrandita il tocco cambia lo stato della tasca: nessun tocco su
             bersagli piccoli. -->
        <div class="layout-draw">
            <TrayPockets fill
                :pockets="listPz"
                :dimX="dim_x" :dimY="dim_y" :radius="radius"
                :trayX="trayX / 1000" :trayY="trayY / 1000"
                :robotSide="robotSide" :zone="zona"
                @pick="toccaTasca($event)" @tap="toccaVassoio($event)" @scale="scala($event)" />
            <UiButton v-if="zona" class="layout-unzoom" variant="secondary" size="min" :icon="ZoomOut" @click="zona = null">
                {{ $t('trays.wholeTray') }}
            </UiButton>
        </div>
        <p v-if="zoomServe && !zona" class="layout-zoom-hint">{{ $t('trays.zoomHint') }}</p>
    </div>

    <div class="pure-u-1">
        <!-- (UI v2 fase 1.5) legenda dalla STESSA tabella del disegno
             (util/pocketColors.js): tutti gli stati, compreso IN LAVORO che
             prima mancava e BLOCCATA che prima era corallo nella legenda e
             nera nel disegno. Era un SVG a posizioni fisse con testi
             bianchi su grigio chiaro. -->
        <div class="pocket-legend">
            <span class="pocket-legend-title">{{ $t('layout.legend') }}</span>
            <span v-for="s in POCKET_STATES" :key="s.status" class="pocket-legend-item">
                <span class="pocket-swatch" :class="'pocket-swatch--' + s.key"
                    :style="{ background: 'var(' + s.token + ')' }"></span>
                {{ $t(s.label).trim() }}
            </span>
        </div>
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
            <div class="mission-dialog mission-dialog--danger">
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
            <div class="mission-dialog mission-dialog--danger">
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
                {{ $t('Save') }}
                <progress v-if="avanzamento>0" max="100" :value="avanzamento"> {{avanzamento}} </progress>
            </button>
        </div>
    </div>
    <div class="pure-u-1" v-if="$route.params.modifyEnable==0">
        <h2 class="blink"> {{ $t('layout.viewOnly') }} </h2>
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
                // misure del cassetto (TRAY.X / TRAY.Y, micron): contorno in scala
                trayX:0,
                trayY:0,
                // (v3 fase C) zona ingrandita (null = tutto il cassetto) e
                // scala del disegno intero (px per mm)
                zona: null,
                scalaPiena: 0,
                robotSide:false,   //visualizzazione del layout da parte del robot o dell'operatore
                avanzamento:0,
                trayReset: { open: false, busy: false },  // dialog AZZERA STATO CASSETTO
                // dialog DICHIARA CONTENUTO: scrive Part_Type su tutte le tasche
                trayType: { open: false, busy: false, pieceId: 0, error: '', errorParams: {} },
                pieces: [],
                // (P3 5/10) frecce fra cassetti
                trays: [],          // elenco cassetti (api/conf/tray/show/all, come TraysView)
                loadedSig: null,    // stato tasche come letto dal DB: diverso dall'attuale = modifiche non salvate
                navConfirm: null,   // vicino verso cui si vuole andare, in attesa di conferma
                saving: false       // Save! in corso: niente frecce finche' non ha finito di scrivere
            }
        },
        watch: {
            // (P3 5/10) Vue RIUSA il componente quando cambiano solo i parametri
            // della rotta (/layout/:trayID/:modifyEnable/:floorMag): senza questo
            // la pagina mostrerebbe le tasche del cassetto vecchio col titolo nuovo.
            '$route.params': {
                handler(to, from) {
                    if (!from || (to.trayID === from.trayID && to.floorMag === from.floorMag && to.modifyEnable === from.modifyEnable)) return;
                    this.listPz = [];
                    this.loadedSig = null;
                    this.navConfirm = null;
                    this.zona = null;
                    this.trayReset.open = false;
                    this.trayType.open = false;
                    this.getDataTable();
                }
            }
        },
        methods: {
            // (stato cella 16/9) la lettura delle tasche e la deduzione del
            // passo stanno in util/trayPockets.js: le usa anche il dialog di
            // dichiarazione della pagina robot, e una seconda copia sarebbe
            // divergita al primo ritocco.
            getDataTable() {
                const floor = String(this.$route.params.floorMag);
                loadTrayPockets(dataStored.server, floor)
                    .then(d => {
                        // (P3 5/10) risposta di un cassetto da cui si e' gia'
                        // usciti con le frecce: si scarta, non deve finire
                        // sotto il titolo del cassetto nuovo
                        if (String(this.$route.params.floorMag) !== floor) return;
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
                        this.trayX = d.trayX;
                        this.trayY = d.trayY;
                        this.avanzamento = 0;
                        this.loadedSig = pocketsSignature(this.listPz);
                    });
            },
            // (v3 fase C) tocco su una tasca: con tasche sotto i 44 px il primo
            // tocco ingrandisce, solo nella zona ingrandita cambia lo stato
            toccaTasca(ev) {
                if (!this.zona && this.zoomServe) {
                    this.zona = zoneAround(ev, this.trayDisegno, zoomFactor(this.geoTasche, this.scalaPiena));
                    return;
                }
                this.clickPiece(ev.index);
            },
            toccaVassoio(ev) {
                if (!this.zona && this.zoomServe)
                    this.zona = zoneAround(ev, this.trayDisegno, zoomFactor(this.geoTasche, this.scalaPiena));
            },
            scala(ev) {
                if (ev && !ev.zoned) this.scalaPiena = ev.pxPerMm;
            },
            // (P3 5/10) elenco cassetti per le frecce
            loadTrays() {
                fetch(dataStored.server + 'api/conf/tray/show/all', { method: 'GET' })
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                    .then(d => { this.trays = Array.isArray(d) ? d : []; })
                    .catch(e => { console.info(e); this.trays = []; });
            },
            goNeighbor(dir) {
                const n = this.neighbors[dir];
                if (!n || this.navBlocked) return;
                if (this.isDirty) { this.navConfirm = n; return; }
                this.navigateTo(n);
            },
            confirmDiscard() {
                const n = this.navConfirm;
                this.navConfirm = null;
                if (n) this.navigateTo(n);
            },
            navigateTo(n) {
                // (P3 audit 5/10) modalita' corrente, salvo un cassetto che
                // TraysView aprirebbe in sola lettura: stessa regola, una sola
                const mode = layoutModeFor(this.$route.params.modifyEnable, n.tray);
                this.$router.push('/layout/' + n.trayID + '/' + mode + '/' + n.floor);
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
                // (P3 5/10) il piano si fissa QUI, una volta: con le frecce la
                // rotta puo' cambiare mentre le scritture sono in volo, e il
                // cassetto di partenza non deve mai finire scritto su quello di
                // arrivo. Le frecce restano ferme finche' il Save non ha finito.
                const floor = this.$route.params.floorMag;
                const rows = this.listPz.slice();
                this.saving = true;
                const writes = rows.map((p, i) => {
                    // (dup-guard 4/9) si scrive il SUB_POS REALE della riga,
                    // non (i+1): con buchi/anomalie l'indice colpiva la tasca
                    // sbagliata (e SUB_POS oltre il massimo, no-op silenziosi)
                    const subPos = p.SUB_POS != null ? p.SUB_POS : (i+1);
                    return fetch(dataStored.server+'api/conf/position/updatePositionStatus/'+floor+"/"+subPos+"/"+p.status ,{ method: 'GET'})
                        .then( response => {
                            if (!response.ok) {
                                throw new Error('Network response was not ok');
                            }
                            this.avanzamento = Math.round(this.avanzamento + 100/rows.length)
                        })
                        .catch(error => {
                            console.info("-------------")
                            console.info(error);
                        });
                });
                // riletto DOPO le scritture: lo stato "salvato" e' quello del DB
                Promise.all(writes).finally(() => {
                    this.saving = false;
                    if (String(this.$route.params.floorMag) === String(floor)) this.getDataTable();
                });
            }
        },
        computed: {
            // (layout-axes 1/9) ROBOT_AXIS_ALONG documenta l'accoppiamento
            // fra assi robot e assi disegno (width <-> Y, height <-> X). La
            // conversione la fa TrayPockets con robotToDrawing: qui non c'e'
            // nessuna formula, e non deve tornarci.
            robotAxisAlong() { return ROBOT_AXIS_ALONG; },
            // (v3 fase C) passo fra le tasche (mm del disegno: w = y robot,
            // h = x robot) e contorno, per la zona ingrandita
            geoTasche() {
                const r = this.listPz || [];
                return { pitchW: pitchOf(r.map(p => p.y)), pitchH: pitchOf(r.map(p => p.x)), dimX: this.dim_x };
            },
            trayDisegno() {
                const k = this.trayX > 0 && this.trayY > 0;
                return { trayW: k ? this.trayX / 1000 : TRAY_FALLBACK.w, trayH: k ? this.trayY / 1000 : TRAY_FALLBACK.h };
            },
            zoomServe() { return needsZoom(this.geoTasche, this.scalaPiena); },
            // (P3 5/10) vicini del piano attuale nell'elenco cassetti
            neighbors() { return neighborTrays(this.trays, this.$route.params.floorMag); },
            // modifiche locali non salvate: solo in modifica, e solo dopo che
            // le tasche del cassetto sono state lette
            isDirty() {
                return this.$route.params.modifyEnable == 1 && this.loadedSig !== null
                    && pocketsSignature(this.listPz) !== this.loadedSig;
            },
            navBlocked() { return this.saving; },
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
            this.loadTrays()
        }
    }
</script>    


<style scoped>
    /* (v3 fase C) riquadro del disegno: altezza data, il cassetto ci sta
       dentro in scala (TrayPockets fill, meet) */
    .layout-draw {
        position: relative;
        width: 100%;
        height: clamp(280px, 52vh, 640px);
    }
    .layout-unzoom {
        position: absolute;
        top: var(--space-2);
        right: var(--space-2);
    }
    .layout-zoom-hint {
        margin: var(--space-1) 0 0;
        font-size: var(--font-size-sm);
        color: var(--text-muted);
    }
    /* (UI v2 fase 1.5) legenda stati tasca */
    .pocket-legend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-4);
        margin-top: var(--space-2);
    }
    .pocket-legend-title {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
    }
    .pocket-legend-item {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-size-sm);
        color: var(--text-primary);
    }
    .pocket-swatch {
        width: var(--icon-size-md);
        height: var(--icon-size-md);
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
    }
    /* come nel disegno: la "non definita" e' nera col suo bordo */
    .pocket-swatch--undef {
        border-color: var(--pocket-undef-border);
    }

    /* (P3 5/10) titolo fra le due frecce; touch 52 */
    .layout-nav {
        display: flex;
        align-items: center;
        gap: var(--space-4);
    }
    .layout-nav .layout-title {
        flex: 1;
        text-align: center;
    }
    .layout-nav-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-height: 52px;
        min-width: 52px;
        justify-content: center;
    }
    .layout-nav-btn svg {
        width: 22px;
        height: 22px;
    }
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
    /* dialog: stile comune in assets/css/dialogs.css (UI-DESIGN-SYSTEM v2 §12) */
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