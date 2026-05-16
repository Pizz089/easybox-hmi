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
<p>test</p>
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
                    <select class="pure-u-1" name="trayList" v-model="grating.trayIndex" @change="onChangeTrayList($event)" :readonly="dataStored.userLevel<0">
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

                    <button class="pure-u-1" style="margin-left:0px;margin-top:2px;padding:3px"
                        :disabled="grating.trayIndex==0 || grating.NAME.trim().length<=0 || gratingAssociated || !createNew"
                        @click="setGratingAssociated()" > <!-- updateGratingInTray-->
                        <span > <!-- v-if="!gratingAssociated"-->
                            {{$t("grating.associate")}}
                        </span>
                        <!--span v-if="gratingAssociated" >
                            {{$t("grating.disassociate")}}
                        </span-->
                    </button>
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
                <div class="pure-u-1">
                    <button class="pure-button pure-button-primary" @click="saveData()" 
							:disabled="dataStored.userLevel<0 || grating.SAFEX<minSafeX || grating.SAFEY<minSafeY || !gratingAssociated" 
                            style="margin-top:10px" > 
                        Save
                    </button>
                </div> 
                <div>
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
                </div>
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
                {{ n_row }} Righe x {{ n_cln+2 }} Colonne => {{ (n_row*n_cln)+2*n_row }} pz 
            </h5>
        </div>
        <div class="pure-u-1">
            <svg width="480" height="360" version="1.1" xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 920 630" 
                @click="distribute()"> 
                <!-- vassoio -->
                <rect x="0" y="0" width="820" height="605" style="fill:lightgray"/>
                <!-- limiti del vassoio -->
                <g id="limits">
                    <rect x="0"                 y="0"               :width="minBordoX"  height="605"        style="fill:coral"/>
                    <rect x="0"                 y="0"               width="820"         :height="minBordoY" style="fill:coral"/>
                    <rect :x="820-minBordoX"    y="0"               :width="minBordoX"  height="605"        style="fill:coral"/>
                    <rect x="0"                 :y="605-minBordoY"  width="820"         :height="minBordoY" style="fill:coral"/>
                </g>
                <animate
                    xlink:href="#limits"
                    attributeName="opacity"
                    values="1;0;1;0"
                    dur="1s"
                    repeatCount="2" />
                    <!--fill="freeze" /-->

                <g v-for="(p, index) in listPz" :key="index" >
                    <prisma v-if="p.prisma"
                            :x="p.x" :y="p.y" 
                            :width="dim_x" :height="dim_y" 
                            :status="p.status">
                    </prisma>
                    <!-- {{index+1}}-->
                    <text :x='p.x' :y='p.y' style="fill:blue;font-family:times;font-size:20">
                        {{index+1}}
                    </text>
                    <cylinder v-if="!p.prisma"
                            :x="p.x" :y="p.y" 
                            :width="radius"
                            :status="p.status">
                    </cylinder>
                    <text x='820' :y='calcolaY(p)' style="fill:blue;font-family:times;font-size:32">
                        {{ p.prisma?grating.height-(p.y+dim_y/2):grating.height-p.y }}
                    </text>
                    <text :x='calcolaX(p)' y='640' style="fill:blue;font-family:times;font-size:32">
                        {{ p.prisma?grating.width-(p.x+dim_x/2):grating.width-p.x }}
                    </text>
                </g>

            </svg>
        </div>
        <div class="pure-u-1"> 
            <div class="pure-u-1" style="margin-left:200px">
                <img src="../../../assets/distribute.png" @click="distribute()" />  
            </div>

            {{ this.grating.width-2*this.minBordoX-2*this.x }} 
            <br>
            {{(this.x+2*(this.grating.gripperMouvement+this.grating.tickGripperComponent)+this.grating.SAFEX) }}
            <br>
            {{this.x}} -> {{2*(this.grating.gripperMouvement+this.grating.tickGripperComponent)}} -> {{this.grating.SAFEX }}
            <br>
            corrX: {{ corrX }}
            <br>
            spaceNullX: {{spaceNullX}}
            <br>
            spaceNullY: {{spaceNullY}}
            <br>
            {{this.grating.SAFEY}}
                      

        </div>
    </div>
    <br><br><br><br><br><br><br><br><br><br><br><br><br>>
    </div>
</template>

