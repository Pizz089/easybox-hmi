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
        <h2 v-if="!createNew">{{ $t('fixture.data')}} : {{ fixture.ID }}</h2>
        <h2 v-if="createNew"> {{ $t('fixture.create')}} </h2>

        <div class="pure-form pure-form-aligned" >
            <fieldset>
                <input type="hidden" name="ID" v-model="fixture.ID" />

                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.family')}}</label>
                    <input type="text" id="aligned-foo" name="FAMIGLIA" v-model="fixture.FAMILY" placeholder=""/>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.descr')}}</label>
                    <input type="text" id="aligned-foo" name="DESCR" v-model="fixture.DESCR" placeholder=""/>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.bodyX')}}</label>
                    <input type="number" step="0.02" id="aligned-foo" name="X_BODY" v-model="fixture.X" placeholder="0"/> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.bodyY')}}</label>
                    <input type="number" step="0.02" id="aligned-foo" name="Y_BODY" v-model="fixture.Y" placeholder="0"/> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.bodyZ')}}</label>
                    <input type="number" step="0.02" id="aligned-foo" name="Z_BODY" v-model="fixture.Z" placeholder="0"/> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.chelaZ')}}</label>
                    <input type="number" step="0.02" id="aligned-foo" name="Z_CHELE" v-model="fixture.Z_CLAW" placeholder="0"/> mm
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.scassoChelaZ')}}</label>
                    <input type="number" step="0.02" id="aligned-foo" name="Z_SCASSO_CHELE" v-model="fixture.Z_SINK_CLAW" placeholder="0"/> mm
                </div>
                <!--div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.stato')}}</label>
                    <input type="number" id="aligned-foo" name="STATO" v-model="fixture.STATUS" placeholder="0"/>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.posMag')}}</label>
                    <input type="number" id="aligned-foo" name="POS_IN_MAGAZZINO" v-model="fixture.MAG_POS" placeholder="0"/>
                </div-->
                
                <div class="pure-controls">
                    <button class="pure-button pure-button-primary" @click="saveData()">>> NEXT >></button>
                </div>

            </fieldset>
        </div>
      </div>
</template>

<script>
export default {
    data(){
        return {
            fixture:{ },
            createNew:false,
            palletList:{}
        }
    },
    methods: {
        getDataTable() {
            if (this.$route.query.fixtureID==undefined){
                this.createNew=true;
                return;
            }
            fetch( dataStored.server+'api/conf/fixture/show/'+this.$route.query.fixtureID,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.fixture = data[0]
                    this.fixture.X              /= 1000;
                    this.fixture.Y              /= 1000;
                    this.fixture.Z              /= 1000;
                    this.fixture.Z_CLAW         /= 1000;
                    this.fixture.Z_SINK_CLAW    /= 1000;
                    this.fixture.DESCR          = this.fixture.DESCR.trim();
                    this.fixture.FAMILY         = this.fixture.FAMILY.trim();
                    //Aggiungo le voci di FixtureOnPallet
                    this.fixture.POS_X          /= 1000;
                    this.fixture.POS_Y          /= 1000;
                    this.fixture.POS_Z          /= 1000;
                    this.fixture.POS_X_CORR     /= 1000;
                    this.fixture.POS_Y_CORR     /= 1000;
                    this.fixture.POS_Z_CORR     /= 1000;
                    this.fixture.POS_X_ROT      /= 1000;
                    this.fixture.POS_Y_ROT      /= 1000;
                    this.fixture.POS_Z_ROT      /= 1000;
                })
                .catch(error => {
                    console.info(error);
                });
        },
        getPalletList() {
            fetch( dataStored.server+'api/conf/pallet/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.palletList=data;
                    //console.log("partList: "+JSON.stringify(this.palletList,null,4))
                })
                .catch(error => {
                    console.info(error);
                });
        },
        saveData() {
            var cmd = ""
            if (!this.createNew){
                //eseguo aggiornamento -> update DB
                cmd = dataStored.server+'api/conf/fixture/updateFixture?' + new URLSearchParams( this.fixture ).toString();
                //alert(cmd)
            }else{
                //nuova pinza -> insert DB
                cmd = dataStored.server+'api/conf/fixture/insertFixture?' + new URLSearchParams( this.fixture ).toString();
            }
            fetch( cmd ,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        alert("Network response was not ok")
                        throw new Error('Network response was not ok');
                    }
                    //return this.$router.push("/conf/Fixtures")
                    return this.$router.push("/conf/Fixtureonpallet?fixtureID="+this.fixture.ID)
                })
                .catch(error => {
                    console.info(error);
                    alert("errore")
                });
        }
    },
    computed:{
        getPositionOnPlant() {
            if (this.fixture.POS_PLANT==1000)
                return "=> ROBOT";
            if (this.fixture.POS_PLANT<0)
                return "=> OUT";
            return "";
        }
    },
    mounted(){
        this.getDataTable();
        //this.getPalletList();
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
</style>
