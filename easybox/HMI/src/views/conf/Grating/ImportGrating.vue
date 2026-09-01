<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { dataStored } from '../../../data.js'
import numericField from '../../../components/numericField.vue'
import { ref, onMounted } from 'vue'
//import layout from '../layoutView.vue'

import prisma from '../../../components/layout/prisma.vue'
import cylinder from '../../../components/layout/cylinder.vue'

const el = ref()
</script>

<template>
  <div class="view-shell">
  <div class="pure-g layout-row">

    <div class="pure-u-1 pure-u-md-10-24" >
      <form class="pure-form pure-form-stacked" @submit.prevent>
        <fieldset>
          <label style="text-align:center" >{{$t('Nome')}}</label>
          <input type="text" class="pure-input-1" v-model="grating.NAME" :readonly="dataStored?.userLevel < 0" />

          <label class="mt" style="text-align:center" >{{$t('grating.descr')}}</label>
          <input type="text" class="pure-input-1" v-model="grating.DESCR" :readonly="dataStored?.userLevel < 0" />

          <div class="pure-u-1">
            
            <select class="pure-u-1" name="trayList" v-model="grating.trayIndex" @change="onChangeTrayList($event)"
              :readonly="dataStored.userLevel < 0">
              <option value="0"> </option>
              <template v-for="(t, index) in trayList" :key="t.ID">
                <option :value="index + 1" :selected="grating.trayIndex == index + 1"
                        :disabled="(t.FAMILY.trim().length > 0 || t.FLOOR_MAG <= 0)"
                        :class="{ 'optionDeleted': t.FAMILY.trim().length > 0 }">
                  {{ t.FLOOR_MAG > 0 ? t.FLOOR_MAG : 'OUT' }} - {{ t.DESCR }}
                  <span v-if="t.FAMILY.trim().length > 0">&nbsp;{{ $t('alreadyAssociated') }}</span>
                </option>
              </template>
            </select>

            <button class="pure-button-primary pure-u-1 associate-btn"
              :disabled="grating.trayIndex == 0 || grating.NAME.trim().length <= 0 || gratingAssociated || !createNew"
              @click="setGratingAssociated()">
              <span>{{ $t('grating.associate') }}</span>
            </button>
          </div>
        </fieldset>
      </form>

      <form class="pure-form pure-form-stacked form-spaced" >
        <fieldset>
          <legend> {{$t('grating.sizes')}}</legend>

          <div class="pure-u-1">
            <div class="pure-u-11-24">
              <label style="text-align:center;"><br>A [mm]</label>
              <input v-model.number="minBordoX" type="number" min="0" class="pure-input-1" @focus="showHelp('minBordoX')" />
            </div>
            <div class="pure-u-11-24">
              <label style="text-align:center;"><br>B [mm]</label>
              <input v-model.number="minBordoY" type="number" min="0" class="pure-input-1" @focus="showHelp('minBordoY')" />
            </div>
          </div>

          <div class="pure-u-1">
            <div class="pure-g">
              <div class="pure-u-11-24">
                <label style="text-align:center;"><br>C [mm]</label>
                <input v-model.number="SAFEX" type="number" min="0" class="pure-input-1" @focus="showHelp('SAFEX')" />
              </div>
              <div class="pure-u-11-24">
                <label style="text-align:center;"><br>D [mm]</label>
                <input v-model.number="SAFEY" type="number" min="0" class="pure-input-1" @focus="showHelp('SAFEY')" />
              </div>
            </div>
          </div>

          <div class="pure-u-1">
            <div class="pure-g">
              <div class="pure-u-11-24">
                <label style="text-align:center;"><br>E [mm]</label>
                <input v-model.number="widthPiece" type="number" min="0" class="pure-input-1" @focus="showHelp('widthPiece')" />
              </div>
              <div class="pure-u-11-24">
                <label style="text-align:center;"><br>F [mm]</label>
                <input v-model.number="heightPiece" type="number" min="0" class="pure-input-1" @focus="showHelp('heightPiece')" />
              </div>
            </div>
          </div>

          <div class="pure-u-1">
            <div class="pure-g">
              <div class="pure-u-11-24">
                <label style="text-align:center;">{{ $t('grating.numColumn') }}</label>
                <input v-model.number="n_cln" type="number" min="0" class="pure-input-1" />
              </div>
              <div class="pure-u-11-24">
                <label style="text-align:center;">{{ $t('grating.numLine') }}</label>
                <input v-model.number="n_row" type="number" min="0" class="pure-input-1" />
              </div>
            </div>
          </div>

          <button class="pure-button pure-button-primary action-spaced" type="button" @click="calculateGrid" :disabled="!canCalc">
            {{ $t('grating.generate') }}
          </button>
          <button class="btn-ghost action-spaced reset-btn" type="button" @click="resetAll">
            Reset
          </button>
        </fieldset>
      </form>
      
      <!----------------------------------->
      <div class="pure-u-1 save-row">
        <button class="pure-button pure-button-primary" @click="saveData()"
          >  <!-- :disabled="dataStored.userLevel < 0 || grating.SAFEX < minSafeX || grating.SAFEY < minSafeY || !gratingAssociated"-->
          Save
        </button>
      </div>
      <!----------------------------------->
      <div class="stats" v-if="ready">
        <p>
          <strong>{{ n_row }}</strong> righe × <strong>{{ n_cln }}</strong> colonne
          <strong>{{ n_row * n_cln }}</strong> pezzi
        </p>
        <p>
          Start: X {{ offsetX.toFixed(1) }} mm, Y {{ offsetY.toFixed(1) }} mm — Totale: {{ width }} × {{ height }} mm
        </p>
      </div>
    </div>

    <div class="pure-u-1 pure-u-md-13-24">
  <div class="wrap"> 
    
    <svg v-if="ready"
         :viewBox="'0 0 ' + width + ' ' + height"
         preserveAspectRatio="xMidYMid meet"
         class="preview">
      <rect x="0" y="0" :width="width" :height="height" fill="#ddd" />

      <g id="limits">
        <rect x="0" y="0" :width="minBordoX" :height="height" fill="coral" />
        <rect :x="width - minBordoX" y="0" :width="minBordoX" :height="height" fill="coral" />
        <rect x="0" y="0" :width="width" :height="minBordoY" fill="coral" />
        <rect x="0" :y="height - minBordoY" :width="width" :height="minBordoY" fill="coral" />
      </g>

      <animate xlink:href="#limits" attributeName="opacity" values="1;0;1;0" dur="1s" repeatCount="2" />

      <g v-for="(p, idx) in listPz" :key="idx">
        <rect :x="p.x" :y="p.y" :width="widthPiece" :height="heightPiece"
              fill="#8ab4f8" stroke="#3c78d8" stroke-width="0.6" />
        <text :x="p.x + widthPiece / 2" :y="p.y + heightPiece / 2"
              text-anchor="middle" dominant-baseline="central" font-size="6">
          {{ idx + 1 }}
        </text>
      </g>

      <text x="4" y="12" font-size="8">{{ width }} × {{ height }} mm</text>
    </svg>

    
    <div v-else class="help-image">
      <h4 style="margin:8px 0 6px;">{{ helpKey }}</h4>
      <img :src="helpImages[helpKey]" alt="" />
      <p class="caption">{{ helpCaptions[helpKey] }}</p>
    </div>
  </div>
