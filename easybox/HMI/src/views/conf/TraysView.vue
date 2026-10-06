<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    // (v3 fase C) cassettiera + cassetto in scala, componenti v3
    import TrayPockets from '../../components/layout/TrayPockets.vue'
    import UiButton from '../../components/ui/UiButton.vue'
    import UiBadge from '../../components/ui/UiBadge.vue'
    import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Grid3x3, SlidersHorizontal, Lock, ZoomOut, X } from 'lucide-vue-next'
    import { loadTrayPockets } from '../../util/trayPockets.js'
    import { POCKET_STATES, pocketState } from '../../util/pocketColors.js'
    import { pitchOf, needsZoom, zoomFactor, zoneAround, TRAY_FALLBACK } from '../../util/trayZoom.js'

    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    // (grating-model) associazione grigliato <-> cassetto: griglia dalla
    // stessa util dell'anteprima modello, ingombro e avviso taratura
    import { buildGrid, gridCenters, taughtMismatch, pickClearance } from '../../util/gratingGrid.js'
    import { gridFit } from '../../util/gratingAxes.js'
    import { KO_TRAY_EXTRACTED, KO_ACTIVE_ORDER, KO_ALREADY_ASSOCIATED, KO_SOURCE_EMPTY, KO_OUT_OF_TRAY, KO_Z_BELOW_GRATING, KO_NO_PIECE_DECLARED } from '../../util/errorCodes.js'
    import StatoElenco from '../../components/StatoElenco.vue'
    import { caricaElenco, STATO } from '../../util/caricaElenco.js'
    // (P3 audit 5/10) regola unica "si apre in sola lettura", condivisa con le frecce del layout
    import { trayOpensReadOnly, neighborTrays } from '../../util/trayNeighbors.js'
    const el = ref()
</script>

