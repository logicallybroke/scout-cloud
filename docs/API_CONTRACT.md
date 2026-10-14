# Scout API contract (v1)

**Status: PROPOSED, for Ayush's review (13 October 2026; deliverable additions 14 October). Nothing in this file is built.**

This file defines the names and data shapes shared by the browser SDKs (`scout-js`) and the backend (`scout-cloud`). Every other design doc uses these names; a doc that needs a new shared name adds it here first.

- **Two identical copies:** `scout-js/docs/API_CONTRACT.md` and `scout-cloud/docs/API_CONTRACT.md`. Change both in the same review and `diff` them before committing either.
- **Provenance markers.** **[P]** marks a shape taken from the frozen prototype `scout-demo@aafd6a2` (mostly `lib/scout/core/contracts.ts`). **[N]** marks something new. Code is copied from scout-demo with provenance, never moved.
- **Hosts are placeholders.** `https://api.scout.example`, `https://cdn.scout.example` and `https://app.scout.example`. No domain is chosen.
- **Releases.** Release A is the in-product script tag; Release B is hosted, Supersonik-style demos. Unlabelled parts belong to Release A. Plan (Ayush, 14 Oct): Release A ships as deliverables **D1** (one script tag or npm install on any React app, with a minimal cloud: decide plus workflows and facts as JSON files; no database, console or sessions), **D2** (a classic Java app too, on the full cloud: database, keys, allowlist, admin sign-in, sessions) and **D3** (a Release B spike).

---

## 1. Overview

### In plain language

Scout has three parties. **The browser** runs Scout's runtime inside the client's page (widget, chat, voice, recording, replay, a check after every step) and calls the Agent API (`/v1/agent/*`, publishable key) and, in teach mode, the Admin API (`/v1/admin/*`, admin token). **Scout Cloud** stores projects, keys, workflows and facts, calls the model (server only) to decide what a message means, records sessions, and hosts the console at `app.scout.example`. **The client's own server** (optional) calls the Client API (`/v1/client/*`, secret key), for example for CRM sync; server SDKs for Node, Python and Java are PLANNED in `scout-server-sdks`. In Release B, a cloud browser runs the client's product with `@scout/agent` injected and streams it to a link, an iframe or `@scout/embed` on a marketing site (§3.6). The client's backend language does not matter; what matters is whether the frontend is a single-page app or reloads on every navigation.

**Deliverable 1 subset (PROPOSED).** D1 implements only part of this contract: agent config (workflows), decide, and saving workflows under the interim teach passcode (§2.6). It has no sessions, events, Client API or console. The exact subset is defined in `scout-cloud/docs/CLOUD_DESIGN.md` §6.

### Rules that hold across every part of this contract

- **The browser runs and verifies. The cloud decides and records.** An `ok: true` from an action means only "accepted". Only a verifier that sees the expected UI proves a step succeeded. **[P]**
- **The model only chooses.** It picks a published workflow and values for its declared inputs, or answers, clarifies or declines. Locators, selectors and URLs come from admin-reviewed recordings, never from the model. **[P]**, extended to tier 0.
- **The browser re-checks every run decision against its own current catalog before acting** (§5.4). **[P]**
- **Credentials.** Model credentials and secret keys live only on servers. **[P]**
- **Idle by default.** No network calls, polling or DOM observation until a visitor opens the widget, an admin enters teach mode, or a teach session or run is resuming after a page reload. **[P]** (prototype HLD §8)

---

## 2. Keys and identity

### 2.1 Credentials

| Credential | Format | Lives in | Can do | Cannot do |
|---|---|---|---|---|
| **Publishable key** **[N]** | `scout_pk_` + 24 random base62 chars | The client's HTML (script tag `data-project-key`) | Read the published config, start visitor sessions, request decisions, send session events | Read other sessions, transcripts or insights. Change workflows. Work from an origin that isn't allowlisted (when the allowlist is set, §2.2). |
| **Secret key** **[N]** | `scout_sk_` + 32 random base62 chars | The client's server environment only | Everything in the Client API (`/v1/client/*`) for one project | Anything when sent from a browser (rule below) |
| **Admin token** **[N]** | Opaque, ≥ 32 random bytes, base64url | The console's memory (minted from its sign-in session, short-lived), or the teaching tab's `sessionStorage` | The Admin API for the projects and origin it is scoped to | Outlive its expiry. Read or create keys with `teach` scope. |
| **Session token** **[N]** | Opaque, ≥ 32 random bytes, base64url | The visitor tab's `sessionStorage` | Decisions and events for one session | Anything for another session |

- **Prefixes.** `scout_` makes leaked keys easy to grep for and allows a secret-scanning pattern later; nothing detects them automatically yet.
- **Secret keys** are stored only as a hash, shown once at creation, then only their last 4 characters. **Publishable keys** are not secret and can be shown any time.
- **Keys belong to a project, not an organisation [N]**, unlike Supersonik's organisation-scoped server key (BACKGROUND §3.3). Budgets and rate limits are per project too, and v1 has no level above projects, so a client with several projects needs one secret key per project. v1 assumes one project per client (§7, question 21).

**Rejecting a secret key sent from a browser.** A request carrying a secret key *and* an `Origin` header gets `403 secret_key_in_browser`, and the key is flagged in the console. Browsers always send `Origin` on cross-origin requests; server HTTP clients normally don't.

**How each credential is sent:**
- Publishable key: header `X-Scout-Key: scout_pk_…`. A GET may use the query parameter `key=` instead, avoiding a CORS preflight.
- Secret key and admin token: `Authorization: Bearer …`. Every `Authorization` value is therefore secret-class; a publishable key never appears there.
- Session token: header `X-Scout-Session: …`, or the field `sessionToken` in a `sendBeacon` body (beacons can't set headers).

### 2.2 Allowed origins

- **Format.** Exact origins, `scheme://host[:port]`, lowercase, no path, no trailing slash. Example: `https://app.acme.com`. Local development needs an explicit entry such as `http://localhost:3000`.
- **Check.** On every Agent API request with a publishable key, `Origin` must equal an allowed origin, or the server returns `403 origin_not_allowed`.
- **Requests without a publishable key [N].** Two kinds skip the allowlist check, and each gets CORS only for one recorded origin, with `Vary: Origin`; any other `Origin` gets `403 origin_not_allowed`:
  - Events calls with a session token alone (§3.3): the origin recorded at session start (`Session.page.origin`, §4.8). A `sendBeacon` batch needs no CORS answer, because its response is never read.
  - Hosted sessions (Release B, PROPOSED, §3.6): the origin of the experience's `hosted.startUrl`. If the runner relays the agent's calls itself, no CORS is needed (`scout-cloud/docs/CLOUD_DESIGN.md` §2.1).
- **CORS.** Allowed requests get `Access-Control-Allow-Origin: <that origin>` and `Vary: Origin`. No cookies; no `Access-Control-Allow-Credentials`.
  - Responses send `Access-Control-Expose-Headers: Retry-After, ETag`, so the widget can read `Retry-After` on `429`/`503` and the config `ETag`.
  - Preflights (`OPTIONS`) answer `Access-Control-Allow-Headers: X-Scout-Key, X-Scout-Session, Authorization, Content-Type, If-Match`, `Access-Control-Allow-Methods` with the endpoint's methods, and `Access-Control-Max-Age`.
- **Limit of the check.** The allowlist only stops *other websites* using the key in visitors' browsers; a script outside a browser can fake `Origin`. The real protection is the rate limits and cost caps in §2.5.
- **No allowlist in D1; added later only if required (decided, Ayush 14 Oct) [N].** D1 checks no `Origin`, and CORS answers the request's own `Origin`. When an allowlist is added (D2 or later), an empty allowlist still means any origin (PROPOSED). This matches Supersonik: its widget uses only a public launch-config slug, and its docs (updated 2026-10-13) say the iframe embed "can be framed from any domain. There is no allowlist to configure on our side". D1 runs with no allowlist, bounded by a hard monthly cost cap of $4 (Ayush, 14 Oct) and the rate limits (§2.5). Clients are advised to set an allowlist before production once one exists. Still open: §7, question 22.

### 2.3 Visitor identity

- Visitors are anonymous by default. A session has a random `sessionId`, kept in `sessionStorage` so it survives reloads in the same tab.
- **No cookies and no fingerprinting.** **[N]**
- **Optional identity.** `scout('identify', { memoryId, email })`. `memoryId` is opaque; email is personal data. Visitor identity (`visitor.email`, `memoryId`) is readable only with a secret key (Client API) or a console-scope admin token, never by publishable-key or teach-scope callers. Teach scope does see recordings and inputs' `example` values (§3.4), which can also be personal data the admin typed.
- **Memory across visits is PROPOSED** (from Supersonik, not approved): off by default, needs the visitor's consent, reserves `visitor.memoryId` and `scout('memory', { consent })`. Memory is never authentication.

### 2.4 Admins and teach mode

Teaching records a workflow in the client's real product. It needs an admin, because a recording becomes something every visitor can trigger.

**Admin accounts** **[N]**: admins sign in to the console at `https://app.scout.example` (provider not chosen, §7 question 2). An admin has a role per project, `owner` or `admin`; only an `owner` manages keys, origins and other admins.

**Entering teach mode** needs both a URL switch and a sign-in **[N]**:

```
 1. Admin opens https://app.acme.com/settings?scout=teach (or "Teach on my site" in the console).
 2. @scout/agent removes ?scout=teach (history.replaceState) and shows only a
    "Sign in to teach" button. No teach UI loads yet.
 3. Click -> popup:
    https://app.scout.example/teach/authorize?key=scout_pk_...&origin=https%3A%2F%2Fapp.acme.com&state=<random>
 4. Console: admin signs in. It checks the admin has a role on the key's project
    and that the origin is allowlisted.
 5. Console -> opener:
    postMessage({ source: "scout-console", type: "teach-token", state, token, expiresAt }, "<origin>")
 6. Agent accepts it only if event.origin === "https://app.scout.example" and state matches.
    It stores the token in sessionStorage under scout:<projectId>:teach.
 7. Teach mode is on (recorder, review, validation, publishing). Admin API calls send
    Authorization: Bearer <token>.
```

The URL switch is not a credential: anyone can type `?scout=teach` and get only a sign-in button. A popup plus an origin-checked `postMessage` works across sites without third-party cookies.

**Teach-scope tokens:**
- Scoped to one project and one origin; expire after **60 minutes** (PROPOSED), then the agent opens the popup again.
- Allow recordings, workflows, validation runs, publishing and the admin config. **Not** keys, origins, facts or experiences; only the console manages those.

**Other rules:**
- Sessions started in teach mode have `type: "test"`.
- Admins teach in a **demo or sandbox account**, because client apps can't be reset. The prototype's "Reset & record" becomes *starting conditions* (§4.7).

### 2.5 Rate limits and protection against cost abuse

A publishable key is public, so anyone can call the Agent API, and each decision costs model tokens.

**Estimated cost per decision** (arithmetic, not measured): the prototype's instructions were about 670 input tokens with two workflows (reported in planning, not in the prototype's verification record). At $0.10 / $0.50 per million input / output tokens that is about $0.0001 per decision; a full catalog (20 workflows, 40 facts, 4,000–5,000 tokens) is about $0.0005.

