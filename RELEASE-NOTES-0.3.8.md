# Apfel-Hafen 0.3.8 (in Entwicklung)

Version 0.3.8 baut auf der veröffentlichten Version 0.3.7 auf.
Dieses Dokument wird während der Entwicklung mit den freigaberelevanten
Änderungen ergänzt.

## Änderungen

- Der Update-Check erkennt neuere Veröffentlichungen auch bei gepinnten Versions-Tags (z. B. `ghcr.io/open-webui/open-webui:v0.13.2` → `v0.13.3`). Bisher verglich Apfel-Hafen nur den Digest desselben Tags, der sich bei einer neuen Version nie ändert.
- Unterstützt werden ghcr.io und Docker Hub; der Manifest-Digest wird direkt aus der Registry gelesen, ohne das neue Image herunterzuladen. Varianten-Suffixe (z. B. `-cuda`) und der Präfix-Stil des aktuellen Tags bleiben beim Update erhalten.
- Auch Digest-gepinnte Images (`image@sha256:…`) werden geprüft, indem der Digest des neuesten Versions-Tags verglichen wird.
- Beim Ersetzen wird das neue Image referenziert; die automatische Wiederherstellung bleibt wie bisher an den alten Digest gepinnt.
