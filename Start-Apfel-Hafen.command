#!/bin/zsh

set -u
PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR" || exit 1

NODE_BIN=""
if [[ -x "$PROJECT_DIR/runtime/node" ]]; then
  NODE_BIN="$PROJECT_DIR/runtime/node"
fi
if [[ -z "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node 2>/dev/null || true)"
fi
if [[ -z "$NODE_BIN" ]]; then
  osascript -e 'display alert "Node.js is missing" message "Install Node.js and then start Apfel-Hafen again." as critical'
  exit 1
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
