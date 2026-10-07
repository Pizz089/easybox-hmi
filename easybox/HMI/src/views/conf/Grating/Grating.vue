<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../../data.js'
    import { KO_DUP_NAME } from '../../../util/errorCodes.js'
    import { gridFit, ROBOT_AXIS_ALONG } from '../../../util/gratingAxes.js'
    // (grating-model) griglia calcolata dalla util condivisa con la gestione
    // cassetti: qui serve SOLO per l'anteprima del modello
    import { buildGrid, gridCenters, gripperMinSafe, pickClearance } from '../../../util/gratingGrid.js'
    import { cavityRect, cavityRadius, applyCavityClearanceToSvg,
             CAVITY_CLEARANCE_UM, CAVITY_CLEARANCE_MAX_UM, clearanceMmToUm, clearanceUmToMm, isValidClearanceUm } from '../../../util/cavityClearance.js'
    import { dedupeGrippers } from '../../../util/grippers.js'
    // (base-dxf 7/10) profilo esterno e fori del grigliato letti da Base.dxf
    import { parseBaseDxf, baseToSvg, pocketsVsBase, baseRouteError, BASE_WEB_MM } from '../../../util/baseDxf.js'
    import numericField from '../../../components/numericField.vue'
    import { ref, onMounted } from 'vue'
    //import layout from '../layoutView.vue'

    // (UI v2 fase 1.5) le tasche ora hanno colori var(--pocket-*): nei file
    // esportati vanno risolti in esadecimale
    import { resolveCssVars } from '../../../util/pocketColors.js'
    import prisma from '../../../components/layout/prisma.vue'
    import cylinder from '../../../components/layout/cylinder.vue'

    const el = ref()
</script>

