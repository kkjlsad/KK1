export declare function listFiles(target: string): Promise<Record<string, unknown>>;
export declare function readTextFile(target: string, maxBytes: number): Promise<Record<string, unknown>>;
export declare function writeTextFile(target: string, content: string, append: boolean): Promise<Record<string, unknown>>;
export declare function downloadFile(url: string, destination: string, timeoutSeconds: number): Promise<Record<string, unknown>>;
