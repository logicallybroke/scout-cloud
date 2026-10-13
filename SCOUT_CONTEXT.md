# Scout Cloud: context and status

This file is the record of what exists, what is verified, what was decided, and what comes next in `scout-cloud`. Standing rules are in `AGENTS.md`; design is in `docs/`. Only checks that were actually run are marked as passed, with who ran them.

## Goal

Scout gives live software demos. An admin teaches a workflow by performing it; a visitor asks for it by chat or voice; Scout performs it on screen, verifies each step, and explains product facts.

Scout Cloud is the server side: the API (Agent, Admin, Client), the admin console, the workflow and facts store, the decision service, sessions/transcripts/insights, and, for Release B, the hosted demo runner. The browser runtime is in `scout-js`.

- **Release A (first):** in-product. The client pastes a script tag (`@scout/agent`) into their own app. Scout records and replays by element description, with widget, chat, voice and guided demos. Needs a minimal cloud.
- **Release B (after A):** Supersonik-style hosted demos. The cloud runs the client's product in a cloud browser logged into a demo account, injects the same `@scout/agent` runtime, and streams it to the visitor by link, iframe or `@scout/embed`.
- Engineering order: runtime and minimal cloud first (testable locally, reused by B). Likely selling order: hosted first, because it needs no client engineer.
- Ultimate target (from scout-demo HLD §8): seamless installation in client apps, no noticeable performance cost, no Scout-team work in client code.

## Current state (13 Oct 2026)

