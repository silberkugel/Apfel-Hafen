# Apfel-Hafen 0.3.7

Veröffentlicht am 2. November 2026.

## Zuverlässiger Dienststart

- Ein benutzerbezogener, atomarer Instanz-Lock verhindert parallele
  Serverprozesse, unabhängig davon, ob Apfel-Hafen über die native App, den
  LaunchAgent, den Finder-Startbefehl oder `service-control.mjs` gestartet
  wird.
- Ein erneuter Start erkennt einen bereits laufenden Dienst und beendet sich
  sauber, statt die bestehende Instanz neu zu starten oder zu duplizieren.
- Vor dem Laden des LaunchAgents wird Port 4173 geprüft. Eine fremde
  Portbelegung wird verständlich gemeldet.
- Der HTTPS-Server behandelt `EADDRINUSE` als erwartbaren Startfehler mit
  Port, Adresse und einem konkreten Lösungshinweis; Node.js stürzt nicht mehr
  mit einer ungefangenen Ausnahme ab.

## Diagnose und Protokolle

- `service.log` und `service-error.log` werden bei jedem Dienststart über drei
  Generationen rotiert.
- Jede Protokollzeile enthält einen ISO-Zeitstempel, die Prozess-ID und eine
  eindeutige Start-ID. Beide Protokolle beginnen mit einer klaren
  Startmarkierung.
- Die native App und der klassische LaunchAgent verwenden dasselbe
  Protokollformat und dieselbe Rotationsstrategie.

## MCP-Konfiguration

- Die MCP-Token-Datei wird immer aus dem tatsächlichen Benutzerverzeichnis
  unter `~/Library/Application Support/Apfel-Hafen/mcp-token` geladen.
- Ein abweichendes `APFEL_HAFEN_DATA_DIR` kann den Tokenpfad nicht mehr
  unbeabsichtigt verändern. Bestehende Tokens im Benutzerverzeichnis bleiben
  gültig.

## Qualitätssicherung

- Neue Regressionstests decken Instanz-Lock, Startidentität, Tokenpfad und
  das gemeinsame Protokollformat auf beiden Ausgabeströmen ab.
- Der native Hintergrunddienst wird als eigenes Swift-Produkt gebaut und im
  App-Paket gemeinsam mit dem Server ausgeliefert.
