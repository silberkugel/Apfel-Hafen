# Apfel-Hafen 0.3.2

Version 0.3.2 erweitert die Image-Auswahl um OpenCode als zweite öffentliche
Quelle neben Docker Hub. Damit lassen sich Originalprojekte und Images aus der
OpenCode-Infrastruktur direkt in Apfel-Hafen finden.

## OpenCode und Image-Auswahl

- OpenCode als zweite öffentliche Image-Quelle neben Docker Hub eingebunden.
- OpenCode-Projektsuche unterstützt Suchbegriffe, Projektpfade und vollständige
  URLs von `gitlab.opencode.de`.
- Die Image-Auswahl zeigt Image-Referenz, Version und Veröffentlichungsdatum,
  sofern die jeweilige Quelle diese Angaben bereitstellt.
- Auch Docker-Hub-Tags werden um ihr Veröffentlichungsdatum ergänzt, wenn die
  öffentliche Docker-Hub-API diese Information liefert.
- Versionierte Mehrcontainer-Setups wie `opentalk/ot-setup` werden sicher
  aufgelöst: Apfel-Hafen bietet die darin referenzierten Images aus
  `registry.opencode.de` an, behandelt das Compose-Projekt aber nicht als
  einzelnes OCI-Image.
- Doppelte Image-Treffer werden zusammengeführt; Release-Daten von Images und
  Setup-Projekten werden nicht miteinander vermischt.

## Sicherheit und Kompatibilität

- OpenCode-Projekt-URLs werden ausschließlich für `gitlab.opencode.de`
  akzeptiert. Externe Hosts werden nicht über die Serversuche abgerufen.
- Netzwerkabfragen verwenden feste Zeitlimits und einen kurzlebigen Cache.
- Die OpenCode-Integration benötigt für öffentliche Projekte und Images keinen
  persönlichen Zugangstoken.
- Eine vollständige Compose-Orchestrierung ist nicht Bestandteil von 0.3.2.
  Mehrcontainerprojekte werden nur zur Ermittlung echter OCI-Images gelesen.

## Dokumentation und Qualität

- Die deutsch- und englischsprachige Dokumentation beschreibt die neue Quelle
  und den sicheren Umgang mit Compose-Projekten.
- Frühere Release-Notes von 0.2.2 bis 0.2.9 wurden vollständig in einem
  gemeinsamen Archiv zusammengeführt.
- Automatisierte Tests decken URL-Prüfung, stabile Versionsauswahl,
  Compose-Image-Erkennung sowie Versions- und Datumsmetadaten ab.
