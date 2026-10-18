# Apfel-Hafen 0.3.3 (in Entwicklung)

Version 0.3.3 legt die Grundlage für einen sicheren und verständlichen Umgang
mit Docker-Compose-Mehrcontainerprojekten. Der erste Schritt ist eine
transparente Analyse vor der späteren Ausführung als gemeinsamer Stack.

## Compose-Analyse

- Neuer Compose-Reiter zum Einlesen oder Einfügen von `compose.yaml`,
  `compose.yml`, `docker-compose.yaml` und `docker-compose.yml`.
- Dienste, Images, Builds, Ports, Netzwerke, Volumes, Abhängigkeiten,
  Healthchecks und Neustartregeln werden gemeinsam dargestellt.
- Optionale `.env`-Dateien und ausgewählte Compose-Profile werden bei der
  Auswertung berücksichtigt.
- Sensible Variablen werden erkannt und ihre Werte weder in den Analysebericht
  noch in Fehlermeldungen übernommen.
- Eine ermittelte Startreihenfolge macht Dienstabhängigkeiten nachvollziehbar;
  unbekannte Abhängigkeiten und Zyklen werden gemeldet.
- Ein Kompatibilitätsbericht warnt unter anderem vor Image-Builds,
  privilegiertem Betrieb, Host-Netzwerk und Host-Namensräumen, Gerätezugriffen,
  zusätzlichen Sicherheitsrechten sowie noch nicht unterstützten Compose-
  Secrets und Configs.
- Die Analyse ist vollständig lesend und verändert weder vorhandene noch neue
  Container.

## Abgrenzung zur nächsten Version

0.3.3 analysiert und bewertet Compose-Projekte. Das gemeinsame Starten,
Stoppen und Aktualisieren eines geprüften Stacks folgt in 0.3.4. Dadurch werden
unsichere oder nicht verlustfrei übersetzbare Einstellungen nicht voreilig auf
Apple Container angewendet.

Der genaue Umfang wird während der Entwicklung ergänzt. Fertige Funktionen
werden erst beim Abschluss von 0.3.3 als veröffentlicht gekennzeichnet.
