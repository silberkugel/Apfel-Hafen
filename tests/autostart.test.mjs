import test from "node:test";
import assert from "node:assert/strict";
import { disabledFromLaunchctl, launchAgentPlist, programFromLaunchctl } from "../lib/autostart.mjs";

test("creates a launch agent for the current installation and escapes paths", () => {
  const plist = launchAgentPlist({
    label: "de.apfel-hafen.service",
    nodePath: "/Volumes/Base & Daten/runtime/node",
    serverPath: "/Volumes/Base & Daten/server.mjs",
    stdoutPath: "/Users/test/Library/Logs/Apfel-Hafen/service.log",
    stderrPath: "/Users/test/Library/Logs/Apfel-Hafen/service-error.log",
  });
  assert.match(plist, /<string>de\.apfel-hafen\.service<\/string>/);
  assert.match(plist, /Base &amp; Daten\/runtime\/node/);
  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/);
  assert.match(plist, /<key>KeepAlive<\/key>\s*<true\/>/);
});

test("reads disabled and running-program states from launchctl output", () => {
  const disabled = `disabled services = {\n  "de.apfel-hafen.service" => disabled\n}`;
  assert.equal(disabledFromLaunchctl(disabled, "de.apfel-hafen.service"), true);
  assert.equal(disabledFromLaunchctl(disabled, "another.service"), false);
  assert.equal(programFromLaunchctl("state = running\n\tprogram = /tmp/runtime/node\n"), "/tmp/runtime/node");
  assert.equal(programFromLaunchctl("state = exited"), "");
});

