import type { ToolPayload } from "../types.js";

export function success(data: unknown): { content: Array<{ type: "text"; text: string }>; structuredContent: ToolPayload } {
  const payload: ToolPayload = { ok: true, timestamp: new Date().toISOString(), data };
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
}

export function failure(error: string, hint?: string): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ToolPayload;
} {
  const payload: ToolPayload = { ok: false, timestamp: new Date().toISOString(), error, hint };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
}

export async function wrap(operation: () => Promise<unknown>): Promise<ReturnType<typeof success> | ReturnType<typeof failure>> {
  try {
    return success(await operation());
  } catch (error: unknown) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}
