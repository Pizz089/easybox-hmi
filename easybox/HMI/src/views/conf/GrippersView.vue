<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import buttonsCMD from '../../components/Comands/ComandsRows.vue';
    import UiButton from '../../components/ui/UiButton.vue';
    import { Lock, Plus } from 'lucide-vue-next';

    import { ref, onMounted } from 'vue'
    import { dataStored } from '../../data';
    import { dedupeGrippers, isTwinGripper } from '../../util/grippers.js';
    // (7/10, consegna 34) cassetto fuori: niente carica / scarica pinza
    import { statoCassetti, motivoPinzaCassetto } from '../../util/cassettoFuori.js';
    const el = ref()
</script>

<template>
      <!-- (v3 fase D) Attrezzaggio · Pinze: card come i cataloghi del
           Magazzino (assets/css/catalog-v3.css), invece della tabella.
           Comandi, guardie e conferme quelli di prima: Modifica, Cancella e Prendi/Rilascia dal
           componente di sempre (ComandsRows, stesse props ed eventi),
           la cancellazione chiede conferma come prima (window.confirm in deleteGripper). Aggiungi spento sotto il livello 2, come prima
           (pure-button-disabled). tests/test_golden_equivalenza.mjs -->
      <div class="view-shell view-shell--fill cat">
        <div class="cat-head">
          <h2 class="cat-head__title">{{$t('gripper.welcome')}}</h2>
          <UiButton variant="primary" :icon="dataStored.userLevel<=1 ? Lock : Plus"
                  :disabled="dataStored.userLevel<=1" @click="CreateGripper()">
            {{$t('gripper.add_gripper')}}
          </UiButton>
        </div>
        <!-- (7/10, consegna 34) carica / scarica pinza spenti col cassetto
             fuori: il motivo si scrive, non si lascia un bottone muto -->
        <p class="tray-hint" v-if="motivoPinza">{{ $t(motivoPinza) }}</p>
        <div class="cat-list">
          <template v-for="(dt, index) in datiTab" :key="dt.ID" >
            <!-- (gripper-twins) UNA card per pinza fisica (util/grippers.js,
                 riga canonica = ID minore); la gemella si apre dal link -->
            <article class="cat-card">
              <div class="cat-card__head">
                <span class="cat-card__code">{{dt.FAMILY.trim()}}</span>
              </div>
              <span class="cat-card__desc">{{dt.DESCR.trim()}}</span>
              <div v-if="isTwinGripper(dt)" class="twin-row">
                <span v-if="isTwinGripper(dt)" class="twin-badge">{{ $t('gripper.twinBadge', { ids: dt.twinIDs.join('+') }) }}</span>
                <!-- (gripper-twins) la gemella non ha una riga sua ma la
                     geometria del lato 2 vive SOLO li': accesso diretto al
                     form di modifica (stesso modifyGripper, per ID) -->
                <button v-for="tid in dt.twinIDs.filter(i => i != dt.ID)" :key="tid"
                        type="button" class="twin-link"
                        :title="$t('gripper.twinOpen', { id: tid })"
                        @click="modifyGripper(tid)">
                    &#9998; {{ $t('gripper.twinOpen', { id: tid }) }}
                </button>
              </div>
              <dl class="cat-card__facts">
                <div><dt>{{$t('gripper.stato')}}</dt><dd>{{ $t(dt.STATUS_DESC.trim()) }}</dd></div>
                <div><dt>{{$t('gripper.position')}}</dt><dd v-html="calculatePos(index)" class="cell-pos"></dd></div>
              </dl>
              <div class="cat-card__actions">
                <buttonsCMD  :reference="createLink( dt.ID )"
                           :index="toStr(dt.ID)"
                           modify=true                      @cmdModify="modifyGripper(dt.ID)"
                           del=true                         @cmdDel="deleteGripper(dt.ID)"
                           :move="dt.POS_PLANT>=0 && (!gripperOnRobot || (gripperOnRobot && dt.POS_PLANT==1000))"   @cmdMove="PickReleaseGripper(dt.ID)"
                           :moveDisable="!dataStored.cmdActive || motivoPinza !== ''" >
                           <!--:move="dt.POS_PLANT!=1000 || !gripperOnRobot"   @cmdMove="PickReleaseGripper(dt.ID)"-->
                </buttonsCMD>
              </div>
            </article>
          </template>
        </div>
      </div>
</template>