<template>   
      <!-- (v3 fase C) conf-v3: titolo, card e bersagli v3 (assets/css/catalog-v3.css) -->
      <div class="view-shell conf-v3">
        <h2 v-if="!createNew" class="view-title">{{ $t('grating.data')}}  {{ $route.params.grating_ID }}</h2>
        <h2 v-if="createNew" class="view-title"> {{ $t('grating.createNew')}} </h2>

      <div class="pure-g grating-row">
      <div class="pure-u-11-24">

        <div class="pure-form pure-g grating-form-card">
            <!--fieldset-->
                <input type="hidden" name="id" v-model="$route.params.grating_ID" /> 
                <div class="pure-u-1">
                    <label class="pure-u-1">{{$t('Nome')}}</label>
                    <input type="text" class="pure-u-1" name="NAME" v-model="grating.NAME" :readonly="dataStored.userLevel<0" />
                </div>
                <div class="pure-u-1">
                    <label class="pure-u-1">{{$t('grating.descr')}}</label>
                    <input type="text" class="pure-u-1" name="DESCR" v-model="grating.DESCR" :readonly="dataStored.userLevel<0" />
                </div>
            
                <!--div class="pure-control-group">
                    <label for="aligned-foo">{{$t('grating.width')}}</label>
                    <input type="number" id="aligned-foo" name="width" v-model="grating.width" placeholder="" :readonly="dataStored.userLevel<0" /> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('grating.height')}}</label>
                    <input type="number" id="aligned-foo" name="height" v-model="grating.height" placeholder="" :readonly="dataStored.userLevel<0" /> mm
                </div-->
                <!-- (grating-model) il grigliato e' un MODELLO: qui non si
                     sceglie e non si associa nessun cassetto. L'anteprima usa
                     le misure della cassettiera (cassetto di riferimento);
                     l'associazione si fa dalla pagina Cassetti. -->
                <div class="pure-u-1 model-info">
                    <label class="pure-u-1">{{$t('grating.tray')}}</label>
                    <div class="model-hint">{{ $t('grating.modelHint', { w: grating.width, h: grating.height }) }}</div>
                    <div class="model-hint" v-if="!createNew">
                        <span v-if="usedByFloors.length">{{ $t('grating.usedBy', { floors: usedByFloors.join(', ') }) }}</span>
                        <span v-else>{{ $t('grating.usedByNone') }}</span>
                    </div>
                    <div class="model-hint model-warn" v-if="traySizesDiffer">{{ $t('grating.traySizesDiffer') }}</div>
                </div>
                <!-- -----------------  -->
                <div class="pure-u-1">
                    <label class="pure-u-1">{{$t('grating.part')}}</label>
                    <select class="pure-u-1" name="partList" v-model="grating.pieceIndex" @change="onChange($event)"
                        :readonly="dataStored.userLevel<0">
                        <option value="0"> </option>
                        <template v-for="(p,index) in partList" :key="p.ID">
                            <option :value="index+1" :selected="grating.pieceIndex==index+1">
                               {{ p.FAMILY }} - {{ p.DESCR }}
                            </option>
                        </template>                  
                    </select>
                </div>
                <!--p>{{ partList[grating.partList] }}</p-->
                <div class="pure-u-1">
                    <label class="pure-u-1">{{$t('Pinza')}}</label>
                    <select class="pure-u-1" name="gripperList" v-model="grating.gripperIndex" @change="onChangeGripper($event)"
                        :readonly="dataStored.userLevel<0">
                        <option value="0"> </option>
                        <!-- (gripper-twins) gripperList e' gia' UNA voce per pinza
                             fisica (util/grippers.js): via il filtro legacy
                             SUB_POS<=1 che escludeva la doppia -->
                        <template v-for="(g,index) in gripperList" :key="g.ID">
                            <option :value="index+1" :selected="grating.gripperIndex==index+1">
                               {{ g.POS_MAG>0?g.POS_MAG:'OUT' }} {{ g.FAMILY }} - {{ g.DESCR }}
                            </option>
                        </template>
                    </select>
                </div>
                <!--div class="pure-u-1" >
                    <label class="pure-u-1">{{$t('grating.safeX')}}</label>
                    <span class="pure-u-1">
                        <input type="number" class="pure-u-11-12" name="SAFEX" v-model="grating.SAFEX" 
						:readonly="dataStored.userLevel<0" :class="{'error':grating.SAFEX<minSafeX}"/> 
                        <span class="pure-u-1-12" style="vertical-align: middle;">&nbsp;mm</span>
                    </span>
                </div-->
                <div>
                    <label class="pure-u-1">{{$t('grating.safeX')}} [{{ minSafeX }}..{{ grating.width/2 }}]</label>
                    <numericField 
                        name="SAFEX" 
                        unitMeasure="mm" 
                        step=1 
                        :min=minSafeX
                        :max=grating.width/2
                        :model-value=grating.SAFEX
                        integerVal=true
                        @update="newValue => grating.SAFEX = newValue">
                    </numericField>
                    <small class="min-hint">min {{ minSafeX }} &middot; max {{ grating.width/2 }} mm</small>
                </div>
                <!-- (grating-pitch) interasse risultante: feedback live del
                     centro-centro che finira' a DB (read-only) -->
                <div>
                    <label class="pure-u-1">{{$t('grating.pitchX')}}</label>
                    <input type="text" class="pitch-field" :value="pitchXLabel" readonly tabindex="-1" />
                </div>    
                <!--div class="pure-u-1" >
                    <label class="pure-u-1">
						{{$t('grating.safeY')}} [{{ minSafeY }}..{{ grating.height/2 }}]
					</label>
                    <input type="number" class="pure-u-11-12" name="SAFEY" v-model="grating.SAFEY" 
						   :readonly="dataStored.userLevel<0" :class="{'error':grating.SAFEY<minSafeY}"/>  
                    <span class="pure-u-1-12" style="vertical-align: middle;">&nbsp;mm</span>
                </div-->       
                <div>
                    <label class="pure-u-1">{{$t('grating.safeY')}}</label>
                    <numericField 
                        name="SAFEY" 
                        unitMeasure="mm" 
                        step=1
                        :min=minSafeY
                        :max=grating.height/2
                        :model-value=grating.SAFEY
                        integerVal=true
                        @update="newValue => grating.SAFEY = newValue">
                    </numericField>
                    <small class="min-hint">min {{ minSafeY }} &middot; max {{ grating.height/2 }} mm</small>
                </div>
                <div>
                    <label class="pure-u-1">{{$t('grating.pitchY')}}</label>
                    <input type="text" class="pitch-field" :value="pitchYLabel" readonly tabindex="-1" />
                </div>
                <!-- (grating-thickness 14/9) spessore fisico della griglia, mm con
                     un decimale (a DB micron, NULL = non misurato = nessun
                     vincolo). Protezione anti-urto: Z_PICK/Z_PLACE del pezzo
                     devono stare sopra spessore + 1 mm. Qui solo AVVISO (il
                     modello si salva comunque); il blocco vero e' in
                     generazione tasche, client e server. -->
                <div>
                    <label class="pure-u-1">{{$t('grating.thickness')}}</label>
                    <numericField
                        name="THICKNESS"
                        unitMeasure="mm"
                        step=0.5
                        :min=0
                        :max=100
                        :model-value=grating.THICKNESS
                        @update="newValue => grating.THICKNESS = newValue">
                    </numericField>
                    <small class="min-hint">{{ $t('grating.thicknessHint') }}</small>
                    <div class="model-hint model-warn" v-if="thicknessWarn">
                        {{ $t('grating.thicknessWarn', { min: thicknessWarn.min / 1000, pick: thicknessWarn.zPick / 1000, place: thicknessWarn.zPlace / 1000 }) }}
                    </div>
                </div>
                <div class="pure-u-1 btn-group row-spaced grating-actions">
                    <!-- (cavity-clearance) il franco vale SOLO per i file di
                         fabbricazione, DXF e stampa PDF (dialog askCavity: un solo
                         punto di inserimento, mm, default 0.1 a ogni apertura della
                         pagina, mai salvato). Il modello SVG in Grating_model_dir e'
                         un file di RIFERIMENTO e resta NOMINALE: flusso diretto.
                         saveData e' async: .then, mai '&&' (era sempre vero). -->
                    <button class="pure-button pure-button-primary" @click="saveData().then(() => createModelFile())"
							:disabled="dataStored.userLevel<0 || grating.SAFEX<minSafeX || grating.SAFEY<minSafeY || saving">
                        {{ $t("grating.saveAndModel") }}
                    </button>
                    <!--button
                        style="padding:20px"
                        :disabled="!DownloadModel || createNew"
                        @click="DownloadModel()"
                        class="pure-button pure-button-primary buttonDownload">
                        {{$t("scarica modello")}} 
                    </button-->
                    
                    <!--button class="pure-button pure-button-primary"  style="padding:20px">
                        <img src="../../../assets/pdf.png" width="15%"></img>
                    </button-->
                    <button class="btn-ghost" @click="createModelFile()">{{ $t("grating.modelOnly") }}</button>
                    <button class="btn-ghost" @click="askCavity('dxf')" :disabled="listPz.length === 0">DXF</button>
                </div>

                <!-- dialog franco cavita' (comune a modello/DXF/stampa) -->
                <div v-if="cavityDialog.open" class="mission-dialog-overlay">
                    <div class="mission-dialog mission-dialog--narrow">
                        <h3 class="command-section-title">{{ $t('grating.cavity.title') }}</h3>
                        <div class="cavity-hint">{{ $t('grating.cavity.hint', { def: clearanceUmToMm(CAVITY_CLEARANCE_UM), max: clearanceUmToMm(CAVITY_CLEARANCE_MAX_UM) }) }}</div>
                        <label class="cavity-row">
                            <span>{{ $t('grating.cavity.label') }}</span>
                            <input type="number" class="cavity-input" inputmode="decimal"
                                   step="0.1" :min="0" :max="clearanceUmToMm(CAVITY_CLEARANCE_MAX_UM)"
                                   v-model="cavityDialog.value"
                                   @keyup.enter="confirmCavity()" />
                            <span>mm</span>
                        </label>
                        <div class="cavity-error" v-if="cavityDialog.error">{{ $t(cavityDialog.error, { max: clearanceUmToMm(CAVITY_CLEARANCE_MAX_UM) }) }}</div>
                        <div class="pure-g">
                            <div class="pure-u-1-2">
                                <button style="width:100%" class="button_pressed pure-button-mission" @click="confirmCavity()">
                                    {{ $t('grating.cavity.confirm') }}
                                </button>
                            </div>
                            <div class="pure-u-1-2">
                                <button style="width:100%" class="btn-ghost" @click="closeCavityDialog()">
                                    {{ $t('robot.dialog.cancel') }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="pure-u-1 row-spaced">
                    <!-- img nuda -> bottone canonico touch (handler 1:1) -->
                    <button type="button" class="btn-icon scene-iconbtn" @click="askCavity('print')"
                        :aria-label="$t('grating.print')" :title="$t('grating.print')">
                        <!-- PNG a glifo scuro invisibile su fondo scuro: SVG inline
                             stroke=currentColor, segue il colore del bottone -->
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round"
                             stroke-linejoin="round" aria-hidden="true">
                            <polyline points="6 9 6 2 18 2 18 9"/>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                    </button>
                </div>
                    
                <!--div>
                    <label class="pure-u-1">{{$t('bordo di sicurezza x')}} [{{ length=0 }}..{{ length=50 }}]</label>
                    <numericField 
                        name="SAFEY" 
                        unitMeasure="mm" 
                        step=1
                        min=0
                        max=300
                        :model-value=minBordoX
                        integerVal=true
                        @update="newValue => minBordoX = newValue">
                    </numericField>
                </div>
                <div>
                    <label class="pure-u-1">{{$t('bordo di sicurezza y')}} [{{ length=0 }}..{{ length=50 }}]</label>
                    <numericField 
                        name="SAFEY" 
                        unitMeasure="mm" 
                        step=1
                        min=0
                        max=300
                        :model-value=minBordoY 
                        integerVal=true
                        @update="newValue => minBordoY = newValue">
                    </numericField>
                </div-->
            <!--/fieldset-->
        </div>
      </div>
      <!-- LAYOUT -->
      <div class="pure-u-11-24">
        <!-- GR3 decaduta (cantiere AL): scena centrata dal viewBox computed -->
        <div class="pure-u-1 scene-caption">
            <h5>
                {{ $t('grating.rowsCols', { rows: n_row, cols: n_cln, tot: n_row*n_cln }) }} 
            </h5>
        </div>
        <!-- (base-dxf 7/10) base assente o non valida: riga rossa col messaggio
             e il file cercato; DXF e stampa bloccati, il resto funziona -->
        <div class="pure-u-1 base-line base-error" v-if="baseError" role="alert">{{ baseErrorText }}</div>
        <div class="pure-u-1 base-line base-warn" v-if="baseWarnings.length && !baseWarningsClosed">
            <span>{{ baseWarnings.map(w => $t(w.key, w.params)).join(' · ') }}</span>
            <button type="button" class="base-close" @click="baseWarningsClosed = true"
                :aria-label="$t('grating.base.close')" :title="$t('grating.base.close')">&times;</button>
        </div>
        <div class="pure-u-1 base-line base-conflict" v-if="pocketConflicts.length">{{ conflictText(pocketConflicts) }}</div>
        <div class="pure-u-1">
            <!-- @click="distribute()" RIMOSSO (fase 2b, ratificato): su touch panel
                 il contatto accidentale col disegno mutava SAFEX/SAFEY salvati;
                 la ridistribuzione vive solo nel bottone dedicato -->
            <svg id="trayLayout" width="480" height="360" version="1.1" xmlns="http://www.w3.org/2000/svg" 
                :viewBox="sceneViewBox"> 
                <!-- vassoio -->
                <rect id="tray" x="0" y="0" :width="grating.width" :height="grating.height" fill="#3A4A60" class="noPrint"/>

                <!-- (base-dxf, verso 7/10 sera) tasche nella vista LATO OPERATORE,
                     come la pagina Cassetti (TrayPockets) e Base.dxf: centro in
                     (w, h) di gridCenters, tasca 1 in alto a sinistra vicino
                     all'origine del work object. Coordinate ricalcolate, nessuna
                     transform: i numeri restano dritti. -->
                <g v-for="(p, index) in pocketsView" :key="index" >
                    <prisma v-if="p.prisma"
                            :x="p.x" :y="p.y"
                            :width="dim_x" :height="dim_y"
                            :status="p.status"
                            hideCenter="false">
                    </prisma>
                    <cylinder v-if="!p.prisma"
                            :x="p.x" :y="p.y"
                            :width="radius"
                            :status="p.status"
                            hideCenter="true">
                    </cylinder>
                </g>
                <!-- origine del work object (0,0), come in TrayPockets -->
                <g id="origin">
                    <circle cx="0" cy="0" r="12" fill="#FFFFFF" stroke="#111111" stroke-width="1.5"/>
                    <path d="M0 0 L12 0 A12 12 0 0 1 0 12 Z M0 0 L-12 0 A12 12 0 0 1 0 -12 Z" fill="#111111"/>
                </g>
                
                <!-- (base-dxf 7/10) base del grigliato da Base.dxf: profilo, fori
                     e testi nel frame lato operatore, x_svg = x_dxf e
                     y_svg = -y_dxf, nessuna rotazione. Niente id prisma_obj o
                     cylinder_obj qui dentro: il franco cavita' della stampa
                     (applyCavityClearanceToSvg) non deve allargare i fori. -->
                <g id="base" v-if="baseSvg">
                    <path :d="baseSvg.d" fill="none" stroke="#B2BDCE" stroke-width="1"/>
                    <circle v-for="(h, i) in baseSvg.holes" :key="'h' + i"
                        :r="h.r" :cx="h.cx" :cy="h.cy" fill="none" stroke="#B2BDCE" stroke-width="1"/>
                    <text v-for="(t, i) in baseSvg.texts" :key="'t' + i"
                        :x="t.x" :y="t.y" :font-size="t.size" :text-anchor="t.anchor"
                        :dominant-baseline="t.baseline" fill="#8A94A6">{{ t.text }}</text>
                </g>
                <!-- tasche troppo vicine a un foro o al profilo: in rosso, solo a
                     schermo (avviso, mai blocco); fuori dal modello SVG -->
                <g id="baseConflicts" class="noPrint" v-if="pocketConflicts.length">
                    <template v-for="c in pocketConflicts" :key="'c' + c.index">
                        <rect v-if="pocketsView[c.index] && pocketsView[c.index].prisma"
                            :x="pocketsView[c.index].x" :y="pocketsView[c.index].y" :width="dim_x" :height="dim_y"
                            fill="#EF4444" fill-opacity="0.55" stroke="#EF4444" stroke-width="2"/>
                        <circle v-else-if="pocketsView[c.index]"
                            :cx="pocketsView[c.index].x" :cy="pocketsView[c.index].y" :r="radius"
                            fill="#EF4444" fill-opacity="0.55" stroke="#EF4444" stroke-width="2"/>
                    </template>
                </g>
                <!-- numeri delle tasche (SUB_POS), sopra anche alla sovrapposizione rossa -->
                <g id="pocketNumbers">
                    <text v-for="p in pocketsView" :key="'n' + p.n"
                        :x="p.w" :y="p.h" :font-size="pocketNumberSize"
                        text-anchor="middle" dominant-baseline="central" fill="#FFFFFF"
                        stroke="#111111" stroke-width="2" paint-order="stroke">{{ p.n }}</text>
                </g>

                <!-- misure (solo stampa), vicino alla tasca 1. (verso 7/10 sera) la
                     tasca 1 sta in alto a sinistra: distanze fra le tasche a
                     destra (SAFEX) e sotto (SAFEY), margini dal bordo a sinistra
                     e sopra. I valori sono quelli di prima. -->
                <g v-if="listPz.length>0" class="noScreen">
                    <text :x="pocketsView[0].x+dim_x+3" :y="pocketsView[0].y+dim_y/2" fill="#2A3548" font-size="10">{{ grating.SAFEX }}</text>

                    <text v-for="(c, i) in cifreSotto(grating.SAFEY)" :key="'sy' + i"
                        :x="pocketsView[0].x+dim_x/2" :y="pocketsView[0].y+dim_y+c.dy" fill="#2A3548" font-size="10" rotate="-90">{{ c.ch }}</text>

                    <text v-for="(c, i) in cifreSopra(grating.height-listPz[0].y-dim_y)" :key="'my' + i"
                        :x="pocketsView[0].x+dim_x/2" :y="pocketsView[0].y+c.dy" fill="#2A3548" font-size="10" rotate="-90">{{ c.ch }}</text>

                    <text :x="pocketsView[0].x-3" :y="pocketsView[0].y+dim_y/2" fill="#2A3548" font-size="10" text-anchor="end">
                        {{ grating.width-listPz[0].x-dim_x }}
                    </text>

                    <text :x="pocketsView[0].x+dim_x/2-15" :y="pocketsView[0].y+dim_y/2" fill="#2A3548" font-size="10" rotate="0">
                        {{dim_x}}x{{dim_y}}
                    </text>
                </g>
                <!-- limiti del vassoio -->
                <g id="limits" class="noPrint">
                    <rect 
                        x="0"                
                        :y="minBordoY"               
                        :width="minBordoX"      
                        :height="grating.height-minBordoY*2"        
                        fill="#FBBF24" fill-opacity="0.35"/>
                    <rect 
                        x="0"                 
                        y="0"               
                        :width="grating.width" 
                        :height="minBordoY" 
                        fill="#FBBF24" fill-opacity="0.35"/>
                    <rect 
                        :x="grating.width-minBordoX"    
                        :y="minBordoY"                  
                        :width="minBordoX"      
                        :height="grating.height-minBordoY*2"        
                        fill="#FBBF24" fill-opacity="0.35"/>
                    <rect 
                        x="0"                 
                        :y="grating.height-minBordoY"  
                        :width="grating.width" 
                        :height="minBordoY" 
                        fill="#FBBF24" fill-opacity="0.35"/>
                </g>
                <animate
                    xlink:href="#limits"
                    attributeName="opacity"
                    values="1;0;1;0;1;0;1;"
                    dur="1s"
                    repeatCount="2" /> 

                <g class="noScreen">
                    <!-- cartiglio -->
                    <text x="20" y="655" 	fill="#2A3548" font-size="14" rotate="0">
                            {{$t("Nome")}} : {{$t("Grigliato")}} {{grating.NAME}}
                    </text>
                    <text x="320" y="655" 	fill="#2A3548" font-size="14" rotate="0">
                            {{$t("grating.dimensioniPz")}} : {{dim_x}}x{{dim_y}}
                    </text>
                    <text x="680" y="655" 	fill="#2A3548" font-size="14" rotate="0">
                            {{ $t('grating.generatedOn') }} {{new Date().toLocaleDateString()}}
                    </text>
                    <!-- (verso 7/10 sera) la vista del disegno -->
                    <text x="20" y="675" fill="#2A3548" font-size="12">{{ $t('grating.viewNote') }}</text>
                </g>
            </svg>

        </div>
        <!-- (base-dxf 7/10) quale Base.dxf sta disegnando il pannello -->
        <div class="pure-u-1 base-info" v-if="base && baseFile">{{ baseInfoText }}</div>
        <div class="pure-u-1">
            <!-- GR3 decaduta; img nuda -> bottone canonico touch (handler 1:1) -->
            <div class="pure-u-1 scene-actions">
                <button type="button" class="btn-icon scene-iconbtn" @click="distribute()"
                    :aria-label="$t('grating.redistribute')" :title="$t('grating.redistribute')">
                    <!-- PNG a glifo scuro invisibile su fondo scuro: SVG inline
                         stroke=currentColor, segue il colore del bottone -->
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round"
                         stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="7"/>
                        <rect x="14" y="3" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/>
                    </svg>
                </button>
</div>
        </div>
    </div>
    </div>
    </div>
</template>

<script>
// ============================================================================
// (grating-axis-swap-3, 1/9) La CONVENZIONE ASSI ROBOT vive in UN punto solo:
// util/gratingAxes.js (drawingToRobot: Y lungo width positivo = asse di
// SUB_POS, X lungo height = colonne, origine tasca 1 — validata sul robot
// con TRAY_9 corretto a DB). Qui resta solo l'adapter dalla forma di listPz
// ai centri {w,h} (pocketCentersWH).
// ============================================================================

// DXF di fabbricazione (R12, mm) nel FRAME DI Base.dxf (7/10): vista lato
// operatore, 0,0 in alto a sinistra (origine del work object), Y negativa
// verso il basso. Si sovrappone 1:1 a Base.dxf. Rispetto ai DXF esportati
// prima del 7/10 (vista lato robot, y = H - y_svg) e' ruotato di 180 gradi.
//   - profilo e fori: copiati dalla base letta (util/baseDxf.js), stesse
//     coordinate e stessi bulge (codice 42 sul VERTEX), non dal DOM; i testi
//     della base non si esportano (a chi taglia non servono);
//   - tasche: pieces nella vista lato operatore (pocketsOperatorView),
//     x_dxf = x_svg, y_dxf = -y_svg: una tasca robot (X, Y) cade in
//     (Y/1000, -X/1000).
// pieces/dimX/dimY/radius arrivano NOMINALI (gli stessi dell'anteprima): il
// franco cavita' (util/cavityClearance.js, clearanceUm scelto all'export,
// default la costante) viene applicato SOLO qui, sul layer PIECES, a centro
// invariato.
// Export nominato per i test (test_cavity_clearance.mjs, test_base_dxf.mjs).
export function buildGratingDxf({ base = null, pieces, dimX, dimY, radius, clearanceUm = CAVITY_CLEARANCE_UM }) {
  const fy = (y) => -Number(y);
  // quote emesse arrotondate al micron: niente rumore binario (es. 40.10000000000001)
  const q = (v) => String(Math.round(Number(v) * 1e6) / 1e6);
  // la base si copia com'e', senza arrotondare: i numeri vengono dal file
  const raw = (v) => String(Number(v));
  const out = [];
  const e = (...v) => out.push(...v);
  e('0','SECTION','2','HEADER',
    '9','$ACADVER','1','AC1009',
    '9','$INSUNITS','70','4',
    '0','ENDSEC');
  e('0','SECTION','2','TABLES',
    '0','TABLE','2','LTYPE','70','1',
    '0','LTYPE','2','CONTINUOUS','70','0','3','Solid line','72','65','73','0','40','0',
    '0','ENDTAB',
    '0','TABLE','2','LAYER','70','4',
    '0','LAYER','2','0','70','0','62','7','6','CONTINUOUS',
    '0','LAYER','2','PROFILE','70','0','62','7','6','CONTINUOUS',
    '0','LAYER','2','HOLES','70','0','62','1','6','CONTINUOUS',
    '0','LAYER','2','PIECES','70','0','62','3','6','CONTINUOUS',
    '0','ENDTAB',
    '0','ENDSEC');
  e('0','SECTION','2','ENTITIES');
  // pts gia' nel frame DXF e gia' scritti: [x, y] o [x, y, bulge]
  const polyClosed = (layer, pts) => {
    e('0','POLYLINE','8',layer,'66','1','70','1');
    for (const [px, py, bulge] of pts) {
      e('0','VERTEX','8',layer,'10',px,'20',py);
      if (bulge) e('42', bulge);
    }
    e('0','SEQEND','8',layer);
  };
  // rettangolo in coordinate SVG -> frame DXF
  const polyRect = (layer, x, y, w, h) => {
    x = Number(x); y = Number(y); w = Number(w); h = Number(h);
    polyClosed(layer, [[x, fy(y)], [x + w, fy(y)], [x + w, fy(y + h)], [x, fy(y + h)]].map(([a, b]) => [q(a), q(b)]));
  };
  // la base e' gia' nel frame DXF: si copia com'e', bulge compresi
  if (base && base.profile) polyClosed('PROFILE', base.profile.map(v => [raw(v.x), raw(v.y), v.bulge ? raw(v.bulge) : '']));
  for (const hh of (base && base.holes) || []) {
    e('0','CIRCLE','8','HOLES','10', raw(hh.cx), '20', raw(hh.cy), '40', raw(hh.r));
  }
  for (const p of pieces) {
    if (p.prisma) {
      const c = cavityRect(p.x, p.y, dimX, dimY, clearanceUm);
      polyRect('PIECES', c.x, c.y, c.w, c.h);
    } else {
      e('0','CIRCLE','8','PIECES','10', q(p.x), '20', q(fy(p.y)), '40', q(cavityRadius(radius, clearanceUm)));
    }
  }
  e('0','ENDSEC','0','EOF');
  return out.join('\n') + '\n';
}

// (base-dxf, verso 7/10 sera) le tasche nella vista LATO OPERATORE, la stessa
// della pagina Cassetti (TrayPockets: centro in (w, h) di robotToDrawing) e
// di Base.dxf: centro in (w, h) di gridCenters, quindi tasca 1 in alto a
// sinistra, vicino all'origine del work object (0,0). listPz di buildGrid e'
// nella vista lato robot (tasca 1 in basso a destra) e resta com'e': e' il dato
// da cui nascono le quote del robot (gridCenters -> drawingToRobot). Qui cambia
// solo dove si disegna: x, y come in listPz (spigolo del prisma, centro del
// cilindro), n = SUB_POS.
export function pocketsOperatorView(listPz, { width, height, dim_x, dim_y }) {
  const c = gridCenters(listPz, { width, height, dim_x, dim_y });
  return (listPz || []).map((p, i) => p.prisma
    ? { prisma: true, status: p.status, n: i + 1, w: c[i].w, h: c[i].h, x: c[i].w - dim_x / 2, y: c[i].h - dim_y / 2 }
    : { prisma: false, status: p.status, n: i + 1, w: c[i].w, h: c[i].h, x: c[i].w, y: c[i].h });
}

// (base-dxf 7/10) la sovrapposizione rossa delle tasche in conflitto e' solo
// un avviso a schermo: non entra nel modello SVG di riferimento
export function stripPreviewOnly(svgString) {
  return String(svgString).replace(/<g id="baseConflicts"[^>]*>[\s\S]*?<\/g>/, '');
}

export default {
    data(){
        return {
            grating:{
                NAME:'',
                DESCR:'',
                SAFEX:5,
                SAFEY:5,
                THICKNESS:null,   // (grating-thickness) mm nel form, micron a DB; null = non misurato
				TRAY_ID:0,      // (grating-model) colonna morta: sempre 0, il legame e' TRAY.FAMILY
				GRIPPER_ID:0,
				PIECE_ID:0,
                // (grating-model) trayIndex = cassetto di RIFERIMENTO per le
                // misure dell'anteprima (1-based su trayList), scelto in
                // automatico da getTrayList: NON e' un'associazione.
                trayIndex:0,
                gripperIndex:0,
                pieceIndex:0
            },
            createNew:false,
            n_cln:0,
            n_row:0,
            spaceNullX:0,
            spaceNullY:0,
            x:0,
            y:0,
            gratingList:{},
            partList:{},
            gripperList:{},
            trayList:{},
            listPz:[], 
            dim_x:0,
            dim_y:0,
            radius:0,
            prismatic:true,
            minSafeX:0,             //il minimo raggiungibile in base ai dati della pinza
            minSafeY:0,             //il minimo raggiungibile in base ai dati della pinza
            minBordoX:20,           //bordo minimo dx/sx — (2b-2) diventerà derivato dalle chele  
            minBordoY:20,           //bordo minimo sopra/sotto — (2b-2) diventerà derivato dalle chele
            // (dup-race 4/9) un solo salvataggio in volo (anti doppio-tap)
            saving: false,
            // (cavity-clearance) franco cavita' per le uscite di fabbricazione:
            // micron, default la costante a ogni apertura, mai persistito
            cavityUm: CAVITY_CLEARANCE_UM,
            cavityDialog: { open: false, action: null, value: '', error: '' }, 
            // (base-dxf 7/10) base del grigliato letta da Base.dxf (loadBase):
            // base = risultato di parseBaseDxf (coordinate DXF) o null;
            // baseError = { key, params } per la riga rossa; baseFile = percorso,
            // data di modifica e dimensione dagli header della route
            base: null,
            baseError: null,
            baseFile: null,
            baseWarnings: [],
            baseWarningsClosed: false,
            readyToDownload:false   //activa il download del file di progetto svg
        }
    },
    watch:{
        'grating.SAFEX'(newValue){
			// (2c) pavimento di sicurezza: mai sotto il minimo pinza-derivato
			// (vale per digitazione, +/- e valori caricati da DB)
			if (newValue<this.minSafeX)
				this.grating.SAFEX=this.minSafeX
			if (newValue>this.grating.width/2)
				this.grating.SAFEX=this.grating.width/2
			this.calculateData()
        },
        'grating.SAFEY'(newValue){
            // (2c) pavimento di sicurezza: mai sotto il minimo pinza-derivato
            if (newValue<this.minSafeY)
                this.grating.SAFEY=this.minSafeY
            if (newValue>this.grating.height/2)
                this.grating.SAFEY=this.grating.height/2
            this.calculateData()
        },
    },
    methods: {
        calcolaY(p){
            return !p.prisma?p.y+10:p.y+this.dim_y/2;
        },
        calcolaX(p){
            return !p.prisma?p.x-20:p.x;
        },
        getPiecesList() {
            return fetch( dataStored.server+'api/conf/piece/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.partList=data;
                    //console.log("partList: "+JSON.stringify(this.partList,null,4))
                })
                .catch(error => {
                    console.info(error);
                });
        },
        getGripperList() {
            return fetch( dataStored.server+'api/conf/gripper/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    // (gripper-twins) una voce per pinza fisica, ID canonico
                    this.gripperList = dedupeGrippers(data);
                })
                .catch(error => {
                    console.info(error);
                });
        },
        getTrayList() {
            return fetch( dataStored.server+'api/conf/tray/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.trayList=data;
                    // (grating-model) cassetto di RIFERIMENTO per le misure
                    // dell'anteprima: il primo piano reale con misure valide
                    // (la cassettiera e' uniforme: 820x610 su tutti i 12).
                    const ref = (data || []).findIndex(t => t.FLOOR_MAG > 0 && t.X > 0 && t.Y > 0);
                    if (ref >= 0) {
                        this.grating.trayIndex = ref + 1;
                        this.grating.width  = data[ref].X / 1000;
                        this.grating.height = data[ref].Y / 1000;
                    }
                })
                .catch(error => {
                    console.info(error);
                });
        },
        // (base-dxf 7/10) la base del grigliato da Base.dxf, nella cartella
        // Grating_model_dir del backend: a ogni apertura della pagina, senza
        // cache del browser (un file sostituito vale subito). Servono W e H
        // del cassetto di riferimento: si chiama dopo getTrayList.
        loadBase() {
            this.base = null;
            this.baseError = null;
            this.baseFile = null;
            this.baseWarnings = [];
            this.baseWarningsClosed = false;
            return fetch( dataStored.server+'api/conf/grating/base',{ method: 'GET', cache: 'no-store' })
                .then(async response => {
                    if (!response.ok) {
                        let body = {};
                        try { body = await response.json(); } catch (e) { /* corpo non JSON */ }
                        this.baseError = baseRouteError(response.status, body);
                        return;
                    }
                    const text = await response.text();
                    let path = '';
                    try { path = decodeURIComponent(response.headers.get('X-Base-Path') || ''); } catch (e) { path = ''; }
                    this.baseFile = {
                        path: path || 'Base.dxf',
                        mtime: response.headers.get('Last-Modified') || '',
                        size: Number(response.headers.get('X-Base-Size')) || text.length,
                    };
                    const r = parseBaseDxf(text, { width: this.grating.width, height: this.grating.height });
                    if (r.error) {
                        this.baseError = { key: r.error.key, params: Object.assign({}, r.error.params, { path: this.baseFile.path }) };
                        return;
                    }
                    this.base = r;
                    this.baseWarnings = r.warnings || [];
                })
                .catch(error => {
                    console.info(error);
                    this.baseError = { key: 'grating.base.err.network', params: { msg: String(error && error.message || error) } };
                });
        },
        getGratingList() {
            //console.log("grating: "+this.$route.params.grating_ID);
            if (this.$route.params.grating_ID==0) return;
            fetch( dataStored.server+'api/conf/grating/show/'+this.$route.params.grating_ID,{ method: 'GET'})  
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    //console.log(JSON.stringify(data,null,4))
                    this.gratingList=data;
                    //scritto cosi alle volte non riesco a riempire tutti i campi per un ritardo di risposta dal DB
                    // (grating-model) TRAY_ID ignorato: il modello non ha cassetto;
                    // le misure dell'anteprima vengono dal cassetto di riferimento
                    // scelto in getTrayList.
                    this.grating.TRAY_ID=0;
                    this.grating.PIECE_ID=data[0].PIECE_ID;
                    this.grating.GRIPPER_ID=data[0].GRIPPER_ID;

                    this.grating.SAFEX=data[0].SAFEX;
                    this.grating.SAFEY=data[0].SAFEY;
                    // (grating-thickness) micron -> mm; NULL resta null (non misurato)
                    this.grating.THICKNESS = (data[0].THICKNESS === null || data[0].THICKNESS === undefined) ? null : Number(data[0].THICKNESS) / 1000;

                    let index=1;
                    // (gripper-twins) niente piu' decodifica dell'ID composito
                    // legacy (ID*1000+subID): GRATING.GRIPPER_ID e' l'ID canonico
                    this.gripperList.forEach(gripper => {
                        if (gripper.ID == this.grating.GRIPPER_ID){
                            this.grating.gripperIndex = index;
                            //console.log("this.grating.gripperIndex: "+this.grating.gripperIndex)
                        }
                        index++;
                    });
                    index=1;
                    this.partList.forEach(part => {
                        if (part.ID == this.grating.PIECE_ID){
                            this.grating.pieceIndex = index;
                            //console.log("this.grating.pieceIndex: "+this.grating.pieceIndex )
                        }
                        index++;
                    });
                    this.grating.DESCR=this.gratingList[0].DESCR;
                    this.grating.NAME=this.gratingList[0].NAME;
                    // (fase 2b, fix reattivita') ricalcolo ESPLICITO a valle
                    // della risoluzione di indici e vassoio: prima nessuno lo
                    // chiamava e il disegno restava vuoto/stantio finche' un
                    // evento (il click sul disegno) non mutava SAFEX.
                    this.calculateData();
                })
                .catch(error => {
                    console.info(error);
                });
        },
        calculateData(){
            if (this.grating.gripperIndex<=0 || this.grating.pieceIndex<=0){
                //alert ("selezionare tipo pinza e tipo pezzo")
                return;
            }
            this.listPz=[];
            if (this.grating.pieceIndex<=0) return; //se non ho ancora ricevuto tutti i dati allora salto l'aggiornamento del layout
            this.x=this.partList[this.grating.pieceIndex-1].X/1000 ;
            this.y=this.partList[this.grating.pieceIndex-1].Y/1000 ;
            this.prismatic=this.partList[this.grating.pieceIndex-1].PRISMA;
            // (grating-model) griglia dalla util condivisa (formula grating-
            // pitch invariata: passo = pezzo + distanza, fencepost su area
            // utile, residuo centrato). Stessa funzione che usa il dialog
            // "Associa/Rigenera" della gestione cassetti: anteprima e tasche
            // scritte NON possono divergere.
            const g = buildGrid({
                pieceX: this.x, pieceY: this.y, prismatic: this.prismatic,
                safeX: this.grating.SAFEX, safeY: this.grating.SAFEY,
                width: this.grating.width, height: this.grating.height,
                minBorderX: this.minBordoX, minBorderY: this.minBordoY,
            });
            this.n_cln = g.n_cln; this.n_row = g.n_row;
            this.spaceNullX = g.spaceNullX; this.spaceNullY = g.spaceNullY;
            this.listPz = g.listPz;
            if (this.prismatic) { this.dim_x = g.dim_x; this.dim_y = g.dim_y; }
            else this.radius = g.radius;

            const ms = gripperMinSafe(this.gripperList[this.grating.gripperIndex-1], this.prismatic);
            this.minSafeX = ms.minSafeX;
            this.minSafeY = ms.minSafeY;
            // (2c) pavimento post-calcolo dei minimi: il valore arrivato da DB
            // (o digitato prima che i minimi fossero noti) risale al minimo;
            // il set innesca il watcher che ricalcola con il valore corretto.
            if (this.grating.SAFEX < this.minSafeX) this.grating.SAFEX = this.minSafeX;
            if (this.grating.SAFEY < this.minSafeY) this.grating.SAFEY = this.minSafeY;
            this.grating.ID=this.$route.params.grating_ID;
        },
        onChange(event) {
			this.grating.PIECE_ID=this.partList[this.grating.pieceIndex-1].ID;
            this.calculateData();
            this.distribute();
        },
        onChangeGripper(){
            this.calculateData();
            // (grating-save, bonifica) NIENTE sovrascrittura di SAFEX: la
            // DISTANZA e' dell'operatore; il pavimento di sicurezza pinza-
            // derivato vive gia' nel clamp min (minSafeX/minSafeY, che
            // calculateData rialza da solo se il valore corrente e' sotto).
            // La riga rimossa sovrascriveva SAFEX ad ogni cambio pinza (e
            // conteneva pure l'off-by-one censito: gripperList[gripperIndex]
            // senza -1 sul secondo termine — muore con la riga).
            this.grating.GRIPPER_ID=this.gripperList[this.grating.gripperIndex-1].ID;
            this.distribute();
        },
        distribute(){
            // (2b) morte del rilassamento iterativo: la distribuzione centra
            // da sola il residuo; SAFEX/SAFEY appartengono all'OPERATORE (li
            // edita a mano se vuole piu' aria). Ricalcolo puro -> IDEMPOTENTE.
            this.calculateData();
        },
        // (grating-thickness) payload header: THICKNESS in micron, '' = NULL
        // (non misurato). Il resto dell'oggetto grating passa com'e' (SAFEX/
        // SAFEY sono in mm anche a DB, per eredita').
        headerPayload() {
            const t = this.grating.THICKNESS;
            const um = (t === null || t === undefined || t === '' || !(Number(t) > 0)) ? '' : Math.round(Number(t) * 1000);
            return Object.assign({}, this.grating, { THICKNESS: um });
        },
        async saveData() {
            // (dup-race 4/9) anti doppio-tap: UN solo salvataggio in volo
            // (governa anche il :disabled del bottone).
            if (this.saving) return;
            // (grating-model) "Salva" scrive SOLO l'header del MODELLO
            // (insert/update GRATING): NESSUNA tasca, NESSUN cassetto toccato.
            // Le tasche nascono/muoiono solo dalla gestione cassetti
            // (Associa / Sostituisci / Rigenera / Dissocia). Il check di
            // ingombro resta come avviso sul cassetto di riferimento: un
            // modello che non entra nella cassettiera non ha senso salvarlo.
            if (!this.checkGridFit()) return;
            if (this.grating.NAME.trim().length == 0) { alert(this.$t('grating.nameRequired')); return; }
            this.saving = true;
            try {
                var cmd = ""
                if (!this.createNew){
                    //eseguo aggiornamento -> update DB
                    cmd = dataStored.server+'api/conf/grating/updategrating?' + new URLSearchParams( this.headerPayload() ).toString();
                }else{
                    //nuovo grigliato -> insert DB
                    cmd = dataStored.server+'api/conf/grating/insertgrating?' + new URLSearchParams( this.headerPayload() ).toString();
                }
                const r = await fetch( cmd ,{ method: 'GET'});
                if (!r.ok) { alert("errore"); throw new Error('Network response was not ok'); }
                // body = error contract (KO_DUP_NAME: NAME e' la chiave del
                // legame TRAY.FAMILY, deve essere unico)
                const esito = (await r.text()).trim();
                if (esito == KO_DUP_NAME) { alert(this.$t('grating.dupName', { name: this.grating.NAME.trim() })); return; }
                if (esito != 'OK') { alert('KO ['+esito+']'); return; }
                this.$router.push('/conf/Gratings');
            } catch (error) {
                console.info(error);
                alert(error)
            } finally {
                this.saving = false;
            }
        },
        // Centri tasca in coordinate DISEGNO {w,h} (mm): w lungo width, h
        // lungo height, ordine = SUB_POS. Adapter unico per drawingToRobot /
        // gridFit (la convenzione assi sta in util/gratingAxes.js).
        pocketCentersWH() {
            return gridCenters(this.listPz, { width: this.grating.width, height: this.grating.height, dim_x: this.dim_x, dim_y: this.dim_y });
        },
        // (Task 3, 1/9) ingombro griglia vs contorno, in coordinate DISEGNO
        // (finestra fissa [0,width] x [0,height], mm): lo sforo lungo width e'
        // sull'asse robot Y (TRAY.X lo limita), lungo height sull'asse X
        // (TRAY.Y) — vedi ROBOT_AXIS_ALONG. Contorno = TRAY.X/Y del cassetto
        // selezionato (fresco da trayList). CORR esclusi: X_CORR/Y_CORR del
        // TRAY spostano il cassetto nel frame robot, non la griglia (fino alla
        // vista 4Robot v3 erano un offset uguale per tutte le tasche; dalla v4,
        // work object per cassetto 6/10, non entrano piu' nelle quote).
        checkGridFit() {
            if (this.listPz.length === 0) return true;
            const tray = this.trayList[this.grating.trayIndex-1];
            const fit = gridFit(this.pocketCentersWH(), {
                width:  tray && tray.X > 0 ? tray.X/1000 : this.grating.width,
                height: tray && tray.Y > 0 ? tray.Y/1000 : this.grating.height,
                halfW: (this.prismatic ? this.dim_x : this.x)/2,
                halfH: (this.prismatic ? this.dim_y : this.y)/2,
            });
            if (fit.ok) return true;
            const detail = [];
            if (fit.overW > 0) detail.push(this.$t('grating.outOfTrayAxis', { mm: Math.ceil(fit.overW), axis: ROBOT_AXIS_ALONG.width }));
            if (fit.overH > 0) detail.push(this.$t('grating.outOfTrayAxis', { mm: Math.ceil(fit.overH), axis: ROBOT_AXIS_ALONG.height }));
            alert(this.$t('grating.outOfTray', { detail: detail.join(', ') }));
            return false;
        },
        // (base-dxf 7/10) tasche contro la base, col franco `um`: cavita' in
        // coordinate SVG, controllo in util/baseDxf.js pocketsVsBase. Solo
        // avviso, mai blocco.
        baseConflicts(um = this.cavityUm) {
            if (!this.base || !this.listPz || this.listPz.length === 0) return [];
            const cavities = this.pocketsView.map(p => {
                if (p.prisma) {
                    const c = cavityRect(p.x, p.y, this.dim_x, this.dim_y, um);
                    return { tipo: 'rect', x: c.x, y: c.y, w: c.w, h: c.h };
                }
                return { tipo: 'circle', cx: Number(p.x), cy: Number(p.y), r: cavityRadius(this.radius, um) };
            });
            return pocketsVsBase(this.base, cavities, BASE_WEB_MM);
        },
        // cifre in colonna per le quote di stampa (ruotate di -90, si leggono dal
        // basso): la prima cifra in fondo, come le quote di prima
        cifreSopra(valore) {
            const ch = String(valore).split('');
            const dy = [-6, -11, -17, -23];
            return ch.map((c, k) => ({ ch: c, dy: dy[k] !== undefined ? dy[k] : -23 - 6 * (k - 3) }));
        },
        cifreSotto(valore) {
            const ch = String(valore).split('');
            return ch.map((c, k) => ({ ch: c, dy: 8 + 6 * (ch.length - 1 - k) }));
        },
        // «tasche N, M: troppo vicine a un foro / al profilo» (N = SUB_POS)
        conflictText(list) {
            const holes = list.filter(c => c.foro).map(c => c.index + 1);
            const profile = list.filter(c => c.profilo).map(c => c.index + 1);
            const parts = [];
            if (holes.length) parts.push(this.$t('grating.base.conflictHoles', { list: holes.join(', '), web: BASE_WEB_MM }));
            if (profile.length) parts.push(this.$t('grating.base.conflictProfile', { list: profile.join(', '), web: BASE_WEB_MM }));
            return parts.join(' · ');
        },
        // ===== (cavity-clearance) franco cavita' scelto all'export =====
        // Un solo dialog per le due uscite di FABBRICAZIONE (DXF, stampa PDF):
        // mostra il valore corrente in mm (default CAVITY_CLEARANCE_UM a ogni
        // apertura della pagina, mai salvato), valida 0..max con un decimale
        // e poi lancia l'azione col valore in micron. La conversione mm<->um
        // vive SOLO in util/cavityClearance.js. Il modello SVG (createModelFile
        // / DownloadModel) e' di RIFERIMENTO e non passa di qui: nominale.
        askCavity(action) {
            // (base-dxf 7/10) un file di fabbricazione senza base non esce
            if (!this.base) { alert(this.baseBlockedText); return; }
            this.cavityDialog.action = action;
            this.cavityDialog.value = String(clearanceUmToMm(this.cavityUm));
            this.cavityDialog.error = '';
            this.cavityDialog.open = true;
        },
        closeCavityDialog() {
            this.cavityDialog.open = false;
            this.cavityDialog.action = null;
            this.cavityDialog.error = '';
        },
        confirmCavity() {
            const um = clearanceMmToUm(this.cavityDialog.value);
            if (!isValidClearanceUm(um)) {
                this.cavityDialog.error = 'grating.cavity.rangeError';
                return;
            }
            this.cavityUm = um;   // resta per le prossime uscite di QUESTA pagina
            const action = this.cavityDialog.action;
            this.closeCavityDialog();
            this.runCavityAction(action, um);
        },
        runCavityAction(action, um) {
            if (!this.base) { alert(this.baseBlockedText); return; }
            // tasche troppo vicine a un foro o al profilo, col franco scelto
            const conflicts = this.baseConflicts(um);
            if (conflicts.length && !confirm(this.$t('grating.base.conflictConfirm', { detail: this.conflictText(conflicts) }))) return;
            switch (action) {
                case 'dxf':      return this.esportaDXF(um);
                case 'print':    return this.stampaDiv(um);
            }
        },
        DownloadModel(){
            //con la pagina a tutto schermo, il download NON VIENE VISUALIZZATO
            const svgElement = document.getElementById('trayLayout');

            if (!svgElement) {
                alert('SVG NOT FOUND!');
                return;
            }

            //Serializzazione dello SVG in una stringa XML.
            const serializer = new XMLSerializer();
            // stesso modello SVG di createModelFile: file di RIFERIMENTO,
            // cavita' NOMINALI come nell'anteprima (niente franco)
            let svgString = stripPreviewOnly(resolveCssVars(serializer.serializeToString(svgElement)));

            //Creazione di un Blob e un URL per il file.
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            //Creazione del link per il download
            const a = document.createElement('a');
            a.href = url;
            a.download = this.grating.NAME + '.svg'; // Imposta il nome del file.

            //Simulazione del click per avviare il download
            document.body.appendChild(a);
            a.click();

            // Rimuovi il link e l'URL temporaneo dopo il download.
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        esportaDXF(clearanceUm = CAVITY_CLEARANCE_UM) {
            if (!this.listPz || this.listPz.length === 0) {
                alert('Nessun pezzo distribuito: niente da esportare.');
                return;
            }
            if (!this.base) { alert(this.baseBlockedText); return; }
            // (base-dxf 7/10) profilo e fori dalla base letta, non dal DOM
            // (verso 7/10 sera) tasche nella vista lato operatore: nel DXF una
            // tasca robot (X, Y) cade in (Y/1000, -X/1000)
            const dxf = buildGratingDxf({
              base: this.base,
              pieces: this.pocketsView,
              dimX: this.dim_x,
              dimY: this.dim_y,
              radius: this.radius,
              clearanceUm,
            });
            const blob = new Blob([dxf], { type: 'application/dxf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (this.grating.NAME || 'grating') + '.dxf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        stampaDiv(clearanceUm = CAVITY_CLEARANCE_UM) {
            if (!this.base) { alert(this.baseBlockedText); return; }
            //aprendo la finestra di stampa, posso stampare il modello o salvarlo come PDF
            var contenutoOriginale = document.body.innerHTML;
            var contenutoStampa = document.getElementById('trayLayout');
            const serializer = new XMLSerializer();
            // stampa/PDF = file di fabbricazione: franco cavita' sulla stringa,
            // il DOM dell'anteprima non viene toccato (util/cavityClearance.js)
            let svgString = applyCavityClearanceToSvg(resolveCssVars(serializer.serializeToString(contenutoStampa)), clearanceUm);

            //console.log(svgString)

            svgString = svgString.replaceAll("@@width@@",this.dim_x);
            svgString = svgString.replaceAll("@@height@@",this.dim_y);

            document.body.innerHTML = svgString ;
            

            window.print();
            document.body.innerHTML = contenutoOriginale;
            // Opzionale: ricarica la pagina per reinizializzare tutti gli script, ecc.
            window.location.reload();
        },
        createModelFile() {  //genera il file SVG da scaricare nella cartella del pannello operatore
            var contenutoOriginale = document.body.innerHTML;
            var contenutoStampa = document.getElementById('trayLayout');
            const serializer = new XMLSerializer();
            // modello SVG in Grating_model_dir = file di RIFERIMENTO, non di
            // fabbricazione: cavita' NOMINALI, identiche all'anteprima (il
            // franco vale solo per DXF e stampa PDF — confermato dal cliente 1/9)
            let svgString = stripPreviewOnly(resolveCssVars(serializer.serializeToString(contenutoStampa)));

            document.body.innerHTML = svgString ;

            var cmd = dataStored.server+'api/conf/grating/saveModel/'+this.grating.NAME;
            
            fetch( cmd ,{   
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json'},
                            body: JSON.stringify({ xml: svgString })
                        })
                .then(response => {
                    if (!response.ok) {
                        alert("Error: Network response was not ok")
                    }else
                        alert(this.$t("Modello creato e disponibile nella cartella predefinita del pannello"))
                 })
                .catch(error => {
                    alert(error)
                });

            document.body.innerHTML = contenutoOriginale;
            //window.location.reload();
        }
    },
    computed:{
        // (grating-model) cassetti che USANO questo modello (TRAY.FAMILY =
        // NAME, uguaglianza): solo informativo, l'associazione vive nella
        // pagina Cassetti.
        usedByFloors(){
            const name = (this.grating.NAME || '').trim();
            if (!name || !Array.isArray(this.trayList)) return [];
            return this.trayList
                .filter(t => t.FLOOR_MAG > 0 && (t.FAMILY || '').trim() == name)
                .map(t => t.FLOOR_MAG)
                .sort((a, b) => a - b);
        },
        // cassettiera NON uniforme: l'anteprima vale solo per il cassetto di
        // riferimento, il dialog di associazione ricalcola sul cassetto scelto
        traySizesDiffer(){
            if (!Array.isArray(this.trayList)) return false;
            const real = this.trayList.filter(t => t.FLOOR_MAG > 0 && t.X > 0 && t.Y > 0);
            return real.some(t => t.X != real[0].X || t.Y != real[0].Y);
        },
        // (grating-pitch) interasse risultante (centro-centro) che finira'
        // a DB: pezzo + distanza, aggiornato live; null finche' manca il pezzo
        pitchX(){
            return this.grating.pieceIndex>0 ? this.x + this.grating.SAFEX : null;
        },
        pitchY(){
            return this.grating.pieceIndex>0 ? this.y + this.grating.SAFEY : null;
        },
        // (grating-thickness) avviso NON bloccante: il pezzo scelto ha Z_PICK o
        // Z_PLACE (quote dal fondo) sotto spessore + franco. null = tutto ok
        // o spessore non misurato.
        thicknessWarn(){
            const t = this.grating.THICKNESS;
            const piece = this.partList && this.grating.pieceIndex > 0 ? this.partList[this.grating.pieceIndex-1] : null;
            if (!piece || !(Number(t) > 0)) return null;
            const c = pickClearance({ thickness: Math.round(Number(t) * 1000), zPick: piece.Z_PICK, zPlace: piece.Z_PLACE });
            return c.ok ? null : c;
        },
        // (verso 7/10 sera) le tasche come si disegnano: vista lato operatore
        pocketsView(){
            return pocketsOperatorView(this.listPz, { width: Number(this.grating.width), height: Number(this.grating.height), dim_x: this.dim_x, dim_y: this.dim_y });
        },
        // numero della tasca: in proporzione alla tasca, leggibile
        pocketNumberSize(){
            const lato = this.prismatic ? Math.min(this.dim_x, this.dim_y) : 2 * this.radius;
            return Math.max(6, Math.min(24, Math.round((Number(lato) || 0) * 0.4)));
        },
        // (base-dxf 7/10) la base nelle coordinate dello SVG (y cambiata di
        // segno, archi spezzati), o null se manca o non e' valida
        baseSvg(){
            return this.base ? baseToSvg(this.base) : null;
        },
        // riga rossa: messaggio della util o della route, e il file cercato
        baseErrorText(){
            const e = this.baseError;
            if (!e) return '';
            const msg = this.$t(e.key, e.params || {});
            const path = e.params && e.params.path;
            return path ? this.$t('grating.base.errLine', { msg, path }) : this.$t('grating.base.errLineNoPath', { msg });
        },
        // DXF e stampa senza base: lo stesso messaggio della riga rossa
        baseBlockedText(){
            const why = this.baseError ? this.baseErrorText : this.$t('grating.base.loading');
            return why + '\n' + this.$t('grating.base.blocked');
        },
        baseInfoText(){
            if (!this.base || !this.baseFile) return '';
            const d = this.baseFile.mtime ? new Date(this.baseFile.mtime) : null;
            const mtime = d && !isNaN(d) ? d.toLocaleString() : '?';
            return this.$t('grating.base.info', { path: this.baseFile.path, mtime, holes: (this.base.holes || []).length });
        },
        // tasche in conflitto con la base, col franco corrente della pagina
        pocketConflicts(){
            return this.baseConflicts(this.cavityUm);
        },
        pitchXLabel(){
            return this.pitchX!=null ? this.pitchX+' mm' : '\u2014';
        },
        pitchYLabel(){
            return this.pitchY!=null ? this.pitchY+' mm' : '\u2014';
        },
        // ==================================================================
        // CANTIERE AL — viewBox reattivo sui bounds reali della scena: il
        // vassoio dai dati (grating.width/height), il riquadro della base
        // letta da Base.dxf (base-dxf 7/10; prima era un PROF fisso misurato
        // sul path scritto a mano) e il cartiglio print (y 655 e 675). Senza base
        // si inquadra il solo cassetto. Margine di respiro uniforme.
        // ==================================================================
        sceneViewBox(){
            const CART_Y = 680;    // cartiglio di stampa a y 655 e 675
            const M = 25;          // margine di respiro uniforme
            const w = Number(this.grating.width) || 0;
            const h = Number(this.grating.height) || 0;
            const b = this.baseSvg ? this.baseSvg.bbox : { minX: 0, minY: 0, maxX: w, maxY: h };
            const minX = Math.min(0, b.minX) - M;
            const minY = Math.min(0, b.minY) - M;
            const maxX = Math.max(w, b.maxX) + M;
            const maxY = Math.max(h, b.maxY, CART_Y) + M;
            return minX + ' ' + minY + ' ' + (maxX - minX) + ' ' + (maxY - minY);
        }
    },
    mounted(){
        // (fase 2b) getGratingList parte SOLO a liste caricate: il vecchio
        // setTimeout(300) era una race — con trayList ancora vuota il forEach
        // esplodeva e la funzione moriva a meta'.
        // (base-dxf 7/10) la base dopo getTrayList: il controllo contro il
        // cassetto vuole W e H.
        Promise.all([this.getPiecesList(), this.getGripperList(), this.getTrayList()])
            .then(() => { this.loadBase(); this.getGratingList(); });

        if (this.$route.params.grating_ID>0){
            //faccio modifica di un grigliato gia creato
            this.createNew=false;
        }else
            //creo un nuovo grigliato
            this.createNew=true;
    }
}
</script>

<style scoped>
/* (cavity-clearance) dialog franco cavita': stesso overlay delle view missione */
/* dialog: stile comune in assets/css/dialogs.css (UI-DESIGN-SYSTEM v2 §12) */
.cavity-hint {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
}
.cavity-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-base);
}
.cavity-input {
    width: 7em;
    min-height: 44px;
    background: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-md);
    text-align: right;
}
/* (base-dxf 7/10) righe della base sopra e sotto il disegno */
.base-line {
    box-sizing: border-box;
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    margin-bottom: var(--space-2);
    font-size: var(--font-size-sm);
}
.base-error {
    background: var(--color-danger-bg);
    color: var(--color-danger);
    border: 1px solid var(--color-danger);
    font-weight: var(--font-weight-semibold);
}
/* (verso 7/10 sera) le tasche in conflitto sono un avviso: giallo. Il rosso
   resta per «base assente o non valida» */
