<script setup>
  import { dataStored } from '../../data.js'
  // (collaudo) campo numerico condiviso a contratto "emette sempre numeri
  // interi clampati" (AL 2c) — per la scelta subpos nei comandi 31/32
  import numericField from '../../components/numericField.vue'
  // (machines-gating) destinazioni macchina dinamiche dalla configurazione
  import { MACHINE_POSITIONS } from '../../util/machineBrands'
</script>

<template>
  <div class="pure-u-1 unit-columns">
    <div class="pure-u-10-24">
      <h1 class="view-title">{{ $t('Stato') }} Robot </h1>
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
        </span>
        <h5 v-else> NO GRIPPER MOUNTED! </h5>

        <!-- (AN) coerenza pinza: tre fonti a confronto — sensore (FB8),
             sistema (registro PLC), magazzino (DB). Verde quando le fonti
             DISPONIBILI concordano; messaggio operatore esplicito quando no.
             Finche' il PLC non pubblica SENSOR/CODE la riga mostra "non
             disponibile" (muted, non warning). @click.stop: la card resta
             un link a /conf/grippers, l'indicatore no. -->
        <div class="coherence" @click.stop>
          <div class="coherence-head">
            <span>{{ $t('robot.coherence.title') }}</span>
            <span v-if="gripperCoherence.state=='ok'" class="badge badge-type">{{ $t('robot.coherence.ok') }}</span>
            <span v-else class="badge badge-anomaly">{{ $t('robot.coherence.mismatch') }}</span>
          </div>
          <div class="coherence-row">
            <span class="coh-label">{{ $t('robot.coherence.sensor') }}</span>
            <span v-if="gripperSensor===null" class="coh-na">{{ $t('robot.coherence.na') }}</span>
            <span v-else>{{ gripperSensor==1 ? $t('robot.coherence.mounted') : $t('robot.coherence.absent') }}</span>
          </div>
          <div class="coherence-row">
            <span class="coh-label">{{ $t('robot.coherence.system') }}</span>
            <span v-if="systemGripperId===null" class="coh-na">{{ $t('robot.coherence.na') }}</span>
            <span v-else>{{ systemGripperId>0 ? ($t('robot.coherence.mounted')+' (ID '+systemGripperId+')') : $t('robot.coherence.absent') }}</span>
          </div>
          <div class="coherence-row">
            <span class="coh-label">{{ $t('robot.coherence.warehouse') }}</span>
            <span>{{ gripperOnBoardNow() ? ($t('robot.coherence.mounted')+' (ID '+dataGripper[0].ID+')') : $t('robot.coherence.absent') }}</span>
          </div>
          <div v-if="gripperCoherence.state=='mismatch'" class="coherence-msg">
            {{ $t(gripperCoherence.msgKey) }}
          </div>
        </div>
      </div>

      
      <div class="pure-control-group speed-group">
        <label class="section-label" for="aligned-foo">ROBOT SPEED: </label>
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
        <!-- R2: slider 10..100 step 10 — il comando (updateSpeed, identico
             ai vecchi segmenti: "100;<val>", nessun gating come prima)
             parte SOLO al rilascio (change, mai input: niente flood).
             Il valore mostrato e' l'eco del PLC (ROBOT/CHANGESPEED). -->
        <!-- R2-2: display e input UNIFICATI, tutto su una riga: slider +
             input numerico (fuori editing mostra l'eco PLC, mai 0; al focus
             si edita, Enter/blur -> clamp 1..100 -> invio -> eco) + %. -->
        <div class="speed-control">
          <input type="range" class="speed-slider"
            min="10" max="100" step="10"
            :value="sliderSpeed"
            :disabled="!speedEnabled"
            @change="onSliderChange($event)" />
          <input type="number" class="speed-manual" inputmode="numeric"
            min="1" max="100" step="1"
            :value="speedEditing ? speedManual : displaySpeed"
            :disabled="!speedEnabled"
            @focus="startSpeedEdit"
            @input="speedManual = $event.target.value"
            @keyup.enter="$event.target.blur()"
            @blur="applyManualSpeed" />
          <span class="speed-unit">%</span>
        </div>
      </div>

    </div>
    <div class="pure-u-10-24">
      <h1 class="view-title">{{ $t('Comandi') }}</h1>

      <!-- (AN 1-bis) precondizione ausiliari: banner SOLO con AUX=0
           (con 1 o n/d niente — mai allarmi su dato mancante) -->
      <div class="aux-banner" v-if="dataStored.safetyAux === 0">
        {{ $t('robot.auxBanner') }}
      </div>

      <!-- ===== CARD 1: Comandi critici (RESET / HOLD-START / RESTART) ===== -->
      <section class="command-section">
        <h3 class="section-label">{{ $t('robot.section.critical') }}</h3>

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
        <h3 class="section-label">{{ $t('robot.section.movement') }}</h3>

        <!-- S: {'btn-mission-running': ...} = feedback missione in corso sul
             SOLO bottone che l'ha inviata; gating e comandi INVARIATI
             (sendMission marca la chiave e delega a sendToRobot). -->
        <button class="pure-u-1 button_pressed"
          :class="[dataStored.cmdActive==0? 'pure-button-disable' : 'pure-button-micromission', {'btn-mission-running': missionRunning=='home'}]"
          @click="dataStored.cmdActive==1?sendMission('home',20):''">
          {{ $t('HOME') }}
        </button>

        <button class="pure-u-1 button_pressed"
          :class="[dataStored.cmdActive==0? 'pure-button-disable' : 'pure-button-micromission', {'btn-mission-running': missionRunning=='maintenance'}]"
          @click="dataStored.cmdActive==1?sendMission('maintenance',21):''">
          {{ $t('MAINTENANCE') }}
        </button>

        <!-- (fase B) Reimposta stato cella: dichiarazione manuale 35 dopo
             un'emergenza, a homing completato. Gate = idle (HOLD) come gli
             altri comandi manuali della card. -->
        <button class="pure-u-1 button_pressed"
          :class="[dataStored.cmdActive==0? 'pure-button-disable' : 'pure-button-micromission']"
          @click="dataStored.cmdActive==1?openDeclDialog():''">
          {{ $t('robot.decl.button') }}
        </button>

        <h4 class="section-label">{{ $t('robot.section.destination') }}</h4>
        <div class="pure-g dest-grid">
          <div class="pure-u-1-3">
            <button style="width:100%" class="button_pressed"
              :class="[dataStored.cmdActive==0? 'pure-button-disable' : 'pure-button-micromission', {'btn-mission-running': missionRunning=='dest-easybox'}]"
              @click="dataStored.cmdActive==1?sendMission('dest-easybox','15;1'):''">
              {{ $t('Easybox') }}
            </button>
          </div>
          <!-- (machines-gating) destinazioni macchina DINAMICHE dalla
               configurazione (contratto 15;(10+n)): con una sola macchina
               resta il solo bottone MC1, mai bottoni per macchine fantasma -->
          <div class="pure-u-1-3" v-for="pos in MACHINE_POSITIONS" :key="pos.mc">
            <button style="width:100%" class="button_pressed"
              :class="[dataStored.cmdActive==0? 'pure-button-disable' : 'pure-button-micromission', {'btn-mission-running': missionRunning=='dest-'+pos.mc.toLowerCase()}]"
              @click="dataStored.cmdActive==1?sendMission('dest-'+pos.mc.toLowerCase(),'15;'+(10+pos.n)):''">
              {{ $t(pos.labelKey) }}
            </button>
          </div>
        </div>
      </section>

      <!-- ===== CARD 3: Missioni (SCARICA/CARICA PINZA + CARICA/SCARICA PALLET) ===== -->
      <section class="command-section">
        <h3 class="section-label">{{ $t('robot.section.mission') }}</h3>

        <!-- M: bottone unico a label FISSA (pattern anti-race: bottone neutro
             + dialog esplicito). NON invia mai direttamente: apre il dialog
             del ramo valido — carico (11) se nessuna pinza a bordo, conferma
             scarico (12) se pinza a bordo. Gate = gripperBranchEnabled
             (computed, unica fonte di verita' per classe e click). -->
        <button class="pure-u-1 button_pressed"
          :class="[gripperBranchEnabled? 'pure-button-mission' : 'pure-button-disable', {'btn-mission-running': missionRunning=='gripper'}]"
          @click="gripperBranchEnabled?openGripperMission():''">
          {{ $t('robot.mission.gripper') }}
        </button>
        <!-- (AN) mai bottoni muti: motivo visibile quando disabilitato -->
        <small class="cmd-hint" v-if="!gripperBranchEnabled && gripperDisabledReason">{{ $t(gripperDisabledReason) }}</small>

        <!-- M-PALLET(B): bottone unico a label FISSA. NON invia mai
             direttamente: apre palletLoad (13) se la pinza pallet e' VUOTA
             (STATUS==status_empty, stessa discriminazione di PalletsView) o
             palletUnload (14) se c'e' un oggetto in pinza.
             Gate = palletBranchEnabled (unica fonte per classe e click). -->
        <button class="pure-u-1 button_pressed"
          :class="[palletBranchEnabled? 'pure-button-mission' : 'pure-button-disable', {'btn-mission-running': missionRunning=='pallet'}]"
          @click="palletBranchEnabled?openPalletMission():''">
          {{ $t('robot.mission.pallet') }}
        </button>
        <small class="cmd-hint" v-if="!palletBranchEnabled && palletDisabledReason">{{ $t(palletDisabledReason) }}</small>

        <!-- M2: bottone unico a label FISSA per i cassetti. NON invia mai
             direttamente: apre il dialog del ramo corrente — estrazione (25)
             se nessun cassetto estratto, rilascio (26) se EXTRACT==1.
             Gate = trayBranchEnabled (unica fonte per classe e click);
             manovra in corso (EXTRACT 1000/2000) => disabilitato. -->
        <button class="pure-u-1 button_pressed"
          :class="[trayBranchEnabled? 'pure-button-mission' : 'pure-button-disable', {'btn-mission-running': missionRunning=='tray'}]"
          @click="trayBranchEnabled?openTrayMission():''">
          {{ $t('robot.mission.tray') }}
        </button>
        <small class="cmd-hint" v-if="!trayBranchEnabled && trayDisabledReason">{{ $t(trayDisabledReason) }}</small>

        <!-- Dialog scelta elemento missione: nessuna preselezione, la conferma
             si attiva solo con una voce selezionata esplicitamente. -->
        <div v-if="dialog.type!=''" class="mission-dialog-overlay">
          <div class="mission-dialog">
            <h3 class="command-section-title">{{ $t(dialogTitle) }}</h3>

            <!-- M2 (aggiunta SOLO informativa, autorizzata): QUALE cassetto
                 si sta rilasciando -->
            <div class="unload-info" v-if="dialog.type=='trayRelease' && extractedTray">
              {{ $t('robot.dialog.tray') }} {{ extractedTray.FLOOR_MAG }}
              <span v-if="(extractedTray.DESCR || '').trim()"> - {{ extractedTray.DESCR.trim() }}</span>
            </div>

            <!-- trayRelease: dialog di sola conferma, nessun elenco -->
            <div class="mission-dialog-list" v-if="dialog.type!='trayRelease'">
              <div v-if="dialogItems.length==0" class="mission-dialog-empty">
                {{ $t('robot.dialog.empty') }}
              </div>
              <button v-for="item in dialogItems" :key="item.ID"
                class="mission-dialog-item"
                :class="{ selected: dialog.selected!=null && dialog.selected.ID==item.ID }"
                @click="dialog.selected=item">
                <span v-if="dialog.type=='tray'">{{ $t('robot.dialog.tray') }} {{ item.FLOOR_MAG }}</span>
                <span v-else>{{ (item.FAMILY || '').trim() }}</span>
                <span v-if="dialog.type=='gripper'">{{ $t('robot.dialog.slot') }} {{ item.SUB_POS }}</span>
                <span v-else-if="dialog.type=='tray'">{{ (item.DESCR || '').trim() }}</span>
                <span v-else>{{ $t('robot.dialog.position') }} {{ item.MAG_POS }}</span>
              </button>
            </div>

            <div class="pure-g">
              <div class="pure-u-1-2">
                <button style="width:100%" class="button_pressed"
                  :class="[!dialogConfirmEnabled? 'pure-button-disable' : 'pure-button-mission']"
                  @click="dialogConfirmEnabled?confirmDialog():''">
                  {{ $t('robot.dialog.confirm') }}
                </button>
              </div>
              <div class="pure-u-1-2">
                <button style="width:100%" class="btn-ghost" @click="closeDialog()">
                  {{ $t('robot.dialog.cancel') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- M: NUOVO dialog conferma SCARICO pinza (cmd 12) — prima partiva a
             tap singolo. Blocco separato: i 5 dialog esistenti sopra restano
             intatti. Mostra ESPLICITAMENTE quale pinza verra' scaricata. -->
        <div v-if="unloadOpen" class="mission-dialog-overlay">
          <div class="mission-dialog">
            <h3 class="command-section-title">{{ $t('robot.dialog.unloadGripper') }}</h3>

            <div class="unload-info" v-if="dataGripper && dataGripper[0]">
              {{ (dataGripper[0].FAMILY || '').trim() }}
              {{ (dataGripper[0].DESCR || '').trim() }}
              (ID {{ dataGripper[0].ID }})
            </div>

            <!-- M4: "Deposita e cambia" a selezione ANTICIPATA — apre prima
                 la scelta della pinza target (modalita' swap del dialog di
                 carico); la conferma li' registra il target, invia il 12 e,
                 a deposito confermato (pinza scesa + HOLD), riapre il dialog
                 di carico col target preselezionato. L'11 lo conferma sempre
                 l'operatore, mai auto-invio. -->
            <button class="pure-u-1 button_pressed pure-button-mission"
              @click="startSwapSelection()">
              {{ $t('robot.dialog.unloadAndSwap') }}
            </button>

            <div class="pure-g">
              <div class="pure-u-1-2">
                <button style="width:100%" class="button_pressed pure-button-mission"
                  @click="confirmUnload()">
                  {{ $t('robot.dialog.confirm') }}
                </button>
              </div>
              <div class="pure-u-1-2">
                <button style="width:100%" class="btn-ghost" @click="unloadOpen=false">
                  {{ $t('robot.dialog.cancel') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== CARD 4: Collaudo missioni singole (comandi manuali PLC) =====
           Stesso pattern della CARD 3: bottone a label FISSA che NON invia mai
           direttamente (apre un dialog di conferma), gate = computed unica
           fonte per classe e click, hint del motivo quando disabilitato.
           Contratto comandi: stringhe "CMD;p1;p2" su TO_PLANT/CMD/ROBOT. -->
      <section class="command-section">
        <h3 class="section-label">{{ $t('robot.section.test') }}</h3>

        <!-- 31;subpos;gripperID — richiede cassetto estratto (PLC: 20001) -->
        <button class="pure-u-1 button_pressed"
          :class="[testTrayEnabled? 'pure-button-mission' : 'pure-button-disable', {'btn-mission-running': missionRunning=='test-pickTray'}]"
          @click="testTrayEnabled?openTestDialog('pickTray'):''">
          {{ $t('robot.test.pickTray') }}
        </button>
        <small class="cmd-hint" v-if="!testTrayEnabled && testTrayDisabledReason">{{ $t(testTrayDisabledReason) }}</small>

        <!-- 32;subpos (0 = prima posizione vuota) — richiede cassetto estratto -->
        <button class="pure-u-1 button_pressed"
          :class="[testTrayEnabled? 'pure-button-mission' : 'pure-button-disable', {'btn-mission-running': missionRunning=='test-placeTray'}]"
          @click="testTrayEnabled?openTestDialog('placeTray'):''">
          {{ $t('robot.test.placeTray') }}
        </button>
        <small class="cmd-hint" v-if="!testTrayEnabled && testTrayDisabledReason">{{ $t(testTrayDisabledReason) }}</small>

        <!-- 33;gripperID -->
        <button class="pure-u-1 button_pressed"
          :class="[testBaseEnabled? 'pure-button-mission' : 'pure-button-disable', {'btn-mission-running': missionRunning=='test-pickMC'}]"
          @click="testBaseEnabled?openTestDialog('pickMC'):''">
          {{ $t('robot.test.pickMC') }}
        </button>
        <small class="cmd-hint" v-if="!testBaseEnabled && testBaseDisabledReason">{{ $t(testBaseDisabledReason) }}</small>

        <!-- 34 — conferma semplice -->
        <button class="pure-u-1 button_pressed"
          :class="[testBaseEnabled? 'pure-button-mission' : 'pure-button-disable', {'btn-mission-running': missionRunning=='test-placeMC'}]"
          @click="testBaseEnabled?openTestDialog('placeMC'):''">
          {{ $t('robot.test.placeMC') }}
        </button>
        <small class="cmd-hint" v-if="!testBaseEnabled && testBaseDisabledReason">{{ $t(testBaseDisabledReason) }}</small>

        <!-- 13;3;palletID;0 / 14;3;palletID;0 — riusano il dialog generico
             (scelta pallet dalla lista esistente), posizione fissa 0 = MC1 -->
        <button class="pure-u-1 button_pressed"
          :class="[testBaseEnabled? 'pure-button-mission' : 'pure-button-disable', {'btn-mission-running': missionRunning=='test-palletPickMC'}]"
          @click="testBaseEnabled?openDialog('palletPickMC'):''">
          {{ $t('robot.test.palletPickMC') }}
        </button>
        <small class="cmd-hint" v-if="!testBaseEnabled && testBaseDisabledReason">{{ $t(testBaseDisabledReason) }}</small>

        <button class="pure-u-1 button_pressed"
          :class="[testBaseEnabled? 'pure-button-mission' : 'pure-button-disable', {'btn-mission-running': missionRunning=='test-palletPlaceMC'}]"
          @click="testBaseEnabled?openDialog('palletPlaceMC'):''">
          {{ $t('robot.test.palletPlaceMC') }}
        </button>
        <small class="cmd-hint" v-if="!testBaseEnabled && testBaseDisabledReason">{{ $t(testBaseDisabledReason) }}</small>

        <!-- Dialog di collaudo (pezzo cassetto/MC1): subpos e/o scelta pinza.
             TERZO overlay: entra nell'invariante "un solo overlay" (fix
             mutual-exclusion) via openTestDialog/openDialog/openGripperMission. -->
        <div v-if="testDialog.type!=''" class="mission-dialog-overlay">
          <div class="mission-dialog">
            <h3 class="command-section-title">{{ $t(testDialogTitle) }}</h3>

            <!-- posizione nel cassetto (31: min 1; 32: min 0 = prima vuota) -->
            <div class="test-field" v-if="testDialog.type=='pickTray' || testDialog.type=='placeTray'">
              <div class="test-field-label">{{ $t('robot.test.subpos') }}</div>
              <numericField
                name="subpos"
                step=1
                :min="testDialog.type=='pickTray' ? '1' : '0'"
                max=999
                :model-value="testDialog.subpos"
                integerVal=true
                @update="v => testDialog.subpos = v">
              </numericField>
              <small class="cmd-hint" v-if="testDialog.type=='placeTray'">{{ $t('robot.test.subposZeroHint') }}</small>
            </div>

            <!-- scelta pinza (31/33): default "a bordo" (0); disabilitata se
                 nessuna pinza risulta a bordo (il PLC risponderebbe 22) -->
            <div class="test-field" v-if="testDialog.type=='pickTray' || testDialog.type=='pickMC'">
              <div class="test-field-label">{{ $t('robot.test.gripperChoice') }}</div>
              <div class="mission-dialog-list">
                <button class="mission-dialog-item"
                  :class="{ selected: testDialog.gripperSel===0 }"
                  :disabled="!gripperOnBoardNow()"
                  @click="gripperOnBoardNow() ? testDialog.gripperSel=0 : ''">
                  <span>{{ $t('robot.test.gripperOnBoard') }}</span>
                  <span v-if="gripperOnBoardNow()">(ID {{ dataGripper[0].ID }})</span>
                  <span v-else class="coh-na">{{ $t('robot.hint.noGripperSystem') }}</span>
                </button>
                <button v-for="g in grippersList" :key="g.ID"
                  class="mission-dialog-item"
                  :class="{ selected: testDialog.gripperSel===g.ID }"
                  @click="testDialog.gripperSel=g.ID">
                  <span>{{ (g.FAMILY || '').trim() }}</span>
                  <span>{{ $t('robot.dialog.slot') }} {{ g.SUB_POS }} (ID {{ g.ID }})</span>
                </button>
              </div>
            </div>

            <!-- 34: conferma semplice -->
            <div class="unload-info" v-if="testDialog.type=='placeMC'">
              {{ $t('robot.test.confirmPlaceMC') }}
            </div>

            <div class="pure-g">
              <div class="pure-u-1-2">
                <button style="width:100%" class="button_pressed"
                  :class="[!testConfirmEnabled? 'pure-button-disable' : 'pure-button-mission']"
                  @click="testConfirmEnabled?confirmTestDialog():''">
                  {{ $t('robot.dialog.confirm') }}
                </button>
              </div>
              <div class="pure-u-1-2">
                <button style="width:100%" class="btn-ghost" @click="closeTestDialog()">
                  {{ $t('robot.dialog.cancel') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- (fase B) dialog "Reimposta stato cella": dichiarazione 35.
             Stato mostrato SOLO dai sensori/echi PLC (mai optimistic).
             Entra nell'invariante un-solo-overlay. -->
        <div v-if="declDialog.open" class="mission-dialog-overlay">
          <div class="mission-dialog">
            <h3 class="command-section-title">{{ $t('robot.decl.title') }}</h3>
            <div class="unload-info">{{ $t('robot.decl.hint') }}</div>

            <!-- sensori LIVE (FROM_PLANT/GRIPPER/MOUNTED e /CLOSED1) -->
            <div class="coherence-row">
              <span class="coh-label">{{ $t('robot.decl.mounted') }}</span>
              <span v-if="gripperMounted===null" class="coh-na">{{ $t('robot.coherence.na') }}</span>
              <span v-else>{{ gripperMounted==1 ? $t('robot.coherence.mounted') : $t('robot.coherence.absent') }}</span>
            </div>
            <div class="coherence-row">
              <span class="coh-label">{{ $t('robot.decl.closed1') }}</span>
              <span v-if="gripperClosed1===null" class="coh-na">{{ $t('robot.coherence.na') }}</span>
              <span v-else>{{ gripperClosed1==1 ? $t('robot.decl.closed') : $t('robot.decl.open') }}</span>
            </div>

            <!-- STEP 1: sensori -> flangia nuda o avanti -->
            <template v-if="declDialog.step==1">
              <div class="unload-info" v-if="gripperMounted===0">{{ $t('robot.decl.bareHint') }}</div>
              <div class="pure-g">
                <div class="pure-u-1-3" v-if="gripperMounted===0">
                  <button style="width:100%" class="button_pressed pure-button-mission"
                    :disabled="declDialog.waiting" @click="declareBare()">
                    {{ $t('robot.decl.declareBare') }}
                  </button>
                </div>
                <div class="pure-u-1-3" v-if="gripperMounted===1">
                  <button style="width:100%" class="button_pressed pure-button-mission" @click="declDialog.step=2">
                    {{ $t('tray.teach.next') }}
                  </button>
                </div>
                <div class="pure-u-1-3">
                  <button style="width:100%" class="btn-ghost" @click="closeDeclDialog()">
                    {{ $t('robot.dialog.cancel') }}
                  </button>
                </div>
              </div>
            </template>

            <!-- STEP 2: pinza + contenuti lati -->
            <template v-if="declDialog.step==2">
              <div class="decl-field">
                <label>{{ $t('robot.decl.gripper') }}</label>
                <select v-model.number="declDialog.gripperSel" class="decl-select">
                  <option :value="0">-</option>
                  <option v-for="g in declGrippers" :key="g.ID" :value="g.ID">
                    #{{ g.ID }} {{ (g.FAMILY || '').trim() }}
                  </option>
                </select>
              </div>
              <div class="decl-field">
                <label>{{ $t('robot.decl.side1') }}</label>
                <!-- regola RATIFICATA: chele aperte (CLOSED1=0) = contenuto
                     FORZATO a vuoto, sola lettura -->
                <span v-if="gripperClosed1===0" class="coh-na">{{ $t('robot.decl.forcedEmpty') }}</span>
                <template v-else>
                  <select v-model.number="declDialog.cont1" class="decl-select">
                    <option :value="0">{{ $t('status.empty') }}</option>
                    <option :value="1">{{ $t('status.raw') }}</option>
                    <option :value="2">{{ $t('status.finished') }}</option>
                    <option :value="3">{{ $t('robot.decl.contPallet') }}</option>
                  </select>
                  <select v-if="declDialog.cont1==3" v-model.number="declDialog.id1" class="decl-select">
                    <option :value="0">-</option>
                    <option v-for="p in palletsList" :key="'d1'+p.ID" :value="p.ID">#{{ p.ID }} {{ (p.FAMILY || '').trim() }}</option>
                  </select>
                </template>
              </div>
              <div class="decl-field">
                <label>{{ $t('robot.decl.side2') }}</label>
                <!-- nessun sensore lato 2: scelta libera, la validazione
                     lato-inesistente la fa il PLC (errore 944) -->
                <select v-model.number="declDialog.cont2" class="decl-select">
                  <option :value="0">{{ $t('status.empty') }}</option>
                  <option :value="1">{{ $t('status.raw') }}</option>
                  <option :value="2">{{ $t('status.finished') }}</option>
                  <option :value="3">{{ $t('robot.decl.contPallet') }}</option>
                </select>
                <select v-if="declDialog.cont2==3" v-model.number="declDialog.id2" class="decl-select">
                  <option :value="0">-</option>
                  <option v-for="p in palletsList" :key="'d2'+p.ID" :value="p.ID">#{{ p.ID }} {{ (p.FAMILY || '').trim() }}</option>
                </select>
              </div>
              <div class="pure-g">
                <div class="pure-u-1-3">
                  <button style="width:100%" class="btn-ghost" @click="declDialog.step=1">
                    {{ $t('tray.teach.back') }}
                  </button>
                </div>
                <div class="pure-u-1-3">
                  <button style="width:100%" class="button_pressed"
                    :class="[!(declDialog.gripperSel>0) || declDialog.waiting ? 'pure-button-disable' : 'pure-button-mission']"
                    @click="(declDialog.gripperSel>0 && !declDialog.waiting) ? sendDeclare() : ''">
                    {{ $t('robot.decl.send') }}
                  </button>
                </div>
                <div class="pure-u-1-3">
                  <button style="width:100%" class="btn-ghost" @click="closeDeclDialog()">
                    {{ $t('robot.dialog.cancel') }}
                  </button>
                </div>
              </div>
            </template>

            <small class="cmd-hint" v-if="declDialog.waiting">{{ $t('robot.decl.waiting') }}</small>
          </div>
        </div>
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
      polling: true,
      //robotSpeed: ''
      grippersList: [],   // pinze a magazzino per il dialog CARICA PINZA
      palletsList: [],    // pallet per i dialog CARICA/SCARICA PALLET
      traysList: [],      // cassetti a magazzino per il dialog ESTRAI CASSETTO
      dialog: {
        type: '',         // '' | 'gripper' | 'palletLoad' | 'palletUnload' | 'tray' | 'trayRelease'
        selected: null    // riga selezionata; nessuna preselezione
      },
      unloadOpen: false,  // M: dialog conferma scarico pinza (blocco separato)
      // M2: stato estrazione cassetti (colonna TRAY.EXTRACT, appendice audit):
      // extractedTray = riga con EXTRACT==1 (conferma PLC) o null;
      // trayBusy = manovra in corso (EXTRACT 1000 richiesta estrazione /
      // 2000 richiesta rilascio). A freddo: null/false -> ramo estrazione.
      extractedTray: null,
      trayBusy: false,
      // M4/AO: swap pinza a selezione ANTICIPATA — "Deposita e cambia" apre
      // prima il dialog di selezione in modalita' swap (swapSelecting); alla
      // conferma parte un SOLO comando nativo 27;<id> e il PLC orchestra il
      // secondo tempo (deposito->prelievo->TCP, missione robot 30 interna).
      // Nessuno stato client di attesa: swapSelecting basta a instradare il
      // gating del dialog e il testo del titolo.
      swapSelecting: false,
      // (collaudo) dialog dei comandi manuali di collaudo missioni singole.
      // type: '' | 'pickTray'(31) | 'placeTray'(32) | 'pickMC'(33) | 'placeMC'(34)
      // subpos: posizione nel cassetto (31: >=1; 32: 0 = prima posizione vuota)
      // gripperSel: 0 = pinza a bordo, >0 = ID pinza a magazzino, null = non scelta
      testDialog: {
        type: '',
        subpos: 1,
        gripperSel: null
      },
      // (fase B) dialog "Reimposta stato cella" (35): sensori LIVE + scelta
      // pinza/contenuti; waiting = in attesa dell'eco DECLARE/ROBOT
      declDialog: {
        open: false,
        step: 1,
        gripperSel: 0,
        cont1: 0, id1: 0,
        cont2: 0, id2: 0,
        waiting: false
      },
      declGrippers: [],        // anagrafica COMPLETA (inclusa l'eventuale a bordo)
      declTimer: null,
      gripperMounted: null,    // FROM_PLANT/GRIPPER/MOUNTED (0/1, null = mai visto)
      gripperClosed1: null,    // FROM_PLANT/GRIPPER/CLOSED1
      // R2-2: editing dell'input velocita' — col flag attivo l'eco PLC non
      // sovrascrive mentre si digita, e l'Enter (che fa blur) non produce
      // un secondo invio.
      speedManual: '',
      speedEditing: false,
      // S: feedback "missione in corso" — chiave del bottone che ha inviato
      // la missione (una sola alla volta) + macchinetta a 3 fasi:
      // 'armed' all'invio (STATUS ancora HOLD) -> 'active' quando STATUS
      // ESCE da HOLD -> spenta quando STATUS RIENTRA in HOLD. Mai spegnere
      // sul semplice STATUS==17: subito dopo l'invio e' ancora 17.
      // (AN) stato pinza a tre fonti: null = mai ricevuto ("non disponibile")
      gripperSensor: null,      // FROM_PLANT/GRIPPER/SENSOR (0/1, FB8)
      gripperCode: null,        // FROM_PLANT/GRIPPER/CODE (IW534 filtrato)
      gripperRegistered: null,  // FROM_PLANT/GRIPPER/ROBOT (ID dichiarato PLC)
      missionRunning: '',     // '' | 'gripper'|'pallet'|'tray'|'home'|'maintenance'|'dest-easybox'|'dest-mc1'|'dest-mc2'
      missionPhase: '',       // '' | 'armed' | 'active'
      missionArmTimer: null,  // ~5s: STATUS mai uscito da HOLD -> missione rifiutata
      missionMaxTimer: null   // 180s: timeout assoluto di sicurezza
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
    // S: unico punto di accensione del feedback missione — il comando resta
    // IDENTICO (passa da sendToRobot), qui si marca solo QUALE bottone e'
    // in corso. RESET/HOLD/RESTART e speed (100) NON passano da qui.
    sendMission(key, val) {
      this.startMission(key);
      this.sendToRobot(val);
    },
    startMission(key) {
      this.clearMission();          // una sola missione in corso alla volta
      this.missionRunning = key;
      this.missionPhase = 'armed';
      // uscita di sicurezza 1: STATUS non esce da HOLD entro ~5s
      // (missione rifiutata dal PLC) -> spegni
      this.missionArmTimer = setTimeout(() => {
        if (this.missionPhase == 'armed') this.clearMission();
      }, 5000);
      // uscita di sicurezza 2: timeout assoluto (missione fisica lunga
      // ma non infinita; oltre, il feedback non e' piu' affidabile)
      this.missionMaxTimer = setTimeout(() => { this.clearMission(); }, 180000);
    },
    clearMission() {
      clearTimeout(this.missionArmTimer);
      clearTimeout(this.missionMaxTimer);
      this.missionArmTimer = null;
      this.missionMaxTimer = null;
      this.missionRunning = '';
      this.missionPhase = '';
    },
    // S: macchinetta a 3 fasi, SOLO osservazione dello STATUS gia' in casa
    // (watcher esistente su dataRobot.STATUS): armed -> active quando
    // STATUS esce da HOLD, spenta quando rientra in HOLD.
    checkMissionPhase() {
      if (!this.missionRunning) return;
      const s = this.dataRobot.STATUS;
      // uscita di sicurezza 3: allarme o stato Sconosciuto -> spegni
      if (s == dataStored.status_alarm || s == dataStored.status_notDef) {
        this.clearMission();
        return;
      }
      if (this.missionPhase == 'armed' && s != dataStored.status_hold) {
        // il robot e' partito: da qui lo spegnimento e' il rientro in HOLD
        this.missionPhase = 'active';
        clearTimeout(this.missionArmTimer);
        this.missionArmTimer = null;
      } else if (this.missionPhase == 'active' && s == dataStored.status_hold) {
        this.clearMission();
      }
    },
    updateSpeed(val){
      //dataStored.robotSpeed = val;
      this.sendToRobot("100;"+val)
    },
    // R2-2: slider con snap-back — la posizione e' SEMPRE l'eco PLC: il
    // DOM viene riportato subito a sliderSpeed, se il comando produce eco
    // (CHANGESPEED) lo slider si sposta, altrimenti resta dov'era.
    onSliderChange(e){
      const v = parseInt(e.target.value);
      e.target.value = this.sliderSpeed;
      this.updateSpeed(v);
    },
    // R2-2: entra in editing precompilando col valore corrente.
    startSpeedEdit(){
      this.speedEditing = true;
      this.speedManual = String(this.displaySpeed);
    },
    // R2-2: unico punto di invio (l'Enter fa blur -> passa da qui una
    // volta sola). Clamp intero 1..100; invio solo se diverso dall'eco
    // corrente (un focus+blur accidentale non rimanda il comando).
    applyManualSpeed(){
      if (!this.speedEditing) return;
      this.speedEditing = false;
      const v = parseInt(this.speedManual);
      this.speedManual = '';
      if (isNaN(v)) return;
      const clamped = Math.min(100, Math.max(1, v));
      if (clamped == this.displaySpeed) return;
      this.updateSpeed(clamped);
    },
    CMD_enabled(){
      dataStored.cmdActive = (this.dataRobot.STATUS == dataStored.status_hold);
    },
    Mission_enabled(){
      // accesso sicuro: dataGripper puo' essere {} (nessuna pinza a bordo)
      const inHold = this.dataRobot.STATUS == dataStored.status_hold;
      const gripperOnBoard = !!(this.dataGripper && this.dataGripper[0] &&
                                this.dataGripper[0].ID != null);
      dataStored.cmdActiveMission = inHold && gripperOnBoard;   // SCARICA PINZA + cassetti
      dataStored.cmdActiveLoad    = inHold && !gripperOnBoard;  // CARICA PINZA
      dataStored.cmdActivePallet  = inHold && gripperOnBoard;   // CARICA/SCARICA PALLET
    },
    getGrippersList() {
      // M4: ritorna la promise (additivo) per la preselezione post-deposito
      return fetch(dataStored.server + 'api/conf/gripper/show/all', { method: 'GET' })
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json()
        })
        .then(grippers => {
          // escludo la pinza gia' a bordo robot (POS_PLANT 1000)
          this.grippersList = grippers.filter(g => g.POS_PLANT != 1000);
        })
        .catch(error => {
          console.info("-------------")
          console.info(error);
          this.grippersList = [];
        });
    },
    getPalletsList() {
      fetch(dataStored.server + 'api/conf/pallet/show/all', { method: 'GET' })
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json()
        })
        .then(pallets => {
          this.palletsList = pallets;
        })
        .catch(error => {
          console.info("-------------")
          console.info(error);
          this.palletsList = [];
        });
    },
    getTraysList() {
      fetch(dataStored.server + 'api/conf/tray/show/all', { method: 'GET' })
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json()
        })
        .then(trays => {
          // I 12 cassetti fisici del magazzino: uno per FLOOR_MAG 1..12 (il PLC
          // movimenta per POSIZIONE, non per contenuto). Range 1..12 (prima 1..11:
          // il piano 12 non compariva mai) + dedup per FLOOR_MAG tenendo la PRIMA
          // occorrenza (rete di sicurezza contro doppioni residui a DB, come quello
          // rimosso sul piano 8) + ordine piano CRESCENTE. La sorgente (vista TRAYS)
          // e' gia' una riga per cassetto: i pezzi contenuti sono conteggi
          // (N_PLACE/N_RAW/...), non righe, quindi non entrano come voci.
          this.traysList = trays
            .filter(t => t.FLOOR_MAG >= 1 && t.FLOOR_MAG <= 12)
            .filter((t, i, a) => a.findIndex(x => x.FLOOR_MAG == t.FLOOR_MAG) === i)
            .sort((a, b) => a.FLOOR_MAG - b.FLOOR_MAG);
          // M2: stato estrazione dalla stessa risposta (nessun fetch in piu').
          // Resta derivato dal grezzo (NON da traysList), ma con lo STESSO vincolo
          // di range 1..12: una riga spuria/fuori range/duplicata con EXTRACT==1
          // non deve leggersi come "cassetto estratto" (disallineo pannello<->PLC,
          // e' il bug vissuto sul cassetto 8).
          this.extractedTray = trays.find(t => t.EXTRACT == 1 && t.FLOOR_MAG >= 1 && t.FLOOR_MAG <= 12) || null;
          this.trayBusy = trays.some(t => t.EXTRACT == 1000 || t.EXTRACT == 2000);
        })
        .catch(error => {
          console.info("-------------")
          console.info(error);
          this.traysList = [];
        });
    },
    openDialog(type) {
      // (fix) esclusione reciproca dei due overlay: aprendo un dialog missione
      // azzero l'eventuale conferma scarico pinza rimasta armata. Senza questo,
      // un tap ravvicinato Gestione pinza -> Gestione cassetto lascia due
      // overlay sovrapposti (stesso z-index) e la Conferma in cima e' quella
      // dello scarico -> partiva il 12 invece del 25/26 del cassetto.
      this.unloadOpen = false;
      // (collaudo) l'invariante copre anche il terzo overlay
      this.closeTestDialog();
      this.closeDeclDialog();
      this.dialog.type = type;
      this.dialog.selected = null;   // mai preselezionato
    },
    // M: stato discriminante letto fresco (stessa espressione di
    // Mission_enabled), per apertura e re-check alla conferma.
    gripperOnBoardNow() {
      return !!(this.dataGripper && this.dataGripper[0] &&
                this.dataGripper[0].ID != null);
    },
    // M-PALLET(B): discriminatore del ramo pallet — pinza pallet VUOTA.
    // Stessa logica IDENTICA di PalletsView (dataGripper.STATUS==2, dove
    // 2 = dataStored.status_empty); ogni altro STATUS (raw/finished/...)
    // = oggetto in pinza.
    palletGripperEmptyNow() {
      return this.gripperOnBoardNow() &&
             this.dataGripper[0].STATUS == dataStored.status_empty;
    },
    // M-fix: dispatcher del bottone unico "Gestione pinza". NESSUNA
    // condizione propria: il gate e' solo gripperBranchEnabled (stessa
    // fonte del :class del bottone) -> bottone attivo => il tap apre
    // sempre il dialog del ramo corrente. Nessun tap muto per costruzione.
    openGripperMission() {
      if (this.gripperOnBoardNow()) {
        this.closeDialog();          // (fix) esclusione reciproca: via ogni dialog missione residuo
        this.closeTestDialog();      // (collaudo) idem per il dialog di collaudo
        this.closeDeclDialog();
        this.unloadOpen = true;
      } else
        this.openDialog('gripper');
    },
    // M2: dispatcher del bottone unico "Gestione cassetto". Nessuna
    // condizione propria (gate = trayBranchEnabled, come per la pinza).
    openTrayMission() {
      if (this.extractedTray)
        this.openDialog('trayRelease');
      else
        this.openDialog('tray');
    },
    // M-PALLET(B): dispatcher del bottone unico "Gestione pallet".
    // Nessuna condizione propria (gate = palletBranchEnabled).
    openPalletMission() {
      if (this.palletGripperEmptyNow())
        this.openDialog('palletLoad');
      else
        this.openDialog('palletUnload');
    },
    // (collaudo) dispatcher del dialog di collaudo. Nessuna condizione
    // propria: il gate e' la computed del bottone (pattern CARD 3); i
    // re-check freschi stanno nella conferma. Esclusione reciproca:
    // un solo overlay aperto, ultimo bottone premuto vince.
    openTestDialog(type) {
      this.closeDialog();
      this.unloadOpen = false;
      this.closeDeclDialog();
      this.testDialog.type = type;
      // default: 31 parte dalla posizione 1; 32 da 0 = prima posizione vuota
      this.testDialog.subpos = (type == 'placeTray') ? 0 : 1;
      // default pinza: quella a bordo (0) se risulta al sistema, altrimenti
      // scelta esplicita obbligatoria (conferma spenta finche' null)
      this.testDialog.gripperSel = this.gripperOnBoardNow() ? 0 : null;
    },
    closeTestDialog() {
      this.testDialog.type = '';
      this.testDialog.gripperSel = null;
    },
    // ===== (fase B) Reimposta stato cella (35) =====
    openDeclDialog() {
      // un solo overlay: chiudo tutto il resto
      this.closeDialog();
      this.unloadOpen = false;
      this.closeTestDialog();
      this.declDialog.open = true;
      this.declDialog.step = 1;
      this.declDialog.gripperSel = 0;
      this.declDialog.cont1 = 0; this.declDialog.id1 = 0;
      this.declDialog.cont2 = 0; this.declDialog.id2 = 0;
      this.declDialog.waiting = false;
      // anagrafica pinze COMPLETA (senza il filtro POS_PLANT!=1000 della
      // lista carico: la dichiarazione puo' riguardare la pinza gia' a bordo)
      fetch(dataStored.server + 'api/conf/gripper/show/all', { method: 'GET' })
        .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
        .then(d => { this.declGrippers = d || []; })
        .catch(e => { console.info(e); this.declGrippers = []; });
    },
    closeDeclDialog() {
      this.declDialog.open = false;
      this.declDialog.waiting = false;
      clearTimeout(this.declTimer);
    },
    declareBare() {
      // MOUNTED=0: flangia nuda dichiarata esplicitamente (35;0;0;0;0;0)
      this.armDeclWait();
      this.sendToRobot('35;0;0;0;0;0');
    },
    sendDeclare() {
      const d = this.declDialog;
      if (!(d.gripperSel > 0) || d.waiting) return;
      // regola RATIFICATA: chele aperte (CLOSED1=0) = lato 1 FORZATO vuoto;
      // id != 0 solo con contenuto pallet (3)
      const c1 = this.gripperClosed1 === 0 ? 0 : d.cont1;
      const cmd = '35;' + d.gripperSel + ';' + c1 + ';' + (c1 == 3 ? d.id1 : 0) +
                  ';' + d.cont2 + ';' + (d.cont2 == 3 ? d.id2 : 0);
      this.armDeclWait();
      this.sendToRobot(cmd);
    },
    armDeclWait() {
      this.declDialog.waiting = true;
      clearTimeout(this.declTimer);
      this.declTimer = setTimeout(() => {
        // nessun eco: il dialog resta aperto, l'operatore decide (gli errori
        // 944/945/946 arrivano comunque come allarme robot via fix P3)
        this.declDialog.waiting = false;
        dataStored.alert.title = this.$t('WARNING');
        dataStored.alert.desc = 'robot.decl.noEcho';
        dataStored.alert.type = 'warning';
      }, 5000);
    },
    confirmTestDialog() {
      const t = this.testDialog.type;
      // re-check del gating alla conferma sui segnali FRESCHI (pattern M2:
      // stato decaduto col dialog aperto -> chiudi con messaggio, NON inviare)
      let ok;
      switch (t) {
        case 'pickTray':
        case 'placeTray':
          ok = this.testTrayEnabled;          // HOLD + cassetto ancora estratto
          break;
        default:
          ok = this.testBaseEnabled;          // HOLD
      }
      // pick con "pinza a bordo" (0): la pinza deve risultare ANCORA a bordo
      // (il PLC risponderebbe 22)
      if (ok && (t == 'pickTray' || t == 'pickMC') &&
          this.testDialog.gripperSel === 0 && !this.gripperOnBoardNow())
        ok = false;
      if (!ok) {
        this.closeTestDialog();
        dataStored.alert.title = this.$t('WARNING');
        dataStored.alert.desc = 'robot.dialog.stateChanged';
        dataStored.alert.type = 'warning';
        return;
      }
      // contratto: stringhe "CMD;p1;p2" (come 25/11/27); feedback col pattern
      // sendMission — la chiave e' quella del BOTTONE che si illumina
      switch (t) {
        case 'pickTray':
          this.sendMission('test-pickTray', '31;' + this.testDialog.subpos + ';' + this.testDialog.gripperSel);
          break;
        case 'placeTray':
          this.sendMission('test-placeTray', '32;' + this.testDialog.subpos);
          break;
        case 'pickMC':
          this.sendMission('test-pickMC', '33;' + this.testDialog.gripperSel);
          break;
        case 'placeMC':
          this.sendMission('test-placeMC', '34');
          break;
      }
      this.closeTestDialog();
      // ricarico gli elenchi dopo ogni comando inviato (pattern confirmDialog)
      this.getGrippersList();
      this.getPalletsList();
      this.getTraysList();
    },
    // M: conferma scarico (cmd 12) con re-check del discriminante sulla
    // STESSA fonte di verita' del bottone (segnali primari freschi, non i
    // flag dataStored stantii): se lo stato e' cambiato mentre il dialog
    // era aperto, chiudi con messaggio e NON inviare.
    // M4: "Deposita e cambia" apre PRIMA la selezione della pinza target
    // (stesso dialog/lista del carico — pinze a magazzino, esclusa quella
    // a bordo — in modalita' swap). Nessuna condizione propria: i re-check
    // stanno nelle conferme.
    startSwapSelection() {
      this.unloadOpen = false;
      this.swapSelecting = true;
      this.openDialog('gripper');
    },
    confirmUnload() {
      if (!this.gripperBranchEnabled || !this.gripperOnBoardNow()) {
        this.unloadOpen = false;
        dataStored.alert.title = this.$t('WARNING');
        dataStored.alert.desc = 'robot.dialog.stateChanged';
        dataStored.alert.type = 'warning';
        return;
      }
      this.unloadOpen = false;
      // S: feedback acceso ALL'INVIO (conferma dialog), comando invariato
      this.sendMission('gripper', 12);
      // ricarico gli elenchi come confirmDialog()
      this.getGrippersList();
      this.getPalletsList();
      this.getTraysList();
    },
    closeDialog() {
      this.dialog.type = '';
      this.dialog.selected = null;
      // M4: la chiusura (anche annulla/stato cambiato) esce sempre dalla
      // modalita' swap; no-op nel percorso normale.
      this.swapSelecting = false;
    },
    confirmDialog() {
      // ri-verifica del gating alla conferma (per tipo di missione): lo stato
      // puo' essere decaduto mentre il dialog era aperto
      let missionEnabled;
      switch (this.dialog.type) {
        case 'gripper':
          // M2 micro-fix: stessa fonte di verita' del bottone (segnali
          // primari). M4: in modalita' swap la selezione precede lo
          // SCARICO, quindi le condizioni valide sono quelle dello scarico
          // (pinza ancora a bordo), non quelle del carico.
          missionEnabled = this.swapSelecting
            ? (this.gripperBranchEnabled && this.gripperOnBoardNow())
            : (this.gripperBranchEnabled && !this.gripperOnBoardNow());
          break;
        case 'palletLoad':
          // M-PALLET(B) re-check: fonte fresca + discriminatore del ramo
          // (carico valido solo se la pinza pallet e' ancora vuota)
          missionEnabled = (this.palletBranchEnabled && this.palletGripperEmptyNow());
          break;
        case 'palletUnload':
          // (scarico valido solo se c'e' ancora un oggetto in pinza)
          missionEnabled = (this.palletBranchEnabled && !this.palletGripperEmptyNow());
          break;
        case 'tray':
          // M2 re-check EXTRACT (punto 8): ancora nessun estratto/manovra
          missionEnabled = (this.trayBranchEnabled && !this.extractedTray);
          break;
        case 'trayRelease':
          // M2 re-check EXTRACT (punto 8): il cassetto estratto e' ancora li'
          missionEnabled = (this.trayBranchEnabled && !!this.extractedTray);
          break;
        case 'palletPickMC':
        case 'palletPlaceMC':
          // (collaudo) pallet da/su MC1: solo HOLD fresco — le precondizioni
          // fini (quale pallet sta in macchina) le valuta il PLC
          missionEnabled = this.testBaseEnabled;
          break;
        default:
          missionEnabled = dataStored.cmdActiveMission;
      }
      if (missionEnabled != 1) {
        // M2 (vincolo di design): stato cambiato col dialog aperto ->
        // chiudi con messaggio, NON inviare (prima: return muto).
        this.closeDialog();
        dataStored.alert.title = this.$t('WARNING');
        dataStored.alert.desc = 'robot.dialog.stateChanged';
        dataStored.alert.type = 'warning';
        return;
      }
      // trayRelease e' a sola conferma, non richiede selezione
      if (this.dialog.type != 'trayRelease' && this.dialog.selected == null)
        return;
      const sel = this.dialog.selected;
      switch (this.dialog.type) {
        case 'gripper':
          if (this.swapSelecting) {
            // (AO) "Deposita e cambia" = missione swap NATIVA del PLC: un
            // SOLO comando 27;<id target> (stringa col ';', come l'11). Il
            // PLC orchestra da solo deposito->prelievo->TCP (missione robot
            // 30, invisibile al pannello); MissionCode/DESCR 'Swap Gripper'
            // arrivano dai canali di sempre. Muore ogni orchestrazione
            // client del secondo tempo. Cade sul closeDialog + reload in
            // coda, esattamente come l'11.
            this.sendMission('gripper', '27;' + sel.ID);
            break;
          }
          // S: feedback acceso ALL'INVIO (conferma dialog) — la chiave e'
          // quella del BOTTONE (gripper/pallet/tray), non del comando:
          // e' il bottone che si illumina. Comandi INVARIATI.
          this.sendMission('gripper', '11;' + sel.ID);
          break;
        case 'palletLoad':
          this.sendMission('pallet', '13;3;' + sel.ID + ';' + sel.MAG_POS);
          break;
        case 'palletUnload':
          this.sendMission('pallet', '14;3;' + sel.ID + ';' + sel.MAG_POS);
          break;
        case 'tray':
          this.sendMission('tray', '25;' + sel.FLOOR_MAG);
          break;
        case 'trayRelease':
          // (fix) formato identico al 25: "26;<numero cassetto>". Prima si
          // inviava l'intero nudo 26 -> il PLC (che attende "26;n") lo scarta.
          // extractedTray e' la riga del cassetto fuori, FLOOR_MAG il numero;
          // il ramo trayRelease e' raggiungibile solo con extractedTray truthy
          // (openTrayMission + re-check missionEnabled), ma guardo comunque.
          this.sendMission('tray', '26;' + (this.extractedTray ? this.extractedTray.FLOOR_MAG : ''));
          break;
        case 'palletPickMC':
          // (collaudo) pick pallet DA MC1: posizione fissa 0 = macchina
          this.sendMission('test-palletPickMC', '13;3;' + sel.ID + ';0');
          break;
        case 'palletPlaceMC':
          // (collaudo) place pallet SU MC1: posizione fissa 0 = macchina
          this.sendMission('test-palletPlaceMC', '14;3;' + sel.ID + ';0');
          break;
      }
      this.closeDialog();
      // ricarico gli elenchi dopo ogni comando inviato
      this.getGrippersList();
      this.getPalletsList();
      this.getTraysList();
    }
  },
  watch: {
    // S: la macchinetta missione osserva ROBOT/STATUS (statusHandler) + il
    // fetch. (AO) lo swap non ha piu' secondo tempo client: niente watcher
    // su dataGripper per lo sblocco.
    'dataRobot.STATUS'() { this.checkMissionPhase(); }
  },
  computed: {
    // ========================================================================
    // (AN) MOTIVI leggibili dei comandi disabilitati — '' quando abilitato.
    // Stesse condizioni dei rispettivi *BranchEnabled, in ordine di priorita'.
    // ========================================================================
    gripperDisabledReason() {
      // (1-bis) l'hint ausiliari PREVALE su notHold: e' la precondizione
      if (dataStored.safetyAux === 0) return 'robot.hint.auxNotReset';
      if (this.dataRobot.STATUS != dataStored.status_hold) return 'robot.hint.notHold';
      return '';
    },
    palletDisabledReason() {
      if (dataStored.safetyAux === 0) return 'robot.hint.auxNotReset';
      if (this.dataRobot.STATUS != dataStored.status_hold) return 'robot.hint.notHold';
      if (!this.gripperOnBoardNow()) return 'robot.hint.noGripperSystem';
      return '';
    },
    trayDisabledReason() {
      if (dataStored.safetyAux === 0) return 'robot.hint.auxNotReset';
      if (this.dataRobot.STATUS != dataStored.status_hold) return 'robot.hint.notHold';
      if (!this.gripperOnBoardNow()) return 'robot.hint.noGripperSystem';
      if (this.trayBusy) return 'robot.hint.trayBusy';
      return '';
    },
    // ========================================================================
    // (collaudo) gate/hint dei comandi di collaudo — stesso schema dei
    // fratelli: gate = HOLD fresco (+ cassetto estratto per 31/32), hint in
    // ordine aux -> notHold -> specifico. Come per la CARD 3, l'aux non
    // blocca il click (banner+hint avvisano, il PLC rifiuta con 934).
    // ========================================================================
    testBaseEnabled() {
      return this.dataRobot.STATUS == dataStored.status_hold;
    },
    testTrayEnabled() {
      // 31/32 richiedono un cassetto estratto (il PLC risponde 20001)
      return this.testBaseEnabled && !!this.extractedTray;
    },
    testBaseDisabledReason() {
      if (dataStored.safetyAux === 0) return 'robot.hint.auxNotReset';
      if (this.dataRobot.STATUS != dataStored.status_hold) return 'robot.hint.notHold';
      return '';
    },
    testTrayDisabledReason() {
      if (this.testBaseDisabledReason) return this.testBaseDisabledReason;
      if (!this.extractedTray) return 'robot.hint.noTrayExtracted';
      return '';
    },
    testDialogTitle() {
      switch (this.testDialog.type) {
        case 'pickTray':  return 'robot.test.pickTray';
        case 'placeTray': return 'robot.test.placeTray';
        case 'pickMC':    return 'robot.test.pickMC';
        case 'placeMC':   return 'robot.test.placeMC';
      }
      return '';
    },
    testConfirmEnabled() {
      const t = this.testDialog.type;
      if (t == 'pickTray' || t == 'pickMC')
        return this.testDialog.gripperSel !== null;   // pinza scelta obbligatoria
      return t != '';
    },
    // (AN) "sistema" = registro PLC: CODE (IW534) se mai arrivato, altrimenti
    // l'ID del canale storico FROM_PLANT/GRIPPER/ROBOT; null = mai visto.
    systemGripperId() {
      if (this.gripperCode !== null) return this.gripperCode;
      return this.gripperRegistered;
    },
    // (AN) coerenza tre fonti: confronto SOLO tra fonti disponibili — mai
    // allarmi su dati mancanti (sensor/code arrivano col contratto FB8).
    gripperCoherence() {
      const db = this.gripperOnBoardNow();
      const sys = this.systemGripperId;
      const sysKnown = sys !== null;
      const sysOn = sysKnown ? sys > 0 : null;
      const senKnown = this.gripperSensor !== null;
      const senOn = senKnown ? this.gripperSensor == 1 : null;
      if (senKnown && sysKnown && senOn !== sysOn)
        return { state: 'mismatch', msgKey: senOn ? 'robot.coherence.sensorNotRegistered' : 'robot.coherence.registeredNotSensed' };
      if (sysKnown && sysOn !== db)
        return { state: 'mismatch', msgKey: 'robot.coherence.dbMismatch' };
      if (senKnown && !sysKnown && senOn !== db)
        return { state: 'mismatch', msgKey: senOn ? 'robot.coherence.sensorNotRegistered' : 'robot.coherence.registeredNotSensed' };
      return { state: 'ok', msgKey: '' };
    },
    // M-fix: UNICA fonte di verita' del bottone "Gestione pinza", reattiva
    // sui segnali PRIMARI (dataRobot.STATUS + dataGripper) — non sui flag
    // dataStored, che vengono ricalcolati solo sugli eventi ROBOT/STATUS e
    // restavano stantii dopo un UPDATEGRIPPER (tap muto dello smoke test).
    // Ramo scarico: inHold && onBoard; ramo carico: inHold && !onBoard —
    // col ramo scelto da onBoard stesso, il gate netto si riduce a inHold.
    gripperBranchEnabled() {
      const inHold = this.dataRobot.STATUS == dataStored.status_hold;
      const onBoard = this.gripperOnBoardNow();
      return onBoard ? (inHold && onBoard) : (inHold && !onBoard);
    },
    // M2: unica fonte di verita' del bottone "Gestione cassetto".
    // Entrambi i rami richiedono HOLD + pinza a bordo (il gating storico
    // di ESTRAI/RILASCIA, cmdActiveMission, valutato fresco); il ramo e'
    // scelto da extractedTray; manovra in corso (1000/2000) blocca tutto.
    trayBranchEnabled() {
      const inHold = this.dataRobot.STATUS == dataStored.status_hold;
      if (!inHold || !this.gripperOnBoardNow()) return false;
      if (this.trayBusy) return false;
      return true;
    },
    // M-PALLET(B): unica fonte di verita' del bottone "Gestione pallet".
    // Gating storico di cmdActivePallet (inHold && gripperOnBoard, da
    // Mission_enabled) valutato fresco sui segnali primari; il ramo 13/14
    // e' scelto da palletGripperEmptyNow.
    palletBranchEnabled() {
      const inHold = this.dataRobot.STATUS == dataStored.status_hold;
      return inHold && this.gripperOnBoardNow();
    },
    // R2: posizione slider = eco PLC agganciato alla scala 10..100 dello
    // slider (l'1% fine impostato da input manuale mostra il numero esatto
    // nell'input, lo slider si ferma al minimo della sua scala).
    sliderSpeed() {
      const v = parseInt(dataStored.robotSpeed) || 10;
      return Math.min(100, Math.max(10, v));
    },
    // R2-2: valore mostrato dall'input fuori editing — eco PLC clampato a
    // minimo 1 (MAI 0%: a freddo mostra 1).
    displaySpeed() {
      const v = parseInt(dataStored.robotSpeed) || 1;
      return Math.min(100, Math.max(1, v));
    },
    // R2-2 (punto 4): il gating reale del comando 100 vive nel PLC (non
    // determinabile dal materiale: backend passthrough, segmenti storici
    // senza gating) -> fallback ratificato: modificabile solo con stato
    // robot NOTO (STATUS definito e non "Sconosciuto").
    speedEnabled() {
      const s = this.dataRobot.STATUS;
      return s != undefined && s != dataStored.status_notDef;
    },
    dialogTitle() {
      switch (this.dialog.type) {
        // M4: in modalita' swap il titolo dichiara che la selezione precede
        // il deposito (il carico partira' solo dopo, su conferma).
        case 'gripper':      return this.swapSelecting
                                    ? 'robot.dialog.chooseSwapGripper'
                                    : 'robot.dialog.chooseGripper';
        case 'palletLoad':   return 'robot.dialog.choosePalletLoad';
        case 'palletUnload': return 'robot.dialog.choosePalletUnload';
        case 'palletPickMC':  return 'robot.dialog.choosePalletPickMC';
        case 'palletPlaceMC': return 'robot.dialog.choosePalletPlaceMC';
        case 'tray':         return 'robot.dialog.chooseTray';
        case 'trayRelease':  return 'robot.dialog.releaseTray';
      }
      return '';
    },
    dialogItems() {
      switch (this.dialog.type) {
        case 'gripper':     return this.grippersList;
        case 'tray':        return this.traysList;
        case 'trayRelease': return [];
      }
      return this.palletsList;
    },
    dialogConfirmEnabled() {
      // trayRelease: conferma sempre attiva (nessuna selezione richiesta)
      return this.dialog.type == 'trayRelease' || this.dialog.selected != null;
    }
  },
  mounted() {
    this.getRobotData();
    this.getGrippersList();
    this.getPalletsList();
    this.getTraysList();
    this.statusHandler = payload => {
      this.dataRobot.STATUS = parseInt(payload);
      this.CMD_enabled();
      this.Mission_enabled();
      if (payload == dataStored.status_alarm){
        dataStored.alert.title= 'ALARM';
        // (AN, fix P3) il CODICE allarme vive in DESCR: prima la chiave era
        // composta con lo STATUS (99) e mostrava sempre la chiave grezza.
        // Stessa logica di getStatus(); fallback generico se DESCR non-codice.
        const alarmCode = parseInt(this.dataRobot.DESCR);
        dataStored.alert.desc = (Number.isInteger(alarmCode) && alarmCode > 0)
          ? 'robot.alarm_' + alarmCode
          : 'ALARM';
      }
      if (this.dataRobot.STATUS == dataStored.status_aborted ) {
        dataStored.alert.title = 'ALARM';
        dataStored.alert.desc = 'abort';
      }
    };
    dataStored.WS.socket.on('ROBOT/STATUS', this.statusHandler);
    // Snapshot: il PLC pubblica STATUS solo on-change, senza questa richiesta
    // una view montata dopo l'ultimo cambio resta sullo stato di default.
    dataStored.WS.socket.emit('UNIT/STATUS/REQUEST', 'ROBOT');
    dataStored.WS.socket.on('ROBOT/DESCR', payload => {
      this.dataRobot.DESCR = payload;
    });
    dataStored.WS.socket.on('ROBOT/UPDATEGRIPPER', () =>{
      this.getRobotData();
    });
    dataStored.WS.socket.on('ROBOT/CHANGESPEED', payload => {
      dataStored.robotSpeed = payload;
    })
    // M2: campanello estrazione cassetti — il backend emette BOX/STATUS a
    // ogni FROM_PLANT/TRAY/BOX/EXTRACT|RELEASE del PLC (pattern e4ab4e5:
    // handler nominato, off specifico in unmounted).
    this.boxStatusHandler = () => {
      this.getTraysList();
    };
    dataStored.WS.socket.on('BOX/STATUS', this.boxStatusHandler);
    // (AN) stato pinza a tre fonti: handler nominati (pattern e4ab4e5) +
    // snapshot dalla cache backend al mount (payload PLC = intero: guardo)
    this.gripperSensorHandler = v => { const n = parseInt(v, 10); if (Number.isInteger(n)) this.gripperSensor = n; };
    this.gripperCodeHandler = v => { const n = parseInt(v, 10); if (Number.isInteger(n)) this.gripperCode = n; };
    this.gripperRegisteredHandler = v => {
      const n = parseInt(v, 10);
      if (Number.isInteger(n)) this.gripperRegistered = n;
      // (1-bis) lista carico REATTIVA: il deposito/carico cambia il registro
      // -> ricarica i dati pinza del dialog anche a dialog aperto (prima la
      // pinza depositata restava invisibile fino a F5). La selezione regge:
      // l'evidenziazione e la conferma vanno per ID.
      this.getGrippersList();
    };
    // (fase B) sensori pinza LIVE + eco dichiarazione 35: l'eco chiude il
    // dialog (successo); gli errori arrivano come allarme robot (fix P3)
    this.gripperMountedHandler = v => { const n = parseInt(v, 10); if (Number.isInteger(n)) this.gripperMounted = n; };
    this.gripperClosed1Handler = v => { const n = parseInt(v, 10); if (Number.isInteger(n)) this.gripperClosed1 = n; };
    this.declRobotHandler = () => {
      if (!this.declDialog.open || !this.declDialog.waiting) return;
      clearTimeout(this.declTimer);
      this.closeDeclDialog();
      dataStored.alert.title = 'INFO';
      dataStored.alert.desc = 'robot.decl.done';
      dataStored.alert.type = 'message';
      this.getRobotData();
      this.getGrippersList();
    };
    dataStored.WS.socket.on('GRIPPER/MOUNTED', this.gripperMountedHandler);
    dataStored.WS.socket.on('GRIPPER/CLOSED1', this.gripperClosed1Handler);
    dataStored.WS.socket.on('DECLARE/ROBOT', this.declRobotHandler);
    dataStored.WS.socket.on('GRIPPER/SENSOR', this.gripperSensorHandler);
    dataStored.WS.socket.on('GRIPPER/CODE', this.gripperCodeHandler);
    dataStored.WS.socket.on('GRIPPER/REGISTERED', this.gripperRegisteredHandler);
    dataStored.WS.socket.emit('GRIPPER/REQUEST_SNAPSHOT');
  },
  unmounted() {
    // off SPECIFICO (evento + callback): un off('ROBOT/STATUS') nudo
    // staccherebbe anche i listener di altri componenti (es. units.vue).
    dataStored.WS.socket.off('ROBOT/STATUS', this.statusHandler);
    dataStored.WS.socket.off('BOX/STATUS', this.boxStatusHandler);
    dataStored.WS.socket.off('GRIPPER/MOUNTED', this.gripperMountedHandler);
    dataStored.WS.socket.off('GRIPPER/CLOSED1', this.gripperClosed1Handler);
    dataStored.WS.socket.off('DECLARE/ROBOT', this.declRobotHandler);
    clearTimeout(this.declTimer);
    dataStored.WS.socket.off('GRIPPER/SENSOR', this.gripperSensorHandler);
    dataStored.WS.socket.off('GRIPPER/CODE', this.gripperCodeHandler);
    dataStored.WS.socket.off('GRIPPER/REGISTERED', this.gripperRegisteredHandler);
    // S: niente timer/feedback orfani, la missione visiva muore con la view
    this.clearMission();
    //dataStored.WS.socket.off('ROBOT/DESCR');
    //dataStored.WS.socket.off('ROBOT/UPDATEGRIPPER');
  }
}
</script>

