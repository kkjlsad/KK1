#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { AUTH_TOKEN, HOST, PORT, SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerTools } from "./tools/register.js";
if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(`termux-phone-mcp-server ${SERVER_VERSION}\n\nEnvironment:\n  PHONE_MCP_HOST             Bind address (default 127.0.0.1)\n  PHONE_MCP_PORT             HTTP port (default 8765)\n  PHONE_MCP_TOKEN            Required bearer token\n  PHONE_MCP_ALLOW_ACTIONS    Enable bounded write actions (0/1)\n  PHONE_MCP_ALLOW_COMMANDS   Enable arbitrary Termux/PRoot commands (0/1)\n`);
    process.exit(0);
}
if (AUTH_TOKEN.length < 24) {
    process.stderr.write("PHONE_MCP_TOKEN 必须设置为至少 24 个字符，服务未启动。\n");
    process.exit(1);
}
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));
app.get("/healthz", (_request, response) => {
    response.json({ ok: true, server: SERVER_NAME, version: SERVER_VERSION });
});
app.use("/mcp", (request, response, next) => {
    if (!isLoopbackHost(request.headers.host)) {
        response.status(403).json({ error: "Host 必须是 127.0.0.1、localhost 或 ::1" });
        return;
    }
    if (!isAllowedOrigin(request.headers.origin)) {
        response.status(403).json({ error: "拒绝非本机 Origin" });
        return;
    }
    if (request.headers.authorization !== `Bearer ${AUTH_TOKEN}`) {
        response.status(401).setHeader("WWW-Authenticate", "Bearer").json({ error: "Bearer token 无效" });
        return;
    }
    next();
});
app.all("/mcp", async (request, response) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });
    response.on("close", () => {
        void transport.close();
        void server.close();
    });
    try {
        await server.connect(transport);
        await transport.handleRequest(request, response, request.body);
    }
    catch (error) {
        process.stderr.write(`MCP 请求失败：${error instanceof Error ? error.message : String(error)}\n`);
        if (!response.headersSent)
            response.status(500).json({ error: "MCP 请求处理失败" });
    }
});
const httpServer = app.listen(PORT, HOST, () => {
    process.stderr.write(`${SERVER_NAME} 已监听 http://${HOST}:${PORT}/mcp\n`);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
        httpServer.close(() => process.exit(0));
    });
}
function createMcpServer() {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    registerTools(server);
    return server;
}
function isLoopbackHost(value) {
    if (!value)
        return false;
    const host = value.toLowerCase().replace(/^\[|\](?=:\d+$|$)/g, "").split(":")[0];
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
}
function isAllowedOrigin(origin) {
    if (!origin || origin === "null")
        return true;
    try {
        const hostname = new URL(origin).hostname;
        return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=index.js.map