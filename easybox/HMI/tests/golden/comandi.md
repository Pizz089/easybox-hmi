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
| Chele pinza | `rvTab='claw'` | `{ on: rvTab=='claw' }` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: sì<br>OFF liv2: sì<br>STATUS ignoto liv2: sì<br>NOT_DEFINED liv2: sì | stato: vm.rvTab = "claw" | no |
| Posizione di home | `dataStored.cmdActive==1?sendMission('home',20):''` | `dataStored.cmdActive==0` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT 20 | no |
| Posizione per la manutenzione | `dataStored.cmdActive==1?sendMission('maintenance',21):''` | `dataStored.cmdActive==0` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT 21 | no |
| {{$t('robot.goTo', { dest: $t('Easybox') })}} | `dataStored.cmdActive==1?sendMission('dest-easybox','15;1'):''` | `dataStored.cmdActive==0` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT "15;1" | no |
| {{$t('robot.goTo', { dest: $t(pos.labelKey) })}} | `dataStored.cmdActive==1?sendMission('dest-'+pos.mc.toLowerCase(),'15;'+(10+pos.n)):''` | `dataStored.cmdActive==0` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT "15;11" | no |
| Apri chela | `clawEnabled(side) ? openClawDialog(side) : ''` | `!clawEnabled(side)` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.clawDialog.side = 1 |  → emit TO_PLANT/CMD/ROBOT "240"<br> → – |
| Chiudi chela | `clawEnabled(side) ? sendClaw(side, false) : ''` | `!clawEnabled(side)` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | emit TO_PLANT/CMD/ROBOT "241" | no |
| Gestione pinza {{$t(gripperDisabledReason)}} | `gripperBranchEnabled?openGripperMission():''` | `!gripperBranchEnabled` | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: no<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | stato: vm.unloadOpen = true | Deposita e cambia → –<br>Conferma → emit TO_PLANT/CMD/ROBOT 12, fetch GET api/conf/gripper/show/all, fetch GET api/conf/pallet/show/all, fetch GET api/conf/tray/show/all<br>Annulla → – |
| Gestione pallet {{$t(palletDisabledReason)}} | `palletBranchEnabled?openPalletMission():''` | `!palletBranchEnabled` | HOLD liv2: no<br>HOLD liv0: no<br>HOLD liv2 cassetto 8 fuori: no<br>AUTO liv2: no<br>OFF liv2: no<br>STATUS ignoto liv2: no<br>NOT_DEFINED liv2: no | – | no |
| Dichiara quale pallet è in pinza | `openPalletDecl()` |  | HOLD liv2: sì<br>HOLD liv0: sì<br>HOLD liv2 cassetto 8 fuori: sì<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – | fetch GET api/conf/pallet/show/all | Conferma → –<br>Annulla → – |
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
| Cassetto {{item.FLOOR_MAG}} {{(item.FAMILY \|\| '').trim()}} Slot {{item.SUB_POS}} {{(item.DESCR \|\| '').trim()}} Posizione | `palletItemBlocked(item) ? '' : dialog.selected=item` | `palletItemBlocked(item)` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Conferma | `dialogConfirmEnabled?confirmDialog():''` | `[!dialogConfirmEnabled? 'pure-button-disable' : 'pure-button-mission']` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Annulla | `closeDialog()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Deposita e cambia | `startSwapSelection()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Conferma | `confirmUnload()` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Annulla | `unloadOpen=false` |  | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Conferma | `(palletDecl.sel>0 && !palletDecl.waiting)? confirmPalletDecl() : ''` | `[(palletDecl.sel>0 && !palletDecl.waiting)? 'pure-button-mission' : 'pure-button-disable']` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |
| Annulla | `closePalletDecl()` | `palletDecl.waiting` | HOLD liv2: –<br>HOLD liv0: –<br>HOLD liv2 cassetto 8 fuori: –<br>AUTO liv2: –<br>OFF liv2: –<br>STATUS ignoto liv2: –<br>NOT_DEFINED liv2: – |  | no |

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

Scenari: liv2 · liv0 · liv2, menu · liv0, menu

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| (click) | `apriMenuPagina()` |  | liv2: sì<br>liv0: sì<br>liv2, menu: sì<br>liv0, menu: sì | stato: vm.menuPagina = true | no |
| (click) | `menuPagina = false` |  | liv2: –<br>liv0: –<br>liv2, menu: sì<br>liv0, menu: sì | stato: vm.menuPagina = false | no |
| Azzera produzione | `menuPagina = false` |  | liv2: –<br>liv0: –<br>liv2, menu: sì<br>liv0, menu: sì | stato: vm.menuPagina = false | no |
| Azzera produzione | `openResetDialog` | `dataStored.userLevel == 0` | liv2: –<br>liv0: –<br>liv2, menu: sì<br>liv0, menu: no | fetch GET api/order/resetProduction/preview/1 | Azzera → fetch POST api/order/resetProduction/1<br>Annulla → – |
| Aggiungi ordine | `navigateToWizard` | `dataStored.userLevel == 0` | liv2: sì<br>liv0: no<br>liv2, menu: sì<br>liv0, menu: no | router "/selectRig" | no |
| {{$t(pos.labelKey)}} | `loadPreview()` |  | liv2: –<br>liv0: –<br>liv2, menu: –<br>liv0, menu: – |  | no |
| Azzera | `resetConfirmEnabled ? confirmReset() : ''` | `[resetConfirmEnabled ? 'pure-button-mission' : 'pure-button-disable']` | liv2: –<br>liv0: –<br>liv2, menu: –<br>liv0, menu: – |  | no |
| Annulla | `closeResetDialog()` |  | liv2: –<br>liv0: –<br>liv2, menu: –<br>liv0, menu: – |  | no |

## productionTable (`src/components/productionTable.vue`)

