# Apfel-Hafen 0.3.4

Veröffentlicht am 27. Oktober 2026.

Version 0.3.4 baut auf der sicheren, nur lesenden Compose-Analyse aus 0.3.3
auf. Das Ziel ist eine kontrollierte Stack-Laufzeit für den geprüften und von
Apple Container unterstützten Compose-Funktionsumfang.

## Neu

- Einen analysierten Stack als zusammengehörige Einheit anlegen, starten und
  stoppen.
- Dienste in der ermittelten Abhängigkeitsreihenfolge starten und beim Stoppen
  in umgekehrter Reihenfolge behandeln.
- Benannte Netzwerke und Volumes nachvollziehbar einem Stack zuordnen.
- Healthchecks und Dienstabhängigkeiten berücksichtigen, bevor abhängige
  Dienste gestartet werden.
- Status, Ressourcenverbrauch und Protokolle sowohl je Dienst als auch für den
  gesamten Stack anzeigen.
- Teilfehler, Wiederholungsversuche und notwendige manuelle Entscheidungen für
  Administratoren sichtbar machen.
- Vor jeder Änderung erneut prüfen, ob der Stack verlustfrei auf Apple
  Container abgebildet werden kann.

## Planung und Schutz

- Aus einer aktuellen Compose-Analyse kann ein deterministischer, weiterhin
  nur lesender Ausführungsplan erzeugt werden.
- Der Plan zeigt die späteren Namen von Containern, Netzwerken und Volumes
  sowie Start- und Stoppreihenfolge.
- Eine Plan-ID bindet den Entwurf an den genauen Compose-, `.env`- und
  Profilstand, ohne Geheimniswerte auszugeben.
- Aktive Fehler und Warnungen werden als offene Entscheidungen übernommen und
  sperren die Ausführung, statt Eigenschaften stillschweigend zu verwerfen.
- Eine nur lesende Vorabprüfung vergleicht den Plan mit den tatsächlich auf
  dem Mac vorhandenen Containern und Portfreigaben.
- Vorhandene Container-Namen, bereits belegte Ports und doppelte Portangaben
  innerhalb des Stacks werden vor jeder späteren Ausführung als Konflikt
  gemeldet.
- Erweiterte oder mehrdeutige Portsyntax bleibt im Bericht sichtbar und wird
  nicht unbemerkt in eine vereinfachte Freigabe umgewandelt.
- App und Hintergrunddienst vergleichen zusätzlich eine Inhaltskennung. Damit
  werden auch neue Entwicklungs-Builds innerhalb derselben Versionsnummer
  zuverlässig aktiviert.

## Sicherheitsgrenze

Nicht unterstützte oder mehrdeutige Compose-Eigenschaften werden nicht
stillschweigend ignoriert. Die Ausführung bleibt gesperrt, bis die Analyse
einen sicheren, nachvollziehbaren Plan liefern kann oder der Administrator
eine ausdrücklich unterstützte Entscheidung getroffen hat.

- Die Installation wiederholt unmittelbar davor die Vorabprüfung und verwirft
  veraltete Plan-IDs.
- Unterstützte Dienste werden in Abhängigkeitsreihenfolge angelegt und
  gestartet; CMD-Healthchecks werden vor abhängigen Diensten ausgeführt.
- Bei einem Teilfehler entfernt Apfel-Hafen die in diesem Versuch neu
  angelegten Container automatisch wieder.
- Installierte Stacks erscheinen gemeinsam mit ihrem Laufzustand und lassen
  sich als Einheit starten oder in umgekehrter Reihenfolge stoppen.
- Stack-Definitionen liegen geschützt in den macOS-Anwendungsdaten; die
  Oberfläche erhält keine gespeicherten Geheimniswerte zurück.
