<script setup>
    //import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../data.js'
    import { useI18n } from 'vue-i18n'
    import  workOrderStep  from '../../components/workOrder_step.vue'

    const { t } = useI18n()
</script>

<template>
   <workOrderStep></workOrderStep>
  <div class="pure-g">
    <div class="pure-u-1-24">
          &nbsp;
      </div>
    <span class="pure-u-22-24">
      <h3>Tipo pezzo</h3>
      <div class="search-bar">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
              type="text"
              class="search-input"
              :placeholder="t('wizard.search.piecePlaceholder')"
              v-model="searchQuery"
          />
      </div>
      <div class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-xl-1-4" >
        <div class="card" @click="nextStep(0)" style="background-color: coral;min-height: 238px;">
            <div class="container" style="padding-bottom: 21px;">
                <h4><b>Manual Vice</b></h4>              
            </div>
        </div>
      </div>
      <div v-for="(p) in piecesFiltered" :key="p.ID"
        class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-xl-1-4">

        <div class="card" @click="nextStep(p.ID)">
            
            <img v-if="p.PRISMA" src="../../assets/cube2.png" alt="prisma" width="65px;">
            <img v-if="!p.PRISMA" src="../../assets/cylinder.png" alt="cylinder" >
            <div class="container" style="padding-bottom: 21px;">
                <h4><b>{{ p.FAMILY }}</b></h4>
                <h5>{{p.DESCR}}</h5>
                <h5 v-if="p.PRISMA"> Dim: {{ p.X/1000 }}x{{ p.Y/1000 }}  H{{ p.Z/1000 }}</h5> 
                <h5 v-else> Dim: R{{ p.X/1000 }}   H{{ p.Z/1000 }}</h5> 
                <!--h6>Program: {{p.PARTPROGRAM}}</h6-->
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
            pieces:{},
            piecesFiltered:{},
            createNew:false,
            searchQuery:""
        }
    },
    methods: {
        getDataTable() {
            fetch( dataStored.server+'api/conf/piece/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    //console.log("pieces: "+JSON.stringify(data,null,4))
                    let ris = []
                    for (let i=0; i<data.length; i++){
                        if (data[i].X>0 && data[i].Y>0){  //evito il "pezzo non definito"
                            ris.push(data[i]);
                        }
                    }
                    this.pieces = ris;
                    this.piecesFiltered = ris;
                    //svuoto la struttura dati ogni volta che inizio il ciclo di scelta
                    dataStored.emptingStructure()
                })
                .catch(error => {
                    console.info(error);
                });
        },
        nextStep(ID){
            dataStored.createWorkOrder.pieceID=ID;
            this.$router.push('/selectGripper');
        }
      },
      mounted(){
        this.getDataTable();
      },
      watch:{
        searchQuery(search){
            //console.log(JSON.stringify(this.datiTab,null,4))
            if (search=="") 
                this.piecesFiltered = this.pieces;
            else{
                let query=search.toLowerCase();
                this.piecesFiltered = this.pieces.filter(item => {
                    return (
                           item.FAMILY.trim().toLowerCase().includes(query) 
                        || item.DESCR.trim().toLowerCase().includes(query)  
                        || item.X.toString().includes(query) 
                        || item.Y.toString().includes(query) 
                        || item.Z.toString().includes(query)     
                    );
                })
            }
        }
      }
    }
  </script>

<style scoped>
/* Search bar: wrapper relative con icona lente SVG inline a sx + input
   con padding-left per spazio icona. Pattern coerente con ChangeUserModal (UI-4).
   Fixed typo <style scope> -> <style scoped> (era global per quirk). */
.search-bar {
    position: relative;
    max-width: 400px;
    margin: 0 0 var(--space-4);
}

.search-icon {
    position: absolute;
    left: var(--space-3);
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
}

.search-input {
    width: 100%;
    background: var(--bg-input);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 10px 16px 10px 36px;
    color: var(--text-primary);
    font-size: 14px;
    transition: border-color var(--transition-fast);
}

.search-input::placeholder {
    color: var(--text-muted);
}

.search-input:focus,
.search-input:focus-visible {
    outline: none;
    border-color: var(--text-primary);
}
</style>
