<script setup>
    //import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../data.js'
    import  workOrderStep  from '../../components/workOrder_step.vue'
    import { dedupeGrippers } from '../../util/grippers.js'
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
                    <!-- pinza gia' montata sul robot: selezionabile (il PLC
                         salta il cambio), solo etichetta informativa -->
                    <span v-if="p.onBoard" class="onboard">{{ $t('wizard.gripper.onBoard') }}</span>
                </h5>
            </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script>
// (order-gripper-onboard, 1/9) UNA voce per pinza fisica, riga canonica =
// ID minore, pinze a bordo selezionabili (il PLC salta il cambio): tutto in
// util/grippers.js (dedupeGrippers). La vecchia fusione "SUB_POS > 1 ->
// ID*1000 + subID sulla card precedente" e' stata rimossa: con le gemelle a
// SUB_POS 3 incollava la doppia nella card della pinza pallet (ID 1026037).
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
                    this.data = dedupeGrippers(data);
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
  /* etichetta "gia' a bordo": informativa (accent), non un blocco */
  .onboard {
    display: inline-block;
    margin-left: var(--space-2);
    padding: 0 var(--space-2);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    color: var(--accent);
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>