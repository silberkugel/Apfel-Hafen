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

## 0.3.6 – Speicherorte und Speichertransparenz (veröffentlicht)

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

## 0.3.7 – Speichersicherheit und Ressourcen-Budget (in Entwicklung)

Hintergrund: Auf einem Mac mit 16 GB Arbeitsspeicher haben mehrere aktive
Container zusammen mehr RAM benötigt, als physisch vorhanden ist. Apples
`container`-CLI lehnt solche Anfragen weder pro Container noch in Summe ab;
macOS gleicht den Mehrbedarf über den Swap aus, was die Leistung deutlich
verschlechtert und Container zum Abbruch bringen kann. Apfel-Hafen muss den
Gesamtbedarf deshalb selbst steuern.

- Ein konfigurierbares Gesamtspeicher-Budget für alle laufenden Container
  und die Builder-VM; Standard ist 60 % des installierten Arbeitsspeichers,
  damit macOS und weitere Anwendungen weiterhin ausreichend Platz haben.
- Verbindlicher Vorab-Check vor dem Start einzelner Container und kompletter
  Stacks: Bereits verpfändeter Speicher plus neue Anfrage übersteigt das
  Budget, wird der Start blockiert und Budget, verpfändeter Speicher,
  Anfrage und Differenz werden verständlich erklärt.
- Die Technik-Zentrale zeigt das Budget, den verpfändeten und den tatsächlich
  genutzten Speicher; Container, die dauerhaft mehr als 85 % ihres Limits
  verbrauchen, werden vor dem nächsten OOM-Abbruch gewarnt.
- Kritischer Speicherdruck löst in der Betriebskonsole eine Benachrichtigung
  mit konkreten Handlungsoptionen aus (Top-Verbraucher stoppen, Budget oder
  Limits anpassen).
- Das Verhalten wird in Release-Notes und README (DE/EN) dokumentiert.

Akzeptanzkriterien:

- Auf einem 16-GB-Mac lassen sich über Apfel-Hafen weder einzelne Container
  noch Stacks starten, die das Budget überschreiten.
- Jeder blockierte Start zeigt Budget, verpfändeten Speicher, Anfrage und
  Differenz sowie mindestens zwei konkrete Optionen.
- Verhalten innerhalb des Budgets bleibt unverändert; alle bestehenden Tests
  bleiben grün.
- Neue Unit- und Integrationstests für Budget, Vorab-Check und
  Druckbehandlung; keine neuen Endpunkte ohne Authentifizierung.

Die Entwicklungszweige werden nacheinander vom jeweils abgeschlossenen Stand
erstellt. Dadurch basiert jede Unterversion auf allen Korrekturen ihrer
Vorgängerversionen.
