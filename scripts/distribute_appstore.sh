#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load secrets if they exist
if [[ -f "$ROOT_DIR/.secrets/project-secrets.zsh" ]]; then
  source "$ROOT_DIR/.secrets/project-secrets.zsh"
fi

PROJECT_FILE="$ROOT_DIR/ios/App/App.xcodeproj"
SCHEME="App"
CONFIGURATION="Release"
EXPORT_OPTIONS_PLIST="$ROOT_DIR/AppStoreExportOptions.plist"
LOCAL_EXPORT_OPTIONS_PLIST="$ROOT_DIR/AppStoreExportLocal.plist"
BUILD_ROOT="$ROOT_DIR/build/appstore"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BUILD_NUMBER="$(date +%y%m%d%H%M)"
RUN_DIR="$BUILD_ROOT/$TIMESTAMP"
ARCHIVE_PATH="$RUN_DIR/DiffHunter.xcarchive"
EXPORT_PATH="$RUN_DIR/export"
DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-3J93523B6Q}"
UPLOAD_TO_STORE=true

usage() {
  cat <<'EOF'
Usage: scripts/distribute_appstore.sh [options]

Builds, packages, and uploads Diff Hunter iOS app directly to App Store Connect / TestFlight.

Options:
  --local-only                         Build and export App Store IPA locally without uploading.
  --build-number <num>                 Override auto-generated build number.
  -h, --help                           Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local-only)
      UPLOAD_TO_STORE=false
      shift
      ;;
    --build-number)
      BUILD_NUMBER="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ Missing required command: $cmd"
    exit 1
  fi
}

require_cmd xcodebuild
require_cmd npm
require_cmd npx

echo "----------------------------------------------------"
echo "🚀 DIFF HUNTER - APP STORE CONNECT DISTRIBUTION"
echo "----------------------------------------------------"
echo "🔢 Build Number: $BUILD_NUMBER"
echo "🏢 Development Team: $DEVELOPMENT_TEAM"
echo "📦 Upload to App Store Connect: $UPLOAD_TO_STORE"

echo "📦 1. Building Vite web bundle and syncing Capacitor iOS native project..."
(cd "$ROOT_DIR" && npm run build && npx cap sync ios)

if [[ -n "${KEYCHAIN_PASSWORD:-}" ]]; then
  echo "🔐 2. Unlocking login keychain for codesign..."
  KEYCHAIN_PATH="$HOME/Library/Keychains/login.keychain-db"
  if security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" 2>/dev/null; then
    echo "✅ Keychain unlocked."
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" 2>/dev/null || true
  else
    echo "⚠️  Keychain unlock warning (continuing with default user session)."
  fi
fi

mkdir -p "$EXPORT_PATH"

echo "🏗️  3. Archiving Xcode app project for App Store (Build #${BUILD_NUMBER})..."
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
echo "✅ Archive created at: $ARCHIVE_PATH"

if [[ "$UPLOAD_TO_STORE" == true ]]; then
  echo "📤 4. Uploading build directly to App Store Connect..."
  export_cmd=(
    xcodebuild -exportArchive
    -archivePath "$ARCHIVE_PATH"
    -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"
    -exportPath "$EXPORT_PATH"
    -allowProvisioningUpdates
  )

  if "${export_cmd[@]}"; then
    echo "----------------------------------------------------"
    echo "🎉 APP STORE CONNECT UPLOAD SUCCEEDED!"
    echo "📱 Build #${BUILD_NUMBER} is now processing on App Store Connect / TestFlight."
    echo "🔗 Check TestFlight build status: https://appstoreconnect.apple.com/apps"
    echo "----------------------------------------------------"
  else
    echo "⚠️  Direct xcodebuild upload encountered an issue. Falling back to local IPA export..."
    fallback_export_cmd=(
      xcodebuild -exportArchive
      -archivePath "$ARCHIVE_PATH"
      -exportOptionsPlist "$LOCAL_EXPORT_OPTIONS_PLIST"
      -exportPath "$EXPORT_PATH"
      -allowProvisioningUpdates
    )
    if "${fallback_export_cmd[@]}"; then
      ipa_path="$(find "$EXPORT_PATH" -maxdepth 1 -name '*.ipa' -print -quit || true)"
      echo "✅ Local App Store IPA generated at: $ipa_path"
      echo "ℹ️  You can upload this IPA via Transporter app or 'xcrun altool --upload-app -f \"$ipa_path\" -t ios ...'"
    else
      echo "❌ Local IPA export failed."
      exit 1
    fi
  fi
else
  echo "📤 4. Exporting App Store IPA package locally (no upload requested)..."
  export_cmd=(
    xcodebuild -exportArchive
    -archivePath "$ARCHIVE_PATH"
    -exportOptionsPlist "$LOCAL_EXPORT_OPTIONS_PLIST"
    -exportPath "$EXPORT_PATH"
    -allowProvisioningUpdates
  )

  if ! "${export_cmd[@]}"; then
    echo "❌ Xcode IPA export failed!"
    exit 1
  fi

  ipa_path="$(find "$EXPORT_PATH" -maxdepth 1 -name '*.ipa' -print -quit || true)"
  echo "----------------------------------------------------"
  echo "✅ APP STORE IPA EXPORTED LOCALLY!"
  echo "📦 Package Path: $ipa_path"
  echo "----------------------------------------------------"
fi

exit 0
