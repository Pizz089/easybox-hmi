<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../../data.js'

    import { ref, onMounted } from 'vue'
    const el = ref()
</script>

<template>   
      <div class="pure-u-1-24">
          &nbsp;
      </div>

      <div class="pure-u-22-24">
        <h2 v-if="!createNew">{{ $t('pallet.data')}} : {{ pallet.ID }}</h2>
        <h2 v-if="createNew"> {{ $t('pallet.createNew')}} </h2>

        <div class="pure-form pure-form-aligned" >
            <fieldset>
                <input type="hidden" name="ID" v-model="pallet.ID" />

                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.family')}}</label>
                    <input type="text" id="aligned-foo" name="FAMIGLIA" v-model="pallet.FAMILY" placeholder="" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.descr')}}</label>
                    <input type="text" id="aligned-foo" name="DESCR" v-model="pallet.DESCR" placeholder="" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.lunghezza')}}</label>
                    <input type="number" id="aligned-foo" name="LUNGHEZZA" v-model="pallet.Y" placeholder="0" :readonly="dataStored.userLevel==0" /> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.larghezza')}}</label>
                    <input type="number" id="aligned-foo" name="LARGHEZZA" v-model="pallet.X" placeholder="0" :readonly="dataStored.userLevel==0" /> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.altezza')}}</label>
                    <input type="number" id="aligned-foo" name="NUM_POSTI" v-model="pallet.Z" placeholder="0" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.X_Corr')}}</label>
                    <input type="number" id="aligned-foo" name="X_CORR" v-model="pallet.X_CORR" placeholder="0" :readonly="dataStored.userLevel==0"/> 0.001mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.Y_Corr')}}</label>
                    <input type="number" id="aligned-foo" name="Y_CORR" v-model="pallet.Y_CORR" placeholder="0" :readonly="dataStored.userLevel==0"/> 0.001mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.Z_Corr')}}</label>
                    <input type="number" id="aligned-foo" name="Z_CORR" v-model="pallet.Z_CORR" placeholder="0" :readonly="dataStored.userLevel==0"/> 0.001mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.magazzino')}}</label>
                    <input type="number" id="aligned-foo" name="NUM_POSTI" v-model="pallet.MAG" placeholder="0" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.posizione')}}</label>
                    <input type="number" id="aligned-foo" name="NUM_POSTI" v-model="pallet.MAG_POS" placeholder="0" :readonly="dataStored.userLevel==0" />
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('pallet.posizioneImpianto')}}</label>
                    <input type="number" id="aligned-foo" name="NUM_POSTI" v-model="pallet.POS_PLANT" placeholder="0" :readonly="dataStored.userLevel==0" />
                    <span> {{getPositionOnPlant}} </span>
                </div>

                <div class="pure-controls">
                    <button class="pure-button pure-button-primary" @click="saveData()" :disabled="dataStored.userLevel==0">
                        Save
                    </button>
                </div>
            </fieldset>
        </div>
      </div>
</template>

<script>
export default {
    data(){
        return {
            pallet:{
                FAMILY:'',
                DESCR:'',
                X:0,
                Y:0,
                Z:0,
                X_CORR:0,
                Y_CORR:0,
                Z_CORR:0,
                MAG:0,
                MAG_POS:0,
                POS_PLANT:0
            },
            createNew:false
        }
    },
    methods: {
        getDataTable() {
            if (this.$route.query.palletID==undefined){
                this.createNew=true;
                return;
            }
            //alert("ID: "+this.$route.query.palletID)
            fetch( dataStored.server+'api/conf/pallet/show/'+this.$route.query.palletID,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    //console.log("pallet:"+JSON.stringify(pallet,null,4))
                    this.pallet=data[0];
                    //elimino un po di spazi vuoti
                    this.pallet.FAMILY=this.pallet.FAMILY.trim();
                    this.pallet.DESCR=this.pallet.DESCR.trim();
                    //trasformo le dimensioni in mm
                    this.pallet.X = this.pallet.X /1000;
                    this.pallet.Y = this.pallet.Y /1000;
                    this.pallet.Z = this.pallet.Z /1000;
                    //this.pallet.X_CORR = this.pallet.X_CORR /10;
                    //this.pallet.Y_CORR = this.pallet.Y_CORR /10;
                    //this.pallet.Z_CORR = this.pallet.Z_CORR /10;
                })
                .catch(error => {
                    console.info(error);
                });
        },
        saveData() {
            var cmd = ""
            if (!this.createNew){
                //eseguo aggiornamento -> update DB
                cmd = dataStored.server+'api/conf/pallet/updatepallet?' + new URLSearchParams( this.pallet ).toString();
            }else{
                //nuovo cassetto -> insert DB
                cmd = dataStored.server+'api/conf/pallet/insertpallet?' + new URLSearchParams( this.pallet ).toString();
                //console.log(JSON.stringify(this.pallet,null,4))
            }
            fetch( cmd ,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return this.$router.push('/conf/pallets');
                })
                .catch(error => {
                    console.info(error);
                });
        }
    },
    computed:{
        getPositionOnPlant() {
            if (this.pallet.POS_PLANT>=100 && this.pallet.POS_PLANT<200)
                return " MC1";
            if (this.pallet.POS_PLANT>=200 && this.pallet.POS_PLANT<300)
                return " MC2";
            if (this.pallet.POS_PLANT>=300 && this.pallet.POS_PLANT<400)
                return " MC3";
            return "";
        }
    },
    mounted(){
        this.getDataTable();
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
