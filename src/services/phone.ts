import os from "node:os";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { commandExists, readTextIfAccessible, runCommand } from "./command.js";
import type { BatteryStatus } from "../types.js";

const BATTERY_ROOT = "/sys/class/power_supply/battery";

export async function getPhoneOverview(): Promise<Record<string, unknown>> {
  const properties = await getAndroidProperties([
    "ro.product.manufacturer",
    "ro.product.model",
    "ro.product.device",
    "ro.product.name",
    "ro.build.version.release",
    "ro.build.version.sdk",
    "ro.build.version.security_patch",
    "ro.build.display.id",
    "ro.soc.manufacturer",
    "ro.soc.model",
  ]);
  const uptimeSeconds = Number.parseFloat((await readTextIfAccessible("/proc/uptime"))?.split(/\s+/)[0] ?? "0");
  return {
    android: properties,
    kernel: os.type() === "Linux" ? (await runCommand("uname", ["-a"])).stdout.trim() : `${os.type()} ${os.release()}`,
    architecture: os.arch(),
    hostname: os.hostname(),
    cpu_logical_cores: os.cpus().length,
    memory_total_bytes: os.totalmem(),
    uptime_seconds: Number.isFinite(uptimeSeconds) ? uptimeSeconds : os.uptime(),
    termux_prefix: process.env.PREFIX ?? null,
    termux_home: process.env.HOME ?? os.homedir(),
    scope_note: "普通 Termux 仅能读取 Android 公开给自身 UID 的信息；其他 App 进程和逐 App 耗电通常不可见。",
  };
}

export async function getBatteryStatus(): Promise<BatteryStatus> {
  if (await commandExists("termux-battery-status")) {
    const result = await runCommand("termux-battery-status", [], { timeoutMs: 12_000 });
    if (result.exitCode === 0) {
      try {
        const raw = JSON.parse(result.stdout) as Record<string, unknown>;
        return normalizeTermuxBattery(raw);
      } catch {
        // Fall through to sysfs when the companion app returned malformed data.
      }
    }
  }
  return getSysfsBattery();
}

export async function samplePower(durationSeconds: number, intervalSeconds: number): Promise<Record<string, unknown>> {
  const samples: BatteryStatus[] = [];
  const startedAt = Date.now();
  const deadline = startedAt + durationSeconds * 1_000;
  do {
    samples.push(await getBatteryStatus());
    if (Date.now() + intervalSeconds * 1_000 > deadline) break;
    await delay(intervalSeconds * 1_000);
  } while (Date.now() < deadline);

  const powers = samples.map((item) => item.estimated_power_w).filter((value): value is number => value !== undefined);
  const currents = samples.map((item) => item.current_ua).filter((value): value is number => value !== undefined);
  return {
    duration_seconds: (Date.now() - startedAt) / 1_000,
    sample_count: samples.length,
    average_power_w_abs: average(powers.map(Math.abs)),
    average_current_ma_abs: average(currents.map((value) => Math.abs(value) / 1_000)),
    first_percentage: samples.at(0)?.percentage ?? null,
    last_percentage: samples.at(-1)?.percentage ?? null,
    samples,
    accuracy_note: "这是 BatteryManager 的瞬时电流与电压估算，不是 Android BatteryStats 的逐 App 归因；部分厂商会反转电流正负号。",
  };
}

export async function getResourceStatus(sampleMilliseconds: number): Promise<Record<string, unknown>> {
  const before = await readCpuTicks();
  await delay(sampleMilliseconds);
  const after = await readCpuTicks();
  const cpuUsagePercent = before && after ? calculateCpuUsage(before, after) : null;
  const memory = await readMemInfo();
  const disk = await runCommand("df", ["-Pk", process.env.HOME ?? "."], { timeoutMs: 5_000 });
  const processes = await runCommand("ps", ["-A", "-o", "PID,PPID,USER,%CPU,%MEM,NAME"], { timeoutMs: 5_000 });
  return {
    cpu: {
      logical_cores: os.cpus().length,
      usage_percent: cpuUsagePercent,
      load_average: os.loadavg(),
      frequencies_khz: await readCpuFrequencies(),
    },
    memory,
    storage_df: disk.exitCode === 0 ? disk.stdout.trim() : disk.stderr.trim(),
    visible_processes: processes.exitCode === 0 ? processes.stdout.trim().split("\n").slice(0, 60) : [],
    process_scope_note: "Android 会按 UID 隔离 /proc；普通 Termux 通常看不到其他 App 的完整进程与资源占用。",
  };
}

