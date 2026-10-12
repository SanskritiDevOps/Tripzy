import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/errors/ErrorBoundary'
import { ErrorScreen } from './components/errors/ErrorScreen'
import { DevCrash } from './components/errors/DevCrash'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Last line of defence: never leave a blank white page. */}
    <ErrorBoundary name="App" fallback={(props) => <ErrorScreen {...props} variant="app" />}>
      <DevCrash where="app" />
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
