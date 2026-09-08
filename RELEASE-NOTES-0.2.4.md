# Apfel-Hafen 0.2.4

## Native macOS-App

- Die neue SwiftUI-App übernimmt Ersteinrichtung, LaunchAgent-Installation und Dienstverwaltung.
- Die Weboberfläche wird weiterhin sicher im normalen Browser geöffnet.
- Das Release enthält neben dem eigenständigen Server-Archiv nun auch ein installierbares DMG.

## Containerverwaltung

- CPU, Arbeitsspeicher, Portfreigaben, Volumes und Umgebungsvariablen lassen sich über das Drei-Punkte-Menü ändern.
- Änderungen werden vorab geprüft und bei Fehlern automatisch zurückgerollt.
- Pfade für Zertifikate und Sicherungen werden zuverlässig in den macOS-Anwendungsdaten verwaltet.
- Feste Images unter `local/` werden bei der Update-Prüfung direkt aus dem lokalen Image-Speicher gelesen und nicht von Docker Hub abgerufen.
- Die Update-Prüfung zeigt auch dann eine sichtbare Rückmeldung, wenn kein Update verfügbar ist.
- Regressionstests sichern lokale und öffentliche Image-Prüfungen, Digest-Änderungen sowie die UI-Rückmeldung ab.
