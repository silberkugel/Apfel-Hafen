# Apfel-Hafen 0.2.7

Diese Version führt die Dienstzentrale aus 0.2.6 mit den anschließend entwickelten Diagnose- und Stabilitätsverbesserungen zusammen.

## Updates

- Nach einem erfolgreichen Image-Update wird der lokale Update-Status zurückgesetzt. Die Aktion wechselt dadurch zuverlässig von „Container ersetzen“ zurück zu „Update prüfen“.
- Direkte und lokale Image-Referenzen werden bei der Update-Prüfung zuverlässig behandelt.

## Diagnose und Stabilität

- Start- und Containerprotokolle können über das Drei-Punkte-Menü direkt in der Oberfläche angezeigt und neu geladen werden.
- Schlägt der erste Start eines neu erstellten Containers fehl, bleibt der Container für die Fehleranalyse erhalten.
- Ist Apples Containerdienst vorübergehend nicht erreichbar, versucht Apfel-Hafen ihn einmal zu starten und wiederholt anschließend den ursprünglichen Befehl.
- Die Container-Konsole probiert bei Images ohne `sh` automatisch weitere verfügbare Shells beziehungsweise Python aus.

## Dienstzentrale und Container-Vorgaben

- Benutzerbezogene LaunchAgents können zentral erstellt und verwaltet werden; systemweite Dienste werden schreibgeschützt angezeigt.
- Startargumente von Containern lassen sich beim Erstellen und Bearbeiten pflegen.
- MQTT- und Mosquitto-Images erhalten Vorschläge für Port `1883` und das Datenverzeichnis `/mosquitto/data`.
