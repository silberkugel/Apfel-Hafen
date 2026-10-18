# Apfel-Hafen – Release-Notes vor 0.3.0

Dieses Archiv fasst die zuvor einzeln geführten Release-Notes der Versionen
0.2.2 bis 0.2.9 zusammen. Die Inhalte sind innerhalb der jeweiligen Version
vollständig erhalten.

## Version 0.2.9

Diese Version ergänzt eine abgesicherte Remote-MCP-Schnittstelle für Hermes Agent und andere kompatible MCP-Clients.

### Remote MCP

- Der neue Streamable-HTTP-Endpunkt ist unter `/mcp` über den bestehenden HTTPS-Dienst erreichbar.
- Unterstützt werden das aktuelle zustandslose MCP-Protokoll `2026-07-28` und ältere MCP-Clients mit Initialisierungshandshake.
- Bereitgestellt werden ausschließlich die Werkzeuge `list_containers`, `get_container_status`, `get_container_logs`, `start_container`, `stop_container`, `restart_container` und `check_image_update`.
- Shell-Zugriff, Container-Erstellung, Löschung, Image-Ersetzung und Host-Administration sind nicht über MCP verfügbar.

### Sicherheit und Betrieb

- Remote MCP ist standardmäßig deaktiviert und wird nur mit einem separaten Bearer-Token von mindestens 32 Zeichen aktiviert.
- Der Token kann über `APFEL_HAFEN_MCP_TOKEN` oder für den nativen LaunchAgent über die geschützte Datei `~/Library/Application Support/Apfel-Hafen/mcp-token` bereitgestellt werden.
- Token-Vergleiche erfolgen über gleich große SHA-256-Werte; Token-Dateien mit Gruppen- oder Weltzugriff werden abgelehnt.
- Werkzeugargumente sind auf exakte Container-Namen beschränkt, und Werkzeugaufrufe werden ohne Zugangsdaten im Dienstprotokoll erfasst.
- Dokumentation und Tests decken Hermes-Konfiguration, Authentifizierung, Tool-Schemas sowie ältere und aktuelle MCP-Protokollvarianten ab.

## Version 0.2.8

Diese Version erweitert die Dienstzentrale um vollständige launchd-Zeitplanung und die sichere Bearbeitung bestehender benutzereigener LaunchAgents.

### Neu

- LaunchAgents können einmal beim Laden beziehungsweise Login (`RunAtLoad`) gestartet werden.
- Prozesse können mit `KeepAlive` dauerhaft am Leben gehalten werden.
- Wiederkehrende Starts lassen sich über `StartInterval` in Sekunden konfigurieren.
- Mehrere tägliche oder wöchentliche Startzeiten lassen sich über `StartCalendarInterval` festlegen.
- Bestehende benutzereigene LaunchAgents können mit vorausgefüllten Werten bearbeitet werden.

### Sicherheit und Qualität

- Änderungen an Plist-Dateien erfolgen atomar und bewahren nicht von Apfel-Hafen verwaltete Schlüssel.
- Geladene LaunchAgents werden vor der Änderung entladen und anschließend erneut geladen; bei Fehlern wird die vorherige Konfiguration wiederhergestellt.
- Systemweite LaunchAgents und LaunchDaemons bleiben schreibgeschützt.
- Neue Frontend-Interaktionstests prüfen Schalter, Intervalle sowie das Hinzufügen, Ändern und Entfernen kalenderbasierter Startzeiten.
- Ein reproduzierbarer macOS-Funktionstest prüft alle vier launchd-Startarten mit echten temporären Benutzer-LaunchAgents.

## Version 0.2.7

Diese Version führt die Dienstzentrale aus 0.2.6 mit den anschließend entwickelten Diagnose- und Stabilitätsverbesserungen zusammen.

### Updates

- Nach einem erfolgreichen Image-Update wird der lokale Update-Status zurückgesetzt. Die Aktion wechselt dadurch zuverlässig von „Container ersetzen“ zurück zu „Update prüfen“.
- Direkte und lokale Image-Referenzen werden bei der Update-Prüfung zuverlässig behandelt.

### Diagnose und Stabilität

- Start- und Containerprotokolle können über das Drei-Punkte-Menü direkt in der Oberfläche angezeigt und neu geladen werden.
- Schlägt der erste Start eines neu erstellten Containers fehl, bleibt der Container für die Fehleranalyse erhalten.
- Ist Apples Containerdienst vorübergehend nicht erreichbar, versucht Apfel-Hafen ihn einmal zu starten und wiederholt anschließend den ursprünglichen Befehl.
- Die Container-Konsole probiert bei Images ohne `sh` automatisch weitere verfügbare Shells beziehungsweise Python aus.

