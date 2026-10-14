import { timingSafeEqual } from "node:crypto";
import { readJson, isRecord } from "../../../../server/http.ts";
import { createProject } from "../../../../server/projects.ts";

// POST /v1/operator/projects: create a project on the hosted D1 cloud, where the data volume is.
// Operator-only, server-to-server (no CORS), and switched off unless SCOUT_OPERATOR_SECRET is set.
// Not part of the client contract; D2's console replaces it.
export async function POST(request: Request) {
    const secret = process.env.SCOUT_OPERATOR_SECRET;
    if (!secret || secret.length < 24) return new Response("Not found", { status: 404 });
    const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const a = Buffer.from(given);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return Response.json({ error: "invalid_credentials", detail: "Wrong operator secret." }, { status: 401 });
    }
    const body = await readJson(request, 4096);
    if (!body.ok) return body.response;
    const name = isRecord(body.body) && typeof body.body.name === "string" ? body.body.name : "";
    const { project, passcode } = await createProject(name);
    // The passcode is returned once, to the operator; only its hash is stored.
    return Response.json({ projectId: project.id, projectKey: project.publishableKey, teachPasscode: passcode }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