.base-conflict {
    background: var(--color-warning-bg);
    color: var(--color-warning);
    border: 1px solid var(--color-warning);
    font-weight: var(--font-weight-semibold);
}
.base-warn {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    background: var(--color-warning-bg);
    color: var(--color-warning);
    border: 1px solid var(--color-warning);
}
.base-warn span { flex: 1; }
.base-close {
    min-width: 44px;
    min-height: 44px;
    background: transparent;
    color: inherit;
    border: none;
    font-size: var(--font-size-md);
    cursor: pointer;
}
.base-info {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    margin-top: var(--space-1);
    word-break: break-all;
}
.cavity-error {
    background: var(--color-danger-bg);
    color: var(--color-danger);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    font-weight: var(--font-weight-semibold);
}

    /* Cantiere AL: form a norma design system (pattern del form Particolare) */
    .grating-form-card{
        background: var(--bg-card);
        border: var(--border-card);
        border-radius: var(--radius-md);
        padding: var(--space-5);
    }

    .min-hint{
        display: block;
        font-size: var(--font-size-xs);
        color: var(--text-muted);
        margin-top: var(--space-1); /* micro-aggiustamento ottico hint-campo */
    }

    .grating-form-card label{
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--text-secondary);
        margin-bottom: var(--space-1); /* micro-aggiustamento ottico label-campo */
    }

    .grating-form-card input[type="text"],
    .grating-form-card select{
        box-sizing: border-box;
        min-height: 44px;              /* touch: deroga 44 campi form */
        padding: var(--space-2) var(--space-4);
        background: var(--bg-input);
        color: var(--text-primary);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: var(--font-size-base);
        transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .grating-form-card input[type="text"]:focus,
    .grating-form-card select:focus{
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 1px var(--accent);
    }

    /* Bottoni GEMELLI: metrica esatta di Piece.vue (AK-BIS) — pill h52
       min-width 140, selettore rinforzato contro la cascata pure */
    .pure-form .grating-actions .pure-button-primary,
    .pure-form .grating-actions .btn-ghost{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        height: 52px;
        min-width: 140px;
        padding: 0 var(--space-5);
        margin: 0;
        border-radius: var(--radius-btn);
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        font-family: inherit;
        line-height: 1;
        letter-spacing: 0.025em;
        text-decoration: none;
        cursor: pointer;
    }

    /* bottoni-icona scena (stampa PDF, ridistribuisci): touch, niente img nude */
    .scene-iconbtn{
        min-width: 52px;
        min-height: 52px;
    }

    /* stato disabled visibile (subdued ma leggibile, filosofia UI-7.5) */
    .scene-iconbtn:disabled{
        opacity: 0.5;
        cursor: not-allowed;
    }

    .scene-caption{
        text-align: center;
        color: var(--text-secondary);
    }

    .scene-actions{
        display: flex;
        justify-content: center;
        margin-top: var(--space-2);
    }
	.error{
		background-color: var(--color-danger-bg);
	}
    .optionDeleted{
        color: var(--color-warning);
        /*text-decoration: line-through;*/
    }

    /* Ex inline (GR2): spaziatura riga azioni + margine del bottone associa. */
    .row-spaced{
        margin-top: var(--space-5);
    }

    /* Shell §2.3: riga a due colonne form | preview (come layout-row di
       ImportGrating). pure-g e' flex, il gap si applica. */
    .grating-row{
        gap: var(--space-4);
        align-items: flex-start;
    }
    .associate-btn{
        margin-top: var(--space-2);
    }

    @media screen{
        .noScreen{
            display: none;
        }
    }

    @media print{
        .noPrint{
            display: none;
        }
    }

    /* (grating-pitch) campo interasse read-only: da form ma chiaramente
       non editabile (feedback, non input) */
    .pitch-field {
        box-sizing: border-box;
        min-height: 44px;
        padding: var(--space-1) var(--space-3);
        background: var(--bg-surface);
        color: var(--text-secondary);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-md);
        font-size: var(--font-size-base);
        cursor: default;
    }
/* (grating-model) blocco informativo al posto del select cassetto */
.model-hint {
    color: var(--text-secondary);
    font-size: 0.9em;
    margin-top: var(--space-1);
}
.model-warn {
    color: var(--color-danger);
}
</style>
