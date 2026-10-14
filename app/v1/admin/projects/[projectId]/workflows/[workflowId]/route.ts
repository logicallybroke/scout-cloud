import { isWorkflow } from "@scout/core";
import { projectForTeach } from "../../../../../../../server/auth.ts";
import { fail, isRecord, json, preflight, readJson } from "../../../../../../../server/http.ts";
import { bumpConfigVersion, deleteWorkflow, getWorkflow, saveWorkflow } from "../../../../../../../server/store/store.ts";

type Context = { params: Promise<{ projectId: string; workflowId: string }> };

export async function GET(request: Request, { params }: Context) {
    const { projectId, workflowId } = await params;
    const auth = await projectForTeach(request, projectId);
    if (!auth.ok) return fail(request, auth.status, auth.error, auth.detail);
    const stored = await getWorkflow(projectId, workflowId);
    if (!stored) return fail(request, 404, "not_found", "No such workflow.");
    return json(request, { ...stored.workflow, status: stored.status, validation: stored.validation ?? null });
}

// PUT: replace a workflow after an edit. It goes back to draft until validated again.
export async function PUT(request: Request, { params }: Context) {
    const { projectId, workflowId } = await params;
    const auth = await projectForTeach(request, projectId);
    if (!auth.ok) return fail(request, auth.status, auth.error, auth.detail);
    const existing = await getWorkflow(projectId, workflowId);
    if (!existing) return fail(request, 404, "not_found", "No such workflow.");

    const body = await readJson(request, 64 * 1024);
    if (!body.ok) return body.response;
    const workflow = isRecord(body.body) ? body.body.workflow : undefined;
    if (!isWorkflow(workflow) || workflow.id !== workflowId) return fail(request, 422, "validation_failed", "That workflow is not valid.");

    await saveWorkflow(projectId, { workflow, status: "draft", updatedAt: new Date().toISOString() });
    if (existing.status === "published") await bumpConfigVersion(projectId);
    return json(request, { workflow, status: "draft" });
}

export async function DELETE(request: Request, { params }: Context) {
    const { projectId, workflowId } = await params;
    const auth = await projectForTeach(request, projectId);
    if (!auth.ok) return fail(request, auth.status, auth.error, auth.detail);
    const existing = await getWorkflow(projectId, workflowId);
    if (!existing || !(await deleteWorkflow(projectId, workflowId))) return fail(request, 404, "not_found", "No such workflow.");
    if (existing.status === "published") await bumpConfigVersion(projectId);
    return json(request, { deleted: workflowId });
}

export function OPTIONS(request: Request) {
    return preflight(request, "GET, PUT, DELETE");
}
