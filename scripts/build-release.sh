#!/bin/zsh

set -euo pipefail

PROJECT_DIR="${0:A:h:h}"
cd "$PROJECT_DIR"

VERSION="$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version")"
NODE_VERSION="${APFEL_HAFEN_NODE_VERSION:-24.14.0}"
ARCH="arm64"
RELEASE_NAME="Apfel-Hafen-$VERSION-macos-$ARCH"
OUT_DIR="$PROJECT_DIR/out"
STAGE_DIR="$OUT_DIR/$RELEASE_NAME"
CACHE_DIR="$PROJECT_DIR/.release-cache"
NODE_ARCHIVE="node-v$NODE_VERSION-darwin-$ARCH.tar.gz"
NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/$NODE_ARCHIVE"
SHASUMS_URL="https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "$ARCH" ]]; then
  print -u2 -- "Dieses Release-Ziel benötigt macOS auf Apple Silicon ($ARCH)."
  exit 1
fi

for tool in node pnpm cc curl shasum ditto; do
  command -v "$tool" >/dev/null || {
    print -u2 -- "Build-Werkzeug fehlt: $tool"
    exit 1
  }
done

print -- "Teste und baue Apfel-Hafen $VERSION …"
pnpm install --frozen-lockfile
pnpm test
pnpm build
cc auth/pam-auth.c -o auth/pam-auth -lpam
codesign --force --sign - auth/pam-auth

mkdir -p "$CACHE_DIR"
if [[ ! -f "$CACHE_DIR/$NODE_ARCHIVE" || ! -f "$CACHE_DIR/SHASUMS256-$NODE_VERSION.txt" ]]; then
  print -- "Lade die gebündelte Node.js-Laufzeit $NODE_VERSION von nodejs.org …"
  curl --fail --location --proto '=https' --tlsv1.2 \
    "$NODE_URL" --output "$CACHE_DIR/$NODE_ARCHIVE"
  curl --fail --location --proto '=https' --tlsv1.2 \
    "$SHASUMS_URL" --output "$CACHE_DIR/SHASUMS256-$NODE_VERSION.txt"
fi

expected="$(awk -v file="$NODE_ARCHIVE" '$2 == file { print $1 }' "$CACHE_DIR/SHASUMS256-$NODE_VERSION.txt")"
actual="$(shasum -a 256 "$CACHE_DIR/$NODE_ARCHIVE" | awk '{ print $1 }')"
if [[ -z "$expected" || "$actual" != "$expected" ]]; then
  print -u2 -- "Die Prüfsumme der Node.js-Laufzeit stimmt nicht."
  exit 1
fi

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/apfel-hafen-release.XXXXXX")"
trap 'rm -rf "$TEMP_DIR"' EXIT INT TERM
tar -xzf "$CACHE_DIR/$NODE_ARCHIVE" -C "$TEMP_DIR"
NODE_ROOT="$TEMP_DIR/node-v$NODE_VERSION-darwin-$ARCH"

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/runtime" "$STAGE_DIR/auth" "$STAGE_DIR/lib"
ditto dist "$STAGE_DIR/dist"
ditto "$NODE_ROOT/bin/node" "$STAGE_DIR/runtime/node"
ditto "$NODE_ROOT/LICENSE" "$STAGE_DIR/runtime/NODE-LICENSE"
ditto auth/pam-auth "$STAGE_DIR/auth/pam-auth"
ditto lib "$STAGE_DIR/lib"
ditto server.mjs "$STAGE_DIR/server.mjs"
ditto "Start-Apfel-Hafen.command" "$STAGE_DIR/Start-Apfel-Hafen.command"
ditto "Stop-Apfel-Hafen.command" "$STAGE_DIR/Stop-Apfel-Hafen.command"
ditto README-DE.md "$STAGE_DIR/README-DE.md"
ditto README.md "$STAGE_DIR/README.md"
ditto LICENSE "$STAGE_DIR/LICENSE"
chmod 755 "$STAGE_DIR/runtime/node" "$STAGE_DIR/auth/pam-auth" \
  "$STAGE_DIR/Start-Apfel-Hafen.command" "$STAGE_DIR/Stop-Apfel-Hafen.command"

cat > "$STAGE_DIR/VERSION.txt" <<EOF
Apfel-Hafen $VERSION
Node.js $NODE_VERSION (gebündelte Laufzeit)
Zielplattform: macOS / $ARCH
EOF

if find "$STAGE_DIR" -type d -name node_modules | grep -q .; then
  print -u2 -- "Interner Fehler: node_modules darf nicht ausgeliefert werden."
  exit 1
fi

ARCHIVE="$OUT_DIR/$RELEASE_NAME.zip"
rm -f "$ARCHIVE" "$ARCHIVE.sha256"
COPYFILE_DISABLE=1 ditto --norsrc -c -k --keepParent "$STAGE_DIR" "$ARCHIVE"
shasum -a 256 "$ARCHIVE" > "$ARCHIVE.sha256"

print -- "Release erstellt:"
print -- "$ARCHIVE"
print -- "$ARCHIVE.sha256"
