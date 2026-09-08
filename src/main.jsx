import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import LaunchdScheduleOptions, { emptyLaunchdDraft, launchdDraftFromService, launchdDraftIsValid, launchdDraftPayload } from "./LaunchdScheduleOptions.jsx";
import "./styles.css";

const translations = {
  de: {
    appName: "Apfel-Hafen", local: "Nur auf diesem Mac", login: "Anmelden", logout: "Abmelden", administration: "Administration", create: "Container erstellen", username: "Benutzername", password: "Passwort",
    headline: "Alle Container", headlineAlmost: "Einige Container", headlineNone: "Keine Container", headlineEm: "auf ruhiger See.", intro: "Container erstellen, verwalten, aktualisieren und sicher löschen.",
    total: "Gesamt", active: "Aktiv", inactive: "Inaktiv / unbekannt", search: "Container suchen", reload: "Neu laden", loading: "Lädt …",
    containers: "Container", services: "Dienste", launchd: "LaunchD", serviceCenter: "Dienstzentrale", running: "Läuft", stopped: "Gestoppt", loaded: "Geladen", unloaded: "Nicht geladen", info: "Info", start: "Starten", stop: "Stoppen", restart: "Neustart", serviceSearch: "LaunchD-Dienste suchen", serviceIntro: "Container und macOS-Dienste an einem Ort beobachten und verwalten.", noServiceMatches: "Keine passenden LaunchD-Dienste gefunden.", userScope: "Benutzer", systemScope: "System", readOnly: "Nur lesen", launchdInfo: "LaunchD-Informationen", configuration: "Konfiguration", schedule: "Startverhalten", logs: "Protokolle", manualOnly: "Systemweite Dienste werden in dieser Testversion nur angezeigt.",
    check: "Update prüfen", replace: "Container ersetzen", update: "Update verfügbar", noMatches: "Keine passenden Container gefunden.", delete: "Löschen", settings: "Einstellungen", console: "Konsole öffnen", containerLogsLabel: "Startprotokoll anzeigen", bootLog: "Bootprotokoll", containerOutput: "Container-Ausgaben (letzte 200 Zeilen)", noLogOutput: "Keine Protokollausgabe vorhanden.", moreActions: "Weitere Aktionen",
    editTitle: "Container-Einstellungen ändern", editIntro: "Apfel-Hafen erstellt den Container mit den geänderten Einstellungen kontrolliert neu. Das Image und der Containername bleiben erhalten.", runningChangeWarning: "Dieser Container läuft. Zum Übernehmen wird er nach einer Sicherheitsprüfung kurz gestoppt, neu erstellt und anschließend automatisch wieder gestartet.", stoppedChangeInfo: "Dieser Container ist gestoppt und bleibt nach der Änderung gestoppt.", editConfiguration: "Konfiguration bearbeiten", reviewChanges: "Änderungen prüfen", applyChanges: "Änderungen anwenden", stopAndApply: "Stoppen und Änderungen anwenden", acknowledgeDowntime: "Ich habe verstanden, dass der laufende Container kurzzeitig nicht erreichbar ist.", safetyNote: "Vor der Änderung wird eine Sicherung erstellt. Falls der Neuaufbau fehlschlägt, stellt Apfel-Hafen die bisherige Konfiguration automatisch wieder her.", sourcePath: "Host-Pfad", editing: "Einstellungen werden geladen …",
    close: "Schließen", cancel: "Abbrechen", back: "Zurück", next: "Weiter", save: "Speichern", saving: "Speichert …", saved: "Einstellungen wurden gespeichert.", savedShort: "Gespeichert", add: "Hinzufügen", remove: "Entfernen", selectFolder: "Auswählen …",
    systemSettings: "Systemeinstellungen", settingsIntro: "Hier werden die Einstellungen von Apfel-Hafen verwaltet.", autostart: "Automatisch starten",
    autostartHelp: "Apfel-Hafen nach der macOS-Anmeldung automatisch starten.", autostartEnabled: "Autostart ist aktiviert", autostartDisabled: "Autostart ist deaktiviert", autostartServiceRunning: "Autostart-Dienst ist aktuell geladen", autostartServiceStopped: "Autostart-Dienst ist aktuell nicht geladen", autostartUpdatePending: "Die neue Konfiguration gilt ab der nächsten Anmeldung.", managedByApp: "Der Hintergrunddienst wird von der Apfel-Hafen-App verwaltet.", volumeBase: "Globaler Pfad für Container-Volumes",
    accessMode: "Zugriff auf die Benutzeroberfläche", accessHelp: "Festlegen, ob Apfel-Hafen nur auf diesem Mac oder zusätzlich im lokalen Netzwerk erreichbar ist.", localAccess: "Nur lokal", localAddress: "127.0.0.1 · nur dieser Mac", networkAccess: "Im Netzwerk", networkAddress: "0.0.0.0 · alle Netzwerkschnittstellen", networkWarning: "Der Netzwerkzugriff ist durch HTTPS geschützt. Damit keine Browserwarnung erscheint, müssen die Geräte dem aktiven Zertifikat vertrauen.",
    certificate: "Serverzertifikat", certificateHelp: "Apfel-Hafen verwendet automatisch ein selbst generiertes Zertifikat. Optional können ein eigenes PEM-Zertifikat und der zugehörige private Schlüssel aktiviert werden.", automaticCertificate: "Automatisch erzeugtes Zertifikat", customCertificate: "Eigenes Zertifikat", certificateFile: "Zertifikat auswählen", privateKeyFile: "Privaten Schlüssel auswählen", activateCertificate: "Zertifikat aktivieren", removeCertificate: "Eigenes Zertifikat löschen", certificateActive: "Aktiv", validUntil: "Gültig bis", certificateNames: "Namen", certificateFingerprint: "SHA-256-Fingerabdruck", certificateMissing: "Bitte Zertifikat und privaten Schlüssel auswählen.", certificateTooLarge: "Die Zertifikatsdatei ist zu groß.", certificateUpdated: "Das eigene Zertifikat ist jetzt aktiv.", certificateRemoved: "Das automatisch erzeugte Zertifikat ist jetzt aktiv.",
    volumeHelp: "Neue Volume-Unterordner werden ausschließlich innerhalb dieses Basisordners angelegt.", createTitle: "Neuen Container erstellen",
    general: "Allgemein", networkStorage: "Netzwerk & Speicher", variablesReview: "Variablen & Prüfung", name: "Containername", image: "Image", resources: "Ressourcen", cpuHelp: "Anzahl der verfügbaren CPU-Kerne.", memoryMb: "Arbeitsspeicher (MB)", memoryHelp: "Maximaler Arbeitsspeicher in Megabyte.",
    imageHelp: "Suchbegriff oder vollständige Registry-Referenz eingeben.", searchImages: "Images suchen", searchingImages: "Images werden gesucht …", noImageResults: "Keine öffentlichen Images gefunden. Die Eingabe kann trotzdem verwendet werden.", official: "Offiziell", localImage: "Lokal", directReference: "Direkte Image-Referenz", startAfter: "Nach dem Erstellen starten", startArguments: "Startargumente", startArgumentsHelp: "Ein Argument pro Zeile. Leer lassen, um den Standardbefehl des Images zu verwenden.",
    externalPort: "Externer Port", containerPort: "Container-Port", protocol: "Protokoll", ports: "Portfreigaben", volumes: "Volumes", suggestionHelp: "Vorschläge wurden anhand des Images erzeugt und können frei angepasst oder entfernt werden.",
    subpath: "Unterordner", destination: "Pfad im Container", readOnly: "Nur lesen", volumeHostPath: "Host-Pfad", variables: "Umgebungsvariablen", key: "Name", value: "Wert",
    secret: "Vertraulich", summary: "Zusammenfassung", deleteTitle: "Container endgültig löschen", typeName: "Zur Bestätigung den Containernamen eingeben",
    deleteVolumes: "Zugehörige Volume-Daten im globalen Pfad ebenfalls löschen", deleteWarning: "Diese Aktion kann nicht rückgängig gemacht werden.",
    adminRequired: "Administrator-Anmeldung erforderlich", confirmAction: "Aktion bestätigen", language: "Sprache", help: "Erste Schritte", noVolumes: "Keine Volumes eingebunden.",
    noPorts: "Keine Ports veröffentlicht.", cpu: "CPU-Kerne", memory: "Arbeitsspeicher", containerInfo: "Container-Informationen",
  },
  en: {
    appName: "Apfel-Hafen", local: "Only on this Mac", login: "Sign in", logout: "Sign out", administration: "Administration", create: "Create container", username: "Username", password: "Password",
    headline: "All containers", headlineAlmost: "Some containers", headlineNone: "No containers", headlineEm: "on calm seas.", intro: "Create, manage, update and safely delete containers.",
    total: "Total", active: "Active", inactive: "Inactive / unknown", search: "Search containers", reload: "Reload", loading: "Loading …",
    containers: "Containers", services: "Services", launchd: "LaunchD", serviceCenter: "Service center", running: "Running", stopped: "Stopped", loaded: "Loaded", unloaded: "Not loaded", info: "Info", start: "Start", stop: "Stop", restart: "Restart", serviceSearch: "Search LaunchD services", serviceIntro: "Observe and manage containers and macOS services in one place.", noServiceMatches: "No matching LaunchD services found.", userScope: "User", systemScope: "System", readOnly: "Read only", launchdInfo: "LaunchD information", configuration: "Configuration", schedule: "Start behavior", logs: "Logs", manualOnly: "System-wide services are shown read-only in this test version.",
    check: "Check update", replace: "Replace container", update: "Update available", noMatches: "No matching containers found.", delete: "Delete", settings: "Settings", console: "Open console", containerLogsLabel: "Show startup log", bootLog: "Boot log", containerOutput: "Container output (last 200 lines)", noLogOutput: "No log output is available.", moreActions: "More actions",
    editTitle: "Change container settings", editIntro: "Apfel-Hafen safely recreates the container with the changed settings. Its image and name remain unchanged.", runningChangeWarning: "This container is running. After a safety check, it will be stopped briefly, recreated, and started again automatically.", stoppedChangeInfo: "This container is stopped and will remain stopped after the change.", editConfiguration: "Edit configuration", reviewChanges: "Review changes", applyChanges: "Apply changes", stopAndApply: "Stop and apply changes", acknowledgeDowntime: "I understand that the running container will be briefly unavailable.", safetyNote: "A backup is created before the change. If recreation fails, Apfel-Hafen automatically restores the previous configuration.", sourcePath: "Host path", editing: "Loading settings …",
    close: "Close", cancel: "Cancel", back: "Back", next: "Next", save: "Save", saving: "Saving …", saved: "Settings have been saved.", savedShort: "Saved", add: "Add", remove: "Remove", selectFolder: "Choose …",
    systemSettings: "System settings", settingsIntro: "Manage Apfel-Hafen settings here.", autostart: "Start automatically",
    autostartHelp: "Start Apfel-Hafen automatically after signing in to macOS.", autostartEnabled: "Automatic start is enabled", autostartDisabled: "Automatic start is disabled", autostartServiceRunning: "Automatic-start service is currently loaded", autostartServiceStopped: "Automatic-start service is not currently loaded", autostartUpdatePending: "The new configuration takes effect after the next sign-in.", managedByApp: "The background service is managed by the Apfel-Hafen app.", volumeBase: "Global container volume path",
    accessMode: "User interface access", accessHelp: "Choose whether Apfel-Hafen is available only on this Mac or also on the local network.", localAccess: "Local only", localAddress: "127.0.0.1 · this Mac only", networkAccess: "On the network", networkAddress: "0.0.0.0 · all network interfaces", networkWarning: "Network access is protected by HTTPS. Devices must trust the active certificate to avoid a browser warning.",
    certificate: "Server certificate", certificateHelp: "Apfel-Hafen automatically uses a self-generated certificate. You may activate your own PEM certificate and matching private key.", automaticCertificate: "Automatically generated certificate", customCertificate: "Custom certificate", certificateFile: "Choose certificate", privateKeyFile: "Choose private key", activateCertificate: "Activate certificate", removeCertificate: "Delete custom certificate", certificateActive: "Active", validUntil: "Valid until", certificateNames: "Names", certificateFingerprint: "SHA-256 fingerprint", certificateMissing: "Choose both the certificate and private key.", certificateTooLarge: "The certificate file is too large.", certificateUpdated: "The custom certificate is now active.", certificateRemoved: "The automatically generated certificate is now active.",
    volumeHelp: "New volume folders are created only inside this base directory.", createTitle: "Create a new container",
    general: "General", networkStorage: "Network & storage", variablesReview: "Variables & review", name: "Container name", image: "Image", resources: "Resources", cpuHelp: "Number of available CPU cores.", memoryMb: "Memory (MB)", memoryHelp: "Maximum memory in megabytes.",
    imageHelp: "Enter a search term or a full registry reference.", searchImages: "Search images", searchingImages: "Searching images …", noImageResults: "No public images found. You can still use the entered reference.", official: "Official", localImage: "Local", directReference: "Direct image reference", startAfter: "Start after creation", startArguments: "Startup arguments", startArgumentsHelp: "One argument per line. Leave empty to use the image's default command.",
    externalPort: "External port", containerPort: "Container port", protocol: "Protocol", ports: "Port mappings", volumes: "Volumes", suggestionHelp: "Suggestions were generated from the image and can be edited or removed.",
    subpath: "Subfolder", destination: "Path in container", readOnly: "Read only", volumeHostPath: "Host path", variables: "Environment variables", key: "Name", value: "Value",
    secret: "Sensitive", summary: "Summary", deleteTitle: "Permanently delete container", typeName: "Enter the container name to confirm",
    deleteVolumes: "Also delete associated volume data inside the global path", deleteWarning: "This action cannot be undone.",
    adminRequired: "Administrator sign-in required", confirmAction: "Confirm action", language: "Language", help: "Getting started", noVolumes: "No volumes mounted.",
    noPorts: "No ports published.", cpu: "CPU cores", memory: "Memory", containerInfo: "Container information",
  },
};

