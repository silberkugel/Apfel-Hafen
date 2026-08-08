#!/bin/zsh

set -euo pipefail

PROJECT_DIR="${0:A:h:h}"
cd "$PROJECT_DIR"

VERSION="$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version")"
DMG="$PROJECT_DIR/out/Apfel-Hafen-$VERSION-macos-arm64.dmg"
CHECKSUM="$DMG.sha256"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/apfel-hafen-dmg.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT INT TERM

zsh scripts/build-app.sh
ditto app-out/Apfel-Hafen.app "$STAGE/Apfel-Hafen.app"
ln -s /Applications "$STAGE/Programme"

rm -f "$DMG" "$CHECKSUM"
/usr/bin/hdiutil create -quiet -volname "Apfel-Hafen" -srcfolder "$STAGE" -format UDZO "$DMG"

if [[ -n "${APFEL_HAFEN_NOTARY_PROFILE:-}" ]]; then
  /usr/bin/xcrun notarytool submit "$DMG" --keychain-profile "$APFEL_HAFEN_NOTARY_PROFILE" --wait
  /usr/bin/xcrun stapler staple "$DMG"
  /usr/sbin/spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG"
fi

shasum -a 256 "$DMG" > "$CHECKSUM"
print -- "$DMG"
print -- "$CHECKSUM"
