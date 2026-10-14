# Origin: what `scout-cloud` takes from `scout-demo`

**Status: PROPOSED, for Ayush's review (13 October 2026; deliverables noted 14 October). Nothing has been imported yet.**

`scout-cloud` starts from the frozen prototype `scout-demo` at commit **`aafd6a2`** (`~/codes/scout-agent/scout-demo`, private `https://github.com/logicallybroke/scout-demo`, branch `prototype`). This file maps **every** tracked file in that commit to its planned place here. Most of the prototype is browser code and goes to `scout-js` (see `scout-js/docs/ORIGIN.md`). Background: `docs/BACKGROUND.md`; shared names: `docs/API_CONTRACT.md`.

- **Imported in:** not yet (no commit). Update this line when the import commit exists.
- **When (PROPOSED, `CLOUD_DESIGN.md` §6, §12):** D1 (minimal cloud) imports `model.ts`, `decide.ts` and the model-check route, rewrites the decide route, and writes the sandbox seed JSON (also D1's starting data). D2 brings the console rewrites; the Next.js app-shell files arrive with C0 (the prototype's stack was chosen 14 Oct). The hosted page reference is Release B.

## Provenance rule

We copy, we never move, and we can always prove where a file came from.

1. **Copy, never move.** `scout-demo` stays exactly as it is at `aafd6a2`.
2. **One import commit, verbatim.** *Copy as-is* and *Copy, then adapt* files are first copied **byte for byte**, with no edits, in one commit whose message names the source:

   ```
   chore: import prototype model client from scout-demo@aafd6a2

   Copied verbatim from scout-demo@aafd6a2:
     lib/scout/server/model.ts -> server/model/model.ts
     ...
   ```

3. **Adaptations come after, in their own reviewed commits,** so `git diff` shows what changed and why. **Every commit must build** (AGENTS.md, Git; BACKGROUND §2.11). Two files don't build verbatim at their new paths, because they import prototype paths that don't exist here: `lib/scout/server/decide.ts` (imports `@/lib/scout/core/contracts`, `@/lib/scout/core/decision`, `./model`) and `app/api/scout/check/route.ts` (imports `@/lib/scout/server/model`). Each is reviewed with the adaptation that makes it build and committed as a back-to-back pair (verbatim import, then adaptation), or only once the adaptation is ready. `model.ts` (imports only `openai`) builds where it lands.
4. **Rewrites are not copied.** *Rewrite* files are written fresh with the old file open; the commit message names the reference file and `aafd6a2`.
5. **Check a verbatim copy** on the import commit: `git -C ../scout-demo show aafd6a2:lib/scout/server/model.ts | diff - server/model/model.ts`
6. **No headers inside copied files** (they would break the byte-for-byte check). This table and the commit message are the record.
7. **Shared code is imported, not copied (PROPOSED, pending Ayush).** `readScoutRequest`, `readDecision`, `resolveWorkflow`, `declareInputs` and the workflow shape check would live once in `@scout/core` (`scout-js`), as the prototype shared one `decision.ts` between server and browser. Rows marked *Import from `@scout/core`* assume this. Method (`CLOUD_DESIGN.md` §10.2): a `file:../scout-js/packages/core` link in development, then a pinned registry version; a deployed D1 already needs the latter or a provenance copy.
8. Committing needs Ayush's explicit "commit".

**Treatments:** *Copy as-is* (verbatim, expected to stay essentially unchanged); *Copy, then adapt* (verbatim in the import commit, changed later for the reasons given); *Rewrite* (not copied; written fresh from the reference); *Import from `@scout/core`* (used through the shared package); *Not carried* (where it goes instead is named).

## Planned layout

