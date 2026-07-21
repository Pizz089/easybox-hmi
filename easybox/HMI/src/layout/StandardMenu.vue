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

const plcAlarmGenericHandler = payload => {
  dataStored.alert.title = 'GENERIC_ERROR'
  dataStored.alert.desc = payload
  dataStored.alert.type = 'warning'
}

onMounted(() => {
  if (dataStored.WS && dataStored.WS.socket) {
    dataStored.WS.socket.on('PLC/ALARM/ROBOT', plcAlarmRobotHandler)
    dataStored.WS.socket.on('PLC/ALARM/GENERIC', plcAlarmGenericHandler)
    dataStored.WS.socket.on('SAFETY/AUX', safetyAuxHandler)
    // replay dalla cache backend (risponde anche SAFETY/AUX)
    dataStored.WS.socket.emit('GRIPPER/REQUEST_SNAPSHOT')
  }
})

onUnmounted(() => {
  if (dataStored.WS && dataStored.WS.socket) {
    // off SPECIFICO (evento + callback): un off nudo staccherebbe anche
    // i listener di altri componenti sugli stessi eventi.
    dataStored.WS.socket.off('PLC/ALARM/ROBOT', plcAlarmRobotHandler)
    dataStored.WS.socket.off('PLC/ALARM/GENERIC', plcAlarmGenericHandler)
    dataStored.WS.socket.off('SAFETY/AUX', safetyAuxHandler)
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
