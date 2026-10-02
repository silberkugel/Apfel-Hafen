function activeCount(items, predicate) {
  return (items || []).filter(predicate).length;
}

function timeLabel(value, language) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(language === "de" ? "de-DE" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function footerStatus({ section, connected, loading, containers, services, technology, updatedAt, language = "de" }) {
  const de = language === "de";
  if (connected === false) return { tone: "critical", text: de ? "Verbindung zum Dienst unterbrochen" : "Service connection interrupted" };
  if (connected === null) return { tone: "loading", text: de ? "Verbindung wird hergestellt …" : "Connecting …" };

  let state;
  let timestamp = updatedAt?.[section];
  let tone = "normal";
  if (section === "containers") {
    const count = activeCount(containers, (item) => item.status === "running");
    state = `${count} ${de ? "Container aktiv" : count === 1 ? "container active" : "containers active"}`;
  } else if (section === "launchd") {
    const count = activeCount(services, (item) => item.running);
    state = `${count} ${de ? "LaunchD-Dienste aktiv" : count === 1 ? "LaunchD service active" : "LaunchD services active"}`;
  } else if (section === "technology") {
    timestamp = technology?.sampledAt || timestamp;
    if (!technology) state = de ? "Apple-Container-Status wird ermittelt" : "Checking Apple Container status";
    else if (technology.systemRunning) state = de ? "Apple Container läuft" : "Apple Container running";
    else { state = de ? "Apple Container gestoppt" : "Apple Container stopped"; tone = "warning"; }
  } else {
    const count = activeCount(containers, (item) => item.status === "running");
    timestamp = updatedAt?.containers;
    state = `${count} ${de ? "Container aktiv" : count === 1 ? "container active" : "containers active"}`;
  }

  const time = timeLabel(timestamp, language);
  const updated = time ? `${de ? "Aktualisiert" : "Updated"} ${time}` : loading ? (de ? "Wird aktualisiert …" : "Updating …") : "";
  return { tone, text: [de ? "Verbunden" : "Connected", state, updated].filter(Boolean).join(" · ") };
}
