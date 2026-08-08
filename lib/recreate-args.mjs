function addMany(args, flag, values = []) {
  for (const value of values) args.push(flag, String(value));
}

export function imageDigestFromInspect(output) {
  const records = JSON.parse(output || "[]");
  const digest = records?.[0]?.configuration?.descriptor?.digest;
  if (!digest) throw new Error("Der Digest des geladenen Images konnte nicht ermittelt werden.");
  return String(digest);
}

export function pinnedImage(reference, digest) {
  const base = String(reference).replace(/@sha256:[a-f0-9]+$/i, "").replace(/:[^/:]+$/, "");
  return `${base}@${digest}`;
}

export function buildCreateArgs(record, imageOverride, nameOverride, overrides = null) {
  const config = record.configuration || {};
  const process = config.initProcess || {};
  const id = String(nameOverride || record.id || config.id || "");
  if (!id || !imageOverride) throw new Error("Container-ID oder Image fehlt in der Sicherung.");
  if (process.supplementalGroups?.length) throw new Error("Zusätzliche Gruppen können noch nicht sicher rekonstruiert werden.");
  if (Object.keys(config.sysctls || {}).length) throw new Error("Sysctl-Einstellungen können noch nicht sicher rekonstruiert werden.");

  const args = ["create", "--name", id];
  addMany(args, "--env", overrides ? overrides.variables.map(({ key, value }) => `${key}=${value}`) : process.environment);
  addMany(args, "--cap-add", config.capAdd);
  addMany(args, "--cap-drop", config.capDrop);
  addMany(args, "--label", Object.entries(config.labels || {}).map(([key, value]) => `${key}=${value}`));

  if (process.workingDirectory) args.push("--workdir", process.workingDirectory);
  if (process.executable) args.push("--entrypoint", process.executable);
  if (process.terminal) args.push("--tty");
  const cpus = overrides?.cpus ?? config.resources?.cpus;
  const memoryInBytes = overrides ? overrides.memoryMb * 1048576 : config.resources?.memoryInBytes;
  if (cpus) args.push("--cpus", String(cpus));
  if (memoryInBytes) args.push("--memory", `${Math.ceil(memoryInBytes / 1048576)}M`);
  if (config.platform?.os && config.platform?.architecture) args.push("--platform", `${config.platform.os}/${config.platform.architecture}`);

  const rawUser = process.user?.raw?.userString;
  const numericUser = process.user?.id;
  if (rawUser) args.push("--user", rawUser);
  else if (numericUser?.uid !== undefined) args.push("--user", `${numericUser.uid}:${numericUser.gid ?? numericUser.uid}`);

  const mounts = overrides ? overrides.volumes.map((volume) => ({ ...volume, options: volume.readOnly ? ["ro"] : [] })) : config.mounts || [];
  for (const mount of mounts) {
    if (!mount.source || !mount.destination) throw new Error("Eine Mount-Konfiguration ist unvollständig.");
    const readOnly = (mount.options || []).some((option) => /^(ro|readonly)$/i.test(option));
    args.push("--volume", `${mount.source}:${mount.destination}${readOnly ? ":ro" : ""}`);
  }

  const publishedPorts = overrides ? overrides.ports.map((port) => ({ ...port, proto: port.protocol })) : config.publishedPorts || [];
  for (const port of publishedPorts) {
    const protocol = port.proto ? `/${port.proto}` : "";
    const address = port.hostAddress ? `${port.hostAddress}:` : "";
    args.push("--publish", `${address}${port.hostPort}:${port.containerPort}${protocol}`);
  }
  for (const socket of config.publishedSockets || []) {
    args.push("--publish-socket", `${socket.hostPath}:${socket.containerPath}`);
  }
  for (const network of config.networks || []) {
    let value = network.network;
    if (network.options?.mtu) value += `,mtu=${network.options.mtu}`;
    args.push("--network", value);
  }
  for (const nameserver of config.dns?.nameservers || []) args.push("--dns", nameserver);
  for (const domain of config.dns?.searchDomains || []) args.push("--dns-search", domain);
  for (const option of config.dns?.options || []) args.push("--dns-option", option);

  if (config.readOnly) args.push("--read-only");
  if (config.rosetta) args.push("--rosetta");
  if (config.ssh) args.push("--ssh");
  if (config.virtualization) args.push("--virtualization");
  if (config.useInit) args.push("--init");
  if (config.runtimeHandler && config.runtimeHandler !== "container-runtime-linux") args.push("--runtime", config.runtimeHandler);

  args.push(imageOverride, ...(process.arguments || []));
  return args;
}

export function editableContainerSettings(record) {
  const config = record.configuration || {};
  return {
    name: String(record.id || config.id || ""),
    image: String(config.image?.reference || ""),
    status: record.status?.state === "running" ? "running" : "stopped",
    cpus: config.resources?.cpus ?? 2,
    memoryMb: Math.ceil((config.resources?.memoryInBytes || 1073741824) / 1048576),
    variables: (config.initProcess?.environment || []).map((entry) => {
      const separator = String(entry).indexOf("=");
      return { key: separator < 0 ? String(entry) : String(entry).slice(0, separator), value: separator < 0 ? "" : String(entry).slice(separator + 1) };
    }),
    ports: (config.publishedPorts || []).map((port) => ({ hostAddress: String(port.hostAddress || ""), hostPort: port.hostPort, containerPort: port.containerPort, protocol: String(port.proto || "tcp") })),
    volumes: (config.mounts || []).map((mount) => ({ source: String(mount.source || ""), destination: String(mount.destination || ""), readOnly: (mount.options || []).some((option) => /^(ro|readonly)$/i.test(option)) })),
  };
}

export function replacementSummary(record) {
  const config = record.configuration || {};
  return {
    mounts: config.mounts?.length || 0,
    ports: config.publishedPorts?.length || 0,
    environment: config.initProcess?.environment?.length || 0,
    cpus: config.resources?.cpus || null,
    memoryInBytes: config.resources?.memoryInBytes || null,
  };
}
