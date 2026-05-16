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
          Tipo Morsa
      </h3> 
      <div class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-lg-1-4" >
        <div class="card" @click="nextStep(0)" style="background-color: coral;">
            <div class="container" style="padding-bottom: 21px;">
                <h4><b>NO VICE</b></h4>              
            </div>
        </div>
      </div>
      <div v-for="(p) in data" :key="p.ID"
        class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-lg-1-4">

        <div class="card" @click="nextStep(p.ID)">
            
            <!--img v-if="p.PRISMA" src="../../assets/cube2.png" alt="prisma" width="65px;">
            <img v-if="!p.PRISMA" src="../../assets/cylinder.png" alt="cylinder" -->
            <div class="container" style="padding-bottom: 21px;">
                <h4><b>{{ p.FAMILY }}</b></h4>
                <h4>{{p.DESCR}}</h4>
                <h4> Dim: {{ p.X/1000 }}x{{ p.Y/1000 }}  H{{ p.Z/1000 }}</h4> 
                <!--h4 v-else> Dim: R{{ p.X/1000 }}   H{{ p.Z/1000 }}</h4> 
                <h6>Program: {{p.PARTPROGRAM}}</h6-->
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
            data:{}
        }
    },
    methods: {
        getDataTable() {
            fetch( dataStored.server+'api/conf/vice/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    this.data=data;
                })
                .catch(error => {
                    console.info(error);
                });
        },
        nextStep(ID){
            dataStored.createWorkOrder.viceID=ID;
            this.$router.push('/selectMC');
        }
      },
      mounted(){
        this.getDataTable();
      }
    }
  </script>
