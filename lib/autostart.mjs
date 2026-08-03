export function launchAgentPlist({ label, nodePath, serverPath, stdoutPath, stderrPath }) {
  const escape = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escape(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escape(nodePath)}</string>
    <string>${escape(serverPath)}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${escape(stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escape(stderrPath)}</string>
</dict>
</plist>
`;
}

export function disabledFromLaunchctl(output, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`"${escapedLabel}"\\s*=>\\s*disabled`).test(output);
}

export function programFromLaunchctl(output) {
  return output.match(/^\s*program = (.+)$/m)?.[1]?.trim() || "";
}

