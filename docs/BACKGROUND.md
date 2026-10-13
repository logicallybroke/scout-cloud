# Scout background

**What this file is.** The shared background for Scout, written so that a session started in `scout-js` or `scout-cloud` needs nothing else to understand where Scout came from and why it is shaped the way it is.

- **Snapshot date:** 13 October 2026.
- **Source:** the prototype repository `scout-demo` at commit `aafd6a2` (frozen, so this file will not drift from it), plus the planning conversation of 13 October 2026.
- **Two identical copies:** `scout-js/docs/BACKGROUND.md` and `scout-cloud/docs/BACKGROUND.md`. Change both in the same review, and check with `diff ../scout-js/docs/BACKGROUND.md docs/BACKGROUND.md` before committing either.
- **What it is not.** It is not the status file and not the design. Current progress and verification live in each repo's `SCOUT_CONTEXT.md`. Standing rules live in each repo's `AGENTS.md`. Shared names and data shapes live in `docs/API_CONTRACT.md`. When this file and one of those disagree about the present, the other file wins; this file is history and reasoning.

**Labels used below.**

| Label | Meaning |
|---|---|
| **BUILT** | Exists in `scout-demo@aafd6a2` and was read in source |
| **VERIFIED (who, when)** | A check that someone actually ran, and who ran it |
| **DECIDED (date)** | Ayush made the decision |
| **PROPOSED** | Suggested, not yet approved |
| **PLANNED** | Approved intent, nothing built |
| **INFERENCE** | Our reading of public material; not documented by its owner |

Contents:

1. Scout in one page
2. The prototype (`scout-demo`)
3. Supersonik: the interaction reference, analysed in depth
4. Aman's review (11 Oct) and what followed
5. Ways to integrate Scout into a client's product
6. Tiers, releases and the order of work
7. Model, provider, prompt and voice
8. Environment
9. How we work (summary; `AGENTS.md` is the authority)
10. What's next and what is waiting for approval
11. Glossary

---

## 1. Scout in one page

### 1.1 What Scout is

In plain language: Scout gives **live software demos**. An admin teaches Scout a workflow by doing it once in the product. Later a visitor asks for it, by typing or by speaking. Scout then does the workflow on screen, step by step, explains what it is doing, checks that each step really happened, and answers questions about the product.

```
   TEACH (admin)                 ASK (visitor)                   SHOW (Scout)
 +-----------------+         +--------------------+         +--------------------------+
 | does the task   |         | "add alex as an    |         | picks the taught         |
 | once; reviews   | ------> |  admin" (chat or   | ------> | workflow, fills inputs,  |
 | and saves it    |  saved  |  voice)            |  model  | performs, VERIFIES each  |
 +-----------------+ workflow+--------------------+ decision| step, narrates, answers  |
                                                            +--------------------------+
```

"Teaching" means saving a reviewed workflow as data. It is **not** model training, and it is **not** automatic understanding of arbitrary websites.

### 1.2 Goals and horizons

| Horizon | What it means | State on 13 Oct 2026 |
|---|---|---|
| **Prototype** | One complete loop on a fictional dashboard we own: record a workflow, review and save it, reload it, select it from varied requests, execute and verify it, answer a question, stop or replace a run | **Done** (4–11 Oct 2026). Frozen in `scout-demo@aafd6a2` |
| **Post-prototype** | Turn the prototype into installable SDKs (`scout-js`) and a backend (`scout-cloud`). Rehearse integration: (1) an app we build for the purpose, (2) Argo CD, a real third-party React app | Design phase |
| **Ultimate target** | Scout installs into a client's app **seamlessly**, with **no noticeable performance cost**, and with **no Scout-team work in the client's code** | Not started |

The three integration goals every rehearsal must test:

1. **No Scout work in client code.** The client installs and configures Scout. Our team gets no repo access and makes no custom changes.
2. **No performance cost.** Scout is idle during ordinary use. It works only during a teaching session, a Scout-driven run, or while the visitor talks to it. The concrete rules (scout-demo HLD §8):
   - No polling or DOM observation unless a step is being verified (the prototype polled every 50 ms, only while one check was active, for at most 2 s).
   - Never wrap or delay the product's own handlers; product operations stay synchronous.
   - The Scout bundle loads off the product's critical path. This is a rule, not something the prototype did or measured.
   - Measure before claiming: report latency and overhead only from measured runs.
3. **Same core, different product.** Moving from one product to another changes only per-product data (bindings, facts, workflows, verification targets), never the core.

Later milestones, deliberately out of scope for now: joining Meet or Zoom calls, and automation of arbitrary websites. Remote demo browsers, a later milestone during the prototype, are now Release B (§6). Shared publishing of workflows to other visitors is now Scout Cloud's job.

**Do not promise** zero client code, or automatic understanding of arbitrary sites. A remote browser or an iframe does not control the visitor's own browser.

### 1.3 People

| Person | Role |
|---|---|
| **Ayush** | Builds Scout. Is learning Next.js, React and TypeScript while doing so, so understanding is part of every deliverable. Makes the decisions recorded here. Pushes to GitHub from his own terminal. |
| **Aman** | Reviews the business and integration side (see §4). |
| **The coding agent** (Claude Code) | Writes code and docs in "prototype build mode" and explains them (see §9). |

### 1.4 Supersonik is the interaction reference

