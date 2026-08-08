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

FIREBASE_APP_ID="1:396835359318:ios:a87d550b51f279818389f7"
FIREBASE_PROJECT="thirteen-a5760"
FIREBASE_GROUPS="internal-testers"
RELEASE_NOTES="Diff Hunter iOS Speedrun Game Build (${TIMESTAMP})"

usage() {
  cat <<'EOF'
Usage: scripts/distribute_ios.sh [options]

Builds, packages, and uploads Diff Hunter iOS app to Firebase App Distribution.

Options:
  --groups <groups>                    Comma-separated tester groups. Default: internal-testers
  --release-notes <text>               Inline release notes.
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
require_cmd firebase
require_cmd npm
require_cmd npx

echo "----------------------------------------------------"
echo "🚀 DIFF HUNTER - IOS FIREBASE DISTRIBUTION PIPELINE"
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

if [[ -z "$ipa_path" ]]; then
  echo "❌ No IPA found in $EXPORT_PATH"
  exit 1
fi

echo "✅ IPA package created at: $ipa_path"

echo "🚀 5. Uploading and distributing to Firebase App Distribution..."
export FIREBASE_CLI_NO_ANALYTICS=1

dist_cmd=(
  firebase appdistribution:distribute "$ipa_path"
  --app "$FIREBASE_APP_ID"
  --project "$FIREBASE_PROJECT"
  --groups "$FIREBASE_GROUPS"
  --release-notes "$RELEASE_NOTES"
  --non-interactive
)

if CI=1 "${dist_cmd[@]}" < /dev/null; then
  echo "----------------------------------------------------"
  echo "🎉 FIREBASE APP DISTRIBUTION SUCCEEDED!"
  echo "📱 App uploaded to Firebase App Distribution."
  echo "📩 Check your email / Firebase Tester app to install on your phone!"
  echo "----------------------------------------------------"
else
  echo "⚠️ Initial upload attempt failed, retrying once..."
  sleep 5
  if CI=1 "${dist_cmd[@]}" < /dev/null; then
    echo "🎉 FIREBASE APP DISTRIBUTION SUCCEEDED!"
  else
    echo "❌ Firebase distribution failed."
    exit 1
  fi
fi

exit 0
