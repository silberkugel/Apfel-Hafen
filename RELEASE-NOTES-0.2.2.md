# Apfel-Hafen 0.2.2

## Deutsch

- Apfel-Hafen läuft jetzt als benutzerbezogener macOS-LaunchAgent im
  Hintergrund. Ein dauerhaft geöffnetes Terminalfenster ist nicht mehr nötig.
- Start und Stop steuern gezielt den LaunchAgent. Der schnelle Neustart wartet
  zuverlässig auf `launchd` und wiederholt das Laden bei Übergangsfehlern.
- Die Bindung bleibt zwischen rein lokalem Zugriff (`127.0.0.1`) und Zugriff
  über alle Netzwerkschnittstellen (`0.0.0.0`) umschaltbar.
- Nach dem Speichern der Administrationseinstellungen erscheinen drei Sekunden
  lang ein bestätigter Speichern-Button und eine Erfolgsmeldung.
- Der globale Info-Button öffnet einen deutsch- und englischsprachigen
  Erste-Schritte-Leitfaden aus Sicht des Hafenmeisters.
- Release-Paket und Tests decken die neue Service-Steuerung und die wichtigsten
  UI-Rückmeldungen ab.

## English

- Apfel-Hafen now runs in the background as a per-user macOS LaunchAgent. A
  permanently open Terminal window is no longer required.
- Start and Stop now target the LaunchAgent. Fast restarts reliably wait for
  `launchd` and retry loading after transient failures.
- Binding remains configurable between local-only access (`127.0.0.1`) and all
  network interfaces (`0.0.0.0`).
- Saving administration settings now shows a confirmed Save button and a toast
  for three seconds.
- The restored global Info button opens a bilingual getting-started guide from
  the harbor master's perspective.
- Release packaging and tests cover the new service control and key UI
  feedback.
