#!/bin/zsh

set -euo pipefail

MODE="${1:-run}"
APP_NAME="ApfelHafen"
ROOT_DIR="${0:A:h:h}"
APP_BUNDLE="$ROOT_DIR/app-out/Apfel-Hafen.app"
APP_BINARY="$APP_BUNDLE/Contents/MacOS/$APP_NAME"
EXPECTED_VERSION="$(node -p "JSON.parse(require('fs').readFileSync('$ROOT_DIR/package.json', 'utf8')).version")"

pkill -x "$APP_NAME" >/dev/null 2>&1 || true
zsh "$ROOT_DIR/scripts/build-app.sh"
pkill -x ApfelHafenService >/dev/null 2>&1 || true

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    /usr/bin/lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\""
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate 'subsystem == "de.apfel-hafen.app"'
    ;;
  --verify|verify)
    open_app
    for attempt in {1..20}; do
      pgrep -x "$APP_NAME" >/dev/null || { sleep 1; continue; }
      STATUS="$(curl -ksS --max-time 2 https://127.0.0.1:4173/api/status 2>/dev/null || true)"
      if [[ "$STATUS" == *"\"version\":\"$EXPECTED_VERSION\""* ]]; then
        print -- "Apfel-Hafen $EXPECTED_VERSION und der zugehörige HTTPS-Dienst laufen."
        exit 0
      fi
      sleep 1
    done
    print -u2 -- "Apfel-Hafen wurde gestartet, aber der HTTPS-Dienst meldet nicht Version $EXPECTED_VERSION."
    exit 1
    ;;
  *)
    print -u2 -- "usage: $0 [run|--debug|--logs|--telemetry|--verify]"
    exit 2
    ;;
esac
