# Mappa golden dei comandi

Generata da `tests/test_golden_comandi.mjs --aggiorna`. Per ogni controllo: etichetta, handler, condizione di abilitazione e, nel primo scenario dove e' visibile, gli effetti (MQTT, HTTP, router) e le conferme. Il dettaglio per scenario e' nel json.

## robotView (`src/views/unit/robotView.vue`)

Scenari: HOLD liv2 · HOLD liv0 · HOLD liv2 cassetto 8 fuori · AUTO liv2 · OFF liv2 · STATUS ignoto liv2 · NOT_DEFINED liv2

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Reimposta stato cella | `dataStored.cmdActive==1?openDeclDialog():''` | `dataStored.cmdActive==0` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | fetch GET api/conf/piece/show/all<br>fetch GET api/conf/gripper/show/all | Annulla → – |
| Riprova | `retryPlcRefresh` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Pinza a bordo {{(dataGripper[0].FAMILY \|\| '').trim()}} {{$t('robot.claw.side', { side: 1 })}} {{$t(gripperContentKey(dat | `$router.push('../../conf/grippers')` |  | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: sì<br>OFF liv2: sì<br>STATUS ignoto liv2: sì<br>NOT_DEFINED liv2: sì | router "../../conf/grippers" | no |
| {{gripperCoherence.state=='ok' ? $t('robot.coherence.ok') : $t('robot.coherence.mismatch')}} · Sensore non disponibile S | `` |  | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: sì<br>OFF liv2: sì<br>STATUS ignoto liv2: sì<br>NOT_DEFINED liv2: sì | – | no |
| (step) | `stepSpeed($event)` | `!speedEnabled` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: sì<br>OFF liv2: sì<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT "100;2" | no |
| {{p}} % | `setSpeedPreset(p)` | `!speedEnabled` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: sì<br>OFF liv2: sì<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT "100;10" | no |
| Movimenti | `rvTab='movement'` | `{ on: rvTab=='movement' }` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: sì<br>OFF liv2: sì<br>STATUS ignoto liv2: sì<br>NOT_DEFINED liv2: sì | – | no |
| Missioni | `rvTab='mission'` | `{ on: rvTab=='mission' }` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: sì<br>OFF liv2: sì<br>STATUS ignoto liv2: sì<br>NOT_DEFINED liv2: sì | stato: vm.rvTab = "mission" | no |
| Chele | `rvTab='claw'` | `{ on: rvTab=='claw' }` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: sì<br>OFF liv2: sì<br>STATUS ignoto liv2: sì<br>NOT_DEFINED liv2: sì | stato: vm.rvTab = "claw" | no |
| Posizione di home | `dataStored.cmdActive==1?sendMission('home',20):''` | `dataStored.cmdActive==0` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT 20 | no |
| Posizione per la manutenzione | `dataStored.cmdActive==1?sendMission('maintenance',21):''` | `dataStored.cmdActive==0` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT 21 | no |
| {{$t('robot.goTo', { dest: $t('Easybox') })}} | `dataStored.cmdActive==1?sendMission('dest-easybox','15;1'):''` | `dataStored.cmdActive==0` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT "15;1" | no |
| {{$t('robot.goTo', { dest: $t(pos.labelKey) })}} | `dataStored.cmdActive==1?sendMission('dest-'+pos.mc.toLowerCase(),'15;'+(10+pos.n)):''` | `dataStored.cmdActive==0` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT "15;11" | no |
| Apri chela | `clawEnabled(side) ? openClawDialog(side) : ''` | `!clawEnabled(side)` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.clawDialog.side = 1 |  → emit TO_PLANT/CMD/ROBOT "240"<br> → – |
| Chiudi chela | `clawEnabled(side) ? sendClaw(side, false) : ''` | `!clawEnabled(side)` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT "241" | no |
| Gestione pinza {{$t(gripperDisabledReason)}} | `gripperBranchEnabled?openGripperMission():''` | `!gripperBranchEnabled` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.unloadOpen = true | Deposita e cambia → –<br>Conferma → emit TO_PLANT/CMD/ROBOT 12, fetch GET api/conf/gripper/show/all, fetch GET api/conf/pallet/show/all, fetch GET api/conf/tray/show/all<br>Annulla → – |
| Gestione pallet {{$t(palletDisabledReason)}} | `palletBranchEnabled?openPalletMission():''` | `!palletBranchEnabled` | HOLD liv2: no<br>HOLD liv0: no<br>HOLD liv2 cassetto 8 fuori: no<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | – | no |
| Gestione cassetto {{$t(trayDisabledReason)}} | `trayBranchEnabled?openTrayMission():''` | `!trayBranchEnabled` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.dialog.type = "tray" | Conferma → –<br>Annulla → – |
| Preleva finito e deposita grezzo {{$t(pickPlaceDisabledReason())}} | `pickPlaceEnabled() ? openPickPlaceDialog() : ''` | `!pickPlaceEnabled()` | HOLD liv2: no<br>HOLD liv0: no<br>HOLD liv2 cassetto 8 fuori: no<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | – | no |
| Preleva pezzo da cassetto {{$t(testTrayDisabledReason)}} | `testTrayEnabled?openTestDialog('pickTray'):''` | `!testTrayEnabled` | HOLD liv2: no<br>HOLD liv0: no<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.testDialog.type = "pickTray", vm.testDialog.gripperSel = 0 |  → –<br>Pinza a bordo (ID {{dataGripper[0].ID}} ) Nessuna pinza a bordo risulta al sistema → –<br>Conferma → emit TO_PLANT/CMD/ROBOT "31;1;0", fetch GET api/conf/gripper/show/all, fetch GET api/conf/pallet/show/all, fetch GET api/conf/tray/show/all<br>Annulla → – |
| Deposita pezzo in cassetto {{$t(testTrayDisabledReason)}} | `testTrayEnabled?openTestDialog('placeTray'):''` | `!testTrayEnabled` | HOLD liv2: no<br>HOLD liv0: no<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.testDialog.type = "placeTray", vm.testDialog.subpos = 0 |  → –<br>Conferma → emit TO_PLANT/CMD/ROBOT "32;0", fetch GET api/conf/gripper/show/all, fetch GET api/conf/pallet/show/all, fetch GET api/conf/tray/show/all<br>Annulla → – |
| Preleva pezzo da MC1 | `testBaseEnabled?openTestDialog('pickMC'):''` | `!testBaseEnabled` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.testDialog.type = "pickMC", vm.testDialog.gripperSel = 0 | Pinza a bordo (ID {{dataGripper[0].ID}} ) Nessuna pinza a bordo risulta al sistema → –<br>Conferma → emit TO_PLANT/CMD/ROBOT "33;0", fetch GET api/conf/gripper/show/all, fetch GET api/conf/pallet/show/all, fetch GET api/conf/tray/show/all<br>Annulla → – |
| Deposita pezzo su MC1 | `testBaseEnabled?openTestDialog('placeMC'):''` | `!testBaseEnabled` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.testDialog.type = "placeMC", vm.testDialog.gripperSel = 0 | Conferma → emit TO_PLANT/CMD/ROBOT "34", fetch GET api/conf/gripper/show/all, fetch GET api/conf/pallet/show/all, fetch GET api/conf/tray/show/all<br>Annulla → – |
| Preleva pallet da MC1 | `testBaseEnabled?openDialog('palletPickMC'):''` | `!testBaseEnabled` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.dialog.type = "palletPickMC" | Conferma → –<br>Annulla → – |
| Deposita pallet su MC1 | `testBaseEnabled?openDialog('palletPlaceMC'):''` | `!testBaseEnabled` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.dialog.type = "palletPlaceMC" | Conferma → –<br>Annulla → – |
| Reset allarmi | `criticalEnabled('reset') ? askCritical('reset') : ''` |  | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: sì<br>OFF liv2: sì<br>STATUS ignoto liv2: sì<br>NOT_DEFINED liv2: sì | stato: vm.criticalDialog.type = "reset" | {{$t('robot.critical.' + criticalDialog.type + 'NotThis')}} → emit TO_PLANT/CMD/ROBOT 99<br>{{$t('robot.critical.' + criticalDialog.type + 'NotThis')}} → – |
| Riavvia programma robot | `criticalEnabled('restart') ? askCritical('restart') : ''` | `!criticalEnabled('restart')` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.criticalDialog.type = "restart" | {{$t('robot.critical.' + criticalDialog.type + 'NotThis')}} → emit TO_PLANT/CMD/ROBOT 18<br>{{$t('robot.critical.' + criticalDialog.type + 'NotThis')}} → – |
| (confirm) | `confirmClawOpen()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| (cancel) | `closeClawDialog()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| {{$t('robot.critical.' + criticalDialog.type + 'NotThis')}} | `confirmCritical()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| {{$t('robot.critical.' + criticalDialog.type + 'NotThis')}} | `closeCriticalDialog()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| (update) | `v => testDialog.subpos = v` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Pinza a bordo (ID {{dataGripper[0].ID}} ) Nessuna pinza a bordo risulta al sistema | `gripperOnBoardNow() ? testDialog.gripperSel=0 : ''` | `!gripperOnBoardNow()` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| {{(g.FAMILY \|\| '').trim()}} Slot {{g.SUB_POS}} (ID {{g.ID}} ) | `testDialog.gripperSel=g.ID` | `{ selected: testDialog.gripperSel===g.ID }` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Conferma | `testConfirmEnabled?confirmTestDialog():''` | `[!testConfirmEnabled? 'pure-button-disable' : 'pure-button-mission']` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Annulla | `closeTestDialog()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Dichiara flangia nuda | `declareBare()` | `declDialog.waiting` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Avanti | `declDialog.step=2` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Annulla | `closeDeclDialog()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Correggi tasche | `pocketsEnabled ? openPockets() : ''` | `[pocketsEnabled ? 'pure-button-micromission' : 'pure-button-disable']` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Indietro | `declDialog.step=1` | `declDialog.waiting` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| DICHIARA | `(declDialog.gripperSel>0 && !declDialog.waiting) ? sendDeclare() : ''` | `[!(declDialog.gripperSel>0) \|\| declDialog.waiting ? 'pure-button-disable' : 'pure-button-mission']` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Annulla | `closeDeclDialog()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Dichiara | `(pockets.typeBusy \|\| !(pockets.typeSel > 0)) ? '' : declareTrayType()` | `[pockets.typeBusy \|\| !(pockets.typeSel > 0) ? 'pure-button-disable' : 'pure-button-micromission']` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| (pick) | `pickPocket($event)` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| {{$t(st.label)}} | `pockets.busy ? '' : declarePocket(st.code)` | `[pockets.busy ? 'pure-button-disable' : 'pure-button-micromission']` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Indietro | `declDialog.step=2` | `pockets.busy` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Annulla | `closeDeclDialog()` | `pockets.busy` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Conferma | `pickPlaceConfirmEnabled ? confirmPickPlace() : ''` | `[pickPlaceConfirmEnabled ? 'pure-button-mission' : 'pure-button-disable']` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Annulla | `closePickPlaceDialog()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Posizione {{d.pos}} {{$t(d.reason, d.reasonParams)}} | `d.usable ? dialog.dest=d.pos : ''` | `!d.usable` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| {{$t('attrezzaggi.inMachine', { mc: $t(m.labelKey) })}} | `dialog.dest=0` | `{ selected: dialog.dest===0 }` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Cassetto {{item.FLOOR_MAG}} {{(item.FAMILY \|\| '').trim()}} Slot {{item.SUB_POS}} {{(item.DESCR \|\| '').trim()}} Posizione | `dialog.selected=item` | `{ selected: dialog.selected!=null && dialog.selected.ID==item.ID }` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Conferma | `dialogConfirmEnabled?confirmDialog():''` | `[!dialogConfirmEnabled? 'pure-button-disable' : 'pure-button-mission']` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Annulla | `closeDialog()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Deposita e cambia | `startSwapSelection()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Conferma | `confirmUnload()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Annulla | `unloadOpen=false` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |

## CNC1View (`src/views/unit/CNC1View.vue`)

Scenari: base · pallet 2 scelto e dichiarato · eco morsa manuale ON

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Apri | `sendToPLC(30)` |  | base: sì<br>pallet 2 scelto e dichiarato: sì<br>eco morsa manuale ON: sì | emit TO_PLANT/CMD/MC1 30 | no |
| Chiudi | `sendToPLC(31)` |  | base: sì<br>pallet 2 scelto e dichiarato: sì<br>eco morsa manuale ON: sì | emit TO_PLANT/CMD/MC1 31 | no |
| Sblocca | `sendToPLC(20)` |  | base: sì<br>pallet 2 scelto e dichiarato: sì<br>eco morsa manuale ON: sì | emit TO_PLANT/CMD/MC1 20 | no |
| Blocca | `sendToPLC(21)` |  | base: sì<br>pallet 2 scelto e dichiarato: sì<br>eco morsa manuale ON: sì | emit TO_PLANT/CMD/MC1 21 | no |
| Sblocca | `sendToPLC(10)` |  | base: sì<br>pallet 2 scelto e dichiarato: sì<br>eco morsa manuale ON: sì | emit TO_PLANT/CMD/MC1 10 | no |
| Blocca | `openViceLockDialog()` |  | base: sì<br>pallet 2 scelto e dichiarato: sì<br>eco morsa manuale ON: sì | stato: vm.viceLockOpen = true |  → emit TO_PLANT/CMD/MC1 "11"<br> → – |
| OFF | `toggleManualVice()` | `rigBlockReason!='' \|\| declWaiting \|\| !declManualVice` | base: no<br>pallet 2 scelto e dichiarato: no<br>eco morsa manuale ON: sì | emit TO_PLANT/CMD/MC1 "43" | no |
| ON | `toggleManualVice()` | `rigBlockReason!='' \|\| declWaiting \|\| !!declManualVice` | base: sì<br>pallet 2 scelto e dichiarato: sì<br>eco morsa manuale ON: no | emit TO_PLANT/CMD/MC1 "42" | no |
| Dichiara pallet | `declarePallet()` | `rigBlockReason!='' \|\| declWaiting \|\| !(palletSel>0)` | base: no<br>pallet 2 scelto e dichiarato: sì<br>eco morsa manuale ON: no | emit TO_PLANT/CMD/MC1 "40;2" | no |
| Rimuovi pallet | `removePallet()` | `rigBlockReason!='' \|\| declWaiting \|\| !(declPallet>0)` | base: no<br>pallet 2 scelto e dichiarato: sì<br>eco morsa manuale ON: no | emit TO_PLANT/CMD/MC1 "41" | no |
| (confirm) | `confirmViceLock()` |  | base: –<br>pallet 2 scelto e dichiarato: –<br>eco morsa manuale ON: – |  | no |
| (cancel) | `closeViceLockDialog()` |  | base: –<br>pallet 2 scelto e dichiarato: –<br>eco morsa manuale ON: – |  | no |

## CNC2View (`src/views/unit/CNC2View.vue`)

Scenari: base

Nessun controllo con handler.

## smallboxView (`src/views/unit/smallboxView.vue`)

Scenari: locale, cassetto 8 fuori · remoto, cassetto 8 fuori · locale, nessun cassetto fuori

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Reset EasyBox | `sendToBox(99)` |  | locale, cassetto 8 fuori: sì<br>remoto, cassetto 8 fuori: sì<br>locale, nessun cassetto fuori: sì | emit TO_PLANT/CMD/BOX 99 | no |

## DashboardView (`src/views/DashboardView.vue`)

Scenari: base · tre ordini, 102 in lavoro · nessun ordine in corso

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Ferma ordine | `modifyOrderStatus(ordineInCorso.ID,dataStored.status_raw,ordineInCorso.PIECE_ID)` |  | base: –<br>tre ordini, 102 in lavoro: sì<br>nessun ordine in corso: – | emit TO_PLANT/CMD/ORDER {"id":102,"status":4,"pieceID":2} | no |
| Coda ordini | `$router.push('/production')` |  | base: –<br>tre ordini, 102 in lavoro: sì<br>nessun ordine in corso: – | router "/production" | no |
| Coda ordini | `$router.push('/production')` |  | base: sì<br>tre ordini, 102 in lavoro: –<br>nessun ordine in corso: sì | router "/production" | no |
| Vedi tutti | `$router.push('/production')` |  | base: sì<br>tre ordini, 102 in lavoro: sì<br>nessun ordine in corso: sì | router "/production" | no |
| # {{o.ID}} {{o.PIECE}} {{(o.PIECE_DESC \|\| '').trim()}} {{o.PRODUCTED}} / {{o.QUANTITY}} MC {{o.MACHINE_ID}} | `$router.push('/production')` |  | base: –<br>tre ordini, 102 in lavoro: sì<br>nessun ordine in corso: sì | router "/production" | no |
| Robot {{$t(statusKey(plant.robot))}} {{$t('robot.alarm_' + parseInt(plant.robotAlarm))}} {{$t('home.speed', { v: velocit | `$router.push('/unit/robot');` |  | base: sì<br>tre ordini, 102 in lavoro: sì<br>nessun ordine in corso: sì | router "/unit/robot" | no |
| Macchina MC1 {{$t(statusKey(plant.mc1))}} {{$t('home.mcOrder', { id: ordineSu(1).ID })}} | `$router.push('/unit/cnc1');` |  | base: sì<br>tre ordini, 102 in lavoro: sì<br>nessun ordine in corso: sì | router "/unit/cnc1" | no |
| Macchina MC2 {{$t(statusKey(plant.mc2))}} {{$t('home.mcOrder', { id: ordineSu(2).ID })}} | `$router.push('/unit/cnc2');` |  | base: –<br>tre ordini, 102 in lavoro: –<br>nessun ordine in corso: – |  | no |
| EasyBox {{$t('strip.trayOut', { n: plant.trayOut })}} {{$t(statusKey(plant.box))}} {{$t(statusKey(plant.box))}} | `$router.push('/unit/smallbox');` |  | base: sì<br>tre ordini, 102 in lavoro: sì<br>nessun ordine in corso: sì | router "/unit/smallbox" | no |
| Apri allarmi | `$router.push('/alarms')` |  | base: sì<br>tre ordini, 102 in lavoro: sì<br>nessun ordine in corso: sì | router "/alarms" | no |
| {{allarmi[0].testo}} {{$t('home.moreAlarms', { n: allarmi.length - 1 })}} | `$router.push('/alarms')` |  | base: –<br>tre ordini, 102 in lavoro: –<br>nessun ordine in corso: – |  | no |

## units (`src/components/units.vue`)

Scenari: base

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| {{$t(robot_desc)}} Alarm: {{$t('robot.alarm_' + robotAlarm)}} {{robotAlarm}} | `$router.push('/unit/robot');` |  | base: sì | router "/unit/robot" | no |
| {{$t(smallBox_desc)}} | `$router.push('/unit/smallbox');` |  | base: sì | router "/unit/smallbox" | no |
| {{$t(cnc1_desc)}} Ordine di lavoro : {{cnc1_order}} | `$router.push('/unit/cnc1');` |  | base: sì | router "/unit/cnc1" | no |
| {{$t(cnc2_desc)}} Ordine di lavoro : {{cnc2_order}} | `$router.push('/unit/cnc2');` |  | base: – |  | no |

## productionView (`src/views/productionView.vue`)

Scenari: liv2 · liv0

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Azzera produzione | `openResetDialog` | `dataStored.userLevel == 0` | liv2: sì<br>liv0: no | fetch GET api/order/resetProduction/preview/1 | Azzera → fetch POST api/order/resetProduction/1<br>Annulla → – |
| Aggiungi ordine | `navigateToWizard` | `dataStored.userLevel == 0` | liv2: sì<br>liv0: no | router "/selectRig" | no |
| {{$t(pos.labelKey)}} | `loadPreview()` |  | liv2: –<br>liv0: – |  | no |
| Azzera | `resetConfirmEnabled ? confirmReset() : ''` | `[resetConfirmEnabled ? 'pure-button-mission' : 'pure-button-disable']` | liv2: –<br>liv0: – |  | no |
| Annulla | `closeResetDialog()` |  | liv2: –<br>liv0: – |  | no |

## productionTable (`src/components/productionTable.vue`)

Scenari: tre ordini liv2 · tre ordini, popup elimina aperto

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| (cmdPlay) | `modifyOrderStatus(o.ID,dataStored.status_working,o.PIECE_ID)` |  | tre ordini liv2: sì<br>tre ordini, popup elimina aperto: sì | emit TO_PLANT/CMD/ORDER {"id":101,"status":3,"pieceID":1} | no |
| (cmdStop) | `modifyOrderStatus(o.ID,dataStored.status_raw,o.PIECE_ID)` |  | tre ordini liv2: sì<br>tre ordini, popup elimina aperto: sì | emit TO_PLANT/CMD/ORDER {"id":101,"status":4,"pieceID":1} | no |
| (cmdDel) | `sicurezza(o.ID, o.STATUS_DESC)` |  | tre ordini liv2: sì<br>tre ordini, popup elimina aperto: sì | stato: vm.showPopUp = 101 | Cancella → fetch DELETE api/order/101<br>Annulla → – |
| Rilancia | `relaunchOrder = o` |  | tre ordini liv2: sì<br>tre ordini, popup elimina aperto: sì | stato: vm.relaunchOrder = {"ID":103,"PIECE":"PZ-C","PIECE_DESC":"prova","MACHINE_ID":1,"STATUS":5,"STATUS_ |  → – |
| Cancella | `deleteOrder(o.ID)` |  | tre ordini liv2: –<br>tre ordini, popup elimina aperto: sì | fetch DELETE api/order/101 | no |
| Annulla | `showPopUp=0` |  | tre ordini liv2: –<br>tre ordini, popup elimina aperto: sì | stato: vm.showPopUp = 0 | no |
| (riprova) | `getDataTable()` |  | tre ordini liv2: –<br>tre ordini, popup elimina aperto: – |  | no |
| (close) | `relaunchOrder = null` |  | tre ordini liv2: –<br>tre ordini, popup elimina aperto: – |  | no |

## ComandsRows (`src/components/Comands/ComandsRows.vue`)

Scenari: liv2, EasyBox in locale · liv0 · liv2, robot non in locale · tutto disabilitato

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| (click) | `$emit('cmdPlay')` | `playDisable` | liv2, EasyBox in locale: sì<br>liv0: sì<br>liv2, robot non in locale: sì<br>tutto disabilitato: no | evento cmdPlay | no |
| (click) | `$emit('cmdPause')` | `pauseDisable` | liv2, EasyBox in locale: sì<br>liv0: sì<br>liv2, robot non in locale: sì<br>tutto disabilitato: no | evento cmdPause | no |
| (click) | `$emit('cmdStop')` | `stopDisable` | liv2, EasyBox in locale: sì<br>liv0: sì<br>liv2, robot non in locale: sì<br>tutto disabilitato: no | evento cmdStop | no |
| (click) | `modifyItem()` | `modifyDisable` | liv2, EasyBox in locale: sì<br>liv0: sì<br>liv2, robot non in locale: sì<br>tutto disabilitato: no | evento cmdModify | no |
| (click) | `$emit('cmdPlace')` | `placeDisable` | liv2, EasyBox in locale: sì<br>liv0: sì<br>liv2, robot non in locale: sì<br>tutto disabilitato: no | evento cmdPlace | no |
| (click) | `extract()` | `moveDisable` | liv2, EasyBox in locale: sì<br>liv0: sì<br>liv2, robot non in locale: sì<br>tutto disabilitato: no | evento cmdMove | no |
| (click) | `$emit('cmdSave')` | `saveDisable` | liv2, EasyBox in locale: sì<br>liv0: sì<br>liv2, robot non in locale: sì<br>tutto disabilitato: no | evento cmdSave | no |
| (click) | `deleteItem()` | `delDisable` | liv2, EasyBox in locale: sì<br>liv0: sì<br>liv2, robot non in locale: sì<br>tutto disabilitato: no | evento cmdDel | no |

## RelaunchDialog (`src/components/RelaunchDialog.vue`)

Scenari: anteprima: si sostituisce e si usa il disponibile · anteprima assente

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Sì, li ho rimessi | `canReplace ? confirm('replaced') : ''` | `[canReplace ? 'pure-button-mission' : 'pure-button-disable']` | anteprima: si sostituisce e si usa il disponibile: sì<br>anteprima assente: – | fetch POST api/order/relaunch/103?mode=replaced<br>evento close | no |
| No, usa i grezzi disponibili | `canUseAvailable ? confirm('available') : ''` | `[canUseAvailable ? 'pure-button-mission' : 'pure-button-disable']` | anteprima: si sostituisce e si usa il disponibile: sì<br>anteprima assente: – | fetch POST api/order/relaunch/103?mode=available<br>evento close | no |
| Annulla | `$emit('close')` |  | anteprima: si sostituisce e si usa il disponibile: sì<br>anteprima assente: sì | evento close | no |

## layoutView (`src/views/layoutView.vue`)

Scenari: modifica, vicini 7 e 9, liv2 · modifica, reset aperto

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Cassetto {{neighbors.prev.floor}} | `goNeighbor('prev')` | `!neighbors.prev \|\| navBlocked` | modifica, vicini 7 e 9, liv2: sì<br>modifica, reset aperto: no | router "/layout/21/1/7" | no |
| Cassetto {{neighbors.next.floor}} | `goNeighbor('next')` | `!neighbors.next \|\| navBlocked` | modifica, vicini 7 e 9, liv2: sì<br>modifica, reset aperto: no | router "/layout/23/1/9" | no |
| Scarta e cambia cassetto | `confirmDiscard()` |  | modifica, vicini 7 e 9, liv2: –<br>modifica, reset aperto: – |  | no |
| Annulla | `navConfirm = null` |  | modifica, vicini 7 e 9, liv2: –<br>modifica, reset aperto: – |  | no |
| (pick) | `clickPiece($event.index)` |  | modifica, vicini 7 e 9, liv2: sì<br>modifica, reset aperto: sì | stato: vm.listPz = [{"SUB_POS":1,"x":65,"y":50,"status":5,"prisma":true,"order_ID":0,"partType":103 | no |
| Tutti grezzi | `allRaugh()` |  | modifica, vicini 7 e 9, liv2: sì<br>modifica, reset aperto: sì | stato: vm.listPz = [{"SUB_POS":1,"x":65,"y":50,"status":4,"prisma":true,"order_ID":0,"partType":103 | no |
| Tutti vuoti | `allEmpty()` |  | modifica, vicini 7 e 9, liv2: sì<br>modifica, reset aperto: sì | stato: vm.listPz = [{"SUB_POS":1,"x":65,"y":50,"status":2,"prisma":true,"order_ID":0,"partType":103 | no |
| Azzera stato cassetto | `openTrayReset()` |  | modifica, vicini 7 e 9, liv2: sì<br>modifica, reset aperto: sì | stato: vm.trayReset.open = true | Azzera → fetch POST api/conf/position/resetTray/8<br>Annulla → – |
| Dichiara contenuto | `openTrayType()` |  | modifica, vicini 7 e 9, liv2: sì<br>modifica, reset aperto: sì | stato: vm.trayType.open = true, vm.trayType.pieceId = 1035 | Dichiara → fetch POST api/conf/position/declareTrayType/8/1035<br>Annulla → – |
| Azzera | `trayReset.busy ? '' : confirmTrayReset()` | `[trayReset.busy ? 'pure-button-disable' : 'pure-button-mission']` | modifica, vicini 7 e 9, liv2: –<br>modifica, reset aperto: sì | fetch POST api/conf/position/resetTray/8 | no |
| Annulla | `trayReset.open=false` |  | modifica, vicini 7 e 9, liv2: –<br>modifica, reset aperto: sì | stato: vm.trayReset.open = false | no |
| Dichiara | `(trayType.busy \|\| !(trayType.pieceId > 0)) ? '' : confirmTrayType()` | `[trayType.busy \|\| !(trayType.pieceId > 0) ? 'pure-button-disable' : 'pure-button-mission']` | modifica, vicini 7 e 9, liv2: –<br>modifica, reset aperto: – |  | no |
| Annulla | `trayType.open=false` |  | modifica, vicini 7 e 9, liv2: –<br>modifica, reset aperto: – |  | no |
| Salva {{avanzamento}} | `saveAllData()` |  | modifica, vicini 7 e 9, liv2: sì<br>modifica, reset aperto: sì | fetch GET api/conf/position/updatePositionStatus/8/1/4<br>fetch GET api/conf/position/updatePositionStatus/8/2/2<br>fetch GET api/conf/tray/layout/8 | no |

## layoutView (sola lettura) (`src/views/layoutView.vue`)

Scenari: sola lettura liv0

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Cassetto {{neighbors.prev.floor}} | `goNeighbor('prev')` | `!neighbors.prev \|\| navBlocked` | sola lettura liv0: sì | router "/layout/21/0/7" | no |
| Cassetto {{neighbors.next.floor}} | `goNeighbor('next')` | `!neighbors.next \|\| navBlocked` | sola lettura liv0: sì | router "/layout/23/0/9" | no |
| Scarta e cambia cassetto | `confirmDiscard()` |  | sola lettura liv0: – |  | no |
| Annulla | `navConfirm = null` |  | sola lettura liv0: – |  | no |
| (pick) | `clickPiece($event.index)` |  | sola lettura liv0: sì | stato: dataStored.alert.title = "ATTENTION", dataStored.alert.desc = "VIEW ONLY!" | no |
| Tutti grezzi | `allRaugh()` |  | sola lettura liv0: – |  | no |
| Tutti vuoti | `allEmpty()` |  | sola lettura liv0: – |  | no |
| Azzera stato cassetto | `openTrayReset()` |  | sola lettura liv0: – |  | no |
| Dichiara contenuto | `openTrayType()` |  | sola lettura liv0: – |  | no |
| Azzera | `trayReset.busy ? '' : confirmTrayReset()` | `[trayReset.busy ? 'pure-button-disable' : 'pure-button-mission']` | sola lettura liv0: – |  | no |
| Annulla | `trayReset.open=false` |  | sola lettura liv0: – |  | no |
| Dichiara | `(trayType.busy \|\| !(trayType.pieceId > 0)) ? '' : confirmTrayType()` | `[trayType.busy \|\| !(trayType.pieceId > 0) ? 'pure-button-disable' : 'pure-button-mission']` | sola lettura liv0: – |  | no |
| Annulla | `trayType.open=false` |  | sola lettura liv0: – |  | no |
| Salva {{avanzamento}} | `saveAllData()` |  | sola lettura liv0: – |  | no |

## TraysView (`src/views/conf/TraysView.vue`)

Scenari: due cassetti liv2 · due cassetti liv0

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| {{dt.FAMILY}} | `goToLayout(dt.ID, dt.EXTRACT, dt.STATUS, dt.FLOOR_MAG)` |  | due cassetti liv2: sì<br>due cassetti liv0: sì | router "/layout/21/1/7" | no |
| Associa | `openAssoc('associate', dt)` | `!assocAllowed(dt)` | due cassetti liv2: –<br>due cassetti liv0: – |  | no |
| Sostituisci | `openAssoc('replace', dt)` | `!assocAllowed(dt)` | due cassetti liv2: sì<br>due cassetti liv0: no | fetch GET api/conf/grating/show/all<br>fetch GET api/conf/position/show/all<br>fetch GET api/conf/piece/show/all | {{(g.NAME\|\|'').trim()}} - {{(g.DESCR\|\|'').trim()}} → –<br># {{p.ID}} {{(p.FAMILY\|\|'').trim()}} - {{(p.DESCR\|\|'').trim()}} → –<br>{{$t('tray.assoc.confirm.'+assoc.mode)}} → –<br>Annulla → – |
| Rigenera tasche | `openAssoc('regenerate', dt)` | `!assocAllowed(dt)` | due cassetti liv2: sì<br>due cassetti liv0: no | fetch GET api/conf/grating/show/all<br>fetch GET api/conf/position/show/all<br>fetch GET api/conf/piece/show/all | # {{p.ID}} {{(p.FAMILY\|\|'').trim()}} - {{(p.DESCR\|\|'').trim()}} → –<br>{{$t('tray.assoc.confirm.'+assoc.mode)}} → –<br>Annulla → – |
| Dissocia | `openAssoc('dissociate', dt)` | `!assocAllowed(dt)` | due cassetti liv2: sì<br>due cassetti liv0: no | fetch GET api/conf/grating/show/all<br>fetch GET api/conf/position/show/all<br>fetch GET api/conf/piece/show/all | {{$t('tray.assoc.confirm.'+assoc.mode)}} → fetch POST api/conf/tray/dissociateGrating/7<br>Annulla → – |
| (cmdModify) | `updateTray(dt.ID)` |  | due cassetti liv2: sì<br>due cassetti liv0: sì | router "/conf/tray?trayID=21" | no |
| (cmdMove) | `sendToBox(dt.EXTRACT, dt.FLOOR_MAG)` |  | due cassetti liv2: sì<br>due cassetti liv0: sì | emit TO_PLANT/CMD/BOX "25;7" | no |
| (riprova) | `getDataTable()` |  | due cassetti liv2: sì<br>due cassetti liv0: sì | fetch GET api/conf/tray/show/all | no |
| {{(g.NAME\|\|'').trim()}} - {{(g.DESCR\|\|'').trim()}} | `onAssocGratingChange()` |  | due cassetti liv2: –<br>due cassetti liv0: – |  | no |
| # {{p.ID}} {{(p.FAMILY\|\|'').trim()}} - {{(p.DESCR\|\|'').trim()}} | `onAssocGratingChange()` |  | due cassetti liv2: –<br>due cassetti liv0: – |  | no |
| {{$t('tray.assoc.copyFrom', { n: c.floor, k: c.n })}} proposto | `assoc.sourceFloor=c.floor` | `{ selected: assoc.sourceFloor===c.floor }` | due cassetti liv2: –<br>due cassetti liv0: – |  | no |
| {{$t('tray.assoc.confirm.'+assoc.mode)}} | `assocReady ? confirmAssoc() : ''` | `[assocReady ? 'pure-button-mission' : 'pure-button-disable']` | due cassetti liv2: –<br>due cassetti liv0: – |  | no |
| Annulla | `closeAssoc()` |  | due cassetti liv2: –<br>due cassetti liv0: – |  | no |

## TrayPockets (`src/components/layout/TrayPockets.vue`)

Scenari: una tasca

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| (click) | `tap($event)` |  | una tasca: sì | – | no |
| {{p.SUB_POS != null ? p.SUB_POS : index+1}} | `pick(index)` |  | una tasca: sì | evento pick [{"index":0,"subPos":1,"status":4,"orderID":0,"w":50,"h":65}] | no |
| {{p.SUB_POS != null ? p.SUB_POS : index+1}} | `pick(index)` |  | una tasca: – |  | no |
| (click) | `pick(index)` |  | una tasca: sì | evento pick [{"index":0,"subPos":1,"status":4,"orderID":0,"w":50,"h":65}] | no |

## StatusStrip (`src/layout/v3/StatusStrip.vue`)

Scenari: robot in HOLD · robot in lavoro · robot in AUTO · robot spento · stato non ancora noto · NOT_DEFINED (0)

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| {{t('changeUser.levelLabel.' + livello)}} | `$emit('open-user')` |  | robot in HOLD: sì<br>robot in lavoro: sì<br>robot in AUTO: sì<br>robot spento: sì<br>stato non ancora noto: sì<br>NOT_DEFINED (0): sì | evento open-user | no |
| {{locale.toUpperCase()}} | `cambiaLingua` |  | robot in HOLD: sì<br>robot in lavoro: sì<br>robot in AUTO: sì<br>robot spento: sì<br>stato non ancora noto: sì<br>NOT_DEFINED (0): sì | – | no |
| — {{plant.robot == dataStored.status_hold ? t('strip.resume') : t('cmd.hold')}} | `sendToRobot(17)` | `ignoto` | robot in HOLD: sì<br>robot in lavoro: sì<br>robot in AUTO: sì<br>robot spento: –<br>stato non ancora noto: no<br>NOT_DEFINED (0): no | emit TO_PLANT/CMD/ROBOT 17 | no |
| {{t('cmd.start')}} | `sendToRobot(17)` |  | robot in HOLD: –<br>robot in lavoro: –<br>robot in AUTO: –<br>robot spento: sì<br>stato non ancora noto: –<br>NOT_DEFINED (0): – | emit TO_PLANT/CMD/ROBOT 17 | no |

