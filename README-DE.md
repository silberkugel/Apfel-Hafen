# Apfel-Hafen

[English version](README.md)

**Apfel-Hafen** ist eine lokale Weboberfläche zur Verwaltung von
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

### Fertige Auslieferung

Das Release-Archiv `Apfel-Hafen-0.2.0-macos-arm64.zip` enthält die benötigte
Node.js-Laufzeit, das kompilierte PAM-Hilfsprogramm und die gebaute
Weboberfläche. Es enthält keine Apple-Container, Images, Volumes oder
Anwendungsdaten. Archiv entpacken und `Start-Apfel-Hafen.command` starten.

Node.js, pnpm und die Xcode Command Line Tools werden nur benötigt, wenn die
Auslieferung selbst aus dem Quellcode neu gebaut werden soll.

### Aus dem Quellcode

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

Mit `pnpm release` wird nach Tests und Build ein vollständiges Release-Archiv
unter `out/` erzeugt. Die variable Apple-Container-Konfiguration ist kein Teil
dieses Archivs.

## Starten und Beenden

Zum Starten `Start-Apfel-Hafen.command` im Finder doppelklicken. Der
lokale Dienst startet und öffnet die Oberfläche automatisch im Browser. Das
Terminalfenster muss während des Betriebs geöffnet bleiben.

Alternativ kann die Anwendung im Projektordner gestartet werden:

```console
pnpm start
```

Anschließend ist sie unter <http://127.0.0.1:4173> erreichbar.

Zum Beenden entweder das beim Start geöffnete Terminalfenster schließen oder
`Stop-Apfel-Hafen.command` doppelklicken. Die Anwendung darf nicht
mit `sudo` gestartet werden, weil Apples Containerdienst zum angemeldeten
Benutzer gehört.

### Optionaler Autostart

Nach der Administratoranmeldung kann der Autostart unter **Administration**
ein- oder ausgeschaltet werden. Beim Einschalten installiert beziehungsweise
aktualisiert Apfel-Hafen den LaunchAgent automatisch für den aktuellen
Installationsordner. Die Anzeige unterscheidet zwischen dem Autostart für die
nächste Anmeldung und dem momentan laufenden Dienst. Eine aktualisierte
Konfiguration eines bereits laufenden Dienstes gilt ab der nächsten Anmeldung.

## Handhabung

Die Startseite zeigt alle Apple-Container mit Namen, Image und aktuellem
Status. Statusinformationen können ohne Anmeldung angesehen werden.

Für schreibende Aktionen melden Sie sich mit einem lokalen
macOS-Administratorkonto an. Danach stehen folgende Funktionen bereit:

- Container starten, stoppen und neu starten
- nach einer neueren Version des verwendeten Images suchen
- Container kontrolliert mit dem aktuellen Image ersetzen
- LaunchAgent installieren oder aktualisieren und den Autostart ändern

Vor dem Ersetzen eines Containers legt Apfel-Hafen unter
`backups/<Containername>/` eine Sicherung seiner Konfiguration an und prüft die
neue Konfiguration zunächst mit einem Probe-Container. Eingebundene
Host-Verzeichnisse bleiben erhalten. Daten, die ausschließlich im
beschreibbaren Root-Dateisystem des Containers liegen, können beim Ersetzen
verloren gehen.

## Deinstallation

1. Apfel-Hafen mit `Stop-Apfel-Hafen.command` beenden.
2. Falls der Autostart eingerichtet wurde, den LaunchAgent entladen:

   ```console
   launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/de.apfel-hafen.service.plist"
   ```

3. Die Datei `de.apfel-hafen.service.plist` aus
   `~/Library/LaunchAgents` entfernen.
4. Benötigte Konfigurationssicherungen aus dem Ordner `backups` an einen
   sicheren Ort kopieren.
5. Den Projektordner im Finder in den Papierkorb verschieben.
6. Optional den Protokollordner
   `~/Library/Logs/Apfel-Hafen` entfernen.

Die Deinstallation von Apfel-Hafen entfernt **keine** Apple-Container,
Images, Volumes oder eingebundenen Host-Daten. Diese werden bei Bedarf separat
mit Apples `container`-CLI verwaltet.

## Quellen

- [apple/container](https://github.com/apple/container)

## Lizenz

Dieses Projekt steht unter der [GNU General Public License Version 3](LICENSE).
