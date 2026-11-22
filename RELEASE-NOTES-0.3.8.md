# Apfel-Hafen 0.3.8

Veröffentlicht am 22. November 2026.

## Arbeitsspeicher-Budget

- Apfel-Hafen verwaltet ein verbindliches Gesamtspeicher-Budget für alle
  laufenden Container und die Builder-VM. Standard sind 60 % des eingebauten
  Arbeitsspeichers, damit macOS und weitere Anwendungen ausreichend Reserve
  behalten; der Wert lässt sich in der Administration anpassen.
- Apples `container`-CLI prüft Anfragen nur pro Container und lässt
  Überbuchungen in der Summe unbemerkt zu. macOS gleicht den Mehrbedarf über
  den Swap aus, was die Leistung deutlich verschlechtert und Container
  abbrechen lässt. Apfel-Hafen rechnet deshalb vor jedem Start nach.
- Geprüft werden alle Startwege: einzelne Container, Neustarts, komplette
  Stacks, Compose-Installationen, die Container-Erstellung mit automatischem
  Start und die Builder-VM.
- Jeder blockierte Start nennt Budget, verpfändeten Speicher, Anfrage und
  Differenz in GB sowie konkrete Handlungsoptionen: nicht benötigte Container
  stoppen, Limits in der Technik-Zentrale senken oder das Budget in der
  Administration erhöhen.
- Verhalten innerhalb des Budgets bleibt unverändert. Es wird kein Container
  gestoppt, verschoben oder in seinem Limit verändert.

## Transparenz in der Technik-Zentrale

- RAM-Budget, verpfändeter und tatsächlich genutzter Speicher werden
  unmittelbar angezeigt, automatisch oder mit eigenem Wert.
- Container, die dauerhaft mehr als 85 % ihres Limits verbrauchen, werden nach
  drei Messreihen in Folge gewarnt, bevor ein OOM-Abbruch droht.
- Überschreitet der verpfändete Speicher das Budget, erscheint in der
  Betriebskonsole ein kritischer Hinweis mit denselben Handlungsoptionen.

## Update-Check für gepinnte Images

- Der Update-Check erkennt neuere Veröffentlichungen jetzt auch bei gepinnten
  Versions-Tags (z. B. `ghcr.io/open-webui/open-webui:v0.13.2` → `v0.13.3`).
  Bisher verglich Apfel-Hafen nur den Digest desselben Tags, der sich bei einer
  neuen Version nie ändert.
- Unterstützt werden ghcr.io und Docker Hub; der Manifest-Digest wird direkt
  aus der Registry gelesen, ohne das neue Image herunterzuladen.
- Auch Digest-gepinnte Images (`image@sha256:…`) werden geprüft, indem der
  Digest des neuesten Versions-Tags verglichen wird.
- Varianten-Suffixe (z. B. `-cuda`) und der Präfix-Stil des aktuellen Tags
  bleiben beim Update erhalten. Beim Ersetzen wird das neue Image
  referenziert; die automatische Wiederherstellung bleibt wie bisher an den
  alten Digest gepinnt.

## Qualitätssicherung

- Neue Unit-Tests decken Budgetberechnung, Builder-VM-Erkennung,
  Verpfändungsrechnung, blockierte Starts mit Meldung, Dauerlast-Warnungen und
  die Empfehlungen der Technik-Zentrale ab.
- Ein Meta-Test sichert, dass jede Startroute — Einzelcontainer, Neustart,
  Stack-Start, Stack-Installation, Erstellung und Builder — weiterhin durch das
  Arbeitsspeicher-Budget geschützt bleibt.
- Neue Gast-Tests laufen ohne Administratorrechte: die Bedienoberfläche gegen
  eine simulierte Antwort (vitest) und die unauthentifizierten
  HTTP-Endpunkte gegen den laufenden Server (node:test).
- Die vollständige Testsuite bleibt grün: 134 node:test- und 21
  vitest-Tests, ohne neue unauthentifizierte Endpunkte.
