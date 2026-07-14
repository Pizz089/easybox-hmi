<script setup>
    //import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../data.js'
    import  workOrderStep  from '../../components/workOrder_step.vue'
</script>

<template>
  <div class="view-shell">
    <workOrderStep></workOrderStep>
    <h3 class="view-title"> Macchina </h3>
    <div class="pure-g">
      <div v-for="(p) in data" :key="p.ID"
        class="container_card pure-u-1-2 pure-u-md-1-4 pure-u-xl-1-4">

        <div v-if="p.UNIT.substring(0,2)=='MC'" class="card" @click="nextStep(p.UNIT)">
            <div class="container">
                <h4><b>{{ p.UNIT.trim() }}</b></h4>
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
            data:{}
        }
    },
    methods: {
        getDataTable() {
            fetch( dataStored.server+'api/unit/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.data=data;
                    //for (let i=0; i<data.length; i++){
                    //    console.log(JSON.stringify(data[i], null,4))
                    //    if (data[i].UNIT.substring(0,2) == "MC"){
                    //        let d={};
                    //        d.UNIT = data[i].UNIT
                    //        this.data.push(d)
                    //    }
                    //}
                })
                .catch(error => {
                    console.info(error);
                });
        },
        nextStep(unit){
            dataStored.createWorkOrder.machineID=unit.trim().substring(2,3);
            this.$router.push('/lastData');
        }
      },
      mounted(){
        this.getDataTable();
      }
    }
  </script>
