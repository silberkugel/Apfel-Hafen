// Registry-Tag-Erkennung für Container mit gepinnter Versions-Referenz.
//
// Der Digest-Vergleich desselben Image-Tags kann eine neue Veröffentlichung
// nie erkennen (z. B. ghcr.io/open-webui/open-webui:v0.13.2 bleibt unverändert,
// obwohl v0.13.3 existiert). Diese Module fragt die Tag-Liste der Registry ab
// und ermittelt die neueste höhere Version bzw. den Manifest-Digest.

const GHCR_TOKEN_URL = "https://ghcr.io/token";
const GHCR_API = "https://ghcr.io/v2";
const DOCKER_HUB_API = "https://registry.hub.docker.com/v2/repositories";
const DOCKER_REGISTRY_API = "https://registry-1.docker.io/v2";
const DOCKER_AUTH_URL = "https://auth.docker.io/token";
const MAX_PAGES = 60;
const FETCH_TIMEOUT_MS = 15_000;
const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

async function fetchJson(url, headers = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Registry-Antwort ${response.status} für ${new URL(url).host}`);
  return response;
}

/**
 * Zerlegt eine Image-Referenz in Registry, Repository, Tag und Digest.
 * Unbekannte Formate liefern null.
 */
export function parseImageReference(reference) {
  const raw = String(reference || "").trim();
  if (!raw || /\s/.test(raw)) return null;

  const atIndex = raw.lastIndexOf("@");
  const digest = atIndex >= 0 ? raw.slice(atIndex + 1) : null;
  if (digest && !/^[a-z0-9]+:[a-f0-9]{8,}$/i.test(digest)) return null;
  const withoutDigest = digest ? raw.slice(0, atIndex) : raw;

  const slashIndex = withoutDigest.lastIndexOf("/");
  const colonIndex = withoutDigest.lastIndexOf(":");
  let repository = withoutDigest;
  let tag = null;
  if (colonIndex > slashIndex) {
    repository = withoutDigest.slice(0, colonIndex);
    tag = withoutDigest.slice(colonIndex + 1);
  }
  if (!repository) return null;
  const segments = repository.split("/");
  const segmentsValid = segments.every((segment, index) =>
    index === 0 ? /^[a-z0-9._-]+(:[0-9]+)?$/i.test(segment) : /^[a-z0-9._-]+$/i.test(segment));
  if (!segmentsValid) return null;
  if (tag !== null && !/^[a-z0-9._-]{1,128}$/i.test(tag)) return null;

  let registry = "docker.io";
  let path = repository;
  const firstSegment = repository.split("/")[0];
  const looksLikeHost = firstSegment.includes(".") || firstSegment.includes(":") || firstSegment === "localhost";
  if (repository.includes("/") && looksLikeHost) {
    registry = firstSegment.toLowerCase();
    path = repository.slice(firstSegment.length + 1);
  } else if (!repository.includes("/")) {
    path = `library/${repository}`;
  }
  return { registry, repository: path, tag, digest };
}

/** Ersetzt Tag bzw. Digest einer Referenz durch ein neues Tag, Form bleibt erhalten. */
export function withTag(reference, tag) {
  const raw = String(reference || "").trim();
  const base = raw.replace(/@.*/, "").replace(/:[^/:]+$/, "");
  if (!base) return null;
  return `${base}:${tag}`;
}

const VERSION_TAG_RE = /^v?(\d+(?:\.\d+){0,2})(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Liefert { major, minor, patch, suffix } für Versions-Tags wie v0.13.2 oder 1.27-cuda, sonst null. */
export function parseVersionTag(tag) {
  const match = String(tag || "").match(VERSION_TAG_RE);
  if (!match) return null;
  const [major, minor, patch] = match[1].split(".").map(Number);
  return { major, minor: minor ?? 0, patch: patch ?? 0, suffix: match[2] || null };
}

export function isVersionTag(tag) {
  return parseVersionTag(tag) !== null;
}

export function compareVersions(a, b) {
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  return 0;
}

/**
 * Findet das höchste Versions-Tag über currentTag in der Tag-Liste.
 * Varianten-Suffixe (z. B. -cuda) bleiben erhalten: wird aktuell v0.13.2-cuda
 * gefahren, wird nur v0.13.3-cuda angeboten, nicht das Basis-Image.
 * Bei gleicher Version bleibt der Präfix-Stil des aktuellen Tags erhalten
 * (v0.13.2 → v0.13.3, nicht 0.13.3).
 */
export function findNewerVersion(currentTag, tags) {
  const current = parseVersionTag(currentTag);
  if (!current) return null;
  const currentHasV = String(currentTag).trim().toLowerCase().startsWith("v");
  let best = null;
  for (const rawTag of tags) {
    const candidate = parseVersionTag(rawTag);
    if (!candidate || candidate.suffix !== current.suffix) continue;
    if (compareVersions(candidate, current) <= 0) continue;
    if (!best) {
      best = { tag: String(rawTag), version: candidate };
      continue;
    }
    const comparison = compareVersions(candidate, best.version);
    if (comparison > 0) {
      best = { tag: String(rawTag), version: candidate };
    } else if (comparison === 0) {
      const candidateMatchesStyle = String(rawTag).trim().toLowerCase().startsWith("v") === currentHasV;
      const bestMatchesStyle = best.tag.toLowerCase().startsWith("v") === currentHasV;
      if (candidateMatchesStyle && !bestMatchesStyle) best = { tag: String(rawTag), version: candidate };
    }
  }
  return best ? best.tag : null;
}

/** Liefert das neueste Versions-Tag; bei gleicher Version bevorzugt das Tag ohne Suffix, dann den v-Präfix. */
export function latestVersionTag(tags) {
  let best = null;
  for (const rawTag of tags) {
    const candidate = parseVersionTag(rawTag);
    if (!candidate) continue;
    if (!best) {
      best = { tag: String(rawTag), version: candidate };
      continue;
    }
    const comparison = compareVersions(candidate, best.version);
    if (comparison > 0) {
      best = { tag: String(rawTag), version: candidate };
      continue;
    }
    if (comparison !== 0) continue;
    const candidatePlain = candidate.suffix === null;
    const bestPlain = best.version.suffix === null;
    const candidateHasV = String(rawTag).trim().toLowerCase().startsWith("v");
    const bestHasV = best.tag.toLowerCase().startsWith("v");
    if ((candidatePlain && !bestPlain) || (candidatePlain === bestPlain && candidateHasV && !bestHasV)) {
      best = { tag: String(rawTag), version: candidate };
    }
  }
  return best ? best.tag : null;
}

async function ghcrToken(repository) {
  const response = await fetchJson(`${GHCR_TOKEN_URL}?scope=repository:${repository}:pull`);
  const body = await response.json();
  if (!body.token) throw new Error("Kein Registry-Token für ghcr.io erhalten.");
  return body.token;
}

// Pagination links come from the network — follow them only while they stay on
// the expected registry host, so a rogue "next" cannot redirect us elsewhere.
export function pinnedNextUrl(candidate, expectedHost) {
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate, `https://${expectedHost}`);
    if (parsed.protocol !== "https:" || parsed.hostname !== expectedHost) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function listGhcrTags(repository) {
  const token = await ghcrToken(repository);
  const tags = [];
  let url = `${GHCR_API}/${repository}/tags/list?n=1000`;
  let pages = 0;
  while (url && pages < MAX_PAGES) {
    const response = await fetchJson(url, { Authorization: `Bearer ${token}` });
    const body = await response.json();
    tags.push(...(body.tags || []));
    pages += 1;
    const link = response.headers.get("link") || "";
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = pinnedNextUrl(next ? next[1] : null, "ghcr.io");
  }
  return tags;
}

async function listDockerHubTags(repository) {
  const tags = [];
  let url = `${DOCKER_HUB_API}/${repository}/tags?page_size=100`;
  let pages = 0;
  while (url && pages < MAX_PAGES) {
    const response = await fetchJson(url);
    const body = await response.json();
    tags.push(...(body.results || []).map((entry) => entry.name));
    pages += 1;
    url = pinnedNextUrl(body.next || null, "registry.hub.docker.com");
  }
  return tags;
}

/**
 * Liefert die vollständige Tag-Liste der Registry oder null, wenn die
 * Registry nicht unterstützt wird (z. B. private oder lokale Registry).
 */
export async function listRegistryTags(reference) {
  const parsed = parseImageReference(reference);
  if (!parsed) return null;
  if (parsed.registry === "ghcr.io") return listGhcrTags(parsed.repository);
  if (parsed.registry === "docker.io") return listDockerHubTags(parsed.repository);
  return null;
}

/**
 * Liefert den Manifest-Digest eines Tags direkt aus der Registry,
 * ohne das Image herunterzuladen. Unbekannte Registry oder Tag: null.
 */
export async function registryManifestDigest(reference) {
  const parsed = parseImageReference(reference);
  if (!parsed || !parsed.tag) return null;
  try {
    if (parsed.registry === "ghcr.io") {
      const token = await ghcrToken(parsed.repository);
      const response = await fetch(`${GHCR_API}/${parsed.repository}/manifests/${parsed.tag}`, {
        method: "HEAD",
        headers: { Authorization: `Bearer ${token}`, Accept: MANIFEST_ACCEPT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      return response.headers.get("docker-content-digest");
    }
    if (parsed.registry === "docker.io") {
      const tokenResponse = await fetchJson(`${DOCKER_AUTH_URL}?service=registry.docker.io&scope=repository:${parsed.repository}:pull`);
      const token = (await tokenResponse.json()).token;
      if (!token) return null;
      const response = await fetch(`${DOCKER_REGISTRY_API}/${parsed.repository}/manifests/${parsed.tag}`, {
        method: "HEAD",
        headers: { Authorization: `Bearer ${token}`, Accept: MANIFEST_ACCEPT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      return response.headers.get("docker-content-digest");
    }
  } catch {
    return null;
  }
  return null;
}
