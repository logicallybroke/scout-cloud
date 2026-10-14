// D1 store: JSON files under SCOUT_DATA_DIR (a persistent volume in production). No database.
// Everything read back is shape-checked: stored data is untrusted.
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readWorkflow, type Workflow } from "@scout/core";

export type ProjectRecord = {
    id: string;
    name: string;
    publishableKey: string;
    teachPasscodeHash: string;
    // Increases with each publish, unpublish or facts change (contract §6.3, simplified for D1).
    configVersion: number;
    createdAt: string;
};

export type WorkflowStatus = "draft" | "published";

export type StoredWorkflow = {
    workflow: Workflow;
    // D1: a workflow is published by a passed validation run (the prototype's Validate-to-enable rule).
    status: WorkflowStatus;
    updatedAt: string;
    validation?: { result: "passed" | "failed"; at: string; agentVersion?: string; origin?: string; error?: string };
};

const PROJECT_ID = /^prj_[a-z0-9]{6,32}$/;
const WORKFLOW_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;

export const isProjectId = (value: string) => PROJECT_ID.test(value);
export const isWorkflowId = (value: string) => WORKFLOW_ID.test(value);

// Read at call time, so tests can point it at a temporary folder.
export const dataDir = () => process.env.SCOUT_DATA_DIR ?? join(process.cwd(), "data");
const projectDir = (projectId: string) => {
    // The id becomes a path: only safe ids, so nothing can escape the data folder.
    if (!isProjectId(projectId)) throw new Error("Invalid project id.");
    return join(dataDir(), "projects", projectId);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

async function readJsonFile(path: string): Promise<unknown> {
    try {
        return JSON.parse(await readFile(path, "utf8")) as unknown;
    } catch {
        return undefined;
    }
}

// Write a temporary file, then rename it over the old one, so a crash never leaves half a file.
async function writeJsonFile(path: string, value: unknown): Promise<void> {
    const dir = path.slice(0, path.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, path);
}

function readProject(value: unknown): ProjectRecord | null {
    return isRecord(value) &&
        typeof value.id === "string" && isProjectId(value.id) &&
        typeof value.name === "string" &&
        typeof value.publishableKey === "string" &&
        typeof value.teachPasscodeHash === "string" &&
        typeof value.configVersion === "number" &&
        typeof value.createdAt === "string"
        ? (value as ProjectRecord)
        : null;
}

export async function listProjects(): Promise<ProjectRecord[]> {
    let ids: string[];
    try {
        ids = await readdir(join(dataDir(), "projects"));
    } catch {
        return [];
    }
    const projects = await Promise.all(ids.filter(isProjectId).map((id) => getProject(id)));
    return projects.filter((project): project is ProjectRecord => project !== null);
}

export async function getProject(projectId: string): Promise<ProjectRecord | null> {
    if (!isProjectId(projectId)) return null;
    return readProject(await readJsonFile(join(projectDir(projectId), "project.json")));
}

export async function findProjectByKey(key: string): Promise<ProjectRecord | null> {
    return (await listProjects()).find((project) => project.publishableKey === key) ?? null;
}

export async function saveProject(project: ProjectRecord): Promise<void> {
    await writeJsonFile(join(projectDir(project.id), "project.json"), project);
}

export async function bumpConfigVersion(projectId: string): Promise<number> {
    const project = await getProject(projectId);
    if (!project) throw new Error("Unknown project.");
    project.configVersion += 1;
    await saveProject(project);
    return project.configVersion;
}

function readStoredWorkflow(value: unknown): StoredWorkflow | null {
    if (!isRecord(value) || (value.status !== "draft" && value.status !== "published") || typeof value.updatedAt !== "string") {
        return null;
    }
    const workflow = readWorkflow(value.workflow);
    if (!workflow) return null;
    return {
        workflow,
        status: value.status,
        updatedAt: value.updatedAt,
        validation: isRecord(value.validation) ? (value.validation as StoredWorkflow["validation"]) : undefined,
    };
}

export async function listWorkflows(projectId: string): Promise<StoredWorkflow[]> {
    let files: string[];
    try {
        files = await readdir(join(projectDir(projectId), "workflows"));
    } catch {
        return [];
    }
    const stored = await Promise.all(
        files.filter((file) => file.endsWith(".json")).map((file) => readJsonFile(join(projectDir(projectId), "workflows", file)))
    );
    return stored
        .map(readStoredWorkflow)
        .filter((item): item is StoredWorkflow => item !== null)
        .sort((a, b) => a.workflow.id.localeCompare(b.workflow.id));
}

export async function getWorkflow(projectId: string, workflowId: string): Promise<StoredWorkflow | null> {
    if (!isWorkflowId(workflowId)) return null;
    return readStoredWorkflow(await readJsonFile(join(projectDir(projectId), "workflows", `${workflowId}.json`)));
}

export async function saveWorkflow(projectId: string, stored: StoredWorkflow): Promise<void> {
    if (!isWorkflowId(stored.workflow.id)) throw new Error("Invalid workflow id.");
    await writeJsonFile(join(projectDir(projectId), "workflows", `${stored.workflow.id}.json`), stored);
}

export async function deleteWorkflow(projectId: string, workflowId: string): Promise<boolean> {
    if (!isWorkflowId(workflowId)) return false;
    const existing = await getWorkflow(projectId, workflowId);
    if (!existing) return false;
    await rm(join(projectDir(projectId), "workflows", `${workflowId}.json`), { force: true });
    return true;
}

export async function getFacts(projectId: string): Promise<string[]> {
    const value = await readJsonFile(join(projectDir(projectId), "facts.json"));
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function saveFacts(projectId: string, facts: string[]): Promise<void> {
    await writeJsonFile(join(projectDir(projectId), "facts.json"), facts);
}

// Month-to-date model spend across all projects, for D1's one hard cap.
export type Usage = { month: string; costUsd: number; decisions: number };

export async function readUsage(month: string): Promise<Usage> {
    const value = await readJsonFile(join(dataDir(), "usage", `${month}.json`));
    return isRecord(value) && typeof value.costUsd === "number" && typeof value.decisions === "number"
        ? { month, costUsd: value.costUsd, decisions: value.decisions }
        : { month, costUsd: 0, decisions: 0 };
}

export async function writeUsage(usage: Usage): Promise<void> {
    await writeJsonFile(join(dataDir(), "usage", `${usage.month}.json`), usage);
}
