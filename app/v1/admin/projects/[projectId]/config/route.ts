import { projectForTeach } from "../../../../../../server/auth.ts";
import { fail, json, preflight } from "../../../../../../server/http.ts";
import { getFacts, listWorkflows } from "../../../../../../server/store/store.ts";

// GET /v1/admin/projects/{projectId}/config: every workflow with its status and example
// values (needed to validate), plus facts. Teach passcode required (contract §2.6, §3.4).
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const auth = await projectForTeach(request, projectId);
    if (!auth.ok) return fail(request, auth.status, auth.error, auth.detail);
    return json(request, {
        projectId,
        configVersion: auth.project.configVersion,
        workflows: (await listWorkflows(projectId)).map((item) => ({ ...item.workflow, status: item.status, validation: item.validation ?? null })),
        facts: await getFacts(projectId),
    });
}

export function OPTIONS(request: Request) {
    return preflight(request, "GET");
}
