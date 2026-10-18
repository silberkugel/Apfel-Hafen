import { useState } from "react";
import "./compose.css";

const copy = {
  de: {
    title: "Compose-Analyse", intro: "Mehrcontainerprojekte vor der Installation vollständig und ohne Änderungen prüfen.", composeFile: "Compose-Datei", envFile: ".env-Datei (optional)", choose: "Datei auswählen", paste: "Oder Inhalt einfügen", profiles: "Aktive Profile", profilesHelp: "Kommagetrennt, zum Beispiel frontend, monitoring", analyze: "Projekt analysieren", analyzing: "Analyse läuft …", login: "Für die Analyse als macOS-Administrator anmelden.", privacy: "Die Analyse ist nur lesend. Geheimniswerte werden nicht in das Ergebnis übernommen.", compatible: "Analyse bestanden", incompatible: "Vor der Ausführung zu klären", services: "Dienste", active: "aktiv", warnings: "Warnungen", errors: "Fehler", startOrder: "Ermittelte Startreihenfolge", diagnostics: "Kompatibilitätsbericht", noDiagnostics: "Keine Kompatibilitätsprobleme erkannt.", image: "Image", build: "Build erforderlich", dependencies: "Abhängigkeiten", ports: "Ports", volumes: "Volumes", networks: "Netzwerke", environment: "Variablen", healthcheck: "Healthcheck", enabled: "vorhanden", inactive: "durch Profile inaktiv", noValue: "–", readError: "Die Datei konnte nicht gelesen werden.", tooLarge: "Die Datei ist größer als 1 MB.", selected: "Ausgewählt",
  },
  en: {
    title: "Compose analysis", intro: "Inspect multi-container projects completely before installation, without making changes.", composeFile: "Compose file", envFile: ".env file (optional)", choose: "Choose file", paste: "Or paste content", profiles: "Active profiles", profilesHelp: "Comma-separated, for example frontend, monitoring", analyze: "Analyze project", analyzing: "Analyzing …", login: "Sign in as a macOS administrator to analyze.", privacy: "Analysis is read-only. Secret values are never included in the result.", compatible: "Analysis passed", incompatible: "Requires review before execution", services: "Services", active: "active", warnings: "Warnings", errors: "Errors", startOrder: "Calculated start order", diagnostics: "Compatibility report", noDiagnostics: "No compatibility issues detected.", image: "Image", build: "Build required", dependencies: "Dependencies", ports: "Ports", volumes: "Volumes", networks: "Networks", environment: "Variables", healthcheck: "Health check", enabled: "present", inactive: "inactive due to profiles", noValue: "–", readError: "The file could not be read.", tooLarge: "The file is larger than 1 MB.", selected: "Selected",
  },
};

async function selectedFile(event, setName, setValue, t, setError) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 1024 * 1024) { setError(t.tooLarge); return; }
  try { setValue(await file.text()); setName(file.name); setError(""); }
  catch { setError(t.readError); }
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
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function runAnalysis(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const data = await request("/api/compose/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ compose, env, profiles: profiles.split(",").map((item) => item.trim()).filter(Boolean) }) });
      setAnalysis(data.analysis); onAnalysis?.(data.analysis);
    } catch (reason) { setError(reason.message); setAnalysis(null); onAnalysis?.(null); }
    finally { setBusy(false); }
  }

  return <section className="panel compose-center">
    <div className="compose-heading"><div><h2>{t.title}</h2><p>{t.intro}</p></div><span>READ ONLY</span></div>
    <form className="compose-input" onSubmit={runAnalysis}>
      <div className="compose-files">
        <label className="compose-file"><strong>{t.composeFile}</strong><input type="file" accept=".yaml,.yml,text/yaml" onChange={(event) => selectedFile(event, setComposeName, setCompose, t, setError)} /><span>{t.choose}</span><small>{composeName ? `${t.selected}: ${composeName}` : "compose.yaml · docker-compose.yml"}</small></label>
        <label className="compose-file"><strong>{t.envFile}</strong><input type="file" accept=".env,text/plain" onChange={(event) => selectedFile(event, setEnvName, setEnv, t, setError)} /><span>{t.choose}</span><small>{envName ? `${t.selected}: ${envName}` : ".env"}</small></label>
      </div>
      <label className="compose-source"><span>{t.paste}</span><textarea value={compose} onChange={(event) => { setCompose(event.target.value); setComposeName(""); }} placeholder={"services:\n  web:\n    image: nginx:latest"} /></label>
      <div className="compose-options"><label><span>{t.profiles}</span><input value={profiles} onChange={(event) => setProfiles(event.target.value)} placeholder="frontend, monitoring" /><small>{t.profilesHelp}</small></label><button className="primary" disabled={!authenticated || !compose.trim() || busy}>{busy ? t.analyzing : t.analyze}</button></div>
      <p className="compose-privacy">⌾ {authenticated ? t.privacy : t.login}</p>
      {error && <div className="message error" role="alert">{error}</div>}
    </form>
    {analysis && <div className="compose-results">
      <div className={`compose-verdict ${analysis.compatible ? "ok" : "blocked"}`}><strong>{analysis.compatible ? `✓ ${t.compatible}` : `⚠ ${t.incompatible}`}</strong><span>{analysis.summary.services} {t.services} · {analysis.summary.activeServices} {t.active} · {analysis.summary.warnings} {t.warnings} · {analysis.summary.errors} {t.errors}</span></div>
      {analysis.startOrder.length > 0 && <section className="compose-order"><h3>{t.startOrder}</h3><ol>{analysis.startOrder.map((name) => <li key={name}><code>{name}</code></li>)}</ol></section>}
      <div className="compose-service-grid">{analysis.services.map((service) => <article className={service.active ? "" : "inactive"} key={service.name}><header><h3>{service.name}</h3>{!service.active && <span>{t.inactive}</span>}</header><dl><Detail label={t.image}>{service.image || (service.build ? t.build : t.noValue)}</Detail><Detail label={t.dependencies}>{service.dependsOn.join(", ")}</Detail><Detail label={t.ports}>{service.ports.join(", ")}</Detail><Detail label={t.volumes}>{service.volumes.map((volume) => `${volume.source || "bind"} → ${volume.target}${volume.readOnly ? " (ro)" : ""}`).join(", ")}</Detail><Detail label={t.networks}>{service.networks.join(", ")}</Detail><Detail label={t.environment}>{service.environment.map((item) => `${item.secret ? "🔒 " : ""}${item.name}`).join(", ")}</Detail><Detail label={t.healthcheck}>{service.healthcheck ? t.enabled : t.noValue}</Detail></dl></article>)}</div>
      <section className="compose-diagnostics"><h3>{t.diagnostics}</h3>{analysis.diagnostics.length ? <ul>{analysis.diagnostics.map((item, index) => <li className={item.level} key={`${item.code}-${index}`}><b>{item.level === "error" ? "!" : "i"}</b><span>{item.message}</span><code>{item.code}</code></li>)}</ul> : <p>✓ {t.noDiagnostics}</p>}</section>
    </div>}
  </section>;
}
