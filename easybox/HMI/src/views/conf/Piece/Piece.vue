<script setup>
import { RouterLink } from "vue-router";
import { dataStored } from "../../../data.js";
import { ref } from "vue";

const el = ref();
</script>

<template>
  <div class="piece-page">
    <header class="piece-header">
      <h1 v-if="!createNew">
        {{ $t("piece.welcome") }}
        <span class="piece-id">#{{ piece.ID }}</span>
      </h1>
      <h1 v-else>
        {{ $t("piece.createNew") }}
      </h1>
    </header>

    <div class="piece-card">
      <form class="pure-form pure-form-aligned" @submit.prevent>
        <input type="hidden" name="ID" v-model="piece.ID" />

        <div class="pure-control-group">
          <label for="family">{{ $t("piece.family") }}</label>
          <input
            id="family"
            type="text"
            name="FAMIGLIA"
            v-model="piece.FAMILY"
          />
        </div>

        <div class="pure-control-group">
          <label for="descr">{{ $t("piece.descr") }}</label>
          <input id="descr" type="text" name="DESCR" v-model="piece.DESCR" />
        </div>

        <div class="pure-control-group">
          <label for="partprogram">PART PROGRAM</label>
          <input
            id="partprogram"
            type="number"
            name="PARTPROGRAM"
            v-model="piece.PARTPROGRAM"
            placeholder="0"
          />
        </div>

        <div class="pure-control-group mc-group">
          <label class="mc-label">
            
          </label>
          <div class="mc-switches">
            <label class="mc-toggle">
              <input
                type="checkbox"
                name="MC1_ONLY"
                v-model="piece.MC1_ONLY"
              />
              <span class="mc-track">
                <span class="mc-knob"></span>
              </span>
              <span class="mc-text">{{ $t("piece.MC1_ONLY") }}</span>
            </label>

            <label class="mc-toggle">
              <input
                type="checkbox"
                name="MC2_ONLY"
                v-model="piece.MC2_ONLY"
              />
              <span class="mc-track">
                <span class="mc-knob"></span>
              </span>
              <span class="mc-text">{{ $t("piece.MC2_ONLY") }}</span>
            </label>

            <label class="mc-toggle">
              <input
                type="checkbox"
                name="MC3_ONLY"
                v-model="piece.MC3_ONLY"
              />
              <span class="mc-track">
                <span class="mc-knob"></span>
              </span>
              <span class="mc-text">{{ $t("piece.MC3_ONLY") }}</span>
            </label>
          </div>
        </div>

        <div class="piece-main">
          <div class="piece-fields">
            <div class="pure-control-group">
              <label for="z">H</label>
              <input
                id="z"
                type="number"
                name="Z"
                v-model="piece.Z"
                @focus="setActiveDim('H')"
                @blur="setActiveDim(null)"
              />
              <small>mm</small>
            </div>

            <div class="pure-control-group" v-if="piece.PRISMA">
              <label for="y">W</label>
              <input
                id="y"
                type="number"
                name="Y"
                v-model="piece.Y"
                @focus="setActiveDim('W')"
                @blur="setActiveDim(null)"
              />
              <small>mm</small>
            </div>

            <div class="pure-control-group">
              <label for="x">{{ piece.PRISMA ? "L" : "D" }}</label>
              <input
                id="x"
                type="number"
                name="X"
                v-model.number="piece.X"
                @focus="setActiveDim('L')"
                @blur="setActiveDim(null)"
              />
              <small>mm</small>
            </div>

            <div class="pure-control-group">
              <label for="z_pick">{{ $t("piece.Z_PICK") }}</label>
              <input
                id="z_pick"
                type="number"
                name="Z_PICK"
                v-model="piece.Z_PICK"
              />
              <small>mm</small>
            </div>

            <div class="pure-control-group">
              <label for="z_place">{{ $t("piece.Z_PLACE") }}</label>
              <input
                id="z_place"
                type="number"
                name="Z_PLACE"
                v-model="piece.Z_PLACE"
              />
              <small>mm</small>
            </div>
          </div>

          <div class="piece-svg">
            <div class="shape-toggle">
              <span
                class="shape-pill"
                :class="{ active: !piece.PRISMA }"
                @click="piece.PRISMA = false"
              >
                {{ $t("piece.CILINDRICO") }}
              </span>
              <span
                class="shape-pill"
                :class="{ active: piece.PRISMA }"
                @click="piece.PRISMA = true"
              >
                {{ $t("piece.PRISMATICO") }}
              </span>
            </div>

            <svg v-if="piece.PRISMA" viewBox="0 0 120 120" class="dim-svg">
              <rect x="20" y="40" width="50" height="40" class="cube-face" />
              <polyline
                points="20,40 40,25 90,25 70,40 20,40"
                class="cube-edge"
              />
              <polyline points="70,40 70,80 90,65 90,25" class="cube-edge" />
              <polyline points="20,80 70,80 90,65" class="cube-edge" />

              <line
                x1="70"
                y1="40"
                x2="70"
                y2="80"
                :class="['dim-line', { active: activeDim === 'H' }]"
              />
              <text
                x="53"
                y="65"
                :class="['dim-text', { active: activeDim === 'H' }]"
              >
                H
              </text>

              <line
                x1="20"
                y1="80"
                x2="70"
                y2="80"
                :class="['dim-line', { active: activeDim === 'W' }]"
              />
              <text
                x="40"
                y="98"
                :class="['dim-text', { active: activeDim === 'W' }]"
              >
                W
              </text>

              <line
                x1="70"
                y1="80"
                x2="90"
                y2="65"
                :class="['dim-line', { active: activeDim === 'L' }]"
              />
              <text
                x="92"
                y="60"
                :class="['dim-text', { active: activeDim === 'L' }]"
              >
                L
              </text>
            </svg>

            <svg v-else viewBox="0 0 120 120" class="dim-svg">
              <ellipse cx="45" cy="35" rx="20" ry="8" class="cube-face" />
              <line x1="25" y1="35" x2="25" y2="75" class="cube-edge" />
              <line x1="65" y1="35" x2="65" y2="75" class="cube-edge" />
              <ellipse cx="45" cy="75" rx="20" ry="8" class="cube-edge" />

              <line
                x1="80"
                y1="35"
                x2="80"
                y2="75"
                :class="['dim-line', { active: activeDim === 'H' }]"
              />
              <text
                x="76"
                y="30"
                :class="['dim-text', { active: activeDim === 'H' }]"
              >
                H
              </text>

              <line
                x1="25"
                y1="20"
                x2="65"
                y2="20"
                :class="['dim-line', { active: activeDim === 'L' }]"
              />
              <text
                x="42"
                y="14"
                :class="['dim-text', { active: activeDim === 'L' }]"
              >
                D
              </text>
            </svg>
          </div>
        </div>

        <div class="pure-controls piece-actions">
          <button type="button" class="piece-save" @click="saveData()">
            Save
          </button>
          <RouterLink class="piece-cancel" to="/conf/Parts">
            {{
              $t("common.cancel") === "common.cancel"
                ? "Cancel"
                : $t("common.cancel")
            }}
          </RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { dataStored } from "../../../data.js";

