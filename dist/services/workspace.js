import { copyFile, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveWithinHome } from "./command.js";
import { requireActions } from "./environments.js";
export async function editTextFile(target, find, replace, all) {
    requireActions();
    if (find.length === 0)
        throw new Error("find 不能为空。");
    const resolved = resolveWithinHome(target);
    const original = await readFile(resolved, "utf8");
    const occurrences = original.split(find).length - 1;
    if (occurrences === 0)
        throw new Error("文件里没有找到要替换的内容。");
    if (occurrences > 1 && !all) {
        throw new Error(`找到 ${occurrences} 处匹配，为安全起见没有改动。请把 find 写得更精确，或显式设置 all=true。`);
    }
    const updated = all ? original.split(find).join(replace) : original.replace(find, replace);
    await writeFile(resolved, updated, "utf8");
    return {
        path: resolved,
        occurrences,
        replaced: all ? occurrences : 1,
        size_bytes: Buffer.byteLength(updated, "utf8"),
    };
}
export async function deletePath(target, recursive, confirm) {
    requireActions();
    const resolved = resolveWithinHome(target);
    if (resolved === resolveWithinHome("~"))
        throw new Error("拒绝删除 Termux HOME 本身。");
    const base = path.basename(resolved);
    if (confirm !== `DELETE:${base}`)
        throw new Error(`确认字符串不匹配，应为 DELETE:${base}`);
    const info = await stat(resolved);
    if (info.isDirectory() && !recursive)
        throw new Error("目标是目录，删除目录需要 recursive=true。");
    await rm(resolved, { recursive, force: false });
    return { path: resolved, deleted: true, type: info.isDirectory() ? "dir" : "file" };
}
export async function movePath(from, to) {
    requireActions();
    const source = resolveWithinHome(from);
    const destination = resolveWithinHome(to);
    await mkdir(path.dirname(destination), { recursive: true });
    try {
        await rename(source, destination);
    }
    catch (error) {
        if (error.code !== "EXDEV")
            throw error;
        await copyFile(source, destination);
        await unlink(source);
    }
    return { from: source, to: destination, moved: true };
}
async function collectFiles(root, depth, out, maxFiles) {
    if (depth > 8 || out.length >= maxFiles)
        return;
    let dirents;
    try {
        dirents = await readdir(root, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const dirent of dirents) {
        if (out.length >= maxFiles)
            return;
        if (dirent.name === "node_modules" || dirent.name === ".git" || dirent.name === ".cache")
            continue;
        const full = path.join(root, dirent.name);
        if (dirent.isDirectory())
            await collectFiles(full, depth + 1, out, maxFiles);
        else if (dirent.isFile())
            out.push(full);
    }
}
export async function searchFiles(root, namePattern, contentPattern, maxResults) {
    const resolved = resolveWithinHome(root);
    const files = [];
    await collectFiles(resolved, 0, files, 4000);
    const nameRegex = namePattern ? new RegExp(namePattern, "i") : undefined;
    let contentRegex;
    if (contentPattern) {
        try {
            contentRegex = new RegExp(contentPattern, "i");
        }
        catch {
            throw new Error("content 不是合法的正则表达式。");
        }
    }
    const matches = [];
    let scannedForContent = 0;
    for (const file of files) {
        if (matches.length >= maxResults)
            break;
        const relative = path.relative(resolved, file);
        const info = await stat(file).catch(() => undefined);
        if (!info || info.size > 1_000_000)
            continue;
        if (!contentRegex) {
            if (!nameRegex || nameRegex.test(path.basename(file))) {
                matches.push({ path: relative, size_bytes: info.size });
            }
            continue;
        }
        scannedForContent += 1;
        const text = await readFile(file, "utf8").catch(() => undefined);
        if (text === undefined || text.includes("\0"))
            continue;
        const lines = text.split("\n");
        for (let index = 0; index < lines.length && matches.length < maxResults; index += 1) {
            const line = lines[index] ?? "";
            if (line.length > 400)
                continue;
            if (contentRegex.test(line)) {
                matches.push({ path: relative, line: index + 1, text: line.trim() });
            }
        }
    }
    return {
        root: resolved,
        files_found: files.length,
        files_scanned_for_content: scannedForContent,
        returned: matches.length,
        matches,
    };
}
//# sourceMappingURL=workspace.js.map