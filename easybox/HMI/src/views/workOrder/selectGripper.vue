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
          Tipo Pinza
      </h3> 
      <div v-for="(p) in data" :key="p.ID" class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-xl-1-4">

        <div class="card" @click="nextStep(p.ID)">
            <div class="container" style="padding-bottom: 21px;">
                <h3 style="min-height: 80px;margin:auto;width:80%;"> <b>{{ p.FAMILY }}</b> </h3>
                <hr>
                <h5 style="min-height: 60px;margin:auto;width:80%;"> {{p.DESCR}}</h5>
                
                <h5 style="min-height: 50px;margin:auto;width:80%;">
                    Pos Mag: <b :class="{'OUT':p.POS_MAG<=0}">{{p.POS_MAG>0?p.POS_MAG:'OUT'}}</b>
                </h5>
            </div>
        </div>

      </div>
    </span>
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
            this.$router.push('/selectPallet');
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