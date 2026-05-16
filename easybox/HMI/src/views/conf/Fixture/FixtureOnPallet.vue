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
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('fixture.posPlant')}}</label>
                
                    <select id="aligned-foo" name="palletOption" :readonly="dataStored.userLevel<0" 
                            v-model="fixture.POS_PLANT" > <!--:onchange="resetData()"--> 
                        <option value="0" :selected="fixture.POS_PLANT==0">NOT PLACED</option>
                        <template v-for="(p) in palletList" :key="p.ID">
                            <option :selected="fixture.POS_PLANT==p.ID" :value="p.ID" >
                                #{{ p.ID }} {{ p.FAMILY }} - {{p.DESCR}}
                            </option>
                        </template>                  
                    </select>
                </div>
                
                <span v-if="fixture.POS_PLANT>0">
                    <h4>Position on pallet #{{ fixture.POS_PLANT }}
                        &nbsp; <button @click="resetData()" class="pure-button pure-button-secondary"> reset position </button>
                    </h4> 
                    <div class="pure-control-group">
                        <label for="aligned-foo">X</label>
                        <input type="number" step="0.02" id="aligned-foo" name="stroke_claw" v-model="fixture.POS_X" placeholder="0"/>
                        mm
                    </div>
                    <div class="pure-control-group">
                        <label for="aligned-foo">Y</label>
                        <input type="number" step="0.02" id="aligned-foo" name="stroke_claw" v-model="fixture.POS_Y" placeholder="0"/>
                        mm
                    </div>
                    <div class="pure-control-group">
                        <label for="aligned-foo">Z</label>
                        <input type="number" step="0.02" id="aligned-foo" name="stroke_claw" v-model="fixture.POS_Z" placeholder="0"/>
                        mm
                    </div>
                    <br>
                    <div class="pure-control-group">
                        <label for="aligned-foo">X_ROT</label>
                        <input type="number" step="0.02" id="aligned-foo" name="stroke_claw" v-model="fixture.POS_X_ROT" placeholder="0"/>
                        °
                    </div>
                    <div class="pure-control-group">
                        <label for="aligned-foo">Y_ROT</label>
                        <input type="number" step="0.02" id="aligned-foo" name="stroke_claw" v-model="fixture.POS_Y_ROT" placeholder="0"/>
                        °
                    </div>
                    <div class="pure-control-group">
                        <label for="aligned-foo">Z_ROT</label>
                        <input type="number" step="0.02" id="aligned-foo" name="stroke_claw" v-model="fixture.POS_Z_ROT" placeholder="0"/>
                        °
                    </div>
                    <br>
                    <div class="pure-control-group">
                        <label for="aligned-foo">X_CORR</label>
                        <input type="number" step="0.01" id="aligned-foo" name="stroke_claw" v-model="fixture.POS_X_CORR" placeholder="0"/>
                        mm
                    </div>
                    <div class="pure-control-group">
                        <label for="aligned-foo">Y_CORR</label>
                        <input type="number" step="0.01" id="aligned-foo" name="stroke_claw" v-model="fixture.POS_Y_CORR" placeholder="0"/>
                        mm
                    </div>
                    <div class="pure-control-group">
                        <label for="aligned-foo">Z_CORR</label>
                        <input type="number" step="0.01" id="aligned-foo" name="stroke_claw" v-model="fixture.POS_Z_CORR" placeholder="0"/>
                        mm
                    </div>
                </span>

                <div class="pure-controls">
                    <button class="pure-button pure-button-primary" @click="saveData()">Save</button>
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
                    this.fixture.POS_X          /= 1000;
                    this.fixture.POS_Y          /= 1000;
                    this.fixture.POS_Z          /= 1000;
                    this.fixture.POS_X_CORR     /= 1000;
                    this.fixture.POS_Y_CORR     /= 1000;
                    this.fixture.POS_Z_CORR     /= 1000;
                    this.fixture.POS_X_ROT      /= 1000;
                    this.fixture.POS_Y_ROT      /= 1000;
                    this.fixture.POS_Z_ROT      /= 1000;
                    console.log(JSON.stringify(this.fixture,null,4))
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
                cmd = dataStored.server+'api/conf/fixture/updateFixtureOnPallet?' + new URLSearchParams( this.fixture ).toString();
                //alert(cmd)
            }else{
                //nuova pinza -> insert DB
                cmd = dataStored.server+'api/conf/fixture/insertFixtureOnPallet?' + new URLSearchParams( this.fixture ).toString();
            }
            fetch( cmd ,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        alert("Network response was not ok")
                        throw new Error('Network response was not ok');
                    }
                    return this.$router.push("/conf/Fixtures")
                })
                .catch(error => {
                    console.info(error);
                    alert("errore")
                });
        },
        resetData(){  
            this.fixture.POS_X          = 0;
            this.fixture.POS_Y          = 0;
            this.fixture.POS_Z          = 0;
            this.fixture.POS_X_CORR     = 0;
            this.fixture.POS_Y_CORR     = 0;
            this.fixture.POS_Z_CORR     = 0;
            this.fixture.POS_X_ROT      = 0;
            this.fixture.POS_Y_ROT      = 0;
            this.fixture.POS_Z_ROT      = 0; 
        }
    },
    computed:{
        getPositionOnPlant() {
            //if (this.fixture.POS_PLANT==1000)
            //    return "=> ROBOT";
            //if (this.fixture.POS_PLANT<0)
            //    return "=> OUT";
            //return "";
        }
    },
    mounted(){
        this.getDataTable();
        this.getPalletList();
    },
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
