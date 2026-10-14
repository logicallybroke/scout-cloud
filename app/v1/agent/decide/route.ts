import { readScoutRequest } from "@scout/core";
import { passcodeMatches, projectFromKey } from "../../../../server/auth.ts";
import { catalogFor, liveWorkflows } from "../../../../server/catalog.ts";
import { decide } from "../../../../server/decision/decide.ts";
import { clientIp, fail, isRecord, json, preflight, readJson } from "../../../../server/http.ts";
import { costUsd, describeModelError } from "../../../../server/model/model.ts";
import { getFacts } from "../../../../server/store/store.ts";
import {
    capReached, DECIDE_LIMITS, PROJECT_DECIDE_LIMIT, rateLimit, recordSpend, secondsUntilNextMonth,
} from "../../../../server/usage/limits.ts";

// POST /v1/agent/decide: a visitor message in, one checked decision out (contract §5).
// The server owns the catalog and facts; the model only chooses; the browser runs and verifies.
// D1 has no sessions, so no session token (contract §2.6); history is browser-sent.
export async function POST(request: Request) {
    const project = await projectFromKey(request);
    if (!project) return fail(request, 401, "invalid_credentials", "Unknown or missing project key.");

    const ip = clientIp(request);
    for (const { scope, limit, windowMs } of DECIDE_LIMITS) {
        const limited = rateLimit(`decide:${scope}:${ip}`, limit, windowMs);
        if (!limited.ok) return fail(request, 429, "rate_limited", "Too many messages. Please wait a moment.", { "Retry-After": String(limited.retryAfterS) });
    }
    const projectLimited = rateLimit(`decide:project:${project.id}`, PROJECT_DECIDE_LIMIT.limit, PROJECT_DECIDE_LIMIT.windowMs);
    if (!projectLimited.ok) return fail(request, 429, "rate_limited", "Too many messages for this project.", { "Retry-After": String(projectLimited.retryAfterS) });

    if (await capReached()) {
        return fail(request, 429, "budget_exhausted", "Scout is unavailable right now.", { "Retry-After": String(secondsUntilNextMonth()) });
    }

    const body = await readJson(request, 32 * 1024);
    if (!body.ok) return body.response;
    if (!isRecord(body.body)) return fail(request, 400, "invalid_request", "The body must be a JSON object.");
    const requestId = typeof body.body.requestId === "string" ? body.body.requestId.slice(0, 64) : null;

    const teach = passcodeMatches(project, request.headers.get("x-scout-teach-passcode"));
    const workflows = (await liveWorkflows(project.id, teach)).map((item) => item.workflow);
    const parsed = readScoutRequest({
        message: body.body.message,
        history: body.body.history ?? [],
        workflows: catalogFor(workflows),
        facts: await getFacts(project.id),
    });
    if (!parsed.ok) return fail(request, 400, "invalid_request", parsed.error);

    try {
        const result = await decide(parsed.request);
        await recordSpend(costUsd(result.usage));
        if (!result.ok) {
            console.error(`[scout] unusable decision: ${result.error}`);
            return fail(request, 502, "model_error", "I got a reply I couldn't use. Please try rephrasing.");
        }
        return json(request, { requestId, configVersion: project.configVersion, decision: result.decision, modelMs: result.modelMs });
    } catch (error) {
        const described = describeModelError(error);
        return fail(request, described.status, described.error, described.detail,
            described.retryAfterS ? { "Retry-After": String(described.retryAfterS) } : undefined);
    }
}

export function OPTIONS(request: Request) {
    return preflight(request, "POST");
}
