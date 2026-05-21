<script setup>
  import { dataStored } from '../../data.js'
  import { sendToRobot } from '../../util/globalFunction.js';
</script>

<template>
  <div class="pure-u-1">
    <div class="pure-u-1-24">
    </div>
    <div class="pure-u-10-24">
      <h1>{{$t('Stato')}} EasyBox </h1>
      <div class="area pure-u-1" :style="getColorFromStatus()">
          <h5>
            {{ getDescriptionFromStatus(status) }}
            <span v-if="error>0 && error<999">
              <br><br>
              {{$t('TRAY')}} #{{ error }} {{$t('tray.NOT_IN_POSITION')}}
            </span>
            <span v-if="error==999">
              <br><br>
              {{$t('menu.trays')}} {{$t('tray.NOT_IN_POSITION')}}
            </span>
          </h5>
      </div>

      <!--div class="area pure-u-1">
        <h5 v-for="d in data" :key="d.ID">
        <span v-if="d.EXTRACT==1"> 
          Cassetto {{ d.ID }} estratto 
        </span>
        </h5>
      </div-->

      <div class="area pure-u-1">
        <h5>
          {{getTrayExtract()>0? $t("tray.extract")+getTrayExtract(): $t("tray.no_extract")}} 
        </h5>
      </div>
    </div>

    <!--------------------- COLONNA COMANDI -------------------->
    
    <div class="pure-u-1-24">
    </div>
    <div class="pure-u-10-24">
      <h1> {{$t('Comandi')}} </h1>
      
      <button class="pure-button-micromission pure-u-1 specialCMD button_pressed" 
        @click="sendToBox(99)">
        RESET
      </button>

      <!--div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1"  style="margin-top:10px; padding:10px"> {{ $t('APRI_PORTA')}}</button>
      </div>
      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1"  style="margin-top:10px; padding:10px"> {{ $t('CHIUDI_PORTA')}}</button>
      </div-->    
      
      <br><br><br><br><br><br>

      <h6> {{ $t("unit.MacroMission") }}
      </h6>
      <div class="pure-u-1">
        <button class="pure-u-1"
          :class="[!cmdActiveMission? 'pure-button-disable' : 'pure-button-mission']"
          @click="cmdActiveMission?sendToRobot(26):''">
          {{ $t('tray.INSERISCI_CASSETTO') }} 
          <span v-if="getTrayExtract()>0"> 
            n° {{ getTrayExtract() }}
          </span>
        </button>
      </div>

    </div>
  </div>
</template>

<script>
export default {
    data(){
        return {
          data:{},
          status:0,
          error : ""
        }
    },
    methods: {
        getTrayData() {
            fetch(dataStored.server+'api/conf/tray/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                  this.data = data
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        getStatus(){
          fetch(dataStored.server + 'api/unit/show/SMALLBOX', { method: 'GET' })
            .then(response => {
              if (!response.ok) {
                throw new Error('Network response was not ok');
              }
              return response.json()
            })
            .then(box => {
              this.status = box[0].STATUS;
              this.error = box[0].DESCR;
            })
            .catch(error => {
              console.info("-------------")
              console.info(error);
            });
        },
        getDescriptionFromStatus(status){
          switch (status) {
            case dataStored.status_paused:
              return "PAUSED ";
              break;
            case dataStored.status_aborted:
              return "ABORTED ";
              break;
            case dataStored.status_auto:
              return "MODE AUTO";
              break;
            case dataStored.status_manual:
              return "MANUAL MODE";
              break;
            case dataStored.status_alarm:
              return "ALARM ";
              break;
            case dataStored.status_off:
              return this.$t('unit.box.off');
              break;
            case dataStored.status_hold:
              return "HOLD";
              break;
          }
          return "NOT DEFINED ";
        },
        getColorFromStatus() {
          if (this.status == dataStored.status_manual)
            return 'background-color:yellow'
          if (this.status == dataStored.status_alarm)
            return 'background-color:red'
          if (this.status == dataStored.status_auto || this.status == dataStored.status_local)
            return 'background-color:green'
          if (this.status == dataStored.status_remote)
            return 'background-color:lime'
          if (this.status == dataStored.status_working || this.status == dataStored.status_hold)
            return 'background-color: #54a4F5;'
          return 'background-color:lightgray'
        },
        getTrayExtract(){
          for (let i=0; i<this.data.length; i++){
            if (this.data[i].EXTRACT == 1) 
              return this.data[i].FLOOR_MAG; //+" (id="+this.data[i].ID+")";
          }
          return 0
        },
        sendToBox(val) {
          dataStored.WS.socket.emit("TO_PLANT/CMD/BOX", val);
        }
    },
    mounted(){
        this.getTrayData()
        this.getStatus();
        dataStored.WS.socket.on('BOX/STATUS', () =>{
          this.getTrayData()
          this.getStatus();
        });
        dataStored.WS.socket.on('BOX/DESCR', (desc) =>{
          this.getStatus();
        });
    },
    unmounted(){
    },
    computed: {
      cmdActiveMission(){
        if (dataStored.RobotInLocalMode && this.getTrayExtract()>0) 
          return true;
        else 
          return false;
      }
    }
  }
</script>

<style scoped>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
}
.pure-button-micromission{
  background-color: rgb(33, 33, 211);
  color: whitesmoke;
}
.pure-button-mission{
  background-color: orange;
}
.area {
  color: black;
  background-color: lightgray;
  padding: 5px;
  margin-top: 10px;
  text-align: center;
}
button {
  margin-top: 10px;
  padding: 10px;
}
.specialCMD {
  border-radius: 20px;
  background-color: coral;
}

</style>

