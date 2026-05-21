<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { dataStored } from '../data.js'
import { onMounted } from 'vue';
import { useTheme } from '@/composables/useTheme';


</script>

<template>
    <div class="pure-u-1" id="rigaInAlto">

        <!--button @click="$router.go(-1)">
            <img src="../assets/left.png" width="20px"/>
        </button-->

        <!--div class="searchMenu">
            <input type="text" placeholder="search" v-model="dataStored.searchQuery" style="margin-left:34px;">
        </div-->
        <div class="topbar-logo">
            <img src="@/assets/logo.png" alt="ADMG Logo" />
        </div>
        <h3 v-if="!dataStored.WS.connected">in attesa di connessione!!</h3>
        <div>
            <RouterLink to="/changeUser">
                <img v-if="dataStored.userLevel == 0" src="../assets/casco.png" width="45px" class="operatorLevel">
                <img v-if="dataStored.userLevel == 1" src="../assets/chiaveIng.svg" width="45px" class="operatorLevel">
                <img v-if="dataStored.userLevel == 2" src="../assets/laurea.png" width="45px" class="operatorLevel">
            </RouterLink>

            <h6 class="languageMenu" @click="changeLang">
                <img src="/src/assets/translate.png" width="45px">
                <!--&nbsp;{{ $i18n.locale }}</h6-->
            </h6>
            
            <h6 class="productionMenu" @click="sendToRobot(dataStored.RobotInLocalMode ? 81 : 82)">
                <img :src="[dataStored.RobotInLocalMode ? '/src/assets/on_manual3.png' : '/src/assets/on_auto3.png']"
                    width="90%">
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
            
            
            
            /*<button class="theme-btn" @click="toggleTheme" :title="isDark ? 'Light mode' : 'Dark mode'">
                <span v-if="!isDark">🌙</span>
                <span v-else>☀️</span>
            </button>*/
export default {
    data() {
        return {
            languageDisp: ['it', 'en'],
            langIndex: 0,
        }
    },
    methods: {
        changeLang() {
            this.langIndex++;
            if (this.langIndex >= this.languageDisp.length)
                this.langIndex = 0;

            this.$i18n.locale = this.languageDisp[this.langIndex];
        },
        sendToRobot(val) {
            dataStored.WS.socket.emit("TO_PLANT/CMD/ROBOT", val);
        }
    },
    mounted() {
        dataStored.WS.socket.on('ROBOT/STATUS', payload => {
            //alert("payload: "+payload);
            if (parseInt(payload) == dataStored.status_remote) {
                dataStored.RobotInLocalMode = false;
                //alert("local: "+dataStored.RobotInLocalMode);
                //alert(this.$t("ROBOT READY FOR WORK!"));
                //dataStored.alert.title=this.$t("ATTENTION");
                //dataStored.alert.type="message";
                //dataStored.alert.desc=this.$t("ROBOT READY FOR WORK!");
            }
            if (parseInt(payload) == dataStored.status_local) {
                dataStored.RobotInLocalMode = true;
                //alert("local: "+dataStored.RobotInLocalMode);
            }
        })
    },
    unmounted() {
        //dataStored.WS.socket.off('ROBOT/STATUS');
    }
}

const { isDark, toggleTheme, setTheme, theme } = useTheme();
</script>


<style scoped>
/* Logo ADMG nella TopBar (spostato da SideBar in UI-3.2).
   .topbar-logo riempie tutta l'altezza TopBar (64px), l'img dentro
   lascia 4px breathing top+bottom (height calc(100% - 8px) = 56px).
   Layout/bg/box-shadow TopBar gestiti da custom-fix.css sezione B. */
.topbar-logo {
    display: flex;
    align-items: center;
    height: 100%;
}

.topbar-logo img {
    height: calc(100% - 8px);
    width: auto;
    object-fit: contain;
}
</style>