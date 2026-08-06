import { isAbsolute, relative, resolve } from "node:path";

const namePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const variablePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

function text(value, maximum, field) {
  if (typeof value !== "string" || value.length > maximum) throw new Error(`${field} ist ungültig.`);
  return value.trim();
}

function port(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) throw new Error(`${field} muss zwischen 1 und 65535 liegen.`);
  return number;
}

function resource(value, minimum, maximum, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`${field} muss zwischen ${minimum} und ${maximum} liegen.`);
  }
  return number;
}

export function safeVolumeSource(basePath, subpath) {
  if (!isAbsolute(basePath)) throw new Error("Der globale Volume-Pfad muss absolut sein.");
  const clean = text(subpath, 200, "Volume-Unterordner");
  if (!clean || isAbsolute(clean)) throw new Error("Der Volume-Unterordner muss relativ sein.");
  const source = resolve(basePath, clean);
  const relation = relative(resolve(basePath), source);
  if (!relation || relation.startsWith("..") || isAbsolute(relation)) throw new Error("Der Volume-Unterordner liegt außerhalb des globalen Pfads.");
  return source;
}

export function validateContainerDraft(input, basePath, occupiedPorts = []) {
  const name = text(input?.name, 64, "Containername");
  if (!namePattern.test(name)) throw new Error("Der Containername darf nur Buchstaben, Zahlen, Punkt, Unterstrich und Bindestrich enthalten.");
  const image = text(input?.image, 300, "Image");
  if (!image || /\s/.test(image)) throw new Error("Bitte eine gültige Image-Referenz angeben.");
  const cpus = resource(input?.cpus, 1, 256, "CPU-Anzahl");
  if (!Number.isInteger(cpus)) throw new Error("CPU-Anzahl muss eine ganze Zahl sein.");
  const memoryMb = resource(input?.memoryMb, 64, 1048576, "Arbeitsspeicher (MB)");
  if (!Number.isInteger(memoryMb)) throw new Error("Arbeitsspeicher (MB) muss eine ganze Zahl sein.");

  const variables = Array.isArray(input.variables) ? input.variables : [];
  if (variables.length > 128) throw new Error("Es sind höchstens 128 Variablen erlaubt.");
  const variableNames = new Set();
  const normalizedVariables = variables.map((item) => {
    const key = text(item?.key, 128, "Variablenname");
    if (!variablePattern.test(key) || variableNames.has(key)) throw new Error(`Der Variablenname „${key || "?"}“ ist ungültig oder doppelt.`);
    variableNames.add(key);
    if (typeof item?.value !== "string" || item.value.length > 4096) throw new Error(`Der Wert von „${key}“ ist zu lang.`);
    return { key, value: item.value };
  });

  const used = new Set(occupiedPorts.map((item) => `${item.protocol}:${item.hostPort}`));
  const ports = Array.isArray(input.ports) ? input.ports : [];
  if (ports.length > 32) throw new Error("Es sind höchstens 32 Portfreigaben erlaubt.");
  const normalizedPorts = ports.map((item) => {
    const hostPort = port(item?.hostPort, "Externer Port");
    const containerPort = port(item?.containerPort, "Container-Port");
    const protocol = String(item?.protocol || "tcp").toLowerCase();
    if (!['tcp', 'udp'].includes(protocol)) throw new Error("Als Protokoll ist nur TCP oder UDP erlaubt.");
    const key = `${protocol}:${hostPort}`;
    if (used.has(key)) throw new Error(`Der externe Port ${hostPort}/${protocol.toUpperCase()} ist bereits belegt.`);
    used.add(key);
    return { hostPort, containerPort, protocol };
  });

  const volumes = Array.isArray(input.volumes) ? input.volumes : [];
  if (volumes.length > 16) throw new Error("Es sind höchstens 16 Volumes erlaubt.");
  const normalizedVolumes = volumes.map((item) => {
    const destination = text(item?.destination, 300, "Container-Pfad");
    if (!destination.startsWith("/")) throw new Error("Der Container-Pfad eines Volumes muss absolut sein.");
    return { source: safeVolumeSource(basePath, item?.subpath), destination, readOnly: Boolean(item?.readOnly) };
  });

  return { name, image, cpus, memoryMb, start: Boolean(input.start), variables: normalizedVariables, ports: normalizedPorts, volumes: normalizedVolumes };
}