export default {
  data() {
    return {
      piece: {
        FAMILY: "",
        DESCR: "",
        PARTPROGRAM: "",
        MC1_ONLY: false,
        MC2_ONLY: false,
        MC3_ONLY: false,
        PRISMA: true,
        X: 0,
        Y: 0,
        Z: 0,
        Z_PICK: 0,
        Z_PLACE: 0,
      },
      createNew: false,
      activeDim: null,
    };
  },
  methods: {
    setActiveDim(dim) {
      this.activeDim = dim;
    },
    getDataTable() {
      if (this.$route.query.pieceID == undefined) {
        this.createNew = true;
        return;
      }
      fetch(
        dataStored.server + "api/conf/piece/show/" + this.$route.query.pieceID,
        { method: "GET" }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          this.piece = data[0];
          this.piece.X /= 1000;
          this.piece.Y /= 1000;
          this.piece.Z /= 1000;
          this.piece.Z_PICK /= 1000;
          this.piece.Z_PLACE /= 1000;
        })
        .catch((error) => {
          console.info(error);
        });
    },
    saveData() {
      let cmd = "";
      if (!this.piece.PRISMA) this.piece.Y = this.piece.X;

      this.piece.X *= 1000;
      this.piece.Y *= 1000;
      this.piece.Z *= 1000;
      this.piece.Z_PICK *= 1000;
      this.piece.Z_PLACE *= 1000;

      if (!this.createNew) {
        cmd =
          dataStored.server +
          "api/conf/piece/updatePiece?" +
          new URLSearchParams(this.piece).toString();
      } else {
        cmd =
          dataStored.server +
          "api/conf/piece/insertPiece?" +
          new URLSearchParams(this.piece).toString();
      }
      fetch(cmd, { method: "GET" })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return this.$router.push("/conf/Parts");
        })
        .catch((error) => {
          console.info(error);
        });
    },
  },
  mounted() {
    this.getDataTable();
  },
};
</script>

