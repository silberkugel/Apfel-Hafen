export function isLocalImageReference(reference) {
  return /^local\//i.test(String(reference || "").trim());
}

export function shouldPullImage(reference) {
  return !isLocalImageReference(reference);
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
