import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const translations = {
  de: {
    appName: "Apfel-Hafen", local: "Nur auf diesem Mac", login: "Anmelden", logout: "Abmelden", administration: "Administration", create: "Container erstellen", username: "Benutzername", password: "Passwort",
    headline: "Alle Container", headlineEm: "auf ruhiger See.", intro: "Container erstellen, verwalten, aktualisieren und sicher löschen.",
    total: "Gesamt", active: "Aktiv", inactive: "Inaktiv / unbekannt", search: "Container suchen", reload: "Neu laden", loading: "Lädt …",
    containers: "Container", running: "Läuft", stopped: "Gestoppt", info: "Info", start: "Starten", stop: "Stoppen", restart: "Neustart",
    check: "Update prüfen", replace: "Container ersetzen", update: "Update verfügbar", noMatches: "Keine passenden Container gefunden.", delete: "Löschen",
    close: "Schließen", cancel: "Abbrechen", back: "Zurück", next: "Weiter", save: "Speichern", saving: "Speichert …", saved: "Einstellungen wurden gespeichert.", add: "Hinzufügen", remove: "Entfernen", selectFolder: "Auswählen …",
    systemSettings: "Systemeinstellungen", settingsIntro: "Hier werden die Einstellungen von Apfel-Hafen verwaltet.", autostart: "Automatisch starten",
    autostartHelp: "Apfel-Hafen nach der macOS-Anmeldung automatisch starten.", volumeBase: "Globaler Pfad für Container-Volumes",
    volumeHelp: "Neue Volume-Unterordner werden ausschließlich innerhalb dieses Basisordners angelegt.", createTitle: "Neuen Container erstellen",
    general: "Allgemein", networkStorage: "Netzwerk & Speicher", variablesReview: "Variablen & Prüfung", name: "Containername", image: "Image",
    imageHelp: "Suchbegriff oder vollständige Registry-Referenz eingeben.", searchImages: "Images suchen", searchingImages: "Images werden gesucht …", noImageResults: "Keine öffentlichen Images gefunden. Die Eingabe kann trotzdem verwendet werden.", official: "Offiziell", localImage: "Lokal", startAfter: "Nach dem Erstellen starten",
    externalPort: "Externer Port", containerPort: "Container-Port", protocol: "Protokoll", ports: "Portfreigaben", volumes: "Volumes", suggestionHelp: "Vorschläge wurden anhand des Images erzeugt und können frei angepasst oder entfernt werden.",
    subpath: "Unterordner", destination: "Pfad im Container", readOnly: "Nur lesen", volumeHostPath: "Host-Pfad", variables: "Umgebungsvariablen", key: "Name", value: "Wert",
    secret: "Vertraulich", summary: "Zusammenfassung", deleteTitle: "Container endgültig löschen", typeName: "Zur Bestätigung den Containernamen eingeben",
    deleteVolumes: "Zugehörige Volume-Daten im globalen Pfad ebenfalls löschen", deleteWarning: "Diese Aktion kann nicht rückgängig gemacht werden.",
    adminRequired: "Administrator-Anmeldung erforderlich", confirmAction: "Aktion bestätigen", language: "Sprache", noVolumes: "Keine Volumes eingebunden.",
    noPorts: "Keine Ports veröffentlicht.", cpu: "CPU-Kerne", memory: "Arbeitsspeicher", containerInfo: "Container-Informationen",
  },
  en: {
    appName: "Apfel-Hafen", local: "Only on this Mac", login: "Sign in", logout: "Sign out", administration: "Administration", create: "Create container", username: "Username", password: "Password",
    headline: "All containers", headlineEm: "on calm seas.", intro: "Create, manage, update and safely delete containers.",
    total: "Total", active: "Active", inactive: "Inactive / unknown", search: "Search containers", reload: "Reload", loading: "Loading …",
    containers: "Containers", running: "Running", stopped: "Stopped", info: "Info", start: "Start", stop: "Stop", restart: "Restart",
    check: "Check update", replace: "Replace container", update: "Update available", noMatches: "No matching containers found.", delete: "Delete",
    close: "Close", cancel: "Cancel", back: "Back", next: "Next", save: "Save", saving: "Saving …", saved: "Settings have been saved.", add: "Add", remove: "Remove", selectFolder: "Choose …",
    systemSettings: "System settings", settingsIntro: "Manage Apfel-Hafen settings here.", autostart: "Start automatically",
    autostartHelp: "Start Apfel-Hafen automatically after signing in to macOS.", volumeBase: "Global container volume path",
    volumeHelp: "New volume folders are created only inside this base directory.", createTitle: "Create a new container",
    general: "General", networkStorage: "Network & storage", variablesReview: "Variables & review", name: "Container name", image: "Image",
    imageHelp: "Enter a search term or a full registry reference.", searchImages: "Search images", searchingImages: "Searching images …", noImageResults: "No public images found. You can still use the entered reference.", official: "Official", localImage: "Local", startAfter: "Start after creation",
    externalPort: "External port", containerPort: "Container port", protocol: "Protocol", ports: "Port mappings", volumes: "Volumes", suggestionHelp: "Suggestions were generated from the image and can be edited or removed.",
    subpath: "Subfolder", destination: "Path in container", readOnly: "Read only", volumeHostPath: "Host path", variables: "Environment variables", key: "Name", value: "Value",
    secret: "Sensitive", summary: "Summary", deleteTitle: "Permanently delete container", typeName: "Enter the container name to confirm",
    deleteVolumes: "Also delete associated volume data inside the global path", deleteWarning: "This action cannot be undone.",
    adminRequired: "Administrator sign-in required", confirmAction: "Confirm action", language: "Language", noVolumes: "No volumes mounted.",
    noPorts: "No ports published.", cpu: "CPU cores", memory: "Memory", containerInfo: "Container information",
  },
};

