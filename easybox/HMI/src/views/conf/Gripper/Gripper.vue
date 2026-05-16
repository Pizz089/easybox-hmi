<template>
  <div class="pure-u-1-24">&nbsp;</div>

  <div class="pure-u-22-24">
    <h2 v-if="!create && gripper">
      {{ $t("gripper.data") }} : {{ gripper.ID }}
    </h2>
    <h2 v-else>{{ $t("gripper.create") }}</h2>

    <div class="gripper-layout">
      <div class="gripper-form">
        <form class="pure-form pure-form-aligned" @submit.prevent>
          <input type="hidden" name="ID" :value="gripper.ID" />

          <div class="pure-control-group">
            <label :for="ids.family">{{ $t("gripper.family") }}</label>
            <select
              :id="ids.family"
              name="FAMILY"
              v-model="gripper.FAMILY"
              autocomplete="off"
            >
              <option v-for="g in gripperTypeList" :key="g.ID" :value="g.TYPE">
                {{ g.TYPE }}
              </option>
            </select>
          </div>

          <div class="pure-control-group">
            <label :for="ids.descr">{{ $t("gripper.descr") }}</label>
            <input
              :id="ids.descr"
              class="aligned-foo"
              type="text"
              name="DESCR"
              v-model="gripper.DESCR"
              autocomplete="off"
            />
          </div>

          <div class="pure-control-group">
            <label :for="ids.xBody">{{ $t("gripper.bodyX") }}</label>
            <input
              :id="ids.xBody"
              class="aligned-foo"
              type="number"
              name="X_BODY"
              v-model.number="gripper.X_BODY"
              @input="onDimInput('X_BODY', $event)"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>

          <div class="pure-control-group">
            <label :for="ids.yBody">{{ $t("gripper.bodyY") }}</label>
            <input
              :id="ids.yBody"
              class="aligned-foo"
              type="number"
              name="Y_BODY"
              v-model.number="gripper.Y_BODY"
              @input="onDimInput('Y_BODY', $event)"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>

          <div class="pure-control-group">
            <label :for="ids.zBody">{{ $t("gripper.bodyZ") }}</label>
            <input
              :id="ids.zBody"
              class="aligned-foo"
              type="number"
              name="Z_BODY"
              v-model.number="gripper.Z_BODY"
              @input="onDimInput('Z_BODY', $event)"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>

          <div class="pure-control-group">
            <label :for="ids.xClaw">{{ $t("gripper.chelaX") }}</label>
            <input
              :id="ids.xClaw"
              class="aligned-foo"
              type="number"
              name="X_CHELE"
              v-model.number="gripper.X_CLAW"
              @input="onDimInput('X_CLAW', $event)"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>

          <div class="pure-control-group">
            <label :for="ids.yClaw">{{ $t("gripper.chelaY") }}</label>
            <input
              :id="ids.yClaw"
              class="aligned-foo"
              type="number"
              name="Y_CHELE"
              v-model.number="gripper.Y_CLAW"
              @input="onDimInput('Y_CLAW', $event)"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>

          <div class="pure-control-group">
            <label :for="ids.zClaw">{{ $t("gripper.chelaZ") }}</label>
            <input
              :id="ids.zClaw"
              class="aligned-foo"
              type="number"
              name="Z_CHELE"
              v-model.number="gripper.Z_CLAW"
              @input="onDimInput('Z_CLAW', $event)"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>

          <div class="pure-control-group">
            <label :for="ids.stroke">{{ $t("gripper.stroke_claw") }}</label>
            <input
              :id="ids.stroke"
              class="aligned-foo"
              type="number"
              name="STROKE_CLAW"
              v-model.number="gripper.STROKE_CLAW"
              @input="onDimInput('STROKE_CLAW', $event)"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>

          <div class="pure-control-group">
            <label :for="ids.thickness">{{
              $t("gripper.tickness_claw")
            }}</label>
            <input
              :id="ids.thickness"
              class="aligned-foo"
              type="number"
              name="TICKNESS_CLAW"
              v-model.number="gripper.TICKNESS_CLAW"
              @input="onDimInput('TICKNESS_CLAW', $event)"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>

          <div class="pure-control-group">
            <label :for="ids.status">{{ $t("gripper.stato") }}</label>
            <optionStatus
              :id="ids.status"
              name="STATO"
              :model-value="gripper.STATUS"
              @update="(val) => (gripper.STATUS = val)"
            />
          </div>

          <div class="pure-control-group">
            <label :for="ids.posMag">{{ $t("gripper.posMag") }}</label>
            <div
              :id="ids.posMag"
              class="shelfPosWrap"
              role="group"
              :aria-labelledby="ids.posMagLabel"
            >
              <span class="sr-only" :id="ids.posMagLabel">{{
                $t("gripper.posMag")
              }}</span>
              <button
                v-for="(p, index) in warehousePos.maxPos"
                :key="p"
                class="shelfPos"
                type="button"
                :disabled="getDisabled(index + 1)"
                :value="index + 1"
                :class="{ active: gripper.POS_MAG == index + 1 }"
                @click.prevent="gripper.POS_MAG = index + 1"
              >
                {{ index + 1 }}
              </button>
            </div>
          </div>

          <div class="pure-control-group">
            <label :for="ids.posPlant">{{ $t("gripper.posPlant") }}</label>
            <select
              :id="ids.posPlant"
              name="POS_PLANT"
              v-model="gripper.POS_PLANT"
              autocomplete="off"
            >
              <option value="-1">{{ $t("OUT") }}</option>
              <option :value="gripper.POS_MAG">
                {{ $t("Posizione") }} {{ gripper.POS_MAG }}
                {{ $t("Magazzino") }}
              </option>
              <option value="1000">ROBOT</option>
            </select>
          </div>

          <div class="pure-controls">
            <button class="pure-button pure-button-primary" @click="saveData">
              Save
            </button>
          </div>
        </form>
      </div>

      <div class="gripper-preview">
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
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { dataStored } from "../../../data.js";
import optionStatus from "@/components/optionStatus.vue";

