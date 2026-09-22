import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { downloadFile, listFiles, readTextFile, writeTextFile } from "../services/files.js";
import { wrap } from "./response.js";

const readOnlyAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const actionAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };

export function registerFileTools(server: McpServer): void {
  server.registerTool(
    "phone_list_files",
    {
      title: "列出目录内容",
      description:
        "列出 Termux HOME 内的目录，返回条目名称、类型、大小和修改时间。~/storage 下是手机共享存储（相册、下载等）。只读。",
      inputSchema: z.object({
        path: z.string().min(1).max(500).default("~").describe("目录路径，必须位于 Termux HOME 内，例如 ~ 或 ~/storage/shared/Download"),
      }).strict(),
      annotations: readOnlyAnnotations,
    },
    async ({ path }) => wrap(() => listFiles(path)),
  );

  server.registerTool(
    "phone_read_file",
    {
      title: "读取文本文件",
      description: "读取 Termux HOME 内某个文本文件的内容。二进制文件会被拒绝。只读。",
      inputSchema: z.object({
        path: z.string().min(1).max(500).describe("文件路径，必须位于 Termux HOME 内"),
        max_bytes: z.number().int().min(256).max(200_000).default(20_000).describe("最多读取的字节数"),
      }).strict(),
      annotations: readOnlyAnnotations,
    },
    async ({ path, max_bytes }) => wrap(() => readTextFile(path, max_bytes)),
  );

  server.registerTool(
    "phone_write_file",
    {
      title: "写入文本文件",
      description:
        "把文本写入 Termux HOME 内的文件，父目录会自动创建。append=false 时会覆盖原文件。需要 PHONE_MCP_ALLOW_ACTIONS=1。",
      inputSchema: z.object({
        path: z.string().min(1).max(500).describe("文件路径，必须位于 Termux HOME 内"),
        content: z.string().max(200_000).describe("要写入的文本内容"),
        append: z.boolean().default(false).describe("true 表示追加，false 表示覆盖"),
      }).strict(),
      annotations: actionAnnotations,
    },
    async ({ path, content, append }) => wrap(() => writeTextFile(path, content, append)),
  );

  server.registerTool(
    "phone_download",
    {
      title: "下载文件到手机",
      description:
        "用 curl 把 http/https 链接下载到 Termux HOME 内的路径。需要 PHONE_MCP_ALLOW_ACTIONS=1。存到 ~/storage/shared/Download 就会出现在手机下载目录。",
      inputSchema: z.object({
        url: z.string().url().max(2000).describe("http/https 下载地址"),
        destination: z.string().min(1).max(500).describe("保存路径，必须位于 Termux HOME 内"),
        timeout_seconds: z.number().int().min(5).max(600).default(120).describe("下载超时秒数"),
      }).strict(),
      annotations: actionAnnotations,
    },
    async ({ url, destination, timeout_seconds }) => wrap(() => downloadFile(url, destination, timeout_seconds)),
  );
}
