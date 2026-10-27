# Roadmap für Apfel-Hafen 0.3.x

Diese Roadmap beschreibt die geplante Reihenfolge der nächsten
Unterversionen. Sie ist eine Arbeitsplanung und keine Zusage bereits fertiger
Funktionen.

## 0.3.3 – Compose-Analyse (veröffentlicht)

- Mehrcontainerprojekte in einem eigenen, nur lesenden Compose-Reiter
  als Datei, lokalen Projektordner oder öffentliches OpenCode-Projekt
  importieren beziehungsweise einfügen und vor der Installation prüfen.
- `.env`-Dateien und Compose-Profile berücksichtigen; vertrauliche Werte im
  gesamten Ergebnis maskieren.
- Dienste, Images, Builds, Ports, Netzwerke, Volumes, Abhängigkeiten,
  Neustartregeln und Healthchecks übersichtlich darstellen.
- Eine Startreihenfolge bestimmen und unbekannte Abhängigkeiten sowie Zyklen
  erkennen.
- Kompatibilitätsprobleme und notwendige Administratorentscheidungen vorab
  erklären, insbesondere privilegierten Betrieb, Host-Namensräume,
  Gerätezugriffe, Sicherheitsrechte, Secrets und Configs.
- Akzeptanzkriterium: Die Analyse darf keine Container erstellen, ändern,
  starten oder löschen.
- Akzeptanzkriterium: Noch nicht ausgewertete Compose-Eigenschaften müssen im
  Bericht erscheinen und dürfen nicht stillschweigend entfallen.
- Akzeptanzkriterium: Nicht ausgewählte Profile bleiben sichtbar, beeinflussen
  die Kompatibilität des aktiven Profils aber nur über echte Abhängigkeiten.

## 0.3.4 – Stack-Laufzeit (veröffentlicht)

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