export default {
  components: { optionStatus },

  data() {
    const defaultGripper = () => ({
      ID: 0,
      FAMILY: "",
      DESCR: "",
      X_BODY: 0,
      Y_BODY: 0,
      Z_BODY: 0,
      X_CLAW: 0,
      Y_CLAW: 0,
      Z_CLAW: 0,
      STROKE_CLAW: 0,
      TICKNESS_CLAW: 0,
      STATUS: 0,
      POS_MAG: 0,
      SUB_POS: 0,
      POS_PLANT: 0,
    });

    return {
      ids: {
        family: "gripper-family",
        descr: "gripper-descr",
        xBody: "gripper-x-body",
        yBody: "gripper-y-body",
        zBody: "gripper-z-body",
        xClaw: "gripper-x-claw",
        yClaw: "gripper-y-claw",
        zClaw: "gripper-z-claw",
        stroke: "gripper-stroke",
        thickness: "gripper-thickness",
        status: "gripper-status",
        posMag: "gripper-pos-mag",
        posMagLabel: "gripper-pos-mag-label",
        posPlant: "gripper-pos-plant",
      },

      defaultGripper,
      gripper: defaultGripper(),
      gripperTypeList: [],
      warehousePos: { maxPos: [], freePos: [] },
      create: false,

      // Babylon
      engine: null,
      scene: null,
      camera: null,
      resizeHandler: null,
      rotateAuto: false,

      nodes: {
        root: null,
        mount: null,
        flange: null,
        conn: null,
        body: null,
        clawBase: null,
        clawL: null,
        clawR: null,
      },

      scaleFactor: 5,

      _mm(mm) {
        return Number(mm || 0) / this.scaleFactor;
      },

      _sz(mm) {
        return Math.max(0.001, Number(mm || 0) / this.scaleFactor);
      },

      _u(mm) {
        return this._sz(mm);
      },

      CONN: { W: 60, H: 70, D: 30 },
      GAP_MOUNT_MM: 6,
      MOUNT: { axis: "z", dir: +1 },

      ready: false,
    };
  },

  methods: {
    // Posiziona il body DAVANTI alla flangia (Z positivo)
    bodyTranslateByDims(wB, hB, dB) {
      const gap = this._mm(3); // 3mm di distanza dalla flangia
      const flangeHalfDepth = this._sz(30) / 2; // metà spessore flangia (15mm)
      // Body davanti alla flangia lungo Z positivo
      const z = flangeHalfDepth + gap + dB / 2;
      return new Vector3(0, 0, z);
    },

    startLoop() {
      if (!this.engine || !this.scene) return;
      this.engine.stopRenderLoop();
      this.engine.runRenderLoop(() => {
        if (!this.scene) return;
        if (this.rotateAuto && this.nodes.root) {
          this.nodes.root.rotation.y += 0.006;
        }
        this.scene.render();
      });
    },

    stopLoop() {
      this.engine?.stopRenderLoop();
    },

    initBabylon() {
      if (this.engine) return;
      const canvas = this.$refs.bjsCanvas;
      if (!canvas) return;

      this.engine = new Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
      this.scene = new Scene(this.engine);
      this.scene.clearColor = new Color4(0.043, 0.071, 0.125, 1);

      this.camera = new ArcRotateCamera(
        "cam",
        0.85,
        1.15,
        80,
        Vector3.Zero(),
        this.scene,
      );
      this.camera.attachControl(canvas, true);
      this.camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");

      new HemisphericLight("hemi", new Vector3(0.3, 1, 0.2), this.scene);

      // === MATERIALI - Palette professionale metallica ===
      const mat = (name, hex, specular = 0.3) => {
        const m = new StandardMaterial(name, this.scene);
        m.diffuseColor = Color3.FromHexString(hex);
        m.specularColor = new Color3(specular, specular, specular);
        return m;
      };
      const MATS = {
        flange: mat("matFlange", "#2d3748", 0.4), // Grigio scuro bluastro
        conn: mat("matConn", "#4a5568", 0.3), // Grigio medio
        pin: mat("matPin", "#d4af37", 0.6), // Oro metallico
        body: mat("matBody", "#4a5568", 0.5), // Grigio acciaio scuro
        claw: mat("matClaw", "#a0aec0", 0.7), // Argento/alluminio metallizzato
      };

      // === ROOT - Nodo radice per tutta la scena ===
      this.nodes.root = new TransformNode("root", this.scene);
      this.nodes.root.rotation = new Vector3(-0.2, 0.25, 0);

      // === MOUNT - Nodo per orientamento base ===
      this.nodes.mount = new TransformNode("mount", this.scene);
      this.nodes.mount.parent = this.nodes.root;
      this.nodes.mount.rotation = new Vector3(-0.3, 0, 0);

      // === FLANGIA (cilindro) - posizione 0,0,0 ===
      // Cilindro orizzontale - ruotato su X per vederlo di fronte
      this.nodes.flange = MeshBuilder.CreateCylinder(
        "flange",
        { diameter: this._sz(120), height: this._sz(30), tessellation: 48 },
        this.scene,
      );
      this.nodes.flange.parent = this.nodes.mount;
      this.nodes.flange.rotation = new Vector3(Math.PI / 2, 0, 0); // Ruota su X per vederlo di fronte
      this.nodes.flange.position = Vector3.Zero();
      this.nodes.flange.material = MATS.flange;

      // === CONNETTORE - A SINISTRA della flangia ===
      this.nodes.conn = MeshBuilder.CreateBox(
        "conn",
        {
          width: this._sz(this.CONN.W),
          height: this._sz(this.CONN.H),
          depth: this._sz(this.CONN.D),
        },
        this.scene,
      );
      this.nodes.conn.parent = this.nodes.mount;
      // Posizione: a sinistra della flangia (X positivo nella vista)
      const flangeHalfWidth = this._sz(30) / 2;
      const connHalfW = this._sz(this.CONN.W) / 2;
      this.nodes.conn.position = new Vector3(
        +(flangeHalfWidth + connHalfW + this._mm(20)),
        0,
        -0.1,
      );
      this.nodes.conn.material = MATS.conn;

      // === PIN sul connettore ===
      const PIN = { DIA: 5, LEN: 4, MARGIN: 1 };
      const pinZFront = this._mm(this.CONN.D / 2 + PIN.LEN / 2 + PIN.MARGIN);

      const pinMaster = MeshBuilder.CreateCylinder(
        "pinMaster",
        {
          diameter: this._sz(PIN.DIA),
          height: this._sz(PIN.LEN),
          tessellation: 24,
        },
        this.scene,
      );
      pinMaster.isVisible = false;
      pinMaster.parent = this.nodes.conn;
      pinMaster.rotation.x = Math.PI / 2;
      pinMaster.material = MATS.pin;

      const xs = [22, 15, 8, 1];
      const ys = [-25, -19, -13, -7, 6, 12, 18, 24];
      ys.forEach((y) =>
        xs.forEach((x) => {
          const inst = pinMaster.createInstance(`pin_${x}_${y}`);
          inst.parent = this.nodes.conn;
          inst.position = new Vector3(this._mm(x), this._mm(y), pinZFront);
        }),
      );

      // === BODY (pinza) - DAVANTI alla flangia (Z positivo) ===
      this.nodes.body = MeshBuilder.CreateBox("body", { size: 1 }, this.scene);
      this.nodes.body.parent = this.nodes.mount;
      this.nodes.body.material = MATS.body;
      // La posizione viene settata in updatePreviewFromModel

      // === CHELE - SOTTO il body ===
      this.nodes.clawBase = new TransformNode("clawBase", this.scene);
      this.nodes.clawBase.parent = this.nodes.mount;

      this.nodes.clawL = MeshBuilder.CreateBox(
        "clawL",
        { size: 1 },
        this.scene,
      );
      this.nodes.clawL.parent = this.nodes.clawBase;
      this.nodes.clawL.material = MATS.claw;

      this.nodes.clawR = MeshBuilder.CreateBox(
        "clawR",
        { size: 1 },
        this.scene,
      );
      this.nodes.clawR.parent = this.nodes.clawBase;
      this.nodes.clawR.material = MATS.claw;

      this.updatePreviewFromModel();

      this.resizeHandler = () => this.engine?.resize();
      window.addEventListener("resize", this.resizeHandler);

      this.startLoop();
    },

    destroyBabylon() {
      this.stopLoop();
      if (this.resizeHandler) {
        window.removeEventListener("resize", this.resizeHandler);
        this.resizeHandler = null;
      }
      this.scene?.dispose();
      this.engine?.dispose();
      this.scene = null;
      this.engine = null;
      this.camera = null;
      this.nodes = {
        root: null,
        mount: null,
        flange: null,
        conn: null,
        body: null,
        clawBase: null,
        clawL: null,
        clawR: null,
      };
    },

    updatePreviewFromModel() {
      if (!this.scene || !this.nodes.body) return;

      // === BODY ===
      const wB = this._sz(this.gripper.X_BODY);
      const hB = this._sz(this.gripper.Y_BODY);
      const dB = this._sz(this.gripper.Z_BODY);

      this.nodes.body.scaling = new Vector3(wB, hB, dB);
      const bodyPos = this.bodyTranslateByDims(wB, hB, dB);
      this.nodes.body.position = bodyPos;

      // === CHELE ===
      const wC = this._sz(this.gripper.X_CLAW);
      const hC = this._sz(this.gripper.Y_CLAW);
      const dC = this._sz(this.gripper.Z_CLAW);

      this.nodes.clawL.scaling = new Vector3(wC, hC, dC);
      this.nodes.clawR.scaling = new Vector3(wC, hC, dC);

      const gap = this._mm(2);
      const strokeOpen = this._mm(this.gripper.STROKE_CLAW) / 2;

      // Posizione Y delle chele: sotto il body
      // bodyPos.y è il centro del body
      const clawY = bodyPos.y - hB / 2 - gap - hC / 2;

      // Posizione Z delle chele:
      const clawZ = bodyPos.z;

      // Posizione X: a sinistra
      const clawOffsetX = wC / 2 + gap + strokeOpen;

      this.nodes.clawBase.position = new Vector3(0, clawY, clawZ);

      this.nodes.clawL.position = new Vector3(-clawOffsetX, 0, 0);
      this.nodes.clawR.position = new Vector3(+clawOffsetX, 0, 0);
    },

    onDimInput(field, e) {
      let raw = e?.target?.value ?? "";
      let val = Number(String(raw).replace(",", "."));
      if (!Number.isFinite(val) || val < 0) val = 0;
      this.gripper[field] = val;
      this.updatePreviewFromModel();
    },

    getDataTable() {
      if (this.$route.query.gripperID == undefined) {
        this.create = true;
        return;
      }
      fetch(
        dataStored.server +
          "api/conf/gripper/show/" +
          this.$route.query.gripperID,
        { method: "GET" },
      )
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return r.json();
        })
        .then((data) => {
          const row = Array.isArray(data) ? data[0] : null;
          this.gripper = row
            ? { ...this.defaultGripper(), ...row }
            : this.defaultGripper();

          this.gripper.X_BODY /= 1000;
          this.gripper.Y_BODY /= 1000;
          this.gripper.Z_BODY /= 1000;
          this.gripper.X_CLAW /= 1000;
          this.gripper.Y_CLAW /= 1000;
          this.gripper.Z_CLAW /= 1000;
          this.gripper.STROKE_CLAW /= 1000;
          this.gripper.TICKNESS_CLAW /= 1000;

          this.updatePreviewFromModel();
        })
        .catch(console.info);
    },

    getGripperType() {
      fetch(dataStored.server + "api/conf/gripper/showType/all", {
        method: "GET",
      })
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return r.json();
        })
        .then((data) => {
          this.gripperTypeList = data || [];
        })
        .catch(console.info);
    },

    getWarehouseFreePos() {
      fetch(dataStored.server + "api/conf/gripper/showWarehousePos", {
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
      const g = this.gripper;
      const payload = {
        ...g,
        X_CLAW: g.X_CLAW * 1000,
        Y_CLAW: g.Y_CLAW * 1000,
        Z_CLAW: g.Z_CLAW * 1000,
        X_CHELE: g.X_CLAW * 1000,
        Y_CHELE: g.Y_CLAW * 1000,
        Z_CHELE: g.Z_CLAW * 1000,
        X_BODY: g.X_BODY * 1000,
        Y_BODY: g.Y_BODY * 1000,
        Z_BODY: g.Z_BODY * 1000,
        STROKE_CLAW: g.STROKE_CLAW * 1000,
        TICKNESS_CLAW: g.TICKNESS_CLAW * 1000,
      };

      const base =
        dataStored.server +
        (this.create
          ? "api/conf/gripper/insertGripper?"
          : "api/conf/gripper/updateGripper?");
      const cmd = base + new URLSearchParams(payload).toString();

      fetch(cmd, { method: "GET" })
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return this.$router.push("/conf/Grippers");
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
    this.getGripperType();
    this.getWarehouseFreePos();
    this.$nextTick(() => {
      this.initBabylon();
      this.updatePreviewFromModel();
      this.ready = true;
    });
  },

  beforeUnmount() {
    this.destroyBabylon();
  },

  activated() {
    if (!this.engine) this.initBabylon();
    this.startLoop();
  },

  deactivated() {
    this.stopLoop();
  },
};
</script>

<style scoped>



/* === CONTAINER PRINCIPALE - SFONDO SCURO FULL WIDTH === */
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

/* === LAYOUT GRID === */
.gripper-layout {
  display: grid !important;
  grid-template-columns: 1fr 420px !important;
  gap: 28px !important;
  align-items: start !important;
  max-width: 1400px !important;
}

/* === FORM CARD === */
.gripper-form {
  background: rgba(30, 41, 59, 0.6) !important;
  backdrop-filter: blur(10px) !important;
  border-radius: 16px !important;
  padding: 28px 32px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

/* === FORM CONTROLS === */
.gripper-form .pure-form-aligned .pure-control-group {
  display: flex !important;
  align-items: center !important;
  margin-bottom: 16px !important;
  padding: 6px 0 !important;
}

.gripper-form .pure-form-aligned .pure-control-group label {
  width: 150px !important;
  min-width: 150px !important;
  margin-right: 20px !important;
  text-align: right !important;
  color: #94a3b8 !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
}

/* === INPUT & SELECT === */
.gripper-form .aligned-foo,
.gripper-form select,
.gripper-form input[type="text"],
.gripper-form input[type="number"] {
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

.gripper-form .aligned-foo:hover,
.gripper-form select:hover,
.gripper-form input[type="text"]:hover,
.gripper-form input[type="number"]:hover {
  border-color: rgba(71, 85, 105, 0.8) !important;
  background: rgba(30, 41, 59, 0.8) !important;
}

.gripper-form .aligned-foo:focus,
.gripper-form select:focus,
.gripper-form input[type="text"]:focus,
.gripper-form input[type="number"]:focus {
  outline: none !important;
  border-color: #3b82f6 !important;
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.15),
    inset 0 1px 2px rgba(0, 0, 0, 0.2) !important;
  background: rgba(30, 41, 59, 0.9) !important;
}

.gripper-form select {
  cursor: pointer !important;
  appearance: none !important;
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 14px center !important;
  padding-right: 40px !important;
}

.gripper-form select option {
  background: #1e293b !important;
  color: #f1f5f9 !important;
  padding: 10px !important;
}

/* === UNIT LABEL === */
.gripper-form .unit {
  margin-left: 12px !important;
  color: #64748b !important;
  font-size: 0.8rem !important;
  font-weight: 500 !important;
  min-width: 30px !important;
}

/* === SHELF POSITION BUTTONS === */
.gripper-form .shelfPosWrap {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 6px !important;
}

.gripper-form .shelfPos {
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

.gripper-form .shelfPos:hover:not(:disabled) {
  border-color: #3b82f6 !important;
  background: rgba(59, 130, 246, 0.1) !important;
  color: #f1f5f9 !important;
}

.gripper-form .shelfPos:disabled {
  opacity: 0.35 !important;
  cursor: not-allowed !important;
}

.gripper-form .shelfPos.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
  border-color: #3b82f6 !important;
  color: #ffffff !important;
  box-shadow: 0 0 16px rgba(59, 130, 246, 0.35) !important;
}

/* === SAVE BUTTON === */
.gripper-form .pure-controls {
  margin-top: 24px !important;
  padding-top: 20px !important;
  border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
}

.gripper-form .pure-button-primary {
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

.gripper-form .pure-button-primary:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.45) !important;
}

.gripper-form .pure-button-primary:active {
  transform: translateY(0) !important;
}

/* === 3D PREVIEW CARD === */
.gripper-preview {
  background: rgba(30, 41, 59, 0.6) !important;
  backdrop-filter: blur(10px) !important;
  border-radius: 16px !important;
  padding: 14px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  position: sticky !important;
  top: 20px !important;
}

.gripper-preview .bjs-canvas,
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
  .gripper-layout {
    grid-template-columns: 1fr !important;
  }

  .gripper-preview {
    order: -1 !important;
    position: relative !important;
    top: 0 !important;
  }

  .gripper-preview .bjs-canvas,
  .bjs-canvas {
    height: 300px !important;
  }
}

@media (max-width: 600px) {
  .pure-u-22-24 {
    padding: 20px 16px !important;
  }

  .gripper-form {
    padding: 20px 16px !important;
  }

  .gripper-form .pure-form-aligned .pure-control-group {
    flex-direction: column !important;
    align-items: flex-start !important;
  }

  .gripper-form .pure-form-aligned .pure-control-group label {
    text-align: left !important;
    margin-bottom: 6px !important;
    width: 100% !important;
  }

  .gripper-form .aligned-foo,
  .gripper-form select,
  .gripper-form input[type="text"],
  .gripper-form input[type="number"] {
    width: 100% !important;
  }
}
.gripper-form 
.pure-form-aligned 
.pure-control-group {
  align-items: flex-start !important;
}

</style>
