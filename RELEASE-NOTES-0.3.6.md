# Apfel-Hafen 0.3.6

Veröffentlicht am 2. November 2026.

## Speicherorte

- Der globale Pfad für Konfigurations- und Stack-Sicherungen lässt sich
  unabhängig vom Container-Volume-Pfad einstellen.
- Neue Sicherungen können auf einer dauerhaft verbundenen externen Festplatte
  abgelegt werden.
- Eine Zielmarkierung verhindert, dass Apfel-Hafen bei einem fehlenden
  externen Laufwerk unbemerkt auf der internen SSD weiterschreibt.
- Bereits vorhandene Sicherungen bleiben beim Wechsel des Pfades unverändert
  am bisherigen Ort.

## Technik-Zentrale

- Der Speicherverbrauch von Apple-Container-Snapshots sowie Images und
  Inhalten wird getrennt ausgewiesen.
- Der von Apple Container verwaltete Datenstamm wird transparent angezeigt.
- Die Oberfläche erklärt, weshalb eine externe Verlagerung dieses internen
  Datenstamms derzeit nicht angeboten wird.
- Die vorhandenen geschützten Bereinigungsaktionen stehen direkt neben den
  Speicherwerten bereit.

## Sicherheit

- Vor jeder Sicherung wird geprüft, ob das konfigurierte Ziel vorhanden und
  als Apfel-Hafen-Sicherungsziel erkennbar ist.
- Ein nicht eingehängtes externes Laufwerk führt zu einer verständlichen
  Fehlermeldung statt zu einem unerwarteten lokalen Ersatzordner.

## Sicherheits-Härtung

- Stack-Manifeste werden vor Start, Stopp, Wiederanlauf und
  Wiederherstellung gegen ihre Prüfsumme geprüft. Eine außerhalb von
  Apfel-Hafen veränderte Konfiguration wird angezeigt und kann keine
  Containeraktionen mehr steuern.
- Jede Antwort trägt Sicherheits-Header (Content-Security-Policy mit
  striktem script-src, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy); bei eigenem Zertifikat zusätzlich HSTS.
- Nicht angemeldete Anfragen erhalten nur noch eine redigierte Übersicht
  von Containern und LaunchD-Diensten. Image-Referenzen, Host-Pfade,
  Ports und PIDs bleiben der angemeldeten Oberfläche vorbehalten.
- Die Anmelde-Ratebegrenzung zählt nur fehlgeschlagene Versuche pro
  Adresse und Konto und wird bei erfolgreicher Anmeldung zurückgesetzt.
  Ein gültiges Nicht-Admin-Konto erhält dieselbe Fehlermeldung wie ein
  unbekanntes Konto.
- Image-Referenzen und Host-Adressen, die als CLI-Optionen oder als
  fehlerhafte --publish-Werte interpretiert werden könnten, werden
  abgelehnt.
- Der statische Dateihandler stürzt nicht mehr bei Anfragen auf
  Verzeichnisse ab.
