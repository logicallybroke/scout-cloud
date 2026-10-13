# Scout API contract (v1)

**Status: PROPOSED, for Ayush's review (13 October 2026). Nothing in this file is built.**

This file defines the names and data shapes shared by the browser SDKs (`scout-js`) and the backend (`scout-cloud`). Every other new design doc uses the names defined here. A design doc that needs a new name adds it here first.

- **Two identical copies.** One is `scout-js/docs/API_CONTRACT.md` and the other is `scout-cloud/docs/API_CONTRACT.md`. Change both in the same review. Before committing either, check that they still match with `diff ../scout-js/docs/API_CONTRACT.md docs/API_CONTRACT.md`.
- **Where the shapes come from.** The prototype at `scout-demo@aafd6a2`, which is frozen. Its file `lib/scout/core/contracts.ts` is the source of every shape marked **[P]** below. **[N]** marks something new. Code is copied from scout-demo with provenance, never moved.
- **Hosts are placeholders.** `https://api.scout.example`, `https://cdn.scout.example` and `https://app.scout.example` stand in for real hosts. **No domain has been chosen yet.**
- **Release labels.** Release A is the in-product script tag. Release B is hosted, Supersonik-style demos. Each part below is labelled with the release it belongs to. Anything not labelled belongs to Release A.

Contents:

1. Overview
2. Keys and identity
3. Endpoints (v1)
4. Data model
5. Decision contract
6. Versioning and compatibility
7. Open questions
8. Names index

---

## 1. Overview

### In plain language

Scout has three parties.

1. **The browser.** Scout's runtime runs inside the client's web page. It shows the chat widget, listens to voice, records an admin's clicks, and replays workflows by clicking and typing in the real page. It checks the screen after every step. The client's backend language (Java, Python, anything) does not matter here. What matters is whether the frontend is a single-page app or reloads the page on every navigation.
2. **Scout Cloud.** Our server. It stores projects, keys, workflows and facts. It calls the model to decide what a visitor's message means. It records sessions and transcripts. Later it also runs hosted demo browsers.
3. **The client's own server** (optional). It uses a secret key to ask Scout Cloud for sessions, transcripts and insights, for example to sync them into a CRM. In Release B it also creates personalised demo links. Server SDKs for Node, Python and Java will wrap this API later, in a future `scout-server-sdks` repo that has not been created yet.

There are two kinds of key. A **publishable key** sits in the page's HTML and anyone can see it. It can only do visitor things, and only from the client's allowed websites. A **secret key** stays on the client's server. It can read every session's data, so it must never reach a browser.

Teaching uses a third credential: an **admin token**. An admin gets one by signing in to Scout's console.

### The three parties

```
 CLIENT'S WEBSITE (visitor or admin browser)          SCOUT CLOUD (scout-cloud)                  CLIENT'S SERVER (optional)
 +----------------------------------------+          +--------------------------------+          +--------------------------+
 | client app page                        |          | Agent API    /v1/agent/*       |          | CRM sync, link creation  |
 |                                        |  HTTPS   |   publishable key + Origin     |  HTTPS   |                          |
 |  <script> @scout/agent loader          | -------> | Admin API    /v1/admin/*       | <------- | secret key (scout_sk_)   |
 |   - widget (Shadow DOM), chat, voice   |  pk key  |   admin token                  |  sk key  | server SDKs: PLANNED     |
 |   - recorder (teach mode only)         |  or      | Client API   /v1/client/*      |          | (Node, Python, Java)     |
 |   - runner + verifier (@scout/core)    |  admin   |   secret key                   |          +--------------------------+
 |   - tier-1 hints: data-scout-id        |  token   |                                |
 |   - tier 2: @scout/actions,            |          | model call (server only)       |
 |     @scout/react (optional)            |          | database                       |
 +----------------------------------------+          | console  app.scout.example     |
                                                      | hosted runner (Release B)      |
 MARKETING SITE (Release B)                           +--------------------------------+
 +----------------------------------------+                |
 | <script> @scout/embed loader, or an    |  link/iframe    | cloud browser runs the client's
 | iframe app.scout.example/d/<slug>/embed| <---------------+ product, with @scout/agent
 +----------------------------------------+   live stream     injected into that page
```

### Rules that hold across every part of this contract

- **The browser runs and verifies. The cloud decides and records.** An `ok: true` from an action means only "accepted". Only a verifier that sees the expected UI proves a step succeeded. **[P]**
- **The model only chooses.** It picks a published workflow and values for that workflow's declared inputs, or it answers, clarifies, or declines. Locators, CSS selectors and URLs inside a workflow come from an admin-reviewed recording, never from the model. **[P]**, extended to tier 0.
- **The browser re-checks every run decision against its own current catalog before acting.** **[P]**
- **Credentials.** Model credentials and secret keys live only on servers. **[P]**
- **Idle by default.** The runtime makes no network calls, polling, or DOM observation until a visitor opens the widget, an admin enters teach mode, a teach session is resuming after a page reload, or a run is resuming after a page reload. **[P]**: the performance rule in HLD §8.

---

## 2. Keys and identity

### 2.1 Credentials

| Credential | Format | Lives in | Can do | Cannot do |
|---|---|---|---|---|
| **Publishable key** **[N]** | `scout_pk_` + 24 random base62 chars | The client's HTML (script tag `data-project-key`) | Read the published config, start visitor sessions, request decisions, send session events | Read other sessions, transcripts or insights. Change workflows. Work from an origin that isn't allowlisted. |
| **Secret key** **[N]** | `scout_sk_` + 32 random base62 chars | The client's server environment only | Everything in the Client API (`/v1/client/*`) for one project | Anything when sent from a browser (see the rejection rule below) |
| **Admin token** **[N]** | Opaque, at least 32 random bytes, base64url | The console's memory (minted from the console's sign-in session, short-lived), or the teaching tab's `sessionStorage` | The Admin API for the projects and origin it is scoped to | Outlive its expiry. Read or create keys when it has `teach` scope. |
| **Session token** **[N]** | Opaque, at least 32 random bytes, base64url | The visitor tab's `sessionStorage` | Decisions and events for one session | Anything for another session |

How keys are stored and shown:

