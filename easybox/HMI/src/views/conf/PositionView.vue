<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import CMDlist from '../../components/Comands/ComandsRows.vue';
    
    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    const el = ref()
</script>

<template>   
    &nbsp;
      <div class="pure-u-23-24">
        <h3>{{$t('position.welcome')}}
            &nbsp;
            <!--button class="pure-button pure-button-primary" @click="createposition()">
            {{$t('position.add_position')}}
          </button-->
          &nbsp;
          <!--button class="pure-button pure-button-primary" @click="$router.push('/conf/positionOnPallet');">
            {{$t('position.PosOnPallet')}}
          </button-->
        </h3>
        <h3 class="searchBar">
            <input type="text" placeholder="search" v-model="searchQuery" style="margin-left:40px;">
        </h3>
        <table class="pure-table pure-table-horizontal" style="margin-top: 30px;">
            <thead>
                <tr style="position: sticky; top: 0; background-color: #e0e0e0;;">
                    <!--th>ID</th-->
                    <th> 
                        <img src="../../assets/lente.png" width="15px"> 
                        <br>
                        {{$t('name')}} 
                    </th>
                    <th>
                        <img src="../../assets/lente.png" width="15px"> 
                        <br>
                        {{$t('position.position')}}
                    </th>
                    <th></th>
                    <th style="text-align:right">{{$t('position.Pos')}} [mm]</th>
                    <th style="text-align:right">{{$t('position.Correzione')}} [mm]</th>

                    <th style="text-align:right">{{$t('position.Rotazione')}} [°]</th>
                    <th style="text-align:right">{{$t('position.Correzione')}} [°]</th>
                    
                    <th style="text-align:right">{{$t('position.approach')}} [mm]</th>
                    <!--th>{{$t('position.comands')}}</th-->
                    <th>&nbsp;</th>
                </tr>
            </thead>
            <tbody>
                <template v-for="(dt,index) in datiTabFiltred" :key="dt.ID" >
                    <tr :class="{'pure-table-odd':(index % 2==1)}">
                        <!--td>{{dt.ID}} </td-->
                        <!--td v-if="dt.MAG>0">{{dt.MAG}}.{{dt.MAG_POS}} </td>
                        <td v-else><strong>OUT</strong></td-->

                        <td>{{getDescription(dt.PARENT.trim())}}</td>    
                        
                        <td>{{dt.SUB_POS>0?dt.SUB_POS:""}}</td>    

                        <td style="text-align:right">
                            <strong>X</strong><br>
                            <strong>Y</strong><br>
                            <strong>Z</strong>
                        </td>
                        <td style="text-align:right" :class="{'locked4OP':dt.ID==editID && dataStored.userLevel==0}">
                            <span v-if="dt.ID!=editID || dataStored.userLevel==0"> 
                                <span>{{getFormat(dt.X, dt.ID==editID)}} </span><br>
                                <span>{{getFormat(dt.Y, dt.ID==editID)}} </span><br>
                                <span>{{getFormat(dt.Z, dt.ID==editID)}} </span>
                            </span>
                            <span v-if="dt.ID==editID && dataStored.userLevel>=1"> 
                                <input type="number" step="0.01" v-model="datiInEdit.X" style="width:90px;text-align:right" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Y" style="width:90px;text-align:right" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Z" style="width:90px;text-align:right" />
                            </span>
                            <br>
                        </td>
                        <td style="text-align:right">
                            <span v-if="dt.ID!=editID"> 
                                <span>{{getFormat(dt.X_CORR, dt.ID==editID)}}</span><br>
                                <span>{{getFormat(dt.Y_CORR, dt.ID==editID)}}</span><br>
                                <span>{{getFormat(dt.Z_CORR, dt.ID==editID)}}</span>
                            </span>
                            <span v-if="dt.ID==editID"> 
                                <input type="number" step="0.01" v-model="datiInEdit.X_CORR" style="width:90px;text-align:right" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Y_CORR" style="width:90px;text-align:right" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Z_CORR" style="width:90px;text-align:right" />
                            </span>
                        </td>
                        
                        <td style="text-align:right" :class="{'locked4OP':dt.ID==editID && dataStored.userLevel==0}" >
                            <span v-if="dt.ID!=editID || dataStored.userLevel==0"> 
                                <span>{{getFormat(dt.X_ROT, dt.ID==editID)}}</span><br>
                                <span>{{getFormat(dt.Y_ROT, dt.ID==editID)}}</span><br>
                                <span>{{getFormat(dt.Z_ROT, dt.ID==editID)}}</span>
                            </span>
                            <span v-if="dt.ID==editID && dataStored.userLevel>=1"> 
                                <input type="number" step="0.01" v-model="datiInEdit.X_ROT" style="width:90px;text-align:right" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Y_ROT" style="width:90px;text-align:right" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Z_ROT" style="width:90px;text-align:right" />
                            </span>
                            <br>
                        </td>
                        <td style="text-align:right">
                            <span v-if="dt.ID!=editID "> 
                                <span>{{getFormat(dt.X_ROT_CORR)}}</span><br>
                                <span>{{getFormat(dt.Y_ROT_CORR)}}</span><br>
                                <span>{{getFormat(dt.Z_ROT_CORR)}}</span>
                            </span>
                            <span v-if="dt.ID==editID"> 
                                <input type="number" step="0.01" v-model="datiInEdit.X_ROT_CORR" style="width:90px;text-align:right" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Y_ROT_CORR" style="width:90px;text-align:right" /><br>
                                <input type="number" step="0.01" v-model="datiInEdit.Z_ROT_CORR" style="width:90px;text-align:right" />
                            </span>
                        </td>

                        <td style="text-align:right">
                            <span v-if="dt.ID!=editID "> 
                                <span>{{getFormat(dt.APPROACH_X)}}</span><br>
                                <span>{{getFormat(dt.APPROACH_Y)}}</span><br>
                                <span>{{getFormat(dt.APPROACH_Z)}}</span>
                            </span>
                            <span v-if="dt.ID==editID"> 
                                <input type="number" step="0.001" v-model="datiInEdit.APPROACH_X" style="width:90px;text-align:right" /><br>
                                <input type="number" step="0.001" v-model="datiInEdit.APPROACH_Y" style="width:90px;text-align:right" /><br>
                                <input type="number" step="0.001" v-model="datiInEdit.APPROACH_Z" style="width:90px;text-align:right" />
                            </span>
                        </td>
                        
                        <td>
                            <CMDlist  
                                :modify="true && editID==0" @cmdModify="updatePosition(dt.ID)"
                                :save="editID==dt.ID"       @cmdSave="updatePosition(dt.ID)"
                            />
                            
                        </td>
                    </tr>
                    <tr v-if="_showPopUp(dt.ID)">
                        <td class="popUpOnLine" colspan="20" >
                            <div class="center">
                                <h3>{{ $t('position.sure') }}</h3>
                                <!--h4>{{ $t('position.delete') }}</h4-->
                                <span class="pure-g">
                                    <button class="pure-button button-error pure-u-1" @click="deleteposition(dt.ID)">
                                        DELETE
                                    </button>
                                    <button class="pure-button button-secondary pure-u-1" @click="showPopUp=0" style="margin-top:9px">
                                        EXIT
                                    </button>
                                </span>
                            </div>
                        </td>
                    </tr>
                </template>
            </tbody>
        </table>
        <br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br>
      </div>