const emptyDraft = () => ({ name: "", image: "", cpus: "2", memoryMb: "1024", start: true, arguments: [], ports: [], volumes: [], variables: [] });
const webPorts = new Set([80, 443, 3000, 3001, 5678, 7070, 8080, 8443, 8888, 8889]);

function formatMemory(bytes, language) {
  if (!bytes) return "–";
  const locale = language === "de" ? "de-DE" : "en-US";
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toLocaleString(locale, { maximumFractionDigits: 1 })} GB`;
  return `${Math.round(bytes / 1048576)} MB`;
}

function portUrl(port) {
  if (port.protocol !== "tcp" || !webPorts.has(port.hostPort)) return null;
  return `${port.hostPort === 443 || port.hostPort === 8443 ? "https" : "http"}://${window.location.hostname || "127.0.0.1"}:${port.hostPort}`;
}

function launchdScheduleLabels(service, t) {
  const labels = [];
  if (service.runAtLoad) labels.push(t("runAtLogin"));
  if (service.keepAlive) labels.push(t("keepRunning"));
  if (service.startInterval) labels.push(`${t("startRegularly")}: ${service.startInterval} s`);
  for (const interval of service.calendarIntervals || []) {
    const day = interval.weekday === null ? t("daily") : t(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][interval.weekday]);
    const hour = interval.hour === null ? "*" : String(interval.hour).padStart(2, "0");
    const minute = interval.minute === null ? "*" : String(interval.minute).padStart(2, "0");
    labels.push(`${day} ${hour}:${minute}`);
  }
  return labels;
}

