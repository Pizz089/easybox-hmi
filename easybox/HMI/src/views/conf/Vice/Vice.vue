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
            <span class="unit" aria-hidden="true">&micro;m</span>
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
            <span class="unit" aria-hidden="true">&micro;m</span>
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
            <span class="unit" aria-hidden="true">&micro;m</span>
          </div>

          <!-- (push-to-stop 15/9) GANASCIA nella direzione in cui il pezzo
               scorre fino alla battuta: dimensione FISICA, si misura col
               calibro. L'etichetta descrive la direzione invece di nominare
               un asse: l'operatore misura la ganascia, non deve sapere come
               si chiama l'asse del robot. Da questa e dalle misure del pezzo
               il sistema ricava le quote di spinta e di arrivo: l'operatore non
               inserisce nessuna coordinata. Vuoto = non misurata, ciclo
               disabilitato. NB unita': questo campo e' in MILLIMETRI (convertito
               in micron al salvataggio); X/Y/Z qui sopra viaggiano in micron
               raw, difetto storico gia' censito, e per questo hanno etichetta
               diversa. -->
          <div class="pure-control-group">
            <label for="vice-claw">{{ $t("vice.clawLength") }}</label>
            <input
              id="vice-claw"
              class="aligned-foo"
              type="number"
              step="0.1"
              min="0"
              name="CLAW_LENGTH"
              v-model="vice.CLAW_LENGTH"
              inputmode="decimal"
              autocomplete="off"
            />
            <span class="unit" aria-hidden="true">mm</span>
          </div>
          <div class="pure-control-group">
            <label>&nbsp;</label>
            <small class="claw-hint">{{ $t("vice.clawLengthHint") }}</small>
          </div>

          <!-- (push-to-stop 15/9) APPOGGIO DICHIARATO. Un pezzo piu' lungo
               della ganascia non e' un errore: appoggia piu' avanti, su un
               altro riferimento fisico, e quella distanza nessuno la puo'
               dedurre dai dati. Qui si dichiara, una riga per pezzo.
               L'elenco mostra i pezzi con la spinta attiva che ECCEDONO questa
               ganascia, piu' le dichiarazioni gia' fatte anche quando non
               servono piu' (ganascia allungata): una riga deve sparire solo se
               qualcuno la cancella, mai da sola. -->
          <div class="pure-control-group stops-block" v-if="!create && clawLengthMicron > 0">
            <label>{{ $t("vice.stops") }}</label>
            <div class="stops-body">
              <small class="claw-hint">{{ $t("vice.stopsHint") }}</small>
              <p v-if="!stopRows.length" class="stops-empty">
                {{ $t("vice.stopsNone") }}
              </p>
              <div v-for="row in stopRows" :key="row.PIECE_ID" class="stop-row">
                <div class="stop-piece">
                  <strong>{{ row.label }}</strong>
                  <small>{{ $t("vice.stopsOverhang", { piece: row.pieceY / 1000, over: row.overhang / 1000 }) }}</small>
                  <small v-if="!row.exceeds" class="stop-unused">{{ $t("vice.stopsUnused") }}</small>
                </div>
                <div class="stop-edit">
                  <input
                    class="aligned-foo"
                    type="number"
                    step="0.1"
                    min="0"
                    v-model="row.value"
                    inputmode="decimal"
                    autocomplete="off"
                  />
                  <span class="unit" aria-hidden="true">mm</span>
                  <button
                    type="button"
                    class="pure-button button_pressed"
                    :disabled="!stopValueValid(row) || stopBusy"
                    @click="saveStop(row)"
                  >
                    {{ $t("vice.stopsSave") }}
                  </button>
                  <button
                    type="button"
                    class="pure-button button_pressed del"
                    v-if="row.declared"
                    :disabled="stopBusy"
                    @click="removeStop(row)"
                  >
                    {{ $t("vice.stopsDelete") }}
                  </button>
                </div>
              </div>
            </div>
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

          <!-- AF: la posizione NON si edita piu' da qui — sola lettura +
               hint. Rimossi: il selettore POS_MAG (campo FANTASMA: updateVice
               non lo scrive nemmeno, restava solo a video) e la select
               POS_PLANT. La posizione della morsa la muove l'impianto;
               il montaggio su pallet si gestisce da Attrezzaggi. -->
          <div class="pure-control-group">
            <label>{{ $t("vice.posizione") }}</label>
            <span class="pos-readonly">{{ vicePositionLabel }}</span>
          </div>
          <div class="pure-control-group">
            <label>&nbsp;</label>
            <span class="pos-hint">{{ $t("vice.positionHint") }}</span>
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
      // (push-to-stop 15/9) ganascia sull'asse di battuta, mm nel form e
      // micron a DB; null = non misurata, ciclo di spinta disabilitato
      CLAW_LENGTH: null,
      STATUS: 0,
      // AF: via POS_MAG (campo fantasma: updateVice non lo scrive) e i
      // campi posizione dagli editabili — restano nella riga letta e
      // viaggiano freschi al submit (vedi saveData).
      MAG: 0,
      MAG_POS: 0,
      POS_PLANT: 0,
    });

    return {
      defaultVice,
      vice: defaultVice(),
      viceTypeList: [],
      create: false,

      // (push-to-stop 15/9) dichiarazioni dell'appoggio per questa morsa.
      // pieces: anagrafica pezzi; stops: righe PIECE_ON_VICE gia' presenti.
      pieces: [],
      stops: [],
      stopRows: [],
      stopBusy: false,

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

  computed: {
    // ganascia in micron: nel form e' in millimetri, il confronto con le
    // misure del pezzo va fatto nell'unita' del database
    clawLengthMicron() {
      const v = this.vice.CLAW_LENGTH;
      if (v === null || v === undefined || String(v).trim() === "") return 0;
      return Math.round(Number(v) * 1000);
    },
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

    // ---------------------------------------------------------------
    // (push-to-stop 15/9) APPOGGIO DICHIARATO
    // ---------------------------------------------------------------
    // La riga E' la dichiarazione: valore 0 legittimo (il pezzo sporge ma
    // tocca ancora la fine della ganascia), riga assente = non dichiarato, e
    // in quel caso l'ordine viene rifiutato. Per questo "cancella" e "salva 0"
    // sono due operazioni diverse e tutte e due esistono.
    loadStops() {
      const viceID = Number(this.$route.query.viceID);
      if (!Number.isInteger(viceID) || viceID < 1) return;
      const get = (url) =>
        fetch(dataStored.server + url, { method: "GET" }).then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return r.json();
        });
      Promise.all([get("api/conf/piece/show/all"), get("api/conf/vice/stops/" + viceID)])
        .then(([pieces, stops]) => {
          this.pieces = pieces || [];
          this.stops = stops || [];
          this.buildStopRows();
        })
        .catch(console.info);
    },

    // Una riga per ogni pezzo che ha BISOGNO di una dichiarazione (spinta
    // attiva e piu' lungo della ganascia) piu' ogni dichiarazione gia'
    // esistente, anche se non serve piu'. Il secondo insieme e' quello che
    // evita la sparizione silenziosa.
    buildStopRows() {
      const claw = this.clawLengthMicron;
      const byPiece = new Map();
      for (const st of this.stops) byPiece.set(Number(st.PIECE_ID), st);
      const rows = [];
      const seen = new Set();
      for (const p of this.pieces) {
        const id = Number(p.ID);
        if (!id) continue;
        const pieceY = Number(p.Y) || 0;
        const exceeds = claw > 0 && pieceY > claw;
        const st = byPiece.get(id);
        // serve una dichiarazione solo se la spinta e' attiva sul pezzo E il
        // pezzo eccede questa ganascia; una dichiarazione gia' fatta si mostra
        // sempre, anche quando non serve piu'
        const needs = exceeds && !!Number(p.PUSH_TO_STOP);
        if (!needs && !st) continue;
        seen.add(id);
        rows.push({
          PIECE_ID: id,
          label: (String(p.FAMILY || "").trim() || "#" + id) + (String(p.DESCR || "").trim() ? " — " + String(p.DESCR).trim() : ""),
          pieceY,
          exceeds,
          overhang: exceeds ? Math.trunc((pieceY - claw) / 2) : 0,
          declared: !!st,
          value: st ? Number(st.STOP_BEYOND_CLAW) / 1000 : null,
        });
      }
      // dichiarazioni per pezzi non piu' in anagrafica: restano visibili per
      // poterle cancellare, invece di diventare righe orfane invisibili
      for (const st of this.stops) {
        const id = Number(st.PIECE_ID);
        if (seen.has(id)) continue;
        rows.push({
          PIECE_ID: id,
          label: "#" + id,
          pieceY: 0,
          exceeds: false,
          overhang: 0,
          declared: true,
          value: Number(st.STOP_BEYOND_CLAW) / 1000,
        });
      }
      this.stopRows = rows;
    },

    // lo zero e' valido; il vuoto no (per togliere la dichiarazione c'e'
    // il pulsante di cancellazione, che e' un'altra cosa)
    stopValueValid(row) {
      if (row.value === null || row.value === undefined || String(row.value).trim() === "") return false;
      const n = Number(row.value);
      return Number.isFinite(n) && n >= 0;
    },

    saveStop(row) {
      if (!this.stopValueValid(row)) return;
      const viceID = Number(this.$route.query.viceID);
      const micron = Math.round(Number(row.value) * 1000);
      const url =
        dataStored.server +
        "api/conf/vice/setStop?" +
        new URLSearchParams({ VICE_ID: viceID, PIECE_ID: row.PIECE_ID, STOP_BEYOND_CLAW: micron }).toString();
      this.stopBusy = true;
      fetch(url, { method: "GET" })
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return r.text();
        })
        .then(() => {
          row.declared = true;
          this.stopBusy = false;
          this.loadStops();
        })
        .catch((e) => {
          console.info(e);
          this.stopBusy = false;
          dataStored.alert.title = this.$t("WARNING");
          dataStored.alert.desc = this.$t("vice.stopsSaveError");
          dataStored.alert.type = "warning";
        });
    },

    removeStop(row) {
      const viceID = Number(this.$route.query.viceID);
      const url =
        dataStored.server +
        "api/conf/vice/deleteStop?" +
        new URLSearchParams({ VICE_ID: viceID, PIECE_ID: row.PIECE_ID }).toString();
      this.stopBusy = true;
      fetch(url, { method: "GET" })
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return r.text();
        })
        .then(() => {
          this.stopBusy = false;
          this.loadStops();
        })
        .catch((e) => {
          console.info(e);
          this.stopBusy = false;
          dataStored.alert.title = this.$t("WARNING");
          dataStored.alert.desc = this.$t("vice.stopsSaveError");
          dataStored.alert.type = "warning";
        });
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
          // (push-to-stop) colonna in micron, campo in mm; NULL resta vuoto
          this.vice.CLAW_LENGTH =
            row && row.CLAW_LENGTH !== null && row.CLAW_LENGTH !== undefined
              ? Number(row.CLAW_LENGTH) / 1000
              : null;
          this.updatePreviewFromModel();
          // le dichiarazioni si costruiscono DOPO aver letto la
          // ganascia: senza quella non si sa quali pezzi la eccedono
          this.loadStops();
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

    // AF: campi che il form EDITA davvero. NB unita': la VICE viaggia in
    // micron raw sia in lettura che in scrittura (nessuna divisione in
    // getDataTable) — il round-trip e' gia' fedele, quindi QUI non c'e' il
    // gemello dell'incidente 396000->396 del form Pallet (chiuso in AE);
    // resta il difetto SOLO VISIVO dell'etichetta "mm" su valori micron,
    // segnalato a parte e non toccato per non cambiare la semantica.
    editedFields() {
      return {
        FAMILY: this.vice.FAMILY,
        DESCR: this.vice.DESCR,
        STATUS: this.vice.STATUS,
        X: this.vice.X,
        Y: this.vice.Y,
        Z: this.vice.Z,
        // (push-to-stop) il campo e' in mm, la colonna in micron: vuoto resta
        // vuoto e il backend scrive NULL (= non misurata)
        CLAW_LENGTH:
          this.vice.CLAW_LENGTH === null ||
          this.vice.CLAW_LENGTH === undefined ||
          String(this.vice.CLAW_LENGTH).trim() === ''
            ? ''
            : Math.round(Number(this.vice.CLAW_LENGTH) * 1000),
      };
    },
    saveData() {
      if (this.create) {
        // AF: nessun input posizione — la morsa nasce con posizione neutra
        // (0/0/0, come i default storici del form quando non si toccavano
        // i campi); Z_CLAW/Z_SINK_CLAW ai default della riga vuota.
        const params = new URLSearchParams({
          ID: this.vice.ID,
          ...this.editedFields(),
          Z_CLAW: 0,
          Z_SINK_CLAW: 0,
          MAG: 0,
          MAG_POS: 0,
          POS_PLANT: 0,
        });
        fetch(dataStored.server + "api/conf/vice/insertVice?" + params.toString(), { method: "GET" })
          .then((r) => {
            if (!r.ok) throw new Error("Network response was not ok");
            return this.$router.push(this.$route.query.returnTo || "/conf/Vices");
          })
          .catch(console.info);
        return;
      }
      // AF + TRAPPOLA PASS-THROUGH (pattern AE, incidente 396000->396):
      // updateVice esige tutti i campi -> la riga viene RILETTA FRESCA al
      // submit e tutto cio' che il form NON edita (Z_CLAW, Z_SINK_CLAW,
      // MAG, MAG_POS, POS_PLANT) riparte da li', mai dai valori stantii
      // caricati all'apertura (l'impianto puo' aver mosso la morsa).
      // PALLET_ID viene OMESSO di proposito: la clausola condizionale di
      // updateVice non tocca il montaggio se il parametro non arriva
      // (cautela (a): la preservazione resta al server, zero staleness).
      fetch(dataStored.server + "api/conf/vice/show/" + this.vice.ID, { method: "GET" })
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          return r.json();
        })
        .then((rows) => {
          const fresh = rows[0];
          const params = new URLSearchParams({
            ID: this.vice.ID,
            ...this.editedFields(),
            Z_CLAW: fresh.Z_CLAW,
            Z_SINK_CLAW: fresh.Z_SINK_CLAW,
            MAG: fresh.MAG,
            MAG_POS: fresh.MAG_POS,
            POS_PLANT: fresh.POS_PLANT,
          });
          return fetch(dataStored.server + "api/conf/vice/updateVice?" + params.toString(), { method: "GET" });
        })
        .then((r) => {
          if (!r.ok) throw new Error("Network response was not ok");
          // U-FASE2: ritorno opzionale al chiamante (form composito Attrezzaggio)
          return this.$router.push(this.$route.query.returnTo || "/conf/Vices");
        })
        .catch(console.info);
    },
  },

  computed: {
    // AF: decodifica in sola lettura — stessa semantica della colonna
    // storica di VicesView (rimossa): POS_PLANT>200 MC2, >100 MC1,
    // altrimenti magazzino morse MAG.
    vicePositionLabel() {
      if (this.create) return this.$t("OUT");
      if (this.vice.POS_PLANT > 200) return "MC 2";
      if (this.vice.POS_PLANT > 100) return "MC 1";
      return this.$t("Mag") + " " + this.vice.MAG + "." + this.vice.MAG_POS;
    },
  },

  mounted() {
    this.getDataTable();
    this.getViceType();
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
  font-size: var(--font-size-lg) !important;
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
  font-size: var(--font-size-sm) !important;
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
  font-size: var(--font-size-sm) !important;
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
  font-size: var(--font-size-xs) !important;
  font-weight: 500 !important;
  min-width: 30px !important;
}

