// Shared HTTP helpers for the route handlers: CORS, the { error, detail } shape, JSON bodies.

// D1 has no origin allowlist (Ayush, 14 Oct; contract §2.2): CORS answers the request's own Origin.
export function corsHeaders(request: Request): Headers {
    const headers = new Headers();
    const origin = request.headers.get("origin");
    if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Vary", "Origin");
        headers.set("Access-Control-Expose-Headers", "Retry-After, ETag");
    }
    return headers;
}

export function json(request: Request, body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
    const headers = corsHeaders(request);
    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", "no-store");
    for (const [name, value] of Object.entries(init.headers ?? {})) headers.set(name, value);
    return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

// One error shape everywhere (contract §3.1). detail never carries keys, tokens or provider text.
export function fail(request: Request, status: number, error: string, detail: string, headers?: Record<string, string>): Response {
    return json(request, { error, detail }, { status, headers });
}

export function preflight(request: Request, methods: string): Response {
    const headers = corsHeaders(request);
    headers.set("Access-Control-Allow-Methods", `${methods}, OPTIONS`);
    headers.set("Access-Control-Allow-Headers", "X-Scout-Key, X-Scout-Session, X-Scout-Teach-Passcode, Authorization, Content-Type, If-Match");
    headers.set("Access-Control-Max-Age", "600");
    return new Response(null, { status: 204, headers });
}

export async function readJson(
    request: Request,
    maxBytes: number
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxBytes) {
        return { ok: false, response: fail(request, 413, "too_large", `The request body is over ${maxBytes} bytes.`) };
    }
    try {
        return { ok: true, body: JSON.parse(text) as unknown };
    } catch {
        return { ok: false, response: fail(request, 400, "invalid_json", "The request body must be JSON.") };
    }
}

// The caller's IP, for rate limits. Behind a proxy (Railway) it is the first X-Forwarded-For hop.
export function clientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