</div>

  </div>
  </div>
</template>

<script>
// ============================================================================
// (grating-axis-swap-3, 1/9) La CONVENZIONE ASSI ROBOT vive in UN punto solo:
// util/gratingAxes.js (drawingToRobot: Y lungo width positivo = SUB_POS,
// X lungo height = colonne, origine tasca 1 — validata sul robot). Qui resta
// solo l'adapter dalla forma di listPz (cx/cy sui prismi) ai centri {w,h}.
// ============================================================================
import { drawingToRobot, gridFit, ROBOT_AXIS_ALONG } from '../../../util/gratingAxes.js';

export default {
  name: 'ImportGrating',
  data() {
    return {
      grating: { NAME: '', DESCR: '', TRAY_ID: 0, trayIndex: 0 },
      width: 820,
      height: 605,
      minBordoX: 0,
      minBordoY: 0,
      SAFEX: 0,
      SAFEY: 0,
      widthPiece: 0,
      heightPiece: 0,

      trayList: {},

      
      partList: {},            
      gripperList: {},         
      gratingList: {},         

      listPz: [],
      n_cln: 0,
      n_row: 0,
      offsetX: 0,
      offsetY: 0,
      residuoX: 0,
      residuoY: 0,
      ready: false,

      
      gratingAssociated: false,  
      createNew: true,           
      dim_x: 0,                  
      dim_y: 0,                  
      minSafeX: 0,               
      minSafeY: 0,               

      helpKey: 'referenceGrating', 
      helpImages: {
        referenceGrating: new URL('../../../assets/referenceGrating.png', import.meta.url).href,
        minBordoX: new URL('../../../assets/minBordoX.png', import.meta.url).href,
        minBordoY: new URL('../../../assets/minBordoY.png', import.meta.url).href,
        SAFEX: new URL('../../../assets/SAFEX.png', import.meta.url).href,
        SAFEY: new URL('../../../assets/SAFEY.png', import.meta.url).href,
        widthPiece: new URL('../../../assets/widthPice.png', import.meta.url).href,
        heightPiece: new URL('../../../assets/heightPice.png', import.meta.url).href,
      },
      helpCaptions: {
        referenceGrating: '',
        minBordoX: 'Bordo laterale X',
        minBordoY: 'Bordo superiore/inferiore Y',
        SAFEX: 'Spaziatura orizzontale tra i pezzi',
        SAFEY: 'Spaziatura verticale tra i pezzi',
        widthPiece: 'Larghezza del pezzo',
        heightPiece: 'Altezza del pezzo',
      },
    }
  },

  computed: {
    canCalc() {
      return this.widthPiece > 0 &&
        this.heightPiece > 0 &&
        this.n_cln > 0 &&
        this.n_row > 0 &&
        this.minBordoX >= 0 &&
        this.minBordoY >= 0 &&
        this.SAFEX >= 0 &&
        this.SAFEY >= 0;
    },

    boxW() { 
      const cols = this.n_cln
      if (cols > 0 && this.widthPiece > 0) {
        return 2 * this.minBordoX + cols * this.widthPiece + (cols - 1) * this.SAFEX
      }
      return Math.max(2 * this.minBordoX, 300)
    },
    boxH() { 
      const rows = this.n_row
      if (rows > 0 && this.heightPiece > 0) {
        return 2 * this.minBordoY + rows * this.heightPiece + (rows - 1) * this.SAFEY
      }
      return Math.max(2 * this.minBordoY, 200)
    },
  },

  mounted() {
    this.getTrayList();
    //setTimeout(() => { this.getGratingList(); }, "300");

    if (this.$route.params.grating_ID > 0) {
      this.createNew = false;
    } else {
      this.createNew = true;
    }
  },

  methods: {
    showHelp(key) { this.helpKey = key }, 

    resetAll() {
      this.grating.NAME = '';
      this.grating.DESCR = '';
      this.grating.trayIndex = 0;
      this.widthPiece = 0
      this.heightPiece = 0
      this.minBordoX = 0
      this.minBordoY = 0
      this.SAFEX = 0
      this.SAFEY = 0
      this.n_cln = 0
      this.n_row = 0
      this.listPz = []
      this.ready = false
      this.width = 0
      this.height = 0
      this.offsetX = 0
      this.offsetY = 0
    },

   
  calculateGrid() {
    this.listPz = [];
    this.ready = false;

    if (this.n_cln < 1 || this.n_row < 1) return;

    for (let r = 0; r < this.n_row; r++) {
      let y = this.height - this.minBordoY - this.heightPiece/2 - r * this.heightPiece - r * this.SAFEY;
      for (let c = 0; c < this.n_cln; c++) {
        let x = this.width - this.minBordoX - this.widthPiece/2 - c * this.widthPiece - c * this.SAFEX;
        this.listPz.push({
          x, y,
          cx: x + this.widthPiece / 2,
          cy: y + this.heightPiece / 2
        });
      }
    }

  this.ready = true;
  },

  calculateGrid__OLD() {
      this.listPz = [];
      this.ready = false;

      const n_cln = this.n_cln;
      const n_row = this.n_row;
      if (n_cln < 1 || n_row < 1) return;

      const startX = this.minBordoX;
      const startY = this.height - this.minBordoY - this.heightPiece;
      this.offsetX = startX;
      this.offsetY = startY;

      for (let r = 0; r < n_row; r++) {
        const y = startY - r * this.heightPiece - r * this.SAFEY;
        for (let c = 0; c < n_cln; c++) {
          const x = startX + c * this.widthPiece + c * this.SAFEX;
          this.listPz.push({
            x, y,
            cx: x + this.widthPiece / 2,
            cy: y + this.heightPiece / 2
          });
        }
      }

    this.ready = true;
  },
    
    getTrayList() {
      fetch(dataStored.server + 'api/conf/tray/show/all', { method: 'GET' })
        .then(response => {
          if (!response.ok) { throw new Error('Network response was not ok'); }
          return response.json()
        })
        .then(data => {
          this.trayList = data;
        })
        .catch(error => { console.info(error); });
    },

    getGratingList() {
      if (this.$route.params.grating_ID == 0) return;
      fetch(dataStored.server + 'api/conf/grating/show/' + this.$route.params.grating_ID, { method: 'GET' })
        .then(response => {
          if (!response.ok) { throw new Error('Network response was not ok'); }
          return response.json()
        })
        .then(data => {
          this.gratingList = data;

          this.grating.TRAY_ID    = data[0].TRAY_ID;
          this.grating.PIECE_ID   = data[0].PIECE_ID;
          this.grating.GRIPPER_ID = data[0].GRIPPER_ID;

          this.grating.SAFEX = data[0].SAFEX;
          this.grating.SAFEY = data[0].SAFEY;

          let index=1;
          this.trayList.forEach(tray => {
            if (tray.ID == this.grating.TRAY_ID){ this.grating.trayIndex = index; }
            index++;
          });
          index=1;
          (this.gripperList||[]).forEach(gripper => { 
            if (gripper.ID == this.grating.GRIPPER_ID){ this.grating.gripperIndex = index; }
            index++;
          });
          index=1;
          (this.partList||[]).forEach(part => { 
            if (part.ID == this.grating.PIECE_ID){ this.grating.pieceIndex = index; }
            index++;
          });

          this.grating.width  = this.trayList[this.grating.trayIndex]?.X / 1000 || 0; 
          this.grating.height = this.trayList[this.grating.trayIndex]?.Y / 1000 || 0; 
          this.grating.DESCR  = this.gratingList[0].DESCR;
          this.grating.NAME   = this.gratingList[0].NAME;
        })
        .catch(error => { console.info(error); });
    },

    onChangeTrayList() {
      this.grating.width  = this.trayList[this.grating.trayIndex - 1].X / 1000;
      this.grating.height = this.trayList[this.grating.trayIndex - 1].Y / 1000;
      this.grating.TRAY_ID = this.trayList[this.grating.trayIndex - 1].ID;
      //this.calculateData();
    },

    
    
    setGratingAssociated(){ this.gratingAssociated=!this.gratingAssociated; }, 

    saveData() {
      this.updateGratingInTray()

      this.grating.GRIPPER_ID=0;
      this.grating.PIECE_ID=0;
      this.grating.SAFEX=this.SAFEX;
      this.grating.SAFEY=this.SAFEY;

      var cmd = ""
      if (!this.createNew){
        cmd = dataStored.server+'api/conf/grating/updategrating?' + new URLSearchParams( this.grating ).toString();
      }else{
        cmd = dataStored.server+'api/conf/grating/insertgrating?' + new URLSearchParams( this.grating ).toString();
      }
      fetch( cmd ,{ method: 'GET'})
        .then(response => {
          if (!response.ok) { 
            alert("errore"); 
            throw new Error('Network response was not ok'); 
          }else{
            //this.savePositions();
            this.updateGratingInTray();
            this.$router.push('/conf/Gratings');
          }
        })
        .catch(error => { console.info(error); alert(error) });
    },

    updateGratingInTray() {
      var cmd = dataStored.server+'api/conf/tray/updateGratingInTray?' + new URLSearchParams(
        { ID: this.grating.TRAY_ID, FAMILY: this.grating.NAME }
      ).toString();

      fetch( cmd ,{ method: 'GET'})
        .then(response => { if (!response.ok) { alert("Error: Network response was not ok"); throw new Error('Network response was not ok'); } })
        .catch(error => { console.info(error); alert(error) });
    },

    savePositions() {
      var cmd = ""
      // (grating-axis-swap-2) adapter -> centri {w,h} disegno, poi
      // convenzione robot dalla util condivisa (origine = tasca 1)
      const centers = this.listPz.map(p => ({
        w: p.prisma ? this.grating.width  - p.cx : this.grating.width  - p.x,
        h: p.prisma ? this.grating.height - p.cy : this.grating.height - p.y,
      }));
      const robotPts = drawingToRobot(centers);
      // (Task 3, 1/9) BLOCCO ingombro prima di scrivere, in coordinate
      // DISEGNO (width -> asse robot Y, height -> asse robot X, vedi
      // ROBOT_AXIS_ALONG). L'ingombro tasca dal DXF importato non e' noto:
      // check sui SOLI centri (halfW/halfH 0).
      const tray = this.trayList[this.grating.trayIndex - 1];
      const fit = gridFit(centers, {
        width:  tray && tray.X > 0 ? tray.X/1000 : this.grating.width,
        height: tray && tray.Y > 0 ? tray.Y/1000 : this.grating.height,
        halfW: 0, halfH: 0,
      });
      if (!fit.ok) {
        const detail = [];
        if (fit.overW > 0) detail.push(this.$t('grating.outOfTrayAxis', { mm: Math.ceil(fit.overW), axis: ROBOT_AXIS_ALONG.width }));
        if (fit.overH > 0) detail.push(this.$t('grating.outOfTrayAxis', { mm: Math.ceil(fit.overH), axis: ROBOT_AXIS_ALONG.height }));
        alert(this.$t('grating.outOfTray', { detail: detail.join(', ') }));
        return;
      }
      for (let i=0; i<this.listPz.length; i++){
        let pos={};
        pos.SUB_POS   = i+1;
        pos.POS       = this.trayList[this.grating.trayIndex-1].MAG;
        pos.TRAY_ID   = this.trayList[this.grating.trayIndex-1].FLOOR_MAG;
        pos.PIECE_TYPE= 0; 
        pos.STATUS    = 2;
        pos.SAFEX     = this.grating.SAFEX;
        pos.SAFEY     = this.grating.SAFEY;

        pos.X = robotPts[i].X;
        pos.Y = robotPts[i].Y;   // micron, gia' in convenzione robot

        if (this.createNew)
          cmd = dataStored.server+'api/conf/position/insertPositionTray?' + new URLSearchParams( pos ).toString();
        else
          cmd = dataStored.server+'api/conf/position/updatePositionTray?' + new URLSearchParams( pos ).toString();

        fetch( cmd ,{ method: 'GET'})
          .then(response => { if (!response.ok) { throw new Error('Network response was not ok'); } })
          .catch(error => { alert(error) });
      }
    },
  }
}
</script>

