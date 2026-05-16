import { ref, computed, onMounted } from 'vue';

const THEME_KEY = 'theme';
const theme = ref('system');

function applyTheme(current) {
  const root = document.documentElement;
  const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = current === 'dark' || (current === 'system' && preferDark);
  root.classList.toggle('dark', isDark);
}

export function useTheme() {
  const isDark = computed(() => {
    const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return theme.value === 'dark' || (theme.value === 'system' && preferDark);
  });

  function setTheme(next) {
    theme.value = next;
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark');
  }

  onMounted(() => {
    const saved = localStorage.getItem(THEME_KEY);
    theme.value = saved || 'system';
    applyTheme(theme.value);


    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => theme.value === 'system' && applyTheme('system');
    mq.addEventListener?.('change', handler);
  });

  return { theme, isDark, setTheme, toggleTheme };

}

export function initTheme() {
  const enabled = import.meta.env.VITE_DARK_MODE === "true";
  document.documentElement.classList.toggle("dark", enabled);
}