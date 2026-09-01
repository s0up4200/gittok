import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// autoUpdate reloads the page when a new service worker takes control. Without this an installed app that iOS
// keeps alive runs the old bundle for days. Foregrounding checks for a new build, so the reload lands on return.
const update = registerSW({ immediate: true })
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && update())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