<style scoped>
/* (AN) hint motivo comando disabilitato (pattern min-hint 2c) */
.cmd-hint {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  text-align: center;
}

/* (AN) indicatore coerenza pinza: righe fonte + badge (grammatica badge di
   AttrezzaggiView/selectRig) */
.coherence {
  margin-top: var(--space-4);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-subtle);
  text-align: left;
  cursor: default;
}

.coherence-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.coherence-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  padding: 2px 0;
}

.coh-label {
  color: var(--text-secondary);
}

.coh-na {
  color: var(--text-muted);
  font-style: italic;
}

.coherence-msg {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3); /* micro-aggiustamento ottico badge */
  border-radius: var(--radius-lg);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.badge-type {
  background-color: var(--color-success-bg);
  color: var(--color-success);
}

.badge-anomaly {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  font-weight: var(--font-weight-semibold);
}
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

/* Punti di destinazione (K-FIX): pure-g e' flex ma le colonne pure-u-1-3
   a 33.33% con un gap andrebbero in overflow -> flex:1 con width auto,
   larghezze uguali tra loro come prima, gap allineato al gap 8 della card. */
.dest-grid {
  gap: var(--space-2);
}

/* R1: colonne flex + bottoni che riempiono la riga -> i tre bottoni hanno
   SEMPRE la stessa altezza (se un testo va a capo, crescono tutti insieme)
   col testo centrato verticalmente. */
