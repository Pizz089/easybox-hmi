<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../../data.js'
    import numericField from '../../../components/numericField.vue'
    import { ref, onMounted } from 'vue'
    //import layout from '../layoutView.vue'

    import prisma from '../../../components/layout/prisma.vue'
    import cylinder from '../../../components/layout/cylinder.vue'

    const el = ref()
</script>

<template>   
      &nbsp;
      <div class="pure-u-21-24">
        <!--div class="pure-u-1-2" style="background-color: lightcoral;">merda</div>
        <div class="pure-u-1-2" style="background-color: lightblue;">merdone</div>
      </div-->

      <div class="pure-u-11-24">
        <h2 v-if="!createNew">{{ $t('grating.data')}}  {{ $route.params.grating_ID }}</h2>
        <h2 v-if="createNew"> {{ $t('grating.createNew')}} </h2>

        <div class="pure-form pure-g" >
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
                    <label class="pure-u-1">Tray</label>
                    <select class="pure-u-1" 
                        name="trayList" 
                        v-model="grating.trayIndex" 
                        @change="onChangeTrayList($event)" 
                        :readonly="dataStored.userLevel<0"
                        :disabled="grating.trayIndex>0 && gratingAssociated">

                        <option value="-1"> </option>
                        <template v-for="(t,index) in trayList" :key="t.ID">
                            <option :value="index" 
                                    :selected="grating.trayIndex==index" 
                                    :disabled="(t.FAMILY.trim().length>0||t.FLOOR_MAG<=0)"
                                    :class="{'optionDeleted':t.FAMILY.trim().length>0}"> 
                                    {{ t.FLOOR_MAG>0?t.FLOOR_MAG:'OUT' }} - {{ t.DESCR }} 
                                    <span v-if="t.FAMILY.trim().length>0">&nbsp;{{$t('alreadyAssociated')}}</span>
                                    <!-- :class="{'optionDeleted':t.FAMILY.trim()!=''}"> -->
                            </option>
                        </template>                  
                    </select>
                    <button class="pure-u-1" style="margin-left:0px;margin-top:2px;padding:3px"
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
                    <label class="pure-u-1">{{$t('grating.safeX')}} [{{ minSafeX }}..{{ grating.width/2 }}]</label>
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
                    <label class="pure-u-1">{{$t('grating.safeY')}} [{{ minSafeY }}..{{ grating.height/2 }}]</label>
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
                </div> 
                <div class="pure-u-1" style="margin-top:20px">
                    <button class="pure-button pure-button-primary" @click="saveData() && createModelFile()" 
							:disabled="dataStored.userLevel<0 || grating.SAFEX<minSafeX || grating.SAFEY<minSafeY " 
                            style="padding:20px"> 
                        {{$t("Save") }} & {{$t("Create_model_file")}}
                    </button>
                    &nbsp;
                    <!--button 
                        style="padding:20px"
                        :disabled="!DownloadModel || createNew"
                        @click="DownloadModel()"
                        class="pure-button pure-button-primary buttonDownload">
                        {{$t("scarica modello")}} 
                        &nbsp;
                        &nbsp;
                    </button-->
                    
                    <!--button class="pure-button pure-button-primary"  style="padding:20px">
                        <img src="../../../assets/pdf.png" width="15%"></img>
                    </button-->
                    <button @click="createModelFile()">modello</button>
                    <button @click="esportaDXF()" :disabled="listPz.length === 0">DXF</button>
                </div>
                <div class="pure-u-1" style="margin-top:20px">
                    <img
                        src="../../../assets/pdf.png" 
                        width="15%" 
                        @click="stampaDiv()">
                    </img>
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
      <div class="pure-u-1-24">
        &nbsp;
      </div>
      <!-- LAYOUT -->
      <div class="pure-u-11-24">
        <br><br>
        <div class="pure-u-1" style="margin-left:130px">
            <h5>
                {{ n_row }} Righe x {{ n_cln }} Colonne => {{ n_row*n_cln }} pz 
            </h5>
        </div>
        <div class="pure-u-1">
            <svg id="trayLayout" width="480" height="360" version="1.1" xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 920 630" @click="distribute()"> 
                <!-- vassoio -->
                <rect id="tray" x="0" y="0" :width="grating.width" :height="grating.height" style="fill:lightgray" class="noPrint"/>

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
                        style="fill:none;stroke:red;stroke-width:1"/>
                              
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
                <circle r="3" cx="18"  cy="15" style="fill:none;stroke:red;stroke-width:1"/>
                <circle r="3" cx="398" cy="15" style="fill:none;stroke:red;stroke-width:1"/>
                <circle r="3" cx="802" cy="15" style="fill:none;stroke:red;stroke-width:1"/>
                
                <circle r="3" cx="18"  cy="300" style="fill:none;stroke:red;stroke-width:1"/>
                <circle r="3" cx="398" cy="300" style="fill:none;stroke:red;stroke-width:1"/>
                <circle r="3" cx="802" cy="300" style="fill:none;stroke:red;stroke-width:1"/>
                
                <circle r="3" cx="18"  cy="593" style="fill:none;stroke:red;stroke-width:1"/>
                <circle r="3" cx="398" cy="593" style="fill:none;stroke:red;stroke-width:1"/>
                <circle r="3" cx="802" cy="593" style="fill:none;stroke:red;stroke-width:1"/>

                <!-- misure-->
                <!--text :x="listPz[0].x:0" :y="listPz[0].y+10" fill="dark" font-size="10">{{dim_x}}x{{dim_y}}</text-->
                <g v-if="listPz.length>0" class="noScreen">
                    <text :x="listPz[0].x-20" :y="listPz[0].y+dim_y/2" fill="dark" font-size="10">{{ grating.SAFEX }}</text>
                    
                    <text :x="listPz[0].x+dim_x/2" :y="listPz[0].y-17"  fill="dark" font-size="10" rotate="-90" v-if="grating.SAFEY.toString()[2]>0">{{ grating.SAFEY.toString()[2] }}</text>
                    <text :x="listPz[0].x+dim_x/2" :y="listPz[0].y-11"  fill="dark" font-size="10" rotate="-90" v-if="grating.SAFEY.toString()[1]>=0">{{ grating.SAFEY.toString()[1] }}</text>
                    <text :x="listPz[0].x+dim_x/2" :y="listPz[0].y-6"   fill="dark" font-size="10" rotate="-90">{{ grating.SAFEY.toString()[0] }}</text>
                    
                    <text :x="listPz[0].x+dim_x/2" :y="listPz[0].y+dim_y+8" fill="dark" font-size="10" rotate="-90">
                        {{ (grating.height-listPz[0].y-dim_y).toString()[1] }}
                    </text>
                    <text :x="listPz[0].x+dim_x/2" :y="listPz[0].y+dim_y+14" fill="dark" font-size="10" rotate="-90">
                        {{ (grating.height-listPz[0].y-dim_y).toString()[0] }}
                    </text>
                    
                    <text :x="listPz[0].x+dim_x+10" :y="listPz[0].y+dim_y/2" fill="dark" font-size="10" rotate="0">
                        {{ grating.width-listPz[0].x-dim_x }}
                    </text>

                    <text :x="listPz[0].x+dim_x/2-15" :y="listPz[0].y+dim_y/2" fill="dark" font-size="10" rotate="0">
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
                        style="fill:#fff65087"/>
                    <rect 
                        x="0"                 
                        y="0"               
                        :width="grating.width" 
                        :height="minBordoY" 
                        style="fill:#fff65087"/>
                    <rect 
                        :x="grating.width-minBordoX"    
                        :y="minBordoY"                  
                        :width="minBordoX"      
                        :height="grating.height-minBordoY*2"        
                        style="fill:#fff65087"/>
                    <rect 
                        x="0"                 
                        :y="grating.height-minBordoY"  
                        :width="grating.width" 
                        :height="minBordoY" 
                        style="fill:#fff65087"/>
                </g>
                <animate
                    xlink:href="#limits"
                    attributeName="opacity"
                    values="1;0;1;0;1;0;1;"
                    dur="1s"
                    repeatCount="2" /> 

                <g class="noScreen">
                    <!-- cartiglio -->
                    <text x="20" y="655" 	fill="dark" font-size="14" rotate="0">
                            {{$t("Nome")}} : {{$t("Grigliato")}} {{grating.NAME}}
                    </text>
                    <text x="320" y="655" 	fill="dark" font-size="14" rotate="0">
                            {{$t("grating.dimensioniPz")}} : {{dim_x}}x{{dim_y}}
                    </text>
                    <text x="680" y="655" 	fill="dark" font-size="14" rotate="0">
                            Generato il: {{new Date().toLocaleDateString()}}
                    </text>
                </g>
            </svg>
            
        </div>
        <div class="pure-u-1"> 
            <div class="pure-u-1" style="margin-left:200px">
                <img src="../../../assets/distribute.png" @click="distribute()" />      
            </div>
        </div>
    </div>
    <br><br><br><br><br><br><br><br><br><br><br><br><br>
    </div>
