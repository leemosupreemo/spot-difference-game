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
EXPORT_OPTIONS_PLIST="$ROOT_DIR/ExportOptions.plist"
BUILD_ROOT="$ROOT_DIR/build/distribution"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$BUILD_ROOT/$TIMESTAMP"
ARCHIVE_PATH="$RUN_DIR/DiffHunter.xcarchive"
EXPORT_PATH="$RUN_DIR/export"
DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-3J93523B6Q}"

usage() {
  cat <<'EOF'
Usage: scripts/distribute_ios.sh [options]

Builds and packages the Diff Hunter iOS app into an IPA artifact.

Options:
  --scheme <scheme>                    Xcode scheme. Default: App
  --configuration <configuration>      Xcode configuration. Default: Release
  --build-root <path>                  Root output directory. Default: build/distribution
  -h, --help                           Show this help.
EOF
}

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
echo "🚀 DIFF HUNTER - IOS BUILD & DISTRIBUTION PIPELINE"
echo "----------------------------------------------------"

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

echo "🏗️  3. Archiving Xcode app project '$PROJECT_FILE' (Team: '$DEVELOPMENT_TEAM')..."
archive_cmd=(
  xcodebuild archive
  -project "$PROJECT_FILE"
  -scheme "$SCHEME"
  -configuration "$CONFIGURATION"
  -archivePath "$ARCHIVE_PATH"
  DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM"
  -allowProvisioningUpdates
)

if ! "${archive_cmd[@]}"; then
  echo "❌ Xcode archive failed!"
  exit 1
fi
echo "✅ Archive created at: $ARCHIVE_PATH"

echo "📤 4. Exporting IPA package..."
export_cmd=(
  xcodebuild -exportArchive
  -archivePath "$ARCHIVE_PATH"
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"
  -exportPath "$EXPORT_PATH"
  -allowProvisioningUpdates
)

if ! "${export_cmd[@]}"; then
  echo "❌ Xcode IPA export failed!"
  exit 1
fi

ipa_path="$(find "$EXPORT_PATH" -maxdepth 1 -name '*.ipa' -print -quit || true)"

if [[ -n "$ipa_path" ]]; then
  echo "----------------------------------------------------"
  echo "🎉 IOS DISTRIBUTION IPA CREATED SUCCESSFULLY!"
  echo "📱 IPA File Location: $ipa_path"
  echo "----------------------------------------------------"
else
  echo "✅ App exported to: $EXPORT_PATH"
fi

exit 0
