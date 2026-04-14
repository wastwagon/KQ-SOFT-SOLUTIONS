/**
 * Single premium light theme — dark mode and theme toggle removed.
 * Ensures .dark is never applied so only light styles are used.
 */
function ensureLightTheme() {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('dark')
  }
}

// Run on load so we never show dark
if (typeof document !== 'undefined') {
  ensureLightTheme()
}

export const useTheme = {
  apply: ensureLightTheme,
}
