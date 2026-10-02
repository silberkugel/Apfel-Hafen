import React, { useEffect, useMemo, useRef, useState } from "react";
import "./technology.css";

const copy = {
  de: {
    title: "Technik-Zentrale", intro: "Host und Apple Container auf einen Blick.", refresh: "Neu laden", loading: "Messwerte werden geladen", retry: "Erneut versuchen", updated: "Aktualisiert", signIn: "Für Live-Metriken und Verwaltungsaktionen ist eine Administrator-Anmeldung erforderlich.",
    memory: "Memory", pressure: "Druck", normal: "Niedrig", thermalNormal: "Normal", warning: "Erhöht", critical: "Kritisch", unavailable: "Nicht verfügbar", cpu: "CPU", load: "Load", cores: "Kerne", gpu: "GPU / ANE", noPassthrough: "Nicht für Container durchgereicht", ssd: "SSD", free: "frei", used: "belegt", thermal: "Thermal", noThrottling: "Keine Drosselung erkannt", noSensor: "Keine verlässlichen Sensordaten", system: "System", uptime: "Laufzeit",
    appleContainer: "Apple Container", running: "Läuft", stopped: "Gestoppt", active: "aktiv", reclaimable: "rückgewinnbar", containers: "Container", container: "Container", limit: "Limit", network: "Netzwerk", blockIo: "Block-I/O", processes: "Prozesse", actions: "Aktionen", start: "Starten", stop: "Stoppen", restart: "Neustart", details: "Details", noStats: "Noch keine Messung", current: "Aktuell", readWrite: "Lesen / Schreiben", receiveSend: "Empfang / Versand", configured: "Konfiguriert", image: "Image", close: "Schließen",
    limits: "Ressourcenlimits", editLimits: "CPU/RAM ändern", cpus: "CPU-Kerne", memoryMb: "Arbeitsspeicher (MB)", downtime: "Der laufende Container wird geprüft, kurz gestoppt, neu erstellt und anschließend wieder gestartet.", acknowledge: "Ich habe die kurze Unterbrechung verstanden.", apply: "Änderungen anwenden", applying: "Wird angewendet …",
    cleanup: "Speicher bereinigen", cleanupHint: "Apfel-Hafen zeigt eine Schätzung. Die CLI meldet nach der Bereinigung den tatsächlich freigegebenen Speicher.", pruneContainers: "Gestoppte Container", pruneImages: "Ungenutzte Images", pruneVolumes: "Nicht referenzierte Volumes", confirmCleanup: "Diese Bereinigung kann Daten dauerhaft löschen. Fortfahren?",
    recommendations: "Hinweise", memoryPressure: "Der Speicherdruck ist erhöht. Container-Limits prüfen und macOS ausreichend Reserve lassen.", diskSpace: "Der freie SSD-Speicher wird knapp. Nicht mehr benötigte Container-Ressourcen prüfen.", reclaimableStorage: "Apple Container kann mindestens 1 GB Speicher zurückgewinnen.", overcommittedMemory: "Die Summe der Container-Limits lässt weniger als 10 % RAM-Reserve für macOS.", noRecommendations: "Keine aktuellen Warnungen.",
  },
  en: {
    title: "Technology Center", intro: "Host and Apple Container at a glance.", refresh: "Refresh", loading: "Loading metrics", retry: "Try again", updated: "Updated", signIn: "Administrator sign-in is required for live metrics and management actions.",
    memory: "Memory", pressure: "Pressure", normal: "Low", thermalNormal: "Normal", warning: "Elevated", critical: "Critical", unavailable: "Unavailable", cpu: "CPU", load: "Load", cores: "cores", gpu: "GPU / ANE", noPassthrough: "Not exposed to containers", ssd: "SSD", free: "free", used: "used", thermal: "Thermal", noThrottling: "No throttling detected", noSensor: "No reliable sensor data", system: "System", uptime: "Uptime",
    appleContainer: "Apple Container", running: "Running", stopped: "Stopped", active: "active", reclaimable: "reclaimable", containers: "Containers", container: "Container", limit: "Limit", network: "Network", blockIo: "Block I/O", processes: "Processes", actions: "Actions", start: "Start", stop: "Stop", restart: "Restart", details: "Details", noStats: "Waiting for next sample", current: "Current", readWrite: "Read / write", receiveSend: "Receive / send", configured: "Configured", image: "Image", close: "Close",
    limits: "Resource limits", editLimits: "Change CPU/RAM", cpus: "CPU cores", memoryMb: "Memory (MB)", downtime: "The running container is checked, briefly stopped, recreated, and then started again.", acknowledge: "I understand the brief interruption.", apply: "Apply changes", applying: "Applying …",
    cleanup: "Reclaim storage", cleanupHint: "Apfel-Hafen shows an estimate. The CLI reports the space actually released after cleanup.", pruneContainers: "Stopped containers", pruneImages: "Unused images", pruneVolumes: "Unreferenced volumes", confirmCleanup: "This cleanup can permanently delete data. Continue?",
    recommendations: "Recommendations", memoryPressure: "Memory pressure is elevated. Review container limits and leave enough headroom for macOS.", diskSpace: "Free SSD space is running low. Review container resources that are no longer needed.", reclaimableStorage: "Apple Container can reclaim at least 1 GB of storage.", overcommittedMemory: "The sum of container limits leaves less than 10% RAM headroom for macOS.", noRecommendations: "No current warnings.",
  },
};