[Supersonik](https://supersonik.ai/) is an AI demo agent. It is the reference for **how Scout should feel** (a guided, narrated, voice-capable demo that actually operates the product), **not** an architecture reference. Section 3 analyses what it documents publicly. The short version: Supersonik appears to run demos in its own hosted browser and stream them to the visitor (INFERENCE), so it needs no SDK inside the client's product. Scout's Release B follows that model; Release A (in-product) targets a use case Supersonik does not appear to serve.

---

## 2. The prototype (`scout-demo`)

### 2.1 Facts about the repository

- **Path:** `~/codes/scout-agent/scout-demo`. **Remote:** private `https://github.com/logicallybroke/scout-demo`, branch `prototype` only.
- **Frozen** on 13 Oct 2026 at `aafd6a2` ("docs: freeze scout-demo and point to scout-js and scout-cloud"). It is history and a fallback. No SDK or cloud code goes there (Ayush's explicit wish).
- `aafd6a2` was pushed to `origin/prototype` on 13 Oct. Local `main` sits at `4bcc46c`, and there is no `origin/main`; the plan to merge or push `main` when the prototype was complete was never carried out.
- 43 commits from 3 Oct to 13 Oct 2026. Author `ayush dev`. From `756fa76` onward commits carry the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Stack:** Next.js 16.3.8 (App Router), React 19.2.8, TypeScript 5, Tailwind CSS v4, ESLint 9 flat config. Dependencies: `next` 16.3.8, `openai` ^7.32.0, `react` and `react-dom` 19.2.8. Import alias `@/*` maps to the repo root.
- **Scripts:** `dev`, `build` (**the only type check**), `start`, `lint`, `test` (`node --test lib/scout/core/core.test.mjs`).
- **Next.js gotcha.** `AGENTS.md` carries a block that starts "This is NOT the Next.js you know". `next dev` writes and re-adds it (`node_modules/next/dist/server/lib/generate-agent-files.js`). Read `node_modules/next/dist/docs/` before writing Next.js code. Removing the block only re-creates it, so commit it.

### 2.2 How it was built, step by step

The prototype followed a six-step build sequence written on 4 Oct:

1. Manual invitation UI, validation, duplicates, list, resettable data.
2. Registered semantic actions; one workflow run deterministically, without a model.
3. Admin recording, review, persistence, enablement, replay validation.
4. Chat interface, `/api/scout` decision endpoint with runtime validation, product facts file.
5. Speech input and narration through the same session controller, with interruption.
6. More workflows; a narrow UI recording/replay experiment if time permits.

Steps 1–5 were built. Step 6 was partly built (customer search). The revenue filter and the UI recording experiment were not.

| Dates | Phase | Key commits | What was added |
|---|---|---|---|
| 3–4 Oct | Scaffold and agreements | `7da24ff`, `c7ed7e4`, `a5e50c6`, `545e650` | Create Next App; dashboard with four sections (Overview, Customers, Analytics, Settings); Scout scope and working agreements in `AGENTS.md` and `SCOUT_CONTEXT.md` (coaching mode at first) |
| 5 Oct | 1. Manual invitations | `e1da27d` | Invitation panel, controlled email input, Member/Admin select, format check, trim and lowercase, duplicate rejection, "Pending (simulated)" list, Reset demo |
| 7 Oct | 2. Registered actions | `cfdc6ff`, `fe47d87`, `e7ebd7e`, `c97a036`, `c691ada` | Action IDs with input validation; adapter extracted; `ActionResult`; shared dispatcher that rejects unregistered and inherited IDs; "latest handler" hook that reads the registry from a ref set in `useLayoutEffect` |
| 7–8 Oct | 2b. Rendered-result verification | `756fa76` | Bounded, abortable polling verifiers (50 ms, 2 s) scoped to the dashboard; cancellation of stale checks |
| 8 Oct | 2c. Workflow data and runner | `a8d2caa`, `df727cd` | `WorkflowStep`, `Workflow`; hand-written five-step invite workflow; `runWorkflow`, deterministic, one step at a time, each verified before the next |
| 8 Oct | 3. Core/binding split and teaching | `f48e192` | `lib/scout/core` (React-free), `lib/scout/react` (`ScoutProvider`, `ScoutPanel`), `lib/scout/bindings/dashboard`; recording, review, `localStorage` store, Validate-to-enable |
| 8 Oct | 3b. Declared inputs | `89d7971` | Workflow version 2: `purpose`, `examples`, `inputs`, `{ $input: name }` placeholders, `resolveWorkflow` |
| 11 Oct | 4. Model, chat, modes, search | `bf7d7b8`, `fc8cb27` | OpenAI client and `/api/scout/check`; `POST /api/scout` with a strict JSON schema; `readDecision` on server and browser; chat widget; `/configure`, `/demo`, `/dashboard` modes; customer search and facts |
| 11 Oct | 5. Voice | `cab82c1` | Press-to-talk and spoken replies via the browser's Web Speech API; stuck-mic fix |
| 11 Oct | 5b. Guided demos | `b055bfa` | Per-step narration, spotlight, waiting for the voice, visible typing, closing line |
| 11 Oct | Tests and latency | `198cdfe`, `46fc106` | 16 Node tests; latency breakdown in chat; build type error fixed; "the prototype loop is complete" |
| 13 Oct | Freeze | `aafd6a2` | Frozen note; pointers to `scout-js` and `scout-cloud` |

### 2.3 How it works, end to end

**Plain language first.** The product (a fictional dashboard) tells Scout which operations exist and how to check that each one worked. The admin records a workflow by using the product normally while Scout listens. The admin reviews it, says which recorded values should change per run (for example the email), and saves it. A saved workflow stays off until Scout replays it successfully from a clean start. Then a visitor can ask for it in chat or by voice. A model on the server only *chooses*: which workflow, with which values, or an answer, a question back, or a polite refusal. The browser checks that choice again, then runs the workflow itself, one step at a time, showing and saying what it is about to do and proving each step on screen before moving on.

```
 BROWSER                                                                 SERVER
 +----------------------------------------------------------------+     +----------------------+
 |  Product UI (ProductDashboard)                                 |     |  POST /api/scout     |
 |    manual click --> perform(step) --+                          |     |   readScoutRequest   |
 |                                     |                          |     |   buildInstructions  |
 |  ScoutProvider (session controller) v                          |     |   model call         |
 |    one check | one run | one request | mic | narration         |     |   (strict schema)    |
 |                                     |                          |     |   readDecision       |
 |    Recorder <-- human results only  |                          |     +----------^-----------+
 |       | review -> declareInputs     |                          |                |
 |       v                             v                          |   message,     | decision
 |    Workflow store --> Runner --> execute --> Dispatcher        |   history,     |
 |    (localStorage)     (one step   (latest     --> Adapter      |   catalog,     |
 |                        at a time)  binding)    --> Product op  |   facts        |
 |                         |                                      |----------------+
 |                         +--> Verifier --> reads rendered UI    |
 |    Chat widget, voice, spotlight (outside the product DOM)     |
 +----------------------------------------------------------------+
```

**Technically, in order.**

1. **Binding.** On every render, `ProductDashboard` calls `useScoutBinding({ actions, verifiers, reset, mergeConsecutive, narrate, locate, typing })`. The provider publishes it into `bindingRef` inside `useLayoutEffect`, that is, only after React commits that render. Scout therefore always calls the handlers of the committed UI, never a stale or discarded render.
2. **Human path.** Each manual control calls `perform(step)`. Scout interrupts any pending check or run, dispatches through the latest binding, awaits the step's verifier, shows a failure in the panel, and, while recording, appends `{ step, result }` to the session log. If a newer action replaced this one meanwhile, the result is dropped (not shown, not recorded).
3. **Teach (`/configure`).** "Reset & record" resets the demo and starts an empty log. `appendRecordedEntry` merges consecutive successful edits of the same mergeable action, so typing `alex@example.com` becomes one `invite.setEmail` step with the final value, not 16. Failed entries are kept, shown with ✕, and cannot be saved.
4. **Review.** Title, purpose, example requests, which steps to keep, a narration line per step (pre-filled from the binding), a closing line, and which recorded values become inputs. `collectRecordedValues` lists the distinct values. On Save, `declareInputs` swaps **every** occurrence of a ticked value for `{ $input: name }`, so the email typed into the form and the email expected after submit become one `email` input. The recorded value is kept as the input's `example`. `createWorkflowFromRecording` gives the id `<slug>-<base36 time>` and `version: 2`. The saved workflow starts `enabled: false`.
5. **Validate.** Replays the workflow from Reset with the example values, unguided (fast and silent). Only if every step verifies does it become `enabled: true`. A failure names the step.
6. **Ask (`/demo`).** `sendMessage` interrupts everything, gives the request a new id, and POSTs `{ message, history (last 8 turns), workflows (enabled catalog, no example values), facts }`.
7. **Decide (server).** `readScoutRequest` checks shape and limits; `buildInstructions` assembles rules, facts and the catalog; one `responses.create` call with a strict schema returns `{ kind, workflowId, inputs[{name,value}], message }`; the pairs become a record; `readDecision` checks it against the catalog the browser sent.
8. **Re-check (browser).** A reply for an old request id is dropped silently. `readDecision` runs again against what is enabled **now**, then `resolveWorkflow` fills the placeholders. `answer`, `clarify` and `unsupported` are shown (and spoken). A `run` states its intent ("Inviting priya…"), then starts the runner.
9. **Guided verified run.** For each step: pause 250 ms (except before step 1); `beforeStep` spotlights `binding.locate(step)`, shows and speaks `step.narration ?? binding.narrate(step)` and waits for the voice (at most 8 s) or a reading pause; if `binding.typing` names a field, growing prefixes are executed 45 ms apart (not verified); the final value is executed; the verifier proves the result. Any failure stops the run with "Step N (action) failed: …".
10. **Close.** After every step verifies, Scout says `workflow.outcome` (filled with inputs) or "Done: <title>.", with a measured breakdown: steps verified, model time, time to first verified change, total time including narration.

### 2.4 Code map at `aafd6a2`

| Area | Files | Role |
|---|---|---|
| Routes | `app/page.tsx` (links), `app/dashboard/page.tsx` (mode `dev`), `app/configure/page.tsx` (`configure`), `app/demo/page.tsx` (`demo`), `app/api/scout/route.ts` (`POST`), `app/api/scout/check/route.ts` (dev-only `GET`) | Thin. Pages are Server Components passing only serializable data (`Workflow[]`, `string[]`) to the client `ScoutProvider`. Functions can't cross that boundary, which is why the product publishes its binding from inside a client component. |
| Product | `components/dashboard/ProductDashboard.tsx`, `types.ts`, `customers.ts` | The fictional product: state, operations, and the six fictional customers |
| Core (React-free) | `lib/scout/core/contracts.ts`, `dispatcher.ts`, `wait-for-condition.ts`, `runner.ts`, `inputs.ts`, `recorder.ts`, `decision.ts`, `workflow-store.ts`, `core.test.mjs` | The future SDK core |
| React runtime | `lib/scout/react/ScoutProvider.tsx`, `ScoutPanel.tsx`, `ScoutChat.tsx`, `ScoutSpotlight.tsx` | Session controller, dev panel, chat, spotlight overlay |
| Binding (product-specific) | `lib/scout/bindings/dashboard/actions.ts`, `verifiers.ts`, `workflows.ts`, `facts.ts`, `presentation.ts` | What a client would write or configure |
| Browser | `lib/scout/browser/speech.ts` | Web Speech API wrapper |
| Server | `lib/scout/server/model.ts`, `decide.ts` | The only model choice and the only `openai` importer; the decision call |

Dependency direction: `bindings → core`, `react → core`, server `→ core`, product `→ react + its bindings`. Nothing in `core` imports React or the dashboard.

**Modes** (`ScoutProvider mode`, not authentication; separate mounts have separate state and share only `localStorage`):

| Route | Mode | Panel shows |
|---|---|---|
| `/configure` | `configure` | Stop, Reset demo, Teach, Workflows (Run, Validate, Delete) |
| `/demo` | `demo` | Stop, Reset demo, chat |
| `/dashboard` | `dev` | Everything |

### 2.5 Contracts (from `core/contracts.ts`)

```ts
type ActionResult   = { ok: true } | { ok: false; error: string };
type ActionRequest  = { id: string; input?: unknown };
type ActionRegistry = Record<string, (input: unknown) => ActionResult>;   // synchronous handlers
type WorkflowStep   = { action: string; input?: unknown; expect?: unknown; narration?: string };
type VerifyContext  = { getRoot: () => HTMLElement | null; signal: AbortSignal };
type StepVerifier   = (step: WorkflowStep, context: VerifyContext) => Promise<ActionResult>;
type VerifierRegistry = Record<string, StepVerifier>;
type WorkflowInput  = { name: string; label: string; example: string };
type InputValues    = Record<string, string>;
type Workflow       = { id: string; version: number; title: string; purpose: string;
                        examples: string[]; inputs: WorkflowInput[]; steps: WorkflowStep[];
                        outcome?: string };
type SavedWorkflow  = { workflow: Workflow; enabled: boolean };
type RecordedEntry  = { step: WorkflowStep; result: ActionResult };
type ScoutBinding   = { actions: ActionRegistry; verifiers: VerifierRegistry; reset: () => void;
                        mergeConsecutive: readonly string[];
                        narrate?: (step) => string | undefined;          // presentation only
                        locate?: (step, root: HTMLElement) => HTMLElement | null;
                        typing?: Readonly<Record<string, string>> };     // action id -> field
type CatalogEntry   = { id; title; purpose; examples: string[]; inputs: { name; label }[] }; // no example values
type ChatTurn       = { role: "visitor" | "scout"; text: string };
type ScoutRequest   = { message: string; history: ChatTurn[]; workflows: CatalogEntry[]; facts: string[] };
type ScoutDecision  = { kind: "run"; workflowId: string; inputs: InputValues; message: string }
                    | { kind: "answer" | "clarify" | "unsupported"; message: string };
```

**What `ok: true` means depends on who returned it:**

| Returned by | Means |
|---|---|
| An adapter handler or `dispatchAction` | Accepted; a React update was requested |
| A verifier | The expected UI is visibly rendered |
| `perform` or a runner step | Accepted, verified, and still the current action or run |

**Workflow rules.** Version 2 has inputs; v1 (id, title, steps) is upgraded in memory on load. Placeholders are one-key objects `{ $input: "email" }` anywhere inside `input` or `expect`. `resolveWorkflow` fills a copy before every run and rejects: a declared input without a non-blank value, a value for an undeclared name, and a placeholder naming an undeclared input. It also fills `{name}` in `narration` and `outcome` (unknown names stay as written). The runner and verifiers never see placeholders. Input names match `^[a-z][A-Za-z0-9]*$`. `readDecision` *drops* undeclared input names while `resolveWorkflow` *rejects* them; that difference is deliberate.

### 2.6 The dashboard binding (the example of tier-2 integration)

| Action ID | Input / expect | Adapter rejects unless | Verifier confirms |
|---|---|---|---|
| `navigation.open` | `{ section }` | section is one of the four | One heading with that text; exactly one pressed nav button, the enabled target |
| `invite.open` | none | Settings is shown | "Panel ready": heading, one enabled opener with `aria-expanded="true"` and `aria-controls="invite-panel"`, one panel, visible enabled fields |
| `invite.setEmail` | `{ email }` | Settings and panel open | Panel ready, input value equals `email` exactly, not read-only |
| `invite.setRole` | `{ role }` | role is Member or Admin, panel open | Panel ready, one enabled matching option, select value equals `role` |
| `invite.submit` | `expect: { email, role }` | Settings and panel open | Exactly one row for the normalized email reading `"<role> · Pending (simulated)"`, Settings heading, panel gone, opener `aria-expanded="false"` |
| `customers.search` | `{ query }` | Customers is shown | Customers heading; one enabled `#customer-search` with exactly that value; every listed name matches; the count text agrees with the rows |

- `dashboardMergeConsecutive = ["navigation.open", "invite.setEmail", "invite.setRole", "customers.search"]`.
- `dashboardTyping = { "invite.setEmail": "email", "customers.search": "query" }`.
- Built-in workflows: `invite-teammate` (inputs `email`, `role`; five steps; outcome line) and `find-customer` (input `query`; two steps).
- **DOM markers verification depends on** (renaming any breaks verification): `data-scout-navigation`, `data-scout-section`, `data-scout-section-heading`, `data-scout-invite-open`, `data-scout-invitations`, `data-scout-invitation`, `data-scout-invitation-email`, `data-scout-invitation-details`, `data-scout-customers`, `data-scout-customer`, `data-scout-customer-name`, `data-scout-customer-count`, and the ids `invite-panel`, `invite-email`, `invite-role`, `customer-search`. These markers are, in effect, the first **tier-1 hints** (§6).
- **Facts** (`facts.ts`, nine authored strings): the product is the fictional "Scout Sandbox"; four sections (Overview and Analytics are placeholders); Settings manages the team; invitations are simulated, no email is sent and the list clears on reload or Reset; roles are exactly Member or Admin, with their rights; one pending invitation per email, ignoring case and spaces; Customers has plans (Starter, Growth, Enterprise), owners, and search by name; Scout can't change real accounts or send email. Recording steps never teaches facts.

### 2.7 Architecture invariants, and why each exists

| # | Invariant | Why |
|---|---|---|
| 1 | **Accepted is not done.** `ok: true` from dispatch means accepted. Only a verifier that sees the expected UI counts as success. Setter calls, fixed delays, narration and typing prefixes are never evidence. | React renders later than the handler returns. A demo that claims success without seeing it lies to the visitor. |
| 2 | **Await each step's verifier before the next dispatch.** | Stale closures: if `setEmail` and `submit` are dispatched back to back, `submit` still runs the old binding and sees `inviteEmail = ""`. Awaiting the verifier proves the next render committed and its binding was published. |
| 3 | **Publish only the committed binding** (`useLayoutEffect`, never during render). | Handlers close over their render's state; writing the ref during render violates `react-hooks/refs` and may publish handlers from a render React later discards. |
| 4 | **Registration defines access.** Scout calls only registered action IDs (own properties; prototype keys like `toString` are rejected) with validated input. | The model must never reach code, URLs or selectors. |
| 5 | **Product rules stay in the product.** Email format, normalization and duplicate rejection live in `submitInvitation`; the adapter checks only input shape and screen state. | One behavior for people and Scout; repeated runs can't duplicate. |
| 6 | **One path for people and Scout.** Manual controls and the runner reach the same operations through the same dispatcher and verifiers. | No second, divergent implementation of the product. |
| 7 | **Product operations never cancel Scout work.** Cancel calls `interrupt()` explicitly first; Scout's Reset interrupts, then calls `binding.reset`. | A successful submit closes the panel. If closing cancelled, submit would abort its own check. (This also resolved a `react-hooks/refs` lint error.) |
| 8 | **Waiting belongs to Scout.** Product handlers stay synchronous and never await Scout. | Keeps product code ignorant of Scout and keeps sequencing, timeouts and cancellation in one place. |
| 9 | **Dispatch doesn't record.** Only human `perform` calls during an explicit teaching session are recorded. The runner calls `execute`, never `perform`. | Replay must never record itself or interrupt itself. |
| 10 | **Saved workflows are untrusted on load** (shape check, bad entries skipped) and **enabled only by a successful replay from Reset.** | Storage can be edited or stale; a recording can be broken. |
| 11 | **Verifiers are scoped and strict.** They search only inside the provider's root `<div>` (Scout's own UI renders outside it), use fixed selectors, compare step data as text and never put it into a selector, treat zero or several matches for a unique target as failure, and treat absence as "not yet" (time out rather than fail at once). | Scout's panel must never satisfy a check; step data must never become selector injection; ambiguity must stop a run clearly. |
| 12 | **Bounded verification.** Poll every 50 ms, at most 2 s by default, abortable, every timer and listener cleared exactly once. Polling happens only while a check is active. | No idle cost; no hang; no leaked timers. 50 ms and 2 s are settings, not measurements. |
| 13 | **One controller owns requests, runs and narration** and uses identities (request ids, `AbortController`s, per-session mic identity) to ignore stale replies, timers and speech callbacks. | Late replies and callbacks from replaced work caused real bugs (stuck mic). |
| 14 | **Stop, a new request, or the mic cancels pending work and speech first.** A human click does **not** silence narration. | Runs call `interrupt()` too; silencing there would cut Scout's own "about to do X". |
| 15 | **Cancellation doesn't undo completed actions.** Read the current UI before continuing. Reset cancels first, restores demo data, and keeps saved workflows. | Undo is not generally possible in a client's product. |
| 16 | **The model only chooses.** It selects an enabled workflow and declared inputs, answers from facts, asks for clarification, or declines. Its JSON is validated at runtime on the server and rechecked in the browser against the catalog enabled at that moment. | TypeScript types don't exist at run time; the catalog may change while the request is in flight. |
| 17 | **Narrate intent before acting; claim success only after verification.** | Honest demos. |
| 18 | **Credentials stay on the server.** `server/model.ts` is the only importer of the model SDK; only routes import it. | The key must never enter the browser bundle. |
| 19 | **Browser storage is same browser and origin only.** It does not publish workflows to other visitors. | Hence Scout Cloud. |
| 20 | **The invitation is simulated and labelled so.** | No real email, no real side effects in a demo. |

### 2.8 Verification record

"Ayush" means Ayush ran the check and reported the result. "Agent" means the coding agent ran it.

| Check | Result | Who, when |
|---|---|---|
| Invitations added with selected roles | Works | Ayush, 5 Oct |
| Browser UI after the latest-handler hook | "Working as before" | Ayush, 7 Oct |
| `npm run lint` after the field-verification patch and the lint fix | Clean | Ayush, 7–8 Oct |
| Runner: invite demo end to end; run twice (duplicate stops at step 5); Stop mid-run; manual click mid-run | Works | Ayush, 8 Oct |
| Core/binding split: repeated manual invites listed correctly | Works | Ayush, 8 Oct |
| `npm run lint` after step 3 | Clean | Ayush, 8 Oct |
| Recording; broken workflow stays disabled after Validate; save → reload → listed → Validate → enabled → Run | Works | Ayush, 8 Oct |
| Declared inputs: email and role become inputs; Validate with recorded values; blank input rejected; v1 still loads | Works | Ayush, 8 Oct |
| `GET /api/scout/check` | Reply `ok`, 13 tokens in / 5 out; first call 3,619 ms (warm-up), then about 1.5 s average over repeated calls | Ayush, 11 Oct |
| Chat "what can you do?" | Answer from facts; model time 2,160 ms | Ayush, 11 Oct |
| Chat "show me customers" | Ran the recorded "show any customer", 2 steps verified; model time 2,853 ms | Ayush, 11 Oct |
| Chat "add prakhar@c.com as Admin", "add me@Me.com as member" | 5 steps verified; model time 2,070 / 2,751 ms | Ayush, 11 Oct |
| First-loop cases: missing input → clarify; unsupported; duplicate fails at step 5; Stop or new message mid-run; Reset during a request | Pass ("1–3 are fine") | Ayush, 11 Oct |
| Voice on `/demo` after the stuck-mic fix | Works | Ayush, 11 Oct |
| Guided demos | Work | Ayush, 11 Oct |
| `npm run lint`; `npm run build` (TypeScript, 7 routes); `npm test` | Clean; passes; 16/16 | Agent, 11 Oct |
| `npm test` re-run on Node v22.23.2 | 16/16, about 182 ms | Agent, 13 Oct |

The 16 tests cover: runner order and stop at the first failure, rejected action, missing verifier, cancellation, typing, `beforeStep`, input resolution, `fillText`, decision checks, request checks, recording merge, `declareInputs`.

**Never run** (do not claim them): the submit-verification matrix (valid, duplicate, invalid, Reset) as separate checks; failure paths (timeout, missing, ambiguous or disabled target, rapid replacement, unmount); the built-in "Find a customer" on its own (search ran only through a recorded workflow); the planned ~15-case decision comparison; any test of `dispatchAction`, `waitForCondition`, `isVisible`, the workflow store, `collectRecordedValues`, `createWorkflowFromRecording`, `toCatalogEntry`, cancellation during a pause, `beforeStep` or typing, or the DOM verifiers.

### 2.9 Measured latency

Only measured numbers, each a single machine's runs, not a benchmark:

- **Tiny model call** (`/api/scout/check`): 3,619 ms first (warm-up), then about 1.5 s average.
- **Decision call:** about 2–3 s model time per decision (measured in chat, 11 Oct).
- **Per-request model time** (`modelMs`, shown under each chat reply, 11 Oct): 2,160 / 2,853 / 2,070 / 2,751 ms for the four chat cases above. End-to-end run times were not measured then. The first-change and total breakdown was added later, in `198cdfe`, and no measurement with it is recorded.
- **Prompt size:** the instructions were about 670 tokens with two workflows. This figure was reported in the planning conversation and is not in the prototype's verification record. Prompt caching is irrelevant at this size.

Rule carried forward: report latency only from measured runs, and keep model time, time to the first visible change, completion, speech and pacing separate. Pacing (250 ms guided, 300 ms unguided between steps; 45 ms per typed character) and narration waits are deliberate presentation time, not latency.

### 2.10 Known limits at the freeze

- **Input values aren't constrained.** `role` accepts any text until the adapter rejects it at run time. Planned: allowed values per input, told to the model up front (now `allowedValues` in `API_CONTRACT.md`).
- **Finish during verification** drops the last edit.
- **Validation's one-macrotask yield** after Reset is ordering, not proof; step 1's verifier is the proof.
- **No step-log viewer.** A malformed submit `expect` is found only after dispatch.
- **Same browser only.** No export/import; no cross-tab sync (no `storage` event listener).
- **Recorded labels are raw** (`label = name`, for example "email").
- **Spotlight** is measured once per step; it does not follow scroll or resize; the caption is not clamped on the right or bottom.
- **Stop is disabled** when Scout is only speaking (Reset silences it).
- **No auth.** Modes are not authentication; `/configure` and the paid `/api/scout` are unprotected.
- **Request limits:** more than 20 enabled workflows or a chat turn over 1,000 characters makes the server return 400 for the whole request.
- **Reset wipes demo data** only because the dashboard is fictional. A client's app can't be wiped. Planned instead: each workflow saves **starting conditions** (screen, required targets); Scout checks and navigates to them before a run; validation runs in a sandbox or demo account. Designed, not built.
- **Voice** depends on browser support; tested only on Ayush's Ubuntu browser (recognition working implies Google Chrome, but the browser wasn't recorded).
- **Edge cases in core** (from reading the code): exceptions thrown by action handlers, `beforeStep` or verifiers are not caught; a `readCondition` that throws on a timer tick leaves the promise to resolve only at timeout; `collectRecordedValues` doesn't traverse arrays; `declareInputs` can replace short values inside unrelated words in narration; `readScoutRequest` doesn't check duplicate catalog ids or input-name syntax; `readDecision` doesn't limit input value length.
- **Edge cases in the runtime and voice** (`lib/scout/browser/speech.ts` and `ScoutProvider`'s `sendMessage`/`presentStep`, from reading the code): the decision's intent line and step 1's `speakAndWait` share the 8 s cap, so a long intent line can cut step 1's wait short.
- **Open question (never answered):** how much a client must declare (actions, result checks, teaching events) versus what Scout can discover from the UI. The UI recording experiment and the Argo CD rehearsal were meant to answer it. That question is now the centre of tier 0 (§6).

### 2.11 Bugs, mistakes and lessons (never repeat these)

| # | What happened | Cause | Fix | Rule now |
|---|---|---|---|---|
| 1 | `c7ed7e4`, `d7030be`, `a5e50c6`, `6d40887` don't build | A page was committed before the component it imports (`545e650`) | Later commit added the component | Never commit a file before what it imports |
| 2 | `a8d2caa` doesn't compile | An unfinished `export type WorkflowStep<>;` was committed | `df727cd` removed it | Don't commit half-finished code; don't bisect onto `a8d2caa` |
| 3 | `npm run build` failed from `f48e192` (8 Oct) to 11 Oct, unnoticed for three days | `notConnected: ActionResult` then reading `.error` (only on the `ok: false` branch). The dev server doesn't type-check | `198cdfe` typed it `{ ok: false; error: string }` | Run the real type check (build or `tsc`) before calling a step done. Ayush's 11 Oct "build" pass conflicts with this, which shows a reported pass must name exactly what ran |
| 4 | Lint errors `react-hooks/refs` and `prefer-const` (7 Oct) | `submitInvitation → closeInvitePanel → cancel → ref` was traced through the factory argument called during render | Removed cancellation from `closeInvitePanel`; explicit cancellation in Cancel and Submit handlers; `const` timer | Invariant 7 |
| 5 | Stale registry in `executeAction` (7 Oct) | A per-render snapshot captured old handlers | Latest-handler hook with `useLayoutEffect` (`c691ada`) | Invariant 3; and fresh handlers alone don't make consecutive calls safe (invariant 2) |
| 6 | Stuck microphone on `/demo` (11 Oct) | A failed `recognition.start()` or a late `onend` from an old session left `isListening` true or a dead stop function in the ref | `active` flag guarding every callback; `start()` in try/catch; stop runs once; each listening session has an identity, and the ref is cleared only if it still holds this session's stop, and stored only if the session didn't end synchronously (`cab82c1`) | Every async callback needs an identity or guard |
| 7 | Chrome sometimes never fires the speech `end` event | Browser behavior | `speakAndWait` also resolves on error, abort or an 8 s timeout | Always bound speech waits |
| 8 | "Scout just clicks"; not smooth like Supersonik (Ayush, 11 Oct) | Narration didn't guide | Guided demos: spotlight, caption, wait for voice, visible typing, closing line (`b055bfa`) | Presentation matters, but is never evidence |
| 9 | PNG/SVG diagrams added and deleted six minutes later (`15bd089`, `efdb8e2`) | Image diagrams aren't editable | Plain-text diagrams | Diagrams are text in Markdown; PNG previews only in `/tmp` |
| 10 | Docs became patch history | Narrative accumulated in status files | `c08afac` restructured: status only in `SCOUT_CONTEXT.md`, design in HLD/LLD | Docs trimmed and non-redundant |
| 11 | A demo run-sheet was committed | Presentation script in the repo | Ayush deleted it and had it removed from history | No run-sheets or presentation scripts in git |
| 12 | Standing commit authorization (7 Oct) | Ayush wanted to review applied code first | Revoked the same day | Ask before every commit; "commit" must be said explicitly |
| 13 | Docs drifted from code (see §2.12) | Docs not updated with code | Not fixed (repo frozen) | Update design docs at each checkpoint; don't copy the drift |

### 2.12 Where the frozen docs disagree with the frozen code (don't copy these)

- `CLAUDE.md`/`AGENTS.md` say there is no test runner; `npm test` exists.
- `AGENTS.md` says to tell Ayush what to run; on 11 Oct he allowed the agent to run lint, build and tests itself (the decision governs). It also still calls `/configure` and `/demo` "planned".
- `SCOUT_CONTEXT.md`: a stale "`npm run build` | Not run" row; "Declared inputs: Written, untested" contradicts the 8 Oct passes; the 11 Oct decision says reasoning effort `none`, but the decision call uses `DECISION_EFFORT = "low"` (only the check route uses `none`); decisions are out of date order; the superseded Haiku entry sits after 11 Oct entries.
- HLD: §1 "Workflow (planned)", §5 and §7 headings "(planned)" though built; §6 "will be stored"; §8 says "Two ways" but lists four; glossary names pre-split files (`dashboard-adapter.ts`, `waitForDashboardInvitation`).
- LLD: §1 file tree misses many files and says five actions (six); §2 types miss `narration`, `outcome`, `narrate`, `locate`, `typing`, the chat and decision types; §3 omits customer query state; §4 merge list omits `customers.search`; §10 says `stepPauseMs: 600` (code: 250 guided, 300 unguided); §12 says `version === 1` and `isSavedWorkflow` (code: v2, upgrades v1, `readSavedWorkflow`); §13 marks model-supplied values "Planned" (built in §15).
- The selector list in `CLAUDE.md` and LLD §6 omits `customer-search`.

### 2.13 TypeScript and test-tooling lessons for the new repos

- Node 22.18+ strips types, so `node --test` imported `.ts` files directly with no test dependency. This works only for modules whose imports are all `import type` (erased); a value import without a file extension fails under Node's ESM resolution. `workflow-store.ts` (value import of `./inputs`, uses `window`) could not be tested this way.
- The prototype's `tsconfig.json` had `moduleResolution: "bundler"`, `isolatedModules`, `strict`, `noEmit`, but **not** `verbatimModuleSyntax`, `erasableSyntaxOnly` or `allowImportingTsExtensions`, so nothing enforced strippable code except review. Its `include` didn't cover `.mjs`, so the test file was never type-checked. `@types/node` was ^20 on Node 22.
- PROPOSED for `scout-js`: enable `verbatimModuleSyntax` and `erasableSyntaxOnly`; either `.ts` extensions with `allowImportingTsExtensions` or a runner that resolves extensionless paths; a real type-check script that is actually run, so type checking does not depend on a production build (the exact command is each repo's design: `scout-js/docs/SDK_DESIGN.md` §13, `scout-cloud/docs/CLOUD_DESIGN.md` §10).

---

## 3. Supersonik: the interaction reference, analysed in depth

Sources read on 13 Oct 2026: `https://supersonik.ai/docs/client-api` (API v1, page last updated 2026-10-09), `https://supersonik.ai/platform` and `https://supersonik.ai/docs/slack`. Everything below is what those pages document, unless marked INFERENCE.

### 3.1 Hosts

| Host | Used for |
|---|---|
| `api.supersonik.ai` | Server API (secret key) |
| `app.supersonik.ai` | Demo pages (`/d/<slug>`, `/d/<token>`) |
| `embed.supersonik.ai` | Widget loader script (`/v1/loader.js`) |
| `embed-api.supersonik.ai` | Widget's browser API |

### 3.2 Four delivery options

| Option | How | Details |
|---|---|---|
| **A. Plain link** | `https://app.supersonik.ai/d/<slug>` | Slugs and URLs come from `GET /v1/client/launch-configs` |
| **B. Iframe** | `https://app.supersonik.ai/d/<slug>/embed?native=true` | `allow="microphone; fullscreen"`, `allowfullscreen`; HTTPS only; a wrapper `div` controls height; the frame posts `{ source: 'supersonik-embed', type: 'RESIZE', height }` and the host must validate `event.origin` and `event.source`; any domain can frame it; the host's `Permissions-Policy` must allow the microphone; layout breakpoints around 968 px and 1200 px; `disableRedirect=1` together with `native=true` |
| **C. Contextualized link** | `POST /v1/client/demos { demo_url_slug, context }` → `201 { id, token, url }` with `url = https://app.supersonik.ai/d/<token>` | `context` is any JSON, max 32 KB, max 5 levels deep; the link is reusable and doesn't expire while the demo is published; context is immutable; no `/embed` variant; the legacy `/d/c/<token>` still works |
| **D. Voice and chat widget** | Queue stub plus loader script (below) | Floating launcher on the client's own site |

**Loader snippet (option D)** (attribute values here are placeholders):

```html
<script>
  window.supersonik = window.supersonik || function () {
    (window.supersonik.q = window.supersonik.q || []).push(arguments);
  };
</script>
<script src="https://embed.supersonik.ai/v1/loader.js"
        data-launch-config-slug="..."
        data-launcher-label="..."
        data-position="bottom-right"
        data-colors='{"primary":"#..."}'
        data-accent-color="#..."
        data-language="..."
        data-locale="..."
        data-memory-mode="manual"
        data-memory-storage-key-prefix="..."
        async></script>
```

`data-position` is `bottom-right` or `bottom-left`; `data-colors` is JSON; `data-memory-mode` is `manual` or `automatic`. The stub queues calls made before the script loads; the loader replays the queue.

**Runtime commands:**

| Command | Effect |
|---|---|
| `supersonik('language', 'es-ES' \| 'auto')` | Set or reset the language |
| `supersonik('appearance', { locale, colors, launcher_label, position, accent_color })` | Change appearance; `null` clears a value |
| `supersonik('identify', { memory_id, email })` | Attach identity |
| `supersonik('memory', { consent: true \| false })` | Record consent for automatic memory |
| `supersonik('resetIdentity')` | Forget identity |

**Theming.** About 30 colour roles: `background`, `surface`, `text`, `muted_text`, `border`, `shadow`, `primary`, `primary_text`, `primary_hover`, `control_*`, `placeholder`, `focus`, `link`, `visitor_*`, `speaking`, `listening`, `microphone_*`, `danger*`, `warning*`, `launcher_*`, and a screen-share backdrop role.

**Language and locale.** Language is chosen from `navigator.languages` unless set; locale from `<html lang>`; right-to-left layout for `ar`, `fa`, `he`, `ur`.

**Memory.** Off by default. *Manual* mode: the client passes an opaque `memory_id`. *Automatic* mode needs consent and stores a random id in `localStorage` under `<prefix>:memory:<scope>:<launch-config id>`. Same browser and origin only; no cookies or fingerprinting; stores a summary, not transcripts; explicitly not authentication.

**CSP for the widget.** `embed.supersonik.ai` in `script-src`, `img-src` and `font-src`; `embed-api.supersonik.ai` and a media host in `connect-src`.

### 3.3 Server ("client") API

- `Authorization: Bearer <API_KEY>`. Server-side only. Organisation-scoped.
- Errors: `401`, `404`, `422`, `500` with `{ error, detail }`.

| Endpoint | Purpose and details |
|---|---|
| `GET /v1/client/launch-configs` | Screen-sharing demos only; `status` `published` or `testing`; not paginated |
| `POST /v1/client/demos` | Create a contextualized link (option C) |
| `GET /v1/client/demos` | List sessions. Query: `page`, `limit`, `start_time_from` and `start_time_to` (inclusive), `demo_type` `prod`\|`test` (repeatable; default `prod`), `validity` `valid`\|`invalid`\|`unknown` (default valid + unknown). Newest first. **Incremental sync:** store the latest `start_time` you have seen, query from it, and de-duplicate by `id` |
| `GET /v1/client/demos/{id}` | Adds `agent_config_version`, `params` (merged with pre-demo form values), `demo_context`, `participants`, `insights` (`[{ slug, name, output_type, value }]`), `transcript_url` |
| `GET /v1/client/demos/{id}/transcript` | `messages: [{ role, content, timestamp, source }]` where `role` is the agent's display name or the literal `'Participant'`, and `source` is `voice` or `chat` |

- **Query parameters on demo links** for attribution and personalization: `utm_*`, `email`, `utm_email` (hashed and used as a memory key).
- **HTTP tool context templating:** `{{context.*}}` with allowlisted parameters.
- **Testing vs published:** a launch config is `testing` or `published`; runs of a testing demo are recorded with type `test`.
- **Config version per session:** each session records `agent_config_version`.

### 3.4 Slack app, MCP, platform claims

- **Slack app:** `/demo` creates a personalised link; Supersonik DMs when a prospect finishes; the message updates as insights are processed. A Slackbot works through the Supersonik MCP server.
- **Platform page claims:** agents "understand intent, operate your real product, and explain it live"; "ClickTypeScroll"; insights across transcripts; simulate difficult sessions and turn findings into regression tests; access and data controls; multi-region.

### 3.5 INFERENCE: what Supersonik actually runs

Not documented; our reading:

- Their main demos are **hosted "screen-sharing demos"**: Supersonik runs the client's product in **its own browser session** and streams it to the visitor (supported by the launch configs being "screen-sharing demos" and the "screen-share backdrop" colour role).
- So there is **no SDK inside the client's product**. Their "SDK" is the widget loader plus the server REST API.
- They don't appear to offer an in-product SDK. An in-product tier 0 therefore targets a **different use case**: onboarding and adoption for logged-in users, where digital adoption platforms (Pendo, WalkMe, Appcues) compete.

### 3.6 What we borrow

| Supersonik idea | Scout equivalent (see `API_CONTRACT.md`) |
|---|---|
| Queue-stub loader + `data-*` config + documented CSP | `window.scout` stub, `cdn.scout.example/agent/v1/loader.js`, `data-project-key` and friends |
| `testing` vs `published` | The prototype's Validate/enabled becomes revision statuses `draft → testing → published → retired` |
| `agent_config_version` per session | `configVersion` pinned per session, plus `revision` and `agentVersion` |
| Server-side contextualized links with immutable context | `POST /v1/client/links` (Release B) |
| Sessions, transcripts, insights API for CRM sync; incremental sync | `/v1/client/sessions`, `/transcript`, insights |
| Consent-based visitor memory | Reserved `scout('memory', { consent })`, later |
| Slack notifications, MCP server | Later (open question in the contract) |
| Simulated difficult sessions turned into regression tests | Later: replay failed or stored visitor requests against a new revision's catalog (a decision regression set) and require them to pass before publish. Not in Release A |
| HTTP tools with `{{context.*}}` templating (the agent calls client-configured HTTP endpoints during a demo) | **Not borrowed in v1.** They would let a model decision trigger server-side requests, which conflicts with "the model only chooses" (it never supplies URLs or new actions). If ever added: admin-defined, allowlisted endpoints only, with context passed as data, never templated by the model. Open (`scout-cloud/docs/CLOUD_DESIGN.md` §13) |
| Pre-demo form (values merged into `params`) | PROPOSED, open, for Release B lead capture: a form before a hosted demo, its values stored in the session's `params` and readable through the Client API. Not in Release A |
| Insights across transcripts (aggregate analytics) | Later: per-session insights come first (after Release A); cross-session analytics through the console or an MCP server after that. Open (`scout-cloud/docs/CLOUD_DESIGN.md` §13) |

---

## 4. Aman's review (11 Oct) and what followed

Aman's points:

1. **Clients may not bring an engineer** to install an SDK unless it is very good.
2. Three approaches to compare: **SDK**, **Browserbase** (a hosted cloud browser), **Chrome extension**.
3. **Figure out what Supersonik does** (done in §3: hosted browser, INFERENCE).
4. **Browserbase login persistence:** he said 30 days. Browserbase's docs say Contexts persist indefinitely, but websites can still expire their own logins. So Scout must detect a logged-out page and re-authenticate.
5. **Some clients want a Scout widget** on their site.
6. **Add an auth layer** (Clerk or Google OAuth) to rehearse products with login walls. Scheduled after the prototype, in the rehearsal app, not the dashboard. Irrelevant to the in-product SDK (it runs inside an already logged-in app); relevant to hosted browsers and extensions, and later to protecting the admin console and the paid decision endpoint.
7. **Ask Supersonik's own chat** how a company with no engineers sets it up. (Not yet recorded as done.)

A possible combination that came out of it: a **Chrome extension for admin teaching** plus a **hosted browser for visitors**.

**Browserbase notes** (from its docs; the API surface of Stagehand was not verified):

- **Contexts** store a Chromium user-data directory (cookies, `localStorage`, IndexedDB) and live until deleted. `persist: true` saves on close. Avoid concurrent sessions on one context. Use one context per site per login. Detect logged-out state and re-authenticate.
- **Live View:** `bb.sessions.debug(id)` returns `debuggerFullscreenUrl`, an embeddable iframe; view-only with `pointer-events: none`; `navbar=false`.
- **Control** via Playwright or Puppeteer over CDP. **Stagehand** is their open-source AI automation framework.
- **Cost** is per session time.

Consequences recorded in the decisions: lean toward no-engineer approaches for selling (hosted browser first), keep the SDK for clients with engineers, keep an embeddable widget, and treat the UI recording experiment as the bridge to the browser and extension approaches. That led directly to tier 0 and Releases A/B (§6).

---

## 5. Ways to integrate Scout into a client's product

### 5.1 Taxonomy

| Approach | Client does | Scout team does | Strengths | Weaknesses |
|---|---|---|---|---|
| **SDK with registered actions** (the prototype; tier 2) | Installs packages; registers operations; exposes result checks and human-action events | Nothing in client code | Most reliable: semantic actions, product-defined checks, no guessing | Needs a client engineer and ongoing maintenance |
| **Script tag + visual editor** | Pastes a script tag; an admin teaches in the page | Nothing in client code | Little engineering | Scout must find targets by itself |
| **Recorded UI automation** (tier 0) | Pastes a script tag (or nothing, in hosted mode); admin records | Nothing in client code | Closest to "client does nothing"; per-client work becomes data | Locator robustness, verification without product-defined checks, framework quirks |
| **Hosted demo browser** (Browserbase-style; Release B) | Provides a demo account | Nothing in client code | No client engineer, no visitor install; works on the marketing site | Per-session cost; login persistence; latency of streaming; needs UI automation anyway |
| **Chrome extension** (likely admin-only) | Admin installs it | Nothing in client code | Teaches on the real site in the admin's own logged-in browser | Too much friction for visitors |

Products behind a login (Clerk, OAuth) affect each approach differently: the SDK and script tag run inside the already logged-in app, a hosted browser must keep a demo-account login, and an extension uses the admin's own session.

These are not exclusive. The same runtime can be loaded by a script tag in the client's app (Release A), injected into a cloud browser page (Release B), or, later, injected by an extension.

Install-pattern reference (Ayush, 4 Oct): Elastic's OpenTelemetry Browser SDK (EDOT Browser) shows how browser instrumentation installs into an existing site, by script tag or npm, and stays light. Its purpose, telemetry, differs from Scout's teaching and replay.

### 5.2 The core-versus-binding split

```
 +---------------------------- CORE (same for every product) -----------------------------+
 | runner | verification engine (bounded polling) | recorder | input resolution |        |
 | decision checks | session controller | chat | voice | dispatcher | storage/cache      |
 +----------------------------------------^------------------------------------------------+
                                          | binding interface
 +---------------------------- BINDING (per product) -------------------------------------+
 | actions: id -> operation + input checks      verifiers: id -> visible-result condition  |
 | teaching events: which human actions to report     facts: product knowledge            |
 | presentation: narrate, locate, typing                                                  |
 +----------------------------------------------------------------------------------------+
```

In the prototype the split was real: `lib/scout/core` + `lib/scout/react` were the core and `lib/scout/bindings/dashboard` was the binding. One known prototype shortcut: the product's manual handlers called `perform`, so teaching could see human actions. In a client product, normal clicks call product operations directly; Scout calls the same operations through the binding and listens for human-action events only during a teaching session.

### 5.3 How per-client work becomes data

In tier 2 the binding is **code** the client writes. In tier 0 the binding becomes **data** Scout records:

| Binding piece | Tier 2 (code) | Tier 0 (data) |
|---|---|---|
| Actions | `invite.setEmail` handler | Reserved generic actions `ui.click`, `ui.type`, `ui.select`, `ui.check`, `ui.press`, `page.navigate`, handled by `@scout/agent` |
| Target | Inside the handler | A recorded **locator**: several descriptions of the element (strategies `hint`, `role`, `label`, `text`, `near`, `css`), tried in order |
| Verifier | Product-written function | Recorded **checks** (`visible`, `hidden`, `text`, `value`, `url`), confirmed by the admin in review. A click must have at least one confirmed check |
| Teaching events | Product reports them | `@scout/agent` listens to DOM events during an explicit teach session |
| Facts | A file | Entered in the console |
| Presentation | `narrate`, `locate`, `typing` | Narration from review; locate is the locator; typing applies to `ui.type` |

Tier 1 sits between: the client adds `data-scout-*` hint attributes (`data-scout-id`, `data-scout-ignore`, `data-scout-mask`) so that tier-0 locators find elements reliably. The prototype's own `data-scout-*` markers show how cheap that is.

---

## 6. Tiers, releases and the order of work

### 6.1 Repository strategy (DECIDED 13 Oct)

- **`scout-js`**: one monorepo with separate packages per tier (not one repo per tier). Remote `https://github.com/logicallybroke/scout-js.git`.

  | Package | Tier | Role |
  |---|---|---|
  | `@scout/core` | all | Framework-free: runner, verification engine, recorder, inputs, decision checks. Whether `scout-cloud` imports it or copies the checks is PROPOSED, pending (§10.2) |
  | `@scout/agent` | 0 (+1) | The runtime loaded by a script tag: teach by element description, replay, generic verifiers, widget (Web Component with Shadow DOM), chat, voice, guided presentation; reads tier-1 hints |
  | (no package) | 1 | The `data-scout-*` hint convention, read by `@scout/agent` |
  | `@scout/actions` | 2 | Register semantic actions in code, redesigned as one `defineAction` object per action |
  | `@scout/react` | 2 | React adapter for tier-2 users (the successor of `useScoutBinding`) |
  | `@scout/embed` | Release B | Tiny loader for the marketing-site widget and hosted demos |

- **`scout-cloud`**: separate repo. Backend, admin console, decision endpoint, hosted demos. Remote `https://github.com/logicallybroke/scout-cloud.git`.
- **`scout-server-sdks`** (PLANNED, not created): Node, Python and Java clients for the cloud's server API.
- Both new repos were `git init`-ed on `main` on 13 Oct with remotes added; nothing committed yet at the snapshot.
- **Code is copied from `scout-demo` with provenance, never moved.** The first import commit names `scout-demo@aafd6a2`. See each repo's `docs/ORIGIN.md`.
- The `@scout` npm scope is a working name; its availability on npm has not been checked.

### 6.2 Tiers

| Tier | Client effort | How Scout finds and checks things |
|---|---|---|
| **0** | Paste a script tag (Release A) or nothing (Release B) | Recorded element descriptions and recorded checks |
| **1** | Optionally add `data-scout-*` attributes | Hints tried first by tier-0 locators |
| **2** | Register actions and verifiers in code | Semantic actions and product-written verifiers (the prototype's model) |

### 6.3 Releases of tier 0 (DECIDED 13 Oct)

- **Release A (first): in-product.** The client pastes a script tag into their own app. Scout records and replays by element description, with the widget, chat, voice and guided demos. A minimal Scout Cloud stores workflows, serves config and makes decisions.
- **Release B (after A): Supersonik-like hosted demos.** Scout Cloud runs the client's product in a cloud browser (Browserbase-style) logged into a demo account, injects the same `@scout/agent` runtime into that page (for example with a Playwright init script), and streams it to the visitor. Delivered by plain link, iframe embed, or the `@scout/embed` widget on the client's marketing site.
- Tier 2 (`@scout/actions`, `@scout/react`) stays available for clients with engineers who want maximum robustness.

### 6.4 Engineering order versus likely selling order

- **Engineering order: Release A first.** The runtime can be built and tested locally against apps we control, with no cloud browser cost; and Release B reuses the same runtime unchanged inside the cloud browser. Building B first would mean debugging locators, verification and streaming at the same time.
- **Likely selling order: hosted first.** A hosted demo needs no client engineer, which is what Aman's review says clients want.

### 6.5 Key insight: the client's backend language doesn't matter

Scout lives in the browser. A Java, Python or Ruby backend makes no difference; what matters is the **frontend kind**: a single-page app (React, Vue, Angular) or a server-rendered multi-page app. Language-specific SDKs belong on the **server API** side (create personalised links, pull sessions, transcripts and insights into CRMs). That is what `scout-server-sdks` is for.

### 6.6 Hard problems identified for tier 0

1. **Full page reloads** in server-rendered apps wipe in-memory run state. → Persist the run in `sessionStorage` and resume on the next page (`scout:<projectId>:run`, `run.resumed` event).
2. **Finding elements without markers.** → Robust locators tried in order: data-scout hint, role + accessible name, label, visible text, nearby text, CSS path fallback. Fail clearly when none or several match (the prototype's uniqueness rule).
3. **Client Content Security Policy** must allow Scout's script and API hosts. Document it, as Supersonik does.
4. **Typing into framework-controlled inputs** (React, Vue, Angular): set the value with the native value setter, then dispatch `input` and `change` events, or the framework ignores the change.
5. **Keys and abuse.** A publishable project key in the browser, an origin allowlist, rate limits and model cost caps; the secret key server-only (`scout_pk_…`, `scout_sk_…` in `API_CONTRACT.md`).
6. **Style isolation.** The widget is a Web Component with Shadow DOM so host CSS and Scout CSS don't collide.

### 6.7 Proposed test apps for the SDK

- A classic **server-rendered multi-page app** (Java/Spring if a JDK is available, otherwise Flask or Express).
- A **Vite + React + React Router SPA**.
- The **scout-demo dashboard**, copied, integrated via tier 2 (and usable as a tier-0/1 target, since it already has `data-scout-*` markers).
- **Argo CD** later (heavy: needs local Kubernetes; ask first, see §8). The rehearsal must answer three things for itself: how Scout is mounted, how human actions are observed, and how replay is shown visibly. Installing Argo CD alone answers none of them (scout-demo HLD §8).
- For each: measure integration cost (files and lines touched, time taken, misfits).

---

## 7. Model, provider, prompt and voice

### 7.1 Provider history

| Date | Decision |
|---|---|
| 8 Oct | **Claude Haiku 5.5** (`claude-haiku-5-5`), the cheapest Claude model ($0.10 / $0.50 per 1M tokens), chosen by Ayush, behind a one-line `SCOUT_MODEL` switch. Earlier plan to compare Opus, Sonnet and Haiku on ~15 decision cases (needed approval for the SDK, key and spend) was never run. |
| 11 Oct | **Switched to OpenAI** because Claude API credit wasn't available. Model **`gpt-6-luna`**: $0.10 / $0.50 per 1M tokens, Responses API, structured outputs, reasoning effort `none` … `max`. Decision effort `low` (`DECISION_EFFORT`); the check route uses `none`. The Anthropic SDK was removed. |
| — | `gpt-5-nano` ($0.05 / $0.40) is cheaper but OpenAI lists it as deprecated. |
| — | A ChatGPT subscription does **not** include API credit. |
| — | **Jev** (jev-ai.pro) evaluated: a scoring/classification API, text-only, no extraction, answers or voice. **Rejected.** |
| — | **Groq** and **Cerebras** noted as speed options if latency becomes the bottleneck. |

The model choice lives in exactly one server module. Switching provider touches only that module and the routes that call it.

### 7.2 What the model receives, and what it doesn't

Sent on every request:
- **Rules** for the four kinds (`run`: one short intent sentence, "Do not say it is done"; `clarify` when an input is missing or the request is ambiguous; `answer` only from facts; `unsupported` says what Scout can show instead; never invent workflows, inputs, steps, URLs or facts; non-run kinds use `workflowId: null`, `inputs: []`).
- **Facts** (bullet list).
- **Enabled workflow catalog** as JSON: `id`, `title`, `purpose`, `examples` (example *requests*), input `name` and `label`.
- **Last ≤ 8 chat turns** (visitor → `user`, scout → `assistant`) and the new message.

Not sent: steps, selectors, URLs, code, recorded example values (so the model uses only what the visitor said), anything from the DOM, credentials.

Output: strict JSON schema `scout_decision` with `kind`, `workflowId` (string or null), `inputs` (array of `{ name, value }`, because strict schemas can't have free-form keys) and `message`; `max_output_tokens: 400`.

Limits checked by `readScoutRequest`: message ≤ 1,000 characters and non-blank after trimming; history ≤ 8 turns of ≤ 1,000; ≤ 20 workflows (id ≤ 100, title ≤ 200, purpose ≤ 500, ≤ 10 examples of ≤ 500, ≤ 10 inputs with name ≤ 50 and label ≤ 100); ≤ 40 facts of ≤ 500.

In the cloud design the catalog and facts come from the server-side config snapshot rather than from the browser (see `API_CONTRACT.md` §5).

### 7.3 Voice

- **Approach:** the browser's **Web Speech API**. No key and no server. Press-to-talk (`listenOnce`, `en-US`, no interim results, one alternative) and spoken replies (`speechSynthesis`).
- **Browser caveats:** Google Chrome supports recognition and sends the audio to Google's speech service. Many Chromium builds don't, and Firefox doesn't. Typing is always the fallback; unsupported browsers get a chat note. Tested only on Ayush's Ubuntu browser ("the tested Ubuntu browser" in the prototype's notes; recognition working implies Google Chrome, but the browser wasn't recorded).
- **Rules:** voice feeds the same `sendMessage` as typing. The mic, a new message, Stop and Reset cancel narration and pending work first. Speech waits are bounded (8 s) because Chrome can skip `end`. Narration is never evidence.
- **Later:** cloud speech-to-text and text-to-speech (Deepgram, ElevenLabs, OpenAI) would need server-side keys and add a media host to the client's CSP.
- Guided demos (spotlight, narration, visible typing) were built after Ayush found plain runs "just click"; he confirmed they work.

---

## 8. Environment

- **Machine:** Ubuntu laptop, 15 GB RAM, 4 GB swap. Swap has filled under load (Chrome ~4.5 GB, VS Code ~2.3 GB, Claude Code ~1.7 GB), causing iowait. **Avoid heavy local stacks (Kubernetes, Argo CD, many containers) without asking first.**
- **Browser:** Chrome is in use (it was the largest memory user above). Which browser voice was tested in wasn't recorded: voice was tested only on Ayush's Ubuntu browser (probably Google Chrome). Many Chromium builds and Firefox lack recognition; other browsers are untested.
- **Node:** v22.23.2. **Package manager:** npm.
- **Workspace:** `~/codes/scout-agent/` holds `scout-demo`, `scout-js`, `scout-cloud` and an unversioned `CLAUDE.md` index. Start Claude Code sessions in `~/codes/scout-agent` so all repos are visible. Claude Code memory is per starting folder, so durable facts must live in repo files.
- A stray `package-lock.json` in `/home/ayush-dev/codes` triggers a harmless `turbopack.root` warning in `scout-demo`.
- **GitHub:** private repos under `logicallybroke`. The agent's shell has no GitHub credentials; **Ayush pushes from his own terminal.**
- **Secrets:** `OPENAI_API_KEY` lived in `scout-demo/.env.local` (git-ignored). Never read or print secrets; read example variable names instead.

---

## 9. How we work (summary; each repo's `AGENTS.md` is the authority)

- **Prototype build mode continues** (Ayush, 13 Oct): the agent writes each step's code, explains it in plain language first and then technically, and Ayush reviews and tests. Coaching (Ayush implements) only when he asks.
- **Commits:** ask before every commit or push; Ayush says "commit" explicitly. Separate code and docs commits. Messages describe actual behavior. Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Checks:** the agent may run lint, build and tests itself (granted 11 Oct). Never claim an unrun check.
- **Scope:** one reviewable step at a time; installing dependencies or changing configuration needs an explicit request.
- **Docs:** trimmed and non-redundant; text diagrams only; no demo run-sheets; never record unbuilt work as implemented.
- **What Ayush values:** being shown what changed in product code versus Scout integration (he worries about integration footprint), "no gaps, best work", and understanding as part of the deliverable.

---

## 10. What's next and what is waiting for approval

### 10.1 Next

1. **Design review.** The SDK design (`scout-js/docs`) and the Scout Cloud design (`scout-cloud/docs`), with the shared `API_CONTRACT.md`, reviewed by Ayush before any code. The SDK design was to cover each package's API, the loader snippet, tier-0 recording and how elements are found again, tier-1 hints, tier-2 actions, the cloud's REST API and data model, publishable vs secret keys, the hosted-demo runner, and page reloads in server-rendered apps.
2. **Release A.** Tier-0 in-product runtime (`@scout/agent`, script tag) with a minimal Scout Cloud; test apps and measured integration cost.
3. **Release B.** Hosted, Supersonik-style demos (cloud browser, injected runtime, streaming; link, iframe, `@scout/embed`).
4. **Selling Scout (investor discussion).** Options for selling; competitor research across AI demo agents (Supersonik and similar), interactive demo platforms, digital adoption platforms (Pendo, WalkMe, Appcues) and AI sales assistants; the prototypes the pitch needs.
5. **Rehearsals carried over:** the app we build with a login wall (Clerk or Google OAuth); a Browserbase spike; the admin Chrome extension idea; Argo CD later.

### 10.2 Pending approvals (PROPOSED, not decided)

| Item | Suggestion |
|---|---|
| Bundler for `scout-js` | esbuild |
| Database for `scout-cloud` | SQLite first, then Postgres |
| `scout-cloud` stack | Reuse Next.js route handlers, or a separate API service |
| Test framework | Beyond `node:test`, if needed |
| How `scout-cloud` consumes `@scout/core` before packages are published | PROPOSED in `scout-cloud/docs/CLOUD_DESIGN.md` §10.2: a `file:../scout-js/packages/core` link during development, then a pinned registry version. Whether the cloud imports rather than copies the shared checks is itself pending. `@scout` npm scope availability unchecked |
| Initial commits in the new repos | Need Ayush's explicit "commit" |
| Real domain, admin sign-in provider and the other open questions | Listed in `API_CONTRACT.md` §7 |

---

## 11. Glossary

| Term | Meaning |
|---|---|
| Product operation | A function implementing product behavior (`updateInviteEmail`) |
| Action ID | A stable name for an operation Scout may call (`invite.setEmail`, or tier-0 `ui.type`) |
| Adapter | Maps action IDs to one product's operations and validates input |
| Dispatcher | Checks a request envelope and routes it to a registered action (`dispatchAction`) |
| Verifier | Watches the rendered UI until an action's expected result appears, within a bounded time |
| Binding | Everything product-specific: actions, verifiers, reset, merge rules, presentation helpers |
| Workflow | Serializable, reviewed, versioned steps with declared inputs, narration and an outcome line |
| Input | A named value that changes per run, referenced as `{ $input: name }` |
| Catalog | The enabled workflows as the model sees them (no steps, no example values) |
| Facts | Authored product knowledge the model may answer from |
| Validate | Replay from a clean start with example values; the only way to enable a workflow |
| Guided run | A run with spotlight, narration, voice wait and visible typing (presentation only) |
| Locator | A recorded, multi-strategy description of an element (tier 0) |
| Check | A recorded visible-result condition (tier 0's verifier) |
| Tier 0 / 1 / 2 | Recorded by description / plus `data-scout-*` hints / actions registered in code |
| Release A / B | In-product script tag / hosted cloud-browser demos |
| Starting conditions | The screen and targets a workflow needs before it runs (designed, not built) |
