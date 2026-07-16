<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { dataStored } from '@/data'

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

const currentLevelIcon = computed(() => {
  const map = { 0: 'casco.png', 1: 'chiaveIng.svg', 2: 'laurea.png' }
  const file = map[dataStored.userLevel] || 'casco.png'
  return new URL(`../assets/${file}`, import.meta.url).href
})

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
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @click.self="close">
        <div class="modal-dialog" :class="{ shake: showError }">
          <button
            type="button"
            class="modal-close"
            @click="close"
            :aria-label="t('changeUser.close')"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="4" y1="16" x2="16" y2="4" />
            </svg>
          </button>

          <h2 class="modal-title">{{ t('changeUser.title') }}</h2>
          <p class="modal-subtitle">{{ t('changeUser.subtitle') }}</p>

          <div class="current-level">
            <img :src="currentLevelIcon" class="level-icon" alt="" />
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

          <button type="button" class="pure-button-primary btn-primary" @click="submit">
            {{ t('changeUser.submit') }}
          </button>

          <!-- X: visibile SOLO sopra il livello operatore -->
          <button v-if="dataStored.userLevel > 0" type="button" class="btn-ghost btn-logout" @click="backToOperator">
            {{ t('changeUser.backToOperator') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--bg-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-dialog {
  position: relative;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  padding: var(--space-6);
  width: 420px;
  max-width: 92vw;
}

.modal-dialog.shake {
  animation: shake 0.4s cubic-bezier(.36, .07, .19, .97) both;
}

.modal-close {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--text-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;  /* touch minimo */
  min-height: 44px;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.modal-close:hover,
.modal-close:focus-visible {
  background: var(--bg-surface-2);
  color: var(--text-primary);
  outline: none;
}

.modal-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.modal-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--space-5);
}

.current-level {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-input);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-5);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.current-level strong {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.level-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.form-group label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-weight: var(--font-weight-semibold);
}

.form-group input {
  background: var(--bg-input);
  /* border-strong sugli input (audit WCAG: subtle su bg-input 1.77 -> 4.31) */
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  min-height: 44px;  /* touch minimo */
  color: var(--text-primary);
  font-size: var(--font-size-base);
  transition: border-color var(--transition-fast);
}

.form-group input:focus,
.form-group input:focus-visible {
  outline: none;
  border-color: var(--text-primary);
}

.error-msg {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}

/* Layout hook (opzione A audit-sistema-b): SOLO full-width nel modal,
   l'estetica viene dalla variante Primary canonica (buttons.css). */
.btn-primary {
  width: 100%;
}

/* X: layout hook come .btn-primary — l'estetica e' la variante Ghost
   canonica (buttons.css), qui solo full-width + stacco dal submit. */
.btn-logout {
  width: 100%;
  margin-top: var(--space-2);
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

.modal-enter-active .modal-dialog,
.modal-leave-active .modal-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-dialog,
.modal-leave-to .modal-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
