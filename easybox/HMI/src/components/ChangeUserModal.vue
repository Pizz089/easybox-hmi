<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { dataStored } from '@/data'
// (v3 E1.2) icone del livello in lucide, come la striscia (util/userLevel.js)
import { X } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import { iconaLivello } from '@/util/userLevel.js'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])

const { t } = useI18n()

const password = ref('')
const showError = ref(false)
const errorMsg = ref('')
const passwordInput = ref(null)

const currentLevelIcon = computed(() => iconaLivello(dataStored.userLevel))

function close() {
  password.value = ''
  showError.value = false
  errorMsg.value = ''
  emit('close')
}

function submit() {
  switch (password.value) {
    case '333':
      dataStored.userLevel = 1
      sessionStorage.setItem('userLevel', dataStored.userLevel)
      setTimeout(() => {
        dataStored.userLevel = 0
        sessionStorage.removeItem('userLevel')
      }, dataStored.timeoutUserLevel)
      onSuccess(1)
      break
    case '555':
      dataStored.userLevel = 2
      sessionStorage.setItem('userLevel', dataStored.userLevel)
      setTimeout(() => {
        dataStored.userLevel = 0
        sessionStorage.removeItem('userLevel')
      }, dataStored.timeoutUserLevel)
      onSuccess(2)
      break
    case '666':
      dataStored.userLevel = 2
      sessionStorage.setItem('userLevel', dataStored.userLevel)
      onSuccess(2)
      break
    default:
      onError()
      break
  }
}

function onSuccess(level) {
  dataStored.alert.title = t('changeUser.successAlert.title')
  dataStored.alert.desc = t('changeUser.successAlert.desc', {
    level: t('changeUser.levelLabel.' + level),
  })
  dataStored.alert.type = 'message'
  close()
}

// X: ritorno esplicito al livello operatore — prima esisteva solo il
// timeout dei 5' (e il login '666' non ne aveva affatto): nessun percorso
// manuale per tornare a 0. Azzera anche la persistenza sessionStorage
// (stessa coppia di operazioni del timeout). L'eventuale timer dei 5'
// ancora pendente rifissera' 0 su 0: innocuo.
const route = useRoute()
const router = useRouter()

// Voci sidebar gated da requiresLevel (SideBar.vue): /conf/Machines (2),
// /diag/mqtt (1). Dopo il downgrade l'operatore non deve restare su una
// pagina che la sua sidebar non mostra -> redirect a /dashboard.
// startsWith: copre anche eventuali sotto-route future delle stesse aree.
const RESTRICTED_PATHS = ['/conf/machines', '/diag/mqtt']

function backToOperator() {
  dataStored.userLevel = 0
  sessionStorage.removeItem('userLevel')
  if (RESTRICTED_PATHS.some((p) => route.path.toLowerCase().startsWith(p)))
    router.push('/dashboard')
  close()
}

function onError() {
  errorMsg.value = t('changeUser.error')
  showError.value = true
  setTimeout(() => {
    showError.value = false
  }, 400)
}

function handleEscape(e) {
  if (e.key === 'Escape' && props.open) {
    close()
  }
}

watch(
  () => props.open,
  async (val) => {
    document.body.style.overflow = val ? 'hidden' : ''
    if (val) {
      await nextTick()
      passwordInput.value?.focus()
    }
  }
)

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.body.style.overflow = ''
})
</script>

<template>
  <!-- (v3 E1.2) la scatola dei dialog del pannello (assets/css/dialogs.css):
       velo, superficie piena, angoli 24. Il tocco sul velo chiude come prima
       (e' un cambio utente, non un allarme). -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="mission-dialog-overlay change-user" @click.self="close">
        <section class="mission-dialog mission-dialog--narrow change-user__box" :class="{ shake: showError }"
          role="dialog" aria-modal="true" aria-labelledby="changeuser-title">
          <header class="alert-box__head">
            <h2 id="changeuser-title" class="alert-box__title change-user__title">{{ t('changeUser.title') }}</h2>
            <button type="button" class="alert-box__x" @click="close" :aria-label="t('changeUser.close')">
              <X :stroke-width="2" aria-hidden="true" />
            </button>
          </header>
          <p class="change-user__subtitle">{{ t('changeUser.subtitle') }}</p>

          <div class="current-level">
            <component :is="currentLevelIcon" class="level-icon" :stroke-width="2" aria-hidden="true" />
            <span>
              {{ t('changeUser.currentLevel') }}:
              <strong>{{ t('changeUser.levelLabel.' + dataStored.userLevel) }}</strong>
            </span>
          </div>

          <div class="form-group">
            <label for="changeuser-pwd">{{ t('changeUser.passwordLabel') }}</label>
            <input
              ref="passwordInput"
              id="changeuser-pwd"
              type="password"
              v-model="password"
              :placeholder="t('changeUser.placeholder')"
              @keyup.enter="submit"
              autocomplete="current-password"
            />
            <span v-if="errorMsg" class="error-msg">{{ errorMsg }}</span>
          </div>

          <UiButton variant="primary" size="main" block @click="submit">{{ t('changeUser.submit') }}</UiButton>

          <!-- ritorno all'operatore: visibile SOLO sopra il livello operatore -->
          <UiButton v-if="dataStored.userLevel > 0" variant="outline" size="main" block @click="backToOperator">
            {{ t('changeUser.backToOperator') }}
          </UiButton>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* (v3 E1.2) scatola, velo e X dalla sede unica (dialogs.css); qui solo il
   contenuto del cambio utente. Sopra gli altri dialog (2000), sotto il
   riquadro degli allarmi (50000). */
.change-user { z-index: 2000; }
.change-user__title { color: var(--text-primary); }
.change-user__subtitle {
  margin: 0;
  font-size: var(--font-size-body);
  color: var(--text-secondary);
}

.current-level {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-well);
  border-radius: var(--radius-btn);
  font-size: var(--font-size-body);
  color: var(--text-secondary);
}
.current-level strong {
  color: var(--text-primary);
  font-weight: var(--font-weight-extrabold);
}
.level-icon {
  width: 32px;
  height: 32px;
  flex: none;
  color: var(--accent);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.form-group label {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
  font-weight: var(--font-weight-bold);
}
.form-group input {
  background: var(--bg-input);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-btn);
  padding: 0 var(--space-4);
  min-height: 56px;
  color: var(--text-primary);
  font-size: var(--font-size-md);
  transition: border-color var(--transition-fast);
}
.form-group input:focus,
.form-group input:focus-visible {
  outline: none;
  border-color: var(--text-primary);
}
.error-msg {
  font-size: var(--font-size-body);
  color: var(--color-danger-fg);
}

.change-user__box.shake {
  animation: shake 0.4s cubic-bezier(.36, .07, .19, .97) both;
}
@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .change-user__box,
.modal-leave-active .change-user__box {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .change-user__box,
.modal-leave-to .change-user__box {
  transform: scale(0.95);
  opacity: 0;
}
</style>
