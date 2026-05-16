<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../data.js'

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

        <form class="pure-form pure-form-aligned" >
            <fieldset>
                <input type="hidden" name="ID" v-model="tray.ID" />

                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.family')}}</label>
                    <input type="text" id="aligned-foo" name="FAMIGLIA" v-model="tray.FAMILY" placeholder="" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.descr')}}</label>
                    <input type="text" id="aligned-foo" name="DESCR" v-model="tray.DESCR" placeholder="" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.lunghezza')}}</label>
                    <input type="number" id="aligned-foo" name="LUNGHEZZA" v-model="tray.X" placeholder="0" :readonly="dataStored.userLevel==0" /> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.larghezza')}}</label>
                    <input type="number" id="aligned-foo" name="LARGHEZZA" v-model="tray.Y" placeholder="0" :readonly="dataStored.userLevel==0" /> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.numPosti')}}</label>
                    <input type="number" id="aligned-foo" name="NUM_POSTI" v-model="tray.N_PLACE" placeholder="0" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.numGrezzi')}}</label>
                    <input type="number" id="aligned-foo" :class="{'errore':tray.N_FINISHED+tray.N_EMPTY+tray.N_RAW>tray.N_PLACE}"  name="NUM_GREZZI" v-model="tray.N_RAW" placeholder="0" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.numVuoti')}}</label>
                    <input type="number" id="aligned-foo" :class="{'errore':tray.N_FINISHED+tray.N_EMPTY+tray.N_RAW>tray.N_PLACE}" name="NUM_VUOTI" v-model="tray.N_EMPTY" placeholder="0" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.numFiniti')}}</label>
                    <input type="number" id="aligned-foo" :class="{'errore':tray.N_FINISHED+tray.N_EMPTY+tray.N_RAW>tray.N_PLACE}" name="NUM_FINITI" v-model="tray.N_FINISHED" placeholder="0" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.stato')}}</label>
                    <input type="number" id="aligned-foo" name="STATO" v-model="tray.STATUS" placeholder="0" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.tipoPezzo')}}</label>
                    <!--input type="number" id="aligned-foo" name="TIPO_PEZZO" v-model="tray.TIPO_PEZZO" placeholder="0"/-->
                    <select id="aligned-foo" name="TIPO_PEZZO" v-model="tray.PIECE_TYPE"  :readonly="dataStored.userLevel==0" >
                        <template v-for="tpl in typePartList" :key="tpl.ID">
                            <option :value="tpl.ID">
                                {{ tpl.FAMILY }} / {{ tpl.DESCR }}
                            </option>
                        </template>
                    </select>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.tipoApproccio')}}</label>
                    <!--input type="number" id="aligned-foo" name="TIPO_APPROCCIO" v-model="tray.TIPO_APPROCCIO" placeholder="0"/-->
                    <select id="aligned-foo" name="TIPO_APPROCCIO" v-model="tray.APPROACH_TYPE" :readonly="dataStored.userLevel==0">
                        <template v-for="ap in approachList" :key="ap.ID">
                            <option :value="ap.ID">
                                {{ ap.DESCR }} ({{ ap.ID }})
                            </option>
                        </template>
                    </select>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.ZPrelievo')}}</label>
                    <input type="number" id="aligned-foo" name="Z_PRELIEVO" v-model="tray.Z_PICK" placeholder="0" :readonly="dataStored.userLevel==0"/> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.ZDeposito')}}</label>
                    <input type="number" id="aligned-foo" name="Z_DEPOSITO" v-model="tray.Z_PLACE" placeholder="0" :readonly="dataStored.userLevel==0"/> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.pianoMagazzino')}}</label>
                    <!--input type="number" id="aligned-foo" name="PIANO_MAGAZZINO" v-model="tray.PIANO_MAGAZZINO" placeholder="0"/> <span>Floor 1 => lower position</span-->
                    <select id="aligned-foo" name="FLOOR_MAG" v-model="tray.FLOOR_MAG" :readonly="dataStored.userLevel==0">
                        <option value="12">12 higher</option>
                        <option value="11">11</option>
                        <option value="10">10</option>
                        <option value="9" >9</option>
                        <option value="8" >8</option>
                        <option value="7" >7</option>
                        <option value="6" >6</option>
                        <option value="5" >5</option>
                        <option value="4" >4</option>
                        <option value="3" >3</option>
                        <option value="2" >2</option>
                        <option value="1" >1 lower </option>                    
                        <option value="-1" > OUT </option>
                    </select>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.X_Corr')}}</label>
                    <input type="number" id="aligned-foo" name="X_CORR" v-model="tray.X_CORR" placeholder="0" :readonly="dataStored.userLevel==0"/> 0.1mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.Y_Corr')}}</label>
                    <input type="number" id="aligned-foo" name="Y_CORR" v-model="tray.Y_CORR" placeholder="0" :readonly="dataStored.userLevel==0"/> 0.1mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('tray.Z_Corr')}}</label>
                    <input type="number" id="aligned-foo" name="Z_CORR" v-model="tray.Z_CORR" placeholder="0" :readonly="dataStored.userLevel==0"/> 0.1mm
                </div>
                <div class="pure-controls">
                    <button class="pure-button pure-button-primary" @click="saveData()" :disabled="dataStored.userLevel==0">
                        Save
                    </button>

                </div>
            </fieldset>
        </form>
      </div>
</template>

<script>
export default {
    data(){
        return {
            tray:{},
            createNew:false,
            approachList:{},
            typePartList:{},
        }
    },
    methods: {
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