- Repository created on 13 Oct 2026 at `~/codes/scout-agent/scout-cloud`: `git init` on `main`, remote `origin` = https://github.com/logicallybroke/scout-cloud.git.
- **No code.** One commit: the initial docs-only commit on `main` (13 Oct 2026, Ayush's request), holding the files listed below. Not pushed when this was written; Ayush pushes from his own terminal (`git push -u origin main`).
- Files in the initial commit: `README.md`, `CLAUDE.md`, `AGENTS.md`, this file, `.gitignore`, `docs/API_CONTRACT.md` (PROPOSED, identical to `scout-js/docs/API_CONTRACT.md`), `docs/CLOUD_DESIGN.md` (PROPOSED), `docs/BACKGROUND.md` (identical to `scout-js/docs/BACKGROUND.md`), and `docs/ORIGIN.md` (PROPOSED file map from `scout-demo@aafd6a2`).
- Sibling repos: `scout-js` (browser SDK monorepo, also created 13 Oct; its initial docs commit was made the same day) and `scout-demo` (`prototype`, frozen at `aafd6a2`; pushed to `origin/prototype` on 13 Oct). `scout-server-sdks` (Node/Python/Java Client API clients) is planned, not created.
- An unversioned `~/codes/scout-agent/CLAUDE.md` indexes the repos, so sessions started there see all three. It is not in any repo.

## Implementation status

| Part | Status |
|---|---|
| API contract (`docs/API_CONTRACT.md`) | Written, PROPOSED, not reviewed |
| Cloud design (`docs/CLOUD_DESIGN.md`) | Written, PROPOSED, not reviewed |
| Shared background (`docs/BACKGROUND.md`) | Written, identical to the scout-js copy, not reviewed |
| Import map (`docs/ORIGIN.md`) | Written, PROPOSED; nothing imported |
| Stack, database, scripts | Not chosen (pending approval) |
| Agent API (`/v1/agent/config`, `sessions`, `decide`, `events`) | Not built |
| Admin API and console | Not built |
| Client API (`experiences`, `sessions`, `transcript`; `links` in Release B) | Not built |
| Keys, origins, rate limits, budgets | Not built |
| Decision service | Not built here. Exists in the prototype (`scout-demo` `app/api/scout/route.ts`, `lib/scout/server/decide.ts`, `lib/scout/server/model.ts`) |
| Insights | PROPOSED, not part of Release A's minimum |
| Hosted runner (Release B) | Not built; no spike run |

## Verification record

Nothing has been run in this repository. There is nothing to run.

Measured facts carried over from `scout-demo` (Ayush's measurements on his Ubuntu laptop, 11 Oct 2026, unless noted). They are single runs, not benchmarks.

| What | Result |
|---|---|
| Dev model check (`GET /api/scout/check`, `gpt-6-luna`, effort `none`, tiny prompt) | Reply `ok`, 13 input / 5 output tokens. First call 3,619 ms (warm-up), then about 1.5 s average over repeated calls |
| Decision model time (`POST /api/scout`, effort `low`, strict schema) | About 2–3 s per decision |
| "what can you do?" → answer from facts | Model time (`modelMs`) 2,160 ms |
| "show me customers" → recorded workflow, 2 steps verified | Model time (`modelMs`) 2,853 ms |
| "add prakhar@c.com as Admin" / "add me@Me.com as member" → 5 steps verified | Model time (`modelMs`) 2,070 / 2,751 ms |
| End-to-end time for those four chat cases | Not recorded. The chat then showed only `modelMs`; first-change and total timings were added later (`198cdfe`) |
| Decision instructions size | About 670 input tokens with two workflows and the dashboard facts (from the planning conversation) |
| Estimated cost per decision | About $0.0001 at $0.10 / $0.50 per 1M tokens. Arithmetic, not a measurement |
| Agent-run in scout-demo (11 Oct) | `npm run lint` clean, `npm run build` passes (7 routes), `npm test` 16/16; re-run of `npm test` on 13 Oct: 16/16 |

Prompt caching was irrelevant at the prototype's ~670 tokens. Revisit it when instructions grow (contract §2.5 estimates 4–5k tokens with a full catalog). Keep the static part (rules, facts, catalog from the pinned snapshot) first and the per-request history and message last, as the prototype's `decide()` already does: static rules, facts and catalog in `instructions`; history and message in `input` (`docs/CLOUD_DESIGN.md` §3.3). Revisit model latency if voice feels slow.

## Decisions

| Date | Decision |
|---|---|
| 4 Oct | The model selects an enabled workflow and inputs, answers from facts, or clarifies. Its output is validated at runtime; credentials stay on the server. Deterministic execution before any model. |
| 8 Oct | Model chosen in one server module (`SCOUT_MODEL`), so switching is one line. The model only decides; the browser speaks. Claude Haiku 5.5 chosen as the cheapest Claude (**superseded 11 Oct**, see below). |
| 8 Oct | Integration doesn't need Scout access to client code. Client apps can't be wiped, so workflows will save starting conditions and validation runs in a demo or sandbox account. Reset never deletes saved workflows. |
| 11 Oct | Switched to OpenAI because Claude API credit wasn't available: `gpt-6-luna` ($0.10 / $0.50 per 1M), Responses API, structured outputs. `gpt-5-nano` ($0.05 / $0.40) is cheaper but deprecated. A ChatGPT subscription doesn't include API credit. Switching back to Claude when credit exists is possible (a one-module change) but not decided. |
| 11 Oct | Decision endpoint contract: strict schema `scout_decision` (`kind`, `workflowId`, `inputs` as `{name, value}` pairs, `message`), `DECISION_EFFORT = "low"`, `readDecision` on server and browser. Tune effort with measurements. |
| — (planning conversation, date not recorded) | Jev (jev-ai.pro) evaluated and rejected: a text-only scoring/classification API, no extraction, answers or voice. Groq and Cerebras noted as speed options. |
| 11 Oct | Aman's review (proposed direction): clients may not supply an engineer, so lean toward a hosted cloud browser (Browserbase) for visitors and perhaps a Chrome extension for admin teaching; keep the SDK for clients with engineers; keep a Scout widget; rehearse a login wall (Clerk or Google OAuth) in a rehearsal app; ask Supersonik's chat how a company with no engineers sets up. Auth matters for the hosted browser, the console and the paid decision endpoint. |
| 11 Oct | The agent may run lint, build and tests itself. |
| 13 Oct | scout-demo frozen. Work continues in `scout-js` (one monorepo, a package per tier) and `scout-cloud` (separate). Code is copied from scout-demo with provenance, never moved. |
| 13 Oct | Tier 0 gets two releases: Release A in-product first, Release B Supersonik-style hosted after. |
| 13 Oct | Prototype build mode continues in scout-js and scout-cloud (Ayush): the agent writes each step's code and explains it, plain language first; Ayush reviews and tests. Coaching only when he asks. |
| 13 Oct | Scout runs in the browser, so the client's backend language doesn't matter; the frontend kind (SPA or server-rendered multi-page) does. Language-specific SDKs belong on the server API side (create links, pull sessions/transcripts/insights into CRMs), in a future `scout-server-sdks`. |

## Pending approvals

- scout-cloud stack: reuse Next.js route handlers, or a separate API service.
- Database: SQLite first, then Postgres (suggested).
- Test framework beyond `node:test`.
- scout-js bundler and build output (esbuild suggested), which consuming `@scout/core` from here depends on (`docs/CLOUD_DESIGN.md` §10.2).
- Server-owned decision catalog and facts, loaded from the session's pinned config snapshot, because a public publishable key means anyone can call decide (`docs/API_CONTRACT.md` §5.1).
- How scout-cloud consumes `@scout/core`. PROPOSED (`docs/CLOUD_DESIGN.md` §10.2): imported rather than copied (this choice itself is pending, not only the method); a `file:../scout-js/packages/core` link during development, then a pinned registry version.
- Admin sign-in provider: Clerk or Google OAuth.
- Real domains for the placeholder hosts `api.scout.example`, `cdn.scout.example`, `app.scout.example`.
- The 21 open questions in `docs/API_CONTRACT.md` §7.
- The cloud-specific open questions in `docs/CLOUD_DESIGN.md` §13, and the choices it leaves pending elsewhere: ORM (Drizzle recommended), error tracking (Sentry), retention defaults (30 / 90 days / 13 months / 1 year), the $20 default monthly budget and the global spend cap, server-built history, Live View versus screencast relay, and `persist` policy. These block the first milestones: database and ORM (C1), sign-in provider (C7), deployment platform (C12), and the B0 spike's provider account and spend.

## Server pieces to import from scout-demo@aafd6a2

Not imported yet. Which files come here, how each is treated, and what to adapt are in `docs/ORIGIN.md`. Prototype doc drift not to copy is listed in `docs/BACKGROUND.md` §2.12.

## Background research

Supersonik's public docs and Browserbase's docs, as read on 13 Oct 2026 (not verified by us), are summarised in `docs/BACKGROUND.md` §3–§4; what we borrow is in §3.6 there.

## Next steps

1. Review `docs/CLOUD_DESIGN.md` and `docs/API_CONTRACT.md` with Ayush (the contract together with scout-js's SDK design).
2. Choose the stack and storage (see Pending approvals).
3. Import the server pieces from `scout-demo@aafd6a2` with provenance (`docs/ORIGIN.md`).
4. Build the minimal cloud for Release A: projects, keys and origins, published config and snapshots, sessions, decide, events, admin workflows and facts, rate limits and budget.
5. Release B: hosted runner spike (cloud browser session, persisted demo login, injected `@scout/agent`, live stream).
6. Open item from Aman's review (11 Oct), not done: ask Supersonik's own chat how a company with no engineers sets it up. It informs Release B onboarding.
7. Open item from Aman's review (11 Oct), not done: the login-wall rehearsal app (Clerk or Google OAuth). It also informs the console sign-in choice (C7) and demo-account login capture (`docs/CLOUD_DESIGN.md` §7.6).
8. After the SDK work: the investor discussion (selling options, competitors such as AI demo agents, interactive demo platforms, digital adoption platforms and AI sales assistants, and the prototypes the pitch needs).