/* AF: rimossi gli stili shelfPos/shelfPosWrap (morti col selettore
   POS_MAG fantasma — updateVice non scriveva nemmeno il campo). */

/* AF: posizione in sola lettura + hint */
.pos-readonly {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.pos-hint {
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

/* === SAVE BUTTON === */
.vice-form .pure-controls {
  margin-top: 24px !important;
  padding-top: 20px !important;
  border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
}

/* Save: variante Primary canonica (buttons.css), override gradient rimosso
   (decisione audit-sistema-b). */

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
/* (push-to-stop 15/9) elenco delle dichiarazioni di appoggio. Bersagli da
   44 px: la pagina gira su un touch in cella, non su un desktop. */
.stops-block {
  align-items: flex-start;
}
.stops-body {
  flex: 1 1 auto;
  min-width: 0;
}
.stops-empty {
  margin: 6px 0 0;
  opacity: 0.75;
}
.stop-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding: 8px 0;
  border-top: 1px solid var(--border, #2a3444);
}
.stop-piece {
  display: flex;
  flex-direction: column;
  min-width: 180px;
  flex: 1 1 180px;
}
.stop-piece small {
  opacity: 0.8;
}
.stop-unused {
  font-style: italic;
}
.stop-edit {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.stop-edit input {
  width: 110px;
  min-height: 44px;
}
.stop-edit .pure-button {
  min-height: 44px;
}
@media (max-width: 700px) {
  .stop-edit input {
    width: 100%;
  }
}
</style>