export function validateContainerSettings(input, occupiedPorts = []) {
  const cpus = resource(input?.cpus, 1, 256, "CPU-Anzahl");
  if (!Number.isInteger(cpus)) throw new Error("CPU-Anzahl muss eine ganze Zahl sein.");
  const memoryMb = resource(input?.memoryMb, 64, 1048576, "Arbeitsspeicher (MB)");
  if (!Number.isInteger(memoryMb)) throw new Error("Arbeitsspeicher (MB) muss eine ganze Zahl sein.");

  const variables = Array.isArray(input?.variables) ? input.variables : [];
  if (variables.length > 128) throw new Error("Es sind höchstens 128 Variablen erlaubt.");
  const variableNames = new Set();
  const normalizedVariables = variables.map((item) => {
    const key = text(item?.key, 128, "Variablenname");
    if (!variablePattern.test(key) || variableNames.has(key)) throw new Error(`Der Variablenname „${key || "?"}“ ist ungültig oder doppelt.`);
    variableNames.add(key);
    if (typeof item?.value !== "string" || item.value.length > 4096) throw new Error(`Der Wert von „${key}“ ist zu lang.`);
    return { key, value: item.value };
  });

  const used = new Set(occupiedPorts.map((item) => `${item.protocol}:${item.hostPort}`));
  const inputPorts = Array.isArray(input?.ports) ? input.ports : [];
  if (inputPorts.length > 32) throw new Error("Es sind höchstens 32 Portfreigaben erlaubt.");
  const ports = inputPorts.map((item) => {
    const hostPort = port(item?.hostPort, "Externer Port");
    const containerPort = port(item?.containerPort, "Container-Port");
    const protocol = String(item?.protocol || "tcp").toLowerCase();
    if (!["tcp", "udp"].includes(protocol)) throw new Error("Als Protokoll ist nur TCP oder UDP erlaubt.");
    const key = `${protocol}:${hostPort}`;
    if (used.has(key)) throw new Error(`Der externe Port ${hostPort}/${protocol.toUpperCase()} ist bereits belegt.`);
    used.add(key);
    return { hostPort, containerPort, protocol, hostAddress: text(item?.hostAddress || "", 80, "Host-Adresse") };
  });

  const inputVolumes = Array.isArray(input?.volumes) ? input.volumes : [];
  if (inputVolumes.length > 16) throw new Error("Es sind höchstens 16 Volumes erlaubt.");
  const volumes = inputVolumes.map((item) => {
    const source = text(item?.source, 500, "Host-Pfad");
    const destination = text(item?.destination, 300, "Container-Pfad");
    if (!isAbsolute(source)) throw new Error("Der Host-Pfad eines Volumes muss absolut sein.");
    if (!destination.startsWith("/")) throw new Error("Der Container-Pfad eines Volumes muss absolut sein.");
    return { source, destination, readOnly: Boolean(item?.readOnly) };
  });
  return { cpus, memoryMb, variables: normalizedVariables, ports, volumes };
}

export function buildNewContainerArgs(draft) {
  const args = ["create", "--name", draft.name];
  args.push("--cpus", String(draft.cpus), "--memory", `${draft.memoryMb}M`);
  for (const variable of draft.variables) args.push("--env", `${variable.key}=${variable.value}`);
  for (const mapping of draft.ports) args.push("--publish", `${mapping.hostPort}:${mapping.containerPort}/${mapping.protocol}`);
  for (const volume of draft.volumes) args.push("--volume", `${volume.source}:${volume.destination}${volume.readOnly ? ":ro" : ""}`);
  args.push(draft.image);
  return args;
}

export function parseImageNames(output) {
  const records = JSON.parse(output || "[]");
  if (!Array.isArray(records)) return [];
  return [...new Set(records.flatMap((record) => [record.name, record.reference, ...(record.names || [])]).filter(Boolean).map(String))]
    .sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
}
