<script setup>
    //import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../data.js'
    import  workOrderStep  from '../../components/workOrder_step.vue'
</script>

<template>
  <div class="view-shell">
    <workOrderStep></workOrderStep>
    <h3 class="view-title"> Tipo Pinza </h3>
    <div class="pure-g">
      <div v-for="(p) in data" :key="p.ID" class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-lg-1-5">

        <div class="card" @click="nextStep(p.ID)">
            <div class="container">
                <h3 style="min-height: 80px;margin:auto;width:80%;"> <b>{{ p.FAMILY }}</b> </h3>
                <hr>
                <h5 style="min-height: 60px;margin:auto;width:80%;"> {{p.DESCR}}</h5>
                
                <h5 style="min-height: 50px;margin:auto;width:80%;">
                    Pos Mag: <b :class="{'OUT':p.POS_MAG<=0}">{{p.POS_MAG>0?p.POS_MAG:'OUT'}}</b>
                </h5>
            </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script>
export default {
    data(){
        return {
          data:[]
        }
    },
    methods: {
        getDataTable() {
            fetch( dataStored.server+'api/conf/gripper/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    //console.log("pieces: "+JSON.stringify(data,null,4))
                    //filtro: se è una pinza doppia la mostro come se fosse solo 1
                    for (let i=0; i<data.length; i++){
                      //if (data[i].SUB_POS <= 1)
                      //  this.data.push(data[i])
                      if (data[i].SUB_POS > 1){
                        //unisco gli iD delle sottopinze per indicare al PLC che la pinza ha le sottopinze
                        this.data[this.data.length-1].ID = this.data[this.data.length-1].ID * 1000 + data[i].ID;
                      }else
                        this.data.push(data[i])
                    }

                })
                .catch(error => {
                    console.info(error);
                });
        },
        nextStep(ID){
            dataStored.createWorkOrder.gripperID=ID;
            // il pallet e' gia' derivato dal rig (selectRig, primo step):
            // dal ramo morsa si va dritti alla scelta macchina
            this.$router.push('/selectMC');
        }
      },
      mounted(){
        this.getDataTable();
      }
    }
  </script>

<style scoped>
  .OUT{
    color: rgb(213, 6, 6);  
  }
</style>