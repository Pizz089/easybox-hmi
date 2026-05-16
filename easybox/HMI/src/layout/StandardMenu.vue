<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

import sideMenu from '../components/menu.vue'
import barraInAlto from '../components/barraInAlto.vue'
import alert from '../components/Alerts/Alert.vue'
import { dataStored } from '@/data'

const { t } = useI18n()

onMounted(() => {
  if (dataStored.WS && dataStored.WS.socket) {
    dataStored.WS.socket.on('PLC/ALARM/ROBOT', payload => {
      dataStored.alert.title = 'PLC_Error'
      dataStored.alert.desc = 'robot.alarm_' + payload
      dataStored.alert.type = 'warning'
    })

    dataStored.WS.socket.on('PLC/ALARM/GENERIC', payload => {
      dataStored.alert.title = 'GENERIC_ERROR'
      dataStored.alert.desc = payload
      dataStored.alert.type = 'warning'
    })
  }
})

onUnmounted(() => {
  if (dataStored.WS && dataStored.WS.socket) {
    // dataStored.WS.socket.off('PLC/ALARM/ROBOT')
    // dataStored.WS.socket.off('PLC/ALARM/GENERIC')
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