export async function getThermalStatus(): Promise<Record<string, unknown>> {
  const zones: Array<Record<string, unknown>> = [];
  try {
    const entries = await readdir("/sys/class/thermal", { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isDirectory() && item.name.startsWith("thermal_zone")).slice(0, 64)) {
      const root = path.join("/sys/class/thermal", entry.name);
      const type = await readTextIfAccessible(path.join(root, "type"));
      const rawTemp = await readTextIfAccessible(path.join(root, "temp"));
      if (rawTemp === undefined) continue;
      const numeric = Number(rawTemp);
      zones.push({
        zone: entry.name,
        type: type ?? "unknown",
        temperature_c: Number.isFinite(numeric) ? normalizeTemperature(numeric) : null,
      });
    }
  } catch {
    // Recent Android versions often deny direct thermal sysfs access.
  }
  const battery = await getBatteryStatus();
  return {
    zones,
    battery_temperature_c: battery.temperature_c ?? null,
    limitation: zones.length === 0 ? "系统未向 Termux 开放 thermal_zone；当前只能使用电池温度。" : null,
  };
}

export async function getNetworkStatus(): Promise<Record<string, unknown>> {
  const wifiAvailable = await commandExists("termux-wifi-connectioninfo");
  const wifiResult = wifiAvailable
    ? await runCommand("termux-wifi-connectioninfo", [], { timeoutMs: 12_000 })
    : undefined;
  const addresses = await runCommand("ip", ["-brief", "address"], { timeoutMs: 5_000 });
  const routes = await runCommand("ip", ["route"], { timeoutMs: 5_000 });
  return {
    wifi: parseJsonOrText(wifiResult?.stdout ?? wifiResult?.stderr ?? "Termux:API 不可用"),
    addresses: addresses.exitCode === 0 ? addresses.stdout.trim() : addresses.stderr.trim(),
    routes: routes.exitCode === 0 ? routes.stdout.trim() : routes.stderr.trim(),
  };
}

export async function getCapabilities(): Promise<Record<string, unknown>> {
  const commands = [
    "termux-battery-status",
    "termux-wifi-connectioninfo",
    "termux-brightness",
    "termux-volume",
    "proot-distro",
    "docker",
    "podman",
    "su",
  ];
  const entries = await Promise.all(commands.map(async (command) => [command, await commandExists(command)] as const));
  const available = Object.fromEntries(entries);
  return {
    commands: available,
    android_api_bridge_ready: available["termux-battery-status"] === true,
    root_binary_present: available.su === true,
    true_container_runtime_present: available.docker === true || available.podman === true,
    proot_environment_present: available["proot-distro"] === true,
    limitations: [
      "Termux PRoot 是用户态 Linux 环境，不是 Docker，也不提供真正的内核隔离。",
      "普通非 root Android 无法可靠读取逐 App 功耗、其他 App 的 CPU/内存或系统 BatteryStats。",
      "Docker/Podman 需要设备内核、cgroup/namespace 与通常的 root 支持；检测到命令不等于运行时一定可用。",
    ],
  };
}

async function getAndroidProperties(keys: string[]): Promise<Record<string, string | null>> {
  if (!(await commandExists("getprop"))) return Object.fromEntries(keys.map((key) => [key, null]));
  const pairs = await Promise.all(keys.map(async (key) => {
    const result = await runCommand("getprop", [key], { timeoutMs: 3_000 });
    return [key, result.exitCode === 0 ? result.stdout.trim() || null : null] as const;
  }));
  return Object.fromEntries(pairs);
}

function normalizeTermuxBattery(raw: Record<string, unknown>): BatteryStatus {
  const current = numberValue(raw.current);
  const voltage = numberValue(raw.voltage);
  return {
    source: "termux-api",
    present: booleanValue(raw.present),
    technology: stringValue(raw.technology),
    health: stringValue(raw.health),
    plugged: stringValue(raw.plugged),
    status: stringValue(raw.status),
    temperature_c: numberValue(raw.temperature),
    voltage_mv: voltage,
    current_ua: current,
    current_average_ua: numberValue(raw.current_average),
    percentage: numberValue(raw.percentage),
    charge_counter_uah: numberValue(raw.charge_counter),
    energy_nwh: numberValue(raw.energy),
    cycle_count: numberValue(raw.cycle),
    estimated_power_w: current !== undefined && voltage !== undefined
      ? (current * voltage) / 1_000_000_000
      : undefined,
    notes: ["estimated_power_w 由 current(µA) × voltage(mV) 估算；电流正负号取决于厂商实现。"],
  };
}

