#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load secrets if they exist
if [[ -f "$ROOT_DIR/.secrets/project-secrets.zsh" ]]; then
  source "$ROOT_DIR/.secrets/project-secrets.zsh"
fi

BUILD_ROOT="$ROOT_DIR/build/android"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DEFAULT_VERSION_CODE="$(git -C "$ROOT_DIR" rev-list --count HEAD 2>/dev/null || echo 10)"
VERSION_CODE="${ANDROID_VERSION_CODE:-${BUILD_NUMBER:-$DEFAULT_VERSION_CODE}}"
APP_VERSION="$(sed -nE "s/^export const APP_VERSION = '([^']+)';/\\1/p" "$ROOT_DIR/src/services/appConfig.js")"
VERSION_NAME="${ANDROID_VERSION_NAME:-$APP_VERSION}"
KEYSTORE_PATH="${ANDROID_KEYSTORE_PATH:-$ROOT_DIR/.secrets/diffhunter-release.keystore}"
KEYSTORE_PASSWORD="${ANDROID_KEYSTORE_PASSWORD:-}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-diffhunter}"
KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-$KEYSTORE_PASSWORD}"
BUILD_APK=false
GEN_KEYSTORE=false

usage() {
  cat <<'EOF'
Usage: scripts/distribute_android.sh [options]

Builds Vite web bundle, syncs Capacitor Android, and builds a release Android App Bundle (.aab)
ready for Google Play Store upload.

Options:
  --version-code <num>        Override versionCode (integer, e.g. 398).
  --version-name <str>        Override versionName (e.g. 1.1.0).
  --keystore-path <path>      Path to release keystore file.
  --keystore-password <pwd>   Keystore password.
  --key-alias <alias>         Key alias (default: diffhunter).
  --key-password <pwd>        Key password.
  --generate-keystore         Interactively generate a new release keystore in .secrets/.
  --apk                       Also build a release APK (.apk) for local device testing.
  -h, --help                  Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version-code)
      VERSION_CODE="$2"
      shift 2
      ;;
    --version-name)
      VERSION_NAME="$2"
      shift 2
      ;;
    --keystore-path)
      KEYSTORE_PATH="$2"
      shift 2
      ;;
    --keystore-password)
      KEYSTORE_PASSWORD="$2"
      shift 2
      ;;
    --key-alias)
      KEY_ALIAS="$2"
      shift 2
      ;;
    --key-password)
      KEY_PASSWORD="$2"
      shift 2
      ;;
    --generate-keystore)
      GEN_KEYSTORE=true
      shift
      ;;
    --apk)
      BUILD_APK=true
      shift
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

require_cmd npm
require_cmd npx

