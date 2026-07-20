<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { dataStored } from '../data.js'

const { t } = useI18n()
const route = useRoute()

function getState(isComplete, isCurrent) {
  if (isCurrent) return 'current'
  if (isComplete) return 'completed'
  return 'pending'
}

// Due sequenze per RAMO (cantiere AG fase 2, rig scelto in selectRig):
//   morsa       : rig -> piece -> gripper -> machine -> final
//   attrezzatura: rig -> piece(dichiarato) -> machine -> final
// A ramo non ancora scelto si mostra la sequenza morsa (piu' lunga) come
// anteprima; gli step pallet/fixture del vecchio flusso non esistono piu'
// (il pallet e' derivato dal rig).
const steps = computed(() => {
  const wo = dataStored.createWorkOrder
  const currentRoute = route.name
  const isFixture = wo.rigType === 'fixture'

  const list = [
    {
      key: 'rig',
      route: '/selectRig',
      value:
        wo.rigType !== '' && wo.palletID > 0
          ? t('wizard.value.rig', { id: wo.palletID }) + ' · ' +
            t(wo.rigType === 'vice' ? 'attrezzaggi.vice' : 'attrezzaggi.fixture')
          : null,
      state: getState(wo.rigType !== '' && wo.palletID > 0, currentRoute === 'selectRig'),
    },
    {
      key: 'piece',
      route: '/selectPiece',
      // Manual Vice rimossa (C3): pieceID=0 esiste ormai solo nel ramo
      // attrezzatura, dove il valore mostrato e' il pezzo DICHIARATO
      value: isFixture
        ? (wo.declaredPieceID > 0 ? t('wizard.value.piece', { id: wo.declaredPieceID }) : null)
        : wo.pieceID > 0
          ? t('wizard.value.piece', { id: wo.pieceID })
          : null,
      state: getState(
        isFixture ? wo.declaredPieceID > 0 : wo.pieceID > 0,
        currentRoute === 'selectPiece'
      ),
    },
  ]

  if (!isFixture) {
    list.push({
      key: 'gripper',
      route: '/selectGripper',
      value: wo.gripperID > 0 ? t('wizard.value.gripper', { id: wo.gripperID }) : null,
      state: getState(wo.gripperID > 0, currentRoute === 'selectGripper'),
    })
  }

  list.push(
    {
      key: 'machine',
      route: '/selectMC',
      value: wo.machineID > 0 ? t('wizard.value.machine', { id: wo.machineID }) : null,
      state: getState(wo.machineID > 0, currentRoute === 'selectMC'),
    },
    {
      key: 'final',
      route: '/lastData',
      value: null,
      state: currentRoute === 'lastData' ? 'current' : 'pending',
    }
  )
  return list
})
</script>

<template>
  <nav class="wizard-stepper">
    <div
      v-for="step in steps"
      :key="step.key"
      :class="['step-item', step.state]"
      @click="step.state === 'completed' && $router.push(step.route)"
      :role="step.state === 'completed' ? 'button' : undefined"
      :tabindex="step.state === 'completed' ? 0 : -1"
    >
      <div class="step-dot">
        <svg
          v-if="step.key === 'final' && step.state === 'current'"
          class="step-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <span class="step-label">{{ t(`wizard.step.${step.key}`) }}</span>
      <span class="step-value" v-if="step.value">{{ step.value }}</span>
    </div>
  </nav>
</template>

<style scoped>
.wizard-stepper {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4);
  /* margin-bottom rimosso: lo spazio lo da' il gap del .view-shell delle view */
  margin-bottom: 0;
  position: relative;
}

.step-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
  text-align: center;
}

/* Linea che connette il centro del dot N al centro del dot N+1.
   width = 100% (step-item) + gap (var(--space-3)) per coprire la
   distanza fino al dot successivo (left:50% del prossimo step-item).
   z-index:1 sta sotto il dot (z:2). */
.step-item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 16px;
  left: 50%;
  width: calc(100% + var(--space-3));
  height: 2px;
  background: var(--border-subtle);
  z-index: 1;
}

.step-item.completed {
  cursor: pointer;
}

.step-item.pending {
  cursor: default;
}

/* Pending state: color shift mirato su label/value invece di opacity globale.
   Il dot pending resta bg-base solido cosi' copre la linea sotto. */
.step-item.pending .step-label,
.step-item.pending .step-value {
  color: var(--text-muted);
}

.step-dot {
  position: relative;
  z-index: 2;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-base);
  border: 2px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  color: var(--bg-base);
}

.step-item.completed .step-dot {
  background: var(--text-primary);
  border-color: var(--text-primary);
}

.step-item.current .step-dot {
  background: var(--bg-base);
  border: 3px solid var(--text-primary);
  /* glow subtle: text-primary #E8EEF7 con alpha 0.15 */
  box-shadow: 0 0 0 4px rgba(232, 238, 247, 0.15);
}

.step-item.completed:hover .step-dot,
.step-item.completed:focus-visible .step-dot {
  filter: brightness(0.92);
  outline: none;
}

.step-item.completed:focus-visible,
.step-item.current:focus-visible {
  outline: none;
}

.step-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: var(--text-muted);
}

.step-item.current .step-label {
  color: var(--text-primary);
  font-weight: 700;
}

.step-item.completed .step-label {
  color: var(--text-secondary);
}

.step-value {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.step-item.completed .step-value {
  color: var(--text-primary);
}

.step-icon {
  color: var(--bg-base);
}
</style>