Scenari: tre ordini liv2 · tre ordini, popup elimina aperto · tre ordini liv2, menu 101 · tre ordini, popup elimina aperto, menu 101 · tre ordini liv2, menu 102 · tre ordini, popup elimina aperto, menu 102 · tre ordini liv2, menu 103 · tre ordini, popup elimina aperto, menu 103

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Ferma | `modifyOrderStatus(o.ID,dataStored.status_raw,o.PIECE_ID)` |  | tre ordini liv2: sì<br>tre ordini, popup elimina aperto: sì<br>tre ordini liv2, menu 101: sì<br>tre ordini, popup elimina aperto, menu 101: sì<br>tre ordini liv2, menu 102: sì<br>tre ordini, popup elimina aperto, menu 102: sì<br>tre ordini liv2, menu 103: sì<br>tre ordini, popup elimina aperto, menu 103: sì | emit TO_PLANT/CMD/ORDER {"id":102,"status":4,"pieceID":2} | no |
| Avvia | `modifyOrderStatus(o.ID,dataStored.status_working,o.PIECE_ID)` |  | tre ordini liv2: sì<br>tre ordini, popup elimina aperto: sì<br>tre ordini liv2, menu 101: sì<br>tre ordini, popup elimina aperto, menu 101: sì<br>tre ordini liv2, menu 102: sì<br>tre ordini, popup elimina aperto, menu 102: sì<br>tre ordini liv2, menu 103: sì<br>tre ordini, popup elimina aperto, menu 103: sì | emit TO_PLANT/CMD/ORDER {"id":101,"status":3,"pieceID":1}<br>fetch GET api/conf/gripper/show/all | no |
| Rilancia | `relaunchOrder = o` |  | tre ordini liv2: sì<br>tre ordini, popup elimina aperto: sì<br>tre ordini liv2, menu 101: sì<br>tre ordini, popup elimina aperto, menu 101: sì<br>tre ordini liv2, menu 102: sì<br>tre ordini, popup elimina aperto, menu 102: sì<br>tre ordini liv2, menu 103: sì<br>tre ordini, popup elimina aperto, menu 103: sì | stato: vm.relaunchOrder = {"ID":103,"PIECE":"PZ-C","PIECE_DESC":"prova","MACHINE_ID":1,"STATUS":5,"STATUS_ |  → – |
| (click) | `apriMenu(o.ID)` |  | tre ordini liv2: sì<br>tre ordini, popup elimina aperto: sì<br>tre ordini liv2, menu 101: sì<br>tre ordini, popup elimina aperto, menu 101: sì<br>tre ordini liv2, menu 102: sì<br>tre ordini, popup elimina aperto, menu 102: sì<br>tre ordini liv2, menu 103: sì<br>tre ordini, popup elimina aperto, menu 103: sì | stato: vm.menuOrdine = 101 | no |
| Avvia Ferma Cancella | `menuOrdine = null` |  | tre ordini liv2: –<br>tre ordini, popup elimina aperto: –<br>tre ordini liv2, menu 101: sì<br>tre ordini, popup elimina aperto, menu 101: sì<br>tre ordini liv2, menu 102: sì<br>tre ordini, popup elimina aperto, menu 102: sì<br>tre ordini liv2, menu 103: sì<br>tre ordini, popup elimina aperto, menu 103: sì | stato: vm.menuOrdine = null | no |
| Avvia | `modifyOrderStatus(o.ID,dataStored.status_working,o.PIECE_ID)` |  | tre ordini liv2: –<br>tre ordini, popup elimina aperto: –<br>tre ordini liv2, menu 101: –<br>tre ordini, popup elimina aperto, menu 101: –<br>tre ordini liv2, menu 102: sì<br>tre ordini, popup elimina aperto, menu 102: sì<br>tre ordini liv2, menu 103: sì<br>tre ordini, popup elimina aperto, menu 103: sì | emit TO_PLANT/CMD/ORDER {"id":102,"status":3,"pieceID":2}<br>fetch GET api/conf/gripper/show/all | no |
| Ferma | `modifyOrderStatus(o.ID,dataStored.status_raw,o.PIECE_ID)` |  | tre ordini liv2: –<br>tre ordini, popup elimina aperto: –<br>tre ordini liv2, menu 101: sì<br>tre ordini, popup elimina aperto, menu 101: sì<br>tre ordini liv2, menu 102: –<br>tre ordini, popup elimina aperto, menu 102: –<br>tre ordini liv2, menu 103: sì<br>tre ordini, popup elimina aperto, menu 103: sì | emit TO_PLANT/CMD/ORDER {"id":101,"status":4,"pieceID":1} | no |
| Cancella | `chiediCancella(o)` | `o.STATUS_DESC=='WORKING'` | tre ordini liv2: –<br>tre ordini, popup elimina aperto: –<br>tre ordini liv2, menu 101: sì<br>tre ordini, popup elimina aperto, menu 101: sì<br>tre ordini liv2, menu 102: no<br>tre ordini, popup elimina aperto, menu 102: no<br>tre ordini liv2, menu 103: sì<br>tre ordini, popup elimina aperto, menu 103: sì | stato: vm.showPopUp = 101 | Cancella → fetch DELETE api/order/101<br>Annulla → – |
| Cancella | `deleteOrder(o.ID)` |  | tre ordini liv2: –<br>tre ordini, popup elimina aperto: sì<br>tre ordini liv2, menu 101: –<br>tre ordini, popup elimina aperto, menu 101: sì<br>tre ordini liv2, menu 102: –<br>tre ordini, popup elimina aperto, menu 102: sì<br>tre ordini liv2, menu 103: –<br>tre ordini, popup elimina aperto, menu 103: sì | fetch DELETE api/order/101 | no |
| Annulla | `showPopUp=0` |  | tre ordini liv2: –<br>tre ordini, popup elimina aperto: sì<br>tre ordini liv2, menu 101: –<br>tre ordini, popup elimina aperto, menu 101: sì<br>tre ordini liv2, menu 102: –<br>tre ordini, popup elimina aperto, menu 102: sì<br>tre ordini liv2, menu 103: –<br>tre ordini, popup elimina aperto, menu 103: sì | stato: vm.showPopUp = 0 | no |
| (riprova) | `getDataTable()` |  | tre ordini liv2: –<br>tre ordini, popup elimina aperto: –<br>tre ordini liv2, menu 101: –<br>tre ordini, popup elimina aperto, menu 101: –<br>tre ordini liv2, menu 102: –<br>tre ordini, popup elimina aperto, menu 102: –<br>tre ordini liv2, menu 103: –<br>tre ordini, popup elimina aperto, menu 103: – |  | no |
| (close) | `relaunchOrder = null` |  | tre ordini liv2: –<br>tre ordini, popup elimina aperto: –<br>tre ordini liv2, menu 101: –<br>tre ordini, popup elimina aperto, menu 101: –<br>tre ordini liv2, menu 102: –<br>tre ordini, popup elimina aperto, menu 102: –<br>tre ordini liv2, menu 103: –<br>tre ordini, popup elimina aperto, menu 103: – |  | no |

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
| (pick) | `toccaTasca($event)` |  | modifica, vicini 7 e 9, liv2: sì<br>modifica, reset aperto: sì | stato: vm.listPz = [{"SUB_POS":1,"x":65,"y":50,"status":5,"prisma":true,"order_ID":0,"partType":103 | no |
| (tap) | `toccaVassoio($event)` |  | modifica, vicini 7 e 9, liv2: sì<br>modifica, reset aperto: sì | – | no |
| (scale) | `scala($event)` |  | modifica, vicini 7 e 9, liv2: sì<br>modifica, reset aperto: sì | stato: vm.scalaPiena = undefined | no |
| Tutto il cassetto | `zona = null` |  | modifica, vicini 7 e 9, liv2: –<br>modifica, reset aperto: – |  | no |
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
| (pick) | `toccaTasca($event)` |  | sola lettura liv0: sì | stato: dataStored.alert.title = "ATTENTION", dataStored.alert.desc = "VIEW ONLY!" | no |
| (tap) | `toccaVassoio($event)` |  | sola lettura liv0: sì | – | no |
| (scale) | `scala($event)` |  | sola lettura liv0: sì | stato: vm.scalaPiena = undefined | no |
| Tutto il cassetto | `zona = null` |  | sola lettura liv0: – |  | no |
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

Scenari: due cassetti liv2 · due cassetti liv0 · due cassetti liv2, scelto 7 · due cassetti liv2, scelto 8 · due cassetti liv0, scelto 7 · due cassetti liv0, scelto 8

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| {{dt.FLOOR_MAG > 0 ? dt.FLOOR_MAG : $t('common.out')}} {{geoPiano(dt).rows}} × {{geoPiano(dt).cols}} – {{contenutoPiano( | `scegli(dt)` | `{ on: sel && dt.ID === sel.ID }` | due cassetti liv2: sì<br>due cassetti liv0: sì<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: sì | stato: vm.selFloor = 8 | no |
| (riprova) | `getDataTable()` |  | due cassetti liv2: sì<br>due cassetti liv0: sì<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: sì | fetch GET api/conf/tray/show/all | no |
| Cassetto {{vicini.prev.floor}} | `scegliPiano(vicini.prev)` | `!vicini.prev` | due cassetti liv2: sì<br>due cassetti liv0: sì<br>due cassetti liv2, scelto 7: no<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: no<br>due cassetti liv0, scelto 8: sì | stato: vm.selFloor = 7 | no |
| Cassetto {{vicini.next.floor}} | `scegliPiano(vicini.next)` | `!vicini.next` | due cassetti liv2: no<br>due cassetti liv0: no<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: no<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: no | stato: vm.selFloor = 8 | no |
| (pick) | `toccaTasca($event)` |  | due cassetti liv2: sì<br>due cassetti liv0: sì<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: sì | stato: vm.tascaScelta = {"index":0,"subPos":1,"status":4,"orderID":0} | no |
| (tap) | `toccaVassoio($event)` |  | due cassetti liv2: sì<br>due cassetti liv0: sì<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: sì | – | no |
| (scale) | `scala($event)` |  | due cassetti liv2: sì<br>due cassetti liv0: sì<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: sì | stato: vm.scalaPiena = undefined | no |
| Tutto il cassetto | `zona = null` |  | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: –<br>due cassetti liv2, scelto 8: –<br>due cassetti liv0, scelto 7: –<br>due cassetti liv0, scelto 8: – |  | no |
| Chiudi | `tascaScelta = null` |  | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: –<br>due cassetti liv2, scelto 8: –<br>due cassetti liv0, scelto 7: –<br>due cassetti liv0, scelto 8: – |  | no |
| {{$t(apreInLettura(sel) ? 'trays.viewPockets' : 'trays.editPockets')}} | `goToLayout(sel.ID, sel.EXTRACT, sel.STATUS, sel.FLOOR_MAG)` |  | due cassetti liv2: sì<br>due cassetti liv0: sì<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: sì | router "/layout/22/0/8" | no |
| Scheda cassetto | `scheda(sel)` |  | due cassetti liv2: sì<br>due cassetti liv0: sì<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: sì | router "/conf/tray?trayID=22" | no |
| Estrai o rilascia dai Controlli Robot Estrai / rilascia | `$router.push('/unit/robot')` |  | due cassetti liv2: sì<br>due cassetti liv0: sì<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: sì | router "/unit/robot" | no |
| Associa | `openAssoc('associate', sel)` | `!assocAllowed(sel)` | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: –<br>due cassetti liv2, scelto 8: –<br>due cassetti liv0, scelto 7: –<br>due cassetti liv0, scelto 8: – |  | no |
| (click) | `apriMenuGrigliato()` |  | due cassetti liv2: sì<br>due cassetti liv0: sì<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: sì | stato: vm.menuGrigliato = true | no |
| (click) | `menuGrigliato = false` |  | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: sì | stato: vm.menuGrigliato = false | no |
| Grigliato {{(sel.FAMILY\|\|'').trim()}} Sostituisci Rigenera tasche Dissocia | `menuGrigliato = false` |  | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: sì<br>due cassetti liv0, scelto 7: sì<br>due cassetti liv0, scelto 8: sì | stato: vm.menuGrigliato = false | no |
| Sostituisci | `openAssoc('replace', sel)` | `!assocAllowed(sel)` | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: no<br>due cassetti liv0, scelto 7: no<br>due cassetti liv0, scelto 8: no | fetch GET api/conf/grating/show/all<br>fetch GET api/conf/position/show/all<br>fetch GET api/conf/piece/show/all | {{(g.NAME\|\|'').trim()}} - {{(g.DESCR\|\|'').trim()}} → –<br># {{p.ID}} {{(p.FAMILY\|\|'').trim()}} - {{(p.DESCR\|\|'').trim()}} → –<br>{{$t('tray.assoc.confirm.'+assoc.mode)}} → –<br>Annulla → – |
| Rigenera tasche | `openAssoc('regenerate', sel)` | `!assocAllowed(sel)` | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: no<br>due cassetti liv0, scelto 7: no<br>due cassetti liv0, scelto 8: no | fetch GET api/conf/grating/show/all<br>fetch GET api/conf/position/show/all<br>fetch GET api/conf/piece/show/all | # {{p.ID}} {{(p.FAMILY\|\|'').trim()}} - {{(p.DESCR\|\|'').trim()}} → –<br>{{$t('tray.assoc.confirm.'+assoc.mode)}} → –<br>Annulla → – |
| Dissocia | `openAssoc('dissociate', sel)` | `!assocAllowed(sel)` | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: sì<br>due cassetti liv2, scelto 8: no<br>due cassetti liv0, scelto 7: no<br>due cassetti liv0, scelto 8: no | fetch GET api/conf/grating/show/all<br>fetch GET api/conf/position/show/all<br>fetch GET api/conf/piece/show/all | {{$t('tray.assoc.confirm.'+assoc.mode)}} → fetch POST api/conf/tray/dissociateGrating/7<br>Annulla → – |
| {{(g.NAME\|\|'').trim()}} - {{(g.DESCR\|\|'').trim()}} | `onAssocGratingChange()` |  | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: –<br>due cassetti liv2, scelto 8: –<br>due cassetti liv0, scelto 7: –<br>due cassetti liv0, scelto 8: – |  | no |
| # {{p.ID}} {{(p.FAMILY\|\|'').trim()}} - {{(p.DESCR\|\|'').trim()}} | `onAssocGratingChange()` |  | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: –<br>due cassetti liv2, scelto 8: –<br>due cassetti liv0, scelto 7: –<br>due cassetti liv0, scelto 8: – |  | no |
| {{$t('tray.assoc.copyFrom', { n: c.floor, k: c.n })}} proposto | `assoc.sourceFloor=c.floor` | `{ selected: assoc.sourceFloor===c.floor }` | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: –<br>due cassetti liv2, scelto 8: –<br>due cassetti liv0, scelto 7: –<br>due cassetti liv0, scelto 8: – |  | no |
| {{$t('tray.assoc.confirm.'+assoc.mode)}} | `assocReady ? confirmAssoc() : ''` | `[assocReady ? 'pure-button-mission' : 'pure-button-disable']` | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: –<br>due cassetti liv2, scelto 8: –<br>due cassetti liv0, scelto 7: –<br>due cassetti liv0, scelto 8: – |  | no |
| Annulla | `closeAssoc()` |  | due cassetti liv2: –<br>due cassetti liv0: –<br>due cassetti liv2, scelto 7: –<br>due cassetti liv2, scelto 8: –<br>due cassetti liv0, scelto 7: –<br>due cassetti liv0, scelto 8: – |  | no |

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
| (load) | `misura` |  | robot in HOLD: sì<br>robot in lavoro: sì<br>robot in AUTO: sì<br>robot spento: sì<br>stato non ancora noto: sì<br>NOT_DEFINED (0): sì | – | no |
| {{t('changeUser.levelLabel.' + livello)}} | `$emit('open-user')` |  | robot in HOLD: sì<br>robot in lavoro: sì<br>robot in AUTO: sì<br>robot spento: sì<br>stato non ancora noto: sì<br>NOT_DEFINED (0): sì | evento open-user | no |
| {{locale.toUpperCase()}} | `cambiaLingua` |  | robot in HOLD: sì<br>robot in lavoro: sì<br>robot in AUTO: sì<br>robot spento: sì<br>stato non ancora noto: sì<br>NOT_DEFINED (0): sì | – | no |
| — {{plant.robot == dataStored.status_hold ? t('strip.resume') : t('cmd.hold')}} | `premi` | `ignoto \|\| holdGuard.attesa` | robot in HOLD: sì<br>robot in lavoro: sì<br>robot in AUTO: sì<br>robot spento: –<br>stato non ancora noto: no<br>NOT_DEFINED (0): no | emit TO_PLANT/CMD/ROBOT 17 | no |
| {{t('cmd.start')}} | `premi` | `holdGuard.attesa` | robot in HOLD: –<br>robot in lavoro: –<br>robot in AUTO: –<br>robot spento: sì<br>stato non ancora noto: –<br>NOT_DEFINED (0): – | emit TO_PLANT/CMD/ROBOT 17 | no |

## AttrezzaggiView (`src/views/conf/AttrezzaggiView.vue`)

Scenari: tre pallet liv2 · tre pallet liv1 · tre pallet liv0 · ordine attivo sul 901 · anomalia 904 e pallet nudo 905 · smonta morsa 911 dal 901, in conferma · smonta attrezzatura 924 dal 904, in conferma · modifica del 901 a magazzino, in conferma · posiziona 901, niente scelto · posiziona 901, posto 20 · posiziona 901, fuori magazzino · posiziona 901, macchina 1 occupata · posiziona 903, macchina 1 libera

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Nuovo attrezzaggio | `$router.push('/conf/Attrezzaggio')` | `dataStored.userLevel<=1` | tre pallet liv2: sì<br>tre pallet liv1: no<br>tre pallet liv0: no<br>ordine attivo sul 901: sì<br>anomalia 904 e pallet nudo 905: sì<br>smonta morsa 911 dal 901, in conferma: sì<br>smonta attrezzatura 924 dal 904, in conferma: sì<br>modifica del 901 a magazzino, in conferma: sì<br>posiziona 901, niente scelto: sì<br>posiziona 901, posto 20: sì<br>posiziona 901, fuori magazzino: sì<br>posiziona 901, macchina 1 occupata: sì<br>posiziona 903, macchina 1 libera: sì | router "/conf/Attrezzaggio" | no |
| Posiziona | `openPlace(row.pallet)` |  | tre pallet liv2: sì<br>tre pallet liv1: sì<br>tre pallet liv0: sì<br>ordine attivo sul 901: sì<br>anomalia 904 e pallet nudo 905: sì<br>smonta morsa 911 dal 901, in conferma: sì<br>smonta attrezzatura 924 dal 904, in conferma: sì<br>modifica del 901 a magazzino, in conferma: sì<br>posiziona 901, niente scelto: sì<br>posiziona 901, posto 20: sì<br>posiziona 901, fuori magazzino: sì<br>posiziona 901, macchina 1 occupata: sì<br>posiziona 903, macchina 1 libera: sì | stato: vm.placeTarget = {"ID":901,"FAMILY":"PAL-PROVA","DESCR":"pallet prova A","X":400000,"Y":400000,"Z | {{n}} # {{occupantOf(n).ID}} {{(occupantOf(n).FAMILY \|\| '').trim()}} disabilitata → –<br>{{n}} # {{occupantOf(n).ID}} {{(occupantOf(n).FAMILY \|\| '').trim()}} disabilitata → –<br>{{n}} # {{occupantOf(n).ID}} {{(occupantOf(n).FAMILY \|\| '').trim()}} disabilitata → –<br>Rimuovi dal magazzino ( Fuori Magazzino ) → –<br>{{$t('attrezzaggi.inMachine', { mc: $t(mpos.labelKey) })}} {{machineBlock(mpos.n)}} → –<br>A bordo del robot → –<br>Conferma → –<br>Annulla → – |
| Modifica | `askEdit(row)` | `rowBlockReason(row)!=''` | tre pallet liv2: sì<br>tre pallet liv1: sì<br>tre pallet liv0: sì<br>ordine attivo sul 901: no<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: sì<br>smonta attrezzatura 924 dal 904, in conferma: –<br>modifica del 901 a magazzino, in conferma: sì<br>posiziona 901, niente scelto: sì<br>posiziona 901, posto 20: sì<br>posiziona 901, fuori magazzino: sì<br>posiziona 901, macchina 1 occupata: sì<br>posiziona 903, macchina 1 libera: sì | stato: vm.pendingEdit = 901 | Modifica → router "/conf/Attrezzaggio?edit=901"<br>Annulla → – |
| Smonta morsa | `askUnmount('vice', row.pallet.ID, row.vice.ID)` | `rowBlockReason(row)!=''` | tre pallet liv2: sì<br>tre pallet liv1: sì<br>tre pallet liv0: sì<br>ordine attivo sul 901: no<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: sì<br>smonta attrezzatura 924 dal 904, in conferma: –<br>modifica del 901 a magazzino, in conferma: sì<br>posiziona 901, niente scelto: sì<br>posiziona 901, posto 20: sì<br>posiziona 901, fuori magazzino: sì<br>posiziona 901, macchina 1 occupata: sì<br>posiziona 903, macchina 1 libera: sì | stato: vm.pending = {"type":"vice","palletID":901,"id":911} | SMONTA → fetch GET api/conf/vice/updateVice?ID=911&FAMILY=MORSA-PROVA&DESCR=morsa+prova+A&STATUS=2&X=150000&Y=100000&Z=80000&Z_CLAW=5000&Z_SINK_CLAW=1000&MAG=1&MAG_POS=1&POS_PLANT=0&PALLET_ID=, fetch GET api/conf/pallet/show/all, fetch GET api/conf/vice/show/all, fetch GET api/conf/fixture/show/all, fetch GET api/conf/fixture/showFixtureOnPallet/all, fetch GET api/conf/position/showWarehouse/WPALLET, fetch GET api/order/show/all<br>Annulla → – |
| Smonta attrezzatura {{row.fixtures.length>1 ? '#'+f.FIXTURE_ID : ''}} | `askUnmount('fixture', row.pallet.ID, f.FIXTURE_ID)` | `rowBlockReason(row)!=''` | tre pallet liv2: sì<br>tre pallet liv1: sì<br>tre pallet liv0: sì<br>ordine attivo sul 901: no<br>anomalia 904 e pallet nudo 905: sì<br>smonta morsa 911 dal 901, in conferma: sì<br>smonta attrezzatura 924 dal 904, in conferma: sì<br>modifica del 901 a magazzino, in conferma: sì<br>posiziona 901, niente scelto: sì<br>posiziona 901, posto 20: sì<br>posiziona 901, fuori magazzino: sì<br>posiziona 901, macchina 1 occupata: sì<br>posiziona 903, macchina 1 libera: sì | stato: vm.pending = {"type":"fixture","palletID":901,"id":921} | SMONTA → fetch DELETE api/conf/fixture/fixtureOnPallet/901/921, fetch GET api/conf/pallet/show/all, fetch GET api/conf/vice/show/all, fetch GET api/conf/fixture/show/all, fetch GET api/conf/fixture/showFixtureOnPallet/all, fetch GET api/conf/position/showWarehouse/WPALLET, fetch GET api/order/show/all<br>Annulla → – |
| SMONTA | `confirmUnmount()` |  | tre pallet liv2: –<br>tre pallet liv1: –<br>tre pallet liv0: –<br>ordine attivo sul 901: –<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: sì<br>smonta attrezzatura 924 dal 904, in conferma: sì<br>modifica del 901 a magazzino, in conferma: –<br>posiziona 901, niente scelto: –<br>posiziona 901, posto 20: –<br>posiziona 901, fuori magazzino: –<br>posiziona 901, macchina 1 occupata: –<br>posiziona 903, macchina 1 libera: – | fetch GET api/conf/vice/updateVice?ID=911&FAMILY=MORSA-PROVA&DESCR=morsa+prova+A&STATUS=2&X=150000&Y=100000&Z=80000&Z_CLAW=5000&Z_SINK_CLAW=1000&MAG=1&MAG_POS=1&POS_PLANT=0&PALLET_ID=<br>fetch GET api/conf/pallet/show/all<br>fetch GET api/conf/vice/show/all<br>fetch GET api/conf/fixture/show/all<br>fetch GET api/conf/fixture/showFixtureOnPallet/all<br>fetch GET api/conf/position/showWarehouse/WPALLET<br>fetch GET api/order/show/all | no |
| Annulla | `pending=null` |  | tre pallet liv2: –<br>tre pallet liv1: –<br>tre pallet liv0: –<br>ordine attivo sul 901: –<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: sì<br>smonta attrezzatura 924 dal 904, in conferma: sì<br>modifica del 901 a magazzino, in conferma: –<br>posiziona 901, niente scelto: –<br>posiziona 901, posto 20: –<br>posiziona 901, fuori magazzino: –<br>posiziona 901, macchina 1 occupata: –<br>posiziona 903, macchina 1 libera: – | stato: vm.pending = null | no |
| Modifica | `goEdit(row.pallet.ID)` |  | tre pallet liv2: –<br>tre pallet liv1: –<br>tre pallet liv0: –<br>ordine attivo sul 901: –<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: –<br>smonta attrezzatura 924 dal 904, in conferma: –<br>modifica del 901 a magazzino, in conferma: sì<br>posiziona 901, niente scelto: –<br>posiziona 901, posto 20: –<br>posiziona 901, fuori magazzino: –<br>posiziona 901, macchina 1 occupata: –<br>posiziona 903, macchina 1 libera: – | router "/conf/Attrezzaggio?edit=901" | no |
| Annulla | `pendingEdit=null` |  | tre pallet liv2: –<br>tre pallet liv1: –<br>tre pallet liv0: –<br>ordine attivo sul 901: –<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: –<br>smonta attrezzatura 924 dal 904, in conferma: –<br>modifica del 901 a magazzino, in conferma: sì<br>posiziona 901, niente scelto: –<br>posiziona 901, posto 20: –<br>posiziona 901, fuori magazzino: –<br>posiziona 901, macchina 1 occupata: –<br>posiziona 903, macchina 1 libera: – | stato: vm.pendingEdit = null | no |
| (riprova) | `getDataTable()` |  | tre pallet liv2: sì<br>tre pallet liv1: sì<br>tre pallet liv0: sì<br>ordine attivo sul 901: sì<br>anomalia 904 e pallet nudo 905: sì<br>smonta morsa 911 dal 901, in conferma: sì<br>smonta attrezzatura 924 dal 904, in conferma: sì<br>modifica del 901 a magazzino, in conferma: sì<br>posiziona 901, niente scelto: sì<br>posiziona 901, posto 20: sì<br>posiziona 901, fuori magazzino: sì<br>posiziona 901, macchina 1 occupata: sì<br>posiziona 903, macchina 1 libera: sì | fetch GET api/conf/pallet/show/all<br>fetch GET api/conf/vice/show/all<br>fetch GET api/conf/fixture/show/all<br>fetch GET api/conf/fixture/showFixtureOnPallet/all<br>fetch GET api/conf/position/showWarehouse/WPALLET<br>fetch GET api/order/show/all | no |
| {{n}} # {{occupantOf(n).ID}} {{(occupantOf(n).FAMILY \|\| '').trim()}} disabilitata | `placeSel=n` | `!!occupantOf(n) \|\| disabledSlots.has(n)` | tre pallet liv2: –<br>tre pallet liv1: –<br>tre pallet liv0: –<br>ordine attivo sul 901: –<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: –<br>smonta attrezzatura 924 dal 904, in conferma: –<br>modifica del 901 a magazzino, in conferma: –<br>posiziona 901, niente scelto: sì<br>posiziona 901, posto 20: sì<br>posiziona 901, fuori magazzino: sì<br>posiziona 901, macchina 1 occupata: sì<br>posiziona 903, macchina 1 libera: sì | stato: vm.placeSel = 20 | no |
| Rimuovi dal magazzino ( Fuori Magazzino ) | `placeSel=-1` | `placeTarget.MAG_POS<0` | tre pallet liv2: –<br>tre pallet liv1: –<br>tre pallet liv0: –<br>ordine attivo sul 901: –<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: –<br>smonta attrezzatura 924 dal 904, in conferma: –<br>modifica del 901 a magazzino, in conferma: –<br>posiziona 901, niente scelto: sì<br>posiziona 901, posto 20: sì<br>posiziona 901, fuori magazzino: sì<br>posiziona 901, macchina 1 occupata: sì<br>posiziona 903, macchina 1 libera: no | stato: vm.placeSel = -1 | no |
| {{$t('attrezzaggi.inMachine', { mc: $t(mpos.labelKey) })}} {{machineBlock(mpos.n)}} | `placeSel='mc'+mpos.n` | `machineBlock(mpos.n) != ''` | tre pallet liv2: –<br>tre pallet liv1: –<br>tre pallet liv0: –<br>ordine attivo sul 901: –<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: –<br>smonta attrezzatura 924 dal 904, in conferma: –<br>modifica del 901 a magazzino, in conferma: –<br>posiziona 901, niente scelto: no<br>posiziona 901, posto 20: no<br>posiziona 901, fuori magazzino: no<br>posiziona 901, macchina 1 occupata: no<br>posiziona 903, macchina 1 libera: sì | – | no |
| A bordo del robot | `placeSel='robot'` | `placeBusy` | tre pallet liv2: –<br>tre pallet liv1: –<br>tre pallet liv0: –<br>ordine attivo sul 901: –<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: –<br>smonta attrezzatura 924 dal 904, in conferma: –<br>modifica del 901 a magazzino, in conferma: –<br>posiziona 901, niente scelto: sì<br>posiziona 901, posto 20: sì<br>posiziona 901, fuori magazzino: sì<br>posiziona 901, macchina 1 occupata: sì<br>posiziona 903, macchina 1 libera: sì | stato: vm.placeSel = "robot" | no |
| Conferma | `(placeSel!=null && !placeBusy)?confirmPlace():''` | `[(placeSel==null \|\| placeBusy)? 'pure-button-disable' : 'pure-button-mission']` | tre pallet liv2: –<br>tre pallet liv1: –<br>tre pallet liv0: –<br>ordine attivo sul 901: –<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: –<br>smonta attrezzatura 924 dal 904, in conferma: –<br>modifica del 901 a magazzino, in conferma: –<br>posiziona 901, niente scelto: no<br>posiziona 901, posto 20: sì<br>posiziona 901, fuori magazzino: sì<br>posiziona 901, macchina 1 occupata: sì<br>posiziona 903, macchina 1 libera: sì | emit GRIPPER/REQUEST_SNAPSHOT undefined | no |
| Annulla | `closePlace()` | `placeBusy` | tre pallet liv2: –<br>tre pallet liv1: –<br>tre pallet liv0: –<br>ordine attivo sul 901: –<br>anomalia 904 e pallet nudo 905: –<br>smonta morsa 911 dal 901, in conferma: –<br>smonta attrezzatura 924 dal 904, in conferma: –<br>modifica del 901 a magazzino, in conferma: –<br>posiziona 901, niente scelto: sì<br>posiziona 901, posto 20: sì<br>posiziona 901, fuori magazzino: sì<br>posiziona 901, macchina 1 occupata: sì<br>posiziona 903, macchina 1 libera: sì | stato: vm.placeTarget = null | no |

## Attrezzaggio (`src/views/conf/Attrezzaggio.vue`)

Scenari: nuovo, nessun pallet · nuovo, 901 gia' attrezzato · nuovo, 905 nudo, tipo da scegliere · nuovo, 905 morsa 913 senza geometria · nuovo, 905 morsa 913 + geometria 924 liv2 · nuovo, 905 morsa 913 + geometria 924 liv0 · nuovo, 905 attrezzatura 924 · modifica 901, morsa 911 -> 913 · modifica 901, da morsa ad attrezzatura 924 · modifica 901, montaggio cambiato sotto

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Crea nuova... | `$router.push('/conf/pallet?returnTo=/conf/Attrezzaggio')` |  | nuovo, nessun pallet: sì<br>nuovo, 901 gia' attrezzato: sì<br>nuovo, 905 nudo, tipo da scegliere: sì<br>nuovo, 905 morsa 913 senza geometria: sì<br>nuovo, 905 morsa 913 + geometria 924 liv2: sì<br>nuovo, 905 morsa 913 + geometria 924 liv0: sì<br>nuovo, 905 attrezzatura 924: sì<br>modifica 901, morsa 911 -> 913: sì<br>modifica 901, da morsa ad attrezzatura 924: sì<br>modifica 901, montaggio cambiato sotto: sì | router "/conf/pallet?returnTo=/conf/Attrezzaggio" | no |
| Morsa | `setType('vice')` | `[rigType=='vice' ? 'pure-button-primary' : 'btn-ghost']` | nuovo, nessun pallet: –<br>nuovo, 901 gia' attrezzato: –<br>nuovo, 905 nudo, tipo da scegliere: sì<br>nuovo, 905 morsa 913 senza geometria: sì<br>nuovo, 905 morsa 913 + geometria 924 liv2: sì<br>nuovo, 905 morsa 913 + geometria 924 liv0: sì<br>nuovo, 905 attrezzatura 924: sì<br>modifica 901, morsa 911 -> 913: sì<br>modifica 901, da morsa ad attrezzatura 924: sì<br>modifica 901, montaggio cambiato sotto: sì | stato: vm.rigType = "vice" | Crea nuova... → router "/conf/vice?returnTo=/conf/Attrezzaggio"<br>Crea nuova... → router "/conf/fixture?returnTo=/conf/Attrezzaggio" |
| Attrezzatura | `setType('fixture')` | `[rigType=='fixture' ? 'pure-button-primary' : 'btn-ghost']` | nuovo, nessun pallet: –<br>nuovo, 901 gia' attrezzato: –<br>nuovo, 905 nudo, tipo da scegliere: sì<br>nuovo, 905 morsa 913 senza geometria: sì<br>nuovo, 905 morsa 913 + geometria 924 liv2: sì<br>nuovo, 905 morsa 913 + geometria 924 liv0: sì<br>nuovo, 905 attrezzatura 924: sì<br>modifica 901, morsa 911 -> 913: sì<br>modifica 901, da morsa ad attrezzatura 924: sì<br>modifica 901, montaggio cambiato sotto: sì | stato: vm.rigType = "fixture" | Crea nuova... → router "/conf/fixture?returnTo=/conf/Attrezzaggio" |
| Crea nuova... | `$router.push('/conf/vice?returnTo=/conf/Attrezzaggio')` |  | nuovo, nessun pallet: –<br>nuovo, 901 gia' attrezzato: –<br>nuovo, 905 nudo, tipo da scegliere: –<br>nuovo, 905 morsa 913 senza geometria: sì<br>nuovo, 905 morsa 913 + geometria 924 liv2: sì<br>nuovo, 905 morsa 913 + geometria 924 liv0: sì<br>nuovo, 905 attrezzatura 924: –<br>modifica 901, morsa 911 -> 913: sì<br>modifica 901, da morsa ad attrezzatura 924: –<br>modifica 901, montaggio cambiato sotto: sì | router "/conf/vice?returnTo=/conf/Attrezzaggio" | no |
| Crea nuova... | `$router.push('/conf/fixture?returnTo=/conf/Attrezzaggio')` |  | nuovo, nessun pallet: –<br>nuovo, 901 gia' attrezzato: –<br>nuovo, 905 nudo, tipo da scegliere: –<br>nuovo, 905 morsa 913 senza geometria: sì<br>nuovo, 905 morsa 913 + geometria 924 liv2: sì<br>nuovo, 905 morsa 913 + geometria 924 liv0: sì<br>nuovo, 905 attrezzatura 924: –<br>modifica 901, morsa 911 -> 913: sì<br>modifica 901, da morsa ad attrezzatura 924: –<br>modifica 901, montaggio cambiato sotto: sì | router "/conf/fixture?returnTo=/conf/Attrezzaggio" | no |
| Crea nuova... | `$router.push('/conf/fixture?returnTo=/conf/Attrezzaggio')` |  | nuovo, nessun pallet: –<br>nuovo, 901 gia' attrezzato: –<br>nuovo, 905 nudo, tipo da scegliere: –<br>nuovo, 905 morsa 913 senza geometria: –<br>nuovo, 905 morsa 913 + geometria 924 liv2: –<br>nuovo, 905 morsa 913 + geometria 924 liv0: –<br>nuovo, 905 attrezzatura 924: sì<br>modifica 901, morsa 911 -> 913: –<br>modifica 901, da morsa ad attrezzatura 924: sì<br>modifica 901, montaggio cambiato sotto: – | router "/conf/fixture?returnTo=/conf/Attrezzaggio" | no |
| Salva attrezzaggio | `canSave ? saveData() : ''` | `{'pure-button-disabled': !canSave}` | nuovo, nessun pallet: no<br>nuovo, 901 gia' attrezzato: no<br>nuovo, 905 nudo, tipo da scegliere: no<br>nuovo, 905 morsa 913 senza geometria: no<br>nuovo, 905 morsa 913 + geometria 924 liv2: sì<br>nuovo, 905 morsa 913 + geometria 924 liv0: sì<br>nuovo, 905 attrezzatura 924: sì<br>modifica 901, morsa 911 -> 913: sì<br>modifica 901, da morsa ad attrezzatura 924: sì<br>modifica 901, montaggio cambiato sotto: sì | fetch GET api/conf/vice/updateVice?ID=913&FAMILY=MORSA-PROVA&DESCR=morsa+prova+C&STATUS=2&X=150000&Y=100000&Z=80000&Z_CLAW=5000&Z_SINK_CLAW=1000&MAG=1&MAG_POS=2&POS_PLANT=0&PALLET_ID=905<br>fetch GET api/conf/fixture/updateFixtureOnPallet?PALLET_ID=905&FIXTURE_ID=924&POS_X=10&POS_Y=20&POS_Z=0&POS_X_CORR=0&POS_Y_CORR=0&POS_Z_CORR=0&POS_X_ROT=0&POS_Y_ROT=0&POS_Z_ROT=90<br>router "/conf/Attrezzaggi" | no |
| Annulla | `$router.push('/conf/Attrezzaggi')` |  | nuovo, nessun pallet: sì<br>nuovo, 901 gia' attrezzato: sì<br>nuovo, 905 nudo, tipo da scegliere: sì<br>nuovo, 905 morsa 913 senza geometria: sì<br>nuovo, 905 morsa 913 + geometria 924 liv2: sì<br>nuovo, 905 morsa 913 + geometria 924 liv0: sì<br>nuovo, 905 attrezzatura 924: sì<br>modifica 901, morsa 911 -> 913: sì<br>modifica 901, da morsa ad attrezzatura 924: sì<br>modifica 901, montaggio cambiato sotto: sì | router "/conf/Attrezzaggi" | no |

## PalletsView (`src/views/conf/PalletsView.vue`)

Scenari: prelievo liv2 · prelievo liv1 · prelievo liv0 · deposito del 901 in pinza · popup elimina 902 aperto

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Aggiungi tipo pallet | `createPallet()` | `dataStored.userLevel<=1` | prelievo liv2: sì<br>prelievo liv1: no<br>prelievo liv0: no<br>deposito del 901 in pinza: sì<br>popup elimina 902 aperto: sì | router "/conf/pallet" | no |
| (cmdModify) | `updatePallet(dt.ID)` |  | prelievo liv2: sì<br>prelievo liv1: sì<br>prelievo liv0: sì<br>deposito del 901 in pinza: sì<br>popup elimina 902 aperto: sì | router "/conf/pallet?palletID=901" | no |
| (cmdDel) | `sicurezza(dt.ID)` |  | prelievo liv2: sì<br>prelievo liv1: sì<br>prelievo liv0: sì<br>deposito del 901 in pinza: sì<br>popup elimina 902 aperto: sì | stato: vm.showPopUp = 901 | Cancella → fetch DELETE api/conf/pallet/901<br>Annulla → – |
| (cmdMove) | `sendToRobot( (dataGripper.STATUS==2?'13;':'14;')+ dataStored.Pallet+';'+ dt.ID+';'+ movePos(dt) )` |  | prelievo liv2: sì<br>prelievo liv1: sì<br>prelievo liv0: sì<br>deposito del 901 in pinza: sì<br>popup elimina 902 aperto: sì | emit TO_PLANT/CMD/ROBOT "13;3;901;3" | no |
| Cancella | `deletePallet(dt.ID)` |  | prelievo liv2: –<br>prelievo liv1: –<br>prelievo liv0: –<br>deposito del 901 in pinza: –<br>popup elimina 902 aperto: sì | fetch DELETE api/conf/pallet/902 | no |
| Annulla | `showPopUp=0` |  | prelievo liv2: –<br>prelievo liv1: –<br>prelievo liv0: –<br>deposito del 901 in pinza: –<br>popup elimina 902 aperto: sì | stato: vm.showPopUp = 0 | no |

## Pallet (`src/views/conf/Pallet/Pallet.vue`)

Scenari: modifica 901 liv2 · modifica 901 liv0 · nuovo liv2 · nuovo liv0 · nuovo da Attrezzaggio

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Salva | `saveData()` | `dataStored.userLevel==0` | modifica 901 liv2: sì<br>modifica 901 liv0: no<br>nuovo liv2: sì<br>nuovo liv0: no<br>nuovo da Attrezzaggio: sì | fetch GET api/conf/pallet/show/901<br>fetch GET api/conf/pallet/updatepallet?ID=901&FAMILY=PAL-PROVA&DESCR=pallet+prova+A&X=400000&Y=400000&Z=100000&X_CORR=0&Y_CORR=0&Z_CORR=0&MAG=1&MAG_POS=3&POS_PLANT=0<br>router "/conf/pallets" | no |

## VicesView (`src/views/conf/VicesView.vue`)

Scenari: tre morse liv2 · tre morse liv1 · tre morse liv0 · popup elimina 913 aperto

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Aggiungi tipo morsa | `createVice()` | `dataStored.userLevel<=1` | tre morse liv2: sì<br>tre morse liv1: no<br>tre morse liv0: no<br>popup elimina 913 aperto: sì | router "/conf/vice" | no |
| (cmdModify) | `updateVice(dt.ID)` |  | tre morse liv2: sì<br>tre morse liv1: sì<br>tre morse liv0: sì<br>popup elimina 913 aperto: sì | router "/conf/vice?viceID=911" | no |
| (cmdDel) | `sicurezza(dt.ID)` |  | tre morse liv2: sì<br>tre morse liv1: sì<br>tre morse liv0: sì<br>popup elimina 913 aperto: sì | stato: vm.showPopUp = 911 | Cancella → fetch DELETE api/conf/vice/911<br>Annulla → – |
| Cancella | `deleteVice(dt.ID)` |  | tre morse liv2: –<br>tre morse liv1: –<br>tre morse liv0: –<br>popup elimina 913 aperto: sì | fetch DELETE api/conf/vice/913 | no |
| Annulla | `showPopUp=0` |  | tre morse liv2: –<br>tre morse liv1: –<br>tre morse liv0: –<br>popup elimina 913 aperto: sì | stato: vm.showPopUp = 0 | no |

## Vice (`src/views/conf/Vice/Vice.vue`)

Scenari: modifica 911 liv2 · modifica 911 liv0 · nuova morsa · nuova morsa da Attrezzaggio

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Famiglia {{v.TYPE}} Descrizione X µm Y µm Z µm Ganascia: lunghezza nella direzione in cui il pezzo scorre fino alla batt | `` |  | modifica 911 liv2: sì<br>modifica 911 liv0: sì<br>nuova morsa: sì<br>nuova morsa da Attrezzaggio: sì | – | no |
| (input) | `onDimInput('X', $event)` |  | modifica 911 liv2: sì<br>modifica 911 liv0: sì<br>nuova morsa: sì<br>nuova morsa da Attrezzaggio: sì | stato: vm.vice.X = 1 | no |
| (input) | `onDimInput('Y', $event)` |  | modifica 911 liv2: sì<br>modifica 911 liv0: sì<br>nuova morsa: sì<br>nuova morsa da Attrezzaggio: sì | stato: vm.vice.Y = 1 | no |
| (input) | `onDimInput('Z', $event)` |  | modifica 911 liv2: sì<br>modifica 911 liv0: sì<br>nuova morsa: sì<br>nuova morsa da Attrezzaggio: sì | stato: vm.vice.Z = 1 | no |
| (keydown) | `` |  | modifica 911 liv2: sì<br>modifica 911 liv0: sì<br>nuova morsa: –<br>nuova morsa da Attrezzaggio: – | – | no |
| Salva | `saveStop(row)` | `!stopValueValid(row) \|\| stopBusy \|\| !canDeclareStop` | modifica 911 liv2: sì<br>modifica 911 liv0: no<br>nuova morsa: –<br>nuova morsa da Attrezzaggio: – | fetch GET api/conf/vice/setStop?VICE_ID=911&PIECE_ID=931&STOP_BEYOND_CLAW=2000<br>fetch GET api/conf/piece/show/all<br>fetch GET api/conf/vice/stops/911 | no |
| Cancella | `removeStop(row)` | `stopBusy \|\| !canDeclareStop` | modifica 911 liv2: sì<br>modifica 911 liv0: no<br>nuova morsa: –<br>nuova morsa da Attrezzaggio: – | fetch GET api/conf/vice/deleteStop?VICE_ID=911&PIECE_ID=931<br>fetch GET api/conf/piece/show/all<br>fetch GET api/conf/vice/stops/911 | no |
| (update) | `(val) => (vice.STATUS = val)` |  | modifica 911 liv2: sì<br>modifica 911 liv0: sì<br>nuova morsa: sì<br>nuova morsa da Attrezzaggio: sì | stato: vm.vice.STATUS = 5 | no |
| Salva | `saveData` |  | modifica 911 liv2: sì<br>modifica 911 liv0: sì<br>nuova morsa: sì<br>nuova morsa da Attrezzaggio: sì | fetch GET api/conf/vice/show/911<br>fetch GET api/conf/vice/updateVice?ID=911&FAMILY=MORSA-PROVA&DESCR=morsa+prova+A&STATUS=2&X=150000&Y=100000&Z=80000&CLAW_LENGTH=40000&Z_CLAW=5000&Z_SINK_CLAW=1000&MAG=1&MAG_POS=1&POS_PLANT=0<br>router "/conf/Vices" | no |

## FixturesView (`src/views/conf/FixturesView.vue`)

Scenari: tre attrezzature liv2 · tre attrezzature liv1 · tre attrezzature liv0 · popup elimina 924 aperto

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Agg. Attrezzatura | `createfixture()` | `dataStored.userLevel<=1` | tre attrezzature liv2: sì<br>tre attrezzature liv1: no<br>tre attrezzature liv0: no<br>popup elimina 924 aperto: sì | router "/conf/fixture" | no |
| (cmdModify) | `updatefixture(dt.ID)` |  | tre attrezzature liv2: sì<br>tre attrezzature liv1: sì<br>tre attrezzature liv0: sì<br>popup elimina 924 aperto: sì | router "/conf/Fixture?fixtureID=921" | no |
| (cmdDel) | `sicurezza(dt.ID)` |  | tre attrezzature liv2: sì<br>tre attrezzature liv1: sì<br>tre attrezzature liv0: sì<br>popup elimina 924 aperto: sì | stato: vm.showPopUp = 921 | Cancella → fetch DELETE api/conf/fixture/921<br>Annulla → – |
| (cmdPlace) | `callPage(dt.ID)` |  | tre attrezzature liv2: sì<br>tre attrezzature liv1: sì<br>tre attrezzature liv0: sì<br>popup elimina 924 aperto: sì | router "/conf/FixtureOnPallet?fixtureID=921" | no |
| Cancella | `deletefixture(dt.ID)` |  | tre attrezzature liv2: –<br>tre attrezzature liv1: –<br>tre attrezzature liv0: –<br>popup elimina 924 aperto: sì | fetch DELETE api/conf/fixture/924 | no |
| Annulla | `showPopUp=0` |  | tre attrezzature liv2: –<br>tre attrezzature liv1: –<br>tre attrezzature liv0: –<br>popup elimina 924 aperto: sì | stato: vm.showPopUp = 0 | no |

## Fixture (`src/views/conf/Fixture/Fixture.vue`)

Scenari: modifica 921 coerente liv2 · modifica 921 coerente liv0 · modifica 922 diverge · modifica 922, allineamento in conferma · modifica 924 non dichiarata · nuova attrezzatura · nuova da Attrezzaggio

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Allinea la quota alla somma | `chiediAllineamento()` |  | modifica 921 coerente liv2: –<br>modifica 921 coerente liv0: –<br>modifica 922 diverge: sì<br>modifica 922, allineamento in conferma: sì<br>modifica 924 non dichiarata: –<br>nuova attrezzatura: –<br>nuova da Attrezzaggio: – | stato: vm.alignDialog = true | Conferma → –<br>Annulla → – |
| >> NEXT >> | `saveData()` |  | modifica 921 coerente liv2: sì<br>modifica 921 coerente liv0: sì<br>modifica 922 diverge: sì<br>modifica 922, allineamento in conferma: sì<br>modifica 924 non dichiarata: sì<br>nuova attrezzatura: sì<br>nuova da Attrezzaggio: sì | fetch GET api/conf/fixture/updateFixture?ID=921&FAMILY=ATT-PROVA&DESCR=attrezzatura+prova+A&X=200&Y=150&Z=120&Z_CLAW=30&Z_SINK_CLAW=2&POS_PLANT=901&PALLET_ID=901&VICE_ID=911&Z_DIVERGE=0&PALLET_Z=100000&VICE_Z=20000&Z_CALC=120000<br>router "/conf/Fixtureonpallet?fixtureID=921" | no |
| Conferma | `confermaAllineamento()` |  | modifica 921 coerente liv2: –<br>modifica 921 coerente liv0: –<br>modifica 922 diverge: –<br>modifica 922, allineamento in conferma: sì<br>modifica 924 non dichiarata: –<br>nuova attrezzatura: –<br>nuova da Attrezzaggio: – | stato: vm.fixture.Z = 120, vm.alignDialog = false | no |
| Annulla | `alignDialog=false` |  | modifica 921 coerente liv2: –<br>modifica 921 coerente liv0: –<br>modifica 922 diverge: –<br>modifica 922, allineamento in conferma: sì<br>modifica 924 non dichiarata: –<br>nuova attrezzatura: –<br>nuova da Attrezzaggio: – | stato: vm.alignDialog = false | no |

## FixtureOnPallet (`src/views/conf/Fixture/FixtureOnPallet.vue`)

Scenari: 921 sul pallet 901 liv2 · 921 sul pallet 901 liv0 · 924 non posizionata · nuova (senza fixtureID)

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| reset position | `resetData()` |  | 921 sul pallet 901 liv2: sì<br>921 sul pallet 901 liv0: sì<br>924 non posizionata: –<br>nuova (senza fixtureID): sì | stato: vm.fixture.POS_X = 0, vm.fixture.POS_Y = 0 | no |
| Salva | `saveData()` |  | 921 sul pallet 901 liv2: sì<br>921 sul pallet 901 liv0: sì<br>924 non posizionata: sì<br>nuova (senza fixtureID): sì | fetch GET api/conf/fixture/updateFixtureOnPallet?ID=921&FAMILY=ATT-PROVA&DESCR=attrezzatura+prova+A&X=200&Y=150&Z=120&Z_CLAW=30&Z_SINK_CLAW=2&POS_PLANT=901&PALLET_ID=901&VICE_ID=911&Z_DIVERGE=0&PALLET_Z=100000&VICE_Z=20000&Z_CALC=120000&POS_X=10&POS_Y=20&POS_Z=0&POS_X_CORR=0.1&POS_Y_CORR=0&POS_Z_CORR=0&POS_X_ROT=0&POS_Y_ROT=0&POS_Z_ROT=90<br>router "/conf/Fixtures" | no |

## GrippersView (`src/views/conf/GrippersView.vue`)

Scenari: pinza 944 a bordo liv2 · pinza 944 a bordo liv1 · pinza 944 a bordo liv0 · nessuna pinza a bordo liv2

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Agg. Pinza | `CreateGripper()` | `dataStored.userLevel<=1` | pinza 944 a bordo liv2: sì<br>pinza 944 a bordo liv1: no<br>pinza 944 a bordo liv0: no<br>nessuna pinza a bordo liv2: sì | router "/conf/Gripper/Gripper" | no |
| ✎ {{$t('gripper.twinOpen', { id: tid })}} | `modifyGripper(tid)` |  | pinza 944 a bordo liv2: sì<br>pinza 944 a bordo liv1: sì<br>pinza 944 a bordo liv0: sì<br>nessuna pinza a bordo liv2: sì | router "/conf/gripper/gripper?gripperID=943" | no |
| (cmdModify) | `modifyGripper(dt.ID)` |  | pinza 944 a bordo liv2: sì<br>pinza 944 a bordo liv1: sì<br>pinza 944 a bordo liv0: sì<br>nessuna pinza a bordo liv2: sì | router "/conf/gripper/gripper?gripperID=941" | no |
| (cmdDel) | `deleteGripper(dt.ID)` |  | pinza 944 a bordo liv2: sì<br>pinza 944 a bordo liv1: sì<br>pinza 944 a bordo liv0: sì<br>nessuna pinza a bordo liv2: sì | confirm-nativo "gripper.delete"<br>fetch DELETE api/conf/gripper/941 | no |
| (cmdMove) | `PickReleaseGripper(dt.ID)` |  | pinza 944 a bordo liv2: sì<br>pinza 944 a bordo liv1: sì<br>pinza 944 a bordo liv0: sì<br>nessuna pinza a bordo liv2: sì | emit TO_PLANT/CMD/ROBOT 12 | no |

## Gripper (`src/views/conf/Gripper/Gripper.vue`)

Scenari: modifica 941 liv2 · modifica 941 liv0 · nuova pinza

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Codice {{g.TYPE}} Descrizione Corpo: lunghezza X mm Corpo: lunghezza Y mm Corpo: lunghezza Z mm Punto di presa rispetto  | `` |  | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | – | no |
| (input) | `onDimInput('X_BODY', $event)` |  | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | stato: vm.gripper.X_BODY = 1 | no |
| (input) | `onDimInput('Y_BODY', $event)` |  | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | stato: vm.gripper.Y_BODY = 1 | no |
| (input) | `onDimInput('Z_BODY', $event)` |  | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | stato: vm.gripper.Z_BODY = 1 | no |
| (input) | `onDimInput('X_CLAW', $event)` |  | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | stato: vm.gripper.X_CLAW = 1 | no |
| (input) | `onDimInput('Y_CLAW', $event)` |  | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | stato: vm.gripper.Y_CLAW = 1 | no |
| (input) | `onDimInput('Z_CLAW', $event)` |  | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | stato: vm.gripper.Z_CLAW = 1 | no |
| (input) | `onDimInput('STROKE_CLAW', $event)` |  | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | stato: vm.gripper.STROKE_CLAW = 1 | no |
| (input) | `onDimInput('TICKNESS_CLAW', $event)` |  | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | stato: vm.gripper.TICKNESS_CLAW = 1 | no |
| (update) | `(val) => (gripper.STATUS = val)` |  | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | stato: vm.gripper.STATUS = 5 | no |
| {{index + 1}} | `gripper.POS_MAG = index + 1` | `getDisabled(index + 1)` | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | – | no |
| Salva | `saveData` |  | modifica 941 liv2: sì<br>modifica 941 liv0: sì<br>nuova pinza: sì | fetch GET api/conf/gripper/updateGripper?ID=941&FAMILY=PINZA-PROVA&DESCR=pinza+prova+A&X_BODY=60000&Y_BODY=80000&Z_BODY=100000&X_CLAW=20000&Y_CLAW=30000&Z_CLAW=40000&STROKE_CLAW=10000&TICKNESS_CLAW=5000&CLAW_LENGTH=20000&HAS_HOOK=&STATUS=2&POS_MAG=1&SUB_POS=1&POS_PLANT=1&X_CHELE=20000&Y_CHELE=30000&Z_CHELE=40000<br>router "/conf/Grippers" | no |

## PositionView (`src/views/conf/PositionView.vue`)

Scenari: scaffale liv2 · scaffale liv0 · macchine liv2 · scaffale, 951 in modifica liv2 · scaffale, 951 in modifica liv0

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| {{opt.label}} | `categoryFilter=opt.id` | `{ active: categoryFilter==opt.id }` | scaffale liv2: sì<br>scaffale liv0: sì<br>macchine liv2: sì<br>scaffale, 951 in modifica liv2: sì<br>scaffale, 951 in modifica liv0: sì | – | no |
| Pos {{sortDir==1?'▲':'▼'}} | `setSort('SUB_POS')` |  | scaffale liv2: sì<br>scaffale liv0: sì<br>macchine liv2: sì<br>scaffale, 951 in modifica liv2: sì<br>scaffale, 951 in modifica liv0: sì | stato: vm.sortDir = -1 | no |
| (cmdModify) | `updatePosition(dt.ID)` |  | scaffale liv2: sì<br>scaffale liv0: sì<br>macchine liv2: sì<br>scaffale, 951 in modifica liv2: sì<br>scaffale, 951 in modifica liv0: sì | stato: vm.datiTab = [{"ID":951,"PARENT":"SHELF","SUB_POS":1,"X":"100.000","Y":"200.000","Z":"300.000, vm.datiTabFiltred = [{"ID":951,"PARENT":"SHELF","SUB_POS":1,"X":"100.000","Y":"200.000","Z":"300.000 | no |
| (cmdSave) | `updatePosition(dt.ID)` |  | scaffale liv2: sì<br>scaffale liv0: sì<br>macchine liv2: sì<br>scaffale, 951 in modifica liv2: sì<br>scaffale, 951 in modifica liv0: sì | stato: vm.datiTab = [{"ID":951,"PARENT":"SHELF","SUB_POS":1,"X":"100.000","Y":"200.000","Z":"300.000, vm.datiTabFiltred = [{"ID":951,"PARENT":"SHELF","SUB_POS":1,"X":"100.000","Y":"200.000","Z":"300.000 | no |

## WarehousesView (`src/views/conf/WarehousesView.vue`)

Scenari: magazzino pallet liv2 · magazzino pallet liv1 · magazzino pallet liv0 · scaffale pinze liv2 · conferma disabilita pallet 20 · conferma abilita pinze 5

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Pallet | `tab='pallet'` | `{active: tab=='pallet'}` | magazzino pallet liv2: sì<br>magazzino pallet liv1: sì<br>magazzino pallet liv0: –<br>scaffale pinze liv2: sì<br>conferma disabilita pallet 20: sì<br>conferma abilita pinze 5: sì | – | no |
| Pinze | `tab='gripper'` | `{active: tab=='gripper'}` | magazzino pallet liv2: sì<br>magazzino pallet liv1: sì<br>magazzino pallet liv0: –<br>scaffale pinze liv2: sì<br>conferma disabilita pallet 20: sì<br>conferma abilita pinze 5: sì | stato: vm.tab = "gripper" | {{row.SUB_POS}} {{cellStateLabel('SHELF', row.SUB_POS)}} → –<br>{{row.SUB_POS}} {{cellStateLabel('SHELF', row.SUB_POS)}} → –<br>{{row.SUB_POS}} {{cellStateLabel('SHELF', row.SUB_POS)}} → – |
| {{n}} {{cellStateLabel('WPALLET', n)}} | `askToggle('WPALLET', n)` | `!cellToggleable('WPALLET', n)` | magazzino pallet liv2: sì<br>magazzino pallet liv1: sì<br>magazzino pallet liv0: –<br>scaffale pinze liv2: –<br>conferma disabilita pallet 20: sì<br>conferma abilita pinze 5: – | stato: vm.pending = {"parent":"WPALLET","subpos":20,"action":"disable"} | Conferma → fetch GET api/conf/pallet/show/all, fetch GET api/conf/position/warehouseSlot/disable/WPALLET/20, fetch GET api/conf/position/showWarehouse/WPALLET, fetch GET api/conf/position/showWarehouse/SHELF, fetch GET api/conf/pallet/show/all, fetch GET api/conf/gripper/show/all<br>Annulla → – |
| {{row.SUB_POS}} {{cellStateLabel('SHELF', row.SUB_POS)}} | `askToggle('SHELF', row.SUB_POS)` | `!cellToggleable('SHELF', row.SUB_POS)` | magazzino pallet liv2: –<br>magazzino pallet liv1: –<br>magazzino pallet liv0: –<br>scaffale pinze liv2: no<br>conferma disabilita pallet 20: –<br>conferma abilita pinze 5: no | – | no |
| Conferma | `confirmToggle()` |  | magazzino pallet liv2: –<br>magazzino pallet liv1: –<br>magazzino pallet liv0: –<br>scaffale pinze liv2: –<br>conferma disabilita pallet 20: sì<br>conferma abilita pinze 5: sì | fetch GET api/conf/pallet/show/all<br>fetch GET api/conf/position/warehouseSlot/disable/WPALLET/20<br>fetch GET api/conf/position/showWarehouse/WPALLET<br>fetch GET api/conf/position/showWarehouse/SHELF<br>fetch GET api/conf/pallet/show/all<br>fetch GET api/conf/gripper/show/all | no |
| Annulla | `pending=null` |  | magazzino pallet liv2: –<br>magazzino pallet liv1: –<br>magazzino pallet liv0: –<br>scaffale pinze liv2: –<br>conferma disabilita pallet 20: sì<br>conferma abilita pinze 5: sì | stato: vm.pending = null | no |

## MachineConfigView (`src/views/conf/Machine/MachineConfigView.vue`)

Scenari: marca 1, scelta 2, liv2 · marca 1, scelta 2, liv1 · marca 1, scelta 2, liv0 · scelta uguale alla richiesta · cambio in attesa (req 2, act 1) · conferma aperta liv2 · conferma aperta liv1 · in attesa del PLC · PLC muto

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| Riprova | `retryPlcRefresh` |  | marca 1, scelta 2, liv2: –<br>marca 1, scelta 2, liv1: –<br>marca 1, scelta 2, liv0: –<br>scelta uguale alla richiesta: –<br>cambio in attesa (req 2, act 1): –<br>conferma aperta liv2: –<br>conferma aperta liv1: –<br>in attesa del PLC: –<br>PLC muto: sì | emit PLC/REFRESH_REQUEST undefined | no |
| {{b.id}} — {{b.name}} | `m(pos).touched = true` | `!canEdit` | marca 1, scelta 2, liv2: sì<br>marca 1, scelta 2, liv1: no<br>marca 1, scelta 2, liv0: no<br>scelta uguale alla richiesta: sì<br>cambio in attesa (req 2, act 1): sì<br>conferma aperta liv2: sì<br>conferma aperta liv1: no<br>in attesa del PLC: –<br>PLC muto: – | – | no |
| Applica | `askConfirm(pos)` | `!canSend(pos)` | marca 1, scelta 2, liv2: sì<br>marca 1, scelta 2, liv1: no<br>marca 1, scelta 2, liv0: no<br>scelta uguale alla richiesta: no<br>cambio in attesa (req 2, act 1): no<br>conferma aperta liv2: sì<br>conferma aperta liv1: no<br>in attesa del PLC: –<br>PLC muto: – | – | no |
| Applica | `sendBrand(pos)` |  | marca 1, scelta 2, liv2: –<br>marca 1, scelta 2, liv1: –<br>marca 1, scelta 2, liv0: –<br>scelta uguale alla richiesta: –<br>cambio in attesa (req 2, act 1): –<br>conferma aperta liv2: sì<br>conferma aperta liv1: sì<br>in attesa del PLC: –<br>PLC muto: – | emit TO_PLANT/CMD/BRANDMC1 2 | no |
| Annulla | `m(pos).confirming = false` |  | marca 1, scelta 2, liv2: –<br>marca 1, scelta 2, liv1: –<br>marca 1, scelta 2, liv0: –<br>scelta uguale alla richiesta: –<br>cambio in attesa (req 2, act 1): –<br>conferma aperta liv2: sì<br>conferma aperta liv1: sì<br>in attesa del PLC: –<br>PLC muto: – | – | no |

## SettingsUserView (`src/views/SettingsUserView.vue`)

Scenari: liv0 · liv2 · dialog cambio utente aperto

| Etichetta | Handler | Abilitazione | Abilitato per scenario | Effetto | Conferma |
|---|---|---|---|---|---|
| {{t('settings.changeLevel')}} | `aperto = true` |  | liv0: sì<br>liv2: sì<br>dialog cambio utente aperto: sì | – | no |
| {{t('settings.changeLanguage')}} | `cambiaLingua` |  | liv0: sì<br>liv2: sì<br>dialog cambio utente aperto: sì | – | no |
| (close) | `aperto = false` |  | liv0: sì<br>liv2: sì<br>dialog cambio utente aperto: sì | – | no |

