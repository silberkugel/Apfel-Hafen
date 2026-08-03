import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { networkInterfaces, hostname } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { X509Certificate, createPrivateKey, createPublicKey } from "node:crypto";
import { createSecureContext } from "node:tls";

const execFileAsync = promisify(execFile);
const certificateDays = 825;

function tlsPaths(root) {
  const directory = join(root, "data", "tls");
  return {
    directory,
    fallbackCertificate: join(directory, "fallback-cert.pem"),
    fallbackKey: join(directory, "fallback-key.pem"),
    customCertificate: join(directory, "custom-cert.pem"),
    customKey: join(directory, "custom-key.pem"),
  };
}

function subjectAltNames() {
  const dns = new Set(["localhost"]);
  const localHostname = hostname().trim().toLowerCase();
  if (/^[a-z0-9.-]+$/.test(localHostname)) {
    dns.add(localHostname);
    if (!localHostname.includes(".")) dns.add(`${localHostname}.local`);
  }
  const ips = new Set(["127.0.0.1"]);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) ips.add(address.address);
    }
  }
  return { dns: [...dns], ips: [...ips] };
}

function opensslConfiguration() {
  const names = subjectAltNames();
  const altNames = [
    ...names.dns.map((value, index) => `DNS.${index + 1} = ${value}`),
    ...names.ips.map((value, index) => `IP.${index + 1} = ${value}`),
  ].join("\n");
  return `[req]\nprompt = no\ndistinguished_name = dn\nx509_extensions = v3_req\n[dn]\nCN = Apfel-Hafen\n[v3_req]\nsubjectAltName = @alt_names\nbasicConstraints = critical,CA:FALSE\nkeyUsage = critical,digitalSignature,keyEncipherment\nextendedKeyUsage = serverAuth\n[alt_names]\n${altNames}\n`;
}

export function validatePemPair(certificate, privateKey) {
  if (typeof certificate !== "string" || certificate.length > 256_000 || !certificate.includes("BEGIN CERTIFICATE")) throw new Error("Das Zertifikat ist ungültig.");
  if (typeof privateKey !== "string" || privateKey.length > 256_000 || !privateKey.includes("PRIVATE KEY")) throw new Error("Der private Schlüssel ist ungültig.");
  const parsedCertificate = new X509Certificate(certificate);
  const parsedKey = createPrivateKey(privateKey);
  const certificatePublicKey = parsedCertificate.publicKey.export({ type: "spki", format: "der" });
  const privatePublicKey = createPublicKey(parsedKey).export({ type: "spki", format: "der" });
  if (!certificatePublicKey.equals(privatePublicKey)) throw new Error("Zertifikat und privater Schlüssel passen nicht zusammen.");
  const now = Date.now();
  if (Date.parse(parsedCertificate.validFrom) > now) throw new Error("Das Zertifikat ist noch nicht gültig.");
  if (Date.parse(parsedCertificate.validTo) <= now) throw new Error("Das Zertifikat ist abgelaufen.");
  createSecureContext({ cert: certificate, key: privateKey, minVersion: "TLSv1.2" });
  return parsedCertificate;
}

async function readPair(certificatePath, keyPath) {
  const [cert, key] = await Promise.all([readFile(certificatePath, "utf8"), readFile(keyPath, "utf8")]);
  validatePemPair(cert, key);
  return { cert, key, minVersion: "TLSv1.2" };
}

function certificateStatus(parsedCertificate, source) {
  return {
    source,
    subject: parsedCertificate.subject,
    issuer: parsedCertificate.issuer,
    validFrom: parsedCertificate.validFrom,
    validTo: parsedCertificate.validTo,
    fingerprint: parsedCertificate.fingerprint256,
    subjectAltName: parsedCertificate.subjectAltName || "",
  };
}

export async function ensureFallbackCertificate(root) {
  const paths = tlsPaths(root);
  await mkdir(paths.directory, { recursive: true, mode: 0o700 });
  try {
    return await readPair(paths.fallbackCertificate, paths.fallbackKey);
  } catch {
    const suffix = `${process.pid}-${Date.now()}`;
    const temporaryConfig = join(paths.directory, `.fallback-${suffix}.cnf`);
    const temporaryCertificate = join(paths.directory, `.fallback-cert-${suffix}.pem`);
    const temporaryKey = join(paths.directory, `.fallback-key-${suffix}.pem`);
    try {
      await writeFile(temporaryConfig, opensslConfiguration(), { mode: 0o600 });
      await execFileAsync("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", String(certificateDays), "-keyout", temporaryKey, "-out", temporaryCertificate, "-config", temporaryConfig, "-extensions", "v3_req"], { timeout: 30_000 });
      const pair = await readPair(temporaryCertificate, temporaryKey);
      await chmod(temporaryKey, 0o600);
      await chmod(temporaryCertificate, 0o644);
      await rename(temporaryKey, paths.fallbackKey);
      await rename(temporaryCertificate, paths.fallbackCertificate);
      return pair;
    } finally {
      await rm(temporaryConfig, { force: true });
      await rm(temporaryCertificate, { force: true });
      await rm(temporaryKey, { force: true });
    }
  }
}

export async function loadTlsCertificate(root) {
  const paths = tlsPaths(root);
  const fallback = await ensureFallbackCertificate(root);
  try {
    const custom = await readPair(paths.customCertificate, paths.customKey);
    const parsed = validatePemPair(custom.cert, custom.key);
    return { ...custom, status: certificateStatus(parsed, "custom") };
  } catch {
    const parsed = validatePemPair(fallback.cert, fallback.key);
    return { ...fallback, status: certificateStatus(parsed, "fallback") };
  }
}

export async function installCustomCertificate(root, certificate, privateKey) {
  const paths = tlsPaths(root);
  const parsed = validatePemPair(certificate, privateKey);
  await mkdir(paths.directory, { recursive: true, mode: 0o700 });
  const suffix = `${process.pid}-${Date.now()}`;
  const temporaryCertificate = join(paths.directory, `.custom-cert-${suffix}.pem`);
  const temporaryKey = join(paths.directory, `.custom-key-${suffix}.pem`);
  try {
    await writeFile(temporaryCertificate, certificate, { mode: 0o644 });
    await writeFile(temporaryKey, privateKey, { mode: 0o600 });
    await readPair(temporaryCertificate, temporaryKey);
    await rename(temporaryKey, paths.customKey);
    await rename(temporaryCertificate, paths.customCertificate);
    return { cert: certificate, key: privateKey, minVersion: "TLSv1.2", status: certificateStatus(parsed, "custom") };
  } finally {
    await rm(temporaryCertificate, { force: true });
    await rm(temporaryKey, { force: true });
  }
}

export async function removeCustomCertificate(root) {
  const paths = tlsPaths(root);
  await Promise.all([rm(paths.customCertificate, { force: true }), rm(paths.customKey, { force: true })]);
  const fallback = await ensureFallbackCertificate(root);
  const parsed = validatePemPair(fallback.cert, fallback.key);
  return { ...fallback, status: certificateStatus(parsed, "fallback") };
}
