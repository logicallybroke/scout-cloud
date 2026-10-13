# Origin: what `scout-cloud` takes from `scout-demo`

**Status: PROPOSED, for Ayush's review (13 October 2026). Nothing has been imported yet.** Update the "Imported in" line below when the import commit exists.

`scout-cloud` starts from the frozen prototype `scout-demo` at commit **`aafd6a2`** (`~/codes/scout-agent/scout-demo`, private `https://github.com/logicallybroke/scout-demo`, branch `prototype`). This file maps **every** tracked file in that commit to its planned place in this repo. Most of the prototype is browser code and goes to `scout-js` instead (see `scout-js/docs/ORIGIN.md`). Background on why each piece exists is in `docs/BACKGROUND.md`; shared names are in `docs/API_CONTRACT.md`.

- **Imported in:** not yet (no commit).

## Provenance rule

In plain language: we copy, we never move, and we can always prove where a file came from.

1. **Copy, never move.** `scout-demo` stays exactly as it is at `aafd6a2`. Nothing is deleted or edited there.
2. **One import commit, verbatim.** Files marked *Copy as-is* or *Copy, then adapt* are first copied **byte for byte** into their destination in one commit, with no edits. Its message names the source, for example:

   ```
   chore: import prototype model client from scout-demo@aafd6a2

   Copied verbatim from scout-demo@aafd6a2:
     lib/scout/server/model.ts -> server/model/model.ts
     ...
   ```

3. **Adaptations come after, in their own reviewed commits,** so `git diff` shows exactly what changed from the prototype and why.
   - **Every commit must build** (AGENTS.md, Git; BACKGROUND §2.11: `c7ed7e4` imported a component that didn't exist yet, and `a8d2caa` didn't compile). Some files here don't build verbatim at their new paths, because they import prototype paths that don't exist in this repo (core comes from `@scout/core`, and `model.ts` moves to `server/model/model.ts`):
     - `lib/scout/server/decide.ts` imports `@/lib/scout/core/contracts`, `@/lib/scout/core/decision` and `./model`.
     - `app/api/scout/check/route.ts` imports `@/lib/scout/server/model`.
   - So each of those verbatim imports is reviewed together with the adaptation that makes it build, and the two are committed as a pair, back to back (verbatim import, then adaptation), or only once the adaptation is ready. The byte-for-byte check (rule 5) runs on the import commit only. `model.ts` (imports only `openai`) builds where it lands. `facts.ts` and `workflows.ts` are not copied: they become JSON seed data, so they are *Rewrite* (below).
4. **Rewrites are not copied.** For files marked *Rewrite*, the new code is written fresh with the old file open as a reference. The commit message names the reference file and `aafd6a2`.
5. **Check a verbatim copy** before committing it:

   ```
   git -C ../scout-demo show aafd6a2:lib/scout/server/model.ts | diff - server/model/model.ts
   ```

6. **No headers inside copied files** in the import commit (they would break the byte-for-byte check). This table and the commit message are the provenance record.
7. **Shared code: imported, not copied (PROPOSED, pending Ayush).** `readScoutRequest`, `readDecision`, `resolveWorkflow`, `declareInputs` and the workflow shape check would live once, in `@scout/core` in `scout-js`, and this repo would import them, as the prototype shared one `decision.ts` between server and browser. The rows marked *Import from `@scout/core`* below assume this. PROPOSED method (`CLOUD_DESIGN.md` §10.2): a `file:../scout-js/packages/core` link during development, then a pinned registry version. Pending Ayush's approval.
8. Committing needs Ayush's explicit "commit", as always.

## Treatments

| Treatment | Meaning |
|---|---|
| **Copy as-is** | Copied verbatim and expected to stay essentially unchanged |
| **Copy, then adapt** | Copied verbatim in the import commit, then changed in later reviewed commits for the reasons given |
| **Rewrite** | Not copied. Written fresh using the old file as a reference |
| **Import from `@scout/core`** | Not copied here. Used through the shared package |
| **Not carried** | Doesn't come to this repo. Where it goes instead is named |

## Planned layout (PROPOSED)

