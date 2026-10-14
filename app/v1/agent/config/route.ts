import { projectFromKey } from "../../../../server/auth.ts";
import { liveWorkflows, publicWorkflow } from "../../../../server/catalog.ts";
import { clientIp, fail, json, preflight } from "../../../../server/http.ts";
import { rateLimit } from "../../../../server/usage/limits.ts";
import { passcodeMatches } from "../../../../server/auth.ts";

// GET /v1/agent/config: what the browser runtime needs to run this project's workflows (contract §3.3).
export async function GET(request: Request) {
    const limited = rateLimit(`config:${clientIp(request)}`, 60, 60_000);
    if (!limited.ok) return fail(request, 429, "rate_limited", "Too many requests.", { "Retry-After": String(limited.retryAfterS) });

    const project = await projectFromKey(request);
    if (!project) return fail(request, 401, "invalid_credentials", "Unknown or missing project key.");

    const maxVersion = Number(new URL(request.url).searchParams.get("maxWorkflowVersion") ?? "3");
    const teach = passcodeMatches(project, request.headers.get("x-scout-teach-passcode"));
    const stored = await liveWorkflows(project.id, teach);
    const runnable = stored.filter((item) => item.workflow.version <= maxVersion);
    const skipped = stored
        .filter((item) => item.workflow.version > maxVersion)
        .map((item) => ({ workflowId: item.workflow.id, reason: "needs_newer_agent" }));

    return json(request, {
        projectId: project.id,
        configVersion: project.configVersion,
        experience: {
            id: "exp_default", slug: "default", kind: "in_product", language: "auto",
            appearance: { position: "bottom-right", accentColor: "#2563eb", launcherLabel: "Ask Scout" },
        },
        workflows: runnable.map((item) => ({ ...publicWorkflow(item.workflow), status: item.status })),
        skipped,
        limits: { message: 1000, history: 8 },
        features: { voice: true, teach: true },
    });
}

export function OPTIONS(request: Request) {
    return preflight(request, "GET");
}
