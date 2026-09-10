import React, { useEffect, useMemo, useRef, useState } from "react";
import LiveLogViewer from "./LiveLogViewer.jsx";


const initialBuild = { tag: "", context: "", dockerfile: "", architectures: ["arm64"] };



function formatBytes(bytes, language) {
  if (!bytes) return "–";
  return new Intl.NumberFormat(language === "de" ? "de-DE" : "en-US", { style: "unit", unit: bytes >= 1073741824 ? "gigabyte" : "megabyte", maximumFractionDigits: 1 }).format(bytes / (bytes >= 1073741824 ? 1073741824 : 1048576));
}

export default function OperationsConsole({ request, language, authenticated, active = true, onNotice, onError }) {
  const de = language === "de";
  const [tab, setTab] = useState("images");
  const [images, setImages] = useState([]);
  const [overview, setOverview] = useState(null);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pullReference, setPullReference] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [inspection, setInspection] = useState(null);
  const [tagTarget, setTagTarget] = useState("");
  const [build, setBuild] = useState(initialBuild);
  const [useEditor, setUseEditor] = useState(false);
  const [dockerfileContent, setDockerfileContent] = useState("FROM alpine:latest\nCMD [\"echo\", \"Hello from Apfel-Hafen\"]\n");
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [builder, setBuilder] = useState({ cpus: 2, memoryMb: 2048 });
  const [registry, setRegistry] = useState({ host: "registry-1.docker.io", username: "", password: "" });

  const loadImages = async () => {
    if (!authenticated) return;
    setLoading(true);
    try { setImages((await request("/api/images/details")).images); } catch (error) { onError(error.message); } finally { setLoading(false); }
  };
  const loadOverview = async () => {
    if (!authenticated) return;
    setLoading(true);
    try { setOverview(await request("/api/system/overview")); } catch (error) { onError(error.message); } finally { setLoading(false); }
  };
  const previousOperations = useRef([]);
  const loadOperations = async () => {
    if (!authenticated) return;
    try {
      const remote = (await request("/api/operations")).operations;
      const completed = remote.filter((item) => item.status !== "running" && previousOperations.current.some((old) => old.id === item.id && old.status === "running"));
      previousOperations.current = remote;
      setOperations(remote);
      for (const item of completed) {
        (item.status === "succeeded" ? onNotice : onError)(`${item.label}: ${item.status}`);
      }
      if (completed.length && active) {
        if (tab === "images") loadImages();
        if (tab === "system" || tab === "build") loadOverview();
      }
    } catch (error) { if (active) onError(error.message); }
  };
  const refreshRef = useRef(loadOperations);
  refreshRef.current = loadOperations;

  useEffect(() => { if (active && authenticated) { if (tab === "images") loadImages(); else if (tab === "system" || tab === "build") loadOverview(); } }, [tab, active, authenticated]);
  useEffect(() => {
    if (!authenticated) { setOperations([]); setInspection(null); setImages([]); setOverview(null); setRegistry((value) => ({ ...value, password: "" })); return; }
    let stopped = false;
    let timer;
    const poll = async () => {
      await refreshRef.current();
      if (!stopped) timer = setTimeout(poll, 2000);
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [authenticated]);

  const startOperation = async (body) => {
    if (submitLock.current) return null;
    if (body.kind === "image.delete") {
      if (!window.confirm(de ? `Image „${body.reference}“ löschen?` : `Delete image "${body.reference}"?`)) return null;
      body.confirmation = body.reference;
    }
    if (body.kind === "image.push" && !window.confirm(de ? `Image „${body.reference}“ in seine Registry hochladen?` : `Upload "${body.reference}" to its registry?`)) return null;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const { operation } = await request("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setOperations((value) => [operation, ...value]);
      previousOperations.current = [operation, ...previousOperations.current];
      setTab("operations");
      onNotice(de ? "Operation wurde gestartet." : "Operation started.");
      return operation;
    } catch (error) { onError(error.message); return null; }
    finally { submitLock.current = false; setSubmitting(false); }
  };

  const inspect = async (reference) => {
    try { setInspection((await request("/api/images/inspect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference }) })).inspection); }
    catch (error) { onError(error.message); }
  };
  const builderAction = async (action) => {
    if (action === "delete" && !window.confirm(de ? "Builder und Build-Cache löschen?" : "Delete builder and build cache?")) return;
    if (submitLock.current) return;
    submitLock.current = true; setSubmitting(true);
    try {
      const data = await request("/api/builder/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...builder }) });
      if (data.operation) { previousOperations.current = [data.operation, ...previousOperations.current]; setTab("operations"); await loadOperations(); }
      else { onNotice(data.message); await loadOverview(); }
    } catch (error) { onError(error.message); } finally { submitLock.current = false; setSubmitting(false); }
  };
  const systemAction = async (action) => {
    if (action === "stop" && !window.confirm(de ? "Apple-Container-System stoppen? Laufende Container werden unterbrochen." : "Stop the container system? Running containers will be interrupted.")) return;
    try {
      const data = await request("/api/system/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      onNotice(data.message); await loadOverview();
    } catch (error) { onError(error.message); }
  };
  const toggleArch = (architecture) => setBuild((value) => ({ ...value, architectures: value.architectures.includes(architecture) ? value.architectures.filter((item) => item !== architecture) : [...value.architectures, architecture] }));
  const activeOperations = useMemo(() => operations.filter((item) => item.status === "running").length, [operations]);

  if (!authenticated) return <section className="panel protected-panel"><h2>{de ? "Entwicklerwerkzeuge" : "Developer tools"}</h2><p>{de ? "Für Images, Builds, Registry und Systemdiagnose ist eine Administrator-Anmeldung erforderlich." : "Administrator sign-in is required for images, builds, registry, and system diagnostics."}</p></section>;

  return <section className="panel operations-console">
    <div className="tool-tabs">
      <button className={tab === "images" ? "active" : ""} onClick={() => setTab("images")}>▧ {de ? "Images" : "Images"}</button>
      <button className={tab === "build" ? "active" : ""} onClick={() => setTab("build")}>⌘ {de ? "Build & Registry" : "Build & registry"}</button>
      <button className={tab === "system" ? "active" : ""} onClick={() => setTab("system")}>◉ {de ? "System" : "System"}</button>
      <button className={tab === "operations" ? "active" : ""} onClick={() => setTab("operations")}>⇅ {de ? "Vorgänge" : "Operations"}{activeOperations ? <span>{activeOperations}</span> : null}</button>
    </div>

    {tab === "images" && <>
      <div className="section-title"><div><p className="eyebrow">OCI</p><h2>{de ? "Lokale Images" : "Local images"}</h2></div><button onClick={loadImages} disabled={loading}>↻ {de ? "Neu laden" : "Refresh"}</button></div>
      <form className="inline-operation" onSubmit={(event) => { event.preventDefault(); startOperation({ kind: "image.pull", reference: pullReference }); }}><input value={pullReference} onChange={(event) => setPullReference(event.target.value)} placeholder="docker.io/library/nginx:latest" required /><button className="primary">↓ Pull</button></form>
      <div className="image-grid">{images.map((image) => <article className="image-card" key={image.id}><h3>{image.reference}</h3><p>{[image.os, image.architecture].filter(Boolean).join(" / ") || "OCI Image"} · {formatBytes(image.sizeInBytes, language)}</p><code title={image.digest}>{image.digest ? image.digest.slice(0, 24) : "–"}</code><div><button onClick={() => { setSelectedImage(image); setTagTarget(""); }}>Tag / Push</button><button onClick={() => inspect(image.reference)}>Inspect</button><button className="danger" onClick={() => startOperation({ kind: "image.delete", reference: image.reference })}>{de ? "Löschen" : "Delete"}</button></div></article>)}</div>
      {!loading && !images.length && <p className="empty">{de ? "Keine lokalen Images gefunden." : "No local images found."}</p>}
    </>}

    {tab === "build" && <div className="tool-columns">
      <section><p className="eyebrow">Dockerfile / Containerfile</p><h2>{de ? "Image bauen" : "Build image"}</h2><div className="stacked-form"><label>Tag<input value={build.tag} onChange={(event) => setBuild((value) => ({ ...value, tag: event.target.value }))} placeholder="example/app:latest" /></label><label>{de ? "Build-Kontext (absoluter Ordnerpfad)" : "Build context (absolute folder path)"}<input value={build.context} onChange={(event) => setBuild((value) => ({ ...value, context: event.target.value }))} placeholder="/Users/me/project" /></label><label>{de ? "Dockerfile (optional)" : "Dockerfile (optional)"}<input value={build.dockerfile} onChange={(event) => setBuild((value) => ({ ...value, dockerfile: event.target.value }))} placeholder="/Users/me/project/Dockerfile" /></label><label className="check-row"><input type="checkbox" checked={useEditor} onChange={(event) => setUseEditor(event.target.checked)} />{de ? "Dockerfile im Editor schreiben" : "Write Dockerfile in editor"}</label>{useEditor && <label>Dockerfile<textarea className="code-editor" spellCheck="false" value={dockerfileContent} onChange={(event) => setDockerfileContent(event.target.value)} /></label>}<div className="check-row"><label><input type="checkbox" checked={build.architectures.includes("arm64")} onChange={() => toggleArch("arm64")} /> ARM64</label><label><input type="checkbox" checked={build.architectures.includes("amd64")} onChange={() => toggleArch("amd64")} /> AMD64</label></div><button className="primary" disabled={submitting || !build.tag || !build.context || !build.architectures.length || (useEditor && !dockerfileContent.trim())} onClick={() => startOperation({ kind: "image.build", ...build, ...(useEditor ? { dockerfileContent } : {}) })}>{de ? "Build starten" : "Start build"}</button></div></section>
      <section><p className="eyebrow">Builder VM</p><h2>Builder</h2><div className="resource-fields"><label>CPU<input type="number" min="1" value={builder.cpus} onChange={(event) => setBuilder((value) => ({ ...value, cpus: event.target.value }))} /></label><label>RAM (MB)<input type="number" min="256" step="256" value={builder.memoryMb} onChange={(event) => setBuilder((value) => ({ ...value, memoryMb: event.target.value }))} /></label></div><div className="button-row"><button className="primary" onClick={() => builderAction("start")}>▶ Start</button><button onClick={() => builderAction("stop")}>■ Stop</button><button className="danger" onClick={() => builderAction("delete")}>{de ? "Löschen" : "Delete"}</button></div><pre className="diagnostic-output">{overview?.builder?.output || overview?.builder?.error || (de ? "Status im System-Tab laden." : "Load status in the System tab.")}</pre></section>
      <section className="registry-panel"><p className="eyebrow">OCI Registry</p><h2>Registry</h2><div className="stacked-form"><label>Host<input value={registry.host} onChange={(event) => setRegistry((value) => ({ ...value, host: event.target.value }))} /></label><label>{de ? "Benutzername" : "Username"}<input autoComplete="username" value={registry.username} onChange={(event) => setRegistry((value) => ({ ...value, username: event.target.value }))} /></label><label>{de ? "Token / Passwort" : "Token / password"}<input type="password" autoComplete="current-password" value={registry.password} onChange={(event) => setRegistry((value) => ({ ...value, password: event.target.value }))} /></label><div className="button-row"><button className="primary" disabled={!registry.host || !registry.username || !registry.password} onClick={async () => { if (await startOperation({ kind: "registry.login", ...registry })) setRegistry((value) => ({ ...value, password: "" })); }}>{de ? "Anmelden" : "Sign in"}</button><button disabled={!registry.host} onClick={() => startOperation({ kind: "registry.logout", host: registry.host })}>{de ? "Abmelden" : "Sign out"}</button></div></div></section>
    </div>}

    {tab === "system" && <><div className="section-title"><div><p className="eyebrow">Apple Container</p><h2>{de ? "Systemdiagnose" : "System diagnostics"}</h2></div><div className="button-row"><button className="primary" onClick={() => systemAction("start")}>▶ Start</button><button onClick={() => systemAction("stop")}>■ Stop</button><button onClick={loadOverview}>↻</button></div></div>{overview && <div className="diagnostic-grid"><Diagnostic title={de ? "CLI-Version" : "CLI version"} value={`${overview.cliPath}\n${overview.version.output || overview.version.error}`} /><Diagnostic title="Status" value={overview.status.output || overview.status.error} /><Diagnostic title={de ? "Speicherbelegung" : "Disk usage"} value={overview.diskUsage.output || overview.diskUsage.error} /><Diagnostic title="Builder" value={overview.builder.output || overview.builder.error} /><Diagnostic title={de ? "Ressourcen" : "Resources"} value={overview.stats.output || overview.stats.error} /><Diagnostic title="Registries" value={overview.registries.join("\n") || overview.registriesError || "–"} /></div>}<h3>{de ? "System-Logs" : "System logs"}</h3><LiveLogViewer enabled={active && authenticated} system url="/api/system/logs/stream" language={language} title="apfel-hafen-system" /></>}

    {tab === "operations" && <><div className="section-title"><div><p className="eyebrow">Queue</p><h2>{de ? "Vorgänge" : "Operations"}</h2></div><button onClick={loadOperations}>↻</button></div><div className="operation-list">{operations.map((operation) => <article key={operation.id} className={`operation ${operation.status}`}><div><i /><strong>{operation.label}</strong><span>{operation.status === "running" ? (de ? "Läuft" : "Running") : operation.status === "succeeded" ? (de ? "Fertig" : "Done") : operation.status === "interrupted" ? (de ? "Unterbrochen" : "Interrupted") : (de ? "Fehlgeschlagen" : "Failed")}</span></div>{(operation.output || operation.error) && <details><summary>{de ? "Ausgabe" : "Output"}</summary><pre>{[operation.error, operation.output].filter(Boolean).join("\n")}</pre></details>}</article>)}</div></>}

    {selectedImage && <div className="subdialog" role="dialog" aria-modal="true" aria-label="Image Tag / Push"><div><h3>{selectedImage.reference}</h3><button onClick={() => setSelectedImage(null)}>×</button></div><label>{de ? "Neuer Tag" : "New tag"}<input value={tagTarget} onChange={(event) => setTagTarget(event.target.value)} placeholder="registry.example.com/me/app:latest" /></label><div className="button-row"><button disabled={!tagTarget} onClick={() => startOperation({ kind: "image.tag", source: selectedImage.reference, target: tagTarget })}>Tag</button><button className="primary" onClick={() => startOperation({ kind: "image.push", reference: selectedImage.reference })}>Push</button></div></div>}
    {inspection && <div className="subdialog inspection-dialog" role="dialog" aria-modal="true" aria-label="Image Inspect"><div><h3>Image Inspect</h3><button onClick={() => setInspection(null)}>×</button></div><button onClick={() => navigator.clipboard.writeText(JSON.stringify(inspection, null, 2)).catch((error) => onError(error.message))}>{de ? "JSON kopieren" : "Copy JSON"}</button><pre>{JSON.stringify(inspection, null, 2)}</pre></div>}
  </section>;
}

function Diagnostic({ title, value }) { return <section><h3>{title}</h3><pre className="diagnostic-output">{value || "–"}</pre></section>; }