async function getSysfsBattery(): Promise<BatteryStatus> {
  const [capacity, status, health, technology, temp, voltage, current, charge, cycle] = await Promise.all([
    readTextIfAccessible(path.join(BATTERY_ROOT, "capacity")),
    readTextIfAccessible(path.join(BATTERY_ROOT, "status")),
    readTextIfAccessible(path.join(BATTERY_ROOT, "health")),
    readTextIfAccessible(path.join(BATTERY_ROOT, "technology")),
    readTextIfAccessible(path.join(BATTERY_ROOT, "temp")),
    readTextIfAccessible(path.join(BATTERY_ROOT, "voltage_now")),
    readTextIfAccessible(path.join(BATTERY_ROOT, "current_now")),
    readTextIfAccessible(path.join(BATTERY_ROOT, "charge_counter")),
    readTextIfAccessible(path.join(BATTERY_ROOT, "cycle_count")),
  ]);
  const currentUa = numericText(current);
  const voltageRaw = numericText(voltage);
  const voltageMv = voltageRaw === undefined ? undefined : Math.abs(voltageRaw) > 100_000 ? voltageRaw / 1_000 : voltageRaw;
  return {
    source: "sysfs",
    health,
    technology,
    status,
    temperature_c: temp === undefined ? undefined : normalizeTemperature(Number(temp)),
    voltage_mv: voltageMv,
    current_ua: currentUa,
    percentage: numericText(capacity),
    charge_counter_uah: numericText(charge),
    cycle_count: numericText(cycle),
    estimated_power_w: currentUa !== undefined && voltageMv !== undefined
      ? (currentUa * voltageMv) / 1_000_000_000
      : undefined,
    notes: [
      "未能调用 Termux:API，已回退到 sysfs；部分 Android 设备会拒绝或裁剪这些字段。",
      "请同时安装与 Termux 同来源签名的 Termux:API APK，并在 Termux 执行 pkg install termux-api。",
    ],
  };
}

async function readMemInfo(): Promise<Record<string, number | null>> {
  const text = await readTextIfAccessible("/proc/meminfo");
  if (!text) return { total_bytes: os.totalmem(), available_bytes: os.freemem(), used_percent: null };
  const values = new Map<string, number>();
  for (const line of text.split("\n")) {
    const match = /^(\w+):\s+(\d+)\s+kB$/i.exec(line);
    if (match?.[1] && match[2]) values.set(match[1], Number(match[2]) * 1024);
  }
  const total = values.get("MemTotal") ?? os.totalmem();
  const available = values.get("MemAvailable") ?? values.get("MemFree") ?? os.freemem();
  return {
    total_bytes: total,
    available_bytes: available,
    used_bytes: total - available,
    used_percent: total > 0 ? Number((((total - available) / total) * 100).toFixed(2)) : null,
  };
}

interface CpuTicks { idle: number; total: number }

async function readCpuTicks(): Promise<CpuTicks | undefined> {
  const text = await readTextIfAccessible("/proc/stat");
  const line = text?.split("\n")[0];
  if (!line?.startsWith("cpu ")) return undefined;
  const ticks = line.trim().split(/\s+/).slice(1).map(Number);
  if (ticks.some((value) => !Number.isFinite(value))) return undefined;
  return { idle: (ticks[3] ?? 0) + (ticks[4] ?? 0), total: ticks.reduce((sum, value) => sum + value, 0) };
}

function calculateCpuUsage(before: CpuTicks, after: CpuTicks): number | null {
  const total = after.total - before.total;
  const idle = after.idle - before.idle;
  return total > 0 ? Number(((1 - idle / total) * 100).toFixed(2)) : null;
}

async function readCpuFrequencies(): Promise<Array<number | null>> {
  return Promise.all(Array.from({ length: os.cpus().length }, async (_, index) => {
    const raw = await readTextIfAccessible(`/sys/devices/system/cpu/cpu${index}/cpufreq/scaling_cur_freq`);
    return raw === undefined ? null : Number(raw);
  }));
}

function normalizeTemperature(raw: number): number {
  if (!Number.isFinite(raw)) return raw;
  if (Math.abs(raw) >= 1_000) return raw / 1_000;
  if (Math.abs(raw) >= 100) return raw / 10;
  return raw;
}

function parseJsonOrText(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value.trim();
  }
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numericText(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}
