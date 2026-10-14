// Creating a D1 project: a public key and a teach passcode. Only the passcode's hash is kept.
import { hashPasscode, newPasscode, newProjectId, newPublishableKey } from "./auth.ts";
import { saveFacts, saveProject, type ProjectRecord } from "./store/store.ts";

export async function createProject(name: string): Promise<{ project: ProjectRecord; passcode: string }> {
    const passcode = newPasscode();
    const project: ProjectRecord = {
        id: newProjectId(),
        name: name.trim().slice(0, 100) || "Untitled project",
        publishableKey: newPublishableKey(),
        teachPasscodeHash: hashPasscode(passcode),
        configVersion: 1,
        createdAt: new Date().toISOString(),
    };
    await saveProject(project);
    await saveFacts(project.id, []);
    return { project, passcode };
}
