<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';
    
    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    // (tray-teaching) campo numerico condiviso per i 6 valori pendant
    import numericField from '../../components/numericField.vue'
    const el = ref()
</script>

<template>   
      <div class="view-shell view-shell--fill conf-card">
        <div class="view-header">
            <h3 class="view-title">{{$t('tray.welcome')}}</h3>
            <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="createTray()">
                {{$t('tray.add_Tray')}}
            </button>
            <!-- (tray-teaching) comando "0 CASSETTIERA": un solo teaching sul
                 cassetto campione, derivazione automatica degli altri 11.
                 (teach-pick-target) gate REALE sul click, non solo classe: il
                 dialog confermato scrive i CORR di TUTTI e 12 i cassetti —
                 stessa soglia della classe (userLevel<=1 = locked). Il vizio
                 solo-CSS di "Add" e dei bottoni AttrezzaggiView resta censito
                 a backlog, qui il danno e' concreto. -->
            <button class="pure-button pure-button-primary" :class="{'pure-button-disabled':dataStored.userLevel<=1}" :id="locked" @click="dataStored.userLevel>1 ? openTeach() : ''">
                {{$t('tray.teach.button')}}
            </button>
        </div>
        <div class="table-scroll">
        <table class="pure-table pure-table-horizontal">
            <thead>
                <tr>
                    <!--th>ID</th-->
                    <th>{{$t('tray.name')}}</th>
                    <th>{{$t('tray.family')}}</th>
                    <!--th>{{$t('tray.stato')}}</th-->
                    <th style='width:20%' id='hide'>{{$t('tray.descr')}}</th>
                    <!--th>{{$t('tray.num_posti')}}</th-->
                    
                    <!--th>{{$t('tray.num_grezzi')}}</th>
                    <th>{{$t('tray.num_vuoti')}}</th>
                    <th>{{$t('tray.num_finiti')}}</th-->
                    <th>{{$t('tray.comands')}}</th>
                </tr>
            </thead>
            <tbody>
                <template v-for="(dt,index) in datiTab" :key="dt.ID" >
                    <tr :class="{'pure-table-odd':(index%2==1),'extractedRow':dt.EXTRACT>0 && dt.EXTRACT<1000}">
                        <!--td>{{dt.ID}} </td-->
                        <td v-if="dt.FLOOR_MAG>0" :class="{'extract':(dt.EXTRACT>0 && dt.EXTRACT<1000),'extractBlink':dt.EXTRACT==1000,'releaseBlink':dt.EXTRACT==2000}" >
                            {{dt.MAG}}.<strong>{{dt.FLOOR_MAG}} </strong>
                        </td>
                        <td v-else><strong>OUT</strong></td>
                        
                        <!--td v-if="dt.FLOOR_MAG>0">{{dt.FLOOR_MAG}} </td>
                        <td v-else></td-->

                        <td v-if="dt.FAMILY.trim().length>0" @click="goToLayout(dt.ID, dt.EXTRACT, dt.STATUS, dt.FLOOR_MAG)">
                            <span>
                                <img src="../../assets/link.png" width="20em"/>
                                &nbsp;
                                {{dt.FAMILY}}
                            </span>
                        </td>
                        <td v-else></td>

                        <!--td  :class="getClassFromStatusDesc(dt.STATUS_DESC)">
                            {{ dt.STATUS_DESC.toString().trim() }}
                        </td-->

                        <td  id='hide'>{{dt.DESCR.trim()}}</td>
                        <!--td>{{dt.N_PLACE}}</td-->
                        <!--td>{{dt.N_RAW}}</td>
                        <td>{{dt.N_EMPTY}}</td>
                        <td>{{dt.N_FINISHED}}</td-->
                        <td>
                            <orderCMD  
                                modify="true"               @cmdModify="updateTray(dt.ID)"
                                del="true"                  @cmdDel="sicurezza(dt.ID)"
                                :move="dt.FLOOR_MAG>0 && (dt.EXTRACT==1 || allInside)"  @cmdMove="sendToBox(dt.EXTRACT, dt.FLOOR_MAG)"
                                :moveDisable="!dataStored.cmdActiveMission" 
                            />
                        </td>
                    </tr>
                    <tr v-if="_showPopUp(dt.ID)">
                        <td class="popUpOnLine" colspan="20" >
                            <div class="center">
                                <h3>{{ $t('tray.sure') }}</h3>
                                <h4>{{ $t('tray.delete') }}</h4>
                                <span class="pure-g">
                                    <button class="pure-button-micromission specialCMD pure-u-1" @click="deleteTray(dt.ID)">
                                        DELETE
                                    </button>
                                    <button class="btn-ghost pure-u-1" @click="showPopUp=0">
                                        EXIT
                                    </button>
                                </span>
                            </div>
                        </td>
                    </tr>
                </template>
            </tbody>
        </table>
        </div>

        <!-- ===== (tray-teaching) dialog comando "0 CASSETTIERA" =====
             3 passi: campione eleggibile -> 6 valori pendant -> ANTEPRIMA
             obbligatoria (12 righe in mm) -> scrittura transazionale. -->
        <div v-if="teach.open" class="mission-dialog-overlay">
          <div class="mission-dialog">
            <h3 class="command-section-title">{{ $t('tray.teach.title') }}</h3>

            <!-- passo 1: cassetto CAMPIONE (eleggibile = posizioni a DB) -->
            <template v-if="teach.step==1">
              <div class="teach-hint">{{ $t('tray.teach.chooseSample') }}</div>
              <div class="teach-list">
                <button v-for="n in 12" :key="n" class="mission-dialog-item"
                  :class="{ selected: teach.sample===n }"
                  :disabled="!eligibleFloors.has(n)"
                  @click="teach.sample=n">
                  <span>{{ $t('tray.teach.floor') }} {{ n }}</span>
                  <span v-if="!eligibleFloors.has(n)" class="teach-muted">{{ $t('tray.teach.notEligible') }}</span>
                </button>
              </div>
              <div class="pure-g">
                <div class="pure-u-1-2">
                  <button style="width:100%" class="button_pressed"
                    :class="[teach.sample==null ? 'pure-button-disable' : 'pure-button-mission']"
                    @click="teach.sample!=null ? teach.step=2 : ''">
                    {{ $t('tray.teach.next') }}
                  </button>
                </div>
                <div class="pure-u-1-2">
                  <button style="width:100%" class="btn-ghost" @click="closeTeach()">
                    {{ $t('robot.dialog.cancel') }}
                  </button>
                </div>
              </div>
            </template>

            <!-- passo 2: valori pendant (X/Y/Z mm, RX/RY/RZ gradi) -->
            <template v-if="teach.step==2">
              <div class="teach-hint">{{ $t('tray.teach.pendantHint', { n: teach.sample }) }}</div>
              <div class="teach-field">
                <label>X [mm]</label>
                <numericField name="teachX" step=0.01 min=-3000 max=3000
                  :model-value="teach.px" @update="v => teach.px = v"></numericField>
              </div>
              <div class="teach-field">
                <label>Y [mm]</label>
                <numericField name="teachY" step=0.01 min=-3000 max=3000
                  :model-value="teach.py" @update="v => teach.py = v"></numericField>
              </div>
              <div class="teach-field">
                <label>Z [mm]</label>
                <numericField name="teachZ" step=0.01 min=-3000 max=3000
                  :model-value="teach.pz" @update="v => teach.pz = v"></numericField>
              </div>
              <!-- (teach-pick-target) pezzo della posizione 1 irrisolvibile:
                   calcolo BLOCCATO con motivo esplicito, mai stime silenziose -->
              <div class="teach-warning" v-if="teach.calcError">{{ $t(teach.calcError) }}</div>
              <div class="teach-hint">{{ $t('tray.teach.rotHint') }}</div>
              <div class="teach-field">
                <label>RX [&deg;]</label>
                <numericField name="teachRX" step=0.1 min=-360 max=360
                  :model-value="teach.rx" @update="v => teach.rx = v"></numericField>
              </div>
              <div class="teach-field">
                <label>RY [&deg;]</label>
                <numericField name="teachRY" step=0.1 min=-360 max=360
                  :model-value="teach.ry" @update="v => teach.ry = v"></numericField>
              </div>
              <div class="teach-field">
                <label>RZ [&deg;]</label>
                <numericField name="teachRZ" step=0.1 min=-360 max=360
                  :model-value="teach.rz" @update="v => teach.rz = v"></numericField>
              </div>
              <div class="pure-g">
                <div class="pure-u-1-3">
                  <button style="width:100%" class="btn-ghost" @click="teach.step=1">
                    {{ $t('tray.teach.back') }}
                  </button>
                </div>
                <div class="pure-u-1-3">
                  <button style="width:100%" class="button_pressed pure-button-mission" @click="calcPreview()">
                    {{ $t('tray.teach.next') }}
                  </button>
                </div>
                <div class="pure-u-1-3">
                  <button style="width:100%" class="btn-ghost" @click="closeTeach()">
                    {{ $t('robot.dialog.cancel') }}
                  </button>
                </div>
              </div>
            </template>

            <!-- passo 3: ANTEPRIMA obbligatoria -->
            <template v-if="teach.step==3">
              <!-- (teach-pick-target) la posa DICHIARATA, scolpita sopra la
                   tabella: e' esattamente cio' che uscira' per la pos.1 -->
              <div class="teach-hint">
                {{ $t('tray.teach.pickPose', { n: teach.sample }) }}:
                X {{ teach.px }} &middot; Y {{ teach.py }} &middot; Z {{ teach.pz }} mm
                &middot; RX {{ teach.rx }}&deg; RY {{ teach.ry }}&deg; RZ {{ teach.rz }}&deg;
              </div>
              <div class="teach-hint">{{ $t('tray.teach.preview') }}</div>
              <div class="table-scroll">
                <table class="pure-table pure-table-horizontal teach-table">
                  <thead>
                    <tr>
                      <th>{{ $t('tray.teach.floor') }}</th>
                      <th>X_CORR [mm]</th>
                      <th>Y_CORR [mm]</th>
                      <th>Z_CORR [mm]</th>
                      <th>&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in teach.preview" :key="r.tray" :class="{'pure-table-odd': r.tray % 2==1}">
                      <td><strong>{{ r.tray }}</strong>{{ r.tray==teach.sample ? ' *' : '' }}</td>
                      <td>{{ mm(r.xCorr) }}</td>
                      <td>{{ mm(r.yCorr) }}</td>
                      <td>{{ mm(r.zCorr) }}</td>
                      <td><span v-if="!r.hasTray" class="teach-muted">{{ $t('tray.teach.noTrayRow') }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="teach-hint">
                {{ $t('tray.teach.rotSummary') }}: RX {{ teach.rx }}&deg; &middot; RY {{ teach.ry }}&deg; &middot; RZ {{ teach.rz }}&deg;
              </div>
              <div class="pure-g">
                <div class="pure-u-1-3">
                  <button style="width:100%" class="btn-ghost" @click="teach.step=2">
                    {{ $t('tray.teach.back') }}
                  </button>
                </div>
                <div class="pure-u-1-3">
                  <button style="width:100%" class="button_pressed pure-button-mission" @click="confirmTeach()">
                    {{ $t('tray.teach.write') }}
                  </button>
                </div>
                <div class="pure-u-1-3">
                  <button style="width:100%" class="btn-ghost" @click="closeTeach()">
                    {{ $t('robot.dialog.cancel') }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
</template>

<script>
export default {
    data(){
        return {
            datiTab:[],
            showPopUp:0,
            //polling:true,
			allInside:false,
            // (tray-teaching) dialog "0 CASSETTIERA": step 1 campione,
            // step 2 pendant (mm/gradi), step 3 anteprima (millesimi interi).
            teach: {
                open: false,
                step: 1,
                sample: null,
                px: 0, py: 0, pz: 0,
                rx: 0, ry: 0, rz: 0,
                positions: [],   // [POSITION] TRAY_% raw (eleggibilita' + SUB_POS 1)
                cfe: [],         // COORDINATES_FOR_EXTRACT (delta tra piani)
                pieces: [],      // anagrafica PIECE (componente pezzo in Z)
                calcError: '',   // chiave i18n del blocco calcolo (pezzo irrisolvibile)
                preview: []      // 12 righe {tray, xCorr, yCorr, zCorr, hasTray}
            }
        }
    },
    methods: {
        getDataTable() {
            fetch(dataStored.server+'api/conf/tray/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(trays => {
                    console.log("ricevo dati per "+trays.length+" cassetti")  
                    //console.log(trays[0].FLOOR_MAG + " "+trays[0].EXTRACT)
                    //console.log(trays[1].FLOOR_MAG + " "+trays[1].EXTRACT)
                    this.datiTab=trays  
					this.allInside=true;
					for (let i=0; i<this.datiTab.length; i++){
						if (this.datiTab[i].EXTRACT == 1)
							this.allInside=false;
					}
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        updateTray(i){
            //alert("modifica "+i);
            this.$router.push('/conf/tray?trayID='+i);
            //this.$router.push({ name: 'conf/tray', params:{trayID: i}} );
        },
        sicurezza(i){
            this.showPopUp=i
            //alert("ricevo "+i)
        },
        /*moveTray(ID){
            let query = 'api/conf/tray/extract/'
            for(let j=0;j<this.datiTab.length;j++){
                if (this.datiTab[j].ID != ID ) continue;
                if(this.datiTab[j].EXTRACT==1){
                    //se è estratto 
                    query = 'api/conf/tray/insert/'
                }else
                    if(this.datiTab[j].EXTRACT==1000){
                        //se è in estrazione
                        query = 'api/conf/tray/resetExtract/';
                    }else
                        if (this.datiTab[j].EXTRACT==2000) {
                            //se è in inserimento 
                            query = 'api/conf/tray/resetInsert/';
                        }
            }
            fetch(dataStored.server+query+ID ,{ method: 'get'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        },
        */
        deleteTray(i){
            this.showPopUp=0
            fetch(dataStored.server+'api/conf/tray/'+i ,{ method: 'delete'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
            this.getDataTable();
        },
        createTray(){
            this.$router.push('/conf/tray');
        },
        // ===== (tray-teaching) comando "0 CASSETTIERA" =====
        openTeach(){
            this.teach.open = true;
            this.teach.step = 1;
            this.teach.sample = null;
            this.teach.px = 0; this.teach.py = 0; this.teach.pz = 0;
            this.teach.rx = 0; this.teach.ry = 0; this.teach.rz = 0;
            this.teach.preview = [];
            this.teach.calcError = '';
            // posizioni raw dei cassetti (PARENT nchar PADDATO: trim),
            // coordinate di estrazione per-piano per i delta e anagrafica
            // PIECE (componente pezzo della Z di prelievo)
            fetch(dataStored.server+'api/conf/position/show/all',{ method: 'GET'})
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(d => { this.teach.positions = (d || []).filter(p => (p.PARENT || '').trim().indexOf('TRAY_') == 0); })
                .catch(e => { console.info(e); this.teach.positions = []; });
            fetch(dataStored.server+'api/conf/tray/extractCoords',{ method: 'GET'})
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(d => { this.teach.cfe = d || []; })
                .catch(e => { console.info(e); this.teach.cfe = []; });
            fetch(dataStored.server+'api/conf/piece/show/all',{ method: 'GET'})
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.json(); })
                .then(d => { this.teach.pieces = d || []; })
                .catch(e => { console.info(e); this.teach.pieces = []; });
        },
        closeTeach(){
            this.teach.open = false;
        },
        mm(v){
            return (v / 1000).toFixed(3);
        },
        calcPreview(){
            this.teach.calcError = '';
            const f = this.teach.sample;
            const p1 = this.teach.positions.find(p => p.PARENT.trim() == 'TRAY_'+f && p.SUB_POS == 1);
            const cfeC = this.teach.cfe.find(c => c.TRAY == f);
            if (!p1 || !cfeC) return;
            // (teach-pick-target) i 6 valori dichiarati sono la POSA DI
            // PRELIEVO della posizione 1 (robot IN PRESA sul pezzo). La vista
            // 4Robot somma alla Z la componente pezzo (PIECE.Z - PIECE.Z_PICK):
            // il CORR deve sottrarla, altrimenti la posa dichiarata NON e'
            // quella che esce dalla vista. Pezzo irrisolvibile -> BLOCCO
            // esplicito (mai calcolare con componente pezzo assunta 0).
            const piece = this.teach.pieces.find(x => x.ID == p1.Part_Type);
            if (!piece || piece.Z == null || piece.Z_PICK == null) {
                this.teach.calcError = 'tray.teach.pieceMissing';
                return;
            }
            // (Q1) CORR campione = pendant - (pos + pos_CORR) della POSIZIONE 1.
            // Z: si sottraggono pos.Z_CORR E la componente pezzo — pos.Z NON va
            // sottratta perche' la transazione teachTrays la porta a 0
            // (convenzione E/Q6): sottrarla e poi azzerarla conterebbe doppio.
            // X/Y: in presa il pendant e' il centro pezzo = identico al piano.
            const corrC = {
                x: Math.round(this.teach.px * 1000 - (p1.X + p1.X_CORR)),
                y: Math.round(this.teach.py * 1000 - (p1.Y + p1.Y_CORR)),
                z: Math.round(this.teach.pz * 1000 - p1.Z_CORR - (piece.Z - piece.Z_PICK))
            };
            // delta tra piani da COORDINATES_FOR_EXTRACT (tutti e 3 gli assi:
            // in cella varia solo Z, ma X/Y coprono i piani fuori canone)
            const floorsWithTray = new Set(this.datiTab.map(t => t.FLOOR_MAG));
            this.teach.preview = this.teach.cfe
                .filter(c => c.TRAY >= 1 && c.TRAY <= 12)
                .map(c => ({
                    tray: c.TRAY,
                    xCorr: corrC.x + (c.X - cfeC.X),
                    yCorr: corrC.y + (c.Y - cfeC.Y),
                    zCorr: corrC.z + (c.Z - cfeC.Z),
                    hasTray: floorsWithTray.has(c.TRAY)
                }));
            this.teach.step = 3;
        },
        confirmTeach(){
            // rotazioni pendant: uniformi per tutta la cassettiera (gradi ->
            // millesimi di grado)
            const rows = this.teach.preview.map(r => ({
                tray: r.tray,
                xCorr: r.xCorr, yCorr: r.yCorr, zCorr: r.zCorr,
                xRot: Math.round(this.teach.rx * 1000),
                yRot: Math.round(this.teach.ry * 1000),
                zRot: Math.round(this.teach.rz * 1000)
            }));
            fetch(dataStored.server+'api/conf/tray/teachTrays?rows='+encodeURIComponent(JSON.stringify(rows)),{ method: 'GET'})
                .then(r => { if (!r.ok) throw new Error('Network response was not ok'); return r.text(); })
                .then(body => {
                    dataStored.alert.title = body == 'OK' ? 'INFO' : this.$t('WARNING');
                    dataStored.alert.desc = body == 'OK' ? 'tray.teach.writeOk' : 'tray.teach.writeErr';
                    dataStored.alert.type = body == 'OK' ? 'message' : 'warning';
                    this.closeTeach();
                    this.getDataTable();
                })
                .catch(e => { console.info(e); });
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
        },
        getClassFromStatusDesc(status){
            //alert(JSON.stringify(status,null,4))
            return status.toString().trim().toLowerCase();
        },
        goToLayout(trayID, extracted, status, floorMag){
            //this.$router.push('/conf/Grating/'+trayID);
            if (extracted || 
                status==dataStored.status_working || 
                status==dataStored.status_locked  ||
                status==dataStored.status_paused  )
                //modifiche non permesse
                this.$router.push('/layout/'+trayID+"/0/"+floorMag);
            else
                this.$router.push('/layout/'+trayID+"/1/"+floorMag);
        },
        sendToBox(extracted,num){
            if (extracted)
			    dataStored.WS.socket.emit("TO_PLANT/CMD/BOX", "26;"+num); //release  ??? codice missione scritto
            else
                dataStored.WS.socket.emit("TO_PLANT/CMD/BOX", "25;"+num); //extract
		}
    },
    computed:{
        // (tray-teaching) piani eleggibili come campione: hanno la POSIZIONE 1
        // a DB (un cassetto senza grigliato associato non e' eleggibile)
        eligibleFloors(){
            return new Set(this.teach.positions
                .filter(p => p.SUB_POS == 1)
                .map(p => parseInt(p.PARENT.trim().slice(5))));
        },
        locked(){
            if (dataStored.userLevel<=1)
                return 'locked4maintenance'
            return ''
        }
    },
    mounted(){
        this.getDataTable();
        //setInterval(() => {
        //    if(this.polling)
        //        this.getDataTable()
        //}, 3000);
        dataStored.WS.socket.on('BOX/STATUS', ()=>{
          this.getDataTable()
        })
    },
    unmounted(){
        //this.polling=false;
        //dataStored.WS.socket.off('BOX/STATUS');
    }
}
</script>

<style scoped>
    .pure-table-horizontal  #td {
        justify-content: center;
        display: flex;
    }
    .pure-table{
        width: inherit;
    }

    .extractedRow {
        border: dashed 4px;
        border-color: var(--accent);
    }
    .extractReq{
        border: dashed 2px;
        border-color: var(--color-info);
    }

    .extract{
        background-image: url('/src/assets/extractTray.PNG');
        background-position-x: 56px;
        background-position-y: 50%;
        background-repeat: no-repeat;
    }

    .extractBlink{
        background-image: url('/src/assets/extractTray.PNG');
        background-position-x: 56px;
        background-position-y: 50%;
        background-repeat: no-repeat;
        animation: blink 1s;
        animation-iteration-count: infinite;
    }

    .releaseBlink{
        background-image: url('/src/assets/insertTray.PNG');
        background-position-x: 56px;
        background-position-y: 50%;
        background-repeat: no-repeat;
        animation: blink 1s;
        animation-iteration-count: infinite;
    }

    @keyframes blink {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
    }
    
    .popUpOnLine{
        background-image: url(/src/assets/up_red.png);
        background-repeat: no-repeat;
        background-position-x: 14.6em;
    }

    .popUpOnLine .btn-ghost {
        margin-top: var(--space-2);
    }

    /* 2px (non 1px --border-card): il popup di conferma delete deve
       staccare piu' di un bordo card. */
    .center {
        margin: auto;
        width: 20%;
        border: 2px solid var(--color-critical);
        padding: var(--space-6);
    }

</style>

<style scoped>
    #locked4OP{
        background-image:url('/src/assets/chiaveIng.svg');
        background-repeat: no-repeat;
        background-size: 1.5em;
        background-position-x: 100%;
        background-position-y: 100%;
    } 
    /* Badge status (grafia lowercase): semantica allineata a productionTable.
       Nota: il td che li usava (getClassFromStatusDesc) e' oggi commentato
       nel template — classi tokenizzate ma di fatto inattive. */
    .paused {
        color: var(--text-muted);
        border-radius: var(--radius-lg);
    }

    .finished {
        background-color: var(--bg-surface-2);
        color: var(--text-secondary);
        border-radius: var(--radius-lg);
    }

    .stop {
        background-color: var(--color-danger-bg);
        color: var(--color-danger);
        border-radius: var(--radius-lg);
    }

    .abort {
        background-color: var(--color-danger-bg);
        color: var(--color-danger);
        border-radius: var(--radius-lg);
    }

    .working {
        background-color: var(--color-success-bg);
        color: var(--color-success);
        border-radius: var(--radius-lg);
    }

    .raw {
        background-color: var(--color-info-bg);
        color: var(--color-info);
        border-radius: var(--radius-lg);
    }

    /* ===== (tray-teaching) overlay canonico (stesso pattern scoped di
       robotView/AttrezzaggiView: overlay a schermo pieno z 1000, card
       dialog, voci touch) ===== */
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
        width: min(560px, 92vw);
        max-height: 85vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
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

    .mission-dialog-item:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .teach-list {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-2);
    }

    .teach-hint {
        background: var(--color-info-bg);
        color: var(--color-info);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font-size: var(--font-size-sm);
    }

    .teach-warning {
        background: var(--color-warning-bg);
        color: var(--color-warning);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font-size: var(--font-size-sm);
    }

    .teach-muted {
        color: var(--text-muted);
        font-size: var(--font-size-xs);
        font-style: italic;
    }

    .teach-field {
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }

    .teach-field label {
        min-width: 64px;
        color: var(--text-secondary);
    }

    .teach-table td, .teach-table th {
        text-align: right;
    }

    .teach-table td:first-child, .teach-table th:first-child {
        text-align: left;
    }
</style>
