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
          Tipo pallet
          <!--button class="pure-button-primary">create new </button--> 
      </h3> 

      <div class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-xl-1-4" >
        <div class="card" @click="nextStep(0)" style="background-color: coral;">
            <div class="container" style="padding-bottom: 21px;">
                <h4><b>NO PALLET</b></h4>              
            </div>
        </div>
      </div>
      <div v-for="(p) in data" :key="p.ID"  
          class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-xl-1-4">
        
        <div class="card" @click="nextStep(p.ID)">

            <div class="container" style="padding-bottom: 21px;">
                <h4><b>{{ p.FAMILY }}</b></h4>
                <h4>{{p.DESCR}}</h4>
                <h4> Dim: {{ p.X/1000 }}x{{ p.Y/1000 }}  H{{ p.Z/1000 }}</h4> 
                <h4> Pos: {{getPosition(p)}} </h4>
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
            fetch( dataStored.server+'api/conf/pallet/show/all',{ method: 'GET'})
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
        getPosition(pal){
            if (pal.POS_PLANT>=100)
                return this.$t('Mag')+" "+pal.MAG_POS+' >> '+this.$t('Machine')+' '+(pal.POS_PLANT-99);
            if (pal.MAG_POS<0)
                return this.$t('fuori_magazzino')

            return this.$t('Mag')+" "+pal.MAG_POS; 
        },
        nextStep(ID){
            dataStored.createWorkOrder.palletID=ID;
            this.$router.push('/selectFixture');
        }
      },
      mounted(){
        this.getDataTable();
      }
    }
  </script>
