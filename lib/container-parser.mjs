export function parseContainers(output) {
  const records = JSON.parse(output || "[]");
  if (!Array.isArray(records)) throw new Error("Die Containerliste hat ein unerwartetes Format.");

  return records.map((record) => ({
    name: String(record.id || record.configuration?.id || "").trim(),
    status: record.status?.state === "running" ? "running" : "stopped",
    image: String(record.configuration?.image?.reference || "").trim(),
    digest: String(record.configuration?.image?.descriptor?.digest || "").trim(),
    cpus: record.configuration?.resources?.cpus ?? null,
    memoryInBytes: record.configuration?.resources?.memoryInBytes ?? null,
    volumes: (record.configuration?.mounts || []).map((mount) => ({
      source: String(mount.source || ""),
      destination: String(mount.destination || ""),
      readOnly: (mount.options || []).some((option) => /^(ro|readonly)$/i.test(option)),
    })),
    ports: (record.configuration?.publishedPorts || []).map((port) => ({
      hostAddress: String(port.hostAddress || ""),
      hostPort: Number(port.hostPort),
      containerPort: Number(port.containerPort),
      protocol: String(port.proto || "tcp"),
    })),
  }))
    .filter((record) => record.name)
    .sort((left, right) => left.name.localeCompare(right.name, "de", { sensitivity: "base", numeric: true }));
}
