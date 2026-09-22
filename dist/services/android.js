import { readdir, stat } from "node:fs/promises";
import { commandExists, resolveWithinHome, runCommand, truncate } from "./command.js";
import { requireActions } from "./environments.js";
const PERMISSION_HINT = "请到 系统设置 → 应用管理 → Termux:API → 权限 里授予对应权限。";
async function runApiRaw(name, args, timeoutMs = 20_000) {
    if (!(await commandExists(name))) {
        throw new Error(`未找到命令 ${name}。请确认已安装 Termux:API App 与 termux-api 包。`);
    }
    const result = await runCommand(name, args, { timeoutMs });
    if (result.exitCode !== 0) {
        if (result.timedOut) {
            throw new Error(`${name} 超时无响应，通常是 Termux:API 缺少所需权限。${PERMISSION_HINT}`);
        }
        throw new Error(result.stderr.trim() || `${name} 退出码 ${result.exitCode}`);
    }
    return result.stdout.trim();
}
async function runApiJson(name, args, timeoutMs = 20_000) {
    const raw = await runApiRaw(name, args, timeoutMs);
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error(`${name} 返回的不是合法 JSON：${truncate(raw, 300)}`);
    }
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        const message = parsed.error;
        if (typeof message === "string")
            throw new Error(`${message}${PERMISSION_HINT}`);
    }
    return parsed;
}
async function runApiList(name, args, timeoutMs = 20_000) {
    const parsed = await runApiJson(name, args, timeoutMs);
    if (Array.isArray(parsed))
        return parsed;
    if (parsed !== null && typeof parsed === "object") {
        const nested = parsed.list;
        if (Array.isArray(nested))
            return nested;
    }
    throw new Error(`${name} 返回了非列表结果：${truncate(JSON.stringify(parsed), 200)}`);
}
export async function getNotifications(limit) {
    const list = await runApiList("termux-notification-list", [], 30_000);
    const items = list.slice(0, limit).map((item) => ({
        package: item.packageName,
        title: item.title,
        content: item.content,
        when: item.when,
    }));
    return { total: list.length, returned: items.length, notifications: items };
}
export async function getSms(limit, box) {
    const args = ["-l", String(limit)];
    if (box !== "all")
        args.push("-t", box);
    const list = await runApiList("termux-sms-list", args, 25_000);
    return { box, returned: list.length, messages: list };
}
export async function sendSms(number, text) {
    requireActions();
    if (!/^[+0-9][0-9 +-]{3,30}$/.test(number))
        throw new Error("号码格式不合法。");
    await runApiRaw("termux-sms-send", ["-n", number, text], 30_000);
    return { number, length: text.length, sent: true };
}
export async function getCallLog(limit) {
    const list = await runApiList("termux-call-log", ["-l", String(limit)], 25_000);
    return { returned: list.length, calls: list };
}
export async function getContacts(limit, query) {
    const list = await runApiList("termux-contact-list", [], 30_000);
    const filtered = query ? list.filter((item) => JSON.stringify(item).includes(query)) : list;
    return {
        total: list.length,
        returned: Math.min(filtered.length, limit),
        query: query ?? null,
        contacts: filtered.slice(0, limit),
    };
}
export async function getLocation(provider) {
    const data = await runApiJson("termux-location", ["-p", provider, "-r", "once"], 60_000);
    return { provider, ...data };
}
export async function getSensors(mode, name, count = 1) {
    if (mode === "list") {
        const parsed = await runApiJson("termux-sensor", ["-l"], 15_000);
        const sensors = Array.isArray(parsed) ? parsed : parsed.sensors ?? parsed;
        return { mode, sensors };
    }
    if (!name)
        throw new Error("sample 模式需要提供 name，先用 list 模式查看可用传感器名称。");
    const values = await runApiJson("termux-sensor", ["-s", name, "-n", String(count)], 30_000);
    return { mode, name, count, values };
}
export async function cameraPhoto(cameraId, output) {
    requireActions();
    const resolved = resolveWithinHome(output);
    const raw = await runApiRaw("termux-camera-photo", ["-c", String(cameraId), resolved], 60_000);
    let size = 0;
    try {
        size = (await stat(resolved)).size;
    }
    catch {
        size = 0;
    }
    if (size === 0) {
        throw new Error(`相机没有生成照片（命令输出：${truncate(raw, 120) || "空"}）。${PERMISSION_HINT}`);
    }
    return { camera_id: cameraId, path: resolved, size_bytes: size };
}
export async function listInstalledApps() {
    const roots = ["~/storage/shared/Android/media", "~/storage/shared/Android/obb"];
    const packages = new Set();
    const notes = [];
    for (const root of roots) {
        try {
            const dirents = await readdir(resolveWithinHome(root), { withFileTypes: true });
            for (const dirent of dirents) {
                if (dirent.isDirectory() && dirent.name.includes("."))
                    packages.add(dirent.name);
            }
        }
        catch {
            notes.push(`${root} 不可读`);
        }
    }
    const sorted = [...packages].sort();
    return {
        count: sorted.length,
        packages: sorted,
        source: roots,
        note: "未 root 的 Android 不允许列出完整应用列表，这里只能看到在共享存储留有 Android/media 或 obb 目录的应用。",
        notes,
    };
}
//# sourceMappingURL=android.js.map