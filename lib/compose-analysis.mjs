import { parseDocument } from "yaml";

const secretName = /(pass(word)?|secret|token|api[_-]?key|private[_-]?key|credential|auth)/i;
const maximumSourceBytes = 1024 * 1024;
const maximumServices = 128;
const reviewedServiceFields = new Set([
  "image", "build", "profiles", "depends_on", "ports", "volumes", "networks", "environment", "env_file", "healthcheck", "restart",
  "privileged", "network_mode", "pid", "ipc", "devices", "cap_add", "security_opt", "extends", "cpus", "mem_limit", "deploy", "platform",
]);
const reviewedTopLevelFields = new Set(["name", "version", "services", "networks", "volumes", "secrets", "configs"]);

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function parseComposeEnv(source = "") {
  if (Buffer.byteLength(source, "utf8") > maximumSourceBytes) throw new Error("Die .env-Datei ist größer als 1 MB.");
  const values = {};
  const warnings = [];
  for (const [index, original] of String(source).replace(/^\uFEFF/, "").split(/\r?\n/).entries()) {
    let line = original.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const separator = line.indexOf("=");
    if (separator < 1) {
      warnings.push(`Zeile ${index + 1} der .env-Datei wurde ignoriert.`);
      continue;
    }
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      warnings.push(`Ungültiger Variablenname in Zeile ${index + 1} der .env-Datei.`);
      continue;
    }
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "").trim();
    values[key] = value;
  }
  return { values, warnings };
}

function interpolate(value, env, missing, maskSecrets = true) {
  if (typeof value === "string") {
    const escaped = value.replace(/\$\$/g, "\u0000");
    return escaped.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-?])([^}]*))?\}/g, (_, name, operator = "", fallback = "") => {
      const present = Object.hasOwn(env, name) && env[name] !== "";
      if (present) return maskSecrets && secretName.test(name) ? "••••" : env[name];
      if (operator.endsWith("-")) return fallback;
      missing.add(name);
      return operator.endsWith("?") ? "" : `\${${name}}`;
    }).replace(/\u0000/g, "$");
  }
  if (Array.isArray(value)) return value.map((item) => interpolate(item, env, missing, maskSecrets));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, env, missing, maskSecrets)]));
  return value;
}

function list(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (value && typeof value === "object") return Object.keys(value);
  return value ? [text(value)] : [];
}

function environmentNames(value) {
  const names = Array.isArray(value)
    ? value.map((entry) => text(entry).split("=", 1)[0])
    : value && typeof value === "object" ? Object.keys(value) : [];
  return [...new Set(names.filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)))].sort().map((name) => ({ name, secret: secretName.test(name) }));
}

function portSummary(port) {
  if (typeof port === "string" || typeof port === "number") return text(port);
  if (!port || typeof port !== "object") return "";
  const published = port.published ? `${port.published}:` : "";
  return `${published}${port.target || "?"}/${port.protocol || "tcp"}`;
}

function supportedPort(port) {
  if (typeof port === "number") return Number.isInteger(port) && port > 0 && port <= 65535;
  if (typeof port === "string") return /^(?:\d{1,5}:)?\d{1,5}(?:\/(?:tcp|udp))?$/i.test(port.trim());
  if (!port || typeof port !== "object") return false;
  const keys = Object.keys(port);
  return keys.every((key) => ["target", "published", "protocol"].includes(key))
    && Number.isInteger(Number(port.target))
    && (!port.published || Number.isInteger(Number(port.published)))
    && (!port.protocol || /^(tcp|udp)$/i.test(String(port.protocol)));
}

function volumeSummary(volume) {
  if (typeof volume === "string") {
    const parts = volume.split(":");
    return { source: parts.length > 1 ? parts[0] : "", target: parts.length > 1 ? parts[1] : parts[0], readOnly: parts.includes("ro"), type: parts[0]?.startsWith("/") || parts[0]?.startsWith(".") ? "bind" : "volume" };
  }
  if (!volume || typeof volume !== "object") return { source: "", target: "", readOnly: false, type: "unknown" };
  return { source: text(volume.source), target: text(volume.target), readOnly: Boolean(volume.read_only), type: text(volume.type || "volume") };
}

function diagnostic(level, code, message, service = null, active = null) {
  return { level, code, message, service, active };
}

function dependencyOrder(services, diagnostics) {
  const active = new Set(services.filter((service) => service.active).map((service) => service.name));
  const state = new Map();
  const order = [];
  let cycle = false;
  const visit = (name, trail = []) => {
    if (state.get(name) === 2) return;
    if (state.get(name) === 1) {
      cycle = true;
      diagnostics.push(diagnostic("error", "dependency-cycle", `Abhängigkeitskreis erkannt: ${[...trail, name].join(" → ")}.`, name));
      return;
    }
    state.set(name, 1);
    const service = services.find((item) => item.name === name);
    for (const dependency of service?.dependsOn || []) if (active.has(dependency)) visit(dependency, [...trail, name]);
    state.set(name, 2);
    order.push(name);
  };
  for (const name of active) visit(name);
  return cycle ? [] : order;
}

