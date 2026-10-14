import { LIMITS } from "@scout/core";
import { projectForTeach } from "../../../../../../server/auth.ts";
import { fail, isRecord, json, preflight, readJson } from "../../../../../../server/http.ts";
import { bumpConfigVersion, getFacts, saveFacts } from "../../../../../../server/store/store.ts";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, { params }: Context) {
    const { projectId } = await params;
    const auth = await projectForTeach(request, projectId);
    if (!auth.ok) return fail(request, auth.status, auth.error, auth.detail);
    return json(request, { facts: await getFacts(projectId) });
}

// PUT: replace the whole facts list (≤ 40 facts, each ≤ 500 characters). Facts are what Scout
// may say about the product; recording workflows doesn't teach them.
export async function PUT(request: Request, { params }: Context) {
    const { projectId } = await params;
    const auth = await projectForTeach(request, projectId);
    if (!auth.ok) return fail(request, auth.status, auth.error, auth.detail);
    const body = await readJson(request, 32 * 1024);
    if (!body.ok) return body.response;
    const facts = isRecord(body.body) ? body.body.facts : undefined;
    if (!Array.isArray(facts) || facts.length > LIMITS.facts ||
        !facts.every((fact) => typeof fact === "string" && fact.trim() !== "" && fact.length <= LIMITS.text)) {
        return fail(request, 400, "invalid_request", `facts must be up to ${LIMITS.facts} non-empty strings of at most ${LIMITS.text} characters.`);
    }
    await saveFacts(projectId, facts.map((fact: string) => fact.trim()));
    await bumpConfigVersion(projectId);
    return json(request, { facts });
}

export function OPTIONS(request: Request) {
    return preflight(request, "GET, PUT");
}
