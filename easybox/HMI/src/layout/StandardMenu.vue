<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

import sideMenu from '../components/menu.vue'
import barraInAlto from '../components/barraInAlto.vue'
import alert from '../components/Alerts/Alert.vue'
import { dataStored } from '@/data'

const { t } = useI18n()

// Handler nominati (equivalente composition-API del pattern this.<nome>Handler
// di robotView/units/productionTable, e4ab4e5): servono i riferimenti per
// l'off specifico in onUnmounted.
const plcAlarmRobotHandler = payload => {
  dataStored.alert.title = 'PLC_Error'
  dataStored.alert.desc = 'robot.alarm_' + payload
  dataStored.alert.type = 'warning'
}

// (AN 1-bis) precondizione ausiliari: stato globale in dataStored, un solo
// listener per tutto il pannello (StandardMenu e' sempre montato).
const safetyAuxHandler = v => {
  const n = parseInt(v, 10)
  if (Number.isInteger(n)) dataStored.safetyAux = n
}

// (fase B) ALARM/MC1 (es. 947: dichiarazione macchina rifiutata): toast
// globale con chiave i18n robot.alarm_<codice> (fallback codice grezzo)
const alarmMc1Handler = payload => {
  const code = parseInt(payload, 10)
  dataStored.alert.title = 'MC1'
  dataStored.alert.desc = Number.isInteger(code) && code > 0 ? 'robot.alarm_' + code : String(payload)
  dataStored.alert.type = 'warning'
}

const plcAlarmGenericHandler = payload => {
  dataStored.alert.title = 'GENERIC_ERROR'
  dataStored.alert.desc = payload
  dataStored.alert.type = 'warning'
}

// (oneshot-refresh, 3/9) rete di sicurezza GLOBALE per gli stati one-shot:
// StandardMenu e' sempre montato, quindi al primo mount e a OGNI riconnessione
// del socket si rigioca la cache (GRIPPER/REQUEST_SNAPSHOT risponde anche
// SAFETY/AUX e DECLARE) e si chiede il refresh 90 al PLC (PLC/REFRESH_REQUEST,
// throttle 5 s lato backend). Incidente del 3/9: AUX ricevuto 0 e mai piu'
// aggiornato (publish on-change perso) bloccava le missioni con Aux_OK vero
// nel PLC; l'unica uscita era il 90 a mano via mosquitto_pub.
const requestOneShotStates = () => {
  dataStored.WS.socket.emit('GRIPPER/REQUEST_SNAPSHOT')
  dataStored.WS.socket.emit('PLC/REFRESH_REQUEST')
}

onMounted(() => {
  if (dataStored.WS && dataStored.WS.socket) {
    dataStored.WS.socket.on('PLC/ALARM/ROBOT', plcAlarmRobotHandler)
    dataStored.WS.socket.on('PLC/ALARM/GENERIC', plcAlarmGenericHandler)
    dataStored.WS.socket.on('SAFETY/AUX', safetyAuxHandler)
    dataStored.WS.socket.on('ALARM/MC1', alarmMc1Handler)
    dataStored.WS.socket.on('connect', requestOneShotStates)
    requestOneShotStates()
  }
})

onUnmounted(() => {
  if (dataStored.WS && dataStored.WS.socket) {
    // off SPECIFICO (evento + callback): un off nudo staccherebbe anche
    // i listener di altri componenti sugli stessi eventi.
    dataStored.WS.socket.off('PLC/ALARM/ROBOT', plcAlarmRobotHandler)
    dataStored.WS.socket.off('PLC/ALARM/GENERIC', plcAlarmGenericHandler)
    dataStored.WS.socket.off('SAFETY/AUX', safetyAuxHandler)
    dataStored.WS.socket.off('ALARM/MC1', alarmMc1Handler)
    dataStored.WS.socket.off('connect', requestOneShotStates)
  }
})
</script>

<template>
  <sideMenu>
    <barraInAlto />

    <alert
      v-if="dataStored.alert && dataStored.alert.title"
      :title="dataStored.alert.title"
      :desc="dataStored.alert.desc"
      :type="dataStored.alert.type"
      @cmd_close="dataStored.emptyAlertList && dataStored.emptyAlertList()"
    />

    <slot />
  </sideMenu>
</template>

<style scoped>
</style>
