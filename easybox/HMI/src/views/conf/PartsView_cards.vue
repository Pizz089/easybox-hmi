<script setup>
    //import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../data.js'
</script>

<template>
  <div class="pure-g">
    <div class="pure-u-1-24">
          &nbsp;
      </div>
    <span class="pure-u-22-24">
      <h3> 
          Tipo pezzi
          <button class="pure-button-primary">create new </button> 
      </h3> 
      <div v-for="(p) in pieces" :key="p.ID"
        class="container_card pure-u-1-2 pure-u-md-1-3 pure-u-lg-1-4">

        <div class="card" @click="$router.push('/conf/parts');">
            
            <img v-if="p.PRISMA" src="../../assets/cube2.png" alt="prisma" width="65px;">
            <img v-if="!p.PRISMA" src="../../assets/cylinder.png" alt="cylinder" >
            <div class="container" style="padding-bottom: 21px;">
                <h4> {{ p.FAMILY }}</h4>
                <h4><b>{{p.DESCR}}</b></h4>
                <h4 v-if="p.PRISMA"> Dim: {{ p.X }}x{{ p.Y }}  H{{ p.Z }}</h4> 
                <h4 v-else> Dim: R{{ p.X }}   H{{ p.Z }}</h4> 
                <h6>Program: {{p.PARTPROGRAM}}</h6>
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
            createNew:false
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
                    this.pieces=data;
                    //elimino un po di spazi vuoti
                    //this.tray.FAMILY=this.tray.FAMILY.trim();
                    //this.tray.DESCR=this.tray.DESCR.trim();
                })
                .catch(error => {
                    console.info(error);
                });
        },
      },
      mounted(){
        this.getDataTable();
      }
    }
  </script>

<style>
/* CARDS */
.errore{
    background-color:#ff000070;
}
.normal{
    background-color: white;
}

.card {
  box-shadow: 0 4px 8px 0 rgba(0,0,0,1.2);
  transition: 0.6s;
  padding-top: 24px;
  margin-top: 11px;
  margin-left: 8px;
  margin-right: 8px;
  place-items: center;    
  display:grid;
}

.card img{
    border-radius: 22px;
    background-color: #30644330;
    padding: 2px;
}


.card:hover {
  box-shadow: 0 8px 16px 0 rgba(0,0,0,0.2);
}

.container {
  padding: 2px 16px;
}

.center {
  justify-content: center;
}
</style>

