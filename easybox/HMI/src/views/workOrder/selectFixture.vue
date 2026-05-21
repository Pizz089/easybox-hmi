<script setup>
    //import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../data.js'
    import { useI18n } from 'vue-i18n'
    import  workOrderStep  from '../../components/workOrder_step.vue'
    import CubeIcon3D from '../../components/CubeIcon3D.vue'

    const { t } = useI18n()
</script>

<template>
   <workOrderStep></workOrderStep>
  <div class="pure-g">
    <div class="pure-u-1-24">
          &nbsp;
      </div>
    <span class="pure-u-22-24">
      <h3> 
          Tipo Attrezzatura
      </h3> 
      <div class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-lg-1-5">
        <div class="card" @click="nextStep(0)" style="background-color: coral;">
            <h4><b>{{ t('wizard.value.noFixture') }}</b></h4>
        </div>
      </div>
      <div v-for="(p) in data" :key="p.ID"
        class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-lg-1-5">

        <div class="card card--detailed" @click="nextStep(p.ID)">
            <CubeIcon3D :w="p.X" :d="p.Y" :h="p.Z" :prisma="true" :bgMode="true" />
            <span class="card-name">{{ p.FAMILY }}</span>
            <div class="card-meta">
                <span class="card-descr">{{ p.DESCR }}</span>
                <span class="card-dim">
                    Dim: {{ p.X/1000 }}×{{ p.Y/1000 }} H{{ p.Z/1000 }}
                </span>
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
            fetch( dataStored.server+'api/conf/fixture/show/all',{ method: 'GET'})
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
            dataStored.createWorkOrder.fixtureID=ID;
            this.$router.push('/selectMC');
        }
      },
      mounted(){
        this.getDataTable();
      }
    }
  </script>
