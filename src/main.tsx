import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// The service worker is what makes the app installable, and installing is what
// registers it as a share target — so registration is load-bearing, not an extra.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // BASE_URL keeps this correct under a subpath deploy; the worker's scope
    // is its own directory, which is exactly the app's scope.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Blocked (e.g. insecure origin); the app still works, just not installable.
    })
  })
}
