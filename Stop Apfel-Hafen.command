#!/bin/zsh

PID="$(lsof -nP -iTCP:4173 -sTCP:LISTEN -t 2>/dev/null | head -n 1)"
if [[ -z "$PID" ]]; then
  osascript -e 'display notification "Apfel-Hafen is not running." with title "Apfel-Hafen"'
  exit 0
fi

kill "$PID"
osascript -e 'display notification "Apfel-Hafen was stopped." with title "Apfel-Hafen"'
