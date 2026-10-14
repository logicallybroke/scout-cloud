// Create a D1 project and print its public key and teach passcode (shown once; only a hash is kept).
// Usage: npm run project:create -- "Aman's app"
// On Railway: run it once in the service's shell, so it writes to the persistent volume.
import { hashPasscode, newPasscode, newProjectId, newPublishableKey } from "../server/auth.ts";
import { dataDir, saveFacts, saveProject } from "../server/store/store.ts";

const name = process.argv.slice(2).join(" ").trim() || "Untitled project";
const passcode = newPasscode();
const project = {
    id: newProjectId(),
    name,
    publishableKey: newPublishableKey(),
    teachPasscodeHash: hashPasscode(passcode),
    configVersion: 1,
    createdAt: new Date().toISOString(),
};
await saveProject(project);
await saveFacts(project.id, []);

console.log(`Created project "${name}" in ${dataDir()}`);
console.log(`  project id:      ${project.id}`);
console.log(`  project key:     ${project.publishableKey}   (public: goes in the app's code)`);
console.log(`  teach passcode:  ${passcode}   (secret: shown once; needed to save workflows)`);
