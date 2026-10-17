import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/errors/ErrorBoundary'
import { ErrorScreen } from './components/errors/ErrorScreen'

// Start waking the (free, sleeping) backend right away, so it's likely up by the
// time someone logs in. Fire-and-forget: the result doesn't matter.
const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
fetch(`${API_BASE}/health`, { cache: 'no-store' }).catch(() => {})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Last line of defence: never leave a blank white page. */}
    <ErrorBoundary name="App" fallback={(props) => <ErrorScreen {...props} variant="app" />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
