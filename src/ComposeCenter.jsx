import { useEffect, useState } from "react";
import "./compose.css";

const copy = {
  de: {
    title: "Compose-Analyse", intro: "Mehrcontainerprojekte vor der Installation vollständig und ohne Änderungen prüfen.", projectFolder: "Projektordner", folderHelp: "Compose und .env gemeinsam erkennen", folderMissing: "Im gewählten Ordner wurde keine Compose-Datei gefunden.", composeFile: "Compose-Datei", envFile: ".env-Datei (optional)", choose: "Auswählen", openCodeProject: "OpenCode-Projekt", loadProject: "Projekt laden", loadingProject: "Projekt wird geladen …", remoteHelp: "Öffentliche Projektadresse, zum Beispiel gitlab.opencode.de/opentalk/ot-setup", loadedFrom: "Geladen aus", paste: "Oder Inhalt einfügen", profiles: "Aktive Profile", profilesHelp: "Kommagetrennt, zum Beispiel frontend, monitoring", analyze: "Projekt analysieren", analyzing: "Analyse läuft …", login: "Für die Analyse als macOS-Administrator anmelden.", privacy: "Die Analyse ist nur lesend. Geheimniswerte werden nicht in das Ergebnis übernommen.", compatible: "Analyse bestanden", incompatible: "Vor der Ausführung zu klären", services: "Dienste", active: "aktiv", warnings: "Warnungen", errors: "Fehler", information: "Hinweise", startOrder: "Ermittelte Startreihenfolge", diagnostics: "Kompatibilitätsbericht", noDiagnostics: "Keine Kompatibilitätsprobleme erkannt.", image: "Image", build: "Build erforderlich", dependencies: "Abhängigkeiten", ports: "Ports", volumes: "Volumes", networks: "Netzwerke", environment: "Variablen", extraEnv: "Weitere env-Dateien", healthcheck: "Healthcheck", restart: "Neustartregel", resources: "Ressourcen", platform: "Plattform", enabled: "vorhanden", inactive: "durch Profile inaktiv", noValue: "–", readError: "Die Datei konnte nicht gelesen werden.", tooLarge: "Die Datei ist größer als 1 MB.", selected: "Ausgewählt", stackName: "Stack-Name", createPlan: "Ausführungsplan erstellen", planning: "Plan wird erstellt …", planTitle: "Stack-Ausführungsplan", planReady: "Bereit für die spätere Ausführung", planBlocked: "Ausführung bleibt gesperrt", planReadOnly: "Dieser Schritt zeigt nur den Plan und verändert noch keine Container.", planId: "Plan-ID", createOrder: "Container anlegen und starten", stopOrder: "Container stoppen", decisions: "Offene Entscheidungen", preflight: "Auf diesem Mac vorab prüfen", preflighting: "Mac wird geprüft …", preflightTitle: "Vorabprüfung", preflightReady: "Keine lokalen Konflikte erkannt", preflightBlocked: "Lokale Konflikte gefunden", existingContainers: "Vorhandene Container", publishedPorts: "Geplante Portfreigaben",
  },
  en: {
    title: "Compose analysis", intro: "Inspect multi-container projects completely before installation, without making changes.", projectFolder: "Project folder", folderHelp: "Detect Compose and .env together", folderMissing: "No Compose file was found in the selected folder.", composeFile: "Compose file", envFile: ".env file (optional)", choose: "Choose", openCodeProject: "OpenCode project", loadProject: "Load project", loadingProject: "Loading project …", remoteHelp: "Public project URL, for example gitlab.opencode.de/opentalk/ot-setup", loadedFrom: "Loaded from", paste: "Or paste content", profiles: "Active profiles", profilesHelp: "Comma-separated, for example frontend, monitoring", analyze: "Analyze project", analyzing: "Analyzing …", login: "Sign in as a macOS administrator to analyze.", privacy: "Analysis is read-only. Secret values are never included in the result.", compatible: "Analysis passed", incompatible: "Requires review before execution", services: "Services", active: "active", warnings: "Warnings", errors: "Errors", information: "Information", startOrder: "Calculated start order", diagnostics: "Compatibility report", noDiagnostics: "No compatibility issues detected.", image: "Image", build: "Build required", dependencies: "Dependencies", ports: "Ports", volumes: "Volumes", networks: "Networks", environment: "Variables", extraEnv: "Additional env files", healthcheck: "Health check", restart: "Restart policy", resources: "Resources", platform: "Platform", enabled: "present", inactive: "inactive due to profiles", noValue: "–", readError: "The file could not be read.", tooLarge: "The file is larger than 1 MB.", selected: "Selected", stackName: "Stack name", createPlan: "Create execution plan", planning: "Creating plan …", planTitle: "Stack execution plan", planReady: "Ready for later execution", planBlocked: "Execution remains blocked", planReadOnly: "This step only shows the plan and does not change any containers.", planId: "Plan ID", createOrder: "Create and start containers", stopOrder: "Stop containers", decisions: "Open decisions", preflight: "Preflight on this Mac", preflighting: "Checking Mac …", preflightTitle: "Preflight check", preflightReady: "No local conflicts detected", preflightBlocked: "Local conflicts detected", existingContainers: "Existing containers", publishedPorts: "Planned published ports",
  },
};