export function analyzeCompose(source, options = {}) {
  if (typeof source !== "string" || !source.trim()) throw new Error("Bitte eine Compose-Datei auswählen oder einfügen.");
  if (Buffer.byteLength(source, "utf8") > maximumSourceBytes) throw new Error("Die Compose-Datei ist größer als 1 MB.");
  const envResult = parseComposeEnv(options.envSource || "");
  const selectedProfiles = [...new Set((options.profiles || []).map((profile) => text(profile).trim()).filter(Boolean))];
  const document = parseDocument(source, { maxAliasCount: 50, uniqueKeys: true });
  if (document.errors.length) throw new Error(`Compose-Datei ist ungültig: ${document.errors[0].message}`);
  const raw = document.toJS({ maxAliasCount: 50 }) || {};
  const missing = new Set();
  const compose = interpolate(raw, envResult.values, missing);
  if (!compose.services || typeof compose.services !== "object" || Array.isArray(compose.services)) throw new Error("Die Compose-Datei enthält keinen gültigen services-Abschnitt.");
  const serviceEntries = Object.entries(compose.services);
  if (!serviceEntries.length) throw new Error("Die Compose-Datei enthält keine Dienste.");
  if (serviceEntries.length > maximumServices) throw new Error(`Es werden höchstens ${maximumServices} Dienste unterstützt.`);

  const diagnostics = envResult.warnings.map((message) => diagnostic("warning", "env-line", message));
  for (const name of missing) diagnostics.push(diagnostic("warning", "missing-variable", `Für „${name}“ wurde kein Wert gefunden.`));
  if (compose.secrets) diagnostics.push(diagnostic("warning", "top-level-secrets", "Compose-Secrets werden erkannt, können mit Apple Container aber noch nicht automatisch bereitgestellt werden."));
  if (compose.configs) diagnostics.push(diagnostic("warning", "top-level-configs", "Compose-Configs werden erkannt, können mit Apple Container aber noch nicht automatisch bereitgestellt werden."));
  for (const field of Object.keys(compose)) if (!reviewedTopLevelFields.has(field)) diagnostics.push(diagnostic("warning", "unreviewed-top-level-field", `Die Projekteigenschaft „${field}“ wird noch nicht ausgewertet und darf bei einer späteren Ausführung nicht stillschweigend entfallen.`));

  const knownNames = new Set(serviceEntries.map(([name]) => name));
  const availableProfiles = new Set();
  const services = serviceEntries.map(([name, serviceValue]) => {
    const service = serviceValue && typeof serviceValue === "object" ? serviceValue : {};
    const profiles = list(service.profiles);
    profiles.forEach((profile) => availableProfiles.add(profile));
    const active = !profiles.length || profiles.some((profile) => selectedProfiles.includes(profile));
    const issue = (level, code, message) => diagnostics.push(diagnostic(active ? level : "info", code, message, name, active));
    const dependsOn = list(service.depends_on);
    for (const dependency of dependsOn) if (!knownNames.has(dependency)) issue("error", "unknown-dependency", `Der Dienst „${name}“ hängt von dem unbekannten Dienst „${dependency}“ ab.`);
    if (!service.image && !service.build) issue("error", "missing-image", `Der Dienst „${name}“ besitzt weder image noch build.`);
    if (service.build) issue(service.image ? "warning" : "error", "build-required", `Der Dienst „${name}“ benötigt einen Image-Build; 0.3.3 analysiert Builds nur.`);
    if (service.privileged) issue("error", "privileged", `Der Dienst „${name}“ fordert privilegierten Betrieb an.`);
    if (service.network_mode === "host") issue("error", "host-network", `Der Dienst „${name}“ verwendet das Host-Netzwerk.`);
    if (service.pid === "host" || service.ipc === "host") issue("error", "host-namespace", `Der Dienst „${name}“ verwendet einen Host-Namensraum.`);
    if (service.devices) issue("warning", "devices", `Gerätefreigaben von „${name}“ müssen vor einer Ausführung manuell geprüft werden.`);
    if (service.cap_add || service.security_opt) issue("warning", "security-options", `Zusätzliche Sicherheitsrechte von „${name}“ müssen manuell geprüft werden.`);
    if (service.extends) issue("error", "extends", `extends von „${name}“ wird noch nicht aufgelöst.`);
    const envFiles = list(service.env_file);
    if (envFiles.length) issue("warning", "env-file-reference", `Der Dienst „${name}“ verweist auf zusätzliche env_file-Dateien (${envFiles.join(", ")}); deren Werte sind nicht Bestandteil der gewählten .env-Datei.`);
    const unreviewedFields = Object.keys(service).filter((field) => !reviewedServiceFields.has(field)).sort();
    for (const field of unreviewedFields) issue("warning", "unreviewed-service-field", `Die Eigenschaft „${field}“ von „${name}“ wird noch nicht ausgewertet und darf bei einer späteren Ausführung nicht stillschweigend entfallen.`);
    for (const port of list(service.ports)) if (!supportedPort(port)) issue("warning", "unsupported-port", `Die Portfreigabe von „${name}“ verwendet eine noch nicht unterstützte Adresse, einen Bereich oder eine erweiterte Option.`);
    const networks = list(service.networks);
    const serviceVolumes = (Array.isArray(service.volumes) ? service.volumes : []).map(volumeSummary);
    if (serviceVolumes.some((volume) => volume.type === "bind")) issue("warning", "bind-volume", `Host-Ordner von „${name}“ werden noch nicht automatisch übernommen.`);
    if (serviceVolumes.some((volume) => volume.type === "volume" && !volume.source)) issue("warning", "anonymous-volume", `Das anonyme Volume von „${name}“ benötigt vor der Ausführung einen eindeutigen Namen.`);
    if (service.healthcheck && !service.healthcheck.disable && (!Array.isArray(service.healthcheck.test) || service.healthcheck.test[0] !== "CMD")) issue("warning", "healthcheck-runtime", `Der Healthcheck von „${name}“ muss als sichere CMD-Liste angegeben werden.`);
    if (service.restart) issue("warning", "restart-runtime", `Die Neustartregel von „${name}“ wird erst durch die Betriebssicherung von 0.3.5 verwaltet.`);
    if (networks.length > 1) issue("warning", "multiple-networks", `„${name}“ verwendet mehrere Netzwerke, die noch nicht verlustfrei abgebildet werden können.`);
    return {
      name,
      active,
      image: text(service.image),
      build: Boolean(service.build),
      profiles,
      dependsOn,
      ports: list(service.ports).map(portSummary).filter(Boolean),
      volumes: serviceVolumes,
      networks: networks.length ? networks : service.network_mode ? [text(service.network_mode)] : ["default"],
      environment: environmentNames(service.environment),
      envFiles,
      healthcheck: Boolean(service.healthcheck && !service.healthcheck.disable),
      restart: text(service.restart),
      platform: text(service.platform),
      resources: {
        cpus: text(service.cpus || service.deploy?.resources?.limits?.cpus),
        memory: text(service.mem_limit || service.deploy?.resources?.limits?.memory),
      },
      unreviewedFields,
    };
  });
  for (const service of services.filter((item) => item.active)) {
    for (const dependency of service.dependsOn) {
      const target = services.find((item) => item.name === dependency);
      if (target && !target.active) diagnostics.push(diagnostic("error", "inactive-dependency", `Der aktive Dienst „${service.name}“ benötigt „${dependency}“, dessen Profil aber nicht ausgewählt ist.`, service.name, true));
    }
  }
  const startOrder = dependencyOrder(services, diagnostics);
  const errorCount = diagnostics.filter((item) => item.level === "error").length;
  const warningCount = diagnostics.filter((item) => item.level === "warning").length;
  return {
    readOnly: true,
    compatible: errorCount === 0,
    project: { name: text(compose.name || "compose") },
    services,
    profiles: { available: [...availableProfiles].sort(), selected: selectedProfiles },
    networks: [...new Set(["default", ...Object.keys(compose.networks || {})])].sort(),
    volumes: Object.keys(compose.volumes || {}).sort(),
    startOrder,
    diagnostics,
    summary: { services: services.length, activeServices: services.filter((service) => service.active).length, errors: errorCount, warnings: warningCount, information: diagnostics.filter((item) => item.level === "info").length },
  };
}

