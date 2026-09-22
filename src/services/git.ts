import { resolveWithinHome, runCommand, truncate } from "./command.js";
import { requireActions } from "./environments.js";

export type GitAction =
  | "status" | "diff" | "log" | "branch" | "remote" | "show" | "rev-parse"
  | "add" | "commit" | "push" | "pull" | "fetch" | "stash";

const WRITE_ACTIONS: GitAction[] = ["add", "commit", "push", "pull", "fetch", "stash"];

export async function gitAction(
  repository: string,
  action: GitAction,
  args: string[],
  message?: string,
): Promise<Record<string, unknown>> {
  const resolved = resolveWithinHome(repository);
  if (WRITE_ACTIONS.includes(action)) requireActions();
  const extra = args.filter((value) => value.length > 0 && value.length <= 200);
  let finalArgs: string[];
  switch (action) {
    case "add":
      finalArgs = ["add", ...(extra.length > 0 ? extra : ["-A"])];
      break;
    case "commit":
      if (!message) throw new Error("commit 需要提供 message。");
      finalArgs = ["commit", "-m", message, ...extra];
      break;
    case "push":
      finalArgs = ["push", ...extra];
      break;
    case "log":
      finalArgs = ["log", ...(extra.length > 0 ? extra : ["--oneline", "-10"])];
      break;
    default:
      finalArgs = [action, ...extra];
  }
  const result = await runCommand("git", finalArgs, { cwd: resolved, timeoutMs: 300_000 });
  const output = `${result.stdout}${result.stderr}`.trim();
  if (result.exitCode !== 0) {
    throw new Error(`git ${action} 失败（退出码 ${result.exitCode}）：${truncate(output, 1500)}`);
  }
  return { repository: resolved, action, args: finalArgs, output: truncate(output, 8000) };
}

export async function cloneRepo(url: string, destination: string, depth: number): Promise<Record<string, unknown>> {
  requireActions();
  if (!/^(https:\/\/\S+|git@\S+:\S+)$/.test(url)) {
    throw new Error("仓库地址只支持 https://... 或 git@host:path 形式。");
  }
  const resolved = resolveWithinHome(destination);
  const args = ["clone"];
  if (depth > 0) args.push("--depth", String(depth));
  args.push(url, resolved);
  const result = await runCommand("git", args, { timeoutMs: 600_000 });
  const output = `${result.stdout}${result.stderr}`.trim();
  if (result.exitCode !== 0) {
    throw new Error(`git clone 失败：${truncate(output, 1200)}`);
  }
  return { url, path: resolved, depth, output: truncate(output, 2000) };
}