# 0. Keystore generator helper
if [[ "$GEN_KEYSTORE" == true ]]; then
  mkdir -p "$ROOT_DIR/.secrets"
  KEYSTORE_TARGET="${KEYSTORE_PATH:-$ROOT_DIR/.secrets/diffhunter-release.keystore}"
  if [[ -f "$KEYSTORE_TARGET" ]]; then
    echo "⚠️ Keystore already exists at: $KEYSTORE_TARGET"
  else
    KEYTOOL_CMD="keytool"
    if [[ -x "/opt/homebrew/opt/openjdk@21/bin/keytool" ]]; then
      KEYTOOL_CMD="/opt/homebrew/opt/openjdk@21/bin/keytool"
    elif [[ -x "/opt/homebrew/opt/openjdk/bin/keytool" ]]; then
      KEYTOOL_CMD="/opt/homebrew/opt/openjdk/bin/keytool"
    elif [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/keytool" ]]; then
      KEYTOOL_CMD="$JAVA_HOME/bin/keytool"
    fi

    STORE_PASS="${KEYSTORE_PASSWORD:-}"
    if [[ -z "$STORE_PASS" ]]; then
      STORE_PASS="$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)"
    fi
    KEY_PASS="${KEY_PASSWORD:-$STORE_PASS}"

    echo "🔑 Generating new Android release keystore: $KEYSTORE_TARGET"
    "$KEYTOOL_CMD" -genkeypair -v \
      -keystore "$KEYSTORE_TARGET" \
      -alias "$KEY_ALIAS" \
      -keyalg RSA \
      -keysize 2048 \
      -validity 10000 \
      -storepass "$STORE_PASS" \
      -keypass "$KEY_PASS" \
      -dname "CN=Diff Hunter, OU=Mobile Games, O=Diff Hunter, L=Austin, ST=Texas, C=US"

    echo "✅ Keystore successfully created at: $KEYSTORE_TARGET"

    mkdir -p "$ROOT_DIR/.secrets"
    SECRETS_FILE="$ROOT_DIR/.secrets/project-secrets.zsh"
    touch "$SECRETS_FILE"
    if ! grep -q "ANDROID_KEYSTORE_PATH" "$SECRETS_FILE"; then
      cat <<SECRETS >> "$SECRETS_FILE"

# Android Release Signing Keystore
export ANDROID_KEYSTORE_PATH="$KEYSTORE_TARGET"
export ANDROID_KEYSTORE_PASSWORD="$STORE_PASS"
export ANDROID_KEY_ALIAS="$KEY_ALIAS"
export ANDROID_KEY_PASSWORD="$KEY_PASS"
SECRETS
      echo "🔒 Keystore credentials saved to $SECRETS_FILE"
    fi
  fi
  exit 0
fi

# Locate compatible JDK (Gradle 8.14 supports JDK 17 or 21)
if [[ -z "${JAVA_HOME:-}" ]]; then
  for candidate in \
    "/opt/homebrew/opt/openjdk@21" \
    "/opt/homebrew/opt/openjdk@17" \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home" \
    "/Library/Java/JavaVirtualMachines/zulu-21.jdk/Contents/Home"; do
    if [[ -d "$candidate" && -x "$candidate/bin/java" ]]; then
      export JAVA_HOME="$candidate"
      echo "☕ Using detected Java runtime: $JAVA_HOME"
      break
    fi
  done
fi

# Locate ANDROID_HOME
if [[ -z "${ANDROID_HOME:-}" ]]; then
  for candidate in \
    "$HOME/Library/Android/sdk" \
    "/opt/homebrew/share/android-commandlinetools" \
    "/usr/local/share/android-sdk"; do
    if [[ -d "$candidate" ]]; then
      export ANDROID_HOME="$candidate"
      export ANDROID_SDK_ROOT="$candidate"
      echo "📱 Using detected Android SDK: $ANDROID_HOME"
      break
    fi
  done
fi

echo "----------------------------------------------------"
echo "🚀 DIFF HUNTER - GOOGLE PLAY ANDROID DISTRIBUTION"
echo "----------------------------------------------------"
echo "🔢 Version Name: $VERSION_NAME"
echo "🔢 Version Code: $VERSION_CODE"
if [[ -f "$KEYSTORE_PATH" ]]; then
  echo "🔐 Release Keystore: $KEYSTORE_PATH"
  export ANDROID_KEYSTORE_PATH="$KEYSTORE_PATH"
  export ANDROID_KEYSTORE_PASSWORD="$KEYSTORE_PASSWORD"
  export ANDROID_KEY_ALIAS="$KEY_ALIAS"
  export ANDROID_KEY_PASSWORD="$KEY_PASSWORD"
else
  echo "⚠️  No release keystore found at: $KEYSTORE_PATH"
  echo "   (Build will proceed with default signing. Run with --generate-keystore to create one.)"
fi

echo ""
echo "📦 1. Building Vite web bundle and syncing Capacitor Android project..."
(cd "$ROOT_DIR" && npm run build && npx cap sync android)

GRADLE_ARGS=(
  -p "$ROOT_DIR/android"
  bundleRelease
  "-PversionCode=$VERSION_CODE"
  "-PversionName=$VERSION_NAME"
)

if [[ -f "$KEYSTORE_PATH" && -n "$KEYSTORE_PASSWORD" ]]; then
  GRADLE_ARGS+=(
    "-PRELEASE_STORE_FILE=$KEYSTORE_PATH"
    "-PRELEASE_STORE_PASSWORD=$KEYSTORE_PASSWORD"
    "-PRELEASE_KEY_ALIAS=$KEY_ALIAS"
    "-PRELEASE_KEY_PASSWORD=$KEY_PASSWORD"
  )
fi

echo ""
echo "🏗️  2. Building Android App Bundle (.aab)..."
"$ROOT_DIR/android/gradlew" "${GRADLE_ARGS[@]}"

OUTPUT_AAB="$ROOT_DIR/android/app/build/outputs/bundle/release/app-release.aab"
RUN_DIR="$BUILD_ROOT/$TIMESTAMP"
mkdir -p "$RUN_DIR"

if [[ -f "$OUTPUT_AAB" ]]; then
  TARGET_AAB="$RUN_DIR/DiffHunter-v${VERSION_NAME}-b${VERSION_CODE}.aab"
  cp "$OUTPUT_AAB" "$TARGET_AAB"
  ln -sf "$TARGET_AAB" "$BUILD_ROOT/DiffHunter-release-latest.aab"

  echo ""
  echo "----------------------------------------------------"
  echo "🎉 GOOGLE PLAY APP BUNDLE (.AAB) READY!"
  echo "📦 Location: $TARGET_AAB"
  echo "📊 File Size: $(du -h "$TARGET_AAB" | cut -f1)"
  echo "🔗 Google Play Console: https://play.google.com/console"
  echo "👉 Navigate to: Play Console -> Your App -> Testing (Closed test) or Production -> Create New Release -> Upload $TARGET_AAB"
  echo "----------------------------------------------------"
fi

if [[ "$BUILD_APK" == true ]]; then
  echo ""
  echo "📱 3. Building standalone release APK..."
  APK_GRADLE_ARGS=(
    -p "$ROOT_DIR/android"
    assembleRelease
    "-PversionCode=$VERSION_CODE"
    "-PversionName=$VERSION_NAME"
  )
  if [[ -f "$KEYSTORE_PATH" && -n "$KEYSTORE_PASSWORD" ]]; then
    APK_GRADLE_ARGS+=(
      "-PRELEASE_STORE_FILE=$KEYSTORE_PATH"
      "-PRELEASE_STORE_PASSWORD=$KEYSTORE_PASSWORD"
      "-PRELEASE_KEY_ALIAS=$KEY_ALIAS"
      "-PRELEASE_KEY_PASSWORD=$KEY_PASSWORD"
    )
  fi
  "$ROOT_DIR/android/gradlew" "${APK_GRADLE_ARGS[@]}"
  OUTPUT_APK="$ROOT_DIR/android/app/build/outputs/apk/release/app-release.apk"
  if [[ -f "$OUTPUT_APK" ]]; then
    TARGET_APK="$RUN_DIR/DiffHunter-v${VERSION_NAME}-b${VERSION_CODE}.apk"
    cp "$OUTPUT_APK" "$TARGET_APK"
    ln -sf "$TARGET_APK" "$BUILD_ROOT/DiffHunter-release-latest.apk"
    echo "✅ Release APK: $TARGET_APK"
    echo "🔗 Latest APK Symlink: $BUILD_ROOT/DiffHunter-release-latest.apk"
  fi
fi

exit 0
