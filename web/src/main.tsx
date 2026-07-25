import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import './index.css'
import App from './App.tsx'
import { useTheme } from './store/theme'
import { initWebSentry } from './lib/sentry'

initWebSentry()

// Single premium light theme
useTheme.apply()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
