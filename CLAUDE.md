# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

**D1's minimal cloud is built on branch `release-a-d1` (Next.js 16, framework-free `server/` modules, JSON store).** Read `SCOUT_CONTEXT.md` for status, the D1–D3 plan and what is verified. The prototype it grows from is `../scout-demo`, frozen at `aafd6a2`; read it, never change it. Sessions work best started in `~/codes/scout-agent/` so all three repos are visible. Claude Code memory is per starting folder, so durable facts belong in repo files.

## Where context lives

| File | Holds |
|---|---|
| `SCOUT_CONTEXT.md` | Status, the deliverable plan, decisions, measured facts, pending approvals, next steps |
| `docs/CLOUD_DESIGN.md` | The cloud's design: components, decision service, storage, D1/D2/D3 (§6), Release B, security, stack, milestones (§12), open questions (§13). PROPOSED |
| `docs/API_CONTRACT.md` | Shared names, endpoints and shapes. Identical to `../scout-js/docs/API_CONTRACT.md`; change both in one review |
| `docs/BACKGROUND.md` | Shared history and reasoning. Identical to `../scout-js/docs/BACKGROUND.md` |
| `docs/ORIGIN.md` | What comes from `scout-demo@aafd6a2`, when, and the provenance rule |
| `../scout-demo/SCOUT_CONTEXT.md`, `docs/SCOUT_HLD.md`, `docs/SCOUT_LLD.md` | How the prototype was built (frozen; drift listed in BACKGROUND §2.12) |

## Commands

On `release-a-d1`: `npm run dev` (http://localhost:4000), `npm run build`, `npm start` (uses `PORT`), `npm run typecheck` (`tsc --noEmit`; the dev server doesn't type-check), `npm test` (`node --test`), `npm run project:create -- "Name"`. `@scout/core` comes from `vendor/scout-core-0.0.0.tgz` (see `vendor/README.md`). Server modules use explicit `.ts` imports and no `@/` alias, so `node --test` and the script can load them.

If Next.js is used, expect a harmless `turbopack.root` warning from the stray `/home/ayush-dev/codes/package-lock.json`. Setting `turbopack.root` or deleting that file needs Ayush's OK.

## Model rules (carried over from the prototype)

- **One server module chooses the model** (prototype: `lib/scout/server/model.ts`): it holds `SCOUT_MODEL` and `DECISION_EFFORT`, creates the single client, maps SDK errors to safe messages (`describeModelError`), and is the only importer of the provider SDK. Never import it from code that can reach a browser bundle; add a `server-only` guard (the prototype relied on convention).
- **Current model:** OpenAI `gpt-6-luna`, Responses API, strict JSON-schema output (`scout_decision`), `reasoning.effort = "low"`, `max_output_tokens: 400`. The dev-only model check used effort `"none"`. $0.10 / $0.50 per 1M input/output tokens. Claude Haiku 5.5 was superseded on 11 Oct only for lack of API credit; switching back is not decided.
- **Credentials:** `OPENAI_API_KEY` lives in `.env.local` (git-ignored) in development and in the host's secret store in production. Ayush creates `scout-cloud/.env.local` himself (C0 commits a `.env.example` with names only). The agent never reads, copies, prints or commits any `.env` file, including `../scout-demo/.env.local`; it checks model access only through the dev-only model-check route.
- Model calls cost money (a ChatGPT subscription includes no API credit); a new eval set or load test needs Ayush's OK.

## Decision rules

- **The model only chooses:** one published workflow and its declared inputs, or an answer from facts, a clarifying question, or a decline. Never code, URLs, selectors, steps or new action ids.
- **Validate at runtime, both ways:** `readScoutRequest` on every request, `readDecision` on every model output against the server-built catalog; the browser re-checks with its own catalog and `resolveWorkflow`. Types are not runtime checks.
- **The server owns the catalog and facts** (contract §5.1, PROPOSED): never trust browser-sent ones once server storage exists, D1's JSON store included.
- **The run message is intent, never success;** only the browser claims success, after every step verifies.
- `readScoutRequest` and `readDecision` move from the prototype's `lib/scout/core/decision.ts` into `@scout/core` in scout-js. How scout-cloud gets them (import or copy, and how once hosted) is pending (`docs/CLOUD_DESIGN.md` §10.2).