<style scoped>
.piece-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #e5e7eb;
}

.piece-header {
  margin: 4px 0 0;
}

.piece-header h1 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: #e5e7eb;
  margin: 0;
}

.piece-id {
  margin-left: 6px;
  color: #38bdf8;
  font-weight: 500;
}

.piece-card {
  width: 100%;
  max-width: 1150px;
  margin: 8px 0 32px;
  background: rgba(9, 9, 11, 0.97);
  border-radius: 16px;
  padding: 20px 26px 24px;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(63, 63, 70, 0.9);
}

.pure-form-aligned .pure-control-group {
  display: flex;
  align-items: center;
  margin: 8px 0;
}

.pure-form-aligned .pure-control-group label {
  width: 170px;
  margin-right: 12px;
  text-align: right;
  font-size: 12px;
  color: #9ca3af;
}

.pure-form-aligned .pure-control-group input[type="text"],
.pure-form-aligned .pure-control-group input[type="number"] {
  width: 280px;
  padding: 6px 9px;
  border-radius: 8px;
  border: 1px solid rgba(75, 85, 99, 0.9);
  background: #020817;
  color: #e5e7eb;
  font-size: 12px;
  outline: none;
  transition: all 0.18s ease-out;
}

.pure-form-aligned .pure-control-group input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25);
}

.pure-form-aligned .pure-control-group small {
  margin-left: 6px;
  font-size: 10px;
  color: #6b7280;
}

.mc-group {
  align-items: flex-start;
}

.mc-label {
  width: 170px;
  margin-right: 12px;
  text-align: right;
  font-size: 12px;
  color: #9ca3af;
  padding-top: 8px;
}

.mc-switches {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.mc-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #e5e7eb;
  cursor: pointer;
}

.mc-toggle input {
  display: none;
}

.mc-track {
  width: 42px;
  height: 20px;
  background: #4b5563;
  border-radius: 999px;
  padding: 2px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  transition: all 0.18s ease-out;
}

.mc-knob {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #e5e7eb;
  transition: all 0.18s ease-out;
}

.mc-toggle input:checked + .mc-track {
  background: #22c55e;
}

.mc-toggle input:checked + .mc-track .mc-knob {
  transform: translateX(18px);
}

.mc-text {
  min-width: 70px;
}

.piece-main {
  display: flex;
  align-items: flex-start;
  gap: 30px;
  margin-top: 70px;
}

.piece-fields {
  flex: 1.6;
}

