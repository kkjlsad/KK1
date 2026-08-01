import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { MAX_OUTPUT_CHARS, TERMUX_HOME } from "../constants.js";
const execFileAsync = promisify(execFile);
export async function commandExists(command) {
    const result = await runCommand("sh", ["-lc", `command -v ${shellQuote(command)}`], { timeoutMs: 3_000 });
    return result.exitCode === 0 && result.stdout.trim().length > 0;
}
export async function runCommand(command, args = [], options = {}) {
    const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 15_000, 500), 600_000);
    const maxOutputChars = options.maxOutputChars ?? MAX_OUTPUT_CHARS;
    try {
        const result = await execFileAsync(command, args, {
            cwd: options.cwd,
            timeout: timeoutMs,
            maxBuffer: 2 * 1024 * 1024,
            encoding: "utf8",
            env: process.env,
        });
        return {
            command,
            args,
            exitCode: 0,
            stdout: truncate(result.stdout, maxOutputChars),
            stderr: truncate(result.stderr, maxOutputChars),
            timedOut: false,
        };
    }
    catch (error) {
        const value = error;
        const timedOut = value.killed === true || value.code === "ETIMEDOUT";
        return {
            command,
            args,
            exitCode: typeof value.code === "number" ? value.code : timedOut ? 124 : 127,
            stdout: truncate(value.stdout ?? "", maxOutputChars),
            stderr: truncate(value.stderr ?? value.message ?? String(error), maxOutputChars),
            timedOut,
        };
    }
}
export async function readTextIfAccessible(filePath) {
    try {
        await access(filePath);
        return (await readFile(filePath, "utf8")).trim();
    }
    catch {
        return undefined;
    }
}
export function resolveWithinHome(inputPath) {
    const resolved = path.resolve(inputPath.startsWith("~") ? path.join(TERMUX_HOME, inputPath.slice(1)) : inputPath);
    const home = path.resolve(TERMUX_HOME);
    if (resolved !== home && !resolved.startsWith(`${home}${path.sep}`)) {
        throw new Error(`路径必须位于 Termux HOME 内：${home}`);
    }
    return resolved;
}
export function truncate(value, limit = MAX_OUTPUT_CHARS) {
    if (value.length <= limit)
        return value;
    return `${value.slice(0, limit)}\n...[输出已截断，共 ${value.length} 字符]`;
}
function shellQuote(value) {
    return `'${value.replaceAll("'", `'\\''`)}'`;
}
//# sourceMappingURL=command.js.map