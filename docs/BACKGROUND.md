# Scout background

The shared history and reasoning behind Scout, so a session in `scout-js` or `scout-cloud` can see where Scout came from and why it is shaped this way.

- **Snapshot:** 13 Oct 2026 (Supersonik re-read and Release A plan added 14 Oct). **Source:** the frozen prototype `scout-demo@aafd6a2` and the planning conversations.
- **Two identical copies:** `scout-js/docs/BACKGROUND.md` and `scout-cloud/docs/BACKGROUND.md`. Change both in one review and `diff` them before committing either.
- **Not the status or the design.** Status and verification: each repo's `SCOUT_CONTEXT.md`. Rules: `AGENTS.md`. Shared names and shapes: `docs/API_CONTRACT.md`. When they disagree about the present, they win.

**Labels:** **BUILT** exists in `scout-demo@aafd6a2` and was read in source; **VERIFIED (who, when)** a check someone actually ran; **DECIDED (date)** Ayush decided; **PROPOSED** suggested, not approved; **PLANNED** approved intent, nothing built; **INFERENCE** our reading of public material, not documented by its owner.

Sections: 1 Scout in one page · 2 The prototype · 3 Supersonik · 4 Aman's review · 5 Ways to integrate · 6 Tiers and releases · 7 Model, prompt and voice · 8 Environment · 9 How we work · 10 What's next · 11 Glossary.

## 1. Scout in one page

### 1.1 What Scout is

Scout gives **live software demos**. An admin teaches Scout a workflow by doing it once in the product. Later a visitor asks for it, by typing or speaking. Scout does the workflow on screen step by step, explains it, checks that each step really happened, and answers questions about the product.

"Teaching" means saving a reviewed workflow as data. It is **not** model training, and **not** automatic understanding of arbitrary websites.

### 1.2 Goals and horizons

| Horizon | What it means | State on 13 Oct 2026 |
|---|---|---|
| **Prototype** | One complete loop on a fictional dashboard we own: record, review and save, reload, select from varied requests, execute and verify, answer a question, stop or replace a run | **Done** (4–11 Oct). Frozen in `scout-demo@aafd6a2` |
| **Post-prototype** | Installable SDKs (`scout-js`) and a backend (`scout-cloud`). Rehearse on (1) an app we build for it, (2) Argo CD, a real third-party React app | Design phase |
| **Ultimate target** | Scout installs into a client's app **seamlessly**, with **no noticeable performance cost**, and **no Scout-team work in the client's code** | Not started |

Every rehearsal tests three goals:

1. **No Scout work in client code.** The client installs and configures Scout; our team gets no repo access.
2. **No performance cost.** Scout is idle in ordinary use and works only while teaching, running, or talking to the visitor. The prototype polled (50 ms, at most 2 s) only while one check was active, and never wrapped or delayed product handlers. Loading off the critical path is a rule the prototype neither followed nor measured. The current rules are in `AGENTS.md`.
3. **Same core, different product.** A new product changes only per-product data (bindings, facts, workflows, checks), never the core.

Out of scope for now: joining Meet or Zoom calls, and automating arbitrary websites. Remote demo browsers are now Release B (§6). Sharing workflows with other visitors is now Scout Cloud's job.

### 1.3 People

- **Ayush** builds Scout and makes the decisions. He is learning Next.js, React and TypeScript along the way, so understanding is part of every deliverable. He pushes to GitHub from his own terminal.
- **Aman** reviews the business and integration side (§4).
- **The coding agent** (Claude Code) writes code and docs in build mode and explains them (`AGENTS.md`).

### 1.4 Supersonik is the interaction reference