</template>

<script>
export default {
    data(){
        return {
            datiTab:[],
            datiTabFiltred:[],
            showPopUp:0,
            polling:false,
            editID:0,
            datiInEdit:{},
            searchQuery:""
        }
    },
    methods: {
        getDataTable() {
            fetch(dataStored.server+'api/conf/position/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    console.log("ricevo dati per "+data.length+"  posizioni")  
                    this.datiTab=data    
                    this.datiTabFiltred = data;
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        getDescription(parent){
            let ris = parent
            if (parent.startsWith("SHELF"))
                ris = 'position.SHELF' 
            if (parent.startsWith("TRAY"))
                ris = 'position.TRAY' 
            if (parent.startsWith("EXTRACT_TRAY"))
                ris = 'position.EXTRACT_TRAY' 
            if (parent.startsWith("MC"))
                ris = 'position.MC'
            if (parent.startsWith("Pal"))
                return this.$t('Pallet') 
                       +" "+ 
                       parent.substring(parent.indexOf("Pal")+3,parent.indexOf("_"))
                       +" "+ 
                       this.$t('Fixture')
                       +" "+ 
                       parent.substring(parent.lastIndexOf("Fx")+2)
                
            if (parent.lastIndexOf("_")>0)
                return this.$t(ris)+ " "+ parent.substring(parent.lastIndexOf("_")+1);
            return this.$t(ris)
        },
        updatePosition(id){
            if (this.editID >0){
                //leggo i dati modificati e salvo su DB
                for (let i=0; i<this.datiTab.length; i++){
                    if (this.datiTab[i].ID == this.editID){
                        this.datiTab[i]             = this.datiInEdit;
                        this.datiInEdit.X           = this.datiInEdit.X          * 1000;
                        this.datiInEdit.Y           = this.datiInEdit.Y          * 1000;
                        this.datiInEdit.Z           = this.datiInEdit.Z          * 1000;
                        this.datiInEdit.X_CORR      = this.datiInEdit.X_CORR     * 1000;
                        this.datiInEdit.Y_CORR      = this.datiInEdit.Y_CORR     * 1000;
                        this.datiInEdit.Z_CORR      = this.datiInEdit.Z_CORR     * 1000;
                        this.datiInEdit.X_ROT       = this.datiInEdit.X_ROT      * 1000;
                        this.datiInEdit.Y_ROT       = this.datiInEdit.Y_ROT      * 1000;
                        this.datiInEdit.Z_ROT       = this.datiInEdit.Z_ROT      * 1000;
                        this.datiInEdit.X_ROT_CORR  = this.datiInEdit.X_ROT_CORR * 1000;
                        this.datiInEdit.Y_ROT_CORR  = this.datiInEdit.Y_ROT_CORR * 1000;
                        this.datiInEdit.Z_ROT_CORR  = this.datiInEdit.Z_ROT_CORR * 1000;
                        this.datiInEdit.APPROACH_X  = this.datiInEdit.APPROACH_X * 1000;
                        this.datiInEdit.APPROACH_Y  = this.datiInEdit.APPROACH_Y * 1000;
                        this.datiInEdit.APPROACH_Z  = this.datiInEdit.APPROACH_Z * 1000;

                        var cmd = dataStored.server+'api/conf/position/updateposition?' + new URLSearchParams( this.datiTab[i] ).toString();
                        fetch( cmd ,{ method: 'GET'})
                        .then(response => {
                            if (!response.ok) {
                                alert('Network response was not ok')
                                throw new Error('Network response was not ok');
                            }
                        })
                        .catch(error => {
                            alert(error);
                        });
                    }
                }
                this.editID = 0
                
            }else{
                //richiedo la modifica di una riga della tabella
                this.editID = id;
                for (let i=0; i<this.datiTab.length; i++)
                    if (this.datiTab[i].ID == id){
                        this.datiInEdit             = this.datiTab[i];
                        this.datiInEdit.X           = this.getFormat(this.datiInEdit.X);
                        this.datiInEdit.Y           = this.getFormat(this.datiInEdit.Y);
                        this.datiInEdit.Z           = this.getFormat(this.datiInEdit.Z);
                        this.datiInEdit.X_CORR      = this.getFormat(this.datiInEdit.X_CORR);
                        this.datiInEdit.Y_CORR      = this.getFormat(this.datiInEdit.Y_CORR);
                        this.datiInEdit.Z_CORR      = this.getFormat(this.datiInEdit.Z_CORR);
                        this.datiInEdit.X_ROT_CORR  = this.getFormat(this.datiInEdit.X_ROT_CORR);
                        this.datiInEdit.Y_ROT_CORR  = this.getFormat(this.datiInEdit.Y_ROT_CORR);
                        this.datiInEdit.Z_ROT_CORR  = this.getFormat(this.datiInEdit.Z_ROT_CORR);
                        this.datiInEdit.X_ROT       = this.getFormat(this.datiInEdit.X_ROT);
                        this.datiInEdit.Y_ROT       = this.getFormat(this.datiInEdit.Y_ROT);
                        this.datiInEdit.Z_ROT       = this.getFormat(this.datiInEdit.Z_ROT);
                        this.datiInEdit.APPROACH_X  = this.getFormat(this.datiInEdit.APPROACH_X);
                        this.datiInEdit.APPROACH_Y  = this.getFormat(this.datiInEdit.APPROACH_Y);
                        this.datiInEdit.APPROACH_Z  = this.getFormat(this.datiInEdit.APPROACH_Z);
                    }
            }
        },
        //getFormat(data){
        //    return (data/1000).toFixed(3); //.replace(".",",");
        //},
        getFormat(data, selected=false){
            if (selected && dataStored.userLevel==0)
                return (data/1).toFixed(3);    
            else
                return (data/1000).toFixed(3);
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
        }
    },
    watch:{
        searchQuery(search){
            //console.log(JSON.stringify(this.datiTab,null,4))
            if (search=="") 
                this.datiTabFiltred = this.datiTab;
            else{
                let query=search.toLowerCase();
                this.datiTabFiltred = this.datiTab.filter(item => {
                    let campoTradotto = this.getDescription(item.PARENT.trim())
                    return (
                        campoTradotto.toLowerCase().includes(query) ||
                        item.SUB_POS.toString().includes(query)
                    );
                })
            }
        },
        'datiInEdit.X_CORR'(newValue){
            if (newValue>dataStored.linTollerance)  this.datiInEdit.X_CORR = dataStored.linTollerance;
            if (newValue<-dataStored.linTollerance) this.datiInEdit.X_CORR = -dataStored.linTollerance;
        },
        'datiInEdit.Y_CORR'(newValue){
            if (newValue*1000>dataStored.linTollerance*1000)  this.datiInEdit.Y_CORR = dataStored.linTollerance;
            if (newValue<-dataStored.linTollerance) this.datiInEdit.Y_CORR = -dataStored.linTollerance;
            //if (newValue>dataStored.linTollerance*1000)  this.datiInEdit.Y_CORR = dataStored.linTollerance*1000;  //corregge durante la visualizzazione ma al DB arriva valore >5mm
        },
        'datiInEdit.Z_CORR'(newValue){
            if (newValue>dataStored.linTollerance)  this.datiInEdit.Z_CORR = dataStored.linTollerance;
            if (newValue<-dataStored.linTollerance) this.datiInEdit.Z_CORR = -dataStored.linTollerance;
        },
        'datiInEdit.X_ROT_CORR'(newValue){
            if (newValue>dataStored.rotTollerance)  this.datiInEdit.X_ROT_CORR = dataStored.rotTollerance;
            if (newValue<-dataStored.rotTollerance) this.datiInEdit.X_ROT_CORR = -dataStored.rotTollerance;
        },
        'datiInEdit.Y_ROT_CORR'(newValue){
            if (newValue>dataStored.rotTollerance)  this.datiInEdit.Y_ROT_CORR = dataStored.rotTollerance;
            if (newValue<-dataStored.rotTollerance) this.datiInEdit.Y_ROT_CORR = -dataStored.rotTollerance;
        },
        'datiInEdit.Z_ROT_CORR'(newValue){
            if (newValue>dataStored.rotTollerance)  this.datiInEdit.Z_ROT_CORR = dataStored.rotTollerance;
            if (newValue<-dataStored.rotTollerance) this.datiInEdit.Z_ROT_CORR = -dataStored.rotTollerance;
        }
    },
    computed: {
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
    @media only screen and (max-width: 1028px) {
        .pure-table-horizontal  td {
            text-align: center;
        }
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

    .popUpOnLine{
        background-image: url(/src/assets/up_red.png);
        background-repeat: no-repeat;
        background-position-x: 34%;
    }
    
    .center {
        margin: auto;
        width: 20%;
        border: 3px solid #ef000082;
        /*background-color: #ef000036;*/
        padding: 40px;
    }

    .locked4OP{
        background-image:url('/src/assets/chiaveIng.svg');
        
        background-repeat: no-repeat;
        background-size: 1.7em;
        /*background-position: left;*/
        background-position-x: 100%;
        background-position-y: 100%;
        background-color: lightyellow;
    } 

    .searchBar{
        background-image:url('/src/assets/lente.png');
        background-repeat: no-repeat;
        background-size: 1.7em;
        background-position: left;
    } 
</style>