function bytes(value, language, compact = false) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "–";
  const number = Number(value);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = number;
  let index = 0;
  while (Math.abs(amount) >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
  return `${new Intl.NumberFormat(language === "de" ? "de-DE" : "en-US", { maximumFractionDigits: compact ? 0 : 1 }).format(amount)} ${units[index]}`;
}

function duration(seconds, language) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return language === "de" ? `${days} T ${String(hours).padStart(2, "0")} Std.` : `${days}d ${String(hours).padStart(2, "0")}h`;
}

function MiniTrend({ values, ceiling = 100 }) {
  if (values.length < 2) return <div className="mini-trend-placeholder" />;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${28 - Math.min(28, Math.max(0, value / ceiling * 28))}`).join(" ");
  return <svg className="mini-trend" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>;
}

function MetricCard({ icon, title, value, detail, state = "normal", values, children }) {
  return <article className={`metric-card ${state}`}>
    <div className="metric-card-heading"><span>{icon}</span><h3>{title}</h3><i /></div>
    <strong>{value}</strong>
    <p>{detail}</p>
    {values ? <MiniTrend values={values} /> : children}
  </article>;
}

export default function TechnologyCenter({ request, language, authenticated, active, onNotice, onError }) {
  const t = (key) => copy[language]?.[key] || copy.de[key] || key;
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [settings, setSettings] = useState(null);
  const [editing, setEditing] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState("");
  const [loadError, setLoadError] = useState("");
  const runningRequest = useRef(false);

  const load = async (showSpinner = false) => {
    if (!authenticated || runningRequest.current) return;
    runningRequest.current = true;
    if (showSpinner) setLoading(true);
    try {
      const next = await request("/api/technology/overview");
      setLoadError("");
      setSnapshot(next);
      setHistory((value) => [...value, {
        at: next.sampledAt,
        memory: next.host.memory.usedPercent,
        cpu: next.host.cpu.usedPercent,
        disk: next.host.disk.usedPercent,
      }].slice(-180));
      setSelected((value) => value ? next.containers.items.find((item) => item.name === value.name) || null : null);
    } catch (error) { setLoadError(error.message); onError(error.message); }
    finally { runningRequest.current = false; setLoading(false); }
  };

  useEffect(() => {
    if (!active || !authenticated) return undefined;
    let stopped = false;
    let timer;
    const poll = async () => { await load(); if (!stopped) timer = setTimeout(poll, 5000); };
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [active, authenticated]);

  const performLifecycle = async (container, action) => {
    if (!window.confirm(`${t(action)} „${container.name}“?`)) return;
    setBusy(`${container.name}:${action}`);
    try {
      const data = await request(`/api/containers/${encodeURIComponent(container.name)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: container.name }) });
      onNotice(data.message || "OK"); await load();
    } catch (error) { onError(error.message); }
    finally { setBusy(""); }
  };

  const performSystemAction = async () => {
    const action = snapshot.containers.systemRunning ? "stop" : "start";
    if (action === "stop" && !window.confirm(language === "de" ? "Apple-Container-System stoppen? Laufende Container werden unterbrochen." : "Stop Apple Container? Running containers will be interrupted.")) return;
    setBusy(`system:${action}`);
    try {
      const data = await request("/api/system/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      onNotice(data.message); await load();
    } catch (error) { onError(error.message); }
    finally { setBusy(""); }
  };

  const openLimits = async () => {
    setBusy(`${selected.name}:settings`);
    try {
      const data = await request(`/api/containers/${encodeURIComponent(selected.name)}/settings`);
      setSettings(data.settings); setAcknowledged(false); setEditing(true);
    } catch (error) { onError(error.message); }
    finally { setBusy(""); }
  };

  const saveLimits = async () => {
    setBusy(`${selected.name}:save`);
    try {
      const data = await request(`/api/containers/${encodeURIComponent(selected.name)}/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      onNotice(data.message); setEditing(false); setSettings(null); await load();
    } catch (error) { onError(error.message); }
    finally { setBusy(""); }
  };

  const prune = async (action) => {
    if (!window.confirm(t("confirmCleanup"))) return;
    setBusy(`prune:${action}`);
    try {
      const data = await request("/api/technology/prune", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, confirmation: action }) });
      onNotice(data.output ? `${data.message} ${data.output}` : data.message); await load();
    } catch (error) { onError(error.message); }
    finally { setBusy(""); }
  };

  const historyValues = (key) => history.map((item) => item[key]);
  const memoryState = snapshot?.host.memory.pressure || "normal";
  const thermalState = snapshot?.host.thermal.state || "unavailable";
  const diskState = snapshot?.host.disk.usedPercent >= 95 ? "critical" : snapshot?.host.disk.usedPercent >= 85 ? "warning" : "normal";
  const sortedContainers = useMemo(() => [...(snapshot?.containers.items || [])].sort((left, right) => (right.cpuPercent || 0) - (left.cpuPercent || 0)), [snapshot]);

  if (!authenticated) return <section className="panel protected-panel technology-protected"><h2>{t("title")}</h2><p>{t("signIn")}</p></section>;
  if (!snapshot) return <section className="panel technology-center"><div className="technology-title"><div><p className="eyebrow">Monitoring</p><h2>{t("title")}</h2></div><div><span className="technology-loading">{loading ? `${t("loading")} …` : loadError}</span>{loadError && <button onClick={() => load(true)}>↻ {t("retry")}</button>}</div></div></section>;

  return <section className="panel technology-center">
    <div className="technology-title"><div><p className="eyebrow">Monitoring</p><h2>{t("title")}</h2><p>{t("intro")}</p></div><div><small>{t("updated")}: {new Date(snapshot.sampledAt).toLocaleTimeString(language === "de" ? "de-DE" : "en-US")}</small><button onClick={() => load(true)} disabled={loading}>↻ {t("refresh")}</button></div></div>

    <div className="metric-grid">
      <MetricCard icon="◫" title={t("memory")} value={`${snapshot.host.memory.usedPercent} %`} detail={`${bytes(snapshot.host.memory.usedBytes, language)} / ${bytes(snapshot.host.memory.totalBytes, language)} · ${t("pressure")}: ${t(memoryState)}`} state={memoryState} values={historyValues("memory")} />
      <MetricCard icon="⌁" title={t("cpu")} value={`${snapshot.host.cpu.usedPercent} %`} detail={`${t("load")} ${snapshot.host.cpu.loadAverage[0].toFixed(1)} · ${snapshot.host.cpu.logicalCores} ${t("cores")}`} values={historyValues("cpu")} />
      <MetricCard icon="◇" title={t("gpu")} value={t("unavailable")} detail={t("noPassthrough")} state="unavailable"><div className="metric-unavailable">GPU · Neural Engine</div></MetricCard>
      <MetricCard icon="▱" title={t("ssd")} value={`${bytes(snapshot.host.disk.freeBytes, language)} ${t("free")}`} detail={`${snapshot.host.disk.usedPercent} % ${t("used")}`} state={diskState} values={historyValues("disk")} />
      <MetricCard icon="♨" title={t("thermal")} value={thermalState === "normal" ? t("thermalNormal") : t(thermalState)} detail={thermalState === "unavailable" ? t("noSensor") : t("noThrottling")} state={thermalState}><div className="thermal-bars"><i /><i /><i /><i /></div></MetricCard>
      <MetricCard icon="⌘" title={t("system")} value={duration(snapshot.host.system.uptimeSeconds, language)} detail={`macOS ${snapshot.host.system.macosVersion} · ${snapshot.host.system.architecture}`}><div className="system-version">{t("uptime")}</div></MetricCard>
    </div>

    <section className={`container-summary ${snapshot.containers.systemRunning ? "normal" : "critical"}`}>
      <div><span className="status-orb" /><div><p className="eyebrow">Runtime</p><h3>{t("appleContainer")}</h3></div><button className="runtime-action" disabled={Boolean(busy)} onClick={performSystemAction}>{snapshot.containers.systemRunning ? `■ ${t("stop")}` : `▶ ${t("start")}`}</button></div>
      <dl><div><dt>{snapshot.containers.systemRunning ? t("running") : t("stopped")}</dt><dd>{snapshot.containers.running} / {snapshot.containers.total} {t("active")}</dd></div><div><dt>{snapshot.containers.cpuPercent} % CPU</dt><dd>{bytes(snapshot.containers.memoryUsageBytes, language)} RAM</dd></div><div><dt>{bytes(snapshot.containers.disk.sizeBytes, language)}</dt><dd>{bytes(snapshot.containers.disk.reclaimableBytes, language)} {t("reclaimable")}</dd></div></dl>
    </section>

    <div className="technology-columns">
      <section className="container-metrics-panel"><div className="technology-section-heading"><div><p className="eyebrow">Live</p><h3>{t("containers")}</h3></div><span>{snapshot.containers.statsError ? t("noStats") : `${snapshot.containers.running} ${t("active")}`}</span></div>
        <div className="metrics-table-wrap"><table className="metrics-table"><thead><tr><th>{t("container")}</th><th>CPU</th><th>RAM</th><th>{t("network")}</th><th>{t("blockIo")}</th><th>{t("processes")}</th><th><span className="visually-hidden">{t("actions")}</span></th></tr></thead><tbody>{sortedContainers.map((container) => <tr key={container.name}><td><button className="container-link" onClick={() => setSelected(container)}><i className={container.status} />{container.name}</button><small>{container.image}</small></td><td>{container.cpuPercent === null ? "–" : `${container.cpuPercent.toFixed(1)} %`}</td><td><strong>{bytes(container.memoryUsageBytes, language)}</strong><small>{bytes(container.memoryLimitBytes, language)} {t("limit")}</small></td><td><strong>↓ {bytes(container.networkRxBytesPerSecond, language)}/s</strong><small>↑ {bytes(container.networkTxBytesPerSecond, language)}/s</small></td><td><strong>↓ {bytes(container.blockReadBytesPerSecond, language)}/s</strong><small>↑ {bytes(container.blockWriteBytesPerSecond, language)}/s</small></td><td>{container.numProcesses || "–"}</td><td><button onClick={() => setSelected(container)}>{t("details")}</button></td></tr>)}</tbody></table></div>
      </section>

      <aside className="technology-side">
        <section className="recommendations"><p className="eyebrow">Health</p><h3>{t("recommendations")}</h3>{snapshot.recommendations.length ? <ul>{snapshot.recommendations.map((item) => <li className={item.severity} key={item.code}><i />{t(item.code)}</li>)}</ul> : <p className="all-clear">✓ {t("noRecommendations")}</p>}</section>
        <section className="cleanup-card"><p className="eyebrow">Storage</p><h3>{t("cleanup")}</h3><p>{t("cleanupHint")}</p><div><button disabled={Boolean(busy)} onClick={() => prune("containers")}>{t("pruneContainers")}</button><button disabled={Boolean(busy)} onClick={() => prune("images")}>{t("pruneImages")}</button><button disabled={Boolean(busy)} onClick={() => prune("volumes")}>{t("pruneVolumes")}</button></div></section>
      </aside>
    </div>

    {selected && <div className="technology-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="technology-dialog" role="dialog" aria-modal="true" aria-labelledby="technology-dialog-title"><header><div><p className="eyebrow">{t("container")}</p><h2 id="technology-dialog-title">{selected.name}</h2></div><button aria-label={t("close")} onClick={() => setSelected(null)}>×</button></header><p className="technology-image">{selected.image}</p>
      <dl className="container-detail-grid"><div><dt>CPU</dt><dd>{selected.cpuPercent === null ? "–" : `${selected.cpuPercent.toFixed(1)} %`}</dd><small>{selected.cpus || "–"} {t("configured")}</small></div><div><dt>RAM</dt><dd>{bytes(selected.memoryUsageBytes, language)}</dd><small>{bytes(selected.memoryLimitBytes, language)} {t("limit")}</small></div><div><dt>{t("network")}</dt><dd>↓ {bytes(selected.networkRxBytesPerSecond, language)}/s</dd><small>↑ {bytes(selected.networkTxBytesPerSecond, language)}/s</small></div><div><dt>{t("blockIo")}</dt><dd>↓ {bytes(selected.blockReadBytesPerSecond, language)}/s</dd><small>↑ {bytes(selected.blockWriteBytesPerSecond, language)}/s</small></div></dl>
      {!editing ? <><div className="technology-dialog-actions"><button disabled={Boolean(busy)} onClick={() => performLifecycle(selected, selected.status === "running" ? "stop" : "start")}>{selected.status === "running" ? `■ ${t("stop")}` : `▶ ${t("start")}`}</button><button disabled={Boolean(busy)} onClick={() => performLifecycle(selected, "restart")}>↻ {t("restart")}</button><button className="primary" disabled={Boolean(busy)} onClick={openLimits}>⚙ {t("editLimits")}</button></div></> : settings && <div className="limit-editor"><h3>{t("limits")}</h3><div><label>{t("cpus")}<input type="number" min="1" max="256" step="1" value={settings.cpus} onChange={(event) => setSettings((value) => ({ ...value, cpus: event.target.value }))} /></label><label>{t("memoryMb")}<input type="number" min="64" max="1048576" step="64" value={settings.memoryMb} onChange={(event) => setSettings((value) => ({ ...value, memoryMb: event.target.value }))} /></label></div>{selected.status === "running" && <><p className="downtime-warning">⚠ {t("downtime")}</p><label className="acknowledge"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />{t("acknowledge")}</label></>}<div className="technology-dialog-actions"><button onClick={() => { setEditing(false); setSettings(null); }}>{t("close")}</button><button className="primary" disabled={Boolean(busy) || (selected.status === "running" && !acknowledged)} onClick={saveLimits}>{busy ? t("applying") : t("apply")}</button></div></div>}
    </section></div>}
  </section>;
}