The authoritative tree is `CLOUD_DESIGN.md` §10.1 (option 3: one Next.js app with framework-free `server/` modules; a separate runner for Release B), not repeated here. Destinations used below: `app/v1/{agent,admin,client}/`, `app/(console)/`, `app/dev/model-check/`, `app/d/[slug]/`, `server/model/`, `server/decision/`, `server/db/seed/`. The stack is decided (the prototype's Next.js stack, 14 Oct); if the layout changes, §10.1 and this file change together before anything is imported.

## File map

### Server and routes

| `scout-demo@aafd6a2` file | Destination | Treatment | Why |
|---|---|---|---|
| `lib/scout/server/model.ts` | `server/model/model.ts` (D1) | Copy, then adapt | One module chooses the model (`SCOUT_MODEL = "gpt-6-luna"`, `DECISION_EFFORT = "low"`, lazy single `OpenAI` client), is the only `openai` importer, and has `describeModelError`. Prototype mapping: auth 500, model not found 500, rate limit 429, connection 502, other API error 502, else 500. Adapt: a real server-only guard; reword errors that mention `.env.local` and `npm run dev`; read config from the deployment environment; **map provider errors to `CLOUD_DESIGN.md` §3.6** (rate limit or no credit → `503 unavailable` with `Retry-After`; auth, missing model, connection → `502 model_error`; `429` only for Scout's own limits), real cause logged, never in `detail` |
| `lib/scout/server/decide.ts` | `server/decision/decide.ts` (D1) | Copy, then adapt | Unchanged: strict schema `scout_decision`, `buildInstructions` (rules, FACTS, WORKFLOWS JSON; never invent workflows, inputs, steps, URLs or facts; a run message is one intent sentence, never "done"), `max_output_tokens: 400`, history visitor→user and scout→assistant, `performance.now()` timing, pairs-to-record conversion. Adapt: catalog and facts from the server (D1 JSON store, then D2's pinned snapshot), not the browser; tell the model `allowedValues`; record model time, tokens and cost for the cap and budgets |
| `app/api/scout/route.ts` | `app/v1/agent/decide/route.ts` (D1) | Rewrite | Same flow (parse JSON, check, decide). Prototype: 400 for non-JSON or a `readScoutRequest` failure, 502 for a decide failure, thrown SDK errors through `describeModelError`. Now `{ requestId, configVersion, decision, modelMs }` or `{ error, detail }` (`API_CONTRACT.md` §3.1, §5.1), provider errors mapped as in the `model.ts` row, plus key, rate limit and cost cap (D1), then `Origin`, session token and per-project budgets (D2). The prototype route was unprotected and paid |
| `app/api/scout/check/route.ts` | `app/dev/model-check/route.ts` (D1; `CLOUD_DESIGN.md` §3.5) | Copy, then adapt | Verifies the key, model availability and one tiny call's latency. Development only (404 in production, as before) |
| `app/configure/page.tsx` | `app/(console)/` (D2) | Rewrite | Admin surface becomes the console with real sign-in (Clerk or Google OAuth, pending). Modes were never authentication |
| `app/demo/page.tsx` | `app/d/[slug]/` (Release B) | Rewrite | Reference for the hosted visitor page. In Release A the visitor surface is the `<scout-agent>` widget in `scout-js` |
| `app/layout.tsx`, `app/globals.css`, `app/favicon.ico` | Console app shell (only if Next.js) | Copy, then adapt | Replace the Create Next App metadata (`title: "Create Next App"`, `description: "Generated by create next app"`); make the body font use the loaded Geist variables (it is still `font-family: Arial, Helvetica, sans-serif`) or drop the unused fonts. Otherwise not carried (they go to `scout-js/examples/dashboard`) |
| `app/dashboard/page.tsx`, `app/page.tsx` | — | Not carried | Go to `scout-js/examples/dashboard` |

### Core (`lib/scout/core/`)

| `scout-demo@aafd6a2` file | Destination | Treatment | Why |
|---|---|---|---|
| `decision.ts` | — | Import from `@scout/core` | Server runs `readScoutRequest` and `readDecision`; the browser runs `readDecision` again. Known gaps to close in `@scout/core` (with scout-js): `readCatalogEntry` rebuilds inputs as `{ name, label }` and would drop `inputs[].allowedValues`, so it must keep and validate them (`API_CONTRACT.md` §5.1); duplicate catalog ids and input-name syntax aren't checked; input value lengths aren't limited; one oversized history turn rejects the whole request. `readDecision` drops undeclared inputs while `resolveWorkflow` rejects them; that difference is deliberate |
| `contracts.ts` | — | Import from `@scout/core` | Shared types (`ScoutRequest`, `ScoutDecision`, `CatalogEntry`, `Workflow`, named `WorkflowDefinition` in the contract, …) |
| `inputs.ts` | — | Import from `@scout/core` | Save-time checks use `isInputName` and `resolveWorkflow` |
| `recorder.ts` | — | Import from `@scout/core` | Console review turns a recording into a workflow with `declareInputs` |
| `workflow-store.ts` | — | Import from `@scout/core` (shape check) | Workflow JSON is untrusted when saved on the server, as when loaded from storage. `localStorage` is replaced by D1's JSON files, then the database |
| `dispatcher.ts`, `wait-for-condition.ts`, `runner.ts` | — | Not carried | Browser execution and verification; go to `@scout/core` in `scout-js`. In Release B the runner still runs inside the page (injected `@scout/agent`), not on this server |
| `core.test.mjs` | — | Not carried | Tests the shared core in `scout-js`; this repo gets its own tests. Same tooling lesson applies here (`CLOUD_DESIGN.md` §10.5) |

### Binding, React runtime, browser and product code

| `scout-demo@aafd6a2` file | Destination | Treatment | Why |
|---|---|---|---|
| `lib/scout/bindings/dashboard/facts.ts` | `server/db/seed/sandbox/facts.json` (D1) | Rewrite | The nine facts become seed JSON for a fictional "Scout Sandbox" project (and D1's starting data), fact texts kept word for word. A `.ts` file can't be copied as JSON, so it is written fresh |
| `lib/scout/bindings/dashboard/workflows.ts` | `server/db/seed/sandbox/workflows.json` (D1) | Rewrite | `invite-teammate` and `find-customer` become seed workflows, with ids, inputs, steps, narration and outcomes unchanged |
| `lib/scout/bindings/dashboard/actions.ts`, `verifiers.ts`, `presentation.ts` | — | Not carried | Browser binding; goes to `scout-js/examples/dashboard` |
| `lib/scout/react/ScoutPanel.tsx` | `app/(console)/` review form (D2) | Rewrite | Its `ReviewForm` (title, purpose, examples, kept steps, narration per step, closing line, values to turn into inputs) is the reference for the console review screen. Teach controls go to `@scout/agent` |
| `lib/scout/react/ScoutProvider.tsx` | — | Not carried | Goes to `@scout/agent` and `@scout/react`. Its `validate()` rule (enable only after a full replay) becomes the cloud's rule: `testing` only after a passed validation run |
| `lib/scout/react/ScoutChat.tsx`, `ScoutSpotlight.tsx` | — | Not carried | Go to the `<scout-agent>` widget and `@scout/agent` |
| `lib/scout/browser/speech.ts` | — | Not carried | Goes to `@scout/agent`. Cloud speech, if adopted, would be new server code here |
| `components/dashboard/ProductDashboard.tsx`, `types.ts`, `customers.ts` | — | Not carried | Product code; goes to `scout-js/examples/dashboard`, which a Release B cloud browser could open as a test target |

### Repository files and docs

| `scout-demo@aafd6a2` file | Destination | Treatment | Why |
|---|---|---|---|
| `.gitignore` | `.gitignore` | Rewrite (written 13 Oct from scout-demo's) | Keeps `node_modules`, `*.tsbuildinfo`, env files (`.env`, `.env.*` except `.env.example`); adds database files, build output, runner artifacts. Not part of the verbatim import |
| `package.json` | `package.json` | Rewrite | Depends on the stack decision. Keeps `openai` (server only), adds `@scout/core` |
| `package-lock.json` | — | Not carried | Regenerated by the first approved `npm install` |
| `tsconfig.json` | `tsconfig.json` | Copy, then adapt (Next.js) or Rewrite | Add `verbatimModuleSyntax`, `erasableSyntaxOnly`, a `tsc --noEmit` script (BACKGROUND §2.13), and the test-tooling rules (a)–(d) in `CLOUD_DESIGN.md` §10.5 (extensions, no `@/` alias in tested modules, tests type-checked, `@types/node` 22) |
| `eslint.config.mjs` | `eslint.config.mjs` | Copy, then adapt (Next.js) or Rewrite | Keep ESLint 9 flat config |
| `next.config.ts` | `next.config.ts` | Copy as-is (only if Next.js) | Empty config |
| `postcss.config.mjs` | `postcss.config.mjs` | Copy as-is (only if the console uses Tailwind) | Tailwind v4 plugin |
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`; `README.md` | — | Not carried | Create Next App assets and boilerplate |
| `AGENTS.md`, `CLAUDE.md`, `SCOUT_CONTEXT.md` | — | Not carried | New versions written for this repo; history summarised in `docs/BACKGROUND.md`. If Next.js is used, commit the agent block `next dev` adds |
| `docs/SCOUT_HLD.md`, `docs/SCOUT_LLD.md` | — | Not carried | Superseded by BACKGROUND, the contract and the cloud design; their drift is in BACKGROUND §2.12 |

## Count check

`git -C ../scout-demo ls-tree -r --name-only aafd6a2` lists 51 files. All 51 appear above (some rows group several files).
