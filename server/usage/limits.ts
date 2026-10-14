// D1 protection (contract §2.5; CLOUD_DESIGN §6.2): in-memory rate limits and one hard monthly cost cap.
import { readUsage, writeUsage } from "../store/store.ts";

type Window = { start: number; count: number };
const windows = new Map<string, Window>();

// Fixed-window counter. Enough for one server process; D2 moves counters to the database.
export function rateLimit(bucket: string, limit: number, windowMs: number, now = Date.now()):
    { ok: true } | { ok: false; retryAfterS: number } {
    const current = windows.get(bucket);
    if (!current || now - current.start >= windowMs) {
        windows.set(bucket, { start: now, count: 1 });
        return { ok: true };
    }
    if (current.count >= limit) {
        return { ok: false, retryAfterS: Math.max(1, Math.ceil((current.start + windowMs - now) / 1000)) };
    }
    current.count += 1;
    return { ok: true };
}

export function resetRateLimits() {
    windows.clear();
}

// Decide limits from contract §2.5, applied per IP while D1 has no sessions.
export const DECIDE_LIMITS = [
    { scope: "ip-minute", limit: 20, windowMs: 60_000 },
    { scope: "ip-day", limit: 200, windowMs: 86_400_000 },
] as const;
export const PROJECT_DECIDE_LIMIT = { limit: 1000, windowMs: 3_600_000 };

// Ayush, 14 Oct: $4 a month, under the model key's $5 prepaid balance.
export function monthlyCapUsd(): number {
    const value = Number(process.env.SCOUT_GLOBAL_MONTHLY_BUDGET_USD ?? "4");
    return Number.isFinite(value) && value >= 0 ? value : 4;
}

export const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7);

export function secondsUntilNextMonth(now = new Date()): number {
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export async function capReached(): Promise<boolean> {
    return (await readUsage(currentMonth())).costUsd >= monthlyCapUsd();
}

// Writes are serialised in-process so two decisions can't lose each other's cost.
let queue: Promise<void> = Promise.resolve();
export function recordSpend(costUsd: number): Promise<void> {
    queue = queue.then(async () => {
        const usage = await readUsage(currentMonth());
        await writeUsage({ ...usage, costUsd: usage.costUsd + costUsd, decisions: usage.decisions + 1 });
    }).catch((error: unknown) => {
        console.error("[scout] could not record model spend", error);
    });
    return queue;
}
