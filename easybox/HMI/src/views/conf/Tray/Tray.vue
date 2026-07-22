<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import numericField from '../../../components/numericField.vue'
    //import SimpleKeyboard from '../../../components/keyboard.vue'
    import optionStatus from '@/components/optionStatus.vue';
    import { dataStored } from '../../../data.js'

    import { ref, onMounted } from 'vue'
    const el = ref()
</script>

<template>   
      <div class="view-shell conf-card">
        <h2 v-if="!createNew" class="view-title">{{ $t('tray.data')}} : {{ tray.ID }}</h2>
        <h2 v-if="createNew" class="view-title"> {{ $t('tray.createNew')}} </h2>

        <div class="pure-form pure-form-aligned" >
            <!--fieldset-->
                <input type="hidden" name="ID" v-model="tray.ID" />

                <div class="pure-control-group" v-if="!createNew">
                    <label for="aligned-foo">{{$t('tray.family')}}</label>
                    <input type="text" id="aligned-foo" name="FAMIGLIA" v-model="tray.FAMILY" placeholder="" :readonly="dataStored.userLevel==0" disabled/>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.descr')}}</label>
                    <input type="text" id="aligned-foo" name="DESCR" v-model="tray.DESCR" placeholder="" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.lunghezza')}}</label>
                    <!--input type="number" id="aligned-foo" name="LUNGHEZZA" v-model="tray.X" :readonly="dataStored.userLevel==0" /-->
                    <numericField 
                        name="LUNGHEZZA" 
                        unitMeasure="mm" 
                        step="1" 
                        :model-value="tray.X"
                        @update="newValue => tray.X = newValue">
                    </numericField>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.larghezza')}}</label>
                    <!--input type="number" id="aligned-foo" name="LARGHEZZA" v-model="tray.Y"  :readonly="dataStored.userLevel==0" /-->
                    <numericField 
                        name="LARGHEZZA" 
                        unitMeasure="mm" 
                        step="1" 
                        :model-value="tray.Y"
                        @update="newValue => tray.Y = newValue">
                    </numericField>
                </div>
                    <!--div class="pure-control-group">
                        <label for="aligned-foo">{{$t('tray.numPosti')}}</label>
                        <input type="number" id="aligned-foo" name="NUM_POSTI" v-model="tray.N_PLACE"  :readonly="dataStored.userLevel==0" />
                    </div>
                    <div class="pure-control-group">
                        <label for="aligned-foo">{{$t('tray.numGrezzi')}}</label>
                        <input type="number" id="aligned-foo" :class="{'errore':tray.N_FINISHED+tray.N_EMPTY+tray.N_RAW>tray.N_PLACE}"  name="NUM_GREZZI" v-model="tray.N_RAW"  :readonly="dataStored.userLevel==0" />
                    </div>
                    <div class="pure-control-group">
                        <label for="aligned-foo">{{$t('tray.numVuoti')}}</label>
                        <input type="number" id="aligned-foo" :class="{'errore':tray.N_FINISHED+tray.N_EMPTY+tray.N_RAW>tray.N_PLACE}" name="NUM_VUOTI" v-model="tray.N_EMPTY"  :readonly="dataStored.userLevel==0" />
                    </div>
                    <div class="pure-control-group">
                        <label for="aligned-foo">{{$t('tray.numFiniti')}}</label>
                        <input type="number" id="aligned-foo" :class="{'errore':tray.N_FINISHED+tray.N_EMPTY+tray.N_RAW>tray.N_PLACE}" name="NUM_FINITI" v-model="tray.N_FINISHED"  :readonly="dataStored.userLevel==0" />
                    </div-->
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.stato')}}</label>
                    <!--input type="number" id="aligned-foo" name="STATO" v-model="tray.STATUS" :readonly="dataStored.userLevel==0" /-->
                    <!--select id="aligned-foo" name="STATO" v-model="tray.STATUS"  :readonly="dataStored.userLevel==0" >
                        <option :value="dataStored.status_notDef">
                            {{$t('status.notDef')}} &nbsp;({{$t('Code')}} {{ dataStored.status_notDef }}) 
                        </option>
                        <option :value="dataStored.status_empty">
                            {{$t('status.empty')}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;({{$t('Code')}} {{ dataStored.status_empty }})
                        </option>
                        <option :value="dataStored.status_working">
                            {{$t('status.working')}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;({{$t('Code')}} {{ dataStored.status_working }})
                        </option>
                        <option :value="dataStored.status_raw">
                            {{$t('status.raw')}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;({{$t('Code')}} {{ dataStored.status_raw }})
                        </option>
                        <option :value="dataStored.status_finished">
                            {{$t('status.finished')}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;({{$t('Code')}} {{ dataStored.status_finished }} )
                        </option>
                    </select-->
                    <optionStatus 
                        name="STATO"
                        :model-value="tray.STATUS"
                        @update="newValue => tray.STATUS = newValue" >
                    </optionStatus>

                </div>
                <!--div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.tipoPezzo')}}</label>
                    <select id="aligned-foo" name="TIPO_PEZZO" v-model="tray.PIECE_TYPE"  :readonly="dataStored.userLevel==0" >
                        <template v-for="tpl in typePartList" :key="tpl.ID">
                            <option :value="tpl.ID">
                                {{ tpl.FAMILY }} / {{ tpl.DESCR }}
                            </option>
                        </template>
                    </select>
                </div-->
                <!--div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.tipoApproccio')}}</label>
                    <select id="aligned-foo" name="TIPO_APPROCCIO" v-model="tray.APPROACH_TYPE" :readonly="dataStored.userLevel==0">
                        <template v-for="ap in approachList" :key="ap.ID">
                            <option :value="ap.ID">
                                {{ ap.DESCR }}  &nbsp;&nbsp;&nbsp;&nbsp;({{$t('Code')}} {{ ap.ID }})
                            </option>
                        </template>
                    </select>
                </div-->
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.ZPrelievo')}}</label>
                    <!--input type="number" id="aligned-foo" name="Z_PRELIEVO" v-model="tray.Z_PICK"  :readonly="dataStored.userLevel==0"/-->
                    <numericField name="Z_PRELIEVO" 
                        :model-value="tray.Z_PICK"
                        @update="newValue => tray.Z_PICK = newValue" 
                        unitMeasure="mm" 
                        step="5"></numericField>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.ZDeposito')}}</label>
                    <!--input type="number" id="aligned-foo" name="Z_DEPOSITO" v-model="tray.Z_PLACE"  :readonly="dataStored.userLevel==0"/-->
                    <numericField name="Z_DEPOSITO" 
                        v-model="tray.Z_PLACE" 
                        unitMeasure="mm" 
                        step="5"
                        :model-value="tray.Z_PLACE"
                        @update="newValue => tray.Z_PLACE = newValue" ></numericField>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.pianoMagazzino')}}</label>
                    <!--input type="number" id="aligned-foo" name="PIANO_MAGAZZINO" v-model="tray.PIANO_MAGAZZINO" /> <span>Floor 1 => lower position</span-->
                    <select id="aligned-foo" name="FLOOR_MAG" v-model="tray.FLOOR_MAG" :readonly="dataStored.userLevel==0">
                        <option value="12" > 12 - ({{$t('tray.higher')}}) </option>
                        <option value="11" > 11</option>
                        <option value="10" > 10</option>
                        <option value="9"  >  9</option>
                        <option value="8"  >  8</option>
                        <option value="7"  >  7</option>
                        <option value="6"  >  6</option>
                        <option value="5"  >  5</option>
                        <option value="4"  >  4</option>
                        <option value="3"  >  3</option>
                        <option value="2"  >  2</option>
                        <option value="1"  >  1 - ({{$t('tray.lower')}}) </option>                    
                        <option value="-1" > {{$t('OUT')}} </option>
                    </select>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.X_Corr')}}</label>
                    <!--input type="number" id="aligned-foo" name="X_CORR" v-model="tray.X_CORR"  :readonly="dataStored.userLevel==0"/-->
                    <numericField name="X_CORR" v-model="tray.X_CORR" unitMeasure="mm" min="-5" max="5" step="0.01"
                        :model-value="tray.X_CORR"
                        @update="newValue => tray.X_CORR = newValue" >
                    </numericField>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.Y_Corr')}}</label>
                    <!--input type="number" id="aligned-foo" name="Y_CORR" v-model="tray.Y_CORR"  :readonly="dataStored.userLevel==0"/-->
                    <numericField name="Y_CORR" v-model="tray.Y_CORR" unitMeasure="mm" min="-5" max="5" step="0.01"
                        :model-value="tray.Y_CORR"
                        @update="newValue => tray.Y_CORR = newValue" ></numericField>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.Z_Corr')}}</label>
                    <!--input type="number" id="aligned-foo" name="Z_CORR" v-model="tray.Z_CORR"  :readonly="dataStored.userLevel==0" step="0.001"/-->
                    <numericField name="Z_CORR" v-model="tray.Z_CORR" unitMeasure="mm" min="-20" max="10" step="0.01" 
                        :model-value="tray.Z_CORR"
                        @update="newValue => tray.Z_CORR = newValue" ></numericField>
                    <br>
                    
                </div>
                <!-- ===== (tray-teaching) Rotazioni di presa =====
                     millesimi di grado a DB, gradi a video; al salvataggio
                     vengono propagate alle [POSITION] del cassetto. -->
                <h4 class="section-label">{{$t('tray.sectionRot')}}</h4>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.X_Rot')}}</label>
                    <numericField name="X_ROT" unitMeasure="&deg;" min="-180" max="180" step="0.1"
                        :model-value="tray.X_ROT"
                        @update="newValue => tray.X_ROT = newValue" ></numericField>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.Y_Rot')}}</label>
                    <numericField name="Y_ROT" unitMeasure="&deg;" min="-180" max="180" step="0.1"
                        :model-value="tray.Y_ROT"
                        @update="newValue => tray.Y_ROT = newValue" ></numericField>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.Z_Rot')}}</label>
                    <numericField name="Z_ROT" unitMeasure="&deg;" min="-180" max="180" step="0.1"
                        :model-value="tray.Z_ROT"
                        @update="newValue => tray.Z_ROT = newValue" ></numericField>
                </div>

                <!-- ===== (tray-teaching) Avvicinamento =====
                     APPROACH_TYPE dalla approachList (gia' caricata dal form,
                     finora inutilizzata) + quote in mm (millesimi a DB). -->
                <h4 class="section-label">{{$t('tray.sectionApproach')}}</h4>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.tipoApproccio')}}</label>
                    <select id="aligned-foo" name="TIPO_APPROCCIO" v-model="tray.APPROACH_TYPE" :readonly="dataStored.userLevel==0">
                        <template v-for="ap in approachList" :key="ap.ID">
                            <option :value="ap.ID">
                                {{ ap.DESCR }}  &nbsp;&nbsp;&nbsp;&nbsp;({{$t('Code')}} {{ ap.ID }})
                            </option>
                        </template>
                    </select>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.approachX')}}</label>
                    <numericField name="APPROACH_X" unitMeasure="mm" min="-500" max="500" step="1"
                        :model-value="tray.APPROACH_X"
                        @update="newValue => tray.APPROACH_X = newValue" ></numericField>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.approachY')}}</label>
                    <numericField name="APPROACH_Y" unitMeasure="mm" min="-500" max="500" step="1"
                        :model-value="tray.APPROACH_Y"
                        @update="newValue => tray.APPROACH_Y = newValue" ></numericField>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.approachZ')}}</label>
                    <numericField name="APPROACH_Z" unitMeasure="mm" min="-500" max="500" step="1"
                        :model-value="tray.APPROACH_Z"
                        @update="newValue => tray.APPROACH_Z = newValue" ></numericField>
                </div>

                <div class="pure-controls">
                    <button class="pure-button pure-button-primary" @click="saveData()" :disabled="dataStored.userLevel==0">
                        Save
                    </button>
                </div>
                
            <!--/fieldset-->
        </div>
      </div>

      <!-- FO3: ex 14 <br> spaziatori, sostituiti da margine token -->
      <div class="bottom-spacer"></div>
</template>

<script>
export default {
    components: {
    //SimpleKeyboard
  },
    data(){
        return {
            tray:{
                MAG:1,
                FAMILY:'', 
                DESCR:'', 
                X:820, 
                Y:610, 
                STATUS:2, 
                APPROACH_TYPE:3,  //ZZ 
                Z_PICK:0, 
                Z_PLACE:0, 
                FLOOR_MAG:-1, 
                X_CORR:0, 
                Y_CORR:0, 
                Z_CORR:0,
                // (tray-teaching) rotazioni di presa (gradi a video) e
                // avvicinamento (mm a video) — vedi conversioni load/save
                X_ROT:0,
                Y_ROT:0,
                Z_ROT:0,
                APPROACH_X:100,
                APPROACH_Y:100,
                APPROACH_Z:100
            },
            createNew:false,
            approachList:{},
            typePartList:{},
            input:1
        }
    },
    methods: {
        modifica(newVal){
            alert(newValue)
            console.log(newValue)
        },
        changeInput(i){
            if (i==".")
                this.input= parseInt(this.input.toString()+'.0')
            this.input=this.input*10+i
        },
        getDataTable() {
            if (this.$route.query.trayID==undefined){
                this.createNew=true;
                return;
            }
            //alert("ID: "+this.$route.query.trayID)
            fetch( dataStored.server+'api/conf/tray/show/'+this.$route.query.trayID,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    //console.log("tray:"+JSON.stringify(tray,null,4))
                    this.tray=data[0];
                    //elimino un po di spazi vuoti
                    this.tray.FAMILY=this.tray.FAMILY.trim();
                    this.tray.DESCR=this.tray.DESCR.trim();
                    this.tray.X = this.tray.X / 1000;
                    this.tray.Y = this.tray.Y / 1000;
                    this.tray.X_CORR = this.tray.X_CORR / 1000;
                    this.tray.Y_CORR = this.tray.Y_CORR / 1000;
                    this.tray.Z_CORR = this.tray.Z_CORR / 1000;
                    // (tray-teaching) rotazioni (millesimi di grado -> gradi)
                    // e avvicinamenti (millesimi -> mm). NULL = mai insegnato:
                    // a video il valore EFFETTIVO di fallback (0 rot, 100 mm);
                    // salvandolo si scrive quel fallback = comportamento identico.
                    this.tray.X_ROT = this.tray.X_ROT == null ? 0 : this.tray.X_ROT / 1000;
                    this.tray.Y_ROT = this.tray.Y_ROT == null ? 0 : this.tray.Y_ROT / 1000;
                    this.tray.Z_ROT = this.tray.Z_ROT == null ? 0 : this.tray.Z_ROT / 1000;
                    this.tray.APPROACH_X = this.tray.APPROACH_X == null ? 100 : this.tray.APPROACH_X / 1000;
                    this.tray.APPROACH_Y = this.tray.APPROACH_Y == null ? 100 : this.tray.APPROACH_Y / 1000;
                    this.tray.APPROACH_Z = this.tray.APPROACH_Z == null ? 100 : this.tray.APPROACH_Z / 1000;
                })
                .catch(error => {
                    console.info(error);
                });
        },
        getApproachList() {
            fetch( dataStored.server+'api/utility/approachList',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.approachList=data;
                    //console.log("ApproachList: "+JSON.stringify(this.approachList,null,4))
                })
                .catch(error => {
                    console.info(error);
                });
        },
        getTypePartList() {
            fetch( dataStored.server+'api/utility/typePartList',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.typePartList=data;
                    //console.log("typePartList: "+JSON.stringify(this.typePartList,null,4))
                })
                .catch(error => {
                    console.info(error);
                });
        },
        saveData() {
            // (tray-teaching, fix vizio 396000) conversioni su COPIA locale:
            // MAI mutare this.tray — un doppio click o un fetch fallito con
            // risalvataggio moltiplicherebbero di nuovo x1000 (incidente
            // storico form Pallet). Pattern AE: riga fresca + campi editati.
            const p = Object.assign({}, this.tray);
            p.X = Math.round(p.X * 1000);
            p.Y = Math.round(p.Y * 1000);
            p.X_CORR = Math.round(p.X_CORR * 1000);
            p.Y_CORR = Math.round(p.Y_CORR * 1000);
            p.Z_CORR = Math.round(p.Z_CORR * 1000);
            // (tray-teaching) gradi -> millesimi di grado; mm -> millesimi
            p.X_ROT = Math.round(p.X_ROT * 1000);
            p.Y_ROT = Math.round(p.Y_ROT * 1000);
            p.Z_ROT = Math.round(p.Z_ROT * 1000);
            p.APPROACH_X = Math.round(p.APPROACH_X * 1000);
            p.APPROACH_Y = Math.round(p.APPROACH_Y * 1000);
            p.APPROACH_Z = Math.round(p.APPROACH_Z * 1000);

            var cmd = ""
            if (!this.createNew){
                //eseguo aggiornamento -> update DB
                cmd = dataStored.server+'api/conf/tray/updatetray?' + new URLSearchParams( p ).toString();
            }else{
                //nuovo cassetto -> insert DB
                cmd = dataStored.server+'api/conf/tray/inserttray?' + new URLSearchParams( p ).toString();
            }
            fetch( cmd ,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    // (tray-teaching) rotazioni+avvicinamento propagati alle
                    // [POSITION] del cassetto, con conferma "applicato a N"
                    if (!this.createNew && this.tray.FLOOR_MAG > 0)
                        return this.propagateTeaching(p);
                })
                .then(() => this.$router.push('/conf/Trays'))
                .catch(error => {
                    console.info(error);
                });
        },
        // (tray-teaching) ROT+APPROACH del cassetto -> [POSITION] TRAY_n
        // esistenti; il backend risponde "OK;<n>" per la conferma a video.
        propagateTeaching(p) {
            const params = new URLSearchParams({
                FLOOR_MAG: this.tray.FLOOR_MAG,
                X_ROT: p.X_ROT, Y_ROT: p.Y_ROT, Z_ROT: p.Z_ROT,
                APPROACH_TYPE: p.APPROACH_TYPE,
                APPROACH_X: p.APPROACH_X, APPROACH_Y: p.APPROACH_Y, APPROACH_Z: p.APPROACH_Z
            });
            return fetch(dataStored.server+'api/conf/tray/propagateTeaching?'+params.toString(), { method: 'GET' })
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.text(); })
                .then(body => {
                    const n = (body || '').indexOf('OK;') == 0 ? body.slice(3) : '0';
                    dataStored.alert.title = 'INFO';
                    dataStored.alert.desc = this.$t('tray.teach.applied', { n: n });
                    dataStored.alert.type = 'message';
                });
        }
    },
    computed:{
        getPositionOnPlant() {
            if (this.tray.POS_IN_IMPIANTO==1000)
                return "=> ROBOT";
            if (this.tray.POS_IN_IMPIANTO<0)
                return "=> OUT";
            return "";
        }
    },
    mounted(){
        this.getDataTable();
        this.getApproachList();
        this.getTypePartList();
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

    #aligned-foo{
        width:300px;
    }

    /* FO3: spazio in coda per lo scroll su touch (ex <br> multipli). */
    .bottom-spacer{
        height: var(--space-8);
    }
</style>