function environmentValues(value, projectEnv) {
  const entries = Array.isArray(value)
    ? value.map((entry) => {
      const source = text(entry);
      const separator = source.indexOf("=");
      return separator < 0 ? [source, projectEnv[source] || ""] : [source.slice(0, separator), source.slice(separator + 1)];
    })
    : value && typeof value === "object" ? Object.entries(value).map(([key, item]) => [key, text(item)]) : [];
  return entries.filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)).map(([key, value]) => ({ key, value }));
}

export function composeRuntimeDraft(source, options = {}) {
  const analysis = analyzeCompose(source, options);
  if (!analysis.compatible) throw new Error("Der Compose-Plan enthält Fehler und darf nicht ausgeführt werden.");
  const envResult = parseComposeEnv(options.envSource || "");
  const document = parseDocument(source, { maxAliasCount: 50, uniqueKeys: true });
  if (document.errors.length) throw new Error(`Compose-Datei ist ungültig: ${document.errors[0].message}`);
  const missing = new Set();
  const compose = interpolate(document.toJS({ maxAliasCount: 50 }) || {}, envResult.values, missing, false);
  if (missing.size) throw new Error(`Für ${[...missing].join(", ")} fehlt ein Wert.`);
  const selected = new Map(analysis.services.filter((service) => service.active).map((service) => [service.name, service]));
  return analysis.startOrder.map((name) => {
    const service = compose.services[name] || {};
    const summary = selected.get(name);
    return {
      name,
      image: text(service.image),
      variables: environmentValues(service.environment, envResult.values),
      ports: summary.ports,
      volumes: summary.volumes,
      networks: summary.networks,
      cpus: summary.resources.cpus,
      memory: summary.resources.memory,
      restart: summary.restart,
      healthcheck: service.healthcheck && !service.healthcheck.disable ? service.healthcheck : null,
    };
  });
}
