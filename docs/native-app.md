# Native Apfel-Hafen-App

Die native macOS-App ist die Installations- und Verwaltungsoberfläche für den
Hintergrunddienst. Die eigentliche Benutzeroberfläche bleibt im normalen
Standardbrowser; die App enthält keine `WKWebView`.

## Aufbau

- `Apfel-Hafen.app/Contents/MacOS/ApfelHafen`: SwiftUI-Verwaltungs-App
- `Apfel-Hafen.app/Contents/MacOS/ApfelHafenService`: eingebetteter Helper
- `Contents/Library/LaunchAgents/de.apfel-hafen.service.plist`: Registrierung
  über `SMAppService`
- `Contents/Resources/Server`: Node.js-Laufzeit, Server, Weboberfläche und
  PAM-Helfer

Der Helper ersetzt sich beim Start durch die eingebettete Node.js-Laufzeit. Der
Agent läuft unabhängig vom App-Fenster weiter und wird von macOS in
**Systemeinstellungen > Allgemein > Anmeldeobjekte & Erweiterungen** angezeigt.

## Laufzeitdaten

Veränderliche Daten liegen nicht im signierten App-Bundle:

```text
~/Library/Application Support/Apfel-Hafen/
├── settings.json
├── tls/
└── backups/
```

Protokolle liegen unter `~/Library/Logs/Apfel-Hafen/`. Beim Wechsel von einer
älteren ZIP-Installation übernimmt die App vorhandene Einstellungen,
Zertifikate und Backups, bevor sie den alten LaunchAgent entfernt.

## Lokaler Build

```console
pnpm app
```

Das erzeugt `app-out/Apfel-Hafen.app` mit einer lokalen Ad-hoc-Signatur. Der
Codex-Run-Einstieg ist `script/build_and_run.sh`.

## DMG

```console
pnpm dmg
```

Das DMG enthält die App und eine Verknüpfung zum Programme-Ordner. Für eine
öffentliche Auslieferung muss eine Developer-ID-Signatur verwendet werden:

```console
APFEL_HAFEN_SIGNING_IDENTITY="Developer ID Application: …" pnpm dmg
```

Wenn ein `notarytool`-Profil im Schlüsselbund eingerichtet ist, kann die
Notarisierung im selben Lauf erfolgen:

```console
APFEL_HAFEN_SIGNING_IDENTITY="Developer ID Application: …" \
APFEL_HAFEN_NOTARY_PROFILE="apfel-hafen-notary" \
pnpm dmg
```
