import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveWithinHome, runCommand, truncate } from "./command.js";
import { requireActions } from "./environments.js";

interface FileEntry {
  name: string;
  type: "dir" | "file" | "link" | "other";
  size_bytes?: number;
  modified?: string;
}

export async function listFiles(target: string): Promise<Record<string, unknown>> {
  const resolved = resolveWithinHome(target);
  const dirents = await readdir(resolved, { withFileTypes: true });
  const entries: FileEntry[] = [];
  for (const dirent of dirents) {
    const entry: FileEntry = {
      name: dirent.name,
      type: dirent.isDirectory() ? "dir" : dirent.isSymbolicLink() ? "link" : dirent.isFile() ? "file" : "other",
    };
    try {
      const info = await stat(path.join(resolved, dirent.name));
      entry.size_bytes = info.size;
      entry.modified = info.mtime.toISOString();
    } catch {
      // 忽略无法 stat 的条目（死链等）
    }
    entries.push(entry);
  }
  entries.sort((left, right) => {
    if (left.type === right.type) return left.name.localeCompare(right.name);
    if (left.type === "dir") return -1;
    if (right.type === "dir") return 1;
    return left.name.localeCompare(right.name);
  });
  return { path: resolved, count: entries.length, entries };
}

export async function readTextFile(target: string, maxBytes: number): Promise<Record<string, unknown>> {
  const resolved = resolveWithinHome(target);
  const info = await stat(resolved);
  if (info.isDirectory()) throw new Error(`${resolved} 是目录，请改用 phone_list_files。`);
  const limit = Math.min(Math.max(maxBytes, 256), 200_000);
  const raw = await readFile(resolved);
  const clipped = raw.subarray(0, limit);
  if (clipped.includes(0)) throw new Error("这是二进制文件，本工具只读文本。");
  return {
    path: resolved,
    size_bytes: info.size,
    truncated: raw.length > limit,
    content: truncate(clipped.toString("utf8"), 20_000),
  };
}

export async function writeTextFile(target: string, content: string, append: boolean): Promise<Record<string, unknown>> {
  requireActions();
  const resolved = resolveWithinHome(target);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, content, { encoding: "utf8", flag: append ? "a" : "w" });
  const info = await stat(resolved);
  return { path: resolved, size_bytes: info.size, append };
}

export async function downloadFile(
  url: string,
  destination: string,
  timeoutSeconds: number,
): Promise<Record<string, unknown>> {
  requireActions();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("url 不是合法地址。");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("只允许 http/https 链接。");
  const resolved = resolveWithinHome(destination);
  await mkdir(path.dirname(resolved), { recursive: true });
  const result = await runCommand(
    "curl",
    ["-fL", "--retry", "2", "--max-time", String(timeoutSeconds), "-o", resolved, url],
    { timeoutMs: (timeoutSeconds + 10) * 1_000 },
  );
  if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `curl 退出码 ${result.exitCode}`);
  const info = await stat(resolved);
  return { url, path: resolved, size_bytes: info.size };
}
