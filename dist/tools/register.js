import { z } from "zod";
import { ALLOW_ACTIONS, ALLOW_COMMANDS } from "../constants.js";
import { commandExists, runCommand } from "../services/command.js";
import { execInProot, installPackages, installProot, listEnvironments, manageCompose, removeProot, runTermuxCommand, } from "../services/environments.js";
import { getBatteryStatus, getCapabilities, getNetworkStatus, getPhoneOverview, getResourceStatus, getThermalStatus, samplePower, } from "../services/phone.js";
const EmptySchema = z.object({}).strict();
const annotations = {
    readOnly: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    action: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    destructive: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
};
export function registerTools(server) {
    server.registerTool("phone_get_overview", {
        title: "获取手机概况",
        description: "读取 Android 机型、系统版本、SoC、内核、架构、核心数、总内存、运行时间和 Termux 路径。只读。",
        inputSchema: EmptySchema,
        annotations: annotations.readOnly,
    }, async () => success(await getPhoneOverview()));
    server.registerTool("phone_get_battery", {
        title: "获取电池状态",
        description: "读取电量、充放电状态、健康度、温度、电压、电流、循环次数和估算瞬时功率。优先使用 Termux:API，失败时回退 sysfs。只读；不是逐 App 耗电统计。",
        inputSchema: EmptySchema,
        annotations: annotations.readOnly,
    }, async () => success(await getBatteryStatus()));
    server.registerTool("phone_sample_power", {
        title: "采样手机功耗",
        description: "在 2-30 秒内多次读取电池电流和电压，估算这段时间的平均整机功率。结果适合比较调整前后趋势，不等同于 Android 逐 App BatteryStats。",
        inputSchema: z.object({
            duration_seconds: z.number().int().min(2).max(30).default(10).describe("总采样时长，2-30 秒"),
            interval_seconds: z.number().int().min(1).max(10).default(2).describe("采样间隔，1-10 秒"),
        }).strict(),
        annotations: annotations.readOnly,
    }, async ({ duration_seconds, interval_seconds }) => {
        if (interval_seconds > duration_seconds)
            return failure("采样间隔不能大于总时长。", "减小 interval_seconds。");
        return success(await samplePower(duration_seconds, interval_seconds));
    });
    server.registerTool("phone_get_resources", {
        title: "获取手机资源状态",
        description: "采样 Termux 可见范围内的 CPU 使用率、频率、内存、存储和进程。Android UID 隔离会隐藏其他 App 的部分信息。只读。",
        inputSchema: z.object({
            sample_milliseconds: z.number().int().min(250).max(3000).default(750).describe("CPU 采样窗口，250-3000 毫秒"),
        }).strict(),
        annotations: annotations.readOnly,
    }, async ({ sample_milliseconds }) => success(await getResourceStatus(sample_milliseconds)));
    server.registerTool("phone_get_thermal", {
        title: "获取手机温度",
        description: "读取系统向 Termux 开放的 thermal_zone 温度和电池温度。不同 Android 厂商开放程度不同。只读。",
        inputSchema: EmptySchema,
        annotations: annotations.readOnly,
    }, async () => success(await getThermalStatus()));
    server.registerTool("phone_get_network", {
        title: "获取手机网络状态",
        description: "读取 Wi-Fi 连接信息、Termux 可见网卡地址和路由。Wi-Fi 详情依赖 Termux:API 权限。只读。",
        inputSchema: EmptySchema,
        annotations: annotations.readOnly,
    }, async () => success(await getNetworkStatus()));
    server.registerTool("phone_get_capabilities", {
        title: "检查手机控制能力",
        description: "检测 Termux:API、PRoot、Docker/Podman、su 以及当前 MCP 写操作开关，说明 Android 权限边界。只读。",
        inputSchema: EmptySchema,
        annotations: annotations.readOnly,
    }, async () => success({
        ...(await getCapabilities()),
        mcp_policy: { actions_enabled: ALLOW_ACTIONS, commands_enabled: ALLOW_COMMANDS },
    }));
    server.registerTool("phone_list_environments", {
        title: "列出手机 Linux/容器环境",
        description: "列出 proot-distro 环境，并在存在 Docker/Podman 时列出容器。普通 Termux 下 PRoot 不是内核级容器。只读。",
        inputSchema: EmptySchema,
        annotations: annotations.readOnly,
    }, async () => wrap(() => listEnvironments()));
    server.registerTool("phone_install_packages", {
        title: "安装 Termux 软件包",
        description: "通过 pkg install 安装指定的 Termux 软件包。需要 PHONE_MCP_ALLOW_ACTIONS=1；建议在 RikkaHub 为此工具启用每次确认。",
        inputSchema: z.object({
            packages: z.array(z.string().regex(/^[a-z0-9][a-z0-9+._-]{0,63}$/)).min(1).max(20).describe("Termux 软件包名列表"),
        }).strict(),
        annotations: annotations.action,
    }, async ({ packages }) => wrap(() => installPackages(packages)));
    server.registerTool("phone_install_proot", {
        title: "部署 PRoot Linux 环境",
        description: "使用 proot-distro install 部署一个用户态 Linux 环境。需要写操作开关；下载可能耗时且占用数 GB 空间。",
        inputSchema: z.object({
            alias: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/).describe("proot-distro list 显示的发行版别名，如 debian"),
        }).strict(),
        annotations: annotations.action,
    }, async ({ alias }) => wrap(() => installProot(alias)));
    server.registerTool("phone_remove_proot", {
        title: "删除 PRoot Linux 环境",
        description: "永久删除一个 proot-distro 根文件系统。必须提供 REMOVE:<alias> 二次确认；建议在 RikkaHub 始终开启工具审批。",
        inputSchema: z.object({
            alias: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
            confirm: z.string().max(80).describe("必须为 REMOVE:<alias>"),
        }).strict(),
        annotations: annotations.destructive,
    }, async ({ alias, confirm }) => wrap(() => removeProot(alias, confirm)));
    server.registerTool("phone_exec_proot", {
        title: "在 PRoot 环境执行命令",
        description: "在指定 proot-distro 内执行 bash 命令。需要 PHONE_MCP_ALLOW_COMMANDS=1，等同于授予模型该 PRoot 环境的命令行权限。",
        inputSchema: z.object({
            alias: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
            command: z.string().min(1).max(4000),
            timeout_seconds: z.number().int().min(1).max(600).default(120),
        }).strict(),
        annotations: annotations.destructive,
    }, async ({ alias, command, timeout_seconds }) => wrap(() => execInProot(alias, command, timeout_seconds)));
    server.registerTool("phone_run_termux_command", {
        title: "执行 Termux 命令",
        description: "在 Termux 本体执行任意 bash 命令。仅在明确需要时启用 PHONE_MCP_ALLOW_COMMANDS=1；此工具拥有 Termux 用户的完整文件和进程权限。",
        inputSchema: z.object({
            command: z.string().min(1).max(4000),
            timeout_seconds: z.number().int().min(1).max(600).default(60),
        }).strict(),
        annotations: annotations.destructive,
    }, async ({ command, timeout_seconds }) => wrap(() => runTermuxCommand(command, timeout_seconds)));
    server.registerTool("phone_manage_compose", {
        title: "管理手机 Compose 项目",
        description: "若设备确实存在可用 Docker/Podman，则在 Termux HOME 内对 Compose 项目执行 pull/up/restart/stop/down。普通非 root Termux 通常不可用。",
        inputSchema: z.object({
            runtime: z.enum(["auto", "docker", "podman"]).default("auto"),
            project_directory: z.string().min(1).max(500).describe("必须位于 Termux HOME 内"),
            action: z.enum(["pull", "up", "restart", "stop", "down"]),
            confirm: z.string().max(120).optional().describe("down 时必须为 DOWN:<目录名>"),
        }).strict(),
        annotations: annotations.destructive,
    }, async ({ runtime, project_directory, action, confirm }) => wrap(() => manageCompose(runtime, project_directory, action, confirm)));
    server.registerTool("phone_set_brightness", {
        title: "调整屏幕亮度",
        description: "通过 Termux:API 把屏幕亮度设为 auto 或 0-255。需要写操作开关及 Android 修改系统设置权限。",
        inputSchema: z.object({
            brightness: z.union([z.literal("auto"), z.number().int().min(0).max(255)]),
        }).strict(),
        annotations: annotations.action,
    }, async ({ brightness }) => wrap(async () => {
        if (!ALLOW_ACTIONS)
            throw new Error("写操作未启用，请设置 PHONE_MCP_ALLOW_ACTIONS=1 后重启服务。");
        if (!(await commandExists("termux-brightness")))
            throw new Error("Termux:API 命令不可用。");
        const result = await runCommand("termux-brightness", [String(brightness)], { timeoutMs: 12_000 });
        if (result.exitCode !== 0)
            throw new Error(result.stderr || "亮度调整失败");
        return { brightness, changed: true };
    }));
    server.registerTool("phone_set_volume", {
        title: "调整手机音量",
        description: "通过 Termux:API 调整指定 Android 音频流音量。需要写操作开关；最大值由设备决定。",
        inputSchema: z.object({
            stream: z.enum(["alarm", "music", "notification", "ring", "system", "call"]),
            volume: z.number().int().min(0).max(100),
        }).strict(),
        annotations: annotations.action,
    }, async ({ stream, volume }) => wrap(async () => {
        if (!ALLOW_ACTIONS)
            throw new Error("写操作未启用，请设置 PHONE_MCP_ALLOW_ACTIONS=1 后重启服务。");
        if (!(await commandExists("termux-volume")))
            throw new Error("Termux:API 命令不可用。");
        const result = await runCommand("termux-volume", [stream, String(volume)], { timeoutMs: 12_000 });
        if (result.exitCode !== 0)
            throw new Error(result.stderr || "音量调整失败");
        return { stream, volume, changed: true };
    }));
}
function success(data) {
    const payload = { ok: true, timestamp: new Date().toISOString(), data };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
}
function failure(error, hint) {
    const payload = { ok: false, timestamp: new Date().toISOString(), error, hint };
    return { isError: true, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
}
async function wrap(operation) {
    try {
        return success(await operation());
    }
    catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
    }
}
//# sourceMappingURL=register.js.map