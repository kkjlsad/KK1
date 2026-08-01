import os from "node:os";
import path from "node:path";
export const SERVER_NAME = "termux-phone-mcp-server";
export const SERVER_VERSION = "0.1.0";
export const HOST = process.env.PHONE_MCP_HOST ?? "127.0.0.1";
export const PORT = parseInteger(process.env.PHONE_MCP_PORT, 8765, 1024, 65535);
export const AUTH_TOKEN = process.env.PHONE_MCP_TOKEN ?? "";
export const ALLOW_ACTIONS = process.env.PHONE_MCP_ALLOW_ACTIONS === "1";
export const ALLOW_COMMANDS = process.env.PHONE_MCP_ALLOW_COMMANDS === "1";
export const MAX_OUTPUT_CHARS = 24_000;
export const TERMUX_HOME = process.env.HOME ?? os.homedir();
export const SERVICE_ROOT = path.resolve(process.env.PHONE_MCP_SERVICE_ROOT ?? path.join(TERMUX_HOME, "services"));
function parseInteger(raw, fallback, min, max) {
    if (raw === undefined)
        return fallback;
    const value = Number.parseInt(raw, 10);
    return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}
//# sourceMappingURL=constants.js.map