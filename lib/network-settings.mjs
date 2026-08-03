export const localListenHost = "127.0.0.1";
export const networkListenHost = "0.0.0.0";

export function normalizeListenHost(value) {
  return value === networkListenHost ? networkListenHost : localListenHost;
}

export function requestMatchesOrigin(origin, host) {
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.host.toLowerCase() === String(host).toLowerCase();
  } catch {
    return false;
  }
}
