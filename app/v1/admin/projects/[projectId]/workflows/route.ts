import { isWorkflow } from "@scout/core";
import { projectForTeach } from "../../../../../../server/auth.ts";
import { fail, isRecord, json, preflight, readJson } from "../../../../../../server/http.ts";
import { getWorkflow, listWorkflows, saveWorkflow } from "../../../../../../server/store/store.ts";

type Context = { params: Promise<{ projectId: string }> };

// GET: list workflows with their status.
export async function GET(request: Request, { params }: Context) {
    const { projectId } = await params;
    const auth = await projectForTeach(request, projectId);
    if (!auth.ok) return fail(request, auth.status, auth.error, auth.detail);
    const workflows = await listWorkflows(projectId);
    return json(request, { workflows: workflows.map((item) => ({ id: item.workflow.id, title: item.workflow.title, status: item.status, updatedAt: item.updatedAt })) });
}

// POST: save a reviewed recording as a new workflow. It starts as a draft; only a passed
// validation run publishes it (the prototype's Validate-to-enable rule).
export async function POST(request: Request, { params }: Context) {
    const { projectId } = await params;
    const auth = await projectForTeach(request, projectId);
    if (!auth.ok) return fail(request, auth.status, auth.error, auth.detail);

    const body = await readJson(request, 64 * 1024);
    if (!body.ok) return body.response;
    const workflow = isRecord(body.body) ? body.body.workflow : undefined;
    // Saved workflow JSON is untrusted: shape, declared inputs and limits are checked here too.
    if (!isWorkflow(workflow)) return fail(request, 422, "validation_failed", "That workflow is not valid.");
    if (await getWorkflow(projectId, workflow.id)) return fail(request, 409, "invalid_state", "A workflow with this id already exists.");

    const now = new Date().toISOString();
    await saveWorkflow(projectId, { workflow, status: "draft", updatedAt: now });
    return json(request, { workflow, status: "draft" }, { status: 201 });
}

export function OPTIONS(request: Request) {
    return preflight(request, "GET, POST");
}
