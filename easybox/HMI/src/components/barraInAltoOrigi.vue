<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../data.js'
import { onMounted } from 'vue';
</script>

<template>
    <div class="pure-u-1" id="rigaInAlto">
        
        <!--button @click="$router.go(-1)">
            <img src="../assets/left.png" width="20px"/>
        </button-->
        
        <!--div class="searchMenu">
            <input type="text" placeholder="search" v-model="dataStored.searchQuery" style="margin-left:34px;">
        </div-->
        <h3 v-if="!dataStored.WS.connected">in attesa di connessione!!</h3>
        <div>
            <RouterLink to="/changeUser">
                <img v-if="dataStored.userLevel==0"  src="../assets/casco.png" width="45px" class="operatorLevel">
                <img v-if="dataStored.userLevel==1" src="../assets/chiaveIng.svg" width="45px" class="operatorLevel">
                <img v-if="dataStored.userLevel==2" src="../assets/laurea.png" width="45px" class="operatorLevel">
            </RouterLink>
        
            <h6 class="languageMenu" @click="changeLang">
                <img src="/src/assets/translate.png" width="45px" >
                <!--&nbsp;{{ $i18n.locale }}</h6-->
            </h6>
            <h6 class="productionMenu" @click="sendToRobot(dataStored.RobotInLocalMode ? 81 : 82)">
                <img :src="[dataStored.RobotInLocalMode ? '/src/assets/on_manual3.png' : '/src/assets/on_auto3.png']" width="90%" >
            </h6>
            <!--:style="[dataStored.RobotInLocalMode ? 'background-image: url(/src/assets/on_manual3.png);' : 'background-image: url(/src/assets/on_auto.png);']" -->
        </div>

        <!--RouterLink v-if="dataStored.alert.title!=''" to="/changeUser" class="alarmMenu">
            <h6>&nbsp;</h6>
        </RouterLink-->

    </div>

    <!--main>
        <RouterView />
    </main-->
</template>

<script>
    export default {
        data() {
            return { 
                languageDisp:['it','en'],
                langIndex: 0,
            }
        },
        methods: {
            changeLang() {
                this.langIndex++;
                if (this.langIndex>=this.languageDisp.length )
                    this.langIndex=0;
                
                this.$i18n.locale=this.languageDisp[this.langIndex];
            },
            sendToRobot(val) {
                dataStored.WS.socket.emit("TO_PLANT/CMD/ROBOT", val);
            }
        },
        mounted(){
            dataStored.WS.socket.on('ROBOT/STATUS', payload => {
                //alert("payload: "+payload);
                if (parseInt(payload) == dataStored.status_remote){
                    dataStored.RobotInLocalMode = false;
                    //alert("local: "+dataStored.RobotInLocalMode);
                    //alert(this.$t("ROBOT READY FOR WORK!"));
                    //dataStored.alert.title=this.$t("ATTENTION");
                    //dataStored.alert.type="message";
                    //dataStored.alert.desc=this.$t("ROBOT READY FOR WORK!");
                }
                if (parseInt(payload) == dataStored.status_local){
                    dataStored.RobotInLocalMode = true;
                    //alert("local: "+dataStored.RobotInLocalMode);
                }
            })
        },
        unmounted() {
            //dataStored.WS.socket.off('ROBOT/STATUS');
        }
    }
</script>


<style scoped>
    img{
        margin-top: -13px;
    }

    #rigaInAlto {
        /*position: sticky;*/
        height:4em;
        top: 0px;
        left: 200px;
        background:white;
        overflow-y: auto;
        border-bottom: 2px solid;
        border-color: #071972;
    }

    #rigaInAlto p{
        float:right;
        padding-right: 80px;
        background-image: url('/src/assets/casco.PNG');
        background-repeat: no-repeat;
        background-size: 1.8em;
        background-position-x: 50%;
        opacity: 66%;
        /*
        border-radius: 35px;
        background-color: rgb(201, 201, 153);
        */
    }

    .operatorLevel{
        float: right;
        padding-right: 30px;
        padding-top: 22px;
    }

    .languageMenu{
        float: right;
        padding-right: 40px;
        padding-top: 0px;
        /*background-image: url('../assets/translate.png');
        background-position: 1px 1px;*/
        background-repeat: no-repeat;
        background-size: 44%;
        border: 0px;
        padding-left: 16px;
    }
    
    .productionMenu{
        float: right;
        padding-right: 28px;
        padding-top: 0px;
        background-repeat: no-repeat;
        background-size: 40px;
        background-position: 1px 12px;
        border: 0px;
        padding-left: 16px;
    }

    .alarmMenu{
        float: right;
        padding-right: 112px;
        padding-top: 0px;
        background-image: url('../assets/campana.png');
        background-repeat: no-repeat;
        background-size: 34%;
        background-position: 31px 12px;
        border: 0px;
    }

    .searchMenu{
        float: left;
        padding-right: 3px;
        padding-top: 30px;
        background-image: url('../assets/lente.png');
        background-repeat: no-repeat;
        background-size: 15%;
        background-position: 14px 18px;
        border: 0px;
        padding-left: 16px;
    }
</style>