- **Prefix.** The `scout_` prefixes make leaked keys easy to grep for, and allow a secret-scanning pattern to be registered later (GitHub's partner programme or custom patterns). Until then, nothing detects them automatically.
- **Secret keys.** The cloud stores only a hash of each secret key. The console shows the key once, when it is created. After that, it shows only the last 4 characters.
- **Publishable keys.** These are not secret, so the console can show them at any time.
- **Keys belong to a project, not an organisation (a deliberate difference from Supersonik) [N].** Supersonik's server API key is organisation-scoped (BACKGROUND §3.3). Scout's secret key, like its budget and rate limits, is per project, and v1 has no account or organisation level above projects. So a client with several projects needs one secret key per project for CRM sync, and budgets and billing have no account total. v1 assumes one project per client; whether an account or organisation entity is needed is open (§7, question 21).

**Rejecting a secret key sent from a browser.** A request that carries a secret key *and* an `Origin` header gets `403 secret_key_in_browser`, and the key is flagged in the console. Browsers always send `Origin` on cross-origin requests. Server HTTP clients normally don't.

**How each credential is sent:**
- Publishable key: header `X-Scout-Key: scout_pk_…`. A GET request may use the query parameter `key=` instead, which avoids a CORS preflight.
- Secret key and admin token: header `Authorization: Bearer …`.
- Session token: header `X-Scout-Session: …`, or the field `sessionToken` in a `sendBeacon` body, because beacons can't set headers.
- Every value of `Authorization` is therefore secret-class. A publishable key never appears in that header.

### 2.2 Allowed origins

- **What an origin is.** A project lists exact origins, written as `scheme://host[:port]` in lowercase, with no path and no trailing slash. Example: `https://app.acme.com`. Local development needs an explicit entry, such as `http://localhost:3000`.
- **What the server checks.** On every Agent API request that carries a publishable key, the `Origin` header must equal one of the project's allowed origins. If it doesn't, the server returns `403 origin_not_allowed`.
- **Session-token-only events calls [N].** The events endpoint also accepts a valid session token alone (§3.3), without a publishable key. Those calls skip the allowlist check and are answered with CORS for the origin recorded at session start (`Session.page.origin`, §4.8), with `Vary: Origin`; any other `Origin` gets `403 origin_not_allowed`. A `sendBeacon` batch needs no CORS answer, because its response is never read.
- **CORS.** Allowed requests get `Access-Control-Allow-Origin: <that origin>` and `Vary: Origin`. No cookies are used and none are allowed (no `Access-Control-Allow-Credentials`).
  - Responses send `Access-Control-Expose-Headers: Retry-After, ETag`. Neither header is CORS-safelisted, so without this the widget's JavaScript couldn't read `Retry-After` on `429` / `503` or the config `ETag`.
  - Preflights (`OPTIONS`) answer `Access-Control-Allow-Headers: X-Scout-Key, X-Scout-Session, Authorization, Content-Type, If-Match`, `Access-Control-Allow-Methods` with the methods the endpoint supports, and `Access-Control-Max-Age`.
- **Hosted sessions (Release B, PROPOSED) [N].** They skip the allowlist (§3.6). A request with a runner-issued hosted session token gets `Access-Control-Allow-Origin` for the origin of the session's `experience.hosted.startUrl`, with `Vary: Origin`, and any other `Origin` gets `403 origin_not_allowed`. If the runner instead relays the agent's API calls itself, no CORS is needed; the choice is made in `scout-cloud/docs/CLOUD_DESIGN.md` §2.1.
- **Limit of the check.** The allowlist only stops *other websites* from using the key in visitors' browsers. A script outside a browser can fake the `Origin` header. The real protection against abuse is the rate limits and cost caps in §2.5.

### 2.3 Visitor identity

Visitors are anonymous by default.

- A session has a random `sessionId`.
- The SDK keeps the session in `sessionStorage`, so it survives page reloads in the same tab.
- **No cookies and no fingerprinting.** **[N]**
- **Optional identity.** `scout('identify', { memoryId, email })` attaches identity. `memoryId` is opaque. Email is personal data. Visitor identity data (`visitor.email`, `memoryId`) is never returned to publishable-key or teach-scope callers; it is readable only with a secret key (Client API) or a console-scope admin token. Teach scope does see what admins recorded: recordings and inputs' `example` values (§3.4), which can also be personal data the admin typed.
- **Memory across visits is PROPOSED** (an idea borrowed from Supersonik, not yet approved). It is off by default and needs the visitor's consent, following Supersonik's consent model. It reserves the names `visitor.memoryId` and `scout('memory', { consent })`. Memory is never authentication.

### 2.4 Admins and teach mode

Teaching means recording a workflow in the client's real product. It needs an admin, because a recording becomes something every visitor can trigger.

**Admin accounts** **[N]**:
- Admins sign in to the console at `https://app.scout.example`.
- The sign-in provider is not chosen yet; Clerk and Google OAuth are both options (§7).
- An admin has a role per project: `owner` or `admin`. Only an `owner` can manage keys, origins and other admins.

**Entering teach mode.** Teach mode is entered in the client's app. It needs both a URL switch and a sign-in **[N]**:

```
 1. Admin opens  https://app.acme.com/settings?scout=teach
    (or clicks "Teach on my site" in the console, which opens that URL)
 2. @scout/agent sees ?scout=teach, removes it from the URL (history.replaceState),
    and shows only a "Sign in to teach" button. No teach UI loads yet.
 3. Click -> popup:
    https://app.scout.example/teach/authorize?key=scout_pk_...&origin=https%3A%2F%2Fapp.acme.com&state=<random>
 4. Console: admin signs in. The console checks that the admin has a role on the project
    that owns the key, and that the origin is allowlisted.
 5. Console -> opener:
    postMessage({ source: "scout-console", type: "teach-token", state, token, expiresAt }, "<origin>")
 6. Agent accepts the message only if event.origin === "https://app.scout.example" and the
    state matches. It stores the token in sessionStorage under scout:<projectId>:teach.
 7. Teach mode is on: recorder, review, validation and publishing. Admin API calls send
    Authorization: Bearer <token>.
```

Why it works this way:
- **The URL switch is not a credential.** Anyone can type `?scout=teach`, and all they get is a sign-in button.
- **Why a popup rather than a cookie.** The client's domain and Scout's domain are different sites, and browsers block third-party cookies. A popup plus a `postMessage` that is checked against its origin works without cookies.

**Teach-scope tokens:**
- They are scoped to one project and one origin, and expire after **60 minutes** (PROPOSED). When one expires, the agent opens the popup again.
- They allow recordings, workflows, validation runs, publishing and the admin config.
- They do **not** allow keys, origins, facts or experiences; only the console manages those.

**Other rules:**
- Sessions started in teach mode have `type: "test"`.
- Admins should teach in a **demo or sandbox account**, because client apps can't be reset the way the prototype dashboard was. The prototype's "Reset & record" becomes *starting conditions* (§4.7).

### 2.5 Rate limits and protection against cost abuse

A publishable key is public, so anyone can call the Agent API. Each decision costs model tokens.

**Estimated cost per decision.** This is arithmetic, not a measurement.
- The prototype's instructions were about 670 input tokens with two workflows. That figure was reported in the planning conversation; it is not in the prototype's verification record.
- At $0.10 per million input tokens and $0.50 per million output tokens, one decision costs about $0.0001.
- A full catalog (20 workflows, 40 facts) might be 4,000–5,000 tokens, or about $0.0005 per decision.

**Defences, in order:**
1. Size limits on every request (§3.2), carried over from the prototype's `LIMITS`.
2. The model's catalog and facts are loaded **on the server** from the published config. The browser can't send its own instructions or facts. This changes the prototype (§5.1).
3. Rate limits, PROPOSED. Tune them with measurements.

   | Scope | Limit |
   |---|---|
   | `GET /v1/agent/config` | 60/min per IP |
   | `POST /v1/agent/sessions` | 20/hour per IP per project |
   | `POST /v1/agent/decide` | 20/min and 200/day per session; 1,000/hour per project |
   | `POST /v1/agent/sessions/{id}/events` | 120 events/min per session |
   | Admin API | 600/min per admin |
   | Client API | 600/min per secret key |

4. **Monthly model budget per project** (default $20, PROPOSED).
   - The console warns at 80%.
   - At 100%, decide returns `429 budget_exhausted`, and the widget says Scout is unavailable instead of failing silently.
5. Bot protection, such as a challenge on session creation, is an open question (§7).

When a rate limit is hit, the response is `429 rate_limited` with a `Retry-After` header in seconds.

---

## 3. Endpoints (v1)

### 3.1 Conventions

- **Base URL and format.** Everything is under `https://api.scout.example/v1`. Requests and responses are JSON (`Content-Type: application/json`), encoded as UTF-8.
  - **Pointing the agent at another Scout Cloud (PROPOSED) [N].** Development and the "test app against a local cloud" checkpoint need the browser runtime to call a non-production cloud, such as `http://localhost:4000`. The proposed names are the script attribute `data-api-origin` and the npm `createScout({ apiOrigin })` option, an origin (`scheme://host[:port]`, no path) defaulting to `https://api.scout.example`. To stop a page from quietly sending a visitor's messages elsewhere, a non-default value is honoured only by development builds of the agent, or only when the page itself is on an `http://localhost` origin; which of the two is open for review. The cloud's own `SCOUT_API_ORIGIN` is the server-side counterpart.
- **Field names are camelCase.** This matches the prototype's TypeScript types. Supersonik uses snake_case; we don't.
- **Times** are ISO 8601 strings in UTC, such as `"2026-10-13T09:15:00.000Z"`. Durations are integer milliseconds, with names ending in `Ms`.
- **IDs** are prefixed strings: `prj_`, `key_`, `ori_` (allowed origin), `adm_`, `exp_`, `rec_`, `val_`, `ses_`, `run_`, `lnk_`, `fct_`, `req_`.
- **Workflow ids** **[P]**: recorded workflows get the prototype's form `<slug>-<base36 time>`, such as `invite-teammate-mv6ga000`. The suffix is `Date.now().toString(36)`, which is 8 base36 characters in 2026 (and until the year 2059). Seeded or built-in ids without the time part, such as `invite-teammate`, are allowed too. All ids are at most 100 characters and match `^[a-z0-9][a-z0-9-]{0,99}$`. The model sees them, so they stay readable.
  - **[N]** The slug is truncated to 90 characters, and a trailing `-` is trimmed, before the suffix is added, so slug (≤ 90) + `-` + suffix (8) ≤ 99, within the 100-character limit. The prototype's `createWorkflowFromRecording` didn't truncate, so a 200-character title gave an id of about 210 characters, which this pattern and the `id` limit reject.
  - **[N]** Workflow ids are the one kind of id with no prefix, and they are **unique within a project**, not globally. Every project seeded from the Scout Sandbox can therefore have `invite-teammate`. Every API path that names a workflow is already under a project (`/v1/admin/projects/{projectId}/workflows/{workflowId}`), and the browser only ever sees its own project's workflows. Creating a workflow whose id already exists in the project (two recordings with the same title in the same millisecond, or a re-seed) returns `409 invalid_state`; the agent then makes a new suffix and retries once.
- **Success responses** are the resource itself or a named wrapper, such as `{ "sessions": [...] }`. They have no `ok` field.
- **Errors** use one shape on every endpoint. It is modelled on Supersonik's `{error, detail}`:

  ```json
  { "error": "origin_not_allowed", "detail": "https://evil.example is not an allowed origin for this project." }
  ```

  `error` is a stable machine code. `detail` is a sentence for people and may change.

| HTTP | `error` codes |
|---|---|
| 400 | `invalid_json`, `invalid_request` (shape or limits; `detail` names the field) |
| 401 | `missing_credentials`, `invalid_credentials`, `token_expired` |
| 403 | `origin_not_allowed`, `secret_key_in_browser`, `key_revoked`, `forbidden` (role or scope) |
| 404 | `not_found` (also used for resources in other projects, so their existence is never revealed) |
| 409 | `revision_conflict`, `invalid_state` (for example, publishing a revision that hasn't been validated) |
| 413 | `too_large` |
| 422 | `validation_failed` (semantic checks, for example an undeclared `$input`) |
| 429 | `rate_limited`, `budget_exhausted` (both with `Retry-After`) |
| 502 | `model_error` (model call failed or returned an unusable decision) |
| 503 | `unavailable` (with `Retry-After` when known, for example when the model provider is rate-limited or out of credit) |

- **Pagination on Client API lists.**
  - Request parameters: `limit` (1–100, default 25) and an opaque `cursor`.
  - Response: `{ "<items>": [...], "nextCursor": "…" | null }`.
  - Supersonik uses `page` numbers. Page numbers shift when new sessions arrive at the top of a newest-first list, and cursors don't.
- **Unknown fields.** Clients must ignore unknown response fields. Servers reject unknown request fields only where the endpoint says so; the decision schema is strict.

### 3.2 Size limits

These are carried over from the prototype's `LIMITS` (`core/decision.ts`) **[P]**, plus new ones **[N]**.

| What | Limit |
|---|---|
| Visitor message | ≤ 1,000 characters, and non-blank after trimming **[P]** (the prototype's `readScoutRequest` checks the length on the untrimmed string) |
| History sent with a decision | ≤ 8 turns, each ≤ 1,000 characters **[P]** |
| Workflows in one catalog (the model's catalog) | ≤ 20 **[P]**. This counts the published workflows plus, in `test` sessions, the workflows that have a `testing` revision. Each workflow appears once: in a `test` session its `testing` revision replaces its published one. The count is per project (published workflows plus workflows with a `testing` revision, each once), before any experience's `workflowIds` filter, which can only lower it; so an experience with `workflowIds: null` stays within the limit and editing `workflowIds` needs no check. Moving a revision to `testing` or `published` when that would take the count over 20 returns `409 invalid_state` **[N]**, so the server never builds a catalog that `readScoutRequest` rejects. |
| Facts per project | ≤ 40, each ≤ 500 characters **[P]** |
| Workflow `id` / `title` / `purpose` | ≤ 100 / 200 / 500 characters **[P]** |
| `examples` | ≤ 10, each ≤ 500 **[P]** |
| `inputs` | ≤ 10. `name` ≤ 50 and matches `^[a-z][A-Za-z0-9]*$`; `label` ≤ 100 **[P]**. `example` ≤ 200 **[N]**. |
| Input values | Every input value, whether a recorded `example`, a value decided by the model, or a value typed into a run form, is 1–200 characters after trimming **[N]**. One limit for all of them, because a value can fill a locator text field (≤ 200, below) as well as a `ui.type` value. `readDecision` turns a longer value into `clarify` (§5.3); `resolveWorkflow` rejects it. |
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

Every request is checked for the publishable key and an allowed `Origin`, with two exceptions **[N]**:

- **The events endpoint** (`POST …/sessions/{sessionId}/events`) accepts a valid session token alone, from the `X-Scout-Session` header or, for a `sendBeacon` batch, from the `sessionToken` field in the body. A beacon can't set headers, and the token was issued only after the key and origin were checked at session start.
- **Hosted sessions** (Release B, §3.6) send `X-Scout-Session` with a token the hosted runner created on the server. They carry no publishable key, and the origin allowlist does not apply.

#### `GET /v1/agent/config`

This returns what the runtime needs to run published workflows.

- **When it is called.** The runtime calls it when the visitor first opens the widget, when a saved run is resuming after a page reload, or when an admin enters teach mode (`?scout=teach`) or a teach session is resuming. Teach mode needs the response's `projectId` before any Admin API call (paths are `/v1/admin/projects/{projectId}/…`, and the token is stored under `scout:<projectId>:teach`, §2.4). It is not called on page load.
- **Query parameters:**
  - `key=scout_pk_…` (or the `X-Scout-Key` header)
  - `experience=<slug>` (optional; defaults to the project's default in-product experience)
  - `agentVersion=1.0.0`
  - `maxWorkflowVersion=3` (the highest workflow schema this agent can run)
- **Caching.** `ETag: "cfg-<configVersion>"` and `Cache-Control: private, max-age=60`. `If-None-Match` returns `304`.

```json
200
{
  "projectId": "prj_8f2k",
  "configVersion": 12,
  "experience": { "id": "exp_1", "slug": "default", "kind": "in_product",
                  "appearance": { "position": "bottom-right", "accentColor": "#2563eb", "launcherLabel": "Ask Scout" },
                  "language": "auto" },
  "workflows": [ /* PublicWorkflow (§4.4): the published revisions; inputs have no "example" */ ],
  "skipped": [ { "workflowId": "export-report-mv6ggfhc", "reason": "needs_newer_agent" } ],
  "limits": { "message": 1000, "history": 8 },
  "features": { "voice": true, "teach": true }
}
```

- **`example` is removed from inputs.** Recorded example values can be real data the admin typed, such as a colleague's email address. They are used only for validation, which goes through the Admin API.
- **Facts are not sent.** Facts stay on the server, because the browser doesn't need them.

#### `POST /v1/agent/sessions`

This starts a session. It is called once, when the visitor first interacts with Scout, not on page load. A session is pinned to the config version the browser loaded.

```json
request
{
  "experience": "default",
  "configVersion": 12,
  "agentVersion": "1.0.0",
  "page": { "path": "/settings", "title": "Settings · Acme" },
  "params": { "utm_source": "newsletter" },
  "language": "en-US",
  "visitor": { "memoryId": null, "email": null },
  "delivery": "in_product"
}
201
{
  "sessionId": "ses_4hq9",
  "sessionToken": "…",
  "type": "prod",
  "configVersion": 12,
  "expiresAt": "2026-10-14T09:15:00.000Z"
}
```

- **Teach-mode sessions.** If the request also carries `Authorization: Bearer <admin token>`, the session gets `type: "test"`. Its catalog then includes `testing` revisions as well as published ones.
- **`page.path` never includes the query string**, because query strings can contain tokens.
- **`params` are filtered.** Only `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ref`, and the project's extra allowlist are kept. Anything else is dropped without an error.
  - **Deliberately unlike Supersonik,** `email` and `utm_email` are not accepted as URL parameters in v1, because personal data in URLs ends up in logs and referrers. Visitor identity comes from `scout('identify', …)` in the client's own page (§2.3), or from server-created link context (Release B, §3.5 `POST /v1/client/links`).
- **Pinning.** `configVersion` may be older than the current one. Config snapshots are immutable, so the session is pinned to the version the browser actually loaded. This keeps the browser and the server's catalogs the same.
- **Expiry.** The session token lasts 24 hours. A session ends after 30 minutes with no events and no decide calls (PROPOSED): both update `lastActivityAt`, so a visitor who only chats keeps the session open.
- **Ended sessions (PROPOSED) [N].** A decide call on an ended session returns `409 invalid_state`, and the agent starts a new session and sends the message again once. An events call on an ended session (while its token is valid) is still accepted and recorded, without reopening the session, so a late `pagehide` beacon isn't lost.

#### `POST /v1/agent/decide`

This turns a visitor message into a decision. The full contract, including the strict schema, is in §5.

```json
request   (headers: X-Scout-Key, X-Scout-Session)
{
  "sessionId": "ses_4hq9",
  "requestId": "req_7",
  "message": "add priya@example.com as an admin",
  "history": [ { "role": "visitor", "text": "what can you do?" }, { "role": "scout", "text": "I can show…" } ],
  "source": "chat"
}
200
{
  "requestId": "req_7",
  "configVersion": 12,
  "decision": { "kind": "run", "workflowId": "invite-teammate", "inputs": { "email": "priya@example.com", "role": "Admin" },
                "message": "I'll invite priya@example.com as an Admin." },
  "modelMs": 2070
}
```

- **`history` is the turns before this message [P].** It holds the last ≤ 8 turns *before* the new visitor turn, as the prototype's `sendMessage` built it; the new text is sent only as `message`, never also as the last `history` turn.
- **`requestId` comes from the client.** It is a value the client increases with each message, like the prototype's `requestSeqRef` **[P]**. The server echoes it back, and the browser drops any reply whose id is not the latest.
- **What the server records.** The visitor turn and the decision's Scout turn, as `Turn`s.
- **Errors:** `400 invalid_request`, `401`/`403`, `429 rate_limited` / `budget_exhausted` (Scout's own limits), `502 model_error`, `503 unavailable` (with `Retry-After`; the model provider is rate-limited or out of credit).

#### `POST /v1/agent/sessions/{sessionId}/events`

This records what happened in the browser: runs, steps, locally generated Scout lines, and page views.

- **Batching.** Events are sent in batches.
- **When the page closes,** the runtime sends a final batch with `navigator.sendBeacon`. That request uses `Content-Type: text/plain` and puts `sessionToken` in the body. Beacons can't set headers, and `text/plain` avoids a preflight.

```json
request
{
  "sessionToken": "…",
  "events": [
    { "seq": 14, "type": "run.started",  "at": "…", "runId": "run_1", "workflowId": "invite-teammate", "revision": 3,
      "inputs": { "email": "priya@example.com", "role": "Admin" }, "guided": true, "requestId": "req_7" },
    { "seq": 15, "type": "step.settled", "at": "…", "runId": "run_1", "step": 1, "action": "ui.click",
      "ok": true, "elapsedMs": 1840 },
    { "seq": 19, "type": "run.finished", "at": "…", "runId": "run_1", "result": "completed", "stepsVerified": 5,
      "timings": { "modelMs": 2070, "firstChangeMs": 4100, "totalMs": 15300 } },
    { "seq": 20, "type": "turn",          "at": "…", "role": "scout", "text": "Done. priya@example.com now appears…",
      "source": "chat", "runId": "run_1" }
  ]
}
202
{ "accepted": 4, "lastSeq": 20 }
```

- **`seq` deduplicates.** It increases within each session. The server de-duplicates per `(sessionId, seq)`: an event whose `seq` it has already stored is ignored, so a retry is safe. It is not a high-water mark, because two batches can be in flight at once (a periodic batch and the `pagehide` beacon, or a retried batch after a later one succeeded) and may arrive out of order; a lower `seq` arriving late is still accepted. `lastSeq` in the response is the highest `seq` stored so far, for information only.

**Event types** **[N]**. This list is open-ended: new types may be added in v1, and servers keep unknown types without interpreting them.

| `type` | Fields |
|---|---|
| `run.started` | `runId`, `workflowId`, `revision`, `inputs`, `guided`, `requestId?` |
| `step.settled` | `runId`, `step` (1-based), `action`, `ok`, `error?`, `elapsedMs` (since the run started; the prototype's `StepLog.at` made relative) |
| `run.finished` | `runId`, `result` (`completed` \| `failed` \| `cancelled`), `failedStep?`, `error?`, `stepsVerified`, `timings` (`modelMs`, `firstChangeMs`, `totalMs`; measured, as in the prototype's chat meta) |
| `run.resumed` | `runId`, `step`. Sent after a full page reload, from the run state saved in `sessionStorage`. |
| `turn` | `role: "scout"`, `text`, `source`, `runId?`. Only for lines the runtime produces itself (outcome, "Stopped", failures); the server already recorded the visitor turns and the decision turns. |
| `page.viewed` | `path`, `title` |
| `session.ended` | `reason` (`pagehide` \| `closed` \| `idle`) |

### 3.4 Admin API: admin token

Paths look like `/v1/admin/projects/{projectId}/…`. The token must be scoped to that project.

**Who may call these:**
- `teach` scope (the token from teach mode): the endpoints marked **T** below.
- `console` scope (the console's own sign-in session): everything.

| Method and path | Scope | Purpose |
|---|---|---|
| `GET …/config` | T | Like the agent config, but includes `draft` and `testing` revisions and inputs *with* `example` (needed for validation). |
| `POST …/recordings` | T | Upload a teach-mode session log for review |
| `GET …/recordings/{recordingId}` | T | Read it back (for example to review in the console) |
| `DELETE …/recordings/{recordingId}` | T | Delete it. Recordings are also deleted automatically after 30 days (PROPOSED). |
| `GET …/workflows` | T | List workflows with their revisions and statuses |
| `POST …/workflows` | T | Create a workflow from a reviewed recording. Revision 1 starts as `draft`. |
| `GET …/workflows/{workflowId}` | T | One workflow: all revision summaries, plus the full latest revision |
| `PUT …/workflows/{workflowId}` | T | Save a new revision (new revisions are always `draft`). Requires `If-Match: "rev-<n>"`; returns `409 revision_conflict` if `n` isn't the latest. |
| `POST …/workflows/{workflowId}/validation-runs` | T | Report a validation replay. A pass on the latest revision moves it to `testing`, unless that would exceed the catalog limit (§3.2): then `409 invalid_state`. |
| `POST …/workflows/{workflowId}/publish` | T | `{ "revision": n }`. The revision must be `testing`, otherwise `409 invalid_state`. Bumps `configVersion`. |
| `POST …/workflows/{workflowId}/unpublish` | T | The published revision goes back to `testing`. Bumps `configVersion`. |
| `DELETE …/workflows/{workflowId}` | T | Archive (soft delete). Also unpublishes. |
| `GET` / `PUT …/facts` | console | Replace the whole list: `{ "facts": [{ "id"?: "fct_…", "text": "…" }] }`. Bumps `configVersion`. |
| `GET` / `POST` / `DELETE …/origins[/{originId}]` | console, owner | Manage allowed origins |
| `GET` / `POST …/keys`, `POST …/keys/{keyId}/revoke` | console, owner | Create and revoke keys. A new secret key is returned once. |
| `GET` / `POST` / `PATCH …/experiences[/{experienceId}]` | console | Manage experiences (§4.5). Bumps `configVersion` when a published experience changes. |

**Recording upload** (`POST …/recordings`).
- A recording is the teach-mode session log. Failed entries are kept so the admin can review them **[P]**.
- **Masking.** Values from masked fields are never in it (§4.6).

```json
request
{
  "sessionId": "ses_teach1",
  "startedAt": "…",
  "page": { "path": "/settings", "title": "Settings · Acme" },
  "agentVersion": "1.0.0",
  "entries": [
    { "step": { "action": "ui.click", "target": { /* Locator */ } }, "result": { "ok": true },
      "observed": [ { "kind": "visible", "target": { /* Locator of the dialog that appeared */ } } ] },
    { "step": { "action": "ui.type", "target": { /* Locator */ }, "input": { "value": "sam@example.com" } },
      "result": { "ok": true } }
  ]
}
201
{ "recordingId": "rec_2n", "expiresAt": "…" }
```

- **`entries` keep the prototype's `RecordedEntry { step, result }` shape [P].** Each entry gains `observed` **[N]**: the checks the recorder suggests, based on what changed after the human action. The admin confirms them in review, and they become the step's `expect`.

**Create from review** (`POST …/workflows`). The body is a `WorkflowDefinition` (§4.3) plus `"recordingId"`.
- The server checks the shape first. Then it checks that every `$input` refers to a declared input, every declared input is used, and the limits hold. Failures return `422 validation_failed`, with `detail` naming the problem.
- The response is `201` with the `Workflow` (§4.3) at revision 1, `draft`.

**Validation run** (`POST …/workflows/{workflowId}/validation-runs`):

```json
request
{
  "revision": 3,
  "agentVersion": "1.0.0",
  "page": { "origin": "https://app.acme.com", "path": "/settings" },
  "startedAt": "…", "finishedAt": "…",
  "values": "examples",
  "result": "passed",
  "steps": [ { "step": 1, "action": "ui.click", "ok": true, "elapsedMs": 610 } ],
  "error": null
}
201
{ "validationRunId": "val_9", "revisionStatus": "testing" }
```

- **The browser reports the result, and the cloud doesn't check it again.** In Release A, validation runs in the admin's own browser. The cloud records it as *admin-reported evidence*, together with the agent version and origin.
- **Release B could validate in a hosted browser,** which would give stronger evidence (§7).
- **`values`** says where the replay's input values came from.
  - `"examples"`: the recorded values, as in the prototype **[P]**.
  - `"examples+prompted"` **[N]**: the recorded values, plus values the admin typed at validation time for `masked` inputs (§4.3.1). Prompted values are used for that replay only and are never sent to the cloud.

### 3.5 Client API: server-facing, secret key

This part is modelled on Supersonik's documented client API (v1, last updated 2026-10-09). It must only be called from the client's server. Every call is scoped to the project the key belongs to.

#### `GET /v1/client/experiences`

This lists the project's experiences that are `published` or `testing`. It is not paginated; a project has few.

```json
200
{
  "experiences": [
    { "id": "exp_1", "slug": "default", "name": "In-product assistant", "kind": "in_product", "status": "published",
      "links": null, "updatedAt": "…" },
    { "id": "exp_2", "slug": "acme-tour", "name": "Acme product tour", "kind": "hosted", "status": "published",
      "links": { "page": "https://app.scout.example/d/acme-tour", "embed": "https://app.scout.example/d/acme-tour/embed" },
      "updatedAt": "…" }
  ]
}
```

The `hosted` kind and `links` arrive in **Release B**. In Release A, every experience is `in_product` and has `links: null`.

#### `POST /v1/client/links` (Release B)

This creates a personalised, reusable link to a hosted experience. Its context can't be changed after creation.

```json
request
{ "experienceSlug": "acme-tour", "context": { "company": "Globex", "plan": "Growth", "contactEmail": "jo@globex.com" } }
201
{ "id": "lnk_3x", "token": "lnk_3x9Qe…", "url": "https://app.scout.example/d/lnk_3x9Qe…", "createdAt": "…" }
```

- **Lifetime.** A link has no expiry. It keeps working while the experience is published.
- **Context.** `context` is any JSON up to 32 KB, nested at most 5 levels. It can't be edited; to change it, create a new link.
- **Name clash.** Tokens start with `lnk_`, and slugs may not, so `/d/<x>` is never ambiguous.
- **How context is used.** The decision model receives `context` as visitor context. It is data, never instructions. The session also records it.
- **Errors.** An experience that isn't `hosted` gives `422 validation_failed`. An unknown or unpublished slug gives `404 not_found`.

#### `GET /v1/client/sessions`

**Query parameters:**
- `limit`, `cursor`
- `startedFrom`, `startedTo` (ISO, inclusive)
- `updatedFrom` (ISO; picks up late changes such as insights)
- `type=prod|test` (may repeat; default `prod`)
- `validity=valid|invalid|unknown` (may repeat; default `valid` and `unknown`)
- `experience=<slug>`

Results are newest first, by `startedAt` and then by `id`.

**Incremental sync, Supersonik-style.** Store the newest `startedAt` (or `updatedAt`) you have seen. Pass it as `startedFrom` (or `updatedFrom`) next time, and de-duplicate by `id`.

```json
200
{
  "sessions": [
    { "id": "ses_4hq9", "experienceSlug": "default", "type": "prod", "delivery": "in_product",
      "startedAt": "…", "endedAt": "…", "updatedAt": "…", "validity": "valid",
      "configVersion": 12, "linkId": null, "visitor": { "email": null },
      "params": { "utm_source": "newsletter" }, "turnCount": 6, "runCount": 1 }
  ],
  "nextCursor": "c_…"
}
```

**What `validity` means** **[N]:**
- `unknown` until the session has ended and been processed.
- `invalid` if there was no visitor turn and no run, or the session was flagged as abuse.
- `valid` otherwise.

#### `GET /v1/client/sessions/{sessionId}`

This returns everything in the list item, plus:

```json
{
  "agentVersion": "1.0.0",
  "page": { "origin": "https://app.acme.com", "path": "/settings" },
  "context": null,
  "runs": [ { "id": "run_1", "workflowId": "invite-teammate", "revision": 3, "title": "Invite a teammate",
              "result": "completed", "stepsVerified": 5, "failedStep": null, "error": null,
              "startedAt": "…", "finishedAt": "…" } ],
  "insights": [ { "key": "buying_intent", "name": "Buying intent", "outputType": "choice", "value": "high",
                  "status": "ready", "generatedAt": "…" } ],
  "transcriptUrl": "https://api.scout.example/v1/client/sessions/ses_4hq9/transcript"
}
```

- `params` are the allowlisted query parameters. `context` is the link's context; it is `null` for in-product sessions.
- **Insights are PROPOSED** (not yet approved; definition and cost are open, §7 question 20). They would be generated after a session ends. Until then the list is empty.

#### `GET /v1/client/sessions/{sessionId}/transcript`

```json
200
{
  "sessionId": "ses_4hq9",
  "messages": [
    { "seq": 1, "role": "visitor", "text": "add priya@example.com as an admin", "source": "voice", "at": "…", "runId": null },
    { "seq": 2, "role": "scout",   "text": "I'll invite priya@example.com as an Admin.", "source": "voice", "at": "…", "runId": "run_1" }
  ]
}
```

- **Roles.** `role` keeps the prototype's `ChatTurn` roles, `visitor` and `scout` **[P]**. Supersonik instead uses the agent's display name, or the literal `'Participant'`.
- **Not paginated.** A session has at most 500 turns.

### 3.6 Hosted delivery URLs (Release B, PROPOSED)

These are not API endpoints. They are listed here so the names stay fixed.

| URL | Use |
|---|---|
| `https://app.scout.example/d/{slug}` | Plain link to a hosted experience |
| `https://app.scout.example/d/{slug}/embed` | Iframe (`allow="microphone; fullscreen"`, `allowfullscreen`, HTTPS only) |
| `https://app.scout.example/d/{linkToken}` | Personalised link from `POST /v1/client/links`. No `/embed` variant, as in Supersonik |

**The iframe tells its parent its height** with `postMessage({ source: "scout-embed", type: "resize", height }, "*")`. The parent page must accept it only when both checks pass:
- `event.origin === "https://app.scout.example"`
- `event.source === iframe.contentWindow`

**How the agent signs in on a hosted page.** In a hosted session, `@scout/agent` runs inside the cloud browser on the client's product page.
- The hosted runner creates the session on the server and injects its `sessionToken` into the page.
- The agent then uses `X-Scout-Session` without a publishable key, and the origin allowlist does not apply. CORS is answered only for the origin of the experience's `hosted.startUrl` (§2.2).
- How the runner's commands and the stream travel is defined in `scout-cloud/docs`, not here.

---

## 4. Data model

The **[P]** and **[N]** markers apply to each field. When a whole entity is new, it is marked once.

### 4.1 Project, AllowedOrigin, Key, Admin **[N]**

| Entity | Fields |
|---|---|
| `Project` | `id` (`prj_`), `name`, `createdAt`, `configVersion` (integer; increases with each published change), `defaultExperienceId`, `monthlyBudgetUsd`, `paramAllowlist: string[]` |
| `AllowedOrigin` | `id` (`ori_`), `projectId`, `origin` (exact, §2.2), `createdAt`, `createdBy` |
| `Key` | `id` (`key_`), `projectId`, `kind` (`publishable` \| `secret`), `label`, `last4`, `secretHash` (secret keys only), `createdAt`, `lastUsedAt`, `revokedAt`, `flaggedAt` (for example, after `secret_key_in_browser`) |
| `Admin` | `id` (`adm_`), `email`, `identityProviderId`, `roles: { projectId, role: "owner" \| "admin" }[]` |

### 4.2 Fact

| Field | Notes |
|---|---|
| `id` (`fct_`) | **[N]** |
| `text` | ≤ 500 characters. In the prototype a fact is a plain string in `dashboardFacts: string[]` **[P]**. |
| `order`, `updatedAt` | **[N]** |

- Facts are what Scout may say about the product. Recording workflows doesn't teach them **[P]**.
- They live on the server only. Any change bumps `configVersion`.

### 4.3 Workflow, WorkflowRevision, WorkflowDefinition

**In plain language.** A workflow is a saved, reviewed list of steps. Each edit makes a new **revision**. Visitors only ever see the one revision that is published. An edited revision has to be validated again before it can be published.

**`Workflow`** **[N]** (the container):

| Field | Notes |
|---|---|
| `id` | Recorded: prototype form `<slug>-<base36>`; seeded or built-in ids such as `invite-teammate` are allowed (§3.1) **[P]**. Unique within the project, not globally; a clash on create returns `409 invalid_state` (§3.1) **[N]** |
| `projectId` | **[N]** |
| `latestRevision`, `publishedRevision` | Integers. `publishedRevision` is `null` when the workflow is not live. |
| `createdAt`, `updatedAt`, `archivedAt` | |

**`WorkflowRevision`** = a `WorkflowDefinition` plus these fields:
- `workflowId`, `revision`, `status`, `createdBy`, `createdAt`, `recordingId?` **[N]**
- `lastValidationRunId?` **[N]**

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

**Statuses.** The status belongs to a revision **[N]**. It maps the prototype's `SavedWorkflow.enabled` onto Supersonik's testing and published states:

```
  save review / edit        validation passes          admin publishes
 --------------------> [draft] -----------------> [testing] -------------> [published]
                          ^          (this revision)    ^                       |
                          |                             +------ unpublish ------+
            any edit creates a NEW revision in draft;          publishing revision n retires
            the published revision keeps serving               the previously published one
                                                               -> [retired]
```

| Status | Who can run it | Prototype equivalent |
|---|---|---|
| `draft` | Admins, for validation only | `enabled: false` ("not validated") |
| `testing` | Admins, and `type: "test"` sessions (in their catalog) | `enabled: true` (the prototype had only one audience) |
| `published` | Everyone in the experience. At most one revision per workflow is published. | `enabled: true`, and the built-in workflows |
| `retired` | Nobody. Kept so that old sessions can still be explained. | none |

**Validation rule.** A revision becomes `testing` only after a `passed` ValidationRun on *that* revision. This carries the prototype's rule over: "enabled only after it replays successfully from Reset" **[P]**.

#### 4.3.1 Input

| Field | Notes |
|---|---|
| `name` | Matches `^[a-z][A-Za-z0-9]*$`. Unique within the workflow. **[P]** |
| `label` | Shown in clarifying questions, such as "I need: Email". **[P]** |
| `example` | The recorded value, which validation replays with. It is **removed** from the agent config and from the model's catalog. **[P]** Required, except on a `masked` input. |
| `masked?` | `true` when the value came from a masked or sensitive field (§4.6). A masked input has **no** `example`, because the value was never captured. Validation asks the admin for a value, uses it for that replay only, and reports `values: "examples+prompted"`. **[N]** |
| `allowedValues?` | `string[]`. If present, the model is told these values. `readDecision` turns any other value into `clarify` naming the allowed values; `resolveWorkflow` rejects it. **[N]**: planned in prototype LLD §20. |

**Rules carried over [P]:**
- Every declared input must have a value that isn't blank.
- Values for undeclared names are rejected by `resolveWorkflow`. `readDecision` instead drops them, and this difference is deliberate.
- A placeholder that names an undeclared input is an error.

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

**Placeholders** are `{ "$input": "<name>" }`: an object with exactly one key **[P]**.
- They can appear anywhere inside `input` and `expect`, and **[N]** inside `target` text fields. For example: "click the row whose text is `{ $input: "email" }`".
- `resolveWorkflow` fills them in before every run. The runner and verifiers never see a placeholder **[P]**.

**Reserved generic actions** (tier 0) **[N]**. They are handled by `@scout/agent`. No other binding may register an id starting with `ui.` or `page.`.

| `action` | `target` | `input` | Default check when `expect` is absent |
|---|---|---|---|
| `ui.click` | required | none | **None. A click must have at least one confirmed check in `expect`**, or validation fails with "Step N needs a check". |
| `ui.type` | required | `{ "value": string }`, the final value | The field's value equals `value` |
| `ui.select` | required | `{ "value": string }`, the option's `value` attribute. The option's visible label is kept on the recorded entry as `optionLabel` for review (§4.8), not in the step. | The selected value equals `value` |
| `ui.check` | required | `{ "checked": boolean }` | The checked state equals `checked` |
| `ui.press` | optional (default: the focused element) | `{ "key": "Enter" \| "Escape" \| "Tab" }` | None; needs `expect` |
| `page.navigate` | none | `{ "path": "/settings" }`, same-origin, recorded only, never from the model | The location's path equals `path` |

**Tier-2 steps** keep the prototype's shape exactly. An example is `{ "action": "invite.setEmail", "input": { "email": { "$input": "email" } } }`. They are verified by the binding's verifier registered under that action id **[P]**.

**Example tier-0 step** (version 3):

```json
{
  "action": "ui.type",
  "target": {
    "description": "Email field in the invite form",
    "strategies": [
      { "kind": "hint",  "id": "invite-email" },
      { "kind": "label", "text": "Email" },
      { "kind": "role",  "role": "textbox", "name": "Email" },
      { "kind": "css",   "selector": "#invite-email" }
    ]
  },
  "input": { "value": { "$input": "email" } },
  "narration": "I'll type the email address: {email}."
}
```

### 4.4 PublicWorkflow (agent config) and CatalogEntry (model)

These are two views of a published revision, for two readers.

- **`PublicWorkflow`** is a `WorkflowDefinition` plus `revision`, with `example` removed from every input. The browser runs it.
- **`CatalogEntry`** is the prototype's type, unchanged **[P]**: `{ id, title, purpose, examples, inputs: { name, label }[] }`, plus the new **[N]** optional `inputs[].allowedValues`. The model reads it. It never contains steps, locators or example values.

### 4.5 Experience **[N]**

An experience is a configured entry point. It is the equivalent of Supersonik's "launch config".

| Field | Notes |
|---|---|
| `id` (`exp_`), `projectId`, `slug`, `name` | A slug matches `^[a-z0-9][a-z0-9-]{0,63}$` and must not start with `lnk_`. |
| `kind` | `in_product` (Release A) \| `hosted` (Release B) |
| `status` | `testing` \| `published`. PROPOSED: anyone with the publishable key (in-product) or the URL (hosted) can load a `testing` experience, as Supersonik's testing launch configs can be opened; the status is not access control. Every session started on a `testing` experience is recorded with `type: "test"`, as Supersonik does for testing launch configs, so it never counts in the Client API's default `type=prod` sync. |
| `workflowIds?` | `null` means every published workflow |
| `appearance` | `{ position: "bottom-right" \| "bottom-left", accentColor, launcherLabel }`. More colour roles come later. |
| `language` | `"auto"` (from `navigator.languages`) or a BCP 47 tag |
| `hosted?` | Release B: `{ startUrl, browserContextId }`. Defined in `scout-cloud/docs`. |

Each project has one default `in_product` experience, created along with the project.

**Slug uniqueness.** `in_product` slugs are unique within their project, so every project can have `default`. `hosted` slugs appear in global URLs (`/d/{slug}`, §3.6), so they are unique **across all projects**, checked when the experience is created or renamed; a taken slug returns `409 invalid_state` **[N]**.

### 4.6 Locator and Check **[N]** (tier 0 and tier 1)

**In plain language.** Without tier-2 code, Scout has to find buttons and fields again on a later visit. It does this from a *description* saved during recording. It doesn't keep a pointer to the element, because the page will have been rebuilt by then. The description has several ways to find the element, tried in order. If none finds exactly one visible element, the step stops with a clear reason. It never guesses.

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

**How a locator is resolved.** For each strategy, in order:
1. Collect every match in the document. Scout's own Shadow DOM is excluded.
2. Keep only visible matches. "Visible" means the element has layout boxes and computed `visibility: visible`, the same test as the prototype's `isVisible` **[P]**.
3. If the locator has `within`, resolve the `within` locator first, by these same rules. It must give exactly one element. Keep only the matches inside it.
4. Exactly one match: stop trying strategies and check that element:
   - Inside `[data-scout-ignore]`: `ignored`, and the step fails at once with "<description> is off limits". Scout never acts on it.
   - The target of an action (not of a check) that is disabled, has `aria-disabled="true"`, or is inside a disabled fieldset: `disabled`, and the step fails at once.
   - Otherwise: use it.
5. Zero matches or more than one: try the next strategy.

**When no strategy gives exactly one match,** the result depends on what was found:
- Nothing was found by any strategy: `missing`. This is retried within the step's timeout, because the element might not have appeared yet. That follows the prototype's "absence can mean not yet" rule.
- Something was found more than once: `ambiguous`, and the step fails at once.

Failure messages name the locator's `description`.

**Recording order.** The recorder writes strategies in this order: `hint` first if the element has one, then `role`, `label`, `text`, `near`, and `css` last.

**Tier-1 attributes** are reserved **[N]**. The prototype's other `data-scout-*` names stay free for tier-2 bindings.

| Attribute | Meaning |
|---|---|
| `data-scout-id="<name>"` | A stable target name, unique on the screen. It is the `hint` strategy. |
| `data-scout-ignore` | Never record this element or anything inside it, and never act on it |
| `data-scout-mask` | Record actions on this field, but never its value. The value must become a declared input, or the step is dropped in review. |

**Privacy rule** **[N]:**
- The recorder never captures the value of `input[type=password]`, fields with `autocomplete` values `cc-*`, `one-time-code` or `current-password`/`new-password`, or `data-scout-mask` fields.
- Those values are never uploaded.

#### Check (the `expect` of tier-0 steps)

```ts
type Check =
  | { kind: "visible"; target: Locator }
  | { kind: "hidden";  target: Locator }
  | { kind: "text";    target: Locator; equals?: string | InputRef; includes?: string | InputRef }
  | { kind: "value";   target: Locator; equals: string | InputRef }
  | { kind: "url";     pathEquals?: string; pathMatches?: string };   // pathMatches: a recorded pattern like "/users/*"
```

A step passes only when **all** its checks pass within the step timeout.
- The timeout is 2,000 ms by default, polling every 50 ms, as in the prototype's `waitForCondition` **[P]**.
- These are settings, not measured latencies.

### 4.7 StartingConditions **[N]**

This replaces the prototype's "Reset before record and validate", because a client's app can't be wiped.

```ts
type StartingConditions = {
  path?: string;        // same-origin path to navigate to before step 1, e.g. "/settings"
  checks?: Check[];     // must pass before step 1; otherwise the run stops: "This demo needs …"
};
```

The recorder sets `path` to the page where recording started. The admin can edit it in review.

### 4.8 Session, Turn, Run, ValidationRun, Insight, Recording

**`Session`** **[N]:**

| Field | Notes |
|---|---|
| `id` (`ses_`), `projectId`, `experienceId` | |
| `type` | `prod` \| `test`. Teach-mode and admin sessions are `test`, and so is every session started on a `testing` experience (§4.5). |
| `delivery` | `in_product` \| `hosted_link` \| `hosted_embed` \| `embed_widget` |
| `configVersion`, `agentVersion` | Pinned at start, for reproducibility (§6.3) |
| `startedAt`, `lastActivityAt`, `endedAt`, `updatedAt` | |
| `page` | `{ origin, path, title }`, with no query string |
| `params` | The allowlisted query parameters |
| `context` | From a link; `null` otherwise |
| `linkId` | `null` unless the session came from a link |
| `visitor` | `{ memoryId?, email? }` |
| `validity` | `valid` \| `invalid` \| `unknown` |

**`Turn`** is the prototype's `ChatTurn { role, text }` **[P]**, plus these **[N]** fields:
- `sessionId`, `seq`, `at`
- `source` (`chat` \| `voice`)
- `decisionKind?`, `workflowId?`, `runId?`
- `modelMs?`

**`Run`** **[N]** is the record of the prototype's `RunResult` / `StepLog` **[P]**:
- `id` (`run_`), `sessionId`, `workflowId`, `revision`, `inputs`, `guided`
- `startedAt`, `finishedAt`
- `result` (`completed` \| `failed` \| `cancelled`), `failedStep`, `error`
- `steps: { step, action, ok, error?, elapsedMs }[]`
- `timings`

How it maps from the prototype:
- `StepLog.at` (`performance.now()`) becomes `elapsedMs`, measured from the start of the run.
- `RunResult.cancelled` becomes `result: "cancelled"`.

**`ValidationRun`** **[N]** has the same step shape as `Run`, plus:
- `id` (`val_`), `workflowId`, `revision`, `adminId`
- `agentVersion`, `page.origin`
- `result` (`passed` \| `failed` \| `cancelled`)
- `values: "examples" | "examples+prompted"`

**`Recording`** **[N]:**
- `id` (`rec_`), `projectId`, `sessionId`, `createdBy`, `startedAt`, `page`
- `entries: RecordedEntry[]`. Each entry is the prototype's `{ step, result }` **[P]** plus `observed: Check[]` **[N]** and, for `ui.select` only, `optionLabel?: string`, the chosen option's visible text **[N]**.
- `expiresAt`

**`InsightDefinition`** and **`Insight`** **[N]**, PROPOSED (not yet approved; not part of Release A's minimum):
- `InsightDefinition { key, name, outputType: "text" | "boolean" | "number" | "choice", choices?, instruction }`, defined per project.
- `Insight { sessionId, key, name, outputType, value, status: "pending" | "ready" | "failed", generatedAt, model }`.
- Insights are generated from the transcript after a session ends.

### 4.9 ConfigSnapshot **[N]**

This is an immutable record of what visitors could use at a given `configVersion`.

| Field | Notes |
|---|---|
| `projectId`, `configVersion`, `createdAt`, `createdBy` | |
| `workflows` | `{ workflowId, revision }[]`, the published revisions |
| `facts` | The fact texts at that version |
| `experiences` | The settings for each published experience |

`testing` experiences and `testing` revisions are not in any snapshot. A session on a `testing` experience, and the `testing` revisions in a `test` session's catalog, are read live at each request, not pinned (§6.3).

---

## 5. Decision contract

### 5.1 What carries over from the prototype, and what changes

**In plain language.** The model step works as it did in the prototype. Scout sends the model the visitor's message, recent chat, the facts, and the list of workflows. The model returns one strict JSON decision, and both sides check it.

One thing changes. The *server* now looks up the facts and workflow list from the published config, instead of trusting the browser to send them. A public key means anyone can call the endpoint. If they could send their own "facts", they could use Scout as a free general-purpose chatbot.

| | Prototype (`scout-demo` `POST /api/scout`) | v1 (`POST /v1/agent/decide`) |
|---|---|---|
| Browser sends | `ScoutRequest { message, history, workflows: CatalogEntry[], facts }` **[P]** | `{ sessionId, requestId, message, history, source }` |
| Catalog and facts | Sent from the browser | Loaded by the server from the session's `ConfigSnapshot`. For `test` sessions, `testing` revisions are added (read live, §6.3). Experience `workflowIds` filter applies. |
| Server builds | — | The same internal `ScoutRequest`, plus `context` (from a link) as visitor context |
| Model call | Server only, strict schema `scout_decision` | Unchanged |
| Server check | `readDecision(raw, request.workflows)` | Unchanged, plus the **[N]** `allowedValues` rule (§5.3), against the catalog the server built |
| Response | `{ ok: true, decision, modelMs }` or `{ ok: false, error }` | `{ requestId, configVersion, decision, modelMs }`, or the standard error shape |
| Browser check | `readDecision` against what is enabled now, then `resolveWorkflow` | Unchanged (§5.4) |

`readScoutRequest` and `readDecision` move into `@scout/core`, copied from `scout-demo` `lib/scout/core/decision.ts`. PROPOSED (pending Ayush): both the browser and `scout-cloud` import them from `@scout/core`, as the prototype shared one `decision.ts` between browser and server **[P]**; copying them into `scout-cloud` with provenance is the alternative.

**[N]** `readScoutRequest`'s catalog check (`readCatalogEntry`) is extended to keep and validate `inputs[].allowedValues` (≤ 20 values, each ≤ 100 characters, §3.2). The prototype's version rebuilt each input as `{ name, label }`, which would silently drop `allowedValues` from the server-built catalog, so the model would never see them and `readDecision`'s rule (§5.3) would have nothing to check.

### 5.2 Model output: the strict JSON schema **[P]**, unchanged

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["kind", "workflowId", "inputs", "message"],
  "properties": {
    "kind":       { "type": "string", "enum": ["run", "answer", "clarify", "unsupported"] },
    "workflowId": { "type": ["string", "null"] },
    "inputs": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "value"],
        "properties": { "name": { "type": "string" }, "value": { "type": "string" } }
      }
    },
    "message": { "type": "string" }
  }
}
```

- **Every field is always present**, because strict schemas require it.
- **`inputs` is a list of `{ name, value }` pairs,** because strict schemas can't have free-form keys. The server turns the pairs into `{ [name]: value }` before calling `readDecision`.
- **Kinds other than `run`** must have `workflowId: null` and `inputs: []`.
- **Model and effort.** These are chosen in exactly one server module, as `SCOUT_MODEL` was in the prototype. Today's values are `gpt-6-luna` with `DECISION_EFFORT = "low"` and `max_output_tokens: 400`. The model is a server setting, not part of this contract.

### 5.3 Decision returned to the browser **[P]**, unchanged

```ts
type ScoutDecision =
  | { kind: "run"; workflowId: string; inputs: Record<string, string>; message: string }
  | { kind: "answer" | "clarify" | "unsupported"; message: string };
```

What `readDecision` does (on both sides; copied from the prototype **[P]**, plus the **[N]** `allowedValues` rule):
- It returns `null` when:
  - the value isn't an object,
  - the message isn't a string of at most 1,000 characters,
  - the kind is unknown, or
  - the kind is `run` but `workflowId` isn't a string, or
  - the kind is `answer`, `clarify` or `unsupported` and the message is blank after trimming.
- A run whose message is blank after trimming gets the message `Showing <title>.`
- A run that names a workflow outside the catalog becomes `clarify`: "I'm not sure which demo you mean…".
- A run with a missing or blank declared input becomes `clarify`: `To show "<title>", I need: <labels>.`
- Input values are trimmed, and undeclared input names are dropped.
- **[N]** A value outside an input's `allowedValues` becomes `clarify` and names the allowed values.
- **[N]** A value longer than 200 characters after trimming (§3.2) becomes `clarify`, naming the input's label: `The value for <label> is too long.`

**What the message means for each kind:**
- For `run`, `message` is one short sentence of **intent**, such as "I'll invite…". It never claims success. Success is said only after every step is verified, using the workflow's `outcome` or "Done: <title>." **[P]**
- For `answer`, the message uses only facts **[P]**.

### 5.4 Browser re-check before acting **[P]**, extended

Before a run starts, the browser checks all of these in order. The first failure stops it with a clear message:

1. The reply's `requestId` is still the latest; a stale reply is dropped silently **[P]**. A new message, Stop, the microphone, starting a run, validation or teach mode, and the runtime being destroyed also cancel a pending request. The prototype also cancelled on any human action and on Reset; in v1 there is no Reset, and clicks in the host page are watched only during a run, so a host-page click while Scout is thinking does not cancel the request **[N]**.
2. `readDecision(decision, currentCatalog)` gives the same kind. `currentCatalog` means the workflows in the agent config this tab loaded, and only those whose schema `version` this agent supports **[N]**.
3. `resolveWorkflow(workflow, decision.inputs)` succeeds **[P]**.
4. **[N]** Tier 2: every registered `action` in the steps exists in the current binding. Tier 0: `startingConditions` can be reached.
5. During the run, each step still goes through: run still active → act → verify within a bounded timeout → log **[P]**.

---

## 6. Versioning and compatibility

The word "version" means different things in different places. These are kept separate:

| Name | What it versions | Where it appears |
|---|---|---|
| **API version** | The HTTP contract | The path: `/v1/` |
| `version` (workflow) | The **schema** of a `WorkflowDefinition` | The field `version` (kept from the prototype) **[P]** |
| `revision` | One workflow's content, increasing with each edit | `WorkflowRevision.revision`, run records, validation runs **[N]** |
| `configVersion` | Everything visitors could use in a project at that moment | Snapshots, sessions, the config `ETag` **[N]** |
| `agentVersion` | The `@scout/agent` build that ran | Sessions, validation runs, recordings **[N]** |

### 6.1 API version

- The version is in the path: `/v1/…`.
- **Within v1, only additive changes are allowed:** new endpoints, new optional request fields, new response fields, new error codes, and new event types.
- **Closed enums** don't gain values within v1. These are `ScoutDecision.kind`, `WorkflowRevision.status`, `Session.type` and `Run.result`. A browser treats an unknown `kind` as an unusable reply, because `readDecision` returns `null`.
- **Breaking changes go to `/v2`.** v1 stays available for at least 6 months after v2 ships (PROPOSED). Deprecated endpoints send the `Deprecation` and `Sunset` response headers.

### 6.2 Workflow schema version

| `version` | Shape | Status |
|---|---|---|
| 1 | `id`, `title` and steps only | Prototype legacy. Read and upgraded in memory to v2 with empty `purpose`, `examples` and `inputs`, as `workflow-store.ts` did **[P]**. |
| 2 | Adds `purpose`, `examples`, `inputs`, `$input`, step `narration` and `outcome` | What the prototype writes **[P]** |
| 3 | Adds step `target`, the reserved `ui.*` and `page.*` actions, `Check[]` as `expect`, `startingConditions`, `inputs[].allowedValues` and `inputs[].masked` | PROPOSED **[N]** |

Compatibility rules:
- **Readers** accept every version up to the highest they know, and upgrade older ones in memory.
- **Writers** always write the latest version.
- **An agent that receives a newer version than it knows** doesn't run that workflow. The config endpoint also reports it in `skipped` with `reason: "needs_newer_agent"`, using the `maxWorkflowVersion` the agent sent.
- **Saved data is untrusted.** Workflow JSON from storage or from the network is shape-checked on load, as `isWorkflow` did in the prototype **[P]**. This applies on the server when saving and in the browser when loading config.

### 6.3 Config version per session

This works like Supersonik's `agent_config_version`.

- **What bumps it.** Publishing or unpublishing a workflow, replacing facts, or changing a published experience each increases `Project.configVersion` by one. Each also writes a `ConfigSnapshot`.
- **Sessions are pinned.** A session records the `configVersion` it started with and uses that snapshot for every decision. For a `prod` session on a published experience, a publish in the middle of the session therefore never changes what that session's model or browser sees.
- **What is not pinned [N].** `testing` revisions and `testing` experiences are not in snapshots (§4.9), so a `test` session reads its `testing` revisions, and a session on a `testing` experience reads that experience's settings, live at each request.
- **Reproducibility.** The session, transcript and runs can be explained later from the snapshot and the workflow revisions.

### 6.4 Agent version and the loader

- **The script tag loads a small loader at a stable path:** `https://cdn.scout.example/agent/v1/loader.js`. The loader then loads an exact runtime build, such as `https://cdn.scout.example/agent/1.0.0/agent.js`. The loader only moves within major version 1.
- **npm.** Clients who install from npm (`@scout/agent`, `@scout/react`, `@scout/actions`) pin exact versions themselves.
- **The runtime sends `agentVersion`** on config, session, recording and validation calls.
- **Storage keys use the prefix `scout:`** (§8). The new runtime never reads `scout.workflows.v1`. Whether prototype workflows move over at all, by an explicit import or by re-teaching, is open (§7, question 19).

---

## 7. Open questions

These need a decision. None is decided by this document.

1. **Domain.** What are the real hosts behind `api`, `cdn` and `app.scout.example`?
2. **Admin sign-in provider.** Clerk or Google OAuth? This also decides how the console session is stored.
3. **scout-cloud stack.** Reuse Next.js route handlers, or build a separate API service? It is still pending approval.
4. **Database.** SQLite first, then Postgres, has been suggested. It is pending approval.
5. **Wildcard origins.** Should `https://*.acme.com` be allowed, or exact origins only, as in v1?
6. **Server-built history.** The server already stores turns. Should decide use the server's last 8 turns instead of trusting the browser's `history`?
7. **Context in-product.** Should Release A have a browser `scout('context', {...})` command? That context would be untrusted. Or should context come only from server-created links in Release B?
8. **Prefilled inputs.** Should link `context` be able to pre-fill declared inputs, for example `context.contactEmail` → `email`? Or should it only be shown to the model?
9. **Tier-2 workflows defined in code.** Prototype built-ins lived in code. In v1 the model's catalog is server-side. Should code-defined workflows be uploaded with an admin CLI, or pushed by `@scout/actions` at startup with an admin token? Or must every model-selectable workflow be taught or created in the console?
10. **Where validation runs.** In Release A it is admin-reported, in the admin's browser. In Release B, should publishing require a validation in a hosted browser?
11. **Personal data.** Should run `inputs` and transcripts be stored, and for how long? Is per-project redaction needed? Where is the data stored (region)?
12. **Bot protection.** Is a challenge needed on `POST /v1/agent/sessions`, such as Cloudflare Turnstile? What should the default budgets and rate limits be after measurement?
13. **Pagination.** Cursor (proposed) or Supersonik-style page numbers? Server SDK users may expect either.
14. **Validity rules.** Beyond "no visitor turn and no run", what makes a session `invalid`?
15. **Test and live keys.** Should keys be split by environment (`scout_pk_test_` and `scout_pk_live_`), or is the `prod`/`test` session `type` enough?
16. **Webhooks and Slack.** Should `session.ended` and `insights.ready` webhooks, Slack notifications or an MCP server be added? They are later work, and nothing in v1 depends on them.
17. **Content Security Policy.** Can the client's CSP stay at `script-src https://cdn.scout.example` and `connect-src https://api.scout.example`? Or does the widget's Shadow DOM styling need a `style-src` allowance? Constructable stylesheets need to be tested on the target browsers. Cloud speech-to-text or text-to-speech would add a media host.
18. **Both scripts on one page.** Can the `@scout/agent` loader and the `@scout/embed` loader run on the same page? Both use the `scout` global; v1 doesn't support loading both.
19. **Importing prototype workflows.** The prototype's `localStorage` workflows have no locators. Is a one-time importer for tier-2 rehearsal apps worth building, or should those workflows be taught again?
20. **Insights.** Who defines the insights, the client or a fixed default set? What does generating them cost per session?
21. **Account or organisation level.** Keys, budgets and rate limits are per project, and v1 assumes one project per client (§2.1). Does a client with several projects need an account or organisation entity above projects, for one secret key across projects, account-level budgets and billing, and shared admins?

---

## 8. Names index

Every new doc uses these exact names.

| Kind | Names |
|---|---|
| Repos | `scout-demo` (frozen at `aafd6a2`), `scout-js`, `scout-cloud`, `scout-server-sdks` (future) |
| Packages (`scout-js`) | `@scout/core`, `@scout/agent`, `@scout/actions`, `@scout/react`, `@scout/embed`. Tier 1 is the `data-scout-*` hint convention (`data-scout-id`, `data-scout-ignore`, `data-scout-mask`); it has no package. |
| Tiers | Tier 0: recorded by element description (`@scout/agent`). Tier 1: `data-scout-*` hints. Tier 2: actions registered in code (`@scout/actions`, `@scout/react`). |
| Releases | Release A: in-product script tag. Release B: hosted demos (link, iframe, `@scout/embed`). |
| Hosts (placeholders) | `https://api.scout.example`, `https://cdn.scout.example`, `https://app.scout.example` |
| API namespaces | `/v1/agent/*` (publishable key), `/v1/admin/*` (admin token), `/v1/client/*` (secret key) |
| Credentials | `scout_pk_…`, `scout_sk_…`, admin token (`teach` and `console` scopes), session token |
| Headers | `X-Scout-Key`, `X-Scout-Session`, `Authorization: Bearer`, `If-Match: "rev-<n>"`, `ETag: "cfg-<n>"`, `Retry-After` |
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