function App() {
  const initialLanguage = localStorage.getItem("cz_language") || (navigator.language?.startsWith("de") ? "de" : "en");
  const [language, setLanguage] = useState(initialLanguage);
  const t = (key) => translations[language][key] || ({
    de: { scope: "Kontext", cleanup: "Bereinigen", orphaned: "Verwaister LaunchAgent", orphanedHint: "Die zugehörige Programmdatei fehlt. Die Plist kann sicher in den Papierkorb verschoben werden.", createService: "LaunchAgent erstellen", createServiceIntro: "Einen benutzereigenen Hintergrunddienst aus einem vorhandenen Programm anlegen.", editService: "LaunchAgent bearbeiten", editServiceIntro: "Programm, Argumente, Protokollpfade und Startregeln ändern. Das Label bleibt unverändert.", saveService: "Änderungen speichern", label: "Label", programPath: "Programmpfad", arguments: "Argumente", onePerLine: "Ein Argument pro Zeile", scheduleOptions: "Automatischer Start", scheduleCombinationHelp: "Mehrere aktivierte Regeln gelten gemeinsam. Solange KeepAlive den Prozess am Leben hält, lösen zusätzliche Zeitregeln keinen zweiten Prozess aus.", runAtLogin: "Einmal beim Login starten", runAtLoginHelp: "Startet den Prozess, sobald der LaunchAgent geladen wird (RunAtLoad).", keepRunning: "Prozess dauerhaft am Leben halten", keepRunningHelp: "Startet den Prozess nach jeder Beendigung erneut (KeepAlive).", startRegularly: "Regelmäßig starten", startRegularlyHelp: "LaunchD stößt den Prozess nach dem angegebenen Sekundenintervall an.", intervalSeconds: "Intervall in Sekunden", calendarStart: "Zu bestimmten Uhrzeiten starten", calendarStartHelp: "Eine oder mehrere tägliche beziehungsweise wöchentliche Startzeiten.", weekday: "Wochentag", time: "Uhrzeit", removeTime: "Uhrzeit entfernen", daily: "Täglich", monday: "Montag", tuesday: "Dienstag", wednesday: "Mittwoch", thursday: "Donnerstag", friday: "Freitag", saturday: "Samstag", sunday: "Sonntag", addTime: "Uhrzeit hinzufügen", manualStart: "Nur manuell", loadNow: "Nach dem Erstellen sofort laden", stdoutPath: "Pfad für Standardausgabe", stderrPath: "Pfad für Fehlerausgabe" },
    en: { scope: "Scope", cleanup: "Clean up", orphaned: "Orphaned LaunchAgent", orphanedHint: "The associated program file is missing. The plist can safely be moved to Trash.", createService: "Create LaunchAgent", createServiceIntro: "Create a user background service from an existing program.", editService: "Edit LaunchAgent", editServiceIntro: "Change the program, arguments, log paths, and launch rules. The label remains unchanged.", saveService: "Save changes", label: "Label", programPath: "Program path", arguments: "Arguments", onePerLine: "One argument per line", scheduleOptions: "Automatic start", scheduleCombinationHelp: "Enabled rules apply together. While KeepAlive keeps the process running, additional time rules do not launch a second process.", runAtLogin: "Start once at login", runAtLoginHelp: "Starts the process when the LaunchAgent is loaded (RunAtLoad).", keepRunning: "Keep the process running", keepRunningHelp: "Restarts the process whenever it exits (KeepAlive).", startRegularly: "Start regularly", startRegularlyHelp: "LaunchD triggers the process after the specified number of seconds.", intervalSeconds: "Interval in seconds", calendarStart: "Start at specific times", calendarStartHelp: "One or more daily or weekly start times.", weekday: "Weekday", time: "Time", removeTime: "Remove time", daily: "Daily", monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday", addTime: "Add time", manualStart: "Manual only", loadNow: "Load immediately after creation", stdoutPath: "Standard output path", stderrPath: "Error output path" },
  })[language][key] || key;
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("containers");
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const [serviceInfo, setServiceInfo] = useState(null);
  const [serviceConfirm, setServiceConfirm] = useState(null);
  const [serviceCreateOpen, setServiceCreateOpen] = useState(false);
  const [serviceEditing, setServiceEditing] = useState(null);
  const [serviceDraft, setServiceDraft] = useState(emptyLaunchdDraft);
  const [serviceCreateBusy, setServiceCreateBusy] = useState(false);
  const [serviceCreateError, setServiceCreateError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [info, setInfo] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [updates, setUpdates] = useState({});
  const [auth, setAuth] = useState({ authenticated: false });
  const [runtimeStatus, setRuntimeStatus] = useState({ protocol: "HTTPS", listenHost: "127.0.0.1", certificateSource: "fallback" });
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [administrationOpen, setAdministrationOpen] = useState(false);
  const [administration, setAdministration] = useState({ enabled: false, installed: false, running: false, configuredForCurrentInstallation: false, updatePending: false, volumeBasePath: "", listenHost: "127.0.0.1", loading: false, saving: false, error: "", success: "" });
  const [administrationSaved, setAdministrationSaved] = useState(false);
  const [certificateStatus, setCertificateStatus] = useState(null);
  const [certificateUpload, setCertificateUpload] = useState({ certificate: "", privateKey: "", certificateName: "", privateKeyName: "", busy: false, error: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [draft, setDraft] = useState(emptyDraft);
  const [images, setImages] = useState([]);
  const [createVolumeBasePath, setCreateVolumeBasePath] = useState("");
  const [imageResults, setImageResults] = useState([]);
  const [imageSearching, setImageSearching] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteForm, setDeleteForm] = useState({ confirmation: "", deleteVolumes: false });
  const [containerMenuOpen, setContainerMenuOpen] = useState(null);
  const [containerLogs, setContainerLogs] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editStep, setEditStep] = useState(1);
  const [editDraft, setEditDraft] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [editAcknowledged, setEditAcknowledged] = useState(false);
  const accountMenuRef = useRef(null);

  const changeLanguage = (value) => { localStorage.setItem("cz_language", value); setLanguage(value); };
  useEffect(() => { document.documentElement.lang = language; document.title = t("appName"); }, [language]);
  async function request(url, options) {
    const response = await fetch(url, { ...options, headers: { ...(options?.headers || {}), "X-App-Language": language } });
    const data = await response.json();
    if (!response.ok) { if (response.status === 401) setAuth({ authenticated: false }); throw new Error(data.error); }
    return data;
  }
  async function load() {
    setLoading(true); setError("");
    try { setContainers((await request("/api/containers")).containers); } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  async function loadServices() {
    setServicesLoading(true); setServicesError("");
    try { setServices((await request("/api/services/launchd")).services); } catch (err) { setServicesError(err.message); } finally { setServicesLoading(false); }
  }
  const loadRuntimeStatus = () => request("/api/status").then(setRuntimeStatus).catch(() => {});
  useEffect(() => { load(); loadServices(); loadRuntimeStatus(); request("/api/auth/session").then(setAuth).catch(() => setAuth({ authenticated: false })); }, []);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (event) => { if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false); };
    document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close);
  }, [accountMenuOpen]);
  useEffect(() => {
    if (!containerMenuOpen) return;
    const close = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && event.target.closest(".container-menu")) return;
      setContainerMenuOpen(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [containerMenuOpen]);
  useEffect(() => {
    if (!administration.success) return;
    const timer = setTimeout(() => {
      setAdministration((value) => ({ ...value, success: "" }));
      setAdministrationSaved(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [administration.success]);
  useEffect(() => {
    if (!createOpen || draft.image.trim().length < 2) { setImageResults([]); setImageSearching(false); return; }
    let active = true;
    setImageSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await request(`/api/images/search?q=${encodeURIComponent(draft.image.trim())}`);
        if (active) setImageResults(data.results || []);
      } catch { if (active) setImageResults([]); }
      finally { if (active) setImageSearching(false); }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [createOpen, draft.image]);
  async function searchImagesNow() {
    const query = draft.image.trim();
    if (query.length < 2) return;
    setImageSearching(true); setCreateError("");
    try { setImageResults((await request(`/api/images/search?q=${encodeURIComponent(query)}`)).results || []); }
    catch (err) { setImageResults([]); setCreateError(err.message); }
    finally { setImageSearching(false); }
  }

  async function login(event) {
    event.preventDefault(); setLoginError("");
    try {
      const data = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(loginForm) });
      setAuth(data); setLoginForm({ username: "", password: "" }); setLoginOpen(false); setNotice(`${data.displayName || data.username}`);
    } catch (err) { setLoginError(err.message); setLoginForm((value) => ({ ...value, password: "" })); }
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setAuth({ authenticated: false }); setAccountMenuOpen(false); }
  async function openAdministration() {
    setAccountMenuOpen(false); setAdministrationOpen(true); setAdministrationSaved(false); setAdministration((value) => ({ ...value, loading: true, error: "", success: "" }));
    setCertificateUpload({ certificate: "", privateKey: "", certificateName: "", privateKeyName: "", busy: false, error: "" });
    try {
      const [settings, certificate] = await Promise.all([request("/api/administration/settings"), request("/api/administration/certificate")]);
      setAdministration({ ...settings, loading: false, saving: false, error: "", success: "" });
      setCertificateStatus(certificate.certificate);
    }
    catch (err) { setAdministration((value) => ({ ...value, loading: false, error: err.message })); }
  }
  async function saveAdministration() {
    setAdministrationSaved(false);
    setAdministration((value) => ({ ...value, saving: true, error: "", success: "" }));
    try {
      const settings = { volumeBasePath: administration.volumeBasePath, listenHost: administration.listenHost };
      if (!administration.managedByApp) settings.enabled = administration.enabled;
      const data = await request("/api/administration/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      setAdministration({ ...data, loading: false, saving: false, error: "", success: t("saved") });
      setAdministrationSaved(true);
      loadRuntimeStatus();
    } catch (err) { setAdministration((value) => ({ ...value, saving: false, error: err.message })); }
  }
  async function selectVolumePath() {
    setAdministration((value) => ({ ...value, error: "", success: "" }));
    try {
      const data = await request("/api/administration/select-volume-path", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language }) });
      if (!data.canceled) setAdministration((value) => ({ ...value, volumeBasePath: data.volumeBasePath, success: "" }));
    } catch (err) { setAdministration((value) => ({ ...value, error: err.message })); }
  }
  async function selectCertificateFile(file, field) {
    if (!file) return;
    if (file.size > 256_000) return setCertificateUpload((value) => ({ ...value, error: t("certificateTooLarge") }));
    const content = await file.text();
    setCertificateUpload((value) => ({ ...value, [field]: content, [`${field}Name`]: file.name, error: "" }));
  }
  async function activateCertificate() {
    if (!certificateUpload.certificate || !certificateUpload.privateKey) return setCertificateUpload((value) => ({ ...value, error: t("certificateMissing") }));
    setCertificateUpload((value) => ({ ...value, busy: true, error: "" }));
    try {
      const data = await request("/api/administration/certificate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ certificate: certificateUpload.certificate, privateKey: certificateUpload.privateKey }) });
      setCertificateStatus(data.certificate);
      setRuntimeStatus((value) => ({ ...value, certificateSource: data.certificate.source }));
      setCertificateUpload({ certificate: "", privateKey: "", certificateName: "", privateKeyName: "", busy: false, error: "" });
      setAdministration((value) => ({ ...value, success: t("certificateUpdated") }));
    } catch (err) { setCertificateUpload((value) => ({ ...value, busy: false, error: err.message })); }
  }
  async function deleteCertificate() {
    setCertificateUpload((value) => ({ ...value, busy: true, error: "" }));
    try {
      const data = await request("/api/administration/certificate", { method: "DELETE" });
      setCertificateStatus(data.certificate);
      setRuntimeStatus((value) => ({ ...value, certificateSource: data.certificate.source }));
      setCertificateUpload({ certificate: "", privateKey: "", certificateName: "", privateKeyName: "", busy: false, error: "" });
      setAdministration((value) => ({ ...value, success: t("certificateRemoved") }));
    } catch (err) { setCertificateUpload((value) => ({ ...value, busy: false, error: err.message })); }
  }
  async function openCreate() {
    if (!auth.authenticated) return setLoginOpen(true);
    setDraft(emptyDraft()); setCreateStep(1); setCreateError(""); setImageResults([]); setCreateOpen(true);
    const [imageResult, settingsResult] = await Promise.allSettled([request("/api/images"), request("/api/administration/settings")]);
    setImages(imageResult.status === "fulfilled" ? imageResult.value.images : []);
    setCreateVolumeBasePath(settingsResult.status === "fulfilled" ? settingsResult.value.volumeBasePath || "" : "");
  }
  async function createContainer() {
    setCreateBusy(true); setCreateError("");
    try {
      const data = await request("/api/containers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      setCreateOpen(false); setNotice(data.message); await load();
    } catch (err) { setCreateError(err.message); } finally { setCreateBusy(false); }
  }
  function continueCreate() {
    if (createStep !== 1) return setCreateStep((value) => value + 1);
    const image = draft.image.toLowerCase();
    let containerPort = 8080;
    let destination = "/data";
    if (/nousresearch\/hermes-agent/.test(image)) { containerPort = 8642; destination = "/opt/data"; }
    else if (/nginx/.test(image)) { containerPort = 80; destination = "/usr/share/nginx/html"; }
    else if (/httpd|apache/.test(image)) { containerPort = 80; destination = "/usr/local/apache2/htdocs"; }
    else if (/postgres/.test(image)) { containerPort = 5432; destination = "/var/lib/postgresql/data"; }
    else if (/mysql|mariadb/.test(image)) { containerPort = 3306; destination = "/var/lib/mysql"; }
    else if (/redis/.test(image)) { containerPort = 6379; destination = "/data"; }
    else if (/mosquitto|mqtt/.test(image)) { containerPort = 1883; destination = "/mosquitto/data"; }
    else if (/mongo/.test(image)) { containerPort = 27017; destination = "/data/db"; }
    else if (/grafana/.test(image)) { containerPort = 3000; destination = "/var/lib/grafana"; }
    else if (/prometheus/.test(image)) { containerPort = 9090; destination = "/prometheus"; }

    const occupied = new Set(containers.flatMap((container) => container.ports).filter((port) => port.protocol === "tcp").map((port) => port.hostPort));
    let hostPort = containerPort === 80 ? 8080 : containerPort;
    while (occupied.has(hostPort) && hostPort < 65535) hostPort += 1;
    setDraft((value) => ({
      ...value,
      ports: value.ports.length ? value.ports : [{ hostPort: String(hostPort), containerPort: String(containerPort), protocol: "tcp" }],
      volumes: value.volumes.length ? value.volumes : [{ subpath: value.name, destination, readOnly: false }],
      arguments: value.arguments.length || !/nousresearch\/hermes-agent/.test(image) ? value.arguments : ["gateway", "run"],
    }));
    setCreateStep(2);
  }
  async function execute() {
    const { container, action } = confirm; setConfirm(null); setBusy(`${container.name}:${action}`);
    try {
      const data = await request(`/api/containers/${encodeURIComponent(container.name)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: container.name }) });
      if (action === "replace") {
        setUpdates((value) => {
          const next = { ...value };
          delete next[container.name];
          return next;
        });
      }
      setNotice(data.message || "OK"); await load();
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }
  async function checkUpdate(container) {
    if (!auth.authenticated) return setLoginOpen(true);
    setBusy(`${container.name}:update-check`);
    try { const data = await request(`/api/containers/${encodeURIComponent(container.name)}/update-check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: container.name }) }); setUpdates((value) => ({ ...value, [container.name]: data })); setNotice(data.message || "OK"); }
    catch (err) { setError(err.message); } finally { setBusy(""); }
  }
  async function openContainerConsole(container) {
    if (!auth.authenticated) return setLoginOpen(true);
    setContainerMenuOpen(null); setBusy(`${container.name}:console`);
    try {
      const data = await request(`/api/containers/${encodeURIComponent(container.name)}/console`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: container.name }) });
      setNotice(data.message);
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }
  async function openContainerLogs(container) {
    if (!auth.authenticated) return setLoginOpen(true);
    setContainerMenuOpen(null); setBusy(`${container.name}:logs`);
    try {
      const data = await request(`/api/containers/${encodeURIComponent(container.name)}/logs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: container.name }) });
      setContainerLogs(data);
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }
  async function removeContainer() {
    try {
      const data = await request(`/api/containers/${encodeURIComponent(deleteTarget.name)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(deleteForm) });
      setDeleteTarget(null); setDeleteForm({ confirmation: "", deleteVolumes: false }); setNotice(data.message); await load();
    } catch (err) { setError(err.message); }
  }
  async function openContainerSettings(container) {
    if (!auth.authenticated) return setLoginOpen(true);
    setContainerMenuOpen(null); setEditTarget(container); setEditStep(1); setEditDraft(null); setEditError(""); setEditAcknowledged(false);
    try {
      const data = await request(`/api/containers/${encodeURIComponent(container.name)}/settings`);
      setEditDraft(data.settings);
    } catch (err) { setEditError(err.message); }
  }
  async function saveContainerSettings() {
    setEditBusy(true); setEditError("");
    try {
      const data = await request(`/api/containers/${encodeURIComponent(editTarget.name)}/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editDraft) });
      setEditTarget(null); setEditDraft(null); setNotice(data.message); await load();
    } catch (err) { setEditError(err.message); } finally { setEditBusy(false); }
  }
  async function executeServiceAction() {
    const selected = serviceConfirm;
    setServiceConfirm(null); setBusy(`launchd:${selected.service.id}`); setNotice("");
    try {
      const data = await request(`/api/services/launchd/${encodeURIComponent(selected.service.id)}/${selected.action}`, { method: "POST" });
      setNotice(data.message); await loadServices();
    } catch (err) { setServicesError(err.message); } finally { setBusy(""); }
  }
  function editService(service) {
    setServiceInfo(null);
    setServiceEditing(service);
    setServiceDraft(launchdDraftFromService(service));
    setServiceCreateError("");
    setServiceCreateOpen(true);
  }
  async function saveService(event) {
    event.preventDefault(); setServiceCreateBusy(true); setServiceCreateError("");
    try {
      const payload = launchdDraftPayload(serviceDraft);
      delete payload.argumentsText;
      const url = serviceEditing ? `/api/services/launchd/${encodeURIComponent(serviceEditing.id)}` : "/api/services/launchd";
      const data = await request(url, { method: serviceEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setServiceCreateOpen(false); setServiceEditing(null); setServiceDraft(emptyLaunchdDraft()); setNotice(data.message); await loadServices();
    } catch (err) { setServiceCreateError(err.message); } finally { setServiceCreateBusy(false); }
  }
  const updateEditList = (field, index, patch) => setEditDraft((value) => ({ ...value, [field]: value[field].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const removeEditList = (field, index) => setEditDraft((value) => ({ ...value, [field]: value[field].filter((_, itemIndex) => itemIndex !== index) }));
  const updateList = (field, index, patch) => setDraft((value) => ({ ...value, [field]: value[field].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const removeList = (field, index) => setDraft((value) => ({ ...value, [field]: value[field].filter((_, itemIndex) => itemIndex !== index) }));
  const filtered = useMemo(() => containers.filter((item) => `${item.name} ${item.image}`.toLowerCase().includes(query.toLowerCase())), [containers, query]);
  const filteredServices = useMemo(() => services.filter((item) => `${item.label} ${item.program} ${item.kind}`.toLowerCase().includes(query.toLowerCase())), [services, query]);
  const running = containers.filter((item) => item.status === "running").length;
  const runningServices = services.filter((item) => item.running).length;
  const headline = running === 0 ? t("headlineNone") : running === containers.length ? t("headline") : t("headlineAlmost");

  return <main>
    <header className="hero"><div><p className="eyebrow">{t("serviceCenter")}</p><h1>{section === "containers" ? <>{headline} <em>{t("headlineEm")}</em></> : <>{language === "de" ? "Zentrale" : "Center"} <em>{t("services")}</em></>}</h1><p className="intro">{section === "containers" ? t("intro") : t("serviceIntro")}</p></div><div className="hero-aside">
      <div className="account-controls"><button className="help-button" onClick={() => setHelpOpen(true)} aria-label={t("help")} title={t("help")}>ⓘ <span>{t("help")}</span></button><div className="account-menu" ref={accountMenuRef}><button className={`account-button ${auth.authenticated ? "authenticated" : ""}`} onClick={auth.authenticated ? () => setAccountMenuOpen(!accountMenuOpen) : () => setLoginOpen(true)}>{auth.authenticated ? (auth.displayName || auth.username) : t("login")} {auth.authenticated && "⌄"}</button>{auth.authenticated && accountMenuOpen && <div className="account-dropdown"><button onClick={openAdministration}>{t("administration")}</button><button className="logout-item" onClick={logout}>{t("logout")}</button></div>}</div><select className="language-select" value={language} onChange={(e) => changeLanguage(e.target.value)} aria-label={t("language")}><option value="de">DE</option><option value="en">EN</option></select></div>
      <div className="summary"><div><strong>{section === "containers" ? containers.length : services.length}</strong><span>{t("total")}</span></div><div><strong>{section === "containers" ? running : runningServices}</strong><span>{t("active")}</span></div><div><strong>{section === "containers" ? containers.length - running : services.length - runningServices}</strong><span>{t("inactive")}</span></div></div>
    </div></header>
    <nav className="service-tabs" aria-label={t("serviceCenter")}><button className={section === "containers" ? "active" : ""} onClick={() => { setSection("containers"); setQuery(""); }}>◇ {t("containers")} <span>{containers.length}</span></button><button className={section === "launchd" ? "active" : ""} onClick={() => { setSection("launchd"); setQuery(""); }}>⚙ {t("launchd")} <span>{services.length}</span></button></nav>
    {section === "containers" && <section className="panel"><div className="section-title container-list-header"><h2>{t("containers")}</h2><label className="search">⌕<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} /></label><div className="toolbar-actions">{auth.authenticated && <button className="primary create-button" onClick={openCreate}>＋ {t("create")}</button>}<button className="refresh" onClick={load} disabled={loading}>↻ {loading ? t("loading") : t("reload")}</button></div></div>
      {error && <div className="message error" role="alert">{error}</div>}{notice && <div className="message success" role="status">{notice}</div>}
      <div className="list">{filtered.map((container) => <article className={`row ${updates[container.name]?.available ? "has-update" : ""}`} key={container.name}><div className="identity"><div className={`cube ${container.status}`}>◇</div><div><h3>{container.name}{updates[container.name]?.available && <span className="update-badge">{t("update")}</span>}</h3><p><i className={container.status} />{container.status === "running" ? t("running") : t("stopped")}{container.image ? ` · ${container.image}` : ""}</p></div></div><div className="actions"><button className="info-button" onClick={() => setInfo(container)}>ⓘ {t("info")}</button>{container.status !== "running" && <button disabled={!auth.authenticated} onClick={() => setConfirm({ container, action: "start" })}>▶ {t("start")}</button>}{container.status === "running" && <button disabled={!auth.authenticated} onClick={() => setConfirm({ container, action: "stop" })}>■ {t("stop")}</button>}<button disabled={!auth.authenticated} onClick={() => setConfirm({ container, action: "restart" })}>↻ {t("restart")}</button>{updates[container.name]?.available && <button className="replace" onClick={() => setConfirm({ container, action: "replace", update: updates[container.name] })}>⇄ {t("replace")}</button>}<div className="container-menu"><button className="container-menu-trigger" aria-label={`${t("moreActions")}: ${container.name}`} aria-haspopup="menu" aria-expanded={containerMenuOpen === container.name} onClick={() => setContainerMenuOpen((value) => value === container.name ? null : container.name)}>•••</button>{containerMenuOpen === container.name && <div className="container-dropdown" role="menu"><button role="menuitem" disabled={!auth.authenticated} onClick={() => openContainerLogs(container)}>≡ {t("containerLogsLabel")}</button><button role="menuitem" disabled={!auth.authenticated || container.status !== "running"} onClick={() => openContainerConsole(container)}>▸_ {t("console")}</button><button role="menuitem" disabled={!auth.authenticated} onClick={() => openContainerSettings(container)}>⚙ {t("settings")}</button><button role="menuitem" disabled={!auth.authenticated} onClick={() => { setContainerMenuOpen(null); checkUpdate(container); }}>↓ {t("check")}</button><button role="menuitem" className="danger-item" disabled={!auth.authenticated} onClick={() => { setContainerMenuOpen(null); setDeleteTarget(container); setDeleteForm({ confirmation: "", deleteVolumes: false }); }}>⌫ {t("delete")}</button></div>}</div></div>{busy.startsWith(`${container.name}:`) && <div className="working">{t("loading")}</div>}</article>)}{!loading && !filtered.length && <div className="empty">{t("noMatches")}</div>}</div>
    </section>}
    {section === "launchd" && <section className="panel"><div className="section-title container-list-header"><h2>{t("launchd")}</h2><label className="search">⌕<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("serviceSearch")} /></label><div className="toolbar-actions">{auth.authenticated && <button className="primary create-button" onClick={() => { setServiceEditing(null); setServiceDraft(emptyLaunchdDraft()); setServiceCreateError(""); setServiceCreateOpen(true); }}>＋ {t("createService")}</button>}<button className="refresh" onClick={loadServices} disabled={servicesLoading}>↻ {servicesLoading ? t("loading") : t("reload")}</button></div></div>
      <p className="scope-note">ⓘ {t("manualOnly")}</p>{servicesError && <div className="message error" role="alert">{servicesError}</div>}{notice && <div className="message success" role="status">{notice}</div>}
      {filteredServices.some((service) => service.canCleanup) && <section className="cleanup-panel"><div><strong>⚠ {t("orphaned")}</strong><p>{t("orphanedHint")}</p></div><div>{filteredServices.filter((service) => service.canCleanup).map((service) => <button key={service.id} disabled={!auth.authenticated} onClick={() => setServiceConfirm({ service, action: "cleanup" })}>⌫ {service.label} · {t("cleanup")}</button>)}</div></section>}
      <div className="list">{filteredServices.map((service) => <article className="row service-row" key={service.id}><div className="identity"><div className={`cube ${service.running ? "running" : "stopped"}`}>⚙</div><div><h3>{service.label}<span className={`scope-badge ${service.scope}`}>{t(service.scope === "user" ? "userScope" : "systemScope")}</span></h3><p><i className={service.running ? "running" : "stopped"} />{service.running ? t("running") : service.loaded ? t("loaded") : t("unloaded")} · {service.kind}{service.pid ? ` · PID ${service.pid}` : ""}</p></div></div><div className="actions"><button className="info-button" onClick={() => setServiceInfo(service)}>ⓘ {t("info")}</button>{service.canEdit && <button disabled={!auth.authenticated} onClick={() => editService(service)}>✎ {t("editService")}</button>}{service.canManage && !service.running && <button disabled={!auth.authenticated} onClick={() => setServiceConfirm({ service, action: "start" })}>▶ {t("start")}</button>}{service.canManage && service.loaded && <button disabled={!auth.authenticated} onClick={() => setServiceConfirm({ service, action: "stop" })}>■ {t("stop")}</button>}{service.canManage && service.loaded && <button disabled={!auth.authenticated} onClick={() => setServiceConfirm({ service, action: "restart" })}>↻ {t("restart")}</button>}{!service.canManage && <span className="readonly-badge">🔒 {t("readOnly")}</span>}</div>{busy === `launchd:${service.id}` && <div className="working">{t("loading")}</div>}</article>)}{!servicesLoading && !filteredServices.length && <div className="empty">{t("noServiceMatches")}</div>}</div>
    </section>}
    <footer><span>{section === "containers" ? "Apple Container CLI" : "macOS LaunchD"}</span><span>{runtimeStatus.protocol} · {runtimeStatus.listenHost === "0.0.0.0" ? t("networkAccess") : t("localAccess")} · {runtimeStatus.certificateSource === "custom" ? t("customCertificate") : t("automaticCertificate")}</span></footer>

    {confirm && <Modal onClose={() => setConfirm(null)}><p className="eyebrow">{t("confirmAction")}</p><h2>{t(confirm.action === "replace" ? "replace" : confirm.action)}?</h2><p>„{confirm.container.name}“</p><div><button className="cancel" onClick={() => setConfirm(null)}>{t("cancel")}</button><button className="primary" onClick={execute}>{t(confirm.action === "replace" ? "replace" : confirm.action)}</button></div></Modal>}
    {serviceConfirm && <Modal onClose={() => setServiceConfirm(null)}><p className="eyebrow">{t("confirmAction")}</p><h2>{t(serviceConfirm.action)}?</h2><p>„{serviceConfirm.service.label}“</p><div><button className="cancel" onClick={() => setServiceConfirm(null)}>{t("cancel")}</button><button className="primary" onClick={executeServiceAction}>{t(serviceConfirm.action)}</button></div></Modal>}
    {serviceInfo && <Modal wide onClose={() => setServiceInfo(null)}><p className="eyebrow">{t("launchdInfo")}</p><h2>{serviceInfo.label}</h2><dl className="info-grid"><div><dt>{t("configuration")}</dt><dd><code>{serviceInfo.path}</code></dd></div><div><dt>{t("scope")}</dt><dd>{t(serviceInfo.scope === "user" ? "userScope" : "systemScope")} · {serviceInfo.kind}</dd></div><div><dt>Status</dt><dd>{serviceInfo.running ? t("running") : serviceInfo.loaded ? t("loaded") : t("unloaded")}{serviceInfo.pid ? ` · PID ${serviceInfo.pid}` : ""}</dd></div><div><dt>{t("schedule")}</dt><dd>{launchdScheduleLabels(serviceInfo, t).join(" · ") || t("manualStart")}</dd></div></dl><section className="info-section"><h3>Programm</h3><code>{serviceInfo.program || "–"}</code>{serviceInfo.programArguments.length > 1 && <p>{serviceInfo.programArguments.slice(1).join(" ")}</p>}</section><section className="info-section"><h3>{t("logs")}</h3><p>{serviceInfo.standardOutPath || "stdout: –"}<br />{serviceInfo.standardErrorPath || "stderr: –"}</p></section><div className="info-close">{serviceInfo.canEdit && <button disabled={!auth.authenticated} onClick={() => editService(serviceInfo)}>✎ {t("editService")}</button>}<button className="primary" onClick={() => setServiceInfo(null)}>{t("close")}</button></div></Modal>}
    {serviceCreateOpen && <Modal wide onClose={() => { if (!serviceCreateBusy) { setServiceCreateOpen(false); setServiceEditing(null); } }}><form className="service-create-form" onSubmit={saveService}><p className="eyebrow">{t("serviceCenter")}</p><h2>{t(serviceEditing ? "editService" : "createService")}</h2><p>{t(serviceEditing ? "editServiceIntro" : "createServiceIntro")}</p>{serviceCreateError && <div className="login-error">{serviceCreateError}</div>}<label className="form-field"><span>{t("label")}</span><input autoFocus required disabled={Boolean(serviceEditing)} value={serviceDraft.label} onChange={(e) => setServiceDraft((value) => ({ ...value, label: e.target.value }))} placeholder="de.meinname.mein-dienst" /></label><label className="form-field"><span>{t("programPath")}</span><input required value={serviceDraft.program} onChange={(e) => setServiceDraft((value) => ({ ...value, program: e.target.value }))} placeholder="/usr/local/bin/mein-programm" /></label><label className="form-field"><span>{t("arguments")}</span><textarea value={serviceDraft.argumentsText} onChange={(e) => setServiceDraft((value) => ({ ...value, argumentsText: e.target.value }))} placeholder={`--port\n8080`} /><small>{t("onePerLine")}</small></label><div className="service-log-fields"><label className="form-field"><span>{t("stdoutPath")}</span><input value={serviceDraft.standardOutPath} onChange={(e) => setServiceDraft((value) => ({ ...value, standardOutPath: e.target.value }))} placeholder="/Users/…/Library/Logs/dienst.log" /></label><label className="form-field"><span>{t("stderrPath")}</span><input value={serviceDraft.standardErrorPath} onChange={(e) => setServiceDraft((value) => ({ ...value, standardErrorPath: e.target.value }))} placeholder="/Users/…/Library/Logs/dienst-error.log" /></label></div><LaunchdScheduleOptions draft={serviceDraft} setDraft={setServiceDraft} t={t} />{!serviceEditing && <label className="load-now-option"><input type="checkbox" checked={serviceDraft.loadNow} onChange={(e) => setServiceDraft((value) => ({ ...value, loadNow: e.target.checked }))} /> {t("loadNow")}</label>}<div className="wizard-actions"><button type="button" className="cancel" disabled={serviceCreateBusy} onClick={() => { setServiceCreateOpen(false); setServiceEditing(null); }}>{t("cancel")}</button><button type="submit" className="primary" disabled={serviceCreateBusy || !launchdDraftIsValid(serviceDraft)}>{serviceCreateBusy ? t("loading") : t(serviceEditing ? "saveService" : "createService")}</button></div></form></Modal>}
    {info && <Modal wide onClose={() => setInfo(null)}><p className="eyebrow">{t("containerInfo")}</p><h2>{info.name}</h2><dl className="info-grid"><div><dt>{t("image")}</dt><dd>{info.image || "–"}</dd></div><div><dt>{t("memory")}</dt><dd>{formatMemory(info.memoryInBytes, language)}</dd></div><div><dt>{t("cpu")}</dt><dd>{info.cpus ?? "–"}</dd></div></dl><section className="info-section"><h3>{t("volumes")}</h3>{info.volumes.length ? <ul>{info.volumes.map((v, i) => <li key={i}><code>{v.source}</code><span>→</span><code>{v.destination}</code></li>)}</ul> : <p>{t("noVolumes")}</p>}</section><section className="info-section"><h3>{t("ports")}</h3>{info.ports.length ? <ul>{info.ports.map((p, i) => { const url = portUrl(p); return <li key={i}><code>{p.hostPort}</code><span>→</span><code>{p.containerPort}/{p.protocol}</code>{url && <a href={url} target="_blank" rel="noreferrer">↗</a>}</li>; })}</ul> : <p>{t("noPorts")}</p>}</section><div className="info-close"><button className="primary" onClick={() => setInfo(null)}>{t("close")}</button></div></Modal>}
    {helpOpen && <Modal extraWide onClose={() => setHelpOpen(false)}><GettingStarted language={language} onClose={() => setHelpOpen(false)} /> </Modal>}
    {administrationOpen && <Modal wide onClose={() => setAdministrationOpen(false)}>
      <p className="eyebrow">{t("systemSettings")}</p><h2>{t("administration")}</h2><p>{t("settingsIntro")}</p>
      {administration.error && <div className="login-error">{administration.error}</div>}{administration.success && <div className="settings-toast" role="status" aria-live="polite"><span>✓</span>{administration.success}</div>}
      <section className="setting-row"><div><strong>{t("autostart")}</strong><span>{administration.managedByApp ? t("managedByApp") : t("autostartHelp")}</span><small>{administration.enabled ? t("autostartEnabled") : t("autostartDisabled")} · {administration.running ? t("autostartServiceRunning") : t("autostartServiceStopped")}</small>{administration.updatePending && <small>{t("autostartUpdatePending")}</small>}</div>{!administration.managedByApp && <button className={`switch ${administration.enabled ? "on" : ""}`} onClick={() => setAdministration((v) => ({ ...v, enabled: !v.enabled, success: "" }))} aria-pressed={administration.enabled}><i /></button>}</section>
      <label className="form-field volume-setting"><span>{t("volumeBase")}</span><div className="path-selector"><input value={administration.volumeBasePath} onChange={(e) => setAdministration((v) => ({ ...v, volumeBasePath: e.target.value, success: "" }))} /><button type="button" onClick={selectVolumePath}>{t("selectFolder")}</button></div><small>{t("volumeHelp")}</small></label>
      <section className="network-setting"><strong>{t("accessMode")}</strong><span>{t("accessHelp")}</span><div className="access-options"><button className={administration.listenHost === "127.0.0.1" ? "selected" : ""} onClick={() => setAdministration((v) => ({ ...v, listenHost: "127.0.0.1", success: "" }))}><b>{t("localAccess")}</b><small>{t("localAddress")}</small></button><button className={administration.listenHost === "0.0.0.0" ? "selected" : ""} onClick={() => setAdministration((v) => ({ ...v, listenHost: "0.0.0.0", success: "" }))}><b>{t("networkAccess")}</b><small>{t("networkAddress")}</small></button></div>{administration.listenHost === "0.0.0.0" && <p className="network-warning">{t("networkWarning")}</p>}</section>
      <CertificateSetting status={certificateStatus} upload={certificateUpload} t={t} language={language} onFile={selectCertificateFile} onActivate={activateCertificate} onDelete={deleteCertificate} />
      <div className="administration-actions"><button className="cancel" onClick={() => setAdministrationOpen(false)}>{t("cancel")}</button><button className={`primary save-button ${administrationSaved ? "saved" : ""}`} disabled={administration.saving || administration.loading} onClick={saveAdministration}>{administration.saving ? t("saving") : administrationSaved ? `✓ ${t("savedShort")}` : t("save")}</button></div>
    </Modal>}
    {createOpen && <Modal extraWide onClose={() => !createBusy && setCreateOpen(false)}><p className="eyebrow">{t("create")} · {createStep}/3</p><h2>{t("createTitle")}</h2><div className="step-indicator"><span className={createStep >= 1 ? "active" : ""}>{t("general")}</span><span className={createStep >= 2 ? "active" : ""}>{t("networkStorage")}</span><span className={createStep >= 3 ? "active" : ""}>{t("variablesReview")}</span></div>{createError && <div className="login-error">{createError}</div>}
      {createStep === 1 && <div className="form-grid"><label className="form-field"><span>{t("name")}</span><input autoFocus value={draft.name} onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} placeholder="mein-webserver" /></label><div className="form-field image-search-field"><span>{t("image")}</span><div className="image-search-control"><input value={draft.image} onChange={(e) => setDraft((v) => ({ ...v, image: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchImagesNow(); } }} placeholder="z. B. nginx" autoComplete="off" /><button type="button" disabled={draft.image.trim().length < 2 || imageSearching} onClick={searchImagesNow}>⌕ {imageSearching ? t("searchingImages") : t("searchImages")}</button></div><small>{t("imageHelp")}</small>{draft.image.trim().length >= 2 && <div className="image-results" role="listbox">{images.filter((image) => image.toLowerCase().includes(draft.image.toLowerCase())).slice(0, 5).map((image) => <button type="button" key={`local-${image}`} onClick={() => { setDraft((v) => ({ ...v, image })); setImageResults([]); }}><span><strong>{image}</strong><small>{t("localImage")}</small></span><b>→</b></button>)}{imageResults.map((result) => <button type="button" key={result.reference} onClick={() => { setDraft((v) => ({ ...v, image: result.reference })); setImageResults([]); }}><span><strong>{result.name}</strong><small>{result.official ? `${t("official")} · ` : ""}${result.description || result.reference}</small></span><b>→</b></button>)}{imageSearching && <p>{t("searchingImages")}</p>}{!imageSearching && !imageResults.length && !images.some((image) => image.toLowerCase().includes(draft.image.toLowerCase())) && <p>{t("noImageResults")}</p>}</div>}</div><fieldset className="resource-fields"><legend>{t("resources")}</legend><label className="form-field"><span>{t("cpu")}</span><input type="number" min="1" max="256" step="1" value={draft.cpus} onChange={(e) => setDraft((v) => ({ ...v, cpus: e.target.value }))} /><small>{t("cpuHelp")}</small></label><label className="form-field"><span>{t("memoryMb")}</span><input type="number" min="64" max="1048576" step="64" value={draft.memoryMb} onChange={(e) => setDraft((v) => ({ ...v, memoryMb: e.target.value }))} /><small>{t("memoryHelp")}</small></label></fieldset><label className="check-field"><input type="checkbox" checked={draft.start} onChange={(e) => setDraft((v) => ({ ...v, start: e.target.checked }))} /> {t("startAfter")}</label></div>}
      {createStep === 2 && <div className="builder-sections"><p className="suggestion-help">✦ {t("suggestionHelp")}</p><BuilderSection title={t("ports")} addLabel={`＋ ${t("add")}`} onAdd={() => setDraft((v) => ({ ...v, ports: [...v.ports, { hostPort: "", containerPort: "", protocol: "tcp" }] }))}>{draft.ports.map((p, i) => <div className="builder-row" key={i}><input type="number" placeholder={t("externalPort")} value={p.hostPort} onChange={(e) => updateList("ports", i, { hostPort: e.target.value })} /><input type="number" placeholder={t("containerPort")} value={p.containerPort} onChange={(e) => updateList("ports", i, { containerPort: e.target.value })} /><select value={p.protocol} onChange={(e) => updateList("ports", i, { protocol: e.target.value })}><option value="tcp">TCP</option><option value="udp">UDP</option></select><button onClick={() => removeList("ports", i)}>×</button></div>)}</BuilderSection><BuilderSection title={t("volumes")} addLabel={`＋ ${t("add")}`} onAdd={() => setDraft((v) => ({ ...v, volumes: [...v.volumes, { subpath: `${v.name}/data`, destination: "/data", readOnly: false }] }))}>{draft.volumes.map((v, i) => <React.Fragment key={i}><div className="volume-path-preview"><span>{t("volumeHostPath")}</span><code>{createVolumeBasePath ? `${createVolumeBasePath.replace(/\/$/, "")}/${v.subpath}` : v.subpath}</code></div><div className="builder-row volume-row"><input placeholder={t("subpath")} value={v.subpath} onChange={(e) => updateList("volumes", i, { subpath: e.target.value })} /><input placeholder={t("destination")} value={v.destination} onChange={(e) => updateList("volumes", i, { destination: e.target.value })} /><label><input type="checkbox" checked={v.readOnly} onChange={(e) => updateList("volumes", i, { readOnly: e.target.checked })} /> {t("readOnly")}</label><button onClick={() => removeList("volumes", i)}>×</button></div></React.Fragment>)}</BuilderSection></div>}
      {createStep === 3 && <div className="builder-sections"><label className="form-field command-arguments"><span>{t("startArguments")}</span><textarea value={draft.arguments.join("\n")} onChange={(e) => setDraft((v) => ({ ...v, arguments: e.target.value ? e.target.value.split("\n") : [] }))} placeholder={`gateway\nrun`} /><small>{t("startArgumentsHelp")}</small></label><BuilderSection title={t("variables")} addLabel={`＋ ${t("add")}`} onAdd={() => setDraft((v) => ({ ...v, variables: [...v.variables, { key: "", value: "", secret: false }] }))}>{draft.variables.map((v, i) => <div className="builder-row variable-row" key={i}><input placeholder={t("key")} value={v.key} onChange={(e) => updateList("variables", i, { key: e.target.value })} /><input type={v.secret ? "password" : "text"} placeholder={t("value")} value={v.value} onChange={(e) => updateList("variables", i, { value: e.target.value })} /><label><input type="checkbox" checked={v.secret} onChange={(e) => updateList("variables", i, { secret: e.target.checked })} /> {t("secret")}</label><button onClick={() => removeList("variables", i)}>×</button></div>)}</BuilderSection><div className="review-card"><strong>{draft.name || "–"}</strong><span>{draft.image || "–"}</span><small>{draft.cpus} {t("cpu")} · {draft.memoryMb} MB {t("memory")} · {draft.ports.length} {t("ports")} · {draft.volumes.length} {t("volumes")} · {draft.variables.length} {t("variables")} · {draft.arguments.length} {t("startArguments")}</small></div></div>}
      <div className="wizard-actions"><button className="cancel" disabled={createBusy} onClick={() => createStep === 1 ? setCreateOpen(false) : setCreateStep((v) => v - 1)}>{createStep === 1 ? t("cancel") : t("back")}</button>{createStep < 3 ? <button className="primary" disabled={createStep === 1 && (!draft.name || !draft.image || !Number.isInteger(Number(draft.cpus)) || Number(draft.cpus) < 1 || Number(draft.cpus) > 256 || !Number.isInteger(Number(draft.memoryMb)) || Number(draft.memoryMb) < 64 || Number(draft.memoryMb) > 1048576)} onClick={continueCreate}>{t("next")}</button> : <button className="primary" disabled={createBusy} onClick={createContainer}>{createBusy ? t("loading") : t("create")}</button>}</div>
    </Modal>}
    {editTarget && <Modal extraWide onClose={() => !editBusy && setEditTarget(null)}><p className="eyebrow">{t("settings")} · {editStep}/3</p><h2>{t("editTitle")}</h2><div className="step-indicator"><span className={editStep >= 1 ? "active" : ""}>{t("general")}</span><span className={editStep >= 2 ? "active" : ""}>{t("editConfiguration")}</span><span className={editStep >= 3 ? "active" : ""}>{t("reviewChanges")}</span></div>{editError && <div className="login-error">{editError}</div>}
      {!editDraft && !editError && <p className="edit-loading">{t("editing")}</p>}
      {editDraft && editStep === 1 && <div className="edit-introduction"><div className="review-card"><strong>{editDraft.name}</strong><span>{editDraft.image}</span><small>{editTarget.status === "running" ? t("running") : t("stopped")}</small></div><p>{t("editIntro")}</p><p className={editTarget.status === "running" ? "running-warning" : "stopped-info"}>{editTarget.status === "running" ? `■ ${t("runningChangeWarning")}` : `● ${t("stoppedChangeInfo")}`}</p><p className="safety-note">✓ {t("safetyNote")}</p></div>}
      {editDraft && editStep === 2 && <div className="builder-sections"><fieldset className="resource-fields"><legend>{t("resources")}</legend><label className="form-field"><span>{t("cpu")}</span><input type="number" min="1" max="256" step="1" value={editDraft.cpus} onChange={(e) => setEditDraft((v) => ({ ...v, cpus: e.target.value }))} /></label><label className="form-field"><span>{t("memoryMb")}</span><input type="number" min="64" max="1048576" step="64" value={editDraft.memoryMb} onChange={(e) => setEditDraft((v) => ({ ...v, memoryMb: e.target.value }))} /></label></fieldset>
        <BuilderSection title={t("ports")} addLabel={`＋ ${t("add")}`} onAdd={() => setEditDraft((v) => ({ ...v, ports: [...v.ports, { hostAddress: "", hostPort: "", containerPort: "", protocol: "tcp" }] }))}>{editDraft.ports.map((p, i) => <div className="builder-row" key={i}><input type="number" placeholder={t("externalPort")} value={p.hostPort} onChange={(e) => updateEditList("ports", i, { hostPort: e.target.value })} /><input type="number" placeholder={t("containerPort")} value={p.containerPort} onChange={(e) => updateEditList("ports", i, { containerPort: e.target.value })} /><select value={p.protocol} onChange={(e) => updateEditList("ports", i, { protocol: e.target.value })}><option value="tcp">TCP</option><option value="udp">UDP</option></select><button aria-label={t("remove")} onClick={() => removeEditList("ports", i)}>×</button></div>)}</BuilderSection>
        <BuilderSection title={t("volumes")} addLabel={`＋ ${t("add")}`} onAdd={() => setEditDraft((v) => ({ ...v, volumes: [...v.volumes, { source: "", destination: "/data", readOnly: false }] }))}>{editDraft.volumes.map((v, i) => <div className="builder-row volume-row" key={i}><input placeholder={t("sourcePath")} value={v.source} onChange={(e) => updateEditList("volumes", i, { source: e.target.value })} /><input placeholder={t("destination")} value={v.destination} onChange={(e) => updateEditList("volumes", i, { destination: e.target.value })} /><label><input type="checkbox" checked={v.readOnly} onChange={(e) => updateEditList("volumes", i, { readOnly: e.target.checked })} /> {t("readOnly")}</label><button aria-label={t("remove")} onClick={() => removeEditList("volumes", i)}>×</button></div>)}</BuilderSection>
        <label className="form-field command-arguments"><span>{t("startArguments")}</span><textarea value={editDraft.arguments.join("\n")} onChange={(e) => setEditDraft((v) => ({ ...v, arguments: e.target.value ? e.target.value.split("\n") : [] }))} placeholder={`gateway\nrun`} /><small>{t("startArgumentsHelp")}</small></label><BuilderSection title={t("variables")} addLabel={`＋ ${t("add")}`} onAdd={() => setEditDraft((v) => ({ ...v, variables: [...v.variables, { key: "", value: "" }] }))}>{editDraft.variables.map((v, i) => <div className="builder-row variable-row" key={i}><input placeholder={t("key")} value={v.key} onChange={(e) => updateEditList("variables", i, { key: e.target.value })} /><input placeholder={t("value")} value={v.value} onChange={(e) => updateEditList("variables", i, { value: e.target.value })} /><span /><button aria-label={t("remove")} onClick={() => removeEditList("variables", i)}>×</button></div>)}</BuilderSection></div>}
      {editDraft && editStep === 3 && <div className="edit-review"><div className="review-card"><strong>{editDraft.name}</strong><span>{editDraft.image}</span><small>{editDraft.cpus} {t("cpu")} · {editDraft.memoryMb} MB {t("memory")} · {editDraft.ports.length} {t("ports")} · {editDraft.volumes.length} {t("volumes")} · {editDraft.variables.length} {t("variables")}</small></div><p className="safety-note">✓ {t("safetyNote")}</p>{editTarget.status === "running" && <label className="check-field downtime-check"><input type="checkbox" checked={editAcknowledged} onChange={(e) => setEditAcknowledged(e.target.checked)} /> {t("acknowledgeDowntime")}</label>}</div>}
      {editDraft && <div className="wizard-actions"><button className="cancel" disabled={editBusy} onClick={() => editStep === 1 ? setEditTarget(null) : setEditStep((v) => v - 1)}>{editStep === 1 ? t("cancel") : t("back")}</button>{editStep < 3 ? <button className="primary" disabled={editStep === 2 && (!Number.isInteger(Number(editDraft.cpus)) || Number(editDraft.cpus) < 1 || Number(editDraft.cpus) > 256 || !Number.isInteger(Number(editDraft.memoryMb)) || Number(editDraft.memoryMb) < 64 || Number(editDraft.memoryMb) > 1048576)} onClick={() => setEditStep((v) => v + 1)}>{t("next")}</button> : <button className="primary" disabled={editBusy || (editTarget.status === "running" && !editAcknowledged)} onClick={saveContainerSettings}>{editBusy ? t("loading") : editTarget.status === "running" ? t("stopAndApply") : t("applyChanges")}</button>}</div>}
    </Modal>}
    {containerLogs && <Modal extraWide onClose={() => setContainerLogs(null)}><p className="eyebrow">{t("containerLogsLabel")}</p><h2>{containerLogs.name}</h2><div className="log-sections"><section><h3>{t("bootLog")}</h3><pre>{containerLogs.bootLog || t("noLogOutput")}</pre></section><section><h3>{t("containerOutput")}</h3><pre>{containerLogs.outputLog || t("noLogOutput")}</pre></section></div><div className="log-actions"><button className="cancel" onClick={() => setContainerLogs(null)}>{t("close")}</button><button className="primary" disabled={busy === `${containerLogs.name}:logs`} onClick={() => openContainerLogs({ name: containerLogs.name })}>↻ {t("reload")}</button></div></Modal>}
    {deleteTarget && <Modal onClose={() => setDeleteTarget(null)}><p className="eyebrow">{t("delete")}</p><h2>{t("deleteTitle")}</h2><p className="warning">{t("deleteWarning")}</p><label className="form-field"><span>{t("typeName")}: <b>{deleteTarget.name}</b></span><input autoFocus value={deleteForm.confirmation} onChange={(e) => setDeleteForm((v) => ({ ...v, confirmation: e.target.value }))} /></label><label className="check-field danger-check"><input type="checkbox" checked={deleteForm.deleteVolumes} onChange={(e) => setDeleteForm((v) => ({ ...v, deleteVolumes: e.target.checked }))} /> {t("deleteVolumes")}</label><div><button className="cancel" onClick={() => setDeleteTarget(null)}>{t("cancel")}</button><button className="danger solid" disabled={deleteForm.confirmation !== deleteTarget.name} onClick={removeContainer}>{t("delete")}</button></div></Modal>}
    {loginOpen && <div className="backdrop"><form className="dialog login-dialog" onSubmit={login}><p className="eyebrow">{t("adminRequired")}</p><h2>{t("login")}</h2>{loginError && <div className="login-error">{loginError}</div>}<label><span>{t("username")}</span><input autoFocus required autoComplete="username" value={loginForm.username} onChange={(e) => setLoginForm((v) => ({ ...v, username: e.target.value }))} /></label><label><span>{t("password")}</span><input type="password" required autoComplete="current-password" value={loginForm.password} onChange={(e) => setLoginForm((v) => ({ ...v, password: e.target.value }))} /></label><div className="login-actions"><button type="button" className="cancel" onClick={() => setLoginOpen(false)}>{t("cancel")}</button><button className="primary">{t("login")}</button></div></form></div>}
  </main>;
}

function Modal({ children, onClose, wide = false, extraWide = false }) { return <div className="backdrop" onMouseDown={onClose}><div className={`dialog ${wide ? "info-dialog" : ""} ${extraWide ? "builder-dialog" : ""}`} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>{children}</div></div>; }
function BuilderSection({ title, addLabel, onAdd, children }) { return <section className="builder-section"><div className="builder-heading"><h3>{title}</h3><button onClick={onAdd}>{addLabel}</button></div>{children}</section>; }
function GettingStarted({ language, onClose }) {
  const de = language === "de";
  const steps = de ? [
    { number: "01", title: "Maschinenraum prüfen", text: "Bevor wir ablegen, muss Apples Containerdienst laufen. Apfel-Hafen zeigt vorhandene Container erst dann zuverlässig an.", action: "Bei einer leeren oder fehlerhaften Liste: container system status prüfen und den Dienst bei Bedarf starten." },
    { number: "02", title: "Liegeplatz festlegen", text: "Melde dich als lokaler macOS-Administrator an und öffne Administration. Prüfe den globalen Pfad für Container-Volumes. Neue verwaltete Daten legt Apfel-Hafen ausschließlich darunter ab.", action: "Empfehlung: einen dauerhaften, gut gesicherten Ordner wählen – nicht Downloads oder einen temporären Pfad." },
    { number: "03", title: "Hafenzufahrt sichern", text: "Wähle 127.0.0.1 für Zugriff nur auf diesem Mac oder 0.0.0.0 für Geräte im lokalen Netzwerk. Prüfe außerdem Autostart und Serverzertifikat.", action: "Bei Netzwerkzugriff ein vertrauenswürdiges Zertifikat verwenden und den Port in der Firewall nur für das gewünschte Netz freigeben." },
    { number: "04", title: "Ersten Container anlegen", text: "Klicke auf Container erstellen. Vergib einen eindeutigen Namen und suche ein Image, zum Beispiel nginx, ubuntu oder postgres. Lege anschließend Portfreigaben, Volumes und benötigte Umgebungsvariablen fest.", action: "Vor dem Erstellen die Zusammenfassung prüfen. Vertrauliche Variablen als vertraulich markieren und wichtige Daten immer in ein Volume legen." },
    { number: "05", title: "Schiffsbetrieb beobachten", text: "Nach dem Erstellen erscheint der Container in der Übersicht. Von hier kannst du ihn starten, stoppen, neu starten, auf Image-Updates prüfen oder kontrolliert ersetzen.", action: "Der Info-Button am jeweiligen Container zeigt Image, Ressourcen, Volumes und veröffentlichte Ports." },
  ] : [
    { number: "01", title: "Check the engine room", text: "Before departure, Apple's container service must be running. Apfel-Hafen can only list containers reliably when it is available.", action: "If the list is empty or reports an error, check container system status and start the service if necessary." },
    { number: "02", title: "Choose the berth", text: "Sign in as a local macOS administrator and open Administration. Verify the global container volume path. Apfel-Hafen creates new managed data only below this directory.", action: "Recommendation: choose a permanent, well-backed-up folder—not Downloads or a temporary location." },
    { number: "03", title: "Secure the harbor entrance", text: "Choose 127.0.0.1 for this Mac only or 0.0.0.0 for devices on the local network. Also review automatic start and the server certificate.", action: "For network access, use a trusted certificate and restrict the firewall rule to the intended network." },
    { number: "04", title: "Create the first container", text: "Select Create container. Enter a unique name and find an image such as nginx, ubuntu, or postgres. Then configure port mappings, volumes, and required environment variables.", action: "Review the summary before creation. Mark sensitive variables accordingly and always keep important data in a volume." },
    { number: "05", title: "Watch harbor operations", text: "The new container appears in the overview. From there you can start, stop, restart, check it for image updates, or replace it safely.", action: "The Info button on each container shows its image, resources, volumes, and published ports." },
  ];
  return <article className="getting-started"><p className="eyebrow">{de ? "Logbuch des Hafenmeisters" : "Harbor master's logbook"}</p><h2>{de ? "Willkommen im Apfel-Hafen" : "Welcome to Apfel-Hafen"}</h2><p className="getting-started-intro">{de ? "Fünf Stationen, dann ist dein erster Apple-Container sicher vertäut." : "Five stops, and your first Apple container will be safely moored."}</p><div className="getting-started-steps">{steps.map((step) => <section key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.text}</p><small>⚓ {step.action}</small></div></section>)}</div><div className="getting-started-finish"><strong>{de ? "Leinen los!" : "Cast off!"}</strong><p>{de ? "Beginne mit Administration und prüfe zuerst den globalen Volume-Pfad." : "Start in Administration and verify the global volume path first."}</p><button className="primary" onClick={onClose}>{de ? "Zur Übersicht" : "Back to overview"}</button></div></article>;
}
function CertificateSetting({ status, upload, t, language, onFile, onActivate, onDelete }) {
  const validTo = status?.validTo ? new Date(status.validTo).toLocaleDateString(language === "de" ? "de-DE" : "en-US") : "–";
  return <section className="certificate-setting"><strong>{t("certificate")}</strong><span>{t("certificateHelp")}</span>{status && <dl className="certificate-status"><div><dt>{t("certificateActive")}</dt><dd>{status.source === "custom" ? t("customCertificate") : t("automaticCertificate")}</dd></div><div><dt>{t("validUntil")}</dt><dd>{validTo}</dd></div><div><dt>{t("certificateNames")}</dt><dd>{status.subjectAltName || status.subject}</dd></div><div><dt>{t("certificateFingerprint")}</dt><dd><code>{status.fingerprint}</code></dd></div></dl>}{upload.error && <div className="login-error">{upload.error}</div>}<div className="certificate-files"><label><span>{t("certificateFile")}</span><input type="file" accept=".pem,.crt,.cer,application/x-pem-file" onChange={(event) => onFile(event.target.files?.[0], "certificate")} /><small>{upload.certificateName}</small></label><label><span>{t("privateKeyFile")}</span><input type="file" accept=".pem,.key,application/x-pem-file" onChange={(event) => onFile(event.target.files?.[0], "privateKey")} /><small>{upload.privateKeyName}</small></label></div><div className="certificate-actions"><button className="primary" disabled={upload.busy || !upload.certificate || !upload.privateKey} onClick={onActivate}>{t("activateCertificate")}</button>{status?.source === "custom" && <button className="danger" disabled={upload.busy} onClick={onDelete}>{t("removeCertificate")}</button>}</div></section>;
}

createRoot(document.getElementById("root")).render(<App />);
