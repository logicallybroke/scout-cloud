# Scout Cloud: context and status

What exists, what is verified, what was decided, and what comes next in `scout-cloud`. Standing rules are in `AGENTS.md`; design is in `docs/`. Only checks that were actually run are marked as passed, with who ran them.

## Goal

Scout gives live software demos: an admin teaches a workflow, a visitor asks by chat or voice, Scout performs it on screen, verifies each step and explains product facts. Scout Cloud is the server side: the API, admin console, workflow and facts store, decision service, sessions and transcripts, and (Release B) the hosted demo runner. The browser runtime is in `scout-js`.

**Plan (Ayush, 14 Oct 2026):** Release A ships as three demoable deliverables (`docs/CLOUD_DESIGN.md` §6, §12):

- **D1 minimal cloud:** decide (the prototype's route, ported, with the server owning catalog and facts), workflows and facts as JSON files, serving `agent.js`, one hard monthly cost cap and a basic rate limit. Hosted, so Aman can test the npm package in his own app.
- **D2 "Works on a classic Java app too, on the full cloud":** database, keys and allowlist, admin sign-in and console, snapshots, sessions and events, Client API, jobs, first real deployment.
- **D3 "No engineer needed":** the Release B spike (cloud browser, injected `@scout/agent`, stream, one demo account).

Likely selling order is hosted first (no client engineer needed); engineering order is D1 → D2 → D3.

## Current state (14 Oct 2026)

- `~/codes/scout-agent/scout-cloud`, `main`, remote https://github.com/logicallybroke/scout-cloud.git. One commit, `1d23756` (initial docs, 13 Oct), pushed to `origin/main` (checked 14 Oct).
- **D1 minimal cloud BUILT on branch `release-a-d1`** (14 Oct): decide, agent config, admin workflows/validation/facts behind the teach passcode, JSON store, $4 cap, rate limits, operator endpoint for creating projects, Railway deploy notes in the README. Not merged to `main`, not deployed. Docs are PROPOSED, awaiting review. They were trimmed and re-planned around D1–D3 on 14 Oct (Ayush's request) and are not committed yet. `docs/API_CONTRACT.md` and `docs/BACKGROUND.md` are identical to the `scout-js` copies.
- The decision service exists only in the prototype (`scout-demo` `app/api/scout/route.ts`, `lib/scout/server/decide.ts`, `lib/scout/server/model.ts`); what comes here and when is in `docs/ORIGIN.md`.
- Siblings: `scout-js` (browser SDKs, initial docs commit `800ea36`, pushed) and `scout-demo` (frozen at `aafd6a2`). `scout-server-sdks` is planned, not created. The unversioned `~/codes/scout-agent/CLAUDE.md` indexes the repos.

## Verification record

Nothing has run in this repository. Measured facts carried over from `scout-demo` (Ayush's single runs on his Ubuntu laptop, 11 Oct 2026, unless noted; not benchmarks):

| What | Result |
|---|---|
| Dev model check (`GET /api/scout/check`, `gpt-6-luna`, effort `none`, tiny prompt) | Reply `ok`, 13 input / 5 output tokens; first call 3,619 ms (warm-up), then about 1.5 s average |
| Decision model time (`POST /api/scout`, effort `low`, strict schema) | About 2–3 s per decision |
| "what can you do?" → answer from facts | `modelMs` 2,160 ms |
| "show me customers" → recorded workflow, 2 steps verified | `modelMs` 2,853 ms |
| "add prakhar@c.com as Admin" / "add me@Me.com as member" → 5 steps verified | `modelMs` 2,070 / 2,751 ms |
| End-to-end time for those cases | Not recorded (first-change and total timings came later, `198cdfe`) |
| Decision instructions size | About 670 input tokens with two workflows (from the planning conversation) |
| Cost per decision | About $0.0001 at $0.10 / $0.50 per 1M tokens (arithmetic) |
| Agent-run in scout-demo | 11 Oct: `npm run lint` clean, `npm run build` passes (7 routes), `npm test` 16/16; 13 Oct: `npm test` 16/16 |

Prompt caching was irrelevant at ~670 tokens; revisit when the catalog grows (contract §2.5 estimates 4–5k tokens). Keep the static part first and history and message last, as the prototype's `decide()` does (`docs/CLOUD_DESIGN.md` §3.3).

## Decisions

| Date | Decision |
|---|---|
| 4 Oct | The model selects an enabled workflow and inputs, answers from facts, or clarifies; its output is validated at runtime; credentials stay on the server. Deterministic execution before any model. |
| 8 Oct | Model chosen in one server module (`SCOUT_MODEL`). The model only decides; the browser speaks. Integration needs no Scout access to client code; workflows save starting conditions and validation runs in a demo or sandbox account. |
| 11 Oct | OpenAI `gpt-6-luna` ($0.10 / $0.50 per 1M), Responses API, structured outputs, replacing Claude Haiku 5.5 (8 Oct) only because Claude API credit wasn't available; switching back is a one-module change, not decided. A ChatGPT subscription includes no API credit. Strict schema `scout_decision`, `DECISION_EFFORT = "low"`, `readDecision` on server and browser. |
| 11 Oct | Aman's review: clients may not supply an engineer, so lean toward a hosted cloud browser for visitors, perhaps a Chrome extension for admin teaching; keep the SDK and a widget; rehearse a login wall. The agent may run lint, build and tests itself. |
| — | Jev (jev-ai.pro) evaluated and rejected (text scoring only). Groq and Cerebras noted as speed options. (Planning conversation; date not recorded.) |
| 13 Oct | scout-demo frozen; work continues in `scout-js` and `scout-cloud`; code copied with provenance, never moved. Tier 0 gets Release A (in-product) then Release B (hosted). Build mode continues (Ayush). The client's backend language doesn't matter; language-specific SDKs belong to the server API (`scout-server-sdks`). |
| 14 Oct | (Ayush) Release A split into D1–D3. D1 keeps workflows and facts as JSON files. Aman wants an npm package to test in his own or a real client app, so the D1 cloud must be hosted. Docs trimmed. One branch per deliverable. |
| 14 Oct | (Ayush) Keep the prototype's stack (Next.js 16, React 19, TypeScript, Tailwind v4, Node 22, npm), as option 3 (`docs/CLOUD_DESIGN.md` §10.1). D1 model key: Ayush's OpenAI API key with a $5 prepaid balance, possibly replaced by one from Aman; set only in the host's environment. Tarball first, npm publish later. |
| 14 Oct | (Agent, delegated by Ayush: "take best decision") D1 host: Railway Hobby, about $5 a month, with a volume for the JSON files. Vercel Hobby (non-commercial only, no disk), Render Free (no disk, sleeps) and Fly.io (more setup) rejected (§6.2). Ayush creates the account and pays. |
| 14 Oct | (Ayush) D1 runs with **no origin allowlist** (like Supersonik's slug-only widget, `docs/BACKGROUND.md` §3); one is added later only if required. Hard monthly cost cap **$4**. Teach saving behind an interim **per-project teach passcode** until D2's admin sign-in. Contract §2.2, §2.6; `docs/CLOUD_DESIGN.md` §6.2. |

## Pending approvals

Blocking D1 first:

1. The C0 dependency install (the stack itself is decided).
2. Ayush creates the Railway account when D1.5 is reached; until then everything runs locally.
3. How scout-cloud gets `@scout/core` once hosted: copy with provenance or a published package (§10.2); the `@scout` npm scope's ownership is unchecked.
4. The server owning catalog and facts (contract §5.1).

Then D2: database and ORM (C1; SQLite through Drizzle suggested), the optional allowlist (q23), sign-in provider (C7; Clerk or Google OAuth), deployment platform (C12), retention defaults, per-project budgets and the global cap, server-built history, real domains for the `*.scout.example` placeholders. D3: the B0 provider account and spend. All other questions: `docs/CLOUD_DESIGN.md` §13 (tagged by deliverable) and contract §7.

## Next steps

1. Ayush reviews the trimmed docs (the contract together with scout-js's SDK design) and says whether to commit them.
2. Settle the D1 approvals above.
3. C0 scaffold, then D1.1–D1.5 (`docs/CLOUD_DESIGN.md` §12), coordinated with scout-js's A11.
4. D2, then the D3 spike.
5. Open items from Aman's review (11 Oct), not done: ask Supersonik's chat how a company with no engineers sets it up; the login-wall rehearsal app (informs C7 and demo-account login capture, §7.6).
6. After the SDK work: the investor discussion (selling options, competitors, the prototypes the pitch needs).
