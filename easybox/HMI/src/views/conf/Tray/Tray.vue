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
      <div class="pure-u-1-24">
          &nbsp;
      </div>

      <div class="pure-u-22-24">
        <h2 v-if="!createNew">{{ $t('tray.data')}} : {{ tray.ID }}</h2>
        <h2 v-if="createNew"> {{ $t('tray.createNew')}} </h2>

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
                <div class="pure-controls">
                    <button class="pure-button pure-button-primary" @click="saveData()" :disabled="dataStored.userLevel==0">
                        Save
                    </button>
                </div>
                
            <!--/fieldset-->
        </div>
      </div>

      <br><br><br><br><br><br><br><br><br><br><br><br><br><br>
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
                Z_CORR:0
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
            this.tray.X = this.tray.X * 1000;
            this.tray.Y = this.tray.Y * 1000;

            this.tray.X_CORR = this.tray.X_CORR * 1000;
            this.tray.Y_CORR = this.tray.Y_CORR * 1000;
            this.tray.Z_CORR = this.tray.Z_CORR * 1000;
            
            var cmd = ""
            if (!this.createNew){
                //eseguo aggiornamento -> update DB
                cmd = dataStored.server+'api/conf/tray/updatetray?' + new URLSearchParams( this.tray ).toString();
            }else{
                //nuovo cassetto -> insert DB
                cmd = dataStored.server+'api/conf/tray/inserttray?' + new URLSearchParams( this.tray ).toString();
                console.log(JSON.stringify(this.tray,null,4))
            }
            fetch( cmd ,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    //return this.$router.go(-8);  //va per fortuna?
                    return this.$router.push('/conf/Trays');
                })
                .catch(error => {
                    console.info(error);
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
    .errore{
        background-color:lightcoral;
    }
</style>
