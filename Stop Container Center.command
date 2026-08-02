#!/bin/zsh

PID="$(lsof -nP -iTCP:4173 -sTCP:LISTEN -t 2>/dev/null | head -n 1)"
if [[ -z "$PID" ]]; then
  osascript -e 'display notification "Container Center is not running." with title "Container Center"'
  exit 0
fi

kill "$PID"
osascript -e 'display notification "Container Center was stopped." with title "Container Center"'