</template>

<script>
function buildGratingDxf({ width, height, pieces, dimX, dimY, radius, flipY = true, profileD = null, holes = [] }) {
  const W = Number(width), H = Number(height);
  const fy = (y) => (flipY ? H - Number(y) : Number(y));
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
    for (const [px, py] of pts) e('0','VERTEX','8',layer,'10',String(px),'20',String(fy(py)));
    e('0','SEQEND','8',layer);
  };
  const polyRect = (layer, x, y, w, h) => {
    x = Number(x); y = Number(y); w = Number(w); h = Number(h);
    polyClosed(layer, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  };
  if (profileD) polyClosed('PROFILE', pathToPts(profileD));
  for (const hh of holes) {
    e('0','CIRCLE','8','HOLES','10', String(Number(hh.cx)), '20', String(fy(hh.cy)), '40', String(Number(hh.r)));
  }
  for (const p of pieces) {
    if (p.prisma) polyRect('PIECES', p.x, p.y, dimX, dimY);
    else e('0','CIRCLE','8','PIECES','10', String(Number(p.x)), '20', String(fy(p.y)), '40', String(Number(radius)));
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
                gripperMouvement:0,
                tickGripperComponent:0,
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
            minSpaceX: 0,
            minSpaceY: 0,
            spaceNullX:0,
            spaceNullY:0,
            x:0,
            y:0,
            corrX:0,
            corrY:0,
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
            minBordoX:20,           //bordo minimo a destra e sinistra del cassetto  
            minBordoY:20,           //bordo minimo a sopra e sotto del cassetto 
            readyToDownload:false   //activa il download del file di progetto svg
        }
    },
    watch:{
        'grating.SAFEX'(newValue){
			if (newValue<0) 
			//	this.grating.SAFEX=0
			//if (newValue<this.minSafeX)
				this.grating.SAFEX=this.minSafeX
			if (newValue>this.grating.width/2)
				this.grating.SAFEX=this.grating.width/2
			this.calculateData()
        },
        'grating.SAFEY'(newValue){
            if (newValue<0) 
            //    this.grating.SAFEY=0
            //if (newValue<this.minSafeY)
                this.grating.SAFEY=this.minSafeY
            if (newValue>this.grating.height/2)
                this.grating.SAFEY=this.grating.height/2
            this.calculateData()
        },
        'grating.gripperMouvement'(newValue){
            if (newValue<0) 
                this.grating.gripperMouvement=0
            this.calculateData()
        },
        'grating.tickGripperComponent'(newValue){
            if (newValue<0) 
                this.grating.tickGripperComponent=0
            this.calculateData()
        }
    },
    methods: {
        calcolaY(p){
            return !p.prisma?p.y+10:p.y+this.dim_y/2;
        },
        calcolaX(p){
            return !p.prisma?p.x-20:p.x;
        },
        getPiecesList() {
            fetch( dataStored.server+'api/conf/piece/show/all',{ method: 'GET'})
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
            fetch( dataStored.server+'api/conf/gripper/show/all',{ method: 'GET'})
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
            fetch( dataStored.server+'api/conf/tray/show/all',{ method: 'GET'})
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
                            this.grating.trayIndex = index;
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
                    if (typeof this.grating.trayIndex !== 'undefined' && 
                        typeof (this.trayList[this.grating.trayIndex].X) !== 'undefined'){
                        if (this.trayList[this.grating.trayIndex].X>0)
                            this.grating.width=this.trayList[this.grating.trayIndex].X/1000;
                        if (this.trayList[this.grating.trayIndex].Y>0)
                            this.grating.height=this.trayList[this.grating.trayIndex].Y/1000;
                    }
                    this.grating.DESCR=this.gratingList[0].DESCR;
                    this.grating.NAME=this.gratingList[0].NAME;
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
            this.grating.ID=this.$route.params.grating_ID;
        },
        calculateCylinder(){ //da controllare con il file excell
            this.n_cln=Math.floor(this.grating.width/(this.x+2*(this.grating.gripperMouvement+this.grating.tickGripperComponent)+this.grating.SAFEX));
            this.n_row=Math.floor(this.grating.height/(this.y+this.grating.SAFEY));
            this.minSpaceX=this.grating.gripperMouvement+this.grating.tickGripperComponent+this.grating.SAFEX
            
            this.minSpaceY=this.grating.SAFEY /////
            this.spaceNullX=this.grating.width-((this.n_cln-1)*this.minSpaceX)-(this.n_cln*this.x)-(2*this.grating.SAFEX);
            this.spaceNullY=this.grating.height-((this.n_row-1)*this.minSpaceY)-(this.n_row*this.y)-(2*this.grating.SAFEY);
            
            this.corrX=Math.floor(this.spaceNullX/(this.n_cln));
            this.corrY=Math.floor(this.spaceNullY/(this.n_row));

            for (let r=1; r<=this.n_row; r++){
                for (let c=1;c<=this.n_cln; c++){
                    let obj = {}    // {prisma:true, x:700, y:500, status:7},
                    obj.prisma = false;
                    obj.x=this.grating.width-(this.minSpaceX+this.x)*c +this.x/2;
                    obj.y=this.grating.height-(this.minSpaceY+this.y)*r+this.y/2;
                    obj.status=2;
                    this.listPz.push(obj);
                }
            }
            //console.log(JSON.stringify(this.listPz,null,4));
            this.radius=this.x/2;
        },
        calculatePrisma(){
            this.n_cln=Math.floor((this.grating.width-2*this.minBordoX)/(this.x+2*(this.grating.gripperMouvement+this.grating.tickGripperComponent)+this.grating.SAFEX));
            this.n_row=Math.floor((this.grating.height-2*this.minBordoY)/(this.y+this.grating.SAFEY));
            this.minSpaceX=this.grating.gripperMouvement+this.grating.tickGripperComponent+this.grating.SAFEX
            this.minSpaceY=this.grating.SAFEY
            this.spaceNullX=(this.grating.width-2*this.minBordoX)-((this.n_cln-1)*this.minSpaceX)-(this.n_cln*this.x)-(2*this.grating.SAFEX);
            this.spaceNullY=(this.grating.height-2*this.minBordoY)-((this.n_row-1)*this.minSpaceY)-(this.n_row*this.y)-(2*this.grating.SAFEY);
            
            this.corrX=Math.floor(this.spaceNullX/(this.n_cln-1));
            this.corrY=Math.floor(this.spaceNullY/(this.n_row-1));

            for (let r=1; r<=this.n_row; r++){
                for (let c=1;c<=this.n_cln; c++){
                    let obj = {}    // {prisma:true, x:700, y:500, status:7},
                    obj.prisma = true;
                    obj.x=-this.minBordoX+this.grating.width-(this.minSpaceX+this.x)*c;
                    obj.y=-this.minBordoY+this.grating.height-(this.minSpaceY+this.y)*r;
                    obj.status=2;
                    this.listPz.push(obj);
                }
            }
            //console.log(JSON.stringify(this.listPz,null,4));
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
            //console.log(this.gripperList[this.grating.gripperList-1].STROKE_CLAW/1000)
            //console.log(this.gripperList[this.grating.gripperList-1].TICKNESS_CLAW/1000)
            this.grating.SAFEX=this.gripperList[this.grating.gripperIndex-1].STROKE_CLAW/1000+this.gripperList[this.grating.gripperIndex].TICKNESS_CLAW/1000
			this.grating.GRIPPER_ID=this.gripperList[this.grating.gripperIndex-1].ID;
            this.distribute();
        },
        distribute(){
            this.grating.SAFEX=this.grating.SAFEX+this.corrX-this.grating.gripperMouvement-this.grating.tickGripperComponent ;
            this.grating.SAFEY=this.grating.SAFEY+this.corrY;
        },
        setGratingAssociated(){
            this.gratingAssociated=!this.gratingAssociated;
            if (!this.gratingAssociated) {
                this.grating.pieceIndex=0;
                this.grating.gripperIndex=0;
                this.calculateData();
            }
        },
        saveData() {
            //this.updateGratingInTray()

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
                    this.savePositions();
                    this.updateGratingInTray();
                    //alert(this.$t("save_ok"));
                    this.$router.push('/conf/Gratings');
                 })
                .catch(error => {
                    console.info(error);
                    alert(error)
                });
        },
        savePositions() {
            var cmd = ""
            for (let i=0; i<this.listPz.length; i++){
                let pos={};
                pos.SUB_POS=i+1;
                pos.POS=this.trayList[this.grating.trayIndex-1].MAG;              
                pos.TRAY_ID=this.trayList[this.grating.trayIndex-1].FLOOR_MAG;              
                pos.PIECE_TYPE=this.partList[this.grating.pieceIndex-1].ID;
                pos.STATUS=2;  //EMPTY  
                pos.SAFEX=this.grating.SAFEX              
                pos.SAFEY=this.grating.SAFEY
			
                if (this.listPz[i].prisma){
                    pos.X=this.grating.width-(this.listPz[i].x+this.dim_x/2);
                    pos.Y=this.grating.height-(this.listPz[i].y+this.dim_y/2); 
                }else{
                    pos.X=this.grating.width-this.listPz[i].x;
                    pos.Y=this.grating.height-this.listPz[i].y;
                }
                pos.X *=  1000;
                pos.Y *= -1000;   //tutte le quote sono negative

                pos.EASYBOX = dataStored.EasyBox;
			
                //alert("pos: "+JSON.stringify(pos,null,4))
                if (this.createNew)
                    cmd = dataStored.server+'api/conf/position/insertPositionTray?' + new URLSearchParams( pos ).toString(); 
                else
                    cmd = dataStored.server+'api/conf/position/updatePositionTray?' + new URLSearchParams( pos ).toString(); 
                fetch( cmd ,{ method: 'GET'})
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                    })
                    .catch(error => {
                        alert(error)
                    });
            }
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
            let svgString = serializer.serializeToString(svgElement);

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
            let svgString = serializer.serializeToString(contenutoStampa);

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
            let svgString = serializer.serializeToString(contenutoStampa);

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
    },
    mounted(){
        this.getPiecesList();
        this.getGripperList();
        this.getTrayList();
        setTimeout(() => { this.getGratingList(); }, "300");

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
    label{
        font-weight: bolder;
    }
	.error{
		/*
		border:3px dashed;
		border-color:red;
		*/
		background-color:#fb2929c7
	}
    .optionDeleted{
        color:coral;
        /*text-decoration: line-through;*/
    }
    .buttonDownload{
        background-image:url('../../../assets/download.png');
        background-repeat: no-repeat;
        background-size: 20%;
        background-position-x: 100%;
        background-position-y: 28%;
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
</style>
