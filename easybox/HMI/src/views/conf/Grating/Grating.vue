<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../../data.js'
    import { KO_ACTIVE_ORDER } from '../../../util/errorCodes.js'
    import { drawingToRobot, gridFit } from '../../../util/gratingAxes.js'
    import { cavityRect, cavityRadius, applyCavityClearanceToSvg } from '../../../util/cavityClearance.js'
    import numericField from '../../../components/numericField.vue'
    import { ref, onMounted } from 'vue'
    //import layout from '../layoutView.vue'

    import prisma from '../../../components/layout/prisma.vue'
    import cylinder from '../../../components/layout/cylinder.vue'

    const el = ref()
</script>

<template>   
      <div class="view-shell">
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
                <div class="pure-u-1">
                    <label class="pure-u-1">{{$t('grating.tray')}}</label>
                    <select class="pure-u-1" 
                        name="trayList" 
                        v-model="grating.trayIndex" 
                        @change="onChangeTrayList($event)" 
                        :readonly="dataStored.userLevel<0"
                        :disabled="grating.trayIndex>0 && gratingAssociated">

                        <option value="0"> </option>
                        <template v-for="(t,index) in trayList" :key="t.ID">
                            <option :value="index+1"
                                    :selected="grating.trayIndex==index+1"
                                    :disabled="(t.FAMILY.trim().length>0||t.FLOOR_MAG<=0)"
                                    :class="{'optionDeleted':t.FAMILY.trim().length>0}"> 
                                    {{ t.FLOOR_MAG>0?t.FLOOR_MAG:'OUT' }} - {{ t.DESCR }} 
                                    <span v-if="t.FAMILY.trim().length>0">&nbsp;{{$t('alreadyAssociated')}}</span>
                                    <!-- :class="{'optionDeleted':t.FAMILY.trim()!=''}"> -->
                            </option>
                        </template>                  
                    </select>
                    <button class="pure-button-primary pure-u-1 associate-btn"
                        :disabled="grating.trayIndex==0 || grating.NAME.trim().length<=0 || gratingAssociated || !createNew"
                        @click="setGratingAssociated()" > <!-- updateGratingInTray-->
                        <span > <!-- v-if="!gratingAssociated"-->
                            {{$t("grating.associate")}}
                        </span>
                    </button>
                    <!--button v-if="grating.trayIndex>=0" @click="grating.trayIndex=-1">
                            {{$t("grating.disassociate")}}
                            //bisogna anche cancellare le posizioni
                    </button-->
                </div>
                <!-- -----------------  -->
                <div class="pure-u-1">
                    <label class="pure-u-1">{{$t('grating.part')}}</label>
                    <select class="pure-u-1" name="partList" v-model="grating.pieceIndex" @change="onChange($event)" 
                        :readonly="dataStored.userLevel<0 || (!gratingAssociated && createNew)">
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
                        :readonly="dataStored.userLevel<0 || (!gratingAssociated && createNew)">
                        <option value="0"> </option>
                        <template v-for="(g,index) in gripperList" :key="g.ID">
                            <option :value="index+1" v-if="g.SUB_POS<=1" :selected="grating.gripperIndex==index+1">
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
                <div class="pure-u-1 btn-group row-spaced grating-actions">
                    <button class="pure-button pure-button-primary" @click="saveData() && createModelFile()"
							:disabled="dataStored.userLevel<0 || grating.SAFEX<minSafeX || grating.SAFEY<minSafeY ">
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
                    <button class="btn-ghost" @click="esportaDXF()" :disabled="listPz.length === 0">DXF</button>
                </div>
                <div class="pure-u-1 row-spaced">
                    <!-- img nuda -> bottone canonico touch (handler 1:1) -->
                    <button type="button" class="btn-icon scene-iconbtn" @click="stampaDiv()"
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
        <div class="pure-u-1">
            <!-- @click="distribute()" RIMOSSO (fase 2b, ratificato): su touch panel
                 il contatto accidentale col disegno mutava SAFEX/SAFEY salvati;
                 la ridistribuzione vive solo nel bottone dedicato -->
            <svg id="trayLayout" width="480" height="360" version="1.1" xmlns="http://www.w3.org/2000/svg" 
                :viewBox="sceneViewBox"> 
                <!-- vassoio -->
                <rect id="tray" x="0" y="0" :width="grating.width" :height="grating.height" fill="#3A4A60" class="noPrint"/>

                <!-- profilo esterno -->
                <path d="M15 5 
                        l112 0 l0 -4 l100 0 l0 4 
                        l372 0 l0 -4 l100 0 l0 4
                        l110 0
                        l5 5
                        l0 235 l6 0 l0 25 l-8 0 
                        l0 70  l8 0 l0 25 l-6 0 
                        l0 230 
                        l-5 5
                        l-117 0 l0 5 l-100 0 l0 -5 
                        l-370 0 l0 5 l-100 0 l0 -5 
                        l-111 0
                        l-5 -5
                        l0 -240 l-5 0 l0 -25 l8 0 
                        l0 -70 l-8 0 l0 -25 l5 0 
                        l0 -225
                        Z" 
                        fill="none" stroke="#B2BDCE" stroke-width="1"/>
                              
                <g v-for="(p, index) in listPz" :key="index" >
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
                
                <!-- fori -->
                <circle r="3" cx="18"  cy="15" fill="none" stroke="#B2BDCE" stroke-width="1"/>
                <circle r="3" cx="398" cy="15" fill="none" stroke="#B2BDCE" stroke-width="1"/>
                <circle r="3" cx="802" cy="15" fill="none" stroke="#B2BDCE" stroke-width="1"/>
                
                <circle r="3" cx="18"  cy="300" fill="none" stroke="#B2BDCE" stroke-width="1"/>
                <circle r="3" cx="398" cy="300" fill="none" stroke="#B2BDCE" stroke-width="1"/>
                <circle r="3" cx="802" cy="300" fill="none" stroke="#B2BDCE" stroke-width="1"/>
                
                <circle r="3" cx="18"  cy="593" fill="none" stroke="#B2BDCE" stroke-width="1"/>
                <circle r="3" cx="398" cy="593" fill="none" stroke="#B2BDCE" stroke-width="1"/>
                <circle r="3" cx="802" cy="593" fill="none" stroke="#B2BDCE" stroke-width="1"/>

                <!-- misure-->
                <!--text :x="listPz[0].x:0" :y="listPz[0].y+10" fill="#2A3548" font-size="10">{{dim_x}}x{{dim_y}}</text-->
                <g v-if="listPz.length>0" class="noScreen">
                    <text :x="listPz[0].x-20" :y="listPz[0].y+dim_y/2" fill="#2A3548" font-size="10">{{ grating.SAFEX }}</text>
                    
                    <text :x="listPz[0].x+dim_x/2" :y="listPz[0].y-17"  fill="#2A3548" font-size="10" rotate="-90" v-if="grating.SAFEY.toString()[2]>0">{{ grating.SAFEY.toString()[2] }}</text>
                    <text :x="listPz[0].x+dim_x/2" :y="listPz[0].y-11"  fill="#2A3548" font-size="10" rotate="-90" v-if="grating.SAFEY.toString()[1]>=0">{{ grating.SAFEY.toString()[1] }}</text>
                    <text :x="listPz[0].x+dim_x/2" :y="listPz[0].y-6"   fill="#2A3548" font-size="10" rotate="-90">{{ grating.SAFEY.toString()[0] }}</text>
                    
                    <text :x="listPz[0].x+dim_x/2" :y="listPz[0].y+dim_y+8" fill="#2A3548" font-size="10" rotate="-90">
                        {{ (grating.height-listPz[0].y-dim_y).toString()[1] }}
                    </text>
                    <text :x="listPz[0].x+dim_x/2" :y="listPz[0].y+dim_y+14" fill="#2A3548" font-size="10" rotate="-90">
                        {{ (grating.height-listPz[0].y-dim_y).toString()[0] }}
                    </text>
                    
                    <text :x="listPz[0].x+dim_x+10" :y="listPz[0].y+dim_y/2" fill="#2A3548" font-size="10" rotate="0">
                        {{ grating.width-listPz[0].x-dim_x }}
                    </text>

                    <text :x="listPz[0].x+dim_x/2-15" :y="listPz[0].y+dim_y/2" fill="#2A3548" font-size="10" rotate="0">
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
                </g>
            </svg>
            
        </div>
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
// (grating-axis-swap-2, 1/9) La CONVENZIONE ASSI ROBOT vive in UN punto solo:
// util/gratingAxes.js (drawingToRobot: X lungo width positivo, Y lungo height
// negata — validata sui dati DB di TRAY_9). Qui resta solo l'adapter dalla
// forma di listPz ai centri {w,h} (pocketCentersWH). Il blocco DIR_X/DIR_Y
// del 23/7 e' stato rimosso: invertiva i ruoli degli assi su numeri attesi
// mai riscontrati sul ferro (incidente TRAY_8 dell'1/9).
// ============================================================================

