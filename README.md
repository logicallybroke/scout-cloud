# Scout Cloud

Scout Cloud is the backend for Scout. Scout gives live software demos: an admin teaches a workflow by doing it once in the product, a visitor asks for it by chat or voice, and Scout performs it on screen, checks every step, and explains the product.

The part that clicks and types runs in the visitor's browser (the `scout-js` SDKs). Scout Cloud is everything that has to live on a server.

**Status: design stage. There is no code in this repository yet.** Everything below is PROPOSED until it is built and checked. Progress and evidence are in [`SCOUT_CONTEXT.md`](SCOUT_CONTEXT.md).

## What Scout Cloud will do

| Part | In plain language | Release |
|---|---|---|
| **API** | Three groups of HTTP endpoints. The Agent API is for the browser runtime and uses a public, publishable key. The Admin API is for teaching and the console and uses an admin sign-in. The Client API is for the client's own server and uses a secret key. | A |
| **Admin console** | A website where the client's admins sign in, manage keys and allowed websites, write product facts, review workflows, see validation results reported from teach mode, and publish them. | A |
| **Workflow and facts store** | Saves taught workflows (with every revision), product facts, and an immutable snapshot of what visitors could use at each config version. Replaces the prototype's same-browser `localStorage`. | A |
| **Decision service** | Turns a visitor's message into one decision: run a published workflow with inputs, answer from facts, ask a clarifying question, or decline. It calls the model on the server and checks the reply at runtime. The model only chooses; it never writes steps, selectors, URLs or code. | A |
| **Sessions, transcripts, insights** | Records each visitor session, its chat turns and its runs, so a client can read them or sync them to a CRM through the Client API. Insights (summaries generated after a session) come later. | A (insights later) |
| **Protection** | Origin allowlists for publishable keys, rate limits, and a monthly model budget per project, because a public key means anyone can call the decision endpoint. | A |
| **Hosted demo runner** | Runs the client's product in a cloud browser logged into a demo account, injects the same `@scout/agent` runtime into that page, and streams it to the visitor. Delivered by plain link, iframe, or the `@scout/embed` widget on a marketing site. Supersonik-style. | B |

Release A is the in-product release: the client pastes a script tag into their own app. Release B is hosted demos and comes after Release A. Release B reuses Release A's runtime and cloud, so the cloud is built for A first. Release A is built in three deliverables: **D1** a minimal hosted cloud (decide, workflows and facts as JSON files, a hard cost cap), **D2** the full cloud in this table, **D3** a Release B spike (`docs/CLOUD_DESIGN.md` §6).

```
 CLIENT'S APP (browser)                SCOUT CLOUD (this repo)                 CLIENT'S SERVER (optional)
 +---------------------------+        +--------------------------------+      +-------------------------+
 | @scout/agent (scout-js)   |  pk    | Agent API   /v1/agent/*        |  sk  | CRM sync, link creation |
 |  widget, chat, voice      | -----> | Admin API   /v1/admin/*        | <--- | server SDKs (PLANNED,   |
 |  recorder (teach mode)    | admin  | Client API  /v1/client/*       |      |  scout-server-sdks)     |
 |  runner + verifier        | token  |                                |      +-------------------------+
 +---------------------------+        | decision service -> model      |
                                      | store: workflows, facts,       |
 MARKETING SITE (Release B)           |  sessions, transcripts         |
 +---------------------------+        | console                        |
 | link / iframe /           | <----- | hosted runner (Release B):     |
 | @scout/embed widget       | stream |  cloud browser + @scout/agent  |
 +---------------------------+        +--------------------------------+
```

The browser runs and verifies. The cloud decides and records. Model credentials and secret keys never leave the server.

## Documents

- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md): the shared contract between `scout-js` and `scout-cloud` (keys, endpoints, data model, decision contract, versioning, open questions). PROPOSED, for review. An identical copy lives in `scout-js/docs/API_CONTRACT.md`; change both together.
- [`docs/CLOUD_DESIGN.md`](docs/CLOUD_DESIGN.md): the cloud's own design (services, storage, hosted runner). PROPOSED, for review.
- [`docs/BACKGROUND.md`](docs/BACKGROUND.md): shared background (prototype, Supersonik, Aman's review, tiers, releases, model, voice, lessons). An identical copy lives in `scout-js`; change both together.
- [`docs/ORIGIN.md`](docs/ORIGIN.md): which `scout-demo@aafd6a2` files come here, and the provenance rule. PROPOSED; nothing imported yet.
- [`SCOUT_CONTEXT.md`](SCOUT_CONTEXT.md): status, decisions, measured facts, next steps.
- [`AGENTS.md`](AGENTS.md): standing working agreements and backend rules. [`CLAUDE.md`](CLAUDE.md): quick guide for Claude Code sessions.

## Related repositories

All three live side by side in `~/codes/scout-agent/`.

- **scout-js** (https://github.com/logicallybroke/scout-js): the browser SDKs, one monorepo with a package per tier: `@scout/core`, `@scout/agent`, `@scout/actions`, `@scout/react`, `@scout/embed`.
- **scout-demo** (https://github.com/logicallybroke/scout-demo, branch `prototype`): the prototype, built 4–11 October 2026 and **frozen at commit `aafd6a2`** as history and a fallback. Scout Cloud's first server code (decision endpoint, model module) will be copied from it with provenance, never moved. Do not add code there.
- **scout-server-sdks** (future, not created): Node, Python and Java clients for the Client API.

## Run it (D1 minimal cloud, branch `release-a-d1`)

Local: create `.env.local` with `OPENAI_API_KEY=…`, then `npm install`, `npm run dev` (http://localhost:4000), and
`npm run project:create -- "My app"` to get a project key and teach passcode. `npm run typecheck`, `npm test`, `npm run build`.

### Deploy on Railway (Ayush's account; about $5 a month)

1. railway.com → New Project → Deploy from GitHub repo → `logicallybroke/scout-cloud`, branch `release-a-d1`.
2. Add a **Volume** to the service, mounted at `/data` (the JSON workflow store lives there).
3. **Variables** (Railway's dashboard; never in git):
   - `OPENAI_API_KEY`: the model key (only the server ever sees it).
   - `SCOUT_TOKEN_PEPPER`: a long random value. Set it once and never change it: passcodes are hashed with it.
   - `SCOUT_DATA_DIR=/data`, `SCOUT_GLOBAL_MONTHLY_BUDGET_USD=4`.
   - `SCOUT_OPERATOR_SECRET`: a long random value (24+ characters), used once below.
4. Railway builds with `npm run build` and starts `npm start` (it sets `PORT`). Settings → Networking → **Generate Domain**.
   Check: `https://<domain>/health` returns `{"ok":true}`.
5. Create the project for an app (the passcode is shown once):
   `curl -X POST https://<domain>/v1/operator/projects -H "Authorization: Bearer <SCOUT_OPERATOR_SECRET>" -H "Content-Type: application/json" -d '{"name":"Aman app"}'`
   Then you may clear `SCOUT_OPERATOR_SECRET` to switch the endpoint off.

Give the app owner: the project key, the teach passcode, and `https://<domain>` as `apiOrigin`.
