# Roadmap für Apfel-Hafen 0.3.x

Diese Roadmap beschreibt die geplante Reihenfolge der nächsten
Unterversionen. Sie ist eine Arbeitsplanung und keine Zusage bereits fertiger
Funktionen.

## 0.3.3 – Compose-Analyse

- Mehrcontainerprojekte importieren und vor der Installation prüfen.
- `.env`-Dateien und Compose-Profile berücksichtigen.
- Dienste, Images, Ports, Netzwerke, Volumes, Abhängigkeiten und Healthchecks
  übersichtlich darstellen.
- Kompatibilitätsprobleme und notwendige Administratorentscheidungen vorab
  erklären.

## 0.3.4 – Stack-Laufzeit

- Einen geprüften Compose-Funktionsumfang als gemeinsamen Stack starten und
  stoppen.
- Netzwerke, Volumes, Abhängigkeiten und Healthchecks zuverlässig verwalten.
- Status, Ressourcenverbrauch und Protokolle pro Dienst sowie für den gesamten
  Stack anzeigen.
- Teilfehler und Wiederholungsversuche nachvollziehbar darstellen.

## 0.3.5 – Betriebssicherheit und OpenTalk

- Neustartregeln und Wiederanlauf nach einem Mac-Neustart absichern.
- Sicherung, Aktualisierung und Rollback für Stack-Daten und Konfigurationen
  anbieten.
- Ein geprüftes OpenTalk-Profil beziehungsweise einen Adapter für die
  Besonderheiten des Originalprojekts bereitstellen.
- Diagnose- und Wiederherstellungswege für Administratoren ergänzen.

Die Entwicklungszweige werden nacheinander vom jeweils abgeschlossenen Stand
erstellt. Dadurch basieren 0.3.4 und 0.3.5 später auf allen Korrekturen ihrer
Vorgängerversionen.