### Dienstzentrale und Container-Vorgaben

- Benutzerbezogene LaunchAgents können zentral erstellt und verwaltet werden; systemweite Dienste werden schreibgeschützt angezeigt.
- Startargumente von Containern lassen sich beim Erstellen und Bearbeiten pflegen.
- MQTT- und Mosquitto-Images erhalten Vorschläge für Port `1883` und das Datenverzeichnis `/mosquitto/data`.

## Version 0.2.6

Diese Version erweitert Apfel-Hafen um eine zentrale Verwaltung für macOS-Dienste und verbessert die Container-Konfiguration.

### Neu

- LaunchD-Dienste lassen sich in einer eigenen Dienstzentrale anzeigen, filtern und verwalten.
- Benutzer-Dienste können erstellt, gestartet, gestoppt, neu gestartet und bereinigt werden.
- Startargumente von Containern können beim Erstellen und späteren Bearbeiten gepflegt werden.
- Vollständige Docker-Hub-Referenzen werden bei der Image-Suche direkt erkannt und angeboten.

### Verbessert

- Die Image-Suche bleibt bei direkten Referenzen auch dann nutzbar, wenn Docker Hub vorübergehend nicht erreichbar ist.
- Anmeldung und API-Proxy funktionieren konsistent in der lokalen Entwicklungsumgebung.
- Zusätzliche Tests sichern LaunchD-Verwaltung, Startargumente, Image-Suche und Update-Prüfung ab.

### Release-Artefakt

Das macOS-ARM64-Paket enthält die Weboberfläche, die native SwiftUI-App und die gebündelte Node.js-Laufzeit.

## Version 0.2.5

### Container-Konsole

- Im Administrationsmodus lässt sich für jeden laufenden Apple-Container über das Drei-Punkte-Menü eine interaktive Konsole öffnen.
- Die Konsole startet in einem eigenen macOS-Terminalfenster und führt `container exec --interactive --tty <Container> <Konsole>` aus.
- Falls ein Image keine POSIX-Shell enthält, probiert Apfel-Hafen nacheinander `sh`, `bash`, `ash`, `python3` und `python`.
- Der Konsolenaufruf ist auf die lokale Oberfläche und angemeldete macOS-Administratoren beschränkt; der Containerstatus wird direkt vor dem Öffnen erneut geprüft.

### Auslieferung

- Der Release-Befehl erzeugt nun immer zusätzlich ein DMG mit der nativen macOS-App.

## Version 0.2.4

### Native macOS-App

- Die neue SwiftUI-App übernimmt Ersteinrichtung, LaunchAgent-Installation und Dienstverwaltung.
- Die Weboberfläche wird weiterhin sicher im normalen Browser geöffnet.
- Das Release enthält neben dem eigenständigen Server-Archiv nun auch ein installierbares DMG.

### Containerverwaltung

- CPU, Arbeitsspeicher, Portfreigaben, Volumes und Umgebungsvariablen lassen sich über das Drei-Punkte-Menü ändern.
- Änderungen werden vorab geprüft und bei Fehlern automatisch zurückgerollt.
- Pfade für Zertifikate und Sicherungen werden zuverlässig in den macOS-Anwendungsdaten verwaltet.
- Feste Images unter `local/` werden bei der Update-Prüfung direkt aus dem lokalen Image-Speicher gelesen und nicht von Docker Hub abgerufen.
- Die Update-Prüfung zeigt auch dann eine sichtbare Rückmeldung, wenn kein Update verfügbar ist.
- Regressionstests sichern lokale und öffentliche Image-Prüfungen, Digest-Änderungen sowie die UI-Rückmeldung ab.

## Version 0.2.3

### Container-Einstellungen

- Container-Einstellungen lassen sich über das Drei-Punkte-Menü öffnen.
- CPU, Arbeitsspeicher, Portfreigaben, Volumes und Umgebungsvariablen können geändert werden.
- Die Oberfläche führt durch Prüfung, Änderung und Bestätigung.
- Laufende Container werden kontrolliert gestoppt, neu erstellt und automatisch wieder gestartet.
- Vor jeder Änderung wird eine Sicherung erstellt; bei Fehlern erfolgt eine automatische Wiederherstellung.
- CPU-Werte sind ganzzahlig und werden in Einerschritten geändert.

### Oberfläche

- Die Aktionen „Update prüfen“ und „Löschen“ sind im Container-Menü gebündelt.
- „Container erstellen“ verwendet die neutrale Gestaltung der übrigen Aktionsbuttons.

## Version 0.2.2

### Deutsch

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

### English

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
