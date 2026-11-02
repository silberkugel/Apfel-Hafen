import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { rmSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";

export function actualUserHome() {
  return userInfo().homedir;
}

export function serviceRuntimePaths(home = actualUserHome()) {
  const support = join(home, "Library", "Application Support", "Apfel-Hafen");
  return {
    support,
    lock: join(support, "service.lock"),
    mcpToken: join(support, "mcp-token"),
  };
}

function processExists(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

export async function acquireServiceLock(lockPath, { pid = process.pid, startId = randomUUID() } = {}) {
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await mkdir(lockPath, { mode: 0o700 });
      await writeFile(join(lockPath, "owner.json"), JSON.stringify({ pid, startId, startedAt: new Date().toISOString() }), { mode: 0o600 });
      return { acquired: true, pid, startId, lockPath };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let owner = {};
      try { owner = JSON.parse(await readFile(join(lockPath, "owner.json"), "utf8")); } catch {}
      if (processExists(Number(owner.pid))) return { acquired: false, owner, lockPath };
      await rm(lockPath, { recursive: true, force: true });
    }
  }
  return { acquired: false, owner: {}, lockPath };
}

export function releaseServiceLock(lock) {
  if (lock?.acquired) rmSync(lock.lockPath, { recursive: true, force: true });
}

function prefixWriter(stream, context) {
  const originalWrite = stream.write.bind(stream);
  let atLineStart = true;
  stream.write = (chunk, encoding, callback) => {
    if (typeof encoding === "function") {
      callback = encoding;
      encoding = undefined;
    }
    const input = Buffer.isBuffer(chunk) ? chunk.toString(encoding || "utf8") : String(chunk);
    let output = "";
    for (const part of input.split(/(?<=\n)/)) {
      if (part === "") continue;
      if (atLineStart) output += `[${new Date().toISOString()}] pid=${context.pid} start=${context.startId} `;
      output += part;
      atLineStart = part.endsWith("\n");
    }
    return originalWrite(output, encoding, callback);
  };
}

export function installServiceLogContext({ pid = process.pid, startId = randomUUID() } = {}) {
  const context = { pid, startId };
  prefixWriter(process.stdout, context);
  prefixWriter(process.stderr, context);
  process.stdout.write("--- Apfel-Hafen service start ---\n");
  process.stderr.write("--- Apfel-Hafen service start ---\n");
  return context;
}