.piece-svg {
  flex: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.shape-toggle {
  display: inline-flex;
  background: #020817;
  border-radius: 999px;
  padding: 2px;
  gap: 2px;
  border: 1px solid rgba(75, 85, 99, 0.9);
}

.shape-pill {
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 999px;
  cursor: pointer;
  color: #9ca3af;
  transition: all 0.18s ease-out;
}

.shape-pill.active {
  background: #22c55e;
  color: #020817;
  font-weight: 600;
}

.dim-svg {
  width: 160px;
  height: 160px;
}

.cube-face {
  fill: rgba(15, 23, 42, 0.9);
  stroke: rgba(75, 85, 99, 0.9);
  stroke-width: 1;
}

.cube-edge {
  fill: none;
  stroke: rgba(107, 114, 128, 0.9);
  stroke-width: 1;
}

.dim-line {
  stroke: rgba(148, 163, 253, 0.7);
  stroke-width: 2;
}

.dim-text {
  font-size: 10px;
  fill: rgba(148, 163, 253, 0.7);
  font-weight: 500;
}

.dim-line.active {
  stroke: #38bdf8;
  stroke-width: 3;
}

.dim-text.active {
  fill: #38bdf8;
  font-weight: 700;
}

.piece-actions {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.piece-save {
  background: #38bdf8;
  border-radius: 8px;
  padding: 7px 18px;
  border: none;
  color: #020817;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease-out;
}

.piece-save:hover {
  background: #0ea5e9;
  box-shadow: 0 4px 12px rgba(56, 189, 248, 0.35);
}

.piece-cancel {
  font-size: 11px;
  color: #9ca3af;
  text-decoration: none;
}

.piece-cancel:hover {
  color: #e5e7eb;
  text-decoration: underline;
}
</style>





<!--vecchio piece-->
<!--script setup>
import { RouterLink } from "vue-router";
import { dataStored } from "../../../data.js";
import { ref } from "vue";

const el = ref();
</script-->

<!--template>
  <div class="piece-page">
    <header class="piece-header">
      <h1 v-if="!createNew">
        {{ $t("piece.welcome") }}
        <span class="piece-id">#{{ piece.ID }}</span>
      </h1>
      <h1 v-else>
        {{ $t("piece.createNew") }}
      </h1>
    </header>

    <div class="piece-card">
      <form class="pure-form pure-form-aligned" @submit.prevent>
        <input type="hidden" name="ID" v-model="piece.ID" />

        <div class="pure-control-group">
          <label for="family">{{ $t("piece.family") }}</label>
          <input
            id="family"
            type="text"
            name="FAMIGLIA"
            v-model="piece.FAMILY"
          />
        </div>

        <div class="pure-control-group">
          <label for="descr">{{ $t("piece.descr") }}</label>
          <input id="descr" type="text" name="DESCR" v-model="piece.DESCR" />
        </div>

        <div class="pure-control-group">
          <label for="partprogram">PART PROGRAM</label>
          <input
            id="partprogram"
            type="number"
            name="PARTPROGRAM"
            v-model="piece.PARTPROGRAM"
            placeholder="0"
          />
        </div>

        <div class="pure-control-group mc-group">
          <label class="mc-label">
            {{ $t("piece.onlyFor") || "Solo per" }}
          </label>
          <div class="mc-switches">
            <label>
              {{ $t("piece.MC1_ONLY") }}
              <input type="checkbox" name="MC1_ONLY" v-model="piece.MC1_ONLY" />
            </label>
            <label>
              {{ $t("piece.MC2_ONLY") }}
              <input type="checkbox" name="MC2_ONLY" v-model="piece.MC2_ONLY" />
            </label>
            <label>
              {{ $t("piece.MC3_ONLY") }}
              <input type="checkbox" name="MC3_ONLY" v-model="piece.MC3_ONLY" />
            </label>
          </div>
        </div>

        <div class="pure-control-group">
          <label>{{ $t("piece.Forma") || "Forma" }}</label>
          <div class="shape-toggle">
            <span
              class="shape-pill"
              :class="{ active: !piece.PRISMA }"
              @click="piece.PRISMA = false"
            >
              {{ $t("piece.CILINDRICO") }}
            </span>
            <span
              class="shape-pill"
              :class="{ active: piece.PRISMA }"
              @click="piece.PRISMA = true"
            >
              {{ $t("piece.PRISMATICO") }}
            </span>
          </div>
        </div>

        <div class="piece-main">
          <div class="piece-fields">
            <div class="pure-control-group">
              <label for="z">H</label>
              <input
                id="z"
                type="number"
                name="Z"
                v-model="piece.Z"
                @focus="setActiveDim('H')"
                @blur="setActiveDim(null)"
              />
              <small>mm</small>
            </div>

            <div class="pure-control-group" v-if="piece.PRISMA">
              <label for="y">W</label>
              <input
                id="y"
                type="number"
                name="Y"
                v-model="piece.Y"
                @focus="setActiveDim('W')"
                @blur="setActiveDim(null)"
              />
              <small>mm</small>
            </div>

            <div class="pure-control-group">
              <label for="x">{{ piece.PRISMA ? "L" : "D" }}</label>
              <input
                id="x"
                type="number"
                name="X"
                v-model.number="piece.X"
                @focus="setActiveDim('L')"
                @blur="setActiveDim(null)"
              />
              <small>mm</small>
            </div>

            <div class="pure-control-group">
              <label for="z_pick">{{ $t("piece.Z_PICK") }}</label>
              <input
                id="z_pick"
                type="number"
                name="Z_PICK"
                v-model="piece.Z_PICK"
              />
              <small>mm</small>
            </div>

            <div class="pure-control-group">
              <label for="z_place">{{ $t("piece.Z_PLACE") }}</label>
              <input
                id="z_place"
                type="number"
                name="Z_PLACE"
                v-model="piece.Z_PLACE"
              />
              <small>mm</small>
            </div>
          </div>

          <div class="piece-svg">
            <svg v-if="piece.PRISMA" viewBox="0 0 120 120" class="dim-svg">
              <rect x="20" y="40" width="50" height="40" class="cube-face" />
              <polyline
                points="20,40 40,25 90,25 70,40 20,40"
                class="cube-edge"
              />
              <polyline points="70,40 70,80 90,65 90,25" class="cube-edge" />
              <polyline points="20,80 70,80 90,65" class="cube-edge" />

              <line
                x1="20"
                y1="40"
                x2="20"
                y2="80"
                :class="['dim-line', { active: activeDim === 'H' }]"
              />
              <text
                x="8"
                y="65"
                :class="['dim-text', { active: activeDim === 'H' }]"
              >
                H
              </text>

              <line
                x1="20"
                y1="80"
                x2="70"
                y2="80"
                :class="['dim-line', { active: activeDim === 'W' }]"
              />
              <text
                x="40"
                y="98"
                :class="['dim-text', { active: activeDim === 'W' }]"
              >
                W
              </text>

              <line
                x1="70"
                y1="80"
                x2="90"
                y2="65"
                :class="['dim-line', { active: activeDim === 'L' }]"
              />
              <text
                x="92"
                y="60"
                :class="['dim-text', { active: activeDim === 'L' }]"
              >
                L
              </text>
            </svg>

            <svg v-else viewBox="0 0 120 120" class="dim-svg">
              <ellipse cx="45" cy="35" rx="20" ry="8" class="cube-face" />
              <line x1="25" y1="35" x2="25" y2="75" class="cube-edge" />
              <line x1="65" y1="35" x2="65" y2="75" class="cube-edge" />
              <ellipse cx="45" cy="75" rx="20" ry="8" class="cube-edge" />

              
              <line
                x1="80"
                y1="35"
                x2="80"
                y2="75"
                :class="['dim-line', { active: activeDim === 'H' }]"
              />
              <text
                x="76"
                y="30"
                :class="['dim-text', { active: activeDim === 'H' }]"
              >
                H
              </text>

              
              <line
                x1="25"
                y1="20"
                x2="65"
                y2="20"
                :class="['dim-line', { active: activeDim === 'L' }]"
              />
              <text
                x="42"
                y="14"
                :class="['dim-text', { active: activeDim === 'L' }]"
              >
                D
              </text>
            </svg>
          </div>
        </div>

        <div class="pure-controls piece-actions">
          <button type="button" class="piece-save" @click="saveData()">
            Save
          </button>
          <RouterLink class="piece-cancel" to="/conf/Parts">
            {{
              $t("common.cancel") === "common.cancel"
                ? "Cancel"
                : $t("common.cancel")
            }}
          </RouterLink>
        </div>
      </form>
    </div>
  </div>
</template-->

<!--script>
import { dataStored } from "../../../data.js";

export default {
  data() {
    return {
      piece: {
        FAMILY: "",
        DESCR: "",
        PARTPROGRAM: "",
        MC1_ONLY: false,
        MC2_ONLY: false,
        MC3_ONLY: false,
        PRISMA: true,
        X: 0,
        Y: 0,
        Z: 0,
        Z_PICK: 0,
        Z_PLACE: 0,
      },
      createNew: false,
      activeDim: null,
    };
  },
  methods: {
    setActiveDim(dim) {
      this.activeDim = dim;
    },
    getDataTable() {
      if (this.$route.query.pieceID == undefined) {
        this.createNew = true;
        return;
      }
      fetch(
        dataStored.server + "api/conf/piece/show/" + this.$route.query.pieceID,
        { method: "GET" }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          this.piece = data[0];
          this.piece.X /= 1000;
          this.piece.Y /= 1000;
          this.piece.Z /= 1000;
          this.piece.Z_PICK /= 1000;
          this.piece.Z_PLACE /= 1000;
        })
        .catch((error) => {
          console.info(error);
        });
    },
    saveData() {
      let cmd = "";
      if (!this.piece.PRISMA) this.piece.Y = this.piece.X;

      this.piece.X *= 1000;
      this.piece.Y *= 1000;
      this.piece.Z *= 1000;
      this.piece.Z_PICK *= 1000;
      this.piece.Z_PLACE *= 1000;

      if (!this.createNew) {
        cmd =
          dataStored.server +
          "api/conf/piece/updatePiece?" +
          new URLSearchParams(this.piece).toString();
      } else {
        cmd =
          dataStored.server +
          "api/conf/piece/insertPiece?" +
          new URLSearchParams(this.piece).toString();
      }
      fetch(cmd, { method: "GET" })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return this.$router.push("/conf/Parts");
        })
        .catch((error) => {
          console.info(error);
        });
    },
  },
  mounted() {
    this.getDataTable();
  },
};
</script-->

