// What a project offers: its workflows, as the browser runs them and as the model sees them.
import { LIMITS, MAX_WORKFLOW_VERSION, toCatalogEntry, type CatalogEntry, type Workflow } from "@scout/core";
import { listWorkflows, type StoredWorkflow } from "./store/store.ts";

// Visitors get published workflows; a teach session (valid passcode) also gets drafts.
export async function liveWorkflows(projectId: string, includeDrafts: boolean): Promise<StoredWorkflow[]> {
    const all = await listWorkflows(projectId);
    return all.filter((item) => includeDrafts || item.status === "published");
}

// Recorded example values can be real data the admin typed; they never reach visitors (contract §3.3).
export const publicWorkflow = (workflow: Workflow): Workflow => ({
    ...workflow,
    inputs: workflow.inputs.map(({ example: _example, ...input }) => input),
});

export function catalogFor(workflows: Workflow[]): CatalogEntry[] {
    return workflows.filter((workflow) => workflow.version <= MAX_WORKFLOW_VERSION).slice(0, LIMITS.workflows).map(toCatalogEntry);
}