<template>
      <!-- (v3 fase C) Magazzino · Cassetti, tavole Magazzino e Magazzino43.
           A sinistra la CASSETTIERA: un piano per riga col suo numero
           (FLOOR_MAG, non l'ID), righe x colonne del grigliato, riempimento
           per stato coi colori della fase 1.5 (uno stato, un colore) e
           Dentro/Fuori. A destra il CASSETTO SCELTO disegnato in scala
           (TrayPockets, regola 4) con legenda e conteggi; toccando una tasca
           se ne vede il contenuto (pezzo, stato, ordine), in sola lettura.
           Comandi, abilitazioni e conferme sono quelli della tabella di prima,
           con lo stesso percorso (anche le guardie che stavano in
           ComandsRows): cambia il posto, si danno dal cassetto scelto invece
           che dalla riga. tests/test_golden_equivalenza.mjs (2c) li confronta
           scegliendo un cassetto alla volta.
           (P1 5/10, decisione 29/9) niente "Aggiungi" ne' "Elimina": i
           cassetti sono la cassettiera fisica.
           (6/10) "0 CASSETTIERA" ELIMINATO, decisione di Dario: con i work
           object per cassetto non ha piu' senso e scriverebbe in TRAY valori
           assurdi. Le rotazioni si impostano cassetto per cassetto dalla
           scheda del cassetto. Il codice di prima e' nella storia git,
           commit 7fc7964. -->
      <div class="trays">
        <section class="trays-rack" :aria-label="$t('trays.rack')">
          <header class="trays-rack__head">
            <span class="trays-label">{{ $t('trays.rack') }}</span>
            <span class="trays-rack__n">{{ $t('trays.floors', { n: piani.length }) }}</span>
          </header>
          <div class="trays-rack__list">
            <button v-for="dt in piani" :key="dt.ID" type="button" class="rack-row"
              :class="{ on: sel && dt.ID === sel.ID }" :aria-pressed="!!(sel && dt.ID === sel.ID)"
              :title="$t('tray.dbId', { id: dt.ID })"
              @click="scegli(dt)">
              <span class="rack-row__n">{{ dt.FLOOR_MAG > 0 ? dt.FLOOR_MAG : $t('common.out') }}</span>
              <span class="rack-row__body">
                <span class="rack-row__info">
                  <span class="rack-row__grid" v-if="geoPiano(dt).rows">{{ geoPiano(dt).rows }} <i>×</i> {{ geoPiano(dt).cols }}</span>
                  <span class="rack-row__grid" v-else>–</span>
                  <span class="rack-row__txt">{{ contenutoPiano(dt) }}</span>
                </span>
                <span class="rack-bar" aria-hidden="true">
                  <i v-for="seg in barraPiano(dt)" :key="seg.key" :style="{ width: seg.pct + '%', background: 'var(' + seg.token + ')' }"></i>
                </span>
              </span>
              <span class="rack-row__where" :class="'is-' + dove(dt).key">{{ $t(dove(dt).label) }}</span>
            </button>
          </div>
          <!-- (usabilita' 15/9) elenco senza righe: si dice PERCHE' -->
          <StatoElenco
            :stato="statoElenco"
            :vuoto="datiTab.length === 0"
            :messaggio-vuoto="$t('tray.nessuno')"
            @riprova="getDataTable()"
          />
        </section>

        <section v-if="sel" class="tray-panel">
          <header class="tray-panel__head">
            <div class="tray-panel__title">
              <h2 class="tray-panel__name" :title="$t('tray.dbId', { id: sel.ID })">{{ $t('TRAY') }} {{ sel.FLOOR_MAG > 0 ? sel.FLOOR_MAG : $t('common.out') }}</h2>
              <UiBadge :tone="dove(sel).tone">{{ $t(dove(sel).label) }}</UiBadge>
            </div>
            <!-- frecce al piano sotto e a quello sopra: i piani senza cassetto
                 si saltano (util/trayNeighbors.js, come nella pagina layout) -->
            <div class="tray-panel__nav">
              <UiButton variant="outline" :icon="ChevronLeft" :disabled="!vicini.prev"
                :title="vicini.prev ? $t('layout.nav.toFloor', { floor: vicini.prev.floor }) : $t('layout.nav.none')"
                :aria-label="vicini.prev ? $t('layout.nav.toFloor', { floor: vicini.prev.floor }) : $t('layout.nav.none')"
                @click="scegliPiano(vicini.prev)">
                <span v-if="vicini.prev" class="tray-panel__navlbl">{{ $t('TRAY') }} {{ vicini.prev.floor }}</span>
              </UiButton>
              <UiButton variant="outline" :disabled="!vicini.next"
                :title="vicini.next ? $t('layout.nav.toFloor', { floor: vicini.next.floor }) : $t('layout.nav.none')"
                :aria-label="vicini.next ? $t('layout.nav.toFloor', { floor: vicini.next.floor }) : $t('layout.nav.none')"
                @click="scegliPiano(vicini.next)">
                <span v-if="vicini.next" class="tray-panel__navlbl">{{ $t('TRAY') }} {{ vicini.next.floor }}</span>
                <ChevronRight class="tray-panel__navico" :stroke-width="2" aria-hidden="true" />
              </UiButton>
            </div>
          </header>
          <p class="tray-panel__sub">{{ sottotitolo }}</p>

          <div class="tray-panel__draw">
            <div class="tray-panel__frame">
              <TrayPockets fill
                :pockets="tasche.rows"
                :dimX="tasche.dimX" :dimY="tasche.dimY" :radius="tasche.radius"
                :trayX="trayDisegno.noto ? trayDisegno.trayW : 0" :trayY="trayDisegno.noto ? trayDisegno.trayH : 0"
                :zone="zona" :showOrigin="false" :showCenters="false" :showOrders="false"
                :selected="tascaScelta ? tascaScelta.subPos : null"
                @pick="toccaTasca($event)" @tap="toccaVassoio($event)" @scale="scala($event)" />
              <p v-if="tasche.letto && tasche.rows.length === 0" class="tray-panel__empty">{{ $t('trays.noPockets') }}</p>
              <UiButton v-if="zona" class="tray-panel__unzoom" variant="secondary" size="min" :icon="ZoomOut" @click="zona = null">
                {{ $t('trays.wholeTray') }}
              </UiButton>
            </div>
            <p class="tray-panel__scale">{{ didascalia }}</p>
          </div>

          <!-- contenuto della tasca toccata: pannello di dettaglio (non un
               tooltip: si usa col dito), solo lettura -->
          <div v-if="tascaScelta" class="pocket-detail" role="region" :aria-label="$t('trays.pocket.title', { n: tascaScelta.subPos })">
            <span class="pocket-detail__title">{{ $t('trays.pocket.title', { n: tascaScelta.subPos }) }}</span>
            <dl class="pocket-detail__facts">
              <div><dt>{{ $t('trays.pocket.status') }}</dt><dd><UiBadge :tone="tonoStato(tascaScelta.status)">{{ $t(statoTasca(tascaScelta.status).label).trim() }}</UiBadge></dd></div>
              <div><dt>{{ $t('trays.pocket.piece') }}</dt><dd>{{ pezzoTasca(tascaScelta) }}</dd></div>
              <div><dt>{{ $t('trays.pocket.order') }}</dt><dd>{{ tascaScelta.orderID > 0 ? '#' + tascaScelta.orderID : $t('trays.pocket.noOrder') }}</dd></div>
            </dl>
            <UiButton variant="outline" size="min" :icon="X" :aria-label="$t('trays.pocket.close')" @click="tascaScelta = null">{{ $t('trays.pocket.close') }}</UiButton>
          </div>
          <div v-else class="tray-legend">
            <span v-for="s in legenda" :key="s.status" class="tray-legend__item">
              <i class="tray-legend__sw" :class="'tray-legend__sw--' + s.key" :style="{ background: 'var(' + s.token + ')' }"></i>
              {{ $t(s.label).trim() }} <b>{{ s.n }}</b>
            </span>
            <span v-if="zoomServe && !zona" class="tray-legend__hint">{{ $t('trays.zoomHint') }}</span>
            <span v-else-if="tasche.rows.length" class="tray-legend__hint tray-legend__hint--tap">{{ $t('trays.tapHint') }}</span>
          </div>

          <footer class="tray-panel__actions">
            <!-- estrai / rilascia (25 / 26 alla cassettiera): stessa
                 condizione per mostrarlo e stessa abilitazione della riga di
                 prima, stessa guardia di ComandsRows (muovi) -->
            <UiButton v-if="sel.FLOOR_MAG>0 && (sel.EXTRACT==1 || allInside)"
              variant="primary" size="main" :icon="sel.EXTRACT==1 ? ArrowUp : ArrowDown"
              :disabled="!dataStored.cmdActiveMission"
              @click="muovi(sel)">
              {{ $t(sel.EXTRACT==1 ? 'trays.release' : 'trays.extract') }}
            </UiButton>
            <!-- tasche: la pagina layout, in modifica o in sola lettura con la
                 regola di sempre (goToLayout -> trayOpensReadOnly) -->
            <UiButton v-if="(sel.FAMILY||'').trim().length>0" variant="secondary" size="main" :icon="Grid3x3"
              @click="goToLayout(sel.ID, sel.EXTRACT, sel.STATUS, sel.FLOOR_MAG)">
              {{ $t(apreInLettura(sel) ? 'trays.viewPockets' : 'trays.editPockets') }}
            </UiButton>
            <!-- scheda del cassetto (/conf/tray): come il "Modifica" di prima,
                 dal livello 1 in su (all'operatore lo stesso avviso) -->
            <UiButton variant="secondary" size="main" :icon="dataStored.userLevel > 0 ? SlidersHorizontal : Lock"
              @click="scheda(sel)">
              {{ $t('trays.card') }}
            </UiButton>

            <!-- (grating-model) QUI, e solo qui, si associa/sostituisce/
                 rigenera/dissocia il grigliato. Livello tecnico (2): cancellano
                 tasche tarate. Cassetto estratto o in manovra (EXTRACT<>0):
                 bottoni disabilitati, e il backend rifiuta comunque (guardia
                 conservativa). -->
            <div v-if="sel.FLOOR_MAG>0" class="tray-grating">
              <span class="tray-grating__label">{{ $t('tray.assoc.col') }}</span>
              <template v-if="(sel.FAMILY||'').trim().length==0">
                <UiButton variant="outline" size="min" class="assoc-btn" :disabled="!assocAllowed(sel)" :title="assocTitle(sel)"
                  @click="openAssoc('associate', sel)">{{ $t('tray.assoc.associate') }}</UiButton>
              </template>
              <div v-else class="assoc-actions">
                <UiButton variant="outline" size="min" class="assoc-btn" :disabled="!assocAllowed(sel)" :title="assocTitle(sel)"
                  @click="openAssoc('replace', sel)">{{ $t('tray.assoc.replace') }}</UiButton>
                <!-- (usabilita' 15/9; UI 5/10) Rigenera e Dissocia rifanno o
                     buttano via le tasche del cassetto: gruppo a parte, dietro
                     un divisorio e con uno stacco largo, cosi' un dito che
                     scivola da Sostituisci non arriva a Rigenera. -->
                <div class="assoc-destructive-group">
                  <UiButton variant="outline" size="min" class="assoc-btn" :disabled="!assocAllowed(sel)" :title="assocTitle(sel)"
                    @click="openAssoc('regenerate', sel)">{{ $t('tray.assoc.regenerate') }}</UiButton>
                  <UiButton variant="outline" size="min" class="assoc-btn assoc-danger" :disabled="!assocAllowed(sel)" :title="assocTitle(sel)"
                    @click="openAssoc('dissociate', sel)">{{ $t('tray.assoc.dissociate') }}</UiButton>
                </div>
              </div>
            </div>
          </footer>
        </section>

        <!-- ===== (grating-model) dialog Associa / Sostituisci / Rigenera / Dissocia =====
             Un solo dialog, 4 modi. Copia da cassetto tarato = default quando
             esiste una sorgente (proposta = piu' tasche a DB, MOSTRATA e
             modificabile); generazione dall'header SOLO senza sorgenti o in
             "Rigenera" (con avviso taratura e spunta obbligatoria). -->
        <div v-if="assoc.open" class="mission-dialog-overlay">
          <div class="mission-dialog mission-dialog--wide" :class="{ 'mission-dialog--danger': assoc.mode !== 'associate' }">
            <h3 class="command-section-title">{{ $t('tray.assoc.title.'+assoc.mode, { n: assoc.floor }) }}</h3>

            <template v-if="assoc.mode=='associate' || assoc.mode=='replace'">
              <div class="teach-hint">{{ $t('tray.assoc.chooseGrating') }}</div>
              <select class="pure-u-1" v-model="assoc.gratingId" @change="onAssocGratingChange()">
                <option :value="0"> </option>
                <option v-for="g in assoc.gratings" :key="g.ID" :value="g.ID">{{ (g.NAME||'').trim() }} - {{ (g.DESCR||'').trim() }}</option>
              </select>
            </template>
            <div class="teach-hint" v-else>{{ $t('tray.assoc.currentGrating') }}: <strong>{{ assoc.currentName }}</strong></div>

            <!-- (16/9) COSA CONTERRA' IL CASSETTO. Il grigliato porta la
                 GEOMETRIA (quante tasche, che passo) e basta: lo stesso
                 grigliato ospita piu' particolari, due pezzi di sagoma
                 identica con programmi HAAS diversi sono codici distinti.
                 Il contenuto e' un'altra cosa, e va detto: finisce in
                 POSITION.Part_Type, che e' cio' che il ciclo cerca e di cui
                 usa le quote. Si puo' cambiare dopo senza riassociare, dalla
                 pagina del cassetto. -->
            <template v-if="assoc.mode!='dissociate'">
              <div class="teach-hint">{{ $t('tray.assoc.choosePiece') }}</div>
              <select class="pure-u-1" v-model.number="assoc.pieceId" @change="onAssocGratingChange()">
                <option :value="0"> </option>
                <option v-for="p in assoc.pieces" :key="p.ID" :value="p.ID">
                  #{{ p.ID }} {{ (p.FAMILY||'').trim() }} - {{ (p.DESCR||'').trim() }}
                </option>
              </select>
            </template>

            <template v-if="assoc.mode!='dissociate' && assoc.gratingId>0">
              <template v-if="assoc.mode!='regenerate' && assoc.candidates.length">
                <div class="teach-hint">{{ $t('tray.assoc.sourceHint') }}</div>
                <div class="teach-list">
                  <button v-for="(c, i) in assoc.candidates" :key="c.floor" class="mission-dialog-item"
                    :class="{ selected: assoc.sourceFloor===c.floor }" @click="assoc.sourceFloor=c.floor">
                    <span>{{ $t('tray.assoc.copyFrom', { n: c.floor, k: c.n }) }}</span>
                    <span v-if="i==0" class="teach-muted">{{ $t('tray.assoc.suggested') }}</span>
                  </button>
                </div>
                <div class="teach-hint"><strong>{{ $t('tray.assoc.willCopy', { n: assoc.sourceFloor, k: candidateCount(assoc.sourceFloor) }) }}</strong></div>
              </template>
              <template v-else>
                <div class="teach-hint">{{ $t(assoc.mode=='regenerate' ? 'tray.assoc.regenerateHint' : 'tray.assoc.generateHint') }}</div>
                <div class="teach-hint" v-if="assoc.preview"><strong>{{ $t('grating.rowsCols', { rows: assoc.preview.n_row, cols: assoc.preview.n_cln, tot: assoc.preview.tot }) }}</strong></div>
                <div class="teach-warning" v-if="assoc.mismatch">
                  {{ $t('grating.taughtMismatch', { realW: assoc.mismatch.realW/1000, realH: assoc.mismatch.realH/1000, genW: assoc.mismatch.genW/1000, genH: assoc.mismatch.genH/1000 }) }}
                  <label class="assoc-ack"><input type="checkbox" v-model="assoc.ack" /> {{ $t('tray.assoc.ackMismatch') }}</label>
                </div>
              </template>
            </template>

            <div class="teach-warning" v-if="assoc.mode!='associate' && assoc.currentCount>0">
              {{ $t('tray.assoc.willDelete', { k: assoc.currentCount, n: assoc.floor }) }}
            </div>
            <div class="teach-warning" v-if="assoc.error">{{ $t(assoc.error, assoc.errorParams) }}</div>

            <div class="pure-g">
              <div class="pure-u-1-2">
                <button style="width:100%" class="button_pressed"
                  :class="[assocReady ? 'pure-button-mission' : 'pure-button-disable']"
                  @click="assocReady ? confirmAssoc() : ''">
                  {{ $t('tray.assoc.confirm.'+assoc.mode) }}
                </button>
              </div>
              <div class="pure-u-1-2">
                <button style="width:100%" class="btn-ghost" @click="closeAssoc()">{{ $t('robot.dialog.cancel') }}</button>
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
            datiTab:[],
            // stato della lettura: 'attesa' finche' non si sa, cosi' non si
            // scrive "nessun cassetto" prima di avere una risposta
            statoElenco: STATO.ATTESA,
            //polling:true,
			allInside:false,
            // (v3 fase C) cassetto scelto (FLOOR_MAG; null = quello fuori, se
            // c'e', altrimenti il primo) e le sue tasche, lette come la
            // pagina layout (util/trayPockets.js)
            selFloor: null,
            tasche: { rows: [], dimX: 0, dimY: 0, radius: 0, trayX: 0, trayY: 0, letto: false },
            // tutte le tasche dei cassetti (api/conf/position/show/all): righe
            // x colonne e riempimento di ogni piano della cassettiera
            posizioni: [],
            posizioniLette: false,
            pezzi: [],              // anagrafica: codice del contenuto
            tascaScelta: null,      // tasca toccata (evento pick di TrayPockets)
            zona: null,             // zona ingrandita (util/trayZoom.js)
            scalaPiena: 0,          // px per mm del disegno intero
            // (grating-model) dialog associazione grigliato <-> cassetto
            assoc: {
                open: false,
                mode: '',            // 'associate' | 'replace' | 'regenerate' | 'dissociate'
                floor: 0,            // cassetto target (FLOOR_MAG)
                tray: null,          // riga TRAYS del target (misure X/Y)
                currentName: '',     // FAMILY attuale del target
                currentCount: 0,     // tasche attuali del target
                gratings: [],        // catalogo GRATING
                gratingId: 0,        // modello scelto
                positions: [],       // [POSITION] TRAY_% (conteggi sorgenti, avviso taratura)
                pieces: [],          // anagrafica PIECE (ingombro per la generazione)
                pieceId: 0,          // CONTENUTO dichiarato del cassetto -> POSITION.Part_Type
                candidates: [],      // sorgenti [{floor, n}] ordinate per n DESC (prima = piu' completa)
                sourceFloor: null,   // sorgente scelta; null = genera dall'header
                preview: null,       // { n_row, n_cln, tot, centers } (generazione)
                mismatch: null,      // avviso taratura { realW, realH, genW, genH } um (rigenera)
                ack: false,          // spunta obbligatoria sull'avviso taratura
                error: '',           // chiave i18n del blocco
                errorParams: {},
                busy: false
            }
        }
    },
    methods: {
        getDataTable() {
            // (usabilita' 15/9) prima il guasto finiva in console e a video
            // restava una tabella vuota, indistinguibile da "nessun cassetto".
            this.statoElenco = STATO.ATTESA;
            caricaElenco(dataStored.server, 'api/conf/tray/show/all').then(esito => {
                this.statoElenco = esito.stato;
                if (esito.stato !== STATO.OK) {
                    console.info('elenco cassetti non letto: ' + esito.dettaglio);
                    return;
                }
                this.datiTab = esito.dati;
                this.allInside = true;
                for (let i = 0; i < this.datiTab.length; i++)
                    if (this.datiTab[i].EXTRACT == 1) this.allInside = false;
            });
        },
        updateTray(i){
            //alert("modifica "+i);
            this.$router.push('/conf/tray?trayID='+i);
            //this.$router.push({ name: 'conf/tray', params:{trayID: i}} );
        },
        /*moveTray(ID){
            let query = 'api/conf/tray/extract/'
            for(let j=0;j<this.datiTab.length;j++){
                if (this.datiTab[j].ID != ID ) continue;
                if(this.datiTab[j].EXTRACT==1){
                    //se è estratto 
                    query = 'api/conf/tray/insert/'
                }else
                    if(this.datiTab[j].EXTRACT==1000){
                        //se è in estrazione
                        query = 'api/conf/tray/resetExtract/';
                    }else
                        if (this.datiTab[j].EXTRACT==2000) {
                            //se è in inserimento 
                            query = 'api/conf/tray/resetInsert/';
                        }
            }
            fetch(dataStored.server+query+ID ,{ method: 'get'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        */
        // ===== (grating-model) associazione grigliato <-> cassetto =====
        // Guardia client (visiva): livello tecnico + cassetto DENTRO
        // (EXTRACT==0). Il backend ripete entrambe le guardie + ordine attivo.
        assocAllowed(dt){
            return dataStored.userLevel > 1 && Number(dt.EXTRACT || 0) == 0;
        },
        assocTitle(dt){
            return Number(dt.EXTRACT || 0) != 0 ? this.$t('tray.assoc.extractedHint') : '';
        },
        // numero piano da PARENT 'TRAY_n' (nchar paddato: trim)
        trayFloorOf(p){
            const s = (p.PARENT || '').trim();
            return s.indexOf('TRAY_') == 0 ? Number(s.slice(5)) : 0;
        },
        pocketsOf(floor){
            return this.assoc.positions.filter(p => this.trayFloorOf(p) == floor);
        },
        candidateCount(floor){
            const c = this.assoc.candidates.find(x => x.floor == floor);
            return c ? c.n : 0;
        },
        openAssoc(mode, dt){
            const a = this.assoc;
            a.open = true; a.mode = mode; a.floor = dt.FLOOR_MAG; a.tray = dt;
            a.currentName = (dt.FAMILY || '').trim(); a.currentCount = 0;
            a.gratingId = 0; a.gratings = []; a.positions = []; a.pieces = [];
            a.pieceId = 0;
            a.candidates = []; a.sourceFloor = null; a.preview = null; a.mismatch = null;
            a.ack = false; a.error = ''; a.errorParams = {}; a.busy = false;
            const get = url => fetch(dataStored.server + url, { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); });
            return Promise.all([get('api/conf/grating/show/all'), get('api/conf/position/show/all'), get('api/conf/piece/show/all')])
                .then(([gratings, positions, pieces]) => {
                    a.gratings = gratings || [];
                    a.positions = (positions || []).filter(p => this.trayFloorOf(p) > 0);
                    a.pieces = pieces || [];
                    a.currentCount = this.pocketsOf(a.floor).length;
                    // contenuto: si riparte dal codice gia' dichiarato nelle
                    // tasche (se c'e'), non da vuoto — su Sostituisci e
                    // Rigenera di solito il contenuto non cambia, cambia la
                    // geometria. Va letto QUI: nel reset le posizioni non
                    // erano ancora arrivate e sarebbe sempre stato 0.
                    a.pieceId = Number((this.pocketsOf(a.floor)[0] || {}).Part_Type) || 0;
                    if (mode == 'regenerate' || mode == 'dissociate') {
                        // modello FISSO = quello del cassetto (FAMILY = NAME)
                        const g = a.gratings.find(x => (x.NAME || '').trim() == a.currentName);
                        a.gratingId = g ? g.ID : 0;
                        if (mode == 'regenerate' && !g) { a.error = 'tray.assoc.err.noModel'; return; }
                    }
                    this.onAssocGratingChange();
                })
                .catch(e => { console.info(e); a.error = 'tray.assoc.err.load'; });
        },
        closeAssoc(){
            this.assoc.open = false;
        },
        // Sorgenti = cassetti con lo STESSO modello (FAMILY = NAME) e tasche a
        // DB, escluso il target, ordinati per tasche DESC: la prima e' la
        // proposta (piu' completa), MOSTRATA e modificabile. Senza sorgenti
        // (o in "Rigenera"): generazione dall'header sulle misure del target.
        onAssocGratingChange(){
            const a = this.assoc;
            a.candidates = []; a.sourceFloor = null; a.preview = null; a.mismatch = null; a.ack = false;
            a.error = ''; a.errorParams = {};
            const g = a.gratings.find(x => x.ID == a.gratingId);
            if (!g || a.mode == 'dissociate') return;
            // proposta di contenuto: il pezzo su cui e' stata calcolata la
            // geometria, se il modello ce l'ha. E' una proposta da confermare,
            // non una verita': lo stesso grigliato ospita piu' particolari.
            if (!(a.pieceId > 0) && Number(g.PIECE_ID) > 0) a.pieceId = Number(g.PIECE_ID);
            // (grating-thickness 14/9) protezione anti-urto PRIMA di qualunque
            // sorgente o anteprima, in TUTTI i modi (copia compresa): Z_PICK e
            // Z_PLACE del pezzo del modello >= spessore grigliato + 1 mm.
            // Spessore NULL/0 = non misurato = nessun vincolo. Il server
            // ripete il controllo sui valori del DB.
            {
                // (16/9) le misure che contano sono quelle del pezzo che ci
                // finira' DENTRO: il pezzo del modello e' solo il ripiego di
                // quando il contenuto non e' ancora stato scelto
                const piece = a.pieces.find(p => p.ID == (a.pieceId > 0 ? a.pieceId : g.PIECE_ID));
                const c = pickClearance({ thickness: g.THICKNESS, zPick: piece ? piece.Z_PICK : 0, zPlace: piece ? piece.Z_PLACE : 0 });
                if (piece && !c.ok) {
                    a.error = 'tray.assoc.err.thickness';
                    a.errorParams = { min: c.min / 1000, pick: c.zPick / 1000, place: c.zPlace / 1000, t: Number(g.THICKNESS) / 1000 };
                    return;
                }
            }
            if (a.mode != 'regenerate') {
                const name = (g.NAME || '').trim();
                a.candidates = this.datiTab
                    .filter(t => t.FLOOR_MAG > 0 && t.FLOOR_MAG != a.floor && (t.FAMILY || '').trim() == name)
                    .map(t => ({ floor: t.FLOOR_MAG, n: this.pocketsOf(t.FLOOR_MAG).length }))
                    .filter(c => c.n > 0)
                    .sort((x, y) => y.n - x.n || x.floor - y.floor);
                if (a.candidates.length) { a.sourceFloor = a.candidates[0].floor; return; }
            }
            this.buildAssocPreview(g);
        },
        // Generazione dall'header sulle misure del cassetto TARGET (non del
        // riferimento): anteprima righe x colonne, ingombro (il server lo
        // ripete dal DB), avviso taratura in "Rigenera".
        buildAssocPreview(g){
            const a = this.assoc;
            // idem qui: la griglia si verifica sull'ingombro del contenuto
            const piece = a.pieces.find(p => p.ID == (a.pieceId > 0 ? a.pieceId : g.PIECE_ID));
            if (!piece || !(piece.X > 0) || !(piece.Y > 0)) { a.error = 'tray.assoc.err.noPiece'; return; }
            // (z-pick 14/9) Z_PICK = quota di presa dal fondo: con 0 ogni tasca
            // generata e' imprendibile (il robot chiuderebbe sul fondo). Blocco.
            if (!(Number(piece.Z_PICK) > 0)) { a.error = 'tray.assoc.err.zPick'; a.errorParams = { id: piece.ID }; return; }
            const width = a.tray.X / 1000, height = a.tray.Y / 1000;
            const grid = buildGrid({ pieceX: piece.X / 1000, pieceY: piece.Y / 1000, prismatic: !!piece.PRISMA,
                                     safeX: g.SAFEX, safeY: g.SAFEY, width, height });
            if (grid.listPz.length == 0) { a.error = 'tray.assoc.err.emptyGrid'; return; }
            const centers = gridCenters(grid.listPz, { width, height, dim_x: grid.dim_x, dim_y: grid.dim_y });
            const fit = gridFit(centers, { width, height, halfW: piece.X / 2000, halfH: piece.Y / 2000 });
            if (!fit.ok) { a.error = 'tray.assoc.err.outOfTray'; a.errorParams = { w: Math.ceil(fit.overW), h: Math.ceil(fit.overH) }; return; }
            a.preview = { n_row: grid.n_row, n_cln: grid.n_cln, tot: grid.listPz.length, centers };
            if (a.mode == 'regenerate') {
                const genW = Math.round((piece.X / 1000 + Number(g.SAFEX)) * 1000);
                const genH = Math.round((piece.Y / 1000 + Number(g.SAFEY)) * 1000);
                a.mismatch = taughtMismatch(this.pocketsOf(a.floor), genW, genH);
            }
        },
        confirmAssoc(){
            const a = this.assoc;
            if (a.busy) return;
            a.busy = true; a.error = ''; a.errorParams = {};
            let url, body = null;
            if (a.mode == 'dissociate') {
                url = 'api/conf/tray/dissociateGrating/' + a.floor;
            } else {
                url = 'api/conf/tray/associateGrating/' + a.floor;
                body = { gratingId: a.gratingId, replace: a.mode != 'associate',
                         pieceId: a.pieceId,
                         source: a.sourceFloor != null ? { floor: a.sourceFloor } : { centers: a.preview.centers } };
            }
            return fetch(dataStored.server + url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                    body: body ? JSON.stringify(body) : undefined })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(out => {
                    a.busy = false;
                    if (out && out.ris == 'OK') {
                        dataStored.alert.title = 'INFO';
                        dataStored.alert.desc = 'tray.assoc.done.' + a.mode;
                        dataStored.alert.type = 'message';
                        this.closeAssoc();
                        this.getDataTable();
                        return;
                    }
                    const code = out ? out.ris : 'KO';
                    const map = {};
                    map[KO_TRAY_EXTRACTED] = 'tray.assoc.err.extracted';
                    map[KO_ACTIVE_ORDER] = 'tray.assoc.err.activeOrder';
                    map[KO_ALREADY_ASSOCIATED] = 'tray.assoc.err.alreadyAssociated';
                    map[KO_SOURCE_EMPTY] = 'tray.assoc.err.sourceEmpty';
                    map[KO_OUT_OF_TRAY] = 'tray.assoc.err.outOfTray';
                    map[KO_Z_BELOW_GRATING] = 'tray.assoc.err.thickness';
                    // (16/9) il modello non dice che pezzo ospita: le tasche
                    // nascerebbero invisibili al robot, quindi non nascono
                    map[KO_NO_PIECE_DECLARED] = 'tray.assoc.err.noPiece';
                    a.error = map[code] || 'tray.assoc.err.generic';
                    a.errorParams = code == KO_OUT_OF_TRAY
                        ? { w: Math.ceil(out.overW || 0), h: Math.ceil(out.overH || 0) }
                        : code == KO_Z_BELOW_GRATING
                            ? { min: (out.min || 0) / 1000, pick: (out.zPick || 0) / 1000, place: (out.zPlace || 0) / 1000, t: (out.thickness || 0) / 1000 }
                            : { code: code };
                })
                .catch(e => { console.info(e); a.busy = false; a.error = 'tray.assoc.err.generic'; a.errorParams = { code: String(e) }; });
        },
        getClassFromStatusDesc(status){
            //alert(JSON.stringify(status,null,4))
            return status.toString().trim().toLowerCase();
        },
        goToLayout(trayID, extracted, status, floorMag){
            //this.$router.push('/conf/Grating/'+trayID);
            // (P3 audit 5/10) la regola "sola lettura" e' in util/trayNeighbors.js,
            // la stessa che usano le frecce della pagina layout
            if (trayOpensReadOnly({ EXTRACT: extracted, STATUS: status }))
                //modifiche non permesse
                this.$router.push('/layout/'+trayID+"/0/"+floorMag);
            else
                this.$router.push('/layout/'+trayID+"/1/"+floorMag);
        },
        // ===== (v3 fase C) cassettiera e cassetto scelto =====
        // tasche di un piano (righe di api/conf/position/show/all)
        tascheDi(dt){
            return this.perPiano.get(Number(dt.FLOOR_MAG)) || [];
        },
        // righe x colonne: valori distinti di X robot (righe) e di Y robot
        // (colonne), come stanno a DB
        geoPiano(dt){
            const r = this.tascheDi(dt);
            if (!r.length) return { rows: 0, cols: 0, n: 0 };
            return { rows: new Set(r.map(p => Number(p.X))).size, cols: new Set(r.map(p => Number(p.Y))).size, n: r.length };
        },
        conta(stati){
            const c = {};
            for (const st of stati) { const k = pocketState(st).key; c[k] = (c[k] || 0) + 1; }
            return c;
        },
        contenutoPiano(dt){
            if (!((dt.FAMILY || '').trim())) return this.$t('trays.noGrating');
            const r = this.tascheDi(dt);
            if (!r.length) return this.posizioniLette ? this.$t('trays.noPocketsShort') : '';
            const c = this.conta(r.map(p => p.STATUS));
            const parti = ['raw', 'working', 'finished', 'locked', 'abort', 'undef']
                .filter(k => c[k] > 0).map(k => this.$t('trays.count.' + k, { n: c[k] }));
            return parti.length ? parti.join(' · ') : this.$t('trays.allEmpty');
        },
        // barra di riempimento: un segmento per stato (colori della fase
        // 1.5, util/pocketColors.js); il fondo e' il colore della tasca vuota
        barraPiano(dt){
            const r = this.tascheDi(dt);
            if (!r.length) return [];
            const c = this.conta(r.map(p => p.STATUS));
            return POCKET_STATES.filter(st => st.key !== 'empty' && c[st.key] > 0)
                .map(st => ({ key: st.key, token: st.token, pct: Math.round(c[st.key] / r.length * 1000) / 10 }));
        },
        // Dentro / Fuori dal campo EXTRACT (1000 in uscita, 2000 in rientro:
        // prima lampeggiavano nella riga)
        dove(dt){
            const e = Number(dt.EXTRACT || 0);
            if (!(dt.FLOOR_MAG > 0)) return { key: 'none', label: 'trays.where.none', tone: 'neutral' };
            if (e === 0) return { key: 'in', label: 'trays.where.in', tone: 'neutral' };
            if (e === 1000) return { key: 'moving', label: 'trays.where.extracting', tone: 'warning' };
            if (e === 2000) return { key: 'moving', label: 'trays.where.inserting', tone: 'warning' };
            return { key: 'out', label: 'trays.where.out', tone: 'warning' };
        },
        scegli(dt){
            this.selFloor = dt.FLOOR_MAG;
        },
        scegliPiano(v){
            if (v) this.selFloor = v.floor;
        },
        apreInLettura(dt){
            return trayOpensReadOnly(dt);
        },
        statoTasca(st){
            return pocketState(st);
        },
        tonoStato(st){
            const k = pocketState(st).key;
            return k === 'raw' ? 'info' : k === 'finished' ? 'success' : k === 'abort' ? 'danger'
                : (k === 'working' || k === 'locked') ? 'warning' : 'neutral';
        },
        pezzoTasca(t){
            const p = (this.tasche.rows || [])[t.index] || {};
            const id = Number(p.partType) || 0;
            if (!(id > 0)) return this.$t('trays.pocket.noPiece');
            const pz = this.pezzi.find(x => x.ID == id);
            if (!pz) return '#' + id;
            const d = (pz.DESCR || '').trim();
            return (pz.FAMILY || '').trim() + (d ? ' · ' + d : '');
        },
        // tasche del cassetto scelto: la stessa lettura della pagina layout
        caricaTasche(){
            const floor = this.selPiano;
            if (!(floor > 0)) { this.tasche = { rows: [], dimX: 0, dimY: 0, radius: 0, trayX: 0, trayY: 0, letto: true }; return; }
            loadTrayPockets(dataStored.server, floor).then(d => {
                // risposta di un cassetto lasciato nel frattempo: si scarta
                if (this.selPiano !== floor) return;
                this.tasche = Object.assign({ letto: true }, d);
            });
        },
        caricaPosizioni(){
            fetch(dataStored.server + 'api/conf/position/show/all', { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(d => { this.posizioni = Array.isArray(d) ? d.filter(p => this.trayFloorOf(p) > 0) : []; this.posizioniLette = true; })
                .catch(e => { console.info(e); });
        },
        caricaPezzi(){
            fetch(dataStored.server + 'api/conf/piece/show/all', { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(d => { this.pezzi = Array.isArray(d) ? d : []; })
                .catch(e => { console.info(e); });
        },
        // tocco su una tasca: con tasche sotto i 44 px il primo tocco
        // ingrandisce la zona, poi il tocco mostra il contenuto (solo lettura)
        toccaTasca(ev){
            if (!this.zona && this.zoomServe) {
                this.zona = zoneAround(ev, this.trayDisegno, zoomFactor(this.geoTasche, this.scalaPiena));
                return;
            }
            this.tascaScelta = ev;
        },
        toccaVassoio(ev){
            if (!this.zona && this.zoomServe)
                this.zona = zoneAround(ev, this.trayDisegno, zoomFactor(this.geoTasche, this.scalaPiena));
        },
        scala(ev){
            if (ev && !ev.zoned) this.scalaPiena = ev.pxPerMm;
        },
        // ESTRAI / RILASCIA: la stessa catena della riga di prima. Il pulsante
        // della riga (ComandsRows.extract) voleva EasyBox e il robot in
        // modalita' locale (RobotInLocalMode), altrimenti avvisava; poi
        // sendToBox mandava 25 (estrai) o 26 (rilascia) alla cassettiera.
        muovi(dt){
            if (dataStored.EasyBox) {
                if (dataStored.RobotInLocalMode)
                    this.sendToBox(dt.EXTRACT, dt.FLOOR_MAG);
                else {
                    dataStored.alert.title = this.$t('WARNING');
                    dataStored.alert.desc = this.$t('LocalModeReq');
                    dataStored.alert.type = 'warning';
                }
            }
        },
        // SCHEDA DEL CASSETTO: come il "Modifica" della riga
        // (ComandsRows.modifyItem), dal livello 1 in su
        scheda(dt){
            if (dataStored.userLevel > 0)
                this.updateTray(dt.ID);
            else {
                dataStored.alert.title = this.$t('WARNING');
                dataStored.alert.desc = this.$t('user_not_enabled');
                dataStored.alert.type = 'alarm';
            }
        },
        sendToBox(extracted,num){
            if (extracted)
			    dataStored.WS.socket.emit("TO_PLANT/CMD/BOX", "26;"+num); //release  ??? codice missione scritto
            else
                dataStored.WS.socket.emit("TO_PLANT/CMD/BOX", "25;"+num); //extract
		}
    },
    computed:{
        // (v3 fase C) piani della cassettiera in ordine di numero; quelli
        // senza piano (FLOOR_MAG <= 0, "fuori") in fondo
        piani(){
            const n = t => (t.FLOOR_MAG > 0 ? Number(t.FLOOR_MAG) : 1e6);
            return (this.datiTab || []).slice().sort((a, b) => n(a) - n(b));
        },
        sel(){
            const p = this.piani;
            if (!p.length) return null;
            return (this.selFloor != null && p.find(t => t.FLOOR_MAG == this.selFloor))
                || p.find(t => Number(t.EXTRACT || 0) != 0 && t.FLOOR_MAG > 0)
                || p[0];
        },
        selPiano(){
            return this.sel ? Number(this.sel.FLOOR_MAG) : null;
        },
        vicini(){
            return this.sel ? neighborTrays(this.datiTab, this.sel.FLOOR_MAG) : { prev: null, next: null };
        },
        perPiano(){
            const m = new Map();
            for (const p of this.posizioni || []) {
                const f = this.trayFloorOf(p);
                if (!(f > 0)) continue;
                if (!m.has(f)) m.set(f, []);
                m.get(f).push(p);
            }
            return m;
        },
        // passo fra le tasche del cassetto scelto (mm del disegno: w = y
        // robot, h = x robot) e contorno, per la scala e la zona ingrandita
        geoTasche(){
            const r = this.tasche.rows || [];
            return { pitchW: pitchOf(r.map(p => p.y)), pitchH: pitchOf(r.map(p => p.x)), dimX: this.tasche.dimX };
        },
        // misure del cassetto (micron -> mm): quelle lette con le tasche; un
        // cassetto senza tasche non le porta, e allora valgono quelle della
        // sua riga in api/conf/tray/show/all (stesse colonne TRAY.X / TRAY.Y)
        trayDisegno(){
            let x = Number(this.tasche.trayX) || 0, y = Number(this.tasche.trayY) || 0;
            if (!(x > 0 && y > 0) && this.sel) { x = Number(this.sel.X) || 0; y = Number(this.sel.Y) || 0; }
            const k = x > 0 && y > 0;
            return { trayW: k ? x / 1000 : TRAY_FALLBACK.w, trayH: k ? y / 1000 : TRAY_FALLBACK.h, noto: k };
        },
        zoomServe(){
            return needsZoom(this.geoTasche, this.scalaPiena);
        },
        legenda(){
            const n = new Map();
            for (const p of this.tasche.rows || []) { const k = pocketState(p.status).status; n.set(k, (n.get(k) || 0) + 1); }
            return POCKET_STATES.map(st => Object.assign({}, st, { n: n.get(st.status) || 0 }));
        },
        sottotitolo(){
            const t = this.sel;
            if (!t) return '';
            const nome = (t.FAMILY || '').trim();
            if (!nome) return this.$t('trays.sub.noGrating');
            const parti = [this.$t('trays.sub.grating', { name: nome })];
            const r = this.tasche.rows || [];
            if (r.length) {
                parti.push(this.$t('trays.sub.grid', { rows: new Set(r.map(p => Number(p.x))).size, cols: new Set(r.map(p => Number(p.y))).size }));
                parti.push(this.$t('trays.sub.pockets', { n: r.length }));
                const pz = this.pezzi.find(p => p.ID == r[0].partType);
                parti.push(pz ? this.$t('trays.sub.piece', { code: (pz.FAMILY || '').trim() }) : this.$t('trays.sub.noPiece'));
            }
            return parti.join(' · ');
        },
        // didascalia della scala: misure vere del cassetto, della tasca e
        // del passo; senza misure del cassetto si dice che il contorno e'
        // quello fisso di prima
        didascalia(){
            const t = this.tasche, r = t.rows || [];
            if (!r.length) return '';
            const f = v => String(Math.round(Number(v) * 10) / 10);
            const d = this.trayDisegno, g = this.geoTasche;
            const parti = [d.noto ? this.$t('trays.scale.tray', { w: f(d.trayW), h: f(d.trayH) }) : this.$t('trays.scale.trayUnknown')];
            if (r[0].prisma) parti.push(this.$t('trays.scale.pocket', { w: f(t.dimX), h: f(t.dimY) }));
            else parti.push(this.$t('trays.scale.round', { d: f(2 * t.radius) }));
            if (g.pitchW > 0 && g.pitchH > 0) parti.push(this.$t('trays.scale.pitch', { w: f(g.pitchW), h: f(g.pitchH) }));
            return this.$t('trays.scale.lead') + ' ' + parti.join(' · ');
        },
        // (grating-model) il bottone di conferma del dialog si abilita solo con
        // uno stato completo: modello scelto, sorgente scelta OPPURE anteprima
        // valida, avviso taratura spuntato se presente, nessun errore.
        assocReady(){
            const a = this.assoc;
            if (!a.open || a.busy || a.error) return false;
            if (a.mode == 'dissociate') return true;
            if (!(a.gratingId > 0)) return false;
            // senza contenuto dichiarato le tasche nascerebbero con un
            // Part_Type che non aggancia nessun PIECE: invisibili al ciclo
            if (!(a.pieceId > 0)) return false;
            if (a.sourceFloor != null) return true;
            if (!a.preview) return false;
            if (a.mismatch && !a.ack) return false;
            return true;
        },
    },
    watch: {
        // (v3 fase C) cambia il cassetto scelto (tocco, frecce, primo
        // caricamento): si rileggono le sue tasche, via dettaglio e zona
        selPiano(n, o){
            if (n === o) return;
            this.tascaScelta = null;
            this.zona = null;
            this.caricaTasche();
        }
    },
    mounted(){
        this.getDataTable();
        this.caricaPosizioni();
        this.caricaPezzi();
        //setInterval(() => {
        //    if(this.polling)
        //        this.getDataTable()
        //}, 3000);
        // BOX/STATUS: cassetto estratto o rientrato, tasche cambiate: si
        // rileggono elenco, riempimento e tasche del cassetto scelto
        this.onBoxStatus = () => {
          this.getDataTable();
          this.caricaPosizioni();
          this.caricaTasche();
        };
        dataStored.WS.socket.on('BOX/STATUS', this.onBoxStatus);
    },
    unmounted(){
        //this.polling=false;
        // (v3) off del solo handler di questa pagina (prima restava appeso)
        dataStored.WS.socket.off('BOX/STATUS', this.onBoxStatus);
    }
}
</script>

<style scoped>
/* (v3 fase C) tavole Magazzino e Magazzino43: pagina a tutta altezza,
   cassettiera a sinistra, cassetto scelto a destra. Nessuno scroll di
   pagina a 1920 x 1080 e a 1024 x 768: scorre, se serve, solo l'elenco. */
.trays {
  display: grid;
  grid-template-columns: minmax(400px, 540px) minmax(0, 1fr);
  gap: var(--space-5);
  height: 100%;
  min-height: 0;
}
.trays-rack,
.tray-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  padding: var(--card-padding);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  box-sizing: border-box;
}

/* ---- cassettiera ---- */
.trays-rack__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}
.trays-label,
.tray-grating__label {
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  color: var(--text-muted);
}
.trays-rack__n { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text-muted); }
.trays-rack__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rack-row {
  flex: none;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
  min-height: 58px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-md);
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.rack-row.on { background: var(--bg-raised); box-shadow: inset 0 0 0 2px var(--accent); }
.rack-row__n {
  font-size: 26px;
  font-weight: var(--font-weight-extrabold);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.rack-row__body { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.rack-row__info { display: flex; align-items: baseline; gap: var(--space-3); min-width: 0; font-size: var(--font-size-sm); }
.rack-row__grid { flex: none; font-weight: var(--font-weight-bold); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.rack-row__grid i { font-style: normal; color: var(--text-muted); }
.rack-row__txt { color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rack-bar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--pocket-empty);
}
.rack-bar i { display: block; height: 100%; }
.rack-row__where { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--text-muted); white-space: nowrap; }
.rack-row__where.is-out,
.rack-row__where.is-moving { color: var(--color-warning-fg); font-weight: var(--font-weight-extrabold); }
/* in uscita / in rientro: come il lampeggio della riga di prima */
.rack-row__where.is-moving { animation: tray-pulse 1s infinite; }
@keyframes tray-pulse { 50% { opacity: 0.35; } }

/* ---- cassetto scelto ---- */
.tray-panel { gap: var(--space-4); }
.tray-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.tray-panel__title { display: flex; align-items: center; gap: var(--space-4); min-width: 0; }
.tray-panel__name {
  margin: 0;
  text-transform: none;
  font-size: 40px;
  font-weight: var(--font-weight-extrabold);
  letter-spacing: -0.01em;
  color: var(--text-primary);
  white-space: nowrap;
}
.tray-panel__nav { display: flex; gap: var(--space-3); }
.tray-panel__navico { width: var(--icon-size-md); height: var(--icon-size-md); vertical-align: middle; margin-left: var(--space-1); }
.tray-panel__sub { margin: calc(-1 * var(--space-2)) 0 0; font-size: var(--font-size-md); color: var(--text-secondary); }
.tray-panel__draw { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.tray-panel__frame {
  position: relative;
  flex: 1;
  min-height: 150px;
}
.tray-panel__frame > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.tray-panel__unzoom { position: absolute; top: var(--space-2); right: var(--space-2); }
.tray-panel__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-size: var(--font-size-md);
  color: var(--text-muted);
  pointer-events: none;
}
.tray-panel__scale { margin: 0; text-align: center; font-size: var(--font-size-sm); color: var(--text-muted); font-variant-numeric: tabular-nums; }

/* legenda con i conteggi (stessa tabella colori del disegno) */
.tray-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-5);
  font-size: var(--font-size-base);
  color: var(--text-secondary);
}
.tray-legend__item { display: inline-flex; align-items: center; gap: var(--space-2); white-space: nowrap; }
.tray-legend__item b { color: var(--text-primary); font-weight: var(--font-weight-extrabold); font-variant-numeric: tabular-nums; }
.tray-legend__sw { width: 18px; height: 18px; border-radius: 5px; flex: none; }
.tray-legend__sw--undef { box-shadow: inset 0 0 0 1px var(--pocket-undef-border); }
.tray-legend__hint { flex-basis: 100%; font-size: var(--font-size-sm); color: var(--text-muted); }

