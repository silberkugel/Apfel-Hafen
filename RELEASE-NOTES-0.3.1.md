# Apfel-Hafen 0.3.1

Version 0.3.1 ergänzt die Dienstzentrale um einen eigenständigen Reiter „Technik“.

## Technik-Zentrale

- Sechs adaptive Statuskacheln zeigen Arbeitsspeicher und Speicherdruck, CPU und Load, GPU/Neural Engine, SSD, thermischen Zustand sowie Systemlaufzeit und macOS-Version.
- Nicht zuverlässig verfügbare GPU-, Neural-Engine- und Temperatursensordaten werden ausdrücklich als nicht verfügbar gekennzeichnet und nicht geschätzt.
- Ein Apple-Container-Banner fasst Laufzeitstatus, aktive Container, CPU, RAM, Speicherbelegung und rückgewinnbaren Speicher zusammen.
- Die Live-Tabelle zeigt pro Container CPU, RAM und Limit, Netzwerk- und Block-I/O-Raten sowie die Prozessanzahl. Aufeinanderfolgende Messungen werden für CPU- und Datenraten ausgewertet.
- Kleine Verlaufsgrafiken halten bis zu 15 Minuten CPU-, RAM- und SSD-Werte ausschließlich im Browser-Arbeitsspeicher.
- Gesundheitsregeln warnen vor Speicherdruck, knappem SSD-Platz, hohem rückgewinnbarem Speicher und zu knapp bemessener RAM-Reserve für macOS.

## Verwaltung und Sicherheit

- Container können aus der Detailansicht gestartet, gestoppt und neu gestartet werden.
- CPU- und RAM-Limits verwenden den vorhandenen abgesicherten Neuaufbau mit Probe-Container, Sicherung und automatischer Wiederherstellung.
- Für laufende Container muss die kurze Unterbrechung ausdrücklich bestätigt werden.
- Gestoppte Container, ungenutzte Images und nicht referenzierte Volumes können einzeln und erst nach einer Warnung bereinigt werden.
- Technikdaten und sämtliche Aktionen erfordern eine Administrator-Sitzung. Schreibende Aktionen bleiben auf die lokale Oberfläche begrenzt.
- Live-Systemprotokolle werden wegen der zusätzlichen macOS-Root-Anforderung sicher im Terminal geöffnet; die notwendige Freigabe erfolgt dort über `sudo`, ohne das Apfel-Hafen-Anmeldepasswort zu speichern oder weiterzugeben.
- Die Technik-Zentrale behält beim Reiterwechsel den letzten Messstand bei und aktualisiert ihn beim erneuten Öffnen, statt erneut mit einer leeren Ansicht zu beginnen.
- Die Fußzeile zeigt nun je nach Reiter den Verbindungszustand, aktive Container oder LaunchD-Dienste, den Apple-Container-Zustand und die letzte erfolgreiche Aktualisierung.

## Kompatibilität

- Die Technik-Zentrale verwendet öffentliche macOS-Werkzeuge und die maschinenlesbaren Ausgaben von Apple Container 1.1.0.
- GPU und Neural Engine werden von Apple Container nicht an Linux-Container durchgereicht. Ein privilegierter, hardwareabhängiger Sensor-Helfer ist nicht Bestandteil von 0.3.1.