<!--style scoped>
.piece-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #e5e7eb;
}

.piece-header {
  margin: 4px 0 0;
}

.piece-header h1 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: #e5e7eb;
  margin: 0;
}

.piece-id {
  margin-left: 6px;
  color: #38bdf8;
  font-weight: 500;
}

.piece-card {
  width: 100%;
  max-width: 1150px;
  margin: 8px 0 32px;
  background: rgba(9, 9, 11, 0.97);
  border-radius: 16px;
  padding: 20px 26px 24px;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(63, 63, 70, 0.9);
}

.pure-form-aligned .pure-control-group {
  display: flex;
  align-items: center;
  margin: 8px 0;
}

.pure-form-aligned .pure-control-group label {
  width: 170px;
  margin-right: 12px;
  text-align: right;
  font-size: 12px;
  color: #9ca3af;
}

.pure-form-aligned .pure-control-group input[type="text"],
.pure-form-aligned .pure-control-group input[type="number"] {
  width: 280px;
  padding: 6px 9px;
  border-radius: 8px;
  border: 1px solid rgba(75, 85, 99, 0.9);
  background: #020817;
  color: #e5e7eb;
  font-size: 12px;
  outline: none;
  transition: all 0.18s ease-out;
}

.pure-form-aligned .pure-control-group input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25);
}

