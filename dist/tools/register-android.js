import { z } from "zod";
import { cameraPhoto, getCallLog, getContacts, getLocation, getNotifications, getSensors, getSms, listInstalledApps, sendSms, } from "../services/android.js";
import { wrap } from "./response.js";
const readOnlyAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const actionAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
export function registerAndroidTools(server) {
    server.registerTool("phone_get_notifications", {
        title: "读取通知栏",
        description: "读取当前通知栏里的通知（含 App 包名、标题、内容）。需要在系统设置里给 Termux:API 开“通知使用权”。只读，内容可能含隐私信息。",
        inputSchema: z.object({
            limit: z.number().int().min(1).max(100).default(20).describe("最多返回多少条通知"),
        }).strict(),
        annotations: readOnlyAnnotations,
    }, async ({ limit }) => wrap(() => getNotifications(limit)));
    server.registerTool("phone_get_sms", {
        title: "读取短信",
        description: "读取短信收件箱/已发送。需要 Termux:API 的短信读取权限。只读，内容含隐私信息。",
        inputSchema: z.object({
            limit: z.number().int().min(1).max(200).default(20).describe("最多返回多少条"),
            box: z.enum(["all", "inbox", "sent", "draft"]).default("inbox").describe("读取哪个信箱"),
        }).strict(),
        annotations: readOnlyAnnotations,
    }, async ({ limit, box }) => wrap(() => getSms(limit, box)));
    server.registerTool("phone_send_sms", {
        title: "发送短信",
        description: "用手机发送一条短信。需要 PHONE_MCP_ALLOW_ACTIONS=1 与短信发送权限。此操作不可撤回，建议在 RikkaHub 为此工具开启每次确认。",
        inputSchema: z.object({
            number: z.string().min(4).max(30).describe("接收号码，可带 +86"),
            text: z.string().min(1).max(1000).describe("短信内容"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ number, text }) => wrap(() => sendSms(number, text)));
    server.registerTool("phone_get_call_log", {
        title: "读取通话记录",
        description: "读取最近的通话记录。需要 Termux:API 的通话记录权限。只读，含隐私信息。",
        inputSchema: z.object({
            limit: z.number().int().min(1).max(200).default(20).describe("最多返回多少条"),
        }).strict(),
        annotations: readOnlyAnnotations,
    }, async ({ limit }) => wrap(() => getCallLog(limit)));
    server.registerTool("phone_get_contacts", {
        title: "读取手机联系人",
        description: "读取联系人列表，可选按关键字过滤。需要 Termux:API 的通讯录权限。只读，含隐私信息。",
        inputSchema: z.object({
            limit: z.number().int().min(1).max(500).default(50).describe("最多返回多少条"),
            query: z.string().max(100).optional().describe("可选关键字，过滤姓名或号码"),
        }).strict(),
        annotations: readOnlyAnnotations,
    }, async ({ limit, query }) => wrap(() => getContacts(limit, query)));
    server.registerTool("phone_get_location", {
        title: "获取当前位置",
        description: "读取一次当前位置。需要 Termux:API 的定位权限；provider=gps 时需在室外并可能等待数十秒。只读。",
        inputSchema: z.object({
            provider: z.enum(["gps", "network", "passive"]).default("network").describe("定位方式"),
        }).strict(),
        annotations: readOnlyAnnotations,
    }, async ({ provider }) => wrap(() => getLocation(provider)));
    server.registerTool("phone_get_sensors", {
        title: "读取手机传感器",
        description: "mode=list 列出全部可用传感器；mode=sample 需指定 name 采样。只读。",
        inputSchema: z.object({
            mode: z.enum(["list", "sample"]).default("list"),
            name: z.string().max(100).optional().describe("sample 模式下的传感器名称，如 accelerometer"),
            count: z.number().int().min(1).max(50).default(1).describe("sample 模式的采样次数"),
        }).strict(),
        annotations: readOnlyAnnotations,
    }, async ({ mode, name, count }) => wrap(() => getSensors(mode, name, count)));
    server.registerTool("phone_camera_photo", {
        title: "用手机相机拍照",
        description: "调用手机相机拍一张照片并保存到 Termux HOME 内。需要 PHONE_MCP_ALLOW_ACTIONS=1 及相机权限。存到 ~/storage/shared/DCIM 会直接进相册。",
        inputSchema: z.object({
            camera_id: z.number().int().min(0).max(10).default(0).describe("相机编号，一般 0 后置、1 前置"),
            output: z.string().min(1).max(500).describe("保存路径，必须位于 Termux HOME 内"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ camera_id, output }) => wrap(() => cameraPhoto(camera_id, output)));
    server.registerTool("phone_list_installed_apps", {
        title: "列举已装应用（尽力而为）",
        description: "未 root 时 Android 不允许读取完整应用列表。本工具通过共享存储 /sdcard/Android/media 与 obb 下的包名目录推断，结果不完整。只读。",
        inputSchema: z.object({}).strict(),
        annotations: readOnlyAnnotations,
    }, async () => wrap(() => listInstalledApps()));
}
//# sourceMappingURL=register-android.js.map