import React from "react";

export default function AdvancedContainerOptions({ draft, setDraft, language }) {
  const de = language === "de";
  const change = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  return <details className="advanced-options"><summary>{de ? "Erweiterte Containeroptionen" : "Advanced container options"}</summary>
    <div className="advanced-grid">
      <label>{de ? "Architektur" : "Architecture"}<select value={draft.architecture} onChange={(event) => change("architecture", event.target.value)}><option value="auto">Auto</option><option value="arm64">ARM64</option><option value="amd64">AMD64</option></select></label>
      <label>DNS-Domain<input value={draft.dnsDomain} onChange={(event) => change("dnsDomain", event.target.value)} placeholder="test" /></label>
      <label>{de ? "Netzwerk" : "Network"}<input value={draft.network} onChange={(event) => change("network", event.target.value)} placeholder="default" /></label>
      <label>{de ? "Arbeitsverzeichnis" : "Working directory"}<input value={draft.workdir} onChange={(event) => change("workdir", event.target.value)} placeholder="/app" /></label>
      <label>Entrypoint<input value={draft.entrypoint} onChange={(event) => change("entrypoint", event.target.value)} placeholder="/bin/sh" /></label>
    </div>
    <div className="check-row">{[["rosetta", "Rosetta"], ["interactive", de ? "STDIN offen halten" : "Keep STDIN open"], ["tty", "TTY"], ["readOnlyRoot", de ? "Root-Dateisystem nur lesen" : "Read-only root filesystem"], ["useInit", "Init"], ["ssh", "SSH-Agent"]].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(draft[key])} onChange={(event) => change(key, event.target.checked)} />{label}</label>)}</div>
    <p>{de ? "DNS-Namen benötigen eine bereits eingerichtete lokale DNS-Domain. Netzwerke müssen vorhanden sein. Rosetta setzt die Installation der Apple-Laufzeit voraus." : "DNS names require a configured local DNS domain. Networks must already exist. Rosetta requires the Apple runtime to be installed."}</p>
  </details>;
}
