<template>
  <div class="pure-u-1-24">&nbsp;</div>

  <div class="pure-u-22-24">
    <h2 v-if="!create && vice">
      {{ $t("vice.data") || "Configurazione morsa" }} : {{ vice.ID }}
    </h2>
    <h2 v-else>{{ $t("vice.createNew") }}</h2>

    <div class="vice-layout">
      <div class="vice-form">
        <form class="pure-form pure-form-aligned" @submit.prevent>
          <input type="hidden" name="ID" :value="vice.ID" />

          <div class="pure-control-group">
            <label for="vice-family">{{ $t("vice.family") }}</label>
            <select
              id="vice-family"
              name="FAMILY"
              v-model="vice.FAMILY"
              autocomplete="off"
            >
              <option v-for="v in viceTypeList" :key="v.ID" :value="v.TYPE">
                {{ v.TYPE }}
              </option>
            </select>
          </div>

          <div class="pure-control-group">
            <label for="vice-descr">{{ $t("vice.descr") }}</label>
            <input
              id="vice-descr"
              class="aligned-foo"
              type="text"
              name="DESCR"
              v-model="vice.DESCR"
              autocomplete="off"
            />
          </div>

          <div class="pure-control-group">
            <label for="vice-x">X</label>
            <input
              id="vice-x"
              class="aligned-foo"
              type="number"
              name="X"
              v-model.number="vice.X"
              @input="onDimInput('X', $event)"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>

          <div class="pure-control-group">
            <label for="vice-y">Y</label>
            <input
              id="vice-y"
              class="aligned-foo"
              type="number"
              name="Y"
              v-model.number="vice.Y"
              @input="onDimInput('Y', $event)"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>

          <div class="pure-control-group">
            <label for="vice-z">Z</label>
            <input
              id="vice-z"
              class="aligned-foo"
              type="number"
              name="Z"
              v-model.number="vice.Z"
              @input="onDimInput('Z', $event)"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>

          <div class="pure-control-group">
            <label for="vice-status">{{ $t("vice.stato") }}</label>
            <optionStatus
              id="vice-status"
              name="STATO"
              :model-value="vice.STATUS"
              @update="(val) => (vice.STATUS = val)"
            />
          </div>

          <div class="pure-control-group">
            <label for="vice-posmag">{{ $t("vice.posizione") }}</label>
            <div id="vice-posmag" class="shelfPosWrap" role="group">
              <button
                v-for="(p, index) in warehousePos.maxPos"
                :key="p"
                class="shelfPos"
                type="button"
                :disabled="getDisabled(index + 1)"
                :value="index + 1"
                :class="{ active: vice.POS_MAG == index + 1 }"
                @click.prevent="vice.POS_MAG = index + 1"
              >
                {{ index + 1 }}
              </button>
            </div>
          </div>

          <div class="pure-control-group">
            <label for="vice-posplant">{{ $t("vice.posizione") }}</label>
            <select
              id="vice-posplant"
              name="POS_PLANT"
              v-model="vice.POS_PLANT"
              autocomplete="off"
            >
              <option value="-1">{{ $t("OUT") || "OUT" }}</option>
              <option :value="vice.POS_MAG">
                {{ $t("Posizione") || "Posizione" }} {{ vice.POS_MAG }}
                {{ $t("Magazzino") || "Magazzino" }}
              </option>
              <option value="101">MC 1</option>
              <option value="201">MC 2</option>
            </select>
          </div>

          <div class="pure-controls">
            <button class="pure-button pure-button-primary" @click="saveData">
              Save
            </button>
          </div>
        </form>
      </div>

      <!-- 3D PREVIEW -->
      <div class="vice-preview">
        <canvas
          ref="bjsCanvas"
          class="bjs-canvas"
          width="360"
          height="360"
        ></canvas>
      </div>
    </div>
  </div>
</template>

