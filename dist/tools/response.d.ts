import type { ToolPayload } from "../types.js";
export declare function success(data: unknown): {
    content: Array<{
        type: "text";
        text: string;
    }>;
    structuredContent: ToolPayload;
};
export declare function failure(error: string, hint?: string): {
    isError: true;
    content: Array<{
        type: "text";
        text: string;
    }>;
    structuredContent: ToolPayload;
};
export declare function wrap(operation: () => Promise<unknown>): Promise<ReturnType<typeof success> | ReturnType<typeof failure>>;