[Supersonik](https://supersonik.ai/) is an AI demo agent. It is the reference for **how Scout should feel** (a guided, narrated, voice-capable demo that operates the product), **not** for architecture. It appears to run demos in its own hosted browser and stream them (INFERENCE, §3.5), so it needs no SDK in the client's product. Release B follows that model; Release A (in-product) targets a use case Supersonik does not appear to serve.

## 2. The prototype (`scout-demo`)

### 2.1 Facts about the repository

- **Path:** `~/codes/scout-agent/scout-demo`. **Remote:** private `github.com/logicallybroke/scout-demo`, branch `prototype` only.
- **Frozen** on 13 Oct at `aafd6a2` ("docs: freeze scout-demo and point to scout-js and scout-cloud"), pushed to `origin/prototype`. History and fallback only; no SDK or cloud code goes there (Ayush's wish). Local `main` sits at `4bcc46c`, never merged or pushed; there is no `origin/main`.
- 43 commits, 3–13 Oct, author `ayush dev`. From `756fa76` on, commits carry `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Stack:** Next.js 16.3.8 (App Router), React 19.2.8, TypeScript 5, Tailwind CSS v4, ESLint 9 flat config, `openai` ^7.32.0. Alias `@/*` maps to the repo root.
- **Scripts:** `dev`, `build` (**the only type check**), `start`, `lint`, `test` (`node --test lib/scout/core/core.test.mjs`).
- **Next.js gotcha.** `next dev` re-adds an `AGENTS.md` block starting "This is NOT the Next.js you know" (`node_modules/next/dist/server/lib/generate-agent-files.js`). Removing it only re-creates it, so commit it. Read `node_modules/next/dist/docs/` before writing Next.js code.

### 2.2 How it was built

The 4 Oct plan had six steps: (1) manual invitation UI; (2) registered actions, one workflow run without a model; (3) admin recording, review, persistence, Validate-to-enable; (4) chat, `/api/scout` with runtime validation, facts; (5) speech and narration through the same controller, with interruption; (6) more workflows and a UI recording/replay experiment. Steps 1–5 were built. Step 6 was partly built (customer search); the revenue filter and the UI recording experiment were not.

| Date | Phase | Commits | Added |
|---|---|---|---|
| 3–4 Oct | Scaffold | `7da24ff`, `c7ed7e4`, `a5e50c6`, `545e650` | Dashboard with Overview, Customers, Analytics, Settings; `AGENTS.md` and `SCOUT_CONTEXT.md` (coaching mode at first) |
| 5 Oct | 1. Invitations | `e1da27d` | Email input, Member/Admin select, format check, trim and lowercase, duplicate rejection, "Pending (simulated)" list, Reset demo |
| 7 Oct | 2. Registered actions | `cfdc6ff`, `fe47d87`, `e7ebd7e`, `c97a036`, `c691ada` | Action IDs with input validation; adapter; `ActionResult`; dispatcher rejecting unregistered and inherited IDs; latest-handler hook via `useLayoutEffect` |
| 7–8 Oct | 2b–2c. Verification, runner | `756fa76`; `a8d2caa`, `df727cd` | Bounded, abortable polling verifiers (50 ms, 2 s) scoped to the dashboard, stale checks cancelled; `Workflow` types, hand-written five-step invite, `runWorkflow` verifying each step before the next |
| 8 Oct | 3–3b. Core split, teaching, inputs | `f48e192`; `89d7971` | `lib/scout/core` (React-free), `lib/scout/react`, `lib/scout/bindings/dashboard`; recording, review, `localStorage` store, Validate-to-enable; workflow v2 with `purpose`, `examples`, `inputs`, `{ $input: name }`, `resolveWorkflow` |
| 11 Oct | 4. Model and chat | `bf7d7b8`, `fc8cb27` | OpenAI client, `/api/scout/check`, `POST /api/scout` with strict schema, `readDecision` both sides, chat, three modes, customer search and facts |
| 11 Oct | 5–5b. Voice, guided demos | `cab82c1`; `b055bfa` | Press-to-talk and spoken replies (Web Speech API), stuck-mic fix; narration, spotlight, voice wait, visible typing, closing line |
| 11 Oct | Tests, latency | `198cdfe`, `46fc106` | 16 Node tests; latency breakdown; build type error fixed; "the prototype loop is complete" |
| 13 Oct | Freeze | `aafd6a2` | Frozen note; pointers to the new repos |

### 2.3 How it works, end to end

**Plain language.** The fictional product tells Scout which operations exist and how to check each worked. The admin records a workflow by using the product while Scout listens, marks which values change per run (the email), and saves it. A saved workflow stays off until it replays successfully from a clean start. A visitor then asks in chat or by voice. A server-side model only *chooses*: a workflow and values, an answer, a question back, or a refusal. The browser re-checks that choice and runs the workflow itself, saying what it is about to do and proving each step on screen before the next.

**Technically, in order.**

1. **Binding.** `ProductDashboard` calls `useScoutBinding({ actions, verifiers, reset, mergeConsecutive, narrate, locate, typing })` every render. The provider publishes it into `bindingRef` in `useLayoutEffect`, after React commits, so Scout always calls the committed UI's handlers.
2. **Human path.** Manual controls call `perform(step)`: interrupt pending work, dispatch through the latest binding, await the verifier, show failures, and while recording append `{ step, result }`. A result superseded by a newer action is dropped.
3. **Teach (`/configure`).** "Reset & record" resets and starts an empty log. `appendRecordedEntry` merges consecutive successful edits of a mergeable action (16 keystrokes become one `invite.setEmail`). Failed entries are kept with ✕ and can't be saved.
4. **Review.** Title, purpose, example requests, steps to keep, narration per step (pre-filled from the binding), closing line, and which recorded values become inputs (`collectRecordedValues`). `declareInputs` replaces **every** occurrence of a ticked value with `{ $input: name }`, so the typed email and the expected email become one input; the recorded value is kept as `example`. Id `<slug>-<base36 time>`, `version: 2`, `enabled: false`.
5. **Validate.** Unguided replay from Reset with example values. Only if every step verifies does it become enabled; a failure names the step.
6. **Ask (`/demo`).** `sendMessage` interrupts everything, assigns a request id, and POSTs `{ message, history (last 8 turns), workflows (enabled catalog, no example values), facts }`.
7. **Decide (server).** `readScoutRequest` checks shape and limits; `buildInstructions` assembles rules, facts and catalog; one `responses.create` with a strict schema returns `{ kind, workflowId, inputs[{name,value}], message }`; the pairs become a record; `readDecision` checks it against the sent catalog.
8. **Re-check (browser).** Replies for old request ids are dropped. `readDecision` runs again against what is enabled **now**; `resolveWorkflow` fills placeholders. `answer`, `clarify`, `unsupported` are shown and spoken; `run` states intent ("Inviting priya…") and starts the runner.
9. **Guided run.** Per step: 250 ms pause (not before step 1); spotlight `binding.locate(step)`; show and speak `step.narration ?? binding.narrate(step)`, waiting for the voice (max 8 s) or a reading pause; if `binding.typing` names a field, execute growing prefixes 45 ms apart (not verified); execute the final value; verify. Any failure stops with "Step N (action) failed: …".
10. **Close.** Say `workflow.outcome` (filled) or "Done: <title>.", with steps verified, model time, time to first verified change, and total time.

### 2.4 Code map at `aafd6a2`

| Area | Files | Role |
|---|---|---|
| Routes | `app/page.tsx`, `app/dashboard/page.tsx` (`dev`), `app/configure/page.tsx` (`configure`), `app/demo/page.tsx` (`demo`), `app/api/scout/route.ts` (`POST`), `app/api/scout/check/route.ts` (dev-only `GET`) | Thin. Server Components pass only serializable data (`Workflow[]`, `string[]`) to the client `ScoutProvider`. Functions can't cross that boundary, so the product publishes its binding from a client component. |
| Product | `components/dashboard/ProductDashboard.tsx`, `types.ts`, `customers.ts` | State, operations, six fictional customers |
| Core (React-free) | `lib/scout/core/contracts.ts`, `dispatcher.ts`, `wait-for-condition.ts`, `runner.ts`, `inputs.ts`, `recorder.ts`, `decision.ts`, `workflow-store.ts`, `core.test.mjs` | The future SDK core |
| React runtime | `lib/scout/react/ScoutProvider.tsx`, `ScoutPanel.tsx`, `ScoutChat.tsx`, `ScoutSpotlight.tsx` | Session controller, dev panel, chat, spotlight |
| Binding | `lib/scout/bindings/dashboard/actions.ts`, `verifiers.ts`, `workflows.ts`, `facts.ts`, `presentation.ts` | What a client would write or configure |
| Browser | `lib/scout/browser/speech.ts` | Web Speech API wrapper |
| Server | `lib/scout/server/model.ts`, `decide.ts` | The only model choice and only `openai` importer; the decision call |

Dependencies: `bindings → core`, `react → core`, server `→ core`, product `→ react + bindings`. Nothing in `core` imports React or the dashboard.

**Modes** (a `ScoutProvider` prop, not authentication; separate mounts share only `localStorage`): `/configure` shows Stop, Reset demo, Teach, Workflows (Run, Validate, Delete); `/demo` shows Stop, Reset demo, chat; `/dashboard` (`dev`) shows everything.

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

**`ok: true` means different things:** from an adapter handler or `dispatchAction`, accepted (a React update was requested); from a verifier, the expected UI is visibly rendered; from `perform` or a runner step, accepted, verified, and still the current action or run.

**Workflow rules.** v2 has inputs; v1 (id, title, steps) is upgraded in memory on load. Placeholders are one-key objects `{ $input: "email" }` anywhere in `input` or `expect`. `resolveWorkflow` fills a copy before every run and rejects a declared input without a non-blank value, a value for an undeclared name, and a placeholder naming an undeclared input. It also fills `{name}` in `narration` and `outcome` (unknown names stay). The runner and verifiers never see placeholders. Input names match `^[a-z][A-Za-z0-9]*$`. `readDecision` *drops* undeclared input names while `resolveWorkflow` *rejects* them, deliberately.

### 2.6 The dashboard binding (the example of tier-2 integration)

| Action ID | Input / expect | Adapter rejects unless | Verifier confirms |
|---|---|---|---|
| `navigation.open` | `{ section }` | section is one of the four | One heading with that text; exactly one pressed nav button, the enabled target |
| `invite.open` | none | Settings is shown | "Panel ready": heading, one enabled opener with `aria-expanded="true"` and `aria-controls="invite-panel"`, one panel, visible enabled fields |
| `invite.setEmail` | `{ email }` | Settings and panel open | Panel ready, input value equals `email` exactly, not read-only |
| `invite.setRole` | `{ role }` | role is Member or Admin, panel open | Panel ready, one enabled matching option, select value equals `role` |
| `invite.submit` | `expect: { email, role }` | Settings and panel open | Exactly one row for the normalized email reading `"<role> · Pending (simulated)"`, Settings heading, panel gone, opener `aria-expanded="false"` |
| `customers.search` | `{ query }` | Customers is shown | Customers heading; one enabled `#customer-search` with exactly that value; every listed name matches; count text agrees with rows |

- `dashboardMergeConsecutive = ["navigation.open", "invite.setEmail", "invite.setRole", "customers.search"]`; `dashboardTyping = { "invite.setEmail": "email", "customers.search": "query" }`.
- Built-in workflows: `invite-teammate` (inputs `email`, `role`; five steps; outcome line) and `find-customer` (input `query`; two steps).
- **DOM markers verification depends on** (renaming any breaks it): `data-scout-navigation`, `data-scout-section`, `data-scout-section-heading`, `data-scout-invite-open`, `data-scout-invitations`, `data-scout-invitation`, `data-scout-invitation-email`, `data-scout-invitation-details`, `data-scout-customers`, `data-scout-customer`, `data-scout-customer-name`, `data-scout-customer-count`, and ids `invite-panel`, `invite-email`, `invite-role`, `customer-search`. In effect the first **tier-1 hints** (§6).
- **Facts** (`facts.ts`, nine strings): the fictional "Scout Sandbox"; four sections (Overview and Analytics are placeholders); Settings manages the team; invitations are simulated (no email, cleared on reload or Reset); roles are exactly Member or Admin, with their rights; one pending invitation per email, ignoring case and spaces; Customers has plans (Starter, Growth, Enterprise), owners and name search; Scout can't change real accounts or send email. Recording never teaches facts.

### 2.7 Architecture invariants, and why each exists

| # | Invariant | Why |
|---|---|---|
| 1 | **Accepted is not done.** `ok: true` from dispatch means accepted. Only a verifier that sees the expected UI counts. Setter calls, delays, narration and typing prefixes are never evidence. | React renders after the handler returns. A demo that claims unseen success lies to the visitor. |
| 2 | **Await each step's verifier before the next dispatch.** | Stale closures: dispatched back to back, `submit` runs the old binding and sees `inviteEmail = ""`. Awaiting the verifier proves the next render committed and its binding was published. |
| 3 | **Publish only the committed binding** (`useLayoutEffect`, never during render). | Handlers close over their render's state; writing the ref during render violates `react-hooks/refs` and may publish a render React discards. |
| 4 | **Registration defines access.** Only registered action IDs (own properties; `toString` and other prototype keys rejected) with validated input. | The model must never reach code, URLs or selectors. |
| 5 | **Product rules stay in the product.** Format, normalization and duplicate rejection live in `submitInvitation`; the adapter checks only input shape and screen state. | One behavior for people and Scout; repeated runs can't duplicate. |
| 6 | **One path for people and Scout:** same operations, dispatcher and verifiers. | No second, divergent implementation. |
| 7 | **Product operations never cancel Scout work.** Cancel calls `interrupt()` explicitly; Scout's Reset interrupts, then calls `binding.reset`. | A successful submit closes the panel; if closing cancelled, submit would abort its own check. (Also fixed a `react-hooks/refs` error.) |
| 8 | **Waiting belongs to Scout.** Product handlers stay synchronous and never await Scout. | Product code stays ignorant of Scout; sequencing, timeouts and cancellation live in one place. |
| 9 | **Dispatch doesn't record.** Only human `perform` calls in an explicit teach session are recorded; the runner calls `execute`. | Replay must never record or interrupt itself. |
| 10 | **Saved workflows are untrusted on load** (shape check, bad entries skipped) and **enabled only by a successful replay from Reset.** | Storage can be edited or stale; a recording can be broken. |
| 11 | **Verifiers are scoped and strict.** Only inside the provider's root `<div>` (Scout's UI renders outside it); fixed selectors; step data compared as text, never put in a selector; zero or several matches for a unique target fail; absence means "not yet" (time out, don't fail at once). | Scout's panel must never satisfy a check; no selector injection; ambiguity stops a run clearly. |
| 12 | **Bounded verification.** Poll every 50 ms, at most 2 s by default, abortable, every timer and listener cleared once; polling only while a check is active. | No idle cost, no hang, no leaks. 50 ms and 2 s are settings, not measurements. |
| 13 | **One controller owns requests, runs and narration**, using identities (request ids, `AbortController`s, per-session mic identity) to ignore stale replies, timers and speech callbacks. | Late callbacks from replaced work caused real bugs (stuck mic). |
| 14 | **Stop, a new request or the mic cancels pending work and speech first.** A human click does **not** silence narration. | Runs call `interrupt()` too; silencing there would cut Scout's own "about to do X". |
| 15 | **Cancellation doesn't undo completed actions.** Read the current UI before continuing. Reset cancels, restores demo data, keeps saved workflows. | Undo isn't generally possible in a client's product. |
| 16 | **The model only chooses** an enabled workflow and declared inputs, answers from facts, clarifies or declines. Its JSON is validated on the server and rechecked in the browser against the catalog enabled at that moment. | Types don't exist at run time; the catalog may change mid-request. |
| 17 | **Narrate intent before acting; claim success only after verification.** | Honest demos. |
| 18 | **Credentials stay on the server.** `server/model.ts` is the only model-SDK importer; only routes import it. | The key must never enter the browser bundle. |
| 19 | **Browser storage is same browser and origin only**; it doesn't publish workflows to others. | Hence Scout Cloud. |
| 20 | **The invitation is simulated and labelled so.** | No real email or side effects in a demo. |

### 2.8 Verification record

"Ayush" means Ayush ran the check and reported it. "Agent" means the coding agent ran it.

| Check | Result | Who, when |
|---|---|---|
| Invitations added with selected roles | Works | Ayush, 5 Oct |
| Browser UI after the latest-handler hook | "Working as before" | Ayush, 7 Oct |
| `npm run lint` after the field-verification patch and lint fix | Clean | Ayush, 7–8 Oct |
| Runner: invite end to end; run twice (duplicate stops at step 5); Stop mid-run; manual click mid-run. Core/binding split: repeated manual invites listed correctly | Works | Ayush, 8 Oct |
| `npm run lint` after step 3 | Clean | Ayush, 8 Oct |
| Recording; broken workflow stays disabled after Validate; save → reload → listed → Validate → enabled → Run. Declared inputs: email and role become inputs; Validate with recorded values; blank input rejected; v1 still loads | Works | Ayush, 8 Oct |
| `GET /api/scout/check` | `ok`, 13 tokens in / 5 out; first call 3,619 ms (warm-up), then about 1.5 s average | Ayush, 11 Oct |
| Chat: "what can you do?"; "show me customers"; "add prakhar@c.com as Admin"; "add me@Me.com as member" | Answer from facts (model time 2,160 ms); ran the recorded "show any customer", 2 steps verified (2,853 ms); 5 steps verified each (2,070 / 2,751 ms) | Ayush, 11 Oct |
| First-loop cases: missing input → clarify; unsupported; duplicate fails at step 5; Stop or new message mid-run; Reset during a request | Pass ("1–3 are fine") | Ayush, 11 Oct |
| Voice on `/demo` after the stuck-mic fix; guided demos | Work | Ayush, 11 Oct |
| `npm run lint`; `npm run build` (TypeScript, 7 routes); `npm test` | Clean; passes; 16/16 | Agent, 11 Oct |
| `npm test` re-run on Node v22.23.2 | 16/16, about 182 ms | Agent, 13 Oct |

The 16 tests cover runner order and stop at first failure, rejected action, missing verifier, cancellation, typing, `beforeStep`, input resolution, `fillText`, decision checks, request checks, recording merge, `declareInputs`.

**Never run** (do not claim): the submit-verification matrix (valid, duplicate, invalid, Reset) as separate checks; failure paths (timeout, missing, ambiguous or disabled target, rapid replacement, unmount); the built-in "Find a customer" alone (search ran only through a recorded workflow); the planned ~15-case decision comparison; any test of `dispatchAction`, `waitForCondition`, `isVisible`, the workflow store, `collectRecordedValues`, `createWorkflowFromRecording`, `toCatalogEntry`, cancellation during a pause, `beforeStep` or typing, or the DOM verifiers.

### 2.9 Measured latency

Single-machine runs, not a benchmark:

- **Tiny model call** (`/api/scout/check`): 3,619 ms first, then about 1.5 s average.
- **Decision model time** (`modelMs`, 11 Oct): 2,160 / 2,853 / 2,070 / 2,751 ms for the four chat cases in §2.8, so about 2–3 s. End-to-end times weren't measured; the first-change and total breakdown came later (`198cdfe`) and no measurement with it is recorded.
- **Prompt size:** about 670 tokens with two workflows (reported in the planning conversation, not in the verification record). Prompt caching is irrelevant at this size.

Rule carried forward: report latency only from measured runs, keeping model time, first visible change, completion, speech and pacing separate. Pacing (250 ms guided, 300 ms unguided between steps; 45 ms per typed character) and narration waits are presentation time, not latency.

### 2.10 Known limits at the freeze

- **Input values aren't constrained.** `role` accepts any text until the adapter rejects it at run time. Fix planned: allowed values per input, told to the model (now `allowedValues` in `API_CONTRACT.md`).
- **Same browser only.** No export/import; no cross-tab sync (no `storage` listener).
- **Smaller gaps:** Finish during verification drops the last edit; validation's one-macrotask yield after Reset is ordering, not proof (step 1's verifier is); no step-log viewer, so a malformed submit `expect` shows only after dispatch; recorded labels are raw (`label = name`); the spotlight is measured once per step (no scroll or resize tracking, caption not clamped right or bottom); Stop is disabled while Scout is only speaking (Reset silences it).
- **No auth.** Modes aren't authentication; `/configure` and the paid `/api/scout` are unprotected.
- **Request limits:** more than 20 enabled workflows, or any chat turn over 1,000 characters, makes the server return 400 for the whole request.
- **Reset wipes demo data** only because the dashboard is fictional. A client's app can't be wiped. Designed, not built: each workflow saves **starting conditions** (screen, required targets), Scout navigates to them before a run, and validation runs in a sandbox or demo account.
- **Voice** depends on browser support and was tested on one browser (§7.3).
- **Core edge cases** (from reading the code): exceptions from action handlers, `beforeStep` or verifiers aren't caught; a `readCondition` that throws on a tick resolves only at timeout; `collectRecordedValues` doesn't traverse arrays; `declareInputs` can replace short values inside unrelated narration words; `readScoutRequest` doesn't check duplicate catalog ids or input-name syntax; `readDecision` doesn't limit value length.
- **Runtime edge case** (`speech.ts`, `ScoutProvider`): the intent line and step 1's `speakAndWait` share the 8 s cap, so a long intent line can cut step 1's wait short.
- **Open question:** how much a client must declare (actions, checks, teaching events) versus what Scout can discover from the UI. The UI recording experiment and Argo CD rehearsal were meant to answer it; it is now the centre of tier 0 (§6).

### 2.11 Bugs, mistakes and lessons (never repeat these)

| # | What happened | Cause | Fix | Rule now |
|---|---|---|---|---|
| 1 | `c7ed7e4`, `d7030be`, `a5e50c6`, `6d40887` don't build | A page was committed before the component it imports (`545e650`) | Later commit added the component | Never commit a file before what it imports |
| 2 | `a8d2caa` doesn't compile | Unfinished `export type WorkflowStep<>;` committed | `df727cd` removed it | No half-finished commits; don't bisect onto `a8d2caa` |
| 3 | `npm run build` broken from `f48e192` (8 Oct) to 11 Oct, unnoticed | `notConnected: ActionResult` then reading `.error` (only on `ok: false`). The dev server doesn't type-check | `198cdfe` typed it `{ ok: false; error: string }` | Run the real type check before calling a step done. Ayush's 11 Oct "build" pass conflicts with this: a reported pass must name exactly what ran |
| 4 | Lint errors `react-hooks/refs`, `prefer-const` (7 Oct) | `submitInvitation → closeInvitePanel → cancel → ref` traced through a factory called during render | Cancellation removed from `closeInvitePanel`, made explicit in Cancel and Submit; `const` timer | Invariant 7 |
| 5 | Stale registry in `executeAction` (7 Oct) | A per-render snapshot captured old handlers | Latest-handler hook with `useLayoutEffect` (`c691ada`) | Invariant 3; fresh handlers alone don't make consecutive calls safe (invariant 2) |
| 6 | Stuck mic on `/demo` (11 Oct) | A failed `recognition.start()` or a late `onend` from an old session left `isListening` true or a dead stop function in the ref | `active` flag on every callback; `start()` in try/catch; stop runs once; each session has an identity; the ref is cleared only if it holds this session's stop, stored only if the session didn't end synchronously (`cab82c1`) | Every async callback needs an identity or guard |
| 7 | Chrome sometimes never fires speech `end` | Browser behavior | `speakAndWait` also resolves on error, abort or 8 s timeout | Always bound speech waits |
| 8 | "Scout just clicks"; not smooth like Supersonik (Ayush, 11 Oct) | Narration didn't guide | Guided demos (`b055bfa`) | Presentation matters but is never evidence |
| 9 | PNG/SVG diagrams added and deleted six minutes later (`15bd089`, `efdb8e2`) | Image diagrams aren't editable | Plain-text diagrams | Text diagrams in Markdown; PNG previews only in `/tmp` |
| 10 | Docs became patch history | Narrative piled up in status files | `c08afac`: status only in `SCOUT_CONTEXT.md`, design in HLD/LLD | Docs trimmed and non-redundant |
| 11 | A demo run-sheet was committed | Presentation script in the repo | Deleted and removed from history | No run-sheets in git |
| 12 | Standing commit authorization (7 Oct) | Ayush wanted to review applied code first | Revoked the same day | Ask before every commit; "commit" said explicitly |
| 13 | Docs drifted from code (§2.12) | Docs not updated with code | Not fixed (frozen) | Update design docs at each checkpoint; don't copy the drift |

### 2.12 Where the frozen docs disagree with the frozen code (don't copy these)

- `CLAUDE.md`/`AGENTS.md` say there is no test runner; `npm test` exists.
- `AGENTS.md` says to tell Ayush what to run; on 11 Oct he let the agent run lint, build and tests (the decision governs). It still calls `/configure` and `/demo` "planned".
- `SCOUT_CONTEXT.md`: a stale "`npm run build` | Not run" row; "Declared inputs: Written, untested" contradicts the 8 Oct passes; the 11 Oct decision says reasoning effort `none`, but the decision call uses `DECISION_EFFORT = "low"` (only the check route uses `none`); decisions out of date order; the superseded Haiku entry sits after 11 Oct entries.
- HLD: §1 "Workflow (planned)", §5 and §7 headings "(planned)" though built; §6 "will be stored"; §8 says "Two ways" but lists four; glossary names pre-split files (`dashboard-adapter.ts`, `waitForDashboardInvitation`).
- LLD: §1 file tree misses many files and says five actions (six); §2 types miss `narration`, `outcome`, `narrate`, `locate`, `typing`, the chat and decision types; §3 omits customer query state; §4 merge list omits `customers.search`; §10 says `stepPauseMs: 600` (code: 250 guided, 300 unguided); §12 says `version === 1` and `isSavedWorkflow` (code: v2, upgrades v1, `readSavedWorkflow`); §13 marks model-supplied values "Planned" (built in §15).
- The selector list in `CLAUDE.md` and LLD §6 omits `customer-search`.

### 2.13 TypeScript and test-tooling lessons for the new repos

- Node 22.18+ strips types, so `node --test` imported `.ts` files directly with no test dependency. This works only when all imports are `import type` (erased); a value import without a file extension fails under Node's ESM resolution. `workflow-store.ts` (value import of `./inputs`, uses `window`) couldn't be tested this way.
- The prototype's `tsconfig.json` had `moduleResolution: "bundler"`, `isolatedModules`, `strict`, `noEmit`, but **not** `verbatimModuleSyntax`, `erasableSyntaxOnly` or `allowImportingTsExtensions`, so only review enforced strippable code. Its `include` didn't cover `.mjs`, so the test file was never type-checked. `@types/node` was ^20 on Node 22.
- PROPOSED for `scout-js`: `verbatimModuleSyntax` and `erasableSyntaxOnly`; `.ts` extensions with `allowImportingTsExtensions` or a runner that resolves extensionless paths; a real type-check script that is actually run, independent of a production build (exact commands: `scout-js/docs/SDK_DESIGN.md` §13, `scout-cloud/docs/CLOUD_DESIGN.md` §10).

## 3. Supersonik: the interaction reference, analysed in depth

Sources: `https://supersonik.ai/docs/client-api` (API v1), read 13 Oct 2026 (page then said last updated 2026-10-09) and re-read 14 Oct (now last updated 2026-10-13); `https://supersonik.ai/platform` and `https://supersonik.ai/docs/slack` (13 Oct). Everything below is what those pages document, unless marked INFERENCE.

### 3.1 Hosts

`api.supersonik.ai` server API (secret key); `app.supersonik.ai` demo pages (`/d/<slug>`, `/d/<token>`); `embed.supersonik.ai` widget loader (`/v1/loader.js`); `embed-api.supersonik.ai` the widget's browser API.

### 3.2 Four delivery options

| Option | How | Details |
|---|---|---|
| **A. Plain link** | `https://app.supersonik.ai/d/<slug>` | Slugs and URLs come from `GET /v1/client/launch-configs` |
| **B. Iframe** | `https://app.supersonik.ai/d/<slug>/embed?native=true` | "The embed page can be framed from any domain. There is no allowlist to configure on our side." Needs `allow="microphone; fullscreen"`, `allowfullscreen`, HTTPS, and a host `Permissions-Policy` that allows the microphone. A wrapper `div` controls height; the frame posts `{ source: 'supersonik-embed', type: 'RESIZE', height }` and the host must validate `event.origin` and `event.source`. Layout breakpoints around 968 px and 1200 px; `disableRedirect=1` with `native=true` |
| **C. Contextualized link** | `POST /v1/client/demos { demo_url_slug, context }` → `201 { id, token, url }`, `url = https://app.supersonik.ai/d/<token>` | `context` is any JSON, max 32 KB, max 5 levels deep, immutable; the link is reusable and doesn't expire while the demo is published; no `/embed` variant; legacy `/d/c/<token>` still works |
| **D. Voice and chat widget** | Queue stub plus loader script (below), copied from an "Install" screen in their app | Floating launcher on the client's own site. The snippet carries only `data-launch-config-slug` (a public slug) and appearance attributes. No key appears, and no allowlist or origin restriction is documented for the widget |

**Loader snippet (option D).** A queue stub, then the async loader:

```html
<script>window.supersonik = window.supersonik || function () { (window.supersonik.q = window.supersonik.q || []).push(arguments); };</script>
<script async src="https://embed.supersonik.ai/v1/loader.js" data-launch-config-slug="..." data-position="bottom-right" ...></script>
```

Attributes: `data-launch-config-slug`, `data-launcher-label`, `data-position` (`bottom-right` or `bottom-left`), `data-colors` (JSON, e.g. `{"primary":"#..."}`), `data-accent-color`, `data-language`, `data-locale`, `data-memory-mode` (`manual` or `automatic`), `data-memory-storage-key-prefix` (default `supersonik`). The stub queues calls made before the script loads; the loader replays them.

**Runtime commands:**

- `supersonik('language', 'es-ES' | 'auto')` sets or resets the language.
- `supersonik('appearance', { locale, colors, launcher_label, position, accent_color })` changes appearance; `null` clears a value.
- `supersonik('identify', { memory_id, email })` attaches identity; `supersonik('resetIdentity')` forgets it.
- `supersonik('memory', { consent: true | false })` records consent for automatic memory.

**Theming.** About 30 colour roles: `background`, `surface`, `text`, `muted_text`, `border`, `shadow`, `primary`, `primary_text`, `primary_hover`, `control_*`, `placeholder`, `focus`, `link`, `visitor_*`, `speaking`, `listening`, `microphone_*`, `danger*`, `warning*`, `launcher_*`, and a screen-share backdrop role.

**Language and locale.** Language from `navigator.languages` unless set; locale from `<html lang>`; right-to-left layout for `ar`, `fa`, `he`, `ur`.

**Memory.** Off by default. *Manual*: the client passes an opaque `memory_id`. *Automatic*: needs consent; stores a random id in `localStorage` under `<prefix>:memory:<scope>:<launch-config id>`. Same browser and origin only; no cookies or fingerprinting; stores a summary, not transcripts. "A memory identifier is not authentication: anyone who obtains it can present it to your public agent." They treat the agent as public.

**CSP for the widget.** `embed.supersonik.ai` in `script-src`, `img-src`, `font-src`; `embed-api.supersonik.ai` and a media host in `connect-src`.

### 3.3 Server ("client") API

- `Authorization: Bearer <API_KEY>`. The key is issued by the Supersonik team (not self-serve), organisation-scoped, and explicitly a server-side credential: never in browsers or public repos.
- Errors `401`, `404`, `422`, `500` with `{ error, detail }`. Rate limits are given by their team on request; none are documented for the widget or embed.

| Endpoint | Purpose and details |
|---|---|
| `GET /v1/client/launch-configs` | Screen-sharing demos only; `status` `published` or `testing` (runs of a `testing` config are recorded as type `test`); not paginated |
| `POST /v1/client/demos` | Create a contextualized link (option C) |
| `GET /v1/client/demos` | List sessions. Query: `page`, `limit`, `start_time_from`/`start_time_to` (inclusive), `demo_type` `prod`\|`test` (repeatable; default `prod`), `validity` `valid`\|`invalid`\|`unknown` (default valid + unknown). Newest first. **Incremental sync:** store the latest `start_time` seen, query from it, de-duplicate by `id` |
| `GET /v1/client/demos/{id}` | Adds `agent_config_version` (can be permanently null on a demo), `params` (merged with pre-demo form values), `demo_context`, `participants`, `insights` (`[{ slug, name, output_type, value }]`), `transcript_url` |
| `GET /v1/client/demos/{id}/transcript` | `messages: [{ role, content, timestamp, source }]`; `role` is the agent's configurable display name or, for the prospect, the literal `'Participant'`; `source` is `voice` or `chat` |

- **Personal data** (params, demo context, participants, transcripts) appears only in detail endpoints; list endpoints omit it.
- **Query parameters on demo links:** `utm_*`, `email`, `utm_email` (hashed, used as a memory key).
- **HTTP tool context templating:** `{{context.*}}` with allowlisted parameters.

### 3.4 Slack app, MCP, platform claims

- **Slack app:** `/demo` creates a personalised link; Supersonik DMs when a prospect finishes, updating the message as insights are processed. A Slackbot works through the Supersonik MCP server.
- **Platform claims:** agents "understand intent, operate your real product, and explain it live"; "ClickTypeScroll"; insights across transcripts; simulate difficult sessions and turn findings into regression tests; access and data controls; multi-region.

### 3.5 INFERENCE: what Supersonik actually runs

- Their main demos are **hosted "screen-sharing demos"**: Supersonik runs the product in **its own browser session** and streams it (launch configs are "screen-sharing demos"; there is a "screen-share backdrop" colour role).
- So there is **no SDK inside the client's product**; their "SDK" is the widget loader plus the server REST API. An in-product tier 0 therefore targets a **different use case**: onboarding and adoption for logged-in users, where Pendo, WalkMe and Appcues compete.
- **Abuse control is server-side, not by origin.** The embed is framable from any domain, the widget needs only a public slug, and memory ids are not authentication, so Supersonik appears to rely on server-side controls (rate limits, absorbing its own costs) rather than an origin allowlist. Scout followed that: D1 (§6.3) runs with no origin allowlist, bounded by a $4 hard monthly cost cap, and an allowlist is added later only if required (Ayush, 14 Oct; contract §2.2).

### 3.6 What we borrow

| Supersonik idea | Scout equivalent (see `API_CONTRACT.md`) |
|---|---|
| Queue-stub loader + `data-*` config + documented CSP | `window.scout` stub, `cdn.scout.example/agent/v1/loader.js`, `data-project-key` and friends |
| `testing` vs `published` | Validate/enabled becomes revision statuses `draft → testing → published → retired` |
| `agent_config_version` per session | `configVersion` pinned per session, plus `revision` and `agentVersion` |
| Server-side contextualized links, immutable context | `POST /v1/client/links` (Release B) |
| Sessions, transcripts, insights API; incremental sync | `/v1/client/sessions`, `/transcript`, insights |
| Consent-based visitor memory | Reserved `scout('memory', { consent })`, later |
| Slack notifications, MCP server | Later (open in the contract) |
| Simulated difficult sessions as regression tests | Later: replay failed or stored requests against a new revision's catalog and require them to pass before publish. Not in Release A |
| HTTP tools with `{{context.*}}` (the agent calls client endpoints mid-demo) | **Not in v1.** A model decision would trigger server requests, against "the model only chooses". If ever added: admin-defined, allowlisted endpoints, context passed as data, never templated by the model. Open (`CLOUD_DESIGN.md` §13) |
| Pre-demo form merged into `params` | PROPOSED, open, for Release B lead capture: values stored in the session's `params`, readable through the Client API. Not in Release A |
| Insights across transcripts | Later: per-session insights first (after Release A), cross-session analytics in the console or an MCP server after. Open (`CLOUD_DESIGN.md` §13) |

## 4. Aman's review (11 Oct) and what followed

1. **Clients may not bring an engineer** to install an SDK unless it is very good.
2. Compare three approaches: **SDK**, **Browserbase** (hosted cloud browser), **Chrome extension**.
3. **Figure out what Supersonik does** (done, §3: hosted browser, INFERENCE).
4. **Browserbase login persistence:** he said 30 days. Browserbase's docs say Contexts persist indefinitely, but websites can still expire their own logins, so Scout must detect a logged-out page and re-authenticate.
5. **Some clients want a Scout widget** on their site.
6. **Add an auth layer** (Clerk or Google OAuth) to rehearse login walls, in the rehearsal app after the prototype. Irrelevant to the in-product SDK (it runs in an already logged-in app); relevant to hosted browsers, extensions, and protecting the console and paid decision endpoint.
7. **Ask Supersonik's own chat** how a company with no engineers sets it up. (Not recorded as done.)

A combination that came out of it: a **Chrome extension for admin teaching** plus a **hosted browser for visitors**.

**Browserbase notes** (from its docs; Stagehand's API not verified): **Contexts** store a Chromium user-data directory (cookies, `localStorage`, IndexedDB) until deleted; `persist: true` saves on close; avoid concurrent sessions on one context; one context per site per login. **Live View:** `bb.sessions.debug(id)` returns `debuggerFullscreenUrl`, an embeddable iframe, view-only with `pointer-events: none`, `navbar=false`. **Control** via Playwright or Puppeteer over CDP; **Stagehand** is their open-source AI automation framework. **Cost** is per session time.

Consequences: lean toward no-engineer approaches for selling (hosted first), keep the SDK for clients with engineers, keep an embeddable widget, and treat UI recording as the bridge to browser and extension approaches. That led to tier 0 and Releases A/B (§6).

## 5. Ways to integrate Scout into a client's product

### 5.1 Taxonomy

| Approach | Client does | Strengths | Weaknesses |
|---|---|---|---|
| **SDK with registered actions** (prototype; tier 2) | Installs packages; registers operations, result checks and human-action events | Most reliable: semantic actions, product-defined checks, no guessing | Needs a client engineer and maintenance |
| **Script tag + visual editor** | Pastes a script tag; an admin teaches in the page | Little engineering | Scout must find targets itself |
| **Recorded UI automation** (tier 0) | Pastes a script tag (or nothing, hosted); admin records | Closest to "client does nothing"; per-client work becomes data | Locator robustness, verification without product checks, framework quirks |
| **Hosted demo browser** (Browserbase-style; Release B) | Provides a demo account | No client engineer or visitor install; works on the marketing site | Per-session cost, login persistence, streaming latency; needs UI automation anyway |
| **Chrome extension** (likely admin-only) | Admin installs it | Teaches on the real site in the admin's own logged-in browser | Too much friction for visitors |

In every approach the Scout team does nothing in client code. Login walls differ by approach: the SDK and script tag run inside the logged-in app, a hosted browser must keep a demo-account login, an extension uses the admin's session. The approaches combine: one runtime can load from a script tag (Release A), be injected into a cloud browser page (Release B), or later by an extension.

Install-pattern reference (Ayush, 4 Oct): Elastic's OpenTelemetry Browser SDK (EDOT Browser) installs into an existing site by script tag or npm and stays light; its purpose (telemetry) differs from Scout's.

### 5.2 The core-versus-binding split

- **Core** (same for every product): runner, bounded verification engine, recorder, input resolution, decision checks, session controller, chat, voice, dispatcher, storage.
- **Binding** (per product): actions (id → operation + input checks), verifiers (id → visible-result condition), teaching events, facts, presentation (`narrate`, `locate`, `typing`).

In the prototype `lib/scout/core` + `lib/scout/react` were the core and `lib/scout/bindings/dashboard` the binding. One shortcut: the product's manual handlers called `perform`, so teaching could see human actions. In a client product, clicks call product operations directly; Scout calls the same operations through the binding and listens for human-action events only during teaching.

### 5.3 How per-client work becomes data

In tier 2 the binding is **code** the client writes. In tier 0 it is **data** Scout records:

| Binding piece | Tier 2 (code) | Tier 0 (data) |
|---|---|---|
| Actions | `invite.setEmail` handler | Reserved generic actions `ui.click`, `ui.type`, `ui.select`, `ui.check`, `ui.press`, `page.navigate`, handled by `@scout/agent` |
| Target | Inside the handler | A recorded **locator**: several descriptions of the element (strategies `hint`, `role`, `label`, `text`, `near`, `css`), tried in order |
| Verifier | Product-written function | Recorded **checks** (`visible`, `hidden`, `text`, `value`, `url`), confirmed by the admin in review; a click needs at least one confirmed check |
| Teaching events | Product reports them | `@scout/agent` listens to DOM events during an explicit teach session |
| Facts | A file | Entered in the console |
| Presentation | `narrate`, `locate`, `typing` | Narration from review; locate is the locator; typing applies to `ui.type` |

Tier 1 sits between: the client adds `data-scout-*` hints (`data-scout-id`, `data-scout-ignore`, `data-scout-mask`) so tier-0 locators find elements reliably. The prototype's markers show how cheap that is.

## 6. Tiers, releases and the order of work

### 6.1 Repository strategy (DECIDED 13 Oct)

- **`scout-js`** (`github.com/logicallybroke/scout-js`): one monorepo with separate packages per tier, not one repo per tier.

  | Package | Tier | Role |
  |---|---|---|
  | `@scout/core` | all | Framework-free runner, verification engine, recorder, inputs, decision checks. Whether `scout-cloud` imports it or copies the checks is pending (`SCOUT_CONTEXT.md`) |
  | `@scout/agent` | 0 (+1) | Script-tag runtime: teach by element description, replay, generic checks, widget (Web Component, Shadow DOM), chat, voice, guided presentation; reads tier-1 hints |
  | (no package) | 1 | The `data-scout-*` hint convention, read by `@scout/agent` |
  | `@scout/actions` | 2 | Semantic actions in code, one `defineAction` object per action |
  | `@scout/react` | 2 | React adapter for tier 2 (successor of `useScoutBinding`) |
  | `@scout/embed` | Release B | Tiny loader for the marketing-site widget and hosted demos |

- **`scout-cloud`** (`github.com/logicallybroke/scout-cloud`): backend, admin console, decision endpoint, hosted demos.
- **`scout-server-sdks`** (PLANNED, not created): Node, Python and Java clients for the cloud's server API.
- **Code is copied from `scout-demo` with provenance, never moved**; the first import commit names `scout-demo@aafd6a2` (`docs/ORIGIN.md`).
- `@scout` is a working npm scope name: no public package uses it (checked 14 Oct), but ownership is unknown.

### 6.2 Tiers

| Tier | Client effort | How Scout finds and checks things |
|---|---|---|
| **0** | Paste a script tag (Release A) or nothing (Release B) | Recorded element descriptions and recorded checks |
| **1** | Optionally add `data-scout-*` attributes | Hints tried first by tier-0 locators |
| **2** | Register actions and verifiers in code | Semantic actions and product-written verifiers (the prototype's model) |

### 6.3 Releases of tier 0 (DECIDED 13 Oct)

- **Release A (first): in-product.** The client pastes a script tag into their app. Scout records and replays by element description, with widget, chat, voice and guided demos. A minimal Scout Cloud stores workflows, serves config and decides.
- **Release B (after A): Supersonik-like hosted demos.** Scout Cloud runs the product in a cloud browser (Browserbase-style) logged into a demo account, injects the same `@scout/agent` (for example by a Playwright init script), and streams it. Delivered by plain link, iframe, or the `@scout/embed` widget on the marketing site.
- Tier 2 (`@scout/actions`, `@scout/react`) stays available for clients with engineers who want maximum robustness.

**14 Oct plan (DECIDED 14 Oct; status in `SCOUT_CONTEXT.md`).** Release A is split into three demos:

| Step | Promise | Scope |
|---|---|---|
| **D1** | "One script tag or npm install on any React app" | Minimal cloud; workflows as JSON files; no origin allowlist, bounded by a hard cost cap (§3.5). Aman wants an npm package to try in his own or a real client app |
| **D2** | "Works on a classic Java app too, on the full cloud" | Resume after reload, a Spring Boot test app, a database, keys, the allowlist, admin sign-in |
| **D3** | "No engineer needed" | A Release B spike |

Tier 2 is deferred.

### 6.4 Engineering order versus likely selling order

- **Engineering: Release A first.** The runtime can be built and tested locally on apps we control with no cloud-browser cost, and Release B reuses it unchanged. Building B first would mean debugging locators, verification and streaming at once.
- **Selling: hosted first,** because it needs no client engineer (Aman's review).

### 6.5 The client's backend language doesn't matter

Scout lives in the browser. What matters is the **frontend kind**: a single-page app (React, Vue, Angular) or a server-rendered multi-page app. Language-specific SDKs belong on the **server API** side (personalised links, sessions, transcripts and insights into CRMs): `scout-server-sdks`.

### 6.6 Hard problems identified for tier 0

1. **Full page reloads** wipe in-memory run state → persist the run in `sessionStorage` and resume (`scout:<projectId>:run`, `run.resumed` event).
2. **Finding elements without markers** → locators tried in order: hint, role + accessible name, label, visible text, nearby text, CSS path. Fail clearly on none or several matches.
3. **Client CSP** must allow Scout's script and API hosts; document it, as Supersonik does.
4. **Framework-controlled inputs** (React, Vue, Angular): set the value with the native setter, then dispatch `input` and `change`.
5. **Keys and abuse:** a publishable key in the browser (`scout_pk_…`), rate limits and model cost caps, the secret key (`scout_sk_…`) server-only, and an origin allowlist (none in D1; later only if required, §3.5).
6. **Style isolation:** a Web Component with Shadow DOM.

### 6.7 Proposed test apps for the SDK

- A classic **server-rendered multi-page app** (Java/Spring Boot if a JDK is available, otherwise Flask or Express), a **Vite + React + React Router SPA**, and the **scout-demo dashboard** copied and integrated via tier 2 (also a tier-0/1 target, since it has `data-scout-*` markers).
- **Argo CD** later (needs local Kubernetes; ask first, §8). The rehearsal must answer how Scout is mounted, how human actions are observed, and how replay is shown; installing Argo CD alone answers none of them (scout-demo HLD §8).
- For each, measure integration cost (files and lines touched, time, misfits).

## 7. Model, provider, prompt and voice

### 7.1 Provider history

| Date | Decision |
|---|---|
| 8 Oct | **Claude Haiku 5.5** (`claude-haiku-5-5`, $0.10 / $0.50 per 1M tokens), chosen by Ayush, behind a one-line `SCOUT_MODEL` switch. A planned comparison of Opus, Sonnet and Haiku on ~15 decision cases was never run. |
| 11 Oct | **Switched to OpenAI** because Claude API credit wasn't available. **`gpt-6-luna`**: $0.10 / $0.50 per 1M tokens, Responses API, structured outputs, reasoning effort `none` … `max`. Decision effort `low` (`DECISION_EFFORT`); the check route uses `none`. The Anthropic SDK was removed. |
| — | `gpt-5-nano` ($0.05 / $0.40) is cheaper but listed as deprecated. A ChatGPT subscription includes **no** API credit. |
| — | **Jev** (jev-ai.pro): a text-only scoring/classification API, no extraction, answers or voice. **Rejected.** |
| — | **Groq** and **Cerebras**: speed options if latency becomes the bottleneck. |

The model choice lives in one server module; switching provider touches only it and the routes that call it.

### 7.2 What the model receives, and what it doesn't

Sent on every request:
- **Rules** for the four kinds: `run` gives one short intent sentence ("Do not say it is done"); `clarify` when an input is missing or the request is ambiguous; `answer` only from facts; `unsupported` says what Scout can show instead; never invent workflows, inputs, steps, URLs or facts; non-run kinds use `workflowId: null`, `inputs: []`.
- **Facts** (bullet list).
- **Enabled catalog** as JSON: `id`, `title`, `purpose`, `examples` (example *requests*), input `name` and `label`.
- **Last ≤ 8 turns** (visitor → `user`, scout → `assistant`) and the new message.

Not sent: steps, selectors, URLs, code, recorded example values (so the model uses only what the visitor said), anything from the DOM, credentials.

Output: strict JSON schema `scout_decision` with `kind`, `workflowId` (string or null), `inputs` (array of `{ name, value }`, since strict schemas can't have free-form keys) and `message`; `max_output_tokens: 400`.

`readScoutRequest` limits: message ≤ 1,000 characters, non-blank after trimming; history ≤ 8 turns of ≤ 1,000; ≤ 20 workflows (id ≤ 100, title ≤ 200, purpose ≤ 500, ≤ 10 examples of ≤ 500, ≤ 10 inputs with name ≤ 50 and label ≤ 100); ≤ 40 facts of ≤ 500.

In the cloud design the catalog and facts come from the server-side config, not the browser (`API_CONTRACT.md` §5).

### 7.3 Voice

- **Approach:** the browser's **Web Speech API**, no key or server. Press-to-talk (`listenOnce`, `en-US`, no interim results, one alternative) and spoken replies (`speechSynthesis`).
- **Browser caveats:** Google Chrome supports recognition and sends the audio to Google's speech service. Many Chromium builds and Firefox don't. Typing is always the fallback; unsupported browsers get a chat note. Tested only on Ayush's Ubuntu browser (recognition working implies Google Chrome, but the browser wasn't recorded); others are untested.
- **Rules:** voice feeds the same `sendMessage` as typing. The mic, a new message, Stop and Reset cancel narration and pending work first. Speech waits are bounded (8 s) because Chrome can skip `end`. Narration is never evidence.
- **Later:** cloud speech-to-text and text-to-speech (Deepgram, ElevenLabs, OpenAI) would need server-side keys and add a media host to the client's CSP.
- Guided demos were built after Ayush found plain runs "just click"; he confirmed they work.

## 8. Environment

- **Machine:** Ubuntu laptop, 15 GB RAM, 4 GB swap. Swap has filled under load (Chrome ~4.5 GB, VS Code ~2.3 GB, Claude Code ~1.7 GB), causing iowait. **Ask before heavy local stacks** (Kubernetes, Argo CD, many containers).
- **Browser:** Chrome is in use. For voice testing, see §7.3.
- **Node:** v22.23.2. **Package manager:** npm.
- **Workspace:** `~/codes/scout-agent/` holds `scout-demo`, `scout-js`, `scout-cloud` and an unversioned `CLAUDE.md` index. Start sessions there; Claude Code memory is per starting folder, so durable facts live in repo files.
- A stray `/home/ayush-dev/codes/package-lock.json` triggers a harmless `turbopack.root` warning in `scout-demo`.
- **GitHub:** private repos under `logicallybroke`. The agent's shell has no GitHub credentials; **Ayush pushes from his own terminal.**
- **Secrets:** `OPENAI_API_KEY` lived in `scout-demo/.env.local` (git-ignored). Never read or print secrets.

## 9. How we work

Each repo's `AGENTS.md` is the authority: build mode (the agent writes and explains, Ayush reviews and tests), one reviewable step at a time, explicit "commit", never claim an unrun check, trimmed docs. This file adds nothing to it.

## 10. What's next and what is waiting for approval

### 10.1 Next

The order of work is in §6.3–§6.4 and each repo's `SCOUT_CONTEXT.md`. One item recorded only here in detail: **selling Scout** (investor discussion), covering options for selling, competitor research across AI demo agents (Supersonik and similar), interactive demo platforms, digital adoption platforms (Pendo, WalkMe, Appcues) and AI sales assistants, and the prototypes the pitch needs.

### 10.2 Pending approvals

Listed in each repo's `SCOUT_CONTEXT.md` (bundler, database, test framework, how `scout-cloud` consumes `@scout/core`); open product questions (domain, admin sign-in and others) in `API_CONTRACT.md` §7.

## 11. Glossary

Tiers, releases and D1–D3 are in §6; Validate and guided runs in §2.3.

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
| Locator | A recorded, multi-strategy description of an element (tier 0) |
| Check | A recorded visible-result condition (tier 0's verifier) |
| Starting conditions | The screen and targets a workflow needs before it runs (designed, not built) |
