export declare function getNotifications(limit: number): Promise<Record<string, unknown>>;
export declare function getSms(limit: number, box: "all" | "inbox" | "sent" | "draft"): Promise<Record<string, unknown>>;
export declare function sendSms(number: string, text: string): Promise<Record<string, unknown>>;
export declare function getCallLog(limit: number): Promise<Record<string, unknown>>;
export declare function getContacts(limit: number, query?: string): Promise<Record<string, unknown>>;
export declare function getLocation(provider: "gps" | "network" | "passive"): Promise<Record<string, unknown>>;
export declare function getSensors(mode: "list" | "sample", name?: string, count?: number): Promise<Record<string, unknown>>;
export declare function cameraPhoto(cameraId: number, output: string): Promise<Record<string, unknown>>;
export declare function listInstalledApps(): Promise<Record<string, unknown>>;
