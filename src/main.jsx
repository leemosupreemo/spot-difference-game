import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import DeviceSimulatorHarness from './components/DeviceSimulatorHarness.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <DeviceSimulatorHarness>
        <App />
      </DeviceSimulatorHarness>
    </ErrorBoundary>
  </StrictMode>,
)
