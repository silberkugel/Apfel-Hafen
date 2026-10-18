# Apfel-Hafen 0.3.3

Veröffentlicht am 18. Oktober 2026.

Version 0.3.3 legt die Grundlage für einen sicheren und verständlichen Umgang
mit Docker-Compose-Mehrcontainerprojekten. Der erste Schritt ist eine
transparente Analyse vor der späteren Ausführung als gemeinsamer Stack.

## Compose-Analyse

- Neuer Compose-Reiter zum Einlesen oder Einfügen von `compose.yaml`,
  `compose.yml`, `docker-compose.yaml` und `docker-compose.yml`.
- Ein lokaler Projektordner kann gemeinsam ausgewählt werden; Apfel-Hafen sucht
  darin die Compose-Datei und die zugehörige `.env`-Datei.
- Öffentliche OpenCode-Projekte können über ihre vollständige Adresse oder den
  Projektpfad geladen werden. Verwendet wird der jüngste stabile Tag oder
  ersatzweise der Standardzweig; eine vorhandene `.env.example` wird als
  Vorlage berücksichtigt.
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
- Noch nicht ausdrücklich ausgewertete Projekt- oder Diensteigenschaften werden
  einzeln im Bericht aufgeführt. Dadurch kann eine spätere Ausführung keine
  Compose-Einstellung unbemerkt verwerfen.
- Befunde deaktivierter Profile bleiben als Hinweise sichtbar, blockieren aber
  nicht das ausgewählte Profil. Benötigt ein aktiver Dienst einen deaktivierten
  Dienst, wird dies dagegen als Fehler gemeldet.
- Der OpenTalk-Praxistest berücksichtigt die im Projekt verwendete
  `env.sample` und weist für das Profil `core` derzeit gezielt auf das von
  `livekit` benötigte Host-Netzwerk hin.
- Die Analyse ist vollständig lesend und verändert weder vorhandene noch neue
  Container.

## Abgrenzung zur nächsten Version

0.3.3 analysiert und bewertet Compose-Projekte. Das gemeinsame Starten,
Stoppen und Aktualisieren eines geprüften Stacks folgt in 0.3.4. Dadurch werden
unsichere oder nicht verlustfrei übersetzbare Einstellungen nicht voreilig auf
Apple Container angewendet.
