# Containerzentrale

[English version](README.md)

Die **Containerzentrale** ist eine lokale Weboberfläche zur Verwaltung von
Apple-Containern unter macOS 26. Sie zeigt vorhandene Container an und kann sie
starten, stoppen, neu starten sowie auf aktualisierte Images prüfen.

Die Oberfläche ist ausschließlich auf dem Mac unter
`http://127.0.0.1:4173` erreichbar. Änderungen an Containern erfordern die
Anmeldung eines lokalen macOS-Administrators. Das Passwort wird über PAM
geprüft und nicht gespeichert.

## Sprachen

Die Oberfläche unterstützt Deutsch und Englisch. Beim ersten Start wird die
Browsersprache verwendet. Die Auswahl DE/EN in der Kopfzeile wird lokal im
Browser gespeichert.

## Voraussetzungen

- macOS 26 auf einem Apple-Silicon-Mac
- Apples `container`-CLI unter `/usr/local/bin/container`
- Node.js 20 oder neuer
- `pnpm`
- Xcode Command Line Tools zum Kompilieren des PAM-Hilfsprogramms

Prüfen Sie zunächst, ob der Apple-Containerdienst läuft:

```console
container system status
```

Falls der Dienst noch nicht läuft:

```console
container system start
```

## Installation

1. Repository laden und in den Projektordner wechseln:

   ```console
   git clone git@github.com:silberkugel/Apfel-Hafen.git
   cd Apfel-Hafen
   ```

2. JavaScript-Abhängigkeiten installieren:

   ```console
   pnpm install
   ```

3. Den lokalen PAM-Anmeldehelfer kompilieren:

   ```console
   cc auth/pam-auth.c -o auth/pam-auth -lpam
   ```

4. Die Weboberfläche bauen:

   ```console
   pnpm build
   ```

Das erzeugte PAM-Programm, die installierten Abhängigkeiten und die fertigen
Webdateien bleiben lokal und werden nicht in Git eingecheckt.

## Starten und Beenden

Zum Starten `Start Container Center.command` im Finder doppelklicken. Der
lokale Dienst startet und öffnet die Oberfläche automatisch im Browser. Das
Terminalfenster muss während des Betriebs geöffnet bleiben.

Alternativ kann die Anwendung im Projektordner gestartet werden:

```console
pnpm start
```

Anschließend ist sie unter <http://127.0.0.1:4173> erreichbar.

Zum Beenden entweder das beim Start geöffnete Terminalfenster schließen oder
`Stop Container Center.command` doppelklicken. Die Anwendung darf nicht
mit `sudo` gestartet werden, weil Apples Containerdienst zum angemeldeten
Benutzer gehört.

### Optionaler Autostart

Unter `launchd/de.containerzentrale.service.plist.example` liegt eine Vorlage
für einen LaunchAgent. Vor der Verwendung müssen darin `__PROJECT_DIR__` und
`__HOME__` durch die absoluten lokalen Pfade ersetzt werden. Die angepasste
Datei wird anschließend als
`~/Library/LaunchAgents/de.containerzentrale.service.plist` installiert.

## Handhabung

Die Startseite zeigt alle Apple-Container mit Namen, Image und aktuellem
Status. Statusinformationen können ohne Anmeldung angesehen werden.

Für schreibende Aktionen melden Sie sich mit einem lokalen
macOS-Administratorkonto an. Danach stehen folgende Funktionen bereit:

- Container starten, stoppen und neu starten
- nach einer neueren Version des verwendeten Images suchen
- Container kontrolliert mit dem aktuellen Image ersetzen
- Autostartstatus des installierten LaunchAgents ändern

Vor dem Ersetzen eines Containers legt die Containerzentrale unter
`backups/<Containername>/` eine Sicherung seiner Konfiguration an und prüft die
neue Konfiguration zunächst mit einem Probe-Container. Eingebundene
Host-Verzeichnisse bleiben erhalten. Daten, die ausschließlich im
beschreibbaren Root-Dateisystem des Containers liegen, können beim Ersetzen
verloren gehen.

## Deinstallation

1. Containerzentrale mit `Stop Container Center.command` beenden.
2. Falls der Autostart eingerichtet wurde, den LaunchAgent entladen:

   ```console
   launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/de.containerzentrale.service.plist"
   ```

3. Die Datei `de.containerzentrale.service.plist` aus
   `~/Library/LaunchAgents` entfernen.
4. Benötigte Konfigurationssicherungen aus dem Ordner `backups` an einen
   sicheren Ort kopieren.
5. Den Projektordner im Finder in den Papierkorb verschieben.
6. Optional den Protokollordner
   `~/Library/Logs/Containerzentrale` entfernen.

Die Deinstallation der Containerzentrale entfernt **keine** Apple-Container,
Images, Volumes oder eingebundenen Host-Daten. Diese werden bei Bedarf separat
mit Apples `container`-CLI verwaltet.

## Quellen

- [apple/container](https://github.com/apple/container)

## Lizenz

Dieses Projekt steht unter der [GNU General Public License Version 3](LICENSE).
