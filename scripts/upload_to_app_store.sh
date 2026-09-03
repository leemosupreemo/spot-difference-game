#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load secrets if present
if [[ -f "$ROOT_DIR/.secrets/project-secrets.zsh" ]]; then
  source "$ROOT_DIR/.secrets/project-secrets.zsh"
fi

PROJECT_FILE="$ROOT_DIR/ios/App/App.xcodeproj"
SCHEME="App"
CONFIGURATION="Release"
EXPORT_OPTIONS_PLIST="$ROOT_DIR/ExportOptionsAppStore.plist"
BUILD_ROOT="$ROOT_DIR/build/appstore"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BUILD_NUMBER="$(date +%y%m%d%H%M)"
RUN_DIR="$BUILD_ROOT/$TIMESTAMP"
ARCHIVE_PATH="$RUN_DIR/DiffHunter.xcarchive"
DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-3J93523B6Q}"

echo "--------------------------------------------------------"
echo "🚀 DIFF HUNTER - APP STORE CONNECT UPLOAD PIPELINE"
echo "--------------------------------------------------------"
echo "🔢 Build Number: $BUILD_NUMBER"
echo "👥 Team ID:      $DEVELOPMENT_TEAM"

echo "📦 1. Building Vite web bundle and syncing Capacitor iOS native project..."
(cd "$ROOT_DIR" && npm run build && npx cap sync ios)

if [[ -n "${KEYCHAIN_PASSWORD:-}" ]]; then
  echo "🔐 2. Unlocking login keychain for App Store code signing..."
  KEYCHAIN_PATH="$HOME/Library/Keychains/login.keychain-db"
  if security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" 2>/dev/null; then
    echo "✅ Keychain unlocked."
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" 2>/dev/null || true
  else
    echo "⚠️ Keychain unlock warning (continuing with session)."
  fi
fi

mkdir -p "$RUN_DIR"

echo "🏗️  3. Archiving Xcode app for App Store (Build #${BUILD_NUMBER})..."
archive_cmd=(
  xcodebuild archive
  -project "$PROJECT_FILE"
  -scheme "$SCHEME"
  -configuration "$CONFIGURATION"
  -archivePath "$ARCHIVE_PATH"
  DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM"
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER"
  -allowProvisioningUpdates
)

if ! "${archive_cmd[@]}"; then
  echo "❌ Xcode archive failed!"
  exit 1
fi
echo "✅ Archive created successfully at: $ARCHIVE_PATH"

echo "📤 4. Uploading build to App Store Connect..."
upload_cmd=(
  xcodebuild -exportArchive
  -archivePath "$ARCHIVE_PATH"
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"
  -allowProvisioningUpdates
)

if ! "${upload_cmd[@]}"; then
  echo "❌ App Store Connect upload failed!"
  exit 1
fi

echo "--------------------------------------------------------"
echo "🎉 APP STORE CONNECT UPLOAD SUCCEEDED!"
echo "📱 Build #${BUILD_NUMBER} is now uploaded to App Store Connect."
echo "⏳ It will finish processing on Apple's servers in ~5-10 minutes."
echo "👉 You can now attach Build #${BUILD_NUMBER} to your version on App Store Connect!"
echo "--------------------------------------------------------"

exit 0