.dest-grid > div {
  flex: 1;
  width: auto;
  display: flex;
}

.dest-grid button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
}

/* R1: la label ROBOT SPEED staccata dalla card di stato sopra con lo
   stesso passo del resto della colonna. */
.speed-group {
  margin-top: var(--space-4);
}

/* R2: speed = slider (comando al rilascio) + input manuale fine + eco %.
   I vecchi 5 segmenti .speed-button sono stati rimossi. */
.speed-control {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.speed-slider {
  flex: 1;
  min-height: 44px;              /* area touch generosa */
  accent-color: var(--accent);   /* track/thumb su accent (nativo) */
  cursor: pointer;
}

/* thumb generoso per il touch (Chrome kiosk) */
.speed-slider::-webkit-slider-thumb {
  width: 28px;
  height: 28px;
}

/* R2-2: unita' statica accanto all'input unificato */
.speed-unit {
  color: var(--text-secondary);
  font-size: var(--font-size-md);
}

/* R2-2: disabled a canone ("subdued ma leggibile", come buttons.css) */
.speed-slider:disabled,
.speed-manual:disabled {
  opacity: 0.8;
  cursor: not-allowed;
}

.speed-slider:disabled {
  accent-color: var(--text-muted);
}

/* input manuale canonico dark (regola F10: --border-strong su bg-input) */
.speed-manual {
  width: 55px;
  min-height: 44px;
  padding: var(--space-2);
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  text-align: right;
}

/* Dialog scelta pinza/pallet per missioni (CARD 3). Overlay a schermo pieno
   sopra sidebar (z 900); voci elenco min 52px = touch target industriale,
   selezione a tap (nessuna interazione hover-only). */
.mission-dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-backdrop);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mission-dialog {
  background: var(--bg-surface);
  border: var(--border-card);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
  padding: var(--space-4);
  width: min(520px, 92vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.mission-dialog-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.mission-dialog-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  min-height: 52px;
  padding: var(--space-2) var(--space-4);
  background: var(--bg-input);
  color: var(--text-primary);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  cursor: pointer;
  text-align: left;
}

.mission-dialog-item.selected {
  background: var(--accent);
  border-color: var(--accent-hover);
  font-weight: var(--font-weight-semibold);
}

.mission-dialog-empty {
  color: var(--text-muted);
  text-align: center;
  padding: var(--space-4);
}

/* M: riga info del dialog scarico pinza (quale pinza verra' scaricata) */
.unload-info {
  color: var(--text-primary);
  font-size: var(--font-size-md);
  text-align: center;
  padding: var(--space-2) 0;
}
/* (collaudo) campi del dialog di collaudo missioni */
.test-field {
  margin-bottom: var(--space-4);
  text-align: left;
}

.test-field-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

/* (fase B) campi del dialog Reimposta stato cella */
.decl-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  text-align: left;
}

.decl-field label {
  min-width: 7em;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.decl-select {
  min-height: 44px;
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-base);
}
</style>