// DXF di fabbricazione (R12, mm). pieces/dimX/dimY/radius arrivano NOMINALI
// (gli stessi dell'anteprima): il franco cavita' (util/cavityClearance.js)
// viene applicato SOLO qui, sul layer PIECES, a centro invariato.
// Export nominato per il test (test_cavity_clearance.mjs).
export function buildGratingDxf({ width, height, pieces, dimX, dimY, radius, flipY = true, profileD = null, holes = [] }) {
  const W = Number(width), H = Number(height);
  const fy = (y) => (flipY ? H - Number(y) : Number(y));
  // quote emesse arrotondate al micron: niente rumore binario (es. 40.10000000000001)
  const q = (v) => String(Math.round(Number(v) * 1e6) / 1e6);
  const out = [];
  const e = (...v) => out.push(...v);
  const pathToPts = (d) => {
    const toks = d.match(/[MmLlZz]|-?\d*\.?\d+/g) || [];
    const pts = []; let i = 0, x = 0, y = 0, cmd = null;
    while (i < toks.length) {
      const t = toks[i];
      if (/^[MmLlZz]$/.test(t)) { cmd = t; i++; if (t === 'Z' || t === 'z') break; continue; }
      const a = parseFloat(toks[i]), b = parseFloat(toks[i + 1]); i += 2;
      if (cmd === 'M') { x = a; y = b; cmd = 'L'; }
      else if (cmd === 'm') { x += a; y += b; cmd = 'l'; }
      else if (cmd === 'L') { x = a; y = b; }
      else if (cmd === 'l') { x += a; y += b; }
      pts.push([x, y]);
    }
    return pts;
  };
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
  const polyClosed = (layer, pts) => {
    e('0','POLYLINE','8',layer,'66','1','70','1');
    for (const [px, py] of pts) e('0','VERTEX','8',layer,'10',q(px),'20',q(fy(py)));
    e('0','SEQEND','8',layer);
  };
  const polyRect = (layer, x, y, w, h) => {
    x = Number(x); y = Number(y); w = Number(w); h = Number(h);
    polyClosed(layer, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  };
  if (profileD) polyClosed('PROFILE', pathToPts(profileD));
  for (const hh of holes) {
    e('0','CIRCLE','8','HOLES','10', q(hh.cx), '20', q(fy(hh.cy)), '40', q(hh.r));
  }
  for (const p of pieces) {
    if (p.prisma) {
      const c = cavityRect(p.x, p.y, dimX, dimY);
      polyRect('PIECES', c.x, c.y, c.w, c.h);
    } else {
      e('0','CIRCLE','8','PIECES','10', q(p.x), '20', q(fy(p.y)), '40', q(cavityRadius(radius)));
    }
  }
  e('0','ENDSEC','0','EOF');
  return out.join('\n') + '\n';
}

export default {
    data(){
        return {
            grating:{
                NAME:'',
                DESCR:'',
                SAFEX:5,
                SAFEY:5,
				TRAY_ID:0, 
				GRIPPER_ID:0, 
				PIECE_ID:0,
                trayIndex:0,
                gripperIndex:0,
                pieceIndex:0
            },
            gratingAssociated:false,
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
                    this.gripperList=data;                    
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
                    //console.log("trayList: "+JSON.stringify(this.trayList,null,4))
                })
                .catch(error => {
                    console.info(error);
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
                    this.grating.TRAY_ID=data[0].TRAY_ID; 
                    this.grating.PIECE_ID=data[0].PIECE_ID; 
                    this.grating.GRIPPER_ID=data[0].GRIPPER_ID; 
                    
                    this.grating.SAFEX=data[0].SAFEX;  
                    this.grating.SAFEY=data[0].SAFEY;
                    
                    let index=0;
                    this.trayList.forEach(tray => {
                        //console.log(index +" : "+tray.FLOOR_MAG +" "+tray.ID +" - "+ this.grating.TRAY_ID)
                        if (tray.ID == this.grating.TRAY_ID){
                            // (2c) indice 1-based, allineato a select/onChange/savePositions
                            this.grating.trayIndex = index+1;
                            //console.log("--------- this.grating.trayIndex: "+this.grating.trayIndex)
                        }
                        index++;
                    });
                    index=1;
                    this.gripperList.forEach(gripper => {
                        //console.log(this.grating.GRIPPER_ID +" - "+gripper.ID)
                        if (this.grating.GRIPPER_ID>1000){
                            this.grating.GRIPPER_ID = Math.trunc(this.grating.GRIPPER_ID/1000)
                        }
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
                    if (this.grating.trayIndex > 0 && 
                        typeof (this.trayList[this.grating.trayIndex-1].X) !== 'undefined'){
                        if (this.trayList[this.grating.trayIndex-1].X>0)
                            this.grating.width=this.trayList[this.grating.trayIndex-1].X/1000;
                        if (this.trayList[this.grating.trayIndex-1].Y>0)
                            this.grating.height=this.trayList[this.grating.trayIndex-1].Y/1000;
                    }
                    // (2c) il grigliato caricato con TRAY_ID e' gia' associato:
                    // select cassetto bloccata e stato coerente col bottone
                    if (this.grating.TRAY_ID > 0)
                        this.gratingAssociated = true;
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
            if (this.prismatic)
                this.calculatePrisma();
            else
                this.calculateCylinder();
 
            this.minSafeX=this.gripperList[this.grating.gripperIndex-1].STROKE_CLAW/1000+this.gripperList[this.grating.gripperIndex-1].TICKNESS_CLAW/1000;
            if (this.prismatic){
                this.minSafeY=this.gripperList[this.grating.gripperIndex-1].TICKNESS_CLAW/1000;
            }else{
                this.minSafeY=this.gripperList[this.grating.gripperIndex-1].STROKE_CLAW/1000+this.gripperList[this.grating.gripperIndex-1].TICKNESS_CLAW/1000;
            }
            // (2c) pavimento post-calcolo dei minimi: il valore arrivato da DB
            // (o digitato prima che i minimi fossero noti) risale al minimo;
            // il set innesca il watcher che ricalcola con il valore corretto.
            if (this.grating.SAFEX < this.minSafeX) this.grating.SAFEX = this.minSafeX;
            if (this.grating.SAFEY < this.minSafeY) this.grating.SAFEY = this.minSafeY;
            this.grating.ID=this.$route.params.grating_ID;
        },
        calculateCylinder(){
            // (grating-pitch) FORMULA DICHIARATA:
            //   passo X (centro-centro) = pezzo.x + SAFEX
            //   passo Y (centro-centro) = pezzo.y + SAFEY
            // SAFEX/SAFEY = DISTANZA TRA I PEZZI (riqualificata, gia'
            // persistita a DB: zero cambi schema); la sicurezza pinza vive
            // nel clamp min (minSafeX/minSafeY). Contributo chele ELIMINATO
            // (era sempre 0: nessun input lo alimentava, e pesava 2x nel
            // divisore ma 1x nel passo). n per asse = fencepost corretto:
            // n pezzi occupano n*pezzo + (n-1)*distanza nell'area utile
            // (width/height - 2*minBordo); il residuo centra la griglia
            // (margini simmetrici, 2b). corrX/corrY morti rimossi.
            const stepX = this.x + this.grating.SAFEX;
            const stepY = this.y + this.grating.SAFEY;
            const utilX = this.grating.width  - 2*this.minBordoX;
            const utilY = this.grating.height - 2*this.minBordoY;
            this.n_cln = (this.x>0 && stepX>0) ? Math.max(0, Math.floor((utilX + this.grating.SAFEX)/stepX)) : 0;
            this.n_row = (this.y>0 && stepY>0) ? Math.max(0, Math.floor((utilY + this.grating.SAFEY)/stepY)) : 0;
            this.spaceNullX = this.n_cln>0 ? utilX - this.n_cln*this.x - (this.n_cln-1)*this.grating.SAFEX : utilX;
            this.spaceNullY = this.n_row>0 ? utilY - this.n_row*this.y - (this.n_row-1)*this.grating.SAFEY : utilY;

            for (let r=1; r<=this.n_row; r++){
                for (let c=1;c<=this.n_cln; c++){
                    let obj = {}    // {prisma:false, x:700, y:500, status:2},
                    obj.prisma = false;
                    // centro cerchio: spigolo prisma equivalente + pezzo/2;
                    // margini simmetrici: residuo/2 per lato
                    obj.x=-this.minBordoX+this.grating.width+this.grating.SAFEX-stepX*c+this.x/2-this.spaceNullX/2;
                    obj.y=-this.minBordoY+this.grating.height+this.grating.SAFEY-stepY*r+this.y/2-this.spaceNullY/2;
                    obj.status=2;
                    this.listPz.push(obj);
                }
            }
            this.radius=this.x/2;
        },
        calculatePrisma(){
            // (grating-pitch) stessa formula dichiarata di calculateCylinder:
            //   passo = pezzo + distanza (SAFEX/SAFEY), fencepost su area
            //   utile, residuo centrato. obj.x/y = spigolo del prisma.
            const stepX = this.x + this.grating.SAFEX;
            const stepY = this.y + this.grating.SAFEY;
            const utilX = this.grating.width  - 2*this.minBordoX;
            const utilY = this.grating.height - 2*this.minBordoY;
            this.n_cln = (this.x>0 && stepX>0) ? Math.max(0, Math.floor((utilX + this.grating.SAFEX)/stepX)) : 0;
            this.n_row = (this.y>0 && stepY>0) ? Math.max(0, Math.floor((utilY + this.grating.SAFEY)/stepY)) : 0;
            this.spaceNullX = this.n_cln>0 ? utilX - this.n_cln*this.x - (this.n_cln-1)*this.grating.SAFEX : utilX;
            this.spaceNullY = this.n_row>0 ? utilY - this.n_row*this.y - (this.n_row-1)*this.grating.SAFEY : utilY;

            for (let r=1; r<=this.n_row; r++){
                for (let c=1;c<=this.n_cln; c++){
                    let obj = {}    // {prisma:true, x:700, y:500, status:2},
                    obj.prisma = true;
                    // margini simmetrici: residuo/2 per lato
                    obj.x=-this.minBordoX+this.grating.width+this.grating.SAFEX-stepX*c-this.spaceNullX/2;
                    obj.y=-this.minBordoY+this.grating.height+this.grating.SAFEY-stepY*r-this.spaceNullY/2;
                    obj.status=2;
                    this.listPz.push(obj);
                }
            }
            this.dim_x=this.x;
            this.dim_y=this.y;
        },
        onChange(event) {
			this.grating.PIECE_ID=this.partList[this.grating.pieceIndex-1].ID;
            this.calculateData();
            this.distribute();
        },
        onChangeTrayList(){
            this.grating.width=this.trayList[this.grating.trayIndex-1].X/1000;
            this.grating.height=this.trayList[this.grating.trayIndex-1].Y/1000;  
			this.grating.TRAY_ID=this.trayList[this.grating.trayIndex-1].ID;			
            this.calculateData();
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
        setGratingAssociated(){
            this.gratingAssociated=!this.gratingAssociated;
            if (!this.gratingAssociated) {
                this.grating.pieceIndex=0;
                this.grating.gripperIndex=0;
                this.calculateData();
            }
        },
        async saveData() {
            // (Task 3, 1/9) BLOCCO ingombro PRIMA di qualsiasi scrittura
            // (header GRATING incluso): griglia fuori dal contorno = tasche
            // sbagliate scritte in silenzio (incidente TRAY_8).
            if (!this.checkGridFit()) return;
            // (grating-save) ramo grigliato ESISTENTE: guardrail e conferma
            // PRIMA di qualsiasi scrittura — annullare = zero modifiche,
            // anche sull'header GRATING (coerenza header/posizioni).
            if (!this.createNew) {
                const goAhead = await this.confirmRegenerate();
                if (!goAhead) return;
            }

            var cmd = ""
            if (!this.createNew){
                //eseguo aggiornamento -> update DB
                cmd = dataStored.server+'api/conf/grating/updategrating?' + new URLSearchParams( this.grating ).toString();
            }else{
                //nuovo grigliato -> insert DB
                cmd = dataStored.server+'api/conf/grating/insertgrating?' + new URLSearchParams( this.grating ).toString();
            }
            fetch( cmd ,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        alert("errore")
                        throw new Error('Network response was not ok');
                    }
                    // (grating-save) posizioni AWAITED prima di navigare via
                    // (prima: fire-and-forget + push immediato)
                    return this.savePositions();
                })
                .then(() => {
                    this.updateGratingInTray();
                    this.$router.push('/conf/Gratings');
                })
                .catch(error => {
                    console.info(error);
                    alert(error)
                });
        },
        // (grating-save) guardrail pre-rigenerazione del cassetto:
        //  - BLOCCO se una posizione referenzia un ordine ATTIVO
        //    (Order_ID != 0 con WORKORDERS.STATUS == 3);
        //  - altrimenti conferma esplicita SEMPRE, con conteggi REALI delle
        //    righe a DB del cassetto — perimetro = PARENT del floor (stesso
        //    PARENT = 'TRAY_{floor}' della delete backend, helper trayParent),
        //    incluse le orfane con POS/PARENT divergenti (bug D2): dopo il
        //    save il cassetto avra' SOLO le N righe nuove;
        //  - verifica impossibile -> annulla (MAI cancellare alla cieca).
        async confirmRegenerate() {
            const tray = this.trayList[this.grating.trayIndex-1];
            const floor = tray ? tray.FLOOR_MAG : 0;
            if (!(floor > 0)) return true;   // nessun cassetto: niente da rigenerare
            try {
                const positions = await fetch(dataStored.server+'api/conf/position/show/all',{ method: 'GET'})
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); });
                // equivalente client di PARENT = 'TRAY_{floor}' (PARENT nchar
                // paddato: il primo token trim-mato e' 'TRAY_{floor}')
                const mine = (positions || []).filter(p => ((p.PARENT || '').trim().split(' ')[0]) == 'TRAY_'+floor);
                if (mine.length == 0) return true;
                const orders = await fetch(dataStored.server+'api/order/show/all',{ method: 'GET'})
                    .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); });
                const activeIds = new Set((orders || []).filter(o => o.STATUS == 3).map(o => o.ID));
                const busy = mine.some(p => p.Order_ID && activeIds.has(p.Order_ID));
                if (busy) {
                    alert(this.$t('grating.saveBlockedOrder'));
                    return false;
                }
                const notEmpty = mine.filter(p => p.STATUS != 2).length;
                return confirm(this.$t('grating.confirmRegenerate', { n: mine.length, floor: floor, m: notEmpty }));
            } catch (e) {
                console.info(e);
                alert(this.$t('grating.saveCheckFailed'));
                return false;
            }
        },
        // Centri tasca in coordinate DISEGNO {w,h} (mm): w lungo width, h
        // lungo height, ordine = SUB_POS. Adapter unico per drawingToRobot /
        // gridFit (la convenzione assi sta in util/gratingAxes.js).
        pocketCentersWH() {
            return this.listPz.map(p => ({
                w: p.prisma ? this.grating.width  - (p.x + this.dim_x/2) : this.grating.width  - p.x,
                h: p.prisma ? this.grating.height - (p.y + this.dim_y/2) : this.grating.height - p.y,
            }));
        },
        // (Task 3, 1/9) confronto ingombro griglia vs contorno TRAY.X/TRAY.Y.
        // Nominale, CORR esclusi: nella vista 4Robot X_CORR/Y_CORR del TRAY
        // sono un offset di teaching uguale per tutte le tasche (spostano il
        // cassetto nel frame robot, non la griglia dentro il contorno).
        checkGridFit() {
            if (this.listPz.length === 0) return true;
            const tray = this.trayList[this.grating.trayIndex-1];
            if (!tray) return true;
            const fit = gridFit(drawingToRobot(this.pocketCentersWH()), {
                trayX: tray.X,
                trayY: tray.Y,
                halfW: (this.prismatic ? this.dim_x : this.x)/2 * 1000,
                halfH: (this.prismatic ? this.dim_y : this.y)/2 * 1000,
            });
            if (fit.ok) return true;
            const detail = [];
            if (fit.overX > 0) detail.push(this.$t('grating.outOfTrayAxis', { mm: Math.ceil(fit.overX/1000), axis: 'X' }));
            if (fit.overY > 0) detail.push(this.$t('grating.outOfTrayAxis', { mm: Math.ceil(fit.overY/1000), axis: 'Y' }));
            alert(this.$t('grating.outOfTray', { detail: detail.join(', ') }));
            return false;
        },
        async savePositions() {
            // (grating-save) grigliato ESISTENTE: DELETE-THEN-INSERT.
            // L'update per SUB_POS non poteva ne' cancellare le righe
            // eccedenti ne' creare le nuove, e con PARENT/POS storici
            // divergenti era un no-op TOTALE con risposta OK (bug 91@60).
            // La delete usa deletePositionsTray: PARENT = 'TRAY_{floor}'
            // (helper trayParent backend) — sparisce OGNI riga del cassetto;
            // poi SOLO insert delle N posizioni correnti.
            // LIMITE DICHIARATO — NON ATOMICO (due endpoint distinti): se un
            // insert fallisce dopo la delete lo stato e' incompleto ma
            // RECUPERABILE ripetendo il salvataggio (alert esplicito).
            const floorMag = this.trayList[this.grating.trayIndex-1].FLOOR_MAG;
            // (grating-axis-swap-2) coordinate robot dall'adapter + util
            // condivisa: origine = tasca 1, X lungo width, Y = -height.
            // Riscontro TRAY_9 (DB cella): tasca1 (50000,-65000), tasca2
            // (110000,-65000), tasca14 (50000,-145000), tasca91 (770000,-545000).
            const robotPts = drawingToRobot(this.pocketCentersWH());
            if (!this.createNew) {
                try {
                    const del = await fetch(dataStored.server+'api/conf/position/deletePositionsTray/'+floorMag ,{ method: 'delete'});
                    if (!del.ok) throw new Error('Network response was not ok');
                    // (tray-parent-predicate) la route ora RISPONDE: prima
                    // restava muta (res.send commentati) e questo await non
                    // tornava MAI — il ciclo di insert qui sotto era
                    // irraggiungibile e il cassetto restava senza tasche.
                    // Body = error contract: la guardia server-side puo'
                    // bloccare su ordine attivo.
                    const esito = (await del.text()).trim();
                    if (esito == KO_ACTIVE_ORDER) {
                        alert(this.$t('grating.saveBlockedOrder'));
                        return;
                    }
                    if (esito != 'OK') throw new Error('delete posizioni ['+esito+']');
                } catch (e) {
                    console.info(e);
                    alert(this.$t('grating.saveIncomplete'));
                    return;
                }
            }
            let failed = 0;
            for (let i=0; i<this.listPz.length; i++){
                let pos={};
                pos.SUB_POS=i+1;
                pos.POS=this.trayList[this.grating.trayIndex-1].MAG;
                pos.TRAY_ID=floorMag;
                pos.PIECE_TYPE=this.partList[this.grating.pieceIndex-1].ID;
                pos.STATUS=2;  //EMPTY
                pos.SAFEX=this.grating.SAFEX
                pos.SAFEY=this.grating.SAFEY

                pos.X = robotPts[i].X;
                pos.Y = robotPts[i].Y;   // micron, gia' in convenzione robot

                pos.EASYBOX = dataStored.EasyBox;

                // SEMPRE insert: dopo la delete non esistono righe da
                // aggiornare (il vecchio ramo updatePositionTray muore qui;
                // l'endpoint resta per GratingTest/ImportGrating)
                const cmd = dataStored.server+'api/conf/position/insertPositionTray?' + new URLSearchParams( pos ).toString();
                try {
                    const r = await fetch( cmd ,{ method: 'GET'});
                    const body = r.ok ? await r.text() : 'KO';
                    if (body != 'OK') failed++;
                } catch (e) {
                    console.info(e);
                    failed++;
                }
            }
            if (failed > 0)
                alert(this.$t('grating.saveIncomplete'));
        },
        updateGratingInTray() {
            var cmd = dataStored.server+'api/conf/tray/updateGratingInTray?' + new URLSearchParams( 
                { 
                    ID      : this.grating.TRAY_ID,
                    FAMILY  : this.grating.NAME
                }
             ).toString();
            
            fetch( cmd ,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        alert("Error: Network response was not ok")
                        throw new Error('Network response was not ok');
                    }
                 })
                .catch(error => {
                    console.info(error);
                    alert(error)
                });
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
            // file di fabbricazione: franco cavita' sulla STRINGA serializzata,
            // l'anteprima a schermo resta nominale (util/cavityClearance.js)
            let svgString = applyCavityClearanceToSvg(serializer.serializeToString(svgElement));

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
        esportaDXF() {
            if (!this.listPz || this.listPz.length === 0) {
                alert('Nessun pezzo distribuito: niente da esportare.');
                return;
            }
            const svg = document.getElementById('trayLayout');
            const profEl = svg && svg.querySelector(':scope > path');
            const profileD = profEl ? profEl.getAttribute('d') : null;
            const holes = svg
              ? Array.from(svg.querySelectorAll(':scope > circle')).map(c => ({
                  cx: parseFloat(c.getAttribute('cx')),
                  cy: parseFloat(c.getAttribute('cy')),
                  r:  parseFloat(c.getAttribute('r')),
                }))
              : [];
            const dxf = buildGratingDxf({
              width: this.grating.width,
              height: this.grating.height,
              pieces: this.listPz,
              dimX: this.dim_x,
              dimY: this.dim_y,
              radius: this.radius,
              flipY: true,
              profileD,
              holes,
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
        stampaDiv() {
            //aprendo la finestra di stampa, posso stampare il modello o salvarlo come PDF 
            var contenutoOriginale = document.body.innerHTML;
            var contenutoStampa = document.getElementById('trayLayout');
            const serializer = new XMLSerializer();
            // stampa/PDF = file di fabbricazione: franco cavita' sulla stringa,
            // il DOM dell'anteprima non viene toccato (util/cavityClearance.js)
            let svgString = applyCavityClearanceToSvg(serializer.serializeToString(contenutoStampa));

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
            // modello SVG in Grating_model_dir = file di fabbricazione: franco
            // cavita' sulla stringa inviata al backend, anteprima nominale
            let svgString = applyCavityClearanceToSvg(serializer.serializeToString(contenutoStampa));

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
        // (grating-pitch) interasse risultante (centro-centro) che finira'
        // a DB: pezzo + distanza, aggiornato live; null finche' manca il pezzo
        pitchX(){
            return this.grating.pieceIndex>0 ? this.x + this.grating.SAFEX : null;
        },
        pitchY(){
            return this.grating.pieceIndex>0 ? this.y + this.grating.SAFEY : null;
        },
        pitchXLabel(){
            return this.pitchX!=null ? this.pitchX+' mm' : '\u2014';
        },
        pitchYLabel(){
            return this.pitchY!=null ? this.pitchY+' mm' : '\u2014';
        },
        // ==================================================================
        // CANTIERE AL — UNICA modifica script ammessa dal gate: viewBox
        // reattivo sui bounds reali della scena. Bounds del profilo esterno
        // hardcoded (path fisso, misurati una volta: x 1..820, y 1..605),
        // uniti al vassoio dai dati (grating.width/height) e al cartiglio
        // print (y 655). Margine di respiro uniforme. Centra la scena per
        // qualunque cassetto: le deroghe GR3 decadono.
        // ==================================================================
        sceneViewBox(){
            const PROF = { minX: 1, minY: 1, maxX: 820, maxY: 605 };
            const CART_Y = 660;    // cartiglio di stampa a y 655
            const M = 25;          // margine di respiro uniforme
            const w = Number(this.grating.width) || 0;
            const h = Number(this.grating.height) || 0;
            const minX = Math.min(0, PROF.minX) - M;
            const minY = Math.min(0, PROF.minY) - M;
            const maxX = Math.max(w, PROF.maxX) + M;
            const maxY = Math.max(h, PROF.maxY, CART_Y) + M;
            return minX + ' ' + minY + ' ' + (maxX - minX) + ' ' + (maxY - minY);
        }
    },
    mounted(){
        // (fase 2b) getGratingList parte SOLO a liste caricate: il vecchio
        // setTimeout(300) era una race — con trayList ancora vuota il forEach
        // esplodeva e la funzione moriva a meta'.
        Promise.all([this.getPiecesList(), this.getGripperList(), this.getTrayList()])
            .then(() => { this.getGratingList(); });

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
</style>
