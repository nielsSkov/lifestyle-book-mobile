import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

registerSW({
  immediate: true,
  onRegisteredSW() {
    void navigator.serviceWorker.ready.then(() => {
      document.documentElement.dataset.offlineReady = 'true'
      window.dispatchEvent(new Event('lifestyle-book:offline-ready'))
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