The authoritative tree is `CLOUD_DESIGN.md` §10.1 (option 3: one Next.js app now, with framework-free `server/` modules, and a separate runner for Release B). It is not repeated here, so the two can't drift. The destinations this file uses all sit in that tree: `app/v1/{agent,admin,client}/`, `app/(console)/`, `app/dev/model-check/`, `app/d/[slug]/`, `server/model/`, `server/decision/` and `server/db/seed/`.

The stack and database are still pending approval, so these paths are **provisional**: if the stack changes, §10.1 and this file's destinations change together before anything is imported.

## File map

### Server (`lib/scout/server/`), the main import

| `scout-demo@aafd6a2` file | Destination in `scout-cloud` | Treatment | Why |
|---|---|---|---|
| `lib/scout/server/model.ts` | `server/model/model.ts` | Copy, then adapt | Keeps the rule that one module chooses the model (`SCOUT_MODEL = "gpt-6-luna"`, `DECISION_EFFORT = "low"`, lazy single `OpenAI` client) and is the only importer of the `openai` SDK, plus `describeModelError`. The prototype mapping was: auth 500, model not found 500, rate limit 429, connection 502, other API error 502, anything else 500. Adapt: add a real server-only guard (the prototype relied on convention); reword errors that mention `.env.local` and `npm run dev`; read configuration from the deployment environment; **map provider errors to the contract codes in `CLOUD_DESIGN.md` §3.6** (provider rate limit or no credit → `503 unavailable` with `Retry-After`; auth, missing model, connection → `502 model_error`), with `429` reserved for Scout's own `rate_limited` and `budget_exhausted`, and the real cause logged, never returned in `detail` |
| `lib/scout/server/decide.ts` | `server/decision/decide.ts` | Copy, then adapt | The strict schema `scout_decision`, `buildInstructions` (rules, FACTS, WORKFLOWS JSON; never invent workflows, inputs, steps, URLs or facts; a run message is one intent sentence, never "done"), `max_output_tokens: 400`, history mapped visitor→user and scout→assistant, timing with `performance.now()` and the pairs-to-record conversion carry over unchanged. Adapt: catalog and facts come from the session's pinned config snapshot, not from the browser; tell the model `allowedValues`; record model time, tokens and cost per decision for budgets |

### Routes (`app/`)

| `scout-demo@aafd6a2` file | Destination in `scout-cloud` | Treatment | Why |
|---|---|---|---|
| `app/api/scout/route.ts` | `app/v1/agent/decide/route.ts` (`POST /v1/agent/decide`) | Rewrite | Same flow (parse JSON, check the request, decide). The prototype returned 400 for non-JSON, 400 for a `readScoutRequest` failure, 502 for a decide failure, and sent thrown SDK errors through `describeModelError` (auth or model not found 500, rate limit 429, connection or API 502). The response becomes `{ requestId, configVersion, decision, modelMs }` or the `{ error, detail }` shape (`API_CONTRACT.md` §3.1, §5.1), with provider errors mapped as in the `model.ts` row. It now also needs the publishable key, an allowed `Origin`, a session token, rate limits and cost budgets (`API_CONTRACT.md` §2–§3). The prototype route was unprotected and paid |
| `app/api/scout/check/route.ts` | `app/dev/model-check/route.ts` (console app, development only; `CLOUD_DESIGN.md` §3.5) | Copy, then adapt | Still useful to verify the key, model availability and one tiny call's latency. Must stay unavailable in production (it returned 404 there) |
| `app/configure/page.tsx` | `app/(console)/` | Rewrite | The admin surface becomes the console, with real sign-in (Clerk or Google OAuth, pending). Modes were never authentication |
| `app/demo/page.tsx` | `app/d/[slug]/` (Release B) | Rewrite | Reference for the visitor surface of hosted demos. In Release A the visitor surface is the `<scout-agent>` widget in `scout-js` |
| `app/dashboard/page.tsx` | — | Not carried | Goes to `scout-js/examples/dashboard` |
| `app/page.tsx` | — | Not carried | Goes to `scout-js/examples/dashboard` |
| `app/layout.tsx`, `app/globals.css`, `app/favicon.ico` | Console app shell, if the stack is Next.js | Copy, then adapt (only if Next.js is chosen) | Root layout, Tailwind import and icon. Adapt: replace the Create Next App boilerplate metadata (`title: "Create Next App"`, `description: "Generated by create next app"`) with the console's own; and in `globals.css` make the body font use the loaded Geist variables (it is still `font-family: Arial, Helvetica, sans-serif`), or drop the unused Geist fonts. Otherwise not carried here (they go to `scout-js/examples/dashboard`) |

