// Create a D1 project and print its public key and teach passcode (shown once; only a hash is kept).
// Usage: npm run project:create -- "Aman's app"   (same SCOUT_TOKEN_PEPPER and SCOUT_DATA_DIR as the server)
import { createProject } from "../server/projects.ts";
import { dataDir } from "../server/store/store.ts";

const name = process.argv.slice(2).join(" ");
const { project, passcode } = await createProject(name);
console.log(`Created project "${project.name}" in ${dataDir()}`);
console.log(`  project id:      ${project.id}`);
console.log(`  project key:     ${project.publishableKey}   (public: goes in the app's code)`);
console.log(`  teach passcode:  ${passcode}   (secret: shown once; needed to save workflows)`);
