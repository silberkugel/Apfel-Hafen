# Apfel-Hafen 0.2.6

Diese Version erweitert Apfel-Hafen um eine zentrale Verwaltung für macOS-Dienste und verbessert die Container-Konfiguration.

## Neu

- LaunchD-Dienste lassen sich in einer eigenen Dienstzentrale anzeigen, filtern und verwalten.
- Benutzer-Dienste können erstellt, gestartet, gestoppt, neu gestartet und bereinigt werden.
- Startargumente von Containern können beim Erstellen und späteren Bearbeiten gepflegt werden.
- Vollständige Docker-Hub-Referenzen werden bei der Image-Suche direkt erkannt und angeboten.

## Verbessert

- Die Image-Suche bleibt bei direkten Referenzen auch dann nutzbar, wenn Docker Hub vorübergehend nicht erreichbar ist.
- Anmeldung und API-Proxy funktionieren konsistent in der lokalen Entwicklungsumgebung.
- Zusätzliche Tests sichern LaunchD-Verwaltung, Startargumente, Image-Suche und Update-Prüfung ab.

## Release-Artefakt

Das macOS-ARM64-Paket enthält die Weboberfläche, die native SwiftUI-App und die gebündelte Node.js-Laufzeit.
