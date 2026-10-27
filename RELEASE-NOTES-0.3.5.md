# Apfel-Hafen 0.3.5

Veröffentlicht am 27. Oktober 2026.

## Betriebssicherheit

- Apfel-Hafen speichert je Stack den gewünschten Laufzustand und prüft nach
  dem Start des Hintergrunddienstes, welche durch ihre Neustartregel
  abgesicherten Dienste wieder anlaufen müssen.
- `always`, `unless-stopped` und `on-failure` werden kontrolliert unterstützt;
  unbekannte Regeln sperren die Installation.
- Die Stack-Diagnose prüft Konfigurationsintegrität, vorhandene Container,
  Laufzustand und den gemeinsamen Datenordner.
- Administratoren können die geschützte Stack-Konfiguration und alle von
  Apfel-Hafen verwalteten Stack-Daten gemeinsam sichern. Sicherungen werden
  mit restriktiven Zugriffsrechten in den Anwendungsdaten abgelegt.
- Die neueste Sicherung lässt sich kontrolliert zurückspielen. Der vorherige
  Datenstand bleibt bis zum erfolgreichen Wiederanlauf als Rückfallkopie
  erhalten und wird bei einem Fehler automatisch zurückgesetzt.
- Geheimniswerte werden weiterhin weder in der Stack-Übersicht noch in
  Diagnoseantworten ausgegeben.

## OpenTalk

- Das originale öffentliche `opentalk/ot-setup`-Projekt auf OpenCode wird
  erkannt und mit dem empfohlenen `core`-Profil geladen.
- Ein sichtbarer OpenTalk-Hinweis erklärt die zusätzlichen Voraussetzungen
  für Konfigurationsdateien, Host-Ordner, DNS, TLS und UDP-Freigaben.
- Nicht verlustfrei auf Apple Container abbildbare OpenTalk-Eigenschaften
  bleiben als Sperrgründe sichtbar. Eine unvollständige Installation wird
  nicht angeboten.

## Qualität

- Stack-Manifeste besitzen eine Integritätsprüfung und geschützte
  Dateirechte.
- Die gesamte Backend-, Sicherheits- und Oberflächentestsuite sowie der
  native macOS-Release-Build wurden vor der Veröffentlichung ausgeführt.
