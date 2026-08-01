import type { CommandResult } from "../types.js";
export declare function commandExists(command: string): Promise<boolean>;
export declare function runCommand(command: string, args?: string[], options?: {
    timeoutMs?: number;
    cwd?: string;
    maxOutputChars?: number;
}): Promise<CommandResult>;
export declare function readTextIfAccessible(filePath: string): Promise<string | undefined>;
export declare function resolveWithinHome(inputPath: string): string;
export declare function truncate(value: string, limit?: number): string;