Object.assign(copy.de, { installStack: "Stack jetzt installieren", installingStack: "Stack wird installiert …", installWarning: "Die geprüften Container und Datenordner werden jetzt angelegt und gestartet.", installDone: "Stack wurde sicher installiert.", managedStacks: "Installierte Stacks", runningServices: "laufende Dienste", startStack: "Starten", stopStack: "Stoppen", recoveryPending: "Wiederanlauf nötig", diagnoseStack: "Diagnose", backupStack: "Sichern", restoreStack: "Letzte Sicherung", restoreWarning: "Der Stack wird gestoppt und auf den letzten gesicherten Stand zurückgesetzt. Fortfahren?", stackHealthy: "Betrieb ist in Ordnung", backupDone: "Sicherung wurde angelegt" });
Object.assign(copy.en, { installStack: "Install stack now", installingStack: "Installing stack …", installWarning: "The checked containers and data folders will now be created and started.", installDone: "Stack was installed safely.", managedStacks: "Installed stacks", runningServices: "running services", startStack: "Start", stopStack: "Stop", recoveryPending: "Recovery required", diagnoseStack: "Diagnose", backupStack: "Back up", restoreStack: "Latest backup", restoreWarning: "The stack will stop and return to its latest backed-up state. Continue?", stackHealthy: "Operation is healthy", backupDone: "Backup created" });

async function selectedFile(event, setName, setValue, t, setError, reset) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 1024 * 1024) { setError(t.tooLarge); return; }
  try { setValue(await file.text()); setName(file.name); setError(""); reset?.(); }
  catch { setError(t.readError); }
}

async function selectedProject(event, setters, t, setError, reset) {
  const files = [...(event.target.files || [])];
  const composeNames = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"];
  const candidates = files.filter((file) => composeNames.includes(file.name.toLowerCase())).sort((left, right) => {
    const leftPath = left.webkitRelativePath || left.name;
    const rightPath = right.webkitRelativePath || right.name;
    return leftPath.split("/").length - rightPath.split("/").length || composeNames.indexOf(left.name.toLowerCase()) - composeNames.indexOf(right.name.toLowerCase());
  });
  const composeFile = candidates[0];
  if (!composeFile) { setError(t.folderMissing); return; }
  if (composeFile.size > 1024 * 1024) { setError(t.tooLarge); return; }
  const composePath = composeFile.webkitRelativePath || composeFile.name;
  const composeDirectory = composePath.includes("/") ? composePath.slice(0, composePath.lastIndexOf("/") + 1) : "";
  const envFile = files.find((file) => (file.webkitRelativePath || file.name) === `${composeDirectory}.env`) || files.find((file) => file.name === ".env");
  if (envFile && envFile.size > 1024 * 1024) { setError(t.tooLarge); return; }
  try {
    setters.setCompose(await composeFile.text());
    setters.setComposeName(composePath);
    setters.setEnv(envFile ? await envFile.text() : "");
    setters.setEnvName(envFile ? (envFile.webkitRelativePath || envFile.name) : "");
    setters.setOrigin(composePath.split("/")[0] || composeFile.name);
    setError("");
    reset?.();
  } catch { setError(t.readError); }
}

function Detail({ label, children }) {
  return <div><dt>{label}</dt><dd>{children || "–"}</dd></div>;
}