<script>
import {
  ArcRotateCamera,
  Color4,
  Engine,
  HemisphericLight,
  DirectionalLight,
  Scene,
  SceneLoader,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { GLTFFileLoader } from "@babylonjs/loaders/glTF";
import viceModelUrl from "@/assets/models/vice_1.glb?url";
import { dataStored } from "../../../data.js";
import optionStatus from "@/components/optionStatus.vue";

export default {
  components: { optionStatus },

  data() {
    const defaultVice = () => ({
      ID: 0,
      FAMILY: "",
      DESCR: "",
      X: 150,
      Y: 100,
      Z: 80,
      STATUS: 0,
      POS_MAG: 0,
      MAG: 0,
      MAG_POS: 0,
      POS_PLANT: 0,
    });

    return {
      defaultVice,
      vice: defaultVice(),
      viceTypeList: [],
      warehousePos: { maxPos: [], freePos: [] },
      create: false,

      // Babylon
      engine: null,
      scene: null,
      camera: null,
      resizeHandler: null,
      rotateAuto: false,

      // container del modello GLB caricato
      modelContainer: null,
    };
  },

  methods: {
    startLoop() {
      if (!this.engine || !this.scene) return;
      this.engine.stopRenderLoop();
      this.engine.runRenderLoop(() => {
        if (!this.scene) return;
        this.scene.render();
      });
    },

    stopLoop() {
      this.engine?.stopRenderLoop();
    },

    async initBabylon() {
      if (this.engine) return;
      const canvas = this.$refs.bjsCanvas;
      if (!canvas) return;

      this.engine = new Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
      this.scene = new Scene(this.engine);
      this.scene.clearColor = new Color4(0.043, 0.071, 0.125, 1);

      // Camera
      this.camera = new ArcRotateCamera(
        "cam",
        -0.6,
        1.1,
        3,
        Vector3.Zero(),
        this.scene,
      );
      this.camera.attachControl(canvas, true);
      this.camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");
      this.camera.lowerRadiusLimit = 0.5;
      this.camera.upperRadiusLimit = 20;

      // Luci
      new HemisphericLight("hemi", new Vector3(0.3, 1, 0.2), this.scene);
      const dirLight = new DirectionalLight(
        "dir",
        new Vector3(-1, -2, -1),
        this.scene,
      );
      dirLight.intensity = 0.5;

      // Carica il modello GLB reale
      await this.loadModel();

      this.resizeHandler = () => this.engine?.resize();
      window.addEventListener("resize", this.resizeHandler);

      this.startLoop();
    },

    async loadModel() {
      if (!this.scene) return;

      // Rimuovi eventuale modello precedente
      if (this.modelContainer) {
        this.modelContainer.removeAllFromScene();
        this.modelContainer.dispose();
        this.modelContainer = null;
      }

      // Registra il loader GLB esattamente come in TestView
      if (!SceneLoader.IsPluginForExtensionAvailable(".glb")) {
        SceneLoader.RegisterPlugin(new GLTFFileLoader());
      }
      if (!SceneLoader.IsPluginForExtensionAvailable(".gltf")) {
        SceneLoader.RegisterPlugin(new GLTFFileLoader());
      }

      try {
        this.modelContainer = await SceneLoader.LoadAssetContainerAsync(
          "",
          viceModelUrl, // import Vite con ?url — stesso sistema di TestView
          this.scene,
          undefined,
          ".glb",
        );
        this.modelContainer.addAllToScene();
        this.fitCameraToModel(this.modelContainer.meshes);
      } catch (err) {
        console.error("Errore caricamento vice_1.glb:", err);
      }
    },

    fitCameraToModel(meshes) {
      // Calcola il bounding box complessivo di tutte le mesh
      let min = new Vector3(Infinity, Infinity, Infinity);
      let max = new Vector3(-Infinity, -Infinity, -Infinity);

      meshes.forEach((m) => {
        m.computeWorldMatrix(true);
        const bi = m.getBoundingInfo();
        if (!bi) return;
        const wmin = bi.boundingBox.minimumWorld;
        const wmax = bi.boundingBox.maximumWorld;
        min = Vector3.Minimize(min, wmin);
        max = Vector3.Maximize(max, wmax);
      });

      const center = Vector3.Center(min, max);
      const size = max.subtract(min);
      const radius = Math.max(size.x, size.y, size.z) * 0.8;

      // Centra la camera sul modello
      
      this.camera.target = new Vector3(
        center.x,
        center.y +50,
        center.z- 20,
      );
      this.camera.radius = radius * 3.2;
      this.camera.lowerRadiusLimit = radius * 0.5;
      this.camera.upperRadiusLimit = radius * 8;
    },

    destroyBabylon() {
      this.stopLoop();
      if (this.resizeHandler) {
        window.removeEventListener("resize", this.resizeHandler);
        this.resizeHandler = null;
      }
      if (this.modelContainer) {
        this.modelContainer.removeAllFromScene();
        this.modelContainer.dispose();
        this.modelContainer = null;
      }
      this.scene?.dispose();
      this.engine?.dispose();
      this.scene = null;
      this.engine = null;
      this.camera = null;
    },

    onDimInput(field, e) {
      let raw = e?.target?.value ?? "";
      let val = Number(String(raw).replace(",", "."));
      if (!Number.isFinite(val) || val < 0) val = 0;
      this.vice[field] = val;
      // Qui in futuro: aggiorna scaling/posizione di parti specifiche del modello
    },

    getDataTable() {
      if (this.$route.query.viceID == undefined) {
        this.create = true;
        return;
      }
      fetch(
        dataStored.server + "api/conf/vice/show/" + this.$route.query.viceID,
        { method: "GET" },
      )
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return r.json();
        })
        .then((data) => {
          const row = Array.isArray(data) ? data[0] : data;
          this.vice = row
            ? { ...this.defaultVice(), ...row }
            : this.defaultVice();
          this.updatePreviewFromModel();
        })
        .catch(console.info);
    },

    getViceType() {
      fetch(dataStored.server + "api/conf/vice/showType/all", { method: "GET" })
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return r.json();
        })
        .then((data) => {
          this.viceTypeList = data || [];
        })
        .catch(console.info);
    },

    getWarehouseFreePos() {
      fetch(dataStored.server + "api/conf/vice/showWarehousePos", {
        method: "GET",
      })
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return r.json();
        })
        .then((data) => {
          this.warehousePos = data || { maxPos: [], freePos: [] };
        })
        .catch(console.info);
    },

    saveData() {
      const v = this.vice;
      const payload = { ...v };

      const base =
        dataStored.server +
        (this.create
          ? "api/conf/vice/insertVice?"
          : "api/conf/vice/updateVice?");
      const cmd = base + new URLSearchParams(payload).toString();

      fetch(cmd, { method: "GET" })
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return this.$router.push("/conf/Vices");
        })
        .catch(console.info);
    },

    getDisabled(index) {
      const free = this.warehousePos.freePos || [];
      for (let i = 0; i < free.length; i++) if (free[i] == index) return false;
      return true;
    },
  },

  mounted() {
    this.getDataTable();
    this.getViceType();
    this.getWarehouseFreePos();
    this.$nextTick(async () => {
      await this.initBabylon();
    });
  },

  beforeUnmount() {
    this.destroyBabylon();
  },

  async activated() {
    if (!this.engine) await this.initBabylon();
    this.startLoop();
  },

  deactivated() {
    this.stopLoop();
  },
};
</script>

