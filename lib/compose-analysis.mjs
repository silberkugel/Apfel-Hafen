import { parseDocument } from "yaml";

const secretName = /(pass(word)?|secret|token|api[_-]?key|private[_-]?key|credential|auth)/i;
const maximumSourceBytes = 1024 * 1024;
const maximumServices = 128;

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

function interpolate(value, env, missing) {
  if (typeof value === "string") {
    const escaped = value.replace(/\$\$/g, "\u0000");
    return escaped.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-?])([^}]*))?\}/g, (_, name, operator = "", fallback = "") => {
      const present = Object.hasOwn(env, name) && env[name] !== "";
      if (present) return secretName.test(name) ? "••••" : env[name];
      if (operator.endsWith("-")) return fallback;
      missing.add(name);
      return operator.endsWith("?") ? "" : `\${${name}}`;
    }).replace(/\u0000/g, "$");
  }
  if (Array.isArray(value)) return value.map((item) => interpolate(item, env, missing));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, env, missing)]));
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

function volumeSummary(volume) {
  if (typeof volume === "string") {
    const parts = volume.split(":");
    return { source: parts.length > 1 ? parts[0] : "", target: parts.length > 1 ? parts[1] : parts[0], readOnly: parts.includes("ro"), type: parts[0]?.startsWith("/") || parts[0]?.startsWith(".") ? "bind" : "volume" };
  }
  if (!volume || typeof volume !== "object") return { source: "", target: "", readOnly: false, type: "unknown" };
  return { source: text(volume.source), target: text(volume.target), readOnly: Boolean(volume.read_only), type: text(volume.type || "volume") };
}

function diagnostic(level, code, message, service = null) {
  return { level, code, message, service };
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

  const knownNames = new Set(serviceEntries.map(([name]) => name));
  const availableProfiles = new Set();
  const services = serviceEntries.map(([name, serviceValue]) => {
    const service = serviceValue && typeof serviceValue === "object" ? serviceValue : {};
    const profiles = list(service.profiles);
    profiles.forEach((profile) => availableProfiles.add(profile));
    const active = !profiles.length || profiles.some((profile) => selectedProfiles.includes(profile));
    const dependsOn = list(service.depends_on);
    for (const dependency of dependsOn) if (!knownNames.has(dependency)) diagnostics.push(diagnostic("error", "unknown-dependency", `Der Dienst „${name}“ hängt von dem unbekannten Dienst „${dependency}“ ab.`, name));
    if (!service.image && !service.build) diagnostics.push(diagnostic("error", "missing-image", `Der Dienst „${name}“ besitzt weder image noch build.`, name));
    if (service.build) diagnostics.push(diagnostic(service.image ? "warning" : "error", "build-required", `Der Dienst „${name}“ benötigt einen Image-Build; 0.3.3 analysiert Builds nur.`, name));
    if (service.privileged) diagnostics.push(diagnostic("error", "privileged", `Der Dienst „${name}“ fordert privilegierten Betrieb an.`, name));
    if (service.network_mode === "host") diagnostics.push(diagnostic("error", "host-network", `Der Dienst „${name}“ verwendet das Host-Netzwerk.`, name));
    if (service.pid === "host" || service.ipc === "host") diagnostics.push(diagnostic("error", "host-namespace", `Der Dienst „${name}“ verwendet einen Host-Namensraum.`, name));
    if (service.devices) diagnostics.push(diagnostic("warning", "devices", `Gerätefreigaben von „${name}“ müssen vor einer Ausführung manuell geprüft werden.`, name));
    if (service.cap_add || service.security_opt) diagnostics.push(diagnostic("warning", "security-options", `Zusätzliche Sicherheitsrechte von „${name}“ müssen manuell geprüft werden.`, name));
    if (service.extends) diagnostics.push(diagnostic("error", "extends", `extends von „${name}“ wird noch nicht aufgelöst.`, name));
    return {
      name,
      active,
      image: text(service.image),
      build: Boolean(service.build),
      profiles,
      dependsOn,
      ports: list(service.ports).map(portSummary).filter(Boolean),
      volumes: (Array.isArray(service.volumes) ? service.volumes : []).map(volumeSummary),
      networks: list(service.networks),
      environment: environmentNames(service.environment),
      healthcheck: Boolean(service.healthcheck && !service.healthcheck.disable),
      restart: text(service.restart),
    };
  });
  const startOrder = dependencyOrder(services, diagnostics);
  const errorCount = diagnostics.filter((item) => item.level === "error").length;
  const warningCount = diagnostics.filter((item) => item.level === "warning").length;
  return {
    readOnly: true,
    compatible: errorCount === 0,
    services,
    profiles: { available: [...availableProfiles].sort(), selected: selectedProfiles },
    networks: Object.keys(compose.networks || {}).sort(),
    volumes: Object.keys(compose.volumes || {}).sort(),
    startOrder,
    diagnostics,
    summary: { services: services.length, activeServices: services.filter((service) => service.active).length, errors: errorCount, warnings: warningCount },
  };
}
