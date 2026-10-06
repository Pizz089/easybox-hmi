<script setup>
    import { dataStored } from '../../data.js'
    // (v3 fase B) stato MC2 dallo store della shell (stessa fonte della
    // striscia), componenti v3
    import { plant } from '../../stores/plantStatus.js'
    import { statusKey, statusTone } from '../../util/unitStatus.js'
    import UiCard from '../../components/ui/UiCard.vue'
</script>

<template>
  <!-- (v3 fase B) Controlli · Macchina MC2, stesso schema di MC1. I due
       pulsanti della porta non avevano un comando collegato (nessun @click):
       restano visibili ma spenti, invece di sembrare comandi che fanno
       qualcosa. Lo stato e' lo STATUS di MC2 dalla striscia. -->
  <div class="ctl">
    <div class="ctl__col">
      <UiCard :label="$t('Stato')">
        <div class="ctl-state-title" :class="'ctl-tone--' + statusTone(plant.mc2)">
          <i class="ctl-dot" aria-hidden="true"></i><span>{{ $t(statusKey(plant.mc2)) }}</span>
        </div>
      </UiCard>

      <!-- attrezzatura sulla macchina (api fixture/showOnMC/2, poll 3 s) -->
      <UiCard :label="$t('machine.fixtureSection')">
        <template v-if="dataFixture.ID>0">
          <div class="ctl-value">{{ dataFixture.FAMILY }}</div>
          <div class="ctl-sub">
            <span v-if="(dataFixture.DESCR || '').trim().length">{{ dataFixture.DESCR }} · </span>ID {{ dataFixture.ID }}
          </div>
          <div class="ctl-sub">{{ $t('Stato') }}: {{ dataFixture.STATUS_DESC }}</div>
        </template>
        <div v-else class="ctl-value ctl-muted">{{ $t('machine.noFixture') }}</div>
      </UiCard>
    </div>

    <div class="ctl__col">
      <UiCard :label="$t('machine.cmdSection')">
        <div class="ctl-row">
          <span class="ctl-row__label">{{ $t('machine.door') }}</span>
          <div class="ctl-seg">
            <button type="button" class="ctl-seg__opt" disabled :title="$t('machine.notWired')">{{ $t('machine.open') }}</button>
            <button type="button" class="ctl-seg__opt" disabled :title="$t('machine.notWired')">{{ $t('machine.close') }}</button>
          </div>
          <small class="ctl-row__note">{{ $t('machine.notWired') }}</small>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script>
export default {
    data(){
        return {
          dataFixture:{},
            polling:true
        }
    },
    methods: {
        getGripperData() {
          fetch(dataStored.server+'api/conf/fixture/showOnMC/2',{ method: 'GET'})
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json()
            })
            .then(fx => {
                if (JSON.stringify(fx)==JSON.stringify([]))
                  this.dataFixture = {}
                else
                  this.dataFixture = fx[0];
            })
            .catch(error => {
                console.info("-------------")
                console.info(error);
            });
        },
    },
    mounted(){
        this.getGripperData()
        setInterval(() => {
            if(this.polling)
                this.getGripperData()
        }, 3000);
    },
    unmounted(){
        this.polling=false;
    }
  }
</script>
