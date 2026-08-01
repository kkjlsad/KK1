import { mkdir } from "node:fs/promises";
import path from "node:path";
import { ALLOW_ACTIONS, ALLOW_COMMANDS, SERVICE_ROOT } from "../constants.js";
import { commandExists, resolveWithinHome, runCommand } from "./command.js";
const SAFE_NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export function requireActions() {
    if (!ALLOW_ACTIONS) {
        throw new Error("写操作未启用。请把 ~/.config/termux-phone-mcp/.env 中 PHONE_MCP_ALLOW_ACTIONS 改为 1 后重启服务。");
    }
}
export function requireCommands() {
    if (!ALLOW_COMMANDS) {
        throw new Error("命令执行未启用。请把 ~/.config/termux-phone-mcp/.env 中 PHONE_MCP_ALLOW_COMMANDS 改为 1 后重启服务。");
    }
}
export async function listEnvironments() {
    const proot = await commandExists("proot-distro");
    const docker = await commandExists("docker");
    const podman = await commandExists("podman");
    const result = {
        proot_distro_available: proot,
        docker_available: docker,
        podman_available: podman,
        service_root: SERVICE_ROOT,
    };
    if (proot) {
        const listed = await runCommand("proot-distro", ["list"], { timeoutMs: 10_000 });
        result.proot_distros = listed.exitCode === 0 ? listed.stdout.trim() : listed.stderr.trim();
    }
    const runtime = docker ? "docker" : podman ? "podman" : undefined;
    if (runtime) {
        const listed = await runCommand(runtime, ["ps", "-a", "--format", "{{json .}}"], { timeoutMs: 15_000 });
        result.container_runtime = runtime;
        result.containers = listed.exitCode === 0 ? listed.stdout.trim().split("\n").filter(Boolean) : [];
        if (listed.exitCode !== 0)
            result.container_error = listed.stderr.trim();
    }
    else {
        result.container_note = "当前没有可用 Docker/Podman。普通非 root Termux 通常只能使用 proot-distro。";
    }
    return result;
}
export async function installProot(alias) {
    requireActions();
    validateName(alias, "发行版别名");
    if (!(await commandExists("proot-distro")))
        throw new Error("未安装 proot-distro，请先调用 phone_install_packages 安装 proot-distro。");
    const result = await runCommand("proot-distro", ["install", alias], { timeoutMs: 600_000 });
    if (result.exitCode !== 0)
        throw new Error(result.stderr || `proot-distro install 退出码 ${result.exitCode}`);
    return { alias, installed: true, output: result.stdout.trim() };
}
export async function removeProot(alias, confirm) {
    requireActions();
    validateName(alias, "发行版别名");
    if (confirm !== `REMOVE:${alias}`)
        throw new Error(`确认字符串不匹配，应为 REMOVE:${alias}`);
    const result = await runCommand("proot-distro", ["remove", alias], { timeoutMs: 120_000 });
    if (result.exitCode !== 0)
        throw new Error(result.stderr || `proot-distro remove 退出码 ${result.exitCode}`);
    return { alias, removed: true, output: result.stdout.trim() };
}
export async function execInProot(alias, command, timeoutSeconds) {
    requireCommands();
    validateName(alias, "发行版别名");
    const result = await runCommand("proot-distro", ["login", alias, "--", "bash", "-lc", command], {
        timeoutMs: timeoutSeconds * 1_000,
    });
    return { alias, ...result };
}
export async function runTermuxCommand(command, timeoutSeconds) {
    requireCommands();
    const result = await runCommand("bash", ["-lc", command], { timeoutMs: timeoutSeconds * 1_000 });
    return { ...result };
}
export async function installPackages(packages) {
    requireActions();
    const unique = [...new Set(packages)];
    unique.forEach((name) => validateName(name, "软件包名"));
    const result = await runCommand("pkg", ["install", "-y", ...unique], { timeoutMs: 600_000 });
    if (result.exitCode !== 0)
        throw new Error(result.stderr || `pkg install 退出码 ${result.exitCode}`);
    return { installed: unique, output: result.stdout.trim() };
}
export async function manageCompose(runtime, projectDirectory, action, confirm) {
    requireActions();
    const cwd = resolveWithinHome(projectDirectory);
    const selected = runtime === "auto"
        ? (await commandExists("docker")) ? "docker" : (await commandExists("podman")) ? "podman" : undefined
        : runtime;
    if (!selected || !(await commandExists(selected)))
        throw new Error("未找到可用的 Docker/Podman 运行时。");
    if (action === "down" && confirm !== `DOWN:${path.basename(cwd)}`) {
        throw new Error(`down 会删除项目容器，确认字符串应为 DOWN:${path.basename(cwd)}`);
    }
    const args = selected === "docker" ? ["compose", action] : ["compose", action];
    if (action === "up")
        args.push("-d");
    const result = await runCommand(selected, args, { cwd, timeoutMs: 600_000 });
    if (result.exitCode !== 0)
        throw new Error(result.stderr || `${selected} compose ${action} 失败`);
    return { runtime: selected, project_directory: cwd, action, output: result.stdout.trim() || result.stderr.trim() };
}
export async function prepareServiceRoot() {
    requireActions();
    await mkdir(SERVICE_ROOT, { recursive: true });
    return SERVICE_ROOT;
}
function validateName(value, label) {
    if (!SAFE_NAME.test(value))
        throw new Error(`${label}只能包含小写字母、数字、点、下划线和短横线，且最长 64 个字符。`);
}
//# sourceMappingURL=environments.js.map