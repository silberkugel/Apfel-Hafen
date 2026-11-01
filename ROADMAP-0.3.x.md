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

## 0.3.5 – Betriebssicherheit und OpenTalk (veröffentlicht)

- Neustartregeln und Wiederanlauf nach einem Mac-Neustart absichern.
- Sicherung, Aktualisierung und Rollback für Stack-Daten und Konfigurationen
  anbieten.
- Ein geprüftes OpenTalk-Profil beziehungsweise einen Adapter für die
  Besonderheiten des Originalprojekts bereitstellen.
- Diagnose- und Wiederherstellungswege für Administratoren ergänzen.

## 0.3.6 – Speicherorte und Speichertransparenz (in Entwicklung)

- Den globalen Pfad für Apfel-Hafen-Sicherungen unabhängig vom Volume-Pfad
  konfigurieren und damit auch ein dauerhaft verbundenes externes Laufwerk
  verwenden können.
- Vor jeder Sicherung prüfen, ob das ausgewählte Ziel tatsächlich verfügbar
  ist, damit ein fehlendes externes Laufwerk nicht unbemerkt durch einen
  lokalen Ordner ersetzt wird.
- In der Technik-Zentrale den von Apple Container belegten Platz für
  Snapshots sowie Images und Inhalte getrennt anzeigen.
- Die vorhandenen, bestätigungspflichtigen Bereinigungsaktionen für
  gestoppte Container, ungenutzte Images und nicht referenzierte Volumes
  direkt bei diesen Messwerten anbieten.
- Den internen Datenstamm von Apple Container nur anzeigen. Eine Verlagerung
  auf externe Datenträger wird erst angeboten, wenn Apple Container diesen
  Betriebsmodus zuverlässig unterstützt.

Die Entwicklungszweige werden nacheinander vom jeweils abgeschlossenen Stand
erstellt. Dadurch basiert jede Unterversion auf allen Korrekturen ihrer
Vorgängerversionen.
