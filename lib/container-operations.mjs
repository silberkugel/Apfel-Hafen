import { isAbsolute, resolve } from "node:path";

const referencePattern = /^[^\s\0]{1,500}$/;
const registryPattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?)(?::\d{1,5})?$/;

function requiredText(value, maximum, field) {
  const result = String(value || "").trim();
  if (!result || result.length > maximum || result.includes("\0")) throw new Error(`${field} ist ungültig.`);
  return result;
}

export function validateImageReference(value) {
  const reference = requiredText(value, 500, "Image-Referenz");
  if (!referencePattern.test(reference) || reference.startsWith("-")) throw new Error("Image-Referenz ist ungültig.");
  return reference;
}

export function validateRegistryHost(value) {
  const host = requiredText(value, 253, "Registry").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!registryPattern.test(host)) throw new Error("Registry ist ungültig.");
  return host;
}

export function parseImages(output) {
  const records = JSON.parse(output || "[]");
  if (!Array.isArray(records)) throw new Error("Die Image-Liste hat ein unerwartetes Format.");
  return records.map((record, index) => {
    const references = [record.configuration?.name, record.reference, record.name, ...(record.names || []), ...(record.tags || [])].filter(Boolean).map(String);
    const variants = (record.variants || []).filter((item) => item.platform?.architecture !== "unknown");
    const reference = references[0] || String(record.id || record.digest || `image-${index + 1}`);
    return {
      id: String(record.id || record.digest || reference),
      reference,
      references: [...new Set(references.length ? references : [reference])],
      digest: String(record.digest || record.descriptor?.digest || record.configuration?.descriptor?.digest || ""),
      sizeInBytes: Number(record.sizeInBytes ?? record.size ?? (variants.length ? variants.reduce((sum, item) => sum + (Number(item.size) || 0), 0) : 0)) || 0,
      os: String(record.platform?.os || record.os || ""),
      architecture: String(record.platform?.architecture || record.architecture || record.arch || [...new Set(variants.map((item) => item.platform?.architecture).filter(Boolean))].join(", ")),
      createdAt: String(record.createdAt || record.created || ""),
    };
  }).sort((left, right) => left.reference.localeCompare(right.reference, "en", { sensitivity: "base", numeric: true }));
}

export function imageActionArgs(action, input = {}) {
  if (action === "pull" || action === "push" || action === "delete" || action === "inspect") {
    return ["image", action, validateImageReference(input.reference)];
  }
  if (action === "tag") return ["image", "tag", validateImageReference(input.source), validateImageReference(input.target)];
  throw new Error("Unbekannte Image-Aktion.");
}

export function registryAction(action, input = {}) {
  const host = validateRegistryHost(input.host);
  if (action === "logout") return { args: ["registry", "logout", host], input: "" };
  if (action !== "login") throw new Error("Unbekannte Registry-Aktion.");
  const username = requiredText(input.username, 200, "Registry-Benutzername");
  const password = String(input.password || "");
  if (!password || password.length > 4096 || password.includes("\0")) throw new Error("Registry-Passwort ist ungültig.");
  return { args: ["registry", "login", "--username", username, "--password-stdin", host], input: `${password}\n` };
}

export function builderActionArgs(action, input = {}) {
  if (["status", "stop", "delete"].includes(action)) return ["builder", action];
  if (action !== "start") throw new Error("Unbekannte Builder-Aktion.");
  const cpus = Number(input.cpus);
  const memoryMb = Number(input.memoryMb);
  if (!Number.isInteger(cpus) || cpus < 1 || cpus > 256) throw new Error("Builder-CPU-Anzahl ist ungültig.");
  if (!Number.isInteger(memoryMb) || memoryMb < 256 || memoryMb > 1048576) throw new Error("Builder-Arbeitsspeicher ist ungültig.");
  return ["builder", "start", "--cpus", String(cpus), "--memory", `${memoryMb}M`];
}

export function buildImageArgs(input = {}) {
  const contextInput = requiredText(input.context, 1000, "Build-Kontext");
  if (!isAbsolute(contextInput)) throw new Error("Build-Kontext muss absolut sein.");
  const context = resolve(contextInput);
  const args = ["build", "--tag", validateImageReference(input.tag), "--progress", "plain"];
  const dockerfile = input.dockerfileContent === undefined ? String(input.dockerfile || "").trim() : "";
  if (dockerfile) {
    if (!isAbsolute(dockerfile) || dockerfile.length > 1000) throw new Error("Dockerfile-Pfad muss absolut sein.");
    args.push("--file", resolve(dockerfile));
  }
  const architectures = [...new Set((Array.isArray(input.architectures) ? input.architectures : []).map(String))];
  if (!architectures.length || architectures.some((item) => !["arm64", "amd64"].includes(item))) throw new Error("Mindestens eine gültige Zielarchitektur auswählen.");
  for (const architecture of architectures) args.push("--arch", architecture);
  args.push(context);
  return args;
}

export function parseRegistryList(output) {
  const trimmed = String(output || "").trim();
  if (!trimmed) return [];
  try {
    const records = JSON.parse(trimmed);
    if (Array.isArray(records)) return records.map((record) => typeof record === "string" ? record : String(record.hostname || record.host || record.registry || record.domain || "")).filter(Boolean);
  } catch {}
  return trimmed.split(/\r?\n/).map((line) => line.trim().split(/\s+/)[0]).filter((line) => line && !/^(HOST|REGISTRY)$/i.test(line));
}

export function safeLogOptions(input = {}) {
  const tail = Number(input.tail ?? 200);
  if (!Number.isInteger(tail) || tail < 1 || tail > 5000) throw new Error("Log-Zeilenlimit ist ungültig.");
  return { tail, boot: Boolean(input.boot) };
}
