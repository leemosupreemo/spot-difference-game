# Diff Hunter

A high-performance Spot-the-Difference game built with React, Vite, Capacitor, and Firebase.

---

## Directory & App Bundle Structure

To easily identify what is packaged into the live game versus what is kept for offline tools and marketing, directories follow a strict naming convention:

### 📦 Core App Directories (Included in iOS Bundle / Web Build)
Folders without an underscore prefix are part of the core game build:

| Directory | Platform | Description |
| :--- | :--- | :--- |
| **`src/`** | Web & iOS | Core React game code, viewmodels, audio, and UI components (compiled into `dist/assets/`). |
| **`public/`** | Web & iOS | Static assets copied directly into the app bundle (offline starter levels in `public/levels/`, music in `public/music/`, app icons). |
| **`ios/`** | iOS Native | Native Xcode project shell, CocoaPods, Apple Game Center, and StoreKit configs. |
| **`android/`** | Android Native | Native Android Studio shell and gradle configurations. |

---

### 🚫 Non-App Directories (Prefixed with `_` — Never Bundled or Deployed)
Folders prefixed with an underscore (`_`) are excluded from app bundles and web deployments:

| Directory | Git Status | Purpose |
| :--- | :---: | :--- |
| **`_marketing/`** | Tracked | Social media campaigns, promotional videos, and variant image packs (e.g. `_marketing/social_media/ocean_series/`). |
| **`_design/`** | Tracked | Master high-resolution app icon templates (`_design/app-icon-master.png`). |
| **`_docs/`** | Tracked | Architecture notes, design documents, and developer guides. |
| **`_staging/`** | Ignored | Local working scratchpad for batch level generation before publishing. |

---

### 🛠 Tooling, Backend, and Hosted-Only Directories

| Directory | Target | Purpose |
| :--- | :--- | :--- |
| **`scripts/`** | Local / CI | Python and Node.js level generation pipelines, QA gates, and build automations. |
| **`functions/`** | Cloud Backend | Firebase Cloud Functions for global leaderboards and player verification. |
| **`remote-levels/`** | Web CDN Only | Extended level packs served over HTTPS (kept out of native app binary to minimize download size). |
| **`screenshots/`** | Local / QA | App Store display screenshots and automated visual regression test baselines. |

---

## Verifying the iOS App Bundle

To view the exact files and byte counts bundled into the native iOS app:

```bash
du -sh ios/App/App/public/*
```
