# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Read `SCOUT_CONTEXT.md` for current progress and what is verified vs. unverified. The shared browser/cloud contract is `docs/API_CONTRACT.md` (an identical copy is in `../scout-js/docs/`). The cloud's own design is `docs/CLOUD_DESIGN.md`. Both are PROPOSED until Ayush approves them. The shared history and reasoning (prototype, Supersonik, Aman's review, tiers, releases, model, voice, lessons) is `docs/BACKGROUND.md` (identical copy in `../scout-js/docs/`). What comes from `scout-demo@aafd6a2`, and the provenance rule, is `docs/ORIGIN.md`.

**This repository is at the design stage (13 Oct 2026). There is no code and no `package.json`; the only commit is the initial docs commit.** The prototype it grows from is `../scout-demo`, frozen at `aafd6a2`; read it, never change it.

Sessions work best when started in `~/codes/scout-agent/`, so `scout-cloud`, `scout-js` and `scout-demo` are all visible. Claude Code memory is per starting folder, so durable facts belong in this repo's files, not in memory.

## Commands

None yet. There is no `package.json`, so there are no scripts to run. Do not invent a command. When a stack is approved, list its scripts here (dev, lint, build or type check, test), exactly as `package.json` defines them.

Planned stack options, all **pending Ayush's approval**:

- **Service shape:** reuse Next.js route handlers (as the prototype's `/api/scout` did, and the console could live in the same app), or a separate API service with the console elsewhere.
- **Database:** SQLite first, then Postgres. Schema changes go through migrations from the first table.
- **Tests:** Node's built-in `node:test` (the prototype's approach, no dependency), or a test framework if that stops being enough.
- **Release B hosted runner:** a cloud browser provider (Browserbase-style) driven with Playwright over CDP. Spike only; paid per session time.

The prototype used Next.js 16.3.8, React 19.2.8, TypeScript and Tailwind v4 on Node v22.23.2. In Next.js, `npm run build` was the only type check; the dev server does not type-check. PROPOSED here: a separate `typecheck` script (`tsc --noEmit`, `docs/CLOUD_DESIGN.md` §10.1), and a fixed development port, `http://localhost:4000` (`next dev -p 4000`), because the scout-js dashboard example uses 3000 and the Vite test app 5173; those two are the seeded allowed origins (`docs/CLOUD_DESIGN.md` §4.3, §10.1).

If Next.js is used, expect a harmless `turbopack.root` warning caused by the stray `/home/ayush-dev/codes/package-lock.json` (it made Next pick the wrong workspace root in scout-demo too). Setting `turbopack.root` in `next.config` is a config change, and deleting that file is outside this repo; both need Ayush's OK.

## Model rules (carried over from the prototype)

- **One server module chooses the model.** In the prototype it was `lib/scout/server/model.ts`: it holds `SCOUT_MODEL` and `DECISION_EFFORT`, creates the single client, maps SDK errors to safe messages (`describeModelError`), and is the only importer of the provider SDK. Keep that shape here. Never import it from code that can reach a browser bundle; add a `server-only` style guard (the prototype had none and relied on convention).
- **Current model:** OpenAI `gpt-6-luna` through the Responses API, with strict JSON-schema output (`scout_decision`), `reasoning.effort = "low"` (`DECISION_EFFORT`) and `max_output_tokens: 400`. The dev-only model check used effort `"none"`. Price $0.10 / $0.50 per 1M input/output tokens.
- **Claude Haiku 5.5** was chosen on 8 Oct and superseded on 11 Oct only because Claude API credit wasn't available. Whether to switch back is not decided. A provider swap touches only the model module and its callers.
- **Credentials:** `OPENAI_API_KEY` lives in `.env.local` (git-ignored) in development and in the host's secret store in production; never in the repo or a browser bundle. Never read, print, log or commit it. Read example variable names (for example a committed `.env.example`) instead.
- **Where this repo's key comes from:** Ayush creates `scout-cloud/.env.local` himself (milestone C0 commits a `.env.example` with names only). The agent never reads, copies or `cat`s `../scout-demo/.env.local` or any other `.env` file, even to "copy the key over". It checks model access only through the dev-only model-check route.
- A ChatGPT subscription does not include API credit. Model calls cost money; a new eval set or load test needs Ayush's OK for the spend.

## Decision rules

- **The model only chooses.** It picks one published workflow from the catalog and values for that workflow's declared inputs, or it answers from facts, asks a clarifying question, or declines. It never supplies code, URLs, selectors, steps or new action IDs.
- **Validate at runtime, both ways.** The server checks every request (`readScoutRequest` limits) and every model output (`readDecision` against the catalog the server built). The browser re-checks the decision against its own current catalog and `resolveWorkflow` before acting. TypeScript types are not runtime checks.
- **The server owns the catalog and facts** (PROPOSED in `docs/API_CONTRACT.md` §5.1; binding once the contract is approved). In the prototype the browser sent them on every request. With a publishable key that would turn Scout into a free chatbot, so v1 loads them from the session's pinned config snapshot. Never trust a browser-sent catalog or facts once server storage exists.
- **The run message is intent, never success.** Success is claimed only by the browser after every step is verified.
- `readScoutRequest` and `readDecision` come from the prototype's `lib/scout/core/decision.ts` and move into `@scout/core` in `scout-js`. PROPOSED (pending Ayush): scout-cloud imports them from `@scout/core` rather than copying them. PROPOSED method (`docs/CLOUD_DESIGN.md` §10.2): a `file:../scout-js/packages/core` link during development, then a pinned registry version. Pending Ayush's approval.

## Where context lives

| File | Holds |
|---|---|
| `SCOUT_CONTEXT.md` | Status, verification evidence, dated decisions, next steps |
| `AGENTS.md` | Standing working agreements and backend rules |
| `docs/API_CONTRACT.md` | Shared names, endpoints, data shapes (keep identical to the scout-js copy) |
| `docs/CLOUD_DESIGN.md` | Cloud system design |
| `docs/BACKGROUND.md` | Shared background and reasoning (identical to `../scout-js/docs/BACKGROUND.md`) |
| `docs/ORIGIN.md` | File map from `scout-demo@aafd6a2` and the provenance rule (PROPOSED) |
| `../scout-demo/SCOUT_CONTEXT.md`, `../scout-demo/docs/SCOUT_HLD.md`, `SCOUT_LLD.md` | How and why the prototype was built (frozen; some sections are stale, see this repo's `SCOUT_CONTEXT.md`) |
