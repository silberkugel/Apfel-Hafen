const openCodeHost = "gitlab.opencode.de";
const registryHost = "registry.opencode.de";

export function openCodeSearchInput(value) {
  const original = String(value || "").trim();
  if (original.length < 2 || original.length > 500) return null;

  let projectPath = "";
  try {
    const candidate = new URL(original);
    if (candidate.hostname !== openCodeHost) return null;
    projectPath = candidate.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "").split("/-/")[0];
  } catch {
    if (/^[a-zA-Z0-9._/-]+$/.test(original) && original.includes("/")) projectPath = original.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
  }

  if (projectPath && !/^[a-zA-Z0-9._/-]+$/.test(projectPath)) return null;
  return { query: projectPath || original, projectPath: projectPath || null };
}

export function tagDate(tag) {
  return tag?.created_at || tag?.commit?.committed_date || tag?.commit?.created_at || null;
}

export function latestStableTag(tags = []) {
  const valid = tags.filter((tag) => tag?.name);
  const stable = valid.filter((tag) => !/(?:alpha|beta|rc|preview|nightly|dev)/i.test(tag.name));
  const versionParts = (name) => String(name).match(/^v?(\d+(?:\.\d+)+)(?:[-+].*)?$/)?.[1].split(".").map(Number) || null;
  const compare = (left, right) => {
    const leftParts = versionParts(left.name);
    const rightParts = versionParts(right.name);
    if (leftParts && rightParts) {
      for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
        const difference = (rightParts[index] || 0) - (leftParts[index] || 0);
        if (difference) return difference;
      }
    } else if (leftParts || rightParts) return leftParts ? -1 : 1;
    return String(tagDate(right) || "").localeCompare(String(tagDate(left) || ""));
  };
  return stable.sort(compare)[0] || valid.sort(compare)[0] || null;
}

export function parseComposeOpenCodeImages(source) {
  const references = [];
  for (const line of String(source || "").split(/\r?\n/)) {
    const match = line.match(/^\s*image:\s*["']?([^"'#\s]+)["']?\s*(?:#.*)?$/);
    if (!match) continue;
    const expanded = match[1].replace(/\$\{[A-Za-z_][A-Za-z0-9_]*(?::-|-)([^}]+)\}/g, "$1");
    if (expanded.includes("${") || !expanded.startsWith(`${registryHost}/`)) continue;
    if (!references.includes(expanded)) references.push(expanded);
  }
  return references;
}

export function imageProjectPath(reference) {
  const escapedRegistry = registryHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutRegistry = String(reference || "").replace(new RegExp(`^${escapedRegistry}/`), "");
  return withoutRegistry.replace(/@sha256:[a-f0-9]+$/i, "").replace(/:[^/:]+$/, "");
}

export function imageVersion(reference, fallback = "latest") {
  const value = String(reference || "");
  if (value.includes("@")) return value.slice(value.indexOf("@") + 1);
  return value.match(/:([^/:]+)$/)?.[1] || fallback;
}

export function openCodeImageResult({ reference, project, tag, sourceProject, sourceVersion }) {
  const version = imageVersion(reference, tag?.name || "latest");
  return {
    source: "opencode",
    name: project?.name_with_namespace || project?.name || imageProjectPath(reference),
    reference,
    description: project?.description || "Offizielles Image aus der OpenCode Container Registry",
    official: false,
    version,
    releasedAt: tagDate(tag),
    projectUrl: project?.web_url || sourceProject?.web_url || null,
    sourceProject: sourceProject?.path_with_namespace || project?.path_with_namespace || imageProjectPath(reference),
    sourceVersion: sourceVersion || tag?.name || version,
  };
}
