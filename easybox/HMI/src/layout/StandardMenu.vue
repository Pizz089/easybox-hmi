<script setup>
// (v3, 6/10) layout v1/v2: sidebar + barra in alto. Dal pannello v3 le
// rotte usano layout/v3/AppShell.vue; questo resta finche' i componenti
// vecchi non si tolgono (fase D). Gli handler globali sono in
// layout/plantGlobals.js, condivisi con AppShell: una copia sola.
import sideMenu from '../components/menu.vue'
import barraInAlto from '../components/barraInAlto.vue'
import alert from '../components/Alerts/Alert.vue'
import { dataStored } from '@/data'
import { usePlantGlobals } from './plantGlobals.js'

usePlantGlobals()
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
