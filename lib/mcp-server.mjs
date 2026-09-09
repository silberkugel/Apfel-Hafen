import { createHash, timingSafeEqual } from "node:crypto";

export const apfelHafenMcpVersion = "0.2.9";
export const currentMcpProtocolVersion = "2026-07-28";
export const legacyMcpProtocolVersions = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const containerNameSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 128,
      pattern: "^[A-Za-z0-9._-]+$",
      description: "Exact name of the container.",
    },
  },
  required: ["name"],
  additionalProperties: false,
};

export const apfelHafenMcpTools = [
  {
    name: "list_containers",
    title: "List containers",
    description: "List all Apple containers visible to Apfel-Hafen and return their current state.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "get_container_status",
    title: "Get container status",
    description: "Return the current status and configuration summary for one Apple container.",
    inputSchema: containerNameSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "get_container_logs",
    title: "Get container logs",
    description: "Return the startup log and the latest 200 output lines for one Apple container.",
    inputSchema: containerNameSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "start_container",
    title: "Start container",
    description: "Start one existing Apple container.",
    inputSchema: containerNameSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "stop_container",
    title: "Stop container",
    description: "Stop one running Apple container without deleting it.",
    inputSchema: containerNameSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "restart_container",
    title: "Restart container",
    description: "Restart one existing Apple container without changing its configuration.",
    inputSchema: containerNameSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "check_image_update",
    title: "Check image update",
    description: "Check whether the image used by one container has a newer digest. This can pull image metadata but never replaces the container.",
    inputSchema: containerNameSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
];

function hashToken(value) {
  return createHash("sha256").update(value).digest();
}

export function validMcpToken(token) {
  return typeof token === "string" && token.length >= 32 && token.length <= 4096 && !/[\r\n\s]/.test(token);
}

export function mcpBearerAuthorized(authorization, expectedToken) {
  if (!validMcpToken(expectedToken) || typeof authorization !== "string" || authorization.length > 8192) return false;
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  if (!match) return false;
  return timingSafeEqual(hashToken(match[1]), hashToken(expectedToken));
}

function response(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id, code, message, data) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

function hasId(message) {
  return Object.prototype.hasOwnProperty.call(message, "id");
}

function serverMeta() {
  return { "io.modelcontextprotocol/serverInfo": { name: "apfel-hafen", version: apfelHafenMcpVersion } };
}

function completeResult(result, modern) {
  if (!modern) return result;
  return { resultType: "complete", ...result, _meta: { ...serverMeta(), ...(result._meta || {}) } };
}

function legacyProtocolVersion(requested) {
  return legacyMcpProtocolVersions.includes(requested) ? requested : legacyMcpProtocolVersions[0];
}

function safeToolError(error) {
  const message = error instanceof Error ? error.message : String(error || "Tool execution failed.");
  return message.replace(/[\r\n]+/g, " ").slice(0, 4000);
}

export function validateModernMcpHeaders(headers, message) {
  const protocolVersion = String(headers["mcp-protocol-version"] || "");
  if (protocolVersion !== currentMcpProtocolVersion) return null;
  if (String(headers["mcp-method"] || "") !== message?.method) return "Mcp-Method header does not match the JSON-RPC method.";
  const expectedName = message?.method === "tools/call" ? String(message?.params?.name || "") : "";
  const actualName = String(headers["mcp-name"] || "");
  if (expectedName && actualName !== expectedName) return "Mcp-Name header does not match the requested tool.";
  if (!expectedName && actualName) return "Mcp-Name header is not valid for this method.";
  return null;
}

export async function dispatchMcpMessage(message, invokeTool, options = {}) {
  if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return errorResponse(message?.id, -32600, "Invalid Request");
  }

  const modern = options.protocolVersion === currentMcpProtocolVersion;
  const id = message.id;

  if (message.method === "notifications/initialized") return null;
  if (!hasId(message)) return null;

  if (message.method === "server/discover") {
    return response(id, completeResult({
      supportedVersions: [currentMcpProtocolVersion],
      capabilities: { tools: { listChanged: false } },
      instructions: "Manage Apple containers through the seven explicitly exposed Apfel-Hafen tools. No shell, deletion, creation, or host administration capability is available.",
      ttlMs: 300_000,
      cacheScope: "private",
    }, true));
  }

  if (message.method === "initialize") {
    return response(id, {
      protocolVersion: legacyProtocolVersion(message.params?.protocolVersion),
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "apfel-hafen", version: apfelHafenMcpVersion },
      instructions: "Manage Apple containers through the seven explicitly exposed Apfel-Hafen tools. No shell, deletion, creation, or host administration capability is available.",
    });
  }

  if (message.method === "ping") return response(id, completeResult({}, modern));

  if (message.method === "tools/list") {
    return response(id, completeResult({
      tools: apfelHafenMcpTools,
      ...(modern ? { ttlMs: 300_000, cacheScope: "private" } : {}),
    }, modern));
  }

  if (message.method === "tools/call") {
    const name = message.params?.name;
    if (!apfelHafenMcpTools.some((tool) => tool.name === name)) return errorResponse(id, -32602, "Unknown tool");
    const args = message.params?.arguments ?? {};
    if (!args || typeof args !== "object" || Array.isArray(args)) return errorResponse(id, -32602, "Tool arguments must be an object.");
    try {
      const output = await invokeTool(name, args);
      return response(id, completeResult({
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
        isError: false,
      }, modern));
    } catch (error) {
      const messageText = safeToolError(error);
      return response(id, completeResult({
        content: [{ type: "text", text: messageText }],
        structuredContent: { error: messageText },
        isError: true,
      }, modern));
    }
  }

  return errorResponse(id, -32601, "Method not found");
}

export async function dispatchMcpPayload(payload, invokeTool, options = {}) {
  if (!Array.isArray(payload)) return dispatchMcpMessage(payload, invokeTool, options);
  if (payload.length === 0) return errorResponse(null, -32600, "Invalid Request");
  const replies = (await Promise.all(payload.map((message) => dispatchMcpMessage(message, invokeTool, options)))).filter(Boolean);
  return replies.length ? replies : null;
}
