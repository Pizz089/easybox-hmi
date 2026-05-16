<script setup>
    //import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../data.js'
    import  workOrderStep  from '../../components/workOrder_step.vue'
</script>

<template>
   <workOrderStep></workOrderStep>
  <div class="pure-g">
    <div class="pure-u-1-24">
          &nbsp;
      </div>
    <span class="pure-u-22-24">
      <h3> 
          <!--Quanti pezzi? -->
          &nbsp;
      </h3> 
      <div class="pure-u-22-24">

        <div class="pure-form pure-form-aligned" >
            <!--fieldset-->
                <div class="pure-control-group">
                    <label for="aligned-foo">* {{$t('quantity')}}</label>
                    <input type="number" id="aligned-foo" name="quantity" 
                           v-model="dataStored.createWorkOrder.quantity" placeholder=""/>
                </div>
                
                <!--h3> 
                    PartProgram
                </h3--> 
                <div class="pure-control-group">
                    <label for="aligned-foo">* PartProgram</label>
                    <select class="pure-u-1" id="aligned-foo" name="PPList" 
                        v-model="PPindex" :readonly="dataStored.userLevel<0" style="max-width: 218px;">
                        <option value="0"> No selected </option>
                        <template v-for="(pp,index) in PPList" :key="pp.ID">
                            <option :value="index+1"> 
                                {{pp.NAME.trim()}}
                            </option>
                        </template>  
                    </select>
                </div>
                <br>
                <h3>Dati per il posizionameto</h3>
                
                <hr>

                <p>{{$t('decentrated_tray.pick')}} {{$t('decentrated_tray.tray')}}</p>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('decentrated_tray.x_pick')}}</label>
                    <input type="number" id="aligned-foo" name="decentrated_tray_x_pick" 
                           v-model="dataStored.createWorkOrder.decentrated_tray_x_pick" placeholder=""/> <small>0.01 mm</small>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('decentrated_tray.y_pick')}}</label>
                    <input type="number" id="aligned-foo" name="decentrated_tray_y_pick" 
                           v-model="dataStored.createWorkOrder.decentrated_tray_y_pick" placeholder=""/> <small>0.01 mm</small>
                </div>
                
                <p>{{$t('decentrated_tray.place')}} {{$t('decentrated_tray.macchina')}}</p>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('decentrated_tray.x_place')}}</label>
                    <input type="number" id="aligned-foo" name="decentrated_tray_x_place" 
                           v-model="dataStored.createWorkOrder.decentrated_tray_x_place" placeholder=""/> <small>0.01 mm</small>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('decentrated_tray.y_place')}}</label>
                    <input type="number" id="aligned-foo" name="decentrated_tray_y_place" 
                           v-model="dataStored.createWorkOrder.decentrated_tray_y_place" placeholder=""/> <small>0.01 mm</small>
                </div>
                <br>
                <hr>

                <p>{{$t('decentrated_tray.pick')}} {{$t('decentrated_tray.macchina')}}</p>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('decentrated_tray.x_pick')}}</label>
                    <input type="number" id="aligned-foo" name="decentrated_MC_x_pick" 
                           v-model="dataStored.createWorkOrder.decentrated_MC_x_pick" placeholder=""/> <small>0.01 mm</small>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('decentrated_tray.y_pick')}}</label>
                    <input type="number" id="aligned-foo" name="decentrated_MC_y_pick" 
                           v-model="dataStored.createWorkOrder.decentrated_MC_y_pick" placeholder=""/> <small>0.01 mm</small>
                </div>
                <p>{{$t('decentrated_tray.place')}} {{$t('decentrated_tray.tray')}}</p>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('decentrated_tray.x_place')}}</label>
                    <input type="number" id="aligned-foo" name="decentrated_MC_x_place" 
                           v-model="dataStored.createWorkOrder.decentrated_MC_x_place" placeholder=""/> <small>0.01 mm</small>
                </div>
                <div class="pure-control-group">
                    <label for="aligned-foo">{{$t('decentrated_tray.y_place')}}</label>
                    <input type="number" id="aligned-foo" name="decentrated_MC_y_place" 
                           v-model="dataStored.createWorkOrder.decentrated_MC_y_place" placeholder=""/> <small>0.01 mm</small>
                </div>

                <div class="pure-controls">
                    <button type="submit" 
                        class="pure-button pure-button-primary" 
                        @click="saveData()" 
                        :disabled="PPindex<=0||dataStored.createWorkOrder.quantity<=0"> <!--:disabled="dataStored.userLevel==0"-->
                        Save
                    </button>

                </div>
            <!--/fieldset-->
        </div>
      </div>
    </span>
  </div>
</template>

<script>
export default {
    data(){
        return {
            createNew:true,
            PPList:{},
            PPindex:0
        }
    },
    methods: {
        nextStep(ID){
        },
        getPPList(){
            fetch( dataStored.server+'api/pp/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.PPList=data;
                    console.log(JSON.stringify(data,null,4))
                })
                .catch(error => {
                    console.info(error);
                });
        },
        saveData() {
            var cmd = ""
            dataStored.createWorkOrder.decentrated_tray_x_pick  *= 100;
            dataStored.createWorkOrder.decentrated_tray_y_pick  *= 100;
            dataStored.createWorkOrder.decentrated_tray_x_place *= 100;
            dataStored.createWorkOrder.decentrated_tray_y_place *= 100;
            dataStored.createWorkOrder.decentrated_MC_x_pick    *= 100;
            dataStored.createWorkOrder.decentrated_MC_y_pick    *= 100;
            dataStored.createWorkOrder.decentrated_MC_x_place   *= 100;
            dataStored.createWorkOrder.decentrated_MC_y_place   *= 100;
            dataStored.createWorkOrder.PP                        = this.PPindex;
            
            if (!this.createNew){
                //eseguo aggiornamento -> update DB
                cmd = dataStored.server+'api/order/updateOrder?' + new URLSearchParams( dataStored.createWorkOrder ).toString();
            }else{
                //nuovo ordine -> insert DB
                cmd = dataStored.server+'api/order/insertOrder?' + new URLSearchParams( dataStored.createWorkOrder ).toString();
                //console.log(JSON.stringify(dataStored.createWorkOrder ,null,4))
            }
            fetch( cmd ,{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    dataStored.emptingStructure()
                    this.$router.push("/production")
                })
                .catch(error => {
                    console.info(error);
                });
        }
      },
      mounted(){
        this.getPPList()
      }
    }
  </script>
