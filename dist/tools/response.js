export function success(data) {
    const payload = { ok: true, timestamp: new Date().toISOString(), data };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
}
export function failure(error, hint) {
    const payload = { ok: false, timestamp: new Date().toISOString(), error, hint };
    return { isError: true, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
}
export async function wrap(operation) {
    try {
        return success(await operation());
    }
    catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
    }
}
//# sourceMappingURL=response.js.map