# Apfel-Hafen 0.3.3 (in Entwicklung)

Version 0.3.3 legt die Grundlage für einen sicheren und verständlichen Umgang
mit Docker-Compose-Mehrcontainerprojekten. Der erste Schritt ist eine
transparente Analyse vor der späteren Ausführung als gemeinsamer Stack.

## Geplanter Schwerpunkt: Compose-Analyse

- Compose-Dateien aus einem lokalen Ordner oder einem unterstützten Projekt
  einlesen.
- Dienste, Images, Ports, Netzwerke, Volumes und Abhängigkeiten gemeinsam
  darstellen.
- `.env`-Dateien und Compose-Profile berücksichtigen, ohne Geheimnisse in der
  Oberfläche oder in Protokollen offenzulegen.
- Nicht unterstützte oder riskante Einstellungen vor der Installation in einem
  verständlichen Kompatibilitätsbericht ausweisen.
- Die Analyse zunächst ohne Veränderungen an laufenden Containern durchführen.

Der genaue Umfang wird während der Entwicklung ergänzt. Fertige Funktionen
werden erst beim Abschluss von 0.3.3 als veröffentlicht gekennzeichnet.