### Core (`lib/scout/core/`)

| `scout-demo@aafd6a2` file | Destination in `scout-cloud` | Treatment | Why |
|---|---|---|---|
| `lib/scout/core/decision.ts` | — | Import from `@scout/core` | The server runs `readScoutRequest` and `readDecision`; the browser runs `readDecision` again. One copy keeps both sides identical. Known gaps to close in `@scout/core` (coordinate with scout-js): `readCatalogEntry` rebuilds each input as `{ name, label }` and would drop `inputs[].allowedValues`, so it must be extended to keep and validate them (`API_CONTRACT.md` §5.1); duplicate catalog ids and input-name syntax aren't checked; input value lengths aren't limited; one oversized history turn rejects the whole request. `readDecision` drops undeclared inputs while `resolveWorkflow` rejects them; that difference is deliberate |
| `lib/scout/core/contracts.ts` | — | Import from `@scout/core` | Shared types (`ScoutRequest`, `ScoutDecision`, `CatalogEntry`, `Workflow` (named `WorkflowDefinition` in the contract), …) |
| `lib/scout/core/inputs.ts` | — | Import from `@scout/core` | Console review and save-time checks use `isInputName` and `resolveWorkflow` |
| `lib/scout/core/recorder.ts` | — | Import from `@scout/core` | The console's review step turns a recording into a workflow with `declareInputs` |
| `lib/scout/core/workflow-store.ts` | — | Import from `@scout/core` (shape check) | Workflow JSON is untrusted when saved on the server, as it was when loaded from storage. The `localStorage` part is replaced by the database |
| `lib/scout/core/dispatcher.ts` | — | Not carried | Browser execution; goes to `@scout/core` in `scout-js` |
| `lib/scout/core/wait-for-condition.ts` | — | Not carried | Browser verification; goes to `@scout/core` |
| `lib/scout/core/runner.ts` | — | Not carried | Browser execution. In Release B the runner still runs inside the page (the injected `@scout/agent`), not in this server |
| `lib/scout/core/core.test.mjs` | — | Not carried | Tests the shared core in `scout-js`. This repo gets its own tests for keys, origins, limits and endpoints. Same tooling lesson: Node 22.18+ strips types, so modules loaded by `node --test` must use `import type` for type-only imports, and their relative value imports need explicit extensions (or a runner that resolves them) and no `@/` alias (`CLOUD_DESIGN.md` §10.5) |

### Binding (`lib/scout/bindings/dashboard/`)

| `scout-demo@aafd6a2` file | Destination in `scout-cloud` | Treatment | Why |
|---|---|---|---|
| `lib/scout/bindings/dashboard/facts.ts` | `server/db/seed/sandbox/facts.json` | Rewrite | The nine facts become seed data (JSON, not TypeScript) for a fictional "Scout Sandbox" project, so decisions can be tested against known facts. Facts are project data in the cloud, not code. A verbatim `.ts` copy can't be JSON, so the seed file is written fresh with the old file as the reference, keeping the fact texts word for word |
| `lib/scout/bindings/dashboard/workflows.ts` | `server/db/seed/sandbox/workflows.json` | Rewrite | `invite-teammate` and `find-customer` become seed workflow revisions (JSON data, not TypeScript) for decision tests and the console. Written fresh with the old file as the reference, keeping ids, inputs, steps, narration and outcomes unchanged |
| `lib/scout/bindings/dashboard/actions.ts` | — | Not carried | Browser binding; goes to `scout-js/examples/dashboard` |
| `lib/scout/bindings/dashboard/verifiers.ts` | — | Not carried | Same |
| `lib/scout/bindings/dashboard/presentation.ts` | — | Not carried | Same |

### React runtime and browser (`lib/scout/react/`, `lib/scout/browser/`)

