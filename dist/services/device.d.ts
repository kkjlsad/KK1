export declare function showToast(text: string, short: boolean): Promise<Record<string, unknown>>;
export declare function vibrateDevice(durationMs: number, force: boolean): Promise<Record<string, unknown>>;
export declare function speakText(text: string, language: string, rate: number): Promise<Record<string, unknown>>;
export declare function readClipboard(): Promise<Record<string, unknown>>;
export declare function writeClipboard(text: string): Promise<Record<string, unknown>>;
export declare function setTorch(on: boolean): Promise<Record<string, unknown>>;
export declare function controlMedia(action: "play" | "pause" | "stop" | "info", file?: string): Promise<Record<string, unknown>>;
export declare function openUrl(url: string): Promise<Record<string, unknown>>;