<style scoped>
/* GR5: contenitori ritematizzati dark su pattern outlined §4.1
   (erano riquadri chiari #fff/#fafafa/#fcfcfc su tema scuro). */
.help-image {
  margin-top: 0;
  border: var(--border-card);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  background: var(--bg-card);
}
.help-image img {
  max-width: 100%;
  height: auto;
  display: block;
}
.help-image .caption {
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  margin-top: var(--space-2);
}

.help {
  color: var(--text-muted);
  /* -6px: micro-aggiustamento ottico verso il campo sopra (eccezione §2.1) */
  margin-top: -6px;
}

.canvas-wrap {
  border: var(--border-card);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-card);
}

.preview {
  width: 100%;
  height: 60vh;
  display: block;
}

.placeholder {
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  color: var(--text-muted);
  background: var(--bg-card);
}

.stats {
  margin-top: var(--space-2);
  background: var(--bg-card);
  border: var(--border-card);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-2);
}

/* Ex inline (GR2). */
.layout-row {
  gap: var(--space-4);
  align-items: flex-start;
}
.associate-btn {
  margin-top: var(--space-2);
}
.form-spaced {
  margin-top: var(--space-4);
}
.action-spaced {
  margin-top: var(--space-4);
}
.reset-btn {
  margin-left: var(--space-2);
}
.save-row {
  margin-top: var(--space-2);
}
</style>
