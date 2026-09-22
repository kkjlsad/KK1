import { z } from "zod";
import { cloneRepo, gitAction } from "../services/git.js";
import { deletePath, editTextFile, movePath, searchFiles } from "../services/workspace.js";
import { wrap } from "./response.js";
const readOnlyAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const actionAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const destructiveAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };
export function registerWorkspaceTools(server) {
    server.registerTool("phone_edit_file", {
        title: "编辑文本文件（精确替换）",
        description: "把 Termux HOME 内文本文件中的 find 替换为 replace。默认要求 find 在文件中唯一（避免误改），需要批量时显式设置 all=true。需要 PHONE_MCP_ALLOW_ACTIONS=1。",
        inputSchema: z.object({
            path: z.string().min(1).max(500).describe("文件路径，必须位于 Termux HOME 内"),
            find: z.string().min(1).max(4000).describe("要被替换的原文，建议带上足够上下文以保证唯一"),
            replace: z.string().max(4000).describe("替换后的内容，空字符串表示删除"),
            all: z.boolean().default(false).describe("true 表示替换全部匹配处"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ path, find, replace, all }) => wrap(() => editTextFile(path, find, replace, all)));
    server.registerTool("phone_search_files", {
        title: "搜索文件或文件内容",
        description: "在 Termux HOME 内按文件名（name）或内容（content，支持正则）搜索。自动跳过 node_modules、.git、.cache 与大于 1MB 的文件。只读。",
        inputSchema: z.object({
            path: z.string().min(1).max(500).default("~").describe("搜索起点目录"),
            name: z.string().max(200).optional().describe("文件名正则，例如 \\.ts$"),
            content: z.string().max(200).optional().describe("文件内容正则，例如 phone_git"),
            max_results: z.number().int().min(1).max(200).default(50).describe("最多返回多少条"),
        }).strict(),
        annotations: readOnlyAnnotations,
    }, async ({ path, name, content, max_results }) => wrap(async () => {
        if (!name && !content)
            throw new Error("name 和 content 至少要提供一个。");
        return searchFiles(path, name, content, max_results);
    }));
    server.registerTool("phone_move_path", {
        title: "移动或重命名文件",
        description: "在 Termux HOME 内移动/重命名文件或目录，父目录会自动创建。需要 PHONE_MCP_ALLOW_ACTIONS=1。",
        inputSchema: z.object({
            from: z.string().min(1).max(500).describe("源路径"),
            to: z.string().min(1).max(500).describe("目标路径"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ from, to }) => wrap(() => movePath(from, to)));
    server.registerTool("phone_delete_path", {
        title: "删除文件或目录",
        description: "删除 Termux HOME 内的文件或目录，必须提供 DELETE:<名字> 形式的确认字符串；删除目录还要 recursive=true。此操作不可恢复，建议在 RikkaHub 开启每次确认。",
        inputSchema: z.object({
            path: z.string().min(1).max(500).describe("要删除的路径"),
            confirm: z.string().max(300).describe("确认字符串，必须是 DELETE:<路径最后一段的名字>"),
            recursive: z.boolean().default(false).describe("删除目录时必须为 true"),
        }).strict(),
        annotations: destructiveAnnotations,
    }, async ({ path, confirm, recursive }) => wrap(() => deletePath(path, recursive, confirm)));
    server.registerTool("phone_git", {
        title: "执行 Git 操作",
        description: "在 Termux HOME 内的 Git 仓库执行操作。只读：status/diff/log/branch/remote/show/rev-parse；写入（需 PHONE_MCP_ALLOW_ACTIONS=1）：add/commit/push/pull/fetch/stash。额外参数用 args 数组传入，不经 shell 解析。",
        inputSchema: z.object({
            repository: z.string().min(1).max(500).default("~").describe("仓库路径，必须位于 Termux HOME 内"),
            action: z.enum([
                "status", "diff", "log", "branch", "remote", "show", "rev-parse",
                "add", "commit", "push", "pull", "fetch", "stash",
            ]),
            args: z.array(z.string().max(200)).max(20).default([]).describe("额外 git 参数，例如 [\"--stat\"] 或 [\"origin\",\"main\"]"),
            message: z.string().max(2000).optional().describe("commit 时的提交信息"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ repository, action, args, message }) => wrap(() => gitAction(repository, action, args, message)));
    server.registerTool("phone_clone_repo", {
        title: "克隆远程仓库",
        description: "把远程 Git 仓库克隆到 Termux HOME 内。支持 https:// 与 git@ 地址（SSH 需本机已配置密钥）。需要 PHONE_MCP_ALLOW_ACTIONS=1。",
        inputSchema: z.object({
            url: z.string().min(8).max(500).describe("仓库地址"),
            destination: z.string().min(1).max(500).describe("克隆到哪个目录，必须位于 Termux HOME 内"),
            depth: z.number().int().min(0).max(100).default(1).describe("浅克隆深度，0 表示完整克隆"),
        }).strict(),
        annotations: actionAnnotations,
    }, async ({ url, destination, depth }) => wrap(() => cloneRepo(url, destination, depth)));
}
//# sourceMappingURL=register-workspace.js.map