<template>
  <div class="viewer">
    <canvas ref="cv"></canvas>

    <div class="ui">
      <div class="row">
        <button @click="loadModel">Ricarica</button>
        <button @click="resetCam">Reset</button>
      </div>
      <div class="status">{{ status }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Color4,
  SceneLoader,
  PointerEventTypes,
  Animation,
  EasingFunction,
  CubicEase,
} from "@babylonjs/core";

import { GLTFFileLoader } from "@babylonjs/loaders/glTF";
import modelUrl from "@/assets/models/smallbox.glb?url";

const cv = ref(null);
const status = ref("Pronto");

let engine, scene, camera;
let container = null;
let meshStates = new Map(); // mesh.uniqueId -> aperta/chiusa

function ensureGltfLoader() {
  if (!SceneLoader.IsPluginForExtensionAvailable(".glb")) {
    SceneLoader.RegisterPlugin(new GLTFFileLoader());
  }
  if (!SceneLoader.IsPluginForExtensionAvailable(".gltf")) {
    SceneLoader.RegisterPlugin(new GLTFFileLoader());
  }
}

function fitCamera(meshes) {
  let min = new Vector3(+Infinity, +Infinity, +Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);
  let found = false;

  for (const m of meshes) {
    if (!m || !m.getBoundingInfo) continue;
    if (typeof m.getTotalVertices === "function" && m.getTotalVertices() === 0) continue;

    m.computeWorldMatrix(true);
    const bi = m.getBoundingInfo();
    if (!bi) continue;

    min = Vector3.Minimize(min, bi.boundingBox.minimumWorld);
    max = Vector3.Maximize(max, bi.boundingBox.maximumWorld);
    found = true;
  }

  if (!found) return;

  const center = min.add(max).scale(0.5);
  const size = max.subtract(min);
  const r = Math.max(size.x, size.y, size.z);

  camera.setTarget(center);
  camera.radius = Math.max(1.5, r * 2.2);
  camera.lowerRadiusLimit = camera.radius * 0.05;
  camera.upperRadiusLimit = camera.radius * 30;
}

function isRealMesh(mesh) {
  if (!mesh) return false;
  if (typeof mesh.getTotalVertices === "function" && mesh.getTotalVertices() === 0) return false;
  return true;
}

function animateMeshY(mesh, toAngle) {
  if (!mesh.rotation) {
    mesh.rotation = new Vector3(0, 0, 0);
  }

  const ease = new CubicEase();
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

  Animation.CreateAndStartAnimation(
    "meshRotateY",
    mesh,
    "rotation.y",
    60,
    18,
    mesh.rotation.y,
    toAngle,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
    ease,
  );
}

function toggleMesh(mesh) {
  if (!mesh) return;

  const opened = !!meshStates.get(mesh.uniqueId);

  const delta = Math.PI / 4; // 45°
  const target = opened ? 0 : delta;

  animateMeshY(mesh, target);
  meshStates.set(mesh.uniqueId, !opened);

  status.value = `${mesh.name || "mesh"} -> ${opened ? "chiusa" : "aperta"} (test animazione)`;
}

async function loadModel() {
  status.value = "Caricamento…";

  try {
    ensureGltfLoader();
    meshStates.clear();

    if (container) {
      container.removeAllFromScene();
      container.dispose();
      container = null;
    }

    container = await SceneLoader.LoadAssetContainerAsync(
      "",
      modelUrl,
      scene,
      undefined,
      ".glb",
    );

    container.addAllToScene();
    fitCamera(container.meshes);

    status.value = `OK ✅ (mesh: ${container.meshes.length})`;
    console.log("Loaded meshes:", container.meshes.map((m) => m.name));
  } catch (e) {
    console.error(e);
    status.value = `Errore ❌ ${e?.message || String(e)}`;

    try {
      const r = await fetch(modelUrl, { cache: "no-cache" });
      const ct = r.headers.get("content-type") || "";
      const buf = await r.arrayBuffer();
      const head = new TextDecoder().decode(buf.slice(0, 40));
      status.value += ` | HTTP ${r.status} | ${ct} | head: ${head.replace(/\s+/g, " ").slice(0, 30)}`;
    } catch {}
  }
}

function resetCam() {
  camera.alpha = Math.PI / 2.2;
  camera.beta = Math.PI / 2.4;
  camera.radius = 6;
  camera.setTarget(new Vector3(0, 0.8, 0));
}

function onResize() {
  engine?.resize();
}

onMounted(async () => {
  engine = new Engine(cv.value, true);
  scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.08, 0.12, 1);

  camera = new ArcRotateCamera(
    "cam",
    Math.PI / 2.2,
    Math.PI / 2.4,
    6,
    new Vector3(0, 0.8, 0),
    scene,
  );
  camera.attachControl(cv.value, true);

  new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  const dir = new DirectionalLight("dir", new Vector3(-0.3, -1, -0.2), scene);
  dir.intensity = 1.1;

  scene.onPointerObservable.add((pi) => {
    if (pi.type !== PointerEventTypes.POINTERPICK) return;

    const pick = pi.pickInfo;
    if (!pick?.hit || !pick.pickedMesh) return;

    const mesh = pick.pickedMesh;

    if (!isRealMesh(mesh)) {
      status.value = `Nodo tecnico: ${mesh.name || "(senza nome)"}`;
      return;
    }

    toggleMesh(mesh);
  });

  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", onResize);

  await loadModel();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  scene?.dispose();
  engine?.dispose();
});
</script>

<style scoped>
.viewer {
  position: relative;
  width: 100%;
  height: 75vh;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.35);
}

.viewer canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.ui {
  position: absolute;
  left: 12px;
  top: 12px;
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.45);
  color: rgba(235, 242, 250, 0.95);
  font-size: 13px;
  backdrop-filter: blur(6px);
}

.row {
  display: flex;
  gap: 8px;
}

button {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(235, 242, 250, 0.95);
  cursor: pointer;
}

.status {
  max-width: 500px;
  word-break: break-word;
  opacity: 0.9;
}
</style>