/* contenuto della tasca toccata (solo lettura) */
.pocket-detail {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--bg-input);
}
.pocket-detail__title { font-size: var(--font-size-lg); font-weight: var(--font-weight-extrabold); white-space: nowrap; }
.pocket-detail__facts { display: flex; flex: 1; flex-wrap: wrap; gap: var(--space-2) var(--space-6, 32px); margin: 0; }
.pocket-detail__facts dt {
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  color: var(--text-muted);
}
.pocket-detail__facts dd { margin: 4px 0 0; font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--text-primary); }

/* comandi del cassetto */
.tray-panel__actions { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.tray-grating { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-left: auto; }
.assoc-actions { display: flex; align-items: center; gap: var(--space-2); flex-wrap: nowrap; }
/* (usabilita' 15/9; UI 5/10) le azioni che rifanno o buttano via le
   tasche non stanno vicino a Sostituisci: gruppo staccato da un divisorio
   e da 24 + 16 px */
.assoc-destructive-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: var(--space-5);
  padding-left: var(--space-4);
  border-left: 1px solid var(--border-subtle);
}
.tray-grating .assoc-danger { color: var(--color-danger-fg); }
.tray-grating .assoc-danger:disabled { color: var(--text-muted); }
/* dialog del grigliato: spunta dell'avviso taratura */
.assoc-ack { display: block; margin-top: var(--space-2); }

