import { LIMITS } from "@scout/core";
import { projectForTeach } from "../../../../../../../../server/auth.ts";
import { fail, isRecord, json, preflight, readJson } from "../../../../../../../../server/http.ts";
import { bumpConfigVersion, getWorkflow, listWorkflows, saveWorkflow } from "../../../../../../../../server/store/store.ts";

// POST: the admin's browser reports a validation replay. The cloud records it as admin-reported
// evidence and does not re-check it (contract §3.4). In D1 a pass publishes the workflow.
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string; workflowId: string }> }) {
    const { projectId, workflowId } = await params;
    const auth = await projectForTeach(request, projectId);
    if (!auth.ok) return fail(request, auth.status, auth.error, auth.detail);
    const stored = await getWorkflow(projectId, workflowId);
    if (!stored) return fail(request, 404, "not_found", "No such workflow.");

    const body = await readJson(request, 32 * 1024);
    if (!body.ok) return body.response;
    if (!isRecord(body.body) || (body.body.result !== "passed" && body.body.result !== "failed")) {
        return fail(request, 400, "invalid_request", "result must be \"passed\" or \"failed\".");
    }
    const passed = body.body.result === "passed";

    if (passed && stored.status !== "published") {
        // Keep the model's catalog within its limit, so decide never rejects a request for size.
        const published = (await listWorkflows(projectId)).filter((item) => item.status === "published").length;
        if (published >= LIMITS.workflows) {
            return fail(request, 409, "invalid_state", `A project can have at most ${LIMITS.workflows} published workflows.`);
        }
    }

    const validation = {
        result: passed ? ("passed" as const) : ("failed" as const),
        at: new Date().toISOString(),
        agentVersion: typeof body.body.agentVersion === "string" ? body.body.agentVersion.slice(0, 40) : undefined,
        origin: request.headers.get("origin") ?? undefined,
        error: typeof body.body.error === "string" ? body.body.error.slice(0, 500) : undefined,
    };
    const status = passed ? "published" : stored.status;
    await saveWorkflow(projectId, { ...stored, status, validation, updatedAt: validation.at });
    if (passed && stored.status !== "published") await bumpConfigVersion(projectId);
    return json(request, { revisionStatus: status }, { status: 201 });
}

export function OPTIONS(request: Request) {
    return preflight(request, "POST");
}
