const exactEnglish = new Map([
  ["Der Autostart-Status konnte nicht gelesen werden.", "The automatic-start status could not be read."],
  ["Der Autostart konnte nicht aktiviert werden.", "Automatic start could not be enabled."],
  ["Der Autostart konnte nicht deaktiviert werden.", "Automatic start could not be disabled."],
  ["Benutzername oder Passwort ist ungültig.", "The username or password is invalid."],
  ["Der lokale Anmeldehelfer fehlt.", "The local authentication helper is missing."],
  ["Benutzername oder Passwort ist nicht korrekt.", "The username or password is incorrect."],
  ["Nur macOS-Administratoren dürfen sich anmelden.", "Only macOS administrators may sign in."],
  ["Apple Container CLI wurde unter /usr/local/bin/container nicht gefunden.", "Apple Container CLI was not found at /usr/local/bin/container."],
  ["Container ist nicht mehr vorhanden.", "The container no longer exists."],
  ["Image-Referenz fehlt.", "The image reference is missing."],
  ["Einstellungen wurden übernommen.", "Settings were applied."],
  ["Einstellungen wurden übernommen und der Container wurde wieder gestartet.", "Settings were applied and the container was started again."],
  ["Image-Referenz oder bisheriger Digest fehlt.", "The image reference or current digest is missing."],
  ["Bitte das Update unmittelbar vor dem Ersetzen erneut prüfen.", "Check for the update again immediately before replacing the container."],
  ["Für diesen Container wurde kein neuer Image-Digest gefunden.", "No new image digest was found for this container."],
  ["Der Container hat sich seit der Update-Prüfung verändert. Bitte erneut prüfen.", "The container changed after the update check. Check again."],
  ["Container wurde mit dem neuen Image neu erstellt.", "The container was recreated with the new image."],
  ["Container wurde neu gestartet.", "The container was restarted."],
  ["Unbekannte Aktion.", "Unknown action."],
  ["Anfrage ist zu groß.", "The request is too large."],
  ["Anmeldung ist nur von der lokalen Oberfläche erlaubt.", "Sign-in is only allowed from the local interface."],
  ["Zu viele Anmeldeversuche. Bitte fünf Minuten warten.", "Too many sign-in attempts. Wait five minutes."],
  ["Abmeldung ist nur von der lokalen Oberfläche erlaubt.", "Sign-out is only allowed from the local interface."],
  ["Bitte als macOS-Administrator anmelden.", "Sign in as a macOS administrator."],
  ["Einstellungen dürfen nur von der lokalen Oberfläche geändert werden.", "Settings may only be changed from the local interface."],
  ["Ungültige Autostart-Einstellung.", "Invalid automatic-start setting."],
  ["Verwaltungsaktionen sind nur von der lokalen Oberfläche erlaubt.", "Administrative actions are only allowed from the local interface."],
  ["Containername stimmt nicht überein.", "The container name does not match."],
  ["Container ist nicht mehr vorhanden. Bitte Liste aktualisieren.", "The container no longer exists. Reload the list."],
  ["Aktion wurde ausgeführt.", "The action was completed."],
  ["Nicht gefunden.", "Not found."],
  ["Frontend läuft im Entwicklungsmodus auf Port 5173.", "The frontend is running in development mode on port 5173."],
  ["Die Containerliste hat ein unerwartetes Format.", "The container list has an unexpected format."],
  ["Der Digest des geladenen Images konnte nicht ermittelt werden.", "The digest of the pulled image could not be determined."],
  ["Container-ID oder Image fehlt in der Sicherung.", "The container ID or image is missing from the backup."],
  ["Zusätzliche Gruppen können noch nicht sicher rekonstruiert werden.", "Supplemental groups cannot yet be reconstructed safely."],
  ["Sysctl-Einstellungen können noch nicht sicher rekonstruiert werden.", "Sysctl settings cannot yet be reconstructed safely."],
  ["Eine Mount-Konfiguration ist unvollständig.", "A mount configuration is incomplete."],
  ["CPU-Anzahl muss eine ganze Zahl sein.", "CPU count must be a whole number."],
]);

export function requestLanguage(value) {
  return String(value || "").toLowerCase().startsWith("en") ? "en" : "de";
}

export function localizeServerMessage(message, language) {
  const source = String(message || "");
  if (requestLanguage(language) !== "en") return source;
  if (exactEnglish.has(source)) return exactEnglish.get(source);

  const replacements = [
    [/^Änderung wurde vor dem Löschen abgebrochen: (.+)$/s, (match) => `The change was aborted before deletion: ${localizeServerMessage(match[1], "en")}`],
    [/^Die Änderung ist fehlgeschlagen; der vorherige Container wurde automatisch wiederhergestellt\. Ursache: (.+)$/s, (match) => `The change failed; the previous container was restored automatically. Cause: ${localizeServerMessage(match[1], "en")}`],
    [/^Änderung und automatische Wiederherstellung sind fehlgeschlagen\. Die Sicherung liegt unter (.+)\. Ursache: (.+)$/s, (match) => `The change and automatic recovery failed. The backup is located at ${match[1]}. Cause: ${localizeServerMessage(match[2], "en")}`],
    [/^Sicherheitsprüfung fehlgeschlagen; der vorhandene Container wurde nicht verändert\. Ursache: (.+)$/s, (match) => `Safety check failed; the existing container was not changed. Cause: ${localizeServerMessage(match[1], "en")}`],
    [/^Ersetzen wurde vor dem Löschen abgebrochen: (.+)$/s, (match) => `Replacement was aborted before deletion: ${localizeServerMessage(match[1], "en")}`],
    [/^Das Update ist fehlgeschlagen; der vorherige Container wurde automatisch wiederhergestellt\. Ursache: (.+)$/s, (match) => `The update failed; the previous container was restored automatically. Cause: ${localizeServerMessage(match[1], "en")}`],
    [/^Update und automatische Wiederherstellung sind fehlgeschlagen\. Die Sicherung liegt unter (.+)\. Ursache: (.+)$/s, (match) => `The update and automatic recovery failed. The backup is located at ${match[1]}. Cause: ${localizeServerMessage(match[2], "en")}`],
  ];
  for (const [pattern, build] of replacements) {
    const match = source.match(pattern);
    if (match) return build(match);
  }
  return source
    .replace(" Prüfe mit „container system status“, ob der Apple-Containerdienst für diesen Benutzer läuft.", " Check with “container system status” whether Apple Container service is running for this user.");
}
