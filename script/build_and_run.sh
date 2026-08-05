#!/bin/zsh

set -euo pipefail

MODE="${1:-run}"
APP_NAME="ApfelHafen"
ROOT_DIR="${0:A:h:h}"
APP_BUNDLE="$ROOT_DIR/app-out/Apfel-Hafen.app"
APP_BINARY="$APP_BUNDLE/Contents/MacOS/$APP_NAME"

pkill -x "$APP_NAME" >/dev/null 2>&1 || true
zsh "$ROOT_DIR/scripts/build-app.sh"

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
    sleep 2
    pgrep -x "$APP_NAME" >/dev/null
    ;;
  *)
    print -u2 -- "usage: $0 [run|--debug|--logs|--telemetry|--verify]"
    exit 2
    ;;
esac
