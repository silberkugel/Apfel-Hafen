import test from "node:test";
import assert from "node:assert/strict";
import {
  apfelHafenMcpTools,
  currentMcpProtocolVersion,
  dispatchMcpMessage,
  dispatchMcpPayload,
  mcpBearerAuthorized,
  validMcpToken,
  validateModernMcpHeaders,
} from "../lib/mcp-server.mjs";

const token = "0123456789abcdef0123456789abcdef";

test("MCP exposes exactly the requested Apfel-Hafen tools", () => {
  assert.deepEqual(apfelHafenMcpTools.map((tool) => tool.name), [
    "list_containers",
    "get_container_status",
    "get_container_logs",
    "start_container",
    "stop_container",
    "restart_container",
    "check_image_update",
  ]);
  assert.ok(apfelHafenMcpTools.every((tool) => tool.inputSchema.additionalProperties === false));
});

test("MCP bearer authentication is fail-closed and constant-size comparable", () => {
  assert.equal(validMcpToken(token), true);
  assert.equal(validMcpToken("short"), false);
  assert.equal(mcpBearerAuthorized(`Bearer ${token}`, token), true);
  assert.equal(mcpBearerAuthorized(`bearer ${token}`, token), true);
  assert.equal(mcpBearerAuthorized("Bearer wrong", token), false);
  assert.equal(mcpBearerAuthorized(undefined, token), false);
  assert.equal(mcpBearerAuthorized(`Bearer ${token}`, ""), false);
});

test("legacy MCP lifecycle lists and calls tools", async () => {
  const initialized = await dispatchMcpMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } },
  }, async () => ({}));
  assert.equal(initialized.result.protocolVersion, "2025-11-25");

  const listed = await dispatchMcpMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, async () => ({}));
  assert.equal(listed.result.tools.length, 7);

  const called = await dispatchMcpMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "get_container_status", arguments: { name: "web" } },
  }, async (name, args) => ({ name, container: args.name }));
  assert.deepEqual(called.result.structuredContent, { name: "get_container_status", container: "web" });
  assert.equal(called.result.isError, false);
});

test("modern stateless MCP discovery and routing headers are supported", async () => {
  const discovered = await dispatchMcpMessage({ jsonrpc: "2.0", id: "d", method: "server/discover", params: {} }, async () => ({}), {
    protocolVersion: currentMcpProtocolVersion,
  });
  assert.deepEqual(discovered.result.supportedVersions, [currentMcpProtocolVersion]);
  assert.equal(discovered.result.resultType, "complete");
  assert.equal(discovered.result._meta["io.modelcontextprotocol/serverInfo"].name, "apfel-hafen");

  assert.equal(validateModernMcpHeaders({
    "mcp-protocol-version": currentMcpProtocolVersion,
    "mcp-method": "tools/call",
    "mcp-name": "start_container",
  }, { method: "tools/call", params: { name: "start_container" } }), null);
  assert.match(validateModernMcpHeaders({
    "mcp-protocol-version": currentMcpProtocolVersion,
    "mcp-method": "tools/list",
  }, { method: "tools/call", params: { name: "start_container" } }), /Mcp-Method/);
});

test("tool failures are returned as tool errors and notifications have no response", async () => {
  const failed = await dispatchMcpMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "start_container", arguments: { name: "missing" } },
  }, async () => { throw new Error("Container does not exist.\nsecret detail"); });
  assert.equal(failed.result.isError, true);
  assert.equal(failed.result.structuredContent.error, "Container does not exist. secret detail");

  assert.equal(await dispatchMcpPayload([
    { jsonrpc: "2.0", method: "notifications/initialized" },
  ], async () => ({})), null);
});