export default function ComposeCenter({ request, language, authenticated, onAnalysis }) {
  const t = copy[language] || copy.de;
  const [compose, setCompose] = useState("");
  const [env, setEnv] = useState("");
  const [composeName, setComposeName] = useState("");
  const [envName, setEnvName] = useState("");
  const [profiles, setProfiles] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [origin, setOrigin] = useState("");
  const [adapter, setAdapter] = useState(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [plan, setPlan] = useState(null);
  const [preflight, setPreflight] = useState(null);
  const [stackName, setStackName] = useState("");
  const [busy, setBusy] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [installed, setInstalled] = useState("");
  const [stacks, setStacks] = useState([]);
  const [stackBusy, setStackBusy] = useState("");
  const [stackNotice, setStackNotice] = useState("");
  const [error, setError] = useState("");

  async function loadStacks() {
    if (!authenticated) { setStacks([]); return; }
    try { setStacks((await request("/api/stacks"))?.stacks || []); } catch { setStacks([]); }
  }
  useEffect(() => { loadStacks(); }, [authenticated]);

  async function changeStack(name, action) {
    setStackBusy(name); setError("");
    try { await request(`/api/stacks/${encodeURIComponent(name)}/${action}`, { method: "POST" }); await loadStacks(); }
    catch (reason) { setError(reason.message); }
    finally { setStackBusy(""); }
  }

  async function safetyAction(name, action) {
    if (action === "restore" && !window.confirm(t.restoreWarning)) return;
    setStackBusy(name); setError(""); setStackNotice("");
    try {
      const data = await request(`/api/stacks/${encodeURIComponent(name)}/${action}`, { method: ["backup", "restore"].includes(action) ? "POST" : "GET" });
      if (["backup", "restore"].includes(action)) setStackNotice(`${name}: ${data.message || t.backupDone}`);
      else setStackNotice(`${name}: ${data.diagnosis?.healthy ? t.stackHealthy : `${data.diagnosis?.actions?.length || 0} ${t.recoveryPending}`}`);
      await loadStacks();
    } catch (reason) { setError(reason.message); }
    finally { setStackBusy(""); }
  }

  function clearResults() {
    setAnalysis(null); setPlan(null); setPreflight(null); onAnalysis?.(null);
  }

  async function runAnalysis(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const data = await request("/api/compose/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ compose, env, profiles: profiles.split(",").map((item) => item.trim()).filter(Boolean) }) });
      setAnalysis(data.analysis); setPlan(null); setPreflight(null); setStackName((current) => current || data.analysis.project?.name || "compose"); onAnalysis?.(data.analysis);
    } catch (reason) { setError(reason.message); setAnalysis(null); onAnalysis?.(null); }
    finally { setBusy(false); }
  }

  async function createPlan() {
    setPlanBusy(true); setError("");
    try {
      const data = await request("/api/compose/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ compose, env, profiles: profiles.split(",").map((item) => item.trim()).filter(Boolean), stackName }) });
      setPlan(data.plan); setPreflight(null);
    } catch (reason) { setError(reason.message); setPlan(null); }
    finally { setPlanBusy(false); }
  }

  async function runPreflight() {
    setPreflightBusy(true); setError("");
    try {
      const data = await request("/api/compose/preflight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ compose, env, profiles: profiles.split(",").map((item) => item.trim()).filter(Boolean), stackName }) });
      setPlan(data.plan); setPreflight(data.preflight);
    } catch (reason) { setError(reason.message); setPreflight(null); }
    finally { setPreflightBusy(false); }
  }

  async function installStack() {
    if (!preflight?.ready || !window.confirm(t.installWarning)) return;
    setInstallBusy(true); setError(""); setInstalled("");
    try {
      const data = await request("/api/stacks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ compose, env, profiles: profiles.split(",").map((item) => item.trim()).filter(Boolean), stackName, planId: plan.planId }) });
      setInstalled(data.message || t.installDone); await loadStacks();
    } catch (reason) { setError(reason.message); }
    finally { setInstallBusy(false); }
  }

  async function loadOpenCodeProject() {
    setSourceBusy(true); setError("");
    try {
      const data = await request("/api/compose/source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: projectUrl }) });
      setCompose(data.source.compose); setComposeName(data.source.composeName);
      setEnv(data.source.env || ""); setEnvName(data.source.envName || "");
      setOrigin(`${data.source.projectName} · ${data.source.ref}`);
      setAdapter(data.source.adapter || null);
      if (data.source.adapter?.defaultProfiles?.length) setProfiles(data.source.adapter.defaultProfiles.join(", "));
      setAnalysis(null); setPlan(null); setPreflight(null); setStackName(""); onAnalysis?.(null);
    } catch (reason) { setError(reason.message); }
    finally { setSourceBusy(false); }
  }

  return <section className="panel compose-center">
    <div className="compose-heading"><div><h2>{t.title}</h2><p>{t.intro}</p></div><span>READ ONLY</span></div>
    {stacks.length > 0 && <section className="compose-stacks"><h3>{t.managedStacks}</h3>{stacks.map((stack) => <article key={stack.stackName}><div><strong>{stack.stackName}</strong><small>{stack.running}/{stack.total} {t.runningServices}{stack.recovery?.length ? ` · ${t.recoveryPending}` : ""}</small></div><div className="button-row"><button type="button" disabled={stackBusy === stack.stackName || stack.running === stack.total} onClick={() => changeStack(stack.stackName, "start")}>{t.startStack}</button><button type="button" disabled={stackBusy === stack.stackName || stack.running === 0} onClick={() => changeStack(stack.stackName, "stop")}>{t.stopStack}</button><button type="button" disabled={stackBusy === stack.stackName} onClick={() => safetyAction(stack.stackName, "diagnose")}>{t.diagnoseStack}</button><button type="button" disabled={stackBusy === stack.stackName} onClick={() => safetyAction(stack.stackName, "backup")}>{t.backupStack}</button><button type="button" disabled={stackBusy === stack.stackName} onClick={() => safetyAction(stack.stackName, "restore")}>{t.restoreStack}</button></div></article>)}{stackNotice && <p className="message success">✓ {stackNotice}</p>}</section>}
    <form className="compose-input" onSubmit={runAnalysis}>
      <div className="compose-files">
        <label className="compose-file"><strong>{t.projectFolder}</strong><input type="file" webkitdirectory="" directory="" multiple onChange={(event) => selectedProject(event, { setCompose, setComposeName, setEnv, setEnvName, setOrigin }, t, setError, clearResults)} /><span>{t.choose}</span><small>{t.folderHelp}</small></label>
        <label className="compose-file"><strong>{t.composeFile}</strong><input type="file" accept=".yaml,.yml,text/yaml" onChange={(event) => selectedFile(event, setComposeName, setCompose, t, setError, clearResults)} /><span>{t.choose}</span><small>{composeName ? `${t.selected}: ${composeName}` : "compose.yaml · docker-compose.yml"}</small></label>
        <label className="compose-file"><strong>{t.envFile}</strong><input type="file" accept=".env,text/plain" onChange={(event) => selectedFile(event, setEnvName, setEnv, t, setError, clearResults)} /><span>{t.choose}</span><small>{envName ? `${t.selected}: ${envName}` : ".env"}</small></label>
      </div>
      <div className="compose-remote"><label><span>{t.openCodeProject}</span><input value={projectUrl} onChange={(event) => setProjectUrl(event.target.value)} placeholder="https://gitlab.opencode.de/opentalk/ot-setup" /><small>{t.remoteHelp}</small></label><button type="button" disabled={!authenticated || projectUrl.trim().length < 3 || sourceBusy} onClick={loadOpenCodeProject}>{sourceBusy ? t.loadingProject : t.loadProject}</button></div>
      {origin && <p className="compose-origin">{t.loadedFrom}: <strong>{origin}</strong></p>}
      {adapter && <div className="compose-adapter"><strong>{adapter.label}</strong><span>{adapter.notice}</span></div>}
      <label className="compose-source"><span>{t.paste}</span><textarea value={compose} onChange={(event) => { setCompose(event.target.value); setComposeName(""); clearResults(); }} placeholder={"services:\n  web:\n    image: nginx:latest"} /></label>
      <div className="compose-options"><label><span>{t.profiles}</span><input value={profiles} onChange={(event) => { setProfiles(event.target.value); clearResults(); }} placeholder="frontend, monitoring" /><small>{t.profilesHelp}</small></label><button className="primary" disabled={!authenticated || !compose.trim() || busy}>{busy ? t.analyzing : t.analyze}</button></div>
      <p className="compose-privacy">⌾ {authenticated ? t.privacy : t.login}</p>
      {error && <div className="message error" role="alert">{error}</div>}
    </form>
    {analysis && <div className="compose-results">
      <div className={`compose-verdict ${analysis.compatible ? "ok" : "blocked"}`}><strong>{analysis.compatible ? `✓ ${t.compatible}` : `⚠ ${t.incompatible}`}</strong><span>{analysis.summary.services} {t.services} · {analysis.summary.activeServices} {t.active} · {analysis.summary.warnings} {t.warnings} · {analysis.summary.errors} {t.errors} · {analysis.summary.information || 0} {t.information}</span></div>
      <section className="compose-plan-action"><label><span>{t.stackName}</span><input value={stackName} onChange={(event) => { setStackName(event.target.value); setPlan(null); setPreflight(null); }} /></label><button type="button" className="primary" disabled={!authenticated || !stackName.trim() || planBusy} onClick={createPlan}>{planBusy ? t.planning : t.createPlan}</button><small>{t.planReadOnly}</small></section>
      {plan && <section className={`compose-plan ${plan.ready ? "ready" : "blocked"}`}><header><div><h3>{t.planTitle}</h3><strong>{plan.ready ? `✓ ${t.planReady}` : `⚠ ${t.planBlocked}`}</strong></div><code>{t.planId}: {plan.planId}</code></header><div className="compose-plan-columns"><div><h4>{t.networks}</h4><ul>{plan.phases.networks.map((item) => <li key={item.composeName}><code>{item.composeName}</code><span>→</span><code>{item.runtimeName}</code></li>)}</ul><h4>{t.volumes}</h4><ul>{plan.phases.volumes.map((item) => <li key={item.composeName}><code>{item.composeName}</code><span>→</span><code>{item.runtimeName}</code></li>)}</ul></div><div><h4>{t.createOrder}</h4><ol>{plan.phases.start.map((name) => <li key={name}><code>{name}</code></li>)}</ol><h4>{t.stopOrder}</h4><ol>{plan.phases.stop.map((name) => <li key={name}><code>{name}</code></li>)}</ol></div></div>{plan.decisions.length > 0 && <div className="compose-plan-decisions"><h4>{t.decisions}</h4><ul>{plan.decisions.map((item, index) => <li key={`${item.code}-${index}`}><span>{item.message}</span><code>{item.code}</code></li>)}</ul></div>}<button type="button" className="compose-preflight-button" disabled={!plan.ready || preflightBusy} onClick={runPreflight}>{preflightBusy ? t.preflighting : t.preflight}</button></section>}
      {preflight && <section className={`compose-preflight ${preflight.ready ? "ready" : "blocked"}`}><h3>{t.preflightTitle}</h3><strong>{preflight.ready ? `✓ ${t.preflightReady}` : `⚠ ${t.preflightBlocked}`}</strong><p>{preflight.checks.existingContainers} {t.existingContainers} · {preflight.checks.plannedContainers} {t.services} · {preflight.checks.publishedPorts} {t.publishedPorts}</p>{preflight.conflicts.length > 0 && <ul>{preflight.conflicts.map((item, index) => <li key={`${item.code}-${index}`}><span>{item.message}</span><code>{item.code}</code></li>)}</ul>}{preflight.ready && <button type="button" className="primary compose-install-button" disabled={installBusy} onClick={installStack}>{installBusy ? t.installingStack : t.installStack}</button>}{installed && <p className="message success">✓ {installed}</p>}</section>}
      {analysis.startOrder.length > 0 && <section className="compose-order"><h3>{t.startOrder}</h3><ol>{analysis.startOrder.map((name) => <li key={name}><code>{name}</code></li>)}</ol></section>}
      <div className="compose-service-grid">{analysis.services.map((service) => <article className={service.active ? "" : "inactive"} key={service.name}><header><h3>{service.name}</h3>{!service.active && <span>{t.inactive}</span>}</header><dl><Detail label={t.image}>{service.image || (service.build ? t.build : t.noValue)}</Detail><Detail label={t.dependencies}>{service.dependsOn.join(", ")}</Detail><Detail label={t.ports}>{service.ports.join(", ")}</Detail><Detail label={t.volumes}>{service.volumes.map((volume) => `${volume.source || "bind"} → ${volume.target}${volume.readOnly ? " (ro)" : ""}`).join(", ")}</Detail><Detail label={t.networks}>{service.networks.join(", ")}</Detail><Detail label={t.environment}>{service.environment.map((item) => `${item.secret ? "🔒 " : ""}${item.name}`).join(", ")}</Detail><Detail label={t.extraEnv}>{service.envFiles.join(", ")}</Detail><Detail label={t.healthcheck}>{service.healthcheck ? t.enabled : t.noValue}</Detail><Detail label={t.restart}>{service.restart}</Detail><Detail label={t.resources}>{[service.resources.cpus && `${service.resources.cpus} CPU`, service.resources.memory].filter(Boolean).join(" · ")}</Detail><Detail label={t.platform}>{service.platform}</Detail></dl></article>)}</div>
      <section className="compose-diagnostics"><h3>{t.diagnostics}</h3>{analysis.diagnostics.length ? <ul>{analysis.diagnostics.map((item, index) => <li className={item.level} key={`${item.code}-${index}`}><b>{item.level === "error" ? "!" : "i"}</b><span>{item.message}</span><code>{item.code}</code></li>)}</ul> : <p>✓ {t.noDiagnostics}</p>}</section>
    </div>}
  </section>;
}