<script>
export default {
    data(){
        return {
            popup:false,
            datiTab:[],
            statusList:[],
            // (7/10) cassetto fuori / in manovra (util/cassettoFuori.js)
            cassetti: { estratto: null, manovra: false },
            polling:true
        }
    },
    methods: {
        getDataTable() {
            fetch(dataStored.server+'api/conf/gripper/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(pinze => {
                    //console.log(JSON.stringify(order,null,4))
                    console.log("ricevo dati per "+pinze.length+" pinze")
                    // (gripper-twins) una riga per pinza fisica
                    const rows = dedupeGrippers(pinze);
                    if (JSON.stringify(this.datiTab) !== JSON.stringify(rows)){
                        this.datiTab=rows
						//this.gripperOnRobot=false
						//for (let i=0; i<this.datiTab.length; i++){
                        //    if (this.datiTab[i].POS_PLANT > 1000)
                        //        this.gripperOnRobot=true;
                        //}
                    }
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
            this.getTrays();
        },
        // (7/10, consegna 34) i cassetti, con le regole della pagina Robot: con
        // un cassetto fuori il PLC rifiuta carico (1419) e deposito (1519)
        getTrays() {
            fetch(dataStored.server+'api/conf/tray/show/all',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json()
                })
                .then(trays => { this.cassetti = statoCassetti(trays); })
                .catch(error => { console.info(error); });
        },
        CreateGripper(){
            this.$router.push('/conf/Gripper/Gripper');
        },
        createLink(id) {
            let stringObj = new String(id);
            return "/conf/Gripper/gripper" ;
            //return "/conf/Gripper/gripper/"+stringObj ;
        },
        toStr(id) {
            let stringObj = new String(id);
            return parseInt(stringObj);
        },
        calculatePos(i) {
            //console.log("ui "+JSON.stringify(this.datiTab[i],null,4))
            if (this.datiTab[i].POS_PLANT==1000)
                return '<strong>ROBOT<strong>';
            if (this.datiTab[i].POS_PLANT<0)
                return this.$t('OUT');
            // (gripper-twins) SUB_POS non e' una sotto-posizione di scaffale ma
            // la chiave delle gemelle: la posizione e' il solo POS_MAG
            return this.datiTab[i].POS_MAG;
        },
        PickReleaseGripper(ID){
            // (7/10) il bottone e' gia' spento: difesa in piu'
            if (this.motivoPinza) return;
            for(let i=0; i<this.datiTab.length; i++){
                if (this.datiTab[i].POS_PLANT==1000){    
                    //c'e' almeno una pinza montata su robot => la scarico
                    this.sendToRobot(12);
                    return;
                }
            }
            //robot senza pinza => carico la pinza richiesta
            this.sendToRobot("11;"+ID);
        },
        modifyGripper(gripperID){
            this.$router.push('/conf/gripper/gripper?gripperID='+gripperID);
        },
        deleteGripper(ID){
            if (window.confirm(this.$t('gripper.delete'))){
                fetch(dataStored.server+'api/conf/gripper/'+ID ,{ method: 'delete'})
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
            }
        },
        sendToRobot(val) {
            dataStored.WS.socket.emit("TO_PLANT/CMD/ROBOT", val);
        }
    },
    computed:{
        // (7/10) '' se il cassetto non c'entra, altrimenti la chiave del motivo
        motivoPinza(){
            return motivoPinzaCassetto(this.cassetti);
        },
        gripperOnRobot(){
            for(let i=0; i<this.datiTab.length; i++){
                if (this.datiTab[i].POS_PLANT==1000)
                    return true;
            }
            return false;
        },
        locked(){
            if (dataStored.userLevel<=1)
                return 'locked4maintenance'
            return ''
        }
    },
    mounted(){
        this.getDataTable()
        setInterval(() => {
            if(this.polling)
                this.getDataTable()
        }, 3000);
    },
    unmounted(){
        this.polling=false;
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

    /* (gripper-twins) link alla gemella: stessa misura touch dei bottoni ghost */
    .twin-link {
        display: inline-flex;
        align-items: center;
        margin-left: var(--space-2);
        min-height: var(--touch-target-min);  /* (v3 fase D) 48, era 32 */
        padding: 0 var(--space-2);
        background: transparent;
        border: 1px dashed var(--border-strong);
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        font-size: var(--font-size-xs);
        cursor: pointer;
    }
    .twin-link:hover {
        color: var(--accent);
        border-color: var(--accent);
    }

    /* (v3 fase D) badge e link della gemella su una riga della card */
    .twin-row { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
    /* (gripper-twins) badge "doppia" sulla riga canonica */
    .twin-badge {
        display: inline-block;
        margin-left: 0;
        padding: 0 var(--space-2);
        border: 1px solid var(--accent);
        border-radius: var(--radius-sm);
        color: var(--accent);
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .cell-descr {
        max-width: 20%;
    }
    .cell-pos {
        max-width: 30px;
    }
    /* (7/10) motivo dei comandi pinza spenti, come .cmd-hint della pagina Robot */
    .tray-hint {
        font-size: var(--font-size-xs);
        color: var(--text-muted);
        margin: 0 0 8px 0;
    }
</style>
