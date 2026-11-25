#!/bin/zsh

set -u
PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR" || exit 1

NODE_BIN=""
if [[ -x "$PROJECT_DIR/runtime/node" ]]; then
  NODE_BIN="$PROJECT_DIR/runtime/node"
fi
if [[ -z "$NODE_BIN" ]]; then
  # Never fall back to `command -v node`: a PATH-hijacked binary would run the
  # admin server and its PAM flow outside the bundled, checksum-verified runtime.
  # Development checkouts can opt in explicitly via APFEL_HAFEN_NODE.
  if [[ -n "${APFEL_HAFEN_NODE:-}" && -x "$APFEL_HAFEN_NODE" ]]; then
    NODE_BIN="$APFEL_HAFEN_NODE"
  else
    osascript -e 'display alert "Node.js runtime is missing" message "The bundled runtime ./runtime/node is missing. Reinstall Apfel-Hafen from the release archive, or set APFEL_HAFEN_NODE explicitly for development use." as critical'
    exit 1
  fi
fi

if [[ ! -f "$PROJECT_DIR/dist/index.html" ]]; then
  osascript -e 'display alert "Interface not built" message "The built web files are missing. Complete the installation first." as critical'
  exit 1
fi

echo "Apfel-Hafen is starting as a background service …"
if ! "$NODE_BIN" "$PROJECT_DIR/service-control.mjs" start; then
  osascript -e 'display alert "Apfel-Hafen could not be started" message "See the Terminal output and ~/Library/Logs/Apfel-Hafen/service-error.log for details." as critical'
  exit 1
fi

for attempt in {1..30}; do
  if curl --insecure --silent --fail --max-time 1 https://127.0.0.1:4173/ >/dev/null 2>&1; then
    open https://127.0.0.1:4173/
    echo "Apfel-Hafen is running in the background. This window can be closed."
    exit 0
  fi
  sleep 0.25
done

echo "Apfel-Hafen could not be started."
exit 1
