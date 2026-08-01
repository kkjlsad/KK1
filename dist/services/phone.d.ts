import type { BatteryStatus } from "../types.js";
export declare function getPhoneOverview(): Promise<Record<string, unknown>>;
export declare function getBatteryStatus(): Promise<BatteryStatus>;
export declare function samplePower(durationSeconds: number, intervalSeconds: number): Promise<Record<string, unknown>>;
export declare function getResourceStatus(sampleMilliseconds: number): Promise<Record<string, unknown>>;
export declare function getThermalStatus(): Promise<Record<string, unknown>>;
export declare function getNetworkStatus(): Promise<Record<string, unknown>>;
export declare function getCapabilities(): Promise<Record<string, unknown>>;