<style scoped>
/* === CONTAINER PRINCIPALE === */
.pure-u-1-24 {
  display: none !important;
}

.pure-u-22-24 {
  width: 100% !important;
  padding: 32px 40px !important;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%) !important;
  min-height: calc(100vh - 80px) !important;
}

/* === TITOLO === */
h2 {
  color: #f1f5f9 !important;
  font-size: 1.5rem !important;
  font-weight: 600 !important;
  margin-bottom: 28px !important;
  letter-spacing: -0.01em !important;
  text-transform: none !important;
}

/* === LAYOUT GRID (form sinistra | 3D destra) === */
.vice-layout {
  display: grid !important;
  grid-template-columns: 1fr 420px !important;
  gap: 28px !important;
  align-items: start !important;
  max-width: 1400px !important;
}

/* === FORM CARD === */
.vice-form {
  background: rgba(30, 41, 59, 0.6) !important;
  backdrop-filter: blur(10px) !important;
  border-radius: 16px !important;
  padding: 28px 32px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

/* === FORM CONTROLS === */
.vice-form .pure-form-aligned .pure-control-group {
  display: flex !important;
  align-items: center !important;
  margin-bottom: 16px !important;
  padding: 6px 0 !important;
}

.vice-form .pure-form-aligned .pure-control-group label {
  width: 150px !important;
  min-width: 150px !important;
  margin-right: 20px !important;
  text-align: right !important;
  color: #94a3b8 !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
}

/* === INPUT & SELECT === */
.vice-form .aligned-foo,
.vice-form select,
.vice-form input[type="text"],
.vice-form input[type="number"] {
  width: 260px !important;
  padding: 11px 14px !important;
  background: rgba(15, 23, 42, 0.8) !important;
  border: 1px solid rgba(71, 85, 105, 0.5) !important;
  border-radius: 8px !important;
  color: #f1f5f9 !important;
  font-size: 0.9rem !important;
  transition: all 0.2s ease !important;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2) !important;
}

