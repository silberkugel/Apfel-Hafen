// Guest reads (no admin session) may only see redacted status data, but every
// list request spawns the container CLI or launchctl subprocesses. A
// per-address rate limit plus a short-lived cache bounds the process fan-out
// an unauthenticated caller can cause (rate limit 429, TTL serves repeats).

export const guestReadPaths = new Set([
  "/api/status",
  "/api/auth/session",
  "/api/containers",
  "/api/services/launchd",
]);

export function guestReadRateLimited(guard, req) {
  return !guard(req?.socket?.remoteAddress || "local");
}

export function createGuestReadGuard({ windowMs = 60_000, maxRequests = 30 } = {}) {
  const attempts = new Map();
  return function guestReadAllowed(address, now = Date.now()) {
    const recent = (attempts.get(address) || []).filter((time) => now - time < windowMs);
    if (recent.length >= maxRequests) {
      attempts.set(address, recent);
      return false;
    }
    recent.push(now);
    attempts.set(address, recent);
    if (attempts.size > 1000) {
      for (const [stored, times] of attempts) {
        const fresh = times.filter((time) => now - time < windowMs);
        if (fresh.length) attempts.set(stored, fresh);
        else attempts.delete(stored);
      }
    }
    return true;
  };
}

export function createGuestReadCache({ ttlMs = 5_000 } = {}) {
  const entries = new Map();
  return {
    read(key, load) {
      const entry = entries.get(key);
      if (entry?.pending) return entry.pending;
      if (entry && Date.now() - entry.createdAt < ttlMs) return Promise.resolve(entry.value);
      const pending = Promise.resolve()
        .then(load)
        .then((value) => {
          entries.set(key, { createdAt: Date.now(), value });
          return value;
        })
        .catch((error) => {
          if (entries.get(key)?.pending === pending) entries.delete(key);
          throw error;
        });
      entries.set(key, { createdAt: 0, value: undefined, pending });
      return pending;
    },
    invalidate(key) {
      entries.delete(key);
    },
  };
}
