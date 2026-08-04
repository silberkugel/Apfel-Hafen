#!/bin/zsh

set -u
PROJECT_DIR="${0:A:h}"
NODE_BIN="$PROJECT_DIR/runtime/node"
if [[ ! -x "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node 2>/dev/null || true)"
fi
if [[ -z "$NODE_BIN" ]]; then
  osascript -e 'display alert "Node.js is missing" message "Apfel-Hafen cannot control its background service." as critical'
  exit 1
fi

if "$NODE_BIN" "$PROJECT_DIR/service-control.mjs" stop; then
  osascript -e 'display notification "Apfel-Hafen was stopped for this session." with title "Apfel-Hafen"'
  exit 0
fi

osascript -e 'display alert "Apfel-Hafen could not be stopped" message "See the Terminal output for details." as critical'
exit 1
