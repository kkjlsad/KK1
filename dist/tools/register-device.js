import { z } from "zod";
import { controlMedia, openUrl, readClipboard, setTorch, showToast, speakText, vibrateDevice, writeClipboard, } from "../services/device.js";
import { wrap } from "./response.js";
const readOnlyAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const actionAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
export function registerDeviceTools(server) {
    server.registerTool("phone_toast", {
        title: "显示屏幕提示",
        description: "在手机屏幕上弹出 Toast 提示。需要 PHONE_MCP_ALLOW_ACTIONS=1。",
        inputSchema: z.object({
            text: z.string().min(1).max(200).describe("提示文字，最长 200 字符"),
            short: z.boolean().default(true).describe("true 为短提示，false 为长提示"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ text, short }) => wrap(() => showToast(text, short)));
    server.registerTool("phone_vibrate", {
        title: "让手机震动",
        description: "让手机震动指定毫秒数。需要 PHONE_MCP_ALLOW_ACTIONS=1。",
        inputSchema: z.object({
            duration_ms: z.number().int().min(1).max(5_000).default(500).describe("震动时长（毫秒）"),
            force: z.boolean().default(false).describe("是否使用强制震动模式"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ duration_ms, force }) => wrap(() => vibrateDevice(duration_ms, force)));
    server.registerTool("phone_speak", {
        title: "朗读文字",
        description: "用手机 TTS 朗读一段文字。需要 PHONE_MCP_ALLOW_ACTIONS=1，且系统已安装对应语言的语音包。",
        inputSchema: z.object({
            text: z.string().min(1).max(1_000).describe("要朗读的文字"),
            language: z.string().min(2).max(20).default("zh").describe("语言代码，例如 zh、en"),
            rate: z.number().min(0.1).max(3).default(1).describe("语速倍率"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ text, language, rate }) => wrap(() => speakText(text, language, rate)));
    server.registerTool("phone_clipboard_get", {
        title: "读取手机剪贴板",
        description: "读取当前手机剪贴板里的纯文本。只读，但内容可能包含敏感信息。",
        inputSchema: z.object({}).strict(),
        annotations: readOnlyAnnotations,
    }, async () => wrap(() => readClipboard()));
    server.registerTool("phone_clipboard_set", {
        title: "写入手机剪贴板",
        description: "把文本写入手机剪贴板。需要 PHONE_MCP_ALLOW_ACTIONS=1。",
        inputSchema: z.object({
            text: z.string().min(1).max(20_000).describe("要写入剪贴板的文本"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ text }) => wrap(() => writeClipboard(text)));
    server.registerTool("phone_torch", {
        title: "开关手电筒",
        description: "打开或关闭手机手电筒。需要 PHONE_MCP_ALLOW_ACTIONS=1。",
        inputSchema: z.object({
            on: z.boolean().describe("true 打开，false 关闭"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ on }) => wrap(() => setTorch(on)));
    server.registerTool("phone_media_control", {
        title: "控制媒体播放",
        description: "控制 Termux 媒体播放器。play 需要 file 参数（HOME 内的音频文件），也可以是 pause/stop/info。需要 PHONE_MCP_ALLOW_ACTIONS=1。",
        inputSchema: z.object({
            action: z.enum(["play", "pause", "stop", "info"]),
            file: z.string().min(1).max(500).optional().describe("play 时的音频文件路径，必须位于 Termux HOME 内"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ action, file }) => wrap(() => controlMedia(action, file)));
    server.registerTool("phone_open_url", {
        title: "用手机打开链接",
        description: "在手机上用默认应用打开 http/https 链接（通常是浏览器）。需要 PHONE_MCP_ALLOW_ACTIONS=1。",
        inputSchema: z.object({
            url: z.string().url().max(2000).describe("要打开的 http/https 链接"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ url }) => wrap(() => openUrl(url)));
}
//# sourceMappingURL=register-device.js.map