| `scout-demo@aafd6a2` file | Destination in `scout-cloud` | Treatment | Why |
|---|---|---|---|
| `lib/scout/react/ScoutPanel.tsx` | `app/(console)/` (review form) | Rewrite | The `ReviewForm` (title, purpose, examples, kept steps, narration per step, closing line, values to turn into inputs) is the reference for the console's review screen. Teach controls themselves go to `@scout/agent` |
| `lib/scout/react/ScoutProvider.tsx` | — | Not carried | Session controller; goes to `scout-js` (`@scout/agent`, `@scout/react`). Its `validate()` rule (enable only after a full replay) becomes the cloud's revision status rule: `testing` only after a passed validation run |
| `lib/scout/react/ScoutChat.tsx` | — | Not carried | Goes to the `<scout-agent>` widget in `scout-js` |
| `lib/scout/react/ScoutSpotlight.tsx` | — | Not carried | Goes to `@scout/agent` |
| `lib/scout/browser/speech.ts` | — | Not carried | Browser speech; goes to `@scout/agent`. Cloud speech services, if adopted later, would need new server code here |

### Product (`components/dashboard/`)

| `scout-demo@aafd6a2` file | Destination in `scout-cloud` | Treatment | Why |
|---|---|---|---|
| `components/dashboard/ProductDashboard.tsx` | — | Not carried | Product code; goes to `scout-js/examples/dashboard`. In Release B a cloud browser could open that example app as a test target |
| `components/dashboard/types.ts` | — | Not carried | Same |
| `components/dashboard/customers.ts` | — | Not carried | Same |

### Repository files and docs

| `scout-demo@aafd6a2` file | Destination in `scout-cloud` | Treatment | Why |
|---|---|---|---|
| `.gitignore` | `.gitignore` | Rewrite (written 13 Oct with scout-demo's `.gitignore` as reference) | Keeps `node_modules`, `*.tsbuildinfo` and ignored env files (now `.env` and `.env.*`, except `.env.example`); adds database files, build output and hosted-runner artifacts. Not part of the verbatim import |
| `package.json` | `package.json` | Rewrite | Depends on the stack and database decisions. Keeps `openai` (server side only) and adds `@scout/core` |
| `package-lock.json` | — | Not carried | Regenerated by the first approved `npm install` |
| `tsconfig.json` | `tsconfig.json` | Copy, then adapt (if Next.js) or Rewrite | Add `verbatimModuleSyntax`, `erasableSyntaxOnly` and a real `tsc --noEmit` script (BACKGROUND §2.13). Also (`CLOUD_DESIGN.md` §10.5): explicit `.ts` extensions with `allowImportingTsExtensions`, or a test runner that resolves extensionless paths; no `@/` alias in modules that tests load (plain Node doesn't resolve it), or an alias mapping in the runner; tests written as `.ts` or added to `include` (the prototype's `include` didn't cover the `.mjs` test file); `@types/node` pinned to 22 to match Node v22.23.2 (the prototype had `^20`) |
| `eslint.config.mjs` | `eslint.config.mjs` | Copy, then adapt (if Next.js) or Rewrite | Keep ESLint 9 flat config |
| `next.config.ts` | `next.config.ts` | Copy as-is (only if Next.js is chosen) | Empty config |
| `postcss.config.mjs` | `postcss.config.mjs` | Copy as-is (only if the console uses Tailwind) | Tailwind v4 plugin |
| `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg` | — | Not carried | Unused Create Next App assets |
| `README.md` | — | Not carried | Create Next App boilerplate |
| `AGENTS.md` | — | Not carried | A new `AGENTS.md` carries the working agreements forward. If this repo uses Next.js, `next dev` will add its own agent block; commit it |
| `CLAUDE.md` | — | Not carried | A new `CLAUDE.md` describes this repo |
| `SCOUT_CONTEXT.md` | — | Not carried | A new status file. History is summarised in `docs/BACKGROUND.md` |
| `docs/SCOUT_HLD.md`, `docs/SCOUT_LLD.md` | — | Not carried | Superseded by `docs/BACKGROUND.md`, `docs/API_CONTRACT.md` and the cloud design. Their drift is listed in BACKGROUND §2.12 |

## Count check

`git -C ../scout-demo ls-tree -r --name-only aafd6a2` lists 51 files. All 51 appear above (some rows group several files).