.pure-form-aligned .pure-control-group small {
  margin-left: 6px;
  font-size: 10px;
  color: #6b7280;
}

.mc-group {
  align-items: flex-start;
}

.mc-label {
  width: 170px;
  margin-right: 12px;
  text-align: right;
  font-size: 12px;
  color: #9ca3af;
  padding-top: 6px;
}

.mc-switches {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.mc-switches label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #e5e7eb;
}

.shape-toggle {
  display: inline-flex;
  background: #020817;
  border-radius: 999px;
  padding: 2px;
  gap: 2px;
  border: 1px solid rgba(75, 85, 99, 0.9);
}

.shape-pill {
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 999px;
  cursor: pointer;
  color: #9ca3af;
  transition: all 0.18s ease-out;
}

.shape-pill.active {
  background: #22c55e;
  color: #020817;
  font-weight: 600;
}

.piece-main {
  display: flex;
  align-items: flex-start;
  gap: 40px;
  margin-top: 10px;
}

.piece-fields {
  flex: 1.6;
}

.piece-svg {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.dim-svg {
  width: 160px;
  height: 160px;
}

.cube-face {
  fill: rgba(15, 23, 42, 0.9);
  stroke: rgba(75, 85, 99, 0.9);
  stroke-width: 1;
}

.cube-edge {
  fill: none;
  stroke: rgba(107, 114, 128, 0.9);
  stroke-width: 1;
}

.dim-line {
  stroke: rgba(148, 163, 253, 0.7);
  stroke-width: 2;
}

.dim-text {
  font-size: 10px;
  fill: rgba(148, 163, 253, 0.7);
  font-weight: 500;
}

.dim-line.active {
  stroke: #38bdf8;
  stroke-width: 3;
}

.dim-text.active {
  fill: #38bdf8;
  font-weight: 700;
}

.piece-actions {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.piece-save {
  background: #38bdf8;
  border-radius: 8px;
  padding: 7px 18px;
  border: none;
  color: #020817;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease-out;
}

.piece-save:hover {
  background: #0ea5e9;
  box-shadow: 0 4px 12px rgba(56, 189, 248, 0.35);
}

.piece-cancel {
  font-size: 11px;
  color: #9ca3af;
  text-decoration: none;
}

.piece-cancel:hover {
  color: #e5e7eb;
  text-decoration: underline;
}
</style-->