/* ---- compatto (1024 x 768, 1280 x 800): cassettiera in una colonna
   stretta con numero e barra, il cassetto nel resto dello spazio ---- */
@media (max-width: 1599px) {
  .trays { grid-template-columns: 150px minmax(0, 1fr); gap: var(--space-4); }
  .trays-rack { padding: var(--space-3); }
  .trays-rack__head { display: none; }
  .rack-row { grid-template-columns: 34px minmax(0, 1fr); gap: var(--space-2); min-height: 48px; padding: 0 var(--space-3); }
  .rack-row__n { font-size: 19px; }
  .rack-row__info,
  .rack-row__where { display: none; }
  .tray-panel { gap: var(--space-3); }
  .tray-panel__name { font-size: 28px; }
  .tray-panel__navlbl { display: none; }
  .tray-panel__navico { margin-left: 0; }
  .tray-panel__sub { margin-top: calc(-1 * var(--space-1)); font-size: var(--font-size-sm); }
  .tray-legend { gap: var(--space-1) var(--space-3); font-size: 13px; }
  .tray-legend__sw { width: 14px; height: 14px; border-radius: 4px; }
  /* l'invito a toccare una tasca resta solo in largo: in compatto lo
     spazio va al disegno (l'aiuto della zona ingrandita resta) */
  .tray-legend__hint--tap { display: none; }
  .trays-rack__list { gap: 4px; }
  .tray-panel__actions { gap: var(--space-2); }
  .tray-panel__actions > .ui-btn { flex: 1 1 0; min-width: 0; }
  .tray-grating { margin-left: 0; width: 100%; }
  .pocket-detail { gap: var(--space-3); padding: var(--space-2) var(--space-3); }
}
</style>


