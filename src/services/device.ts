import { commandExists, resolveWithinHome, runCommand } from "./command.js";
import { requireActions } from "./environments.js";

async function runApi(name: string, args: string[], timeoutMs = 15_000): Promise<string> {
  if (!(await commandExists(name))) {
    throw new Error(`未找到命令 ${name}。请确认已安装 Termux:API App 与 termux-api 包。`);
  }
  const result = await runCommand(name, args, { timeoutMs });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `${name} 退出码 ${result.exitCode}`);
  }
  return result.stdout.trim();
}

export async function showToast(text: string, short: boolean): Promise<Record<string, unknown>> {
  requireActions();
  await runApi("termux-toast", short ? ["-s", text] : [text], 10_000);
  return { toast: text, duration: short ? "short" : "default" };
}

export async function vibrateDevice(durationMs: number, force: boolean): Promise<Record<string, unknown>> {
  requireActions();
  const args = ["-d", String(durationMs)];
  if (force) args.push("-f");
  await runApi("termux-vibrate", args, 12_000);
  return { duration_ms: durationMs, force };
}

export async function speakText(text: string, language: string, rate: number): Promise<Record<string, unknown>> {
  requireActions();
  await runApi("termux-tts-speak", ["-l", language, "-r", String(rate), text], 90_000);
  return { text, language, rate };
}

export async function readClipboard(): Promise<Record<string, unknown>> {
  const text = await runApi("termux-clipboard-get", [], 10_000);
  return { text, length: text.length };
}

export async function writeClipboard(text: string): Promise<Record<string, unknown>> {
  requireActions();
  await runApi("termux-clipboard-set", [text], 10_000);
  return { written: true, length: text.length };
}

export async function setTorch(on: boolean): Promise<Record<string, unknown>> {
  requireActions();
  await runApi("termux-torch", [on ? "on" : "off"], 10_000);
  return { torch: on ? "on" : "off" };
}

export async function controlMedia(
  action: "play" | "pause" | "stop" | "info",
  file?: string,
): Promise<Record<string, unknown>> {
  requireActions();
  const resolved = file ? resolveWithinHome(file) : undefined;
  if (action === "play" && !resolved) throw new Error("play 动作需要提供 file 参数。");
  const args = action === "play" && resolved ? ["play", resolved] : [action];
  const output = await runApi("termux-media-player", args, 20_000);
  return { action, file: resolved, output };
}

export async function openUrl(url: string): Promise<Record<string, unknown>> {
  requireActions();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("url 不是合法地址。");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("只允许 http/https 链接。");
  }
  await runApi("termux-open-url", [url], 15_000);
  return { opened: url };
}
