export function isLocalImageReference(reference) {
  return /^local\//i.test(String(reference || "").trim());
}

export function shouldPullImage(reference) {
  return !isLocalImageReference(reference);
}

export function dockerHubSearchInput(value) {
  const original = String(value || "").trim().toLowerCase();
  if (original.length < 2 || original.length > 300 || /\s/.test(original)) return null;

  let repository = original.replace(/^https?:\/\//, "").replace(/^docker\.io\//, "");
  if (repository.startsWith("library/")) repository = repository.slice("library/".length);
  repository = repository.replace(/@sha256:[a-f0-9]+$/i, "").replace(/:[^/:]+$/, "");
  if (!repository || !/^[a-z0-9._/-]+$/.test(repository)) return null;

  const hasExplicitReference = original.startsWith("docker.io/") || original.includes(":") || original.includes("@");
  const canonicalRepository = repository.includes("/") ? repository : `library/${repository}`;
  const suffix = original.includes("@") ? original.slice(original.indexOf("@")) : `:${original.match(/:([^/:]+)$/)?.[1] || "latest"}`;
  return {
    query: repository,
    directReference: hasExplicitReference ? {
      name: repository.replace(/^library\//, ""),
      reference: `docker.io/${canonicalRepository}${suffix}`,
      description: "Direkte Image-Referenz",
      official: canonicalRepository.startsWith("library/"),
      direct: true,
      pulls: 0,
      stars: 0,
    } : null,
  };
}

export function updateCheckResult(reference, oldDigest, newDigest) {
  const localImage = isLocalImageReference(reference);
  const available = String(newDigest) !== String(oldDigest);
  return {
    available,
    message: available
      ? "Image-Update ist verfügbar."
      : localImage
        ? "Lokales Image ist aktuell. Für lokale Images ist kein Registry-Update verfügbar."
        : "Kein Image-Update verfügbar.",
  };
}
