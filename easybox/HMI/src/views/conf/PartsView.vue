<script setup>
    //import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../../data.js'
    import orderCMD from '../../components/Comands/ComandsRows.vue';
    import CubeIcon3D from '../../components/CubeIcon3D.vue';
    import StatoElenco from '../../components/StatoElenco.vue';
    import { caricaElenco, STATO } from '../../util/caricaElenco.js';
    // (v3 fase C) anagrafica in card, componenti v3 (stili in assets/css/catalog-v3.css)
    import UiButton from '../../components/ui/UiButton.vue'
    import { Plus, Lock } from 'lucide-vue-next'

</script>

<template>
    <!-- (v3 fase C) Magazzino · Pezzi: anagrafica in card, componenti v3.
         Campi, chiamate e conferme quelli di prima: Crea nuovo tipo pezzo
         dal livello 2 (lucchetto sotto), Modifica e Cancella da ComandsRows
         (stesse guardie), la conferma di cancellazione nella card con lo
         stesso testo. Il solido e' quello di sempre (CubeIcon3D, misure
         vere). -->
    <div class="view-shell view-shell--fill cat" >
      <div class="cat-head">
          <h2 class="cat-head__title">{{ $t('piece.listTitle') }}</h2>
          <UiButton variant="primary" :icon="dataStored.userLevel<=1 ? Lock : Plus"
                  :disabled="dataStored.userLevel<=1"
                  @click="createPart()">
            {{$t('piece.createNew')}}
          </UiButton>
      </div>
      <div class="cat-list">
        <template v-for="(p) in pieces" :key="p.ID" >
            <article v-if="p.ID>0" class="cat-card">
                <div class="part-card__top">
                    <!-- feat(parts-images): anteprima proporzionale a token dark,
                         stesso generatore del wizard produzione (audit J, opz. A) -->
                    <div class="part-card__draw" aria-hidden="true">
                        <CubeIcon3D :w="p.X" :d="p.Y" :h="p.Z" :prisma="p.PRISMA" :size="72" />
                    </div>
                    <div class="part-card__id">
                        <span class="cat-card__code">{{p.FAMILY}}</span>
                        <span class="cat-card__desc">{{p.DESCR}}</span>
                    </div>
                </div>
                <dl class="cat-card__facts">
                    <div><dt>{{$t('piece.dim')}}</dt><dd>{{p.X/1000}} × {{p.Y/1000}}</dd></div>
                    <div><dt>{{$t('piece.Z')}}</dt><dd>{{p.Z/1000}}</dd></div>
                    <div><dt>{{$t('piece.Z_pick')}}</dt><dd>{{p.Z_PICK/1000}}</dd></div>
                    <div><dt>{{$t('piece.Z_place')}}</dt><dd>{{p.Z_PLACE/1000}}</dd></div>
                </dl>
                <div class="cat-card__actions">
                    <orderCMD  :reference="createLink( p.ID )"
                                :index="toStr(p.ID)"
                                modify="true"   @cmdModify="modifyPiece(p.ID)"
                                del="true"  	@cmdDel="sicurezza(p.ID)"
                                >
                    </orderCMD>
                </div>
                <div v-if="_showPopUp(p.ID)" class="cat-card__confirm">
                    <div class="cat-card__sure"><b>{{ $t('pallet.sure') }}</b></div>
                    <UiButton variant="danger" size="min" @click="deletePiece(p.ID)">
                        {{ $t('rowCmd.delete') }}
                    </UiButton>
                    <UiButton variant="outline" size="min" @click="showPopUp=0">
                        {{ $t('common.cancel') }}
                    </UiButton>
                </div>
            </article>
        </template>
      </div>
      <StatoElenco
        :stato="statoElenco"
        :vuoto="pieces.length === 0"
        :messaggio-vuoto="$t('piece.nessuno')"
        @riprova="getDataTable()"
      />
    </div>
</template>

<script>
export default {
    data(){
        return {
            pieces:[],
            // (usabilita' 15/9) 'attesa' finche' non si sa: niente affermazioni
            // prima di avere una risposta
            statoElenco: STATO.ATTESA,
            showPopUp:-1,
            createNew:false,
			polling:true
        }
    },
    methods: {
        getDataTable() {
            // (usabilita' 15/9) il guasto non finisce piu' solo in console:
            // una tabella senza righe non e' la stessa cosa di un elenco vuoto.
            this.statoElenco = STATO.ATTESA;
            caricaElenco(dataStored.server, 'api/conf/piece/show/all').then(esito => {
                this.statoElenco = esito.stato;
                if (esito.stato === STATO.OK) this.pieces = esito.dati;
                else console.info('elenco pezzi non letto: ' + esito.dettaglio);
            });
        },
        createLink(id) {
            let stringObj = new String(id);
            return "/conf/piece/" ;
        },
		createPart() {
			this.$router.push('/conf/piece/piece');
		},
        toStr(id) {
            let stringObj = new String(id);
            return parseInt(stringObj);
        },
        modifyPiece(pieceID){
          this.$router.push('/conf/piece/piece?pieceID='+pieceID);
        },
        sicurezza(i){
            this.showPopUp=i
        },
		deletePiece(pieceID){
          this.showPopUp=-1;
		  fetch( dataStored.server+'api/conf/piece/'+pieceID,{ method: 'delete'})
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
        },
        _showPopUp(i){
            if (this.showPopUp==i)
                return true
            return false
        },
    },
    mounted(){
        this.getDataTable()
        setInterval(() => {
            if(this.polling)
                this.getDataTable();
        }, 2000);
    },
    unmounted(){
        this.polling=false;
    },
    computed:{
        locked(){
            if (dataStored.userLevel<=1)
                return 'locked4maintenance'
            return ''
        }
    }
}
  </script>

<style scoped>
/* (v3 fase C) card, intestazione e conferma da assets/css/catalog-v3.css;
   qui solo il disegno del pezzo accanto a codice e descrizione */
.part-card__top { display: flex; align-items: center; gap: var(--space-4); min-width: 0; }
.part-card__draw {
  flex: none;
  width: 84px;
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--bg-input);
}
/* il solido nei grigi della v3 (come Home e Produzione) */
.part-card__draw :deep(.face-top),
.part-card__draw :deep(.face-right),
.part-card__draw :deep(.face-left) { stroke: var(--bg-input); stroke-width: 0.45; }
.part-card__draw :deep(.face-top) { fill: var(--text-disabled); }
.part-card__draw :deep(.face-right) { fill: var(--border-default); }
.part-card__draw :deep(.face-left) { fill: var(--bg-segment-on); }
.part-card__id { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
</style>
