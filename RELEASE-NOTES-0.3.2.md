# Apfel-Hafen 0.3.2 (in Entwicklung)

Version 0.3.2 baut auf der veröffentlichten Technik-Zentrale aus 0.3.1 auf.
Dieses Dokument wird während der Entwicklung mit den freigaberelevanten
Änderungen ergänzt.

## Änderungen

- Entwicklungszweig und Versionsmetadaten für 0.3.2 angelegt.
- OpenCode als zweite öffentliche Image-Quelle neben Docker Hub eingebunden.
- OpenCode-Projektsuche unterstützt Suchbegriffe, Projektpfade und vollständige
  URLs von `gitlab.opencode.de`.
- Die Image-Auswahl zeigt verfügbare Versionen und Veröffentlichungsdaten.
- Versionierte Mehrcontainer-Setups wie `opentalk/ot-setup` werden sicher
  aufgelöst: Apfel-Hafen bietet die darin referenzierten Images aus
  `registry.opencode.de` an, behandelt das Compose-Projekt aber nicht als
  einzelnes OCI-Image.
