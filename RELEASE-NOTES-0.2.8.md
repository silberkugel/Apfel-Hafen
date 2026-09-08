# Apfel-Hafen 0.2.8

Diese Version erweitert die Dienstzentrale um vollständige launchd-Zeitplanung und die sichere Bearbeitung bestehender benutzereigener LaunchAgents.

## Neu

- LaunchAgents können einmal beim Laden beziehungsweise Login (`RunAtLoad`) gestartet werden.
- Prozesse können mit `KeepAlive` dauerhaft am Leben gehalten werden.
- Wiederkehrende Starts lassen sich über `StartInterval` in Sekunden konfigurieren.
- Mehrere tägliche oder wöchentliche Startzeiten lassen sich über `StartCalendarInterval` festlegen.
- Bestehende benutzereigene LaunchAgents können mit vorausgefüllten Werten bearbeitet werden.

## Sicherheit und Qualität

- Änderungen an Plist-Dateien erfolgen atomar und bewahren nicht von Apfel-Hafen verwaltete Schlüssel.
- Geladene LaunchAgents werden vor der Änderung entladen und anschließend erneut geladen; bei Fehlern wird die vorherige Konfiguration wiederhergestellt.
- Systemweite LaunchAgents und LaunchDaemons bleiben schreibgeschützt.
- Neue Frontend-Interaktionstests prüfen Schalter, Intervalle sowie das Hinzufügen, Ändern und Entfernen kalenderbasierter Startzeiten.
- Ein reproduzierbarer macOS-Funktionstest prüft alle vier launchd-Startarten mit echten temporären Benutzer-LaunchAgents.
