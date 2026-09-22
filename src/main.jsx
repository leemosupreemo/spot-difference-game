import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import DeviceSimulatorHarness from './components/DeviceSimulatorHarness.jsx'
import { initSentry } from './services/sentry.js'
import { Capacitor } from '@capacitor/core'

initSentry();

// Lets CSS fork on platform. The curtain screen transition, for one, is a native
// app affordance that reads as a stutter in a browser.
document.documentElement.classList.add(
  Capacitor.isNativePlatform() ? 'platform-native' : 'platform-web'
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <DeviceSimulatorHarness>
        <App />
      </DeviceSimulatorHarness>
    </ErrorBoundary>
  </StrictMode>,
)