**Defences, in order:**
1. Size limits on every request (§3.2), from the prototype's `LIMITS`.
2. The catalog and facts are loaded **on the server** from the published config; the browser can't send its own (§5.1).
3. Rate limits, PROPOSED, to be tuned with measurements:

   | Scope | Limit |
   |---|---|
   | `GET /v1/agent/config` | 60/min per IP |
   | `POST /v1/agent/sessions` | 20/hour per IP per project |
   | `POST /v1/agent/decide` | 20/min and 200/day per session; 1,000/hour per project |
   | `POST /v1/agent/sessions/{id}/events` | 120 events/min per session |
   | Admin API | 600/min per admin |
   | Client API | 600/min per secret key |

4. **Monthly model budget per project** (default $20, PROPOSED). The console warns at 80%. At 100%, decide returns `429 budget_exhausted`, and the widget says Scout is unavailable instead of failing silently.
5. Bot protection, such as a challenge on session creation, is open (§7, question 12).

A rate-limited request gets `429 rate_limited` with `Retry-After` in seconds.

### 2.6 Deliverable 1 interim credentials (decided, Ayush 14 Oct) [N]

D1 has no database, console or admin sign-in, so it uses only two credentials:

- **Publishable key** for the Agent API calls D1 implements (§1). With no sessions, decide is called without `X-Scout-Session` or `sessionId`, against the current config.
- **Teach passcode**: one shared secret per project, typed by the admin in teach mode and sent as header `X-Scout-Teach-Passcode` on the workflow-saving calls D1 implements. It is never in page HTML, is held like the admin token (§2.4), and D1 preflights also allow this header. A wrong or missing passcode gets `401 invalid_credentials` / `missing_credentials`.

D2 replaces the passcode with the admin sign-in and teach-token flow (§2.4); the header then stops being accepted. Still open: §7, question 23.

---

## 3. Endpoints (v1)

### 3.1 Conventions

- **Base URL and format.** `https://api.scout.example/v1`. JSON (`Content-Type: application/json`), UTF-8.
  - **Another Scout Cloud (PROPOSED) [N].** For development and the "test app against a local cloud" checkpoint, the script attribute `data-api-origin` and the npm option `createScout({ apiOrigin })` set an origin (`scheme://host[:port]`, no path; default `https://api.scout.example`), such as `http://localhost:4000`. So a page can't quietly send messages elsewhere, a non-default value is honoured only by development builds of the agent, or only on an `http://localhost` page; which one is open for review. The cloud's `SCOUT_API_ORIGIN` is the server-side counterpart.
- **Field names are camelCase**, matching the prototype's TypeScript types (Supersonik uses snake_case).
- **Times** are ISO 8601 UTC strings, such as `"2026-10-13T09:15:00.000Z"`. Durations are integer milliseconds, named `…Ms`.
- **IDs** are prefixed strings: `prj_`, `key_`, `ori_` (allowed origin), `adm_`, `exp_`, `rec_`, `val_`, `ses_`, `run_`, `lnk_`, `fct_`, `req_`.
- **Workflow ids** **[P]**: recorded workflows get the prototype's form `<slug>-<base36 time>`, such as `invite-teammate-mv6ga000`; the suffix is `Date.now().toString(36)`, 8 characters until 2059. Seeded or built-in ids such as `invite-teammate` are allowed. All are ≤ 100 characters and match `^[a-z0-9][a-z0-9-]{0,99}$`; the model sees them, so they stay readable.
  - **[N]** The slug is truncated to 90 characters and a trailing `-` trimmed before the suffix is added, so the id fits in 99 characters. The prototype's `createWorkflowFromRecording` didn't truncate.
  - **[N]** Workflow ids have no prefix and are **unique within a project**, not globally, so every project seeded from the Scout Sandbox can have `invite-teammate`. Every workflow path is under a project (`/v1/admin/projects/{projectId}/workflows/{workflowId}`). Creating an id that already exists returns `409 invalid_state`; the agent makes a new suffix and retries once.
- **Success responses** are the resource or a named wrapper, such as `{ "sessions": [...] }`, with no `ok` field.
- **Errors** use one shape everywhere, modelled on Supersonik's `{error, detail}`. `error` is a stable machine code; `detail` is a sentence for people and may change.

  ```json
  { "error": "origin_not_allowed", "detail": "https://evil.example is not an allowed origin for this project." }
  ```

