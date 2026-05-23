<script setup>
  import { dataStored } from '../../data.js'
</script>

<template>
  <div class="pure-u-1">
    <div class="pure-u-1-24">
    </div>
    <div class="pure-u-10-24">
      <h1>{{ $t('Stato') }} Robot </h1>
      <div class="status-card pure-u-1" :class="getColorFromStatus()">
        <h5>
          <span v-if="dataRobot.DESCR>0">
            {{dataRobot.DESCR}}: 
          </span>
          {{ $t( getStatus(dataRobot.STATUS) ) }}
        </h5>
      </div>

      <div class="status-card pure-u-1 link" @click="$router.push('../../conf/grippers')">

        <span v-if="dataGripper.length>0">
          <h5 v-if="dataGripper[0].ID > 0">{{ dataGripper[0].FAMILY }} - {{ dataGripper[0].DESCR }}</h5>
          <h5 v-if="dataGripper[0].ID > 0">
            {{$t('position.SHELF')}} {{$t('position.position')}} : {{ dataGripper[0].POS_MAG }}
          </h5>
          <div class="pure-u-1">
            <div :class="[dataGripper.length>1?'pure-u-1-2':'pure-u-1']">
              <h5 v-if="dataGripper[0].ID > 0">
                {{$t('Stato')}} {{$t('GRIPPER')}} 1: {{ getStatusGripper(dataGripper[0].STATUS) }}
              </h5>
            </div>

            <div class="pure-u-1-2" v-if="dataGripper.length>1 > 0">
              <h5 v-if="dataGripper[1].ID > 0">
                {{$t('Stato')}} {{$t('GRIPPER')}} 2: {{ getStatusGripper(dataGripper[1].STATUS) }}
              </h5>
            </div>
          </div>
          <br><br>
        </span>
        <h5 v-else> NO GRIPPER MOUNTED! </h5>
      </div>

      
      <div class="pure-control-group">
        <br><br><br><br>
        <label for="aligned-foo">ROBOT SPEED: </label>
        <br>
        <!--numericField 
            name="speed" 
            unitMeasure="%" 
            step="5" 
            integerVal="true"
            min="0"
            max="100"
            :model-value="robotSpeed"
            @update="newVal => updateSpeed(newVal)">
        </numericField-->
        <span class="pure-u-1">
          <button class="pure-u-1-5 speed-button button_pressed" @click="updateSpeed(1)"   :class="{ active: dataStored.robotSpeed <= 1 }"> 1% </button>
          <button class="pure-u-1-5 speed-button button_pressed" @click="updateSpeed(10)"  :class="{ active: dataStored.robotSpeed == 10 }"> 10% </button>
          <button class="pure-u-1-5 speed-button button_pressed" @click="updateSpeed(20)"  :class="{ active: dataStored.robotSpeed == 20 }"> 20% </button>
          <button class="pure-u-1-5 speed-button button_pressed" @click="updateSpeed(50)"  :class="{ active: dataStored.robotSpeed == 50 }"> 50% </button>
          <button class="pure-u-1-5 speed-button button_pressed" @click="updateSpeed(100)" :class="{ active: dataStored.robotSpeed == 100 }"> 100% </button>
        </span>
      </div>

    </div>
    <div class="pure-u-1-24">
    </div>
    <div class="pure-u-10-24">
      <h1>{{ $t('Comandi') }}</h1>

      <!-- ===== CARD 1: Comandi critici (RESET / HOLD-START / RESTART) ===== -->
      <section class="command-section">
        <h3 class="command-section-title">{{ $t('robot.section.critical') }}</h3>

        <button class="pure-button-micromission pure-u-1 specialCMD button_pressed"
          @click="sendToRobot(99)">
          RESET
        </button>

        <button class="pure-button-micromission pure-u-1 specialCMD button_pressed" :class="{'button-hold':dataRobot.STATUS==dataStored.status_hold}"
          v-if="dataRobot.STATUS!=dataStored.status_off"
          @click="sendToRobot(17)">
          <span v-if="dataRobot.STATUS!=dataStored.status_hold && dataRobot.STATUS!=dataStored.status_off">
            <span style="font-size: 16px;">HOLD</span>
          </span>
          <span v-if="dataRobot.STATUS==dataStored.status_hold">
            <small>HOLD</small> => <span style="font-size: 16px;">{{$t("CONTINUE")}}</span>
          </span>
        </button>

        <button class="pure-button-micromission pure-u-1 specialCMD button_pressed" :class="{'button-hold':dataRobot.STATUS==dataStored.status_hold}"
          style="animation: blinker 1s linear infinite;border:3px solid black;"
          @click="sendToRobot(17)"
          v-if="dataRobot.STATUS==dataStored.status_off">
          <span>
            <span style="font-size: 16px;">START</span>
          </span>
        </button>

        <button class="pure-button-micromission pure-u-1 specialCMD button_pressed" :disabled="dataRobot.STATUS!=dataStored.status_hold"
          :class="[dataRobot.STATUS!=dataStored.status_hold ? 'pure-button-disable' : 'pure-button-micromission']"
          :style="[dataRobot.STATUS!=dataStored.status_hold ? 'background-color:lightgray;color:gray': '']"
          @click="sendToRobot(18)">
          RESTART MAIN PROGRAM
        </button>
      </section>

      <!-- ===== CARD 2: Movimenti (HOME/MAINT + Punti destinazione) ===== -->
      <section class="command-section">
        <h3 class="command-section-title">{{ $t('robot.section.movement') }}</h3>

        <button class="pure-u-1 button_pressed"
          :class="[dataStored.cmdActive==0? 'pure-button-disable' : 'pure-button-micromission']"
          @click="dataStored.cmdActive==1?sendToRobot(20):''">
          {{ $t('HOME') }}
        </button>

        <button class="pure-u-1 button_pressed"
          :class="[dataStored.cmdActive==0? 'pure-button-disable' : 'pure-button-micromission']"
          @click="dataStored.cmdActive==1?sendToRobot(21):''">
          {{ $t('MAINTENANCE') }}
        </button>

        <h4 class="command-subsection-title">{{ $t('robot.section.destination') }}</h4>
        <div class="pure-g">
          <div class="pure-u-1-3">
            <button style="width:100%" class="button_pressed"
              :class="[dataStored.cmdActive==0? 'pure-button-disable' : 'pure-button-micromission']"
              @click="dataStored.cmdActive==1?sendToRobot('15;1'):''">
              {{ $t('Easybox') }}
            </button>
          </div>
          <div class="pure-u-1-3">
            <button style="width:100%" class="button_pressed"
              :class="[dataStored.cmdActive==0? 'pure-button-disable' : 'pure-button-micromission']"
              @click="dataStored.cmdActive==1?sendToRobot('15;11'):''">
              {{ $t('MC1') }}
            </button>
          </div>
          <div class="pure-u-1-3">
            <button style="width:100%" class="button_pressed"
              :class="[dataStored.cmdActive==0? 'pure-button-disable' : 'pure-button-micromission']"
              @click="dataStored.cmdActive==1?sendToRobot('15;12'):''">
              {{ $t('MC2') }}
            </button>
          </div>
        </div>
      </section>

      <!-- ===== CARD 3: Missioni (SCARICA PINZA) ===== -->
      <section class="command-section">
        <h3 class="command-section-title">{{ $t('robot.section.mission') }}</h3>

        <button class="pure-u-1 button_pressed"
          :class="[dataStored.cmdActiveMission==0? 'pure-button-disable' : 'pure-button-mission']"
          @click="dataStored.cmdActiveMission==1?sendToRobot(12):''">
          {{ $t('SCARICA PINZA') }}
        </button>
      </section>
    </div>

  </div>
