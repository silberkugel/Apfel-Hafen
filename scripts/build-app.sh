#!/bin/zsh

set -euo pipefail

PROJECT_DIR="${0:A:h:h}"
cd "$PROJECT_DIR"

VERSION="$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version")"
BUILD_NUMBER="$(git rev-list --count HEAD 2>/dev/null || print 1)"
RELEASE_STAGE="$PROJECT_DIR/out/Apfel-Hafen-$VERSION-macos-arm64"
APP_OUT="$PROJECT_DIR/app-out"
APP="$APP_OUT/Apfel-Hafen.app"
CONTENTS="$APP/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"
SERVER="$RESOURCES/Server"
AGENTS="$CONTENTS/Library/LaunchAgents"
MODULE_CACHE="$PROJECT_DIR/.build/ModuleCache"
SIGNING_IDENTITY="${APFEL_HAFEN_SIGNING_IDENTITY:--}"

print -- "Baue Webserver und selbständige Laufzeit …"
zsh scripts/build-release.sh

print -- "Baue native SwiftUI-App …"
env SWIFTPM_MODULECACHE_OVERRIDE="$MODULE_CACHE" CLANG_MODULE_CACHE_PATH="$MODULE_CACHE" swift build
BIN_DIR="$(env SWIFTPM_MODULECACHE_OVERRIDE="$MODULE_CACHE" CLANG_MODULE_CACHE_PATH="$MODULE_CACHE" swift build --show-bin-path)"

rm -rf "$APP"
mkdir -p "$MACOS" "$RESOURCES" "$AGENTS"
ditto "$RELEASE_STAGE" "$SERVER"
ditto "$BIN_DIR/ApfelHafen" "$MACOS/ApfelHafen"
ditto "$BIN_DIR/ApfelHafenService" "$MACOS/ApfelHafenService"
ditto MacApp/Resources/Info.plist "$CONTENTS/Info.plist"
ditto MacApp/Resources/ApfelHafen.icns "$RESOURCES/ApfelHafen.icns"
ditto MacApp/Resources/de.apfel-hafen.service.plist "$AGENTS/de.apfel-hafen.service.plist"
/usr/bin/sed -i '' -e "s/__VERSION__/$VERSION/g" -e "s/__BUILD__/$BUILD_NUMBER/g" "$CONTENTS/Info.plist"

chmod 755 "$MACOS/ApfelHafen" "$MACOS/ApfelHafenService" "$SERVER/runtime/node" "$SERVER/auth/pam-auth"
/usr/bin/plutil -lint "$CONTENTS/Info.plist" "$AGENTS/de.apfel-hafen.service.plist"

print -- "Signiere lokalen Entwicklungs-Build …"
if [[ "$SIGNING_IDENTITY" == "-" ]]; then
  SIGN_ARGS=(--force --sign -)
else
  SIGN_ARGS=(--force --timestamp --options runtime --sign "$SIGNING_IDENTITY")
fi
/usr/bin/codesign "${SIGN_ARGS[@]}" "$SERVER/runtime/node"
/usr/bin/codesign "${SIGN_ARGS[@]}" "$SERVER/auth/pam-auth"
/usr/bin/codesign "${SIGN_ARGS[@]}" "$MACOS/ApfelHafenService"
/usr/bin/codesign "${SIGN_ARGS[@]}" "$MACOS/ApfelHafen"
/usr/bin/codesign "${SIGN_ARGS[@]}" "$APP"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$APP"

print -- "$APP"
