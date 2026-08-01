import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const port = 39876;
const token = "smoke-test-token-0123456789abcdef";
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["dist/index.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PHONE_MCP_HOST: "127.0.0.1",
    PHONE_MCP_PORT: String(port),
    PHONE_MCP_TOKEN: token,
    PHONE_MCP_ALLOW_ACTIONS: "0",
    PHONE_MCP_ALLOW_COMMANDS: "0",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

try {
  let healthy = false;
  let healthDetail = "no response";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      healthDetail = `HTTP ${response.status}: ${await response.text()}`;
      if (response.ok) {
        healthy = true;
        break;
      }
    } catch (error) {
      healthDetail = error instanceof Error
        ? `${error.message}; cause=${String(error.cause ?? "unknown")}`
        : String(error);
    }
    await delay(100);
  }
  assert.equal(healthy, true, `服务未就绪：${healthDetail}\n${stderr}`);

  const unauthorized = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
  });
  assert.equal(unauthorized.status, 401);

  const client = new Client({ name: "termux-phone-mcp-smoke", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  const listed = await client.listTools();
  assert.equal(listed.tools.length, 16, `预期 16 个工具，实际 ${listed.tools.length}`);
  assert.ok(listed.tools.some((tool) => tool.name === "phone_get_battery"));
  assert.ok(listed.tools.some((tool) => tool.name === "phone_run_termux_command"));

  const capabilities = await client.callTool({ name: "phone_get_capabilities", arguments: {} });
  assert.equal(capabilities.isError, undefined);
  assert.ok(capabilities.content.length > 0);
  await client.close();
  process.stdout.write(`SMOKE_OK tools=${listed.tools.length} auth=401 capabilities=ok\n`);
} finally {
  child.kill("SIGTERM");
}