</template>

<script>
export default {
  data() {
    return {
      dataGripper: {},
      dataRobot: {},
      polling: true
      //robotSpeed: ''
    }
  },
  methods: {
    getRobotData() {
      fetch(dataStored.server + 'api/conf/gripper/onrobot', { method: 'GET' })
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json()
        })
        .then(gripper => {
          if (JSON.stringify(gripper) == JSON.stringify([]))
            this.dataGripper = {}
          else
            this.dataGripper = gripper;
        })
        .catch(error => {
          console.info("-------------")
          console.info(error);
        });

      fetch(dataStored.server + 'api/unit/show/robot', { method: 'GET' })
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json()
        })
        .then(robot => {
          this.dataRobot = robot[0];
        })
        .catch(error => {
          console.info("-------------")
          console.info(error);
        });
    },
    getStatus(status) {
      if (status==undefined) 
        return "NOT_DEFINED"

      switch (status) {
        case dataStored.status_working:
          if (this.dataRobot.DESCR != "" && this.dataRobot.DESCR != "0")
            return "EXECUTE : " + this.dataRobot.DESCR;
          else 
            return "EXECUTE"
          break;
        case dataStored.status_paused:
          return "PAUSED ";
          break;
        case dataStored.status_aborted:
          return "ABORTED ";
          break;
        case dataStored.status_remote:
          //dataStored.RobotInLocalMode = false;
          return "ROBOT PRONTO IN AUTOMATICO";
          break;
        case dataStored.status_local:
          //dataStored.RobotInLocalMode = true;  
          return "PRONTO per i COMANDI MANUALI";
          break;
        case dataStored.status_auto:
          return "MODE AUTO";
          break;
        case dataStored.status_manual:
          return "ROBOT NON IN AUTOMATICO"; //MANUAL MODE
          break;
        case dataStored.status_alarm:
          let ris = ""; 
          if (parseInt(this.dataRobot.DESCR) > 0) {
            ris += 'robot.alarm_' + this.dataRobot.DESCR;
          }else{
            ris="ALARM"
          }
          return ris;
          break;
        case dataStored.status_off:
          return 'unit.robot.off';
          break;
        case dataStored.status_hold:
          return "HOLD";
          break;
        default:
          return "NOT_DEFINED"
      }
      return "NOT_DEFINED"
    },
    getStatusGripper(status) {
      switch (status) {
        case dataStored.status_empty:
          return "EMPTY"
          break;
        case dataStored.status_finished:
          return "FINISH ";
          break;
        case dataStored.status_aborted:
          return "ABORTED ";
          break;
        case dataStored.status_raw:
          return "RAW";
          break;
      }
      return "NOT DEFINED "
    },
    getColorFromStatus() {
      if (this.dataRobot.STATUS == dataStored.status_manual)
        return 'manual'
      if (this.dataRobot.STATUS == dataStored.status_alarm ||
          this.dataRobot.STATUS == dataStored.status_notDef)
        return 'alarm'
      if (this.dataRobot.STATUS == dataStored.status_auto ||
          this.dataRobot.STATUS == dataStored.status_local ||
          this.dataRobot.STATUS == dataStored.status_remote)
        return 'auto'
      if (this.dataRobot.STATUS == dataStored.status_hold)
        return 'hold'
      if (this.dataRobot.STATUS == dataStored.status_working)
        return 'working'
      return 'normal'
    },
    sendToRobot(val) {
      dataStored.WS.socket.emit("TO_PLANT/CMD/ROBOT", val);
    },
    updateSpeed(val){
      //dataStored.robotSpeed = val;
      this.sendToRobot("100;"+val)
    },
    CMD_enabled(){
      if (dataStored.RobotInLocalMode &&
          this.dataRobot.STATUS!=dataStored.status_off &&
          (this.dataRobot.STATUS==dataStored.status_auto || 
           this.dataRobot.STATUS==dataStored.status_local)
         )
        dataStored.cmdActive = true;
      else
        dataStored.cmdActive = false;
    },
    Mission_enabled(){
      if (dataStored.RobotInLocalMode && 
          this.dataGripper[0].ID != null &&
          this.dataRobot.STATUS!=dataStored.status_off &&
          (this.dataRobot.STATUS==dataStored.status_auto || 
          this.dataRobot.STATUS==dataStored.status_local)
        )
        dataStored.cmdActiveMission = true;
      else
        dataStored.cmdActiveMission = false;
    }
  },
  mounted() {
    this.getRobotData();
    dataStored.WS.socket.on('ROBOT/STATUS', payload => {
      this.dataRobot.STATUS = parseInt(payload);
      this.CMD_enabled();
      this.Mission_enabled(); 
      if (payload == dataStored.status_alarm){
        dataStored.alert.title= 'ALARM';
        dataStored.alert.desc= "robot.alarm_"+payload
      }
      if (this.dataRobot.STATUS == dataStored.status_aborted ) {
        dataStored.alert.title = 'ALARM';
        dataStored.alert.desc = 'abort';
      }
    });
    dataStored.WS.socket.on('ROBOT/DESCR', payload => {
      this.dataRobot.DESCR = payload;
    });
    dataStored.WS.socket.on('ROBOT/UPDATEGRIPPER', () =>{
      this.getRobotData();
    });
    dataStored.WS.socket.on('ROBOT/CHANGESPEED', payload => {
      dataStored.robotSpeed = payload;
    })
  },
  unmounted() {
    //dataStored.WS.socket.off('ROBOT/STATUS');
    //dataStored.WS.socket.off('ROBOT/DESCR');
    //dataStored.WS.socket.off('ROBOT/UPDATEGRIPPER');
  }
}
</script>

<style scoped>
small {
  font-size: 0.8em;
}

h6 {
  margin-bottom: 3px;
}

/* Override .specialCMD (rosso) quando robot e' in stato HOLD: bg blu vivido
   + border accent + animazione blinker (definita in unit-views.css) per
   richiamare attenzione sul bottone CONTINUE. */
.button-hold {
  background: var(--color-info);
  border: 4px solid var(--accent);
  animation: blinker 1s linear infinite;
}

/* Speed selector: 5 bottoni preset 1/10/20/50/100%. Base scura distinguibile
   da action buttons; selezionato evidenziato via .active (accent solido). */
.speed-button {
  background: var(--bg-input);
  color: var(--text-primary);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  padding: var(--space-2);
  margin-top: var(--space-3);
  max-width: 62px;
  cursor: pointer;
  transition: filter var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
}

.speed-button:hover:not(.active) {
  filter: brightness(1.15);
}

.speed-button.active {
  background: var(--accent);
  border-color: var(--accent-hover);
  font-weight: var(--font-weight-semibold);
}
</style>
