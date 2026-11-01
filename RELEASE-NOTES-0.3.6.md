# Apfel-Hafen 0.3.6 (in Entwicklung)

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
