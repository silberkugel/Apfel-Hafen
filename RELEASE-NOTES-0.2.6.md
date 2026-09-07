# Apfel-Hafen 0.2.6

## Updates

- Nach einem erfolgreichen Image-Update wird der lokale Update-Status zurückgesetzt. Die Aktion wechselt dadurch zuverlässig von „Container ersetzen“ zurück zu „Update prüfen“.
- Die Container-Konsole probiert bei Images ohne `sh` automatisch weitere verfügbare Shells beziehungsweise Python aus.

## Diagnose und Stabilität

- Start- und Containerprotokolle können über das Drei-Punkte-Menü direkt in der Oberfläche angezeigt und neu geladen werden.
- Schlägt der erste Start eines neu erstellten Containers fehl, bleibt der Container für die Fehleranalyse erhalten.
- Ist Apples Containerdienst vorübergehend nicht erreichbar, versucht Apfel-Hafen ihn einmal zu starten und wiederholt anschließend den ursprünglichen Befehl.

## Container-Vorgaben

- MQTT- und Mosquitto-Images erhalten sinnvolle Vorschläge für Port `1883` und das Datenverzeichnis `/mosquitto/data`.
