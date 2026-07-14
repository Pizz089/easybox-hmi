<script setup>
    //import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../data.js'
    import orderCMD from '../../components/Comands/ComandsRows.vue';

</script>

<template>
    <div class="view-shell view-shell--fill conf-card" >
      <div class="view-header">
          <h3 class="view-title"> Tipo pezzi </h3>
          <button class="pure-button pure-button-primary"
                  :class="{'pure-button-disabled':dataStored.userLevel<=1}"
                  :id="locked"
                  @click="createPart()">
            {{$t('piece.createNew')}}
          </button>
      </div>
      <div class="table-scroll">
      <table class="pure-table pure-table-horizontal">
          <thead>
              <tr>
                  <th>{{$t('piece.prisma')}}</th>
                  <th>{{$t('piece.family')}}</th>
                  <th style='width:15%'>{{$t('piece.descr')}}</th>
                  
                  <th>{{$t('piece.dim')}}</th>
                  <th>{{$t('piece.Z')}}</th>
                  <th id='hide'>{{$t('piece.Z_pick')}}</th>
                  <th id='hide'>{{$t('piece.Z_place')}}</th>
                  <th>{{$t('piece.comands')}}</th>
              </tr>
          </thead>
          <tbody>
            <template v-for="(p) in pieces" :key="p.ID" >
                <tr v-if="p.ID>0" :class="{'pure-table-odd':(p.ID % 2==1)}">
                  <td>
                      <img v-if="p.PRISMA" src="../../assets/cube2.png" alt="prisma" width="65px;">
                      <img v-if="!p.PRISMA" src="../../assets/cylinder.png" alt="cylinder" >
                    </td>
                    <td>{{p.FAMILY}}</td>
                    <td>{{p.DESCR}}</td>
                    <!--td>{{p.PRISMA?'PRISMATIC':'CYLINDER'}}</td-->
                    <td><strong>{{p.X/1000}}x{{p.Y/1000}}</strong> </td>
                    <td><strong>{{p.Z/1000}}</strong></td>
                    <td id='hide'>{{p.Z_PICK/1000}}</td>
                    <td id='hide'>{{p.Z_PLACE/1000}}</td>
                    <td>
                        <orderCMD  :reference="createLink( p.ID )" 
                                    :index="toStr(p.ID)"
                                    modify="true"   @cmdModify="modifyPiece(p.ID)"
                                    del="true"  	@cmdDel="sicurezza(p.ID)"
                                    >
                        </orderCMD>
                    </td>
                </tr>
                 <tr v-if="_showPopUp(p.ID)">
                    <td class="popUpOnLine" colspan="20" >
                        <div class="center">
                            <h3>{{ $t('pallet.sure') }}</h3>
                            <!--h4>{{ $t('pallet.delete') }}</h4-->
                            <span class="pure-g">
                                <button class="pure-button-micromission specialCMD pure-u-1" @click="deletePiece(p.ID)">
                                    DELETE
                                </button>
                                <button class="btn-ghost pure-u-1" @click="showPopUp=0">
                                    EXIT
                                </button>
                            </span>
                        </div>
                    </td>
                </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
</template>

<script>
export default {
    data(){
        return {
            pieces:{},
            showPopUp:-1,
            createNew:false,
			polling:true
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
        createLink(id) {
            let stringObj = new String(id);
            return "/conf/piece/" ;
        },
		createPart() {
			this.$router.push('/conf/piece/piece');
		},
        toStr(id) {
            let stringObj = new String(id);
            return parseInt(stringObj);
        },
        modifyPiece(pieceID){
          this.$router.push('/conf/piece/piece?pieceID='+pieceID);
        },
        sicurezza(i){
            this.showPopUp=i
        },
		deletePiece(pieceID){
          this.showPopUp=-1;
		  fetch( dataStored.server+'api/conf/piece/'+pieceID,{ method: 'delete'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
        },
    },
    mounted(){
        this.getDataTable()
        setInterval(() => {
            if(this.polling)
                this.getDataTable();
        }, 2000);
    },
    unmounted(){
        this.polling=false;
    },
    computed:{
        locked(){
            if (dataStored.userLevel<=1)
                return 'locked4maintenance'
            return ''
        }
    }
}
  </script>

<style scoped>
/* CARDS — blocco legacy della versione a card (PartsView_cards): il template
   attuale (tabella) non usa queste classi. Era NON scoped e faceva leak
   globale su .card/.container della dashboard (LV7): ora scoped + token. */
.errore{
    background-color: var(--color-danger-bg);
}
.normal{
    background-color: var(--bg-surface);
}

.card {
  box-shadow: var(--elevation-2);
  transition: 0.6s;
  padding-top: var(--space-5);
  margin-top: var(--space-2);
  margin-left: var(--space-2);
  margin-right: var(--space-2);
  place-items: center;
  display:grid;
}

.card img{
    border-radius: var(--radius-lg);
    background-color: var(--color-success-bg);
    /* 2px: micro-aggiustamento ottico (eccezione §2.1) */
    padding: 2px;
}


.card:hover {
  box-shadow: var(--elevation-3);
}

.container {
  /* 2px verticale: micro-aggiustamento ottico (eccezione §2.1) */
  padding: 2px var(--space-4);
}

.center {
  justify-content: center;
}
</style>

<style scoped>
    .pure-table-horizontal  #td {
        justify-content: center;
        display: flex;
    }
    .pure-table{
        width: inherit;
    }

    .popUpOnLine{
        /*background-image: url(/src/assets/up_red.png);*/
        background-repeat: no-repeat;
        background-position-x: 14.6em;
    }

    .popUpOnLine .btn-ghost {
        margin-top: var(--space-2);
    }

    /* 2px (non 1px --border-card): il popup di conferma delete deve
       staccare piu' di un bordo card. */
    .center {
        margin: auto;
        width: 20%;
        border: 2px solid var(--color-critical);
        padding: var(--space-6);
    }
</style>
