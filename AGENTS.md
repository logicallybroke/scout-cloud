# Scout Cloud: agent guidance

Standing working agreements and architecture rules for `scout-cloud`. Progress, verification evidence and decisions are in `SCOUT_CONTEXT.md`. The shared contract with the browser SDKs is `docs/API_CONTRACT.md`; the cloud's design is `docs/CLOUD_DESIGN.md`. If this file and `SCOUT_CONTEXT.md` conflict, point out the conflict and follow Ayush's latest explicit instruction.

These agreements were carried over from `scout-demo` (frozen at `aafd6a2`, 13 Oct 2026) and adapted to a backend repository.

## If the stack becomes Next.js

`next dev` appends a Next.js agent-rules block to this file. The block starts with an HTML comment marker named nextjs-agent-rules and the heading "This is NOT the Next.js you know". It lands at the end, since the file already exists; it lands at the top only when Next.js creates the file itself, as in scout-demo's scaffold. See `node_modules/next/dist/server/lib/generate-agent-files.js`. When it appears:

- **Gotcha:** never quote the block's BEGIN or END marker comments anywhere in `AGENTS.md` or `CLAUDE.md`. The generator matches the first occurrence of the BEGIN marker and replaces everything from there to the END marker, so a quoted marker makes the second `next dev` delete most of the file.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code, and heed deprecation notices. The installed version has breaking changes from older Next.js.
- Removing the block only re-creates it as an uncommitted change. Commit it with the work that triggered it (with Ayush's approval, like any commit).

## Before working

- Read `SCOUT_CONTEXT.md`, the docs the task touches, and the source files it touches. Read `package.json` (once it exists) before recommending dependencies, scripts or version-specific changes; keep the chosen stack and lockfile.
- Source code and observed behavior are evidence of what exists; plans and design docs are intent. Don't claim context from other chats; read the notes.
- Sessions should start in `~/codes/scout-agent/` so all repos are visible. Claude Code memory is per starting folder, so anything that must survive goes into repo files.
- `../scout-demo` is frozen history. Read it for provenance; never edit, commit or scaffold there.

## Working with Ayush

Ayush is building Scout while learning Next.js, React, TypeScript and backend work; understanding is part of the deliverable.

- **Build mode** (agreed 8 Oct 2026 for the prototype; Ayush wants it to continue in the new repos): the agent writes each step's code, explains it in plain language first and then technically, and Ayush reviews and tests it. Return to coaching (Ayush implements, agent reviews) only when he asks.
- Explain changes through the feature being built: the request, the validation, the stored data, the response, and what the browser does with it.
- Keep each change to the current step and reviewable in one sitting. No modules for later milestones, no unrelated refactors.
- A request to continue building authorizes editing application files for the current step. Installing dependencies, changing configuration, creating cloud accounts, or anything that spends money (model calls beyond a quick check, cloud browsers, hosting) needs an explicit request. A conceptual question is not a request to implement.
- The agent may run the repo's lint, build/type-check and test scripts itself (granted 11 Oct 2026). For browser or manual checks, tell Ayush exactly what to run and what to look for.
- After each step, report what changed and why, the checks run (and by whom), the checks Ayush should do, and what remains unverified. Never claim an unrun check passed.
- Ask only when the answer changes the next step; resolve routine details yourself.
- Ayush authorizes routine updates to `AGENTS.md`, `SCOUT_CONTEXT.md` and design docs at checkpoints. Never record unbuilt work as implemented.
- Docs stay trimmed and non-redundant: status only in `SCOUT_CONTEXT.md`, standing rules only here, design in `docs/`. No patch-history narratives. No demo run-sheets or presentation scripts in the repo or its history.
- Diagrams are editable plain text in Markdown. PNG previews may go in `/tmp`; no image diagram assets in the repo.
- Ayush likes to see the integration footprint: when a change affects what a client must install, configure or write, say so explicitly.
- Ayush expects complete, careful work ("no gaps, best work"): close known gaps in the current step, or list them explicitly as unverified or open, rather than leaving them implicit.
- Environment: Ubuntu laptop, 15 GB RAM, swap fills easily. Don't start heavy local stacks (Docker databases, Kubernetes, local browser farms) without asking.

## Git

- Do not stage, commit, amend, reset, clean or push without Ayush's explicit request for that operation. Writing or applying code does not authorize a commit; leave changes uncommitted until he has reviewed them and says "commit".
- The agent's shell has no GitHub credentials. Ayush pushes from his own terminal (`origin` is https://github.com/logicallybroke/scout-cloud.git, branch `main`).
- Before committing, read the full files being committed and review tracked, staged and untracked changes (`git status`; `git diff` omits untracked files).
- Prefer focused commits; separate product code from docs and instructions. Messages describe actual behavior, never planned capabilities.
- End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code copied from `scout-demo` is copied with provenance: the commit that imports it names `scout-demo@aafd6a2` and the source paths. It is never moved or deleted from scout-demo.
- `docs/API_CONTRACT.md` and `docs/BACKGROUND.md` each have an identical copy in `../scout-js/docs/`. Change both copies in the same review; before committing either repo, check that `diff ../scout-js/docs/API_CONTRACT.md docs/API_CONTRACT.md` and `diff ../scout-js/docs/BACKGROUND.md docs/BACKGROUND.md` are both empty.
- Never commit a file before what it imports, and never commit code that doesn't compile; each commit should pass the type check on its own (scout-demo's `c7ed7e4`…`6d40887` and `a8d2caa` didn't build).
- Keep generated output, dependencies, databases and credentials out of commits. Don't read or print secrets; read example variable names instead.

## Scope and sequence

Scout gives live software demos: an admin teaches a workflow, a visitor asks for it by chat or voice, Scout performs it, verifies it, and explains product facts. Supersonik is the interaction reference, not an architecture reference.

Scout Cloud is the server side: API, admin console, workflow and facts store, decision service, sessions/transcripts/insights, and (Release B) the hosted demo runner. The browser runtime lives in `scout-js`.

1. Review `docs/CLOUD_DESIGN.md` and `docs/API_CONTRACT.md` with Ayush; nothing is built before approval.
2. **D1 minimal cloud** (Ayush, 14 Oct; `docs/CLOUD_DESIGN.md` §6.2): import the prototype's decide pieces from `scout-demo@aafd6a2` with provenance; decide with server-owned catalog and facts, workflows and facts as JSON files, serving `agent.js`, a hard cost cap and a rate limit; hosted so Aman can test from his own app.
3. **D2** the full Release A cloud: database, keys and allowlist, admin sign-in and console, snapshots, sessions and events, Client API, jobs, first real deployment.
4. **D3** the Release B spike: cloud browser, demo-account login, injected `@scout/agent`, stream to the visitor.

One branch per deliverable; commit after each verified step (only on Ayush's explicit "commit"); merge to `main` when the demo works.

The sequence is a plan, not evidence or a deadline. Make small early checks (model access, a cloud browser session) before full integration.

## Architecture rules

- **Thin routes.** Handlers parse, authenticate, validate, call a focused module, and shape the response. Behavior lives in modules.
- **The browser runs and verifies; the cloud decides and records.** An `ok: true` from an action means "accepted". The cloud never claims a step happened; it records what the browser reported (validation runs are admin-reported evidence in Release A).
- Add infrastructure (queues, WebSockets, vector search, caches, remote browsers) only for a concrete requirement.
- PROPOSED (pending Ayush): keep product-independent logic shared with `@scout/core` (request limits, decision checks, workflow shape checks) by importing it rather than copying or forking it. How is pending (`docs/CLOUD_DESIGN.md` §10.2): a `file:` link works only on the laptop, so the hosted D1 cloud needs a copy with provenance or a published package.
- Names, endpoints and shapes follow `docs/API_CONTRACT.md`. A new name is added there first.

### Keys and access

- **Secret keys are server-only.** Store only a hash; show the key once at creation, then only its last 4 characters. A request carrying a secret key and an `Origin` header is rejected (`403 secret_key_in_browser`) and the key is flagged.
- **Publishable keys are origin-allowlisted.** Every publishable-key Agent API request must carry an `Origin` that exactly matches one of the project's allowed origins. D1 exception (Ayush, 14 Oct; contract §2.2, §2.6): no allowlist, under a $4 hard cost cap and a rate limit; an allowlist comes later only if required. D1's teach saving uses an interim per-project passcode, stored only as a hash. Hosted-session requests (Release B, `docs/API_CONTRACT.md` §3.6) authenticate by session token only, and get CORS only for their experience's `hosted.startUrl` origin (PROPOSED, `docs/API_CONTRACT.md` §2.2). CORS echoes the matched origin with `Vary: Origin`; no cookies, no credentials mode. The allowlist only stops other websites; scripts can fake `Origin`, so rate limits and budgets are the real defence.
- Admin tokens are scoped (project, origin, `teach` or `console`) and expire. Teach scope never manages keys, origins, facts or experiences.
- Resources in another project return `404 not_found`, never revealing that they exist.
- Modes and URL switches (like `?scout=teach`) are never authentication.

### Model calls and cost

- One server module chooses the model and is the only importer of the provider SDK (see `CLAUDE.md`). Provider credentials never reach a browser or a log.
- **Rate limits and cost caps on every model call:** per-session, per-IP and per-project limits, and a monthly model budget per project that returns `429 budget_exhausted` when spent. Request size limits apply before any model call.
- Report latency and cost only from measured runs. Separate model time, first visible change, completion, speech and pacing.

### Runtime validation

- **Validate every request at runtime** (shape, size limits, enums, ids) before acting on it, and every model output before returning it. TypeScript types do not validate anything at runtime.
- Saved and uploaded workflow JSON is untrusted: shape-check on save and on load; check every `$input` is declared and every declared input is used.
- **Never trust browser-sent catalogs or facts** once server storage exists (PROPOSED in `docs/API_CONTRACT.md` §5.1; binding once the contract is approved). The decision catalog and facts come from the session's pinned config snapshot.
- Visitor context from links is data, never instructions, and is passed to the model as such.

### Data, privacy and retention

- Collect the minimum. No cookies, no fingerprinting. Page paths are stored without query strings; only allowlisted query parameters are kept.
- Stored personal data (other sessions' messages, stored run inputs, `visitor.email`, `memoryId`) is never returned to publishable-key or teach-scope callers; it is readable only with a secret key (Client API) or a console-scope admin token. A session's own decide response may echo values from its own message (for example `decision.inputs`). Masked fields never appear in recordings.
- Every stored kind of data (recordings, transcripts, run inputs, sessions) has a stated retention period and a delete path. Retention defaults are PROPOSED in `docs/CLOUD_DESIGN.md` §8.6 (recordings' 30 days also in the contract §3.4) and need Ayush's approval.
- Visitor memory across visits is off by default and needs consent; it is never authentication.

### Schema and storage

- **Every schema change goes through a migration,** committed with the code that needs it, from the first table onward. No hand edits to a shared database.
- Config snapshots and published revisions are immutable. Publishing bumps `configVersion`; sessions stay pinned to the version they started with.
- Local database files and dumps never go into git.

### Hosted demos (Release B)

- A hosted browser is a separate session from the visitor's own browser; it does not control the visitor's browser. Stream it read-only to the visitor unless a design says otherwise.
- One cloud-browser login context per client site and demo account; avoid concurrent sessions on one context; detect a logged-out page and re-authenticate rather than failing silently.
- Demo-account credentials are secrets: server-only, never logged, never sent to the model.
- Cloud browsers cost per session minute: cap session length and concurrency per project.

### Integration claims

- Don't promise zero client code or automatic understanding of arbitrary sites. Client integration is a script tag plus taught workflows (tier 0), optional hints (tier 1), or registered actions (tier 2).
- Teaching saves reviewed workflow data; it is not model training. Product facts and business rules are separate inputs.

## Verification

- Use only scripts in `package.json`. Run the type check (`typecheck` or `build`) before calling a step done; the dev server does not type-check, and a reported pass names exactly which script ran.
- Add focused automated checks for request validation, decision checks, authentication and origin checks, rate limits and budgets, migrations, and stale or duplicate events (`seq`) when practical.
- Before calling a release's cloud slice done, check: invalid and oversized requests, wrong origin, secret key from a browser, revoked key, expired token, rate limit and budget responses, pinned config across a publish, duplicate event batches, and a full decide call against the real model with measured latency.
- Record every check in `SCOUT_CONTEXT.md` with who ran it, when, and the result.
