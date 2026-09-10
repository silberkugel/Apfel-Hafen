import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";

// Only operation metadata/output is persisted, never commands, credentials or input.
export class OperationStore {
  constructor(path, program, { spawnProcess = spawn } = {}) {
    this.path = path;
    this.program = program;
    this.spawnProcess = spawnProcess;
    this.operations = [];
    this.pendingWrite = Promise.resolve();
  }
  async load() {
    try {
      const saved = JSON.parse(await readFile(this.path, "utf8"));
      this.operations = (Array.isArray(saved) ? saved : []).slice(0, 50).map((item) => item.status === "running" ? { ...item, status: "interrupted", finishedAt: new Date().toISOString(), error: "Server restart: check the result before retrying." } : item);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  list() { return this.operations.map((item) => ({ ...item })); }
  save() {
    const data = JSON.stringify(this.operations);
    this.pendingWrite = this.pendingWrite.catch(() => {}).then(async () => {
      await writeFile(`${this.path}.tmp`, data, { mode: 0o600 });
      await rename(`${this.path}.tmp`, this.path);
    });
    return this.pendingWrite;
  }
  async start(kind, label, args, { input = "", cleanup = async () => {} } = {}) {
    if (this.operations.filter((item) => item.status === "running").length >= 3) throw new Error("At most three operations can run at the same time.");
    if (this.operations.some((item) => item.status === "running" && item.label === label)) throw new Error("This operation is already running.");
    const operation = { id: randomUUID(), kind, label, status: "running", output: "", startedAt: new Date().toISOString(), finishedAt: null, error: "" };
    const running = this.operations.filter((item) => item.status === "running");
    this.operations = [operation, ...running, ...this.operations.filter((item) => item.status !== "running").slice(0, 49 - running.length)];
    try { await this.save(); } catch (error) { this.operations = this.operations.filter((item) => item !== operation); throw error; }
    let child;
    let finished = false;
    let persistenceTimer;
    const credentialOperation = kind.startsWith("registry.");
    const finish = async (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(persistenceTimer);
      operation.status = error ? "failed" : "succeeded";
      operation.error = error ? (credentialOperation ? "Registry operation failed. Check credentials and registry host." : error.message) : "";
      operation.finishedAt = new Date().toISOString();
      try { await cleanup(); await this.save(); } catch (failure) { console.error("Operation persistence/cleanup failed:", failure.message); }
    };
    try {
      child = this.spawnProcess(this.program, args, { shell: false, timeout: 30 * 60 * 1000, killSignal: "SIGKILL" });
      const append = (data) => {
        if (credentialOperation) return;
        operation.output = `${operation.output}${data.toString()}`.slice(-100_000);
        if (!persistenceTimer) persistenceTimer = setTimeout(() => { persistenceTimer = null; this.save().catch((error) => console.error("Cannot save operation:", error.message)); }, 1000);
      };
      child.stdout.on("data", append);
      child.stderr.on("data", append);
      child.on("error", finish);
      child.on("close", (code, signal) => finish(code === 0 ? null : new Error(`Command exited with ${signal || code}. See operation output.`)));
      child.stdin.on("error", () => {});
      child.stdin.end(input);
    } catch (error) { await finish(error); }
    return { ...operation };
  }
}