.vice-form .aligned-foo:hover,
.vice-form select:hover,
.vice-form input[type="text"]:hover,
.vice-form input[type="number"]:hover {
  border-color: rgba(71, 85, 105, 0.8) !important;
  background: rgba(30, 41, 59, 0.8) !important;
}

.vice-form .aligned-foo:focus,
.vice-form select:focus,
.vice-form input[type="text"]:focus,
.vice-form input[type="number"]:focus {
  outline: none !important;
  border-color: #3b82f6 !important;
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.15),
    inset 0 1px 2px rgba(0, 0, 0, 0.2) !important;
  background: rgba(30, 41, 59, 0.9) !important;
}

.vice-form select {
  cursor: pointer !important;
  appearance: none !important;
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 14px center !important;
  padding-right: 40px !important;
}

.vice-form select option {
  background: #1e293b !important;
  color: #f1f5f9 !important;
  padding: 10px !important;
}

/* === UNIT LABEL === */
.vice-form .unit {
  margin-left: 12px !important;
  color: #64748b !important;
  font-size: 0.8rem !important;
  font-weight: 500 !important;
  min-width: 30px !important;
}

/* === SHELF POSITION BUTTONS === */
.vice-form .shelfPosWrap {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 6px !important;
}

.vice-form .shelfPos {
  height: 40px !important;
  width: 48px !important;
  border: 1px solid rgba(71, 85, 105, 0.5) !important;
  border-radius: 6px !important;
  background: rgba(15, 23, 42, 0.8) !important;
  color: #94a3b8 !important;
  font-weight: 600 !important;
  font-size: 0.85rem !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  margin-right: 0 !important;
}

.vice-form .shelfPos:hover:not(:disabled) {
  border-color: #3b82f6 !important;
  background: rgba(59, 130, 246, 0.1) !important;
  color: #f1f5f9 !important;
}

.vice-form .shelfPos:disabled {
  opacity: 0.35 !important;
  cursor: not-allowed !important;
}

.vice-form .shelfPos.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
  border-color: #3b82f6 !important;
  color: #ffffff !important;
  box-shadow: 0 0 16px rgba(59, 130, 246, 0.35) !important;
}

/* === SAVE BUTTON === */
.vice-form .pure-controls {
  margin-top: 24px !important;
  padding-top: 20px !important;
  border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
}

.vice-form .pure-button-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
  color: #ffffff !important;
  border: none !important;
  padding: 12px 28px !important;
  border-radius: 8px !important;
  font-size: 0.95rem !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35) !important;
  letter-spacing: 0.01em !important;
}

.vice-form .pure-button-primary:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.45) !important;
}

.vice-form .pure-button-primary:active {
  transform: translateY(0) !important;
}

/* === 3D PREVIEW CARD === */
.vice-preview {
  background: rgba(30, 41, 59, 0.6) !important;
  backdrop-filter: blur(10px) !important;
  border-radius: 16px !important;
  padding: 14px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  position: sticky !important;
  top: 20px !important;
}

.vice-preview .bjs-canvas,
.bjs-canvas {
  width: 100% !important;
  height: 390px !important;
  background: linear-gradient(180deg, #0c1222 0%, #0a0f1a 100%) !important;
  border-radius: 10px !important;
  display: block !important;
  touch-action: none !important;
}

/* === UTILITIES === */
.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  border: 0 !important;
}

/* === RESPONSIVE === */
@media (max-width: 1100px) {
  .vice-layout {
    grid-template-columns: 1fr !important;
  }

  .vice-preview {
    order: -1 !important;
    position: relative !important;
    top: 0 !important;
  }

  .vice-preview .bjs-canvas,
  .bjs-canvas {
    height: 300px !important;
  }
}

@media (max-width: 600px) {
  .pure-u-22-24 {
    padding: 20px 16px !important;
  }

  .vice-form {
    padding: 20px 16px !important;
  }

  .vice-form .pure-form-aligned .pure-control-group {
    flex-direction: column !important;
    align-items: flex-start !important;
  }

  .vice-form .pure-form-aligned .pure-control-group label {
    text-align: left !important;
    margin-bottom: 6px !important;
    width: 100% !important;
  }

  .vice-form .aligned-foo,
  .vice-form select,
  .vice-form input[type="text"],
  .vice-form input[type="number"] {
    width: 100% !important;
  }
}
</style>