const emptyDraft = () => ({ name: "", image: "", start: true, ports: [], volumes: [], variables: [] });
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

function App() {
  const initialLanguage = localStorage.getItem("cz_language") || (navigator.language?.startsWith("de") ? "de" : "en");
  const [language, setLanguage] = useState(initialLanguage);
  const t = (key) => translations[language][key] || key;
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [info, setInfo] = useState(null);
  const [updates, setUpdates] = useState({});
  const [auth, setAuth] = useState({ authenticated: false });
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [administrationOpen, setAdministrationOpen] = useState(false);
  const [administration, setAdministration] = useState({ enabled: false, volumeBasePath: "", loading: false, saving: false, error: "", success: "" });
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
  useEffect(() => { load(); request("/api/auth/session").then(setAuth).catch(() => setAuth({ authenticated: false })); }, []);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (event) => { if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false); };
    document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close);
  }, [accountMenuOpen]);
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
    setAccountMenuOpen(false); setAdministrationOpen(true); setAdministration((value) => ({ ...value, loading: true, error: "", success: "" }));
    try { setAdministration({ ...(await request("/api/administration/settings")), loading: false, saving: false, error: "", success: "" }); }
    catch (err) { setAdministration((value) => ({ ...value, loading: false, error: err.message })); }
  }
  async function saveAdministration() {
    setAdministration((value) => ({ ...value, saving: true, error: "", success: "" }));
    try {
      const data = await request("/api/administration/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: administration.enabled, volumeBasePath: administration.volumeBasePath }) });
      setAdministration({ ...data, loading: false, saving: false, error: "", success: t("saved") });
    } catch (err) { setAdministration((value) => ({ ...value, saving: false, error: err.message })); }
  }
  async function selectVolumePath() {
    setAdministration((value) => ({ ...value, error: "", success: "" }));
    try {
      const data = await request("/api/administration/select-volume-path", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language }) });
      if (!data.canceled) setAdministration((value) => ({ ...value, volumeBasePath: data.volumeBasePath, success: "" }));
    } catch (err) { setAdministration((value) => ({ ...value, error: err.message })); }
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
    if (/nginx/.test(image)) { containerPort = 80; destination = "/usr/share/nginx/html"; }
    else if (/httpd|apache/.test(image)) { containerPort = 80; destination = "/usr/local/apache2/htdocs"; }
    else if (/postgres/.test(image)) { containerPort = 5432; destination = "/var/lib/postgresql/data"; }
    else if (/mysql|mariadb/.test(image)) { containerPort = 3306; destination = "/var/lib/mysql"; }
    else if (/redis/.test(image)) { containerPort = 6379; destination = "/data"; }
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
    }));
    setCreateStep(2);
  }
  async function execute() {
    const { container, action } = confirm; setConfirm(null); setBusy(`${container.name}:${action}`);
    try {
      const data = await request(`/api/containers/${encodeURIComponent(container.name)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: container.name }) });
      setNotice(data.message || "OK"); await load();
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }
  async function checkUpdate(container) {
    if (!auth.authenticated) return setLoginOpen(true);
    setBusy(`${container.name}:update-check`);
    try { const data = await request(`/api/containers/${encodeURIComponent(container.name)}/update-check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: container.name }) }); setUpdates((value) => ({ ...value, [container.name]: data })); }
    catch (err) { setError(err.message); } finally { setBusy(""); }
  }
  async function removeContainer() {
    try {
      const data = await request(`/api/containers/${encodeURIComponent(deleteTarget.name)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(deleteForm) });
      setDeleteTarget(null); setDeleteForm({ confirmation: "", deleteVolumes: false }); setNotice(data.message); await load();
    } catch (err) { setError(err.message); }
  }
  const updateList = (field, index, patch) => setDraft((value) => ({ ...value, [field]: value[field].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const removeList = (field, index) => setDraft((value) => ({ ...value, [field]: value[field].filter((_, itemIndex) => itemIndex !== index) }));
  const filtered = useMemo(() => containers.filter((item) => `${item.name} ${item.image}`.toLowerCase().includes(query.toLowerCase())), [containers, query]);
  const running = containers.filter((item) => item.status === "running").length;

  return <main>
    <header className="hero"><div><p className="eyebrow">{language === "de" ? "Apfel-Hafen für Apple-Containers" : "Apfel-Hafen for Apple-Containers"}</p><h1>{t("headline")} <em>{t("headlineEm")}</em></h1><p className="intro">{t("intro")}</p></div><div className="hero-aside">
      <div className="account-controls"><div className="account-menu" ref={accountMenuRef}><button className={`account-button ${auth.authenticated ? "authenticated" : ""}`} onClick={auth.authenticated ? () => setAccountMenuOpen(!accountMenuOpen) : () => setLoginOpen(true)}>{auth.authenticated ? (auth.displayName || auth.username) : t("login")} {auth.authenticated && "⌄"}</button>{auth.authenticated && accountMenuOpen && <div className="account-dropdown"><button onClick={openAdministration}>{t("administration")}</button><button className="logout-item" onClick={logout}>{t("logout")}</button></div>}</div><select className="language-select" value={language} onChange={(e) => changeLanguage(e.target.value)} aria-label={t("language")}><option value="de">DE</option><option value="en">EN</option></select></div>
      <div className="summary"><div><strong>{containers.length}</strong><span>{t("total")}</span></div><div><strong>{running}</strong><span>{t("active")}</span></div><div><strong>{containers.length - running}</strong><span>{t("inactive")}</span></div></div>
    </div></header>
    <section className="panel"><div className="section-title container-list-header"><h2>{t("containers")}</h2><label className="search">⌕<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} /></label><div className="toolbar-actions">{auth.authenticated && <button className="primary create-button" onClick={openCreate}>＋ {t("create")}</button>}<button className="refresh" onClick={load} disabled={loading}>↻ {loading ? t("loading") : t("reload")}</button></div></div>
      {error && <div className="message error" role="alert">{error}</div>}{notice && <div className="message success" role="status">{notice}</div>}
      <div className="list">{filtered.map((container) => <article className={`row ${updates[container.name]?.available ? "has-update" : ""}`} key={container.name}><div className="identity"><div className={`cube ${container.status}`}>◇</div><div><h3>{container.name}{updates[container.name]?.available && <span className="update-badge">{t("update")}</span>}</h3><p><i className={container.status} />{container.status === "running" ? t("running") : t("stopped")}{container.image ? ` · ${container.image}` : ""}</p></div></div><div className="actions"><button className="info-button" onClick={() => setInfo(container)}>ⓘ {t("info")}</button>{container.status !== "running" && <button disabled={!auth.authenticated} onClick={() => setConfirm({ container, action: "start" })}>▶ {t("start")}</button>}{container.status === "running" && <button disabled={!auth.authenticated} onClick={() => setConfirm({ container, action: "stop" })}>■ {t("stop")}</button>}<button disabled={!auth.authenticated} onClick={() => setConfirm({ container, action: "restart" })}>↻ {t("restart")}</button><button disabled={!auth.authenticated} onClick={() => checkUpdate(container)}>↓ {t("check")}</button>{updates[container.name]?.available && <button className="replace" onClick={() => setConfirm({ container, action: "replace", update: updates[container.name] })}>⇄ {t("replace")}</button>}<button className="danger" disabled={!auth.authenticated} onClick={() => { setDeleteTarget(container); setDeleteForm({ confirmation: "", deleteVolumes: false }); }}>⌫ {t("delete")}</button></div>{busy.startsWith(`${container.name}:`) && <div className="working">{t("loading")}</div>}</article>)}{!loading && !filtered.length && <div className="empty">{t("noMatches")}</div>}</div>
    </section><footer><span>Apple Container CLI</span><span>127.0.0.1</span></footer>

    {confirm && <Modal onClose={() => setConfirm(null)}><p className="eyebrow">{t("confirmAction")}</p><h2>{t(confirm.action === "replace" ? "replace" : confirm.action)}?</h2><p>„{confirm.container.name}“</p><div><button className="cancel" onClick={() => setConfirm(null)}>{t("cancel")}</button><button className="primary" onClick={execute}>{t(confirm.action === "replace" ? "replace" : confirm.action)}</button></div></Modal>}
    {info && <Modal wide onClose={() => setInfo(null)}><p className="eyebrow">{t("containerInfo")}</p><h2>{info.name}</h2><dl className="info-grid"><div><dt>{t("image")}</dt><dd>{info.image || "–"}</dd></div><div><dt>{t("memory")}</dt><dd>{formatMemory(info.memoryInBytes, language)}</dd></div><div><dt>{t("cpu")}</dt><dd>{info.cpus ?? "–"}</dd></div></dl><section className="info-section"><h3>{t("volumes")}</h3>{info.volumes.length ? <ul>{info.volumes.map((v, i) => <li key={i}><code>{v.source}</code><span>→</span><code>{v.destination}</code></li>)}</ul> : <p>{t("noVolumes")}</p>}</section><section className="info-section"><h3>{t("ports")}</h3>{info.ports.length ? <ul>{info.ports.map((p, i) => { const url = portUrl(p); return <li key={i}><code>{p.hostPort}</code><span>→</span><code>{p.containerPort}/{p.protocol}</code>{url && <a href={url} target="_blank" rel="noreferrer">↗</a>}</li>; })}</ul> : <p>{t("noPorts")}</p>}</section><div className="info-close"><button className="primary" onClick={() => setInfo(null)}>{t("close")}</button></div></Modal>}
    {administrationOpen && <Modal wide onClose={() => setAdministrationOpen(false)}><p className="eyebrow">{t("systemSettings")}</p><h2>{t("administration")}</h2><p>{t("settingsIntro")}</p>{administration.error && <div className="login-error">{administration.error}</div>}{administration.success && <div className="setting-feedback" role="status">✓ {administration.success}</div>}<section className="setting-row"><div><strong>{t("autostart")}</strong><span>{t("autostartHelp")}</span></div><button className={`switch ${administration.enabled ? "on" : ""}`} onClick={() => setAdministration((v) => ({ ...v, enabled: !v.enabled, success: "" }))}><i /></button></section><label className="form-field volume-setting"><span>{t("volumeBase")}</span><div className="path-selector"><input value={administration.volumeBasePath} onChange={(e) => setAdministration((v) => ({ ...v, volumeBasePath: e.target.value, success: "" }))} /><button type="button" onClick={selectVolumePath}>{t("selectFolder")}</button></div><small>{t("volumeHelp")}</small></label><div className="administration-actions"><button className="cancel" onClick={() => setAdministrationOpen(false)}>{t("cancel")}</button><button className="primary" disabled={administration.saving || administration.loading} onClick={saveAdministration}>{administration.saving ? t("saving") : t("save")}</button></div></Modal>}
    {createOpen && <Modal extraWide onClose={() => !createBusy && setCreateOpen(false)}><p className="eyebrow">{t("create")} · {createStep}/3</p><h2>{t("createTitle")}</h2><div className="step-indicator"><span className={createStep >= 1 ? "active" : ""}>{t("general")}</span><span className={createStep >= 2 ? "active" : ""}>{t("networkStorage")}</span><span className={createStep >= 3 ? "active" : ""}>{t("variablesReview")}</span></div>{createError && <div className="login-error">{createError}</div>}
      {createStep === 1 && <div className="form-grid"><label className="form-field"><span>{t("name")}</span><input autoFocus value={draft.name} onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} placeholder="mein-webserver" /></label><div className="form-field image-search-field"><span>{t("image")}</span><div className="image-search-control"><input value={draft.image} onChange={(e) => setDraft((v) => ({ ...v, image: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchImagesNow(); } }} placeholder="z. B. nginx" autoComplete="off" /><button type="button" disabled={draft.image.trim().length < 2 || imageSearching} onClick={searchImagesNow}>⌕ {imageSearching ? t("searchingImages") : t("searchImages")}</button></div><small>{t("imageHelp")}</small>{draft.image.trim().length >= 2 && <div className="image-results" role="listbox">{images.filter((image) => image.toLowerCase().includes(draft.image.toLowerCase())).slice(0, 5).map((image) => <button type="button" key={`local-${image}`} onClick={() => { setDraft((v) => ({ ...v, image })); setImageResults([]); }}><span><strong>{image}</strong><small>{t("localImage")}</small></span><b>→</b></button>)}{imageResults.map((result) => <button type="button" key={result.reference} onClick={() => { setDraft((v) => ({ ...v, image: result.reference })); setImageResults([]); }}><span><strong>{result.name}</strong><small>{result.official ? `${t("official")} · ` : ""}${result.description || result.reference}</small></span><b>→</b></button>)}{imageSearching && <p>{t("searchingImages")}</p>}{!imageSearching && !imageResults.length && !images.some((image) => image.toLowerCase().includes(draft.image.toLowerCase())) && <p>{t("noImageResults")}</p>}</div>}</div><label className="check-field"><input type="checkbox" checked={draft.start} onChange={(e) => setDraft((v) => ({ ...v, start: e.target.checked }))} /> {t("startAfter")}</label></div>}
      {createStep === 2 && <div className="builder-sections"><p className="suggestion-help">✦ {t("suggestionHelp")}</p><BuilderSection title={t("ports")} addLabel={`＋ ${t("add")}`} onAdd={() => setDraft((v) => ({ ...v, ports: [...v.ports, { hostPort: "", containerPort: "", protocol: "tcp" }] }))}>{draft.ports.map((p, i) => <div className="builder-row" key={i}><input type="number" placeholder={t("externalPort")} value={p.hostPort} onChange={(e) => updateList("ports", i, { hostPort: e.target.value })} /><input type="number" placeholder={t("containerPort")} value={p.containerPort} onChange={(e) => updateList("ports", i, { containerPort: e.target.value })} /><select value={p.protocol} onChange={(e) => updateList("ports", i, { protocol: e.target.value })}><option value="tcp">TCP</option><option value="udp">UDP</option></select><button onClick={() => removeList("ports", i)}>×</button></div>)}</BuilderSection><BuilderSection title={t("volumes")} addLabel={`＋ ${t("add")}`} onAdd={() => setDraft((v) => ({ ...v, volumes: [...v.volumes, { subpath: `${v.name}/data`, destination: "/data", readOnly: false }] }))}>{draft.volumes.map((v, i) => <React.Fragment key={i}><div className="volume-path-preview"><span>{t("volumeHostPath")}</span><code>{createVolumeBasePath ? `${createVolumeBasePath.replace(/\/$/, "")}/${v.subpath}` : v.subpath}</code></div><div className="builder-row volume-row"><input placeholder={t("subpath")} value={v.subpath} onChange={(e) => updateList("volumes", i, { subpath: e.target.value })} /><input placeholder={t("destination")} value={v.destination} onChange={(e) => updateList("volumes", i, { destination: e.target.value })} /><label><input type="checkbox" checked={v.readOnly} onChange={(e) => updateList("volumes", i, { readOnly: e.target.checked })} /> {t("readOnly")}</label><button onClick={() => removeList("volumes", i)}>×</button></div></React.Fragment>)}</BuilderSection></div>}
      {createStep === 3 && <div className="builder-sections"><BuilderSection title={t("variables")} addLabel={`＋ ${t("add")}`} onAdd={() => setDraft((v) => ({ ...v, variables: [...v.variables, { key: "", value: "", secret: false }] }))}>{draft.variables.map((v, i) => <div className="builder-row variable-row" key={i}><input placeholder={t("key")} value={v.key} onChange={(e) => updateList("variables", i, { key: e.target.value })} /><input type={v.secret ? "password" : "text"} placeholder={t("value")} value={v.value} onChange={(e) => updateList("variables", i, { value: e.target.value })} /><label><input type="checkbox" checked={v.secret} onChange={(e) => updateList("variables", i, { secret: e.target.checked })} /> {t("secret")}</label><button onClick={() => removeList("variables", i)}>×</button></div>)}</BuilderSection><div className="review-card"><strong>{draft.name || "–"}</strong><span>{draft.image || "–"}</span><small>{draft.ports.length} {t("ports")} · {draft.volumes.length} {t("volumes")} · {draft.variables.length} {t("variables")}</small></div></div>}
      <div className="wizard-actions"><button className="cancel" disabled={createBusy} onClick={() => createStep === 1 ? setCreateOpen(false) : setCreateStep((v) => v - 1)}>{createStep === 1 ? t("cancel") : t("back")}</button>{createStep < 3 ? <button className="primary" disabled={createStep === 1 && (!draft.name || !draft.image)} onClick={continueCreate}>{t("next")}</button> : <button className="primary" disabled={createBusy} onClick={createContainer}>{createBusy ? t("loading") : t("create")}</button>}</div>
    </Modal>}
    {deleteTarget && <Modal onClose={() => setDeleteTarget(null)}><p className="eyebrow">{t("delete")}</p><h2>{t("deleteTitle")}</h2><p className="warning">{t("deleteWarning")}</p><label className="form-field"><span>{t("typeName")}: <b>{deleteTarget.name}</b></span><input autoFocus value={deleteForm.confirmation} onChange={(e) => setDeleteForm((v) => ({ ...v, confirmation: e.target.value }))} /></label><label className="check-field danger-check"><input type="checkbox" checked={deleteForm.deleteVolumes} onChange={(e) => setDeleteForm((v) => ({ ...v, deleteVolumes: e.target.checked }))} /> {t("deleteVolumes")}</label><div><button className="cancel" onClick={() => setDeleteTarget(null)}>{t("cancel")}</button><button className="danger solid" disabled={deleteForm.confirmation !== deleteTarget.name} onClick={removeContainer}>{t("delete")}</button></div></Modal>}
    {loginOpen && <div className="backdrop"><form className="dialog login-dialog" onSubmit={login}><p className="eyebrow">{t("adminRequired")}</p><h2>{t("login")}</h2>{loginError && <div className="login-error">{loginError}</div>}<label><span>{t("username")}</span><input autoFocus required autoComplete="username" value={loginForm.username} onChange={(e) => setLoginForm((v) => ({ ...v, username: e.target.value }))} /></label><label><span>{t("password")}</span><input type="password" required autoComplete="current-password" value={loginForm.password} onChange={(e) => setLoginForm((v) => ({ ...v, password: e.target.value }))} /></label><div className="login-actions"><button type="button" className="cancel" onClick={() => setLoginOpen(false)}>{t("cancel")}</button><button className="primary">{t("login")}</button></div></form></div>}
  </main>;
}

function Modal({ children, onClose, wide = false, extraWide = false }) { return <div className="backdrop" onMouseDown={onClose}><div className={`dialog ${wide ? "info-dialog" : ""} ${extraWide ? "builder-dialog" : ""}`} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>{children}</div></div>; }
function BuilderSection({ title, addLabel, onAdd, children }) { return <section className="builder-section"><div className="builder-heading"><h3>{title}</h3><button onClick={onAdd}>{addLabel}</button></div>{children}</section>; }

createRoot(document.getElementById("root")).render(<App />);