| HTTP | `error` codes |
|---|---|
| 400 | `invalid_json`, `invalid_request` (shape or limits; `detail` names the field) |
| 401 | `missing_credentials`, `invalid_credentials`, `token_expired` |
| 403 | `origin_not_allowed`, `secret_key_in_browser`, `key_revoked`, `forbidden` (role or scope) |
| 404 | `not_found` (also for resources in other projects, so their existence is never revealed) |
| 409 | `revision_conflict`, `invalid_state` (for example, publishing a revision that hasn't been validated) |
| 413 | `too_large` |
| 422 | `validation_failed` (semantic checks, for example an undeclared `$input`) |
| 429 | `rate_limited`, `budget_exhausted` (both with `Retry-After`) |
| 502 | `model_error` (model call failed or returned an unusable decision) |
| 503 | `unavailable` (with `Retry-After` when known, for example when the model provider is rate-limited or out of credit) |

- **Pagination on Client API lists.** Request: `limit` (1–100, default 25) and an opaque `cursor`. Response: `{ "<items>": [...], "nextCursor": "…" | null }`. Supersonik uses page numbers, which shift when new sessions arrive at the top of a newest-first list; cursors don't.
- **Unknown fields.** Clients ignore unknown response fields. Servers reject unknown request fields only where the endpoint says so; the decision schema is strict.

### 3.2 Size limits

From the prototype's `LIMITS` (`core/decision.ts`) **[P]**, plus new ones **[N]**.

| What | Limit |
|---|---|
| Visitor message | ≤ 1,000 characters, and non-blank after trimming **[P]** (`readScoutRequest` checks the length on the untrimmed string) |
| History sent with a decision | ≤ 8 turns, each ≤ 1,000 characters **[P]** |
| Workflows in one catalog (the model's catalog) | ≤ 20 **[P]**: per project, the published workflows plus, in `test` sessions, workflows with a `testing` revision (which replaces the published one), each counted once, before any experience `workflowIds` filter. Moving a revision to `testing` or `published` when that would exceed 20 returns `409 invalid_state` **[N]**, so the server never builds a catalog `readScoutRequest` rejects. |
| Facts per project | ≤ 40, each ≤ 500 characters **[P]** |
| Workflow `id` / `title` / `purpose` | ≤ 100 / 200 / 500 characters **[P]** |
| `examples` | ≤ 10, each ≤ 500 **[P]** |
| `inputs` | ≤ 10. `name` ≤ 50 and matches `^[a-z][A-Za-z0-9]*$`; `label` ≤ 100 **[P]**. `example` ≤ 200 **[N]**. |
| Input values | Every value (recorded `example`, decided by the model, or typed into a run form) is 1–200 characters after trimming **[N]**, because a value can fill a locator text field as well as a `ui.type` value. `readDecision` turns a longer value into `clarify` (§5.3); `resolveWorkflow` rejects it. |
| `allowedValues` per input | ≤ 20, each ≤ 100 **[N]** |
| Steps per workflow | ≤ 50 **[N]** |
| `narration`, `outcome` | ≤ 500 characters each **[N]** |
| Locator strategies per target | ≤ 6. `css` selector ≤ 500 characters; text fields ≤ 200 **[N]** |
| Workflow definition JSON | ≤ 64 KB **[N]** |
| Recording upload | ≤ 500 entries, ≤ 256 KB **[N]** |
| Events batch | ≤ 50 events, ≤ 64 KB **[N]** |
| Link `context` (Release B) | ≤ 32 KB of JSON, nested ≤ 5 levels (as in Supersonik) **[N]** |
| Turns per session | ≤ 500; later turns are not recorded **[N]** |

### 3.3 Agent API: browser-facing, publishable key

Every request carries the publishable key and an allowed `Origin`, with two exceptions **[N]** (CORS for both in §2.2):

- **The events endpoint** accepts a valid session token alone, from `X-Scout-Session` or, for a `sendBeacon` batch, the body's `sessionToken`. The token was issued only after the key and origin were checked at session start.
- **Hosted sessions** (Release B, §3.6) send `X-Scout-Session` with a token the hosted runner created, and no publishable key.

#### `GET /v1/agent/config`

Returns what the runtime needs to run published workflows.

- **When.** When the visitor first opens the widget, a saved run resumes after a reload, or an admin enters teach mode or a teach session resumes. Teach mode needs `projectId` before any Admin API call (paths and the `scout:<projectId>:teach` key use it). Never on page load.
- **Query parameters:** `key=scout_pk_…` (or `X-Scout-Key`); `experience=<slug>` (optional; default in-product experience); `agentVersion=1.0.0`; `maxWorkflowVersion=3` (the highest workflow schema this agent can run).
- **Caching.** `ETag: "cfg-<configVersion>"`, `Cache-Control: private, max-age=60`. `If-None-Match` returns `304`.

```json
200
{ "projectId": "prj_8f2k", "configVersion": 12,
  "experience": { "id": "exp_1", "slug": "default", "kind": "in_product", "language": "auto",
                  "appearance": { "position": "bottom-right", "accentColor": "#2563eb", "launcherLabel": "Ask Scout" } },
  "workflows": [ /* PublicWorkflow (§4.4): the published revisions; inputs have no "example" */ ],
  "skipped": [ { "workflowId": "export-report-mv6ggfhc", "reason": "needs_newer_agent" } ],
  "limits": { "message": 1000, "history": 8 }, "features": { "voice": true, "teach": true } }
```

- **`example` is removed from inputs**, because recorded values can be real data the admin typed. They are used only for validation, via the Admin API.
- **Facts are not sent**; they stay on the server.

#### `POST /v1/agent/sessions`

Starts a session, once, at the visitor's first interaction (not on page load). The session is pinned to the config version the browser loaded.

```json
request
{ "experience": "default", "configVersion": 12, "agentVersion": "1.0.0",
  "page": { "path": "/settings", "title": "Settings · Acme" }, "params": { "utm_source": "newsletter" },
  "language": "en-US", "visitor": { "memoryId": null, "email": null }, "delivery": "in_product" }
201
{ "sessionId": "ses_4hq9", "sessionToken": "…", "type": "prod", "configVersion": 12,
  "expiresAt": "2026-10-14T09:15:00.000Z" }
```

- **Teach-mode sessions.** With `Authorization: Bearer <admin token>` too, the session gets `type: "test"`, and its catalog includes `testing` revisions.
- **`page.path` never includes the query string**, which can contain tokens.
- **`params` are filtered** to `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ref` and the project's extra allowlist; anything else is dropped silently. Unlike Supersonik, `email` and `utm_email` are not accepted, because personal data in URLs leaks into logs and referrers. Identity comes from `scout('identify', …)` (§2.3) or link context (Release B, §3.5).
- **Pinning.** `configVersion` may be older than current. Snapshots are immutable, so the browser's and server's catalogs match (§6.3).
- **Expiry.** The token lasts 24 hours. A session ends after 30 minutes with no events and no decide calls (PROPOSED); both update `lastActivityAt`.
- **Ended sessions (PROPOSED) [N].** Decide on an ended session returns `409 invalid_state`; the agent starts a new session and resends once. Events on an ended session (token still valid) are recorded without reopening it, so a late `pagehide` beacon isn't lost.

#### `POST /v1/agent/decide`

Turns a visitor message into a decision. Full contract in §5.

```json
request   (headers: X-Scout-Key, X-Scout-Session)
{ "sessionId": "ses_4hq9", "requestId": "req_7", "message": "add priya@example.com as an admin", "source": "chat",
  "history": [ { "role": "visitor", "text": "what can you do?" }, { "role": "scout", "text": "I can show…" } ] }
200
{ "requestId": "req_7", "configVersion": 12, "modelMs": 2070,
  "decision": { "kind": "run", "workflowId": "invite-teammate", "inputs": { "email": "priya@example.com", "role": "Admin" },
                "message": "I'll invite priya@example.com as an Admin." } }
```

- **`history` is the ≤ 8 turns *before* this message [P]**; the new text is sent only as `message`.
- **`requestId`** increases with each message, like the prototype's `requestSeqRef` **[P]**. The server echoes it; the browser drops any reply that isn't the latest.
- **Recorded:** the visitor turn and the decision's Scout turn, as `Turn`s.
- **Errors:** `400 invalid_request`, `401`/`403`, `429 rate_limited` / `budget_exhausted`, `502 model_error`, `503 unavailable` (with `Retry-After`).

#### `POST /v1/agent/sessions/{sessionId}/events`

Records runs, steps, locally generated Scout lines and page views, in batches. When the page closes, the final batch goes by `navigator.sendBeacon` with `Content-Type: text/plain` (no preflight) and `sessionToken` in the body.

```json
request
{ "sessionToken": "…",
  "events": [
    { "seq": 14, "type": "run.started",  "at": "…", "runId": "run_1", "workflowId": "invite-teammate", "revision": 3,
      "inputs": { "email": "priya@example.com", "role": "Admin" }, "guided": true, "requestId": "req_7" },
    { "seq": 15, "type": "step.settled", "at": "…", "runId": "run_1", "step": 1, "action": "ui.click",
      "ok": true, "elapsedMs": 1840 },
    { "seq": 19, "type": "run.finished", "at": "…", "runId": "run_1", "result": "completed", "stepsVerified": 5,
      "timings": { "modelMs": 2070, "firstChangeMs": 4100, "totalMs": 15300 } },
    { "seq": 20, "type": "turn",          "at": "…", "role": "scout", "text": "Done. priya@example.com now appears…",
      "source": "chat", "runId": "run_1" }
  ] }
202
{ "accepted": 4, "lastSeq": 20 }
```

- **`seq` deduplicates.** It increases within a session, and the server ignores an already-stored `(sessionId, seq)`, so retries are safe. It is not a high-water mark: batches can arrive out of order (a periodic batch and the beacon, or a retry), and a late lower `seq` is still accepted. `lastSeq` is the highest stored so far, for information only.

**Event types** **[N]**. Open-ended: new types may be added in v1, and servers keep unknown types without interpreting them.

| `type` | Fields |
|---|---|
| `run.started` | `runId`, `workflowId`, `revision`, `inputs`, `guided`, `requestId?` |
| `step.settled` | `runId`, `step` (1-based), `action`, `ok`, `error?`, `elapsedMs` (since the run started; the prototype's `StepLog.at` made relative) |
| `run.finished` | `runId`, `result` (`completed` \| `failed` \| `cancelled`), `failedStep?`, `error?`, `stepsVerified`, `timings` (`modelMs`, `firstChangeMs`, `totalMs`; measured) |
| `run.resumed` | `runId`, `step`. Sent after a full page reload, from the run state in `sessionStorage`. |
| `turn` | `role: "scout"`, `text`, `source`, `runId?`. Only lines the runtime produces itself (outcome, "Stopped", failures); the server already recorded visitor and decision turns. |
| `page.viewed` | `path`, `title` |
| `session.ended` | `reason` (`pagehide` \| `closed` \| `idle`) |

### 3.4 Admin API: admin token

Paths are `/v1/admin/projects/{projectId}/…`, and the token must be scoped to that project. `teach` scope (from teach mode) may call the endpoints marked **T**; `console` scope (the console's sign-in session) may call everything.

| Method and path | Scope | Purpose |
|---|---|---|
| `GET …/config` | T | Like the agent config, but includes `draft` and `testing` revisions and inputs *with* `example` (needed for validation). |
| `POST …/recordings` | T | Upload a teach-mode session log for review |
| `GET …/recordings/{recordingId}` | T | Read it back (for example to review in the console) |
| `DELETE …/recordings/{recordingId}` | T | Delete it. Recordings are also deleted after 30 days (PROPOSED). |
| `GET …/workflows` | T | List workflows with their revisions and statuses |
| `POST …/workflows` | T | Create a workflow from a reviewed recording. Revision 1 starts as `draft`. |
| `GET …/workflows/{workflowId}` | T | One workflow: all revision summaries, plus the full latest revision |
| `PUT …/workflows/{workflowId}` | T | Save a new revision (always `draft`). Requires `If-Match: "rev-<n>"`; `409 revision_conflict` if `n` isn't the latest. |
| `POST …/workflows/{workflowId}/validation-runs` | T | Report a validation replay. A pass on the latest revision moves it to `testing`, unless that exceeds the catalog limit (§3.2): then `409 invalid_state`. |
| `POST …/workflows/{workflowId}/publish` | T | `{ "revision": n }`. The revision must be `testing`, else `409 invalid_state`. Bumps `configVersion`. |
| `POST …/workflows/{workflowId}/unpublish` | T | The published revision goes back to `testing`. Bumps `configVersion`. |
| `DELETE …/workflows/{workflowId}` | T | Archive (soft delete). Also unpublishes. |
| `GET` / `PUT …/facts` | console | Replace the whole list: `{ "facts": [{ "id"?: "fct_…", "text": "…" }] }`. Bumps `configVersion`. |
| `GET` / `POST` / `DELETE …/origins[/{originId}]` | console, owner | Manage allowed origins |
| `GET` / `POST …/keys`, `POST …/keys/{keyId}/revoke` | console, owner | Create and revoke keys. A new secret key is returned once. |
| `GET` / `POST` / `PATCH …/experiences[/{experienceId}]` | console | Manage experiences (§4.5). Bumps `configVersion` when a published experience changes. |

**Recording upload** (`POST …/recordings`). The teach-mode session log. Failed entries are kept for review **[P]**; values from masked fields are never in it (§4.6).

```json
request
{ "sessionId": "ses_teach1", "startedAt": "…", "agentVersion": "1.0.0",
  "page": { "path": "/settings", "title": "Settings · Acme" },
  "entries": [
    { "step": { "action": "ui.click", "target": { /* Locator */ } }, "result": { "ok": true },
      "observed": [ { "kind": "visible", "target": { /* Locator of the dialog that appeared */ } } ] },
    { "step": { "action": "ui.type", "target": { /* Locator */ }, "input": { "value": "sam@example.com" } },
      "result": { "ok": true } }
  ] }
201
{ "recordingId": "rec_2n", "expiresAt": "…" }
```

- **`entries` keep the prototype's `RecordedEntry { step, result }` [P]**, plus `observed` **[N]**: checks the recorder suggests from what changed after the human action. The admin confirms them in review, and they become the step's `expect`.

**Create from review** (`POST …/workflows`). Body: a `WorkflowDefinition` (§4.3) plus `"recordingId"`. The server checks the shape, then that every `$input` is declared, every declared input is used, and the limits hold; failures return `422 validation_failed` with `detail` naming the problem. Response: `201` with the `Workflow` at revision 1, `draft`.

**Validation run** (`POST …/workflows/{workflowId}/validation-runs`):

```json
request
{ "revision": 3, "agentVersion": "1.0.0", "page": { "origin": "https://app.acme.com", "path": "/settings" },
  "startedAt": "…", "finishedAt": "…", "values": "examples", "result": "passed", "error": null,
  "steps": [ { "step": 1, "action": "ui.click", "ok": true, "elapsedMs": 610 } ] }
201
{ "validationRunId": "val_9", "revisionStatus": "testing" }
```

- **Admin-reported evidence.** In Release A validation runs in the admin's browser; the cloud records the result with the agent version and origin and does not re-check it. Release B could validate in a hosted browser (§7, question 10).
- **`values`**: `"examples"`, the recorded values **[P]**; or `"examples+prompted"` **[N]**, plus values the admin typed at validation time for `masked` inputs (§4.3.1), used for that replay only and never sent to the cloud.

### 3.5 Client API: server-facing, secret key

Modelled on Supersonik's documented client API (v1; page last updated 2026-10-13 when re-read on 14 Oct). Server-only; every call is scoped to the key's project.

#### `GET /v1/client/experiences`

Lists the project's `published` and `testing` experiences. Not paginated.

```json
200
{ "experiences": [
    { "id": "exp_1", "slug": "default", "name": "In-product assistant", "kind": "in_product", "status": "published",
      "links": null, "updatedAt": "…" },
    { "id": "exp_2", "slug": "acme-tour", "name": "Acme product tour", "kind": "hosted", "status": "published",
      "links": { "page": "https://app.scout.example/d/acme-tour", "embed": "https://app.scout.example/d/acme-tour/embed" },
      "updatedAt": "…" }
  ] }
```

The `hosted` kind and `links` arrive in Release B; in Release A every experience is `in_product` with `links: null`.

#### `POST /v1/client/links` (Release B)

Creates a personalised, reusable link to a hosted experience.

```json
request
{ "experienceSlug": "acme-tour", "context": { "company": "Globex", "plan": "Growth", "contactEmail": "jo@globex.com" } }
201
{ "id": "lnk_3x", "token": "lnk_3x9Qe…", "url": "https://app.scout.example/d/lnk_3x9Qe…", "createdAt": "…" }
```

- No expiry; works while the experience is published. `context` (≤ 32 KB, ≤ 5 levels) can't be edited; create a new link instead.
- Tokens start with `lnk_` and slugs may not, so `/d/<x>` is never ambiguous.
- The model receives `context` as visitor context: data, never instructions. The session records it.
- **Errors.** A non-`hosted` experience: `422 validation_failed`. Unknown or unpublished slug: `404 not_found`.

#### `GET /v1/client/sessions`

**Query parameters:** `limit`, `cursor`; `startedFrom`, `startedTo` (ISO, inclusive); `updatedFrom` (ISO; picks up late changes such as insights); `type=prod|test` (may repeat; default `prod`); `validity=valid|invalid|unknown` (may repeat; default `valid` and `unknown`); `experience=<slug>`.

Newest first, by `startedAt` then `id`. **Incremental sync, Supersonik-style:** store the newest `startedAt` (or `updatedAt`) seen, pass it as `startedFrom` (or `updatedFrom`) next time, and de-duplicate by `id`.

```json
200
{ "sessions": [
    { "id": "ses_4hq9", "experienceSlug": "default", "type": "prod", "delivery": "in_product",
      "startedAt": "…", "endedAt": "…", "updatedAt": "…", "validity": "valid",
      "configVersion": 12, "linkId": null, "visitor": { "email": null },
      "params": { "utm_source": "newsletter" }, "turnCount": 6, "runCount": 1 } ],
  "nextCursor": "c_…" }
```

**`validity`** **[N]:** `unknown` until the session has ended and been processed; `invalid` if there was no visitor turn and no run, or it was flagged as abuse; `valid` otherwise.

#### `GET /v1/client/sessions/{sessionId}`

Everything in the list item, plus:

```json
{ "agentVersion": "1.0.0", "page": { "origin": "https://app.acme.com", "path": "/settings" }, "context": null,
  "runs": [ { "id": "run_1", "workflowId": "invite-teammate", "revision": 3, "title": "Invite a teammate",
              "result": "completed", "stepsVerified": 5, "failedStep": null, "error": null,
              "startedAt": "…", "finishedAt": "…" } ],
  "insights": [ { "key": "buying_intent", "name": "Buying intent", "outputType": "choice", "value": "high",
                  "status": "ready", "generatedAt": "…" } ],
  "transcriptUrl": "https://api.scout.example/v1/client/sessions/ses_4hq9/transcript" }
```

- `context` is the link's context; `null` for in-product sessions.
- **Insights are PROPOSED** (§7, question 20), generated after a session ends. Until then the list is empty.

#### `GET /v1/client/sessions/{sessionId}/transcript`

```json
200
{ "sessionId": "ses_4hq9",
  "messages": [
    { "seq": 1, "role": "visitor", "text": "add priya@example.com as an admin", "source": "voice", "at": "…", "runId": null },
    { "seq": 2, "role": "scout",   "text": "I'll invite priya@example.com as an Admin.", "source": "voice", "at": "…", "runId": "run_1" }
  ] }
```

- `role` keeps the prototype's `ChatTurn` roles, `visitor` and `scout` **[P]** (Supersonik uses the agent's name or `'Participant'`).
- Not paginated: a session has at most 500 turns.

### 3.6 Hosted delivery URLs (Release B, PROPOSED)

Not API endpoints; listed so the names stay fixed.

| URL | Use |
|---|---|
| `https://app.scout.example/d/{slug}` | Plain link to a hosted experience |
| `https://app.scout.example/d/{slug}/embed` | Iframe (`allow="microphone; fullscreen"`, `allowfullscreen`, HTTPS only) |
| `https://app.scout.example/d/{linkToken}` | Personalised link from `POST /v1/client/links`. No `/embed` variant, as in Supersonik |

**Resize.** The iframe sends `postMessage({ source: "scout-embed", type: "resize", height }, "*")`. The parent accepts it only if `event.origin === "https://app.scout.example"` and `event.source === iframe.contentWindow`.

**Agent sign-in on a hosted page.** The hosted runner creates the session on the server and injects its `sessionToken` into the page; `@scout/agent` then uses `X-Scout-Session` with no publishable key (CORS in §2.2). How runner commands and the stream travel is defined in `scout-cloud/docs`.

---

## 4. Data model

**[P]** and **[N]** apply per field; a wholly new entity is marked once.

### 4.1 Project, AllowedOrigin, Key, Admin **[N]**

| Entity | Fields |
|---|---|
| `Project` | `id` (`prj_`), `name`, `createdAt`, `configVersion` (integer; increases with each published change), `defaultExperienceId`, `monthlyBudgetUsd`, `paramAllowlist: string[]` |
| `AllowedOrigin` | `id` (`ori_`), `projectId`, `origin` (exact, §2.2), `createdAt`, `createdBy` |
| `Key` | `id` (`key_`), `projectId`, `kind` (`publishable` \| `secret`), `label`, `last4`, `secretHash` (secret keys only), `createdAt`, `lastUsedAt`, `revokedAt`, `flaggedAt` (for example, after `secret_key_in_browser`) |
| `Admin` | `id` (`adm_`), `email`, `identityProviderId`, `roles: { projectId, role: "owner" \| "admin" }[]` |

### 4.2 Fact

Fields: `id` (`fct_`) **[N]**; `text`, ≤ 500 characters (in the prototype a fact is a plain string in `dashboardFacts: string[]` **[P]**); `order`, `updatedAt` **[N]**.

Facts are what Scout may say about the product; recording workflows doesn't teach them **[P]**. Server only; any change bumps `configVersion`.

### 4.3 Workflow, WorkflowRevision, WorkflowDefinition

A workflow is a saved, reviewed list of steps. Each edit makes a new **revision**; visitors only see the published one, and an edited revision must be validated again before publishing.

**`Workflow`** **[N]** (the container): `id` (§3.1: recorded `<slug>-<base36>` or seeded, such as `invite-teammate` **[P]**; unique within the project **[N]**), `projectId`, `latestRevision`, `publishedRevision` (integers; `publishedRevision` is `null` when not live), `createdAt`, `updatedAt`, `archivedAt`.

**`WorkflowRevision`** = a `WorkflowDefinition` plus `workflowId`, `revision`, `status`, `createdBy`, `createdAt`, `recordingId?`, `lastValidationRunId?` **[N]**.

**`WorkflowDefinition`** is the prototype's `Workflow` type, extended. It is what the runner executes.

| Field | Type | Origin |
|---|---|---|
| `id` | string | **[P]** |
| `version` | integer: the **schema** version, `1`, `2` or `3` (§6.2) | **[P]** (prototype writes 2) |
| `title` | string | **[P]** |
| `purpose` | string | **[P]** |
| `examples` | string[] (example *requests*, such as "add alex as an admin") | **[P]** |
| `inputs` | `Input[]` (§4.3.1) | **[P]** |
| `steps` | `Step[]` (§4.3.2) | **[P]** |
| `outcome?` | string. Said after every step is verified; may use `{inputName}`. | **[P]** |
| `startingConditions?` | `StartingConditions` (§4.7) | **[N]** (designed in the prototype, never built) |

**Statuses** belong to a revision **[N]**, mapping the prototype's `SavedWorkflow.enabled` onto Supersonik's testing and published states. Transitions: any save or edit creates a new revision in `draft`; a passed validation on that revision moves it to `testing`; the admin publishes it to `published`; unpublish returns it to `testing`; publishing revision n moves the previously published revision to `retired`. The published revision keeps serving while a newer one is in `draft` or `testing`.

| Status | Who can run it | Prototype equivalent |
|---|---|---|
| `draft` | Admins, for validation only | `enabled: false` ("not validated") |
| `testing` | Admins, and `type: "test"` sessions (in their catalog) | `enabled: true` (the prototype had only one audience) |
| `published` | Everyone in the experience. At most one revision per workflow. | `enabled: true`, and the built-in workflows |
| `retired` | Nobody. Kept so old sessions can still be explained. | none |

**Validation rule.** A revision becomes `testing` only after a `passed` ValidationRun on *that* revision, carrying over the prototype's "enabled only after it replays successfully from Reset" **[P]**.

#### 4.3.1 Input

| Field | Notes |
|---|---|
| `name` | Matches `^[a-z][A-Za-z0-9]*$`. Unique within the workflow. **[P]** |
| `label` | Shown in clarifying questions, such as "I need: Email". **[P]** |
| `example` | The recorded value validation replays with. **Removed** from the agent config and the model's catalog. Required, except on a `masked` input. **[P]** |
| `masked?` | `true` when the value came from a masked or sensitive field (§4.6). It has **no** `example`; validation asks the admin for a value, uses it for that replay only, and reports `values: "examples+prompted"`. **[N]** |
| `allowedValues?` | `string[]`. The model is told these values. `readDecision` turns any other value into `clarify` naming them; `resolveWorkflow` rejects it. **[N]** (planned in prototype LLD §20) |

**Rules carried over [P]:** every declared input needs a non-blank value; `resolveWorkflow` rejects values for undeclared names, while `readDecision` drops them (deliberate); a placeholder naming an undeclared input is an error.

#### 4.3.2 Step

```ts
type Step = {
  action: string;          // [P] registered action id (tier 2) or a reserved generic id (tier 0)
  target?: Locator;        // [N] tier 0/1 only: which element (§4.6)
  input?: unknown;         // [P] may contain { $input: name } anywhere
  expect?: unknown;        // [P] tier 2: binding-defined. Tier 0: Check[] (§4.6)
  narration?: string;      // [P] said before the step; may use {inputName}; presentation only
};
```

**Placeholders** are `{ "$input": "<name>" }`, an object with exactly one key **[P]**. They can appear anywhere in `input` and `expect`, and **[N]** in `target` text fields (for example "click the row whose text is `{ $input: "email" }`"). `resolveWorkflow` fills them before every run; the runner and verifiers never see one **[P]**.

**Reserved generic actions** (tier 0) **[N]**, handled by `@scout/agent`. No other binding may register an id starting with `ui.` or `page.`.

| `action` | `target` | `input` | Default check when `expect` is absent |
|---|---|---|---|
| `ui.click` | required | none | **None. A click must have at least one confirmed check in `expect`**, or validation fails with "Step N needs a check". |
| `ui.type` | required | `{ "value": string }`, the final value | The field's value equals `value` |
| `ui.select` | required | `{ "value": string }`, the option's `value` attribute. Its visible label is kept on the recorded entry as `optionLabel` for review (§4.8), not in the step. | The selected value equals `value` |
| `ui.check` | required | `{ "checked": boolean }` | The checked state equals `checked` |
| `ui.press` | optional (default: the focused element) | `{ "key": "Enter" \| "Escape" \| "Tab" }` | None; needs `expect` |
| `page.navigate` | none | `{ "path": "/settings" }`, same-origin, recorded only, never from the model | The location's path equals `path` |

**Tier-2 steps** keep the prototype's shape exactly, such as `{ "action": "invite.setEmail", "input": { "email": { "$input": "email" } } }`, verified by the binding's verifier for that action id **[P]**.

**Example tier-0 step** (version 3):

```json
{ "action": "ui.type",
  "target": { "description": "Email field in the invite form",
              "strategies": [ { "kind": "hint",  "id": "invite-email" },
                              { "kind": "label", "text": "Email" },
                              { "kind": "role",  "role": "textbox", "name": "Email" },
                              { "kind": "css",   "selector": "#invite-email" } ] },
  "input": { "value": { "$input": "email" } },
  "narration": "I'll type the email address: {email}." }
```

### 4.4 PublicWorkflow (agent config) and CatalogEntry (model)

Two views of a published revision:

- **`PublicWorkflow`**: a `WorkflowDefinition` plus `revision`, with `example` removed from every input. The browser runs it.
- **`CatalogEntry`**: the prototype's type, unchanged **[P]**: `{ id, title, purpose, examples, inputs: { name, label }[] }`, plus optional `inputs[].allowedValues` **[N]**. The model reads it. It never contains steps, locators or example values.

### 4.5 Experience **[N]**

A configured entry point; the equivalent of Supersonik's "launch config".

| Field | Notes |
|---|---|
| `id` (`exp_`), `projectId`, `slug`, `name` | A slug matches `^[a-z0-9][a-z0-9-]{0,63}$` and must not start with `lnk_`. |
| `kind` | `in_product` (Release A) \| `hosted` (Release B) |
| `status` | `testing` \| `published`. PROPOSED: the status is not access control; anyone with the key (in-product) or URL (hosted) can load a `testing` experience, as with Supersonik's testing launch configs. Every session on a `testing` experience has `type: "test"`, so it never counts in the Client API's default `type=prod` sync. |
| `workflowIds?` | `null` means every published workflow |
| `appearance` | `{ position: "bottom-right" \| "bottom-left", accentColor, launcherLabel }`. More colour roles later. |
| `language` | `"auto"` (from `navigator.languages`) or a BCP 47 tag |
| `hosted?` | Release B: `{ startUrl, browserContextId }`. Defined in `scout-cloud/docs`. |

Each project has one default `in_product` experience, created with the project.

**Slug uniqueness.** `in_product` slugs are unique within the project, so every project can have `default`. `hosted` slugs appear in global URLs (§3.6), so they are unique **across all projects**; a taken slug returns `409 invalid_state` on create or rename **[N]**.

### 4.6 Locator and Check **[N]** (tier 0 and tier 1)

Without tier-2 code, Scout finds elements again on a later visit from a *description* saved at recording, with several strategies tried in order. If none finds exactly one visible element, the step stops with a clear reason; it never guesses.

```ts
type Locator = {
  description: string;            // human-readable, for review and failure messages: "Invite teammate button"
  strategies: Strategy[];         // tried in order; 1–6
  within?: Locator;               // optional scope, e.g. the table row containing some text
};

type Strategy =
  | { kind: "hint";  id: string }                                  // [data-scout-id="<id>"] (tier 1)
  | { kind: "role";  role: string; name: string | InputRef }       // ARIA role + accessible name
  | { kind: "label"; text: string | InputRef }                     // form control by its <label> / aria-label
  | { kind: "text";  text: string | InputRef; tag?: string }       // visible text, optional tag name
  | { kind: "near";  text: string; role?: string }                 // element closest to a piece of visible text
  | { kind: "css";   selector: string };                           // last resort; recorded, never model-supplied
```

**Resolution.** For each strategy, in order:
1. Collect every match in the document, excluding Scout's own Shadow DOM.
2. Keep only visible matches: layout boxes and computed `visibility: visible`, as the prototype's `isVisible` **[P]**.
3. If the locator has `within`, resolve it first by these rules; it must give exactly one element. Keep only matches inside it.
4. Exactly one match: stop and check that element:
   - Inside `[data-scout-ignore]`: `ignored`; the step fails at once with "<description> is off limits".
   - An action target (not a check target) that is disabled, has `aria-disabled="true"`, or is inside a disabled fieldset: `disabled`; the step fails at once.
   - Otherwise use it.
5. Zero or several matches: try the next strategy.

**When no strategy gives exactly one match:** if nothing was found by any strategy, `missing`, retried within the step's timeout (the prototype's "absence can mean not yet" rule); if something was found more than once, `ambiguous`, and the step fails at once. Failure messages name the locator's `description`.

**Recording order:** `hint` (if present), `role`, `label`, `text`, `near`, `css` last.

**Tier-1 attributes** are reserved **[N]**; the prototype's other `data-scout-*` names stay free for tier-2 bindings.

| Attribute | Meaning |
|---|---|
| `data-scout-id="<name>"` | A stable target name, unique on the screen. It is the `hint` strategy. |
| `data-scout-ignore` | Never record this element or anything inside it, and never act on it |
| `data-scout-mask` | Record actions on this field, but never its value. The value must become a declared input, or the step is dropped in review. |

**Privacy rule** **[N]:** the recorder never captures, and never uploads, the value of `input[type=password]`, fields with `autocomplete` values `cc-*`, `one-time-code` or `current-password`/`new-password`, or `data-scout-mask` fields.

#### Check (the `expect` of tier-0 steps)

```ts
type Check =
  | { kind: "visible"; target: Locator }
  | { kind: "hidden";  target: Locator }
  | { kind: "text";    target: Locator; equals?: string | InputRef; includes?: string | InputRef }
  | { kind: "value";   target: Locator; equals: string | InputRef }
  | { kind: "url";     pathEquals?: string; pathMatches?: string };   // pathMatches: a recorded pattern like "/users/*"
```

A step passes only when **all** its checks pass within the step timeout: 2,000 ms by default, polling every 50 ms, as the prototype's `waitForCondition` **[P]**. These are settings, not measured latencies.

### 4.7 StartingConditions **[N]**

Replaces the prototype's "Reset before record and validate", because a client's app can't be wiped.

```ts
type StartingConditions = {
  path?: string;        // same-origin path to navigate to before step 1, e.g. "/settings"
  checks?: Check[];     // must pass before step 1; otherwise the run stops: "This demo needs …"
};
```

The recorder sets `path` to the page where recording started; the admin can edit it in review.

### 4.8 Session, Turn, Run, ValidationRun, Insight, Recording

**`Session`** **[N]:**

| Field | Notes |
|---|---|
| `id` (`ses_`), `projectId`, `experienceId` | |
| `type` | `prod` \| `test`. Teach-mode and admin sessions are `test`, and so is every session on a `testing` experience (§4.5). |
| `delivery` | `in_product` \| `hosted_link` \| `hosted_embed` \| `embed_widget` |
| `configVersion`, `agentVersion` | Pinned at start (§6.3) |
| `startedAt`, `lastActivityAt`, `endedAt`, `updatedAt` | |
| `page` | `{ origin, path, title }`, with no query string |
| `params` | The allowlisted query parameters |
| `context` | From a link; `null` otherwise |
| `linkId` | `null` unless the session came from a link |
| `visitor` | `{ memoryId?, email? }` |
| `validity` | `valid` \| `invalid` \| `unknown` |

**`Turn`** is the prototype's `ChatTurn { role, text }` **[P]**, plus **[N]** `sessionId`, `seq`, `at`, `source` (`chat` \| `voice`), `decisionKind?`, `workflowId?`, `runId?`, `modelMs?`.

**`Run`** **[N]** records the prototype's `RunResult` / `StepLog` **[P]**: `id` (`run_`), `sessionId`, `workflowId`, `revision`, `inputs`, `guided`, `startedAt`, `finishedAt`, `result` (`completed` \| `failed` \| `cancelled`), `failedStep`, `error`, `steps: { step, action, ok, error?, elapsedMs }[]`, `timings`. `StepLog.at` (`performance.now()`) becomes `elapsedMs` from the run's start; `RunResult.cancelled` becomes `result: "cancelled"`.

**`ValidationRun`** **[N]**: the same step shape as `Run`, plus `id` (`val_`), `workflowId`, `revision`, `adminId`, `agentVersion`, `page.origin`, `result` (`passed` \| `failed` \| `cancelled`), `values: "examples" | "examples+prompted"`.

**`Recording`** **[N]**: `id` (`rec_`), `projectId`, `sessionId`, `createdBy`, `startedAt`, `page`, `expiresAt`, and `entries: RecordedEntry[]`. Each entry is the prototype's `{ step, result }` **[P]** plus `observed: Check[]` **[N]** and, for `ui.select` only, `optionLabel?: string`, the chosen option's visible text **[N]**.

**`InsightDefinition`** and **`Insight`** **[N]**, PROPOSED (not in Release A's minimum), generated from the transcript after a session ends:
- `InsightDefinition { key, name, outputType: "text" | "boolean" | "number" | "choice", choices?, instruction }`, per project.
- `Insight { sessionId, key, name, outputType, value, status: "pending" | "ready" | "failed", generatedAt, model }`.

### 4.9 ConfigSnapshot **[N]**

An immutable record of what visitors could use at a given `configVersion`: `projectId`, `configVersion`, `createdAt`, `createdBy`, `workflows` (`{ workflowId, revision }[]`, the published revisions), `facts` (the fact texts at that version), `experiences` (the settings for each published experience).

`testing` experiences and `testing` revisions are not in any snapshot; they are read live at each request (§6.3).

---

## 5. Decision contract

### 5.1 What carries over from the prototype, and what changes

The model step works as in the prototype: message, recent chat, facts and workflow list in; one strict JSON decision out, checked on both sides. One change: the *server* loads the facts and catalog from the published config, because with a public key anyone could otherwise send their own "facts" and use Scout as a free chatbot.

| | Prototype (`scout-demo` `POST /api/scout`) | v1 (`POST /v1/agent/decide`) |
|---|---|---|
| Browser sends | `ScoutRequest { message, history, workflows: CatalogEntry[], facts }` **[P]** | `{ sessionId, requestId, message, history, source }` |
| Catalog and facts | Sent from the browser | Loaded by the server from the session's `ConfigSnapshot`. For `test` sessions, `testing` revisions are added (read live, §6.3). Experience `workflowIds` filter applies. |
| Server builds | — | The same internal `ScoutRequest`, plus `context` (from a link) as visitor context |
| Model call | Server only, strict schema `scout_decision` | Unchanged |
| Server check | `readDecision(raw, request.workflows)` | Unchanged, plus the **[N]** `allowedValues` rule (§5.3), against the catalog the server built |
| Response | `{ ok: true, decision, modelMs }` or `{ ok: false, error }` | `{ requestId, configVersion, decision, modelMs }`, or the standard error shape |
| Browser check | `readDecision` against what is enabled now, then `resolveWorkflow` | Unchanged (§5.4) |

`readScoutRequest` and `readDecision` move into `@scout/core`, copied from `scout-demo` `lib/scout/core/decision.ts`. PROPOSED (pending Ayush): `scout-cloud` imports them from `@scout/core`, as the prototype shared one `decision.ts` **[P]**; copying them with provenance is the alternative.

**[N]** `readScoutRequest`'s catalog check (`readCatalogEntry`) is extended to keep and validate `inputs[].allowedValues` (§3.2). The prototype rebuilt each input as `{ name, label }`, which would silently drop them.

### 5.2 Model output: the strict JSON schema **[P]**, unchanged

```json
{ "type": "object", "additionalProperties": false,
  "required": ["kind", "workflowId", "inputs", "message"],
  "properties": {
    "kind":       { "type": "string", "enum": ["run", "answer", "clarify", "unsupported"] },
    "workflowId": { "type": ["string", "null"] },
    "inputs":     { "type": "array",
                    "items": { "type": "object", "additionalProperties": false, "required": ["name", "value"],
                               "properties": { "name": { "type": "string" }, "value": { "type": "string" } } } },
    "message":    { "type": "string" } } }
```

- **Every field is always present**, as strict schemas require.
- **`inputs` is a list of `{ name, value }` pairs**, because strict schemas can't have free-form keys. The server turns them into `{ [name]: value }` before `readDecision`.
- **Kinds other than `run`** have `workflowId: null` and `inputs: []`.
- **Model and effort** are chosen in one server module, as `SCOUT_MODEL` was. Today: `gpt-6-luna`, `DECISION_EFFORT = "low"`, `max_output_tokens: 400`. A server setting, not part of this contract.

### 5.3 Decision returned to the browser **[P]**, unchanged

```ts
type ScoutDecision =
  | { kind: "run"; workflowId: string; inputs: Record<string, string>; message: string }
  | { kind: "answer" | "clarify" | "unsupported"; message: string };
```

What `readDecision` does on both sides (copied from the prototype **[P]**, plus the **[N]** rules):
- Returns `null` when the value isn't an object, the message isn't a string of ≤ 1,000 characters, the kind is unknown, a `run` has a non-string `workflowId`, or an `answer`, `clarify` or `unsupported` message is blank after trimming.
- A run with a blank message gets `Showing <title>.`
- A run naming a workflow outside the catalog becomes `clarify`: "I'm not sure which demo you mean…".
- A run with a missing or blank declared input becomes `clarify`: `To show "<title>", I need: <labels>.`
- Input values are trimmed; undeclared names are dropped.
- **[N]** A value outside an input's `allowedValues` becomes `clarify` naming the allowed values.
- **[N]** A value over 200 characters after trimming (§3.2) becomes `clarify`: `The value for <label> is too long.`

**Messages:** for `run`, one short sentence of **intent** ("I'll invite…"), never a success claim; success is said only after every step is verified, with the workflow's `outcome` or "Done: <title>." **[P]**. For `answer`, only facts **[P]**.

### 5.4 Browser re-check before acting **[P]**, extended

Before a run starts, the browser checks these in order; the first failure stops it with a clear message:

1. The reply's `requestId` is still the latest; a stale reply is dropped silently **[P]**. A new message, Stop, the microphone, starting a run, validation or teach mode, and destroying the runtime also cancel a pending request. **[N]** Unlike the prototype, there is no Reset, and a host-page click while Scout is thinking does not cancel (clicks are watched only during a run).
2. `readDecision(decision, currentCatalog)` gives the same kind. `currentCatalog` is the workflows in this tab's agent config whose schema `version` this agent supports **[N]**.
3. `resolveWorkflow(workflow, decision.inputs)` succeeds **[P]**.
4. **[N]** Tier 2: every registered `action` in the steps exists in the current binding. Tier 0: `startingConditions` can be reached.
5. During the run, each step: run still active → act → verify within a bounded timeout → log **[P]**.

---

## 6. Versioning and compatibility

"Version" means different things; these are kept separate:

| Name | What it versions | Where it appears |
|---|---|---|
| **API version** | The HTTP contract | The path: `/v1/` |
| `version` (workflow) | The **schema** of a `WorkflowDefinition` | The field `version` (kept from the prototype) **[P]** |
| `revision` | One workflow's content, increasing with each edit | `WorkflowRevision.revision`, run records, validation runs **[N]** |
| `configVersion` | Everything visitors could use in a project at that moment | Snapshots, sessions, the config `ETag` **[N]** |
| `agentVersion` | The `@scout/agent` build that ran | Sessions, validation runs, recordings **[N]** |

### 6.1 API version

- The version is in the path: `/v1/…`.
- **Within v1, only additive changes:** new endpoints, optional request fields, response fields, error codes and event types.
- **Closed enums** don't gain values within v1: `ScoutDecision.kind`, `WorkflowRevision.status`, `Session.type`, `Run.result`. A browser treats an unknown `kind` as unusable (`readDecision` returns `null`).
- **Breaking changes go to `/v2`.** v1 stays at least 6 months after v2 ships (PROPOSED). Deprecated endpoints send `Deprecation` and `Sunset` headers.

### 6.2 Workflow schema version

| `version` | Shape | Status |
|---|---|---|
| 1 | `id`, `title` and steps only | Prototype legacy. Upgraded in memory to v2 with empty `purpose`, `examples` and `inputs`, as `workflow-store.ts` did **[P]**. |
| 2 | Adds `purpose`, `examples`, `inputs`, `$input`, step `narration` and `outcome` | What the prototype writes **[P]** |
| 3 | Adds step `target`, the reserved `ui.*` and `page.*` actions, `Check[]` as `expect`, `startingConditions`, `inputs[].allowedValues` and `inputs[].masked` | PROPOSED **[N]** |

- **Readers** accept every version up to the highest they know and upgrade older ones in memory. **Writers** always write the latest.
- **An agent given a newer version than it knows** doesn't run that workflow; the config endpoint reports it in `skipped` with `reason: "needs_newer_agent"`, using the agent's `maxWorkflowVersion`.
- **Saved data is untrusted.** Workflow JSON from storage or the network is shape-checked on load, as `isWorkflow` did **[P]**: on the server when saving, in the browser when loading config.

### 6.3 Config version per session

Works like Supersonik's `agent_config_version`.

- **What bumps it.** Publishing or unpublishing a workflow, replacing facts, or changing a published experience increases `Project.configVersion` by one and writes a `ConfigSnapshot`.
- **Sessions are pinned** to the snapshot they started with, for every decision; a mid-session publish never changes what a `prod` session on a published experience sees.
- **Not pinned [N]:** `testing` revisions and `testing` experiences (§4.9) are read live at each request.
- **Reproducibility.** A session, transcript and runs can be explained later from the snapshot and the workflow revisions.

### 6.4 Agent version and the loader

- **The script tag loads a small loader at a stable path,** `https://cdn.scout.example/agent/v1/loader.js`, which loads an exact runtime build such as `https://cdn.scout.example/agent/1.0.0/agent.js`. The loader only moves within major version 1.
- **npm** clients (`@scout/agent`, `@scout/react`, `@scout/actions`) pin exact versions themselves.
- **The runtime sends `agentVersion`** on config, session, recording and validation calls.
- **Storage keys use the prefix `scout:`** (§8). The new runtime never reads `scout.workflows.v1`; whether prototype workflows move over is open (§7, question 19).

---

## 7. Open questions

None is decided by this document; decisions made since are noted on the question.

1. **Domain.** What are the real hosts behind `api`, `cdn` and `app.scout.example`?
2. **Admin sign-in provider.** Clerk or Google OAuth? This also decides how the console session is stored.
3. **scout-cloud stack.** Decided 14 Oct (Ayush): the prototype's Next.js stack, with thin route handlers over framework-free modules (`scout-cloud/docs/CLOUD_DESIGN.md` §10.1).
4. **Database.** SQLite first, then Postgres, has been suggested. Pending approval.
5. **Wildcard origins.** Should `https://*.acme.com` be allowed, or exact origins only, as in v1?
6. **Server-built history.** Should decide use the server's stored last 8 turns instead of trusting the browser's `history`?
7. **Context in-product.** Should Release A have a browser `scout('context', {...})` command (untrusted), or should context come only from server-created links in Release B?
8. **Prefilled inputs.** Should link `context` pre-fill declared inputs (for example `context.contactEmail` → `email`), or only be shown to the model?
9. **Tier-2 workflows defined in code.** Prototype built-ins lived in code, but the v1 catalog is server-side. Upload them with an admin CLI, push them from `@scout/actions` at startup with an admin token, or require every model-selectable workflow to be taught or created in the console?
10. **Where validation runs.** Admin-reported in Release A. In Release B, should publishing require a validation in a hosted browser?
11. **Personal data.** Should run `inputs` and transcripts be stored, and for how long? Is per-project redaction needed? Which region?
12. **Bot protection.** Is a challenge needed on `POST /v1/agent/sessions`, such as Cloudflare Turnstile? What should the default budgets and rate limits be after measurement?
13. **Pagination.** Cursor (proposed) or Supersonik-style page numbers?
14. **Validity rules.** Beyond "no visitor turn and no run", what makes a session `invalid`?
15. **Test and live keys.** Split keys by environment (`scout_pk_test_`, `scout_pk_live_`), or is the `prod`/`test` session `type` enough?
16. **Webhooks and Slack.** Add `session.ended` and `insights.ready` webhooks, Slack notifications or an MCP server? Later work; nothing in v1 depends on them.
17. **Content Security Policy.** Can the client's CSP stay at `script-src https://cdn.scout.example` and `connect-src https://api.scout.example`, or does Shadow DOM styling need a `style-src` allowance? Constructable stylesheets need testing on target browsers. Cloud speech would add a media host.
18. **Both scripts on one page.** Can the `@scout/agent` and `@scout/embed` loaders run on the same page? Both use the `scout` global; v1 doesn't support loading both.
19. **Importing prototype workflows.** The prototype's `localStorage` workflows have no locators. Build a one-time importer for tier-2 rehearsal apps, or teach them again?
20. **Insights.** Who defines them, the client or a fixed default set? What does generating them cost per session?
21. **Account or organisation level.** Keys, budgets and rate limits are per project, and v1 assumes one project per client (§2.1). Is an account or organisation entity needed for one secret key across projects, account-level budgets and billing, and shared admins?
22. **Allowlist after D1** (§2.2). D1 runs without one (decided, Ayush 14 Oct). When one is added, should an empty allowlist mean any origin, Supersonik-style, and should the console warn, or require an allowlist, before a project counts as production?
23. **D1 teach passcode** (§2.6). Accepted for D1 (Ayush, 14 Oct). Open: is `X-Scout-Teach-Passcode` the right header name, and how is it set and rotated without a console (for example in the project's JSON file or a cloud environment variable)?

---

## 8. Names index

Every new doc uses these exact names.

| Kind | Names |
|---|---|
| Repos | `scout-demo` (frozen at `aafd6a2`), `scout-js`, `scout-cloud`, `scout-server-sdks` (future) |
| Packages (`scout-js`) | `@scout/core`, `@scout/agent`, `@scout/actions`, `@scout/react`, `@scout/embed`. Tier 1 is the `data-scout-*` hint convention (`data-scout-id`, `data-scout-ignore`, `data-scout-mask`); it has no package. |
| Tiers | Tier 0: recorded by element description (`@scout/agent`). Tier 1: `data-scout-*` hints. Tier 2: actions registered in code (`@scout/actions`, `@scout/react`). |
| Releases | Release A: in-product script tag. Release B: hosted demos (link, iframe, `@scout/embed`). Deliverables (Ayush, 14 Oct): D1 (React app, minimal cloud), D2 (classic Java app, full cloud), D3 (Release B spike). |
| Hosts (placeholders) | `https://api.scout.example`, `https://cdn.scout.example`, `https://app.scout.example` |
| API namespaces | `/v1/agent/*` (publishable key), `/v1/admin/*` (admin token), `/v1/client/*` (secret key) |
| Credentials | `scout_pk_…`, `scout_sk_…`, admin token (`teach` and `console` scopes), session token. D1 only: teach passcode (§2.6). |
| Headers | `X-Scout-Key`, `X-Scout-Session`, `Authorization: Bearer`, `If-Match: "rev-<n>"`, `ETag: "cfg-<n>"`, `Retry-After`. D1 only: `X-Scout-Teach-Passcode` (§2.6). |
| ID prefixes | `prj_` `key_` `ori_` `adm_` `exp_` `rec_` `val_` `ses_` `run_` `lnk_` `fct_` `req_`. Recorded workflow ids are `<slug>-<base36>`; seeded or built-in ids such as `invite-teammate` are allowed; all match `^[a-z0-9][a-z0-9-]{0,99}$`. |
| Script URLs | `https://cdn.scout.example/agent/v1/loader.js`, `https://cdn.scout.example/embed/v1/loader.js` (Release B) |
| Browser global | `window.scout`, a queue stub: `window.scout = window.scout \|\| function () { (window.scout.q = window.scout.q \|\| []).push(arguments) }` |
| Script attributes | `data-project-key`, `data-experience`, `data-position`, `data-accent-color`, `data-launcher-label`, `data-language`. PROPOSED: `data-api-origin` (development only, §3.1) |
| npm options (PROPOSED) | `createScout({ projectKey, experience, apiOrigin })`; `apiOrigin` is the npm form of `data-api-origin` (§3.1) |
| Commands | `scout('open')`, `scout('close')`, `scout('identify', {memoryId, email})`, `scout('resetIdentity')`, `scout('language', tag \| 'auto')`, `scout('appearance', {...})`. Reserved for later: `scout('memory', {consent})`. |
| Teach switch | URL parameter `scout=teach` |
| DOM attributes | `data-scout-id`, `data-scout-ignore`, `data-scout-mask`. The widget is a custom element `<scout-agent>` with a Shadow DOM. |
| postMessage | `{ source: "scout-console", type: "teach-token", … }`, `{ source: "scout-embed", type: "resize", height }` |
| Storage keys | `sessionStorage`: `scout:<projectId>:session`, `scout:<projectId>:run` (resume after reload), `scout:<projectId>:teach`. `localStorage` (only with consent, later): `scout:<projectId>:memory`. |
| Enums | Revision status: `draft` `testing` `published` `retired`. Experience kind: `in_product` `hosted`. Session type: `prod` `test`. Delivery: `in_product` `hosted_link` `hosted_embed` `embed_widget`. Decision kind: `run` `answer` `clarify` `unsupported`. Run result: `completed` `failed` `cancelled`. Validation result: `passed` `failed` `cancelled`. Validation values: `examples` `examples+prompted`. Locator outcome: `missing` `ambiguous` `disabled` `ignored`. Turn role: `visitor` `scout`. Turn source: `chat` `voice`. Validity: `valid` `invalid` `unknown`. |
| Generic actions | `ui.click` `ui.type` `ui.select` `ui.check` `ui.press` `page.navigate` |
| Locator strategies | `hint` `role` `label` `text` `near` `css` |
| Check kinds | `visible` `hidden` `text` `value` `url` |
| Carried-over core names **[P]** | `ActionResult`, `ActionRegistry`, `WorkflowStep` (named `Step` here), `Workflow` (named `WorkflowDefinition` here), `WorkflowInput` (named `Input` here), `InputValues`, `VerifierRegistry`, `ScoutBinding`, `CatalogEntry`, `ChatTurn`, `ScoutRequest`, `ScoutDecision`, `LIMITS`, `readScoutRequest`, `readDecision`, `resolveWorkflow`, `runWorkflow`, `waitForCondition`, `appendRecordedEntry`, `declareInputs` |
