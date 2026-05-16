<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';


    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';

    const el = ref()
</script>

<template>   
      <div class="pure-u-1-24">
          &nbsp;
      </div>

      <div class="pure-u-23-24">
           
        <h3>{{$t('grating.welcome')}}
          <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="createGrating()">
            {{$t('grating.createNew')}}
          </button>
          &nbsp;
          <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="importGrating()">
            {{$t('grating.importNew')}}
          </button>
        </h3>
        <table class="pure-table pure-table-horizontal" style="margin-top: 30px;">
            <thead>
                <tr>
                    <th>{{$t('grating.name')}}</th>
                    <th>{{$t('grating.descr')}}</th>
                    <th>{{$t('TRAY')}}</th>
                    <th>{{$t('GRIPPER')}}</th>
                    <th>{{$t('PIECE')}}</th>
                    <th>{{$t('grating.comands')}}</th>
                </tr>
            </thead>
            <tbody>
                <template v-for="(dt) in datiTab" :key="dt.ID" >
                    <tr :class="{'pure-table-odd':(dt.ID % 2==1)}">
                        <td>{{dt.NAME.trim()}} </td>
                        <td>{{dt.DESCR.trim()}}</td>
                        <td @click="goToLayout(dt.TRAY_ID, dt.TraySTATUS, dt.FLOOR_MAG)">
                            <span>
                                <img src="../../assets/link.png" width="20em"/>
                                &nbsp;
                                {{ dt.FLOOR_MAG>=0?dt.FLOOR_MAG:'OUT' }}
                            </span>
                        </td>
                        <td>{{ dt.GRIPPER_DESC }}</td>
                        <td>{{ dt.PIECE_ID }}</td>
                        <td>
                            <orderCMD  :reference="createLink( dt.ID )" 
                                       :index="dt.ID"
                                       modify="true" @cmdModify="$router.push('/conf/grating/'+dt.ID);"
                                       del="true"	 @cmdDel="sicurezza(dt.ID)"
                                       >
                            </orderCMD>
                        </td>
                    </tr>
                    <tr v-if="_showPopUp(dt.ID)">
                        <td class="popUpOnLine" colspan="20" >
                            <div class="center">
                                <h3>{{ $t('tray.sure') }}</h3>
                                <h4>{{ $t('grating.delete') }}</h4>
                                <span class="pure-g">
                                    <button class="pure-button button-error pure-u-1" @click="deleteGrating(dt.ID)">
                                        DELETE
                                    </button>
                                    <button class="pure-button butto-secondary pure-u-1" @click="showPopUp=0" style="margin-top:9px">
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
</template>

<script>
export default {
    data(){
        return {
            datiTab:[],
            statusList:[],
            showPopUp:0,
			polling:true
        }
    },
    methods: {
        getDataTable() {
            fetch(dataStored.server+'api/conf/grating/showcompleteData/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(gratings => {
                    //console.log(JSON.stringify(order,null,4))
                    console.log("ricevo dati per "+gratings.length+" grigliati")  
                    this.datiTab=gratings
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        createGrating(){
            this.$router.push('/conf/grating/0');  //passando ID=0 allora significa che è un nuovo grigliato da fare
        },
        importGrating(){
            this.$router.push('/conf/importGrating');  //prova bottone grating esistente
        },
        createLink(id) {
            let stringObj = new String(id);
            return "/conf/Grating/"+ stringObj ;
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
        },
        sicurezza(i){
            this.showPopUp=i
        },
		deleteGrating(id) {
			this.showPopUp=0
            fetch(dataStored.server+'api/conf/grating/'+id ,{ method: 'delete'})
                .then(response => {
                    if (!response.ok) {
                        alert('Network response was not ok');
                        throw new Error('Network response was not ok');
                    }
                    this.deletePositionsFromTray(id);
                })
                .catch(error => {
                    console.info(error);
					alert(error);
                });
        },
		deletePositionsFromTray(id) {
            fetch(dataStored.server+'api/conf/position/deletePositionsTray/'+id ,{ method: 'delete'})
                .then(response => {
                    if (!response.ok) {
                        alert('Network response was not ok');
                        throw new Error('Network response was not ok');
                    }
                })
                .catch(error => {
                    console.info(error);
					alert(error);
                });
		},
        goToLayout(Tray_ID,TraySTATUS,floor_MAG){
            if (TraySTATUS==dataStored.status_working) 
                this.$router.push('/layout/'+Tray_ID+'/0/'+floor_MAG);
            else    
                this.$router.push('/layout/'+Tray_ID+'/1/'+floor_MAG);
        },
    },
    computed:{
        locked(){
            if (dataStored.userLevel<=1)
                return 'locked4maintenance'
            return ''
        }
    },
    mounted(){
        this.getDataTable()
        setInterval(() => {
            if(this.polling)
                this.getDataTable()
        }, 3000);
    },
    unmounted(){
        this.polling=false;
    }
}
</script>

<style scoped>
    .pure-table-horizontal  #td {
        justify-content: center;
        display: flex;
    }
    .pure-table{
        width: inherit;
    }
    .button-error {
        background: rgb(202, 60, 60);
        color: white;
        border-radius: 4px;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
    }
</style>