<script>
export default {
    data(){
        return {
            grating:{
                NAME:'pippo',
                DESCR:'',
                SAFEX:0,
                SAFEY:0,
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
            minSafeX:0,     //il minimo raggiungibile in base ai dati della pinza
            minSafeY:0,     //il minimo raggiungibile in base ai dati della pinza
            minBordoX:20,   //bordo minimo a destra e sinistra del cassetto  
            minBordoY:20    //bordo minimo a sopra e sotto del cassetto 
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
                    
                    let index=1;
                    this.trayList.forEach(tray => {
                        if (tray.ID == this.grating.TRAY_ID){
                            this.grating.trayIndex = index;
                            //console.log("this.grating.trayIndex: "+this.grating.trayIndex)
                        }
                        index++;
                    });
                    index=1;
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
                            //console.log("this.grating.pieceIndex: "+this.grating.pieceIndex)
                        }
                        index++;
                    });
                    this.grating.width=this.trayList[this.grating.trayIndex].X/1000;
                    this.grating.height=this.trayList[this.grating.trayIndex].Y/1000;
                    this.grating.DESCR=this.gratingList[0].DESCR;
                    this.grating.NAME=this.gratingList[0].NAME;
                })
                .catch(error => {
                    console.info(error);
                });
        },
        calculateData(){
            this.listPz=[];
            if (this.grating.pieceIndex<=0) return; //se non ho ancora ricevuto tutti i dati allora salto l'aggiornamento del layout
            this.x=(this.partList[this.grating.pieceIndex-1].X/1000) ;
            this.y=(this.partList[this.grating.pieceIndex-1].Y/1000) ;
            this.prismatic=this.partList[this.grating.pieceIndex-1].PRISMA;
            this.grating.gripperMouvement = (this.gripperList[this.grating.gripperIndex-1].STROKE_CLAW+this.gripperList[this.grating.gripperIndex-1].TICKNESS_CLAW)/1000;   
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
        /*calculateCylinder(){ //da controllare con il file excell
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
        },*/
        calculatePrisma(){
            this.n_cln=Math.floor((this.grating.width-2*this.minBordoX-2*this.x)/(this.x+(this.grating.gripperMouvement+this.grating.tickGripperComponent)+this.grating.SAFEX));
            this.n_row=Math.floor((this.grating.height-2*this.minBordoY-2/this.y)/(this.y+(this.grating.gripperMouvement+this.grating.tickGripperComponent)+this.grating.SAFEY));
            this.minSpaceX=this.grating.gripperMouvement+this.grating.tickGripperComponent+this.grating.SAFEX
            this.minSpaceY=this.grating.gripperMouvement+this.grating.tickGripperComponent+this.grating.SAFEY
            this.spaceNullX=(this.grating.width-2*this.minBordoX)-2*this.dim_x-((this.n_cln)*(this.x+this.grating.gripperMouvement+this.grating.tickGripperComponent+this.grating.SAFEX));
            this.spaceNullY=(this.grating.height-2*this.minBordoY)-((this.n_row-1)*(this.y+this.grating.gripperMouvement+this.grating.tickGripperComponent+this.grating.SAFEX))-(this.n_row*this.y)-this.grating.SAFEY;
            
            this.corrX=Math.floor(this.spaceNullX/(this.n_cln-1+2));
            this.corrY=Math.floor(this.spaceNullY/(this.n_row-1));

            for (let r=1; r<=this.n_row; r++){
                let obj = {}    
                obj.prisma = true;
                obj.x=this.grating.width-this.minBordoX-this.dim_x;
                obj.y=this.grating.height-this.minBordoY-this.dim_y-(this.minSpaceY+this.y)*(r-1);
                obj.status=2;
                this.listPz.push(obj);

                for (let c=1;c<=this.n_cln; c++){
                    let obj = {} 
                    obj.prisma = true;
                    obj.x=this.grating.width-this.minBordoX-this.dim_x-(this.minSpaceX+this.x)*c;  //-this.minSpaceX
                    obj.y=this.grating.height-this.minBordoY-this.minSpaceY*(r-1)-this.y*r;
                    obj.status=2;
                    this.listPz.push(obj);
                }
                
                obj = {} 
                obj.prisma = true;
                //obj.x=Math.floor(this.minBordoX+this.corrX); //(this.spaceNullX/(this.n_cln-1));
                obj.x=Math.floor(this.listPz[this.listPz.length-1].x-(this.listPz[this.listPz.length-2].x-this.listPz[this.listPz.length-1].x));
                obj.y=this.grating.height-this.minBordoY-this.dim_y-(this.minSpaceY+this.y)*(r-1);
                obj.status=2;
                this.listPz.push(obj);
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
            this.grating.SAFEX=this.gripperList[this.grating.gripperIndex-1].STROKE_CLAW/1000+this.gripperList[this.grating.gripperIndex].TICKNESS_CLAW/1000-2*this.dim_x //........
			this.grating.GRIPPER_ID=this.gripperList[this.grating.gripperIndex-1].ID;
            this.distribute();
        },
        distribute(){
            this.grating.SAFEX=Math.floor( (this.grating.SAFEX+this.corrX-this.grating.gripperMouvement-this.grating.tickGripperComponent)/(this.n_cln+1) ) ;
            this.grating.SAFEY=(this.grating.SAFEY+this.corrY)/this.n_row;
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
            this.updateGratingInTray()

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
                pos.X *= 1000;
                pos.Y *= 1000;
			
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
</style>
