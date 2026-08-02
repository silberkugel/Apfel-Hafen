import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { initialLanguage, languageNames, supportedLanguages, translate } from "./i18n.js";

const webPorts = new Set([80, 443, 3000, 3001, 5678, 7070, 8080, 8443, 8888, 8889]);

function formatMemory(bytes, locale) {
  if (!bytes) return "–";
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toLocaleString(locale, { maximumFractionDigits: 1 })} GB`;
  return `${Math.round(bytes / 1048576)} MB`;
}

function portUrl(port) {
  if (port.protocol !== "tcp" || !webPorts.has(port.hostPort)) return null;
  const scheme = port.hostPort === 443 || port.hostPort === 8443 ? "https" : "http";
  const host = window.location.hostname || "127.0.0.1";
  return `${scheme}://${host}:${port.hostPort}`;
}

function App() {
  const [language, setLanguage] = useState(() => initialLanguage(window.localStorage, navigator.language));
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [info, setInfo] = useState(null);
  const [updates, setUpdates] = useState({});
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [auth, setAuth] = useState({ authenticated: false });
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [administrationOpen, setAdministrationOpen] = useState(false);
  const [administration, setAdministration] = useState({ loading: false, saving: false, enabled: false, error: "" });
  const accountMenuRef = useRef(null);
  const t = (key, values) => translate(language, key, values);
  const labels = { start: t("start"), stop: t("stop"), restart: t("restart"), replace: t("replace") };
  const locale = language === "en" ? "en-US" : "de-DE";

  function apiFetch(url, options = {}) {
    return fetch(url, { ...options, headers: { ...options.headers, "X-App-Language": language } });
  }

  function changeLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("containerzentrale.language", nextLanguage);
  }

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t("appName");
  }, [language]);

  async function loadSession() {
    try {
      const response = await apiFetch("/api/auth/session");
      setAuth(await response.json());
    } catch {
      setAuth({ authenticated: false });
    }
  }

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/containers");
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setAuth({ authenticated: false });
        throw new Error(data.error);
      }
      setContainers(data.containers);
      setRefreshedAt(new Date(data.refreshedAt));
    } catch (err) {
      setError(err.message || t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); loadSession(); }, [language]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const closeMenu = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  async function login(event) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAuth(data);
      setLoginForm({ username: "", password: "" });
      setLoginOpen(false);
      setNotice(t("signedInAs", { name: data.displayName || data.username }));
    } catch (err) {
      setLoginError(err.message || t("loginFailed"));
      setLoginForm((current) => ({ ...current, password: "" }));
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    setAccountMenuOpen(false);
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAuth({ authenticated: false });
    setUpdates({});
    setNotice(t("signedOut"));
  }

  async function openAdministration() {
    setAccountMenuOpen(false);
    setAdministrationOpen(true);
    setAdministration((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await apiFetch("/api/administration/autostart");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAdministration({ loading: false, saving: false, enabled: data.enabled, error: "" });
    } catch (err) {
      setAdministration((current) => ({ ...current, loading: false, error: err.message || t("settingLoadFailed") }));
    }
  }

  async function changeAutostart() {
    const enabled = !administration.enabled;
    setAdministration((current) => ({ ...current, saving: true, error: "" }));
    try {
      const response = await apiFetch("/api/administration/autostart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setAuth({ authenticated: false });
        throw new Error(data.error);
      }
      setAdministration({ loading: false, saving: false, enabled: data.enabled, error: "" });
    } catch (err) {
      setAdministration((current) => ({ ...current, saving: false, error: err.message || t("settingSaveFailed") }));
    }
  }

  async function execute() {
    const { container, action } = confirm;
    setConfirm(null);
    setBusy(`${container.name}:${action}`);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`/api/containers/${encodeURIComponent(container.name)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: container.name }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setAuth({ authenticated: false });
        throw new Error(data.error);
      }
      setNotice(`${container.name}: ${data.message}`);
      if (action === "replace") setUpdates((current) => ({ ...current, [container.name]: undefined }));
      await load(true);
    } catch (err) {
      setError(err.message || t("actionFailed"));
    } finally {
      setBusy("");
    }
  }

  async function checkUpdate(container) {
    if (!auth.authenticated) {
      setLoginOpen(true);
      return;
    }
    setBusy(`${container.name}:update-check`);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`/api/containers/${encodeURIComponent(container.name)}/update-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: container.name }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setAuth({ authenticated: false });
        throw new Error(data.error);
      }
      setUpdates((current) => ({ ...current, [container.name]: data }));
      setNotice(data.available ? t("newImageAvailable", { name: container.name }) : t("imageCurrent", { name: container.name }));
    } catch (err) {
      setError(err.message || t("updateCheckFailed"));
    } finally {
      setBusy("");
    }
  }

  const filtered = useMemo(
    () => containers.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [containers, query],
  );
  const running = containers.filter((item) => item.status === "running").length;

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="mark">C</span><span>{t("appName")}</span></div>
        <div className="topbar-tools">
          <label className="language-select">
            <span>{t("language")}</span>
            <select value={language} onChange={(event) => changeLanguage(event.target.value)} aria-label={t("language")}>
              {supportedLanguages.map((code) => <option key={code} value={code}>{languageNames[code]}</option>)}
            </select>
          </label>
          <div className="local"><span /> {t("localOnly")}</div>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">MACOS 26 · APPLE CONTAINER</p>
          <h1>{t("heroTitle")}<br /><em>{t("heroAccent")}</em></h1>
          <p className="intro">{t("intro")}</p>
        </div>
        <div className="hero-aside">
          <div className="account-menu" ref={accountMenuRef}>
            <button className={`account-button ${auth.authenticated ? "authenticated" : ""}`} onClick={auth.authenticated ? () => setAccountMenuOpen((open) => !open) : () => setLoginOpen(true)} title={auth.authenticated ? t("openUserMenu") : t("loginAsAdmin")} aria-haspopup={auth.authenticated ? "menu" : undefined} aria-expanded={auth.authenticated ? accountMenuOpen : undefined}>
              <span>{auth.authenticated ? "●" : "○"}</span>{auth.authenticated ? (auth.displayName || auth.username) : t("login")}{auth.authenticated && <b aria-hidden="true">⌄</b>}
            </button>
            {auth.authenticated && accountMenuOpen && <div className="account-dropdown" role="menu">
              <button role="menuitem" onClick={openAdministration}>{t("administration")}</button>
              <a role="menuitem" href="https://github.com/silberkugel/apple-container-manager#readme" target="_blank" rel="noreferrer" onClick={() => setAccountMenuOpen(false)}>{t("documentation")}</a>
              <button role="menuitem" className="logout-item" onClick={logout}>{t("logout")}</button>
            </div>}
          </div>
          <div className="summary" aria-label={t("summary")}>
            <div><strong>{containers.length}</strong><span>{t("total")}</span></div>
            <div><strong>{running}</strong><span>{t("active")}</span></div>
            <div><strong>{containers.length - running}</strong><span>{t("inactive")}</span></div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="toolbar">
          <label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} /></label>
          <button className="refresh" onClick={() => load()} disabled={loading}>↻ <span>{loading ? t("loading") : t("reload")}</span></button>
        </div>

        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message success" role="status">{notice}</div>}

        <div className="section-title"><h2>{t("containers")}</h2><span>{refreshedAt ? t("asOf", { time: refreshedAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) }) : t("notLoaded")}</span></div>

        <div className="list">
          {loading && !containers.length ? <div className="empty">{t("loadingContainers")}</div> : filtered.map((container) => (
            <article className={`row ${updates[container.name]?.available ? "has-update" : ""}`} key={container.name}>
              <div className="identity">
                <div className={`cube ${container.status}`}>◇</div>
                <div><h3>{container.name}{updates[container.name]?.available && <span className="update-badge">{t("updateAvailable")}</span>}</h3><p><i className={container.status} />{container.status === "running" ? t("running") : t("stopped")}{container.image ? ` · ${container.image}` : ""}</p></div>
              </div>
              <div className="actions">
                <button className="info-button" onClick={() => setInfo(container)}>ⓘ <span>{t("info")}</span></button>
                {container.status !== "running" && <button disabled={!auth.authenticated} title={!auth.authenticated ? t("adminRequired") : ""} onClick={() => setConfirm({ container, action: "start" })}>▶ <span>{t("start")}</span></button>}
                {container.status === "running" && <button disabled={!auth.authenticated} title={!auth.authenticated ? t("adminRequired") : ""} onClick={() => setConfirm({ container, action: "stop" })}>■ <span>{t("stop")}</span></button>}
                <button disabled={!auth.authenticated} title={!auth.authenticated ? t("adminRequired") : ""} onClick={() => setConfirm({ container, action: "restart" })}>↻ <span>{t("restart")}</span></button>
                <button disabled={!auth.authenticated} title={!auth.authenticated ? t("adminRequired") : ""} onClick={() => checkUpdate(container)}>↓ <span>{t("checkUpdate")}</span></button>
                {updates[container.name]?.available && <button disabled={!auth.authenticated} className="replace" onClick={() => setConfirm({ container, action: "replace", update: updates[container.name] })}>⇄ <span>{t("replaceShort")}</span></button>}
              </div>
              {busy.startsWith(`${container.name}:`) && <div className="working">{busy.endsWith("update-check") ? t("checkingImage") : t("actionRunning")}</div>}
            </article>
          ))}
          {!loading && !filtered.length && <div className="empty">{t("noMatches")}</div>}
        </div>
      </section>

      <footer><span>{t("systemService")}</span><span>{t("connection")}</span></footer>

      {confirm && <div className="backdrop" onMouseDown={() => setConfirm(null)}>
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(e) => e.stopPropagation()}>
          <span className="dialog-icon">◇</span>
          <p className="eyebrow">{t("confirmAction").toUpperCase()}</p>
          <h2 id="dialog-title">{labels[confirm.action]}?</h2>
          {confirm.action === "replace" ? <>
            <p>{t("replaceDescription", { name: confirm.container.name })}</p>
            <dl className="replace-summary">
              <div><dt>{t("mounts")}</dt><dd>{confirm.update.summary.mounts}</dd></div>
              <div><dt>{t("ports")}</dt><dd>{confirm.update.summary.ports}</dd></div>
              <div><dt>{t("variables")}</dt><dd>{confirm.update.summary.environment}</dd></div>
            </dl>
            <p className="warning">{t("dataWarning")}</p>
          </> : <p>{t("lifecycleDescription", { name: confirm.container.name, action: labels[confirm.action].toLowerCase() })}</p>}
          <div><button className="cancel" onClick={() => setConfirm(null)}>{t("cancel")}</button><button className="primary" onClick={execute}>{labels[confirm.action]}</button></div>
        </div>
      </div>}

      {info && <div className="backdrop" onMouseDown={() => setInfo(null)}>
        <div className="dialog info-dialog" role="dialog" aria-modal="true" aria-labelledby="info-title" onMouseDown={(event) => event.stopPropagation()}>
          <span className="dialog-icon">ⓘ</span>
          <p className="eyebrow">{t("containerInformation").toUpperCase()}</p>
          <h2 id="info-title">{info.name}</h2>
          <dl className="info-grid">
            <div><dt>{t("containerName")}</dt><dd>{info.name}</dd></div>
            <div><dt>{t("image")}</dt><dd>{info.image || "–"}</dd></div>
            <div><dt>{t("memory")}</dt><dd>{formatMemory(info.memoryInBytes, locale)}</dd></div>
            <div><dt>{t("cpuCores")}</dt><dd>{info.cpus ?? "–"}</dd></div>
          </dl>

          <section className="info-section">
            <h3>{t("mounts")}</h3>
            {info.volumes.length ? <ul>{info.volumes.map((volume, index) => <li key={`${volume.source}-${index}`}><code>{volume.source}</code><span>→</span><code>{volume.destination}</code>{volume.readOnly && <small>{t("readOnly")}</small>}</li>)}</ul> : <p>{t("noVolumes")}</p>}
          </section>

          <section className="info-section">
            <h3>{t("portsAndAccess")}</h3>
            {info.ports.length ? <ul>{info.ports.map((port, index) => {
              const url = portUrl(port);
              return <li key={`${port.hostPort}-${port.containerPort}-${index}`}><code>{port.hostAddress || "0.0.0.0"}:{port.hostPort}</code><span>→</span><code>{port.containerPort}/{port.protocol}</code>{url && <a href={url} target="_blank" rel="noreferrer">{t("open")}</a>}</li>;
            })}</ul> : <p>{t("noPorts")}</p>}
          </section>

          <div className="info-close"><button className="primary" onClick={() => setInfo(null)}>{t("close")}</button></div>
        </div>
      </div>}

      {administrationOpen && <div className="backdrop" onMouseDown={() => !administration.saving && setAdministrationOpen(false)}>
        <div className="dialog administration-dialog" role="dialog" aria-modal="true" aria-labelledby="administration-title" onMouseDown={(event) => event.stopPropagation()}>
          <span className="dialog-icon">⚙</span>
          <p className="eyebrow">{t("systemSettings").toUpperCase()}</p>
          <h2 id="administration-title">{t("administration")}</h2>
          <p>{t("administrationDescription")}</p>
          {administration.error && <div className="login-error" role="alert">{administration.error}</div>}
          <section className="setting-row">
            <div>
              <strong>{t("autoStart")}</strong>
              <span>{t("autoStartDescription")}</span>
              <p className={`setting-status ${administration.enabled ? "enabled" : ""}`}>{administration.loading ? t("statusLoading") : administration.saving ? t("settingSaving") : administration.enabled ? t("autoStartEnabled") : t("autoStartDisabled")}</p>
            </div>
            <button type="button" className={`switch ${administration.enabled ? "on" : ""}`} role="switch" aria-checked={administration.enabled} aria-label={t("toggleAutoStart")} disabled={administration.loading || administration.saving} onClick={changeAutostart}><i /></button>
          </section>
          <div className="administration-actions"><button className="primary" disabled={administration.saving} onClick={() => setAdministrationOpen(false)}>{t("close")}</button></div>
        </div>
      </div>}

      {loginOpen && <div className="backdrop" onMouseDown={() => !loginBusy && setLoginOpen(false)}>
        <form className="dialog login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title" onSubmit={login} onMouseDown={(event) => event.stopPropagation()}>
          <span className="dialog-icon">⌾</span>
          <p className="eyebrow">{t("protectedAdministration").toUpperCase()}</p>
          <h2 id="login-title">{t("adminLogin")}</h2>
          <p>{t("loginDescription")}</p>
          {loginError && <div className="login-error" role="alert">{loginError}</div>}
          <label><span>{t("username")}</span><input autoFocus autoComplete="username" required value={loginForm.username} onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))} /></label>
          <label><span>{t("password")}</span><input type="password" autoComplete="current-password" required value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} /></label>
          <div className="login-actions"><button type="button" className="cancel" disabled={loginBusy} onClick={() => setLoginOpen(false)}>{t("cancel")}</button><button className="primary" disabled={loginBusy}>{loginBusy ? t("checking") : t("login")}</button></div>
        </form>
      </div>}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
