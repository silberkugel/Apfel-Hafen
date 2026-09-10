# Apfel-Hafen 0.3.0

Die fünf Ausbaupunkte werden ohne Marketplace im Bereich „Werkzeuge“ ergänzt.

## Neue Funktionen

- Images: lokale Liste mit Digest, Größe und Zielarchitekturen; Pull, Löschen mit Bestätigung, JSON-Inspektion, Tag und Push mit Upload-Bestätigung.
- Protokolle: Live-Folge für Container- und Boot-Logs sowie Systemprotokolle, Text- und Zeitfilter, automatisches Scrollen und Export der gefilterten Ausgabe. Zeitfilter berücksichtigen nur geladene Zeilen mit erkennbarem Zeitstempel.
- Systemdiagnose: CLI-Version, Laufzeitstatus, Speicherbelegung, Ressourcen, Builder- und Registry-Status sowie Start und Stop der Container-Laufzeit.
- Erweiterte Container-Erstellung: Architektur, Rosetta, DNS-Domain, Netzwerk, Arbeitsverzeichnis, Entrypoint, TTY, interaktiver Modus, schreibgeschütztes Root-Dateisystem, Init und SSH.
- Build & Registry: Anmeldung per Token/Passwort, Abmeldung, Builder-Ressourcen, Start/Stop/Löschen, Image-Builds für arm64 und amd64, Dockerfile-Pfad oder integrierter Texteditor. Build-Kontexte werden als absolute lokale Verzeichnisse angegeben.
- Oberfläche: umschaltbarer heller/dunkler Modus sowie laufende und abgeschlossene Image-, Build-, Builder- und Registry-Vorgänge mit Ausgaben und Status.

## Betrieb und Sicherheit

- Neue Verwaltungsfunktionen verlangen eine Administrator-Anmeldung. Zustandsänderungen prüfen den Ursprung der Anfrage.
- Registry-Passwörter werden über die Standardeingabe übergeben, nicht als Prozessargumente. Registry-Ausgaben und Zugangsdaten werden nicht in der Vorgangsliste gespeichert.
- Die letzten 50 Vorgänge werden serverseitig gespeichert; höchstens drei laufen gleichzeitig. Nach einem Serverneustart gelten zuvor laufende Vorgänge als unterbrochen. Vor erneutem Start ist das tatsächliche Ergebnis zu prüfen.
- Ein bewusst gestopptes Container-System wird während dieser Serverlaufzeit nicht automatisch wieder gestartet.
- Logs sind begrenzt; Live-Verbindungen enden nach spätestens zehn Minuten und können erneut gestartet werden.
- CLI-Kompatibilität wurde anhand von Apple Container 1.1.0 geprüft. Rosetta, Netzwerke und Registry-Zugriff benötigen eine entsprechend eingerichtete Laufzeit.

## Prüfung und Auslieferung

- Automatisierte Tests und Produktions-Build werden bei der Paketierung ausgeführt.
- Ein echter Registry-Push und Multiarch-Build wurden nicht gegen Benutzer-Registries ausgeführt. Die Container-Laufzeit war bei der Prüfung nicht erreichbar.
- Lokale ZIP- und DMG-Pakete sind ad-hoc signiert; ohne Developer-ID und Notarisierung sind sie nicht als von Apple bestätigte Distribution anzusehen.
- Kein Marketplace enthalten.
