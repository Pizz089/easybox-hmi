<template>
    <div class="alert" :class="type"> <!--@click="$emit('cmd_close')"-->
        <span @click="$emit('cmd_close')" class="pure-u-1">
            <h3>{{ $t(title) }}</h3>
            <hr>
        </span>
        <br>
        <strong>{{ $t(desc) }}</strong>
        <br><br>
        <ul>
            <li v-for="chk in checks" :key="chk">{{ chk }}</li>
        </ul>
        <slot />

        <div class="close-container" @click.stop>
            <button class="close-button" @click="$emit('cmd_close')">
                <img src="@/assets/xRossa2.png" alt="Chiudi" class="close-icon" />
            </button>
        </div>
    </div>
</template>

<script>
import { dataStored } from '@/data';

export default {
    emits: ['cmd_close'],
    props: {
        title: String,
        desc: String,
        type: '',
        checks: []
    }
};
</script>

<style scoped>
/* Modale allarmi di impianto: rifatta a token (era coral/red/yellow pieni,
   con padding-bottom 400px refuso). VINCOLO: deve restare visivamente
   allarmante — bordo 2px danger, titolo danger marcato, glow sul tipo alarm.
   z-index 50000 invariato: sopra TUTTO, anche modali (2000). */
.alert {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: var(--space-5) var(--space-6) var(--space-6);
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 2px solid var(--color-danger);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  transition: all 0.5s ease-out;
  height: auto;
  max-height: 80vh;
  width: 90%;
  max-width: 1000px;
  z-index: 50000;
  overflow-y: auto;
}

.alert h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-danger);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.close-button {
  all: unset;
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;   /* touch minimo */
  min-height: 44px;
  border: 2px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: 0;
  background-color: var(--bg-surface-2);
}

.close-icon {
  width: 30px;
  height: 30px;
  display: block;
}

/* Tipi semantici (status, doc §6): l'alarm deve "gridare" da lontano
   come le status card — bg danger pieno di tinta + glow esterno. */
.alarm {
    background: var(--color-danger-bg);
    border-color: var(--color-danger);
    box-shadow: var(--elevation-3), 0 0 12px var(--color-danger);
}

.warning {
    background: var(--color-warning-bg);
    border-color: var(--color-warning);
}

.warning h3 {
    color: var(--color-warning);
}

.message {
    background: var(--color-success-bg);
    border-color: var(--color-success);
}

.message h3 {
    color: var(--color-success);
}
</style>