<style scoped>
    /* (UI 5/10) tolta la copia locale di #locked4OP (sfondo in basso a
       destra): il badge di livello e' unico, in App.vue. */
    /* Badge status (grafia lowercase): semantica allineata a productionTable.
       Nota: il td che li usava (getClassFromStatusDesc) e' oggi commentato
       nel template — classi tokenizzate ma di fatto inattive. */
    .paused {
        color: var(--text-muted);
        border-radius: var(--radius-lg);
    }

    .finished {
        background-color: var(--bg-surface-2);
        color: var(--text-secondary);
        border-radius: var(--radius-lg);
    }

    .stop {
        background-color: var(--color-danger-bg);
        color: var(--color-danger);
        border-radius: var(--radius-lg);
    }

    .abort {
        background-color: var(--color-danger-bg);
        color: var(--color-danger);
        border-radius: var(--radius-lg);
    }

    .working {
        background-color: var(--color-success-bg);
        color: var(--color-success);
        border-radius: var(--radius-lg);
    }

    .raw {
        background-color: var(--color-info-bg);
        color: var(--color-info);
        border-radius: var(--radius-lg);
    }

    /* dialog (oggi solo quello del grigliato): stile comune in assets/css/dialogs.css (UI-DESIGN-SYSTEM v3 §12) */


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

    .teach-list {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-2);
    }

    .teach-hint {
        background: var(--color-info-bg);
        color: var(--color-info);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font-size: var(--font-size-sm);
    }
    .teach-warning {
        background: var(--color-warning-bg);
        color: var(--color-warning);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font-size: var(--font-size-sm);
    }

    .teach-muted {
        color: var(--text-muted);
        font-size: var(--font-size-xs);
        font-style: italic;
    }

</style>
