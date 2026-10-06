<script setup>
  import { dataStored } from '../../data.js'
  import { sendToRobot } from '../../util/globalFunction.js';
  // (v3 fase B) stato col nome e il tono della striscia, componenti v3
  import { statusKey, statusTone } from '../../util/unitStatus.js'
  import UiCard from '../../components/ui/UiCard.vue'
  import UiTile from '../../components/ui/UiTile.vue'
  import UiButton from '../../components/ui/UiButton.vue'
  import { ArrowDownToLine, RotateCcw } from 'lucide-vue-next'
</script>

<template>
  <!-- (v3 fase B) Controlli · EasyBox, stesso schema della pagina Robot (non
       disegnata nelle tavole). A sinistra lo stato: STATUS della cassettiera
       (unit/show/SMALLBOX, stesso nome della striscia) con il cassetto non in
       posizione se c'e', e il cassetto fuori (EXTRACT). A destra i comandi:
       inserimento del cassetto e reset. Comandi e abilitazioni quelli di
       prima (tests/test_golden_equivalenza.mjs). -->
  <div class="ctl">
    <div class="ctl__col">
      <UiCard :label="$t('Stato')">
        <div class="ctl-state-title" :class="'ctl-tone--' + statusTone(status)">
          <i class="ctl-dot" aria-hidden="true"></i><span>{{ $t(statusKey(status)) }}</span>
        </div>
        <div class="ctl-sub" v-if="error>0 && error<999">{{$t('TRAY')}} #{{ error }} {{$t('tray.NOT_IN_POSITION')}}</div>
        <div class="ctl-sub" v-if="error==999">{{$t('menu.trays')}} {{$t('tray.NOT_IN_POSITION')}}</div>
      </UiCard>

      <UiCard :label="$t('smallbox.trayOut')">
        <div class="ctl-value" :class="{ 'ctl-muted': !(getTrayExtract()>0) }">
          {{getTrayExtract()>0? $t("tray.extract")+getTrayExtract(): $t("tray.no_extract")}}
        </div>
      </UiCard>
    </div>

    <div class="ctl__col">
      <!-- (AN 1-bis) precondizione ausiliari (vale per ogni vista con
           comandi missione): banner SOLO con AUX=0 -->
      <div class="aux-banner" v-if="dataStored.safetyAux === 0">
        {{ $t('robot.auxBanner') }}
      </div>

      <UiCard :label="$t('unit.MacroMission')">
        <div class="box-tiles">
          <UiTile :icon="ArrowDownToLine" :disabled="!cmdActiveMission"
            @click="cmdActiveMission?sendToRobot(26):''">
            <span>{{ $t('tray.INSERISCI_CASSETTO') }}<template v-if="getTrayExtract()>0"> n° {{ getTrayExtract() }}</template></span>
          </UiTile>
        </div>
      </UiCard>

      <!-- reset della cassettiera (99): nessuna conferma, come prima -->
      <section class="box-restore">
        <span class="box-restore__label">{{ $t('robot.section.restore') }}</span>
        <UiButton variant="danger" :icon="RotateCcw" @click="sendToBox(99)">
          {{ $t('smallbox.reset') }}
        </UiButton>
      </section>
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
            return 'manual'
          if (this.status == dataStored.status_alarm)
            return 'alarm'
          if (this.status == dataStored.status_auto ||
              this.status == dataStored.status_local ||
              this.status == dataStored.status_remote)
            return 'auto'
          if (this.status == dataStored.status_hold)
            return 'hold'
          if (this.status == dataStored.status_working)
            return 'working'
          return 'normal'
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
        // (oneshot-refresh, 3/9) stato BOX e AUX (banner ausiliari) sono
        // one-shot: replay dalla cache backend + refresh 90 (throttle 5 s
        // lato backend) al mount e a ogni riconnessione del socket.
        this.requestSnapshots = () => {
          dataStored.WS.socket.emit('UNIT/STATUS/REQUEST', 'BOX');
          dataStored.WS.socket.emit('PLC/REFRESH_REQUEST');
        };
        dataStored.WS.socket.on('connect', this.requestSnapshots);
        this.requestSnapshots();
        dataStored.WS.socket.on('BOX/STATUS', () =>{
          this.getTrayData()
          this.getStatus();
        });
        dataStored.WS.socket.on('BOX/DESCR', (desc) =>{
          this.getStatus();
        });
    },
    unmounted(){
        // off del solo handler nominato; i due listener BOX/* anonimi sopra
        // restano senza off (debito preesistente, censito in P3)
        dataStored.WS.socket.off('connect', this.requestSnapshots);
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
/* (v3 fase B) colonne, stato e segmenti da assets/css/controls-v3.css */
.box-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}
.box-tiles .ui-tile { min-height: 112px; }
.box-restore {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--card-padding);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}
.box-restore__label {
  flex: 1;
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  color: var(--text-muted);
}
@media (max-width: 1599px) {
  .box-tiles .ui-tile { min-height: 64px; flex-direction: row; align-items: center; justify-content: flex-start; padding: var(--space-2) var(--space-3); font-size: var(--font-size-sm); }
  .box-tiles :deep(.ui-tile__icon) { width: var(--icon-size-md); height: var(--icon-size-md); }
}
</style>
